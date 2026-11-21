#!/usr/bin/env node
"use strict";

/*
 * Logic test for langman-paradox/langman-paradox-core.js.
 *
 *   1. Fibonacci configuration and shoelace areas of the pieces.
 *   2. For n = 4..12: area conservation, a one-unit Cassini discrepancy and
 *      agreement between the two arrangements' piece totals.
 *   3. The Cheat setting changes only the drawn sliver, not the pieces.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("langman-paradox/langman-paradox-core.js", "LangmanParadoxCore");

{
  equal("F(6)", C.fibonacci(6), 8);
  equal("F(7)", C.fibonacci(7), 13);
  equal("index clamped", C.clamp(99, 6), 12);
  const s = C.start();
  equal("default n", s.n, 6);
  equal("default cheat off", s.cheat, false);
  equal("toggle cheat", C.toggleCheat(s).cheat, true);
  equal("set n", C.setN(s, 9).n, 9);
  const r = C.analyze(s);
  equal("square side", r.f, 8);
  equal("rectangle sides", `${r.a} by ${r.f + r.a}`, "5 by 13");
  equal("square area", r.squareArea, 64);
  equal("rectangle area", r.rectangleArea, 65);
  equal("three pieces", r.square.length, 3);
  check("areas conserved", r.conserved);
  equal("discrepancy is one", Math.abs(r.discrepancy), 1);
  equal("Cassini matches", r.cassini, r.discrepancy);
  check("the false arrangement differs by one unit", Math.abs(r.pieceTotal - r.drawnTotal) === 1);
}

{
  let conserved = 0;
  let oneUnit = 0;
  let cassini = 0;
  let cases = 0;
  for (let n = 4; n <= 12; n++) {
    const r = C.analyze({ n, cheat: false });
    cases++;
    if (r.conserved) conserved++;
    if (Math.abs(r.discrepancy) === 1) oneUnit++;
    if (r.cassini === r.discrepancy) cassini++;
  }
  equal("all sizes checked", cases, 9);
  equal("areas always conserved", conserved, cases);
  equal("the rectangle always differs by one", oneUnit, cases);
  equal("Cassini always matches", cassini, cases);
}

{
  const plain = C.analyze({ n: 6, cheat: false });
  const cheated = C.analyze({ n: 6, cheat: true });
  equal("cheat does not change piece areas", cheated.pieceTotal, plain.pieceTotal);
  equal("cheat does not change the discrepancy", cheated.discrepancy, plain.discrepancy);
  check("cheat widens the drawn sliver", C.polygonArea(cheated.sliver) > C.polygonArea(plain.sliver));
  const thin = C.sliver(6, false);
  check("the sliver follows the false diagonal", thin[0].x === 8 && thin[0].y === 5 && thin[1].x === 13 && thin[1].y === 0);
}

done("langman-paradox");
