"use strict";

/*
 * Changing Colors II (Bogomolny's JChangingColors applet) - the board.
 *
 * An N by N board (N = 4, 6 or 8; 6 to start), all white but one black cell
 * on an edge, never a corner. A move swaps every colour along a row, a column,
 * or a line parallel to either diagonal - even a "line" of one corner cell.
 * Can the board ever be made one colour? (Engel, Problem-Solving Strategies.)
 *
 * No. Look at the edge cells that are not corners (the applet's "Show hint").
 * A middle row or column meets two of them, at its ends. The top and bottom
 * rows and the side columns meet N - 2 of them, an even number because N is
 * even - which is why the applet only offers even N. Every diagonal line meets
 * two of them at its ends, or none if it runs corner to corner or is a single
 * corner. So every move swaps an even number of those cells, the number of
 * black ones among them never changes parity, and it starts at one.
 *
 * Read off the bytecode: Reset() puts the black cell on a random edge, not a
 * corner (column 0 or N-1 and row 1..N-2, or the other way round, each half
 * the time); there is an arrow for each of the N rows, N columns and 2N-1
 * lines in each diagonal direction; "Take back" pops a stack of boards; the
 * "numbers" view shows -1 for black and 1 for white, where the product over
 * the hint cells is the invariant.
 */

var ChangingColorsCore = (function () {
  const SIZES = [4, 6, 8]; // JSpinner(6, 4, 8, 2)
  const DEFAULT_N = 6;

  /** cells[r][c] is true for black. */
  function start(n, rnd = Math.random) {
    const cells = Array.from({ length: n }, () => new Array(n).fill(false));
    const inner = 1 + Math.trunc(rnd() * (n - 2));
    if (rnd() < 0.5) {
      const col = rnd() < 0.5 ? 0 : n - 1;
      cells[inner][col] = true;
    } else {
      const row = rnd() < 0.5 ? 0 : n - 1;
      cells[row][Math.trunc(1 + rnd() * (n - 2))] = true;
    }
    return { n, cells, history: [] };
  }

  /**
   * The lines a move can swap: kind "row" or "col" with index 0..n-1, and
   * "diag" (r - c constant) or "anti" (r + c constant) with index 0..2n-2.
   */
  function lineCells(n, kind, k) {
    const out = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if ((kind === "row" && r === k) || (kind === "col" && c === k) ||
            (kind === "diag" && r - c + n - 1 === k) || (kind === "anti" && r + c === k)) out.push([r, c]);
      }
    }
    return out;
  }

  function allLines(n) {
    const out = [];
    for (let k = 0; k < n; k++) out.push(["row", k], ["col", k]);
    for (let k = 0; k < 2 * n - 1; k++) out.push(["diag", k], ["anti", k]);
    return out;
  }

  function swap(s, kind, k) {
    s.history.push(s.cells.map((r) => r.slice()));
    for (const [r, c] of lineCells(s.n, kind, k)) s.cells[r][c] = !s.cells[r][c];
  }

  function takeBack(s) {
    const prev = s.history.pop();
    if (!prev) return false;
    s.cells = prev;
    return true;
  }

  /** The applet's hint: the edge cells that are not corners. */
  function hintCells(n) {
    const out = [];
    for (let i = 1; i < n - 1; i++) out.push([0, i], [n - 1, i], [i, 0], [i, n - 1]);
    return out;
  }

  const blackCount = (s, cells) => cells.filter(([r, c]) => s.cells[r][c]).length;
  const monochrome = (s) => {
    const first = s.cells[0][0];
    return s.cells.every((row) => row.every((v) => v === first));
  };

  return { SIZES, DEFAULT_N, start, lineCells, allLines, swap, takeBack, hintCells, blackCount, monochrome };
})();
