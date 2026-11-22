#!/usr/bin/env node
"use strict";

/*
 * Logic test for other-primes/other-primes-core.js.
 *
 *   node porting/check-other-primes.mjs
 *
 * Checks the page's claims over every case that fits: the table's first rows
 * and columns, that the "x" view is the odd multiplication table, and the
 * theorem (x > 2 is prime iff (x-1)/2 is not in the table) for every odd x
 * the biggest table can judge, against trial division.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("other-primes/other-primes-core.js", "OtherPrimesCore");

const isPrime = (x) => { if (x < 2) return false; for (let d = 2; d * d <= x; d++) if (x % d === 0) return false; return true; };

/* ------------------------------------------------------------ 1. the rules */
{
  const t = C.table(C.start({ dim: 4 }));
  equal("row 0 is 4, 7, 10, 13", t[0], [4, 7, 10, 13]);
  equal("row 1 starts 7 and steps by 5", t[1], [7, 12, 17, 22]);
  equal("row 2 starts 10 and steps by 7", t[2], [10, 17, 24, 31]);
  equal("column 0 equals row 0", t.map((r) => r[0]), t[0]);
  const x = C.table(C.start({ dim: 3, showX: true }));
  equal("x view, first row: odd multiples of 3", x[0], [9, 15, 21]);
  equal("x view, second row: odd multiples of 5", x[1], [15, 25, 35]);
  equal("defaults", C.start({}), { dim: 10, showX: false });
  equal("dimension is clamped to 2..30", [C.start({ dim: 1 }).dim, C.start({ dim: 99 }).dim], [2, 30]);
}

/* ------------------------------------------- 2. every case, where it is small */
{
  // the table is symmetric, and each cell is (2i+3)(2j+3) as x
  let ok = true;
  for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) {
    if (C.entry(i, j) !== C.entry(j, i)) ok = false;
    const [a, b] = C.factors(i, j);
    if (C.xOf(i, j) !== a * b) ok = false;
  }
  check("symmetric, and x = (2i+3)(2j+3) in all 900 cells", ok);

  // the theorem: every odd x from 3 up to what a 30 x 30 table can decide.
  const limit = C.reliableLimit(30);
  let bad = 0, n = 0;
  for (let x = 3; x <= limit; x += 2) {
    n++;
    if (C.primeByTable(x, 30) !== isPrime(x)) bad++;
  }
  check(`theorem agrees with trial division for ${n} odd x up to ${limit}`, bad === 0, `${bad} disagree`);

  // the "x" view lists odd composites only: no prime, and every one up to the limit
  const seen = new Set();
  for (const r of C.table({ dim: 30, showX: true })) for (const v of r) seen.add(v);
  let leaked = 0, missing = 0;
  for (let x = 3; x <= limit; x += 2) {
    const inTable = seen.has(x);
    if (isPrime(x) && inTable) leaked++;
    if (!isPrime(x) && !inTable) missing++;
  }
  check("no prime ever appears in the x table", leaked === 0);
  check("every odd composite up to the limit appears in the x table", missing === 0);
  // beyond the limit a small table may miss a composite, but never calls a prime composite
  let wrongComposite = 0, missed = 0;
  for (let x = limit + 2; x <= 20001; x += 2) {
    const r = C.primeByTable(x, 30);
    if (isPrime(x) && r === false) wrongComposite++;
    if (!isPrime(x) && r === true) missed++;
  }
  check("a prime is never called composite, however big x", wrongComposite === 0);
  check("a 30 x 30 table does miss some big composites (e.g. 3 x 101 = 303)", missed > 0 && C.primeByTable(303, 30) === true);
  check("2 is not judged (even)", C.primeByTable(2, 10) === null && C.primeByTable(4, 10) === null);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // The applet: row r, column c (1-based) shows 4+3c' ... written out as in
  // its description: the first row is 4+3k, each next row's difference is 2 more.
  let ok = true;
  for (let dim = 2; dim <= 30; dim++) {
    const t = C.table(C.start({ dim }));
    let first = 4, diff = 3;
    for (let i = 0; i < dim; i++) {
      let v = first;
      for (let j = 0; j < dim; j++) { if (t[i][j] !== v) ok = false; v += diff; }
      first += 3; diff += 2;
    }
  }
  check("rows built row by row (start +3, step +2) match, dim 2..30", ok);
}

done("other-primes");
