"use strict";

/*
 * Math Pro — the geometry behind Bogomolny's applet MathPro.
 *
 * The page (cut-the-knot.org/Curriculum/Geometry/MathPro.shtml) states the
 * claim: for a triangle ABC with incircle touching BC, CA and AB at D, E, F,
 * and any point P, let X, Y, Z be the intersections of the incircle with the
 * lines AP, BP, CP that are nearest to A, B, C. Then DX, EY and FZ meet in
 * one point (Rabinowitz's point). It also says that replacing an even number
 * of the three choices by the far intersection keeps the concurrence, while
 * using all three far points does not in general.
 *
 * MathProCanvas.init() places
 *   s = min(w,h)/5
 *   A = (w/3, s/2), B = (w/4, h-s), C = (4w/5, h-s)
 *   P = ((3 Ax + Cx)/4, (Ay + By)/2)
 * Compute() then finds the incenter I, the touch points D, E, F, the near
 * circle crossings X, Y, Z and Q = DX ∩ EY. FindCrossPoint() compares the
 * distances from the line's first endpoint (the vertex) to the two crossings
 * and keeps the nearer one. The incircle radius is the mean of the three
 * distances from I to its touch points, exactly as GetIncircle() does.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, MathProCore, so the page loads it with a
 * plain <script> and porting/check-math-pro.mjs can load it in Node. The
 * position is plain data and every function returns new objects.
 */
