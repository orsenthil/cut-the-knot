"use strict";

/*
 * Two Colors in Two Rows II, from Bogomolny's applet ItemParity2.
 *
 * The earlier result still holds when the rows need not be even and the two
 * rows need not have the same number of red dots. What is required is that
 * the red dots in the top row equal the blue dots in the bottom row (call it
 * M1) and the blue dots in the top equal the red dots in the bottom (M2).
 * Then the unmatched reds in the top row, M1 - x, sit above the unmatched
 * blues in the bottom row, M1 - u, so x = u. The same argument with M2 gives
 * the same conclusion. This is the wine-and-water conundrum in disguise.
 *
 * The key idea is that only the column-by-column matching matters, not the
 * totals. The logic test checks every valid configuration for small row
 * lengths and many random larger ones, including odd lengths.
 *
 * No document, no window, no storage: one global, ItemParityGeneralizedCore.
 * The position is plain data, so it can be saved and handed to the tutor.
 */
const ItemParityGeneralizedCore = (() => {
  const MIN_COLS = 2;
  const MAX_COLS = 12;

  const clamp = (v, lo, hi, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
  };
  const count = (row, color) => row.filter((c) => c === color).length;

  function arrangement(cols, redTop, random) {
    const row = Array.from({ length: cols }, (_, i) => i < redTop ? "R" : "B");
    for (let i = cols - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [row[i], row[j]] = [row[j], row[i]];
    }
    return row;
  }

  function start(options) {
    const opts = options || {};
    const cols = clamp(opts.cols === undefined ? 7 : opts.cols, MIN_COLS, MAX_COLS, 7);
    const redTop = clamp(opts.redTop === undefined ? 3 : opts.redTop, 0, cols, 3);
    const random = opts.random || Math.random;
    return {
      cols,
      rows: [arrangement(cols, redTop, random), arrangement(cols, cols - redTop, random)],
      moves: 0,
    };
  }

  /** red(top) = blue(bottom) and blue(top) = red(bottom). */
  function setupValid(rows) {
    const [top, bottom] = rows;
    return count(top, "R") === count(bottom, "B") && count(bottom, "R") === count(top, "B");
  }

  function analyze(state) {
    const [top, bottom] = state.rows;
    const redJoints = [];
    const blueJoints = [];
    for (let i = 0; i < state.cols; i++) {
      if (top[i] === bottom[i]) (top[i] === "R" ? redJoints : blueJoints).push(i);
    }
    const red = redJoints.length;
    const blue = blueJoints.length;
    const redTop = count(top, "R");
    const blueTop = count(top, "B");
    const redBottom = count(bottom, "R");
    const blueBottom = count(bottom, "B");
    return {
      cols: state.cols,
      redTop, blueTop, redBottom, blueBottom,
      redJoints, blueJoints, red, blue,
      unmatchedRedTop: redTop - red,
      unmatchedBlueBottom: blueBottom - blue,
      unmatchedBlueTop: blueTop - blue,
      unmatchedRedBottom: redBottom - red,
      setupValid: setupValid(state.rows),
      equal: red === blue,
    };
  }

  /** Swap two cells within a row, preserving the row's colour counts. */
  function swap(state, row, i, j) {
    if (row < 0 || row > 1 || i < 0 || j < 0 || i >= state.cols || j >= state.cols || i === j) return state;
    const rows = state.rows.map((r) => r.slice());
    [rows[row][i], rows[row][j]] = [rows[row][j], rows[row][i]];
    return { ...state, rows, moves: state.moves + 1 };
  }

  function setRedTop(state, value) {
    const redTop = clamp(value, 0, state.cols, 0);
    const random = Math.random;
    return {
      ...state,
      rows: [arrangement(state.cols, redTop, random), arrangement(state.cols, state.cols - redTop, random)],
      moves: 0,
    };
  }

  function setCols(state, value) {
    const cols = clamp(value, MIN_COLS, MAX_COLS, state.cols);
    const redTop = clamp(Math.round(state.cols ? state.rows[0].filter((c) => c === "R").length / state.cols * cols : cols / 2), 0, cols, cols / 2);
    const random = Math.random;
    return {
      ...state, cols,
      rows: [arrangement(cols, redTop, random), arrangement(cols, cols - redTop, random)],
      moves: 0,
    };
  }

  function randomize(state) {
    const random = Math.random;
    const redTop = count(state.rows[0], "R");
    return { ...state, rows: [arrangement(state.cols, redTop, random), arrangement(state.cols, state.cols - redTop, random)], moves: 0 };
  }

  function rowsEqual(top, bottom) {
    if (!setupValid([top, bottom])) return false;
    return analyze({ cols: top.length, rows: [top, bottom], moves: 0 }).equal;
  }

  return {
    MIN_COLS, MAX_COLS, clamp, count, start, setupValid, analyze,
    swap, setRedTop, setCols, randomize, rowsEqual,
  };
})();
