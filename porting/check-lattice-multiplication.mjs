#!/usr/bin/env node
"use strict";

/*
 * Logic test for lattice-multiplication/lattice-multiplication-core.js.
 *
 *   1. Cell products and the band sums for the page's 712*23 example.
 *   2. The page's carry example 124576*3857 and the single-digit 4566*257.
 *   3. A thousand random pairs: the lattice product always equals ordinary
 *      multiplication, and single-digit band sums need no carries.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("lattice-multiplication/lattice-multiplication-core.js", "LatticeMultiplicationCore");

{
  equal("digits of 712", C.digits(712).join(","), "7,1,2");
  const cs = C.cells(712, 23);
  equal("three columns", cs.length, 3);
  equal("two rows", cs[0].length, 2);
  equal("top-left product tens", cs[0][0].tens, 1);
  equal("top-left product units", cs[0][0].units, 4);
  equal("page's band sums", C.bands(712, 23).join(","), "1,6,3,7,6");
  const r = C.analyze({ a: 712, b: 23 });
  equal("page's product", r.product, 16376);
  check("no carries needed", !r.needsCarry);
}

{
  const big = C.analyze({ a: 124576, b: 3857 });
  equal("page's large product", big.product, 480489632);
  check("the large example needs carrying", big.needsCarry);
  const simple = C.analyze({ a: 4566, b: 257 });
  equal("page's simple product", simple.product, 1173462);
  check("the simple example's bands exceed nine", simple.bands.some((v) => v > 9));
  const manual = C.carry([1, 0, 2]);
  equal("a simple carry", manual.digits.join(""), "102");
  equal("the carry chain length", manual.steps.length, 3);
}

{
  const rnd = rng(1202);
  let correct = 0;
  let zeros = 0;
  for (let t = 0; t < 1000; t++) {
    const a = Math.floor(rnd() * 100000);
    const b = Math.floor(rnd() * 100000);
    const r = C.analyze({ a, b });
    if (r.product === a * b) correct++;
    if (!r.needsCarry) zeros++;
  }
  equal("all random pairs checked", correct, 1000);
  check("some products needed no carrying", zeros > 0 && zeros < 1000, `${zeros}`);
  const s = C.start();
  equal("default factor", s.a, 712);
  equal("set A", C.setA(s, 12).a, 12);
  equal("set B clamps negatives", C.setB(s, -3).b, 0);
}

done("lattice-multiplication");
