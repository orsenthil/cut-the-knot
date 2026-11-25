#!/usr/bin/env node
"use strict";

/*
 * Logic test for napier-bones/napier-bones-core.js.
 *
 *   node porting/check-napier-bones.mjs
 *
 * Base conversion both ways for every base 3..20; every bone against the
 * definition (two digits of d * k in the base); and the page's method, checked
 * everywhere it can be: multiplying by k with the bones, adding along the
 * diagonals with carries, gives exactly the product, for every number of up to 3
 * digits in every base 3..20 where that is under 6,000 numbers per base, and
 * every multiplier 1..B-1, plus 100,000 random numbers of up to 12 digits. The
 * page's example 187 x 3 = 561 with diagonal sums 1, 4 + 2, 3 + 2 (and 0). Also
 * that each diagonal sum is at most 2 (B-1) so a carry is always less than 2.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("napier-bones/napier-bones-core.js", "NapierCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  equal("starts at base 10 with 187", [s.base, s.number], [10, 187]);
  equal("bases 3..20", [C.MIN_BASE, C.MAX_BASE, C.clampBase(1), C.clampBase(99), C.clampBase("7"), C.clampBase("x")], [3, 20, 3, 20, 7, 10]);
  equal("187 in base 10 is 187; in base 2... not allowed; in base 3 is 20221", [C.toString(187, 10), C.toString(187, 3)], ["187", "20221"]);
  equal("187 in base 16 is BB; in base 20 is 97", [C.toString(187, 16), C.toString(187, 20)], ["BB", "97"]);
  equal("0 is 0", C.toString(0, 7), "0");
  equal("reading strings: digits must be below the base, letters from A, lower case accepted", [C.fromString("187", 10), C.fromString("bb", 16), C.fromString("19", 8), C.fromString("", 10), C.fromString("1G", 16), C.fromString("1".repeat(13), 10), C.fromString(" 42 ", 10)], [187, 187, null, null, null, null, 42]);
  const t = C.setText(s, "999"), u = C.setText(s, "abc");
  equal("typing a number sets it; a bad one is refused", [t.number, u], [999, null]);
  equal("changing the base keeps the number", [C.setBase(s, 16).number, C.toString(C.setBase(s, 16).number, 16)], [187, "BB"]);
  equal("digits of 187 in base 10 and base 3", [C.digitsOf(187, 10), C.digitsOf(187, 3)], [[1, 8, 7], [2, 0, 2, 2, 1]]);
  const b7 = C.bone(7, 10);
  equal("the decimal bone of 7: 07 14 21 28 35 42 49 56 63", b7.map((c) => `${c.tens}${c.units}`), ["07", "14", "21", "28", "35", "42", "49", "56", "63"]);
  equal("a bone has B-1 rows", [C.bone(3, 5).length, C.bone(3, 20).length], [4, 19]);
  equal("multiply refuses k out of range", [C.multiply(s, 0), C.multiply(s, 10), C.multiply(s, 1.5)], [null, null, null]);
}

/* -------------------------------------- 2. the page's example */
{
  const r = C.multiply(C.start(), 3);
  equal("187 x 3: the cells of row 3 are 03, 24, 21", r.cells.map((c) => `${c.tens}${c.units}`), ["03", "24", "21"]);
  equal("the diagonals from the right add: 1, 2+4 = 6, 2+3 = 5, 0", r.diagonals.map((d) => [d.units, d.tens, d.sum]), [[1, 0, 1], [4, 2, 6], [3, 2, 5], [0, 0, 0]]);
  equal("so 187 x 3 = 561", [r.text, r.value, 187 * 3], ["561", 561, 561]);
  const carry = C.multiply({ base: 10, number: 78 }, 9);
  equal("with a carry: 78 x 9 = 702 (the diagonal 3 + 7 = 10 carries 1)", [carry.text, carry.diagonals[1].sum, carry.carries.some((c) => c > 0)], ["702", 10, true]);
}

/* ------------- 3. the method equals ordinary multiplication, everywhere it can be tried */
{
  let cases = 0, bad = 0, badConv = 0, maxDiag = 0;
  for (let base = 3; base <= 20; base++) {
    // every digit string up to this many numbers
    const limit = Math.min(Math.pow(base, 3), 6000);
    for (let n = 0; n < limit; n++) {
      if (C.fromString(C.toString(n, base), base) !== n) badConv++;
      for (let k = 1; k < base; k++) {
        cases++;
        const r = C.multiply({ base, number: n }, k);
        if (r.value !== n * k || C.fromString(r.text, base) !== n * k) bad++;
        for (const d of r.diagonals) maxDiag = Math.max(maxDiag, d.sum);
      }
    }
  }
  console.log(`  (${cases.toLocaleString()} multiplications with the bones)`);
  equal("every number of up to 3 digits (up to 6,000 per base), every k: the bones give the product", bad, 0);
  equal("every conversion string round-trips", badConv, 0);
  const r = rng(3);
  let bad2 = 0;
  for (let t = 0; t < 100000; t++) {
    const base = 3 + Math.floor(r() * 18), len = 1 + Math.floor(r() * 12);
    let n = 0; for (let i = 0; i < len; i++) n = n * base + Math.floor(r() * base);
    if (n * base > 2 ** 50 || C.toString(n, base).length > 12) continue; // stay within exact whole numbers
    const k = 1 + Math.floor(r() * (base - 1)), res = C.multiply({ base, number: n }, k);
    if (res.value !== n * k) bad2++;
  }
  equal("random numbers of up to 12 digits in random bases (those below 2^50)", bad2, 0);
  check("a diagonal adds to at most 2 (B - 1) = 38 (base 20), so a carry is below 2 B", maxDiag <= 2 * 19, String(maxDiag));
}

done("napier-bones");
