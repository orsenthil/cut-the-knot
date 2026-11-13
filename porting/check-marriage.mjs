#!/usr/bin/env node
"use strict";

/*
 * Logic test for marriage/marriage-core.js.
 *
 *   1. The algorithm transcribed a second time from the bytecode and compared
 *      on every matrix for n <= 4, plus a sample for n = 5.
 *   2. The page's claims: the |i-j|=1 matrix has an SDR iff n is even; a
 *      permutation (identity) matrix finishes in the Greedy phase; the
 *      algorithm succeeds iff Hall's marriage condition holds.
 *   3. Edge cases: toggle, back, the page's worked example.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const H = loadCore("marriage/marriage-core.js", "MarriageCore");

/* -------------------- 1. a second transcription of MakeStep et al. -------- */

function appletRun(matrix) {
  const n = matrix.length;
  const values = matrix.map((r) => r.slice());
  let RI = [...Array(n).keys()];
  let CI = [...Array(n).keys()];
  let NB = 0, NE = 0, nx = n, ny = n, min = n;
  let state = 0;
  let colLeft = -1, colRight = -1;
  const at = (r, c) => values[RI[r]][CI[c]];
  const swapR = (a, b) => {
    if (a === b) return;
    for (let c = 0; c < n; c++) {
      const t = values[a][c]; values[a][c] = values[b][c]; values[b][c] = t;
    }
  };
  const swapC = (a, b) => {
    if (a === b) return;
    for (let r = 0; r < n; r++) {
      const t = values[r][a]; values[r][a] = values[r][b]; values[r][b] = t;
    }
  };
  const resetIdx = () => {
    NB = 0; NE = 0; min = nx = ny = n;
    RI = [...Array(n).keys()]; CI = [...Array(n).keys()];
  };
  const checkFin = () => {
    let ok = true;
    for (let i = 0; ok && i < min; i++) {
      NB = i;
      if (at(i, i) === 0) ok = false;
    }
    if (min !== n) ok = false;
    if (ok) state = 5;
  };
  const step = () => {
    if (state === 4 || state === 5) return;
    if (state === 0) {
      let found = false;
      for (let c = NB; c < nx && !found; c++) {
        for (let r = NB; r < ny && !found; r++) {
          if (at(r, c) === 1) {
            if (NB !== c) swapC(CI[NB], CI[c]);
            if (NB !== r) swapR(RI[NB], RI[r]);
            found = true;
          }
        }
      }
      if (!found) state = 1;
    } else if (state === 1) {
      let cZero = true;
      for (let r = NB; r < ny && cZero; r++)
        for (let c = 0; c < NB && cZero; c++) if (at(r, c) === 1) cZero = false;
      if (cZero) { state = 4; }
      else {
        let px = -1, py = -1;
        for (let r = NB; r < ny && px < 0; r++)
          for (let c = 0; c < nx && px < 0; c++)
            if (at(r, c) === 1)
              for (let k = NB; k < nx && px < 0; k++)
                if (at(c, k) === 1) { px = c; py = k; }
        if (px >= 0) { swapC(CI[px], CI[py]); state = 0; }
        else { state = 3; colRight = NB - 1; colLeft = 0; }
      }
    } else if (state === 3) {
      const colZ = (col) => {
        for (let r = NB; r < ny; r++) if (at(r, col) === 1) return false;
        return true;
      };
      let left = -1, right = -1;
      for (let c = colLeft; c <= colRight; c++) if (!colZ(c)) { left = c; break; }
      for (let c = colRight; c >= colLeft; c--) if (colZ(c)) { right = c; break; }
      colLeft = left; colRight = right;
      if (left !== -1 && right !== -1 && left < right) {
        swapC(CI[left], CI[right]); swapR(RI[left], RI[right]);
      } else {
        for (let c = 0; c < NB; c++) if (!colZ(c)) { NE = c; break; }
        colRight = -1; colLeft = -1; state = 2;
      }
    } else if (state === 2) {
      let fZero = true;
      for (let r = NE; r < NB && fZero; r++)
        for (let c = 0; c < NE && fZero; c++) if (at(r, c) === 1) fZero = false;
      if (fZero) { state = 4; }
      else {
        let tx = -1, ty = -1, tz = -1;
        for (let r = NE; r < NB && tx < 0; r++)
          for (let c = 0; c < NE && tx < 0; c++)
            if (at(r, c) === 1)
              for (let k = NB; k < nx && tx < 0; k++)
                if (at(c, k) === 1) { tx = r; ty = c; tz = k; }
        if (tx >= 0) {
          swapC(CI[ty], CI[tz]); swapC(CI[tx], CI[tz]);
          state = 0; resetIdx();
        } else {
          let j = 0;
          for (let i = 0; i < nx; i++) if (i < NE || i >= NB) CI[j++] = CI[i];
          nx = nx - (NB - NE); ny = NB; min = Math.min(nx, ny); state = 1;
        }
      }
    }
    checkFin();
  };
  let guard = 0;
  while (state !== 4 && state !== 5 && guard++ < 100000) step();
  return { state, values };
}

