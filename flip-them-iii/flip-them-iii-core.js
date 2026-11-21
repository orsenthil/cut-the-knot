"use strict";

/*
 * Flipping items simultaneously, part III, from Alexander Bogomolny's applet FlipThemIII (after
 * Puzzle 41 of Levitin and Levitin, Algorithmic Puzzles: a circle of n lights, each switch toggles 3).
 *
 * N circles stand in a ring, all red. A click on a circle changes the colour of M successive circles,
 * starting with the one clicked, clockwise. What is the fewest clicks that turn every circle blue?
 * The page: with g = gcd(M, N), M1 = M/g and N1 = N/g, the puzzle can be solved exactly when M1 is odd,
 * and then N1 clicks are needed (clicking every g-th circle does it); when M divides N that is N/M clicks.
 * The order of clicks does not matter and no circle needs more than one click.
 *
 * Read off the bytecode: N from 5 to 24 (opening on 12) and M from 2 to 12 (opening on 3), with M kept
 * below N (changing one drags the other along); circle i at angle 2 pi i / N, clockwise from the right;
 * all circles start red and the puzzle is done when all N are blue. The position is plain data.
 */
const FlipThemIIICore = (() => {
  const MIN_N = 5, MAX_N = 24, MIN_M = 2, MAX_M = 12;
  const START_N = 12, START_M = 3;

  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const clampN = (v) => Math.max(MIN_N, Math.min(MAX_N, Math.trunc(v)));
  const clampM = (v) => Math.max(MIN_M, Math.min(MAX_M, Math.trunc(v)));

  /** A new game: N circles, windows of M (M at most N - 1), all red. */
  function start(options) {
    const o = options || {};
    const n = Number.isFinite(Number(o.n)) ? clampN(Number(o.n)) : START_N;
    let m = Number.isFinite(Number(o.m)) ? clampM(Number(o.m)) : START_M;
    if (m > n - 1) m = n - 1;
    return { n, m, blue: new Array(n).fill(false), clicks: new Array(n).fill(0), moves: 0, explored: false };
  }

  /** The circles a click on i changes: i, i + 1, ..., i + M - 1 (mod N). */
  const window = (s, i) => Array.from({ length: s.m }, (_, k) => (i + k) % s.n);

  /** True when every circle is blue. */
  const allBlue = (s) => s.blue.every(Boolean);

  /** The page's answer for N and M: { g, m1, n1, solvable, fewest } (fewest = N1 clicks when M1 is odd). */
  function answer(n, m) {
    const g = gcd(m, n), m1 = m / g, n1 = n / g;
    return { g, m1, n1, solvable: m1 % 2 === 1, fewest: m1 % 2 === 1 ? n1 : null };
  }

  /** The page's algorithm: click every g-th circle (0, g, 2g, ...), g = gcd(M, N); null when M1 is even. */
  function pageAlgorithm(n, m) {
    const a = answer(n, m);
    if (!a.solvable) return null;
    return Array.from({ length: n / a.g }, (_, i) => i * a.g);
  }

  /**
   * The fewest clicks found by solving over the two-element field: every solution is one particular solution plus
   * a combination of the kernel (sets of clicks that change nothing), and the smallest is found by trying all of those.
   * Returns { clicks, exact } (the circles to click, 0-based; exact is false when the kernel was too big to try
   * every combination, 2^16 at most, and the list is only some solution), or null when there is no way.
   */
  function fewest(n, m) {
    const rows = [];
    for (let j = 0; j < n; j++) {
      const row = new Array(n + 1).fill(0);
      for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) if ((i + k) % n === j) row[i] ^= 1;
      row[n] = 1; // every circle must change colour
      rows.push(row);
    }
    const pivotCol = []; let r = 0;
    for (let c = 0; c < n && r < n; c++) {
      let p = r; while (p < n && !rows[p][c]) p++;
      if (p === n) continue;
      [rows[r], rows[p]] = [rows[p], rows[r]];
      for (let q = 0; q < n; q++) if (q !== r && rows[q][c]) for (let t = c; t <= n; t++) rows[q][t] ^= rows[r][t];
      pivotCol.push(c); r++;
    }
    for (let q = r; q < n; q++) if (rows[q][n]) return null;
    const free = []; for (let c = 0; c < n; c++) if (!pivotCol.includes(c)) free.push(c);
    let best = null;
    const tries = free.length <= 16 ? 1 << free.length : 1; // a kernel bigger than 2^16 is not searched
    for (let mask = 0; mask < tries; mask++) {
      const x = new Array(n).fill(0);
      free.forEach((c, k) => { x[c] = (mask >> k) & 1; });
      pivotCol.forEach((c, q) => { let v = rows[q][n]; free.forEach((f, k) => { v ^= rows[q][f] & ((mask >> k) & 1); }); x[c] = v; });
      const clicks = x.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      if (best === null || clicks.length < best.length) best = clicks;
    }
    return { clicks: best, exact: free.length <= 16 };
  }

  /** Moves: {type:"click", i}, {type:"n", value}, {type:"m", value}, {type:"reset"}. */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "click") {
      if (!(m.i >= 0 && m.i < s.n)) return null;
      const blue = s.blue.slice(), clicks = s.clicks.slice();
      for (const j of window(s, m.i)) blue[j] = !blue[j];
      clicks[m.i]++;
      return { ...s, blue, clicks, moves: s.moves + 1, explored: true };
    }
    if (m.type === "n") { const v = Math.trunc(Number(m.value)); if (!(v >= MIN_N && v <= MAX_N)) return null; return start({ n: v, m: s.m }); }
    if (m.type === "m") {
      const v = Math.trunc(Number(m.value));
      if (!(v >= MIN_M && v <= MAX_M)) return null;
      const n = v > s.n - 1 ? v + 1 : s.n;
      if (n > MAX_N) return null;
      return start({ n, m: v });
    }
    if (m.type === "reset") return start({ n: s.n, m: s.m });
    return null;
  }

  const legalMoves = (s) => s.blue.map((_, i) => ({ type: "click", i }));
  const result = (s) => (allBlue(s) ? "win" : null);

  return { MIN_N, MAX_N, MIN_M, MAX_M, START_N, START_M, gcd, start, window, allBlue, answer, pageAlgorithm, fewest, move, legalMoves, result };
})();
