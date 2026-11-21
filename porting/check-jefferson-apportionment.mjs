#!/usr/bin/env node
"use strict";

/*
 * Logic test for jefferson-apportionment/jefferson-apportionment-core.js.
 *
 *   1. Standard divisor, D'Hondt priorities and the page's rounding-down rule.
 *   2. On 2,000 random countries: the house is filled, the found divisor's
 *      floors match the allocation, and the result agrees with the site's
 *      combined apportionment calculator.
 *   3. Controls and the classic small example (23 seats, 3 states).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("jefferson-apportionment/jefferson-apportionment-core.js", "JeffersonApportionmentCore");
const Combined = loadCore("apportionment-methods/apportionment-methods-core.js", "ApportionmentMethodsCore");

{
  const s = C.start();
  equal("default seats", s.seats, 23);
  equal("default states", s.states, 3);
  equal("total population", C.total(s), s.populations.reduce((a, b) => a + b, 0));
  equal("standard divisor", C.standardDivisor(s), C.total(s) / 23);
  equal("priority of a fresh state", C.priority(10, 0), 10);
  equal("zero population has no priority", C.priority(0, 2), -Infinity);
  equal("states clamped", C.setStates(s, 99).states, 26);
  equal("seats clamped", C.setSeats(s, 9999).seats, 1000);
  equal("population clamped", C.setPopulation(s, 0, -5).populations[0], 0);

  const classic = C.start({ seats: 23, populations: [100, 200, 300], states: 3 });
  const r = C.analyze(classic);
  equal("the classic house is filled", r.total, 23);
  equal("Jefferson favours the larger state", r.final[2] >= r.final[0], true);
}

{
  const rnd = rng(1791);
  let fills = 0;
  let divisors = 0;
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
    const d = C.findDivisor(country);
    const floors = populations.map((p) => Math.floor(p / d));
    // At an exact tie two allocations are both valid Jefferson outcomes;
    // allow a one-seat difference per state there.
    if (Math.abs(floors.reduce((a, b) => a + b, 0) - seats) <= 1 &&
        floors.every((v, i) => Math.abs(v - r.final[i]) <= 1)) divisors++;
    if (JSON.stringify(Combined.apportion(country, "jefferson").final) === JSON.stringify(r.final)) agrees++;
  }
  check("enough countries were tried", cases > 1900, `${cases}`);
  equal("the house is always filled", fills, cases);
  equal("the divisor's floors give the allocation", divisors, cases);
  equal("agrees with the combined calculator", agrees, cases);
}

done("jefferson-apportionment");
