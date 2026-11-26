#!/usr/bin/env node
"use strict";

/*
 * Logic test for random-walk/random-walk-core.js.
 *
 *   node porting/check-random-walk.mjs
 *
 * 1. countWalks is compared with brute-force enumeration of every up/down
 *    sequence for all starts a, ends b and step counts up to 12.
 * 2. The applet's generation method is transcribed again and compared step
 *    by step with the core over seeded random walks; every generated walk
 *    arrives at B when reachable, and the parity shortening is checked.
 * 3. The reflection of a walk starts at -a, first touches the axis at the
 *    same step, then coincides with the original, so crossing walks from A
 *    correspond one-to-one with all walks from A' (the Reflection Lemma).
 * 4. Options, messages, plain JSON and the applet's starting positions.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("random-walk/random-walk-core.js", "RandomWalkCore");

/** Brute force: every sequence of +1/-1 of length n. */
function enumerate(n, a, b) {
  let count = 0;
  for (let mask = 0; mask < 2 ** n; mask++) {
    let y = a;
    for (let i = 0; i < n; i++) y += mask & (1 << i) ? 1 : -1;
    if (y === b) count++;
  }
  return count;
}

/** The applet's MakeOneStep, written again from javap. */
function jWalk(a, b, n, random) {
  const path = [a];
  for (let s = 0; s < n; s++) {
    const remaining = n - s;
    const diff = b - path[path.length - 1];
    const step = Math.abs(diff) >= remaining - 1
      ? (diff < 0 ? -1 : 1)
      : (random() < 0.5 ? 1 : -1);
    path.push(path[path.length - 1] + step);
  }
  return path;
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("the applet starts at A = (1,3)", s.a, 3);
  equal("and ends at B = (10,4)", [s.n, s.b], [9, 4]);
  check("no walks at the start", s.walks.length === 0 && C.result(s) === null);
  equal("the applet's horizontal grid has ten steps", C.LIMITS.n, [1, 20]);
  check("Show names starts off", !s.showNames);
  equal("the number of walks from 3 to 4 in 9 steps is 126", C.countWalks(s), 126);
  check("the message explains the buttons", s.message.includes("One walk"));
  const seeded = C.walk(s, rng(1));
  equal("a walk starts at A and has one more point than steps", [seeded[0], seeded.length], [3, 10]);
  equal("and ends at B", seeded[seeded.length - 1], 4);
  check("each step goes up or down by one", seeded.slice(1).every((y, i) => Math.abs(y - seeded[i]) === 1));
}

/* ----------------------------- 2. every count, against brute-force search */

{
  let same = true;
  let detail = "";
  let cases = 0;
  for (let n = 1; n <= 12; n++) {
    for (let a = -5; a <= 5; a++) {
      for (let b = -5; b <= 5; b++) {
        const state = C.start({ a, b, n });
        const steps = C.steps(state);
        const want = enumerate(steps, a, b);
        const got = C.countWalks(state);
        cases++;
        if (got !== want) {
          same = false;
          detail = `n=${n} a=${a} b=${b}: ${got} vs ${want}`;
          break;
        }
      }
      if (!same) break;
    }
    if (!same) break;
  }
  check(`walk counts match brute force in all ${cases} cases`, same, detail);

  let parity = true;
  for (const [n, a, b] of [[9, 3, 4], [10, 3, 4], [9, 3, 3], [1, 0, 0], [20, -10, 10]]) {
    const state = C.start({ a, b, n });
    const d = b - a;
    if ((stepsOf(state) - d) % 2 !== 0) parity = false;
  }
  function stepsOf(state) { return C.steps(state); }
  check("the effective step count always has the parity of b - a", parity);
  equal("the starting example needs no shortening", C.steps(C.start()), 9);
  equal("a parity mismatch shortens by one", C.steps(C.start({ a: 3, b: 4, n: 10 })), 9);
}

/* ----------------- 3. generated walks, against the applet's own method */

