#!/usr/bin/env node
"use strict";

/*
 * Logic test for chaos/chaos-core.js.
 *
 *   node porting/check-chaos.mjs
 *
 * Checks the applet's own arithmetic (F, XtoJ, the warm-up count, the number
 * of plotted points and the click-to-a mapping) against a second, literal
 * transcription of the bytecode, over the whole parameter space. Then every
 * claim the cut-the-knot page makes is tested honestly: the fixed point and
 * where it stops attracting, the 2/4/8/16 period doublings and their shrinking
 * gaps, chaos near a = 0.892, the 3/6/12-cycle window, the diagonal crossings
 * of f(f(x)), and sensitivity to the starting point.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("chaos/chaos-core.js", "ChaosCore");

/* ----------------------- a second transcription of the applet's own methods */

// chaoscanvas.F(a, x) = 4*a*x*(1-x)
function refF(a, x) {
  return 4 * a * x * (1 - x);
}
// chaoscanvas.a(double) = (int)Math.round(v)
function refRound(v) {
  return Math.round(v);
}
// chaoscanvas.XtoJ(x) = round(x * m_Width / m_MWidth), m_MWidth = 1
function refXtoJ(x, width) {
  return refRound((x * width) / 1);
}
// chaoscanvas.mouseClicked -> m_Lambda = (clickX - width - margin)*cWidth/width1 + first
function refLambda(clickX, width, margin, width1) {
  let L = 0.7 + ((clickX - width - margin) * 0.3) / width1;
  if (L < 0.7) L = 0.7;
  if (L > 1) L = 1;
  return L;
}
// chaoscanvas.run(): round(100/lambda + 20) warm-up iterates
function refWarmup(L) {
  return refRound(100 / L + 20);
}
// chaoscanvas.run(): the applet's own plotting thresholds
function refPlotCount(L, height) {
  if (L > 0.91) return Math.floor(height / 2);
  if (L > 0.9) return Math.floor(height / 4);
  if (L > 0.872) return 24;
  if (L > 0.86237) return 8;
  return 4;
}
function refColumn(L, x0, height) {
  let x = x0;
  for (let i = 0; i < refWarmup(L); i++) x = refF(L, x);
  const ys = [];
  for (let i = 0; i < refPlotCount(L, height); i++) {
    x = refF(L, x);
    ys.push(x);
  }
  return ys;
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("a new game starts at a = 0.7", s.lambda, 0.7);
  equal("a new game starts at x0 = 0.7", s.x0, 0.7);
  equal("a new game is not running", s.running, false);
  equal("a demo never wins or loses", C.result(s), null);
  check("every move is legal", C.legalMoves(s).length >= 5);
  check("unknown moves are refused", C.move(s, { type: "nonsense" }) === null);
  check("the position is plain JSON", JSON.parse(JSON.stringify(s)).lambda === 0.7);
}

/* ------------------------------- 2. the applet's arithmetic, exhaustively */

{
  let n = 0;
  for (let i = 0; i <= 100; i++) {
    const L = 0.7 + (0.3 * i) / 100;
    for (let j = 0; j <= 100; j++) {
      const x = j / 100;
      const got = C.F(L, x);
      check(`F matches the applet a=${L.toFixed(3)} x=${j / 100}`, Math.abs(got - refF(L, x)) < 1e-12);
      check(`F stays in [0,1] a=${L.toFixed(3)} x=${j / 100}`, got >= 0 && got <= 1);
      n++;
    }
  }
  check("F grid was actually exhaustive", n === 101 * 101);
}

{
  // The page's claim: with k = 4a the top of the graph, at x = 1/2, is a.
  for (let i = 0; i <= 1000; i++) {
    const L = 0.7 + (0.3 * i) / 1000;
    check(`peak of the graph equals a at a=${L.toFixed(4)}`, Math.abs(C.F(L, 0.5) - L) < 1e-12);
  }
  equal("peak at a = 1 is 1", C.F(1, 0.5), 1);
}

{
  // The right-hand axis is a from 0.7 through 1, and clicks map onto it.
  equal("a range is 0.3 wide", C.C_WIDTH, 0.3);
  equal("left edge of a range", C.FIRST_LAMBDA, 0.7);
  for (let px = 0; px <= 300; px++) {
    const got = C.lambdaFromClick(200 + 4 + px, 200, 4, 300);
    check(`click maps to the applet's a, px=${px}`, Math.abs(got - refLambda(200 + 4 + px, 200, 4, 300)) < 1e-12);
  }
  equal("click at the far left gives 0.7", C.lambdaFromClick(204, 200, 4, 300), 0.7);
  equal("click at the far right gives 1", C.lambdaFromClick(504, 200, 4, 300), 1);
  equal("clicks before the panel clamp to 0.7", C.lambdaFromClick(0, 200, 4, 300), 0.7);
  equal("clicks past the panel clamp to 1", C.lambdaFromClick(900, 200, 4, 300), 1);
  equal("out-of-range sliders clamp high", C.clampLambda(2), 1);
  equal("out-of-range sliders clamp low", C.clampLambda(0), 0.7);
}

