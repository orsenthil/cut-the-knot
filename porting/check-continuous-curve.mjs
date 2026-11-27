#!/usr/bin/env node
"use strict";

/*
 * Logic test for continuous-curve/continuous-curve-core.js.
 *
 *   node porting/check-continuous-curve.mjs
 *
 * The page (https://www.cut-the-knot.org/Curriculum/Geometry/ContinuousCurve.shtml)
 * claims: "The applet shows a continuous spiral line, although the tendency is
 * to perceive a sequence of embedded squares" and its picture's alt text says
 * "there are no squares but a single continuous spiral". Both are checked over
 * the whole scrollbar range, not a few samples: margin 0..100, spread 2..34,
 * legs 4..100, at two canvas sizes (332,979 configurations, plus mixed
 * canvases). The core is also
 * compared with a second, literal transcription of ContinuousCurveCanvas.Draw
 * from javap, including the odd `i != 1` exception and the d < 0 early exit.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("continuous-curve/continuous-curve-core.js", "ContinuousCurveCore");

/* ---------------------------------------- 1. the applet's options and defaults */

equal("scrollbar ranges and initial values", [C.RANGES.margin, C.RANGES.spread, C.RANGES.legs],
  [[0, 100, 20], [2, 34, 5], [4, 100, 26]]);
equal("new picture uses the three initial values",
  [C.start().margin, C.start().spread, C.start().legs, C.start().trace], [20, 5, 26, 0]);
equal("new picture uses the port's 400 by 400 viewBox", [C.start().width, C.start().height], [400, 400]);
equal("clamping at and beyond each end",
  [C.clampOption("margin", -3), C.clampOption("margin", 999),
    C.clampOption("spread", 1), C.clampOption("spread", 99),
    C.clampOption("legs", 0), C.clampOption("legs", 999)],
  [0, 100, 2, 34, 4, 100]);
equal("non-numbers fall back to the applet's initial values",
  [C.clampOption("margin", "x"), C.clampOption("spread", NaN), C.clampOption("legs", undefined)],
  [20, 5, 26]);
check("fractional values are truncated like a scrollbar", C.clampOption("spread", 12.9) === 12);
{
  const s = C.start();
  const t = C.setOption(s, "spread", 34);
  equal("setOption keeps the old state untouched", [s.spread, t.spread], [5, 34]);
  check("setOption keeps the other options", t.margin === 20 && t.legs === 26);
  check("setOption returns to the first corner to trace", C.setOption(C.setTrace(s, 7), "legs", 40).trace === 0);
}
{
  const s = C.start({ legs: 4 });
  const g = C.geometry(s);
  equal("setTrace cannot pass the last corner", C.setTrace(s, 999).trace, g.drawn);
  equal("nextTrace wraps at the end", C.nextTrace(C.setTrace(s, g.drawn)).trace, 0);
  equal("negative trace goes to the first corner", C.setTrace(s, -5).trace, 0);
}

/* ------------------------------------------------ 2. the applet's own method */

/* Literal javap transcription of ContinuousCurveCanvas.Draw. Local 3 is d,
   locals 4/5 are the centre, locals 6/7 the current pen, 8 the leg count. */
function appletDraw(width, height, margin, spread, nlegs) {
  const size = Math.min(width, height);
  let d = size - 15 - 2 * margin;                 // getSize, Math.min, 15, Margin*2
  const cx = Math.trunc((width - d) / 2);
  const cy = Math.trunc((height - d) / 2);
  let x = cx, y = cy;
  const lines = [];
  for (let i = 0; i < nlegs; i++) {                // 66: i < NLegs; 196: i++
    let nx = x, ny = y;                            // 75, 79
    switch (i % 4) {                               // 83: tableswitch 0..3
      case 0: ny = y + d; break;                   // 116
      case 1:                                      // 125
        if (i !== 1) d = d - spread;               // 127: if i == 1 skip the shrink
        nx = x + d;                                // 138
        break;
      case 2: ny = y - d; break;                   // 147
      case 3:                                      // 156
        d = d - spread;
        nx = x - d;
        break;
    }
    if (d < 0) break;                              // 169, 173
    lines.push({ x1: x, y1: y, x2: nx, y2: ny, d }); // 176
    x = nx; y = ny;                                // 188, 192
  }
  return { side0: size - 15 - 2 * margin, center: { x: cx, y: cy }, lines };
}

