#!/usr/bin/env node
"use strict";

/*
 * Logic test for infinite-latin-square/infinite-latin-square-core.js.
 *
 *   1. The XOR entry formula and the doubling construction agree on every
 *      level 1..6.
 *   2. Every 2^n corner square is Latin, and contains exactly 0..2^n-1.
 *   3. The colouring modulo m is consistent with the raw entries.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("infinite-latin-square/infinite-latin-square-core.js", "InfiniteLatinSquareCore");

{
  equal("entry (0,0)", C.value(0, 0), 0);
  equal("entry (3,5)", C.value(3, 5), 6);
  equal("the first corner is 1x1", C.size(0), 1);
  equal("level clamped", C.clamp(99, 3), 6);
  equal("default level", C.start().level, 3);
  check("the XOR square is Latin for every level", (() => {
    for (let level = 0; level <= 6; level++) if (!C.isLatin(C.square(level, 0))) return false;
    return true;
  })());
}

{
  let agrees = 0;
  let latin = 0;
  let complete = 0;
  let built = [[0]];
  for (let level = 0; level <= 6; level++) {
    const rows = C.square(level, 0);
    if (C.isLatin(rows)) latin++;
    const n = C.size(level);
    const values = [...new Set(rows.flat())].sort((a, b) => a - b);
    if (values.length === n && values.every((v, i) => v === i)) complete++;
    if (JSON.stringify(built) === JSON.stringify(rows)) agrees++;
    built = C.double(built);
  }
  equal("all seven levels checked", latin, 7);
  equal("every corner is Latin", latin, 7);
  equal("every corner uses exactly 0..2^n-1", complete, 7);
  equal("doubling matches the XOR formula", agrees, 7);

  const raw = C.square(3, 0);
  const colored = C.square(3, 5);
  check("modulo colouring matches the raw square", raw.every((row, i) => row.every((v, j) => colored[i][j] === v % 5)));
}

done("infinite-latin-square");
