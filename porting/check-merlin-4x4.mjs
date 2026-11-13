#!/usr/bin/env node
"use strict";

/*
 * Logic test for merlin-4x4/merlin-4x4-core.js.
 *
 *   1. Move matrix A from neighbourhoods; A² = I (page claim).
 *   2. Hint / parity strategy clears every board; solution is unique.
 *   3. Neighbourhoods of distinct buttons intersect in 0 or 2 cells.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const H = loadCore("merlin-4x4/merlin-4x4-core.js", "Merlin4x4Core");
const N = H.N;

/* -------------------- 1. A² = I ------------------------------------------- */

const A = H.matA();
const A2 = H.matMulMod2(A, A);
let id = true;
for (let i = 0; i < 16; i++) {
  for (let j = 0; j < 16; j++) {
    if (A2[i][j] !== (i === j ? 1 : 0)) id = false;
  }
}
check("A^2 = I", id);

/* -------------------- 2. Hint solves every config; unique ----------------- */

function appletHint(board) {
  // Second transcription of SaveValues.
  const out = H.empty();
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const s =
        board[i][j] +
        board[(i + 1) % N][j] +
        board[(i - 1 + N) % N][j] +
        board[i][(j + 1) % N] +
        board[i][(j - 1 + N) % N];
      out[i][j] = s % 2;
    }
  }
  return out;
}

let solved = 0;
let unique = true;
for (let mask = 0; mask < 1 << 16; mask++) {
  const board = H.empty();
  for (let k = 0; k < 16; k++) board[(k / N) | 0][k % N] = (mask >> k) & 1;
  const h = H.hint(board);
  equal("hint vs applet " + mask, h, appletHint(board));
  const cleared = H.applyStrategy(board, h);
  if (!H.isSolved(cleared)) {
    check("hint clears " + mask, false);
    break;
  }
  solved++;
  // Uniqueness: any other strategy that clears differs → fail A s = v uniqueness
  // Spot-check: pressing one extra button (when mask small) leaves lights.
  if (mask < 32) {
    for (let r = 0; r < N && unique; r++) {
      for (let c = 0; c < N; c++) {
        if (h[r][c]) continue;
        const bad = H.copy(h);
        bad[r][c] = 1;
        if (H.isSolved(H.applyStrategy(board, bad))) unique = false;
      }
    }
  }
}
equal("all 65536 boards solvable via hint", solved, 65536);
check("adding an extra press breaks solve (samples)", unique);

// A v equals hint vector
{
  const board = H.randomBoard(rng(7));
  const v = H.boardToVec(board);
  const Av = H.mulMod2(A, v);
  equal("hint = A v", H.boardToVec(H.hint(board)), Av);
}

/* -------------------- 3. Intersections 0 or 2 ----------------------------- */

let badIntersect = false;
for (let r1 = 0; r1 < N; r1++) {
  for (let c1 = 0; c1 < N; c1++) {
    const n1 = new Set(H.neighborhood(r1, c1).map(([r, c]) => r + "," + c));
    for (let r2 = 0; r2 < N; r2++) {
      for (let c2 = 0; c2 < N; c2++) {
        if (r1 === r2 && c1 === c2) continue;
        const n2 = H.neighborhood(r2, c2);
        let k = 0;
        for (const [r, c] of n2) if (n1.has(r + "," + c)) k++;
        if (k !== 0 && k !== 2) badIntersect = true;
      }
    }
  }
}
check("neighbourhoods intersect in 0 or 2", !badIntersect);

/* -------------------- 4. Press twice cancels; random play ----------------- */

{
  const b = H.randomBoard(rng(3));
  const before = H.copy(b);
  H.press(b, 1, 2);
  H.press(b, 1, 2);
  equal("press twice = identity", b, before);
}

{
  // Theorem 1 spot-check: pressing a cell flips its own parity, not a disjoint one's
  const b = H.empty();
  b[0][0] = 1;
  const p00 = H.count(b, 0, 0) % 2;
  const p22 = H.count(b, 2, 2) % 2;
  H.press(b, 0, 0);
  equal("press flips own parity", H.count(b, 0, 0) % 2, 1 - p00);
  // (0,0) and (2,2) are opposite on 4×4 torus — neighbourhoods disjoint?
  const inter = H.neighborhood(0, 0).filter(([r, c]) =>
    H.neighborhood(2, 2).some(([rr, cc]) => rr === r && cc === c),
  );
  if (inter.length === 0) {
    equal("disjoint parity unchanged", H.count(b, 2, 2) % 2, p22);
  }
}

done("merlin-4x4");
