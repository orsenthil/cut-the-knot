#!/usr/bin/env node
"use strict";

/*
 * Logic test for calendar-magic/calendar-core.js.
 *
 * The trick: outline an n-by-n block of dates on a monthly calendar, then
 * circle one date in each row and each column of it. The total never depends on
 * which dates you circled. The core claims the closed form
 *
 *   total = n*a + 4*n*(n-1),   a = the date in the block's top left corner
 *
 * and that claim is not taken on trust here. Every valid block in every month
 * from 1900 to 2099 is enumerated and *every* legal set of picks inside it is
 * summed by replaying Round.pick, so a set only counts if each click was legal
 * when it was made. For n = 2..4 that is all 2, 6 and 24 permutations; n = 5
 * and 6 are sampled over a few years to keep the run short.
 *
 * The calendar grid itself is checked independently of Zeller's congruence
 * (which the core uses) against a day count from 1 January 1900, and against
 * known weekdays.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("calendar-magic/calendar-core.js", "CalendarCore");

/* -------------------------------------------------- 1. the calendar is right */

{
  // Independent weekday: count days since 1 Jan 1900, which was a Monday.
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const len = (y, m) => (m === 1 && leap(y) ? 29 : lengths[m]);

  let elapsed = 0; // days from 1 Jan 1900 to the 1st of (y, m)
  let mismatches = 0;
  let lengthMismatches = 0;
  for (let y = 1900; y <= 2099; y++) {
    for (let m = 0; m < 12; m++) {
      const weekday = (1 + elapsed) % 7; // 1 Jan 1900 was a Monday, index 1
      if (C.firstWeekday(y, m) !== weekday) mismatches++;
      if (C.daysInMonth(y, m) !== len(y, m)) lengthMismatches++;
      elapsed += len(y, m);
    }
  }
  check("firstWeekday agrees with a day count from 1 Jan 1900", mismatches === 0, `${mismatches} months differ`);
  check("daysInMonth agrees with the leap rule", lengthMismatches === 0, `${lengthMismatches} months differ`);

  equal("1 Jan 1900 was a Monday", C.firstWeekday(1900, 0), 1);
  equal("1 Mar 1900 was a Thursday (1900 is not a leap year)", C.firstWeekday(1900, 2), 4);
  equal("1 Feb 2000 was a Tuesday (2000 is a leap year)", C.firstWeekday(2000, 1), 2);
  equal("February 2000 had 29 days", C.daysInMonth(2000, 1), 29);
  equal("February 1900 had 28 days", C.daysInMonth(1900, 1), 28);
  equal("1 Nov 2026 is a Sunday", C.firstWeekday(2026, 10), 0);

  // Every date lands in exactly one cell, at the row and column the grid rule
  // predicts, and nothing else is filled in.
  let gridProblems = 0;
  for (let y = 1900; y <= 2099; y++) {
    for (let m = 0; m < 12; m++) {
      const g = C.monthGrid(y, m);
      const seen = new Set();
      for (let r = 0; r < g.rows; r++) {
        if (g.cells[r].length !== 7) gridProblems++;
        for (let c = 0; c < 7; c++) {
          const d = g.cells[r][c];
          if (d === null) continue;
          if (seen.has(d)) gridProblems++;
          seen.add(d);
          if (7 * r + c !== g.offset + d - 1) gridProblems++;
        }
      }
      if (seen.size !== g.days) gridProblems++;
      if (g.rows !== Math.ceil((g.offset + g.days) / 7)) gridProblems++;
    }
  }
  check("every month's grid places each date at a + 7r + c", gridProblems === 0, `${gridProblems} problems`);
}

/* ------------------------------------- 2. the sum does not depend on the picks */

/** Every way to pick one cell per row and per column: all n! column orders. */
function permutations(n) {
  if (n === 0) return [[]];
  const out = [];
  const walk = (used, acc) => {
    if (acc.length === n) { out.push(acc.slice()); return; }
    for (let c = 0; c < n; c++) {
      if (used[c]) continue;
      used[c] = true;
      acc.push(c);
      walk(used, acc);
      acc.pop();
      used[c] = false;
    }
  };
  walk(new Array(n).fill(false), []);
  return out;
}

