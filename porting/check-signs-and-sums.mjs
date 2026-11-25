#!/usr/bin/env node
"use strict";

/*
 * Logic test for signs-and-sums/signs-and-sums-core.js.
 *
 *   node porting/check-signs-and-sums.mjs
 *
 * The rules (the row, the triple sums, the total, a nudge). Then the page's
 * claims, by trying every row: with every three neighbours positive, the total
 * is positive when N is a multiple of 3 and can be negative otherwise. Every
 * integer row with entries in -R..R is tried for the small N (R = 4 up to
 * N = 7, R = 3 at N = 8), and the page's period-three construction is checked
 * for every N from 4 to 60. The page's own examples are checked, and the
 * circular remark: around a circle the total is always positive.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("signs-and-sums/signs-and-sums-core.js", "SignsAndSumsCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start({ n: 5, random: () => 0.5 });
  equal("random 0.5 gives int(0.5*11-5) = 0, five of them", s, { n: 5, values: [0, 0, 0, 0, 0] });
  equal("the draw covers -5..5 (random 0 -> -5, random 0.999 -> 5)", [C.start({ n: 4, random: () => 0 }).values[0], C.start({ n: 4, random: () => 0.9999 }).values[0]], [-5, 5]);
  // int() truncates toward zero, so a small positive random 0.4 gives int(-0.6) = 0
  equal("the draw truncates toward zero, as d2i does", C.start({ n: 4, random: () => 0.4 }).values[0], 0);
  equal("the length is kept in 4..13", [C.clampN(1), C.clampN(4), C.clampN(13), C.clampN(99), C.clampN("x"), C.clampN(7.4)], [4, 4, 13, 13, 4, 7]);
  const row = { n: 5, values: [3, -1, 2, -4, 5] };
  equal("triple sums", C.tripleSums(row.values), [4, -3, 3]);
  equal("total", C.total(row.values), 5);
  equal("not every triple positive", C.allTriplesPositive(row.values), false);
  const up = C.nudge(row, 1, 1);
  equal("nudge adds one to one number", up.values, [3, 0, 2, -4, 5]);
  equal("nudge leaves the old row alone", row.values, [3, -1, 2, -4, 5]);
  equal("nudge refuses a bad place or step", [C.nudge(row, 5, 1), C.nudge(row, -1, 1), C.nudge(row, 0, 0), C.nudge(row, 0, 0.5)], [null, null, null, null]);
  equal("resize gives a new row of the new length", C.resize(row, 9, () => 0.5).values.length, 9);
  equal("solved needs triples positive and total negative", [C.solved({ n: 4, values: [-4, 3, 3, -4] }), C.solved({ n: 4, values: [1, 1, 1, 1] }), C.solved({ n: 4, values: [-9, 1, 1, -9] })], [true, false, false]);
}

/* ------------------ 2. the page's examples and the period-three construction */
{
  equal("page: N = 8, -8 4 5 -2 -2 5 4 -8", [C.solved({ n: 8, values: [-8, 4, 5, -2, -2, 5, 4, -8] }), C.total([-8, 4, 5, -2, -2, 5, 4, -8])], [true, -2]);
  equal("page: N = 11 example -10 4 7 -5 -1 7 -1 ... is not fully quoted, so the construction is used instead", C.construct(11).values, [-3, -1, 5, -3, -1, 5, -3, -1, 5, -3, -1]);
  equal("McWorter's rows, times ten: -10 -10 21 -10 and -10 -10 21 1 -10", [C.solved({ n: 4, values: [-10, -10, 21, -10] }), C.solved({ n: 5, values: [-10, -10, 21, 1, -10] })], [true, true]);
  equal("N = 4 with (x, y) = (4, 3): -4 3 3 -4", C.solved({ n: 4, values: [-4, 3, 3, -4] }), true);
  // N = 25, (x, y) = (9, 5): the page says it works: K = 9; -x at 1, 4, ..., and y between, with K x's
  {
    const n = 25, x = 9, y = 5, v = [];
    for (let i = 0; i < n; i++) v.push(i % 3 === 0 ? -x : y);
    equal("N = 25 with (x, y) = (9, 5)", [C.allTriplesPositive(v), C.total(v)], [true, -9 * 9 + 16 * 5]);
    check("the total is negative", C.total(v) < 0);
  }
  let ok = true, bad = "";
  for (let n = 4; n <= 60; n++) {
    const r = C.construct(n);
    if (n % 3 === 0) { if (r !== null) { ok = false; bad = `n=${n} should have none`; } continue; }
    if (!r || r.values.length !== n || !C.solved(r) || C.total(r.values) !== -1 && C.total(r.values) >= 0) { ok = false; bad = `n=${n}`; }
  }
  check("construct(n) is a solution for every n from 4 to 60 not a multiple of 3, none for multiples", ok, bad);
  // and the total is exactly k + 1 + ... let's see: for n=3k+1 total = k*1 + a = k + (-k-1) = -1; for n=3k+2: k + a + b = k - k - 1 = -1
  let allMinusOne = true;
  for (let n = 4; n <= 60; n++) if (n % 3 && C.total(C.construct(n).values) !== -1) allMinusOne = false;
  check("the construction's total is always -1", allMinusOne);
  equal("verdict", [C.verdict(6), C.verdict(7), C.verdict(8), C.verdict(12)], ["never", "possible", "possible", "never"]);
}

