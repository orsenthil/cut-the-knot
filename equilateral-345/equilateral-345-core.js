"use strict";

/*
 * Equilateral 345, from Alexander Bogomolny's applet Equilateral345.
 *
 * An equilateral triangle ABC has an interior point P with AP = 3, BP = 4 and
 * CP = 5. Turning a copy of ABC by 60 degrees about each vertex makes a big
 * equilateral triangle of four copies; the hexagon A-Pc-B-Pa-C-Pb inside it
 * has twice the area of ABC and splits into six familiar triangles. Comparing
 * the two area sums gives a² = 25 + 12√3 (so a ≈ 6.7664 when the three
 * distances really are 3, 4 and 5).
 *
 * The geometry here follows the Java bytecode: GeoSDoub.Rotate(center, point,
 * angle, -1), three circle intersections picked inside ABC and their
 * barycenter, a rotation dial from 0 to 65, and draggable vertices A, B and C
 * while P stays where init() put it. The applet's own FindP uses
 * a/√(24 + 12√3) where the exact scale is a/√(25 + 12√3); both are kept, so
 * the logic test can show the small discrepancy instead of hiding it.
 *
 * This file is the picture's logic and nothing else: no document, no window,
 * no storage. It defines one global, Equilateral345Core, so the page loads it
 * with a plain <script> and porting/check-equilateral-345.mjs loads it in Node.
 * Functions take plain data and return new plain data.
 */
