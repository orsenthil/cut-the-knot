#!/usr/bin/env node
"use strict";

/*
 * Logic test for universal-coloring/universal-coloring-core.js.
 *
 *   node porting/check-universal-coloring.mjs
 *
 * 1. The applet's rules: n = 2..6, n^2 dots, a click adds 1 modulo n, changing
 *    n resets every dot, and a demo is done when all ordered pairs are present.
 * 2. Exhaustively over every colouring for n = 2 (16) and n = 3 (19,683): the
 *    core's pair checker and move agree with a separate transcription of the
 *    applet's ProcessBobs and CycleColor, a complete circle contains each pair
 *    exactly once, and reading it backwards is complete too.
 * 3. Constructively for n = 2..6: Hierholzer's Euler tour from every starting
 *    colour is a correct colouring; indegree = outdegree = n; a pigeonhole
 *    argument rules out fewer than n^2 dots. The page's "no way to get stuck"
 *    is checked honestly: a naive walk can close early, Hierholzer cannot.
 * 4. The second transcription is compared again on sampled colourings for the
 *    larger n, where enumerating n^(n^2) colourings is not possible.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("universal-coloring/universal-coloring-core.js", "UniversalColoringCore");

/* ---------- a second, literal transcription of the applet's own methods ---- */

// Bob.CycleColor(): Which = (Which + 1) % N; IDs = "012345".charAt(Which).
function appletCycle(dots, n, i) {
  const out = dots.slice();
  out[i] = (out[i] + 1) % n;
  return out;
}

// CompleteGraph.ProcessBobs(): clear all arcs, then for every bob light the
// edge Edges[bob[j].Which][bob[(j+1) % M].Which].
function appletLit(dots, n) {
  const lit = Array.from({ length: n }, () => new Array(n).fill(false));
  const m = dots.length;
  for (let j = 0; j < m; j++) lit[dots[j]][dots[(j + 1) % m]] = true;
  return lit;
}

function appletComplete(dots, n) {
  return appletLit(dots, n).every((row) => row.every(Boolean));
}

function sameGrid(a, b) {
  return a.length === b.length && a.every((row, i) => row.length === b[i].length && row.every((v, j) => v === b[i][j]));
}

function* colourings(n) {
  const m = n * n, dots = new Array(m).fill(0);
  function* rec(i) {
    if (i === m) { yield dots.slice(); return; }
    for (let c = 0; c < n; c++) { dots[i] = c; yield* rec(i + 1); }
  }
  yield* rec(0);
}

function multiplicities(dots, n) {
  const counts = new Map();
  for (let i = 0; i < dots.length; i++) {
    const k = dots[i] * n + dots[(i + 1) % dots.length];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

// The plain walk the page seems to describe: keep taking the smallest unused
// outgoing arc until you arrive somewhere with none left. No backtracking.
function naiveWalk(n, s) {
  const used = new Array(n).fill(0);
  const path = [s];
  for (;;) {
    const v = path[path.length - 1];
    if (used[v] >= n) break;
    path.push(used[v]++);
    if (path.length > n * n + 1) break;
  }
  return path;
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ n: 4 });
  equal("a new game has 16 dots, all colour 0", s, { n: 4, dots: new Array(16).fill(0), clicks: 0 });
  check("a new game is not finished", C.result(s) === null);
  check("every dot can be clicked", C.legalMoves(s).join(",") === Array.from({ length: 16 }, (_, i) => i).join(","));
  for (const n of [2, 3, 5, 6]) {
    const t = C.start({ n });
    check(`n = ${n} gives ${n * n} dots, all at 0`, t.dots.length === n * n && t.dots.every((c) => c === 0));
  }
  equal("the spinner clamps below 2 and above 6", [C.clampN(1), C.clampN(2), C.clampN(6), C.clampN(9), C.clampN("bad")], [2, 2, 6, 6, 4]);
  const reset = C.start({ n: 6 });
  equal("changing n resets the dots to 0", C.setN(reset, 2), C.start({ n: 2 }));
  equal("a start is not mutated by a click", reset.dots[0], 0);
  for (const n of [2, 3, 4, 5, 6]) {
    let s2 = C.start({ n });
    const rows = [];
    for (let k = 0; k <= n; k++) { rows.push(s2.dots[0]); s2 = C.move(s2, 0); }
    check(`n = ${n}: a click cycles 0..${n - 1} then back to 0`, rows.join(",") === Array.from({ length: n + 1 }, (_, k) => k % n).join(","));
    check(`n = ${n}: bad move indices are refused`, C.move(s2, -1) === null && C.move(s2, n * n) === null && C.move(s2, 0.5) === null);
  }
}

