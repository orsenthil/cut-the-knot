#!/usr/bin/env node
"use strict";

/*
 * Logic test for shuttle-practice/shuttle-practice-core.js.
 *
 *   node porting/check-shuttle-practice.mjs
 *
 * 1. The page's claim that every permutation is a product of
 *    transpositions, exhaustively for N = 2..6 (every one of the 872
 *    targets): a shuttle list built by sorting each top into place is
 *    accepted by Verify, uses exactly N - (number of cycles) shuttles, and
 *    no shorter list exists (breadth-first search over shuttle lists for
 *    N <= 5). Every list for the same target has the same parity.
 * 2. The walk: each shuttle swaps what travels down its poles, so the
 *    result is the product read from the top down; the walks never merge.
 * 3. The applet's rules: Fisher-Yates target (against a transcription of
 *    CreateRandom), labels under the poles, one shuttle per height,
 *    Remove last, and the messages.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("shuttle-practice/shuttle-practice-core.js", "ShuttlePracticeCore");

function* perms(n) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  function* go(k) {
    if (k === n) { yield a.slice(); return; }
    for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; yield* go(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  }
  yield* go(0);
}

/** Shuttles that send top i to pole goal[i]: place what belongs on pole 1, 2, ... in turn. */
function solve(goal) {
  const n = goal.length;
  // cur[p] = which top is travelling down pole p at the current height
  const cur = Array.from({ length: n }, (_, i) => i);
  const bars = [];
  let h = 1;
  for (let p = 0; p < n; p++) {
    const want = goal.indexOf(p + 1);       // the top that must end on pole p
    const q = cur.indexOf(want);
    if (q !== p) { bars.push([p, q, h++]); [cur[p], cur[q]] = [cur[q], cur[p]]; }
  }
  return bars;
}

let targets = 0, accepted = true, minimal = true, labels = true;
for (let n = 2; n <= 6; n++) for (const goal of perms(n)) {
  targets++;
  let s = C.start({ n, goal });
  for (const [a, b, h] of solve(goal)) s = C.addBar(s, a, b, h).state;
  s = C.verify(s);
  if (C.outcome(s) !== "win" || C.message(s) !== "Great! You did it!") accepted = false;
  if (s.bars.length !== C.fewest(goal)) minimal = false;
  const L = C.bottomLabels(s);
  if (!goal.every((g, i) => L[g - 1] === i + 1)) labels = false;
}
check(`every target with N = 2..6 can be reached and Verify accepts it (${targets} targets)`, accepted);
check("using N minus the number of cycles shuttles", minimal);
check("the number under pole j is the top that should arrive there", labels);

{
  // BFS: no shorter list of transpositions exists, N <= 5; parity of all lists agrees.
  let ok = true, parity = true;
  for (let n = 2; n <= 5; n++) {
    const key = (p) => p.join(",");
    const id = Array.from({ length: n }, (_, i) => i + 1);
    const dist = new Map([[key(id), 0]]);
    let frontier = [id];
    while (frontier.length) {
      const next = [];
      for (const p of frontier) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const q = p.slice(); [q[i], q[j]] = [q[j], q[i]];
        if (!dist.has(key(q))) { dist.set(key(q), dist.get(key(p)) + 1); next.push(q); }
      }
      frontier = next;
    }
    for (const g of perms(n)) if (dist.get(key(g)) !== C.fewest(g)) ok = false;
    // parity: random lists of shuttles; the result's fewest has the list length's parity
    const R = rng(n);
    for (let t = 0; t < 400; t++) {
      let s = C.start({ n, goal: id });
      const k = Math.floor(R() * 9);
      for (let h = 1; h <= k; h++) {
        const a = Math.floor(R() * n); let b = Math.floor(R() * (n - 1)); if (b >= a) b++;
        s = C.addBar(s, a, b, h * 7).state;
      }
      if ((C.fewest(C.result(s)) - k) % 2 !== 0) parity = false;
    }
  }
  check("no target can be reached with fewer shuttles (breadth-first search, N <= 5)", ok);
  check("any list of shuttles for a target has the parity of N minus its cycles", parity);
}

