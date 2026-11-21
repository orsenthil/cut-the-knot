"use strict";

/*
 * City Block Hunt From Outside, from Alexander Bogomolny's applet
 * CityBlockHuntFromOutside (a modification of Tom O'Brien's treasure hunt).
 *
 * A treasure hides in one square of an N x N grid. You touch either a square
 * of the grid or one of the strips just outside an edge ("one step away").
 * A touch of the treasure square ends the hunt. Any other touch in an outside
 * strip displays the taxicab (city-block) distance to the treasure; touches
 * inside the grid other than the treasure show nothing, as in the applet,
 * which only stores outside touches in its Clues vector.
 *
 * The one idea this code relies on: the applet keeps the treasure as a Point
 * whose x is the ROW and whose y is the COLUMN, and both the chest drawing and
 * its clue use that same swap. Written in ordinary (column, row) coordinates
 * the distance is therefore
 *     d = |col - treasure.col| + |row - treasure.row|.
 * So every clue leaves a set of grid squares that always contains the
 * treasure; for a touch next to a corner that set collapses to one diagonal.
 *
 * This file is the game's logic and nothing else: no document, no window, no
 * storage. It defines one global, CityBlockHuntFromOutsideCore, so the page
 * loads it with a plain <script> and porting/check-city-block-hunt-from-outside.mjs
 * loads it in Node. The position is plain data (numbers, strings, arrays,
 * plain objects): { n, treasure, clues, finished }. Functions take a position
 * and return a new one; they do not change what they are given.
 */
const CityBlockHuntFromOutsideCore = (() => {
  // The applet's JSpinner: new SpinnerNumberModel(4, 2, 8, 1).
  const GRID = Object.freeze({ min: 2, max: 8, initial: 4, step: 1 });

  /** Keep N inside the spinner's range and on its step. */
  function clampN(n) {
    let v = Number.isFinite(n) ? Math.round(n) : GRID.initial;
    if (v < GRID.min) v = GRID.min;
    if (v > GRID.max) v = GRID.max;
    return v;
  }

  /** Round a touch coordinate and fold anything beyond an edge onto it. */
  function clampCell(value, n) {
    let v = Number.isFinite(value) ? Math.round(value) : -1;
    if (v < -1) v = -1;
    if (v > n) v = n;
    return v;
  }

  /** Keep a treasure coordinate in the grid (the applet's 0 .. N-1). */
  function clampIndex(value, n) {
    let v = Number.isFinite(value) ? Math.round(value) : 0;
    if (v < 0) v = 0;
    if (v > n - 1) v = n - 1;
    return v;
  }

  /** The taxicab distance, transcribed from the applet's mouseClicked. */
  function taxicab(col, row, treasure) {
    return Math.abs(col - treasure.col) + Math.abs(row - treasure.row);
  }

  /** True for the four strips one square outside the N x N grid. */
  function isOutside(n, col, row) {
    return col < 0 || row < 0 || col >= n || row >= n;
  }

  /** The position a new game starts from. A treasure may be supplied for tests. */
  function start(options) {
    const o = options || {};
    const n = clampN(o.n === undefined ? GRID.initial : o.n);
    let col;
    let row;
    if (o.treasure && Number.isFinite(o.treasure.col) && Number.isFinite(o.treasure.row)) {
      col = clampIndex(o.treasure.col, n);
      row = clampIndex(o.treasure.row, n);
    } else {
      col = Math.floor(Math.random() * n);
      row = Math.floor(Math.random() * n);
    }
    return { n, treasure: { col, row }, clues: [], finished: false };
  }

  /**
   * Every square that can be touched: the N x N grid and the strips along its
   * four edges, but not the diagonal squares outside the corners (the applet
   * refuses those). Row-major order, so the UI can build its grid directly.
   */
  function legalMoves(state) {
    const out = [];
    for (let row = -1; row <= state.n; row++) {
      for (let col = -1; col <= state.n; col++) {
        if ((col >= 0 && col < state.n) || (row >= 0 && row < state.n)) {
          out.push({ col, row });
        }
      }
    }
    return out;
  }

  /**
   * Touch square (col, row). Returns null for a refused touch or when the
   * treasure has already been found: the page says the game stops there.
   */
  function move(state, m) {
    if (!m || !Number.isFinite(m.col) || !Number.isFinite(m.row)) return null;
    const n = state.n;
    const col = clampCell(m.col, n);
    const row = clampCell(m.row, n);
    const insideCol = col >= 0 && col < n;
    const insideRow = row >= 0 && row < n;
    if (!insideCol && !insideRow) return null; // outside both ways: a corner
    if (state.finished) return null;

    const d = taxicab(col, row, state.treasure);
    if (d === 0) {
      // The chest is revealed and no clue is recorded, as in the applet.
      return { n, treasure: { col: state.treasure.col, row: state.treasure.row }, clues: state.clues.slice(), finished: true };
    }
    let clues = state.clues;
    if (!insideCol || !insideRow) {
      // The applet records { col, row, distance } only for outside touches.
      clues = state.clues.concat([{ col, row, d }]);
    }
    return { n, treasure: { col: state.treasure.col, row: state.treasure.row }, clues, finished: false };
  }

  /** "done" once the treasure has been found; this demo has no win or loss. */
  function result(state) {
    return state.finished ? "done" : null;
  }

  /** The grid squares exactly d blocks from a touched square (Show hint). */
  function clueLocus(n, col, row, d) {
    const out = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (taxicab(c, r, { col, row }) === d) out.push({ col: c, row: r });
      }
    }
    return out;
  }

  /** The union of all clue loci: the squares still possible for the treasure. */
  function hintCells(state) {
    const seen = new Set();
    const out = [];
    for (const clue of state.clues) {
      for (const cell of clueLocus(state.n, clue.col, clue.row, clue.d)) {
        const key = cell.col + "," + cell.row;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(cell);
        }
      }
    }
    return out;
  }

  return {
    GRID, clampN, clampCell, clampIndex, taxicab, isOutside,
    start, legalMoves, move, result, clueLocus, hintCells,
  };
})();
