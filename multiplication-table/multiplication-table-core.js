"use strict";

/*
 * The Multiplication Table, from Alexander Bogomolny's applet Multiplication.
 *
 * The decimal multiplication table for the numbers 1 to 20: a header row and
 * column of 1..20 and, where row a meets column b, the product a * b.
 * The position is plain data: { n, picked } with n the size (20) and picked
 * the cell the player is looking at, or null.
 */
const MultiplicationCore = (() => {
  const N = 20;

  const start = () => ({ n: N, picked: null });

  /** The entry for row a and column b (1..N). */
  const product = (a, b) => a * b;

  /** The whole table: table[a-1][b-1] = a * b. */
  const table = (n = N) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i + 1) * (j + 1)));

  /** Pick a cell (a, b) to look at; null to put it down. */
  function pick(state, a, b) {
    if (a === null) return { ...state, picked: null };
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || a > state.n || b > state.n) return null;
    return { ...state, picked: { a, b } };
  }

  /** Every cell (row, column) in the table whose product is p. */
  function cellsWith(p, n = N) {
    const out = [];
    for (let a = 1; a <= n; a++) if (p % a === 0 && p / a <= n) out.push([a, p / a]);
    return out;
  }

  /** The cells that are the same product as the picked one (it, and its mirror image, and any others). */
  const related = (state) => (state.picked ? cellsWith(state.picked.a * state.picked.b, state.n) : []);

  return { N, start, product, table, pick, cellsWith, related };
})();
