#!/usr/bin/env node
"use strict";

/*
 * Logic test for dyno-ellipse/dyno-ellipse-core.js.
 *
 *   node porting/check-dyno-ellipse.mjs
 *
 * The page (https://www.cut-the-knot.org/Curriculum/Geometry/DynoEllipse.shtml)
 * claims that the sum of two counter-rotating circular vectors is an ellipse,
 * with X = (r1+r2)cos(wt), Y = (r1-r2)sin(wt) and therefore
 * (X/(r1+r2))^2 + (Y/(r1-r2))^2 = 1. It also names the circle and line-segment
 * extremes and five named curves for other (W, R) = (rate1/rate2, r1/r2):
 * cardioid (2, 1/2), deltoid (-2, 1/2), astroid (-3, 1/3), nephroid (3, 1/3)
 * and the ellipse (-1, any R). All are checked here over the whole option
 * ranges, not a few samples. The core is also compared with a second, literal
 * transcription of DynoEllipseCanvas.update from javap (including the unused
 * N*Rate1 local and the divisor 360 on radians), with exact double equality.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("dyno-ellipse/dyno-ellipse-core.js", "DynoEllipseCore");

/* ---------------------------------------- 1. the applet's options and defaults */

equal("applet's four initial values (Rate1, Rate2, R1, R2)",
  [C.start().rate1, C.start().rate2, C.start().r1, C.start().r2], [2, 5, 60, 40]);
equal("the four number ranges are -50..50, -50..50, 0..100, 0..100",
  [C.RATE_MIN, C.RATE_MAX, C.RADIUS_MIN, C.RADIUS_MAX], [-50, 50, 0, 100]);
equal("centre is half the applet's 400 by 300 canvas", C.CENTER, { x: 200, y: 150 });
equal("both phases are zero and the divisor is 360 radians", [C.PHASE1, C.PHASE2, C.DIVISOR], [0, 0, 360]);
equal("new picture has Go off, both Show boxes on, no steps",
  [C.start().running, C.start().showCircles, C.start().showBars, C.start().n], [false, true, true, 0]);

equal("clamping at and beyond each end of the ranges",
  [C.start({ rate1: -99 }).rate1, C.start({ rate1: 99 }).rate1,
    C.start({ rate2: -99 }).rate2, C.start({ rate2: 99 }).rate2,
    C.start({ r1: -9 }).r1, C.start({ r1: 999 }).r1,
    C.start({ r2: -9 }).r2, C.start({ r2: 999 }).r2],
  [-50, 50, -50, 50, 0, 100, 0, 100]);
equal("non-numbers fall back to the applet's initial values",
  [C.start({ rate1: "x" }).rate1, C.start({ rate2: NaN }).rate2,
    C.start({ r1: undefined }).r1, C.start({ r2: null }).r2], [2, 5, 60, 40]);
check("fractional options truncate as a Java number field does",
  C.start({ rate1: 12.9, r1: 60.7 }).rate1 === 12 && C.start({ rate1: 12.9, r1: 60.7 }).r1 === 60);

{
  const s = { ...C.start(), n: 40 }; // a step count without recording a move
  const changed = C.setOption(s, "rate2", -s.rate1);
  check("a number change calls the applet's Reset (step count back to zero)",
    changed.n === 0 && changed.rate2 === -2 && s.rate2 === 5);
  check("a number change keeps the other three numbers and is recorded",
    changed.rate1 === 2 && changed.r1 === 60 && changed.r2 === 40 && changed.explored && changed.moves === 1);
  check("setting a number to the same value does nothing", C.setOption(s, "rate1", 2) === s);
  const flags = C.setShow(C.setRunning(s, true), "showCircles", false);
  check("Go and Show change flags without resetting the step count",
    flags.n === 40 && flags.running === true && !flags.showCircles);
  check("a new picture is not finished, an explored one is",
    C.result(C.start()) === null && C.result(changed) === "done");
}

/* ------------------------------------------------ 2. the applet's own method */

/* Literal javap transcription of DynoEllipseCanvas.update, 218-409.
   ph1/ph2 are locals 5/7, div is local 9, L10 is the unused local 10. */
