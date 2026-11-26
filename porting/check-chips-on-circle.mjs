#!/usr/bin/env node
"use strict";

/*
 * Logic test for chips-on-circle/chips-on-circle-core.js.
 *
 *   node porting/check-chips-on-circle.mjs
 *
 * 1. The page's theorem, exhaustively: for N = 4, 8, 12, 16, 20 every
 *    placement of N/2 red and N/2 green chips has a balanced half circle,
 *    and the applet's search (first start m) finds one with m < N/2, so its
 *    array never runs past the end.
 * 2. The two facts the proof uses: r changes by at most 1 from one start to
 *    the next, and r(m + 2n) = 2n - r(m). So balanced starts come in pairs
 *    m, m + 2n.
 * 3. With unequal totals there may be no balanced half (all red); with
 *    2n + 1 chips, or an odd split, the claim fails as it should.
 * 4. The applet's start (alternating, green at chip 0), flips, sizes.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("chips-on-circle/chips-on-circle-core.js", "ChipsOnCircleCore");

function* balancedPlacements(n) {
  for (let mask = 0; mask < 1 << n; mask++) {
    let c = 0;
    for (let i = 0; i < n; i++) if ((mask >> i) & 1) c++;
    if (c === n / 2) yield Array.from({ length: n }, (_, i) => !!((mask >> i) & 1));
  }
}

{
  let always = true, early = true, steps = true, opposite = true, pairs = true, total = 0;
  for (const n of [4, 8, 12, 16, 20]) for (const red of balancedPlacements(n)) {
    total++;
    const s = C.start({ n, red });
    const m = C.diameter(s);
    if (m === null) always = false;
    else if (m >= n / 2) early = false;
    for (let k = 0; k < n; k++) {
      const a = C.redsInHalf(s, k), b = C.redsInHalf(s, (k + 1) % n);
      if (Math.abs(a - b) > 1) steps = false;
      if (C.redsInHalf(s, (k + n / 2) % n) !== n / 2 - a) opposite = false;
    }
    const starts = new Set(C.balancedStarts(s));
    for (const k of starts) if (!starts.has((k + n / 2) % n)) pairs = false;
  }
  check(`every one of the ${total.toLocaleString("en")} balanced placements for N = 4..20 has a half circle with n of each`, always);
  check("the applet's search always stops at a start below N/2", early);
  check("moving the start by one changes the reds by at most 1", steps);
  check("the opposite half has the complementary count: r(m + 2n) = 2n - r(m)", opposite);
  check("so balanced halves come in opposite pairs", pairs);
}

{
  const allRed = C.start({ n: 8, red: Array(8).fill(true) });
  check("with unequal totals there may be no balanced half (all red), and no diameter is drawn", C.balancedStarts(allRed).length === 0 && C.diameter(allRed) === null);
  const lop = C.start({ n: 8, red: [true, true, true, false, false, false, false, false] });
  check("3 red and 5 green on 8: no diameter is drawn even though a half has 2 and 2", C.diameter(lop) === null && C.balancedStarts(lop).length > 0);
}

{
  const s = C.start();
  equal("the applet's start: 16 chips, green at even places", `${s.n} ${s.red.map((r) => (r ? "R" : "G")).join("")}`, "16 GRGRGRGRGRGRGRGR");
  equal("its diameter starts at chip 0", C.diameter(s), 0);
  const t = C.flip(C.flip(s, 0), 1);
  check("flipping a green and a red keeps the totals equal and a diameter is found", C.counts(t).red === 8 && C.diameter(t) !== null);
  check("one flip makes the totals unequal: no diameter", C.diameter(C.flip(s, 3)) === null);
  equal("N is held to 4..40 in steps of 4", [C.start({ n: 2 }).n, C.start({ n: 18 }).n, C.start({ n: 99 }).n].join(" "), "4 20 40");
  const before = JSON.stringify(s);
  C.flip(s, 5);
  equal("a flip leaves the old position alone", JSON.stringify(s), before);
}

done("chips-on-circle");
