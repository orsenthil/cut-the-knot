#!/usr/bin/env node
"use strict";

/*
 * Logic test for multiplication-table/multiplication-table-core.js.
 *
 *   node porting/check-multiplication-table.mjs
 *
 * All 400 entries, then the patterns the page's math section points out, each
 * checked on the whole table: it is symmetric about the main diagonal; the
 * diagonal holds the squares; row n is the n times table (equal steps of n); the
 * digit sums of the nine times table (9..180) up to 90 are 9; every product
 * appears as many times as it has ordered factor pairs within 1..20 (counted
 * independently); the largest number that appears is 400 and it appears once;
 * how many different products there are; and 12 appears 6 times (1x12, 2x6, 3x4 and back).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("multiplication-table/multiplication-table-core.js", "MultiplicationCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  equal("a 20 by 20 table, nothing picked", [s.n, s.picked, C.N], [20, null, 20]);
  const t = C.table();
  equal("20 rows of 20", [t.length, t.every((r) => r.length === 20)], [20, true]);
  equal("corners: 1 x 1, 1 x 20, 20 x 1, 20 x 20", [t[0][0], t[0][19], t[19][0], t[19][19]], [1, 20, 20, 400]);
  equal("7 x 8 = 56 (row 7, column 8)", [t[6][7], C.product(7, 8)], [56, 56]);
  const p = C.pick(s, 3, 4);
  equal("pick a cell", p.picked, { a: 3, b: 4 });
  equal("put it down", C.pick(p, null).picked, null);
  equal("a cell outside the table", [C.pick(s, 0, 1), C.pick(s, 21, 1), C.pick(s, 1, 25), C.pick(s, 1.5, 2)], [null, null, null, null]);
  equal("12 is in these cells: 1x12, 2x6, 3x4, 4x3, 6x2, 12x1", C.cellsWith(12), [[1, 12], [2, 6], [3, 4], [4, 3], [6, 2], [12, 1]]);
  equal("the cells related to the picked 3 x 4 are those of 12", C.related(p), C.cellsWith(12));
  equal("nothing related when nothing is picked", C.related(s), []);
}

/* ------------------------- 2. every entry, and the patterns */
{
  const t = C.table();
  let bad = 0;
  for (let a = 1; a <= 20; a++) for (let b = 1; b <= 20; b++) if (t[a - 1][b - 1] !== a * b) bad++;
  equal("all 400 entries are the products", bad, 0);
  let asym = 0; for (let a = 0; a < 20; a++) for (let b = 0; b < 20; b++) if (t[a][b] !== t[b][a]) asym++;
  equal("the table is symmetric about the main diagonal", asym, 0);
  equal("the main diagonal holds the squares 1, 4, 9, ..., 400", t.map((r, i) => r[i]), Array.from({ length: 20 }, (_, i) => (i + 1) * (i + 1)));
  let steps = true; for (let n = 1; n <= 20; n++) for (let b = 1; b < 20; b++) if (t[n - 1][b] - t[n - 1][b - 1] !== n) steps = false;
  equal("row n goes up in steps of n", steps, true);
  const ds = (x) => String(x).split("").reduce((u, d) => u + Number(d), 0);
  equal("the nine times table, up to 9 x 10: the digits of each answer add to 9", t[8].slice(0, 10).map(ds), Array(10).fill(9));
  // counts of each product
  const counts = new Map(); for (const row of t) for (const v of row) counts.set(v, (counts.get(v) || 0) + 1);
  let off = 0;
  for (const [v, c] of counts) { let k = 0; for (let a = 1; a <= 20; a++) if (v % a === 0 && v / a <= 20) k++; if (k !== c) off++; }
  equal("each product appears once for every way of writing it as a x b with a, b from 1 to 20", off, 0);
  const top = Math.max(...counts.values());
  equal("152 different products; 60 is the most often seen, 8 times (1x60 is outside: 3x20, 4x15, 5x12, 6x10 and back)", [counts.size, top, [...counts].filter(([, c]) => c === top).map(([v]) => v)], [152, 8, [60]]);
  equal("400 appears once and 12 appears 6 times", [counts.get(400), counts.get(12)], [1, 6]);
  const squares = [...counts].filter(([, c]) => c % 2 === 1).map(([v]) => v).sort((x, y) => x - y);
  equal("a product appears an odd number of times only when it is a square (the diagonal appears once)", squares.every((v) => Number.isInteger(Math.sqrt(v))), true);
  console.log(`  (${counts.size} different products; most common ${Math.max(...counts.values())} times)`);
}

done("multiplication-table");
