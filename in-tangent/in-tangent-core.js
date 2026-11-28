"use strict";

/*
 * In Tangent, from Alexander Bogomolny's applet InTangent.
 *
 * A is a triangle's apex, B and C lie on its base line, and X is a point on
 * that same line. The incircles of ABX and ACX have centres IB and IC. Reflect
 * the common tangent AX in the line IB IC: the reflected line is the other
 * internal common tangent, and its meeting point S with BC is exactly T, the
 * point where the incircle of ABC touches BC. X and T also lie on the circle
 * whose diameter is IB IC.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, InTangentCore, so the page loads it with a
 * plain <script> and porting/check-in-tangent.mjs loads it in Node. The
 * position is plain data (numbers and plain objects), and functions take a
 * position and return a new one.
 *
 * The applet keeps X as an affine fraction of BC (DoubLine.CreateMidPoint with
 * t = 0.3): dragging B or C keeps t, dragging X projects onto BC to find t.
 */
const InTangentCore = (() => {
  const EPS = 1e-10;

  const sqDist = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const distance = (p, q) => Math.sqrt(sqDist(p, q));
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Point on the infinite line through a and b, at parameter t from a. */
  function onLine(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** GeoSDoub.NearestPoint: the orthogonal projection onto an infinite line. */
  function foot(p, a, b) {
    const d = sub(b, a);
    const len2 = dot(d, d);
    if (len2 < EPS) return { x: a.x, y: a.y };
    return onLine(a, b, dot(sub(p, a), d) / len2);
  }

  /** The incenter, as the side-length-weighted mean of the three vertices. */
  function incenter(a, b, c) {
    const x = distance(b, c), y = distance(c, a), z = distance(a, b);
    const sum = x + y + z;
    if (sum < EPS) return { x: a.x, y: a.y };
    return {
      x: (x * a.x + y * b.x + z * c.x) / sum,
      y: (x * a.y + y * b.y + z * c.y) / sum,
    };
  }

  /** GetIncircle: FindIncenter, then the mean of the distances to the sides. */
  function incircle(a, b, c) {
    const center = incenter(a, b, c);
    const radius = (
      distance(center, foot(center, a, b)) +
      distance(center, foot(center, b, c)) +
      distance(center, foot(center, c, a))
    ) / 3;
    return { center: center, radius: radius };
  }

  /** Reflection in the infinite line through a and b. */
  function reflect(p, a, b) {
    const f = foot(p, a, b);
    return { x: 2 * f.x - p.x, y: 2 * f.y - p.y };
  }

  /** GeoSDoub.Intersect of two lines; null for parallel lines. */
  function intersect(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c);
    const den = r.x * s.y - r.y * s.x;
    if (Math.abs(den) < EPS) return null;
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
    return onLine(a, b, t);
  }

  /** The point where the incircle of ABC touches side BC. */
  function touch(a, b, c) {
    const sideBC = distance(b, c);
    if (sideBC < EPS) return { x: b.x, y: b.y };
    const semiperimeter = (sideBC + distance(c, a) + distance(a, b)) / 2;
    return onLine(b, c, (semiperimeter - distance(c, a)) / sideBC);
  }

  /** The applet's initial triangle: s = min(width, height) / 6. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const s = Math.min(width, height) / 6;
    return {
      width: width, height: height,
      A: { x: width / 2 + s / 2, y: height / 2 - s },
      B: { x: width / 2 - s, y: height / 2 + s },
      C: { x: width / 2 + 1.5 * s, y: height / 2 + 1.5 * s },
      t: o.t === undefined ? 0.3 : o.t,
      showCircle: !!o.showCircle,
    };
  }

  /** X was made from B*t + C*(1-t) by DoubLine.CreateMidPoint(0.3). */
  function pointX(state) {
    return {
      x: state.B.x * state.t + state.C.x * (1 - state.t),
      y: state.B.y * state.t + state.C.y * (1 - state.t),
    };
  }

  /** A fresh diagram with the same options. */
  function reset(state) {
    return start({
      width: state.width, height: state.height,
      t: 0.3, showCircle: state.showCircle,
    });
  }

  /** Dragging a triangle vertex leaves the fraction t of X on BC unchanged. */
  function moveVertex(state, name, p) {
    if (name !== "A" && name !== "B" && name !== "C") return state;
    const next = { ...state };
    next[name] = { x: p.x, y: p.y };
    return next;
  }

  /** DoubLine.UpdateMidPoint: project X onto BC to recover t. */
  function moveX(state, p) {
    const d = sub(state.B, state.C);
    const len2 = dot(d, d);
    if (len2 < EPS) return state;
    return { ...state, t: dot(d, sub(p, state.C)) / len2 };
  }

  /** Put X at T; a modern convenience for seeing the applet's "eyes" light. */
  function moveXToT(state) {
    const T = touch(state.A, state.B, state.C);
    return moveX(state, T);
  }

  /**
   * Everything the drawing needs. The reflected points give the second
   * internal common tangent; S is its crossing with BC. `finished` is the
   * applet's own Finished test: the eyes light when X is within one unit of T.
   */
  function analyze(state) {
    const A = state.A, B = state.B, C = state.C;
    const X = pointX(state);
    const incBX = incircle(A, B, X);
    const incCX = incircle(A, C, X);
    const IB = incBX.center, IC = incCX.center;
    const A2 = reflect(A, IB, IC);
    const X2 = reflect(X, IB, IC);
    const S = intersect(B, C, A2, X2);
    const T = touch(A, B, C);
    const circle = {
      center: { x: (IB.x + IC.x) / 2, y: (IB.y + IC.y) / 2 },
      radius: distance(IB, IC) / 2,
    };
    return {
      A: A, B: B, C: C, X: X,
      IB: IB, IC: IC, incBX: incBX, incCX: incCX,
      A2: A2, X2: X2, S: S, T: T, circle: circle,
      TB: foot(IB, A, X), TC: foot(IC, A, X),
      Bp: foot(IB, B, C), Cp: foot(IC, B, C),
      finished: Math.abs(distance(B, X) - distance(B, T)) < 1,
    };
  }

  /** The plain position saved for the player's record and the tutor. */
  function position(state) {
    const g = analyze(state);
    return {
      A: g.A, B: g.B, C: g.C, X: g.X, T: g.T, S: g.S,
      IB: g.IB, IC: g.IC, t: state.t,
      showCircle: state.showCircle, finished: g.finished,
    };
  }

  return {
    EPS: EPS, distance: distance, sqDist: sqDist, dot: dot, sub: sub,
    clamp: clamp, onLine: onLine, foot: foot, incenter: incenter,
    incircle: incircle, reflect: reflect, intersect: intersect, touch: touch,
    start: start, pointX: pointX, reset: reset, moveVertex: moveVertex,
    moveX: moveX, moveXToT: moveXToT, analyze: analyze, position: position,
  };
})();
