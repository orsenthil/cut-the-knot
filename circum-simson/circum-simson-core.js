"use strict";

/*
 * Circum Simson — the illustration behind Bogomolny's applet CircumSimson,
 * hosted on "Simsons of Diametrically Opposite Points"
 * (m/Algebra/CircumSimson.shtml). The page embeds a GeoGebra figure today, but
 * the original Java applet (and this port) draws the same construction.
 *
 * A, B, C and P are draggable points on one circle. Q is the point opposite P
 * (its antipode). Dropping perpendiculars from P and Q onto the three sides
 * gives two Simson lines. They are always at right angles, and where they meet
 * (M) traces the nine-point circle of ABC as P goes round.
 *
 * The one idea the code relies on is the applet's own CircumSimsonCanvas.Compute:
 * Q = 2·O − P, the six feet come from GeoSDoub.NearestPoint, the two lines from
 * CircumSimsonCanvas.GetLine (which picks two feet via InsideTest), and M is
 * GeoSDoub.Intersect of those lines. The nine-point circle is the circumcircle
 * of the three side midpoints. Every derived value is computed the same way as
 * the bytecode, so porting/check-circum-simson.mjs can compare it with a second,
 * literal transcription of the applet's methods over hundreds of drawings.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, CircumSimsonCore, so the page loads it with a plain
 * <script> and the check can load it in Node. Positions are plain data; each
 * function returns a new position and never changes what it was given.
 */
