#!/usr/bin/env node
"use strict";

/*
 * Logic test for soroban/soroban-core.js.
 *
 *   node porting/check-soroban.mjs
 *
 * 1. The page's claim: with one bead worth r/2 above the bar and r/2 - 1
 *    below, every even base r from 2 to 20 shows each digit 0..r-1 exactly
 *    one way, so 7 wires show every number below r^7.
 * 2. The clicks, against a literal transcription of Wire.CheckBone, from
 *    every bead arrangement a wire can be in (all of them reached by
 *    clicking) and every click, for every radix.
 * 3. The heaven bead's exchange (all earth beads up, push the heaven bead:
 *    r/2 - 1 becomes r/2), the digits written under the wires and the
 *    decimal value, the ranges.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("soroban/soroban-core.js", "SorobanCore");

{
  let unique = true, all = true;
  for (const r of C.RADICES) {
    const s = C.start({ radix: r, wires: 1 });
    const half = r / 2, earth = half - 1;
    const seen = new Map();
    // every arrangement reachable by clicking: earth beads at the bar form a block next to it
    for (let ones = 0; ones <= earth; ones++) for (const h of [false, true]) {
      const t = { ...s, wires: [{ earth: Array.from({ length: earth }, (_, j) => j >= earth - ones), heaven: h }] };
      const v = C.value(t, 0);
      if (seen.has(v)) unique = false;
      seen.set(v, true);
    }
    for (let d = 0; d < r; d++) if (!seen.has(d) || C.value(C.setDigit(s, 0, d), 0) !== d) all = false;
    if (seen.size !== r) all = false;
  }
  check("in every even base 2..20, each digit 0..r-1 has exactly one bead picture", unique && all);
  const big = C.start({ radix: 10 });
  let t = big;
  [1, 2, 3, 4, 5, 6, 7].forEach((d, i) => { t = C.setDigit(t, i, d); });
  equal("seven decimal wires read 1234567", C.reading(t).decimal, 1234567);
  let u = C.start({ radix: 16, wires: 3 });
  [15, 0, 10].forEach((d, i) => { u = C.setDigit(u, i, d); });
  equal("base 16: F0A is 3850", `${C.reading(u).inRadix} ${C.reading(u).decimal}`, "F0A 3850");
}

{
  // literal CheckBone: bones = earth (0..e-1) then the heaven bead (index e)
  function literal(r, earth, heaven, L4) {
    const bones = earth.concat([heaven]);
    const size = bones.length;
    const value = () => { let v = 0; for (let i = 0; i < size - 1; i++) if (bones[i]) { v = size - 1 - i; break; } if (bones[size - 1]) v += size; return v; };
    if (L4 === size - 1) {
      if (!bones[L4] && value() === r / 2 - 1) for (let i = 0; i < size - 1; i++) bones[i] = false;
      bones[L4] = !bones[L4];
    } else if (bones[L4]) for (let i = 0; i <= L4; i++) bones[i] = false;
    else for (let i = L4; i < size - 1; i++) bones[i] = true;
    return bones;
  }
  let same = true, n = 0;
  for (const r of C.RADICES) {
    const e = r / 2 - 1;
    for (let mask = 0; mask < 2 ** (e + 1); mask++) {
      const earth = Array.from({ length: e }, (_, j) => !!(mask >> j & 1)), heaven = !!(mask >> e & 1);
      const s = { radix: r, wires: [{ earth, heaven }] };
      for (let k = 0; k <= e; k++) {
        n++;
        const got = C.click(s, 0, k === e ? "heaven" : k);
        const want = literal(r, earth.slice(), heaven, k);
        if (JSON.stringify(got.wires[0].earth.concat([got.wires[0].heaven])) !== JSON.stringify(want)) same = false;
      }
    }
  }
  check(`clicks match a literal Wire.CheckBone on every bead picture and bead (${n} cases)`, same);
}

{
  let s = C.start();
  equal("defaults: base 10, 7 wires, all zero", `${s.radix} ${s.wires.length} ${C.reading(s).inRadix}`, "10 7 0");
  s = C.click(s, 6, 0);
  equal("clicking the farthest earth bead of the last wire pushes all four: 4", C.value(s, 6), 4);
  s = C.click(s, 6, "heaven");
  equal("then the heaven bead: four ones become one five", C.value(s, 6), 5);
  s = C.click(s, 6, 2);
  equal("then two earth beads: 7", C.value(s, 6), 7);
  s = C.click(s, 6, 2);
  equal("clicking a bead at the bar pulls it and those beyond it away: 6", C.value(s, 6), 6);
  s = C.click(s, 5, "heaven");
  equal("leading zeros are left out: '', ..., '5', '6'", C.reading(s).digits.join("|"), "|||||5|6");
  equal("binary: one heaven bead worth 1 and no earth beads", JSON.stringify(C.start({ radix: 2, wires: 1 }).wires[0]), JSON.stringify({ earth: [], heaven: false }));
  equal("radix 20: 9 earth beads", C.start({ radix: 20 }).wires[0].earth.length, 9);
  check("odd or out-of-range choices fall back", C.start({ radix: 7 }).radix === 10 && C.start({ wires: 50 }).wires.length === 10);
  check("bad clicks are refused", C.click(s, 9, 0) === null && C.click(s, 0, 7) === null);
  const before = JSON.stringify(s);
  C.click(s, 0, 0);
  equal("a click leaves the old position alone", JSON.stringify(s), before);
}

done("soroban");
