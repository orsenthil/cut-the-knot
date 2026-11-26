"use strict";

/*
 * Brahmagupta 2 — the second Brahmagupta theorem, from Bogomolny's applet
 * Brahmagupta2 ("Four Concurrent Lines in a Cyclic Quadrilateral").
 *
 * Drag the four corners A, B, C, D around their common circle. From the
 * midpoint of each side drop a perpendicular to the opposite side: these four
 * "maltitudes" always meet in one point T, the anticenter. The applet finds T
 * as the crossing of two of them, and finds K, the centre of gravity of the
 * quadrilateral, as the crossing of the two Varignon midlines. It then draws
 * the fourth line O–T, where O is the circle's centre: K lies halfway along
 * it. In coordinates that is the exact formula
 *
 *     K = (A + B + C + D) / 4,      T = (A + B + C + D) / 2 - O.
 *
 * This is the *second* Brahmagupta theorem. The first one needs a cyclic
 * quadrilateral whose diagonals are perpendicular and says that the line
 * through their crossing perpendicular to a side bisects the opposite side.
 * Here no condition on the diagonals is needed: the four maltitudes of any
 * cyclic quadrilateral concur. When the diagonals are perpendicular the two
 * theorems coincide, because their crossing is then exactly T.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, Brahmagupta2Core, so the page loads it with a plain
 * <script> and porting/check-brahmagupta-2.mjs loads it in Node. Every function
 * takes plain data and returns new plain data; nothing passed in is changed.
 */
