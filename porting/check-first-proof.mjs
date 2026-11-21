#!/usr/bin/env node
"use strict";

/*
 * Logic test for first-proof/first-proof-core.js.
 *
 *   node porting/check-first-proof.mjs
 *
 * The page's theorem and its generalisation, proved by enumeration as the page invites: for EVERY
 * pattern of pin orientations (2^n of them) for n = 3 to 20, HH + HT + TT = n and HH = TT, so
 * HT = n - 2 HH; for n = 3, either all three vertices are the same (all HT) or all three are
 * different; for n = 4 it is possible to have all four equal but not all different (only three kinds);
 * and the page's table for flipping one pin (the "left" and "right" pins meet the flipped one at its
 * ends): the counts change by (0, 0, 0) or (-1, +2, -1) or (+1, -2, +1), for every pattern and
 * every pin for n up to 14, and every pattern is reached from the all-direct start by flips.
 * Also Proof #1: the count of the two classes of "orientation" around the triangle.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("first-proof/first-proof-core.js", "FirstProofCore");

const fromMask = (n, mask) => ({ ...C.start({ n }), direct: Array.from({ length: n }, (_, i) => !!(mask >> i & 1)) });

{
  const s = C.start({});
  check("the applet opens on 3 pins, all direct: HT = 3, HH = TT = 0, hint off", s.n === 3 && s.direct.every(Boolean) && C.counts(s).ht === 3 && C.counts(s).hh === 0 && C.counts(s).tt === 0 && s.hint === false && C.result(s) === null);
  check("the number of pins runs from 3 to 50", C.start({ n: 2 }).n === 3 && C.start({ n: 99 }).n === 50 && C.move(s, { type: "n", value: 51 }) === null && C.move(s, { type: "n", value: 50 }).n === 50 && C.move(s, { type: "n", value: 3 }).n === 3);
  const t = C.move(s, { type: "flip", pin: 1 });
  check("flipping a pin changes the counts: HH = TT = 1, HT = 1 (all three kinds)", t.direct.join() === "true,false,true" && JSON.stringify(C.counts(t)) === '{"hh":1,"ht":1,"tt":1}' && C.result(t) === "done");
  check("flipping twice goes back, and a pin that does not exist is refused", C.move(t, { type: "flip", pin: 1 }).direct.every(Boolean) && C.move(s, { type: "flip", pin: 3 }) === null && C.move(s, { type: "flip", pin: -1 }) === null);
  check("the old position is untouched", s.direct.every(Boolean) && s.moves === 0);
  check("a new number of pins starts again with all pins direct", C.move(t, { type: "n", value: 6 }).direct.length === 6 && C.move(t, { type: "n", value: 6 }).direct.every(Boolean));
  check("the hint switch only changes what is shown", C.move(s, { type: "hint", value: true }).hint === true && C.counts(C.move(s, { type: "hint", value: true })).ht === 3);
}

{
  let n = 0, bad = null;
  for (let size = 3; size <= 20; size++) {
    for (let mask = 0; mask < 1 << size; mask++) {
      const c = C.counts(fromMask(size, mask));
      if (c.hh + c.ht + c.tt !== size) bad = `sum n=${size} mask=${mask}`;
      if (c.hh !== c.tt) bad = `HH != TT n=${size} mask=${mask}`;
      if (c.ht !== size - 2 * c.hh) bad = `HT n=${size}`;
      n++;
    }
  }
  check(`HH + HT + TT = n and HH = TT for every one of the ${n} patterns of pins for n = 3 to 20`, bad === null, String(bad));
  // the triangle: all the same or all different
  let tri = true, kinds = new Set();
  for (let mask = 0; mask < 8; mask++) {
    const c = C.counts(fromMask(3, mask));
    const same = c.ht === 3 || c.hh === 3 || c.tt === 3;
    const diff = c.hh === 1 && c.ht === 1 && c.tt === 1;
    if (same === diff) tri = false;
    if (c.hh === 3 || c.tt === 3) tri = false;
    kinds.add(JSON.stringify(c));
  }
  check("for three pins either all vertices are the same (all head to tail) or all are different (one of each), over all 8 patterns", tri && kinds.size === 2);
  let all4same = 0, all4diff = 0;
  for (let mask = 0; mask < 16; mask++) { const c = C.counts(fromMask(4, mask)); if (c.ht === 4) all4same++; if (c.hh === 1 && c.ht === 1 && c.tt === 1) all4diff++; }
  check("with four pins all four vertices can be the same (2 patterns) but they can never all be different (only three kinds of vertex)", all4same === 2 && all4diff === 0);
  // the page's table for flipping one pin
  let bad2 = null, seen = new Set();
  for (let size = 3; size <= 14; size++) for (let mask = 0; mask < 1 << size; mask++) {
    const s0 = fromMask(size, mask), c0 = C.counts(s0);
    for (let pin = 0; pin < size; pin++) {
      const c1 = C.counts(C.move(s0, { type: "flip", pin }));
      const d = [c1.hh - c0.hh, c1.ht - c0.ht, c1.tt - c0.tt].join();
      seen.add(d);
      if (!["0,0,0", "-1,2,-1", "1,-2,1"].includes(d)) bad2 = `n=${size} mask=${mask} pin=${pin}: ${d}`;
      // which case: the two neighbouring pins (left = pin - 1, right = pin + 1) decide it
      const L = s0.direct[(pin + size - 1) % size], R = s0.direct[(pin + 1) % size];
      // the neighbours' ends that touch the flipped pin are (head, tail) when both neighbours point the same way (then the counts change)
      // and (head, head) or (tail, tail) when they point opposite ways (then nothing changes): the page's table
      if (L !== R && d !== "0,0,0") bad2 = `opposite neighbours changed the counts n=${size}`;
      if (L === R && d === "0,0,0") bad2 = `equal neighbours left the counts n=${size}`;
      if (L === R && (s0.direct[pin] === L ? d !== "1,-2,1" : d !== "-1,2,-1")) bad2 = `direction of the change n=${size}`; // like neighbours and a like pin: all HT, flipping makes HH and TT
    }
  }
  check(`flipping any pin of any pattern (n = 3 to 14) changes (HH, HT, TT) by (0,0,0) when its two neighbouring pins point opposite ways (the page's head/head and tail/tail rows), and by (-1,+2,-1) or (+1,-2,+1) when they point the same way (head/tail rows); all three changes occur`, bad2 === null && seen.size === 3, String(bad2));
  // every pattern is reached from the all-direct start by flips: trivially each pattern is a set of pins to flip
  let reach = true;
  for (let size = 3; size <= 10; size++) for (let mask = 0; mask < 1 << size; mask++) { let s0 = C.start({ n: size }); for (let i = 0; i < size; i++) if (!(mask >> i & 1)) s0 = C.move(s0, { type: "flip", pin: i }); if (s0.direct.some((d, i) => d !== !!(mask >> i & 1))) reach = false; }
  check("every pattern is reached from the all-direct start by flipping the right pins (n up to 10)", reach);
  // Proof #1: around a triangle the pins are positively or negatively oriented: the pattern is determined up to which two agree
  let p1 = true;
  for (let mask = 0; mask < 8; mask++) { const pos = [0, 1, 2].filter((i) => mask >> i & 1).length; const c = C.counts(fromMask(3, mask)); if ((pos === 0 || pos === 3) !== (c.ht === 3)) p1 = false; }
  check("Proof #1: with three pins, each pin is oriented along the triangle or against it; all three alike means all head to tail, otherwise one of each", p1);
}

done("first-proof");
