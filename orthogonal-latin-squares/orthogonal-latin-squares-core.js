"use strict";

/*
 * Orthogonal Latin Squares, from Alexander Bogomolny's applet OrthoLatin.
 *
 * Each cell of an N by N board holds a pair of letters: a small one on the left
 * (from one square) and a capital on the right (from another). Each square is a
 * Latin square when every letter appears once in every row and once in every
 * column. Two Latin squares are orthogonal when, laid on top of each other, all
 * N x N pairs of letters are different. The task is to arrange the board so that
 * both squares are Latin and the two are orthogonal.
 *
 * The applet's controls: N from 2 to 20 (6 to begin with), "Randomize" (each row
 * of each square starts as a random shuffle of the letters, otherwise every row
 * is a, b, c, ...), "Apply to left / right" (which square a move changes), and
 * two kinds of moves: swap the letters of two cells in the same row, or rotate a
 * whole row or column by one place. Moves change one square at a time.
 *
 * Changed from the applet on purpose: its success test (CheckFinished) compares a
 * cell only with the cells strictly below and to the right of it, never the other
 * diagonal direction, so it can announce success for two squares that are not
 * orthogonal (for N = 4, 18,432 pairs of Latin squares pass it and only 6,912
 * are orthogonal). This port counts every pair of cells, as the definition does.
 *
 * Position (plain data): { n, left, right, apply } with left and right n by n
 * arrays of letter numbers 0..n-1 (row first) and apply "left" or "right".
 * One global, LatinCore, no DOM.
 */
