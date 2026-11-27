"use strict";

/*
 * Simultaneous Diameters in Concurrent Circles, from Alexander Bogomolny's
 * applet DiametersInConcurrentCircles (the page cites Brannan, Esplen and
 * Gray, Geometry, p. 258). Three circles through a common point O meet again
 * in pairs at D, E and F. The lines OD, OE and OF cut the circles again at A,
 * B and C. The page asks: if OA and OB are diameters of their circles, must
 * OC be a diameter of the third?
 *
 * The code follows the applet's own Compute method. Circle (P) is the circle
 * centred at P through O, (Q) is centred at Q, (R) at R. D is the second
 * intersection of (Q) and (R), E of (P) and (R), F of (P) and (Q); A is the
 * second intersection of circle (P) with the line OD, and so on. A centre is
 * "inside" its diameter exactly when IsInside(centre, O, endpoint) holds,
 * i.e. the centre lies between O and that endpoint (applet tolerance 0.05).
 *
 * This file is the geometry only: no document, no window, no storage. It
 * defines one global, DiametersInConcurrentCirclesCore, so the page loads it
 * with a plain <script> and porting/check-diameters-in-concurrent-circles.mjs
 * loads it in Node. Positions are plain data; every function returns a new
 * position and leaves its argument alone.
 */