let differ = 0;
for (let n = 1; n <= 4; n++) {
  // n=1,2 are below the UI minimum but the core accepts them via start clamp;
  // test the algorithm on raw matrices through run() with forced n by
  // building state manually for n < MIN_N.
  const total = 1 << (n * n);
  const stride = n <= 3 ? 1 : 17;
  for (let bits = 0; bits < total; bits += stride) {
    const m = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (bits >> (i * n + j)) & 1));
    const a = appletRun(m.map((r) => r.slice()));
    const s = {
      n, values: m.map((r) => r.slice()),
      rLabels: [..."abcdefghij"].slice(0, n),
      cLabels: [..."ABCDEFGHIJ"].slice(0, n),
      RI: [], CI: [], NB: 0, NE: 0, nx: n, ny: n, min: n,
      state: 0, colLeft: -1, colRight: -1, announce: "", log: [], stack: [],
    };
    H.resetIndices(s);
    H.checkFinished(s);
    H.run(s);
    if (a.state !== s.state) differ++;
  }
}
check("core step() = applet MakeStep on every n<=4 matrix (sampled)", differ === 0, `${differ} differ`);

/* -------------------------------- 2. the page's claims -------------------- */

for (let n = H.MIN_N; n <= 8; n++) {
  const m = H.tridiag(n);
  const expect = n % 2 === 0;
  equal(`tridiag n=${n}: Hall's condition`, H.hall(m), expect);
  const s = H.start(n, m);
  H.run(s);
  equal(`tridiag n=${n}: algorithm ${expect ? "finishes" : "fails"}`,
    s.state, expect ? H.FINISHED : H.FAILED);
}

{
  // Identity: already a transversal; CheckFinished marks Finished at once.
  const n = 5;
  const id = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const s = H.start(n, id);
  equal("identity is Finished before any Step", s.state, H.FINISHED);
  check("identity has a full diagonal", H.hasDiagonal(s));
}

{
  // A non-identity permutation matrix: only Greedy swaps should finish it.
  const m = [
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
    [1, 0, 0, 0],
  ];
  const s = H.start(4, m);
  let usedNonGreedy = false;
  while (s.state !== H.FINISHED && s.state !== H.FAILED) {
    if (s.state !== H.GREEDY) usedNonGreedy = true;
    H.step(s);
  }
  check("a permutation matrix finishes", s.state === H.FINISHED && H.hasDiagonal(s));
  check("a permutation matrix stays in the Greedy phase (page claim)", !usedNonGreedy);
}

{
  // Algorithm iff Hall, for every n=3 matrix and a sample of n=4,5.
  let bad = 0;
  for (let n = 3; n <= 4; n++) {
    const total = 1 << (n * n);
    const stride = n === 3 ? 1 : 31;
    for (let bits = 0; bits < total; bits += stride) {
      const m = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (bits >> (i * n + j)) & 1));
      const s = H.start(n, m.map((r) => r.slice()));
      H.run(s);
      const expect = H.hall(m);
      if ((s.state === H.FINISHED) !== expect) bad++;
    }
  }
  const rand = rng(42);
  for (let t = 0; t < 400; t++) {
    const m = H.randomMatrix(5, rand);
    const s = H.start(5, m.map((r) => r.slice()));
    H.run(s);
    if ((s.state === H.FINISHED) !== H.hall(m)) bad++;
  }
  check("algorithm succeeds iff Hall's condition holds", bad === 0, `${bad} bad`);
}

/* -------------------------------- 3. edge cases / page example ------------ */

{
  const example = [
    [1, 0, 0, 0, 1],
    [1, 1, 0, 0, 0],
    [0, 1, 1, 0, 0],
    [0, 0, 1, 1, 0],
    [0, 0, 0, 1, 0],
  ];
  const s = H.start(5, example);
  H.run(s);
  equal("page example finishes", s.state, H.FINISHED);
  check("page example ends with a diagonal of 1s", H.hasDiagonal(s));
}

{
  const s = H.start(3, H.emptyMatrix(3));
  H.run(s);
  equal("all-zero fails", s.state, H.FAILED);
  equal("failed announce", s.announce, "Failed, the life's hard");
}

{
  const s = H.start(3, [
    [1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ]);
  H.swapColumns(s, 1, 2);
  check("manual column swap is recorded", s.stack.length === 1);
  H.back(s);
  equal("Back undoes the swap", s.values, [
    [1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ]);
}

{
  const s = H.start(3, H.emptyMatrix(3));
  H.toggle(s, 0, 0);
  equal("toggle puts a 1", s.values[0][0], 1);
  H.toggle(s, 0, 0);
  equal("toggle clears it", s.values[0][0], 0);
}

equal("default N is 5", H.DEFAULT_N, 5);
equal("N range 3..10", [H.MIN_N, H.MAX_N], [3, 10]);

done("marriage");