{
  let squares = 0;
  let sets = 0;
  let badTotal = 0;
  let badFormula = 0;
  let noAnchor = 0;

  const perms = { 2: permutations(2), 3: permutations(3), 4: permutations(4), 5: permutations(5), 6: permutations(6) };

  const sweep = (years, sizes) => {
    for (const y of years) {
      for (let m = 0; m < 12; m++) {
        const g = C.monthGrid(y, m);
        for (const n of sizes) {
          const anchors = C.anchors(g, n);
          // A 4-by-4 block of real dates fits in every month; a 6-by-6 never can
          // (six rows of dates need 36 days).
          if (n <= 4 && anchors.length === 0) noAnchor++;
          if (n === 6 && anchors.length !== 0) noAnchor++;
          for (const { row, col } of anchors) {
            squares++;
            const a = g.cells[row][col];
            // The closed form, checked against the dates actually in the block.
            let byRowCol = 0;
            for (let i = 0; i < n; i++) byRowCol += g.cells[row + i][col + i];
            if (C.squareSum(a, n) !== byRowCol) badFormula++;

            for (const perm of perms[n]) {
              const round = new C.Round(g, row, col, n);
              let ok = true;
              for (let r = 0; r < n; r++) {
                const res = round.pick(row + r, col + perm[r]);
                if (!res.ok) ok = false;
              }
              sets++;
              if (!ok || !round.finished || round.total !== round.prediction) badTotal++;
            }
          }
        }
      }
    }
  };

  const all = [];
  for (let y = 1900; y <= 2099; y++) all.push(y);
  sweep(all, [2, 3, 4]);
  sweep([1900, 1996, 2000, 2026, 2027, 2099], [5, 6]);

  check("there is a square to play in every month", noAnchor === 0, `${noAnchor} month/size pairs were wrong`);
  check("the diagonal of each block sums to n*a + 4n(n-1)", badFormula === 0, `${badFormula} blocks differ`);
  check("every legal set of picks reaches the prediction", badTotal === 0, `${badTotal} of ${sets} sets differ`);
  check("the sweep actually covered the months", squares > 20000 && sets > 100000, `${squares} squares, ${sets} sets`);

  // A worked case from the original page: a 4-by-4 block has total 4a + 48.
  const nov = C.monthGrid(2026, 10);
  equal("4-by-4 block at 1 Nov 2026 totals 4*1 + 48", C.squareSum(nov.cells[0][0], 4), 52);
  equal("the formula is 4a + 48 for n = 4", C.squareSum(10, 4), 4 * 10 + 48);
  equal("and 3a + 24 for n = 3", C.squareSum(10, 3), 3 * 10 + 24);
}

/* --------------------------------------------- 3. the picking rules bite back */

{
  const g = C.monthGrid(2026, 10); // November 2026 starts on a Sunday
  equal("November 2026 starts in column 0", g.offset, 0);

  const round = new C.Round(g, 0, 0, 4);
  equal("top left date is the 1st", round.topLeft, 1);
  equal("the prediction is 52", round.prediction, 52);

  equal("a date outside the square is refused", round.pick(0, 5).message, C.MESSAGES.outside);
  equal("a date below the square is refused", round.pick(4, 0).message, C.MESSAGES.outside);
  check("the first pick inside is allowed", round.pick(0, 0).ok);
  equal("clicking it again is refused", round.pick(0, 0).message, C.MESSAGES.same);
  equal("another date in that row is refused", round.pick(0, 2).message, C.MESSAGES.row);
  equal("another date in that column is refused", round.pick(2, 0).message, C.MESSAGES.column);
  check("a fresh row and column is allowed", round.pick(1, 1).ok);
  check("not finished after 2 of 4 picks", !round.finished);

  check("third pick", round.pick(2, 2).ok);
  const last = round.pick(3, 3);
  check("fourth pick finishes the round", last.ok && last.finished);
  equal("the total is the prediction", round.total, round.prediction);
  equal("the main diagonal total is 1 + 9 + 17 + 25", round.total, 52);
  equal("a fifth pick is refused", round.pick(0, 1).message, C.MESSAGES.done);

  round.clearPicks();
  equal("clearing the picks resets the total", round.total, 0);
  check("and the square can be played again", round.pick(0, 3).ok);

  // Blocks are only offered where every cell is a real date.
  const feb = C.monthGrid(2026, 1); // February 2026: 28 days, starts Sunday
  check("a block that would hang off the month is refused", !C.squareFits(feb, 1, 4, 4));
  check("a 4-by-4 block of real dates is accepted", C.squareFits(feb, 0, 0, 4));
  check("every offered block is all real dates",
    C.anchors(feb, 3).every(({ row, col }) => C.squareFits(feb, row, col, 3)));
}

done("calendar-magic");
