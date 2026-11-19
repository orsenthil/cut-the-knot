#!/usr/bin/env node
"use strict";

/*
 * Logic test for birds-on-wire/birds-on-wire-core.js.
 *
 *   node porting/check-birds-on-wire.mjs
 *
 * Checks:
 *  1. perform() against a second, literal transcription of the applet's
 *     Perform() bytecode, over EVERY non-decreasing layout of 2..7 birds on a
 *     7-point grid (including equal gaps, which exercise dcmpg vs dcmpl).
 *  2. The marked-length identity and the small-n exact cases, exhaustively.
 *  3. The page's only quantitative claim - "the applet runs a specified
 *     number of trials for every number of birds between min and max" - over
 *     the whole small parameter space, plus the accumulator's own formulas.
 *  4. Option ranges and their min/max coupling, Repeat(), and the long-run
 *     averages (1/3 for 2 birds, 1/2 for 3 birds, about 7/18 for many).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("birds-on-wire/birds-on-wire-core.js", "BirdsOnWireCore");

/* A literal second transcription of BirdsOnWireAccumulator.Perform(double[]).
 * dcmpg branches when left>=right; dcmpl only sets b[i] when left>right.
 * Our grid values never produce NaN, so a plain three-way compare is enough. */
function appletPerform(L) {
  const n = L.length;
  const b = new Array(n - 1).fill(false);
  b[0] = true;
  b[n - 2] = true;
  for (let i = 1; i < n - 1; i++) {
    const left = L[i] - L[i - 1];
    const right = L[i + 1] - L[i];
    const cmp = left > right ? 1 : left < right ? -1 : 0;
    if (cmp < 0) {
      b[i - 1] = true; // dcmpg/ifge fell through
    } else if (cmp > 0) {
      b[i] = true; // dcmpl/ifle fell through
    }
  }
  return b;
}

/* Every non-decreasing sequence of `n` values from {0,1,...,g-1}/(g-1). */
function* layouts(n, g) {
  const cur = new Array(n).fill(0);
  function* from(pos, lo) {
    if (pos === n) {
      yield cur.map((v) => v / (g - 1));
      return;
    }
    for (let v = lo; v < g; v++) {
      cur[pos] = v;
      yield* from(pos + 1, v);
    }
  }
  yield* from(0, 0);
}

function runToEnd(s, rand, cap) {
  let n = 0;
  while (!C.isFinished(s) && n < cap) {
    C.newTrial(s, rand);
    n++;
  }
  return n;
}

const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* --------------------------------------------------- 1. options and ranges */

equal("option constants", {
  trialsMin: C.TRIALS_MIN,
  trialsMax: C.TRIALS_MAX,
  trialsStep: C.TRIALS_STEP,
  trialsDefault: C.TRIALS_DEFAULT,
  birdsMin: C.BIRDS_MIN,
  birdsMax: C.BIRDS_MAX,
  birdsDefault: C.BIRDS_DEFAULT,
}, {
  trialsMin: 0, trialsMax: 1100, trialsStep: 10, trialsDefault: 50,
  birdsMin: 2, birdsMax: 202, birdsDefault: 2,
});

equal("trials scrollbar 0..110 times ten", [C.clampTrials(0), C.clampTrials(5 * 10), C.clampTrials(110 * 10)], [0, 50, 1100]);
equal("trials clamp below and above", [C.clampTrials(-30), C.clampTrials(2000)], [0, 1100]);
equal("birds scrollbar 2..202", [C.clampBirds(1), C.clampBirds(2), C.clampBirds(202), C.clampBirds(500)], [2, 2, 202, 202]);

/* ------------------------------------- 2. perform() vs the applet, exhaustively */

{
  let tested = 0;
  let wrong = 0;
  for (let n = 2; n <= 7; n++) {
    for (const L of layouts(n, 7)) {
      const mine = C.perform(L);
      const theirs = appletPerform(L);
      tested++;
      if (JSON.stringify(mine) !== JSON.stringify(theirs)) wrong++;
    }
  }
  check(`perform() matches the applet on all ${tested} layouts (2..7 birds)`, wrong === 0, `${wrong} mismatches`);
  check("exhaustive perform() range is substantial", tested > 3000, `${tested} layouts`);
}

/* ------------------------------- 3. marked length: identity and exact small n */

