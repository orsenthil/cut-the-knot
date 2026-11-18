#!/usr/bin/env node
"use strict";

/*
 * Logic test for all-permutations/all-permutations-core.js.
 *
 *   1. The range, factorial counts, cycle notation and derangements.
 *   2. Each of the three generators on every n up to 7: exactly n! distinct
 *      valid rows, correct order against a second transcription of the applet's
 *      own Recursive / Lexicographic / Heap methods, and derangement counts
 *      matching the standard recurrence.
 *   3. The top of the range (n = 8, 40,320 rows) checked by count and endpoints.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("all-permutations/all-permutations-core.js", "AllPermutationsCore");

/* ------------------------------------------------------------ 1. the basics */

{
  equal("n is clamped low", C.clampN(0), 1);
  equal("n is clamped high", C.clampN(99), 8);
  equal("a bad n falls back", C.clampN("x"), 3);
  equal("0!", C.factorial(0), 1);
  equal("7! is 5040", C.factorial(7), 5040);
  equal("the three algorithms", C.ALGORITHMS.join(","), "recursive,lexicographic,heap");

  equal("identity cycles", C.cycles([1, 2, 3]), "(1)(2)(3)");
  equal("a transposition", C.cycles([2, 1, 3]), "(1 2)(3)");
  equal("a three-cycle", C.cycles([2, 3, 1]), "(1 2 3)");
  equal("the reverse three-cycle", C.cycles([3, 1, 2]), "(1 3 2)");
  check("a derangement has no fixed point", C.isDerangement([2, 3, 1]));
  check("the identity is not a derangement", !C.isDerangement([1, 2, 3]));
  equal("a formatted row", C.formatRow([2, 1, 3], true), "2 1 3  (1 2)(3)");
}

/* --------------------------- 2. second transcriptions of the three methods */

function referenceRecursive(n) {
  const out = [];
  const value = Array(n).fill(0);
  let level = -1;
  const go = (k) => {
    level += 1;
    value[k] = level;
    if (level === n) out.push(value.slice());
    else for (let i = 0; i < n; i++) if (value[i] === 0) go(i);
    level -= 1;
    value[k] = 0;
  };
  go(0);
  return out;
}

function referenceLexicographic(n) {
  const out = [];
  const a = Array.from({ length: n }, (_, i) => i + 1);
  out.push(a.slice());
  for (let t = 1; t < C.factorial(n); t++) {
    let i = n - 1;
    while (a[i - 1] >= a[i]) i--;
    let j = n;
    while (a[j - 1] <= a[i - 1]) j--;
    const swap = (x, y) => { const z = a[x]; a[x] = a[y]; a[y] = z; };
    swap(i - 1, j - 1);
    for (let l = i, r = n - 1; l < r; l++, r--) swap(l, r);
    out.push(a.slice());
  }
  return out;
}

function referenceHeap(n) {
  const out = [];
  const a = Array.from({ length: n }, (_, i) => i + 1);
  const swap = (x, y) => { const z = a[x]; a[x] = a[y]; a[y] = z; };
  const go = (size) => {
    if (size === 1) { out.push(a.slice()); return; }
    for (let i = 0; i < size; i++) {
      go(size - 1);
      if (size % 2 === 1) swap(0, size - 1);
      else swap(i, size - 1);
    }
  };
  go(n);
  return out;
}

{
  let boards = 0;
  let derangements = 0;
  const D = [1, 0];
  for (let n = 2; n <= 7; n++) D[n] = (n - 1) * (D[n - 1] + D[n - 2]);
  for (const name of C.ALGORITHMS) {
    const reference = { recursive: referenceRecursive, lexicographic: referenceLexicographic, heap: referenceHeap }[name];
    for (let n = 1; n <= 7; n++) {
      boards++;
      const rows = C.generate(n, name);
      const expected = reference(n);
      equal(`${name}: n=${n} has ${C.factorial(n)} rows`, rows.length, C.factorial(n));
      equal(`${name}: n=${n} matches the transcribed order`, JSON.stringify(rows), JSON.stringify(expected));
      check(`${name}: n=${n} rows are all distinct`, new Set(rows.map((r) => r.join(","))).size === rows.length);
      check(`${name}: n=${n} rows are valid permutations`, rows.every((r) =>
        r.length === n && [...r].sort((a, b) => a - b).join(",") === Array.from({ length: n }, (_, i) => i + 1).join(",")));
      if (n >= 2) {
        const count = rows.filter(C.isDerangement).length;
        if (count === D[n]) derangements++;
      }
    }
  }
  equal("every generator board was checked", boards, 3 * 7);
  equal("derangement counts match the recurrence", derangements, 3 * 6);

  const lexi = C.generate(4, "lexicographic");
  check("the lexicographic rows are alphabetically ordered",
    lexi.every((r, i) => i === 0 || r.join(",") > lexi[i - 1].join(",")));
}

/* ------------------------------------- 3. the top of the range */

{
  for (const name of C.ALGORITHMS) {
    const rows = C.generate(8, name);
    equal(`${name}: n=8 has 40,320 rows`, rows.length, 40320);
    check(`${name}: n=8 rows are distinct`, new Set(rows.map((r) => r.join(","))).size === 40320);
  }
  equal("the first lexicographic row of n=8", C.generate(8, "lexicographic")[0].join(","), "1,2,3,4,5,6,7,8");
  const lexi = C.generate(8, "lexicographic");
  equal("the last lexicographic row of n=8", lexi[lexi.length - 1].join(","), "8,7,6,5,4,3,2,1");
}

done("all-permutations");
