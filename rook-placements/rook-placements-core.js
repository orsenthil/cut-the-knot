"use strict";

/*
 * Rooks and Matchings: an original game for the VP vs VNP path.
 *
 * On a board with some squares blocked, place n rooks, one in every row and
 * every column, only on open squares. How many ways are there? Exactly the
 * permanent of the board's 0/1 matrix (1 = open): each of the n! products
 * is 1 when its n squares are all open and 0 otherwise. In graph language
 * it counts the perfect matchings between rows and columns.
 *
 * Deciding whether there is at least one placement is easy: the augmenting
 * path method finds one, or proves there is none, in about n^3 steps.
 * Counting them is #P-complete (Valiant, 1979): believed to need
 * exponential time. Counting is where the permanent gets hard.
 *
 * The game: find every placement on the board. Boards are made from a
 * seed so the tutor can rebuild them. This file defines one global,
 * RookPlacementsCore. The position is plain data.
 */
const RookPlacementsCore = (() => {
  const SIZES = [4, 5, 6];

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

  /** Every placement: for each, the column of the rook in each row. */
  function placements(open) {
    const n = open.length, out = [], used = new Array(n).fill(false), cols = [];
    const go = (i) => {
      if (i === n) { out.push(cols.slice()); return; }
      for (let j = 0; j < n; j++) if (open[i][j] && !used[j]) { used[j] = true; cols.push(j); go(i + 1); cols.pop(); used[j] = false; }
    };
    go(0);
    return out;
  }
  const count = (open) => placements(open).length;

  /** Is there a placement? Augmenting paths (Kuhn's method), no counting. */
  function exists(open) {
    const n = open.length, rowOf = new Array(n).fill(-1);
    const tryRow = (i, seen) => {
      for (let j = 0; j < n; j++) if (open[i][j] && !seen[j]) {
        seen[j] = true;
        if (rowOf[j] < 0 || tryRow(rowOf[j], seen)) { rowOf[j] = i; return true; }
      }
      return false;
    };
    for (let i = 0; i < n; i++) if (!tryRow(i, new Array(n).fill(false))) return false;
    return true;
  }

  /** A board for (n, seed): blocked squares at random until the count is between 3 and 12. */
  function board(n, seed) {
    const r = rng(seed * 7919 + n);
    for (;;) {
      const open = Array.from({ length: n }, () => Array.from({ length: n }, () => r() < 0.55));
      const c = count(open);
      if (c >= 3 && c <= 12) return open;
    }
  }

  function start(options = {}) {
    const n = SIZES.includes(Number(options.n)) ? Number(options.n) : 4;
    const seed = Number.isInteger(options.seed) && options.seed > 0 ? options.seed : 1;
    const open = Array.isArray(options.open) && options.open.length === n ? options.open.map((r) => r.map(Boolean)) : board(n, seed);
    return { n, seed, open, rooks: new Array(n).fill(-1), found: Array.isArray(options.found) ? options.found.map((f) => f.slice()) : [] };
  }

  const key = (cols) => cols.join(",");
  const attacked = (s, i, j) => s.rooks[i] >= 0 || s.rooks.some((c) => c === j);

  /** Click square (i, j): take a rook off, or put one on an open, unattacked square. */
  function toggle(s, i, j) {
    if (!(Number.isInteger(i) && Number.isInteger(j) && i >= 0 && j >= 0 && i < s.n && j < s.n)) return null;
    const rooks = s.rooks.slice();
    if (rooks[i] === j) rooks[i] = -1;
    else if (!s.open[i][j] || attacked(s, i, j)) return null;
    else rooks[i] = j;
    let found = s.found;
    if (rooks.every((c) => c >= 0) && !found.some((f) => key(f) === key(rooks))) found = found.concat([rooks.slice()]);
    return { ...s, rooks, found };
  }

  const clear = (s) => ({ ...s, rooks: new Array(s.n).fill(-1) });
  const total = (s) => count(s.open);
  const result = (s) => (s.found.length === total(s) ? "win" : null);

  return { SIZES, rng, placements, count, exists, board, start, toggle, clear, total, result };
})();
