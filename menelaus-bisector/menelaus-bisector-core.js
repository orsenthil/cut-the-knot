"use strict";

/*
 * Menelaus Bisector — the geometry behind Bogomolny's applet
 * "Ceva and Menelaus Theorems for Angle Bisectors".
 *
 * At each corner of a triangle there are two angle bisectors: one inside and
 * one outside. Pick one at each corner. The three lines meet in one point
 * exactly when an even number of the picks is external (0 or 2); the three
 * points where they cross the opposite sides (or their extensions) are
 * collinear exactly when an even number of the picks is internal (0 or 2).
 * The key idea is that a bisector at A cuts BC in the signed ratio
 * -c/b when external and +c/b when internal, where a = |BC|, b = |CA|,
 * c = |AB|; the product round the triangle is therefore (-1)^(external picks).
 *
 * This is the geometry and nothing else: no document, no window, no storage.
 * It defines one global, MenelausBisectorCore, so the page loads it with a
 * plain <script> and porting/check-menelaus-bisector.mjs loads it in Node.
 * Positions and results are plain data in the SVG's viewBox units. The
 * construction follows the applet's bytecode: GeoSDoub.FindIncenter,
 * FindExcenter, ComputeAngle, FindOrientation, Rotate and Intersect, then
 * MenelausBisectorCanvas.DrawBisectors and ShowPoints.
 */
