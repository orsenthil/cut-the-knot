"use strict";

/*
 * Other Primes, from Alexander Bogomolny's applet OtherPrimes.
 *
 * The Sieve of Eratosthenes crosses out composites one multiple at a time.
 * This table lists all the odd composites at once. Row i (from 0) is the
 * arithmetic sequence that starts at 4 + 3i and grows by 3 + 2i, so
 * entry(i, j) = 4 + 3i + j(3 + 2i) = n. Then x = 2n + 1 = (2i+3)(2j+3):
 * the table is the multiplication table of the odd numbers 3, 5, 7, ...
 * An odd x > 1 is prime exactly when (x - 1) / 2 is missing from the table.
 *
 * The applet's table is dim x dim with dim from 2 to 30 (default 10). This
 * file is DOM-free and defines one global, OtherPrimesCore.
 */
const OtherPrimesCore = (() => {
  const MIN_DIM = 2, MAX_DIM = 30, DEFAULT_DIM = 10;

  /** The n in row i, column j (both from 0). */
  function entry(i, j) {
    return 4 + 3 * i + j * (3 + 2 * i);
  }

  /** The x = 2n + 1 for the same cell: (2i+3)(2j+3). */
  function xOf(i, j) {
    return 2 * entry(i, j) + 1;
  }

  function clampDim(d) {
    d = Math.floor(Number(d));
    if (!Number.isFinite(d)) return DEFAULT_DIM;
    return Math.min(MAX_DIM, Math.max(MIN_DIM, d));
  }

  /** The position: the table size and which numbers are shown. */
  function start(options) {
    const o = options || {};
    return { dim: clampDim(o.dim === undefined ? DEFAULT_DIM : o.dim), showX: !!o.showX };
  }

  /** The table as rows of numbers (n, or x when showX). */
  function table(state) {
    const rows = [];
    for (let i = 0; i < state.dim; i++) {
      const row = [];
      for (let j = 0; j < state.dim; j++) row.push(state.showX ? xOf(i, j) : entry(i, j));
      rows.push(row);
    }
    return rows;
  }

  /** The set of every n in a dim x dim table. */
  function members(dim) {
    const s = new Set();
    for (let i = 0; i < dim; i++) for (let j = 0; j < dim; j++) s.add(entry(i, j));
    return s;
  }

  /** The two odd factors behind a cell. */
  function factors(i, j) {
    return [2 * i + 3, 2 * j + 3];
  }

  /**
   * The page's theorem as a test: is the odd x > 2 prime, judged only by
   * whether n = (x-1)/2 is missing from the dim x dim table? The table holds
   * the products of two odd numbers from 3 to 2*dim+1, so the answer is sure
   * for every x up to reliableLimit(dim); beyond it a composite whose
   * cofactors are all too big can be missed (never the other way round).
   */
  function primeByTable(x, dim) {
    if (x < 3 || x % 2 === 0) return null;
    return !members(dim).has((x - 1) / 2);
  }

  /** Every odd x up to this is decided correctly by a dim x dim table. */
  function reliableLimit(dim) {
    return 3 * (2 * dim + 1);
  }

  return { reliableLimit, MIN_DIM, MAX_DIM, DEFAULT_DIM, entry, xOf, start, table, members, factors, primeByTable, clampDim };
})();
