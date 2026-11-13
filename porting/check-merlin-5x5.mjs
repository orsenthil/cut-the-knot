#!/usr/bin/env node
"use strict";

/*
 * Logic test for merlin-5x5/merlin-5x5-core.js.
 *
 *   1. Neighbor table / press matches a second transcription; press twice = id.
 *   2. ThreadDown + GetTopFromBottom transcribed from bytecode; Hint solve works.
 *   3. Page claims: solvability ↔ bottom-row parities {1,3,5} and {2,3,4};
 *      four solutions when solvable; rank(A) = 23.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const H = loadCore("merlin-5x5/merlin-5x5-core.js", "Merlin5x5Core");
const N = H.N;

/* -------------------- 1. Neighbors / press -------------------------------- */

function appletNeighbors(r, c) {
  // Rebuild classic Lights Out (self + orthogonal, no wrap).
  const out = [[r, c]];
  if (r > 0) out.push([r - 1, c]);
  if (r < N - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < N - 1) out.push([r, c + 1]);
  return out;
}

for (let r = 0; r < N; r++) {
  for (let c = 0; c < N; c++) {
    const a = H.neighborhood(r, c).map(([x, y]) => x + "," + y).sort();
    const b = appletNeighbors(r, c).map(([x, y]) => x + "," + y).sort();
    equal("neighbors " + r + "," + c, a, b);
  }
}

{
  const b = H.randomBoard(rng(2));
  const before = H.copy(b);
  H.press(b, 2, 2);
  H.press(b, 2, 2);
  equal("press twice", b, before);
}

/* -------------------- 2. Gathering + GetTopFromBottom --------------------- */

function appletThreadDown(board) {
  for (let r = 1; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r - 1][c] === 1) H.press(board, r, c);
    }
  }
}

function appletGetTop(board) {
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

for (const seed of [1, 5, 9, 17, 42]) {
  const board = H.randomBoard(rng(seed));
  const a = H.copy(board);
  const b = H.copy(board);
  H.threadDown(a);
  appletThreadDown(b);
  equal("threadDown seed " + seed, a, b);
  equal("getTop seed " + seed, H.getTopFromBottom(a), appletGetTop(b));
}

/* -------------------- 3. Solvability, four solutions, page parity --------- */

function mulA(s) {
  // Apply strategy s (flat 25) via presses on empty → resulting board vec
  const board = H.empty();
  for (let i = 0; i < 25; i++) if (s[i]) H.press(board, (i / N) | 0, i % N);
  const v = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) v.push(board[r][c]);
  return v;
}

// Rank of A over GF(2) via Gaussian elimination
function rankGF2(A) {
  const n = A.length;
  const M = A.map((row) => row.slice());
  let rank = 0;
  let row = 0;
  for (let col = 0; col < n && row < n; col++) {
    let piv = -1;
    for (let i = row; i < n; i++) if (M[i][col]) {
      piv = i;
      break;
    }
    if (piv < 0) continue;
    [M[row], M[piv]] = [M[piv], M[row]];
    for (let i = 0; i < n; i++) {
      if (i !== row && M[i][col]) {
        for (let j = col; j < n; j++) M[i][j] ^= M[row][j];
      }
    }
    rank++;
    row++;
  }
  return rank;
}

equal("rank(A)", rankGF2(H.matA()), 23);

let solvable = 0;
let unsolvable = 0;
let parityMismatch = 0;
const samples = 4000;
for (let i = 0; i < samples; i++) {
  const board = H.randomBoard(rng(1000 + i));
  const ok = H.isSolvable(board);
  const parity = H.bottomParityOk(board);
  if (ok !== parity) parityMismatch++;
  if (ok) {
    solvable++;
    const s = H.solve(board);
    check("solve clears " + i, H.isSolved(H.applyStrategy(board, s)));
    // hintTop first-row agrees with solve's first row
    const top = H.hintTop(board);
    for (let c = 0; c < N; c++) {
      if (s[0][c] !== top[0][c]) {
        // solve may xor gathering into row 0? No — gathering only presses rows 1..4.
        check("top matches solve row0 " + i, false);
        break;
      }
    }
  } else {
    unsolvable++;
    check("unsolvable has no solve " + i, H.solve(board) == null);
  }
}
check("parity matches solvability", parityMismatch === 0);
check("some solvable samples", solvable > 0);
check("some unsolvable samples", unsolvable > 0);
// Expect about 1/4 solvable (rank 23 → 2^23 / 2^25 = 1/4)
const ratio = solvable / samples;
check("solvable ~1/4", ratio > 0.2 && ratio < 0.3, "got " + ratio);

// Four solutions: nullspace size 2^2 = 4
{
  const board = H.empty();
  board[0][0] = 1; // may or may not be solvable
  // Find a solvable board
  let target = null;
  for (let i = 0; i < 200; i++) {
    const b = H.randomBoard(rng(5000 + i));
    if (H.isSolvable(b)) {
      target = b;
      break;
    }
  }
  check("found solvable", !!target);
  if (target) {
    const base = H.solve(target);
    // Enumerate adding nullspace vectors by trying all 2^25 is too big;
    // instead: chase-lights gives one solution; press each of the two known
    // neutral first-row sets (page) as extras and re-gather — count distinct
    // clearing strategies among {base} ∪ toggled neutrals.
    // Neutral first-row sets from the page / nullspace: {1,2,4,5} i.e. cols
    // 0,1,3,4 and {1,3,5}? Verify by enumeration of first-row-only additions
    // that leave the all-off board fixed after gather-solve composition.
    const neutrals = [];
    for (let mask = 0; mask < 32; mask++) {
      const b = H.empty();
      for (let c = 0; c < 5; c++) if (mask & (1 << c)) H.press(b, 0, c);
      H.threadDown(b);
      if (H.isSolved(b)) neutrals.push(mask);
    }
    // Gathering from a first-row press set being identity means that set is in
    // the kernel of (press top + gather). Equal number of kernel first-rows.
    equal("neutral first-row sets", neutrals.length, 4);
  }
}

// Single corner is NOT solvable on 5×5 (GE / chase leave bottom col 5 lit).
{
  const b = H.empty();
  b[0][0] = 1;
  check("corner unsolvable", !H.isSolvable(b));
  check("corner parity fails", !H.bottomParityOk(b));
}
// A single centre light is solvable.
{
  const b = H.empty();
  b[2][2] = 1;
  check("centre solvable", H.isSolvable(b));
  check("centre parity", H.bottomParityOk(b));
  check("centre clears", H.isSolved(H.applyStrategy(b, H.solve(b))));
}

done("merlin-5x5");
