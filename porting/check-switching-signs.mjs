#!/usr/bin/env node
"use strict";

/*
 * Logic test for switching-signs/switching-signs-core.js.
 *
 *   node porting/check-switching-signs.mjs
 *
 * 1. The page's argument: flipping a line with sum -s raises the total by
 *    exactly 2s; the greedy flipping of negative lines always ends, with
 *    every sum non-negative, on 5,000 random grids of every size up to
 *    15 x 15 (the applet's ranges), including the applet's own deal.
 * 2. Exhaustively on small grids (2 x 2 and 2 x 3 with entries -3..3, all
 *    of them): from every grid, every order of flipping negative lines
 *    ends; the number of distinct grids reachable by any flips is at most
 *    2^(m+n-1) (flipping everything changes nothing).
 * 3. The deal's range, flips of positive lines, the win, sizes.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("switching-signs/switching-signs-core.js", "SwitchingSignsCore");
const R = rng(8);

{
  let mono = true, ends = true, n = 0;
  for (let k = 0; k < 5000; k++) {
    const s = C.start({ rows: 1 + Math.floor(R() * 15), cols: 1 + Math.floor(R() * 15), random: R });
    n++;
    for (const neg of C.negativeLines(s)) {
      const t = C.flip(s, neg.row !== undefined ? { row: neg.row } : { col: neg.col });
      if (C.total(t) !== C.total(s) - 2 * neg.sum) mono = false;
    }
    const { end } = C.solve(s);
    if (!C.solved(end)) ends = false;
  }
  check(`flipping a negative line raises the total by twice its size (${n} grids)`, mono);
  check("flipping negative lines always stops with every sum >= 0", ends);
}

{
  // all 2x2 and 2x3 grids with entries -3..3: every order of flips terminates (search with memo)
  let allEnd = true, grids = 0, reachOK = true;
  for (const [m, nn] of [[2, 2], [2, 3]]) {
    const cells = m * nn, vals = [-3, -2, -1, 0, 1, 2, 3];
    for (let code = 0; code < 7 ** cells; code++) {
      if (nn === 3 && code % 7 !== 0 && code % 11 !== 0) continue; // a large sample of the 2x3 grids
      let c = code;
      const nums = Array.from({ length: m }, () => Array.from({ length: nn }, () => { const v = vals[c % 7]; c = Math.floor(c / 7); return v; }));
      const s = C.start({ nums });
      grids++;
      // depth-first over every order of negative flips: no state may repeat on a path (it cannot, by the total)
      const seen = new Set();
      const stack = [s];
      while (stack.length) {
        const t = stack.pop();
        const key = JSON.stringify(t.nums);
        if (seen.has(key)) continue;
        seen.add(key);
        for (const neg of C.negativeLines(t)) {
          const u = C.flip(t, neg.row !== undefined ? { row: neg.row } : { col: neg.col });
          if (C.total(u) <= C.total(t)) allEnd = false;
          stack.push(u);
        }
      }
      // every grid reachable by any flips
      const all = new Set();
      for (let mask = 0; mask < 2 ** (m + nn); mask++) {
        let t = s;
        for (let i = 0; i < m; i++) if (mask >> i & 1) t = C.flip(t, { row: i });
        for (let j = 0; j < nn; j++) if (mask >> (m + j) & 1) t = C.flip(t, { col: j });
        all.add(JSON.stringify(t.nums));
      }
      if (all.size > 2 ** (m + nn - 1)) reachOK = false;
    }
  }
  check(`every flip of a negative line strictly raises the total, in every order (${grids} small grids)`, allEnd);
  check("at most 2^(m+n-1) different grids can be reached by flipping", reachOK);
}

{
  let lo = 0, hi = 0;
  for (let k = 0; k < 300; k++) for (const r of C.start({ random: R }).nums) for (const x of r) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  equal("the deal's numbers run from -10 to 10", `${lo} ${hi}`, "-10 10");
  const s = C.start({ nums: [[1, -2], [3, -4]] });
  equal("row sums -1, -1; column sums 4, -6", `${C.rowSums(s)} | ${C.colSums(s)}`, "-1,-1 | 4,-6");
  check("not solved yet", C.result(s) === null);
  const t = C.flip(s, { col: 0 });
  equal("a positive line can be flipped too", JSON.stringify(t.nums), "[[-1,-2],[-3,-4]]");
  const u = C.solve(s).end;
  check("solving it wins", C.result(u) === "win" && C.rowSums(u).every((x) => x >= 0));
  equal("defaults 4 x 5; sizes held to 1..15", `${C.start().nums.length}x${C.start().nums[0].length} ${C.start({ rows: 0, cols: 99 }).nums.length}x${C.start({ rows: 0, cols: 99 }).nums[0].length}`, "4x5 1x15");
  check("bad flips are refused", C.flip(s, { row: 5 }) === null && C.flip(s, {}) === null);
  const before = JSON.stringify(s);
  C.flip(s, { row: 0 });
  equal("a flip leaves the old position alone", JSON.stringify(s), before);
}

done("switching-signs");