const MathProCore = (() => {
  const WIDTH = 400;
  const HEIGHT = 300;
  const EPS = 1e-9;

  const copy = (p) => ({ x: p.x, y: p.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const sqDistance = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  /** The starting position, straight from MathProCanvas.init(). */
  function start(options) {
    const o = options || {};
    if (o.points) {
      return {
        A: copy(o.points.A), B: copy(o.points.B),
        C: copy(o.points.C), P: copy(o.points.P),
      };
    }
    const w = o.width === undefined ? WIDTH : o.width;
    const h = o.height === undefined ? HEIGHT : o.height;
    const s = Math.min(w, h) / 5;
    // Java integer division truncates positive ints towards zero.
    const A = { x: Math.trunc(w / 3), y: s / 2 };
    const B = { x: Math.trunc(w / 4), y: h - s };
    const C = { x: Math.trunc((4 * w) / 5), y: h - s };
    const P = { x: (3 * A.x + C.x) / 4, y: (A.y + B.y) / 2 };
    return { A, B, C, P };
  }

  /** A new position with one point moved; the original is untouched. */
  function withPoint(state, name, p) {
    if (!Object.prototype.hasOwnProperty.call(state, name)) return start({ points: state });
    const next = start({ points: state });
    next[name] = copy(p);
    return next;
  }

  /** |BC|, |CA|, |AB| in the applet's notation. */
  function sides(s) {
    return { a: distance(s.B, s.C), b: distance(s.C, s.A), c: distance(s.A, s.B) };
  }

  /** A collapsed triangle has no incircle and no crossings. */
  function isDegenerate(s) {
    const { a, b, c } = sides(s);
    return Math.min(a, b, c) < 2 || Math.abs(cross(s.A, s.B, s.C)) < 1e-6;
  }

  /** Incenter from side-length barycentric weights. */
  function incenter(A, B, C) {
    const a = distance(B, C), b = distance(C, A), c = distance(A, B);
    const t = a + b + c;
    if (t < EPS) return null;
    return {
      x: (a * A.x + b * B.x + c * C.x) / t,
      y: (a * A.y + b * B.y + c * C.y) / t,
    };
  }

  /** GeoSDoub.NearestPoint: the foot on the infinite line, with the applet's
   *  tiny early return (a point within sqrt(0.1) of the first end stays put). */
  function nearestPoint(p, a, b) {
    if (sqDistance(p, a) < 0.1) return copy(p);
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 < EPS) return copy(p);
    return add(a, scale(d, dot(sub(p, a), d) / len2));
  }

  /** GetIncircle(): I is the centre, the touch points are its feet on the
   *  sides, and the radius is the mean of the three distances (not just one). */
  function incircle(A, B, C) {
    const center = incenter(A, B, C);
    if (!center) return null;
    const D = nearestPoint(center, B, C);
    const E = nearestPoint(center, C, A);
    const F = nearestPoint(center, A, B);
    const radius =
      (distance(center, D) + distance(center, E) + distance(center, F)) / 3;
    return { center, radius, D, E, F };
  }

  /** Intersections of the infinite line a-b with a circle, as plain points.
   *  Solved from |a + t(b-a) - c|^2 = r^2; sorted by distance from a, so the
   *  first entry is the one FindCrossPoint() keeps. */
  function lineCircle(a, b, circle) {
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 < EPS || !circle || !(circle.radius > 0)) return [];
    const f = sub(a, circle.center);
    const half = dot(f, d) / len2;
    const disc = half * half - (dot(f, f) - circle.radius * circle.radius) / len2;
    if (disc < 0) return [];
    if (disc < 1e-14) return [add(a, scale(d, -half))];
    const root = Math.sqrt(disc);
    return [add(a, scale(d, -half - root)), add(a, scale(d, -half + root))];
  }

  /** FindCrossPoint(vertex): near is the crossing closest to the vertex, far
   *  the other one. A tangent has the same point for both. */
  function crossings(vertex, P, circle) {
    const hits = lineCircle(vertex, P, circle);
    if (!hits.length) return { near: null, far: null, hits: [] };
    const sorted = hits.slice().sort((u, v) => distance(vertex, u) - distance(vertex, v));
    return { near: sorted[0], far: sorted[sorted.length - 1], hits: sorted };
  }

  /** GeoSDoub.Intersect of two lines, or null when they are parallel. */
  function lineIntersection(p1, p2, p3, p4) {
    const d = sub(p2, p1), e = sub(p4, p3);
    const den = d.x * e.y - d.y * e.x;
    if (!Number.isFinite(den) || Math.abs(den) < 1e-10) return null;
    const a = sub(p3, p1);
    const t = (a.x * e.y - a.y * e.x) / den;
    return add(p1, scale(d, t));
  }

  /** Perpendicular distance from p to the infinite line through a and b. */
  function distanceToLine(p, a, b) {
    const d = sub(b, a);
    const len = Math.hypot(d.x, d.y);
    if (len < EPS) return distance(p, a);
    return Math.abs(cross(a, b, p)) / len;
  }

  /**
   * One full run of Compute(). The applet draws no cevians when any of the
   * three lines misses the incircle (NoDraw); that is `valid` here. `far`
   * holds the other three crossings used by the page's second claim.
   */
  function diagram(state) {
    if (!state || isDegenerate(state)) return { valid: false };
    const circle = incircle(state.A, state.B, state.C);
    if (!circle || !(circle.radius > 0)) return { valid: false };
    const x = crossings(state.A, state.P, circle);
    const y = crossings(state.B, state.P, circle);
    const z = crossings(state.C, state.P, circle);
    const valid = Boolean(x.near && y.near && z.near);
    if (!valid) return { valid: false, circle };
    const span = sides(state);
    const scaleRef = Math.max(1, span.a, span.b, span.c);
    return {
      valid: true,
      circle,
      I: circle.center,
      D: circle.D, E: circle.E, F: circle.F,
      X: x.near, Y: y.near, Z: z.near,
      Xp: x.far, Yp: y.far, Zp: z.far,
      Q: lineIntersection(circle.D, x.near, circle.E, y.near),
      scale: scaleRef,
    };
  }

  /**
   * Test one of the four triplets on the page. `far` says, per vertex,
   * whether to use the far crossing instead of the near one. The two lines
   * from D and E give the candidate point; the third line's distance from it
   * measures how far the three are from meeting.
   */
  function concurrency(state, far) {
    const m = diagram(state);
    if (!m.valid) return { valid: false, concurrent: false, error: Infinity, Q: null };
    const f = far || [false, false, false];
    const X = f[0] ? m.Xp : m.X;
    const Y = f[1] ? m.Yp : m.Y;
    const Z = f[2] ? m.Zp : m.Z;
    const Q = lineIntersection(m.D, X, m.E, Y);
    if (!Q) return { valid: true, concurrent: false, error: Infinity, Q: null };
    const error = distanceToLine(Q, m.F, Z);
    return {
      valid: true,
      concurrent: error <= 1e-6 * m.scale,
      error,
      Q,
    };
  }

  /** The four concurrences the page asserts, plus its one non-concurrence. */
  function claims(state) {
    const main = concurrency(state, [false, false, false]);
    const mixed = [
      concurrency(state, [false, true, true]),
      concurrency(state, [true, false, true]),
      concurrency(state, [true, true, false]),
    ];
    const allFar = concurrency(state, [true, true, true]);
    return {
      valid: main.valid,
      main: main.valid && main.concurrent,
      mixed: mixed.every((c) => c.valid && c.concurrent),
      allFarNot: allFar.valid && !allFar.concurrent,
      Q: main.Q,
    };
  }

  /** An illustration has no win, loss or finish condition. */
  function result(state) {
    return null;
  }

  return {
    WIDTH, HEIGHT,
    start, withPoint, result,
    sides, isDegenerate, incenter, nearestPoint, incircle,
    lineCircle, crossings, lineIntersection, distanceToLine,
    distance, sqDistance, cross, dot, sub, add, scale,
    diagram, concurrency, claims,
  };
})();
