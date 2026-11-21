#!/usr/bin/env node
"use strict";

/*
 * Logic test for item-parity/item-parity-core.js.
 *
 *   1. Row counts and the joint counting on a known pair of rows.
 *   2. Every pair of rows with 2, 4 or 6 columns and half of each colour.
 *   3. Random larger rows, swaps preserving the property, and the full even
 *      grid version with the row/column balance condition.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("item-parity/item-parity-core.js", "ItemParityCore");

{
  const s = C.start({ cols: 4, random: () => 0.5 });
  equal("four columns", s.cols, 4);
  equal("columns stay even", C.setCols(s, 7).cols, 6);
  equal("columns clamped", C.setCols(s, 99).cols, 12);
  equal("a known red-joint count", C.analyze({ cols: 4, rows: [["R", "R", "B", "B"], ["R", "B", "B", "R"]] }).red, 1);
  equal("a known blue-joint count", C.analyze({ cols: 4, rows: [["R", "R", "B", "B"], ["R", "B", "B", "R"]] }).blue, 1);
  const swapped = C.swap(s, 0, 0, 1);
  equal("a swap records a move", swapped.moves, 1);
  check("a swap keeps the row balanced", C.analyze(swapped).redTop === 2 && C.analyze(swapped).blueTop === 2);
  equal("a bad swap is ignored", C.swap(s, 3, 0, 1), s);
}

{
  let cases = 0;
  let equalCount = 0;
  for (const cols of [2, 4, 6]) {
    const half = cols / 2;
    const masks = [];
    const enumerate = (prefix, reds) => {
      if (prefix.length === cols) { if (reds === half) masks.push(prefix); return; }
      enumerate(prefix.concat(["R"]), reds + 1);
      enumerate(prefix.concat(["B"]), reds);
    };
    enumerate([], 0);
    for (const top of masks) {
      for (const bottom of masks) {
        cases++;
        if (C.rowsEqual(top, bottom)) equalCount++;
      }
    }
  }
  equal("all balanced row pairs checked", cases, 2 ** 2 + 6 ** 2 + 20 ** 2);
  equal("red joints always equal blue joints", equalCount, cases);
}

{
  const rnd = rng(399);
  let randomEqual = 0;
  for (let t = 0; t < 500; t++) {
    const state = C.start({ cols: 2 + 2 * Math.floor(rnd() * 6), random: rnd });
    if (C.analyze(state).equal) randomEqual++;
  }
  equal("random rows all balance", randomEqual, 500);

  const grid = [
    ["R", "R", "B", "B"],
    ["B", "B", "R", "R"],
    ["R", "R", "B", "B"],
    ["B", "B", "R", "R"],
  ];
  const g = C.gridEqual(grid);
  check("a balanced 4 by 4 grid has equal totals", g.equal, JSON.stringify(grid));
  equal("that grid has eight joints in total", g.red + g.blue, 8);
}

done("item-parity");
