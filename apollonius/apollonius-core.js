"use strict";

/*
 * Apollonius, from Alexander Bogomolny's applet Apollonius (the algebraic
 * solution of the three-circle problem, on the "Apollonius Problem: What is
 * it?" page). Three circles can be moved and resized by dragging their centre
 * and rim points; the page draws up to eight circles tangent to all three.
 *
 * The one idea the code relies on is the applet's own algebra. A sought circle
 * with signed radius t and centre (x, y) touches circle i when
 *     (x - xi)^2 + (y - yi)^2 = (t - si * ri)^2,   si = +1 or -1.
 * Subtracting one equation from the other two makes x and y linear in t:
 * x = v*t + G, y = w*t + I. Substituting back gives a quadratic in t whose
 * two roots give a pair of tangent circles for each of the eight sign triples.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, ApolloniusCore, so the page loads it with a
 * plain <script> and porting/check-apollonius.mjs loads it in Node. The
 * position is plain data and every function returns a new position.
 */
const ApolloniusCore = (() => {
  /** The applet's 400x300 canvas and its Reset constant: the first radius. */
  const DEFAULT_WIDTH = 400;
  const DEFAULT_HEIGHT = 300;
  const DEFAULT_UNIT = 40;
  /** A modern guard: a dragged rim may not collapse a circle to radius 0. */
  const MIN_RADIUS = 4;

  const SIGN_TRIPLES = [
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1],
    [1, -1, -1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
  ];

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const info = (c) => c.center.x * c.center.x + c.center.y * c.center.y - c.radius * c.radius;

  /**
   * The applet's Reset, in board units. MoveableCircle keeps a centre C and a
   * boundary point B and takes its radius from |CB|: 40, 60 and 80.
   */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? DEFAULT_WIDTH : o.width;
    const height = o.height === undefined ? DEFAULT_HEIGHT : o.height;
    const u = o.unit === undefined ? DEFAULT_UNIT : o.unit;
    const cx = width / 2, cy = height / 2;
    const specs = [
      { center: { x: cx - 4 * u, y: cy }, rim: { x: cx - 3 * u, y: cy } },
      { center: { x: cx + 2 * u, y: cy + 2 * u }, rim: { x: cx + 3.5 * u, y: cy + 2 * u } },
      { center: { x: cx, y: cy - 2 * u }, rim: { x: cx + 2 * u, y: cy - 2 * u } },
    ];
    return { width: width, height: height, unit: u, circles: specs };
  }

  /** Reset keeps the board settings and restores the three given circles. */
  function reset(state) {
    return start({ width: state.width, height: state.height, unit: state.unit });
  }

  /** The radius of a given circle: the distance from its centre to its rim. */
  function radius(circle) {
    return distance(circle.center, circle.rim);
  }

  function asGeometry(circle) {
    return { center: { x: circle.center.x, y: circle.center.y }, radius: radius(circle) };
  }

  /**
   * Drag one of the six points: "C1", "R1", "C2", ... A centre carries its rim
   * with it (the radius stays); a rim point changes only the radius.
   */
  function movePoint(state, name, point) {
    const m = /^([CR])([123])$/.exec(name);
    if (!m) return state;
    const i = Number(m[2]) - 1;
    const circles = state.circles.map((c) => ({ center: { ...c.center }, rim: { ...c.rim } }));
    const c = circles[i];
    if (m[1] === "C") {
      const dx = point.x - c.center.x, dy = point.y - c.center.y;
      c.center = { x: point.x, y: point.y };
      c.rim = { x: c.rim.x + dx, y: c.rim.y + dy };
    } else {
      const dx = point.x - c.center.x, dy = point.y - c.center.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-9) return state;
      const max = Math.min(state.width, state.height) / 2;
      const r = clamp(d, MIN_RADIUS, max);
      c.rim = { x: c.center.x + dx * r / d, y: c.center.y + dy * r / d };
    }
    return { width: state.width, height: state.height, unit: state.unit, circles: circles };
  }

  /** Signature (the applet's name for the number of negative signs). */
  function signature(signs) {
    return signs.filter((s) => s < 0).length;
  }

  /**
   * ApolloniusCircle.Compute, transcribed from the bytecode. Returns the two
   * tangent circles for one sign triple, or null when the applet gives up
   * (|K| < 0.01, |v^2 + w^2 - 1| < 0.001 or a negative discriminant).
   * `signedR` is the quadratic root t; the drawn radius is |t|.
   */
  function compute(gs, signs) {
    const s0 = signs[0], s1 = signs[1], s2 = signs[2];
    const c0 = gs[0], c1 = gs[1], c2 = gs[2];
    const A1 = 2 * (c1.center.x - c0.center.x);
    const A2 = 2 * (c2.center.x - c0.center.x);
    const B1 = 2 * (c1.center.y - c0.center.y);
    const B2 = 2 * (c2.center.y - c0.center.y);
    const o = info(c0);
    const D1 = o - info(c1);
    const D2 = o - info(c2);
    const K = A1 * B2 - A2 * B1;
    // The applet calls TreatZeroDeterminant here; that method always returns
    // null (both of its branches jump to aconst_null).
    if (Math.abs(K) < 0.01) return null;
    const G = (B1 * D2 - B2 * D1) / K;
    const I = -(A1 * D2 - A2 * D1) / K;
    const d1 = 2 * (s0 * c0.radius - s1 * c1.radius);
    const d2 = 2 * (s0 * c0.radius - s2 * c2.radius);
    const v = (B1 * d2 - B2 * d1) / K;
    const w = -(A1 * d2 - A2 * d1) / K;
    const L = v * v + w * w - 1;
    if (Math.abs(L) < 0.001) return null;
    const C = 2 * (v * G + w * I - v * c0.center.x - w * c0.center.y + s0 * c0.radius);
    const Q = G * G + I * I - 2 * G * c0.center.x - 2 * I * c0.center.y + o;
    let disc = C * C - 4 * L * Q;
    if (disc < 0) return null;
    disc = Math.sqrt(disc);
    const make = (t, root) => ({
      x: v * t + G, y: w * t + I, radius: Math.abs(t),
      signedR: t, signs: signs.slice(), color: signature(signs), root: root,
    });
    return [make((-C + disc) / (2 * L), 0), make((-C - disc) / (2 * L), 1)];
  }

  /** ApolloniusCanvas.WasUsed: a solution is a repeat if (x, y, r) is < 1 away. */
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.radius - b.radius) < 1;

  /**
   * The eight sign triples in the applet's drawing order. It draws the first
   * root unless that circle is within one unit of an earlier drawing, in
   * which case it draws the second root. Colours: red, blue, pink, dark green
   * for signatures 0, 1, 2, 3.
   */
  function solve(gs) {
    const used = [];
    const out = [];
    for (const signs of SIGN_TRIPLES) {
      const pair = compute(gs, signs);
      if (!pair) continue;
      const circle = used.some((u) => near(u, pair[0])) ? pair[1] : pair[0];
      out.push(circle);
      used.push(circle);
    }
    return out;
  }

  /** Solve the three circles of a state. */
  function solutions(state) {
    return solve(state.circles.map(asGeometry));
  }

  /**
   * How far a tangent circle is from touching given circle i. The sign
   * follows the applet: +1 means the given circle lies inside the tangent
   * one (distance = |t - ri|); -1 means they touch outside (t + ri).
   */
  function tangencyError(circle, given, sign, useSignedRoot) {
    const t = useSignedRoot ? circle.signedR : circle.radius;
    const d = Math.hypot(circle.x - given.center.x, circle.y - given.center.y);
    return Math.abs(d - Math.abs(t - sign * given.radius));
  }

  /** The plain position saved for the player's record and the tutor. */
  function position(state) {
    const gs = state.circles.map(asGeometry);
    const found = solve(gs);
    return {
      width: state.width, height: state.height,
      circles: gs.map((c) => ({ center: c.center, radius: c.radius })),
      count: found.length,
      tangent: found.map((c) => ({ x: c.x, y: c.y, radius: c.radius, signs: c.signs })),
    };
  }

  return {
    DEFAULT_WIDTH: DEFAULT_WIDTH, DEFAULT_HEIGHT: DEFAULT_HEIGHT,
    DEFAULT_UNIT: DEFAULT_UNIT, MIN_RADIUS: MIN_RADIUS,
    SIGN_TRIPLES: SIGN_TRIPLES, distance: distance, clamp: clamp, info: info,
    start: start, reset: reset, radius: radius, movePoint: movePoint,
    signature: signature, compute: compute, solve: solve, solutions: solutions,
    tangencyError: tangencyError, position: position,
  };
})();
