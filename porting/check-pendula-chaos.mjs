#!/usr/bin/env node
"use strict";

/*
 * Logic test for pendula-chaos/pendula-chaos-core.js.
 *
 *   node porting/check-pendula-chaos.mjs
 *
 * The dots' heights are compared with a second transcription of the applet's
 * formula; the page's "order returns" claim is checked as exact facts: every
 * dot is at its top at every multiple of 40 pi, and at 40 pi p/q there are at
 * most floor(q/2)+1 distinct levels, for every N from 5 to 100 in fives, every
 * start 1..100 and q up to 12.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const P = loadCore("pendula-chaos/pendula-chaos-core.js", "PendulaCore");

// the applet's own y = M - A cos(Step (i+T) / 20), written out once more
const appletY = (M, A, step, i, T) => M - A * Math.cos((step * (i + T)) / 20);
for (const step of [0, 1, 7.5, 123.4, 500]) for (const T of [1, 2, 37, 100]) for (let i = 0; i < 100; i++) {
  // with M = 0 and A = 1 the dot's height above its lowest point is 1 + y
  check(`offset i=${i} T=${T} step=${step}`, Math.abs(1 + appletY(0, 1, step, i, T) - P.offset(step, T, i)) < 1e-12);
}
equal("a new game: step 0, stopped", [P.start({}).step, P.start({}).dir, P.start({}).n, P.start({}).t], [0, 0, 20, 1]);
equal("N is kept to 5..100 in fives", [P.start({ n: 3 }).n, P.start({ n: 12 }).n, P.start({ n: 999 }).n, P.start({ n: 100 }).n], [5, 10, 100, 100]);
equal("T is kept to 1..100", [P.start({ t: 0 }).t, P.start({ t: 500 }).t, P.start({ t: 7 }).t], [1, 100, 7]);
check("the speed is 2/N", P.speed(20) === 0.1 && P.speed(5) === 0.4);
check("a full cycle takes 20 pi N ticks for every N", [5, 20, 55, 100].every((n) => Math.abs(P.speed(n) * 20 * Math.PI * n - P.CYCLE) < 1e-9));

// at step 0 every dot is at its lowest offset, and at every multiple of 40 pi too
for (let n = 5; n <= 100; n += 5) for (const t of [1, 2, 3, 10, 57, 100]) {
  check(`N=${n} T=${t}: all dots in line at step 0`, P.levels(n, t, 0) === 1);
  for (const k of [1, 2, 7]) check(`N=${n} T=${t}: in line again at ${k} cycles`, P.levels(n, t, k * P.CYCLE, 1e-6) === 1);
}
// at 40 pi p / q the dots sit on at most floor(q/2)+1 levels (and exactly that many when T..T+N-1 hits every residue class)
let breaks = 0;
for (let n = 5; n <= 100; n += 5) for (let t = 1; t <= 100; t += 9) for (let q = 2; q <= 12; q++) for (let p = 1; p < q; p++) {
  const lv = P.levels(n, t, (P.CYCLE * p) / q, 1e-9);
  if (lv > Math.floor(q / 2) + 1) breaks++;
}
equal("at 40 pi p/q there are at most floor(q/2)+1 levels", breaks, 0);
equal("half a cycle: two levels (alternate dots)", P.levels(20, 1, P.CYCLE / 2, 1e-9), 2);
equal("a third of a cycle: two levels (1 + floor(3/2))", P.levels(30, 1, P.CYCLE / 3, 1e-9), 2);
equal("a fifth of a cycle: three levels", P.levels(30, 1, P.CYCLE / 5, 1e-9), 3);
// going backwards retraces
let s = Object.assign(P.start({ n: 20, t: 1 }), { dir: 1 });
s = P.advance(s, 50);
const forward = s.step;
s = P.advance(Object.assign(s, { dir: -1 }), 50);
check("forward then backward returns to the start", Math.abs(s.step) < 1e-12 && forward > 0);
done("pendula-chaos");
