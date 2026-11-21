#!/usr/bin/env node
"use strict";

/*
 * Logic test for item-parity-generalized/item-parity-generalized-core.js.
 *
 *   1. The generalized setup condition with unequal colour totals and odd
 *      row lengths.
 *   2. Every valid configuration for rows of length 2..6, and random larger
 *      ones: red joints equal blue joints, and the two unmatched counts agree.
 *   3. Swaps preserve the setup and the equality; invalid setups are rejected.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("item-parity-generalized/item-parity-generalized-core.js", "ItemParityGeneralizedCore");

{
  const s = C.start({ cols: 7, redTop: 3, random: () => 0.5 });
  equal("seven columns", s.cols, 7);
  check("an odd-length setup is valid", C.setupValid(s.rows));
  check("the top row has three reds", C.count(s.rows[0], "R") === 3);
  check("the bottom row has four reds", C.count(s.rows[1], "R") === 4);
  const r = C.analyze(s);
  check("the joints are equal", r.equal);
  check("unmatched reds above equal unmatched blues below", r.unmatchedRedTop === r.unmatchedBlueBottom);
  check("unmatched blues above equal unmatched reds below", r.unmatchedBlueTop === r.unmatchedRedBottom);
  const swapped = C.swap(s, 0, 0, 1);
  equal("a swap counts a move", swapped.moves, 1);
  check("a swap preserves the setup", C.setupValid(swapped.rows));
  equal("a bad swap is ignored", C.swap(s, 2, 0, 1), s);
  equal("columns clamped", C.setCols(s, 99).cols, 12);
  equal("red count clamped", C.analyze(C.setRedTop(s, 99)).redTop, 7);
}

{
  const masks = (n) => {
    const out = [];
    for (let bits = 0; bits < 2 ** n; bits++) {
      out.push(Array.from({ length: n }, (_, i) => (bits & (1 << i)) ? "R" : "B"));
    }
    return out;
  };
  let cases = 0;
  let equalCount = 0;
  let unmatchedOk = 0;
  for (let n = 2; n <= 6; n++) {
    const all = masks(n);
    for (const top of all) {
      for (const bottom of all) {
        if (!C.setupValid([top, bottom])) continue;
        const r = C.analyze({ cols: n, rows: [top, bottom], moves: 0 });
        cases++;
        if (r.equal) equalCount++;
        if (r.unmatchedRedTop === r.unmatchedBlueBottom && r.unmatchedBlueTop === r.unmatchedRedBottom) unmatchedOk++;
      }
    }
  }
  check("enough configurations were tried", cases > 100, `${cases}`);
  equal("red joints always equal blue joints", equalCount, cases);
  equal("both unmatched identities hold", unmatchedOk, cases);

  const rnd = rng(399);
  let randomEqual = 0;
  let randomCases = 0;
  for (let t = 0; t < 500; t++) {
    const cols = 2 + Math.floor(rnd() * 11);
    const state = C.start({ cols, redTop: Math.floor(rnd() * (cols + 1)), random: rnd });
    randomCases++;
    if (C.analyze(state).equal) randomEqual++;
  }
  equal("all random setups checked", randomEqual, randomCases);

  const bad = [["R", "R", "R"], ["R", "B", "B"]];
  check("an unbalanced setup is rejected", !C.setupValid(bad) && !C.rowsEqual(bad[0], bad[1]));
}

done("item-parity-generalized");
