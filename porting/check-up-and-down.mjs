#!/usr/bin/env node
"use strict";

/*
 * Logic test for up-and-down/up-and-down-core.js.
 *
 *   node porting/check-up-and-down.mjs
 *
 * 1. The page's claims, exhaustively: all 120 permutations of 1..5 have an
 *    increasing or decreasing run of 3, and all 10! = 3,628,800 permutations
 *    of 1..10 have one of 4 (the Erdős-Szekeres bound (r-1)(s-1)+1). A
 *    permutation of 9 that avoids both is checked too, so 10 is sharp.
 * 2. The applet's own hidden-card choice, transcribed a second time straight
 *    from UpAndDownCanvas.Reset/ProcessVector/FindStraight: identical hidden
 *    positions and direction for all 120 five-card deals and for a large
 *    seeded sample of ten-card deals, and in an exhaustive ten-card pass.
 *    What is actually true: the hidden run is always at least 4 (3) long,
 *    but the depth-first search keeps extending it, so it can hide more
 *    than four cards; at most six (two) are shown, not exactly six (two).
 * 3. Start, views, the reveal affordance, reset and the saved position.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("up-and-down/up-and-down-core.js", "UpAndDownCore");

/* ------------------------------- a second, literal transcription of the applet */

function javaPermutation(n, rnd) {
  const v = [];
  for (let i = 0; i < n; i++) v[i] = i + 1;          // Permutation.CreateRandom, mode 0
  for (let k = n; k > 1; k--) {
    const j = Math.floor(rnd() * k);                // (int)(Math.random() * k)
    const t = v[k - 1]; v[k - 1] = v[j]; v[j] = t;
  }
  return v;
}

function javaFindStraight(values, i, vec, target, rising) {
  if (vec.length + values.length - i < target) return;
  const saved = vec.length;
  for (let j = i + 1; j < values.length; j++) {
    let ok = false;
    if (rising === 1) ok = values[j] > values[i];   // java: if_icmpgt
    else if (rising === 0) ok = values[j] < values[i]; // java: if_icmpge -> skip
    if (ok) {
      vec.push(j);
      javaFindStraight(values, j, vec, target, rising);
      if (vec.length >= target) return;
      while (vec.length > saved) vec.pop();          // removeElement(lastElement)
    }
  }
}

function javaProcessVector(values, L, rising) {
  const vec = [];
  for (let start = 0; start < values.length; start++) {
    vec.push(start);
    javaFindStraight(values, start, vec, L + 1, rising);
    if (vec.length > L) return vec;
    vec.length = 0;                                  // removeAllElements()
  }
  return null;
}

function javaDeal(values, coin) {
  const L = Math.floor(Math.sqrt(values.length));
  let rising = coin < 0.5 ? 1 : 0;                   // Math.random() < 0.5
  let vec = javaProcessVector(values, L, rising);
  if (vec === null) {                                // the other direction is the fallback
    rising = 1 - rising;
    vec = javaProcessVector(values, L, rising);
  }
  return { hidden: vec || [], direction: rising === 1 ? "up" : "down" };
}

/* ------------------------------- independent longest-run length (Erdős-Szekeres) */

function longest(values, sign) {
  const dp = values.map(() => 1);
  let best = 1;
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < i; j++) {
      if (sign * (values[i] - values[j]) > 0) dp[i] = Math.max(dp[i], dp[j] + 1);
    }
    best = Math.max(best, dp[i]);
  }
  return best;
}

/** Heap's algorithm: each of the n! permutations exactly once, in place. */
function visitPermutations(n, visit) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  const c = new Array(n).fill(0);
  let count = 0, i = 0;
  visit(a); count++;
  while (i < n) {
    if (c[i] < i) {
      const j = i % 2 === 0 ? 0 : c[i];
      const t = a[j]; a[j] = a[i]; a[i] = t;
      visit(a); count++;
      c[i]++; i = 0;
    } else { c[i] = 0; i++; }
  }
  return count;
}

/* -------------------------------------------------------------- 1. every five-card deal */

