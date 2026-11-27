"use strict";

/*
 * Common Tangent Sangaku, from Alexander Bogomolny's applet CommonTangentSangaku.
 *
 * Two circles sit inside an angle, both touching its sides, with the small one
 * centred on the line joining the vertex C to the big circle's centre O. Let
 * MN be the chord of the big circle perpendicular to OC; M and N are where
 * that circle touches the angle's sides. The sangaku says that any two of
 *   (1) M,N are the points of tangency with the sides,
 *   (2) the small circle is tangent to the chord MN,
 *   (3) the small circle's centre lies on the big circle
 * force the third. The applet builds all three at once: Q divides CO in the
 * ratio coef : 1-coef, so CQ = coef*d, OQ = (1-coef)d = R and the small radius
 * is R*CQ/d. The chord MN comes from the circle centred at C orthogonal to
 * (O), whose radius is sqrt(d^2 - R^2).
 *
 * This is the geometry and nothing else: no document, no window, no storage.
 * It defines one global, CommonTangentSangakuCore, so the page loads it with a
 * plain <script> and porting/check-common-tangent-sangaku.mjs loads it in Node.
 * The position is plain data and every function returns a new position.
 */
const CommonTangentSangakuCore = (() => {
  // The applet's getParameterInfo says 400 by 250 is optimal; its coef is 0.6.
  const WIDTH = 400;
  const HEIGHT = 250;
  const COEF = 0.6;
  const MIN_CQ = 2; // Compute() refuses a diagram closer than two pixels
  const EPS = 1e-10;

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  /** The applet's InsideTest.IsInside(C,O,Q): the angle OCQ is at least 90°. */
  function insideTest(v, p, q) {
    return (v.x - p.x) * (v.x - q.x) + (v.y - p.y) * (v.y - q.y) <= 0;
  }

  /** Where p lands on the segment a..b, as a parameter in [0,1]. */
  function parameterOnSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return 0;
    return clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
  }

  /** Foot of the perpendicular from p to the line through a and b. */
  function nearestPoint(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy < 0.1) return { x: p.x, y: p.y }; // GeoSDoub's guard
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Perpendicular distance from p to the infinite line through a and b. */
  function distanceToLine(p, a, b) {
    const foot = nearestPoint(p, a, b);
    return distance(p, foot);
  }

  /**
   * GeoSDoub.Intersect(a,b,c,d): line intersection with the applet's own
   * tolerance of 1 on the determinant. A nearly parallel pair returns NaN in
   * Java; we return null so callers can hide the construction safely.
   */
  function lineIntersection(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1) return null;
    const x = (b1 * c2 - b2 * c1) / det;
    const y = (c1 * a2 - c2 * a1) / det;
    return Number.isFinite(x) && Number.isFinite(y) ? { x: x, y: y } : null;
  }

  /** The two intersections of two circles, by the centre-line formula. */
  function circleIntersections(c1, r1, c2, r2) {
    const dx = c2.x - c1.x, dy = c2.y - c1.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h2 = r1 * r1 - a * a;
    if (h2 < -EPS) return [];
    const h = Math.sqrt(Math.max(0, h2));
    const ux = dx / d, uy = dy / d;
    const base = { x: c1.x + ux * a, y: c1.y + uy * a };
    if (h < EPS) return [base];
    return [
      { x: base.x - uy * h, y: base.y + ux * h },
      { x: base.x + uy * h, y: base.y - ux * h },
    ];
  }

  /** The diagram a new page opens with: the applet's init() coordinates. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? WIDTH : o.width;
    const height = o.height === undefined ? HEIGHT : o.height;
    const coef = clamp(o.coef === undefined ? COEF : o.coef, 0, 1);
    const O = { x: width / 2, y: height / 2 };
    const C = { x: width * 4 / 5, y: height * 3 / 5 };
    return {
      width: width, height: height,
      O: O, C: C, Q: lerp(C, O, coef), coef: coef,
      showNames: !!o.showNames,
      showStatement: !!o.showStatement,
      showHint: !!o.showHint,
    };
  }

  /** Back to the applet's opening diagram, keeping the three display options. */
  function reset(state) {
    return start({
      width: state.width, height: state.height,
      showNames: state.showNames, showStatement: state.showStatement,
      showHint: state.showHint,
    });
  }

  /**
   * Move one of the three draggable points. C and O are free inside the board;
   * Q is a glider on the segment C..O (the applet's CO.RestrictToSegment()),
   * so moving C or O puts Q back at the saved ratio coef.
   */
  function movePoint(state, name, point) {
    const margin = 12;
    const inside = {
      x: clamp(point.x, margin, state.width - margin),
      y: clamp(point.y, margin, state.height - margin),
    };
    if (name === "C") {
      const C = inside;
      return { ...state, C: C, Q: lerp(C, state.O, state.coef) };
    }
    if (name === "O") {
      const O = inside;
      return { ...state, O: O, Q: lerp(state.C, O, state.coef) };
    }
    if (name === "Q") {
      const coef = parameterOnSegment(point, state.C, state.O);
      return { ...state, coef: coef, Q: lerp(state.C, state.O, coef) };
    }
    return state;
  }

  /** Set the saved ratio directly (useful for reproducing a configuration). */
  function setCoef(state, coef) {
    const t = clamp(coef, 0, 1);
    return { ...state, coef: t, Q: lerp(state.C, state.O, t) };
  }

  /** The applet's Compute() early-out: too close, or an angle >= 90°. */
  function canDraw(state) {
    return distance(state.Q, state.C) >= MIN_CQ && !insideTest(state.C, state.O, state.Q);
  }

  /** The three radii: big circle R = OQ, small circle r = R*CQ/d. */
  function radii(state) {
    const d = distance(state.O, state.C);
    const R = distance(state.O, state.Q);
    return { d: d, R: R, r: d > 0 ? R * distance(state.Q, state.C) / d : 0 };
  }

  /**
   * The full computation from Compute(): the tangency chord MN, its midpoint
   * P, the feet S,T, the far point V of (O), and U,W where the tangent at V
   * meets the angle's sides. Returns null when the applet would leave the
   * picture blank.
   */
  function geometry(state) {
    if (!canDraw(state)) return null;
    const C = state.C, O = state.O;
    const rad = radii(state);
    const d = rad.d, R = rad.R;
    if (!(d > R) || !(R > 0)) return null;

    const rAux = Math.sqrt(d * d - R * R); // circle about C orthogonal to (O)
    const hits = circleIntersections(C, rAux, O, R);
    if (hits.length < 2) return null;
    // The applet orders the two points by their y coordinate.
    let M = hits[0], N = hits[1];
    if (M.y >= N.y) { M = hits[1]; N = hits[0]; }

    const P = { x: (M.x + N.x) / 2, y: (M.y + N.y) / 2 };
    const S = nearestPoint(state.Q, C, M);
    const T = nearestPoint(state.Q, C, N);
    // Farthest point of (O) from C: C + (1 + R/d) * (O - C).
    const stretch = (d + R) / d;
    const V = { x: C.x + stretch * (O.x - C.x), y: C.y + stretch * (O.y - C.y) };
    // The tangent at V is perpendicular to CV (a -90° rotation of C-V).
    const tangentEnd = { x: V.x + (C.y - V.y), y: V.y + (C.x - V.x) };
    const U = lineIntersection(V, tangentEnd, C, M);
    const W = lineIntersection(V, tangentEnd, C, N);
    return {
      R: R, r: rad.r, d: d, rAux: rAux,
      M: M, N: N, P: P, S: S, T: T, V: V, U: U, W: W,
      circleO: { center: O, radius: R },
      circleQ: { center: state.Q, radius: rad.r },
      circleC: { center: C, radius: rAux },
    };
  }

  /**
   * The three conditions of the page, measured on the current diagram.
   * Condition 3 is true by construction here; the logic test rebuilds each
   * condition independently to check the "any two imply the third" claim.
   */
  function conditions(state, tolerance) {
    const tol = tolerance === undefined ? 1e-6 : tolerance;
    const g = geometry(state);
    if (!g) return null;
    const c1 = Math.abs((g.M.x - state.O.x) * (g.M.x - state.C.x) +
      (g.M.y - state.O.y) * (g.M.y - state.C.y)) <= tol * g.d;
    const c2 = Math.abs(distanceToLine(state.Q, g.M, g.N) - g.r) <= tol;
    const c3 = Math.abs(distance(state.Q, state.O) - g.R) <= tol;
    return { tangencyPoints: c1, tangentToChord: c2, onBigCircle: c3 };
  }

  /** The plain position saved for the player's record and the tutor. */
  function position(state) {
    const g = geometry(state);
    return {
      C: { x: state.C.x, y: state.C.y },
      O: { x: state.O.x, y: state.O.y },
      Q: { x: state.Q.x, y: state.Q.y },
      coef: state.coef,
      radiusO: g ? g.R : null,
      radiusQ: g ? g.r : null,
      M: g ? g.M : null,
      N: g ? g.N : null,
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, COEF: COEF, MIN_CQ: MIN_CQ,
    distance: distance, clamp: clamp, lerp: lerp, insideTest: insideTest,
    parameterOnSegment: parameterOnSegment, nearestPoint: nearestPoint,
    distanceToLine: distanceToLine, lineIntersection: lineIntersection,
    circleIntersections: circleIntersections,
    start: start, reset: reset, movePoint: movePoint, setCoef: setCoef,
    canDraw: canDraw, radii: radii, geometry: geometry,
    conditions: conditions, position: position,
  };
})();
