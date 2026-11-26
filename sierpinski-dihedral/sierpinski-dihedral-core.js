"use strict";

/*
 * Sierpinski's Gasket and Dihedral Symmetry, from Alexander Bogomolny's
 * applet SierpinskiGasket.
 *
 * A square grid starts with 1 in the top-left cell and 0 elsewhere. At each
 * step every cell, all at once, becomes
 *   Add, 2 prongs:      S(i,j) + S(i-1,j) + S(i,j-1)
 *   Replace, 2 prongs:  S(i-1,j) + S(i,j-1)   (the corner stays 1)
 *   Add, 3 prongs:      S(i,j) + S(i-1,j-1) + S(i-1,j) + S(i,j-1)
 *   Replace, 3 prongs:  S(i-1,j-1) + S(i-1,j) + S(i,j-1)
 * and the numbers are taken modulo M; cells that are not 0 are coloured.
 *
 * The idea behind the surprise on the page (the Add picture has the
 * symmetries of a triangle at every step although the rule looks lopsided):
 * after N steps, Add with 2 prongs holds C(N-m, n) C(N, m) in cell (n, m),
 * which is the multinomial N!/(n! m! (N-n-m)!) and so does not care which
 * of n, m and N-n-m is which. Add with 3 prongs holds C(N, n) C(N, m),
 * symmetric under n <-> m and n -> N-n, m -> N-m, the symmetries of a
 * square. Replace with 2 prongs grows Pascal's triangle C(n+m, n).
 *
 * Transcribed from SierpinskiGasketCanvas.PerformStep, which pushes each
 * cell's value to its neighbours below and to the right in a fresh grid
 * (Replace first puts 1 in the corner of it) and then reduces everything
 * modulo M. N is 2..128 (32), M is 2..32 (2); PerformSteps(k) does at most
 * N - 1 - (steps so far) steps, so "To corner" (1000) stops at step N - 1.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SierpinskiDihedralCore. The position is plain data.
 */
const SierpinskiDihedralCore = (() => {
  const N_RANGE = { min: 2, max: 128, def: 32 };
  const M_RANGE = { min: 2, max: 32, def: 2 };
  const MAX_NUMBERS_N = 32; // Show numbers only on grids up to 32
  const STEP_CHOICES = [["To corner", 1000], ["2", 2], ["3", 3], ["4", 4], ["8", 8], ["16", 16], ["32", 32]];

  const clamp = (v, r) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(r.min, Math.min(r.max, n)) : r.def; };
  const grid = (n) => Array.from({ length: n }, () => new Array(n).fill(0));

  /** reset(): 1 in the corner, nothing else, no steps. */
  function start(options = {}) {
    const n = clamp(options.n ?? N_RANGE.def, N_RANGE);
    const m = clamp(options.m ?? M_RANGE.def, M_RANGE);
    const S = grid(n);
    S[0][0] = 1;
    return { n, m, add: options.add !== false, prongs: options.prongs === 3 ? 3 : 2, steps: 0, S };
  }

  /** PerformStep, pushing as the applet does. */
  function step(s) {
    const { n, m, add } = s;
    const two = s.prongs === 2;
    const L1 = grid(n);
    if (!add) L1[0][0] = 1;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v = s.S[i][j];
        if (add) L1[i][j] += v;
        if (i + 1 < n) {
          L1[i + 1][j] += v;
          if (!two && j + 1 < n) L1[i + 1][j + 1] += v;
        }
        if (j + 1 < n) L1[i][j + 1] += v;
      }
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) L1[i][j] %= m;
    return { ...s, S: L1, steps: s.steps + 1 };
  }

  /** PerformSteps(k): at most N - 1 - steps of them. */
  function steps(s, k) {
    const count = Math.min(k, s.n - s.steps - 1);
    let t = s;
    for (let i = 0; i < count; i++) t = step(t);
    return t;
  }

  /** The panel's switches: the algorithm, the prongs and M start again. */
  const setAdd = (s, add) => start({ n: s.n, m: s.m, prongs: s.prongs, add: !!add });
  const setProngs = (s, p) => start({ n: s.n, m: s.m, prongs: p === 3 ? 3 : 2, add: s.add });
  const setM = (s, m) => start({ n: s.n, m, prongs: s.prongs, add: s.add });

  /**
   * Reset() after a new N: the numbers stay where they are. A bigger grid is
   * padded with zeros; a smaller one keeps the old grid and shows its corner.
   */
  function setN(s, n) {
    const N = clamp(n, N_RANGE);
    let S = s.S;
    if (S.length < N) {
      const T = grid(N);
      for (let i = 0; i < S.length; i++) for (let j = 0; j < S.length; j++) T[i][j] = S[i][j];
      S = T;
    }
    return { ...s, n: N, S };
  }

  /** The value in cell (row i, column j) as the picture shows it. */
  const at = (s, i, j) => s.S[i][j];

  /** How many cells (of the N x N shown) are not 0. */
  function lit(s) {
    let c = 0;
    for (let i = 0; i < s.n; i++) for (let j = 0; j < s.n; j++) if (s.S[i][j]) c++;
    return c;
  }

  return { N_RANGE, M_RANGE, MAX_NUMBERS_N, STEP_CHOICES, start, step, steps, setAdd, setProngs, setM, setN, at, lit };
})();