{
  let wrong = 0;
  let smallTwo = 0;
  let smallThree = 0;
  for (let n = 2; n <= 7; n++) {
    for (const L of layouts(n, 7)) {
      const b = C.perform(L);
      let sum = 0;
      for (let k = 0; k < b.length; k++) if (b[k]) sum += L[k + 1] - L[k];
      if (!near(C.markedLength(L), sum, 1e-12)) wrong++;
      if (n === 2 && !near(C.markedLength(L), L[1] - L[0], 1e-12)) smallTwo++;
      if (n === 3 && !near(C.markedLength(L), L[2] - L[0], 1e-12)) smallThree++;
    }
  }
  check("markedLength() sums exactly the flagged gaps", wrong === 0, `${wrong} mismatches`);
  check("with 2 birds the marked length is their span", smallTwo === 0, `${smallTwo} mismatches`);
  check("with 3 birds the marked length is their span", smallThree === 0, `${smallThree} mismatches`);
}

{
  // The local-maximum characterisation, checked properly (no short circuit).
  let wrong = 0;
  for (let n = 2; n <= 7; n++) {
    for (const L of layouts(n, 7)) {
      const b = C.perform(L);
      for (let k = 0; k < b.length; k++) {
        const g = L[k + 1] - L[k];
        const isEnd = k === 0 || k === b.length - 1;
        const left = k > 0 ? L[k] - L[k - 1] : -1;
        const right = k < b.length - 1 ? L[k + 2] - L[k + 1] : -1;
        const expected = isEnd || g < left || g < right;
        if (b[k] !== expected) wrong++;
      }
    }
  }
  check("flagged gaps are exactly those smaller than a neighbour (ends always)", wrong === 0, `${wrong} mismatches`);
}

/* ---------------------- 4. the page's claim: N trials for every bird count */

{
  const rand = rng(12345);
  const s = C.create(30, 2, 5);
  const perBird = new Map();
  let steps = 0;
  while (!C.isFinished(s) && steps < 10000) {
    C.newTrial(s, rand); // the applet advances NBirds before drawing the birds
    perBird.set(s.birds, (perBird.get(s.birds) || 0) + 1);
    steps++;
  }
  check("the run terminates", C.isFinished(s), `birds=${s.birds}, count=${s.count}`);
  // Quirk of the applet: when it advances NBirds it sets NTrials = NStart (0)
  // and draws that trial too, without the increment the other calls get. So
  // the first bird count runs N trials, each later one runs N+1. Harmless;
  // the page describes the intent ("a specified number of trials").
  equal("the first bird count runs N trials and each later one N+1 (applet quirk)", [...perBird.entries()].sort((a, b) => a[0] - b[0]), [[2, 30], [3, 31], [4, 31], [5, 31]]);
  equal("total trials follows the applet's off-by-one", steps, 30 + 3 * 31);
  equal("Values has one slot per bird count", s.values.length, 4);
  check("no value slot is left at zero", s.values.every((v) => v > 0));
}

{
  // The whole small parameter space of the claim: 10..50 trials, 2..6 birds.
  const rand = rng(777);
  let wrong = 0;
  let combos = 0;
  for (let trials = 10; trials <= 50; trials += 10) {
    for (let min = 2; min <= 4; min++) {
      for (let max = min; max <= 6; max++) {
        combos++;
        const s = C.create(trials, min, max);
        const counts = new Map();
        let steps = 0;
        while (!C.isFinished(s) && steps < 20000) {
          C.newTrial(s, rand);
          counts.set(s.birds, (counts.get(s.birds) || 0) + 1);
          steps++;
        }
        for (let b = min; b <= max; b++) {
          const expected = b === min ? trials : trials + 1; // the applet's quirk
          if (counts.get(b) !== expected) wrong++;
        }
        const expectedSteps = trials + (max - min) * (trials + 1);
        if (steps !== expectedSteps) wrong++;
      }
    }
  }
  check(`page's trials-per-bird-count description holds (with the applet quirk) for all ${combos} combinations`, wrong === 0, `${wrong} failures`);
}

/* ------------------------------- 5. the accumulator's displayed formulas */

