"use strict";

/*
 * The Basel Problem, an original demo for the Riemann Hypothesis path.
 *
 * S(n) = 1 + 1/4 + 1/9 + ... + 1/n^2. The sum is zeta(2). Euler showed in
 * 1735 that it equals pi^2 / 6 = 1.6449... Three facts to see:
 *
 *  - it converges, because 1/k^2 < 1/(k-1) - 1/k, which telescopes: S(n) < 2;
 *  - the tail after n terms is about 1/n, so the error is n times too slow;
 *  - the tail is much closer to 1/(n + 1/2), so S(n) + 1/(n + 1/2) is
 *    accurate to about 1/(12 n^3): the same trick as Euler-Maclaurin;
 *  - the same sum with every power an even number 2k is a rational multiple of
 *    pi^(2k): zeta(2k) = (-1)^(k+1) B_2k (2 pi)^(2k) / (2 (2k)!).
 *
 * DOM-free; one global, BaselProblemCore.
 */
const BaselProblemCore = (() => {
  const MAX_N = 100000, DEFAULT_N = 10;
  const TARGET = (Math.PI * Math.PI) / 6;
  // Bernoulli numbers B2, B4, ..., B12 for the even zeta values.
  const B = [1 / 6, -1 / 30, 1 / 42, -1 / 30, 5 / 66, -691 / 2730];
  const FACT = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };

  function clampN(n) {
    n = Math.floor(Number(n));
    if (!Number.isFinite(n)) return DEFAULT_N;
    return Math.min(MAX_N, Math.max(1, n));
  }

  /** S(n) = sum of 1/k^2 for k = 1..n, added from the small end. */
  function S(n) {
    n = clampN(n);
    let s = 0;
    for (let k = n; k >= 1; k--) s += 1 / (k * k);
    return s;
  }

  /** The sharper estimate S(n) + 1/(n + 1/2). */
  function corrected(n) {
    n = clampN(n);
    return S(n) + 1 / (n + 0.5);
  }

  /** The telescoping bound 2 - 1/n: S(n) <= 2 - 1/n for every n >= 1. */
  function telescoping(n) {
    return 2 - 1 / n;
  }

  /** zeta(2k) for k = 1..6 from the Bernoulli numbers. */
  function zetaEven(k) {
    if (!Number.isInteger(k) || k < 1 || k > B.length) throw new Error("k must be 1.." + B.length);
    return (((k % 2 ? 1 : -1) * B[k - 1] * Math.pow(2 * Math.PI, 2 * k)) / (2 * FACT(2 * k)));
  }

  /** What the page shows at n. */
  function at(n) {
    n = clampN(n);
    const s = S(n), c = corrected(n);
    return {
      n, sum: s, target: TARGET, error: TARGET - s,
      errorTimesN: n * (TARGET - s),
      corrected: c, correctedError: TARGET - c,
      bound: telescoping(n),
    };
  }

  /** Samples of S(k) for k = 1..n, at most `points` of them. */
  function series(n, points) {
    n = clampN(n);
    const out = [];
    const step = Math.max(1, Math.floor(n / (points || 300)));
    let s = 0;
    for (let k = 1; k <= n; k++) {
      s += 1 / (k * k);
      if (k % step === 0 || k === n || k < 12) out.push({ k, sum: s, bound: telescoping(k) });
    }
    return out;
  }

  return { MAX_N, DEFAULT_N, TARGET, clampN, S, corrected, telescoping, zetaEven, at, series };
})();
