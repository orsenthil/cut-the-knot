#!/usr/bin/env node
"use strict";

/*
 * Logic test for apportionment-methods/apportionment-methods-core.js.
 *
 *   1. The five methods, their rounding rules and the option ranges.
 *   2. On thousands of random countries: every method apportions exactly the
 *      number of seats. Hamilton and Adams are cross-checked against the
 *      earlier, independent ports in hamilton-apportionment/ and
 *      adams-apportionment/. Jefferson, Webster and Huntington-Hill are
 *      checked against their defining rounding rules.
 *   3. The page's paradox warning: a concrete Alabama paradox for Hamilton.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("apportionment-methods/apportionment-methods-core.js", "ApportionmentMethodsCore");
const Hamilton = loadCore("hamilton-apportionment/hamilton-apportionment-core.js", "HamiltonApportionmentCore");
const Adams = loadCore("adams-apportionment/adams-apportionment-core.js", "AdamsApportionmentCore");

/* ------------------------------------------------------------ 1. the rules */

{
  equal("five methods", C.METHODS.join(","), "hamilton,jefferson,adams,webster,huntington-hill");
  equal("n clamped low", C.setStates(C.start(), 0).states, 1);
  equal("seats clamped high", C.setSeats(C.start(), 9999).seats, 1000);
  equal("population clamped", C.setPopulation(C.start(), 0, 9999).populations[0], 1000);

  equal("Jefferson rounds down", C.round("jefferson", 4.7, 4), 4);
  equal("Adams rounds up", C.round("adams", 4.1, 4), 5);
  equal("Webster rounds to nearest", C.round("webster", 4.6, 4), 5);
  equal("Webster rounds down below the half", C.round("webster", 4.4, 4), 4);
  equal("Hill rounds up past the geometric mean", C.round("huntington-hill", 4.5, 4), 5);
  equal("Hill rounds down below it", C.round("huntington-hill", 4.4, 4), 4);

  const s = C.start({ seats: 23, states: 3, populations: [100, 200, 300] });
  equal("total population", C.total(s), 600);
  equal("standard divisor", C.standardDivisor(s), 600 / 23);
  const h = C.apportion(s, "hamilton");
  equal("Hamilton final seats", h.final.join(","), "4,8,11");
  equal("Hamilton totals 23", h.final.reduce((a, b) => a + b, 0), 23);
  for (const method of C.METHODS) {
    const r = C.apportion(s, method);
    equal(`${method} totals 23`, r.final.reduce((a, b) => a + b, 0), 23);
  }
}

/* ------------------------------------- 2. the claims, on random countries */

{
  const rnd = rng(1791);
  let exact = 0;
  let hamiltonMatches = 0;
  let adamsMatches = 0;
  let adamsFound = 0;
  let rules = 0;
  let cases = 0;
  for (let t = 0; t < 2000; t++) {
    const states = 1 + Math.floor(rnd() * 10);
    const seats = Math.max(states, Math.floor(rnd() * 60) + 1);
    const populations = Array.from({ length: states }, () => (rnd() < 0.05 ? 0 : 1 + Math.floor(rnd() * 1000)));
    if (populations.every((p) => p === 0)) continue;
    const country = { seats, states, populations };
    cases++;

    const results = C.METHODS.map((m) => C.apportion(country, m));
    if (results.every((r) => r.final.reduce((a, b) => a + b, 0) === seats)) exact++;

    const oldHamilton = Hamilton.apportion(country).final;
    if (JSON.stringify(results[0].final) === JSON.stringify(oldHamilton)) hamiltonMatches++;
    const adamsDivisor = Adams.findDivisor(country);
    if (adamsDivisor !== null) adamsFound++;
    const oldAdams = adamsDivisor === null ? null : Adams.allocation(country, adamsDivisor);
    if (oldAdams && JSON.stringify(results[2].final) === JSON.stringify(oldAdams)) adamsMatches++;

    // An independent seat-by-seat transcription of the four priority rules.
    const ok = ["jefferson", "adams", "webster", "huntington-hill"].every((method, m) => {
      const seats = populations.map(() => 0);
      if (method === "adams" && country.seats < seats.length) {
        const order = populations.map((_, i) => i)
          .filter((i) => populations[i] > 0)
          .sort((a, b) => populations[b] - populations[a]);
        for (const i of order.slice(0, country.seats)) seats[i] = 1;
      }
      while (seats.reduce((a, b) => a + b, 0) < country.seats) {
        let best = 0;
        let value = -Infinity;
        for (let i = 0; i < seats.length; i++) {
          const s = seats[i];
          const p = populations[i] === 0 ? -Infinity
            : method === "jefferson" ? populations[i] / (s + 1)
              : method === "adams" ? (s === 0 ? Infinity : populations[i] / s)
                : method === "webster" ? populations[i] / (s + 0.5)
                  : (s === 0 ? Infinity : populations[i] / Math.sqrt(s * (s + 1)));
          if (p > value) { value = p; best = i; }
        }
        seats[best]++;
      }
      return JSON.stringify(seats) === JSON.stringify(results[m + 1].final);
    });
    if (ok) rules++;
  }
  equal("every non-degenerate country was checked", cases, 1989);
  equal("all five methods always fill the house", exact, cases);
  equal("Hamilton matches the earlier port", hamiltonMatches, cases);
  equal("Adams matches the earlier port where it finds a divisor", adamsMatches, adamsFound);
  equal("every divisor method obeys its rounding rule", rules, cases);
}

/* ------------------------------------- 3. the paradox */

{
  const pops = [998, 594, 128, 71, 83];
  const a = C.apportion({ seats: 42, states: 5, populations: pops }, "hamilton").final;
  const b = C.apportion({ seats: 43, states: 5, populations: pops }, "hamilton").final;
  check("Alabama paradox: one state loses a seat when the house grows",
    a.join(",") === "22,13,3,2,2" && b.join(",") === "23,14,3,1,2");
}

done("apportionment-methods");