const MenelausBisectorCore = (() => {
  // The four checkboxes of MenelausBisectorPanel, in the panel's own order.
  const MODES = ["I3E0", "I2E1", "I1E2", "I0E3"];
  // The applet's canvas is sized by getSize(); these are the page's SVG units.
  const WIDTH = 480;
  const HEIGHT = 320;
  const NAMES = ["A", "B", "C"];
  // GeoSDoub.Intersect returns NaN when |denominator| < 1 (a pixel's worth).
  const INTERSECT_EPS = 1;
  const EPS = 1e-9;

  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const nanPoint = () => ({ x: NaN, y: NaN });

  /** GeoSDoub.ComputeAngle(v,p,q) — the unsigned angle at v, in radians. */
  function computeAngle(v, p, q) {
    const s3 = (sqDist(v, p) + sqDist(v, q) - sqDist(p, q)) / 2;
    const s5 = s3 / (dist(v, p) * dist(v, q));
    return Math.acos(s5);
  }

  /** GeoSDoub.FindOrientation(a,b,c): +1 for a left turn, -1 otherwise. */
  function orientation(a, b, c) {
    const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(a,b,t,o): turn b about a by t, with orientation o. */
  function rotate(a, b, t, o) {
    const cs = Math.cos(t), sn = Math.sin(t);
    return {
      x: a.x + cs * (b.x - a.x) - o * sn * (b.y - a.y),
      y: a.y + o * sn * (b.x - a.x) + cs * (b.y - a.y),
    };
  }

  /** GeoSDoub.Intersect of the infinite lines a-b and c-d. */
  function intersect(a, b, c, d) {
    const s4 = a.y - b.y, s6 = b.x - a.x, s8 = a.x * b.y - a.y * b.x;
    const s10 = c.y - d.y, s12 = d.x - c.x, s14 = c.x * d.y - c.y * d.x;
    const s16 = s6 * s14 - s12 * s8;
    const s18 = s8 * s10 - s14 * s4;
    const s20 = s4 * s12 - s10 * s6;
    if (Math.abs(s20) < INTERSECT_EPS) return nanPoint();
    return { x: s16 / s20, y: s18 / s20 };
  }

  /** GeoSDoub.FindIncenter(a,b,c): two internal half-angle bisectors meet. */
  function findIncenter(a, b, c) {
    const ha = computeAngle(a, b, c) / 2;
    const hb = computeAngle(b, c, a) / 2;
    const o = orientation(a, b, c);
    return intersect(a, rotate(a, b, ha, o), b, rotate(b, c, hb, o));
  }

  /** GeoSDoub.FindExcenter(a,b,c): external bisectors at b and c; opposite a. */
  function findExcenter(a, b, c) {
    const s7 = (Math.PI - computeAngle(b, a, c)) / 2;
    const s9 = (Math.PI - computeAngle(c, a, b)) / 2;
    const o = orientation(b, a, c);
    return intersect(b, rotate(b, c, s7, o), c, rotate(c, b, s9, -o));
  }

  function zeros() {
    return { I3E0: false, I2E1: false, I1E2: false, I0E3: false };
  }

  /**
   * MenelausBisectorCanvas.init(): with a w by h canvas, the corners are
   * (w/2, h/4+20), (w/2, h/3+20), (w/2+w/5, h/2-h/20+20). The four
   * checkboxes start unchecked, as in the panel's constructor.
   */
  function start(options) {
    const src = options || {};
    const w = src.width === undefined ? WIDTH : src.width;
    const h = src.height === undefined ? HEIGHT : src.height;
    const corners = src.corners
      ? { A: copy(src.corners.A), B: copy(src.corners.B), C: copy(src.corners.C) }
      : {
        A: { x: w / 2, y: h / 2 - h / 4 + 20 },
        B: { x: w / 2, y: h / 2 - h / 6 + 20 },
        C: { x: w / 2 + w / 5, y: h / 2 - h / 20 + 20 },
      };
    const modes = zeros();
    if (src.modes) for (const m of MODES) if (src.modes[m] !== undefined) modes[m] = !!src.modes[m];
    return { corners, modes };
  }

  /** Moving a vertex keeps the checkboxes and the other two vertices. */
  function moveCorner(pos, name, p) {
    if (!pos.corners[name]) return pos;
    return { corners: { ...pos.corners, [name]: copy(p) }, modes: { ...pos.modes } };
  }

  /** MenelausBisectorPanel.itemStateChanged(): copy all four checkbox states. */
  function setModes(pos, values) {
    const modes = zeros();
    for (const m of MODES) modes[m] = !!(values && values[m]);
    return { corners: { ...pos.corners }, modes };
  }

  function toggleMode(pos, mode, on) {
    if (!MODES.includes(mode)) return pos;
    return { corners: { ...pos.corners }, modes: { ...pos.modes, [mode]: on === undefined ? !pos.modes[mode] : !!on } };
  }

  /**
   * DrawBisectors(): all the centers and crossings, whether or not they are
   * currently shown. internal[i] is the line from corner i to the incenter;
   * external[i] is the exterior bisector at corner i; intFeet[i] / extFeet[i]
   * are where those lines meet the opposite side.
   */
  function compute(pos) {
    const { A, B, C } = pos.corners;
    const I = findIncenter(A, B, C);
    const Ia = findExcenter(A, B, C);
    const Ib = findExcenter(B, C, A);
    const Ic = findExcenter(C, A, B);
    const sides = [[B, C], [A, C], [A, B]];
    const internal = [[A, I], [B, I], [C, I]];
    const external = [[Ib, Ic], [Ic, Ia], [Ia, Ib]];
    const intFeet = internal.map((line, i) => intersect(line[0], line[1], sides[i][0], sides[i][1]));
    const extFeet = external.map((line, i) => intersect(line[0], line[1], sides[i][0], sides[i][1]));
    return {
      corners: { A, B, C }, I, Ia, Ib, Ic, sides, internal, external, intFeet, extFeet,
    };
  }

  /** The exact paint conditions in DrawBisectors() and ShowPoints(). */
  function visible(pos, c) {
    const m = pos.modes;
    return {
      internalLines: m.I3E0 || m.I2E1 || m.I1E2,
      externalLines: m.I2E1 || m.I1E2 || m.I0E3,
      externalLine: m.I0E3,           // magenta line through extFeet[0], extFeet[1]
      internalTriangle: m.I2E1,       // red triangle of all three internal feet
      centers: (m.I3E0 ? [c.I] : []).concat(m.I1E2 ? [c.Ia, c.Ib, c.Ic] : []),
      feet: (m.I0E3 || m.I2E1 ? c.extFeet : []).concat(m.I2E1 ? c.intFeet : []),
    };
  }

  /** All ways of choosing which corners get an external bisector. */
  function subsets(k) {
    const out = [];
    for (let mask = 0; mask < 8; mask++) {
      let bits = 0;
      for (let i = 0; i < 3; i++) if (mask & (1 << i)) bits++;
      if (bits === k) out.push([0, 1, 2].filter((i) => mask & (1 << i)));
    }
    return out;
  }

  /** The one-bisector-per-corner choices named by each checkbox. */
  function choices(mode) {
    return {
      I3E0: subsets(0), I2E1: subsets(1), I1E2: subsets(2), I0E3: subsets(3),
    }[mode] || [];
  }

  /** The signed Ceva/Menelaus product straight from the side lengths. */
  function product(pos, externalAt) {
    const { A, B, C } = pos.corners;
    const a = dist(B, C), b = dist(A, C), c = dist(A, B);
    const signed = [c / b, a / c, b / a]; // at A, B, C respectively
    let p = 1;
    for (let i = 0; i < 3; i++) {
      p *= signed[i];
      if (externalAt && externalAt.includes(i)) p *= -1;
    }
    return p;
  }

  /** The three chosen bisector lines and their feet on the opposite sides. */
  function chosen(pos, c, externalAt) {
    const lines = [];
    for (let i = 0; i < 3; i++) {
      lines.push(externalAt && externalAt.includes(i) ? c.external[i] : c.internal[i]);
    }
    const feet = lines.map((line, i) => intersect(line[0], line[1], c.sides[i][0], c.sides[i][1]));
    const p = intersect(lines[0][0], lines[0][1], lines[1][0], lines[1][1]);
    const concurrent = finite(p) && finite(feet[0]) && finite(feet[1]) && finite(feet[2]) &&
      Math.abs((p.x - lines[2][0].x) * (lines[2][1].y - lines[2][0].y) -
        (p.y - lines[2][0].y) * (lines[2][1].x - lines[2][0].x)) < 1e-4 * Math.max(1, dist(lines[2][0], lines[2][1]));
    const det = (q, r, s) =>
      (r.x - q.x) * (s.y - q.y) - (r.y - q.y) * (s.x - q.x);
    const collinear = finite(feet[0]) && finite(feet[1]) && finite(feet[2]) &&
      Math.abs(det(feet[0], feet[1], feet[2])) < 1e-5 * Math.max(1,
        dist(feet[0], feet[1]) * dist(feet[1], feet[2]));
    return { lines, feet, point: p, concurrent, collinear, product: product(pos, externalAt) };
  }

  /** For each of the eight choices, compare the product with the drawn lines. */
  function checkClaims(pos) {
    const c = compute(pos);
    const out = [];
    for (let mask = 0; mask < 8; mask++) {
      const externalAt = [0, 1, 2].filter((i) => mask & (1 << i));
      const r = chosen(pos, c, externalAt);
      out.push({
        externalAt,
        internalCount: 3 - externalAt.length,
        externalCount: externalAt.length,
        product: r.product,
        concurrent: r.concurrent,
        collinear: r.collinear,
        productSaysConcurrent: Math.abs(r.product - 1) < 1e-9,
        productSaysCollinear: Math.abs(r.product + 1) < 1e-9,
      });
    }
    return out;
  }

  /** A short status sentence for the selected checkboxes. */
  function describe(pos) {
    const active = MODES.filter((m) => pos.modes[m]);
    if (!active.length) return "The triangle is empty. Check a box to draw angle bisectors.";
    const c = compute(pos);
    const v = visible(pos, c);
    const names = {
      I3E0: "3 internal, 0 external: the three lines meet at one point",
      I2E1: "2 internal, 1 external: two internal feet and one outside foot line up",
      I1E2: "1 internal, 2 external: the chosen three lines meet at one point",
      I0E3: "0 internal, 3 external: the three outside feet line up",
    };
    if (active.length > 2) {
      return active.length + " bisector selections are drawn at once. Untick boxes to study one choice at a time.";
    }
    const parts = active.map((m) => names[m]);
    if (v.internalTriangle) parts.push("the red triangle joins all three internal feet, not the collinear triple");
    return parts.join(". ") + ".";
  }

  /** An illustration has no winner and no loser. */
  function result() { return null; }

  return {
    MODES, NAMES, WIDTH, HEIGHT, INTERSECT_EPS,
    sqDist, dist, finite, computeAngle, orientation, rotate, intersect,
    findIncenter, findExcenter, start, moveCorner, setModes, toggleMode,
    compute, visible, subsets, choices, product, chosen, checkClaims, describe, result,
  };
})();