{
  let es5 = 0, mismatch5 = 0, short5 = 0, long5 = 0, badVisible5 = 0;
  const coins = [0.2, 0.8];
  const count = visitPermutations(5, (a) => {
    if (Math.max(longest(a, 1), longest(a, -1)) < 3) es5++;
    for (const coin of coins) {
      const mine = C.deal(a, () => coin), theirs = javaDeal(a, coin);
      if (JSON.stringify(mine) !== JSON.stringify(theirs)) mismatch5++;
      if (mine.hidden.length < 3) short5++;
      if (mine.hidden.length > 3) long5++;
      if (5 - mine.hidden.length > 2) badVisible5++;
      if (!C.monotone(a, mine.hidden, mine.direction)) mismatch5++;
    }
  });
  equal("all 120 five-card permutations are visited", count, 120);
  equal("every one of them has a rising or falling run of 3", es5, 0);
  equal("the applet's five-card hidden choice matches the second transcription (240 deals)", mismatch5, 0);
  equal("the five-card hidden run is never shorter than 3", short5, 0);
  check(`the five-card hidden run is often longer than 3 (${long5} of 240 deals)` , long5 > 0);
  equal("at most two five-card numbers are shown", badVisible5, 0);
  equal("four numbers can avoid both runs of 3", Math.max(longest([2, 4, 1, 3], 1), longest([2, 4, 1, 3], -1)), 2);
}

/* --------------------------------------- 2. every ten-card permutation, one pass */

{
  let es10 = 0, minRun = 10, seen = 0, sampled = 0, mismatch10 = 0, short10 = 0, long10 = 0, badVisible10 = 0;
  const dist = {};
  const count = visitPermutations(10, (a) => {
    const l = Math.max(longest(a, 1), longest(a, -1));
    if (l < 4) es10++;
    if (l < minRun) minRun = l;
    // Comparing every deal would repeat the same deep search 3.6M more times;
    // sample it through the exhaustive pass instead.
    if (seen % 512 === 0) {
      sampled++;
      const mine = C.deal(a, () => 0.2), theirs = javaDeal(a, 0.2);
      if (JSON.stringify(mine) !== JSON.stringify(theirs)) mismatch10++;
      if (!C.monotone(a, mine.hidden, mine.direction)) mismatch10++;
      if (mine.hidden.length < 4) short10++;
      if (mine.hidden.length > 4) long10++;
      if (10 - mine.hidden.length > 6) badVisible10++;
      dist[mine.hidden.length] = (dist[mine.hidden.length] || 0) + 1;
    }
    seen++;
  });
  equal("all 10! = 3,628,800 ten-card permutations are visited", count, 3628800);
  equal("every one has a rising or falling run of 4", es10, 0);
  equal(`the shortest longest-run over all 3,628,800 is ${minRun}`, minRun, 4);
  equal("the ten-card hidden choice matches the applet's method on the sampled pass", mismatch10, 0);
  equal("the ten-card hidden run is never shorter than 4", short10, 0);
  check(`the hidden run is often longer than 4 (${long10} of ${sampled} sampled deals)`, long10 > 0);
  equal("at most six ten-card numbers are shown", badVisible10, 0);
  check(`the sampled hidden lengths are ${JSON.stringify(dist)}`, Object.keys(dist).every((k) => Number(k) >= 4 && Number(k) <= 10));
}

/* --------------------------------------------------- 3. the bound is sharp at 10 */

{
  const nine = [3, 2, 1, 6, 5, 4, 9, 8, 7];
  check("nine numbers can avoid both runs of 4: 3 2 1 6 5 4 9 8 7", longest(nine, 1) === 3 && longest(nine, -1) === 3);
  equal("four numbers can avoid both runs of 3", Math.max(longest([2, 4, 1, 3], 1), longest([2, 4, 1, 3], -1)), 2);
}

/* ----------------------------------------------- 4. seeded deals, both coin tosses */

{
  const rand = rng(17);
  let bad = 0, upFirst = 0, downFirst = 0, falling = 0;
  for (let k = 0; k < 20000; k++) {
    const values = C.permutation(10, rand);
    const coin = rand();
    const mine = C.deal(values, () => coin), theirs = javaDeal(values, coin);
    if (JSON.stringify(mine) !== JSON.stringify(theirs)) bad++;
    if (!C.monotone(values, mine.hidden, mine.direction)) bad++;
    if (mine.hidden.length < C.target(10) || mine.hidden.length > 10) bad++;
    if (coin < 0.5) upFirst++; else downFirst++;
    if (mine.direction === "down") falling++;
  }
  equal("20,000 seeded ten-card deals match the applet exactly", bad, 0);
  check(`both coin tosses occurred (${upFirst} up-first, ${downFirst} down-first)`, upFirst > 0 && downFirst > 0);
  check(`both colours occurred (${falling} falling, ${20000 - falling} rising)`, falling > 0 && falling < 20000);
}

