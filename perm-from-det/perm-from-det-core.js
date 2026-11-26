"use strict";

/*
 * Permanent from a Determinant: an original game for the VP vs VNP path.
 *
 * Can the permanent be computed by a determinant? For 2 x 2, yes: put a
 * minus sign on one entry and det [[a, -b], [c, d]] = ad + bc. Pólya
 * asked about larger sizes. For 3 x 3, no choice of signs works: every
 * entry appears in exactly two of the six products, so flipping it flips
 * two products, and the number of minus products stays odd. The best is
 * 5 of 6. (Szegő proved no signs work for any n >= 3.)
 *
 * A bigger determinant can do it. Grenet's construction: take every set of
 * columns as a vertex; from a set S of size k draw an edge to S + {j}
 * labelled with the entry in row k + 1, column j. Paths from the empty set
 * to the full set are exactly the n! rook products. Join the full set back
 * to the empty set, put a 1 on the diagonal at every other vertex, and the
 * determinant of the resulting (2^n - 1) x (2^n - 1) matrix of entries,
 * 0s and 1s is the permanent (up to a sign for even n, fixed by negating
 * a row). For n = 3 that is 7 x 7, and 7 is known to be the least
 * (Alper, Bogart and Velasco). How the least size grows with n is
 * Valiant's determinant-versus-permanent question.
 *
 * This file defines one global, PermFromDetCore. The position is plain data.
 */
const PermFromDetCore = (() => {
  const BEST = { 2: 2, 3: 5 };
  const LETTERS = "abcdefghi";

  function permutations(n) {
    const out = [];
    const go = (p, used, sign) => {
      if (p.length === n) { out.push({ p: p.slice(), sign }); return; }
      let inv = 0;
      for (let j = 0; j < n; j++) if (!used[j]) { used[j] = true; p.push(j); go(p, used, inv % 2 ? -sign : sign); p.pop(); used[j] = false; inv++; }
    };
    go([], new Array(n).fill(false), 1);
    return out;
  }

  function start(options = {}) {
    const n = options.n === 2 ? 2 : 3;
    const signs = Array.isArray(options.signs) && options.signs.length === n * n ? options.signs.map((v) => (v < 0 ? -1 : 1)) : new Array(n * n).fill(1);
    return { n, signs };
  }
  function toggle(s, k) {
    if (!Number.isInteger(k) || k < 0 || k >= s.n * s.n) return null;
    const signs = s.signs.slice();
    signs[k] = -signs[k];
    return { ...s, signs };
  }

  /** The products of the signed determinant: letters and the sign each gets. */
  function terms(s) {
    return permutations(s.n).map(({ p, sign }) => ({
      letters: p.map((j, i) => LETTERS[i * s.n + j]).join(""),
      sign: sign * p.reduce((acc, j, i) => acc * s.signs[i * s.n + j], 1),
    }));
  }
  const positives = (s) => terms(s).filter((t) => t.sign > 0).length;
  const result = (s) => (positives(s) === BEST[s.n] ? "win" : null);

  /* ------------------------------------------------ Grenet's matrix */
  /**
   * Entries: 0, 1 or [i, j] (the variable in row i, column j of the n x n
   * matrix), possibly with a minus sign as { neg: [i, j] }. Rows and columns
   * are the nonempty sets of columns, ordered by size, the full set last
   * standing in for the empty set too.
   */
  function grenet(n) {
    const sets = [];
    for (let k = 1; k <= n; k++) for (let mask = 1; mask < 1 << n; mask++) if (popcount(mask) === k) sets.push(mask);
    const full = (1 << n) - 1, idx = new Map(sets.map((m, i) => [m, i])), N = sets.length;
    const node = (mask) => (mask === 0 ? idx.get(full) : idx.get(mask));
    const M = Array.from({ length: N }, () => new Array(N).fill(0));
    sets.forEach((m, i) => { if (m !== full) M[i][i] = 1; });
    for (const S of [0, ...sets]) {
      if (S === full) continue;
      const k = popcount(S);
      for (let j = 0; j < n; j++) if (!((S >> j) & 1)) M[node(S)][node(S | (1 << j))] = [k, j];
    }
    if (n % 2 === 0) M[node(full)] = M[node(full)].map((v) => (v === 0 ? 0 : v === 1 ? -1 : { neg: v }));
    return { size: N, sets, M };
  }
  function popcount(m) { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; }

  /** Fill in numbers x (n x n) to get a numeric matrix. */
  function fill(G, x) {
    return G.M.map((row) => row.map((v) => (typeof v === "number" ? v : v.neg ? -x[v.neg[0]][v.neg[1]] : x[v[0]][v[1]])));
  }

  /** Determinant by exact fraction-free elimination (Bareiss), for whole numbers. */
  function det(m) {
    const n = m.length, a = m.map((r) => r.map((v) => BigInt(v)));
    let sign = 1n, prev = 1n;
    for (let k = 0; k < n - 1; k++) {
      if (a[k][k] === 0n) {
        let p = k + 1; while (p < n && a[p][k] === 0n) p++;
        if (p === n) return 0n;
        [a[p], a[k]] = [a[k], a[p]]; sign = -sign;
      }
      for (let i = k + 1; i < n; i++) for (let j = k + 1; j < n; j++) a[i][j] = (a[i][j] * a[k][k] - a[i][k] * a[k][j]) / prev;
      prev = a[k][k];
    }
    return sign * a[n - 1][n - 1];
  }
  function perm(x) {
    return permutations(x.length).reduce((s, { p }) => s + BigInt(p.reduce((acc, j, i) => acc * x[i][j], 1)), 0n);
  }

  /** Text for an entry of Grenet's matrix. */
  const label = (v, n) => (v === 0 ? "" : typeof v === "number" ? String(v) : v.neg ? `−${LETTERS[v.neg[0] * n + v.neg[1]]}` : LETTERS[v[0] * n + v[1]]);

  return { BEST, LETTERS, permutations, start, toggle, terms, positives, result, grenet, fill, det, perm, label, popcount };
})();
