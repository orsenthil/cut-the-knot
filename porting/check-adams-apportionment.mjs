#!/usr/bin/env node
"use strict";

/*
 * Logic test for adams-apportionment/adams-apportionment-core.js.
 *
 *   1. The controls: ranges, initial board, editing populations, seats and
 *      states, the four quota columns and their totals.
 *   2. The method's claims: the standard quotas add to the number of seats;
 *      the lower/upward quotas bracket them; and whenever there are at least
 *      as many seats as states, some divisor makes the upward quotas add up
 *      exactly. Check all of that on thousands of random countries.
 *   3. The applet's floor/ceil calculations transcribed and compared on every
 *      state of each country, plus the divisor search checked against a brute
 *      force scan on small boards.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("adams-apportionment/adams-apportionment-core.js", "AdamsApportionmentCore");

/* ------------------------------------------------------------ 1. the board */

{
  const s = C.start({ seats: 23, states: 3, populations: [100, 200, 300] });
  equal("three states", s.states, 3);
  equal("23 seats", s.seats, 23);
  equal("total population", C.total(s), 600);
  equal("standard divisor", C.standardDivisor(s), 600 / 23);
  equal("state letters", C.LETTERS.slice(0, 3), "ABC");
  check("a divisor was found", s.divisor !== null && Number.isFinite(s.divisor));

  const q = C.quotas(s, s.divisor);
  equal("one row per state", q.length, 3);
  equal("lower quota of 100 people", q[0].lower, 3);
  equal("upward quota of 100 people at divisor 1", C.quotas(s, 1)[0].upward, 100);
  check("the found divisor fits exactly", C.sumOf(s, s.divisor) === s.seats);
  check("every lower quota does not exceed its upward quota", q.every((row) => row.lower <= row.upward));

  const edited = C.setPopulation(s, 1, 500);
  equal("one population changed", edited.populations[1], 500);
  equal("the others stayed", edited.populations[0], 100);
  equal("the old board is untouched", s.populations[1], 200);
  check("a new divisor was found", C.sumOf(edited, edited.divisor) === edited.seats);
  equal("a bad index is ignored", C.setPopulation(s, 9, 5), s);

  const seats = C.setSeats(s, 50);
  equal("seats changed", seats.seats, 50);
  equal("seats are clamped", C.setSeats(s, 9999).seats, 1000);
  const five = { ...s, states: 5, populations: [90, 210, 330, 170, 260] };
  const more = C.setStates(five, 5);
  equal("more states added with populations", more.populations.length, 5);
  equal("states are clamped", C.setStates(s, 99).states, 26);
  check("a five-state board can still be apportioned", C.sumOf(more, more.divisor) === more.seats);
}

/* ------------------------------------- 2. the claims, on random countries */

{
  const rnd = rng(1822);
  let exact = 0;
  let bracketed = 0;
  let standardExact = 0;
  let fits = 0;
  let cases = 0;
  for (let t = 0; t < 3000; t++) {
    const states = 1 + Math.floor(rnd() * 12);
    const seats = states + Math.floor(rnd() * (60 - states));
    const populations = Array.from({ length: states }, () => 1 + Math.floor(rnd() * 1000));
    if (populations.reduce((a, b) => a + b, 0) < seats) continue; // divisor range starts at 1
    const state = { seats, states, populations, divisor: null };
    cases++;

    // The unmodified quotas must add to the seat count exactly.
    const standard = C.quotas(state, C.standardDivisor(state));
    const sum = standard.reduce((a, q) => a + q.standard, 0);
    if (Math.abs(sum - seats) < 1e-7) standardExact++;
    if (standard.every((q) => q.lower <= q.standard + 1e-9 && q.standard <= q.upward + 1e-9)) bracketed++;

    const d = C.findDivisor(state);
    if (d !== null) {
      fits++;
      if (C.sumOf(state, d) === seats) exact++;
    }
  }
  equal("every country was checked", standardExact, cases);
  equal("lower and upward quotas bracket every standard quota", bracketed, cases);
  // Adams can genuinely fail: several states may lose a seat at the same
  // divisor, so the up-quota total jumps over the number of seats.
  check("a divisor exists for most countries", fits > cases * 0.9, `${fits} of ${cases}`);
  equal("whenever a divisor is found it apportions exactly", exact, fits);
}

/* --------------------------- 3. the applet's arithmetic and a brute-force */

function appletQuota(pop, divisor, stdDivisor) {
  return {
    lower: Math.floor(pop / stdDivisor), // Lower Q uses the standard divisor
    upward: Math.ceil(pop / divisor), // Upward Q uses the modified divisor
  };
}

{
  let rows = 0;
  const rnd = rng(22);
  for (let t = 0; t < 500; t++) {
    const states = 1 + Math.floor(rnd() * 8);
    const populations = Array.from({ length: states }, () => Math.floor(rnd() * 1000));
    const divisor = 1 + rnd() * 100;
    const state = { seats: 20, states, populations, divisor };
    for (const q of C.quotas(state, divisor)) {
      const a = appletQuota(q.population, divisor, C.standardDivisor(state));
      if (q.lower !== a.lower || q.upward !== a.upward) {
        check(`quota agrees at row ${t}`, false);
      } else rows++;
    }
  }
  check("floor and ceil agree with the applet on every row", rows > 1500);

  // Small boards: compare the binary-search divisor with a fine linear scan.
  let compared = 0;
  for (let states = 1; states <= 4; states++) {
    for (const seats of [states, states + 1, states + 3, 12]) {
      for (let t = 0; t < 40; t++) {
        const populations = Array.from({ length: states }, () => 1 + Math.floor(rnd() * 60));
        const state = { seats, states, populations, divisor: null };
        const d = C.findDivisor(state);
        let brute = null;
        for (let x = Math.max(1, C.standardDivisor(state)); x <= 200; x += 0.01) {
          if (C.sumOf(state, x) === seats) { brute = x; break; }
        }
        if ((d === null) !== (brute === null)) {
          check(`brute force agrees for ${states} states and ${seats} seats`, false);
        } else compared++;
      }
    }
  }
  check("the divisor search matches a linear scan on small boards", compared === 4 * 4 * 40);
}

done("adams-apportionment");