{
  for (const width of [120, 200, 375, 760]) {
    for (let j = 0; j <= 200; j++) {
      const x = j / 200;
      equal(`XtoJ matches the applet width=${width} x=${x}`, C.xToColumn(x, width), refXtoJ(x, width));
    }
  }
}

{
  for (let i = 0; i <= 300; i++) {
    const L = 0.7 + (0.3 * i) / 300;
    equal(`warm-up count matches the applet a=${L.toFixed(3)}`, C.warmupCount(L), refWarmup(L));
    for (const height of [100, 200, 333, 900]) {
      equal(`plot count matches the applet a=${L.toFixed(3)} h=${height}`, C.plotCount(L, height), refPlotCount(L, height));
    }
  }
  for (const [L, want] of [[0.86237, 4], [0.862371, 8], [0.86238, 8], [0.872, 8], [0.87201, 24], [0.9, 24], [0.90001, 50], [0.91, 50], [0.91001, 100]]) {
    equal(`plot count at the applet's threshold a=${L}`, C.plotCount(L, 200), want);
  }
}

{
  // The whole right-hand diagram, column by column, matched against the
  // literal transcription (warm-up then plotted iterates).
  for (let i = 0; i <= 200; i++) {
    const L = 0.7 + (0.3 * i) / 200;
    equal(`diagram column a=${L.toFixed(3)}`, C.bifurcationColumn(L, 0.7, 200), refColumn(L, 0.7, 200));
    const ys = C.bifurcationColumn(L, 0.7, 200);
    check(`diagram points are in [0,1] a=${L.toFixed(3)}`, ys.every((y) => y >= 0 && y <= 1));
  }
}

/* --------------------------------- 3. every claim the cut-the-knot page makes */

{
  // "x = 0 and x = 1 - 1/(4a) solve x = f(x)"; "x = 0 is unstable".
  for (let i = 0; i <= 100; i++) {
    const L = 0.7 + (0.3 * i) / 100;
    const [z, xstar] = C.fixedPoints(L);
    equal("zero is a fixed point", C.F(L, z), z);
    check("non-zero fixed point solves x = f(x)", Math.abs(C.F(L, xstar) - xstar) < 1e-12);
    check("the zero fixed point is repelling in this range", !C.zeroAttractive(L));
    check("the fixed point lies in (0,1)", xstar > 0 && xstar < 1);
  }
  check("starting near 0 moves away from 0", C.F(0.8, 0.0001) > 0.0001);
  equal("the second fixed point at a = 0.8", C.fixedPoints(0.8)[1], 0.6875);
}

{
  // "As a approaches 0.75 the slope's absolute value grows and at 0.75 becomes 1."
  check("slope at the fixed point is 2 - 4a", Math.abs(C.slopeAtFixedPoint(0.8) - (2 - 4 * 0.8)) < 1e-12);
  equal("slope magnitude is exactly 1 at a = 0.75", Math.abs(C.slopeAtFixedPoint(0.75)), 1);
  let prev = -1;
  for (let i = 0; i < 50; i++) {
    const L = 0.7 + (0.05 * i) / 50;
    const mag = Math.abs(C.slopeAtFixedPoint(L));
    check(`slope grows towards a = 0.75 at a=${L.toFixed(4)}`, mag > prev);
    check(`single stable point below 0.75 at a=${L.toFixed(4)}`, C.fixedPointAttractive(L));
    prev = mag;
  }
  for (let i = 1; i <= 50; i++) {
    const L = 0.75 + (0.25 * i) / 50;
    check(`fixed point repelling above 0.75 at a=${L.toFixed(4)}`, !C.fixedPointAttractive(L));
  }
}

{
  // "As a moves over 0.75 the process alternates between two points", and
  // "after 0.86237... the two curves split further into four".
  equal("period 2 does not exist below 0.75", C.period2(0.74), null);
  const p2 = C.period2(0.8);
  check("a two-cycle exists at a = 0.8", !!p2);
  check("the two-cycle points solve f(f(x)) = x", p2.points.every((x) => Math.abs(C.F(0.8, C.F(0.8, x)) - x) < 1e-12));
  check("the two-cycle points are not fixed points", p2.points.every((x) => Math.abs(C.F(0.8, x) - x) > 1e-6));
  check("the two-cycle is attractive at a = 0.8", Math.abs(p2.multiplier) < 1);
  equal("period-2 onset is a = 0.75", C.P2_FROM, 0.75);
  check("period-4 onset is the applet's 0.86237...", Math.abs(C.P4_FROM - 0.86237) < 0.00001);
  const p2b = C.period2(0.87);
  check("the two-cycle has lost stability by a = 0.87", Math.abs(p2b.multiplier) > 1);
}

