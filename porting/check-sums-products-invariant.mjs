#!/usr/bin/env node
"use strict";

/*
 * Logic test for sums-products-invariant/sums-products-invariant-core.js.
 *
 *   1. The operation, the invariant on the page's 1..6 example, and clamping.
 *   2. Exhaustively for lists of 3 and 4 small numbers: every first move keeps
 *      the invariant, and every full reduction order ends at the same value.
 *   3. Random lists of up to 12 entries: the invariant is unchanged at every
 *      step and the final number equals the initial prediction; Repeat restores.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("sums-products-invariant/sums-products-invariant-core.js", "SumsProductsInvariantCore");

{
  equal("operation on 2 and 3", C.combineValues(2, 3), 11);
  equal("invariant of the page's example", C.invariant([1, 2, 3, 4, 5, 6]), 7 * 6 * 5 * 4 * 3 * 2 - 1);
  equal("page example value", C.invariant([1, 2, 3, 4, 5, 6]), 5039);
  const s = C.start({ values: [1, 2, 3], count: 3 });
  equal("default count when values given", s.count, 3);
  equal("count clamped", C.setCount(s, 99).count, 12);
  equal("max clamped", C.setMax(s, 0).max, 1);
  const combined = C.combine(s, 0, 2);
  equal("combining removes two and adds one", combined.values.length, 2);
  equal("bad indices are ignored", C.combine(s, 0, 0).values.join(","), "1,2,3");
}

{
  let firstMoves = 0;
  let firstCases = 0;
  let finals = 0;
  let finalCases = 0;
  const allOrders = [
    [[0, 1], [0, 1]], [[0, 1], [1, 0]], [[0, 2], [0, 1]],
    [[1, 2], [0, 1]], [[0, 2], [1, 0]], [[1, 2], [1, 0]],
  ];
  for (let a = 0; a <= 3; a++) {
    for (let b = 0; b <= 3; b++) {
      for (let c = 0; c <= 3; c++) {
        const values = [a, b, c];
        const p = C.invariant(values);
        firstCases++;
        if (C.combine({ values, steps: [] }, 0, 1).values.reduce((x, v) => x * (v + 1), 1) - 1 === p) firstMoves++;
        for (const order of allOrders) {
          const r = C.reduce(values, order);
          finalCases++;
          if (r.final === p && r.values.length === 1) finals++;
        }
      }
    }
  }
  equal("all three-number lists checked", firstCases, 64);
  equal("every first move preserves the invariant", firstMoves, firstCases);
  equal("all six orders checked on each list", finalCases, 64 * 6);
  equal("every order ends at the predicted number", finals, finalCases);
}

{
  const rnd = rng(1998);
  let unchanged = 0;
  let correct = 0;
  let cases = 0;
  for (let t = 0; t < 400; t++) {
    const count = 2 + Math.floor(rnd() * 11);
    const max = 1 + Math.floor(rnd() * 20);
    const values = Array.from({ length: count }, () => 1 + Math.floor(rnd() * max));
    const p = C.invariant(values);
    let state = { values: values.slice(), original: values.slice(), steps: [] };
    let ok = true;
    while (state.values.length > 1) {
      state = C.combine(state, 0, 1);
      if (C.invariant(state.values) !== p) ok = false;
    }
    cases++;
    if (ok) unchanged++;
    if (state.values[0] === p) correct++;
    if (C.repeat(state).values.join(",") !== values.join(",")) ok = false;
  }
  equal("all random lists checked", cases, 400);
  equal("the invariant never changes", unchanged, cases);
  equal("the final number is predictable", correct, cases);
}

done("sums-products-invariant");
