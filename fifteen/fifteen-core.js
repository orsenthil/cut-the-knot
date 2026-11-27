"use strict";

/*
 * Sam Loyd's Fifteen, from Alexander Bogomolny's cut-the-knot applet `fifteen`.
 *
 * A square board of n by n counters (n = 3..7) has one empty cell. Clicking a
 * counter slides the whole run of counters between it and the empty cell; the
 * applet does this for a whole row or column at a time. Two wrap variants
 * change what happens at the top and bottom edges: Cylinder wraps vertically
 * in the same column, Moebius wraps vertically with the column reflected.
 * `Cheat` swaps the two counters just above the empty column, producing a
 * position the ordinary slides can never solve.
 *
 * The key idea is the parity in the page: read the counters row by row,
 * skipping the empty cell, and count inversions. Adding the row number of the
 * empty square gives a quantity whose parity is unchanged by every slide on
 * an even-sized board; on an odd-sized board the inversion count alone is
 * unchanged. This file is pure logic: no document, no window, no storage. It
 * defines one global, FifteenCore, and never changes the state it is given.
 *
 * Coordinates follow the applet: tiles[col * n + row] and blank = n * n.
 */
const FifteenCore = (() => {
  const MIN_N = 3;
  const MAX_N = 7;
  const PLAIN = 0;
  const CYLINDER = 1;
  const MOEBIUS = 2;
  const MODES = ["Loyd's", "Cylinder", "Moebius"];

  function option(value, lo, hi, fallback) {
    const x = Number(value);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(hi, Math.max(lo, Math.trunc(x)));
  }

  /** The applet's option ranges: n = 3..7, mode = 0 (Loyd's), 1, 2. */
  function options(o) {
    const given = o || {};
    return {
      n: option(given.n, MIN_N, MAX_N, 4),
      mode: option(given.mode, PLAIN, MOEBIUS, PLAIN),
    };
  }

  function solvedTiles(n) {
    return Array.from({ length: n * n }, (_, k) => k + 1);
  }

  /** A freshly reset board: counter k is in cell k, the blank is last. */
  function start(o) {
    const { n, mode } = options(o);
    return { n, mode, tiles: solvedTiles(n), moves: 0 };
  }

  function blankIndex(state) {
    return state.tiles.indexOf(state.n * state.n);
  }

  function isSolved(state) {
    const { n, tiles } = state;
    for (let k = 0; k < n * n; k++) if (tiles[k] !== k + 1) return false;
    return true;
  }

  function result(state) {
    // The applet has no win or loss message; finishing just opens its eyes.
    return isSolved(state) ? "done" : null;
  }

  /*
   * One click, transcribed from fifteengame.Shift(). `col` is the applet's
   * Point.x / square size and `row` its Point.y / square size. A click on the
   * blank or off a reachable row/column does nothing (Shift leaves the array
   * alone and then re-tests whether the board is solved).
   */
  function slide(tiles, n, mode, col, row) {
    if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
    if (col < 0 || row < 0 || col >= n || row >= n) return null;
    const sq = n * n;
    const at = tiles.indexOf(sq);
    if (at < 0) return null;
    const blankCol = Math.floor(at / n);
    const blankRow = at % n;
    if (col === blankCol && row === blankRow) return null;

    const a = tiles.slice();
    const swap = (i, j) => {
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    };

    if (row === blankRow) {
      // ShiftLeft / ShiftRight: the counters in the row move past the blank.
      if (col > blankCol) {
        for (let k = blankCol; k < col; k++) a[k * n + blankRow] = a[(k + 1) * n + blankRow];
      } else {
        for (let k = blankCol; k > col; k--) a[k * n + blankRow] = a[(k - 1) * n + blankRow];
      }
      a[col * n + blankRow] = sq;
    } else if (mode === MOEBIUS && col === n - blankCol - 1 && col !== blankCol &&
               row === 0 && blankRow === n - 1) {
      swap((n - blankCol - 1) * n, blankCol * n + (n - 1));
    } else if (mode === MOEBIUS && row === n - 1 && blankRow === 0) {
      // The bytecode does not check the clicked column here: it always swaps
      // the reflected column with the blank. Kept as the applet has it.
      swap((n - blankCol - 1) * n + (n - 1), blankCol * n);
    } else if (col === blankCol) {
      if (mode === CYLINDER && ((row === 0 && blankRow === n - 1) ||
                                (row === n - 1 && blankRow === 0))) {
        swap(blankCol * n, blankCol * n + (n - 1));
      } else if (row < blankRow) {
        // ShiftTop: blank moves up, counters move down.
        for (let k = blankRow; k > row; k--) a[blankCol * n + k] = a[blankCol * n + k - 1];
        a[blankCol * n + row] = sq;
      } else {
        // ShiftBottom: blank moves down, counters move up.
        for (let k = blankRow; k < row; k++) a[blankCol * n + k] = a[blankCol * n + k + 1];
        a[blankCol * n + row] = sq;
      }
    } else {
      return null;
    }
    return a;
  }

  /** The position after a click on cell index col * n + row, or null. */
  function move(state, index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.n * state.n) return null;
    const col = Math.floor(index / state.n);
    const row = index % state.n;
    const tiles = slide(state.tiles, state.n, state.mode, col, row);
    if (!tiles) return null;
    return { n: state.n, mode: state.mode, tiles, moves: state.moves + 1 };
  }

  /** Every click that actually slides counters (the applet's IsSquare/Shift). */
  function legalMoves(state) {
    const out = [];
    for (let k = 0; k < state.n * state.n; k++) {
      const col = Math.floor(k / state.n);
      const row = k % state.n;
      if (slide(state.tiles, state.n, state.mode, col, row)) out.push(k);
    }
    return out;
  }

  /*
   * Reshuffle: 4*n*n random clicks, each drawing col, row and a third random
   * bit the bytecode fetches but never uses. Shuffling starts from the board
   * it is given, so it never changes which component the position is in.
   */
  function shuffle(state, rng) {
    const rand = typeof rng === "function" ? rng : Math.random;
    const { n, mode } = state;
    let tiles = state.tiles.slice();
    for (let k = 0; k < 4 * n * n; k++) {
      const col = Math.floor(n * rand());
      const row = Math.floor(n * rand());
      Math.floor(2 * rand()); // the applet's third draw, unused
      const next = slide(tiles, n, mode, col, row);
      if (next) tiles = next;
    }
    return { n, mode, tiles, moves: state.moves };
  }

  /** The applet's Cheat: swap rows n-3 and n-2 of the empty square's column. */
  function cheat(state) {
    const { n, mode } = state;
    const sq = n * n;
    let col = n - 1;
    if (state.tiles[(n - 3) * n + (n - 1)] === sq ||
        state.tiles[(n - 2) * n + (n - 1)] === sq) col = n - 2;
    const tiles = state.tiles.slice();
    const i = (n - 3) * n + col;
    const j = (n - 2) * n + col;
    const t = tiles[i];
    tiles[i] = tiles[j];
    tiles[j] = t;
    return { n, mode, tiles, moves: state.moves + 1 };
  }

  /** Inversions, reading the visible board row by row and skipping the blank. */
  function inversions(state) {
    const { n, tiles } = state;
    const seq = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const v = tiles[col * n + row];
        if (v !== n * n) seq.push(v);
      }
    }
    let count = 0;
    for (let i = 0; i < seq.length; i++) {
      for (let j = i + 1; j < seq.length; j++) if (seq[i] > seq[j]) count++;
    }
    return count;
  }

  /** Row of the empty square, counted from the top starting at one. */
  function blankRow(state) {
    return (blankIndex(state) % state.n) + 1;
  }

  /** The page's N: inversions plus the blank's row. Only its parity matters. */
  function parity(state) {
    return (inversions(state) + blankRow(state)) % 2;
  }

  /** Permutation.toCyclesSpec(), with the applet's blank printed as "b". */
  function cycles(state) {
    const { n, tiles } = state;
    const sq = n * n;
    const seen = new Array(n * n).fill(false);
    let out = "";
    let k = seen.indexOf(false);
    while (k !== -1) {
      out += "(";
      let first = true;
      while (!seen[k]) {
        const v = tiles[k];
        out += (first ? "" : ",") + (v === sq ? "b" : String(v));
        first = false;
        seen[k] = true;
        k = v - 1; // fromV in the applet's ShiftUp mode
        if (seen[k]) out += ")";
      }
      k = seen.indexOf(false);
    }
    return out;
  }

  return {
    MIN_N, MAX_N, PLAIN, CYLINDER, MOEBIUS, MODES,
    options, start, blankIndex, isSolved, result, move, legalMoves,
    slide, shuffle, cheat, inversions, blankRow, parity, cycles,
  };
})();
