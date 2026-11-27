"use strict";

/*
 * Eyeball 2 — the Squinting Eyes Theorem, from Alexander Bogomolny's
 * applet Eyeball2 (the 1842 Aichi sangaku). Two circles have centres A and B
 * and radii RA, RB. P and Q are the points of the circles farthest from the
 * other centre. The tangents from P to the other circle, and from Q to the
 * first, cut out two curvilinear "isosceles triangles"; the circles inscribed
 * in them have the same radius
 *
 *     r = 2 RA RB / (RA + RB + AB).
 *
 * The key idea is similarity: the right triangle PTB (BT = RB, PB = RA + AB)
 * is similar to the right triangle PSR made by the small circle, where
 * PR = 2 RA - RS. That gives the formula, which is symmetric in A and B.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, Eyeball2Core, so the page loads it with a
 * plain <script> and porting/check-eyeball-2.mjs loads it in Node. The
 * position is plain data and every function returns a new position.
 */
const Eyeball2Core = (() => {
  const EPS = 1e-9;
  const WIDTH = 600;
  const HEIGHT = 400;
  const MIN_RADIUS = 4;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });

  /** The applet's init(): centres at W/3 and 2W/3, radius min(W,H)/6. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const base = Math.min(width, height) / 2;
    const y = height / 2;
    const A = { x: Math.trunc(width / 3), y: y };
    const B = { x: Math.trunc((2 * width) / 3), y: y };
    return {
      width: width, height: height,
      A: A, B: B,
      boundaryA: { x: A.x - base / 3, y: y },
      boundaryB: { x: B.x + base / 3, y: y },
    };
  }

  /** Reset keeps the canvas size and puts the handles back where init did. */
  function reset(state) {
    return start({ width: state.width, height: state.height });
  }

  /**
   * One of the four draggable points. Moving a centre carries its boundary
   * point with it (the applet's MoveableCircle.UpdateLocation), so the radius
   * stays put; moving a boundary point changes that circle's radius. The
   * modern guard keeps a radius of at least 4 units and the handle on board.
   */
  function setPoint(state, name, point) {
    if (!point) return state;
    const q = {
      x: clamp(point.x, 2, state.width - 2),
      y: clamp(point.y, 2, state.height - 2),
    };
    if (name === "A" || name === "B") {
      const key = name === "A" ? "A" : "B";
      const boundaryKey = name === "A" ? "boundaryA" : "boundaryB";
      const shift = sub(q, state[key]);
      return { ...state, [key]: q, [boundaryKey]: add(state[boundaryKey], shift) };
    }
    const centre = name === "boundaryA" ? state.A : state.B;
    const key = name === "boundaryA" ? "boundaryA" : "boundaryB";
    if (distance(q, centre) < MIN_RADIUS) return state;
    return { ...state, [key]: q };
  }

  /** Intersections of two circles, in either order; [] if they do not meet. */
  function circleIntersections(c0, r0, c1, r1) {
    const dx = c1.x - c0.x, dy = c1.y - c0.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS || d > r0 + r1 + EPS || d < Math.abs(r0 - r1) - EPS) return [];
    const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
    const base = { x: c0.x + (dx * a) / d, y: c0.y + (dy * a) / d };
    if (h < EPS) return [base];
    return [
      { x: base.x - (dy * h) / d, y: base.y + (dx * h) / d },
      { x: base.x + (dy * h) / d, y: base.y - (dx * h) / d },
    ];
  }

  /** The page's radius, before any question of whether tangents exist. */
  function incircleRadius(ra, rb, d) {
    const sum = ra + rb + d;
    return sum > 0 ? (2 * ra * rb) / sum : 0;
  }

  /**
   * All the geometry of the current position, in board units.
   * `tangents` are the segments from P and Q to the points of contact.
   * `incircles` are placed as the page's diagram and proof place them: inside
   * each circle, on the side facing the other one. `appletCircles` keep the
   * original Java bytecode's outer placement, for comparison in the test.
   */
  function measure(state) {
    const ra = distance(state.A, state.boundaryA);
    const rb = distance(state.B, state.boundaryB);
    const d = distance(state.A, state.B);
    const u = d > EPS ? scale(sub(state.B, state.A), 1 / d) : { x: 1, y: 0 };
    const P = add(state.A, scale(u, -ra));     // farthest point of C(A, RA) from B
    const Q = add(state.B, scale(u, rb));      // farthest point of C(B, RB) from A
    const r = incircleRadius(ra, rb, d);

    // DrawTangents(g, source, target): the vertex is the farthest point of
    // the target circle from the source centre, so Draw(C1, C2) draws from Q
    // to circle A and Draw(C2, C1) draws from P to circle B. The tangent
    // circle at the vertex has radius sqrt((d + targetRadius)^2 - sourceRadius^2).
    const qQ = (d + rb) * (d + rb) - ra * ra;
    const qP = (d + ra) * (d + ra) - rb * rb;
    // GeoSDoub.Intersect returns two points even when the circles merely
    // touch: keep that pair, so the applet's degenerate tangent still counts.
    const touchPair = (hits) => hits.length === 1 ? [hits[0], hits[0]] : hits;
    const fromP = qP >= 0 && d > EPS
      ? touchPair(circleIntersections(state.B, rb, P, Math.sqrt(qP))) : [];
    const fromQ = qQ >= 0 && d > EPS
      ? touchPair(circleIntersections(state.A, ra, Q, Math.sqrt(qQ))) : [];

    const facingA = add(state.A, scale(u, ra - r));
    const facingB = add(state.B, scale(u, -(rb - r)));
    return {
      A: state.A, B: state.B, ra: ra, rb: rb, d: d, r: r, P: P, Q: Q,
      tangents: { fromP: fromP, fromQ: fromQ },
      possible: fromP.length === 2 && fromQ.length === 2,
      incircles: [
        { centre: facingA, radius: r, owner: "A" },
        { centre: facingB, radius: r, owner: "B" },
      ],
      appletCircles: [
        { centre: add(state.A, scale(u, -(ra - r))), radius: r },
        { centre: add(state.B, scale(u, rb - r)), radius: r },
      ],
    };
  }

  /** Plain data for assets/progress.js and the tutor. */
  function position(state) {
    const g = measure(state);
    return {
      A: g.A, B: g.B,
      boundaryA: state.boundaryA, boundaryB: state.boundaryB,
      ra: g.ra, rb: g.rb, d: g.d, radius: g.r, possible: g.possible,
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, EPS: EPS,
    distance: distance, start: start, reset: reset, setPoint: setPoint,
    circleIntersections: circleIntersections, incircleRadius: incircleRadius,
    measure: measure, position: position,
  };
})();
