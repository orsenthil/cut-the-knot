"use strict";

/*
 * Two Colors in Two Rows, from Bogomolny's applet ItemParity.
 *
 * Two rows each have an even number of cells, half red and half blue. In each
 * column, join the two cells when they have the same colour. The number of red
 * joins always equals the number of blue joins. With M of each colour per row,
 * let x be the number of joined red pairs and u the number of joined blue
 * pairs. Unmatched reds in one row match unmatched blues in the other, so
 * M - x = M - u and hence x = u.
 *
 * The key idea is that the unmatched cells of the two colours are paired
 * across rows. The logic test checks the equality exhaustively for small row
 * lengths, on random larger rows and on full even grids (where it applies
 * between every adjacent pair of rows and columns).
 *
 * No document, no window, no storage: one global, ItemParityCore. The position
 * is plain data, so it can be saved and handed to the tutor.
 */
const ItemParityCore = (() => {
  const MIN_COLS = 2;
  const MAX_COLS = 12;

  const clamp = (v, lo, hi, fb) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb;
  };

  function shuffled(cols, random) {
    const half = cols / 2;
    const row = Array.from({ length: cols }, (_, i) => i < half ? "R" : "B");
    for (let i = cols - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [row[i], row[j]] = [row[j], row[i]];
    }
    return row;
  }

  function start(options) {
    const opts = options || {};
    const cols = clamp(opts.cols === undefined ? 8 : opts.cols, MIN_COLS, MAX_COLS, 8);
    const random = opts.random || Math.random;
    return { cols, rows: [shuffled(cols, random), shuffled(cols, random)], moves: 0 };
  }

  function count(row, color) {
    return row.filter((c) => c === color).length;
  }

  function analyze(state) {
    const [top, bottom] = state.rows;
    const redJoints = [];
    const blueJoints = [];
    for (let i = 0; i < state.cols; i++) {
      if (top[i] === bottom[i]) (top[i] === "R" ? redJoints : blueJoints).push(i);
    }
    return {
      cols: state.cols,
      redTop: count(top, "R"), blueTop: count(top, "B"),
      redBottom: count(bottom, "R"), blueBottom: count(bottom, "B"),
      redJoints, blueJoints,
      red: redJoints.length, blue: blueJoints.length,
      equal: redJoints.length === blueJoints.length,
    };
  }

  /** Swap two cells within a row, preserving its red/blue counts. */
  function swap(state, row, i, j) {
    if (row < 0 || row > 1 || i < 0 || j < 0 || i >= state.cols || j >= state.cols || i === j) return state;
    const rows = state.rows.map((r) => r.slice());
    [rows[row][i], rows[row][j]] = [rows[row][j], rows[row][i]];
    return { ...state, rows, moves: state.moves + 1 };
  }

  function randomize(state) {
    const random = Math.random;
    return { ...state, rows: [shuffled(state.cols, random), shuffled(state.cols, random)], moves: 0 };
  }

  function setCols(state, value) {
    const cols = clamp(value, MIN_COLS, MAX_COLS, state.cols) & ~1; // keep it even
    const random = Math.random;
    return { ...state, cols, rows: [shuffled(cols, random), shuffled(cols, random)], moves: 0 };
  }

  /** Check the two-row claim for an explicit pair of rows. */
  function rowsEqual(top, bottom) {
    const r = analyze({ cols: top.length, rows: [top, bottom] });
    return r.red === r.blue;
  }

  /** Full grid version: equal totals over every adjacent row and column pair. */
  function gridEqual(grid) {
    const n = grid.length;
    const m = grid[0].length;
    let red = 0;
    let blue = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        if (i + 1 < n && grid[i][j] === grid[i + 1][j]) grid[i][j] === "R" ? red++ : blue++;
        if (j + 1 < m && grid[i][j] === grid[i][j + 1]) grid[i][j] === "R" ? red++ : blue++;
      }
    }
    return { red, blue, equal: red === blue };
  }

  return { MIN_COLS, MAX_COLS, clamp, start, count, analyze, swap, randomize, setCols, rowsEqual, gridEqual };
})();
