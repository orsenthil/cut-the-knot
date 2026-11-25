"use strict";

/*
 * Filling an Array with 0s and 1s, and Counting, from Alexander Bogomolny's
 * applet Numbers01.
 *
 * Fill an N by M array with 0s and 1s. Count the 1s in every row and every
 * column. How many different sums can there be? A sum is at most max(N, M),
 * so there can be at most max(N, M) + 1 different ones (0, 1, ..., max). The
 * page shows that the most, max(N, M) + 1, can be reached when N = M, or when
 * the shorter side is more than half of the longer one (N = M + 1 needs
 * M > 2).
 *
 * The applet's controls: N and M from 2 to 20 (3 and 3 to begin with), a click
 * on a square flips 0 and 1, Reset clears everything, Complement flips every
 * square, and the set of different sums is shown as |{...}| = k. Changing N or
 * M keeps the squares that are still on the board.
 *
 * Position (plain data): { n, m, cells } with cells an array of n rows of m
 * zeros and ones. One global, ZeroOneCore, no DOM.
 */
const ZeroOneCore = (() => {
  const MIN = 2, MAX = 20, DEFAULT = 3;

  const clamp = (v) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.max(MIN, Math.min(MAX, v)) : null; };
  const zeros = (n, m) => Array.from({ length: n }, () => new Array(m).fill(0));

  /** An empty board (the applet's Reset). */
  function start(options) {
    const o = options || {};
    const n = clamp(o.n === undefined ? DEFAULT : o.n) ?? DEFAULT, m = clamp(o.m === undefined ? DEFAULT : o.m) ?? DEFAULT;
    return { n, m, cells: zeros(n, m) };
  }

  /** Flip one square, or null when there is no such square. */
  function toggle(state, i, j) {
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= state.n || j >= state.m) return null;
    const cells = state.cells.map((r) => r.slice());
    cells[i][j] = 1 - cells[i][j];
    return { n: state.n, m: state.m, cells };
  }

  /** Every 0 becomes 1 and every 1 becomes 0. */
  function complement(state) {
    return { n: state.n, m: state.m, cells: state.cells.map((r) => r.map((v) => 1 - v)) };
  }

  /** The board with a new size; squares that are still on the board keep their value, new ones are 0. */
  function resize(state, n, m) {
    n = clamp(n); m = clamp(m);
    if (n === null || m === null) return null;
    const cells = zeros(n, m);
    for (let i = 0; i < Math.min(n, state.n); i++) for (let j = 0; j < Math.min(m, state.m); j++) cells[i][j] = state.cells[i][j];
    return { n, m, cells };
  }

  /** The number of 1s in each row and in each column, the set of different sums (sorted), and the most there could be. */
  function sums(state) {
    const rows = state.cells.map((r) => r.reduce((a, b) => a + b, 0));
    const cols = Array.from({ length: state.m }, (_, j) => state.cells.reduce((a, r) => a + r[j], 0));
    const distinct = [...new Set([...rows, ...cols])].sort((a, b) => a - b);
    return { rows, cols, distinct, count: distinct.length, most: Math.max(state.n, state.m) + 1 };
  }

  /** Whether the page's construction reaches the most possible sums for N by M: N = M, N = M + 1 with M > 2, or the shorter side more than half of the longer. */
  function attainable(n, m) {
    const hi = Math.max(n, m), lo = Math.min(n, m);
    return hi === lo || (hi === lo + 1 && lo > 2) || (hi % 2 === 0 && lo >= hi / 2 + 1) || (hi % 2 === 1 && lo > (hi + 1) / 2);
  }

  /**
   * An array with the most possible different sums (max(N, M) + 1), or null
   * where that is not known to be possible. The rows (the longer side as
   * rows, shifted left) are a few full rows, optionally one in between,
   * then a run going down by 1 steps; the columns of such a staircase follow.
   * Found by trying the few shapes, and checked against the real sums.
   */
  function optimal(n, m) {
    n = clamp(n); m = clamp(m);
    if (n === null || m === null) return null;
    const flip = n < m, N = flip ? m : n, M = flip ? n : m;
    const covers = (r) => {
      const c = new Array(M).fill(0);
      for (const x of r) for (let j = 0; j < x; j++) c[j]++;
      return new Set([...r, ...c]).size === N + 1;
    };
    let rows = null;
    search: for (const v of [M, M - 1]) for (let p = 1; p <= N; p++) for (let mid = -1; mid < v; mid++) for (let s = 0; s <= 1; s++) {
      const used = p + (mid >= 0 ? 1 : 0), rest = N - used;
      if (rest < 0) continue;
      const t = rest === 0 ? -1 : s + rest - 1;
      if (rest > 0 && (t >= v || (mid >= 0 && t > mid))) continue;
      const r = [...Array(p).fill(v), ...(mid >= 0 ? [mid] : []), ...(rest ? Array.from({ length: rest }, (_, k) => t - k) : [])];
      if (r.some((x) => x < 0 || x > M)) continue;
      if (covers(r)) { rows = r; break search; }
    }
    if (!rows) return null;
    const cells = rows.map((x) => Array.from({ length: M }, (_, j) => (j < x ? 1 : 0)));
    if (!flip) return { n, m, cells };
    // a tall board turned on its side
    return { n, m, cells: Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => cells[j][i])) };
  }

  return { MIN, MAX, DEFAULT, start, toggle, complement, resize, sums, attainable, optimal };
})();
