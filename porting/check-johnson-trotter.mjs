#!/usr/bin/env node
"use strict";

/*
 * Logic test for johnson-trotter/johnson-trotter-core.js.
 *
 *   1. Directions, mobility on a known state and one step of the algorithm.
 *   2. Exhaustively for n = 1..7: n! distinct permutations, every consecutive
 *      pair an adjacent transposition, and the stopping permutation has no
 *      mobile number.
 *   3. The page's final permutation <2 <1 3> ... n> and controls.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("johnson-trotter/johnson-trotter-core.js", "JohnsonTrotterCore");

{
  const s = C.start(3);
  equal("three items", s.items.length, 3);
  equal("all start looking left", s.directions ? "" : s.items.map((i) => i.dir).join(","), "-1,-1,-1");
  check("3 is mobile leftwards", C.mobile(s, 2));
  check("1 is not mobile", !C.mobile(s, 0));
  equal("largest mobile is 3", C.largestMobile(s), 2);
  const next = C.step(s);
  equal("after one step the values are 1,3,2", C.permutation(next).join(","), "1,3,2");
  equal("one step counted", next.steps, 1);
  equal("n clamped", C.setN(s, 99).n, 7);
  const one = C.start(1);
  check("a single item cannot move", C.largestMobile(one) < 0 && C.step(one) === one);
}

{
  let counts = 0;
  let unique = 0;
  let adjacent = 0;
  let stopped = 0;
  for (let n = 1; n <= 7; n++) {
    const seq = C.generate(n);
    const factorial = Array.from({ length: n }, (_, i) => i + 1).reduce((a, b) => a * b, 1);
    if (seq.length === factorial) counts++;
    if (new Set(seq.map((s) => s.permutation.join(","))).size === factorial) unique++;
    let ok = true;
    for (let i = 1; i < seq.length; i++) if (!C.isAdjacentTransposition(seq[i - 1].permutation, seq[i].permutation)) ok = false;
    if (ok) adjacent++;
    let state = C.start(n);
    for (let i = 1; i < seq.length; i++) state = C.step(state);
    if (C.analyze(state).finished) stopped++;
  }
  equal("all sizes checked", counts, 7);
  equal("the permutation counts are n factorial", counts, 7);
  equal("every permutation appears once", unique, 7);
  equal("every step is one adjacent swap", adjacent, 7);
  equal("every run stops", stopped, 7);

  const seq = C.generate(4);
  equal("4! permutations", seq.length, 24);
  equal("the page's final permutation", seq[seq.length - 1].permutation.join(","), "2,1,3,4");
}

done("johnson-trotter");
