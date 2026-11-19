"use strict";

/*
 * Emergence of Chaos — Alexander Bogomolny's applet "chaos" (cut-the-knot.org).
 *
 * The applet explores the logistic map x -> 4a x(1-x) in two panels. On the
 * right it draws a bifurcation diagram: for each a from 0.7 to 1 it throws
 * away a few starting iterates and then plots the ones that follow, so a
 * settling-down orbit gives one dot, a two-cycle gives two, and so on. On the
 * left it draws the cobweb: starting from some x0 it repeatedly goes straight
 * up to the graph y = f(x), across to the diagonal y = x, and down again — the
 * same iteration, shown as a picture.
 *
 * The one idea the code relies on is that *all* of the behaviour comes from
 * iterating a single quadratic. Its fixed points solve x = 4a x(1-x), and the
 * derivative there is 2 - 4a: once |2 - 4a| passes 1 (at a = 0.75) the fixed
 * point stops attracting and the orbit splits into a 2-cycle; that cycle in
 * turn loses stability at a = (1 + sqrt 6)/4 = 0.86237..., and the period
 * doublings come faster and faster until chaos at a ~ 0.8925.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, ChaosCore, so the page loads it with a
 * plain <script> and porting/check-chaos.mjs loads it in Node. The position is
 * plain data (numbers, strings, booleans), so it can be saved and handed to
 * the tutor as it is. Functions take a position and return a new one; they do
 * not change what they are given.
 */
