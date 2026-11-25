"use strict";

/*
 * Moving Chips in Pairs Down a Checkerboard, from Alexander Bogomolny's applet
 * MovingInpairs.
 *
 * N chips are placed on an N by N board, one in every row and one in every
 * column (a random placement). A move slides any two chips, each one square
 * down. Can all the chips reach the bottom row? A chip in the bottom row cannot
 * be picked. The game ends when all N chips are at the bottom (solved) or when
 * only one chip is left off the bottom row (blocked: a move needs two).
 *
 * Rows are counted from the top (row 0) to the bottom (row N-1). The height of
 * a chip is its distance from the bottom, N-1-row; the height of a position is
 * the sum. Every move lowers the height by exactly 2, so an odd height can
 * never reach 0; and the starting height is always 0 + 1 + ... + (N-1) =
 * N(N-1)/2, which is even exactly when N is 0 or 1 modulo 4. When it is even,
 * always moving the two highest chips solves the game (the page's strategy).
 *
 * The position is plain data: { n, rows, selected, history }
 *   rows[c]      the row of the chip in column c (chips never change column)
 *   selected[c]  true when that chip is picked
 *   history      earlier positions' rows, for Remove last
 */
const ChipsCore = (() => {
  const MIN_N = 3, MAX_N = 20, DEFAULT_N = 10;

  const clampN = (n) => Math.min(MAX_N, Math.max(MIN_N, Math.round(Number(n)) || DEFAULT_N));

  /** A random placement: one chip per column, in a random permutation of the rows. */
  function start(options) {
    const o = options || {}, random = o.random || Math.random, n = clampN(o.n === undefined ? DEFAULT_N : o.n);
    const rows = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
    return { n, rows, selected: Array(n).fill(false), history: [] };
  }

  const height = (state) => state.rows.reduce((t, r) => t + (state.n - 1 - r), 0);
  const startHeight = (n) => (n * (n - 1)) / 2;
  const atBottom = (state) => state.rows.filter((r) => r === state.n - 1).length;
  /** Pick or unpick a chip; a chip in the bottom row cannot be picked. null if not allowed. */
  function toggle(state, c) {
    if (!Number.isInteger(c) || c < 0 || c >= state.n || state.rows[c] === state.n - 1) return null;
    return { ...state, selected: state.selected.map((s, i) => (i === c ? !s : s)) };
  }

  const pickedCount = (state) => state.selected.filter(Boolean).length;
  /** The Make move button is available exactly when two chips are picked. */
  const canMove = (state) => pickedCount(state) === 2;

  /** Slide the two picked chips one square down. */
  function move(state) {
    if (!canMove(state)) return null;
    return {
      ...state,
      rows: state.rows.map((r, c) => (state.selected[c] ? r + 1 : r)),
      selected: Array(state.n).fill(false),
      history: state.history.concat([state.rows.slice()]),
    };
  }

  /** Remove last: take the last move back. null when there is none. */
  function undo(state) {
    if (state.history.length === 0) return null;
    return { ...state, rows: state.history[state.history.length - 1].slice(), selected: Array(state.n).fill(false), history: state.history.slice(0, -1) };
  }

  /** "win" when all chips are at the bottom, "lose" when one chip is left, else null. */
  function result(state) {
    const b = atBottom(state);
    return b === state.n ? "win" : b === state.n - 1 ? "lose" : null;
  }

  /** The strategy: the two chips farthest from the bottom (ties: the lower column numbers). Columns, or null when fewer than two can move. */
  function bestPair(state) {
    const movable = state.rows.map((r, c) => ({ c, h: state.n - 1 - r })).filter((x) => x.h > 0).sort((a, b) => b.h - a.h || a.c - b.c);
    return movable.length >= 2 ? [movable[0].c, movable[1].c] : null;
  }

  /** Is the whole game solvable from here? (Even height, by the page's two propositions.) */
  const solvable = (state) => height(state) % 2 === 0;

  const reset = (state, random) => start({ n: state.n, random });
  const resize = (state, n, random) => start({ n, random });

  return { MIN_N, MAX_N, DEFAULT_N, clampN, start, height, startHeight, atBottom, toggle, pickedCount, canMove, move, undo, result, bestPair, solvable, reset, resize };
})();
