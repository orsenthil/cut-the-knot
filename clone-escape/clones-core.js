"use strict";

/*
 * Escape of the Clones -- pure logic, no DOM. Ported from Alexander
 * Bogomolny's CloneEscape applet
 * (cut-the-knot.org/Curriculum/Games/CloneEscape.shtml). classes.zip has only
 * the three .class files and no source, so the rules came off
 * `javap -c -p CloneEscapeCanvas.class`.
 *
 * The board is the infinite quarter plane, squares (row, col) with row and col
 * >= 0 and the origin at the top left. A clone splits into one copy directly
 * below it and one directly to its right:
 *
 *   mouseClicked: if (Clones[r][c] && !Clones[r+1][c] && !Clones[r][c+1]) {
 *                   Clones[r][c] = false;
 *                   Clones[r+1][c] = Clones[r][c+1] = true;
 *                   Pairs.push([c, r]);              // the undo stack
 *                 }
 *
 * A split into an occupied square simply does not happen. The applet shows a
 * 10x10 window on the infinite board (N = max(10, M)) and the move above runs
 * off the end of its array at the far edge; here a split that would leave the
 * window is refused instead, and the page says why.
 *
 * Two spinners set up the puzzle, and this module keeps both:
 *
 *   D (1..10)  FillSquares() fills the triangle row + col < D at the start.
 *   M (1..5)   PrisonIsEmpty() checks a region that is NOT simply the triangle
 *              of side M -- the applet special-cases it:
 *                  let m = (M > 2) ? M - 1 : M;
 *                  M === 3 ? the full m x m square : the triangle row + col < m
 *              so the five prisons are 1 square, the 3-square L, the 2x2
 *              square, the 6-square triangle and the 10-square triangle. Those
 *              are exactly the five the cut-the-knot page discusses.
 *
 * The mathematics (the puzzle is attributed to Maxim Kontsevich; Tournament of
 * Towns and Kvant, 1981). Give square (row, col) the weight 2^-(row+col). A
 * split replaces 2^-(r+c) by two copies of 2^-(r+c+1), so
 *
 *   the total weight of the occupied squares never changes.
 *
 * The whole quarter plane weighs (1 + 1/2 + 1/4 + ...)^2 = 4. If the clones
 * ever leave the prison entirely they must all fit outside it, so the puzzle is
 * impossible whenever the starting weight is at least 4 minus the prison's
 * weight -- "at least" and not "more than", because finitely many clones can
 * never add up to the full weight of an infinite region.
 */
const ClonesCore = (() => {
  const N = 10; // the window on the board, as in the applet (N = max(10, M))
  const BOARD_WEIGHT = 4; // the whole infinite quarter plane

  const at = (r, c) => r * N + c;
  const weightAt = (r, c) => 2 ** -(r + c);

  /** The applet's PrisonIsEmpty() region, for M = 1..5. */
  function prisonCells(m) {
    const side = m > 2 ? m - 1 : m;
    const cells = [];
    for (let r = 0; r < side; r++) {
      const wide = m === 3 ? side : side - r;
      for (let c = 0; c < wide; c++) cells.push([r, c]);
    }
    return cells;
  }

  const sumWeight = (cells) => cells.reduce((w, [r, c]) => w + weightAt(r, c), 0);

  /** The five prisons the spinner offers, indexed by M. */
  const PRISONS = [1, 2, 3, 4, 5].map((m) => {
    const cells = prisonCells(m);
    return { m, cells, size: cells.length, weight: sumWeight(cells) };
  });
  const prison = (m) => PRISONS[m - 1];

  /** FillSquares(): the triangle row + col < d. */
  function startBoard(d) {
    const board = new Uint8Array(N * N);
    for (let r = 0; r < d; r++) for (let c = 0; c < d - r; c++) board[at(r, c)] = 1;
    return board;
  }

  const occupied = (board) => {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[at(r, c)]) out.push([r, c]);
    return out;
  };
  const occupiedWeight = (board) => sumWeight(occupied(board));

  /** Why a click fails: "" means the split is legal. */
  function splitProblem(board, r, c) {
    if (r < 0 || c < 0 || r >= N || c >= N) return "offboard";
    if (!board[at(r, c)]) return "empty";
    if (r + 1 >= N || c + 1 >= N) return "window";
    if (board[at(r + 1, c)] || board[at(r, c + 1)]) return "blocked";
    return "";
  }
  const canSplit = (board, r, c) => splitProblem(board, r, c) === "";

  /** The move. Returns a new board, or null when the split cannot happen. */
  function split(board, r, c) {
    if (!canSplit(board, r, c)) return null;
    const next = board.slice();
    next[at(r, c)] = 0;
    next[at(r + 1, c)] = 1;
    next[at(r, c + 1)] = 1;
    return next;
  }

  /** Pop(): puts a split back together. The caller supplies the split's square. */
  function unsplit(board, r, c) {
    const next = board.slice();
    next[at(r, c)] = 1;
    next[at(r + 1, c)] = 0;
    next[at(r, c + 1)] = 0;
    return next;
  }

  function legalSplits(board) {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (canSplit(board, r, c)) out.push([r, c]);
    return out;
  }

  const prisonEmpty = (board, m) => prison(m).cells.every(([r, c]) => !board[at(r, c)]);

  /**
   * The weight obstruction. True means the puzzle is provably impossible: the
   * clones carry more weight than the whole board outside the prison can hold.
   * False does not mean solvable -- the 6-square prison escapes this bound and
   * is still impossible, which is the harder half of the cut-the-knot page.
   */
  function provablyStuck(d, m) {
    return occupiedWeight(startBoard(d)) >= BOARD_WEIGHT - prison(m).weight;
  }

  /**
   * A shortest sequence of splits that empties the prison, or null if none was
   * found. Iterative-deepening search, so the answer is the true minimum; it
   * gives up and returns undefined once it has looked at maxNodes positions.
   * The page never calls this -- it is here for the Node test.
   */
  function solve(d, m, maxDepth = 20, maxNodes = 3e6) {
    const start = startBoard(d);
    if (prisonEmpty(start, m)) return [];
    let nodes = 0;
    let capped = false;
    const path = [];
    const seen = new Set();

    const dfs = (board, left) => {
      if (++nodes > maxNodes) { capped = true; return false; }
      if (prisonEmpty(board, m)) return true;
      if (left === 0) return false;
      const key = `${board.join("")}|${left}`;
      if (seen.has(key)) return false;
      seen.add(key);
      // Nearest the origin first: those are the clones that have to move.
      const moves = legalSplits(board).sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);
      for (const [r, c] of moves) {
        path.push([r, c]);
        if (dfs(split(board, r, c), left - 1)) return true;
        path.pop();
      }
      return false;
    };

    for (let limit = 1; limit <= maxDepth; limit++) {
      nodes = 0;
      capped = false;
      seen.clear();
      path.length = 0;
      if (dfs(start, limit)) return path.slice();
      if (capped) return undefined; // searched as far as the budget allowed
    }
    return null;
  }

  return {
    N, BOARD_WEIGHT, PRISONS,
    at, weightAt, prisonCells, prison, sumWeight,
    startBoard, occupied, occupiedWeight,
    splitProblem, canSplit, split, unsplit, legalSplits,
    prisonEmpty, provablyStuck, solve,
  };
})();
