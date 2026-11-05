#!/usr/bin/env node
"use strict";

/*
 * Logic test for hourglass/hourglass-core.js.
 *
 * The solver is a Dijkstra search ordered by flips first, elapsed time second.
 * The checks here are that it really finds a minimum (confirmed against an
 * independent breadth-first search over flip counts), that every step it
 * returns is a legal move, and that it reports impossibility rather than
 * inventing a solution when the target is not reachable.
 *
 * The number theory: with glasses of a and b minutes you can only measure
 * multiples of gcd(a, b), so a target that is not one must come back null.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const H = loadCore("hourglass/hourglass-core.js", "HourglassCore");

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/* ------------------------------------- 1. every returned step is a legal move */

function replay(caps, result) {
  let s = H.start();
  for (const step of result.steps) {
    const n = H.apply(s, step.act, caps);
    if (!n) return `illegal action ${step.act}`;
    // apply() returns the state before time advances; the solver's recorded
    // "after" is the authority on what the state became.
    s = step.after;
  }
  if (s.egg !== 2) return "egg never taken out";
  return null;
}

/* ------------- 2. an independent BFS on flips, to confirm the flip count is minimal */

function minFlipsByBfs(caps, target, cap = 12) {
  const key = (s) => `${s.ta},${s.tb},${s.egg},${s.cooked}`;
  let frontier = [H.start()];
  const seen = new Set([key(frontier[0])]);
  for (let flips = 0; flips <= cap; flips++) {
    // Expand everything reachable without adding a flip (egg moves and waits),
    // then take one flip. That layering is what makes the BFS count flips.
    const closed = [];
    const stack = [...frontier];
    const inLayer = new Set(stack.map(key));
    while (stack.length) {
      const s = stack.pop();
      closed.push(s);
      for (const act of ["eggIn", "eggOut", "wait"]) {
        const n = H.apply(s, act, caps);
        if (!n || n.cooked > target) continue;
        const k = key(n);
        if (!inLayer.has(k)) {
          inLayer.add(k);
          stack.push(n);
        }
      }
    }
    for (const s of closed) if (s.egg === 2 && s.cooked === target) return flips;
    const next = [];
    for (const s of closed) {
      for (const act of ["flipA", "flipB"]) {
        const n = H.apply(s, act, caps);
        if (!n || n.cooked > target) continue;
        const k = key(n);
        if (!seen.has(k)) {
          seen.add(k);
          next.push(n);
        }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return null;
}

/* --------------------------------------------------------------- the puzzles */

const PUZZLES = [
  { caps: { a: 7, b: 11 }, target: 15 },
  { caps: { a: 4, b: 7 }, target: 9 },
  { caps: { a: 3, b: 5 }, target: 7 },
  { caps: { a: 2, b: 5 }, target: 1 },
  { caps: { a: 7, b: 11 }, target: 9 },
];

for (const { caps, target } of PUZZLES) {
  const label = `${caps.a}&${caps.b} -> ${target}`;
  const r = H.solve(caps, target);
  check(`${label}: solvable`, r !== null);
  if (!r) continue;

  check(`${label}: replay is legal`, replay(caps, r) === null, replay(caps, r) ?? "");
  equal(`${label}: cooks for exactly ${target}`, r.steps.at(-1).after.cooked, target);

  const bfs = minFlipsByBfs(caps, target);
  equal(`${label}: flip count is minimal`, r.flips, bfs);

  // Every step must describe itself; the UI shows these strings.
  for (const step of r.steps) {
    check(`${label}: describe("${step.act}") is non-empty`, (H.describe(step, caps) ?? "").length > 5);
  }
}

/* ------------------------------------------------- the classic 7 & 11 -> 15 */

// Three flips: start both glasses, drop the egg in when the 7 runs out (the 11
// then has 4 left), and flip the 11 when it empties. 4 + 11 = 15.
const classic = H.solve({ a: 7, b: 11 }, 15);
equal("7 & 11 -> 15 needs 3 flips", classic.flips, 3);
equal("7 & 11 -> 15 takes 15 minutes of cooking", classic.steps.at(-1).after.cooked, 15);
equal("7 & 11 -> 15 finishes 22 minutes after the start", classic.elapsed, 22);

/* ------------------------------------------- impossible targets return null */

for (const [a, b, target] of [
  [4, 6, 15],
  [4, 6, 9],
  [6, 10, 3],
]) {
  check(
    `${a}&${b} -> ${target} is impossible (gcd ${gcd(a, b)})`,
    target % gcd(a, b) !== 0 && H.solve({ a, b }, target) === null,
  );
}

/* ------------------------------ every multiple of gcd up to a+b is reachable */

for (const [a, b] of [
  [7, 11],
  [3, 5],
  [4, 6],
]) {
  const g = gcd(a, b);
  for (let t = g; t <= a + b; t += g) {
    check(`${a}&${b}: ${t} (a multiple of gcd ${g}) is reachable`, H.solve({ a, b }, t) !== null);
  }
}

done("check-hourglass");
