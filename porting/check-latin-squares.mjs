#!/usr/bin/env node
"use strict";

/*
 * Logic test for latin-squares/latin-squares-core.js.
 *
 *   1. The cyclic square is Latin and symmetric for every size 2..9.
 *   2. Invalid grids are rejected; cycling a row preserves the Latin property
 *      while swapping two different cells breaks it.
 *   3. Controls and the two modes' solved conditions.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("latin-squares/latin-squares-core.js", "LatinSquaresCore");

{
  let latinCount = 0;
  let symmetricCount = 0;
  for (let n = 2; n <= 9; n++) {
    const grid = C.cyclic(n);
    if (C.isLatin(grid)) latinCount++;
    if (C.isSymmetric(grid)) symmetricCount++;
  }
  equal("all sizes checked", latinCount, 8);
  equal("cyclic squares are Latin", latinCount, 8);
  equal("cyclic squares are symmetric", symmetricCount, 8);

  const bad = [[1, 1], [2, 2]];
  check("a row with a repeat is rejected", !C.isLatin(bad));
  const badColumn = [[1, 2], [1, 2]];
  check("a column with a repeat is rejected", !C.isLatin(badColumn));
  check("an out-of-range symbol is rejected", !C.isLatin([[1, 3], [2, 1]]));
  check("a symmetric grid is detected", C.isSymmetric([[1, 2], [2, 1]]));
  check("a nonsymmetric grid is detected", !C.isSymmetric([[1, 2, 3], [3, 1, 2], [2, 3, 1]]));
}

{
  const s = C.start({ size: 4 });
  equal("default size", s.size, 4);
  equal("default mode is symmetric", s.symmetric, true);
  equal("size clamped", C.setSize(s, 99).size, 9);
  equal("toggle mode", C.setSymmetric(s, false).symmetric, false);
  check("a fresh grid solves both modes", C.check(s).solved && C.check(C.setSymmetric(s, false)).solved);

  const cycled = C.cycleRow(s, 0, 1);
  check("cycling one row disturbs the columns", !C.isLatin(cycled.grid));
  equal("cycling counts a move", cycled.moves, 1);
  check("the cycled row still holds each symbol once", new Set(cycled.grid[0]).size === 4);
  equal("a bad row is ignored", C.cycleRow(s, 9, 1), s);
  const swapped = C.swapCells(s, 0, 0, 1);
  check("swapping two cells breaks the Latin property", !C.isLatin(swapped.grid));
  equal("a bad swap is ignored", C.swapCells(s, 0, 0, 0), s);

  const disturbed = C.cycleRow(C.swapCells(s, 0, 0, 1), 2, -1);
  check("restore repairs the grid", C.check(C.restore(disturbed)).solved);
  equal("restore clears the moves", C.restore(disturbed).moves, 0);

  const asymmetric = { ...s, size: 3, symmetric: true, grid: [[1, 2, 3], [3, 1, 2], [2, 3, 1]] };
  check("the symmetric mode rejects a nonsymmetric grid", !C.check(asymmetric).solved);
  check("the plain mode accepts it", C.check({ ...asymmetric, symmetric: false }).solved);
}

done("latin-squares");