{
  // "Next four are replaced by 8 and 8 by 16", "distance between split
  // points grows shorter", "bifurcation becomes so fast at a = .892".
  const gaps = [C.P2_FROM, C.P4_FROM, C.P8_FROM, C.P16_FROM];
  for (let i = 2; i < gaps.length; i++) {
    check(`bifurcation gaps shrink (${i})`, gaps[i] - gaps[i - 1] < gaps[i - 1] - gaps[i - 2]);
  }
  check("the cascade accumulates near the page's a = .892", Math.abs(C.ACCUMULATION - 0.892) < 0.001);
  const periods = [[0.70, 1], [0.80, 2], [0.87, 4], [0.887, 8], [0.8915, 16]];
  for (const [L, want] of periods) {
    equal(`orbit has period ${want} at a=${L}`, C.cycleLength(L, 0.12345, 100000, 48), want);
  }
  equal("the orbit is not periodic in the chaotic region", C.cycleLength(0.92, 0.12345, 100000, 48), -1);
}

{
  // "f(f(x)) crosses the diagonal at three points besides 0: A and C stable,
  // B a repeller." At a = 0.8 those are the two-cycle points plus the fixed
  // point; 0 itself is the fourth crossing.
  const L = 0.8;
  const xstar = C.fixedPoints(L)[1];
  const p2 = C.period2(L);
  const crossings = [xstar].concat(p2.points);
  check("three crossings besides 0", crossings.length === 3);
  check("all three solve f(f(x)) = x", crossings.every((x) => Math.abs(C.F(L, C.F(L, x)) - x) < 1e-12));
  const slope2 = (x) => C.fPrime(L, C.F(L, x)) * C.fPrime(L, x);
  check("A and C are attractive", p2.points.every((x) => Math.abs(slope2(x)) < 1));
  check("B is a repeller", Math.abs(slope2(xstar)) > 1);
  check("0 is also a repeller", Math.abs(slope2(0)) > 1);
}

{
  // "Even after 0.86237 there appears regularity: a 3-cycle ... a 6-cycle
  // ... 12- and 24-cycles." (24 is beyond this and the original's precision.)
  check("the 3-cycle window starts after 0.86237", C.P3_WINDOW > C.P4_FROM);
  check("the 3-cycle window starts near a = 0.957", Math.abs(C.P3_WINDOW - 0.957) < 0.001);
  equal("period 3 at a = 0.96", C.cycleLength(0.96, 0.12345, 100000, 48), 3);
  equal("period 6 at a = 0.9605", C.cycleLength(0.9605, 0.12345, 100000, 48), 6);
  equal("period 12 at a = 0.962", C.cycleLength(0.962, 0.12345, 100000, 48), 12);
  equal("period 24 at a = 0.9623", C.cycleLength(0.9623, 0.12345, 100000, 48), 24);
}

{
  // "Chaos is apparently random behaviour with purely deterministic causes":
  // identical rules, but starting points 1e-9 apart separate completely.
  const o1 = C.orbit(1, 0.2, 60);
  const o2 = C.orbit(1, 0.2 + 1e-9, 60);
  check("two nearly equal starts agree at first", Math.abs(o1[5] - o2[5]) < 1e-6);
  check("two nearly equal starts diverge by step 60", Math.abs(o1[60] - o2[60]) > 0.1);
  const o3 = C.orbit(0.7, 0.2 + 1e-9, 60);
  check("a stable orbit does not diverge", Math.abs(o3[60] - C.orbit(0.7, 0.2, 60)[60]) < 1e-6);
}

/* ------------------------------------- 4. moves and status sentences in words */

{
  let s = C.start({});
  s = C.move(s, { type: "setLambda", lambda: 0.957, x0: 0.31 });
  equal("a slider press sets the parameter", s.lambda, 0.957);
  equal("a slider press restarts the orbit", s.steps, 0);
  equal("a slider press starts the web", s.running, true);
  const before = JSON.stringify(s);
  C.move(s, { type: "step" });
  equal("moves do not mutate the position", JSON.stringify(s), before);
  s = C.move(s, { type: "step" });
  equal("step advances the orbit", s.steps, 1);
  s = C.move(s, { type: "pause" });
  equal("pause stops the web", s.running, false);
  s = C.move(s, { type: "toggle" });
  equal("toggle starts the web again", s.running, true);
  s = C.move(s, { type: "reset" });
  equal("reset returns to a = 0.7", s.lambda, 0.7);
  equal("reset stops the web", s.running, false);
  equal("out-of-range a is clamped by move", C.move(s, { type: "setLambda", lambda: 5 }).lambda, 1);
  equal("out-of-range x0 is clamped by move", C.move(s, { type: "setLambda", lambda: 0.8, x0: -2 }).x0, 0);
}

{
  check("status sentence for one resting spot", /one resting spot/.test(C.behavior(0.7)));
  check("status sentence for two spots", /two spots/.test(C.behavior(0.8)));
  check("status sentence for four spots", /four spots/.test(C.behavior(0.87)));
  check("status sentence for chaos", /chaos/.test(C.behavior(0.92)));
  check("status sentence for the 3-cycle window", /three steps/.test(C.behavior(0.96)));
  check("every status sentence is in words", [0.7, 0.8, 0.87, 0.89, 0.92, 0.96, 0.99].every((L) => /[a-z]{3}/.test(C.behavior(L))));
}

done("chaos");
