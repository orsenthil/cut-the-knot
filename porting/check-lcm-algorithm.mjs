#!/usr/bin/env node
"use strict";

/*
 * Logic test for lcm-algorithm/lcm-algorithm-core.js.
 *
 *   1. GCD, the direct LCM formula and the page's 6,10,15 example.
 *   2. On random sets of 2..6 numbers: the algorithm terminates, the common
 *      value equals the direct LCM, every value stays a multiple and never
 *      overshoots the target.
 *   3. A single step picks the smallest and adds its original value.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("lcm-algorithm/lcm-algorithm-core.js", "LcmAlgorithmCore");

{
  equal("gcd of 12 and 18", C.gcd(12, 18), 6);
  equal("direct lcm of 6,10,15", C.directLcm([6, 10, 15]), 30);
  equal("direct lcm of 4 and 6", C.directLcm([4, 6]), 12);
  const s = C.start();
  equal("default count", s.values.length, 3);
  equal("smallest index", C.smallestIndex(s.values), 0);
  check("not finished at the start", !C.finished(s));
  const next = C.step(s);
  equal("the smallest grew by itself", next.values[0], 12);
  equal("one step counted", next.steps, 1);
  equal("others unchanged", next.values.slice(1).join(","), "10,15");
  equal("bad index ignored", C.setNumber(s, 9, 5), s);
  equal("edited number restarts", C.setNumber(s, 0, 7).originals[0], 7);
}

{
  const rnd = rng(1964);
  let finished = 0;
  let correct = 0;
  let multiples = 0;
  let bounded = 0;
  let cases = 0;
  for (let t = 0; t < 600; t++) {
    const count = 2 + Math.floor(rnd() * 3);
    const numbers = Array.from({ length: count }, () => 1 + Math.floor(rnd() * 8));
    const state = C.start(numbers);
    let at = state;
    let okMultiples = true;
    let okBounded = true;
    while (!C.finished(at) && at.steps < 20000) {
      at = C.step(at);
      if (!at.values.every((v, i) => v % numbers[i] === 0)) okMultiples = false;
      if (!at.values.every((v) => v <= C.directLcm(numbers))) okBounded = false;
    }
    cases++;
    if (C.finished(at)) finished++;
    if (at.values[0] === C.directLcm(numbers)) correct++;
    if (okMultiples) multiples++;
    if (okBounded) bounded++;
  }
  equal("all random sets checked", cases, 600);
  equal("the algorithm always terminates", finished, cases);
  equal("the common value is the LCM", correct, cases);
  equal("values remain multiples", multiples, cases);
  equal("no value overshoots the LCM", bounded, cases);

  const solved = C.run(C.start([6, 10, 15]));
  equal("the page example ends at 30", solved.values[0], 30);
  check("a finished state is unchanged by a step", C.step(solved) === solved);
  const a = C.analyze(C.start([6, 10, 15]));
  equal("analysis gives the LCM", a.lcm, 30);
}

done("lcm-algorithm");