const CircumSimsonCore = (() => {
  const EPS = 1e-9;
  const VIEW = { width: 400, height: 250 }; // the applet's "400 seems optimal", "250 seems optimal"
  // CircumSimsonCanvas.init places A, B, C at angles −1.6, −4 and −0.2 about
  // the middle, at radius min(width,height)/3 (Java integer division), and P
  // at Math.random()*PI on the resulting circumcircle. A fixed angle in that
  // same [0, PI] range makes the illustration reproducible.
  const P_ANGLE = Math.PI / 3;
  const INIT_ANGLES = [-1.6, -4, -0.2];

  const copy = (p) => ({ x: p.x, y: p.y });
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** GeoSDoub.Intersect(P1,P2,P3,P4): lines in ax+by+c=0 form, |det|<1 is NaN. */
  function intersect(P1, P2, P3, P4) {
    const a1 = P1.y - P2.y, b1 = P2.x - P1.x;
    const c1 = P1.x * P2.y - P1.y * P2.x;
    const a2 = P3.y - P4.y, b2 = P4.x - P3.x;
    const c2 = P3.x * P4.y - P3.y * P4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindCircumcenter + CircumSimsonCanvas.GetCircle's average radius. */
  function circumcircle(A, B, C) {
    const midAB = midpoint(A, B), midBC = midpoint(B, C);
    const p = { x: midAB.x + B.y - A.y, y: midAB.y - B.x + A.x };
    const q = { x: midBC.x + C.y - B.y, y: midBC.y - C.x + B.x };
    const center = intersect(midAB, p, midBC, q);
    const r = (dist(center, A) + dist(center, B) + dist(center, C)) / 3;
    return { x: center.x, y: center.y, r };
  }

  /**
   * GeoSDoub.NearestPoint(P,X,Y): the foot on the infinite line XY. The
   * applet returns P itself when P is within sqrt(0.1) of X (its SqDist check).
   */
  function nearestPoint(P, X, Y) {
    if (sqDist(X, P) < 0.1) return copy(P);
    const dx = Y.x - X.x, dy = Y.y - X.y;
    const denom = dx * dx + dy * dy;
    if (denom <= EPS) return copy(X);
    const t = (dx * (P.x - X.x) + dy * (P.y - X.y)) / denom;
    return { x: X.x + dx * t, y: X.y + dy * t };
  }

  /** InsideTest.IsInside(A,B,C): (A−B)·(A−C) <= 0, i.e. an obtuse/right angle at A. */
  function insideTest(A, B, C) {
    return (A.x - B.x) * (A.x - C.x) + (A.y - B.y) * (A.y - C.y) <= 0;
  }

  /** CircumSimsonCanvas.GetLine: draw through the two feet not at the obtuse angle. */
  function simsonEnds(f1, f2, f3) {
    if (insideTest(f1, f2, f3)) return [copy(f2), copy(f3)];
    if (insideTest(f2, f3, f1)) return [copy(f3), copy(f1)];
    return [copy(f1), copy(f2)];
  }

  /** CTKMoveableDoub's circle glider: project a dragged point onto the circle. */
  function projectOnCircle(p, circle) {
    const d = dist(p, circle);
    if (d < EPS) return { x: circle.x + circle.r, y: circle.y };
    return {
      x: circle.x + ((p.x - circle.x) * circle.r) / d,
      y: circle.y + ((p.y - circle.y) * circle.r) / d,
    };
  }

  /** The position a new illustration starts from (the applet's init). */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? VIEW.width : o.width;
    const height = o.height === undefined ? VIEW.height : o.height;
    const cx = width / 2, cy = height / 2;
    const radius = Math.floor(Math.min(width, height) / 3); // Java int / 3
    const onCircle = (a) => ({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
    const A = onCircle(INIT_ANGLES[0]);
    const B = onCircle(INIT_ANGLES[1]);
    const C = onCircle(INIT_ANGLES[2]);
    const circle = circumcircle(A, B, C);
    const theta = o.angle === undefined ? P_ANGLE : o.angle;
    const P = {
      x: circle.x + circle.r * Math.cos(theta),
      y: circle.y + circle.r * Math.sin(theta),
    };
    const flag = (name, fallback) =>
      o[name] === undefined ? fallback : Boolean(o[name]);
    return {
      A: copy(A), B: copy(B), C: copy(C), P: copy(P), circle,
      showNames: flag("showNames", true),
      showPerps: flag("showPerps", false),
      showLines: flag("showLines", false),
      showMidpoints: flag("showMidpoints", false),
      showAngles: flag("showAngles", false),
      showCircle: flag("showCircle", false),
      trace: [],
    };
  }

  /** Everything the page draws, straight from CircumSimsonCanvas.Compute. */
  function compute(state) {
    const circle = state.circle;
    const A = state.A, B = state.B, C = state.C, P = state.P;
    const Q = { x: 2 * circle.x - P.x, y: 2 * circle.y - P.y };
    const Pa = nearestPoint(P, B, C);
    const Pb = nearestPoint(P, C, A);
    const Pc = nearestPoint(P, A, B);
    const Qa = nearestPoint(Q, B, C);
    const Qb = nearestPoint(Q, C, A);
    const Qc = nearestPoint(Q, A, B);
    const lineP = simsonEnds(Pa, Pb, Pc);
    const lineQ = simsonEnds(Qa, Qb, Qc);
    const M = intersect(lineP[0], lineP[1], lineQ[0], lineQ[1]);
    const Am = midpoint(B, C), Bm = midpoint(C, A), Cm = midpoint(A, B);
    const ninePoint = circumcircle(Am, Bm, Cm);
    // The three auxiliary circles the applet shows with "angles" ticked.
    const auxCircles = [
      circumcircle(P, Pa, B),
      circumcircle(P, C, Pb),
      circumcircle(C, Q, Qb),
    ];
    return {
      Q, Pa, Pb, Pc, Qa, Qb, Qc, lineP, lineQ, M,
      Am, Bm, Cm, ninePoint, auxCircles,
    };
  }

  /** The angle at v between vp and vq, in radians (0 when degenerate). */
  function angleAt(v, p, q) {
    const a = { x: p.x - v.x, y: p.y - v.y };
    const b = { x: q.x - v.x, y: q.y - v.y };
    const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
    if (n < EPS) return 0;
    return Math.acos(clamp(dot(a, b) / n, -1, 1));
  }

  /** The angle between the two Simson lines; the page claims it is 90°. */
  function simsonAngle(state) {
    const d = compute(state);
    if (![...d.lineP, ...d.lineQ].every((p) => Number.isFinite(p.x))) return NaN;
    return angleBetween(d.lineP[0], d.lineP[1], d.lineQ[0], d.lineQ[1]);
  }

  /** Unsigned angle in [0, PI] between the directions p→q and r→s. */
  function angleBetween(p, q, r, s) {
    const u = { x: q.x - p.x, y: q.y - p.y };
    const v = { x: s.x - r.x, y: s.y - r.y };
    const n = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    if (n < EPS) return NaN;
    return Math.acos(clamp(Math.abs(dot(u, v)) / n, -1, 1));
  }

  /** Signed area of a Simson triangle divided by R: 0 exactly when collinear. */
  function lineError(state, which) {
    const d = compute(state);
    const f = which === "Q" ? [d.Qa, d.Qb, d.Qc] : [d.Pa, d.Pb, d.Pc];
    if (!f.every((p) => Number.isFinite(p.x))) return NaN;
    return cross(f[0], f[1], f[2]) / Math.max(Math.abs(state.circle.r), EPS);
  }

  /** How far M is from the nine-point circle, as a fraction of R. */
  function ninePointError(state) {
    const d = compute(state);
    if (!Number.isFinite(d.M.x)) return Infinity;
    const err = Math.abs(dist(d.M, d.ninePoint) - d.ninePoint.r);
    return err / Math.max(Math.abs(state.circle.r), EPS);
  }

  /** The page's claim A' is the midpoint of PaQa (and likewise for B', C'). */
  function midpointError(state) {
    const d = compute(state);
    const scale = Math.max(Math.abs(state.circle.r), EPS);
    return Math.max(
      dist(midpoint(d.Pa, d.Qa), d.Am),
      dist(midpoint(d.Pb, d.Qb), d.Bm),
      dist(midpoint(d.Pc, d.Qc), d.Cm),
    ) / scale;
  }

  /** The page's PaPb ⟂ QaQb claim, in radians. */
  function feetAngle(state) {
    const d = compute(state);
    return angleBetween(d.Pa, d.Pb, d.Qa, d.Qb);
  }

  /** Directed Menelaus product for the feet of P: the page's proof needs −1. */
  function menelaus(state) {
    const d = compute(state);
    const ratio = (X, Y, F) => {
      const len = dist(X, Y);
      if (len < EPS) return NaN;
      const ux = (Y.x - X.x) / len, uy = (Y.y - X.y) / len;
      const t = (F.x - X.x) * ux + (F.y - X.y) * uy;
      return t / (len - t);
    };
    return ratio(state.A, state.B, d.Pc) *
      ratio(state.B, state.C, d.Pa) *
      ratio(state.C, state.A, d.Pb);
  }

  /** The nine-point circle should be centred at (O+H)/2 with radius R/2. */
  function ninePointCenterAndRadius(state) {
    const O = state.circle;
    const A = state.A, B = state.B, C = state.C;
    const H = { x: A.x + B.x + C.x - 2 * O.x, y: A.y + B.y + C.y - 2 * O.y };
    return { center: midpoint(O, H), r: O.r / 2 };
  }

  /** A new position with one named point moved onto the circle. */
  function withPoint(state, name, p) {
    if (!["A", "B", "C", "P"].includes(name) || !p) return state;
    const next = { ...state, trace: state.trace.slice() };
    next[name] = projectOnCircle({ x: p.x, y: p.y }, state.circle);
    return next;
  }

  /** A new position with one of the applet's six options changed. */
  function withOption(state, name, value) {
    const names = [
      "showNames", "showPerps", "showLines",
      "showMidpoints", "showAngles", "showCircle",
    ];
    if (!names.includes(name)) return state;
    return { ...state, [name]: Boolean(value) };
  }

  /** The applet's "Trace circle": add the current M to the recorded locus. */
  function withTrace(state, point) {
    const p = point || compute(state).M;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    return { ...state, trace: [...state.trace, copy(p)] };
  }

  /** The applet clears the trace when a new drag begins. */
  function clearTrace(state) {
    return state.trace.length ? { ...state, trace: [] } : state;
  }

  /** An illustration has no win and no loss. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, VIEW, INIT_ANGLES, P_ANGLE,
    start, compute, result,
    intersect, circumcircle, nearestPoint, insideTest, simsonEnds, projectOnCircle,
    angleAt, angleBetween, simsonAngle, lineError, ninePointError,
    midpointError, feetAngle, menelaus, ninePointCenterAndRadius,
    withPoint, withOption, withTrace, clearTrace,
    dist, sqDist, midpoint, copy,
  };
})();
