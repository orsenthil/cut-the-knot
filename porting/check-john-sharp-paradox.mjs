#!/usr/bin/env node
"use strict";

/*
 * Logic test for john-sharp-paradox/john-sharp-paradox-core.js.
 *
 *   1. Fibonacci numbers, the shoelace formula and the classic 13-by-13 case.
 *   2. For n = 4..12: the three pieces conserve the square's area, the
 *      rectangle outline differs by exactly one, and Cassini's identity gives
 *      that same signed difference.
 *   3. Controls and the revealed state.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("john-sharp-paradox/john-sharp-paradox-core.js", "JohnSharpParadoxCore");

{
  equal("F(7)", C.fibonacci(7), 13);
  equal("F(6)", C.fibonacci(6), 8);
  equal("F(8)", C.fibonacci(8), 21);
  equal("index clamped low", C.clamp(0, 7), 4);
  equal("index clamped high", C.clamp(99, 7), 12);
  const s = C.start();
  equal("default index", s.n, 7);
  equal("default not revealed", s.revealed, false);
  equal("set index", C.setN(s, 9).n, 9);
  equal("reveal toggles", C.reveal(s).revealed, true);

  equal("unit square area", C.polygonArea([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]), 1);
  const r = C.analyze(s);
  equal("classic square side", r.f, 13);
  equal("classic rectangle sides", `${r.a}×${r.f + r.a}`, "8×21");
  equal("classic square area", r.squareArea, 169);
  equal("classic rectangle area", r.rectangleArea, 168);
  equal("three pieces", r.square.length, 3);
  check("piece areas are conserved", r.conserved);
  equal("the discrepancy is one square", r.discrepancy, 1);
  equal("Cassini gives the same value", r.cassini, 1);
}

{
  let conserved = 0;
  let oneUnit = 0;
  let cassini = 0;
  let cases = 0;
  for (let n = 4; n <= 12; n++) {
    const r = C.analyze({ n, revealed: false });
    cases++;
    if (r.conserved) conserved++;
    if (Math.abs(r.discrepancy) === 1) oneUnit++;
    if (r.cassini === r.discrepancy && Math.abs(r.cassini) === 1) cassini++;
  }
  equal("all indices checked", cases, 9);
  equal("areas always conserved", conserved, cases);
  equal("the rectangle always differs by one", oneUnit, cases);
  equal("Cassini matches the discrepancy", cassini, cases);

  const sliver = C.sliver(7);
  check("the sliver follows the false diagonal", sliver[0].x === 13 && sliver[0].y === 8 && sliver[1].x === 21 && sliver[1].y === 0);
}

done("john-sharp-paradox");
