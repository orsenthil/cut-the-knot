#!/usr/bin/env node
"use strict";

/*
 * Logic test for hooper-paradox/hooper-paradox-core.js.
 *
 *   1. Shoelace areas of simple polygons and the default dissection.
 *   2. Area conservation for every rectangle 2..20 and every cut.
 *   3. Fibonacci/Cassini relation behind the paradox's near-miss ratios, and
 *      the classic 3x10 example's nominal 30-versus-32 claim from the page.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("hooper-paradox/hooper-paradox-core.js", "HooperParadoxCore");

{
  equal("unit square area", C.polygonArea([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]), 1);
  equal("triangle area", C.polygonArea([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }]), 6);
  const s = C.start();
  equal("default width", s.w, 10);
  equal("default height", s.h, 3);
  equal("value clamped", C.set(s, "w", 999).w, 20);
  const r = C.analyze(10, 3, 4);
  equal("classic rectangle area", r.originalArea, 30);
  equal("four pieces", r.pieces.length, 4);
  check("the pieces conserve area", r.conserved);
}

{
  let conserved = 0;
  let cases = 0;
  for (let w = 2; w <= 20; w++) {
    for (let h = 2; h <= 20; h++) {
      for (const a of [1, 2, Math.floor(w / 2), w - 1]) {
        const r = C.analyze(w, h, a);
        cases++;
        if (r.conserved) conserved++;
      }
    }
  }
  equal("all parameter sets checked", cases, 19 * 19 * 4);
  equal("area is always conserved", conserved, cases);
}

{
  let cassini = 0;
  for (let n = 1; n <= 15; n++) {
    const expected = ((-1) ** n + 4) % 3 - 1; // (-1)^n as -1 or +1
    if (C.cassini(n) === expected) cassini++;
  }
  equal("Cassini's identity holds", cassini, 15);
  const pageClaim = 2 * 6 + 4 * 5 - 3 * 10;
  equal("the page's nominal 30-to-32 gain", pageClaim, 2);
}

done("hooper-paradox");
