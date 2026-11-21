#!/usr/bin/env node
"use strict";

/*
 * Logic test for lone-divider/lone-divider-core.js.
 *
 *   1. The matching algorithm on hand-built preference tables.
 *   2. On hundreds of random tables: every assigned piece is acceptable,
 *      each chooser gets at most one piece, and the divider gets the rest.
 *   3. Unsatisfiable tables are reported and the controls work.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("lone-divider/lone-divider-core.js", "LoneDividerCore");

{
  const s = C.start({ n: 4 });
  equal("four pieces", s.n, 4);
  equal("three choosers", s.table.length, 3);
  check("the default table is solvable", C.solve(s).solved);
  const all = [[true, true, true], [true, true, true]];
  equal("two choosers, three pieces", C.match(all).matched, 2);
  const none = [[true, false], [true, false]];
  equal("both choosers want the same piece", C.match(none).matched, 1);
  check("that case is not solved", !C.solve({ n: 2, table: none, divider: 0 }).solved);
  const swapped = C.toggle(s, 0, 0);
  check("a click toggles a cell", swapped.table[0][0] !== s.table[0][0]);
  equal("a bad click is ignored", C.toggle(s, 9, 0), s);
  equal("players clamped", C.setN(s, 99).n, 6);
}

{
  const rnd = rng(1977);
  let cases = 0;
  let valid = 0;
  let covered = 0;
  let solvedCount = 0;
  for (let t = 0; t < 500; t++) {
    const n = 2 + Math.floor(rnd() * 5);
    const state = C.randomize(C.setN(C.start(), n), rnd);
    const r = C.solve(state);
    cases++;
    let ok = true;
    for (const [chooser, piece] of Object.entries(r.assignments)) {
      if (!state.table[chooser][piece]) ok = false;
    }
    if (new Set(Object.values(r.assignments)).size === Object.values(r.assignments).length) ok = ok && true;
    else ok = false;
    const allPieces = [...Object.values(r.assignments), ...r.dividerPieces].sort((a, b) => a - b);
    const complete = allPieces.every((v, i) => v === i) && allPieces.length === n;
    if (ok) valid++;
    if (complete) covered++;
    if (r.solved) solvedCount++;
  }
  equal("all random tables checked", cases, 500);
  equal("assigned pieces are acceptable and unique", valid, cases);
  equal("every piece goes to someone", covered, cases);
  check("some tables were solved", solvedCount > 0 && solvedCount <= cases, `${solvedCount}`);

  const a = C.analyze(C.start({ n: 5 }));
  equal("analysis reports the divider's share", a.dividerPieces.length, 5 - Object.keys(a.assignments).length);
  check("analysis reports a solution", a.solved);
}

done("lone-divider");
