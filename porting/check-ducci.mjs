#!/usr/bin/env node
"use strict";

/*
 * Logic test for ducci/ducci-core.js.
 *
 *   1. step() against the applet's Compute(), transcribed from the bytecode
 *      with its in-place updates and its alternating m_Shift, over many
 *      steps from random starts for every N from 3 to 20: the applet's
 *      circle is the core's, turned by the half-place the drawing moves.
 *   2. The page's claims:
 *      - N = 4 always ends at zeros (every start with entries 0..15), and
 *        Honsberger's lemma: within four steps the largest number drops;
 *      - for N = 8 and 16 too (random starts), "whenever N is a power of 2";
 *      - N = 3 need not ("the no answer is as much obvious");
 *      - N = 5 falls into loops of length "3 or 6 depending on your point of
 *        view": a turned copy of the circle comes back after 3 steps, on the
 *        same ring of drawn positions after 6; an exact repeat takes 15;
 *      - N = 6 "has two loops: of length 2 and 3". Not quite: the two loops
 *        repeat exactly after 6 and 3 steps, or after 2 and 1 counting turns
 *        of the circle; the math section gives these;
 *      - 101010, 121210 and 123210 end at zeros for N = 6;
 *      - a single 1 among zeros ends at zeros exactly when N is a power of 2;
 *      - without the absolute value the numbers blow up.
 *   3. fill(): zeros, or 0..20 at random.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const D = loadCore("ducci/ducci-core.js", "DucciCore");
// Loop lengths found by the census in section 2: exactly, and counting turns as the same.
const LOOPS = { five: [[15], [3]], six: [[3, 6], [1, 2]] };

/* ------------------------------------------- 1. the applet's Compute() */

function appletCompute(d, shift) {
  const n = d.length;
  if (shift === 1) {
    const first = d[0];
    for (let i = 1; i < n; i++) d[i - 1] = Math.abs(d[i - 1] - d[i]);
    d[n - 1] = Math.abs(d[n - 1] - first);
  } else {
    const last = d[n - 1];
    for (let i = n - 1; i > 0; i--) d[i] = Math.abs(d[i] - d[i - 1]);
    d[0] = Math.abs(d[0] - last);
  }
  return 1 - shift; // SetPositions() flips m_Shift
}

{
  const random = rng(3);
  let bad = 0;
  for (let n = D.MIN_N; n <= D.MAX_N; n++) {
    for (let t = 0; t < 30; t++) {
      const start = D.fill(n, true, random);
      let core = start.slice();
      const app = start.slice();
      let shift = 1; // the first Compute() runs with m_Shift = 1 after Reset() and SetPositions()
      for (let k = 0; k < 25; k++) {
        shift = appletCompute(app, shift);
        core = D.step(core);
        // After an odd number of steps the applet's indices sit half a turn round: rotate by one.
        const same = app.join() === core.join() || app.join() === core.slice(-1).concat(core.slice(0, -1)).join();
        if (!same && D.canonical(app) !== D.canonical(core)) bad++;
      }
    }
  }
  check("step() follows the applet's Compute() for N = 3..20", bad === 0, `${bad} differ`);
}

/* ----------------------------------------------------- 2. the claims */

{
  let notZero = 0;
  let lemma = 0;
  for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) for (let c = 0; c < 16; c++) for (let d = 0; d < 16; d++) {
    const s = [a, b, c, d];
    if (D.run(s).zeroAt === undefined) notZero++;
    const max0 = Math.max(...s);
    if (max0 > 0) {
      let cur = s;
      let dropped = false;
      for (let k = 0; k < 4; k++) { cur = D.step(cur); if (Math.max(...cur) < max0) dropped = true; }
      if (!dropped) lemma++;
    }
  }
  equal("N = 4: every start with entries 0..15 ends at zeros", notZero, 0);
  equal("N = 4: the largest number drops within four steps (Honsberger)", lemma, 0);
}
{
  const random = rng(16);
  for (const n of [2, 8, 16]) {
    let bad = 0;
    for (let t = 0; t < 3000; t++) {
      const s = Array.from({ length: n }, () => Math.floor(random() * 1000));
      if (D.run(s).zeroAt === undefined) bad++;
    }
    equal(`N = ${n}: 3,000 random starts all end at zeros`, bad, 0);
  }
}
check("N = 3: 0, 0, 1 never reaches zeros", D.run([0, 0, 1]).zeroAt === undefined);

function loopLengths(n, max) {
  const periods = new Set();
  const rot = new Set();
  const idx = new Array(n).fill(0);
  for (;;) {
    const r = D.run(idx);
    if (r.period) { periods.add(r.period); rot.add(r.rotPeriod); }
    let i = 0;
    while (i < n && ++idx[i] > max) idx[i++] = 0;
    if (i === n) break;
  }
  return { periods: [...periods].sort((a, b) => a - b), rot: [...rot].sort((a, b) => a - b) };
}
{
  const five = loopLengths(5, 4);
  equal("N = 5: loops have length 15, or 3 counting turns as the same", [five.periods, five.rot], LOOPS.five);
  const six = loopLengths(6, 3);
  equal("N = 6: loop lengths, and counting turns as the same", [six.periods, six.rot], LOOPS.six);
  // The page's "3 or 6" for N = 5: a turned copy after 3 steps, back on the same ring of
  // positions (the applet draws each step half a place round) after 6.
  let cur = [1, 0, 0, 0, 1];
  for (let k = 0; k < 20; k++) cur = D.step(cur); // into the loop
  const sameUpToTurn = (t) => { let m = cur; for (let k = 0; k < t; k++) m = D.step(m); return D.canonical(m) === D.canonical(cur); };
  check("N = 5: a turned copy after 3 steps, on the same ring after 6", sameUpToTurn(3) && sameUpToTurn(6) && ![1, 2, 4, 5].some(sameUpToTurn));
}
for (const s of ["101010", "121210", "123210"]) {
  check(`N = 6: ${s} ends at zeros`, D.run([...s].map(Number)).zeroAt !== undefined);
}
{
  const isPow2 = (n) => (n & (n - 1)) === 0;
  let bad = 0;
  for (let n = 2; n <= 64; n++) {
    const s = new Array(n).fill(0);
    s[0] = 1;
    if ((D.run(s).zeroAt !== undefined) !== isPow2(n)) bad++;
  }
  equal("a single 1 ends at zeros exactly when N is a power of 2 (N = 2..64)", bad, 0);
}
{
  const random = rng(9);
  let tame = 0;
  for (let t = 0; t < 500; t++) {
    let s = Array.from({ length: 4 }, () => Math.floor(random() * 20));
    if (s.every((x) => x === s[0])) continue;
    let grew = false;
    for (let k = 0; k < 60 && !grew; k++) {
      s = s.map((x, i) => x - s[(i + 1) % 4]);
      if (Math.max(...s.map(Math.abs)) > 1e6) grew = true;
    }
    if (!grew) tame++;
  }
  equal("without the absolute value, N = 4 starts that are not all equal blow up", tame, 0);
}

/* -------------------------------------------------------- 3. fill */

{
  const random = rng(1);
  equal("zeros when Random is off", D.fill(5, false), [0, 0, 0, 0, 0]);
  const vals = new Set();
  for (let t = 0; t < 2000; t++) for (const v of D.fill(4, true, random)) vals.add(v);
  equal("Random fills 0..20", [...vals].sort((a, b) => a - b), Array.from({ length: 21 }, (_, i) => i));
  equal("3 to 20 numbers, 4 to start", [D.MIN_N, D.MAX_N, D.DEFAULT_N], [3, 20, 4]);
}

done("ducci");