const samePoint = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;
let mismatch = 0, cases = 0, continuity = 0, axisAligned = 0, direction = 0;
let shrink = 0, bounds = 0, laps = 0, positive = 0;
let repeated = 0, distinctLegs = 0;

function examine(width, height, margin, spread, legs, collectLegs) {
  const seenLegs = new Set();
  const s = C.start({ width, height, margin, spread, legs });
  const g = C.geometry(s);
  const ref = appletDraw(width, height, margin, spread, legs);
  cases++;
  if (g.side0 !== ref.side0 || !samePoint(g.center, ref.center) ||
      g.drawn !== ref.lines.length || g.stoppedEarly !== (ref.lines.length < legs)) mismatch++;
  for (let i = 0; i < ref.lines.length; i++) {
    const l = ref.lines[i];
    if (i >= g.sides.length || g.sides[i] !== l.d ||
        !samePoint(g.vertices[i], { x: l.x1, y: l.y1 }) ||
        !samePoint(g.vertices[i + 1], { x: l.x2, y: l.y2 })) mismatch++;
    // The page's "one continuous line": every leg begins at the last leg's end.
    if (!samePoint(g.vertices[i], { x: l.x1, y: l.y1 })) continuity++;
    if (l.x1 !== l.x2 && l.y1 !== l.y2) axisAligned++;
    const want = i % 4;
    if (want === 0 && l.y2 !== l.y1 + l.d) direction++;
    if (want === 1 && l.x2 !== l.x1 + l.d) direction++;
    if (want === 2 && l.y2 !== l.y1 - l.d) direction++;
    if (want === 3 && l.x2 !== l.x1 - l.d) direction++;
    if (l.d < 0) positive++;
    // Shrink events are exactly legs 3 mod 4 and 1 mod 4 except the first.
    let shrinks = 0;
    for (let j = 0; j <= i; j++) if (j % 4 === 3 || (j % 4 === 1 && j !== 1)) shrinks++;
    if (l.d !== ref.side0 - shrinks * spread) shrink++;
    if (ref.side0 >= 0 &&
        (l.x1 < ref.center.x || l.x2 < ref.center.x ||
         l.y1 < ref.center.y || l.y2 < ref.center.y ||
         l.x1 > ref.center.x + ref.side0 || l.x2 > ref.center.x + ref.side0 ||
         l.y1 > ref.center.y + ref.side0 || l.y2 > ref.center.y + ref.side0)) bounds++;
    if (collectLegs && (l.x1 !== l.x2 || l.y1 !== l.y2)) {
      const a = [l.x1, l.y1], b = [l.x2, l.y2];
      const first = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? a : b;
      const second = first === a ? b : a;
      const key = [...first, ...second].join(",");
      if (seenLegs.has(key)) repeated++;
      seenLegs.add(key);
    }
  }
  if (collectLegs) distinctLegs += seenLegs.size;
  // Four legs later the path has shifted inward by exactly `spread` in x and
  // `spread` in y (the classic "embedded squares" the eye reports).
  for (let k = 1; 4 * k <= ref.lines.length; k++) {
    const v = g.vertices[4 * k];
    if (v.x - ref.center.x !== k * spread || v.y - ref.center.y !== (k - 1) * spread) laps++;
  }
}

for (const margin of [0, 20, 100]) {
  for (let spread = 2; spread <= 34; spread++) {
    for (let legs = 4; legs <= 100; legs++) {
      examine(400, 400, margin, spread, legs, true);
    }
  }
}
equal(`core = bytecode at 400x400 (${cases} configurations)`, mismatch, 0);
check("each leg starts at the end of the previous leg", continuity === 0, `${continuity} lifts`);
check("every leg is horizontal or vertical", axisAligned === 0, `${axisAligned} diagonals`);
check("directions repeat down, right, up, left", direction === 0, `${direction} wrong legs`);
check("the side never becomes negative before a leg is drawn", positive === 0, `${positive} bad legs`);
check("the side shrinks only on the applet's two legs per lap", shrink === 0, `${shrink} bad legs`);
check("the path stays inside its first square", bounds === 0, `${bounds} outside legs`);
check("no two non-degenerate legs retrace each other", repeated === 0, `${repeated} repeats`);
check("each lap shifts inward by exactly Spread", laps === 0, `${laps} bad laps`);