const LatinCore = (() => {
  const MIN_N = 2, MAX_N = 20, DEFAULT_N = 4;   // the applet starts at 6; see the page's maths

  const clampN = (n) => { n = Math.round(Number(n)); return Number.isFinite(n) ? Math.max(MIN_N, Math.min(MAX_N, n)) : null; };
  const identity = (n) => Array.from({ length: n }, () => Array.from({ length: n }, (_, c) => c));

  /** The applet's PermuteRow: a Fisher-Yates shuffle of one row, driven by random(). */
  function shuffleRow(row, random) {
    for (let k = row.length; k > 1; k--) {
      const j = Math.floor(random() * k);
      const t = row[k - 1]; row[k - 1] = row[j]; row[j] = t;
    }
  }

  /** A new board; with `randomize` (the default) every row of both squares is shuffled. */
  function start(options) {
    const o = options || {};
    const random = o.random || Math.random;
    const n = clampN(o.n === undefined ? DEFAULT_N : o.n) ?? DEFAULT_N;
    const randomize = o.randomize === undefined ? true : !!o.randomize;
    const left = identity(n), right = identity(n);
    if (randomize) for (let r = 0; r < n; r++) { shuffleRow(left[r], random); shuffleRow(right[r], random); }
    return { n, left, right, apply: "left" };
  }

  const copy = (m) => m.map((r) => r.slice());
  const layer = (s) => (s.apply === "right" ? "right" : "left");

  /** Choose which square the moves change. */
  function setApply(state, which) {
    return which === "left" || which === "right" ? { ...state, apply: which } : null;
  }

  /** Swap the letters of two different cells in the same row (the applet allows only that); null otherwise. */
  function swap(state, r1, c1, r2, c2) {
    const ok = (v) => Number.isInteger(v) && v >= 0 && v < state.n;
    if (!ok(r1) || !ok(c1) || !ok(r2) || !ok(c2) || r1 !== r2 || c1 === c2) return null;
    const next = { ...state, left: copy(state.left), right: copy(state.right) };
    const m = next[layer(state)];
    const t = m[r1][c1]; m[r1][c1] = m[r2][c2]; m[r2][c2] = t;
    return next;
  }

  /** Rotate row r one place, "left" or "right". */
  function rotateRow(state, r, dir) {
    if (!Number.isInteger(r) || r < 0 || r >= state.n || (dir !== "left" && dir !== "right")) return null;
    const next = { ...state, left: copy(state.left), right: copy(state.right) };
    const row = next[layer(state)][r];
    if (dir === "left") row.push(row.shift()); else row.unshift(row.pop());
    return next;
  }

  /** Rotate column c one place, "up" or "down". */
  function rotateCol(state, c, dir) {
    if (!Number.isInteger(c) || c < 0 || c >= state.n || (dir !== "up" && dir !== "down")) return null;
    const next = { ...state, left: copy(state.left), right: copy(state.right) };
    const m = next[layer(state)];
    const col = m.map((row) => row[c]);
    if (dir === "up") col.push(col.shift()); else col.unshift(col.pop());
    m.forEach((row, r) => { row[c] = col[r]; });
    return next;
  }

  /** Whether a square has every letter exactly once in every row and in every column. */
  function isLatin(m) {
    const n = m.length;
    for (let i = 0; i < n; i++) {
      const rs = new Set(m[i]), cs = new Set(m.map((row) => row[i]));
      if (rs.size !== n || cs.size !== n) return false;
    }
    return true;
  }

  /** The pairs of cells that hold the same pair of letters: [[r1, c1], [r2, c2]]. */
  function repeatedPairs(state) {
    const seen = new Map(), out = [];
    for (let r = 0; r < state.n; r++) for (let c = 0; c < state.n; c++) {
      const key = state.left[r][c] * state.n + state.right[r][c];
      if (seen.has(key)) out.push([seen.get(key), [r, c]]); else seen.set(key, [r, c]);
    }
    return out;
  }

  /** What is right and wrong with the board. */
  function status(state) {
    const latinLeft = isLatin(state.left), latinRight = isLatin(state.right);
    const repeats = repeatedPairs(state).length;
    return { latinLeft, latinRight, repeats, orthogonal: repeats === 0, solved: latinLeft && latinRight && repeats === 0 };
  }

  const solved = (state) => status(state).solved;

  /* ---- a solution to show: orthogonal Latin squares for the orders that have an easy construction ---- */

  const GF_POLY = { 4: 0b111, 8: 0b1011, 16: 0b10011 };       // x^2+x+1, x^3+x+1, x^4+x+1
  function gfMul(a, b, n) {
    let p = 0;
    while (b) { if (b & 1) p ^= a; b >>= 1; a <<= 1; if (a & n) a ^= GF_POLY[n]; }
    return p;
  }

  /** A pair of orthogonal Latin squares of order n as [A, B], or null when this page has no construction (n = 2, 6, 10, 14, 18). */
  function solution(n) {
    n = clampN(n);
    if (n === null) return null;
    if (n % 2 === 1) {
      // A = i + j, B = i + 2j (mod n): Latin because 2 has an inverse, orthogonal because the matrix [[1,1],[1,2]] has determinant 1
      const A = [], B = [];
      for (let i = 0; i < n; i++) { A.push([]); B.push([]); for (let j = 0; j < n; j++) { A[i].push((i + j) % n); B[i].push((i + 2 * j) % n); } }
      return [A, B];
    }
    if (GF_POLY[n]) {
      // in the field with n elements: A = i + j, B = i + g j with g = 2 (a field element other than 0 and 1)
      const A = [], B = [];
      for (let i = 0; i < n; i++) { A.push([]); B.push([]); for (let j = 0; j < n; j++) { A[i].push(i ^ j); B[i].push(i ^ gfMul(2, j, n)); } }
      return [A, B];
    }
    if (n % 4 !== 0) return null;
    // n = 2^k * m with m odd: the product of a solution of order 2^k and one of order m
    let k = n, m = 1;
    while (k % 2 === 0) k /= 2;
    m = k; k = n / m;
    if (!GF_POLY[k] && k !== 2) return null;
    const P = solution(k), Q = solution(m);
    if (!P || !Q) return null;
    const A = [], B = [];
    for (let i1 = 0; i1 < k; i1++) for (let i2 = 0; i2 < m; i2++) {
      const ra = [], rb = [];
      for (let j1 = 0; j1 < k; j1++) for (let j2 = 0; j2 < m; j2++) { ra.push(P[0][i1][j1] * m + Q[0][i2][j2]); rb.push(P[1][i1][j1] * m + Q[1][i2][j2]); }
      A.push(ra); B.push(rb);
    }
    return [A, B];
  }

  /** The board showing the construction for this order, or null. */
  function solved_board(n) {
    const s = solution(n);
    return s ? { n: clampN(n), left: s[0], right: s[1], apply: "left" } : null;
  }

  return { MIN_N, MAX_N, DEFAULT_N, start, setApply, swap, rotateRow, rotateCol, isLatin, repeatedPairs, status, solved, solution, solved_board };
})();
