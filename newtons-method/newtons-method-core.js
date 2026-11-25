"use strict";

/*
 * Newton's Method, from Alexander Bogomolny's applet NewtonsMethod.
 *
 * To find a root of f(x) = 0, start at x0 and repeat: draw the tangent to the
 * graph at (x, f(x)) and move to where that tangent meets the x-axis,
 *     x_next = x - f(x) / f'(x).
 * Near a simple root each step roughly squares the error, so the number of
 * correct digits doubles. It can also fail: near a local extreme the tangent
 * is almost flat and the next point flies away, or the points loop.
 *
 * In the applet the graph is a natural cubic spline through 11 control points
 * that the player drags, and it starts as the cubic
 *     f(x) = -x^3 - 4x^2 + 5x + 95.8333...
 * sampled at x = -5, -4, ..., 5 (its Func method). The tangent at a point is
 * the spline's derivative there, and the iteration stops when the tangent
 * misses the axis or lands outside the picture.
 *
 * The position is plain data: { ys, x0, n } with the 11 heights, the starting
 * abscissa (null before one is chosen) and the number of steps to draw (1..10).
 * This file defines one global, NewtonCore, and has no DOM.
 */
const NewtonCore = (() => {
  const KNOTS = 11, XMIN = -5, XMAX = 5;       // the control points sit at x = -5 ... 5
  const MAX_STEPS = 10;                        // the applet's step spinner is 1..10
  const YLIMIT = 120;                          // heights are kept inside +-120

  /** The applet's Func: the cubic the control points start on. */
  const func = (x) => -x * x * x - 4 * x * x + 5 * x + 95.83333333333333;

  function start() {
    return { ys: Array.from({ length: KNOTS }, (_, i) => func(i - 5)), x0: null, n: 1 };
  }

  /** The natural cubic spline through (i - 5, ys[i]): its second derivatives at the knots (unit spacing). */
  function secondDerivs(ys) {
    const n = ys.length, m = Array(n).fill(0);
    if (n < 3) return m;
    const c = Array(n).fill(0), d = Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      const rhs = 6 * (ys[i - 1] - 2 * ys[i] + ys[i + 1]);
      const den = 4 - (i > 1 ? c[i - 1] : 0);
      c[i] = 1 / den;
      d[i] = (rhs - (i > 1 ? d[i - 1] : 0)) / den;
    }
    for (let i = n - 2; i >= 1; i--) m[i] = d[i] - c[i] * (i < n - 2 ? m[i + 1] : 0);
    return m;
  }

  /** The spline's value and slope at x (x between -5 and 5). */
  function evaluate(ys, m, x) {
    const u0 = x - XMIN;
    const i = Math.max(0, Math.min(KNOTS - 2, Math.floor(u0))), t = u0 - i, u = 1 - t;
    const f = u * ys[i] + t * ys[i + 1] + ((u * u * u - u) * m[i] + (t * t * t - t) * m[i + 1]) / 6;
    const df = ys[i + 1] - ys[i] + ((1 - 3 * u * u) * m[i] + (3 * t * t - 1) * m[i + 1]) / 6;
    return { f, df };
  }

  /** The curve as two functions, for a position. */
  function curve(state) {
    const m = secondDerivs(state.ys);
    return { f: (x) => evaluate(state.ys, m, x).f, df: (x) => evaluate(state.ys, m, x).df };
  }

  /**
   * The first `n` Newton steps for f from x0. Each step is
   *   { x, fx, slope, next, status }
   * where next is where the tangent meets the axis. status is "ok", or why the
   * iteration had to stop: "flat" (no slope, the tangent never meets the axis)
   * or "out" (it meets the axis outside [lo, hi], so it is off the picture).
   * The last entry then has no usable next, and the list stops there.
   */
  function orbit(f, df, x0, n, lo, hi) {
    const steps = [];
    let x = x0;
    for (let k = 0; k < n; k++) {
      const fx = f(x), slope = df(x);
      const next = x - fx / slope;
      let status = "ok";
      if (!Number.isFinite(next)) status = "flat";
      else if (next < lo || next > hi) status = "out";
      steps.push({ x, fx, slope, next: status === "ok" ? next : null, status });
      if (status !== "ok") break;
      x = next;
    }
    return steps;
  }

  /** The steps for a position on its own curve; empty until a start is chosen. */
  function steps(state) {
    if (state.x0 === null) return [];
    const c = curve(state);
    return orbit(c.f, c.df, state.x0, state.n, XMIN, XMAX);
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** A start point at x (kept inside the knots' range), or the start cleared. */
  function setStart(state, x) {
    if (x === null) return { ...state, x0: null };
    if (!Number.isFinite(x)) return null;
    return { ...state, x0: clamp(x, XMIN, XMAX) };
  }

  /** Clicking: the first click sets x0, the next click clears it (the applet's toggle). */
  function click(state, x) {
    return state.x0 === null ? setStart(state, x) : setStart(state, null);
  }

  /** The number of steps to draw, 1..10. */
  function setSteps(state, n) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n)) return null;
    return { ...state, n: clamp(n, 1, MAX_STEPS) };
  }

  /** Drag control point i to height y. */
  function setHeight(state, i, y) {
    if (!Number.isInteger(i) || i < 0 || i >= KNOTS || !Number.isFinite(y)) return null;
    return { ...state, ys: state.ys.map((v, k) => (k === i ? clamp(y, -YLIMIT, YLIMIT) : v)) };
  }

  /** Back to the starting cubic, with no start point and one step. */
  function reset() { return start(); }

  /**
   * Heron's square roots, the page's example: f(x) = x^2 - N gives
   * x_next = (x + N / x) / 2. Returns x_0 ... x_steps.
   */
  function heron(N, x0, stepsCount) {
    const xs = [x0];
    for (let k = 0; k < stepsCount; k++) xs.push((xs[k] + N / xs[k]) / 2);
    return xs;
  }

  return { KNOTS, XMIN, XMAX, MAX_STEPS, YLIMIT, func, start, secondDerivs, evaluate, curve, orbit, steps, setStart, click, setSteps, setHeight, reset, heron };
})();
