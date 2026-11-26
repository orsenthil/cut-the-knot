"use strict";

/*
 * Ryser's Formula: an original demo for the VP vs VNP path.
 *
 * Herbert Ryser (1963) found a way to compute the permanent with 2^n
 * products instead of n!, by inclusion-exclusion over sets of columns:
 *
 *   perm(A) = (-1)^n  sum over column sets S  of  (-1)^|S|  prod_i ( sum_{j in S} a_ij )
 *
 * Each product of row sums counts every way to pick one entry per row
 * from the columns in S, repeats allowed; the alternating signs cancel
 * every pick that misses a column, leaving the picks that use every column
 * exactly once: the permanent. It is the best general method known, and
 * it is still exponential, 2^n terms. Grenet turned the same set idea
 * into a determinant of size 2^n - 1 (see the next page).
 *
 * This file defines one global, RyserFormulaCore. The position is plain data.
 */
const RyserFormulaCore = (() => {
  const SIZES = [2, 3, 4];

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const matrix = (n, seed) => { const r = rng(seed * 7727 + n); return Array.from({ length: n }, () => Array.from({ length: n }, () => 1 + Math.floor(r() * 6))); };

  /** Every term of Ryser's formula, in order of the column sets as binary numbers 1..2^n - 1. */
  function terms(m) {
    const n = m.length, out = [];
    for (let mask = 1; mask < 1 << n; mask++) {
      const cols = [...Array(n).keys()].filter((j) => (mask >> j) & 1);
      const sums = m.map((row) => cols.reduce((s, j) => s + row[j], 0));
      const product = sums.reduce((a, b) => a * b, 1);
      const sign = (n - cols.length) % 2 ? -1 : 1;
      out.push({ cols, sums, product, sign });
    }
    return out;
  }
  const ryser = (m) => terms(m).reduce((s, t) => s + t.sign * t.product, 0);

  /** The permanent the slow way, by the n! products. */
  function perm(m) {
    const n = m.length, used = new Array(n).fill(false);
    const go = (i) => { if (i === n) return 1; let s = 0; for (let j = 0; j < n; j++) if (!used[j]) { used[j] = true; s += m[i][j] * go(i + 1); used[j] = false; } return s; };
    return go(0);
  }

  const factorial = (n) => { let f = 1n; for (let k = 2n; k <= BigInt(n); k++) f *= k; return f; };
  /** Multiplications: Ryser (n - 1 per column set) and the plain sum (n - 1 per product). */
  const ryserMults = (n) => BigInt(n - 1) * ((1n << BigInt(n)) - 1n);
  const plainMults = (n) => BigInt(n - 1) * factorial(n);

  function start(options = {}) {
    const n = SIZES.includes(Number(options.n)) ? Number(options.n) : 3;
    const seed = Number.isInteger(options.seed) && options.seed > 0 ? options.seed : 1;
    const shown = Number.isInteger(options.shown) ? Math.max(0, Math.min((1 << n) - 1, options.shown)) : 0;
    return { n, seed, shown };
  }
  const matrixOf = (s) => matrix(s.n, s.seed);
  const next = (s) => (s.shown < (1 << s.n) - 1 ? { ...s, shown: s.shown + 1 } : null);
  const all = (s) => ({ ...s, shown: (1 << s.n) - 1 });
  const result = (s) => (s.shown === (1 << s.n) - 1 ? "done" : null);

  return { SIZES, matrix, terms, ryser, perm, factorial, ryserMults, plainMults, start, matrixOf, next, all, result };
})();
