"use strict";

/*
 * GCD × LCM = M × N, from Bogomolny's applet GcdLcm.
 *
 * An M by N rectangle is tiled by G by G squares, where G = gcd(M, N). There
 * are S = (M/G)(N/G) squares. Splitting each square into G strips of size
 * G by 1, or into 1 by G strips, gives two ways to see that S·G is a common
 * multiple of M and N — in fact the least one.
 *
 * The key idea is that the exponent of each prime in gcd is min(a,b) and in
 * lcm is max(a,b), and min + max = a + b. The logic test checks the identity
 * and the rectangle counts over the applet's whole 1..40 range.
 *
 * No document, no window, no storage: one global, GcdLcmRectanglesCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const GcdLcmRectanglesCore = (() => {
  const MIN = 1;
  const MAX = 40;

  function clamp(value, fallback) {
    const v = Math.trunc(Number(value));
    return Number.isFinite(v) ? Math.max(MIN, Math.min(MAX, v)) : fallback;
  }

  function start(options) {
    const opts = options || {};
    return { m: clamp(opts.m === undefined ? 6 : opts.m, 6), n: clamp(opts.n === undefined ? 4 : opts.n, 4) };
  }

  function gcd(a, b) {
    while (b !== 0) { [a, b] = [b, a % b]; }
    return Math.abs(a);
  }

  function analyze(m, n) {
    const g = gcd(m, n);
    const a = m / g;
    const b = n / g;
    const squares = a * b;
    const lcm = squares * g;
    return {
      m, n, g, a, b, squares, lcm,
      product: m * n,
      lcmByColumns: a * n,
      lcmByRows: m * b,
      holds: m * n === g * lcm,
    };
  }

  function setM(state, value) {
    return { ...state, m: clamp(value, state.m) };
  }
  function setN(state, value) {
    return { ...state, n: clamp(value, state.n) };
  }

  return { MIN, MAX, clamp, start, gcd, analyze, setM, setN };
})();