const Brahmagupta2Core = (() => {
  // The applet's parameter info calls 400x250 optimal. Its circle is centred
  // at (width/2, height/2) with radius min(width, height) * 5 / 12.
  const APPLET = {
    width: 400,
    height: 250,
    radiusFactor: 5,
    radiusDivisor: 12,
    snap: 5,
    nearestGuard: 0.1, // GeoSDoub.NearestPoint returns the point below this
    detGuard: 1, // GeoSDoub.Intersect returns NaN below this determinant
  };

  const pt = (x, y) => ({ x, y });
  const add = (p, q) => pt(p.x + q.x, p.y + q.y);
  const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
  const scale = (p, k) => pt(p.x * k, p.y * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const mid = (p, q) => pt((p.x + q.x) / 2, (p.y + q.y) / 2);
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  function center(s) {
    return pt(s.width / 2, s.height / 2);
  }

  function radius(s) {
    return (Math.min(s.width, s.height) * APPLET.radiusFactor) / APPLET.radiusDivisor;
  }

  /** A point of the circumcircle at an angle in radians (y grows downwards). */
  function onCircle(s, angle) {
    const o = center(s), r = radius(s);
    return pt(o.x + r * Math.cos(angle), o.y + r * Math.sin(angle));
  }

  /** CTKMoveableDoub.UpdateLocation on a circle-gliding point: radial snap. */
  function project(s, p) {
    const o = center(s), r = radius(s);
    const d = distance(p, o);
    if (d < 1e-12) return pt(o.x + r, o.y);
    return pt(o.x + ((p.x - o.x) * r) / d, o.y + ((p.y - o.y) * r) / d);
  }

  /** GeoSDoub.NearestPoint(p, a, b): project p onto the whole line a-b. */
  function nearest(p, a, b) {
    if (sqDist(a, p) < APPLET.nearestGuard) return pt(p.x, p.y);
    const ux = b.x - a.x, uy = b.y - a.y;
    const t = ((p.x - a.x) * ux + (p.y - a.y) * uy) / (ux * ux + uy * uy);
    return pt(a.x + ux * t, a.y + uy * t);
  }

  /** GeoSDoub.Intersect(p, q, r, s): Cramer's rule in line coordinates. */
  function meet(p, q, r, s) {
    const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
    const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < APPLET.detGuard) return pt(NaN, NaN);
    return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
  }

  /* The applet's GetOtherH / GetOtherV: reflect p in the circle's vertical /
   * horizontal diameter. NearestPoint(O, p, p ± (200, 0)) is the foot of O
   * on that horizontal / vertical line, i.e. (O.x, p.y) or (p.x, O.y). */
  function otherH(s, p) {
    const foot = nearest(center(s), p, pt(p.x + 200, p.y));
    return pt(2 * foot.x - p.x, p.y);
  }

  function otherV(s, p) {
    const foot = nearest(center(s), p, pt(p.x, p.y + 200));
    return pt(p.x, 2 * foot.y - p.y);
  }

  /** Brahmagupta2Canvas.init(), point for point. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? APPLET.width : o.width;
    const height = o.height === undefined ? APPLET.height : o.height;
    const s = { width, height, A: pt(0, 0), B: pt(0, 0), C: pt(0, 0), D: pt(0, 0) };
    s.A = onCircle(s, -2);
    const firstD = onCircle(s, 0.4);
    s.B = otherH(s, firstD);
    s.C = otherV(s, s.A);
    s.D = onCircle(s, -0.2);
    return s;
  }

  /** Drag one corner; it stays on the circle, as in the applet. */
  function withPoint(s, name, p) {
    if (!["A", "B", "C", "D"].includes(name)) return s;
    return { ...s, [name]: project(s, p) };
  }

  /** Move a corner to an angle on the circle, keeping the other corners. */
  function withAngle(s, name, angle) {
    return withPoint(s, name, onCircle(s, angle));
  }

  /**
   * ComputePoints(), verbatim: P, Q, R, S are the side midpoints; E, F, G, H
   * are the feet of the perpendiculars to the opposite sides; T is the crossing
   * of two maltitudes and K the crossing of the two Varignon midlines.
   */
  function figure(s) {
    const P = mid(s.A, s.B);
    const E = nearest(P, s.C, s.D);
    const Q = mid(s.B, s.C);
    const F = nearest(Q, s.A, s.D);
    const R = mid(s.C, s.D);
    const G = nearest(R, s.A, s.B);
    const S = mid(s.D, s.A);
    const H = nearest(S, s.B, s.C);
    const T = meet(E, P, F, Q);
    const K = meet(P, R, Q, S);
    const maltitudes = [
      { name: "P–E", through: P, foot: E, side: [s.C, s.D] },
      { name: "Q–F", through: Q, foot: F, side: [s.A, s.D] },
      { name: "R–G", through: R, foot: G, side: [s.A, s.B] },
      { name: "S–H", through: S, foot: H, side: [s.B, s.C] },
    ];
    return { O: center(s), r: radius(s), P, Q, R, S, E, F, G, H, T, K, maltitudes };
  }

  /** The closed forms the drawing should agree with. */
  function centroid(s) {
    return scale(add(add(s.A, s.B), add(s.C, s.D)), 0.25);
  }

  function anticenter(s) {
    return sub(scale(add(add(s.A, s.B), add(s.C, s.D)), 0.5), center(s));
  }

  /** Distance from p to the infinite line through a and b. */
  function lineDistance(p, a, b) {
    const v = sub(b, a);
    const len = Math.hypot(v.x, v.y);
    return len < 1e-12 ? Infinity : Math.abs(cross(v, sub(p, a))) / len;
  }

  /**
   * Every claim the archived page makes, as residuals so the page can print
   * the biggest miss and the logic test can check hundreds of configurations.
   * The two numbered problems at the foot of the page are included too.
   */
  function claims(s) {
    const f = figure(s);
    const O = f.O;
    const ok = finite(f.T) && finite(f.K);
    const miss = ok
      ? Math.max(...f.maltitudes.map((m) => lineDistance(f.T, m.through, m.foot)))
      : Infinity;
    const perp = Math.max(
      ...f.maltitudes.map((m) => Math.abs(dot(sub(m.foot, m.through), sub(m.side[1], m.side[0])))),
    );
    const antipodeGap = ok ? distance(f.T, anticenter(s)) : Infinity;
    const centroidGap = ok ? distance(f.K, centroid(s)) : Infinity;
    const halfGap = ok
      ? Math.max(distance(f.K, mid(O, f.T)), distance(f.K, mid(f.P, f.R)), distance(f.K, mid(f.Q, f.S)))
      : Infinity;

    // Problem 1: U = AD ∩ BC; UT is perpendicular to SQ.
    const U = meet(s.A, s.D, s.B, s.C);
    const problem1 = ok && finite(U)
      ? Math.abs(dot(sub(U, f.T), sub(f.Q, f.S))) /
        (distance(U, f.T) * distance(f.Q, f.S) || 1)
      : Infinity;

    // Problem 2: reflect O in AB and CD; their midpoint is exactly T.
    const Oab = sub(scale(nearest(O, s.A, s.B), 2), O);
    const Ocd = sub(scale(nearest(O, s.C, s.D), 2), O);
    const problem2 = ok ? distance(f.T, mid(Oab, Ocd)) : Infinity;

    return {
      figure: f,
      maltitudeMiss: miss,
      perpendicularResidual: perp,
      anticenterGap: antipodeGap,
      centroidGap,
      midpointGap: halfGap,
      problem1,
      problem2,
      ok: ok && [miss, perp, antipodeGap, centroidGap, halfGap, problem1, problem2]
        .every((v) => v < 1e-5 * Math.max(1, f.r)),
    };
  }

  return {
    APPLET,
    pt, add, sub, scale, dot, cross, distance, sqDist, mid, finite,
    center, radius, onCircle, project, nearest, meet, otherH, otherV,
    start, withPoint, withAngle, figure, centroid, anticenter, lineDistance, claims,
  };
})();