/* A second full-size canvas: min(width,height), not width, sets the side, and
   the centre uses integer division of an odd difference. */
{
  const before = cases;
  for (let margin = 0; margin <= 100; margin++) {
    for (let spread = 2; spread <= 34; spread++) {
      for (let legs = 4; legs <= 100; legs++) examine(320, 200, margin, spread, legs, false);
    }
  }
  equal(`core = bytecode at 320x200 (${cases - before} configurations)`, mismatch, 0);
  check("320x200: no lifts, no diagonals, no wrong directions",
    continuity === 0 && axisAligned === 0 && direction === 0);
}

/* Exotic canvases, including a negative side0, where the applet stops at once. */
{
  const before = cases;
  for (const [w, h] of [[400, 450], [375, 375], [101, 99], [1, 1], [1000, 3]]) {
    for (let margin = 0; margin <= 100; margin += 7) {
      for (let spread = 2; spread <= 34; spread += 3) {
        for (let legs = 4; legs <= 100; legs += 9) examine(w, h, margin, spread, legs, false);
      }
    }
  }
  equal(`core = bytecode on ${cases - before} mixed canvases`, mismatch, 0);
  check("mixed canvases keep the path continuous", continuity === 0 && positive === 0);
}

/* --------------------------------------------- 3. concrete pictures and claims */

{
  const g = C.geometry(C.start());
  equal("default side = min(400,400) - 15 - 2*20", g.side0, 345);
  equal("default centre = (floor(55/2), floor(55/2))", g.center, { x: 27, y: 27 });
  equal("default corners", g.vertices.slice(0, 5),
    [{ x: 27, y: 27 }, { x: 27, y: 372 }, { x: 372, y: 372 }, { x: 372, y: 27 }, { x: 32, y: 27 }]);
  equal("default side lengths", g.sides.slice(0, 6), [345, 345, 345, 340, 340, 335]);
  equal("default draws all 26 legs and ends at the centre corner", g.drawn, 26);
  equal("default endpoint", g.vertices[g.drawn], { x: 342, y: 342 });
  check("default status names one unbroken line", /One unbroken line of 26 straight legs/.test(C.status(C.start(), g, 0)));
  check("status at the last corner names that corner", C.status(C.start(), g, g.drawn) ===
    "One unbroken line of 26 straight legs. At the last corner (342, 342).");
}
{
  const g = C.geometry(C.start({ legs: 100, spread: 2 }));
  equal("100 legs with the smallest spread are all drawn", g.drawn, 100);
  equal("a tight spiral ends near the middle", g.vertices[g.drawn], { x: 77, y: 75 });
}
{
  const g = C.geometry(C.start({ margin: 100, spread: 34, legs: 100 }));
  equal("with the largest margin the side is 185", g.side0, 185);
  equal("the applet stops before drawing a negative side", g.drawn, 13);
  check("stopping is recorded", g.stoppedEarly === true && g.sides.every((d) => d >= 0));
}
{
  const g = C.geometry(C.start({ margin: 100, spread: 2, legs: 4 }));
  equal("minimum leg count draws exactly four legs", g.drawn, 4);
  equal("the first lap stops Spread short of its start", g.vertices[4], { x: 109, y: 107 });
}
{
  const g = C.geometry(C.start({ width: 1, height: 1, margin: 100 }));
  equal("a negative side draws no legs at all", g.drawn, 0);
  check("status says there is nothing to draw", C.status(C.start({ width: 1, height: 1, margin: 100 }), g, 0) === "No legs to draw at these settings.");
}

console.log(`  (${cases} configurations compared with the bytecode; ` +
  `${distinctLegs} distinct non-degenerate legs checked for retracing)`);
done("continuous-curve");