const ChaosCore = (() => {
  // The applet's own constants, read from its bytecode.
  const FIRST_LAMBDA = 0.7; // m_FirstLambda: left edge of the right panel
  const C_WIDTH = 0.3; // m_CWidth: the parameter runs 0.7 .. 1.0
  const M_WIDTH = 1; // m_MWidth: x runs 0 .. 1 across the left panel
  const MARGIN = 4; // m_Margin, in pixels
  const DEFAULT_X0 = 0.7; // X0, the starting iterate of the diagram
  // The applet uses these to decide how many points to plot per column.
  const PLOT_0_91 = 0.91;
  const PLOT_0_9 = 0.9;
  const PLOT_0_872 = 0.872;
  const PLOT_0_86237 = 0.86237;

  // True onset points of the period-doubling cascade, for the math section.
  const P2_FROM = 0.75; // |2 - 4a| = 1 at the non-zero fixed point
  const P4_FROM = (1 + Math.sqrt(6)) / 4; // 0.8623724357
  const P8_FROM = 3.544090359551922 / 4; // 0.8860225899
  const P16_FROM = 3.564407266095433 / 4; // 0.8911018165
  const ACCUMULATION = 3.569945672 / 4; // 0.892486418
  const P3_WINDOW = (1 + Math.sqrt(8)) / 4; // 0.9571067812, start of the 3-cycle

  function clampLambda(a) {
    if (!Number.isFinite(a)) return FIRST_LAMBDA;
    return Math.min(FIRST_LAMBDA + C_WIDTH, Math.max(FIRST_LAMBDA, a));
  }

  function clamp01(x) {
    if (!Number.isFinite(x)) return DEFAULT_X0;
    return Math.min(1, Math.max(0, x));
  }

  /** f(x) = 4 a x (1 - x). In the applet: F(a, x). */
  function F(a, x) {
    return 4 * a * x * (1 - x);
  }

  /** f'(x) = 4 a (1 - 2x). */
  function fPrime(a, x) {
    return 4 * a * (1 - 2 * x);
  }

  /** Java Math.round(v) cast to int; every call here has v >= 0. */
  function a(v) {
    return Math.round(v);
  }

  /** The sequence x0, f(x0), f(f(x0)), ... with n steps after x0. */
  function orbit(lambda, x0, n) {
    const out = [clamp01(x0)];
    for (let i = 0; i < n; i++) out.push(F(lambda, out[out.length - 1]));
    return out;
  }

  /** Java XtoJ: x in [0,1] -> a pixel column of the left panel. */
  function xToColumn(x, width) {
    return a((x * width) / M_WIDTH);
  }

  /** Java lambdaFromClick, mapped and clamped to the applet's range. */
  function lambdaFromClick(clickX, leftWidth, margin, rightWidth) {
    const a0 = FIRST_LAMBDA + ((clickX - leftWidth - margin) * C_WIDTH) / rightWidth;
    return clampLambda(a0);
  }

  /** Java run(): round(100/a + 20) iterates thrown away before plotting. */
  function warmupCount(lambda) {
    return a(100 / lambda + 20);
  }

  /** Java run(): how many iterates to plot for this a, at this panel height. */
  function plotCount(lambda, height) {
    if (lambda > PLOT_0_91) return Math.floor(height / 2);
    if (lambda > PLOT_0_9) return Math.floor(height / 4);
    if (lambda > PLOT_0_872) return 24;
    if (lambda > PLOT_0_86237) return 8;
    return 4;
  }

  /**
   * One column of the right-hand diagram: warm the iterate up, then return
   * the plotted y values (in [0,1]) as the java applet draws them.
   */
  function bifurcationColumn(lambda, x0, height) {
    const L = clampLambda(lambda);
    let x = clamp01(x0);
    for (let i = 0; i < warmupCount(L); i++) x = F(L, x);
    const ys = [];
    for (let i = 0; i < plotCount(L, height); i++) {
      x = F(L, x);
      ys.push(x);
    }
    return ys;
  }

  /** The two solutions of x = f(x): 0 and 1 - 1/(4a). */
  function fixedPoints(lambda) {
    const L = clampLambda(lambda);
    return [0, 1 - 1 / (4 * L)];
  }

  /** Derivative of f at the non-zero fixed point: 2 - 4a. */
  function slopeAtFixedPoint(lambda) {
    return 2 - 4 * lambda;
  }

  function fixedPointAttractive(lambda) {
    return Math.abs(slopeAtFixedPoint(lambda)) < 1;
  }

  function zeroAttractive(lambda) {
    return Math.abs(fPrime(lambda, 0)) < 1; // 4a > 1 in this applet
  }

  /** The 2-cycle of f, when it exists, and its multiplier (f²)'. */
  function period2(lambda) {
    const r = 4 * lambda;
    if (r <= 3) return null;
    const d = Math.sqrt((r - 3) * (r + 1));
    const x1 = (r + 1 - d) / (2 * r);
    const x2 = (r + 1 + d) / (2 * r);
    return { points: [x1, x2], multiplier: 4 + 2 * r - r * r };
  }

  /**
   * Period of the orbit that an iterate settles into: 1, 2, 4, ... or -1 if
   * it does not repeat within the sample. Used by the tests and the status
   * sentence; transients are discarded first.
   */
  function cycleLength(lambda, x0, transients, samples) {
    const N = transients === undefined ? 4000 : transients;
    const M = samples === undefined ? 48 : samples;
    const tol = 1e-6;
    let x = clamp01(x0);
    for (let i = 0; i < N; i++) x = F(lambda, x);
    const pts = [];
    for (let i = 0; i < M; i++) {
      x = F(lambda, x);
      pts.push(x);
    }
    for (let p = 1; p <= M / 2; p++) {
      let ok = true;
      for (let i = 0; i + p < pts.length; i++) {
        if (Math.abs(pts[i] - pts[i + p]) > tol) {
          ok = false;
          break;
        }
      }
      if (ok) return p;
    }
    return -1;
  }

  /** A plain-English sentence about what the orbit does at this a. */
  function behavior(lambda) {
    const L = clampLambda(lambda);
    if (L <= P2_FROM + 1e-9) return "the dot settles down on one resting spot";
    if (L <= P4_FROM) return "the dot keeps hopping between two spots";
    if (L <= P8_FROM) return "the dot cycles through four spots";
    if (L <= P16_FROM) return "the dot cycles through eight spots";
    if (L < ACCUMULATION) return "the dot cycles through more and more spots";
    if (L < P3_WINDOW) return "the dot roams all over with no repeating pattern — chaos";
    if (L < 0.9604) return "a window of order: the dot repeats every three steps";
    if (L < 0.96195) return "the dot repeats every six steps";
    if (L < 0.96225) return "the dot repeats every twelve steps";
    if (L < 0.96235) return "the dot repeats every twenty-four steps";
    return "the dot roams all over again — chaos returns";
  }

  /** The position a new game starts from. */
  function start(options) {
    const o = options || {};
    return {
      lambda: clampLambda(o.lambda === undefined ? FIRST_LAMBDA : o.lambda),
      x0: clamp01(o.x0 === undefined ? DEFAULT_X0 : o.x0),
      running: false,
      steps: 0,
      origin: "start",
    };
  }

  /** The moves allowed from this position (a demo: always the same set). */
  function legalMoves(state) {
    return ["setLambda", "restart", "play", "pause", "toggle", "step", "reset"];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    switch (m.type) {
      case "setLambda": {
        const L = clampLambda(m.lambda);
        return {
          lambda: L,
          x0: m.x0 === undefined ? state.x0 : clamp01(m.x0),
          running: true,
          steps: 0,
          origin: "setLambda",
        };
      }
      case "restart":
        return {
          lambda: state.lambda,
          x0: m.x0 === undefined ? state.x0 : clamp01(m.x0),
          running: true,
          steps: 0,
          origin: "restart",
        };
      case "play":
        return Object.assign({}, state, { running: true });
      case "pause":
        return Object.assign({}, state, { running: false });
      case "toggle":
        return Object.assign({}, state, { running: !state.running });
      case "step":
        return Object.assign({}, state, {
          steps: state.steps + 1,
          running: false,
          origin: "step",
        });
      case "reset":
        return start({});
      default:
        return null;
    }
  }

  /** A demo never wins or loses. */
  function result(state) {
    return null;
  }

  return {
    FIRST_LAMBDA,
    C_WIDTH,
    M_WIDTH,
    MARGIN,
    DEFAULT_X0,
    PLOT_0_91,
    PLOT_0_9,
    PLOT_0_872,
    PLOT_0_86237,
    P2_FROM,
    P4_FROM,
    P8_FROM,
    P16_FROM,
    ACCUMULATION,
    P3_WINDOW,
    clampLambda,
    clamp01,
    F,
    fPrime,
    round: a,
    orbit,
    xToColumn,
    lambdaFromClick,
    warmupCount,
    plotCount,
    bifurcationColumn,
    fixedPoints,
    slopeAtFixedPoint,
    fixedPointAttractive,
    zeroAttractive,
    period2,
    cycleLength,
    behavior,
    start,
    legalMoves,
    move,
    result,
  };
})();
