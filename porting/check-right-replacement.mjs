#!/usr/bin/env node
"use strict";

/*
 * Logic test for right-replacement/right-replacement-core.js.
 *
 *   node porting/check-right-replacement.mjs
 *
 * 1. FillRow is written again from javap for all four comparisons and compared
 *    with the core over every row of length 1..4 with entries 0..3, plus
 *    longer rows with repeated values (where equality matters).
 * 2. The applet's DrawNums loop and IsOver are transcribed again and compared
 *    row for row, with the same stopping reason, over every starting row of
 *    length 2..4 with entries 0..3 in all four modes.
 * 3. The page's claims are checked over that same exhaustive space and over
 *    seeded random rows: LT reaches a fixed row, LE reaches (n-1,...,0) in
 *    at most n steps, GT reaches all zeroes, and GE closes a two-step loop or
 *    hits the 100-row cap.
 * 4. Ranges, button behaviour (Compute vs Reset vs a change of length),
 *    messages and plain JSON.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("right-replacement/right-replacement-core.js", "RightReplacementCore");

/* -------------------- a second transcription of the applet's four methods */

/** RightReplacementInfoCanvas.FillRowLT / LE / GT / GE, from javap. */
function jFillRow(row, type) {
  const out = new Array(row.length).fill(0);
  for (let i = 0; i < row.length - 1; i++) {
    let count = 0;
    for (let j = i + 1; j < row.length; j++) {
      if (type === 0 ? row[i] > row[j] : type === 1 ? row[i] >= row[j]
        : type === 2 ? row[i] < row[j] : row[i] <= row[j]) count++;
    }
    out[i] = count;
  }
  return out;
}

/** RightReplacementInfoCanvas.IsOver, from javap. */
function jIsOver(rows, type) {
  const size = rows.length;
  if (size < 2) return false;
  if (type !== 3 || size >= 3) {
    const a = rows[size - 1];
    const b = rows[type === 3 ? size - 3 : size - 2];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  return false;
}

/** The vector-building loop in RightReplacementInfoCanvas.DrawNums. */
function jIterate(values, type, maxRows = 100) {
  const rows = [];
  let current = values.slice();
  while (true) {
    const next = jFillRow(current, type);
    rows.push(next);
    if (jIsOver(rows, type)) return { rows, reason: type === 3 ? "period-2" : "stable" };
    if (rows.length >= maxRows) return { rows, reason: "cap" };
    current = next;
  }
}

function* rowsOf(length, alphabet) {
  const total = alphabet ** length;
  for (let n = 0; n < total; n++) {
    let x = n;
    const row = new Array(length);
    for (let i = length - 1; i >= 0; i--) {
      row[i] = x % alphabet;
      x = Math.floor(x / alphabet);
    }
    yield row;
  }
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ values: [3, 1, 4, 2] });
  equal("the default comparison is LT", s.type, "LT");
  equal("the default length is ten", C.start({}).length, 10);
  equal("a given row sets its own length", s.length, 4);
  check("no rows are shown before Compute is pressed", s.computed === false && s.rows.length === 0);
  check("a fresh demo is not done", C.result(s) === null);
  equal("the panel's slider runs from 2 to 40 numbers", [C.MIN_LENGTH, C.MAX_LENGTH], [2, 40]);
  equal("each entry runs from 1 to 10000", [C.MIN_VALUE, C.MAX_VALUE], [1, 10000]);
  equal("the display stops at 100 rows", C.MAX_ROWS, 100);
  equal("the comparisons are LT, LE, GT, GE", C.TYPES, ["LT", "LE", "GT", "GE"]);
  equal("LT counts smaller numbers to the right", C.step([3, 1, 4, 2], "LT"), [2, 0, 1, 0]);
  equal("LE also counts equal numbers", C.step([2, 2, 2], "LE"), [2, 1, 0]);
  equal("GT counts larger numbers to the right", C.step([1, 3, 2], "GT"), [2, 0, 0]);
  equal("GE also counts equal numbers", C.step([3, 2, 3], "GE"), [1, 1, 0]);
  equal("the last entry is always zero", C.step([5, 4, 3], "LT")[2], 0);
  const seeded = C.start({ length: 12, random: rng(11) });
  equal("a seeded start has the chosen length", seeded.values.length, 12);
  check("seeded values stay in the applet's 1..50 starting range",
    seeded.values.every((v) => v >= 1 && v <= 50));
}

