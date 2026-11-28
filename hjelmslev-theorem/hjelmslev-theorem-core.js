"use strict";

/*
 * Hjelmslev Theorem — the illustration behind Alexander Bogomolny's applet
 * HjelmslevTheorem (cut-the-knot.org/Curriculum/Geometry/HjelmslevTheorem.shtml).
 *
 * Two black segments A1B1 and A2B2 are drawn. For each fraction u = i/10 the
 * applet marks the point M_i = r * P1_i + (1 - r) * P2_i, where P1_i and P2_i
 * are the matching points on the two segments. The page claims these eleven
 * points are collinear or all coincide — Hjelmslev's theorem for r = 1/2,
 * and the affine generalisation for every other r.
 *
 * The key idea is that M_i is itself an affine image of a point on a segment:
 * M_i = A_r + (B_r - A_r) * u, with A_r = r*A1 + (1-r)*A2 and
 * B_r = r*B1 + (1-r)*B2. So the marks lie on the segment A_r B_r; when
 * A_r = B_r they have nowhere to spread and all coincide. No distance or
 * angle is used, which is why an isometry is more than enough: any affine
 * matching of the two segments works.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, HjelmslevTheoremCore, so the page loads it
 * with a plain <script> and porting/check-hjelmslev-theorem.mjs loads it in
 * Node. Positions are plain data and functions never change what they get.
 */
