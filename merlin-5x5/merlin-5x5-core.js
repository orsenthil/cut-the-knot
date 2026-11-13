"use strict";

/*
 * Lights Out / Merlin 5×5 (Bogomolny's Merlin5x5 applet).
 *
 * Classic 5×5 Lights Out (no torus): pressing a cell toggles it and its
 * orthogonal neighbours. The Neighbor table is taken from the bytecode
 * (self + N/S/E/W within the board). Not every board is solvable; when one
 * is, there are four solutions (nullspace dimension 2).
 *
 * Hint follows the applet's SaveValues: chase lights down (ThreadDown /
 * "gathering"), map the bottom row to first-row presses via
 * GetTopFromBottom, and show those. The full strategy is first-row presses
 * plus the gathering presses above each lit cell, repeated.
 *
 * Solvable iff chasing, pressing GetTopFromBottom, and chasing again clears
 * the board. The page's parity sets {1,3,5} and {2,3,4} (1-based columns of
 * the bottom row after the first gathering) are checked in
 * porting/check-merlin-5x5.mjs.
 */

var Merlin5x5Core = (function () {
  const N = 5;
  const MOD = 2;

  // From Merlin5x5Canvas."<init>": Neighbor[id] = cells toggled by pressing id.
  const NEIGHBOR = [
    [0, 1, 5],
    [1, 0, 2, 6],
    [2, 1, 3, 7],
    [3, 2, 4, 8],
    [4, 3, 9],
    [5, 0, 6, 10],
    [6, 1, 5, 7, 11],
    [7, 2, 6, 8, 12],
    [8, 3, 7, 9, 13],
    [9, 4, 8, 14],
    [10, 5, 11, 15],
    [11, 6, 10, 12, 16],
    [12, 7, 11, 13, 17],
    [13, 8, 12, 14, 18],
    [14, 9, 13, 19],
    [15, 10, 16, 20],
    [16, 11, 15, 17, 21],
    [17, 12, 16, 18, 22],
    [18, 13, 17, 19, 23],
    [19, 14, 18, 24],
    [20, 15, 21],
    [21, 16, 20, 22],
    [22, 17, 21, 23],
    [23, 18, 22, 24],
    [24, 19, 23],
  ];

  function empty() {
    return Array.from({ length: N }, () => Array(N).fill(0));
  }

  function copy(board) {
    return board.map((row) => row.slice());
  }

  function idOf(r, c) {
    return r * N + c;
  }

  function rcOf(id) {
    return [(id / N) | 0, id % N];
  }

  function neighborhood(r, c) {
    return NEIGHBOR[idOf(r, c)].map(rcOf);
  }

  function toggleId(board, id) {
    const [r, c] = rcOf(id);
    board[r][c] = (board[r][c] + 1) % MOD;
  }

  /** MakeMove(r, c): flip Neighbor[r*N+c]. */
  function press(board, r, c) {
    for (const id of NEIGHBOR[idOf(r, c)]) toggleId(board, id);
    return board;
  }

  /** Setup mode: flip a single cell, no neighbours. */
  function toggleOne(board, r, c) {
    board[r][c] = 1 - board[r][c];
    return board;
  }

  function isSolved(board) {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) if (board[r][c]) return false;
    }
    return true;
  }

  /**
   * ThreadDown / gathering: for each row 1..4, press cells under a lit cell
   * in the row above. Leaves at most the bottom row lit (in solvable cases,
   * a 1×5 syndrome).
   */
  function threadDown(board) {
    for (let r = 1; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (board[r - 1][c] === 1) press(board, r, c);
      }
    }
  }

  /**
   * GetTopFromBottom after gathering. Applet only reads bottom[0..2] and
   * writes top[0..2]; top[3] and top[4] stay 0 ("never press the last two").
   */
  function getTopFromBottom(board) {
    const bottom = board[N - 1];
    const top = Array(N).fill(0);
    if (bottom[0] === 1) {
      top[0]++;
      top[1]++;
    }
    if (bottom[1] === 1) {
      top[0]++;
      top[1]++;
      top[2]++;
    }
    if (bottom[2] === 1) {
      top[1]++;
      top[2]++;
    }
    for (let i = 0; i < 3; i++) top[i] %= 2;
    return top;
  }

  /**
   * Applet Hint display (SaveValues): first-row presses only, after gathering.
   * Always returns a 5-cell top row; may not clear an unsolvable board.
   */
  function hintTop(board) {
    const b = copy(board);
    threadDown(b);
    const top = getTopFromBottom(b);
    const marks = empty();
    for (let c = 0; c < N; c++) marks[0][c] = top[c];
    return marks;
  }

  /**
   * Full set of cells to press for the chase-lights solution (or null).
   * Preferred for the page Hint overlay; equals one of the four solutions.
   */
  function hint(board) {
    return solve(board);
  }

  /**
   * Full pressing strategy (one of the four): top presses + both gatherings.
   * Returns null if unsolvable.
   */
  function solve(board) {
    const strategy = empty();
    const b = copy(board);

    function gatherIntoStrategy() {
      for (let r = 1; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (b[r - 1][c] === 1) {
            press(b, r, c);
            strategy[r][c] ^= 1;
          }
        }
      }
    }

    gatherIntoStrategy();
    const top = getTopFromBottom(b);
    for (let c = 0; c < N; c++) {
      if (top[c]) {
        press(b, 0, c);
        strategy[0][c] ^= 1;
      }
    }
    gatherIntoStrategy();
    if (!isSolved(b)) return null;
    return strategy;
  }

  function isSolvable(board) {
    return solve(board) != null;
  }

  /**
   * Page claim: after first gathering, even lit count on columns {1,3,5} and
   * on {2,3,4} (1-based) of the bottom row. Equivalent solvability test.
   */
  function bottomParityOk(board) {
    const b = copy(board);
    threadDown(b);
    const row = b[N - 1];
    const s135 = (row[0] + row[2] + row[4]) % 2;
    const s234 = (row[1] + row[2] + row[3]) % 2;
    return s135 === 0 && s234 === 0;
  }

  function applyStrategy(board, strategy) {
    const b = copy(board);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) if (strategy[r][c]) press(b, r, c);
    }
    return b;
  }

  function randomBoard(rand) {
    const R = rand || Math.random;
    const board = empty();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) board[r][c] = Math.floor(R() * MOD);
    }
    return board;
  }

  /** Build A (25×25) over GF(2): column j = press pattern of cell j. */
  function matA() {
    const A = Array.from({ length: N * N }, () => Array(N * N).fill(0));
    for (let j = 0; j < N * N; j++) {
      for (const id of NEIGHBOR[j]) A[id][j] = 1;
    }
    return A;
  }

  return {
    N, MOD, NEIGHBOR,
    empty, copy, idOf, rcOf, neighborhood,
    press, toggleOne, isSolved,
    threadDown, getTopFromBottom, hintTop, hint, solve, isSolvable,
    bottomParityOk, applyStrategy, randomBoard, matA,
  };
})();
