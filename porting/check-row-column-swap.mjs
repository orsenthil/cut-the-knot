#!/usr/bin/env node
"use strict";

/*
 * Logic test for row-column-swap/row-column-swap-core.js.
 *
 *   node porting/check-row-column-swap.mjs
 *
 * Checks that row/column swaps preserve column sets, that the N=3 olympiad
 * target is unreachable by those sets, and that BFS from the start never
 * reaches the target.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("row-column-swap/row-column-swap-core.js", "RowColumnSwapCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ n: 3 });
  equal("start row-major 0..8", s.grid, [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ]);
  // display +1 → 1 2 3 / 4 5 6 / 7 8 9; col0 = {1,4,7}
  equal("first column set", C.columnSet(s.grid, 0), [0, 3, 6]);
}

{
  let s = C.start({ n: 3 });
  s = C.select(s, "row", 0);
  s = C.select(s, "row", 2);
  equal("swap rows 0 and 2", s.grid, [
    [6, 7, 8],
    [3, 4, 5],
    [0, 1, 2],
  ]);
  check("column sets unchanged after row swap", C.reachableBySets(C.initialGrid(3), s.grid));
  s = C.select(s, "col", 0);
  s = C.select(s, "col", 1);
  check("still reachable by sets after column swap", C.reachableBySets(C.initialGrid(3), s.grid));
  const back = C.undo(C.undo(s));
  equal("double Take back restores start", back.grid, C.initialGrid(3));
}

/* ------------------------------------------- 2. every case, where it is small */

{
  for (let n = 2; n <= 4; n++) {
    const start = C.initialGrid(n);
    let s = C.start({ n });
    for (let step = 0; step < 40; step++) {
      const kind = step % 2 === 0 ? "row" : "col";
      const i = step % n;
      const j = (step * 3 + 1) % n;
      if (i === j) continue;
      s = C.swap(s, i, j, kind);
      check("sets preserved n=" + n + " step=" + step, C.reachableBySets(start, s.grid));
    }
  }
}

{
  const start = C.initialGrid(3);
  const target = C.targetGrid(3);
  equal("olympiad target", target, [
    [0, 1, 2],
    [5, 4, 3],
    [6, 7, 8],
  ]);
  check("N=3 target has different column sets", C.reachableBySets(start, target) === false);

  function key(g) {
    return g.map((r) => r.join(",")).join("|");
  }
  const q = [start];
  const seen = new Set([key(start)]);
  while (q.length) {
    const g = q.shift();
    check("not the target", key(g) !== key(target));
    for (const kind of ["row", "col"]) {
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          let s = C.start({ n: 3, grid: g });
          s = C.swap(s, i, j, kind);
          const k = key(s.grid);
          if (seen.has(k)) continue;
          seen.add(k);
          q.push(s.grid);
        }
      }
    }
  }
  check("exactly 36 reachable grids", seen.size === 36);
}

/* ----------------------------- 3. second transcription */

{
  // Page olympiad fill (row-major), not the applet's column-major Reset.
  function pageInit(n) {
    const d = [];
    for (let r = 0; r < n; r++) {
      d[r] = [];
      for (let c = 0; c < n; c++) d[r][c] = r * n + c;
    }
    return d;
  }
  for (let n = 2; n <= 6; n++) {
    equal("init matches page n=" + n, C.initialGrid(n), pageInit(n));
  }
}

done("row-column-swap");
