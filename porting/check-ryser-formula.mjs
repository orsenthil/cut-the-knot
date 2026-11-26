#!/usr/bin/env node
"use strict";

/*
 * Logic test for ryser-formula/ryser-formula-core.js.
 *
 *   node porting/check-ryser-formula.mjs
 *
 * 1. Ryser's formula equals the permanent (sum of n! products) on random
 *    integer matrices up to 7 x 7, including negative entries and 0/1
 *    boards, and on the article's 1..9 example (450).
 * 2. The inclusion-exclusion reason, checked directly: for every column
 *    set S, the product of row sums counts the maps rows -> S; the signed
 *    sum of those counts is the number of maps that hit every column,
 *    the bijections, n!.
 * 3. The counts: 2^n - 1 terms against n!; Ryser wins from n = 4 on and is
 *    still exponential.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("ryser-formula/ryser-formula-core.js", "RyserFormulaCore");

{
  let seed = 9, ok = true;
  const r = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 13) - 6;
  for (let k = 0; k < 400; k++) {
    const n = 1 + (k % 7);
    const m = Array.from({ length: n }, () => Array.from({ length: n }, r));
    if (C.ryser(m) !== C.perm(m)) ok = false;
  }
  check("Ryser's formula equals the permanent on 400 random matrices up to 7 x 7", ok);
  equal("the article's 1..9 matrix", C.ryser([[1, 2, 3], [4, 5, 6], [7, 8, 9]]), 450);
  let zo = true;
  for (let k = 0; k < 200; k++) { const n = 2 + (k % 5); const m = Array.from({ length: n }, () => Array.from({ length: n }, () => (r() > 0 ? 1 : 0))); if (C.ryser(m) !== C.perm(m)) zo = false; }
  check("and on 200 rook boards (0/1 matrices): it counts the placements", zo);
}
{
  let ok = true;
  for (let n = 1; n <= 7; n++) {
    let s = 0;
    for (let k = 1; k <= n; k++) { // sets of size k: C(n, k) of them, each giving k^n maps
      let binom = 1; for (let i = 0; i < k; i++) binom = (binom * (n - i)) / (i + 1);
      s += ((n - k) % 2 ? -1 : 1) * binom * k ** n;
    }
    if (BigInt(s) !== C.factorial(n)) ok = false;
  }
  check("the all-ones matrix: sum of (-1)^(n-k) C(n,k) k^n = n!, the surjections count", ok);
  const t = C.terms([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
  equal("a 3 x 3 has 7 nonempty column sets", t.length, 7);
  check("the full set's term is the product of the row sums, with a + sign", t.at(-1).product === 6 * 15 * 24 && t.at(-1).sign === 1);
}
{
  equal("multiplications at n = 3, 4, 10: Ryser vs n! products", [3, 4, 10].map((n) => `${C.ryserMults(n)}/${C.plainMults(n)}`).join(" "), "14/12 45/72 9207/32659200");
  let fromFour = true;
  for (let n = 4; n <= 40; n++) if (C.ryserMults(n) >= C.plainMults(n)) fromFour = false;
  check("Ryser uses fewer multiplications from n = 4 on", fromFour && C.ryserMults(3) > C.plainMults(3));
  let doubles = true;
  for (let n = 2; n <= 60; n++) if (C.ryserMults(n + 1) < 2n * C.ryserMults(n)) doubles = false;
  check("but its count more than doubles with every extra row: still exponential", doubles);
}
{
  const s = C.start({ n: 4 });
  check("showing the terms one by one ends at all 15", C.result(C.all(s)) === "done" && C.next(C.all(s)) === null && C.result(s) === null);
  const before = JSON.stringify(s);
  C.next(s);
  equal("a step leaves the old position alone", JSON.stringify(s), before);
}
done("ryser-formula");