/* ------------------------------------------- 2. every case, where it is small */

for (const n of [2, 3]) {
  let solutions = 0, mismatch = 0, wrongMove = 0, badResult = 0, badCount = 0, badReverse = 0;
  let total = 0;
  for (const dots of colourings(n)) {
    total++;
    const s = { n, dots, clicks: 0 };
    const coreGrid = C.edges(s);
    if (!sameGrid(coreGrid, appletLit(dots, n))) mismatch++;
    const info = C.check(s);
    if ((info.complete ? "done" : null) !== (appletComplete(dots, n) ? "done" : null)) badResult++;
    if (info.found !== appletLit(dots, n).flat().filter(Boolean).length) badCount++;
    if (info.complete) {
      solutions++;
      const counts = multiplicities(dots, n);
      if (counts.size !== n * n || [...counts.values()].some((v) => v !== 1)) badCount++;
    }
    if (info.complete !== appletComplete(C.reverseCycle(dots), n)) badReverse++;
    for (let i = 0; i < dots.length; i++) {
      const old = dots[i];
      if (!sameGrid(C.edges(C.move(s, i)), appletLit(appletCycle(dots, n, i), n))) wrongMove++;
      if (C.move(s, i).dots[i] !== (old + 1) % n) wrongMove++;
    }
  }
  check(`n = ${n}: all ${total} colourings: pair chart matches the applet's ProcessBobs`, mismatch === 0);
  check(`n = ${n}: all ${total} colourings: each click matches the applet's CycleColor`, wrongMove === 0);
  check(`n = ${n}: all ${total} colourings: done exactly when the applet's hint has every arc`, badResult === 0);
  check(`n = ${n}: every complete circle has each pair exactly once`, badCount === 0);
  check(`n = ${n}: reading a circle backwards has the same pairs, for all ${total} colourings`, badReverse === 0);
  check(`n = ${n}: at least one of the ${total} colourings solves the puzzle`, solutions > 0, `found ${solutions}`);
}
check("n = 2: brute force finds exactly 4 solutions out of 16", (() => [...colourings(2)].filter((d) => appletComplete(d, 2)).length)() === 4);

/* ------------------------------------------- 3. the de Bruijn / Euler claim */

check("the complete digraph with loops has indegree = outdegree = n for n = 2..6", [2, 3, 4, 5, 6].every((n) => {
  // Build the arc set straight from the definition: every a -> b, loops
  // included. Count arcs out of a (row) and into b (column) independently.
  const arcs = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => ({ a, b }))).flat();
  const outdeg = Array.from({ length: n }, (_, a) => arcs.filter((e) => e.a === a).length);
  const indeg = Array.from({ length: n }, (_, b) => arcs.filter((e) => e.b === b).length);
  return outdeg.every((d) => d === n) && indeg.every((d) => d === n);
}));

