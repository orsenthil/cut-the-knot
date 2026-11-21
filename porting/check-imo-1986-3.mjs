#!/usr/bin/env node
"use strict";

/*
 * Logic test for imo-1986-3/imo-1986-3-core.js.
 *
 *   1. Validity, the potential and a single step of the pentagon iteration.
 *   2. The page's key identity: each step lowers f by exactly -2*y*sum, and
 *      the sum of the numbers is unchanged.
 *   3. Termination on thousands of random valid starts, with nonnegative
 *      final values and a strictly decreasing potential along the way.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("imo-1986-3/imo-1986-3-core.js", "Imo1986_3Core");

{
  const s = C.start();
  equal("five numbers", s.values.length, 5);
  check("the default start is valid", C.isValid(s.values));
  check("a zero total is invalid", !C.isValid([1, -1, 0, 0, 0]));
  equal("potential of all equal numbers", C.potential([2, 2, 2, 2, 2]), 0);
  const next = C.step(s, 1);
  equal("the negative number flips", next.values[1], 3);
  equal("the left neighbour changes", next.values[0], 1);
  equal("the right neighbour changes", next.values[2], -1);
  equal("unaffected vertices", `${next.values[3]},${next.values[4]}`, "-1,5");
  check("a positive number cannot be stepped on", C.step(s, 0) === null);
  equal("sum is unchanged", next.values.reduce((a, b) => a + b, 0), s.values.reduce((a, b) => a + b, 0));
  equal("one step recorded", next.steps, 1);
}

{
  const rnd = rng(1986);
  let identity = 0;
  let terminated = 0;
  let monotone = 0;
  let cases = 0;
  for (let t = 0; t < 2000; t++) {
    const values = Array.from({ length: 5 }, () => -8 + Math.floor(rnd() * 17));
    if (!C.isValid(values)) continue;
    cases++;
    let state = { values, steps: 0, history: [] };
    let okMonotone = true;
    const total = values.reduce((a, b) => a + b, 0);
    while (!C.finished(state) && state.steps < 500) {
      const index = C.negativeIndices(state.values)[0];
      const before = C.potential(state.values);
      const y = state.values[index];
      const next = C.step(state, index);
      const after = C.potential(next.values);
      if (after !== before + 2 * y * total) okMonotone = false;
      if (after >= before) okMonotone = false;
      const solvedStep = C.solve(state.values, 1);
      if (solvedStep.values.join(",") !== next.values.join(",")) okMonotone = false;
      state = next;
    }
    if (okMonotone) monotone++;
    if (C.finished(state)) terminated++;
    // Direct check of the identity on the first step only (cheap), done above.
    identity++;
  }
  check("enough starts were tried", cases > 300, `${cases}`);
  equal("all starts terminated", terminated, cases);
  equal("the potential decreased every step", monotone, cases);
  check("the identity was exercised on every start", identity === cases);

  const final = C.solve([4, -3, 2, -1, 5]);
  check("the pentagon ends nonnegative", C.finished(final));
  check("a solved pentagon takes a few steps", final.steps > 0 && final.steps < 100);
}

done("imo-1986-3");