const DiametersInConcurrentCirclesCore = (() => {
  /** The applet's suggested WIDTH/HEIGHT parameters are 400 and 300. */
  const DEFAULT_WIDTH = 400;
  const DEFAULT_HEIGHT = 300;
  /** FromCircle's three angles on the circle centred at O, in radians. */
  const ANGLES = [
    -2.5132741228718345, // -4*pi/5, the applet's literal constant
    -0.7853981633974483, // -pi/4
    Math.PI / 2,
  ];
  const EDGE = 4; // a drag guard for the handles, in board units

  // GeoSDoub.Dist is Math.sqrt(SqDist), not Math.hypot: the rounding matters
  // at tangencies, where the applet's discriminant can land just either side 0.
  const distance = (p, q) => Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** The applet's O = (w/2, h/2), and P, Q, R on a circle of radius min(w,h)/5. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? DEFAULT_WIDTH : o.width;
    const height = o.height === undefined ? DEFAULT_HEIGHT : o.height;
    const O = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height) / 5;
    const points = ANGLES.map((a) => ({
      x: O.x + radius * Math.cos(a),
      y: O.y + radius * Math.sin(a),
    }));
    return {
      width: width, height: height,
      O: O, P: points[0], Q: points[1], R: points[2],
    };
  }

  /** Reset keeps the board size and restores the applet's starting picture. */
  function reset(state) {
    return start({ width: state.width, height: state.height });
  }

  /** Drag one of the four handles. Unknown names and non-finite points are ignored. */
  function movePoint(state, name, point) {
    if (!["O", "P", "Q", "R"].includes(name)) return state;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return state;
    const next = {
      width: state.width, height: state.height,
      O: { ...state.O }, P: { ...state.P }, Q: { ...state.Q }, R: { ...state.R },
    };
    next[name] = {
      x: clamp(point.x, EDGE, state.width - EDGE),
      y: clamp(point.y, EDGE, state.height - EDGE),
    };
    return next;
  }

  /**
   * GeoSDoub.Intersect(DoubCircle, DoubCircle), transcribed: x-branch when
   * |c1.x - c2.x| > 1, else y-branch when |c1.y - c2.y| > 1, else two copies
   * of c1's centre (the applet's copy constructor). null means no intersection.
   * The x-branch writes x = m*y + b and solves the quadratic in y; the
   * y-branch writes y = m*x + b and solves in x.
   */
  function circleCircle(c1, c2) {
    const common = c1.center.x * c1.center.x - c2.center.x * c2.center.x +
      c1.center.y * c1.center.y - c2.center.y * c2.center.y -
      c1.radius * c1.radius + c2.radius * c2.radius;
    if (Math.abs(c1.center.x - c2.center.x) > 1) {
      const d = c1.center.x - c2.center.x;
      const m = -(c1.center.y - c2.center.y) / d;
      const b = common / 2 / d;
      const h = b - c1.center.x;
      const a = m * m + 1;
      const bb = m * h - c1.center.y;
      const c = c1.center.y * c1.center.y + h * h - c1.radius * c1.radius;
      const disc = bb * bb - a * c;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const y1 = (-bb + root) / a, y2 = (-bb - root) / a;
      return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
    }
    if (Math.abs(c1.center.y - c2.center.y) > 1) {
      const d = c1.center.y - c2.center.y;
      const m = -(c1.center.x - c2.center.x) / d;
      const b = common / 2 / d;
      const h = b - c1.center.y;
      const a = m * m + 1;
      const bb = m * h - c1.center.x;
      const c = c1.center.x * c1.center.x + h * h - c1.radius * c1.radius;
      const disc = bb * bb - a * c;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const x1 = (-bb + root) / a, x2 = (-bb - root) / a;
      return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
    }
    // The applet's degenerate branch: both slots hold a copy of c1's centre.
    return [{ x: c1.center.x, y: c1.center.y }, { x: c1.center.x, y: c1.center.y }];
  }

  /**
   * GeoSDoub.Intersect(DoubCircle, DoubLine), transcribed: IntersectX when
   * |p1.y - p2.y| > 1 (line x = m*y + b), IntersectY when |p1.x - p2.x| > 1
   * (line y = m*x + b), else null as the applet does.
   */
  function circleLine(c, p1, p2) {
    if (Math.abs(p1.y - p2.y) > 1) {
      const m = (p1.x - p2.x) / (p1.y - p2.y);
      const b = p2.x - m * p2.y;
      const h = b - c.center.x;
      const a = m * m + 1;
      const bb = m * h - c.center.y;
      const cc = c.center.y * c.center.y + h * h - c.radius * c.radius;
      const disc = bb * bb - a * cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const y1 = (-bb + root) / a, y2 = (-bb - root) / a;
      return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
    }
    if (Math.abs(p1.x - p2.x) > 1) {
      const m = (p1.y - p2.y) / (p1.x - p2.x);
      const b = p2.y - m * p2.x;
      const h = b - c.center.y;
      const a = m * m + 1;
      const bb = m * h - c.center.x;
      const cc = c.center.x * c.center.x + h * h - c.radius * c.radius;
      const disc = bb * bb - a * cc;
      if (disc < 0) return null;
      const root = Math.sqrt(disc);
      const x1 = (-bb + root) / a, x2 = (-bb - root) / a;
      return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
    }
    return null;
  }

  /** The applet's Other: the first intersection unless it is less than 1 from O. */
  function other(points, O) {
    if (!points) return null;
    if (distance(points[0], O) < 1) return points[1];
    return points[0];
  }

  /** The applet's IsInside: is x on the segment from O to end? Tolerance 0.05. */
  function isInside(x, O, end) {
    if (!end) return false;
    return Math.abs(distance(x, O) + distance(x, end) - distance(O, end)) < 0.05;
  }

  /**
   * DiametersInConcurrentCirclesCanvas.Compute. `valid` is false in the
   * applet's early-return case (a centre within one unit of O). The applet
   * then keeps the previous picture; here the caller simply hides it.
   */
  function compute(state) {
    const { O, P, Q, R } = state;
    const empty = {
      O: { ...O }, P: { ...P }, Q: { ...Q }, R: { ...R },
      D: null, E: null, F: null, A: null, B: null, C: null,
      cP: null, cQ: null, cR: null,
      pok: false, qok: false, rok: false, all: false, valid: false,
    };
    if (distance(O, P) < 1 || distance(O, Q) < 1 || distance(O, R) < 1) return empty;

    const cR = { center: { ...R }, radius: distance(R, O) };
    const cP = { center: { ...P }, radius: distance(P, O) };
    const cQ = { center: { ...Q }, radius: distance(Q, O) };
    const D = other(circleCircle(cR, cQ), O);
    const E = other(circleCircle(cP, cR), O);
    const F = other(circleCircle(cQ, cP), O);
    const A = other(circleLine(cP, D, O), O);
    const B = other(circleLine(cQ, E, O), O);
    const C = other(circleLine(cR, F, O), O);
    const pok = isInside(P, O, A);
    const qok = isInside(Q, O, B);
    const rok = isInside(R, O, C);
    return {
      O: { ...O }, P: { ...P }, Q: { ...Q }, R: { ...R },
      D: D && { ...D }, E: E && { ...E }, F: F && { ...F },
      A: A && { ...A }, B: B && { ...B }, C: C && { ...C },
      cP: cP, cQ: cQ, cR: cR,
      pok: pok, qok: qok, rok: rok,
      all: pok && qok && rok,
      valid: !!(D && E && F && A && B && C),
    };
  }

  /** A plain, DOM-free position for the player's record and the tutor. */
  function position(state) {
    const g = compute(state);
    return {
      width: state.width, height: state.height,
      O: g.O, P: g.P, Q: g.Q, R: g.R,
      A: g.A, B: g.B, C: g.C, D: g.D, E: g.E, F: g.F,
      pok: g.pok, qok: g.qok, rok: g.rok, all: g.all,
    };
  }

  return {
    DEFAULT_WIDTH: DEFAULT_WIDTH, DEFAULT_HEIGHT: DEFAULT_HEIGHT,
    ANGLES: ANGLES, EDGE: EDGE,
    distance: distance, clamp: clamp, start: start, reset: reset,
    movePoint: movePoint, circleCircle: circleCircle, circleLine: circleLine,
    other: other, isInside: isInside, compute: compute, position: position,
  };
})();
