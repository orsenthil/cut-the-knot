#!/usr/bin/env node
"use strict";

/*
 * Logic test for no-equilateral-triangles/no-equilateral-triangles-core.js.
 *
 *   node porting/check-no-equilateral-triangles.mjs
 *
 * The applet's fifteen triangles are exactly the equilateral triangles among
 * the ten dots (found from the distances). Then the page's answer, by trying
 * every colouring: all 1,024 have a monochromatic triangle, the fewest is 1.
 * The page's closing question, whether dots 7 and 10 are needed: they are,
 * since the other eight dots can be coloured with no monochromatic triangle,
 * and in fact every nine-dot subset can be too, so only all ten force one.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("no-equilateral-triangles/no-equilateral-triangles-core.js", "NoEquilateralTrianglesCore");

/* ------------------------------------------------------------ 1. the rules */
{
  equal("ten dots, fifteen triangles", [C.DOTS.length, C.TRIANGLES.length], [10, 15]);
  const s = C.start({ random: rng(3) });
  equal("a new game has ten colours, each 0 or 1", s.colours.length === 10 && s.colours.every((c) => c === 0 || c === 1), true);
  const flipped = C.toggle(s, 4);
  equal("clicking a dot flips only that dot", s.colours.map((c, i) => (c !== flipped.colours[i] ? i : -1)).filter((i) => i >= 0), [4]);
  equal("clicking twice restores", C.toggle(flipped, 4).colours, s.colours);
  equal("the old position is not changed", s.colours === flipped.colours, false);
  equal("no such dot", [C.toggle(s, -1), C.toggle(s, 10), C.toggle(s, 1.5)], [null, null, null]);
  equal("all one colour: every triangle is monochromatic", C.mono(C.fromBits(0)).length, 15);
  equal("the top triangle alone", C.mono({ colours: [0, 0, 0, 1, 0, 1, 1, 0, 1, 0] }).includes(0), true);
}

/* ------------------------ 2. the fifteen triangles are all the equilateral ones */
{
  const d = (i, j) => Math.hypot(C.DOTS[i].x - C.DOTS[j].x, C.DOTS[i].y - C.DOTS[j].y);
  const found = [];
  for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) for (let k = j + 1; k < 10; k++)
    if (Math.abs(d(i, j) - d(j, k)) < 1e-9 && Math.abs(d(j, k) - d(i, k)) < 1e-9) found.push([i, j, k].join());
  const listed = C.TRIANGLES.map((t) => t.slice().sort((a, b) => a - b).join());
  equal("the 15 listed are the geometric equilateral triangles", found.sort(), listed.slice().sort());
  equal("the listed triangles are all different", new Set(listed).size, 15);
}

/* ---------------------------------- 3. the answer: every colouring, all 1,024 */
const all = C.allColourings();
equal("1,024 colourings", all.total, 1024);
equal("none avoids a monochromatic triangle", all.none, 0);
equal("the fewest monochromatic triangles in any colouring is 1", all.min, 1);
console.log(`  (${all.atMin} colourings have exactly one; the most is ${all.max})`);
check("some colouring has exactly one", all.atMin > 0);

/* ----------------------- 4. the page's question: are dots 7 and 10 needed? */
{
  const everyDot = [...Array(10).keys()];
  equal("all ten dots force a monochromatic triangle", C.canAvoid(everyDot), false);
  equal("dots 1-6, 8, 9 (the ones the page's proofs use) can be coloured to avoid one", C.canAvoid(everyDot.filter((i) => i !== 6 && i !== 9)), true);
  let nineOk = 0;
  for (let skip = 0; skip < 10; skip++) if (C.canAvoid(everyDot.filter((i) => i !== skip))) nineOk++;
  equal("with any one dot removed, a colouring exists with none", nineOk, 10);
}

done("no-equilateral-triangles");