const CX = 200, CY = 150; // init: DoubPoint(width/2, height/2) with 400 by 300
function appletFrame(n, Rate1, Rate2, R1, R2) {
  const ph1 = 0, ph2 = 0, div = 360;
  const L10 = n * Rate1; // computed at 223-234, never read
  const v1x = R1 * Math.cos((n * Rate1) / div + ph1);
  const v1y = -R1 * Math.sin((n * Rate1) / div - ph1);
  const v2x = R2 * Math.cos((n * Rate2) / div + ph2);
  const v2y = -R2 * Math.sin((n * Rate2) / div - ph2);
  return {
    L10,
    v1: { x: v1x, y: v1y },
    v2: { x: v2x, y: v2y },
    end1: { x: CX + v1x, y: CY + v1y },
    end2: { x: CX + v2x, y: CY + v2y },
    sum: { x: CX + v1x + v2x, y: CY + v1y + v2y },
  };
}

let cases = 0, mismatch = 0, addition = 0;
function compare(state, n) {
  const got = C.frame(state, n), ref = appletFrame(n, state.rate1, state.rate2, state.r1, state.r2);
  cases++;
  if (got.unusedL10 !== ref.L10 ||
      got.v1.x !== ref.v1.x || got.v1.y !== ref.v1.y ||
      got.v2.x !== ref.v2.x || got.v2.y !== ref.v2.y ||
      got.end1.x !== ref.end1.x || got.end1.y !== ref.end1.y ||
      got.end2.x !== ref.end2.x || got.end2.y !== ref.end2.y ||
      got.sum.x !== ref.sum.x || got.sum.y !== ref.sum.y) mismatch++;
  // The page's "componentwise addition of vectors", at every step.
  if (got.sum.x !== CX + got.v1.x + got.v2.x || got.sum.y !== CY + got.v1.y + got.v2.y) addition++;
}

{
  const before = cases;
  for (let rate1 = C.RATE_MIN; rate1 <= C.RATE_MAX; rate1++) {
    for (let rate2 = C.RATE_MIN; rate2 <= C.RATE_MAX; rate2++) {
      const s = C.start({ rate1, rate2, r1: 60, r2: 40 });
      for (const n of [0, 1, 7, 359, 1000]) compare(s, n);
    }
  }
  equal(`core = bytecode for all ${cases - before} rate pairs (five steps each)`, mismatch, 0);
}

{
  const before = cases;
  for (let r1 = C.RADIUS_MIN; r1 <= C.RADIUS_MAX; r1++) {
    for (let r2 = C.RADIUS_MIN; r2 <= C.RADIUS_MAX; r2++) {
      const s = C.start({ rate1: 2, rate2: -2, r1, r2 });
      for (const n of [0, 1, 17, 1132]) compare(s, n);
    }
  }
  equal(`core = bytecode for all ${cases - before} radius pairs (counter-rotating)`, mismatch, 0);
}

{
  const before = cases;
  for (const [rate1, rate2, r1, r2] of [[0, 0, 0, 0], [100, -100, 100, 100],
    [2, 5, 60, 40], [-50, 50, 0, 100], [1, -3, 1, 3]]) {
    const s = C.start({ rate1, rate2, r1, r2 });
    for (let n = 0; n <= C.PERIOD; n++) compare(s, n);
  }
  equal(`core = bytecode at every step of ${cases - before} edge configurations`, mismatch, 0);
  check("the sum is the componentwise sum of the two vectors everywhere", addition === 0,
    `${addition} bad additions in ${cases} frames`);
}

/* ----------------------------------------------- 3. the page's ellipse claim */

{
  let bad = 0, tested = 0, maxX = 0, minX = 0, maxY = 0;
  const steps = [0, 1, 17, 91, 282, 283, 359, 565, 566, 700, 1131, 2000, 3000];
  function ellipse(rate, r1, r2) {
    const s = C.start({ rate1: rate, rate2: -rate, r1, r2 });
    if (r1 === r2 || r1 + r2 === 0) return;
    for (const n of steps) {
      const p = C.frame(s, n).sum;
      const X = p.x - CX, Y = p.y - CY;
      const lhs = (X / (r1 + r2)) ** 2 + (Y / (r1 - r2)) ** 2;
      tested++;
      if (Math.abs(lhs - 1) > 2e-12) bad++;
      maxX = Math.max(maxX, Math.abs(X) / (r1 + r2));
      minX = Math.min(minX, Math.abs(X) / (r1 + r2));
      maxY = Math.max(maxY, Math.abs(Y) / Math.abs(r1 - r2));
    }
  }
  for (let rate = 1; rate <= C.RATE_MAX; rate++) {
    for (const r1 of [0, 1, 40, 60, 100]) for (const r2 of [0, 1, 40, 60, 100]) ellipse(rate, r1, r2);
  }
  for (const rate of [1, 2, 5, 50]) {
    for (let r1 = 0; r1 <= 100; r1++) for (let r2 = 0; r2 <= 100; r2++) ellipse(rate, r1, r2);
  }
  check(`(X/(r1+r2))^2 + (Y/(r1-r2))^2 = 1 for W=-1 (${tested} points)`, bad === 0, `${bad} off the ellipse`);
  check("the semi-axes are r1+r2 and |r1-r2| (both extremes are reached)",
    minX < 1e-2 && Math.abs(maxX - 1) < 1e-4 && Math.abs(maxY - 1) < 1e-4,
    `minX ${minX}, maxX ${maxX}, maxY ${maxY}`);
}
{
  const s = C.start({ rate1: 2, rate2: -2, r1: 60, r2: 40 });
  const p = C.frame(s, 90).sum;
  check("the ellipse's semi-axes are 100 and 20, centred on (200, 150)",
    Math.abs(Math.abs(p.x - 200) / 100 - Math.cos(0.5)) < 1e-12 &&
    Math.abs(Math.abs(p.y - 150) / 20 - Math.sin(0.5)) < 1e-12);
  check("shapeName reports the counter-rotating case as an ellipse", C.shapeName(s) === "an ellipse");
}