/* ------------------------------- 2. FillRow against the applet's own code */

{
  let same = true;
  let detail = "";
  let cases = 0;
  for (let length = 1; length <= 4; length++) {
    for (const row of rowsOf(length, 4)) {
      for (let type = 0; type < 4; type++) {
        const mine = C.step(row, C.TYPES[type]);
        const theirs = jFillRow(row, type);
        cases++;
        if (JSON.stringify(mine) !== JSON.stringify(theirs)) {
          same = false;
          detail = `${C.TYPES[type]} ${JSON.stringify(row)}: ${JSON.stringify(mine)} vs ${JSON.stringify(theirs)}`;
          break;
        }
      }
      if (!same) break;
    }
    if (!same) break;
  }
  check(`FillRow matches a second transcription in all ${cases} cases`, same, detail);

  // Repeated values are where LE and GE differ from LT and GT.
  let repeats = true;
  for (let type = 0; type < 4; type++) {
    for (const row of [[2, 2, 2, 2], [1, 1, 2, 2], [4, 3, 3, 4], [0, 0, 0, 0]]) {
      if (JSON.stringify(C.step(row, C.TYPES[type])) !== JSON.stringify(jFillRow(row, type))) repeats = false;
    }
  }
  check("FillRow matches on rows full of equal values in every mode", repeats);
}

/* ------------------- 3. the whole iteration, row for row, against the applet */

{
  let same = true;
  let detail = "";
  let cases = 0;
  for (let length = 2; length <= 4; length++) {
    for (const row of rowsOf(length, 4)) {
      for (let type = 0; type < 4; type++) {
        const mine = C.iterate(row, C.TYPES[type]);
        const theirs = jIterate(row, type);
        cases++;
        if (mine.reason !== theirs.reason || JSON.stringify(mine.rows) !== JSON.stringify(theirs.rows)) {
          same = false;
          detail = `${C.TYPES[type]} ${JSON.stringify(row)}: ${mine.reason}/${theirs.reason} ${JSON.stringify(mine.rows)} vs ${JSON.stringify(theirs.rows)}`;
          break;
        }
      }
      if (!same) break;
    }
    if (!same) break;
  }
  check(`the applet's whole row loop matches in all ${cases} cases`, same, detail);

  const long = [5, 3, 3, 1, 4, 4, 2, 0];
  let longer = true;
  for (const type of C.TYPES) {
    const mine = C.iterate(long, type);
    const theirs = jIterate(long, C.TYPES.indexOf(type));
    if (mine.reason !== theirs.reason || JSON.stringify(mine.rows) !== JSON.stringify(theirs.rows)) longer = false;
  }
  check("the row loop matches on a longer row with repeated values in every mode", longer);
}

/* -------------------------------------------- 4. the page's claims, honestly */

