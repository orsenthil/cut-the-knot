"use strict";

/*
 * Carnot — the illustration behind Bogomolny's applet "Carnot's Theorem:
 * What Is It?" (Curriculum/Geometry/Carnot.shtml).
 *
 * Four dots slide on one circle: the triangle A, B, C and a point P on its
 * circumcircle. Through P, three lines are drawn, each making the same angle
 * with one side of the triangle (B→C, C→A and A→B). Their feet A', B', C' on
 * the three side lines always lie on one straight line. At 90° this is the
 * Simson (Wallace) line; the applet's slider (5°…160°) shows the general case.
 *
 * The one idea the code relies on is to keep the applet's own construction:
 * rotate one end of a side by the angle about the other end, draw through P a
 * line parallel to the rotated side, and intersect it with the side. That is
 * exactly CarnotCanvas.FindFoot (Rotate / GetParallelTo / Intersect in
 * GeoSDoub). The feet are then tested with the signed area of triangle A'B'C'.
 *
 * No document, no window, no storage. One global, CarnotCore, so the page
 * loads it with a plain <script> and porting/check-carnot.mjs can load it in
 * Node. Positions are plain data; functions never change what they are given.
 */
const CarnotCore = (() => {
  const EPS = 1e-9;
  const VIEW = { width: 500, height: 500 }; // the applet is embedded 500x500
  // CarnotPanel's Scrollbar(value=90, visible=10, minimum=5, maximum=170):
  // AWT stops getValue() at maximum − visibleAmount, i.e. 160.
  const ANGLE = { min: 5, max: 160, initial: 90, scrollbarMaximum: 170, visible: 10 };
  const PAIR_COUNT = 3; // ShowNumber = (ShowNumber + 1) % 3 on a click

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const copy = (p) => ({ x: p.x, y: p.y });
  const cross = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** GeoSDoub.Intersect(P1,P2,P3,P4): two lines in ax+by+c=0 form. */
  function intersect(P1, P2, P3, P4) {
    const a1 = P1.y - P2.y, b1 = P2.x - P1.x;
    const c1 = P1.x * P2.y - P1.y * P2.x;
    const a2 = P3.y - P4.y, b2 = P4.x - P3.x;
    const c2 = P3.x * P4.y - P3.y * P4.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN }; // as the applet does
    return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
  }

  /** GeoSDoub.FindCircumcenter, then CarnotCanvas.GetCircle's radius. */
  function circumcircle(A, B, C) {
    const midAB = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const midBC = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
    const p = { x: midAB.x + (B.y - A.y), y: midAB.y - (B.x - A.x) };
    const q = { x: midBC.x + (C.y - B.y), y: midBC.y - (C.x - B.x) };
    const center = intersect(midAB, p, midBC, q);
    const r = (dist(center, A) + dist(center, B) + dist(center, C)) / 3;
    return { x: center.x, y: center.y, r };
  }

  /** GeoSDoub.Rotate(P,Q,angle,+1): a clockwise turn in screen coordinates. */
  function rotate(P, Q, radians) {
    const cs = Math.cos(radians), sn = Math.sin(radians);
    const dx = Q.x - P.x, dy = Q.y - P.y;
    return {
      x: P.x + cs * dx - sn * dy,
      y: P.y + sn * dx + cs * dy,
    };
  }

  /** GeoSDoub.GetParallelTo(P,X,Y): P plus 100 times the direction X−Y. */
  function parallelThrough(P, X, Y) {
    return { x: P.x + 100 * (X.x - Y.x), y: P.y + 100 * (X.y - Y.y) };
  }

  /** CarnotCanvas.FindFoot: where the equally inclined line through P meets XY. */
  function footFromPoint(P, X, Y, angleDeg) {
    const turned = rotate(X, Y, (angleDeg * Math.PI) / 180);
    const parallel = parallelThrough(P, X, turned);
    return intersect(X, Y, P, parallel);
  }

  /** The three feet, in the applet's order: A' on BC, B' on CA, C' on AB. */
  function feet(state) {
    const a = state.angle;
    return {
      Ap: footFromPoint(state.P, state.B, state.C, a),
      Bp: footFromPoint(state.P, state.C, state.A, a),
      Cp: footFromPoint(state.P, state.A, state.B, a),
    };
  }

  /**
   * The position a new game starts from. The four points are placed just as
   * CarnotCanvas.init places them: angles −1.6, −4, −0.2 and 2.51327412287…,
   * at radius min(width,height)/5 about the middle of the 500x500 canvas.
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? VIEW.width : o.width;
    const height = o.height === undefined ? VIEW.height : o.height;
    const cx = width / 2, cy = height / 2;
    const radius = Math.floor(Math.min(width, height) / 5); // Java int / 5
    const onCircle = (angle, sign) => ({
      x: cx + radius * Math.cos(angle),
      y: cy + sign * radius * Math.sin(angle),
    });
    const A = onCircle(-1.6, 1), B = onCircle(-4, 1), C = onCircle(-0.2, 1);
    const circle = circumcircle(A, B, C);
    const P = {
      x: circle.x + circle.r * Math.cos(2.5132741228718345),
      y: circle.y - circle.r * Math.sin(2.5132741228718345),
    };
    const angle = clamp(
      o.angle === undefined ? ANGLE.initial : o.angle, ANGLE.min, ANGLE.max,
    );
    return {
      A: copy(A), B: copy(B), C: copy(C), P: copy(P),
      circle: circle,
      angle: angle,
      showSimilar: Boolean(o.showSimilar),
      showCirclePairs: Boolean(o.showCirclePairs),
      showNames: o.showNames === undefined ? true : Boolean(o.showNames),
      pair: o.pair === undefined ? 0 : ((o.pair % PAIR_COUNT) + PAIR_COUNT) % PAIR_COUNT,
    };
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

  /** A new position with one of A, B, C, P moved (always on the circle). */
  function withPoint(state, name, p) {
    if (!["A", "B", "C", "P"].includes(name)) return state;
    const next = { ...state, A: copy(state.A), B: copy(state.B), C: copy(state.C), P: copy(state.P) };
    next[name] = projectOnCircle({ x: p.x, y: p.y }, state.circle);
    return next;
  }

  function withAngle(state, angle) {
    if (!Number.isFinite(angle)) return state;
    return { ...state, angle: Math.round(clamp(angle, ANGLE.min, ANGLE.max)) };
  }

  function withOption(state, name, value) {
    if (name === "showSimilar" || name === "showCirclePairs" || name === "showNames") {
      return { ...state, [name]: Boolean(value) };
    }
    return state;
  }

  /** CarnotCanvas.mouseClicked: ShowNumber = (ShowNumber+1) % 3. */
  function nextPair(state) {
    return { ...state, pair: (state.pair + 1) % PAIR_COUNT };
  }

  /** The two triangles (or circles) highlighted for the current ShowNumber. */
  function pair(state) {
    const f = feet(state);
    const A = state.A, B = state.B, C = state.C, P = state.P;
    return [
      [[f.Ap, P, C], [A, f.Cp, P]],
      [[f.Ap, P, B], [A, f.Bp, P]],
      [[f.Bp, P, C], [B, f.Cp, P]],
    ][state.pair];
  }

  /** Signed area of A'B'C', divided by the circumradius: 0 iff collinear. */
  function lineError(state) {
    const f = feet(state);
    if (![f.Ap, f.Bp, f.Cp].every((p) => Number.isFinite(p.x))) return NaN;
    return cross(f.Ap, f.Bp, f.Cp) / Math.max(Math.abs(state.circle.r), EPS);
  }

  function isCollinear(state, tolerance) {
    const tol = tolerance === undefined ? 1e-8 : tolerance;
    const error = lineError(state);
    return Number.isFinite(error) && Math.abs(error) <= tol;
  }

  /** Directed Menelaus product AC'/C'B · BA'/A'C · CB'/B'A = −1. */
  function menelaus(state) {
    const f = feet(state);
    const ratio = (X, Y, F) => {
      const d = dist(X, Y);
      const ux = (Y.x - X.x) / d, uy = (Y.y - X.y) / d;
      const t = (F.x - X.x) * ux + (F.y - X.y) * uy;
      return t / (d - t);
    };
    return ratio(state.A, state.B, f.Cp) *
      ratio(state.B, state.C, f.Ap) *
      ratio(state.C, state.A, f.Bp);
  }

  /** The squared-length sum from the other cut-the-knot Carnot article. */
  function squaredIdentity(state) {
    const f = feet(state);
    return dist(state.A, f.Cp) ** 2 - dist(state.B, f.Cp) ** 2 +
      dist(state.B, f.Ap) ** 2 - dist(state.C, f.Ap) ** 2 +
      dist(state.C, f.Bp) ** 2 - dist(state.A, f.Bp) ** 2;
  }

  /** An illustration has no win and no loss. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, VIEW, ANGLE, PAIR_COUNT,
    start, circumcircle, intersect, rotate, parallelThrough, footFromPoint,
    projectOnCircle, withPoint, withAngle, withOption, nextPair, pair,
    feet, lineError, isCollinear, menelaus, squaredIdentity, result,
  };
})();
