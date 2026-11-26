#!/usr/bin/env node
"use strict";

/*
 * Logic test for reflection-principle/reflection-principle-core.js.
 *
 *   node porting/check-reflection-principle.mjs
 *
 * 1. Walk counts are compared with brute-force enumeration for all starts,
 *    ends and lengths up to 10.
 * 2. MakeOneStep and UpdateReflection are transcribed again and compared with
 *    the core step by step on seeded walks; the reflected path agrees with
 *    the mathematical reflection of the original.
 * 3. The Reflection Lemma is checked by enumeration for small positive
 *    heights: touching walks from a equal all walks from -a.
 * 4. Options, parity shortening, messages, plain JSON and starting values.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("reflection-principle/reflection-principle-core.js", "ReflectionPrincipleCore");

function enumerate(n, a, b) {
  let count = 0;
  for (let mask = 0; mask < 2 ** n; mask++) {
    let y = a;
    for (let i = 0; i < n; i++) y += mask & (1 << i) ? 1 : -1;
    if (y === b) count++;
  }
  return count;
}

/** The applet's two threads, written again from javap. */
function jPair(a, b, n, random) {
  const path = [a];
  const reflected = [-a];
  let passedZero = false;
  for (let s = 0; s < n; s++) {
    const remaining = n - s;
    const diff = b - path[s];
    const step = Math.abs(diff) >= remaining - 1
      ? (diff < 0 ? -1 : 1)
      : (random() < 0.5 ? 1 : -1);
    path.push(path[s] + step);
    if (s !== 0 && !passedZero && reflected[s] === 0) passedZero = true;
    reflected.push(reflected[s] + (passedZero ? step : -step));
  }
  return { path, reflected };
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("the applet starts at A = (1,3)", s.a, 3);
  equal("and ends at B = (18,4)", [s.n, s.b], [9, 4]);
  check("no walk at the start", s.path === null && C.result(s) === null);
  equal("the count for the starting example is 126", C.countWalks(s), 126);
  check("Show names starts off", !s.showNames);
  check("the message names both walks", s.message.includes("reflection"));
  equal("the option ranges match the applet", [C.LIMITS.a, C.LIMITS.b, C.LIMITS.n],
    [[-10, 10], [-10, 10], [1, 20]]);
  const one = C.addWalk(s, rng(1));
  equal("a walk has one point per step plus the start", one.path.length, 10);
  equal("and arrives at B", one.path[one.path.length - 1], 4);
  equal("the reflected walk starts at -a", one.reflected[0], -3);
  equal("the mirrored walk follows the ideal reflection", one.reflected, C.reflect(one.path));
}

/* ---------------------------------- 2. counts, against brute-force search */

{
  let same = true;
  let detail = "";
  let cases = 0;
  for (let n = 1; n <= 10; n++) {
    for (let a = -4; a <= 4; a++) {
      for (let b = -4; b <= 4; b++) {
        const state = C.start({ a, b, n });
        const want = enumerate(C.steps(state), a, b);
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
  equal("the parity shortening matches the applet", C.steps(C.start({ a: 3, b: 4, n: 10 })), 9);
  equal("a second example needs no shortening", C.steps(C.start({ a: 3, b: 4, n: 9 })), 9);
  check("the effective step count always has the right parity",
    [[9, 3, 4], [10, 3, 4], [8, 0, 0], [1, 0, 0]].every(([n, a, b]) =>
      ((C.steps(C.start({ a, b, n })) - (b - a)) % 2 + 2) % 2 === 0));
}

/* ------------------------ 3. the two walks, against the applet's methods */

{
  let same = true;
  let reflectedOkay = true;
  let arrived = true;
  let detail = "";
  let cases = 0;
  for (let seed = 1; seed <= 60; seed++) {
    for (const [a, b, n] of [[3, 4, 9], [0, 0, 8], [-4, 5, 12], [2, -3, 9], [4, 4, 10]]) {
      const state = C.start({ a, b, n });
      const mine = C.pair(state, rng(seed));
      const theirs = jPair(a, b, C.steps(state), rng(seed));
      cases++;
      if (JSON.stringify(mine.path) !== JSON.stringify(theirs.path) ||
          JSON.stringify(mine.reflected) !== JSON.stringify(theirs.reflected)) {
        same = false;
        detail = `seed ${seed} a=${a} b=${b} n=${n}`;
      }
      // The lemma is about a > 0; for a = 0 the applet's "wait for the
      // reflected walk itself to reach zero" rule differs from the ideal.
      if (a > 0) {
        const want = C.reflect(mine.path);
        if (JSON.stringify(want) !== JSON.stringify(mine.reflected)) reflectedOkay = false;
      }
      if (C.reachable(state) && mine.path[mine.path.length - 1] !== b) arrived = false;
    }
  }
  check(`both walks match a second transcription in ${cases} cases`, same, detail);
  check("the drawn reflection equals the mathematical reflection", reflectedOkay);
  check("every reachable walk arrives at B", arrived);

  // M_n(a,b) = N_n(-a,b) for small positive heights and lengths.
  let lemma = true;
  for (let n = 2; n <= 10; n++) {
    for (let a = 1; a <= 4; a++) {
      for (let b = 1; b <= 4; b++) {
        const steps = C.steps(C.start({ a, b, n }));
        let touching = 0;
        for (let mask = 0; mask < 2 ** steps; mask++) {
          let y = a;
          let touched = false;
          for (let i = 0; i < steps; i++) {
            y += mask & (1 << i) ? 1 : -1;
            if (y <= 0) touched = true;
          }
          if (y === b && touched) touching++;
        }
        if (touching !== C.countWalks(C.start({ a: -a, b, n }))) lemma = false;
      }
    }
  }
  check("the reflection lemma holds for every small positive a, b and n", lemma);
}

/* ------------------------------------- 4. options, messages and plain JSON */

{
  const base = C.start();
  const changed = C.setParam(base, "a", 2);
  equal("changing a clears the drawn walks", changed.path, null);
  check("changing a value explores the demo", C.result(changed) === "done");
  equal("a below -10 is clamped", C.setParam(base, "a", -99).a, -10);
  equal("b above 10 is clamped", C.setParam(base, "b", 99).b, 10);
  equal("n above 20 is clamped", C.setParam(base, "n", 99).n, 20);
  equal("an unknown option is refused", C.setParam(base, "z", 5), base);
  equal("Show names toggles", C.toggleNames(base).showNames, true);
  const one = C.addWalk(base, rng(2));
  check("the message counts all the walks", one.message.includes("126 walks"));
  const stuck = C.start({ a: 3, b: -3, n: 2 });
  check("an unreachable pair says so in words", C.addWalk(stuck, rng(3)).message.includes("cannot be joined"));
  const snapshot = JSON.stringify(base);
  C.addWalk(base, rng(4));
  check("core functions never mutate the position", JSON.stringify(base) === snapshot);
  check("a position is plain JSON", typeof JSON.parse(JSON.stringify(one)).a === "number");
  check("paths are plain arrays", one.path.every((y) => typeof y === "number"));
}

done("reflection-principle");
