"use strict";

/*
 * Fagnano's Problem III (Samelson's solution), from Alexander Bogomolny's
 * applet FagnanoIII.
 *
 * Roll a triangle ABC over its sides: reflect B in CA, then A in the new
 * side B'C, then C in A'B', and so on. The first side AB and its image A'B'
 * meet at O at an angle of 180 - 2*C. The bisector m at O runs through C.
 * Reflecting B and B' in m and taking the two midpoints gives M on AB (the
 * foot of the altitude from C) and M' on A'B'; M' is the midpoint of M and
 * its next image. Samelson's claim is that MM' is the shortest segment
 * joining a point of AB to its rolled image: for every P the two legs are
 * equal and their base is a fixed translation, so the path is shortest
 * exactly when the three copies of P are collinear, which happens at M.
 * Folded back into ABC, the three pieces form the orthic triangle.
 *
 * Every formula here is transcribed from the applet's bytecode:
 * OrthicHexTriangle.ComputeReflection / Reflect / ReflectOneLine,
 * GeoSDoub.Intersect / FindAltitude / FindAngleBisector /
 * ReflectPointInLine / GetParallelTo, and DoubLine.CreateMidPoint /
 * UpdateMidPoint. This file is logic only: no document, no window, no
 * storage. It defines one global, FagnanoIIICore, so a page loads it with a
 * plain <script> and porting/check-fagnano-iii.mjs loads it in Node.
 *
 * The position is plain data (four points and five checkbox booleans), so it
 * can be saved and handed to the tutor as it is. Every function returns a new
 * position and leaves the one it was given untouched. There is no win or
 * loss: this is an illustration.
 */
