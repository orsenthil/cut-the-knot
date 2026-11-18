#!/usr/bin/env node
"use strict";

/*
 * Logic test for hamilton-apportionment/hamilton-apportionment-core.js.
 *
 *   1. The controls and the five columns the applet draws, including the
 *      surplus and the largest-remainder tie-break.
 *   2. The page's claims on thousands of random countries: the leftovers add
 *      to a whole surplus, the final seats add to the seat count, and every
 *      state stays within one seat of its exact quota.
 *   3. The paradoxes the page names: Alabama (more seats, fewer for a state),
 *      population (faster growth loses a seat) and new states. Each is pinned
 *      with a concrete country found by search.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hamilton-apportionment/hamilton-apportionment-core.js", "HamiltonApportionmentCore");

/* ------------------------------------------------------------ 1. the table */

{
  const s = C.start({ seats: 23, states: 3, populations: [100, 200, 300] });
  equal("three states", s.states, 3);
  equal("twenty-three seats", s.seats, 23);
  equal("total population", C.total(s), 600);
  equal("standard divisor", C.standardDivisor(s), 600 / 23);
  equal("state letters", C.LETTERS.slice(0, 3), "ABC");

  const a = C.apportion(s);
  equal("one quota per state", a.quotas.length, 3);
  equal("lower quotas", a.lower.join(","), "3,7,11");
  equal("the lower quotas total 21", a.lower.reduce((x, y) => x + y, 0), 21);
  equal("two surplus seats", a.surplus, 2);
  equal("the two largest leftovers get them", a.winners.join(","), "0,1");
  equal("final seats", a.final.join(","), "4,8,11");
  equal("final seats total the house", a.final.reduce((x, y) => x + y, 0), 23);
  check("leftovers add to the surplus", Math.abs(a.leftover.reduce((x, y) => x + y, 0) - a.surplus) < 1e-9);

  const tie = C.apportion({ seats: 2, states: 3, populations: [1, 1, 1] });
  equal("a tie goes to the smallest index", tie.winners.join(","), "0,1");
  equal("a bad population index is ignored", C.setPopulation(s, 9, 5), s);
  equal("seats are clamped", C.setSeats(s, 9999).seats, 1000);
  equal("states are clamped", C.setStates(s, 99).states, 26);
  equal("a new state arrives with a population", C.setStates(s, 4).populations.length, 4);
}

/* ------------------------------------- 2. the claims, on random countries */

{
  const rnd = rng(1791);
  let totals = 0;
  let quotas = 0;
  let leftovers = 0;
  let cases = 0;
  for (let t = 0; t < 3000; t++) {
    const states = 1 + Math.floor(rnd() * 12);
    const seats = Math.max(states, Math.floor(rnd() * 100) + 1);
    const populations = Array.from({ length: states }, () => (rnd() < 0.05 ? 0 : 1 + Math.floor(rnd() * 1000)));
    if (populations.every((p) => p === 0)) populations[0] = 1;
    const country = { seats, states, populations };
    const a = C.apportion(country);
    cases++;
    if (a.final.reduce((x, y) => x + y, 0) === seats) totals++;
    if (Math.abs(a.leftover.reduce((x, y) => x + y, 0) - a.surplus) < 1e-7) leftovers++;
    if (a.final.every((n, i) => n === Math.floor(a.quotas[i]) || n === Math.ceil(a.quotas[i]))) quotas++;
  }
  equal("every country was checked", cases, 3000);
  equal("the final seats always add to the house", totals, cases);
  equal("the leftovers always add to the surplus", leftovers, cases);
  equal("every state stays within one seat of its quota", quotas, cases);
}

/* ------------------------------------- 3. the paradoxes, with examples */

{
  const alabamaOld = [998, 594, 128, 71, 83];
  const a = C.apportion({ seats: 42, states: 5, populations: alabamaOld }).final;
  const b = C.apportion({ seats: 43, states: 5, populations: alabamaOld }).final;
  check("Alabama paradox: adding a seat costs state D a seat",
    a.join(",") === "22,13,3,2,2" && b.join(",") === "23,14,3,1,2");

  const popBefore = [31, 472, 183, 234, 197, 280];
  const popAfter = [34, 479, 196, 255, 202, 305];
  const x = C.apportion({ seats: 22, states: 6, populations: popBefore }).final;
  const y = C.apportion({ seats: 22, states: 6, populations: popAfter }).final;
  const growthA = popAfter[0] / popBefore[0];
  const growthF = popAfter[5] / popBefore[5];
  check("population paradox: faster growth can lose to slower growth",
    x.join(",") === "1,7,3,4,3,4" && y.join(",") === "0,7,3,4,3,5" && growthA > growthF);

  const two = C.apportion({ seats: 23, states: 3, populations: [100, 200, 300] }).final;
  const three = C.apportion({ seats: 23, states: 4, populations: [100, 200, 300, 150] }).final;
  check("new-states paradox: every old state can lose when one joins",
    three[0] <= two[0] && three[1] <= two[1] && three[2] <= two[2]);
}

done("hamilton-apportionment");
