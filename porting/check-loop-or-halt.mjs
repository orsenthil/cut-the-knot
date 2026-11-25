#!/usr/bin/env node
"use strict";

/*
 * Logic test for loop-or-halt/loop-or-halt-core.js.
 *
 *   node porting/check-loop-or-halt.mjs
 *
 * The page's example 362154 (leaders 3, 2, 6, 4, 3, 5, 2, 4, 1). Then every
 * permutation of 1..N for N up to 9: the process always halts with 1 first
 * (checked against a cap far below any loop), the page's claim that the
 * largest leader leads only once, and that the largest leader strictly falls
 * from round to round. The applet's own method (the Swap routine from the
 * bytecode) is written a second time and compared. Also the longest run for
 * each N.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("loop-or-halt/loop-or-halt-core.js", "LoopOrHaltCore");

/* ------------------------------------------------------------ 1. the page's example */
{
  const rows = C.run([3, 6, 2, 1, 5, 4]);
  equal("362154 leaders", C.leaders(rows), [3, 2, 6, 4, 3, 5, 2, 4, 1]);
  equal("362154: first step is 263154, then 623154", [rows[1].join(""), rows[2].join("")], ["263154", "623154"]);
  equal("362154 ends with 1 first after 8 steps", [rows[rows.length - 1][0], C.steps([3, 6, 2, 1, 5, 4])], [1, 8]);
  equal("starting with 1: nothing to do", C.run([1, 3, 2]).length, 1);
  equal("clampN", [C.clampN(1), C.clampN(50), C.clampN("8"), C.clampN("x")], [3, 12, 8, 6]);
  const p = C.randomPermutation(10, rng(5));
  check("random permutation is one", C.isPermutation(p, 10));
  const q = [3, 1, 2]; C.step(q); equal("step does not change its argument", q, [3, 1, 2]);
}

/* -------------------------- 2. the applet's own Swap, written again from bytecode */
// Swap(k, a): b[i-1] = a[k-i] for i = 1..k, then b[i] = a[i] for i = k..N-1.
const swap = (k, a) => {
  const b = new Array(a.length);
  for (let i = 1; i <= k; i++) b[i - 1] = a[k - i];
  for (let i = k; i < a.length; i++) b[i] = a[i];
  return b;
};

/* ------------------------------------- 3. every permutation, N up to 9 */
function* perms(n) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  const c = Array(n).fill(0);
  yield a.slice();
  for (let i = 0; i < n;) {
    if (c[i] < i) { const j = i % 2 ? c[i] : 0;[a[i], a[j]] = [a[j], a[i]]; yield a.slice(); c[i]++; i = 0; } else { c[i] = 0; i++; }
  }
}
for (let n = 3; n <= 9; n++) {
  let count = 0, bad = 0, badOnce = 0, badFall = 0, badSwap = 0, longest = 0, capHit = 0;
  const cap = 100000;
  for (const p of perms(n)) {
    count++;
    let cur = p, rows = [p], s = 0;
    while (cur[0] !== 1 && s < cap) { const nx = C.step(cur); if (JSON.stringify(nx) !== JSON.stringify(swap(cur[0], cur))) badSwap++; cur = nx; rows.push(cur); s++; }
    if (s >= cap) { capHit++; continue; }
    if (cur[0] !== 1) bad++;
    longest = Math.max(longest, s);
    // the largest leader leads only once (apart from the start, which is a leader too)
    const lead = rows.map((r) => r[0]);
    const L = Math.max(...lead);
    if (lead.filter((x) => x === L).length !== 1 && L !== 1) badOnce++;
    // after the largest leader has led, the largest leader that comes afterwards is smaller
    const at = lead.indexOf(L);
    const after = lead.slice(at + 1);
    if (after.length && Math.max(...after) >= L) badFall++;
  }
  console.log(`  N=${n}: ${count.toLocaleString()} permutations, longest run ${longest} steps`);
  equal(`N=${n}: ${count} permutations, all halt with 1 first`, [bad, capHit], [0, 0]);
  equal(`N=${n}: the largest leader leads only once`, badOnce, 0);
  equal(`N=${n}: the leaders after the largest one are all smaller`, badFall, 0);
  equal(`N=${n}: step agrees with the applet's Swap`, badSwap, 0);
}

done("loop-or-halt");
