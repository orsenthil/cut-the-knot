"use strict";

/*
 * Solitaire on a Circle -- pure logic, no DOM. Ported from Alexander
 * Bogomolny's CSolitaire applet
 * (cut-the-knot.org/SimpleGames/CSolitaire.shtml). classes.zip holds only
 * CSolitaire.class, CSolitaireCanvas.class and CSolitairePanel.class with no
 * source, so the rules below were read straight off
 * `javap -c -p CSolitaireCanvas.class`:
 *
 *   MakeMove(i):  m_Counters[i] = 0            // s_Empty
 *                 Flip((i + 1) % N)
 *                 Flip((i - 1 + N) % N)
 *   Flip(j):      1 <-> 2, and 0 stays 0       // red <-> green, empty is inert
 *
 * Two details of that bytecode matter, and both are easy to get wrong:
 *
 *  - the neighbours flipped are the fixed positions i+1 and i-1 around the
 *    circle, *not* the nearest counters still on the board, and flipping an
 *    already-empty position does nothing. So every counter removed leaves a
 *    permanent gap, and the counters still standing fall into arcs that no
 *    later move can connect.
 *  - only a green counter can be clicked. CheckFinished() scans for a green to
 *    decide whether the game is still alive: none left and the board not clear
 *    is the dead end.
 *
 * Reset() colours each position by a coin flip (`1 + (int)(Math.random() * 2)`),
 * so a fresh board is often unsolvable. That is the puzzle, not a bug: the
 * question is whether you can tell before you start.
 *
 * The theorem (two proofs in the American Mathematical Monthly 104:9,
 * November 1997, p 876; the cut-the-knot page gives the shorter one):
 *
 *   a full circle clears   <=>   its number of greens is even and not zero
 *   an arc with a gap at each end clears   <=>   its number of greens is odd
 *
 * `solvable` is exactly those two lines. `solve` is the proof's induction run
 * forwards: in an arc with an odd number of greens the leftmost green has an
 * even number of greens on each side of it, so removing it and flipping the
 * neighbour on each non-empty side leaves two shorter arcs that are both odd
 * again.
 */
const SolitaireCore = (() => {
  const EMPTY = 0;
  const RED = 1;
  const GREEN = 2;

  const N_MIN = 3; // CSolitairePanel: m_Lower
  const N_MAX = 40; // CSolitairePanel: m_Upper
  const N_DEFAULT = 10; // CSolitaireCanvas: m_N

  /** Flip(j) from the applet: red and green swap, an empty position is inert. */
  function flip(board, j) {
    if (board[j] === RED) board[j] = GREEN;
    else if (board[j] === GREEN) board[j] = RED;
  }

  /** MakeMove(i), in place. The caller must have checked board[i] is green. */
  function applyMove(board, i) {
    const n = board.length;
    board[i] = EMPTY;
    flip(board, (i + 1) % n);
    flip(board, (i - 1 + n) % n);
  }

  /** MakeMove(i) as a new board, or null when position i is not green. */
  function move(board, i) {
    if (board[i] !== GREEN) return null;
    const next = board.slice();
    applyMove(next, i);
    return next;
  }

  /** Reset(false): every position red or green, by a coin flip. */
  function randomBoard(n, rand = Math.random) {
    const board = new Array(n);
    for (let i = 0; i < n; i++) board[i] = 1 + Math.floor(rand() * 2);
    return board;
  }

  const greens = (board) => board.reduce((k, c) => k + (c === GREEN ? 1 : 0), 0);
  const remaining = (board) => board.reduce((k, c) => k + (c === EMPTY ? 0 : 1), 0);
  const legalMoves = (board) => board.flatMap((c, i) => (c === GREEN ? [i] : []));

  const isCleared = (board) => board.every((c) => c === EMPTY);
  const isFullCircle = (board) => board.every((c) => c !== EMPTY);
  const isDeadEnd = (board) => !isCleared(board) && greens(board) === 0;

  /**
   * The maximal runs of counters still on the board, each as a list of
   * positions in order around the circle. A run is bounded by a gap at both
   * ends, so moves inside one can never touch another. Meaningless for a board
   * with no gaps at all, which is one closed circle -- check isFullCircle first.
   */
  function arcs(board) {
    const n = board.length;
    const start = board.indexOf(EMPTY);
    if (start < 0) return [[...board.keys()]];
    const out = [];
    let run = [];
    for (let k = 1; k <= n; k++) {
      const i = (start + k) % n;
      if (board[i] === EMPTY) {
        if (run.length) out.push(run);
        run = [];
      } else {
        run.push(i);
      }
    }
    if (run.length) out.push(run);
    return out;
  }

  /** The theorem: can this position be cleared completely? */
  function solvable(board) {
    if (isCleared(board)) return true;
    if (isFullCircle(board)) {
      const g = greens(board);
      return g > 0 && g % 2 === 0;
    }
    return arcs(board).every((arc) => arc.filter((i) => board[i] === GREEN).length % 2 === 1);
  }

  /**
   * A full sequence of clicks that clears the board, or null when there is
   * none. Each entry is a position to click, in order.
   */
  function solve(board) {
    if (!solvable(board)) return null;
    const state = board.slice();
    const moves = [];

    // One move turns the closed circle into a single arc, and the parity
    // argument says that arc is odd whichever green is taken first.
    if (!isCleared(state) && isFullCircle(state)) {
      const first = state.indexOf(GREEN);
      moves.push(first);
      applyMove(state, first);
    }

    // Remove the leftmost green, then recurse on the two shorter arcs it
    // leaves behind. Flipping over the ends is handled by applyMove itself:
    // outside the arc the neighbour is empty, so the flip does nothing.
    const clearArc = (arc) => {
      if (!arc.length) return;
      const k = arc.findIndex((i) => state[i] === GREEN);
      if (k < 0) throw new Error("arc with no green: solvable() and solve() disagree");
      moves.push(arc[k]);
      applyMove(state, arc[k]);
      clearArc(arc.slice(0, k));
      clearArc(arc.slice(k + 1));
    };
    for (const arc of arcs(state)) clearArc(arc);

    return moves;
  }

  return {
    EMPTY, RED, GREEN,
    N_MIN, N_MAX, N_DEFAULT,
    randomBoard, move, legalMoves,
    greens, remaining, arcs,
    isCleared, isFullCircle, isDeadEnd,
    solvable, solve,
  };
})();
