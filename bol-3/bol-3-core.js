"use strict";

/*
 * BOL3 — Archimedes' Book of Lemmas, Proposition 3 (Bogomolny's Java applet).
 *
 * A, B are the ends of a diameter and P is a point on the circle. N is the
 * foot of the perpendicular from P to line AB, and D is the reflection of A
 * in N, so AN = ND. Q is the other point of the circle with PA = PQ: equal
 * chords cut off equal arcs. The proposition says BQ = BD.
 *
 * The one idea the code relies on: O (the centre) and P are both equally far
 * from A and from Q, so OP is the perpendicular bisector of AQ. Thus Q is the
 * reflection of A in the line OP. Starting from that, all the lengths come
 * from two reflections and one projection; no angle measurement is needed.
 *
 * Coordinates are the applet's own: width 400, height 300, A = (50, 225),
 * B = (350, 225), O = (200, 225), R = 150 and P starts at O - R*(cos45,sin45).
 * Screen y grows downwards; lengths and perpendicularity are unchanged.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, Bol3Core, so the page loads it with a plain <script>
 * and porting/check-bol-3.mjs loads it in Node. Positions are plain data; no
 * function changes the position it is given.
 */
const Bol3Core = (() => {
  const EPS = 1e-9;

  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const dot = (u, v) => u.x * v.x + u.y * v.y;

  /** The starting diagram, placed exactly as the applet's init() places it. */
  function start(options) {
    const o = options || {};
    if (o.A && o.B && o.P) return { A: copy(o.A), B: copy(o.B), P: copy(o.P) };
    const w = o.width === undefined ? 400 : o.width;
    const h = o.height === undefined ? 300 : o.height;
    const inset = Math.trunc(w / 8); // Java: width / 8 in integer arithmetic
    const lift = Math.trunc(h / 4); // Java: height / 4 in integer arithmetic
    const A = { x: inset, y: h - lift };
    const B = { x: w - inset, y: h - lift };
    const O = midpoint(A, B);
    const R = dist(A, O);
    const P = o.P
      ? copy(o.P)
      : { x: O.x - R * Math.cos(Math.PI / 4), y: O.y - R * Math.sin(Math.PI / 4) };
    return { A, B, P };
  }

  /** The circle through A and B with AB as a diameter. */
  function circle(state) {
    const O = midpoint(state.A, state.B);
    return { c: O, r: dist(state.A, O) };
  }

  /** Snap a dragged point onto the circle (the applet's RestrictToCircle). */
  function onCircle(state, q) {
    const { c, r } = circle(state);
    const dx = q.x - c.x, dy = q.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS) return { x: c.x, y: c.y - r };
    return { x: c.x + (r * dx) / d, y: c.y + (r * dy) / d };
  }

  /** A new position with P moved; P always stays on the circle. */
  function withP(state, q) {
    return { A: copy(state.A), B: copy(state.B), P: onCircle(state, q) };
  }

  /** The nearest point to P on the *infinite* line AB (GeoSDoub.NearestPoint). */
  function foot(state) {
    const { A, B, P } = state;
    const dx = B.x - A.x, dy = B.y - A.y;
    const len2 = sqDist(A, B);
    if (len2 < 0.1) return copy(P); // the applet's own guard for a tiny AB
    const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
    return { x: A.x + dx * t, y: A.y + dy * t };
  }

  /** 2*to - from: the reflection of `from` in `to` (the applet's Extend). */
  function extendPoint(from, to) {
    return { x: 2 * to.x - from.x, y: 2 * to.y - from.y };
  }

  /** D: N is the midpoint of AD, because AN = ND. */
  function extend(state) {
    return extendPoint(state.A, foot(state));
  }

  /** The reflection of a point in the line through O and P. */
  function reflectInOP(state, p) {
    const { c } = circle(state);
    const dx = state.P.x - c.x, dy = state.P.y - c.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return copy(p);
    const t = ((p.x - c.x) * dx + (p.y - c.y) * dy) / len2;
    return { x: 2 * (c.x + dx * t) - p.x, y: 2 * (c.y + dy * t) - p.y };
  }

  /** Q: the second intersection of circle(P, PA) with the big circle. */
  function Q(state) {
    return reflectInOP(state, state.A);
  }

  /** Everything the page draws and the logic test measures. */
  function measure(state) {
    const { c, r } = circle(state);
    const N = foot(state);
    const D = extendPoint(state.A, N);
    const q = Q(state);
    const { A, B, P } = state;
    return {
      A: copy(A), B: copy(B), P: copy(P), O: copy(c), R: r,
      N, D, Q: q,
      PA: dist(P, A), PQ: dist(P, q),
      AN: dist(A, N), ND: dist(N, D),
      PN: dist(P, N),
      BQ: dist(B, q), BD: dist(B, D),
      AB: dist(A, B),
    };
  }

  /** Each claim of the proposition, checked numerically at this position. */
  function claims(state) {
    const m = measure(state);
    const tol = 1e-7 * Math.max(m.AB, 1);
    const dx = state.B.x - state.A.x, dy = state.B.y - state.A.y;
    return {
      pnPerpendicular: Math.abs(dot(
        { x: state.P.x - m.N.x, y: state.P.y - m.N.y }, { x: dx, y: dy },
      )) <= tol,
      anEqualsNd: Math.abs(m.AN - m.ND) <= tol,
      paEqualsPq: Math.abs(m.PA - m.PQ) <= tol,
      bqEqualsBd: Math.abs(m.BQ - m.BD) <= tol,
      qOnCircle: Math.abs(dist(m.Q, m.O) - m.R) <= tol,
      nOnAB: Math.abs(dot(
        { x: m.N.x - state.A.x, y: m.N.y - state.A.y }, { x: -dy, y: dx },
      )) <= tol,
    };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    start, circle, onCircle, withP, foot, extendPoint, extend,
    reflectInOP, Q, measure, claims, result, dist, sqDist, midpoint,
  };
})();