/* ------------------------------------- 4. the circle and straight-line extremes */

{
  let bad = 0, tested = 0;
  for (let rate = -50; rate <= 50; rate++) {
    for (const [r1, r2] of [[0, 0], [0, 100], [40, 60], [60, 40], [100, 100]]) {
      const s = C.start({ rate1: rate, rate2: rate, r1, r2 });
      for (const n of [0, 1, 17, 359, 1132, 3000]) {
        const p = C.frame(s, n).sum;
        tested++;
        if (Math.abs(Math.hypot(p.x - CX, p.y - CY) - (r1 + r2)) > 1e-9) bad++;
      }
    }
  }
  check(`equal rates give a circle of radius r1+r2 (${tested} points)`, bad === 0, `${bad} off the circle`);
  check("shapeName reports equal rates as a circle", C.shapeName(C.start({ rate1: 2, rate2: 2 })) === "a circle");
}
{
  let badY = 0, badX = 0, tested = 0;
  for (let r = 0; r <= 100; r++) {
    for (let rate = 1; rate <= 50; rate++) {
      const s = C.start({ rate1: rate, rate2: -rate, r1: r, r2: r });
      for (const n of [0, 1, 17, 91, 359, 1132]) {
        const p = C.frame(s, n).sum;
        tested++;
        if (p.y !== CY) badY++;
        if (Math.abs(p.x - CX) > r + r + 1e-9) badX++;
      }
    }
  }
  check(`opposite rates and equal radii give a horizontal segment (${tested} points)`,
    badY === 0 && badX === 0, `${badY} off the line, ${badX} outside it`);
  check("shapeName reports the degenerate ellipse as a straight line",
    C.shapeName(C.start({ rate1: 2, rate2: -2, r1: 50, r2: 50 })) === "a straight line");
  check("two zero radii leave a single point at the centre",
    C.shapeName(C.start({ r1: 0, r2: 0 })) === "a single point" &&
    C.frame(C.start({ r1: 0, r2: 0 }), 999).sum.x === CX);
}

/* ------------------------------- 5. the five named curves and their cusp counts */