{
  // The walk is the product read from the top: compose transpositions directly.
  const R = rng(11);
  let same = true, distinct = true;
  for (let t = 0; t < 500; t++) {
    const n = 2 + Math.floor(R() * 9);
    let s = C.start({ n, random: R });
    const k = Math.floor(R() * 12);
    for (let i = 0; i < k; i++) {
      const a = Math.floor(R() * n); let b = Math.floor(R() * (n - 1)); if (b >= a) b++;
      const r = C.addBar(s, a, b, 1 + Math.floor(R() * (C.ROWS - 1)));
      if (r.state) s = r.state;
    }
    const cur = Array.from({ length: n }, (_, i) => i);
    for (const b of s.bars.slice().sort((x, y) => x.h - y.h)) [cur[b.a], cur[b.b]] = [cur[b.b], cur[b.a]];
    const want = new Array(n); cur.forEach((top, pole) => { want[top] = pole + 1; });
    if (C.result(s).join() !== want.join()) same = false;
    if (new Set(C.result(s)).size !== n) distinct = false;
  }
  check("following the walks is applying the transpositions from the top down", same);
  check("two tops never end on the same pole", distinct);
}

{
  // CreateRandom, transcribed: values[i] = i+1; for L3 = N..2: L1 = int(random*L3); swap values[L3-1], values[L1].
  const literal = (n, r) => { const v = []; for (let i = 0; i < n; i++) v[i] = i + 1; for (let L3 = n; L3 > 1; L3--) { const L1 = Math.trunc(r() * L3); const L2 = v[L3 - 1]; v[L3 - 1] = v[L1]; v[L1] = L2; } return v; };
  let same = true;
  for (let seed = 1; seed < 200; seed++) {
    const n = 2 + (seed % 19);
    if (C.randomGoal(n, rng(seed)).join() !== literal(n, rng(seed)).join()) same = false;
  }
  check("the target is the applet's Fisher-Yates shuffle", same);
  const R = rng(5), counts = new Map();
  for (let i = 0; i < 6000; i++) { const k = C.randomGoal(3, R).join(""); counts.set(k, (counts.get(k) || 0) + 1); }
  check("all 6 targets of 3 poles come up about equally often", counts.size === 6 && [...counts.values()].every((c) => c > 850 && c < 1150));

  let s = C.start({ n: 4, goal: [2, 1, 3, 4] });
  equal("defaults: 5 poles", C.start().n, 5);
  equal("poles are held to 2..20", [C.start({ n: 1 }).n, C.start({ n: 50 }).n].join(","), "2,20");
  s = C.addBar(s, 0, 1, 50).state;
  equal("one shuttle (1,2) solves 2,1,3,4", C.message(C.verify(s)), "Great! You did it!");
  equal("refused: the same height twice", C.addBar(s, 2, 3, 50).refused, "This height is occupied! Select another.");
  check("a drag back onto the same pole is cancelled without a message", C.addBar(s, 2, 2, 60).refused === null);
  const t = C.addBar(s, 3, 1, 80).state;
  equal("the product reads from the top, smaller number first", C.product(t), "(1,2)(2,4)");
  equal("Verify says no when the walks are wrong", C.message(C.verify(t)), "Nope, not yet. Please continue ...");
  check("and that is not a win", C.outcome(C.verify(t)) === null);
  equal("Remove last takes the newest shuttle away", C.product(C.removeLast(t)), "(1,2)");
  check("nothing to remove on an empty board", C.removeLast(C.start({ n: 3 })) === null);
  equal("cycles are written with fixed points", C.cycles([2, 3, 1, 4]), "(1,2,3)(4)");
  const before = JSON.stringify(t);
  C.verify(t); C.addBar(t, 0, 2, 90);
  equal("moves leave the old position alone", JSON.stringify(t), before);
}

done("shuttle-practice");