{
  const rand = rng(2024);
  const s = C.create(40, 3, 5);
  runToEnd(s, rand, 10000);
  const pts = C.accumulation(s);
  equal("accumulation x values are the bird counts", pts.map((p) => p.x), [3, 4, 5]);
  const expectY = s.values.map((v) => v / s.trials);
  check("finished averages divide each Value by N", pts.every((p, i) => near(p.y, expectY[i], 1e-12)));
  const total = s.values.reduce((a, b) => a + b, 0) / (40 * 3);
  check("total average divides the sum by N times the number of counts", near(C.totalAccumulation(s), total, 1e-12));
  check("the total average lies between the smallest and largest point", C.totalAccumulation(s) >= Math.min(...pts.map((p) => p.y)) - 1e-12 && C.totalAccumulation(s) <= Math.max(...pts.map((p) => p.y)) + 1e-12);
}

{
  // Mid-run: the point for the CURRENT bird count divides by NTrials.
  const rand = rng(99);
  const s = C.create(20, 2, 2);
  for (let i = 0; i < 7; i++) C.newTrial(s, rand);
  check("mid-run count and last-point divisor", near(C.accumulation(s)[0].y, s.values[0] / s.count, 1e-12), `count=${s.count}`);
  check("not finished mid-run", !C.isFinished(s));
  const done = C.create(1, 2, 2);
  C.newTrial(done, rand);
  check("no trial runs after IsFinished", C.isFinished(done) && C.newTrial(done, rand) === null);
}

/* ---------------------------- 6. options, Repeat(), plain position */

{
  const s = C.create(50, 5, 5);
  const a = C.applyOption(s, "min", 9);
  equal("raising Min past Max drags Max along", [a.min, a.max], [9, 9]);
  const b = C.applyOption(s, "max", 2);
  equal("lowering Max past Min drags Min along", [b.min, b.max], [2, 2]);
  equal("changing an option resets the data", [a.count, a.runs, a.values.length], [0, 0, 1]);
  equal("the old state is not mutated", [s.min, s.max], [5, 5]);
  const t = C.applyOption(s, "trials", 30 * 10);
  equal("trials scrollbar value is multiplied by ten", t.trials, 300);
  check("out-of-range options clamp", C.applyOption(s, "min", 999).min === 202 && C.applyOption(s, "max", -5).max === 2);
}

{
  const rand = rng(55);
  const s = C.create(20, 2, 3);
  runToEnd(s, rand, 10000);
  const before = s.values.reduce((x, y) => x + y, 0);
  C.addExtra(s, 20);
  equal("Repeat resets to Min and starts NTrials at N", [s.birds, s.count, s.startAt, s.trials], [2, 20, 20, 40]);
  for (let i = 0; i < 20; i++) C.newTrial(s, rand);
  equal("twenty extra trials all go to Min before advancing", s.birds, 2);
  check("Repeat kept earlier data and added more", s.values.reduce((x, y) => x + y, 0) > before);
}

{
  const s = C.create(20, 2, 4);
  C.newTrial(s, rng(7));
  const pos = JSON.parse(JSON.stringify(s));
  check("the position is plain JSON", typeof pos === "object" && Array.isArray(pos.values) && Array.isArray(pos.last.positions) && Array.isArray(pos.last.marked));
  check("the position has no functions", Object.values(pos).every((v) => typeof v !== "function"));
}

/* ---------------------------------------- 7. the long-run math, honestly */

function meanMarked(n, trials, seed) {
  // 1100 is the applet's real maximum number of trials per bird count.
  const s = C.create(trials, n, n);
  let sum = 0;
  const rand = rng(seed);
  for (let i = 0; i < trials; i++) sum += C.newTrial(s, rand).length;
  return sum / trials;
}

check("2 birds: average span is 1/3", near(meanMarked(2, 1100, 1), 1 / 3, 0.02));
check("3 birds: average span is 1/2", near(meanMarked(3, 1100, 2), 1 / 2, 0.02));
check("many birds: average tends to 7/18", near(meanMarked(200, 1100, 3), 7 / 18, 0.02), `7/18 = ${(7 / 18).toFixed(5)}`);
check("adding birds does not increase the average (sampled)", meanMarked(50, 1100, 4) > meanMarked(200, 1100, 4));
check("the same seed reproduces the same simulation", near(meanMarked(80, 500, 8), meanMarked(80, 500, 8), 0));

done("birds-on-wire");