/* The velocity of (r1 e^{i n*Rate1/360} + r2 e^{i n*Rate2/360}) vanishes exactly
   when |r1*Rate1| = |r2*Rate2|; then the curve has
   |Rate1-Rate2| / gcd(|Rate1|,|Rate2|) cusps. Both counts are computed below:
   one from integer arithmetic, one from a fine numeric search on the derivative. */
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function analyticCusps(s) {
  const A = s.r1 * s.rate1, B = s.r2 * s.rate2;
  if (A === 0 || B === 0 || Math.abs(A) !== Math.abs(B)) return 0;
  const d = s.rate1 - s.rate2;
  return d === 0 ? 0 : Math.abs(d) / (gcd(Math.abs(s.rate1), Math.abs(s.rate2)) || 1);
}
function numericCusps(s) {
  const g = gcd(Math.abs(s.rate1), Math.abs(s.rate2)) || 1;
  const period = 720 * Math.PI / g;
  const A = s.r1 * s.rate1, B = s.r2 * s.rate2, scale = Math.abs(A) + Math.abs(B) || 1;
  const speed = (n) => {
    const a1 = (n * s.rate1) / 360, a2 = (n * s.rate2) / 360;
    return Math.hypot(A * Math.sin(a1) + B * Math.sin(a2), A * Math.cos(a1) + B * Math.cos(a2));
  };
  const M = 4000, h = period / M;
  let count = 0, found = [];
  for (let i = 0; i < M; i++) {
    const n = i * h;
    if (!(speed(n) < speed(n - h + period) && speed(n) <= speed(n + h))) continue;
    let lo = n - h, hi = n + h;
    for (let k = 0; k < 60; k++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (speed(m1) < speed(m2)) hi = m2; else lo = m1;
    }
    const at = (lo + hi) / 2;
    if (speed(at) < scale * 1e-8 && !found.some((v) => Math.abs(v - at) < h)) { found.push(at); count++; }
  }
  return count;
}
for (const [name, rate1, rate2, r1, r2, cusps] of [
  ["ellipse (W=-1)", -1, 1, 60, 40, 0],
  ["line segment (W=-1, R=1)", 2, -2, 50, 50, 2],
  ["cardioid (W=2, R=1/2)", 2, 1, 1, 2, 1],
  ["deltoid (W=-2, R=1/2)", -2, 1, 1, 2, 3],
  ["astroid (W=-3, R=1/3)", -3, 1, 1, 3, 4],
  ["nephroid (W=3, R=1/3)", 3, 1, 1, 3, 2],
]) {
  const s = C.start({ rate1, rate2, r1, r2 });
  check(`${name}: ${cusps} cusp(s), analytic count`, analyticCusps(s) === cusps, `got ${analyticCusps(s)}`);
  check(`${name}: ${cusps} cusp(s), measured from the curve`, numericCusps(s) === cusps, `got ${numericCusps(s)}`);
}
{
  // The page's R = 1/|W| is exactly the condition for cusps, for every W.
  let bad = 0;
  for (let w = 2; w <= 20; w++) {
    const epi = C.start({ rate1: w, rate2: 1, r1: 1, r2: w });
    const hypo = C.start({ rate1: -w, rate2: 1, r1: 1, r2: w });
    if (analyticCusps(epi) !== w - 1 || analyticCusps(hypo) !== w + 1) bad++;
    const off = C.start({ rate1: w, rate2: 1, r1: 2, r2: w });
    if (analyticCusps(off) !== 0) bad++;
  }
  check("R = 1/|W| gives an epicycloid with W-1 cusps or a hypocycloid with W+1; other R are smooth",
    bad === 0, `${bad} bad ratios`);
}

/* --------------------------- 6. the drawn path, the period and the status text */

{
  const s = C.start({ rate1: 2, rate2: -2, r1: 60, r2: 40 });
  const pts = C.trace(s, 0, 500);
  equal("trace returns one point per step, starting at step zero", pts.length, 501);
  equal("trace starts where the frame is", pts[0], C.frame(s, 0).sum);
  equal("trace ends where the frame is", pts[500], C.frame(s, 500).sum);
  const long = C.trace(s, 0, C.PERIOD + 700);
  equal("trace keeps at most TRACE points", long.length, C.TRACE);
  const nearest = C.nearestStep(s, { x: pts[250].x + 0.1, y: pts[250].y - 0.1 }, 0, 500);
  check("nearestStep finds the step whose point is closest", Math.abs(nearest - 250) <= 1, `got ${nearest}`);
  check("step advances N and setN clamps it to zero", C.step(s).n === 1 && C.setN(s, -9).n === 0);
}
{
  let bad = 0;
  for (const [rate1, rate2] of [[2, 5], [-2, 1], [1, 1], [3, -2], [0, 7], [-50, 50]]) {
    const g = gcd(Math.abs(rate1), Math.abs(rate2)) || 1;
    const period = (720 * Math.PI) / g; // Java's N is a long, so the test uses the angle
    for (const rate of [rate1, rate2]) {
      const turns = (period * rate) / 360 / (2 * Math.PI);
      if (Math.abs(turns - Math.round(turns)) > 1e-12) bad++;
    }
  }
  check("the curve closes after 720*pi/gcd steps (whole turns for both arms)", bad === 0);
}
{
  const s = C.start({ rate1: 2, rate2: -2, r1: 60, r2: 40 });
  const text = C.status(s, C.frame(s));
  check("the status names both arms, both rates, the step and the ellipse",
    /Arms 60 and 40/.test(text) && /2 and -2/.test(text) && /Step 0/.test(text) && /ellipse/.test(text) && /Paused/.test(text));
  check("shapeName calls other rate pairs a looping curve",
    C.shapeName(C.start({ rate1: 2, rate2: 5 })) === "a looping curve");
}

console.log(`  (${cases} frames compared exactly with the applet's update; ` +
  `all four option ranges, both phases and the 360-radian divisor included)`);
done("dyno-ellipse");
