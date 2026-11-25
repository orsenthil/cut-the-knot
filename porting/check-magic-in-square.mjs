#!/usr/bin/env node
"use strict";

/*
 * Logic test for magic-in-square/magic-in-square-core.js.
 *
 *   node porting/check-magic-in-square.mjs
 *
 * The trick, checked for every size 3..6, 40 random deals each, and every one
 * of the N*N numbers the player could think of: answering honestly (the column
 * the number is really in, twice) always names the number. The step that makes
 * it work: each new column holds exactly one number from each old column, so
 * the second answer is the old row. The square shown is always a rearrangement
 * of 1..N*N. The applet's own at() formula is written a second time and compared.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("magic-in-square/magic-in-square-core.js", "MagicInSquareCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start({ n: 5, random: rng(1) });
  equal("size 5 by default", [C.start({ random: rng(1) }).n, s.stage], [5, 0]);
  equal("clampN", [C.clampN(1), C.clampN(99), C.clampN("4"), C.clampN("x")], [3, 6, 4, 5]);
  equal("a deal uses each of 1..25 once", s.grid.flat().sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => i + 1));
  equal("the first view is the deal", C.view(s), s.grid);
  equal("no answer before the end", [C.answer(s), C.result(s), C.revealedCell(s)], [null, null, null]);
  equal("messages", [C.message(s).upper, C.message({ ...s, stage: 1 }).upper, C.message({ ...s, stage: 2 }).lower], ["Select a number and", "Please click again under", "Press Reset!"]);
  equal("a column out of range is refused", [C.pick(s, -1), C.pick(s, 5), C.pick(s, 1.5)], [null, null, null]);
  const s1 = C.pick(s, 2);
  equal("the first pick keeps the column and moves on", [s1.stage, s1.col, s.stage], [1, 2, 0]);
  const s2 = C.pick(s1, 4);
  equal("the second pick finishes", [s2.stage, s2.row, C.result(s2)], [2, 4, "done"]);
  equal("a third pick is refused", C.pick(s2, 0), null);
}

/* ------------------------------------- 2. the trick, for every number and deal */
for (let n = 3; n <= 6; n++) {
  let wrong = 0, bad = 0, notPerm = 0, oneEach = 0, cellBad = 0, tries = 0;
  const random = rng(100 + n);
  for (let deal = 0; deal < 40; deal++) {
    const s0 = C.start({ n, random });
    const v1 = C.view({ ...s0, stage: 1, col: 0 });
    if (JSON.stringify(v1.flat().sort((a, b) => a - b)) !== JSON.stringify(Array.from({ length: n * n }, (_, i) => i + 1))) notPerm++;
    // each new column holds the numbers of one old row
    for (let b = 0; b < n; b++) {
      const column = v1.map((r) => r[b]).sort((a, c) => a - c), oldRow = s0.grid[b].slice().sort((a, c) => a - c);
      if (JSON.stringify(column) !== JSON.stringify(oldRow)) oneEach++;
    }
    for (let number = 1; number <= n * n; number++) {
      tries++;
      const first = C.columnOf(s0, number);
      const s1 = C.pick(s0, first);
      const second = C.columnOf(s1, number);
      const s2 = C.pick(s1, second);
      if (C.answer(s2) !== number) wrong++;
      const cell = C.revealedCell(s2);
      if (!cell || C.view(s2)[cell.row][cell.col] !== number) cellBad++;
      // the second answer is the old row of the number
      if (second !== s0.grid.findIndex((r) => r.includes(number))) bad++;
    }
  }
  equal(`n=${n}: ${tries} honest plays all name the number`, wrong, 0);
  equal(`n=${n}: the second column is the old row`, bad, 0);
  equal(`n=${n}: the shown square is always a rearrangement of 1..${n * n}`, notPerm, 0);
  equal(`n=${n}: each new column is exactly one old row's numbers`, oneEach, 0);
  equal(`n=${n}: the revealed cell holds the number`, cellBad, 0);
}

/* ---------------- 3. the applet's own at(): Cols[a2][AuxCol[a2].at(a1) - 1] when stage >= 1 */
{
  const s = C.pick(C.start({ n: 5, random: rng(9) }), 3);
  let bad = 0;
  for (let a1 = 0; a1 < 5; a1++) for (let a2 = 0; a2 < 5; a2++) if (C.view(s)[a1][a2] !== s.grid[a2][s.aux[a2][a1]]) bad++;
  equal("view equals the applet's formula in every cell", bad, 0);
}

done("magic-in-square");
