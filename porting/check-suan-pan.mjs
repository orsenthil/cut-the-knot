#!/usr/bin/env node
"use strict";

/*
 * Logic test for suan-pan/suan-pan-core.js.
 *
 *   node porting/check-suan-pan.mjs
 *
 * 1. The page's claim: with r/2 earth beads and two heaven beads worth r/2,
 *    a wire holds every value 0 .. 3r/2, more than the digits 0 .. r-1, so
 *    one bead in each region is redundant (some values have two pictures).
 * 2. The tidying keeps the number: from thousands of random click sequences
 *    in every radix, the number on the frame before and after the trades
 *    and carries is the same (unless the leftmost wire overflows), and once
 *    settled every wire holds a digit below r with at most one heaven bead.
 * 3. The applet's steps: four ones then a fifth become a five after 6 ticks;
 *    two fives become a carry; 9 + 1 ripples along; the clicks match the
 *    applet's CheckBone.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("suan-pan/suan-pan-core.js", "SuanPanCore");

{
  let ok = true, redundant = true;
  for (const r of C.RADICES) {
    const half = r / 2, seen = new Map();
    for (let ones = 0; ones <= half; ones++) for (let h = 0; h <= 2; h++) {
      const s = { radix: r, wires: [{ earth: Array.from({ length: half }, (_, j) => j >= half - ones), heaven: [h >= 1, h >= 2], alert: 0 }] };
      const v = C.value(s, 0);
      seen.set(v, (seen.get(v) || 0) + 1);
    }
    for (let v = 0; v <= 3 * half; v++) if (!seen.has(v)) ok = false;
    if (Math.max(...seen.keys()) !== 3 * half) ok = false;
    if (![...seen.values()].some((c) => c > 1)) redundant = false;
  }
  check("every wire holds each value 0 .. 3r/2, in every even base 2..20", ok);
  check("some values have two bead pictures: a bead in each region is redundant", redundant);
}

{
  const R = rng(4);
  let kept = true, tidy = true, runs = 0;
  for (let k = 0; k < 4000; k++) {
    const r = C.RADICES[k % C.RADICES.length], n = 1 + Math.floor(R() * 6);
    let s = C.start({ radix: r, wires: n });
    // a few clicks, settling in between
    for (let c = 0; c < 4; c++) {
      const i = Math.floor(R() * n), half = r / 2;
      const choice = Math.floor(R() * (half + 2));
      const bead = choice < half ? choice : choice === half ? "h0" : "h1";
      s = C.settle(s);
      const before = C.total(s);
      const t = C.click(s, i, bead);
      const mid = C.total(t);
      const after = C.settle(t);
      runs++;
      // only what spills off the leftmost wire may be lost: a multiple of r^n
      const overflow = mid - C.total(after) > 0 && (mid - C.total(after)) % r ** n === 0;
      if (C.total(after) !== mid && !overflow) { if (kept) console.log('  case', r, n, JSON.stringify(t.wires.map((w) => [w.earth.map(Number).join(''), w.heaven.map(Number).join('')])), mid, C.total(after)); kept = false; }
      for (let i2 = 0; i2 < n; i2++) {
        const w = after.wires[i2];
        if (C.value(after, i2) >= r || (w.heaven[0] && w.heaven[1]) || w.earth.every(Boolean)) tidy = false;
      }
      s = after;
      void before;
    }
  }
  check(`the trades and carries never change the number, except what spills off the left (${runs} clicks, every radix)`, kept);
  check("once settled, every wire holds a digit below r, one heaven bead at most", tidy);
}

{
  let s = C.start();
  s = C.click(s, 6, 1);
  equal("four earth beads on the last wire: 4", C.value(s, 6), 4);
  check("nothing to tidy yet", !C.busy(s));
  s = C.click(s, 6, 0);
  equal("the fifth one: 5, and the wire starts its countdown", `${C.value(s, 6)} ${s.wires[6].alert}`, "5 6");
  for (let k = 0; k < 5; k++) s = C.tick(s);
  equal("after 5 ticks still five ones", s.wires[6].earth.filter(Boolean).length, 5);
  s = C.tick(s);
  check("after the 6th tick a heaven bead instead", s.wires[6].heaven[0] && !s.wires[6].earth.some(Boolean) && C.value(s, 6) === 5);
  s = C.click(s, 6, "h1");
  equal("two heaven beads: 10, waiting to carry", `${C.value(s, 6)} ${s.wires[6].carry}`, "10 true");
  s = C.settle(s);
  equal("carried: 1 on the next wire, 0 here", C.reading(s).digits.slice(5).join("|"), "1|0");
  let t = C.start({ wires: 3 });
  for (const [i, b] of [[0, 1], [0, "h0"], [1, 1], [1, "h0"], [2, 1], [2, "h0"]]) t = C.settle(C.click(t, i, b));
  equal("999", C.total(t), 999);
  t = C.settle(C.click(t, 2, 0));
  equal("adding one to the units of 999 carries off the frame: 000 (the device has no fourth wire)", C.total(t), 0);
  let u = C.start({ wires: 4 });
  for (const [i, b] of [[1, 1], [1, "h0"], [2, 1], [2, "h0"], [3, 1], [3, "h0"]]) u = C.settle(C.click(u, i, b));
  u = C.settle(C.click(u, 3, 0));
  equal("on four wires 999 + 1 ripples to 1000", C.total(u), 1000);
  equal("defaults: base 10, 7 wires, 5 earth beads", `${C.start().radix} ${C.start().wires.length} ${C.start().wires[0].earth.length}`, "10 7 5");
  check("bad clicks are refused", C.click(u, 9, 0) === null && C.click(u, 0, 5) === null);
  const before = JSON.stringify(u);
  C.tick(C.click(u, 0, 0));
  equal("clicks and ticks leave the old position alone", JSON.stringify(u), before);
}

done("suan-pan");