{
  let same = true;
  let arrived = true;
  let cases = 0;
  for (let seed = 1; seed <= 60; seed++) {
    for (const [a, b, n] of [[3, 4, 9], [0, 0, 8], [-4, 5, 12], [2, -3, 9], [10, -10, 20]]) {
      const state = C.start({ a, b, n });
      const mine = C.walk(state, rng(seed));
      const theirs = jWalk(a, b, C.steps(state), rng(seed));
      cases++;
      if (JSON.stringify(mine) !== JSON.stringify(theirs)) same = false;
      if (C.reachable(state) && mine[mine.length - 1] !== b) arrived = false;
    }
  }
  check(`generated walks match the applet step for step in ${cases} cases`, same);
  check("every reachable walk ends at B", arrived);

  // The reflection lemma: crossing walks from A <-> all walks from A' = -a.
  let reflected = true;
  let bijection = true;
  for (let seed = 1; seed <= 40; seed++) {
    const state = C.start({ a: 3, b: 4, n: 9 });
    const path = C.walk(state, rng(seed));
    const mirror = C.reflect(path);
    if (mirror[0] !== -3) reflected = false;
    const first = path.findIndex((y) => y === 0);
    if (first >= 0) {
      const mirrorFirst = mirror.findIndex((y) => y === 0);
      if (mirrorFirst !== first || mirror.slice(first).some((y, i) => y !== path[first + i])) reflected = false;
    }
  }
  check("a reflected walk starts at -a and coincides after the first touch", reflected);

  for (let n = 2; n <= 10; n++) {
    for (let a = 1; a <= 4; a++) {
      for (let b = 1; b <= 4; b++) {
        const state = C.start({ a, b, n });
        let crossing = 0;
        for (let mask = 0; mask < 2 ** C.steps(state); mask++) {
          const steps = C.steps(state);
          let y = a;
          let touched = false;
          for (let i = 0; i < steps; i++) {
            y += mask & (1 << i) ? 1 : -1;
            if (y <= 0) touched = true;
          }
          if (y === b && touched) crossing++;
        }
        if (crossing !== C.countWalks(C.start({ a: -a, b, n }))) bijection = false;
      }
    }
  }
  check("M_n(a,b) = N_n(-a,b) for every small positive a, b and n", bijection);
}

/* ------------------------------------- 4. options, messages and plain JSON */

{
  const base = C.start();
  const one = C.addWalks(base, 1, rng(2));
  equal("One walk adds one path", one.walks.length, 1);
  check("the result is marked done", C.result(one) === "done");
  const ten = C.addWalks(base, 10, rng(3));
  equal("Ten walks adds ten paths", ten.walks.length, 10);
  check("the message says how many walks exist", ten.message.includes("126 walks"));
  const changed = C.setParam(base, "a", 2);
  equal("changing a clears old walks", changed.walks.length, 0);
  check("changing a value explores the demo", C.result(changed) === "done");
  equal("a below -10 is clamped", C.setParam(base, "a", -99).a, -10);
  equal("b above 10 is clamped", C.setParam(base, "b", 99).b, 10);
  equal("n above 20 is clamped", C.setParam(base, "n", 99).n, 20);
  equal("an unknown option is refused", C.setParam(base, "z", 5), base);
  equal("Show names toggles", C.toggleNames(base).showNames, true);
  const stuck = C.start({ a: 3, b: -3, n: 2 });
  check("an unreachable pair says so in words", C.addWalks(stuck, 1, rng(4)).message.includes("cannot be joined"));
  const snapshot = JSON.stringify(base);
  C.addWalks(base, 1, rng(5));
  check("core functions never mutate the position", JSON.stringify(base) === snapshot);
  check("a position is plain JSON", typeof JSON.parse(JSON.stringify(one)).a === "number");
  check("walks are plain arrays of numbers", one.walks[0].every((y) => typeof y === "number"));
}

done("random-walk");
