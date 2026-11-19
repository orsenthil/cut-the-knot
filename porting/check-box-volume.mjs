#!/usr/bin/env node
"use strict";

/*
 * Logic test for box-volume/box-volume-core.js.
 *
 *   node porting/check-box-volume.mjs
 *
 * The search space is small enough to walk completely: every pair of side
 * lengths on the slider grid (2 to 20 by 0.5, 37 x 37 pairs) and, for each, a
 * fine sweep of the cut across the whole physical domain. Every claim on the
 * cut-the-knot page is checked here: the cubic and its expansion, the three
 * roots, the derivative, the best cut, the square case and the page's worked
 * example. Section 3 re-types the applet's own Parabola() from the bytecode
 * and compares it with the core over the same grid.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("box-volume/box-volume-core.js", "BoxVolumeCore");

const SIDES = [];
for (let v = C.MIN_SIDE; v <= C.MAX_SIDE + 1e-9; v += C.SIDE_STEP) SIDES.push(Math.round(v * 100) / 100);
const CUTS = [];
for (let v = 0; v <= C.MAX_CUT + 1e-9; v += C.CUT_STEP) CUTS.push(Math.round(v * 100) / 100);
const EPS = 1e-9;

/** Turn a failed sweep into one informative check instead of thousands. */
function sweep(label, fn) {
  try {
    fn();
    check(label, true);
  } catch (err) {
    check(label, false, err.message);
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/* ------------------------------------------------------------ 1. the rules */

equal("the default position is the page's worked example", C.start({}), { a: 11, b: 8.5, x: 1, found: false });
check("the demo is not explored before the player acts", C.result(C.start({})) === null);
check("finding the best cut explores the demo", C.result(C.findBest(C.start({}))) === "done");

equal("sides clamp below the minimum", C.setA(C.start({}), 1), { a: 2, b: 8.5, x: 1, found: false });
equal("sides clamp above the maximum", C.setB(C.start({}), 99), { a: 11, b: 20, x: 1, found: false });
equal("a shrinking side pulls the cut back into the box", C.setB(C.start({ b: 2 }), 2).x, 1);
check("any move clears the explored flag", C.findBest(C.start({})).found && !C.setX(C.findBest(C.start({})), 2).found);
check("a non-numeric slider value falls back", C.setA(C.start({}), "nope").a === 11);

/* --------------------------- 2. claims from the page, over the whole grid */

sweep("v(x) equals 4x^3 - 2(a+b)x^2 + abx everywhere on the grid", () => {
  for (const a of SIDES) for (const b of SIDES) for (const x of CUTS) {
    if (x > C.domainMax(a, b) + EPS) continue;
    const p = C.volume(x, a, b);
    const q = C.volumeExpanded(x, a, b);
    assert(Math.abs(p - q) <= 1e-8 * Math.max(1, Math.abs(p)), `a=${a} b=${b} x=${x}: ${p} vs ${q}`);
  }
});

sweep("the cubic has roots at 0, a/2 and b/2, leading coefficient positive", () => {
  for (const a of SIDES) for (const b of SIDES) {
    for (const r of C.roots(a, b)) assert(Math.abs(C.volume(r, a, b)) < 1e-8, `root ${r} for ${a},${b}`);
    assert(C.roots(a, b)[0] === 0 && C.roots(a, b)[2] === Math.max(a, b) / 2, "root order");
    assert(C.volume(1000, a, b) > 0, "the leading coefficient is +4");
  }
});

sweep("v'(x) = 12x^2 - 4(a+b)x + ab and vanishes at both stationary points", () => {
  for (const a of SIDES) for (const b of SIDES) {
    for (const x of [0, 0.25, 1, 2, 3.5, C.domainMax(a, b)]) {
      const h = 1e-5;
      const numeric = (C.volume(x + h, a, b) - C.volume(x - h, a, b)) / (2 * h);
      assert(Math.abs(numeric - C.derivative(x, a, b)) < 1e-5, `derivative at ${x}, ${a},${b}`);
    }
    assert(Math.abs(C.derivative(C.optimalX(a, b), a, b)) < 1e-8, `best root ${a},${b}`);
    assert(Math.abs(C.derivative(C.minimumX(a, b), a, b)) < 1e-8, `other root ${a},${b}`);
  }
});

sweep("the best cut always lies strictly between 0 and min(a/2, b/2)", () => {
  for (const a of SIDES) for (const b of SIDES) {
    const x = C.optimalX(a, b);
    assert(x > 0 && x < Math.min(a, b) / 2, `a=${a} b=${b} x=${x}`);
  }
});

sweep("optimumX is the global maximum of the volume on the physical domain", () => {
  for (const a of SIDES) for (const b of SIDES) {
    const best = C.volume(C.optimalX(a, b), a, b);
    const top = C.domainMax(a, b);
    let seen = -Infinity;
    for (let i = 0; i <= 400; i++) seen = Math.max(seen, C.volume((top * i) / 400, a, b));
    assert(best >= seen - 1e-8, `a=${a} b=${b}: ${best} vs sweep ${seen}`);
  }
});

sweep("the derivative's small root is the maximum, the large one the minimum", () => {
  for (const a of SIDES) for (const b of SIDES) {
    assert(C.secondDerivative(C.optimalX(a, b), a, b) < 0, `max at ${a},${b}`);
    assert(C.secondDerivative(C.minimumX(a, b), a, b) > 0, `min at ${a},${b}`);
  }
});

sweep("a square sheet has a double root and best cut a/6", () => {
  for (const a of SIDES) {
    assert(Math.abs(C.optimalX(a, a) - a / 6) < 1e-9, `square ${a}`);
    assert(Math.abs(C.roots(a, a)[1] - C.roots(a, a)[2]) < EPS, "double root");
    assert(Math.abs(C.volume(a / 2, a, a)) < 1e-8, "tangent to the axis");
    assert(Math.abs(C.volume(a / 6, a, a) - (2 * a * a * a) / 27) < 1e-8, "2a^3/27");
    assert(Math.abs(C.discriminant(a, a) - a * a) < EPS, "discriminant a^2");
  }
});

const exampleBest = C.optimalX(11, 8.5);
check("the page's example a=11, b=8.5 gives x = 1.5854...", Math.abs(exampleBest - 1.5854) < 0.0001, `got ${exampleBest}`);
check("the applet's displayed 1.60 is only an approximation", Math.abs(1.6 - exampleBest) > 0.01 && Math.abs(1.6 - exampleBest) < 0.02, `got ${exampleBest}`);
check("the example's volume is positive and is the maximum", C.volume(exampleBest, 11, 8.5) > 0 && Math.abs(C.volume(exampleBest, 11, 8.5) - C.optimalVolume(11, 8.5)) < EPS);

sweep("the cut stays in the domain and its volume never goes negative", () => {
  for (const a of SIDES) for (const b of SIDES) {
    const top = C.domainMax(a, b);
    for (const asked of [-5, 0, 1, top / 2, top, top + 5]) {
      const x = C.clampX(asked, a, b);
      assert(x >= 0 && x <= top + EPS, `clamp ${asked} for ${a},${b}`);
      assert(C.volume(x, a, b) >= -1e-8, `negative volume at ${x}`);
    }
    assert(C.volume(0, a, b) === 0 && Math.abs(C.volume(top, a, b)) < 1e-8, "volume zero at both ends");
  }
});

check("findBest lands within one slider step of the true optimum", (() => {
  for (const a of SIDES) for (const b of SIDES) {
    const x = C.findBest({ a, b, x: 0, found: false }).x;
    if (Math.abs(x - C.optimalX(a, b)) > C.CUT_STEP / 2 + 1e-9) return false;
  }
  return true;
})());

check("evaluate returns the numbers the page draws", (() => {
  const e = C.evaluate(C.start({}));
  return e.baseA === 9 && e.baseB === 6.5 && Math.abs(e.volume - C.volume(1, 11, 8.5)) < EPS &&
    e.domainMax === 4.25 && Math.abs(e.bestX - exampleBest) < EPS && e.found === false;
})());

/* ------------------------ 3. the applet's own method, transcribed again */

/**
 * Parabola(double x) from BoxVolumeCanvas, from javap:
 *   (Carton.height - 2*x) * (Carton.width - 2*x) * x / Scale / Scale / Scale
 * Carton is the sheet in pixels: width = round(a*Scale), height = round(b*Scale).
 */
function appletParabola(xPixels, cartonWidth, cartonHeight, scale) {
  return ((cartonHeight - 2 * xPixels) * (cartonWidth - 2 * xPixels) * xPixels) / scale / scale / scale;
}

sweep("the core matches the applet's Parabola() over the whole grid", () => {
  const scale = 20; // the applet's constant Scale field
  for (const a of SIDES) for (const b of SIDES) {
    const w = Math.round(a * scale);
    const h = Math.round(b * scale);
    for (let px = 0; px <= Math.min(w, h) / 2; px++) {
      const x = px / scale;
      const p = appletParabola(px, w, h, scale);
      const q = C.volume(x, a, b);
      assert(Math.abs(p - q) <= 1e-8 * Math.max(1, Math.abs(q)), `px=${px} a=${a} b=${b}: ${p} vs ${q}`);
    }
  }
});

check("the initial cut the applet computes is inside the domain", (() => {
  // init(): L = floor(width/3), W = floor(height/3), X = floor(min(L,W)/4).
  const L = Math.floor(400 / 3);
  const W = Math.floor(250 / 3);
  const X = Math.floor(Math.min(L, W) / 4);
  const a = L / 20;
  const b = W / 20;
  const x = X / 20;
  return x > 0 && x < C.domainMax(a, b) && C.volume(x, a, b) > 0;
})());

check("format() renders the readouts to a fixed number of decimals", C.format(1.5854, 2) === "1.59" && C.format(38.4, 1) === "38.4");

done("box-volume");
