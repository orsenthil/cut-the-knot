"use strict";

/*
 * Ellipse in Arbelos, from Alexander Bogomolny's applet EllipseInArbelos and
 * the article "Ellipse in Arbelos" (cut-the-knot.org/Curriculum/Geometry/
 * EllipseInArbelos.shtml, problem E 762, American Mathematical Monthly 1947).
 *
 * Two circles touch at A: the small one has diameter A--C and radius a1, the
 * big one has diameter A--B and radius a2. A circle drawn in the crescent
 * between them and touching both has its centre P at distance a1+r from the
 * small centre and a2-r from the big centre, so PA1 + PA2 = a1+a2: an ellipse
 * with foci at the two centres, semimajor axis (a1+a2)/2 and semiminor axis
 * sqrt(a1*a2). The applet's chain C_t uses tau = a1*a2 + s*s*(a2-a1)^2,
 * radius a1*a2*(a2-a1)/tau and centre (a1*a2*(a1+a2)/tau, +-2*s*radius).
 *
 * This file is only the logic: no document, no window, no storage. It defines
 * one global, EllipseInArbelosCore, and its position is plain data so it can
 * be saved and handed to the tutor.
 */

const EllipseInArbelosCore = (() => {
  // EllipseInArbelosCanvas.init: margin 30; side = min(w-2m, h-2m); square
  // (x, 30, side, side); A is its left-middle and B its right-middle point.
  const MARGIN = 30;
  const WIDTH = 400;
  const HEIGHT = 250;
  const SIDE = Math.min(WIDTH - 2 * MARGIN, HEIGHT - 2 * MARGIN); // 190
  const RECT = { x: (WIDTH - SIDE) / 2, y: MARGIN, width: SIDE, height: SIDE };
  const A = { x: RECT.x, y: RECT.y + SIDE / 2 };
  const B = { x: RECT.x + SIDE, y: A.y };
  const R = SIDE / 2; // a2, the radius of the big circle

  // The applet puts C at random between 0.4167 and 0.5833 along AB. A picture
  // needs a fixed start, so the midpoint of that range is used instead.
  const START_FRACTION = 0.5;
  // The panel's PVNumeric allows 1..20 circles; the article's page has N=1
  // in its first embed and no parameter in its second, whose default is 3.
  const MIN_N = 1;
  const MAX_N = 20;
  const START_N = 3;
  // Scrollbar -300..300, divided by 20 in adjustmentValueChanged.
  const MIN_T = -15;
  const MAX_T = 15;
  const START_T = 1;
  const T_STEP = 0.05;
  // Keep C a few units off A and B: at the ends the small circle degenerates.
  const MIN_GAP = 4;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (v, fallback) => (Number.isFinite(v) ? v : fallback);

  const clampFraction = (f) =>
    clamp(finite(f, START_FRACTION), MIN_GAP / SIDE, 1 - MIN_GAP / SIDE);
  const clampN = (n) => Math.round(clamp(finite(n, START_N), MIN_N, MAX_N));
  const clampT = (t) => clamp(finite(t, START_T), MIN_T, MAX_T);

  /** The position a new diagram starts from. */
  function start(options) {
    const o = options || {};
    return {
      f: clampFraction(o.f === undefined ? START_FRACTION : o.f),
      n: clampN(o.n === undefined ? START_N : o.n),
      t: clampT(o.t === undefined ? START_T : o.t),
    };
  }

  function setFraction(state, f) {
    return { f: clampFraction(f), n: clampN(state.n), t: clampT(state.t) };
  }
  function setN(state, n) {
    return { f: clampFraction(state.f), n: clampN(n), t: clampT(state.t) };
  }
  function setT(state, t) {
    return { f: clampFraction(state.f), n: clampN(state.n), t: clampT(t) };
  }

  /** The fraction of AB belonging to a point in board units (from a drag). */
  const fractionAtX = (x) => clampFraction((x - A.x) / SIDE);

  /**
   * EllipseInArbelosCanvas.Circle(s), in the screen frame (y grows downward).
   * R is BigCircle.GetRadius(), r is LeftCircle.GetRadius() and the parameter
   * s is T+k. This is the formula on the article's page with the sign of y
   * flipped because the screen's y axis is flipped.
   */
  function chainCircle(a1, a2, s) {
    const product = a2 * a1;
    const diff = a2 - a1;
    const sum = a2 + a1;
    const tau = product + s * s * diff * diff;
    const radius = product * diff / tau;
    return {
      s: s,
      center: {
        x: A.x + product * sum / tau,
        y: A.y - 2 * s * radius,
      },
      radius: radius,
    };
  }

  /** The same circle in the article's frame: origin at A, y growing upward. */
  function mathCircle(a1, a2, s) {
    const c = chainCircle(a1, a2, s);
    return { s: s, x: c.center.x - A.x, y: A.y - c.center.y, r: c.radius };
  }

  /**
   * Compute(): for i = 0..n-1 the chain parameter is T+k, where k runs
   * 0, 1, -1, 2, -2, ... (Java's integer division truncates toward zero).
   */
  function chainIndex(i) {
    return i % 2 === 0 ? -(i / 2) : (i + 1) / 2;
  }

  /** Everything the page draws, derived from the three plain numbers. */
  function geometry(state) {
    const s = start(state);
    const a1 = SIDE * s.f / 2; // CircleFromDiameter(A, C)
    const a2 = R;             // CircleFromDiameter(A, B)
    const sum = a1 + a2;
    const diff = a2 - a1;
    const major = sum / 2;
    const minor = Math.sqrt(a1 * a2);
    const C = { x: A.x + 2 * a1, y: A.y };
    const ellipse = { cx: A.x + major, cy: A.y, rx: major, ry: minor };
    // Circle(): its oval is (round(A.x), round(A.y-minor), round(sum),
    // round(2*minor)) in the bytecode's pixel frame.
    const rect = {
      x: Math.round(A.x),
      y: Math.round(A.y - minor),
      width: Math.round(2 * major),
      height: Math.round(2 * minor),
    };
    const circles = [];
    for (let i = 0; i < s.n; i++) circles.push(chainCircle(a1, a2, s.t + chainIndex(i)));
    return {
      state: s,
      A: A,
      B: B,
      C: C,
      R: a2,
      r: a1,
      sum: sum,
      diff: diff,
      bigCenter: { x: A.x + a2, y: A.y },
      smallCenter: { x: A.x + a1, y: A.y },
      ellipse: ellipse,
      ellipseRect: rect,
      major: major,
      minor: minor,
      circles: circles,
    };
  }

  /** A compact, JSON-safe summary for Track.state and the tutor. */
  function position(state) {
    const g = geometry(state);
    const round = (v) => Number(v.toFixed(6));
    return {
      f: round(g.state.f),
      n: g.state.n,
      t: round(g.state.t),
      a1: round(g.r),
      a2: round(g.R),
      major: round(g.major),
      minor: round(g.minor),
      circles: g.circles.map((c) => ({
        s: round(c.s), x: round(c.center.x - A.x), y: round(A.y - c.center.y), r: round(c.radius),
      })),
    };
  }

  return {
    MARGIN: MARGIN, WIDTH: WIDTH, HEIGHT: HEIGHT, SIDE: SIDE, RECT: RECT,
    A: A, B: B, R: R,
    START_FRACTION: START_FRACTION, START_N: START_N, START_T: START_T,
    MIN_N: MIN_N, MAX_N: MAX_N, MIN_T: MIN_T, MAX_T: MAX_T, T_STEP: T_STEP,
    MIN_GAP: MIN_GAP,
    clampFraction: clampFraction, clampN: clampN, clampT: clampT,
    start: start, setFraction: setFraction, setN: setN, setT: setT,
    fractionAtX: fractionAtX, chainIndex: chainIndex,
    chainCircle: chainCircle, mathCircle: mathCircle,
    geometry: geometry, position: position,
  };
})();