const HjelmslevTheoremCore = (() => {
  const EPS = 1e-9;
  const N = 10;                       // the applet's Draw(): i = 0..10
  const WIDTH = 500, HEIGHT = 400;    // the page's applet parameters
  const PHI = 2.0943951023931953;     // init(): 2*pi/3
  const TURN = 1.3463968515384828;    // init(): the second segment's turn
  const S_MIN = 0, S_MAX = 1.01;      // PVNumeric.setMinValue / setMaxValue
  const S_STEP = 0.01, S_DEFAULT = 0.5;
  const NAMES = ["A1", "B1", "A2", "B2"];
  const PARTNER = { A1: "B1", B1: "A1", A2: "B2", B2: "A2" };
  const SEGMENTS = ["A1B1", "A2B2"];

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

  /** The applet's Average(a, b) with its field S. */
  const average = (a, b, s) => s * a + (1 - s) * b;

  /** The applet's Midpoint(p, q): the same weighted combination, point-wise. */
  const weighted = (p, q, s) => ({ x: average(p.x, q.x, s), y: average(p.y, q.y, s) });

  /** The applet's InnerPoint(A, B, i, n) = A + (B - A) * i / n. */
  function innerPoint(a, b, i, n) {
    return { x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n };
  }

  function copyPoint(p) { return { x: p.x, y: p.y }; }

  function copy(s) {
    const out = {};
    for (const name of NAMES) out[name] = copyPoint(s[name]);
    out.s = s.s;
    out.showNames = Boolean(s.showNames);
    out.keepEqual = Boolean(s.keepEqual);
    out.fixLength = Boolean(s.fixLength);
    return out;
  }

  /** The starting picture, placed exactly as HjelmslevTheoremCanvas.init(). */
  function start(options) {
    const o = options || {};
    if (o.points) {
      const out = copy(start({}));
      for (const name of NAMES) out[name] = copyPoint(o.points[name]);
      out.s = clamp(Number.isFinite(o.s) ? o.s : S_DEFAULT, S_MIN, S_MAX);
      if (o.showNames !== undefined) out.showNames = Boolean(o.showNames);
      if (o.keepEqual !== undefined) out.keepEqual = Boolean(o.keepEqual);
      if (o.fixLength !== undefined) out.fixLength = Boolean(o.fixLength);
      return out;
    }
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const cx = width / 2;
    const cy = height / 2 - 20;
    const len = Math.min(width, height) / 3;
    const A1 = { x: cx, y: cy };
    const B1 = { x: cx + len * Math.cos(PHI), y: cy + len * Math.sin(PHI) };
    const phi2 = PHI + TURN;
    const dx = (len / 2) * Math.cos(phi2);
    const dy = (len / 2) * Math.sin(phi2);
    return {
      A1, B1,
      A2: { x: A1.x + dx, y: A1.y + dy },
      B2: { x: B1.x + dx, y: B1.y + dy },
      s: clamp(Number.isFinite(o.s) ? o.s : S_DEFAULT, S_MIN, S_MAX),
      showNames: o.showNames === undefined ? true : Boolean(o.showNames),
      keepEqual: Boolean(o.keepEqual),
      fixLength: Boolean(o.fixLength),
    };
  }

  /** The applet's Combination(): the eleven yellow dots, i = 0..n. */
  function combinedPoints(s, n) {
    const count = n === undefined ? N : n;
    const out = [];
    for (let i = 0; i <= count; i++) {
      const p1 = innerPoint(s.A1, s.B1, i, count);
      const p2 = innerPoint(s.A2, s.B2, i, count);
      out.push(weighted(p1, p2, s.s));
    }
    return out;
  }

  /** Segment A_r B_r on which all the marks lie. */
  function endpoints(s) {
    return { Ar: weighted(s.A1, s.A2, s.s), Br: weighted(s.B1, s.B2, s.s) };
  }

  function affineImage(s, u) {
    const { Ar, Br } = endpoints(s);
    return weighted(Ar, Br, 1 - u);
  }

  /** The page's claim, measured at this position. */
  function claims(s, n) {
    const count = n === undefined ? N : n;
    const pts = combinedPoints(s, count);
    const { Ar, Br } = endpoints(s);
    const scale = Math.max(distance(s.A1, s.B1), distance(s.A2, s.B2), 1);
    const tol = 1e-8 * scale;
    let spread = 0, deviation = 0, affineError = 0;
    for (let i = 0; i <= count; i++) {
      spread = Math.max(spread, distance(pts[i], Ar));
      deviation = Math.max(deviation, Math.abs(cross(Ar, Br, pts[i])));
      affineError = Math.max(affineError, distance(pts[i], affineImage(s, i / count)));
    }
    const coincide = spread <= tol;
    return {
      collinear: deviation <= tol,
      coincide,
      spread,
      deviation,
      affineError,
      endpoints: distance(pts[0], Ar) <= tol && distance(pts[count], Br) <= tol,
      affineFormula: affineError <= tol,
      // "either all different and collinear or all coincide", exactly.
      dichotomy: coincide ? true : deviation <= tol && spread > tol,
      sInRange: s.s >= S_MIN - EPS && s.s <= S_MAX + EPS,
    };
  }

  /** GeoSDoub.NearestPoint on a circle: the FixLengths constraint. */
  function nearestOnCircle(p, center, radius) {
    const d = distance(p, center);
    if (d < EPS) return { x: center.x + radius, y: center.y };
    const t = radius / d;
    return { x: center.x + (p.x - center.x) * t, y: center.y + (p.y - center.y) * t };
  }

  /** The applet's UpdatePoint(p1, p2, p3, p4): rescale p4 about p3. */
  function updatePoint(p1, p2, p3, p4) {
    const from = distance(p1, p2);
    const existing = distance(p3, p4);
    if (Math.abs(existing) < 0.1) return copyPoint(p4);
    const t = from / existing;
    return { x: p3.x + (p4.x - p3.x) * t, y: p3.y + (p4.y - p3.y) * t };
  }

  /** The applet's CheckAndUpdate() for the point that is being dragged. */
  function equalise(s, name) {
    if (name === "A1") s.A2 = updatePoint(s.B1, s.A1, s.B2, s.A2);
    else if (name === "B1") s.B2 = updatePoint(s.A1, s.B1, s.A2, s.B2);
    else if (name === "A2") s.A1 = updatePoint(s.B2, s.A2, s.B1, s.A1);
    else if (name === "B2") s.B1 = updatePoint(s.A2, s.B2, s.A1, s.B1);
    return s;
  }

  /** A new position with one named endpoint moved, as the applet's drag does. */
  function withPoint(state, name, p) {
    const next = copy(state);
    if (!PARTNER[name]) return next;
    let target = copyPoint(p);
    if (next.fixLength) {
      // mousePressed(): circle about the other end, radius as it was on press.
      target = nearestOnCircle(target, state[PARTNER[name]], distance(state[PARTNER[name]], state[name]));
    }
    next[name] = target;
    if (next.keepEqual) equalise(next, name);
    return next;
  }

  /** Dragging the interior of a segment translates both of its endpoints. */
  function withSegment(state, name, delta) {
    const next = copy(state);
    if (name === "A1B1") {
      next.A1 = { x: next.A1.x + delta.x, y: next.A1.y + delta.y };
      next.B1 = { x: next.B1.x + delta.x, y: next.B1.y + delta.y };
    } else if (name === "A2B2") {
      next.A2 = { x: next.A2.x + delta.x, y: next.A2.y + delta.y };
      next.B2 = { x: next.B2.x + delta.x, y: next.B2.y + delta.y };
    }
    return next;
  }

  function withOption(state, name, value) {
    const next = copy(state);
    if (name === "s") next.s = clamp(Number(value), S_MIN, S_MAX);
    else if (name === "showNames" || name === "keepEqual" || name === "fixLength") next[name] = Boolean(value);
    return next;
  }

  function legalMoves(/* state */) { return NAMES.concat(SEGMENTS); }

  function move(state, m) {
    if (!m) return state;
    if (m.type === "segment") return withSegment(state, m.name, m.delta);
    if (m.type === "option") return withOption(state, m.name, m.value);
    return withPoint(state, m.name, m.point);
  }

  /** An illustration has no win and no loss. */
  function result(/* state */) { return null; }

  return {
    EPS, N, WIDTH, HEIGHT, PHI, TURN, S_MIN, S_MAX, S_STEP, S_DEFAULT,
    NAMES, PARTNER, SEGMENTS, distance, clamp, cross, average, weighted,
    innerPoint, start, combinedPoints, endpoints, affineImage, claims,
    nearestOnCircle, updatePoint, equalise, withPoint, withSegment, withOption,
    legalMoves, move, result,
  };
})();
