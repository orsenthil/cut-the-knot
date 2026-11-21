#!/usr/bin/env node
"use strict";

/*
 * Logic test for huntington-hill-method/huntington-hill-method-core.js.
 *
 *   1. The geometric-mean cutoff, the rounding rule and the priority.
 *   2. On 2,000 random countries: the allocation always fills the house, zero
 *      populations get no seats, and each final seat matches the priority rule
 *      transcribed independently. The result also agrees with the
 *      Huntington-Hill column of the combined apportionment-methods port.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("huntington-hill-method/huntington-hill-method-core.js", "HuntingtonHillMethodCore");
const Combined = loadCore("apportionment-methods/apportionment-methods-core.js", "ApportionmentMethodsCore");

{
  equal("cutoff between 1 and 2", Math.sqrt(2), C.cutoff(1));
  equal("cutoff between 4 and 5", Math.sqrt(20), C.cutoff(4));
  equal("round just below cutoff", C.round(4.4), 4);
  equal("round just above cutoff", C.round(4.5), 5);
  equal("priority for a fresh state is infinite", C.priority(10, 0), Infinity);
  equal("zero population has no priority", C.priority(0, 3), -Infinity);
  const s = C.start();
  equal("default seats", s.seats, 23);
  equal("states clamped", C.setStates(s, 99).states, 26);
  equal("seats clamped", C.setSeats(s, 9999).seats, 1000);
}

{
  const rnd = rng(1941);
  let fills = 0;
  let priorities = 0;
  let agrees = 0;
  let cases = 0;
  for (let t = 0; t < 2000; t++) {
    const states = 1 + Math.floor(rnd() * 10);
    const seats = Math.max(states, Math.floor(rnd() * 60) + 1);
    const populations = Array.from({ length: states }, () => (rnd() < 0.05 ? 0 : 1 + Math.floor(rnd() * 1000)));
    if (populations.every((p) => p === 0)) continue;
    const country = { seats, states, populations };
    cases++;
    const r = C.analyze(country);
    if (r.total === seats) fills++;

    // Independent seat-by-seat priority transcription.
    const alloc = populations.map(() => 0);
    if (seats < states) {
      const order = populations.map((_, i) => i).filter((i) => populations[i] > 0).sort((a, b) => populations[b] - populations[a]);
      for (const i of order.slice(0, seats)) alloc[i] = 1;
    }
    while (alloc.reduce((a, b) => a + b, 0) < seats) {
      let best = 0;
      let value = -Infinity;
      for (let i = 0; i < states; i++) {
        const p = populations[i] === 0 ? -Infinity : alloc[i] === 0 ? Infinity : populations[i] / Math.sqrt(alloc[i] * (alloc[i] + 1));
        if (p > value) { value = p; best = i; }
      }
      alloc[best]++;
    }
    if (JSON.stringify(alloc) === JSON.stringify(r.final)) priorities++;
    const combined = Combined.apportion(country, "huntington-hill").final;
    if (JSON.stringify(combined) === JSON.stringify(r.final)) agrees++;
  }
  check("enough non-degenerate countries checked", cases > 1900, `${cases}`);
  equal("the house is always filled", fills, cases);
  equal("the priority rule matches", priorities, cases);
  equal("agrees with the combined apportionment port", agrees, cases);
}

done("huntington-hill-method");