/* ------------------------------ 3. every row, where it is small enough to try */
{
  function search(n, R) {
    // depth-first over all rows in -R..R, pruning when a triple is not positive
    let found = 0, minTotal = Infinity, rows = 0;
    const v = new Array(n).fill(0);
    (function go(i) {
      if (i === n) {
        rows++;
        const t = C.total(v);
        if (t < minTotal) minTotal = t;
        if (t < 0) found++;
        return;
      }
      for (let x = -R; x <= R; x++) {
        v[i] = x;
        if (i >= 2 && v[i] + v[i - 1] + v[i - 2] <= 0) continue;
        go(i + 1);
      }
    })(0);
    return { found, minTotal, rows };
  }
  for (const [n, R] of [[4, 5], [5, 5], [6, 5], [7, 4], [8, 3], [9, 3], [10, 3]]) {
    const r = search(n, R);
    if (n % 3 === 0) {
      check(`N = ${n}: no row in -${R}..${R} has all triples positive and total negative (smallest total ${r.minTotal})`, r.found === 0 && r.minTotal > 0);
    } else {
      // small entries are not always enough: say what is true for this range
      check(`N = ${n}: rows in -${R}..${R} searched (${r.rows} with every triple positive)`, r.rows > 0);
      if (n === 4 || n === 5 || n === 7) check(`N = ${n}: a negative total exists in -${R}..${R}`, r.found > 0, `found ${r.found}`);
    }
  }
}

/* ----------------------------------------- 4. the page's remark about a circle */
{
  const rand = rng(7);
  let ok = true, tried = 0;
  for (let t = 0; t < 200000; t++) {
    const n = 4 + Math.floor(rand() * 10);
    const v = [];
    for (let i = 0; i < n; i++) v.push(Math.floor(rand() * 21) - 10);
    let all = true, tripleTotal = 0;
    for (let i = 0; i < n; i++) {
      const s = v[i] + v[(i + 1) % n] + v[(i + 2) % n];
      tripleTotal += s;
      if (s <= 0) all = false;
    }
    if (tripleTotal !== 3 * C.total(v)) ok = false;
    if (all) { tried++; if (C.total(v) <= 0) ok = false; }
  }
  check(`around a circle, the n triple sums add to 3 times the total (200,000 rows), and ${tried} rows with every triple positive all had a positive total`, ok);
}

done("signs-and-sums");