for (const n of [2, 3, 4, 5, 6]) {
  let tours = 0, bad = 0;
  for (let start = 0; start < n; start++) {
    const dots = C.eulerTour(n, start);
    const info = C.check({ n, dots, clicks: 0 });
    tours++;
    if (dots.length !== n * n || dots.some((c) => !Number.isInteger(c) || c < 0 || c >= n)) bad++;
    if (!info.complete || info.found !== n * n || C.result({ n, dots, clicks: 0 }) !== "done") bad++;
    if (!appletComplete(dots, n) || !appletComplete(C.reverseCycle(dots), n)) bad++;
    const counts = multiplicities(dots, n);
    if (counts.size !== n * n || [...counts.values()].some((v) => v !== 1)) bad++;
    if (dots[0] !== start) bad++;
  }
  check(`n = ${n}: the Euler tour from every one of the ${tours} start colours is a solution, in both directions`, bad === 0);
  const s = { n, dots: new Array(n * n - 1).fill(0), clicks: 0 };
  check(`n = ${n}: ${n * n - 1} dots cannot hold all ${n * n} pairs (pigeonhole)`, C.result(s) === null && !appletComplete(s.dots, n));
}

{
  // The page says there is "no way to get stuck" on a complete digraph. As
  // written that is only true if loops are spliced in: a naive walk starting
  // at 0 for n = 2 closes after three arcs, missing 1 -> 1. Test the true
  // claim: any early close is back at the start, and Hierholzer finishes.
  const naive = naiveWalk(2, 0);
  check(`naive walk can close early: n = 2 visits ${naive.join(",")} (3 of 4 arcs, missing 1->1)`, naive.join(",") === "0,0,1,0" && !appletComplete(naive.slice(0, -1), 2));
  let bad = 0, early = 0;
  for (const n of [2, 3, 4, 5, 6]) for (let s = 0; s < n; s++) {
    const walk = naiveWalk(n, s);
    if (walk.length - 1 < n * n) {
      early++;
      if (walk[walk.length - 1] !== s) bad++; // you can only stop where you started
    }
    const tour = C.eulerTour(n, s);
    if (!appletComplete(tour, n)) bad++;
  }
  check(`every early close is at the start, and Hierholzer completes from all starts (${early} early closes seen)`, bad === 0);
}

/* ----------------------------- 3b. the same answers as the applet's own method */

{
  const random = rng(129);
  let compared = 0, mismatch = 0, wrongMove = 0, wrongResult = 0;
  for (const n of [2, 3, 4, 5, 6]) {
    // n = 2 and 3 were done exhaustively above; sample the larger spaces.
    const count = n === 2 ? 16 : n === 3 ? 20 : 600;
    const m = n * n;
    const cases = [];
    if (n <= 3) {
      const it = colourings(n);
      for (let i = 0; i < count; i++) cases.push(it.next().value);
    } else {
      for (let k = 0; k < count; k++) cases.push(Array.from({ length: m }, () => Math.floor(random() * n)));
    }
    // Add constructed solutions: these are the cases the puzzle is about.
    for (let s = 0; s < n; s++) cases.push(C.solution(n, s));
    for (const dots of cases) {
      const state = { n, dots, clicks: 7 };
      compared++;
      if (!sameGrid(C.edges(state), appletLit(dots, n))) mismatch++;
      if (C.check(state).found !== appletLit(dots, n).flat().filter(Boolean).length) mismatch++;
      if (C.result(state) !== (appletComplete(dots, n) ? "done" : null)) wrongResult++;
      for (let i = 0; i < m; i++) {
        if (!sameGrid(C.edges(C.move(state, i)), appletLit(appletCycle(dots, n, i), n))) wrongMove++;
      }
    }
  }
  check(`${compared} further colourings agree with the applet's ProcessBobs`, mismatch === 0);
  check(`${compared} further colourings: every click agrees with the applet's CycleColor`, wrongMove === 0);
  check(`${compared} further colourings: the finished test agrees with the applet's hint`, wrongResult === 0);
}

{
  const s = C.start({ n: 4 });
  const before = JSON.stringify(s);
  C.move(s, 0); C.check(s); C.setN(s, 6);
  equal("all core calls leave the old position alone", JSON.stringify(s), before);
  const solved = { n: 4, dots: C.solution(4, 0), clicks: 0 };
  check("a solved position is plain data, ready for Track.state", JSON.stringify(solved).includes("dots") && C.result(solved) === "done");
}

done("universal-coloring");
