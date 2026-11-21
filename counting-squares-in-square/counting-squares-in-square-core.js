"use strict";

/*
 * Counting Squares in a Square — the logic behind Alexander Bogomolny's applet
 * "CountingSquaresInSquare"
 * (cut-the-knot.org/Curriculum/Algebra/CountingSquaresInSquare.shtml).
 *
 * How many M x M squares fit on the grid of an N x N square? The applet shows
 * the N x N square and a draggable M x M square that starts in its lower right
 * corner. The upper left 1 x 1 cell of the moving square "leaks paint": each
 * time it passes within a third of a cell of a cell centre it paints that cell.
 * Only cells where the whole M x M square would still lie inside the N x N
 * square can be reached this way, and there are exactly (N - M + 1)^2 of them,
 * because an M x M square is fixed by where its upper left cell is. Adding up
 * over every size M gives the square pyramidal numbers,
 *     T(N) = sum over M of (N - M + 1)^2 = N (N + 1) (2 N + 1) / 6.
 *
 * Applet facts kept: N opens at 4 and M at 2, both between 1 and 40; the moving
 * square starts at the lower right (its cell at (N - M, N - M), already painted);
 * the paint test is "distance from the moving square's upper left cell centre to
 * the cell centre is less than a third of a cell"; the N control never goes
 * below M (it is lifted to M), but M is not held to at most N: a larger M simply
 * leaves no place for the square, so no cell can be painted. (The page's text
 * says the places form a square in the upper right corner: they form it in the
 * upper left.)
 *
 * Positions are in units of one cell, the board running from (0, 0) to (N, N)
 * with y down, as on screen. No document, no window, no storage.
 */
const CountingSquaresInSquareCore = (() => {
  const MIN = 1;
  const MAX = 40;
  const START_N = 4;
  const START_M = 2;
  const REACH = 1 / 3; // SmallSquare.Close: distance below A/3
  const MARGIN = 1.5; // how far the moving square may be dragged beyond the board

  const clampInt = (v) => Math.max(MIN, Math.min(MAX, Math.trunc(v)));

  /** How many places an M x M square has in an N x N square. */
  function places(n, m) {
    return n >= m ? (n - m + 1) * (n - m + 1) : 0;
  }

  /** The square pyramidal number: all squares of every size in an N x N grid. */
  function total(n) {
    let t = 0;
    for (let m = 1; m <= n; m++) t += places(n, m);
    return t;
  }

  /** A new position for sizes n and m (the applet's Reset). */
  function start(options) {
    const o = options || {};
    let n = Number.isFinite(Number(o.n)) ? clampInt(Number(o.n)) : START_N;
    const m = Number.isFinite(Number(o.m)) ? clampInt(Number(o.m)) : START_M;
    if (n < m && !o.allowLargeM) n = m; // the N control is lifted to M; the M control is not held to N
    const side = Math.max(0, n - m + 1);
    const state = {
      n, m,
      painted: Array.from({ length: side * side }, () => false), // index i * side + j for the cell at column i, row j
      pos: { x: n - m, y: n - m }, // the moving square's upper left corner, in cells
      moves: 0, explored: false,
    };
    return paint(state);
  }

  /** The side of the grid of places. */
  const side = (state) => Math.max(0, state.n - state.m + 1);

  /** CheckFilled: paint every cell whose centre the upper left cell's centre is close to. */
  function paint(state) {
    const s = side(state);
    if (!s) return state;
    const painted = state.painted.slice();
    const cx = state.pos.x + 0.5, cy = state.pos.y + 0.5;
    for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) {
      if (Math.hypot(i + 0.5 - cx, j + 0.5 - cy) < REACH) painted[i * s + j] = true;
    }
    return { ...state, painted };
  }

  const bounds = (state) => ({ lo: -MARGIN, hi: Math.max(-MARGIN, state.n + MARGIN - state.m) });

  /** The moves: drag the square (to a new upper left corner), or change N or M. */
  function legalMoves() {
    return [{ type: "drag", x: 0, y: 0 }, { type: "n", value: START_N }, { type: "m", value: START_M }, { type: "reset" }];
  }

  /** The position after a move, or null if it is not allowed. */
  function move(state, mv) {
    if (!mv) return null;
    if (mv.type === "drag") {
      if (!Number.isFinite(Number(mv.x)) || !Number.isFinite(Number(mv.y))) return null;
      const { lo, hi } = bounds(state);
      const pos = { x: Math.max(lo, Math.min(hi, Number(mv.x))), y: Math.max(lo, Math.min(hi, Number(mv.y))) };
      return { ...paint({ ...state, pos }), moves: state.moves + 1, explored: true };
    }
    if (mv.type === "n" || mv.type === "m") {
      if (!Number.isFinite(Number(mv.value))) return null;
      const next = start({ n: mv.type === "n" ? mv.value : state.n, m: mv.type === "m" ? mv.value : state.m, allowLargeM: mv.type === "m" });
      return { ...next, moves: state.moves + 1, explored: true };
    }
    if (mv.type === "reset") return start({ n: state.n, m: state.m, allowLargeM: state.m > state.n });
    return null;
  }

  /** How many places have been painted. */
  const paintedCount = (state) => state.painted.filter(Boolean).length;

  /** A demo: "done" once every place has been painted (or there are none to paint). */
  function result(state) {
    return side(state) > 0 && paintedCount(state) === side(state) * side(state) && state.explored ? "done" : null;
  }

  return { MIN, MAX, START_N, START_M, REACH, MARGIN, start, legalMoves, move, result, places, total, side, paintedCount, bounds };
})();