{
  let ltFixed = true;
  let leTarget = true;
  let leWithinN = true;
  let gtZero = true;
  let geLoop = true;
  let checked = 0;
  for (let length = 2; length <= 4; length++) {
    const target = Array.from({ length }, (_, i) => length - 1 - i);
    for (const row of rowsOf(length, 4)) {
      checked++;
      for (const type of C.TYPES) {
        const { rows, reason } = C.iterate(row, type);
        const last = rows[rows.length - 1];
        if (type === "LT") {
          if (reason !== "stable" || JSON.stringify(C.step(last, "LT")) !== JSON.stringify(last)) ltFixed = false;
        } else if (type === "LE") {
          if (JSON.stringify(last) !== JSON.stringify(target)) leTarget = false;
          // The target appears by step n; the display then shows one more
          // identical row, which is how the applet notices it has stopped.
          const first = rows.findIndex((r) => JSON.stringify(r) === JSON.stringify(target));
          if (first < 0 || first >= length || rows.length > length + 1) leWithinN = false;
        } else if (type === "GT") {
          if (JSON.stringify(last) !== JSON.stringify(new Array(length).fill(0))) gtZero = false;
        } else if (reason === "period-2") {
          if (JSON.stringify(rows[rows.length - 1]) !== JSON.stringify(rows[rows.length - 3])) geLoop = false;
        } else if (reason !== "cap") {
          geLoop = false;
        }
      }
    }
  }
  check(`LT settles on a row that changes no more (${checked} starts)`, ltFixed);
  check(`LE ends at (n-1, ..., 0) in every one of ${checked} starts`, leTarget);
  check("LE needs at most n iterations, as the page says", leWithinN);
  check(`GT ends at all zeroes (${checked} starts)`, gtZero);
  check("GE closes a two-step loop or reaches the 100-row cap", geLoop);

  // Longer seeded rows, where the cap is more likely to be reached.
  let longer = true;
  for (let seed = 1; seed <= 24; seed++) {
    const values = C.randomValues(12, rng(seed));
    if (!["stable", "period-2", "cap"].includes(C.iterate(values, "GE").reason)) longer = false;
    if (C.iterate(values, "LE").reason !== "stable") longer = false;
    if (C.iterate(values, "GT").reason !== "stable") longer = false;
    if (C.iterate(values, "LT").reason !== "stable") longer = false;
  }
  check("all four modes end in the expected way on 12-number seeded rows", longer);
}

/* ----------------------------- 5. options, buttons, messages and plain JSON */

{
  const base = C.start({ values: [3, 1, 4, 2] });
  const run = C.compute(base);
  check("Compute shows the rows and ends the demo", run.computed && C.result(run) === "done");
  check("the status says in words when it settled", run.message.includes("Settled after"));
  equal("the first row is one replacement of the start", run.rows[0], [2, 0, 1, 0]);
  const edited = C.setValue(run, 1, 7);
  check("editing a number clears the rows again", edited.computed === false && edited.rows.length === 0);
  check("the edit message says what changed", edited.message.includes("Number 2 is now 7"));
  equal("an out-of-range edit is clamped", C.setValue(base, 0, 0).values[0], C.MIN_VALUE);
  equal("a huge edit is clamped", C.setValue(base, 0, 99999).values[0], C.MAX_VALUE);
  equal("an edit of a missing entry does nothing", C.setValue(base, 9, 5), base);

  const swapped = C.setType(run, "GE");
  check("changing the comparison recomputes at once", swapped.computed && swapped.type === "GE");
  check("the GE message names the loop", swapped.message.includes("repeats every two steps") ||
    swapped.message.includes("100 steps"));
  equal("an unknown comparison is refused", C.setType(run, "XX"), run);
  const resized = C.setLength(run, 3, rng(2));
  equal("a new length gives a new row", resized.values.length, 3);
  check("changing the length hides the rows", resized.computed === false && resized.rows.length === 0);
  equal("a length below 2 is clamped", C.setLength(run, 1, () => 0).length, 2);
  equal("a length above 40 is clamped", C.setLength(run, 99, () => 0).length, 40);
  const again = C.reset(run, rng(3));
  check("Reset picks a new row and shows it", again.computed && again.values.length === 4);
  check("Reset keeps the chosen comparison", again.type === "LT");

  const snapshot = JSON.stringify(base);
  C.compute(base);
  C.setValue(base, 0, 9);
  check("core functions never mutate the position they are given", JSON.stringify(base) === snapshot);
  const saved = JSON.parse(JSON.stringify(run));
  equal("a saved position carries the row, mode and rows",
    [saved.values.join(","), saved.type, saved.rows.length, saved.computed],
    ["3,1,4,2", "LT", 3, true]);
}

done("right-replacement");
