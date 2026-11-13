"use strict";

/*
 * Marriage Problem (Bogomolny's Marriage applet) - McWorter's constructive
 * proof of Hall's marriage theorem, as a stepable algorithm on a 0-1 matrix.
 *
 * Columns are girls' preference sets, rows are boys. A 1 means that boy is
 * on that girl's list. An SDR (system of distinct representatives) is a
 * transversal of 1s: after row/column swaps, the main diagonal is all 1s.
 *
 * The algorithm is MarriageCanvas.MakeStep / MarryAnother / MakeItZeros /
 * CollectE / Reindex, transcribed from the bytecode. States:
 *
 *   0 Greedy     - pull a 1 from block B onto the growing diagonal
 *   1 Zeros      - try a column swap from C matching D; else assemble E
 *   2 Relabel    - Reindex: F matching G, or shrink the active submatrix
 *   3 Assemble   - CollectE: bubble nonzero C-columns rightward
 *   4 Failed     - Hall's condition is violated
 *   5 Finished   - full diagonal of 1s (an SDR)
 *
 * The page's claim that the |i-j|=1 matrix works iff n is even, and the
 * claim that the algorithm decides exactly when an SDR exists, are checked
 * exhaustively in porting/check-marriage.mjs.
 */

var MarriageCore = (function () {
  const MIN_N = 3;
  const MAX_N = 10;
  const DEFAULT_N = 5;

  const GREEDY = 0;
  const ZEROS = 1;
  const RELABEL = 2;
  const ASSEMBLE = 3;
  const FAILED = 4;
  const FINISHED = 5;

  const STATE_NAMES = [
    "Greedy, marry them",
    "Only-zeros, happy divorces",
    "Relabel, forced separations",
    "Assemble 1s, grouping singles",
    "Failed, the life's hard",
    "Finished, all are happy",
  ];

  const ROW_LABELS = "abcdefghij";
  const COL_LABELS = "ABCDEFGHIJ";

  function emptyMatrix(n) {
    return Array.from({ length: n }, () => Array(n).fill(0));
  }

  function start(n, matrix, rng) {
    const size = Math.max(MIN_N, Math.min(MAX_N, n | 0));
    const values = matrix ? matrix.map((r) => r.slice()) : randomMatrix(size, rng || Math.random);
    const s = {
      n: size,
      values,
      rLabels: ROW_LABELS.slice(0, size).split(""),
      cLabels: COL_LABELS.slice(0, size).split(""),
      RI: [],
      CI: [],
      NB: 0,
      NE: 0,
      nx: size,
      ny: size,
      min: size,
      state: GREEDY,
      colLeft: -1,
      colRight: -1,
      announce: "",
      log: [],
      stack: [],
    };
    resetIndices(s);
    checkFinished(s);
    return s;
  }

  /** The applet's Reset fill: about half the cells randomly set to 1. */
  function randomMatrix(n, rng) {
    const m = emptyMatrix(n);
    const cells = n * n;
    for (let t = 0; t < cells; t++) {
      const k = Math.floor(rng() * cells);
      if (Math.floor(rng() * 2) === 1) m[k % n][Math.floor(k / n)] = 1;
    }
    return m;
  }

  function resetIndices(s) {
    s.NB = 0;
    s.NE = 0;
    s.min = s.nx = s.ny = s.n;
    s.RI = Array.from({ length: s.n }, (_, i) => i);
    s.CI = Array.from({ length: s.n }, (_, i) => i);
  }

  function at(s, r, c) {
    return s.values[s.RI[r]][s.CI[c]];
  }

  function changeState(s, st) {
    s.state = st;
    s.log.push("State changes to \"" + STATE_NAMES[st] + "\"");
    if (st === FAILED || st === FINISHED) s.announce = STATE_NAMES[st];
  }

  function checkFinished(s) {
    let ok = true;
    for (let i = 0; ok && i < s.min; i++) {
      s.NB = i;
      if (at(s, i, i) === 0) ok = false;
    }
    if (s.min !== s.n) ok = false;
    if (ok) changeState(s, FINISHED);
  }

  function swapRows(s, a, b, record) {
    if (a === b) return;
    if (record !== false) s.stack.push({ isRow: true, first: a, second: b });
    for (let c = 0; c < s.n; c++) {
      const t = s.values[a][c];
      s.values[a][c] = s.values[b][c];
      s.values[b][c] = t;
    }
    const lab = s.rLabels[a];
    s.rLabels[a] = s.rLabels[b];
    s.rLabels[b] = lab;
  }

  function swapColumns(s, a, b, record) {
    if (a === b) return;
    if (record !== false) s.stack.push({ isRow: false, first: a, second: b });
    for (let r = 0; r < s.n; r++) {
      const t = s.values[r][a];
      s.values[r][a] = s.values[r][b];
      s.values[r][b] = t;
    }
    const lab = s.cLabels[a];
    s.cLabels[a] = s.cLabels[b];
    s.cLabels[b] = lab;
  }

  function back(s) {
    if (!s.stack.length) return false;
    const m = s.stack.pop();
    if (m.isRow) swapRows(s, m.first, m.second, false);
    else swapColumns(s, m.first, m.second, false);
    s.state = GREEDY;
    s.announce = "";
    resetIndices(s);
    checkFinished(s);
    return true;
  }

  function toggle(s, r, c) {
    s.values[r][c] = 1 - s.values[r][c];
    s.state = GREEDY;
    s.announce = "";
    s.stack = [];
    resetIndices(s);
    checkFinished(s);
  }

  function findOneInB(s) {
    for (let c = s.NB; c < s.nx; c++) {
      for (let r = s.NB; r < s.ny; r++) {
        if (at(s, r, c) === 1) return { x: c, y: r };
      }
    }
    return { x: -1, y: -1 };
  }

  function shrinkB(s, p) {
    if (s.NB !== p.x) swapColumns(s, s.CI[s.NB], s.CI[p.x]);
    if (s.NB !== p.y) swapRows(s, s.RI[s.NB], s.RI[p.y]);
  }

  function marryAnother(s) {
    const p = findOneInB(s);
    if (p.x !== -1) shrinkB(s, p);
    else changeState(s, ZEROS);
  }

  function cIsZero(s) {
    for (let r = s.NB; r < s.ny; r++) {
      for (let c = 0; c < s.NB; c++) {
        if (at(s, r, c) === 1) return false;
      }
    }
    return true;
  }

  function cMatchesD(s) {
    for (let r = s.NB; r < s.ny; r++) {
      for (let c = 0; c < s.nx; c++) {
        if (at(s, r, c) === 1) {
          for (let k = s.NB; k < s.nx; k++) {
            if (at(s, c, k) === 1) return { x: c, y: k };
          }
        }
      }
    }
    return { x: -1, y: -1 };
  }

  function makeItZeros(s) {
    if (cIsZero(s)) {
      changeState(s, FAILED);
      return;
    }
    const p = cMatchesD(s);
    if (p.x !== -1) {
      swapColumns(s, s.CI[p.x], s.CI[p.y]);
      changeState(s, GREEDY);
    } else {
      changeState(s, ASSEMBLE);
      s.colRight = s.NB - 1;
      s.colLeft = 0;
    }
  }

  function colZero(s, col) {
    for (let r = s.NB; r < s.ny; r++) {
      if (at(s, r, col) === 1) return false;
    }
    return true;
  }

  function collectE(s) {
    let left = -1;
    let right = -1;
    for (let c = s.colLeft; c <= s.colRight; c++) {
      if (!colZero(s, c)) {
        left = c;
        break;
      }
    }
    for (let c = s.colRight; c >= s.colLeft; c--) {
      if (colZero(s, c)) {
        right = c;
        break;
      }
    }
    s.colLeft = left;
    s.colRight = right;
    if (left !== -1 && right !== -1 && left < right) {
      swapColumns(s, s.CI[left], s.CI[right]);
      swapRows(s, s.RI[left], s.RI[right]);
      return;
    }
    for (let c = 0; c < s.NB; c++) {
      if (!colZero(s, c)) {
        s.NE = c;
        break;
      }
    }
    s.colRight = -1;
    s.colLeft = -1;
    changeState(s, RELABEL);
  }

  function fIsZero(s) {
    for (let r = s.NE; r < s.NB; r++) {
      for (let c = 0; c < s.NE; c++) {
        if (at(s, r, c) === 1) return false;
      }
    }
    return true;
  }

  function fMatchesG(s) {
    for (let r = s.NE; r < s.NB; r++) {
      for (let c = 0; c < s.NE; c++) {
        if (at(s, r, c) === 1) {
          for (let k = s.NB; k < s.nx; k++) {
            if (at(s, c, k) === 1) return { x: r, y: c, z: k };
          }
        }
      }
    }
    return { x: -1, y: -1, z: -1 };
  }

  function reindex(s) {
    if (fIsZero(s)) {
      changeState(s, FAILED);
      return;
    }
    const t = fMatchesG(s);
    if (t.x !== -1) {
      swapColumns(s, s.CI[t.y], s.CI[t.z]);
      swapColumns(s, s.CI[t.x], s.CI[t.z]);
      changeState(s, GREEDY);
      resetIndices(s);
      return;
    }
    let j = 0;
    for (let i = 0; i < s.nx; i++) {
      if (i < s.NE || i >= s.NB) s.CI[j++] = s.CI[i];
    }
    s.nx = s.nx - (s.NB - s.NE);
    s.ny = s.NB;
    s.min = Math.min(s.nx, s.ny);
    changeState(s, ZEROS);
  }

  /** One MakeStep. Returns false when Failed or Finished. */
  function step(s) {
    if (s.state === FAILED || s.state === FINISHED) return false;
    if (s.state === GREEDY) marryAnother(s);
    else if (s.state === ZEROS) makeItZeros(s);
    else if (s.state === RELABEL) reindex(s);
    else if (s.state === ASSEMBLE) collectE(s);
    checkFinished(s);
    return s.state !== FAILED && s.state !== FINISHED;
  }

  function run(s, maxSteps) {
    const lim = maxSteps == null ? 100000 : maxSteps;
    let i = 0;
    while (step(s) && i++ < lim) {}
    return s;
  }

  function hasDiagonal(s) {
    for (let i = 0; i < s.n; i++) if (s.values[i][i] !== 1) return false;
    return true;
  }

  /**
   * Hall's marriage condition on columns-as-sets: every k columns together
   * cover at least k rows. Equivalent to the existence of an SDR.
   */
  function hall(matrix) {
    const n = matrix.length;
    const total = 1 << n;
    for (let mask = 1; mask < total; mask++) {
      const rows = new Set();
      let k = 0;
      for (let j = 0; j < n; j++) {
        if (mask & (1 << j)) {
          k++;
          for (let i = 0; i < n; i++) if (matrix[i][j]) rows.add(i);
        }
      }
      if (rows.size < k) return false;
    }
    return true;
  }

  /** a_ij = 1 iff |i-j| = 1, the page's even/odd example. */
  function tridiag(n) {
    const m = emptyMatrix(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) if (Math.abs(i - j) === 1) m[i][j] = 1;
    }
    return m;
  }

  return {
    MIN_N, MAX_N, DEFAULT_N,
    GREEDY, ZEROS, RELABEL, ASSEMBLE, FAILED, FINISHED, STATE_NAMES,
    start, randomMatrix, emptyMatrix, toggle, step, run, back,
    swapRows, swapColumns, checkFinished, resetIndices, changeState,
    hasDiagonal, hall, tridiag, at,
  };
})();
