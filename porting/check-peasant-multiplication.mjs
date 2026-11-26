#!/usr/bin/env node
"use strict";

/*
 * Logic test for peasant-multiplication/peasant-multiplication-core.js.
 *
 *   node porting/check-peasant-multiplication.mjs
 *
 * Every pair 1..400 x 1..400 is multiplied by the algorithm and compared with
 * a * b; the odd halves are compared with the binary digits; the row count with
 * floor(log2 a)+1; the page's advice (smaller number first needs fewer rows)
 * is checked on every pair; and the page's worked example 85 x 18 = 1530.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const P = loadCore("peasant-multiplication/peasant-multiplication-core.js", "PeasantCore");

const ex = P.multiply(85, 18);
equal("85 halves", ex.rows.map((r) => r.half), [85, 42, 21, 10, 5, 2, 1]);
equal("18 doubles", ex.rows.map((r) => r.dbl), [18, 36, 72, 144, 288, 576, 1152]);
equal("the third column", ex.parts, [18, 72, 288, 1152]);
equal("85 x 18", ex.product, 1530);
equal("85 in binary", P.binary(85), "1010101");
equal("18 x 85", P.multiply(18, 85).product, 1530);
equal("18 in binary", P.binary(18), "10010");
equal("18 x 85 uses 5 rows, 85 x 18 uses 7", [P.multiply(18, 85).rows.length, ex.rows.length], [5, 7]);

let wrongProduct = 0, wrongBits = 0, wrongRows = 0, wrongAdvice = 0;
for (let a = 1; a <= 400; a++) {
  const bits = a.toString(2);
  if (P.binary(a) !== bits) wrongBits++;
  for (let b = 1; b <= 400; b++) {
    const r = P.multiply(a, b);
    if (r.product !== a * b) wrongProduct++;
    if (r.rows.length !== Math.floor(Math.log2(a)) + 1) wrongRows++;
    if (a <= b && r.rows.length > P.multiply(b, a).rows.length) wrongAdvice++;
  }
}
equal("product correct for every pair up to 400", wrongProduct, 0);
equal("binary digits for every number up to 400", wrongBits, 0);
equal("rows = floor(log2 a) + 1", wrongRows, 0);
equal("smaller number first never needs more rows", wrongAdvice, 0);

const rand = rng(7);
let bad = 0;
for (let i = 0; i < 20000; i++) {
  const a = 1 + Math.floor(rand() * 9999), b = 1 + Math.floor(rand() * 9999);
  if (P.multiply(a, b).product !== a * b) bad++;
}
equal("20,000 random four-digit pairs", bad, 0);

// digit editing
equal("autonomous: 85 tens up", P.bump(85, 2, 0, 1, true), 95);
equal("autonomous: 95 tens up wraps to 05", P.bump(95, 2, 0, 1, true), 5);
equal("autonomous: units 5 down", P.bump(85, 2, 1, -1, true), 84);
equal("connected: 99 units up stays 99", P.bump(99, 2, 1, 1, false), 99);
equal("connected: 85 tens up", P.bump(85, 2, 0, 1, false), 95);
equal("connected: 9 down at the bottom stays 1", P.bump(1, 1, 0, -1, false), 1);
equal("numbers are kept in range", [P.clampNumber(0, 2), P.clampNumber(500, 2), P.clampNumber("7", 1)], [1, 99, 7]);
const s = P.start({ digits: 1, a: 85, b: 18 });
equal("fewer digits shrink the numbers", [s.a, s.b], [9, 9]);

done("peasant-multiplication");
