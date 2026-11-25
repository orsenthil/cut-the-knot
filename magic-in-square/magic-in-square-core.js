"use strict";

/*
 * Magic in a Square, from Alexander Bogomolny's applet MagicInSquare.
 *
 * N*N different numbers are dealt at random into an N by N square. You think
 * of one and say which column it is in. The computer then turns the rows into
 * columns: the numbers of each old row become one new column, in a fresh
 * random order. You say which new column your number is in. A number is
 * fixed by its row and its column, and the two answers give exactly those:
 * the first is the old column, the second is the old row (the new column it
 * has landed in), so the number is grid[row][col].
 *
 * The position is plain data:
 *   { n, grid, aux, stage, col, row }
 *   grid  n rows of n numbers (row r, column c)
 *   aux   for each new column r, the order its numbers are shown in (aux[r][i]
 *         is the old column shown in slot i of new column r)
 *   stage 0 pick the column, 1 pick the column again, 2 revealed
 */
const MagicInSquareCore = (() => {
  const MIN_N = 3, MAX_N = 6, DEFAULT_N = 5;
  const MESSAGES = [
    { upper: "Select a number and", lower: "click under the column it's in" },
    { upper: "Please click again under", lower: "the column your number is in" },
    { upper: "Your number is", lower: "Press Reset!" },
  ];

  const clampN = (n) => Math.min(MAX_N, Math.max(MIN_N, Math.round(Number(n)) || DEFAULT_N));

  function shuffled(len, random) {
    const p = Array.from({ length: len }, (_, i) => i);
    for (let i = len - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    return p;
  }

  /** A new random deal for an n by n square. */
  function start(options) {
    const o = options || {};
    const n = clampN(o.n === undefined ? DEFAULT_N : o.n), random = o.random || Math.random;
    const flat = shuffled(n * n, random).map((v) => v + 1);
    const grid = Array.from({ length: n }, (_, r) => flat.slice(r * n, r * n + n));
    const aux = Array.from({ length: n }, () => shuffled(n, random));
    return { n, grid, aux, stage: 0, col: -1, row: -1 };
  }

  /** The square as it is shown now: view[row][column]. */
  function view(s) {
    const { n, grid, aux, stage } = s;
    return Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => (stage === 0 ? grid[a][b] : grid[b][aux[b][a]])));
  }

  /** The player says "it is in column x" (0-based). Returns the new position, or null when not allowed. */
  function pick(s, x) {
    if (!Number.isInteger(x) || x < 0 || x >= s.n) return null;
    if (s.stage === 0) return { ...s, col: x, stage: 1 };
    if (s.stage === 1) return { ...s, row: x, stage: 2 };
    return null;
  }

  /** The number named at the end, or null before that. */
  const answer = (s) => (s.stage === 2 ? s.grid[s.row][s.col] : null);

  /** Where the named number is in the view: {row, col}, or null. */
  function revealedCell(s) {
    if (s.stage !== 2) return null;
    const v = view(s), target = answer(s);
    for (let a = 0; a < s.n; a++) for (let b = 0; b < s.n; b++) if (v[a][b] === target) return { row: a, col: b };
    return null;
  }

  const result = (s) => (s.stage === 2 ? "done" : null);
  const message = (s) => MESSAGES[s.stage];

  /** The columns of a view that hold a number: what the player should answer if they thought of it. */
  function columnOf(s, number) {
    const v = view(s);
    for (let a = 0; a < s.n; a++) for (let b = 0; b < s.n; b++) if (v[a][b] === number) return b;
    return -1;
  }

  return { MIN_N, MAX_N, DEFAULT_N, MESSAGES, clampN, start, view, pick, answer, revealedCell, result, message, columnOf };
})();
