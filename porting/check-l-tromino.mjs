#!/usr/bin/env node
"use strict";

/*
 * Logic test for l-tromino/l-tromino-core.js.
 *
 *   1. The page's Theorem 2.3, against an exact search on every board the
 *      applet offers (2 to 10 rows by 2 to 10 columns): a board can be tiled
 *      with L-trominoes exactly when the theorem says so. Every tiling found is
 *      checked: L-shaped pieces, no overlap, every square covered.
 *   2. The page's examples: 1x3 (not offered, but quoted), 3x3 and 3x5 cannot
 *      be tiled; 2x3 is the smallest that can; area divisible by 3 is needed
 *      but not enough.
 *   3. Building a piece square by square follows the applet: neighbours only,
 *      no straight line of three, never over a covered square; the corner is
 *      the middle click; Remove last undoes a piece; a full board is finished.
 *   4. Every tiling found can be entered through the clicks, so the page can
 *      reach every solution.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const T = loadCore("l-tromino/l-tromino-core.js", "LTrominoCore");

/* ----------------------------------------------- 1. Theorem 2.3, exactly */

const isL = (cells) => {
  const rs = cells.map((c) => c[0]);
  const cs = cells.map((c) => c[1]);
  const spanR = Math.max(...rs) - Math.min(...rs);
  const spanC = Math.max(...cs) - Math.min(...cs);
  const distinct = new Set(cells.map((c) => c.join())).size === 3;
  return distinct && spanR === 1 && spanC === 1;
};
let mismatches = 0;
let badTilings = 0;
let boards = 0;
const tilings = new Map();
for (let r = T.MIN; r <= T.MAX; r++) {
  for (let c = T.MIN; c <= T.MAX; c++) {
    boards++;
    const t = T.canTile(r, c);
    if ((t !== null) !== T.theorem(r, c)) mismatches++;
    if (t) {
      tilings.set(`${r}x${c}`, t);
      const seen = new Set();
      for (const p of t) {
        if (!isL(p)) badTilings++;
        for (const [x, y] of p) {
          if (x < 0 || x >= r || y < 0 || y >= c || seen.has(`${x},${y}`)) badTilings++;
          seen.add(`${x},${y}`);
        }
      }
      if (seen.size !== r * c) badTilings++;
    }
  }
}
equal(`Theorem 2.3 agrees with exact search on all ${boards} boards from 2x2 to 10x10`, mismatches, 0);
equal("every tiling found is made of real L pieces covering the board once", badTilings, 0);

/* ----------------------------------------------------- 2. the examples */

check("3x3 cannot be tiled", T.canTile(3, 3) === null);
check("3x5 cannot be tiled, although its area is divisible by 3", T.canTile(3, 5) === null);
check("1x3 cannot be tiled", T.canTile(1, 3) === null);
check("2x3 can, and no smaller board can", T.canTile(2, 3) && T.canTile(2, 2) === null);
check("5x6, the starting board, can", T.canTile(5, 6) !== null);
check("4x5 cannot: 20 is not divisible by 3", T.canTile(4, 5) === null);

/* ---------------------------------------------------- 3. building pieces */

{
  const s = T.start(3, 3);
  equal("first square", T.click(s, 0, 0), "added");
  equal("a square that does not touch it starts again", T.click(s, 2, 2), "added");
  equal("and building restarted there", s.building, [[2, 2]]);
  T.click(s, 2, 1);
  equal("a straight third square is refused and restarts the piece", T.click(s, 2, 0), "added");
  equal("piece restarted at the refused square", s.building, [[2, 0]]);
  const t = T.start(3, 3);
  T.click(t, 0, 0);
  T.click(t, 0, 1);
  equal("an L: (0,0), corner (0,1), (1,1)", T.click(t, 1, 1), "placed");
  equal("a covered square is refused", T.click(t, 0, 0), "refused");
  check("Remove last frees it", T.removeLast(t) && T.click(t, 0, 0) === "added");
}

/* -------------------------------------- 4. every tiling can be clicked in */

{
  let bad = 0;
  for (const [key, pieces] of tilings) {
    const [r, c] = key.split("x").map(Number);
    const s = T.start(r, c);
    for (const p of pieces) {
      // Click in an order that puts the corner in the middle: the cell sharing a row with one and a column with the other.
      const corner = p.find((a) => p.filter((b) => b !== a && touch(a, b)).length === 2);
      const ends = p.filter((a) => a !== corner);
      for (const cell of [ends[0], corner, ends[1]]) T.click(s, ...cell);
    }
    if (!T.finished(s)) bad++;
  }
  equal(`every one of the ${tilings.size} tilings can be entered by clicking`, bad, 0);
}
function touch(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1; }

equal("2 to 10 rows and columns, 5 by 6 to start", [T.MIN, T.MAX, T.DEFAULT_ROWS, T.DEFAULT_COLS], [2, 10, 5, 6]);

done("l-tromino");
