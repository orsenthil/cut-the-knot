"use strict";

/*
 * Counting Primes, an original demo for the Riemann Hypothesis path.
 *
 * pi(x) is the number of primes up to x. Gauss and Legendre guessed that it
 * grows like x / ln x; a better guess is the logarithmic integral
 * Li(x) = the integral from 2 to x of dt / ln t. The prime number theorem
 * says pi(x) / (x / ln x) tends to 1. The Riemann Hypothesis is equivalent
 * to a much sharper statement about the error:
 *
 *   |pi(x) - li(x)| < sqrt(x) * ln(x) / (8 pi)      for every x >= 2657
 *
 * (Schoenfeld 1976, assuming the hypothesis). If the hypothesis were false,
 * the error would sometimes be larger than any such square-root bound.
 *
 * DOM-free; one global, PrimeCountingCore. The table of pi(x) is built once
 * by a sieve, up to MAX_X.
 */
const PrimeCountingCore = (() => {
  const MAX_X = 1000000, DEFAULT_X = 1000;
  const EULER_GAMMA = 0.5772156649015329;
  let table = null; // table[x] = pi(x)

  function build() {
    if (table) return table;
    const comp = new Uint8Array(MAX_X + 1);
    table = new Int32Array(MAX_X + 1);
    let count = 0;
    for (let i = 2; i <= MAX_X; i++) {
      if (!comp[i]) {
        count++;
        for (let j = i * i; j <= MAX_X; j += i) comp[j] = 1;
      }
      table[i] = count;
    }
    return table;
  }

  function clampX(x) {
    x = Math.floor(Number(x));
    if (!Number.isFinite(x)) return DEFAULT_X;
    return Math.min(MAX_X, Math.max(2, x));
  }

  /** The number of primes up to x. */
  function pi(x) {
    return build()[clampX(x)];
  }

  /** x / ln x, Gauss's first guess. */
  function xOverLn(x) {
    return x / Math.log(x);
  }

  /** li(x) = the principal value of the integral from 0 to x of dt / ln t (Ramanujan's series). */
  function li(x) {
    const L = Math.log(x);
    let sum = 0, term = 1;
    for (let n = 1; n <= 200; n++) {
      term *= L / n;
      const add = term / n;
      sum += add;
      if (Math.abs(add) < 1e-16 * Math.abs(sum) && n > L) break;
    }
    return EULER_GAMMA + Math.log(L) + sum;
  }

  const LI2 = li(2);
  /** Li(x) = the integral from 2 to x of dt / ln t. */
  function Li(x) {
    return li(x) - LI2;
  }

  /** The RH-sized error allowance sqrt(x) ln(x) / (8 pi), a theorem from x = 2657 under the hypothesis. */
  function allowance(x) {
    return (Math.sqrt(x) * Math.log(x)) / (8 * Math.PI);
  }

  /** What the page shows at x: the true count, the two guesses, and the errors. */
  function at(x) {
    x = clampX(x);
    const p = pi(x);
    const g = xOverLn(x), l = li(x);
    return {
      x, pi: p, xOverLn: g, li: l, Li: Li(x),
      ratio: p / g, liRatio: p / l,
      errorGauss: p - g, errorLi: p - l,
      allowance: allowance(x), guaranteed: x >= 2657,
    };
  }

  /** Samples of the three curves for x = 2..maxX, at most `points` of them, always including every prime jump if short. */
  function series(maxX, points) {
    maxX = clampX(maxX);
    const out = [];
    const step = Math.max(1, Math.floor((maxX - 1) / (points || 400)));
    for (let x = 2; x <= maxX; x += step) out.push(at(x));
    if (out[out.length - 1].x !== maxX) out.push(at(maxX));
    return out;
  }

  return { MAX_X, DEFAULT_X, clampX, pi, xOverLn, li, Li, allowance, at, series };
})();
