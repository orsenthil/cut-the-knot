#!/usr/bin/env node
"use strict";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, "..", "table-to-zero-game", "table-to-zero-game-core.js"), "utf8");
const S = new Function(src + "; return TableToZeroGameCore;")();

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  }
}

// Deal range 1..10
{
  const rnd = (() => {
    let i = 0;
    const seq = [0, 0.5, 0.999, 0.1];
    return () => seq[i++ % seq.length];
  })();
  const g = S.deal(2, 2, rnd);
  for (const row of g) for (const v of row) assert(v >= 1 && v <= 10, `deal ${v}`);
}

// Double row / subtract column / speed-up / undo
{
  let st = S.start({ grid: [[1, 2], [3, 4]], speedUp: false });
  st = S.doubleRow(st, 0);
  assert(JSON.stringify(st.grid) === JSON.stringify([[2, 4], [3, 4]]), "double row 0");
  st = S.subtractColumn(st, 1);
  assert(JSON.stringify(st.grid) === JSON.stringify([[2, 3], [3, 3]]), "sub col 1");
  const before = S.copyGrid(st.grid);
  st = S.undo(st);
  assert(JSON.stringify(st.grid) === JSON.stringify([[2, 4], [3, 4]]), "undo");
  st = { ...st, speedUp: true, grid: [[5, 2], [3, 4]] };
  st = S.subtractColumn(st, 0);
  // min of col0 is 3 → subtract 2 → [3,2],[1,4]
  assert(JSON.stringify(st.grid) === JSON.stringify([[3, 2], [1, 4]]), `speedUp got ${JSON.stringify(st.grid)}`);
  void before;
}

// Finished
{
  assert(S.finished(S.start({ grid: [[0, 0], [0, 0]] })), "zeros done");
  assert(!S.finished(S.start({ grid: [[0, 1]] })), "not done");
}

// Hand path: [[1,2]] → sub col0 → [[0,2]] → sub col1 ×2 → zeros (with doubles as needed).
{
  let st = S.start({ grid: [[1, 2]], speedUp: false });
  st = S.subtractColumn(st, 0);
  st = S.subtractColumn(st, 1);
  st = S.subtractColumn(st, 1);
  assert(S.finished(st), "1×2 clears by column subtracts");
}

// Reverse search finds tiny positives (1×1, 1×2).
{
  assert(S.canReachZero([[1]]), "[[1]]");
  assert(S.canReachZero([[2]]), "[[2]]");
  assert(S.canReachZero([[1, 1]]), "[[1,1]]");
  console.log("Engel reachability: tiny boards OK (full theorem is on the page)");
}

if (failed) {
  console.error(`${failed} failure(s)`);
  process.exit(1);
}
console.log("table-to-zero-game: all checks passed");