const Equilateral345Core = (() => {
  const SQRT3 = Math.sqrt(3);
  // The page's answer for distances 3, 4, 5: a² = 25 + 12√3.
  const FACTOR = 25 + 12 * SQRT3;
  const SOLUTION = Math.sqrt(FACTOR);
  // The applet's FindP constant: 4*(6√3+9)/√3 = 24 + 12√3, one less.
  const APPLET_FACTOR = 4 * (6 * SQRT3 + 9) / SQRT3;

  const APPLET = Object.freeze({
    canvas: { width: 640, height: 460 },
    side: 200,
    lengths: [3, 4, 5],
    angle: { min: 0, max: 65, page: 5, initial: 0 },
    dragMargin: 16,
  });

  const pt = (x, y) => ({ x, y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const midpoint = (p, q) => pt((p.x + q.x) / 2, (p.y + q.y) / 2);

  /** Twice the signed shoelace area; positive when the points run anticlockwise. */
  function signed2(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i], q = points[(i + 1) % points.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum;
  }
  const area = (points) => Math.abs(signed2(points)) / 2;

  /** Same test as the applet's Polygon.contains for a point in triangle abc. */
  function inside(p, abc) {
    const [a, b, c] = abc;
    const cross = (u, v, w) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
    const s1 = cross(a, b, p), s2 = cross(b, c, p), s3 = cross(c, a, p);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  }

  /**
   * GeoSDoub.Rotate(center, point, angleInRadians, sign), transcribed from the
   * applet: the first point stays put and the second swings around it. The
   * applet always passes sign = -1.
   */
  function rotate(center, point, angle, sign = -1) {
    const co = Math.cos(angle), si = Math.sin(angle);
    const dx = point.x - center.x, dy = point.y - center.y;
    return pt(center.x + co * dx - sign * si * dy,
      center.y + sign * si * dx + co * dy);
  }

  /** The two intersections of two circles (zero or one when they do not cross). */
  function circleIntersections(c1, r1, c2, r2) {
    const dx = c2.x - c1.x, dy = c2.y - c1.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-12 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const x = c1.x + a * dx / d, y = c1.y + a * dy / d;
    return [pt(x - dy * h / d, y + dx * h / d), pt(x + dy * h / d, y - dx * h / d)];
  }

  const barycenter = (p, q, r) => pt((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);

  /** The starting equilateral triangle: B above the midpoint of the base CA. */
  function triangle(side, center) {
    const o = center || pt(APPLET.canvas.width / 2, APPLET.canvas.height / 2);
    return {
      A: pt(o.x + side / 2, o.y),
      B: pt(o.x, o.y - side * SQRT3 / 2),
      C: pt(o.x - side / 2, o.y),
    };
  }

  /** The applet's FindP(a), straight from the bytecode. */
  function findP(side, A, B, C, lengths = APPLET.lengths) {
    const k = side / Math.sqrt(APPLET_FACTOR);
    const radii = lengths.map((n) => n * k);
    const tri = [A, B, C];
    const pick = (hits) => (hits.length && inside(hits[0], tri) ? hits[0] : hits[1]);
    const pab = pick(circleIntersections(A, radii[0], B, radii[1]));
    const pbc = pick(circleIntersections(B, radii[1], C, radii[2]));
    const pca = pick(circleIntersections(C, radii[2], A, radii[0]));
    return barycenter(pbc, pca, pab);
  }

  /** The mathematically exact point: all three circles meet in one place. */
  function exactP(side, A, B, C, lengths = APPLET.lengths) {
    const k = side / SOLUTION;
    const radii = lengths.map((n) => n * k);
    const tri = [A, B, C];
    const hits = circleIntersections(A, radii[0], B, radii[1]);
    const P = inside(hits[0], tri) ? hits[0] : hits[1];
    return { P, k };
  }

  /** The position a new illustration starts from: the applet's init(). */
  function start(options = {}) {
    const side = options.side === undefined ? APPLET.side : Math.max(20, options.side);
    const center = options.center || pt(APPLET.canvas.width / 2, APPLET.canvas.height / 2);
    const t = triangle(side, center);
    return {
      side,
      A: t.A,
      B: t.B,
      C: t.C,
      P: options.P || findP(side, t.A, t.B, t.C),
      angle: clamp(Math.round(options.angle === undefined ? APPLET.angle.initial : options.angle),
        APPLET.angle.min, APPLET.angle.max),
      showNames: !!options.showNames,
      showLengths: !!options.showLengths,
    };
  }

  /** A scrollbar-like whole-number angle, clamped to the applet's 0..65 range. */
  function withAngle(state, value) {
    return { ...state, angle: clamp(Math.round(value), APPLET.angle.min, APPLET.angle.max) };
  }

  /** Drag a vertex inside the canvas; P does not follow it in the applet. */
  function withVertex(state, name, p) {
    if (name !== "A" && name !== "B" && name !== "C") return state;
    const m = APPLET.dragMargin;
    const q = pt(clamp(p.x, m, APPLET.canvas.width - m),
      clamp(p.y, m, APPLET.canvas.height - m));
    return { ...state, [name]: q };
  }

  /** The applet's two checkboxes. */
  function withFlag(state, name, value) {
    if (name !== "showNames" && name !== "showLengths") return state;
    return { ...state, [name]: !!value };
  }

  /**
   * Compute(): the six rotated vertices and three rotated images of P.
   * Ap, Bp, Cp are the images of A, B, C that land back on the original
   * vertices at 60 degrees; Aq, Bq, Cq are the outer corners of the big
   * triangle. Pa, Pb, Pc are P about B, about C and about A respectively -
   * the applet prints them with the subscripts c, a and b.
   */
  function compute(state) {
    const theta = state.angle * Math.PI / 180;
    const rot = (center, point) => rotate(center, point, theta, -1);
    return {
      theta,
      Ap: rot(state.B, state.C),
      Bp: rot(state.C, state.A),
      Cp: rot(state.A, state.B),
      Aq: rot(state.B, state.A),
      Bq: rot(state.C, state.B),
      Cq: rot(state.A, state.C),
      Pa: rot(state.B, state.P),
      Pb: rot(state.C, state.P),
      Pc: rot(state.A, state.P),
    };
  }

  /** What the readout shows: three measured distances and the predicted scale. */
  function metrics(state) {
    const lengths = [distance(state.P, state.A), distance(state.P, state.B), distance(state.P, state.C)];
    const k = state.side / SOLUTION;
    const ideal = APPLET.lengths.map((n) => n * k);
    return {
      side: state.side,
      lengths,
      ideal,
      k,
      sideSquared: state.side * state.side,
      predictedSideSquared: k * k * FACTOR,
    };
  }

  /** The page's answer, plus the equation it came from. */
  function claim() {
    return {
      factor: FACTOR,              // a² when AP = 3, BP = 4, CP = 5
      side: SOLUTION,              // ≈ 6.76638
      equilateralArea: (x) => x * x * SQRT3 / 4,
      rightTriangles: 3 * 3 * 4 / 2, // the three 3-4-5 halves, = 18
      equation: "2·a²√3/4 = (3²+4²+5²)√3/4 + 18",
    };
  }

  return {
    APPLET, FACTOR, SOLUTION, APPLET_FACTOR,
    pt, add, sub, distance, clamp, midpoint, area, signed2, inside,
    rotate, circleIntersections, barycenter, triangle, findP, exactP,
    start, withAngle, withVertex, withFlag, compute, metrics, claim,
  };
})();
