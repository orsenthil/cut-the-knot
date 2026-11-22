"use strict";

/*
 * The Harmonic Series, an original demo for the Riemann Hypothesis path.
 *
 * H(n) = 1 + 1/2 + 1/3 + ... + 1/n. The terms shrink to nothing, yet the sum
 * never stops growing. Oresme's grouping shows why: 1/3 + 1/4 > 1/2,
 * 1/5 + ... + 1/8 > 1/2, and in general the block of terms from 2^(k-1) + 1 to
 * 2^k adds up to more than 1/2, so H(2^k) >= 1 + k/2. But it grows very
 * slowly: H(n) is about ln n + gamma, so a million terms reach only 14.4.
 * This is the zeta function's pole at s = 1: zeta(s) = sum of n^-s blows up
 * as s comes down to 1, like 1 / (s - 1).
 *
 * DOM-free; one global, HarmonicSeriesCore.
 */
const HarmonicSeriesCore = (() => {
  const MAX_N = 1000000, DEFAULT_N = 100, EULER_GAMMA = 0.5772156649015329;
  let prefix = null; // prefix[n] = H(n), summed from the small end for accuracy

  function build() {
    if (prefix) return prefix;
    prefix = new Float64Array(MAX_N + 1);
    let s = 0;
    for (let k = 1; k <= MAX_N; k++) { s += 1 / k; prefix[k] = s; }
    return prefix;
  }

  function clampN(n) {
    n = Math.floor(Number(n));
    if (!Number.isFinite(n)) return DEFAULT_N;
    return Math.min(MAX_N, Math.max(1, n));
  }

  /** H(n). */
  function H(n) {
    return build()[clampN(n)];
  }

  /** ln n + gamma: the value H(n) is close to. */
  function approx(n) {
    return Math.log(n) + EULER_GAMMA;
  }

  /** Oresme's block k >= 1: 1/(2^(k-1)+1) + ... + 1/2^k. Block 1 is 1/2 exactly; every block is at least 1/2. */
  function block(k) {
    let s = 0;
    for (let j = 2 ** (k - 1) + 1; j <= 2 ** k; j++) s += 1 / j;
    return s;
  }

  /** The smallest n with H(n) > m, or null if a million terms do not get there (they reach 14.39). */
  function termsToPass(m) {
    const p = build();
    let lo = 1, hi = MAX_N;
    if (p[MAX_N] <= m) return null;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (p[mid] > m) hi = mid; else lo = mid + 1; }
    return lo;
  }

  /** What the page shows at n: the sum, the estimate, the blocks that fit, the lower bound from them. */
  function at(n) {
    n = clampN(n);
    const sum = H(n);
    const full = Math.floor(Math.log2(n));        // blocks 1..full lie entirely inside 1..n
    return {
      n, sum, approx: approx(n), gap: sum - approx(n),
      blocks: full, oresmeBound: 1 + full / 2,
      toPass: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((m) => ({ target: m, terms: termsToPass(m) })),
    };
  }

  /** Samples for the plot: H(n) at n = 1 .. maxN, evenly spaced in log n. */
  function series(maxN, points) {
    maxN = clampN(maxN);
    const out = [], seen = new Set();
    const count = points || 300;
    for (let i = 0; i <= count; i++) {
      const n = Math.max(1, Math.round(Math.pow(maxN, i / count)));
      if (seen.has(n)) continue;
      seen.add(n);
      out.push({ n, sum: H(n), approx: approx(n), oresme: 1 + Math.floor(Math.log2(n)) / 2 });
    }
    return out;
  }

  return { MAX_N, DEFAULT_N, EULER_GAMMA, clampN, H, approx, block, termsToPass, at, series };
})();
