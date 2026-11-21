#!/usr/bin/env node
"use strict";

/*
 * Logic test for long-multiplication/long-multiplication-core.js.
 *
 *   1. The page's 23*46 and 23*761 examples, compact and full partial rows.
 *   2. A thousand random pairs: partials sum to the ordinary product, and
 *      each compact row is the first factor times one digit of the second.
 *   3. Controls.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("long-multiplication/long-multiplication-core.js", "LongMultiplicationCore");

{
  equal("digits of 761", C.digits(761).join(","), "7,6,1");
  const small = C.analyze({ a: 23, b: 46, compact: false });
  equal("page's 46 rows full", small.rows.map((r) => r.full).join(","), "138,920");
  equal("page's 46 product", small.sum, 1058);
  const big = C.analyze({ a: 23, b: 761, compact: false });
  equal("page's 761 rows full", big.rows.map((r) => r.full).join(","), "23,1380,16100");
  equal("page's 761 product", big.sum, 17503);

  const compact = C.analyze({ a: 23, b: 761, compact: true });
  equal("compact rows", compact.rows.map((r) => r.value).join(","), "23,138,161");
  equal("compact still sums correctly", compact.sum, 17503);
}

{
  const rnd = rng(761);
  let sums = 0;
  let rows = 0;
  for (let t = 0; t < 1000; t++) {
    const a = Math.floor(rnd() * 100000);
    const b = Math.floor(rnd() * 100000);
    const r = C.analyze({ a, b, compact: true });
    if (r.sum === a * b) sums++;
    let ok = true;
    r.rows.forEach((row, i) => {
      const digit = r.digitsB[r.digitsB.length - 1 - i];
      if (row.value !== a * digit) ok = false;
    });
    if (ok) rows++;
  }
  equal("all random pairs checked", sums, 1000);
  equal("partials always sum to the product", sums, 1000);
  equal("compact rows are factor times digit", rows, 1000);
}

{
  const s = C.start();
  equal("default first factor", s.a, 23);
  equal("default second factor", s.b, 761);
  check("defaults to compact", s.compact);
  equal("set A", C.setA(s, 7).a, 7);
  equal("set B clamps negatives", C.setB(s, -5).b, 0);
  equal("compact toggled", C.setCompact(s, false).compact, false);
  check("analysis marks the result correct", C.analyze(s).correct);
}

done("long-multiplication");
