"use strict";

/*
 * The Means, from Alexander Bogomolny's applet Means.
 *
 * For positive numbers a_1 .. a_n and a whole-number exponent r the power mean
 * is M_r = ((a_1^r + ... + a_n^r) / n)^(1/r), and for r = 0 the geometric
 * mean (a_1 * ... * a_n)^(1/n). So M_1 is the arithmetic mean, M_-1 the
 * harmonic mean and M_2 the quadratic mean, and M_r never decreases as r
 * grows, from the smallest number (r very negative) to the largest (r very
 * large).
 *
 * The applet has n vertical sliders (2 to 30, 10 to begin with) holding whole
 * numbers 1 to 100, each dealt at random, and a slider for the exponent, a
 * whole number from -50 to 50, starting at 0. The position is plain data:
 * { values: [..], r }.
 */
const MeansCore = (() => {
  const MIN_N = 2, MAX_N = 30, DEFAULT_N = 10;
  const MIN_VALUE = 1, MAX_VALUE = 100;
  const MIN_R = -50, MAX_R = 50;

  const clampN = (n) => Math.min(MAX_N, Math.max(MIN_N, Math.round(Number(n)) || DEFAULT_N));
  const clampValue = (v) => Math.min(MAX_VALUE, Math.max(MIN_VALUE, Math.round(Number(v)) || MIN_VALUE));
  const clampR = (r) => Math.min(MAX_R, Math.max(MIN_R, Math.round(Number(r)) || 0));

  /** A whole number 1..100 at random, as the applet's slider deals it. */
  const randomValue = (random = Math.random) => clampValue(MIN_VALUE + random() * (MAX_VALUE - MIN_VALUE));

  /** The position a new game starts from. */
  function start(options) {
    const o = options || {}, random = o.random || Math.random, n = clampN(o.n === undefined ? DEFAULT_N : o.n);
    return { values: Array.from({ length: n }, () => randomValue(random)), r: 0 };
  }

  /** Change the size of the set: the first values are kept, new ones are random, extra ones go (the applet's Reset(true)). */
  function resize(state, n, random = Math.random) {
    n = clampN(n);
    const values = state.values.slice(0, n);
    while (values.length < n) values.push(randomValue(random));
    return { ...state, values };
  }

  const setValue = (state, i, v) => (i >= 0 && i < state.values.length && Number.isFinite(Number(v))
    ? { ...state, values: state.values.map((x, j) => (j === i ? clampValue(v) : x)) } : null);

  const setExponent = (state, r) => (Number.isFinite(Number(r)) ? { ...state, r: clampR(r) } : null);

  /** The mean of the values with exponent r: as the applet's DrawAverage computes it. */
  function mean(values, r) {
    const n = values.length;
    if (r === 0) {
      let p = 1;
      for (const a of values) p *= a;
      return Math.pow(p, 1 / n);
    }
    let s = 0;
    for (const a of values) s += Math.pow(a, r);
    return Math.pow(s / n, 1 / r);
  }

  /** The name of the mean for a few exponents, else null. */
  function nameOf(r) {
    return { 1: "arithmetic mean", 0: "geometric mean", [-1]: "harmonic mean", 2: "quadratic mean" }[r] || null;
  }

  /** The number as Java's Float.toString would print it for a typical value: the shortest digits that read back as the same float32, with a ".0" for whole numbers. */
  function formatMean(x) {
    const f = Math.fround(x);
    for (let p = 1; p <= 9; p++) {
      const s = f.toPrecision(p);
      if (Math.fround(Number(s)) === f) {
        const t = String(Number(s));
        return /^[-\d]+$/.test(t) ? t + ".0" : t;
      }
    }
    return String(f);
  }

  return { MIN_N, MAX_N, DEFAULT_N, MIN_VALUE, MAX_VALUE, MIN_R, MAX_R, clampN, clampValue, clampR, randomValue, start, resize, setValue, setExponent, mean, nameOf, formatMean };
})();
