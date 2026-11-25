#!/usr/bin/env node
"use strict";

/*
 * Logic test for sums-of-two-squares/sums-of-two-squares-core.js.
 *
 *   node porting/check-sums-of-two-squares.mjs
 *
 * r2(n) by brute force against Jacobi's divisor formula for every n up to 1200;
 * the article's examples (25 gives 12, 65 gives 16); the multiplicative rule
 * from the factorisation; a direct count of unit neighbours of a scaled grid;
 * and the record holders 1, 5, 25, 65, 325, 1105.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("sums-of-two-squares/sums-of-two-squares-core.js", "TwoSquaresCore");

let mismatch = 0, ptsBad = 0;
for (let n = 1; n <= C.MAX_N; n++) {
  if (C.r2Brute(n) !== C.r2Formula(n)) mismatch++;
  for (const [a, b] of C.points(n)) if (a * a + b * b !== n) ptsBad++;
}
equal("brute force = 4 (d1 - d3) for every n up to 1200", mismatch, 0);
equal("every listed point is on the circle", ptsBad, 0);

equal("r2(25) = 12", C.r2Brute(25), 12);
equal("r2(65) = 16", C.r2Brute(65), 16);
equal("r2(1) = 4, r2(2) = 4, r2(3) = 0", [C.r2Brute(1), C.r2Brute(2), C.r2Brute(3)], [4, 4, 0]);
equal("25 = 5^2 + 0^2 = 4^2 + 3^2", C.ways(25), [[5, 0], [4, 3]]);
equal("65 = 8^2 + 1^2 = 7^2 + 4^2", C.ways(65), [[8, 1], [7, 4]]);
equal("factor(1105) = 5 13 17", C.factor(1105), [[5, 1], [13, 1], [17, 1]]);

// With n a product of primes 1 mod 4 (each to the power e), r2 = 4 * prod (e + 1).
{
  let bad = 0;
  for (let n = 1; n <= C.MAX_N; n++) {
    const f = C.factor(n);
    if (f.every(([p, e]) => p % 4 === 1 || (p === 2) || e % 2 === 0)) {
      const expect = 4 * f.filter(([p]) => p % 4 === 1).reduce((t, [, e]) => t * (e + 1), 1);
      if (C.r2Brute(n) !== expect) bad++;
    } else if (C.r2Brute(n) !== 0) bad++;
  }
  equal("r2 from the factorisation (and 0 when a 3 mod 4 prime has an odd power)", bad, 0);
}

// The grid at spacing 1/sqrt(n): count unit neighbours of the origin directly.
for (const n of [25, 65, 325]) {
  let nb = 0;
  const r = Math.ceil(Math.sqrt(n)) + 1;
  for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
    if (a === 0 && b === 0) continue;
    if (Math.abs(Math.hypot(a / Math.sqrt(n), b / Math.sqrt(n)) - 1) < 1e-9) nb++;
  }
  equal(`spacing 1/sqrt(${n}): each point has ${C.r2Brute(n)} unit neighbours`, nb, C.r2Brute(n));
}

equal("records up to 1200", C.records(1200).map(([n]) => n), [1, 5, 25, 65, 325, 1105]);
equal("r2 at the records", C.records(1200).map(([, r]) => r), [4, 8, 12, 16, 24, 32]);
equal("clampN", [C.clampN(0), C.clampN(1e6), C.clampN("65")], [1, 1200, 65]);

done("sums-of-two-squares");
