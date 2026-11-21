"use strict";

/*
 * Flipping items simultaneously, part II, from Alexander Bogomolny's applet FlipThemII
 * (a puzzle from Mathematical Circles, Fomin, Genkin and Itenberg).
 *
 * N circles stand in a ring. All are red but one, which is blue. A click on a circle changes the colour
 * of M successive circles, starting with it, going clockwise. Can you reach the state in which all
 * circles are red except the one the small arrow points to, which must be blue? For N = 12 and M = 3,
 * 4 or 6 it cannot be done. If M divides N the reason is an invariant: mark the circles whose number (from
 * 1) leaves the remainder M - 1 or 0 on division by M; every M successive circles hold exactly two marked
 * ones, so every click changes the colour of exactly two marked circles and the number of blue marked
 * circles stays odd (the product of the marks, red = 1 and blue = -1, stays -1); the starting blue circle is
 * marked and the target is not.
 *
 * Read off the bytecode: N from 5 to 24 (opening on 12) and M from 2 to 12 (opening on 3), with M kept
 * below N (changing one drags the other along); circle i is at angle 2 pi i / N, clockwise from the right;
 * the starting blue circle is the last one, N - 1, and the arrow points at circle 0; the "Solution helper"
 * box can be ticked only when M divides N and marks circles i with (i + 1) mod M equal to 0 or M - 1. This port
 * adds what the page asks for ("what can be said about other pairs?"): which pairs can be solved, found by
 * solving the equations over the two-element field, and a way to solve the solvable ones.
 * The position is plain data.
 */
const FlipThemIICore = (() => {
  const MIN_N = 5, MAX_N = 24, MIN_M = 2, MAX_M = 12;
  const START_N = 12, START_M = 3;

  const clampN = (v) => Math.max(MIN_N, Math.min(MAX_N, Math.trunc(v)));
  const clampM = (v) => Math.max(MIN_M, Math.min(MAX_M, Math.trunc(v)));

  /** A new game: N circles, windows of M (M is kept at most N - 1), the last circle blue. */
  function start(options) {
    const o = options || {};
    let n = Number.isFinite(Number(o.n)) ? clampN(Number(o.n)) : START_N;
    let m = Number.isFinite(Number(o.m)) ? clampM(Number(o.m)) : START_M;
    if (m > n - 1) m = n - 1;
    const blue = new Array(n).fill(false); blue[n - 1] = true;
    return { n, m, blue, helper: false, moves: 0, explored: false };
  }

  /** The circles a click on i changes: i, i + 1, ..., i + M - 1 (mod N). */
  const window = (s, i) => Array.from({ length: s.m }, (_, k) => (i + k) % s.n);

  /** Whether M divides N (the page's case, where the helper is offered). */
  const divides = (s) => s.n % s.m === 0;

  /** The marked circles of the Solution helper (ShowHelper): (i + 1) mod M is 0 or M - 1. */
  const marked = (s) => Array.from({ length: s.n }, (_, i) => (i + 1) % s.m === 0 || (i + 1) % s.m === s.m - 1);

  /** True when all circles are red except circle 0 (the one the arrow points at). */
  const reached = (s) => s.blue.every((b, i) => b === (i === 0));

  /** Moves: {type:"click", i}, {type:"n", value}, {type:"m", value}, {type:"helper", value}, {type:"reset"}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "click") {
      if (!(m.i >= 0 && m.i < s.n)) return null;
      const blue = s.blue.slice();
      for (const j of window(s, m.i)) blue[j] = !blue[j];
      return { ...s, blue, moves: s.moves + 1, explored: true };
    }
    if (m.type === "n") {
      const v = Math.trunc(Number(m.value));
      if (!(v >= MIN_N && v <= MAX_N)) return null;
      return { ...start({ n: v, m: s.m }), helper: false };
    }
    if (m.type === "m") {
      const v = Math.trunc(Number(m.value));
      if (!(v >= MIN_M && v <= MAX_M)) return null;
      // M can be at most N - 1: a bigger M asks for a bigger N, as the applet's spinners do
      const n = v > s.n - 1 ? v + 1 : s.n;
      if (n > MAX_N) return null;
      return { ...start({ n, m: v }), helper: false };
    }
    if (m.type === "helper") { if (m.value && !divides(s)) return null; return { ...s, helper: !!m.value }; }
    if (m.type === "reset") return { ...start({ n: s.n, m: s.m }), helper: s.helper };
    return null;
  }

  const legalMoves = (s) => s.blue.map((_, i) => ({ type: "click", i }));
  const result = (s) => (reached(s) ? "win" : null);

  /**
   * Solve the puzzle over the two-element field: unknowns x_i (click on circle i, an even number of times or an odd number)
   * with sum x_i * window(i) = e_0 + e_(N-1) (the circles that have to change colour). Returns the list of circles to
   * click once each, or null when the target cannot be reached.
   */
  function solve(n, m) {
    const rows = []; // one equation per circle j: sum over the windows that contain j
    for (let j = 0; j < n; j++) {
      const row = new Array(n + 1).fill(0);
      for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) if ((i + k) % n === j) row[i] ^= 1;
      row[n] = j === 0 || j === n - 1 ? 1 : 0;
      rows.push(row);
    }
    const pivotCol = [];
    let r = 0;
    for (let c = 0; c < n && r < n; c++) {
      let p = r; while (p < n && !rows[p][c]) p++;
      if (p === n) continue;
      [rows[r], rows[p]] = [rows[p], rows[r]];
      for (let q = 0; q < n; q++) if (q !== r && rows[q][c]) for (let t = c; t <= n; t++) rows[q][t] ^= rows[r][t];
      pivotCol.push(c); r++;
    }
    for (let q = r; q < n; q++) if (rows[q][n]) return null; // 0 = 1: no solution
    const x = new Array(n).fill(0);
    pivotCol.forEach((c, q) => { x[c] = rows[q][n]; });
    return x.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  }

  /** The page's fact, extended: the target can be reached exactly when gcd(M, N) = 1, or gcd(M, N) = 2 and M = 2 (mod 4). */
  function rule(n, m) {
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const g = gcd(n, m);
    return g === 1 || (g === 2 && m % 4 === 2);
  }

  return { MIN_N, MAX_N, MIN_M, MAX_M, START_N, START_M, start, window, divides, marked, reached, move, legalMoves, result, solve, rule };
})();