const FagnanoIIICore = (() => {
  // The Java canvas was 400 by 250 ("400 seems optimal", "250 seems optimal").
  // The SVG board is 360 by 240; the opening points use the applet's own
  // fractions of the canvas, with s = min(height/8, width/8).
  const WIDTH = 360;
  const HEIGHT = 240;
  const MARGIN = 12;
  const START_T = 0.3; // DoubLine.CreateMidPoint(0.3)
  const EPS = 1e-9;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const len = (p) => Math.hypot(p.x, p.y);
  const dist = (p, q) => len(sub(p, q));
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const available = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.Intersect: line coefficients, or NaN for a near-parallel pair. */
  function intersect(p, q, r, s) {
    const a = p.y - q.y, b = q.x - p.x, c = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const den = a * b2 - a2 * b;
    if (Math.abs(den) < 1) return { x: NaN, y: NaN };
    return { x: (b * c2 - b2 * c) / den, y: (c * a2 - c2 * a) / den };
  }

  /** GeoSDoub.GetParallelTo(A,B,C): 100 base-lengths from A along B-C. */
  const parallelPoint = (a, b, c) => ({
    x: a.x + 100 * (b.x - c.x),
    y: a.y + 100 * (b.y - c.y),
  });

  /** GeoSDoub.FindAltitude(p,a,b): foot of the perpendicular from p to ab. */
  function altitude(p, a, b) {
    const v = { x: p.x + b.y - a.y, y: p.y - (b.x - a.x) };
    return intersect(p, v, a, b);
  }

  /** GeoSDoub.ComputeAngle(a,b,c): the angle at a, in radians. */
  function angle(a, b, c) {
    if (!available(a) || !available(b) || !available(c)) return NaN;
    const ab = dist(a, b), ac = dist(a, c);
    if (!ab || !ac) return NaN;
    const cos = (ab * ab + ac * ac - dist(b, c) * dist(b, c)) / (2 * ab * ac);
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  /** GeoSDoub.FindOrientation(a,b,c): sign of the turn from ab to ac. */
  const orientation = (a, b, c) => (cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1);

  /** GeoSDoub.Rotate(p,center,angle,sign): rotate center around p. */
  function rotate(p, center, a, sign) {
    const co = Math.cos(a), si = Math.sin(a);
    return {
      x: p.x + co * (center.x - p.x) - sign * si * (center.y - p.y),
      y: p.y + sign * si * (center.x - p.x) + co * (center.y - p.y),
    };
  }

  /** GeoSDoub.ReflectPointInLine(p,a,b): reflect p in the line a-b. */
  function reflectPointInLine(p, a, b) {
    const turn = 2 * angle(b, p, a);
    return rotate(b, p, turn, orientation(b, p, a));
  }

  /** GeoSDoub.FindAngleBisector(vertex,p,q): the bisector meets p-q here. */
  function bisectorPoint(vertex, p, q) {
    const turn = angle(vertex, p, q) / 2;
    const arm = rotate(vertex, p, turn, orientation(vertex, p, q));
    return intersect(vertex, arm, p, q);
  }

  /**
   * OrthicHexTriangle.ComputeReflection(p,a,b): reflect p in the line a-b.
   * The applet has a special case for a nearly vertical mirror: it flips x
   * around a.x and leaves y alone.
   */
  function reflect(p, a, b) {
    if (Math.abs(a.x - b.x) < 1) return { x: 2 * a.x - p.x, y: p.y };
    const u = sub(b, p), v = sub(a, b);
    const t = -dot(u, v) / dot(v, v);
    return sub(mul(add(b, mul(v, t)), 2), p);
  }

  /**
   * OrthicHexTriangle.Reflect(side): side 0 mirrors the side AB (moves C),
   * 1 mirrors BC (moves A), 2 mirrors CA (moves B). The applet's three
   * rolling steps from ABC are 2, 1, 0; "more triangles" repeats them.
   */
  function reflectSide(tri, side) {
    const { A, B, C } = tri;
    if (side === 0) return { A, B, C: reflect(C, A, B) };
    if (side === 1) return { A: reflect(A, B, C), B, C };
    if (side === 2) return { A, B: reflect(B, C, A), C };
    return tri;
  }

  /** The position a new illustration starts from. */
  function start() {
    const s = Math.floor(Math.min(HEIGHT / 8, WIDTH / 8)); // 30 here
    const A = { x: 2 * s, y: HEIGHT - 4 * s };
    const B = { x: s, y: HEIGHT - s };
    const C = { x: 4 * s, y: HEIGHT - 2 * s };
    const P = add(mul(A, START_T), mul(B, 1 - START_T));
    return {
      A, B, C, P,
      showAltitudes: false,
      showConstruction: false,
      showMap: false,
      moreTriangles: false,
      showNames: false,
    };
  }

  /** The coefficient of A in P = t*A + (1-t)*B on the line AB. */
  function parameter(A, B, P) {
    const d = sub(A, B);
    const n = dot(d, d);
    if (n < EPS) return START_T;
    let t = -dot(d, sub(B, P)) / n;
    t = Math.max(0, Math.min(1, t)); // DoubLine.RestrictToSegment(true)
    return Number.isFinite(t) ? t : START_T;
  }

  const pointAt = (A, B, t) => add(mul(A, t), mul(B, 1 - t));

  /**
   * Every point the applet draws, from a position. The t0..t5 numbering is
   * its own: t0 is ABC, t1 is after the first roll, and t5 is the last
   * triangle. (The page's t1..t3 are the applet's t0..t2.)
   */
  function compute(s) {
    const { A, B, C, P } = s;
    const t0 = { A, B, C };
    const t1 = reflectSide(t0, 2);
    const t2 = reflectSide(t1, 1);
    const t3 = reflectSide(t2, 0);
    const t4 = reflectSide(t3, 2);
    const t5 = reflectSide(t4, 1);

    // Show construction: the two copies of side c, their crossing, m, B', M.
    const O = intersect(t0.A, t0.B, t2.A, t2.B);
    const bisector = bisectorPoint(O, t0.A, t2.B);
    const B1 = reflectPointInLine(t2.B, O, bisector);
    const B2 = reflectPointInLine(t0.B, O, bisector);
    const M1 = mid(B1, t0.B);
    const M2 = mid(B2, t2.B); // t3.M = t4.M in the page's numbering
    const M3 = sub(mul(M2, 2), M1); // the page's t6.M, on t5.c

    // Show mapping: the three locations of P in the rolled strip.
    const frac = dist(t0.A, P) / Math.max(dist(t0.A, t0.B), EPS);
    const P2 = add(t2.A, mul(sub(t2.B, t2.A), frac));
    const P3 = add(t5.A, sub(P, t0.A));

    const angleC = angle(C, A, B);
    const crossing = angle(O, t0.A, t2.A); // the angle at O between the c lines
    const orthic = {
      C: altitude(C, A, B), // M1 when the triangle is acute
      B: altitude(B, C, A),
      A: altitude(A, B, C),
    };
    const foldX = intersect(M1, M2, t1.B, t1.C); // crossing of t1.a
    return {
      t0, t1, t2, t3, t4, t5, P, O, bisector, B1, B2,
      M1, M2, M3, P2, P3, angleC, crossing, orthic, foldX,
      minLength: dist(t5.A, t0.A),
    };
  }

  /** The two legs and their (fixed) base for an arbitrary point on AB. */
  function images(f, p) {
    const frac = dist(f.t0.A, p) / Math.max(dist(f.t0.A, f.t0.B), EPS);
    const q = add(f.t2.A, mul(sub(f.t2.B, f.t2.A), frac));
    const r = add(f.t5.A, sub(p, f.t0.A));
    return { q, r, leg1: dist(p, q), leg2: dist(q, r), base: dist(p, r) };
  }

  /** True when all three angles are acute, as the page's claim requires. */
  function isAcute(s) {
    const { A, B, C } = s;
    return dot(sub(B, A), sub(C, A)) > 0 &&
      dot(sub(C, B), sub(A, B)) > 0 &&
      dot(sub(A, C), sub(B, C)) > 0;
  }

  /** Keep a dragged point on the board; P glides along the segment AB. */
  function clampPoint(s, name, q) {
    if (name === "P") {
      const t = parameter(s.A, s.B, q);
      return pointAt(s.A, s.B, t);
    }
    return {
      x: Math.max(MARGIN, Math.min(WIDTH - MARGIN, q.x)),
      y: Math.max(MARGIN, Math.min(HEIGHT - MARGIN, q.y)),
    };
  }

  /**
   * Move one named point. A or B keeps P at the same fraction of AB, as the
   * applet's CheckMidPoint does; moving C leaves P alone; moving P changes
   * the fraction and clamps it to the segment.
   */
  function move(s, name, q) {
    if (!["A", "B", "C", "P"].includes(name) || !q || !available(q)) return s;
    const t = parameter(s.A, s.B, s.P);
    const next = Object.assign({}, s, { [name]: clampPoint(s, name, q) });
    if (name === "A" || name === "B") next.P = pointAt(next.A, next.B, t);
    return next;
  }

  /** One of the applet's five checkboxes. */
  function option(s, name, value) {
    const keys = ["showAltitudes", "showConstruction", "showMap", "moreTriangles", "showNames"];
    if (!keys.includes(name)) return s;
    return Object.assign({}, s, { [name]: !!value });
  }

  /** The live status line: honest numbers, and no win or loss. */
  function describe(s, f) {
    const deg = (r) => Number.isFinite(r) ? (r * 180 / Math.PI).toFixed(1) + "\u00b0" : "?";
    if (!isAcute(s)) {
      return "This triangle is not acute, so the page's shortest-line claim does not apply. Move a corner to make all three angles less than 90\u00b0.";
    }
    return `At the crossing the angle is ${deg(f.crossing)} = 180\u00b0 \u2212 2 \u00d7 ${deg(f.angleC)}. ` +
      `At M the three copies of P lie on one line of length ${f.minLength.toFixed(1)}; ` +
      "at any other P the two legs are equal and the path is longer.";
  }

  return {
    WIDTH, HEIGHT, MARGIN, START_T, EPS,
    add, sub, mul, dot, cross, len, dist, mid, available,
    intersect, parallelPoint, altitude, angle, orientation, rotate,
    reflectPointInLine, bisectorPoint, reflect, reflectSide,
    start, parameter, pointAt, compute, images, isAcute,
    clampPoint, move, option, describe,
  };
})();
