"use strict";

/*
 * Concurrency — Alexander Bogomolny's "Isogonal Concurrency" applet.
 *
 * At each corner of a triangle the applet draws a line and its mirror image in
 * the corner's angle bisector. Six such lines make three different triples of
 * lines, and every triple meets in one point. The core follows the bytecode:
 * GetOneMPoint places the draggable ray point, RecomputeAandD measures the angle
 * and length at each corner, MirrorPoint reflects that point across the
 * bisector, and Draw builds the three triples of intersecting lines.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, ConcurrencyCore. A position is plain data (numbers,
 * arrays and plain objects); the functions return new positions.
 */
const ConcurrencyCore = (() => {
  const WIDTH = 360;
  const HEIGHT = 260;
  const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
  const SCALE = Math.min(WIDTH, HEIGHT) / 3;
  const START_ANGLES = [-1.6, -4.0, -0.2]; // applet init: cos/sin of these
  const START_FRACTIONS = [0.3, 0.2, 0.25]; // applet's A array
  const REACH = 0.3; // applet's 0.3 multiplier in GetOneMPoint
  const EPS = 1e-9;
  const NAMES = ["first", "second", "third"];

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.FindOrientation, copied from its bytecode (-1 or +1). */
  function orientation(a, b, c) {
    const cross = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return cross > 0 ? 1 : -1;
  }

  /** GeoSDoub.Rotate(a, b, angle, sign), copied from its bytecode. */
  function rotate(a, b, angle, sign) {
    const co = Math.cos(angle), si = Math.sin(angle);
    const dx = b.x - a.x, dy = b.y - a.y;
    return { x: a.x + co * dx - sign * si * dy, y: a.y + sign * si * dx + co * dy };
  }

  /** GeoSDoub.ComputeAngle(a, b, c): the angle at a, in radians. */
  function computeAngle(a, b, c) {
    const ab = dist(a, b), ac = dist(a, c);
    if (ab < EPS || ac < EPS) return 0;
    const cos = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) / (2 * ab * ac);
    return Math.acos(clamp(cos, -1, 1));
  }

  /** GeoSDoub.Intersect(p, q, r, s): two infinite lines, null if parallel. */
  function intersect(p, q, r, s) {
    if (!finite(p) || !finite(q) || !finite(r) || !finite(s)) return null;
    const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
    const d = r.y - s.y, e = s.x - r.x, f = r.x * s.y - r.y * s.x;
    const det = a * e - b * d;
    if (Math.abs(det) < 1e-9) return null;
    const out = { x: (b * f - e * c) / det, y: (c * d - f * a) / det };
    return finite(out) ? out : null;
  }

  /** The applet's GetOneMPoint: a point on a chosen fraction of corner i. */
  function rayPoint(a, b, c, fraction, reach) {
    const angle = computeAngle(a, b, c) * fraction;
    const sign = orientation(a, b, c);
    const turned = rotate(a, b, angle, sign);
    return { x: a.x + reach * (turned.x - a.x), y: a.y + reach * (turned.y - a.y) };
  }

  /** RecomputeAandD: the angle and the distance the applet stores at each corner. */
  function measure(state) {
    const { V, P } = state;
    const angles = [0, 1, 2].map((i) => computeAngle(V[i], V[(i + 1) % 3], P[i]));
    const lengths = [0, 1, 2].map((i) => dist(V[i], P[i]));
    return { angles, lengths };
  }

  /**
   * MirrorPoint(a=V[i], b=V[i+1], c=V[i+2], y=P[i], i): the applet turns the
   * other side of the corner by the measured angle, then pulls the result back
   * by the measured length. The direction is the isogonal partner of P[i]; the
   * final distance is a harmless quirk of the original code.
   */
  function mirror(a, b, c, y, i, angles, lengths) {
    const sign = orientation(a, b, y);
    const turned = rotate(a, c, angles[i], -sign);
    const length = dist(a, turned);
    if (!length || lengths[i] < EPS) return { x: a.x, y: a.y };
    const scale = length / lengths[i];
    return {
      x: turned.x + (a.x - turned.x) / scale,
      y: turned.y + (a.y - turned.y) / scale,
    };
  }

  /** Geometry the applet's Draw computes, in the same order. */
  function geometry(state) {
    const measured = measure(state);
    const { V, P } = state;
    const M = [0, 1, 2].map((i) => mirror(V[i], V[(i + 1) % 3], V[(i + 2) % 3], P[i], i,
      measured.angles, measured.lengths));
    const X = [0, 1, 2].map((i) => intersect(V[i], P[i], V[(i + 1) % 3], M[(i + 1) % 3]));
    const Y = [0, 1, 2].map((i) => intersect(V[i], P[i], V[(i + 2) % 3], M[(i + 2) % 3]));
    const Z = [0, 1, 2].map((i) => intersect(V[i], M[i], V[(i + 1) % 3], P[(i + 1) % 3]));
    return { ...measured, M, X, Y, Z };
  }

  /** One point where three lines meet, or null when anything is degenerate. */
  function meeting(lines) {
    if (lines.some((l) => !finite(l[0]) || !finite(l[1]))) return null;
    const ab = intersect(lines[0][0], lines[0][1], lines[1][0], lines[1][1]);
    const bc = intersect(lines[1][0], lines[1][1], lines[2][0], lines[2][1]);
    if (!ab || !bc) return null;
    if (dist(ab, bc) > 1e-5) return null; // the theorem is false only if this happens
    return { x: (ab.x + bc.x) / 2, y: (ab.y + bc.y) / 2 };
  }

  /**
   * The three families the page lists. Which 0 is the applet's first checkbox
   * (AP, BQ, CR); which 1 is AU, BV, CW; which 2 is PU, QV, RW.
   */
  function families(state) {
    const g = geometry(state);
    const V = state.V;
    return [
      [0, 1, 2].map((i) => [V[(i + 2) % 3], g.X[i]]),
      [0, 1, 2].map((i) => [V[(i + 1) % 3], g.Y[i]]),
      [0, 1, 2].map((i) => [g.X[i], g.Z[i]]),
    ].map((lines, i) => ({ index: i, name: NAMES[i], lines, point: meeting(lines) }));
  }

  /** The starting picture: the applet's three vertex angles and fractions. */
  function start(options) {
    const opts = options || {};
    const V = START_ANGLES.map((angle) => ({
      x: CENTER.x + SCALE * Math.cos(angle),
      y: CENTER.y + SCALE * Math.sin(angle),
    }));
    const P = V.map((v, i) => rayPoint(v, V[(i + 1) % 3], V[(i + 2) % 3],
      opts.fractions ? opts.fractions[i] : START_FRACTIONS[i], REACH));
    const mode = clamp(Math.round(opts.mode === undefined ? 0 : opts.mode), 0, 2);
    return { V, P, mode };
  }

  const keepInside = (p) => ({
    x: clamp(p.x, 12, WIDTH - 12),
    y: clamp(p.y, 12, HEIGHT - 12),
  });

  /** Move a corner (0=A, 1=B, 2=C) to a point, keeping it on the board. */
  function moveVertex(state, i, p) {
    if (i < 0 || i > 2 || !finite(p)) return state;
    const V = state.V.slice();
    V[i] = keepInside(p);
    return { V, P: state.P.slice(), mode: state.mode };
  }

  /** Move the ray point at a corner; the mirror partner follows it. */
  function movePoint(state, i, p) {
    if (i < 0 || i > 2 || !finite(p)) return state;
    const P = state.P.slice();
    P[i] = keepInside(p);
    return { V: state.V.slice(), P, mode: state.mode };
  }

  /** The applet's three radio buttons. */
  function setMode(state, mode) {
    return { V: state.V.slice(), P: state.P.slice(), mode: clamp(Math.round(mode), 0, 2) };
  }

  /** Reset the drawing, keeping the family the player is looking at. */
  function reset(state) {
    return start({ mode: state.mode });
  }

  /** Hofstadter's special case: each pair of lines trisects its corner. */
  function trisect(state) {
    const P = state.V.map((v, i) => {
      const length = dist(v, state.P[i]) || REACH * dist(v, state.V[(i + 1) % 3]);
      return rayPoint(v, state.V[(i + 1) % 3], state.V[(i + 2) % 3], 1 / 3,
        length / dist(v, state.V[(i + 1) % 3]));
    });
    return { V: state.V.slice(), P, mode: state.mode };
  }

  /**
   * Lyness's proportion for the cevian from corner j, and its cyclic product.
   * With b the angle the line at corner j+1 makes with the side and g the
   * angle the mirror line at j+2 makes with that side,
   *     BS/SC = (cot b - cot B) / (cot g - cot C).
   */
  function ceva(state) {
    const g = geometry(state);
    const V = state.V;
    const parts = [0, 1, 2].map((j) => {
      const k = (j + 1) % 3, l = (j + 2) % 3;
      const apex = intersect(V[j], g.X[(j + 1) % 3], V[k], V[l]);
      if (!apex) return null;
      const dx = V[l].x - V[k].x, dy = V[l].y - V[k].y;
      const t = Math.abs(dx) > Math.abs(dy) ? (apex.x - V[k].x) / dx : (apex.y - V[k].y) / dy;
      const ratio = t / (1 - t);
      const b = computeAngle(V[k], V[l], state.P[k]);
      const gamma = computeAngle(V[l], V[k], g.M[l]);
      const B = computeAngle(V[k], V[j], V[l]);
      const C = computeAngle(V[l], V[j], V[k]);
      const predicted = (1 / Math.tan(b) - 1 / Math.tan(B)) /
        (1 / Math.tan(gamma) - 1 / Math.tan(C));
      return { ratio, predicted, t };
    });
    const product = parts.every((p) => p && Number.isFinite(p.ratio)) ?
      parts.reduce((acc, p) => acc * p.ratio, 1) : null;
    return { parts, product };
  }

  /** The sentence under the picture. An illustration has no win or loss. */
  function describe(state) {
    const family = families(state)[state.mode];
    if (!family.point) return "The lines are flat or overlapping: move a dot to see them meet.";
    const p = family.point;
    const labels = [["AP", "BQ", "CR"], ["AU", "BV", "CW"], ["PU", "QV", "RW"]][state.mode];
    return `${labels.join(", ")} meet at one point (${Math.round(p.x)}, ${Math.round(p.y)}).`;
  }

  return {
    WIDTH, HEIGHT, CENTER, SCALE, START_ANGLES, START_FRACTIONS, REACH,
    orientation, rotate, computeAngle, intersect, rayPoint, measure, mirror,
    geometry, families, start, moveVertex, movePoint, setMode, reset, trisect,
    ceva, describe,
  };
})();