/* ------------------------------------------ 5. the coin decides which run is hidden */

{
  const falling = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  equal("a falling permutation cannot hide a rising run of 4", C.processVector(falling, 3, true), null);
  equal("down is the fallback when the coin asks for up first", C.deal(falling, () => 0.1).direction, "down");
  equal("down is chosen first when the coin asks for it", C.deal(falling, () => 0.9).direction, "down");
  const rising = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  equal("up is the fallback when the coin asks for down first", C.deal(rising, () => 0.9).direction, "up");
  equal("up is chosen first when the coin asks for it", C.deal(rising, () => 0.1).direction, "up");
  const both = [1, 2, 3, 4, 10, 9, 8, 7, 6, 5];
  equal("a permutation with both runs: the coin picks up", C.deal(both, () => 0.1).direction, "up");
  equal("a permutation with both runs: the coin picks down", C.deal(both, () => 0.9).direction, "down");
}

/* -------------------------------------------------- 6. the applet's shuffle and ranges */

{
  for (const n of [5, 10]) {
    for (let seed = 1; seed <= 40; seed++) {
      const a = C.permutation(n, rng(seed)), b = javaPermutation(n, rng(seed));
      if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`shuffle differs for n=${n} seed=${seed}`);
    }
  }
  check("the shuffle matches Permutation.CreateRandom for 80 seeded cases", true);
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const s = C.start({ values, random: () => 0.1 });
  equal("an explicit permutation is used as given", s.values, values);
  equal("start is not finished yet", C.result(s), null);
  equal("start shows the visible part", s.view, "visible");
  equal("start has no revealed cards", s.revealed, []);
  equal("training mode uses five cards", C.start({ training: true, random: () => 0.1 }).n, 5);
  equal("target lengths are 3 and 4", [C.target(5), C.target(10)], [3, 4]);
}

/* ------------------------------------------------- 7. views, reveal, reset, position */

{
  const values = [5, 10, 4, 1, 6, 7, 8, 9, 2, 3];
  const s = C.start({ values, random: () => 0.2 });
  const hidden = C.setView(s, "hidden"), all = C.setView(s, "all");
  equal("changing the view keeps the cards", hidden.values, s.values);
  equal("the hidden part is an explored state", C.result(hidden), "done");
  equal("the whole permutation is an explored state", C.result(all), "done");
  equal("an unknown view is refused", C.setView(s, "nonsense"), null);
  equal("the same view is not a new state", C.setView(s, "visible"), null);

  const i = s.hidden[0], j = s.values.findIndex((_, k) => !s.hidden.includes(k));
  const r = C.reveal(s, i);
  equal("a hidden card can be revealed", r.revealed, [i]);
  equal("revealing finishes the demo", C.result(r), "done");
  equal("a visible card cannot be revealed", C.reveal(s, j), null);
  equal("a card cannot be revealed twice", C.reveal(r, i), null);
  equal("an out-of-range card is refused", C.reveal(s, -1), null);
  equal("revealing does not change the cards", r.values, s.values);

  const next = C.reset(s, { random: () => 0.8 });
  equal("reset returns to the visible part", next.view, "visible");
  equal("reset clears revealed cards", next.revealed, []);
  equal("reset keeps ten cards", next.n, 10);
  equal("reset on a training board keeps five cards", C.reset(C.start({ training: true, random: () => 0.1 }), { random: () => 0.8 }).n, 5);
  equal("reset can switch to training", C.reset(s, { training: true, random: () => 0.2 }).n, 5);

  const pos = JSON.parse(JSON.stringify(C.position(r)));
  equal("the saved position is plain data", pos, { n: s.n, values: s.values, hidden: s.hidden, direction: s.direction, view: "visible", revealed: [i] });
}

done("up-and-down");
