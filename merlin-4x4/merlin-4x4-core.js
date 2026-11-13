"use strict";

/*
 * Mini Lights Out / Merlin 4×4 (Bogomolny's Merlin4x4 applet).
 *
 * A 4×4 board on a torus: pressing a cell toggles it and its four orthogonal
 * neighbours (wrap-around). Lights are bits (m_N = 2). The goal is all off.
 *
 * Over GF(2) the move matrix A has A² = I, so every position v has a unique
 * solution s = A v — press exactly the cells whose five-neighbourhood has odd
 * parity in v (Missigman–Weida). The applet's Hint checkbox displays that
 * vector (SaveValues writes neighbourhood sums mod 2 onto the board).
 *
 * porting/check-merlin-4x4.mjs checks A² = I, the unique solve, neighbourhood
 * intersections of size 0 or 2, and that the parity strategy clears every board.
 */

var Merlin4x4Core = (function () {
  const N = 4;
  const MOD = 2;

  function empty() {
    return Array.from({ length: N }, () => Array(N).fill(0));
  }

  function copy(board) {
    return board.map((row) => row.slice());
  }

  function wrap(i) {
    return ((i % N) + N) % N;
  }

  /** Cells toggled by pressing (r, c): self + N/S/E/W on the torus. */
  function neighborhood(r, c) {
    return [
      [r, c],
      [wrap(r + 1), c],
      [wrap(r - 1), c],
      [r, wrap(c + 1)],
      [r, wrap(c - 1)],
    ];
  }

  function toggleCell(board, r, c) {
    board[r][c] = (board[r][c] + 1) % MOD;
  }

  /** MakeMove(r, c, forward=true): flip the plus-shaped neighbourhood. */
  function press(board, r, c) {
    for (const [rr, cc] of neighborhood(r, c)) toggleCell(board, rr, cc);
    return board;
  }

  /** Undo is the same press when MOD = 2. */
  function undoPress(board, r, c) {
    return press(board, r, c);
  }

  function isSolved(board) {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) if (board[r][c]) return false;
    }
    return true;
  }

  /**
   * Applet SaveValues / Hint: for each cell, sum of its neighbourhood mod 2.
   * That vector is the unique solving strategy A v.
   */
  function hint(board) {
    const out = empty();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        let s = 0;
        for (const [rr, cc] of neighborhood(r, c)) s += board[rr][cc];
        out[r][c] = s % 2;
      }
    }
    return out;
  }

  /** Count of lit cells in a button's neighbourhood (the page's "count"). */
  function count(board, r, c) {
    let n = 0;
    for (const [rr, cc] of neighborhood(r, c)) n += board[rr][cc];
    return n;
  }

  function randomBoard(rand) {
    const R = rand || Math.random;
    const board = empty();
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) board[r][c] = Math.floor(R() * MOD);
    }
    return board;
  }

  /** Apply strategy (0/1 board of presses) to a board. */
  function applyStrategy(board, strategy) {
    const b = copy(board);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) if (strategy[r][c]) press(b, r, c);
    }
    return b;
  }

  /** Column-major? Applet indexes [row][col] with MakeMove(i,j) as row i, col j. */
  function matA() {
    // 16×16 over GF(2): columns are presses, rows are cells. Index r*N+c.
    const A = Array.from({ length: N * N }, () => Array(N * N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const col = r * N + c;
        for (const [rr, cc] of neighborhood(r, c)) {
          A[rr * N + cc][col] = 1;
        }
      }
    }
    return A;
  }

  function mulMod2(M, v) {
    const n = M.length;
    const out = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += M[i][j] * v[j];
      out[i] = s % 2;
    }
    return out;
  }

  function matMulMod2(A, B) {
    const n = A.length;
    const C = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += A[i][k] * B[k][j];
        C[i][j] = s % 2;
      }
    }
    return C;
  }

  function boardToVec(board) {
    const v = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) v.push(board[r][c]);
    return v;
  }

  function vecToBoard(v) {
    const b = empty();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) b[r][c] = v[r * N + c];
    return b;
  }

  return {
    N, MOD,
    empty, copy, wrap, neighborhood, press, undoPress,
    isSolved, hint, count, randomBoard, applyStrategy,
    matA, mulMod2, matMulMod2, boardToVec, vecToBoard,
  };
})();
