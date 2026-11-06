#!/usr/bin/env node
"use strict";

/*
 * Logic test for vanishing-rectangles/vanishing-rectangles-core.js.
 *
 *   1. The heights are the applet's: a permutation of 0..N-1 for the top
 *      parts, N-1 minus that for the bottom parts, so lined up (shift 0)
 *      every rectangle is N-1 units tall and there are N of them.
 *   2. The page's trick, for every N from 3 to 20 and many random boards:
 *      of the N possible shifts, exactly one shows N-1 rectangles - the one
 *      that puts the empty top piece over the empty bottom piece - and every
 *      other shift shows N.
 *   3. Where the rectangle went: the total area (in units) is the same at
 *      every shift, N(N-1); with N-1 rectangles their average height is N, one
 *      unit taller than before.
 *   4. All N-1 of them still look like rectangles: no column at the vanishing
 *      shift is empty except the one, and every column's height is between 1
 *      and 2N-2 (a tallest top piece can land on a tallest bottom piece).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const V = loadCore("vanishing-rectangles/vanishing-rectangles-core.js", "VanishingRectanglesCore");

const random = rng(77);
let badPerm = 0;
let badLined = 0;
let badTrick = 0;
let badArea = 0;
let badShape = 0;
let boards = 0;
for (let n = V.MIN_N; n <= V.MAX_N; n++) {
  for (let t = 0; t < 200; t++) {
    const s = V.start(n, random);
    boards++;
    if ([...s.heights].sort((a, b) => a - b).join() !== Array.from({ length: n }, (_, i) => i).join()) badPerm++;
    const lined = V.columns(s, 0);
    if (lined.some((c) => c.top + c.bottom !== n - 1) || V.visible(s, 0) !== n) badLined++;
    const v = V.vanishingShift(s);
    for (let shift = 0; shift < n; shift++) {
      const seen = V.visible(s, shift);
      if (seen !== (shift === v ? n - 1 : n)) badTrick++;
      const area = V.columns(s, shift).reduce((a, c) => a + c.top + c.bottom, 0);
      if (area !== n * (n - 1)) badArea++;
    }
    const cols = V.columns(s, v).filter((c) => c.top + c.bottom > 0);
    if (cols.length !== n - 1 || cols.some((c) => c.top + c.bottom < 1 || c.top + c.bottom > 2 * n - 2)) badShape++;
  }
}
console.log(`  ${boards} random boards, N = 3..20`);
equal("heights are a permutation of 0..N-1", badPerm, 0);
equal("lined up: N rectangles, all N-1 units tall", badLined, 0);
equal("exactly one shift shows N-1 rectangles, the one matching the empty pieces", badTrick, 0);
equal("the area is N(N-1) units at every shift", badArea, 0);
equal("at the vanishing shift, N-1 rectangles between 1 and 2N-2 units tall", badShape, 0);
{
  const s = { n: 4, heights: [2, 0, 3, 1], upper0: 1, lower0: 2 };
  equal("example: top 2 0 3 1 over bottom 1 3 0 2", V.columns(s, 0).map((c) => [c.top, c.bottom]), [[2, 1], [0, 3], [3, 0], [1, 2]]);
  equal("example: the vanishing shift is 1", V.vanishingShift(s), 1);
  equal("example: then the columns are 1+1, 2+3, 0+0, 3+2", V.columns(s, 1).map((c) => [c.top, c.bottom]), [[1, 1], [2, 3], [0, 0], [3, 2]]);
  check("average height N with N-1 rectangles", (2 + 5 + 5) / 3 === 4);
}
equal("3 to 20 rectangles, 4 to start", [V.MIN_N, V.MAX_N, V.DEFAULT_N], [3, 20, 4]);

done("vanishing-rectangles");
