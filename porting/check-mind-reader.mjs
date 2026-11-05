#!/usr/bin/env node
"use strict";

/*
 * Logic test for mind-reader/mind-reader-core.js.
 *
 * The trick: take a two-digit number, subtract the sum of its digits. Writing
 * the number as 10a + b, the result is 10a + b - (a + b) = 9a, always a
 * multiple of 9. The table then shows the same shape against every multiple of
 * 9, so whatever number you started from, the shape you land on is the one the
 * machine already knew.
 *
 * Both halves are checked exhaustively over the whole table, which is the
 * strongest form available here: there are only 99 starting numbers.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const M = loadCore("mind-reader/mind-reader-core.js", "MindReader");

/* ---------------------------------- 1. the arithmetic, over every number */

{
  let offTable = 0;
  for (let num = 0; num < M.CELLS; num++) {
    const r = M.digitSumResult(num);
    const a = Math.floor(num / 10);
    const b = num % 10;
    equal(`${num} - (${a}+${b}) = 9*${a}`, r, 9 * a);
    check(`${num}: the result is a multiple of 9`, r % 9 === 0, `got ${r}`);
    check(`${num}: the result stays on the table`, r >= 0 && r < M.CELLS);
    if (r < 0 || r >= M.CELLS) offTable++;
  }
  equal("no number lands off the table", offTable, 0);
}

/* ------------------- 2. the marked cells are exactly the multiples of 9 */

{
  const magic = M.magicCells();
  equal("there are 10 marked cells", magic.length, M.N);
  equal("they are 0, 9, 18, ... 81", magic, [0, 9, 18, 27, 36, 45, 54, 63, 72, 81]);
  for (const c of magic) check(`${c} is a multiple of 9`, c % 9 === 0);

  // And every reachable result is one of them.
  const reachable = new Set();
  for (let num = 0; num < M.CELLS; num++) reachable.add(M.digitSumResult(num));
  for (const r of reachable) {
    check(`result ${r} is a marked cell`, magic.includes(r), `marked cells are ${magic}`);
  }
}

/* ---------------------- 3. a fresh table always gives the trick away to no one */

{
  const rand = rng(99);
  for (let trial = 0; trial < 300; trial++) {
    const table = M.newTable(rand);
    equal("the table has a figure for every cell", table.figs.length, M.CELLS);

    // Every marked cell carries the special shape...
    for (const c of M.magicCells()) {
      equal(`cell ${c} shows the special shape`, table.figs[c], table.special);
    }
    // ...so every possible starting number lands on it.
    let wrong = 0;
    for (let num = 0; num < M.CELLS; num++) {
      if (table.figs[M.digitSumResult(num)] !== table.special) wrong++;
    }
    equal("every starting number lands on the special shape", wrong, 0);

    check("the special shape is a real shape", M.SHAPES.includes(M.SHAPES[table.special]));
    for (const f of table.figs) {
      check("every figure index is in range", f >= 0 && f < M.SHAPES.length, `got ${f}`);
    }
  }
}

/* --------------------------------- 4. the table is not uniformly one shape */

{
  // If the decoys were all the special shape too, the trick would be obvious.
  const rand = rng(7);
  let sawVariety = 0;
  for (let trial = 0; trial < 50; trial++) {
    const table = M.newTable(rand);
    if (new Set(table.figs).size > 1) sawVariety++;
  }
  equal("tables use more than one shape", sawVariety, 50);
}

/* ------------------------------------------- 5. the shapes render to paths */

{
  for (let i = 0; i < M.SHAPES.length; i++) {
    const d = M.shapePath(i, 0, 0, 20);
    check(`shape ${i} (${M.SHAPES[i]}) has path data`, typeof d === "string" && d.length > 5, JSON.stringify(d));
    check(`shape ${i} path starts with a move`, /^M/.test(d.trim()), d.slice(0, 10));
  }
  equal("the table grid is 11 by 9", [M.COLS, M.ROWS], [11, 9]);
  equal("the table holds 99 numbers", M.CELLS, 99);
}

done("check-mind-reader");
