"use strict";

/*
 * Addition and Subtraction of Functions, from Alexander Bogomolny's applet
 * OperationsOnFunctions.
 *
 * Adding functions is done point by point: (f + g)(x) = f(x) + g(x), and
 * (f - g)(x) = f(x) - g(x). In the applet f (black) and g (green) are natural
 * cubic splines through 11 control points at x = -5, -4, ..., 5 that the player
 * drags up and down; the sum (blue) or the difference (red) is computed from
 * them. The graph starts with f(x) = -x^2/2 + 25/3 (8.3333...) and g(x) = 5 sin x
 * sampled at the control points. The applet's panel has a "Shade graph" check
 * box (the area between the x-axis and the result is filled) and the two choices
 * "f + g" (the first) and "f - g".
 *
 * Position (plain data): { f, g, op, shade, points } with the eleven heights of
 * f and of g, the operation "add" or "sub", and the two check boxes. One
 * global, FunctionsCore, no DOM.
 */
const FunctionsCore = (() => {
  const KNOTS = 11, XMIN = -5, XMAX = 5;
  const YLIMIT = 14;                // heights are kept inside +-14 (the picture's range)

  const F0 = (x) => (-x * x) / 2 + 8.333333333333334;   // the applet's starting f
  const G0 = (x) => 5 * Math.sin(x);                      // and g

  function start() {
    const xs = Array.from({ length: KNOTS }, (_, i) => i - 5);
    return { f: xs.map(F0), g: xs.map(G0), op: "add", shade: false, points: false };
  }

  /** The second derivatives at the knots of the natural cubic spline through (i - 5, ys[i]) (unit spacing). */
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

  /** The spline's value at x (kept between -5 and 5), from the heights and their second derivatives. */
  function evaluate(ys, m, x) {
    x = Math.max(XMIN, Math.min(XMAX, x));
    const u0 = x - XMIN, i = Math.max(0, Math.min(KNOTS - 2, Math.floor(u0))), t = u0 - i, u = 1 - t;
    return u * ys[i] + t * ys[i + 1] + ((u * u * u - u) * m[i] + (t * t * t - t) * m[i + 1]) / 6;
  }

  /** The three graphs as functions of x: f, g, and the result f + g or f - g. */
  function curves(state) {
    const mf = secondDerivs(state.f), mg = secondDerivs(state.g);
    const f = (x) => evaluate(state.f, mf, x), g = (x) => evaluate(state.g, mg, x);
    const sign = state.op === "sub" ? -1 : 1;
    return { f, g, result: (x) => f(x) + sign * g(x) };
  }

  const clamp = (v) => Math.max(-YLIMIT, Math.min(YLIMIT, v));

  /** Drag control point i of "f" or "g" to height y; null if that is not a point. */
  function setHeight(state, which, i, y) {
    if ((which !== "f" && which !== "g") || !Number.isInteger(i) || i < 0 || i >= KNOTS || !Number.isFinite(y)) return null;
    return { ...state, [which]: state[which].map((v, k) => (k === i ? clamp(y) : v)) };
  }

  /** Choose "add" (f + g) or "sub" (f - g). */
  function setOp(state, op) {
    return op === "add" || op === "sub" ? { ...state, op } : null;
  }

  const setShade = (state, on) => ({ ...state, shade: !!on });
  const setPoints = (state, on) => ({ ...state, points: !!on });

  /**
   * The applet lets you grab a curve anywhere. Which curve ("f" or "g") and
   * which control point does a press at (x, y) take: the curve closer to y at
   * that x, if within `reach`, and the control point nearest to x. Null when
   * neither curve is near.
   */
  function grab(state, x, y, reach) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const c = curves(state), df = Math.abs(c.f(x) - y), dg = Math.abs(c.g(x) - y);
    const which = df <= dg ? "f" : "g";
    if (Math.min(df, dg) > (reach === undefined ? 1 : reach)) return null;
    return { which, index: Math.max(0, Math.min(KNOTS - 1, Math.round(x - XMIN))) };
  }

  /** The values of the three graphs at a point, for the page's readout. */
  function readings(state, x) {
    const c = curves(state);
    return { x, f: c.f(x), g: c.g(x), result: c.result(x) };
  }

  return { KNOTS, XMIN, XMAX, YLIMIT, F0, G0, start, secondDerivs, evaluate, curves, setHeight, setOp, setShade, setPoints, grab, readings };
})();
