#!/usr/bin/env node
"use strict";

/*
 * Logic test for square-sieve/square-sieve-core.js.
 *
 *   node porting/check-square-sieve.mjs
 *
 * For every N the applet allows (5 to 250): after N steps exactly the perfect
 * squares are red (the page's claim), checked against a second transcription
 * of the applet's SetM and against "m is red iff it has an odd number of
 * divisors". Also the partial states: m is final once step m is done.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("square-sieve/square-sieve-core.js", "SquareSieveCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start({});
  equal("defaults: N = 50, step 1 next, all blue", [s.n, s.next, s.red.some(Boolean)], [50, 1, false]);
  const s1 = C.step(s);
  equal("step 1 flips everything", C.redNumbers(s1).length, 50);
  equal("then step 2 is next", s1.next, 2);
  const s2 = C.step(s1);
  equal("step 2 flips the evens back", C.redNumbers(s2).filter((m) => m % 2 === 0).length, 0);
  equal("N is clamped to 5..250", [C.start({ n: 1 }).n, C.start({ n: 999 }).n], [5, 250]);
  const a = C.start({ n: 10 });
  C.step(a);
  equal("step does not change the position it is given", a.next, 1);
  check("not over until the last step", C.result(C.finish(C.start({ n: 5 }))) === "done" && C.result(C.start({ n: 5 })) === null);
  equal("past the end nothing changes", C.step(C.finish(C.start({ n: 5 }))).next, 6);
}

/* ------------------------------------------- 2. every case, where it is small */
{
  let bad = 0;
  for (let n = 5; n <= 250; n++) {
    const reds = C.redNumbers(C.finish(C.start({ n })));
    const squares = [];
    for (let r = 1; r * r <= n; r++) squares.push(r * r);
    if (JSON.stringify(reds) !== JSON.stringify(squares)) bad++;
  }
  check("after N steps exactly the squares are red, every N from 5 to 250", bad === 0, `${bad} sizes wrong`);

  // m is final once step m is done: nothing later touches it
  let late = 0;
  const s = C.start({ n: 250 });
  let cur = s;
  const snapshots = [cur];
  while (C.canStep(cur)) { cur = C.step(cur); snapshots.push(cur); }
  const final = cur;
  for (let k = 1; k <= 250; k++) for (let m = 1; m <= k; m++) if (snapshots[k].red[m - 1] !== final.red[m - 1]) late++;
  check("a number never changes after its own step (all 250 states)", late === 0);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // the applet's SetM(m): for (i = m-1; i < N; i += m) Sign[i] = !Sign[i]
  let ok = true;
  for (let n = 5; n <= 250; n += 5) {
    const sign = new Array(n).fill(false);
    for (let m = 1; m <= n; m++) for (let i = m - 1; i < n; i += m) sign[i] = !sign[i];
    if (JSON.stringify(sign) !== JSON.stringify(C.finish(C.start({ n })).red)) ok = false;
  }
  check("matches SetM transcribed from the bytecode, N = 5, 10, ..., 250", ok);

  // divisor-count parity
  let bad = 0;
  const red = C.finish(C.start({ n: 250 })).red;
  for (let m = 1; m <= 250; m++) {
    let d = 0;
    for (let k = 1; k <= m; k++) if (m % k === 0) d++;
    if ((d % 2 === 1) !== red[m - 1]) bad++;
  }
  check("red iff an odd number of divisors, for m up to 250", bad === 0);
}

done("square-sieve");
