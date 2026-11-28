#!/usr/bin/env node
"use strict";

/*
 * Logic test for light-bulbs/light-bulbs-core.js.
 *
 *   node porting/check-light-bulbs.mjs
 *
 * Part 1 checks the rules, the ranges, the reset and end conditions. Part 2
 * compares the core with a second, literal transcription of OneStep() from the
 * applet's bytecode over all bulb counts, many look-ahead/skip values and
 * several starting patterns, then exhaustively over every state for n <= 5.
 * Part 3 checks every claim on the linked article: the expected-time formula,
 * its printed number, and the four probability thresholds.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("light-bulbs/light-bulbs-core.js", "LightBulbsCore");

/* --------------------------------------------------- 1. rules and options */

{
  const s = C.start({});
  equal("default options are the panel's displayed values",
    [s.bulbs, s.lookAhead, s.skip, s.steps], [15, 1, 0, 15]);
  equal("NCheck is Skip plus one", C.nCheck(s), 1);
  equal("the pointer starts at bulb zero", s.position, 0);
  check("every bulb starts lit", s.on.length === 15 && s.on.every(Boolean));
  equal("no steps have been performed", [s.stepsDone, s.remaining], [0, 15]);
  check("a fresh run is not finished", C.result(s) === null);
  equal("the applet offers one move", C.legalMoves(s), ["step"]);
  check("other moves are refused", C.move(s, "jump") === null);

  const clamped = C.start({ bulbs: 1, lookAhead: 0, skip: -3, steps: 0 });
  equal("lower bounds are applied",
    [clamped.bulbs, clamped.lookAhead, clamped.skip, clamped.steps], [2, 1, 0, 1]);
  const big = C.start({ bulbs: 101, lookAhead: 1001, skip: 51, steps: 30001 });
  equal("upper bounds are applied",
    [big.bulbs, big.lookAhead, big.skip, big.steps], [100, 1000, 50, 30000]);
  const odd = C.start({ bulbs: 7.9, lookAhead: "4.7", skip: NaN, steps: 2.2 });
  equal("non-integers are truncated and bad values fall back",
    [odd.bulbs, odd.lookAhead, odd.skip, odd.steps], [7, 4, 0, 2]);

  const finished = C.run(C.start({ steps: 3 }), 3);
  equal("the batch finishes after exactly its steps", [finished.stepsDone, finished.remaining], [3, 0]);
  check("a finished batch reports done", C.result(finished) === "done");
  check("a further step is still allowed by the core (applet decrements StepsToGo)",
    C.oneStep(finished).remaining === -1);

  const changed = C.withOptions(C.run(C.start({}), 6), { bulbs: 4, skip: 2, steps: 9 });
  check("an option change resets the bulbs", changed.on.length === 4 && changed.on.every(Boolean));
  equal("an option change resets pointer and counters",
    [changed.position, changed.stepsDone, changed.remaining, changed.skip], [0, 0, 9, 2]);
  equal("the Fast checkbox uses the applet's two intervals", [C.interval(false), C.interval(true)], [1000, 100]);
}

/* ----------------------------- 2. one step, checked against the bytecode */

/*
 * LightBulbsCanvas.OneStep(), written again straight from javap, with the
 * applet's own field names and no reference to the core.
 */
function appletMachine(n, d, k, steps, pattern, position) {
  return {
    NBulbs: n, NDiff: d, NCheck: k + 1,
    OnOff: pattern.slice(), CurrentPosition: position,
    StepsToGo: steps, NSteps: 0,
    R: 50, L: 25,
    Ro: Math.min(Math.trunc(Math.PI * 50 / (n + 2)), Math.trunc(50 / 10)),
    Interval: 1000,
  };
}
function appletOneStep(m) {
  m.StepsToGo = m.StepsToGo - 1;
  const tmp = (m.CurrentPosition + m.NDiff) % m.NBulbs;
  if (m.OnOff[m.CurrentPosition] !== 0) {
    m.OnOff[tmp] = m.OnOff[tmp] !== 0 ? 0 : 1;
  }
  m.CurrentPosition = (m.CurrentPosition + m.NCheck) % m.NBulbs;
  m.NSteps = m.NSteps + 1;
  return m;
}
function coreState(n, d, k, steps, pattern, position) {
  return {
    bulbs: n, lookAhead: d, skip: k, steps: steps,
    on: pattern.map((x) => x !== 0), position: position,
    stepsDone: 0, remaining: steps,
  };
}
function sameMachine(core, applet, label) {
  check(label + ": bulb states", core.on.length === applet.OnOff.length &&
    core.on.every((v, i) => (v ? 1 : 0) === applet.OnOff[i]));
  check(label + ": pointer", core.position === applet.CurrentPosition);
  check(label + ": counters", core.stepsDone === applet.NSteps && core.remaining === applet.StepsToGo);
}

