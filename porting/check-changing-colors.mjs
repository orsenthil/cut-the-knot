#!/usr/bin/env node
"use strict";

/*
 * Logic test for changing-colors/changing-colors-core.js.
 *
 *   1. The moves: 2N row and column lines and 2N-1 lines in each diagonal
 *      direction (the applet's EW, SN, NESW and NWSE arrows), covering
 *      every cell; the corner "lines" are single cells.
 *   2. The invariant behind the hint: for N = 4, 6, 8 every move swaps an
 *      even number of the hint cells (edge cells that are not corners).
 *   3. The page's answer, settled without the invariant: swaps are addition
 *      mod 2 and the order of moves doesn't matter, so the boards you can
 *      reach are a linear space over GF(2). Gaussian elimination shows that
 *      from every possible starting cell the applet can pick, neither
 *      all-white nor all-black is reachable, for N = 4, 6, 8.
 *   4. Why the applet offers only even N: for N = 5 and 7 the hint argument
 *      fails (the top row swaps an odd number of hint cells). The puzzle is
 *      still impossible there - the elimination shows it - but it needs a
 *      different proof. Only on a 3 by 3 board can a lone black edge cell be
 *      cleared, and the test finds the moves and plays them.
 *   5. Reset puts the black cell on an edge, never a corner, reaching every
 *      such cell; Take back restores the board.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("changing-colors/changing-colors-core.js", "ChangingColorsCore");

/* --------------------------------------------------------- 1. the moves */

for (const n of C.SIZES) {
  const lines = C.allLines(n);
  equal(`N=${n}: ${2 * n} rows and columns plus 2 x ${2 * n - 1} diagonal lines`, lines.length, 2 * n + 2 * (2 * n - 1));
  const covered = new Set();
  for (const [kind, k] of lines) for (const [r, c] of C.lineCells(n, kind, k)) covered.add(r * n + c);
  equal(`N=${n}: every cell is on some line`, covered.size, n * n);
  const singles = lines.filter(([kind, k]) => C.lineCells(n, kind, k).length === 1).length;
  equal(`N=${n}: the four corners are one-cell diagonal lines`, singles, 4);
}

/* ----------------------------------------------------- 2. the invariant */

for (const n of C.SIZES) {
  const hint = new Set(C.hintCells(n).map(([r, c]) => r * n + c));
  const odd = C.allLines(n).filter(([kind, k]) => C.lineCells(n, kind, k).filter(([r, c]) => hint.has(r * n + c)).length % 2);
  equal(`N=${n}: every move swaps an even number of hint cells`, odd.length, 0);
}

/* ------------------------------------------- 3 and 4. GF(2) reachability */

// Is `target` (a bit vector, as an array of 0/1) a sum of the move vectors? Returns the moves used, or null.
function solve(n, target) {
  const lines = C.allLines(n);
  const vecs = lines.map(([kind, k]) => {
    const v = new Array(n * n).fill(0);
    for (const [r, c] of C.lineCells(n, kind, k)) v[r * n + c] = 1;
    return v;
  });
  // Augmented matrix: rows are cells, columns are moves, last column the target.
  const rows = [];
  for (let i = 0; i < n * n; i++) rows.push([...vecs.map((v) => v[i]), target[i]]);
  const m = lines.length;
  const pivotOf = [];
  let r = 0;
  for (let col = 0; col < m && r < rows.length; col++) {
    let p = rows.findIndex((row, i) => i >= r && row[col]);
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let i = 0; i < rows.length; i++) if (i !== r && rows[i][col]) rows[i] = rows[i].map((x, j) => x ^ rows[r][j]);
    pivotOf[r] = col;
    r++;
  }
  for (let i = r; i < rows.length; i++) if (rows[i][m]) return null; // inconsistent
  const used = new Array(m).fill(0);
  for (let i = 0; i < r; i++) used[pivotOf[i]] = rows[i][m];
  return lines.filter((_, j) => used[j]);
}

const edgeCells = (n) => C.hintCells(n);
for (const n of C.SIZES) {
  let reachable = 0;
  for (const [r0, c0] of edgeCells(n)) {
    for (const toBlack of [false, true]) {
      // Need moves turning the start into all-white (or all-black): target = start XOR goal.
      const t = new Array(n * n).fill(toBlack ? 1 : 0);
      t[r0 * n + c0] ^= 1;
      if (solve(n, t)) reachable++;
    }
  }
  equal(`N=${n}: from every starting cell, no sequence of moves gives one colour`, reachable, 0);
}
for (const n of [5, 7]) {
  const top = C.lineCells(n, "row", 0).filter(([r, c]) => c > 0 && c < n - 1).length;
  check(`N=${n}: the top row swaps ${top} hint cells, an odd number, so the hint argument fails`, top % 2 === 1);
  // ...and yet it is still impossible: some other invariant blocks it.
  let reachable = 0;
  for (const [r0, c0] of edgeCells(n)) {
    for (const toBlack of [false, true]) {
      const t = new Array(n * n).fill(toBlack ? 1 : 0);
      t[r0 * n + c0] ^= 1;
      if (solve(n, t)) reachable++;
    }
  }
  equal(`N=${n}: still no way to one colour from any edge cell`, reachable, 0);
}
{
  // 3 by 3 is the one size where it can be done: the moves reach every board.
  const n = 3;
  const t = new Array(n * n).fill(0);
  t[0 * n + 1] = 1;
  const moves = solve(n, t);
  check("N=3: one black edge cell can be cleared", moves !== null);
  const s = { n, cells: Array.from({ length: n }, () => new Array(n).fill(false)), history: [] };
  s.cells[0][1] = true;
  for (const [kind, k] of moves) C.swap(s, kind, k);
  check(`N=3: playing those ${moves.length} moves leaves the board one colour`, C.monochrome(s));
}

/* -------------------------------------------------- 5. reset, take back */

{
  const random = rng(12);
  for (const n of C.SIZES) {
    const seen = new Set();
    let bad = 0;
    for (let t = 0; t < 4000; t++) {
      const s = C.start(n, random);
      const black = [];
      s.cells.forEach((row, r) => row.forEach((v, c) => { if (v) black.push([r, c]); }));
      if (black.length !== 1) { bad++; continue; }
      const [r, c] = black[0];
      const edge = r === 0 || r === n - 1 || c === 0 || c === n - 1;
      const corner = (r === 0 || r === n - 1) && (c === 0 || c === n - 1);
      if (!edge || corner) bad++;
      seen.add(r * n + c);
    }
    equal(`N=${n}: Reset makes one black cell, on an edge, never a corner`, bad, 0);
    equal(`N=${n}: every such cell can come up`, seen.size, 4 * (n - 2));
  }
  const s = C.start(6, random);
  const before = JSON.stringify(s.cells);
  C.swap(s, "anti", 3);
  C.swap(s, "row", 0);
  C.takeBack(s);
  C.takeBack(s);
  equal("Take back restores the board", JSON.stringify(s.cells), before);
  equal("the hint count stays odd", C.blackCount(s, C.hintCells(6)) % 2, 1);
}

done("changing-colors");
