#!/usr/bin/env node
"use strict";

/*
 * Logic test for gcd-lcm-rectangles/gcd-lcm-rectangles-core.js.
 *
 *   1. The ranges, defaults, gcd and the rectangle decomposition of 12 by 10.
 *   2. The page's identity M*N = gcd*lcm and the tiling counts S=(M/G)(N/G),
 *      L=S*G, L=(M/G)N=M(N/G) over the applet's whole 1..40 range.
 *   3. A second transcription of Euclid's algorithm for the gcd.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("gcd-lcm-rectangles/gcd-lcm-rectangles-core.js", "GcdLcmRectanglesCore");

{
  const s = C.start();
  equal("default M", s.m, 6);
  equal("default N", s.n, 4);
  equal("M clamped low", C.setM(s, 0).m, 1);
  equal("M clamped high", C.setM(s, 999).m, 40);
  equal("N clamped low", C.setN(s, -3).n, 1);
  equal("bad value falls back", C.clamp("x", 7), 7);

  const r = C.analyze(12, 10);
  equal("gcd of 12 and 10", r.g, 2);
  equal("squares along M", r.a, 6);
  equal("squares along N", r.b, 5);
  equal("number of squares", r.squares, 30);
  equal("lcm", r.lcm, 60);
  equal("product identity", r.product, r.g * r.lcm);
  equal("by columns", r.lcmByColumns, 60);
  equal("by rows", r.lcmByRows, 60);
}

{
  let identities = 0;
  let counts = 0;
  let common = 0;
  let pairs = 0;
  for (let m = 1; m <= 40; m++) {
    for (let n = 1; n <= 40; n++) {
      const r = C.analyze(m, n);
      pairs++;
      if (r.holds) identities++;
      if (r.lcm === r.squares * r.g && r.lcm === r.a * n && r.lcm === m * r.b) counts++;
      if (r.lcm % m === 0 && r.lcm % n === 0) common++;
    }
  }
  equal("every pair checked", pairs, 1600);
  equal("M*N = gcd*lcm everywhere", identities, pairs);
  equal("every rectangle count is consistent", counts, pairs);
  equal("the lcm is a common multiple everywhere", common, pairs);
}

function euclid(a, b) {
  while (b !== 0) { const t = a % b; a = b; b = t; }
  return Math.abs(a);
}
{
  let agreements = 0;
  for (let m = 1; m <= 100; m++) for (let n = 1; n <= 100; n++) if (C.gcd(m, n) === euclid(m, n)) agreements++;
  equal("gcd agrees with Euclid", agreements, 10000);
}

done("gcd-lcm-rectangles");