{
  // A lit bulb at the pointer flips the look-ahead bulb; a dark one does not.
  const lit = C.start({ bulbs: 4, lookAhead: 1, skip: 1 });
  const after = C.oneStep(lit);
  equal("lit visitor flips the next bulb", after.on, [true, false, true, true]);
  equal("pointer jumps by Skip+1", after.position, 2);
  equal("the given position is not mutated", lit.on, [true, true, true, true]);
  const dark = C.setPosition(C.start({ bulbs: 4, lookAhead: 1, skip: 1 }), 1);
  const darkOn = dark.on.slice();
  darkOn[1] = false;
  const darkAfter = C.oneStep(Object.assign({}, dark, { on: darkOn }));
  equal("a dark visitor changes nothing", darkAfter.on, darkOn);
  equal("but the pointer still advances", darkAfter.position, 3);

  // The same step when the two arrows point at the same bulb (d a multiple of n).
  const same = C.start({ bulbs: 5, lookAhead: 5, skip: 0 });
  equal("look-ahead wraps to the same bulb", C.nextIndex(same), 0);
  equal("a full turn of look-ahead flips the visitor's own bulb",
    C.oneStep(same).on, [false, true, true, true, true]);

  // Every i -> j wrap of the pointer, for both modules.
  for (let n = 2; n <= 100; n++) {
    for (let k = 0; k <= 50; k++) {
      const s = C.setPosition(C.start({ bulbs: n, skip: k }), n - 1);
      const want = (n - 1 + k + 1) % n;
      check(`pointer wrap n=${n} k=${k}`, C.oneStep(s).position === want);
    }
  }
}

{
  // Second transcription: the whole range of bulb counts, many look-aheads
  // and skips, two patterns and several starting pointers, twelve steps each.
  const random = rng(20261128);
  const diffs = [1, 2, 3, 7, 15, 49, 100, 999, 1000];
  const skips = [0, 1, 2, 15, 50];
  let compared = 0;
  for (let n = 2; n <= 100; n++) {
    for (const d of diffs) {
      for (const k of skips) {
        for (let variant = 0; variant < 3; variant++) {
          const pattern = [];
          for (let i = 0; i < n; i++) {
            pattern.push(variant === 0 ? 1 : variant === 1 ? (i % 2) : (random() < 0.5 ? 1 : 0));
          }
          const position = variant * 7 % n;
          let core = coreState(n, d, k, 40, pattern, position);
          const ap = appletMachine(n, d, k, 40, pattern, position);
          for (let step = 0; step < 12; step++) {
            core = C.oneStep(core);
            appletOneStep(ap);
            sameMachine(core, ap, `bytecode n=${n} d=${d} k=${k} v=${variant} s=${step}`);
            compared++;
          }
        }
      }
    }
  }
  check(`core matches a second transcription in ${compared} steps`, compared === 99 * 9 * 5 * 3 * 12);

  // The reset formula, for every allowed bulb count.
  for (let n = 2; n <= 100; n++) {
    const expected = Math.min(Math.trunc(Math.PI * 50 / (n + 2)), Math.trunc(50 / 10));
    check(`Ro matches Reset() for n=${n}`, C.bulbRadius(n) === expected);
  }
}

{
  // Exhaustive: every state of the machine for n = 2..5, every d, every k.
  let states = 0;
  for (let n = 2; n <= 5; n++) {
    const count = n * Math.pow(2, n);
    for (let d = 1; d <= n + 2; d++) {
      for (let k = 0; k <= n + 1; k++) {
        for (let mask = 0; mask < Math.pow(2, n); mask++) {
          const pattern = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
          for (let pos = 0; pos < n; pos++) {
            const core = coreState(n, d, k, 30000, pattern, pos);
            const ap = appletMachine(n, d, k, 30000, pattern, pos);
            sameMachine(C.oneStep(core), appletOneStep(ap), `exhaustive n=${n} d=${d} k=${k} ${mask}/${pos}`);
            states++;
          }
        }
      }
    }
    // The step map is a permutation of the finite state space, so the orbit
    // from any state returns to it within count steps (the period need not
    // divide count).
    for (let mask = 0; mask < Math.pow(2, n); mask++) {
      const pattern = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
      for (let pos = 0; pos < n; pos++) {
        const first = coreState(n, 1, 0, 30000, pattern, pos);
        let s = first;
        let returned = false;
        for (let i = 0; i < count; i++) {
          s = C.oneStep(s);
          if (s.on.every((v, j) => v === first.on[j]) && s.position === first.position) {
            returned = true;
            break;
          }
        }
        check(`orbit returns within ${count} states (n=${n}, ${mask}/${pos})`, returned);
      }
    }
  }
  check(`every small state was compared twice (${states} states)`, states === 10872);

  // run() is exactly repeated move(), including large Perform batches.
  for (const steps of [1, 7, 15, 137, 30000]) {
    let s = C.start({ bulbs: 12, lookAhead: 5, skip: 3, steps: steps });
    let t = s;
    for (let i = 0; i < steps; i++) t = C.move(t, "step");
    check(`run() equals ${steps} separate steps`,
      JSON.stringify(C.run(s, steps)) === JSON.stringify(t));
  }
}

/* -------------------------------------------- 3. the article's exact claims */

{
  // A second, independent transcription of the article's expected-time sum.
  function printedExpectedTime(n) {
    let a = 0;
    for (let c = 2; c <= n; c++) a += 1 / Math.pow(c, 2);
    return Math.pow(n, 2) - n / (n - 1) - a;
  }
  for (let n = 2; n <= 100; n++) {
    check(`expected-time formula for n=${n}`,
      Math.abs(C.expectedTime(n) - printedExpectedTime(n)) < 1e-9);
  }
  const stated = C.expectedTime(100);
  check("the printed formula gives about 9998.35 days, not 9935.5",
    Math.abs(stated - 9998.354915) < 0.001 && Math.abs(stated - 9935.5) > 60);
  check("the article's 9935.5 requires n times its stated sum",
    Math.abs(C.expectedTimeScaled(100) - 9935.5) < 0.02);
  check("9935.5 days is about 27.2 years, not 26.2",
    Math.abs(9935.5 / 365 - 27.22) < 0.02 && Math.abs(9935.5 / 365 - 26.2) > 1);
  check("the article's 3.14 years for 1146 days is right", Math.abs(1146 / 365 - 3.14) < 0.01);
  check("the article's 5 years and a week for 1833 days is right", Math.abs(1833 / 365 - 5.02) < 0.01);

  // A second transcription of the probability recursion, using yesterday's
  // array explicitly rather than the core's two-array update.
  function articleProbability(n, days) {
    let prev = new Array(n + 1).fill(0);
    prev[1] = 1;
    for (let day = 1; day < days; day++) {
      const now = new Array(n + 1).fill(0);
      for (let c = 1; c <= n; c++) {
        now[c] = prev[c - 1] * (1 - (c - 1) / n) + prev[c] * (c / n);
      }
      prev = now;
    }
    return prev[n];
  }
  for (const n of [2, 3, 5, 10, 50, 100]) {
    for (const d of [0, 1, 2, 7, 100, 1145, 1146, 1375, 1604, 1833]) {
      check(`probability recursion n=${n} d=${d}`,
        Math.abs(C.completionProbability(n, d) - articleProbability(n, d)) < 1e-12);
    }
  }
  check("P(1,1) = 1 and P(1,0) = 0",
    C.completionProbability(1, 1) === 1 && C.completionProbability(1, 0) === 0);

  // The four printed thresholds, and that each is the first day it holds.
  const thresholds = [[1146, 0.999], [1375, 0.9999], [1604, 0.99999], [1833, 0.999999]];
  for (const [day, level] of thresholds) {
    const p = articleProbability(100, day);
    const before = articleProbability(100, day - 1);
    check(`P(100,${day}) has reached ${level}`, p >= level);
    check(`P(100,${day - 1}) has not reached ${level} yet`, before < level);
  }
  // P(OFF) = 1/(n-c) from summing the geometric series in the article.
  for (const c of [0, 1, 2, 40, 98]) {
    let sum = 0;
    for (let k = 0; k < 3000; k++) sum += (1 / 100) * Math.pow(c / 100, k);
    check(`P(OFF) = 1/(100-${c})`, Math.abs(sum - 1 / (100 - c)) < 1e-9);
  }
}

done("light-bulbs");
