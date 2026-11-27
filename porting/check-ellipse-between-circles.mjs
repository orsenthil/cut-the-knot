#!/usr/bin/env node
"use strict";

/*
 * Logic test for ellipse-between-circles/ellipse-between-circles-core.js.
 *
 *   node porting/check-ellipse-between-circles.mjs
 *
 * The cut-the-knot page claims that the centre O of each circle inscribed in
 * the (possibly blunt) arbelos has dist(O,C1) + dist(O,C2) = r1 + r2, so the
 * locus is an ellipse with the two given centres as foci and long axis r1+r2;
 * it gives the short axis as 2h with
 * h^2 = ((r1+r2)/2)^2 - ((x2-x1)/2)^2, from the isosceles triangle at the top.
 * All three claims are checked on every slider value and a grid of handle
 * positions, not a handful of samples. The core is also compared field for
 * field, with exact double equality, against a second transcription of
 * EllipseBetweenCirclesCanvas.Compute/Circle made straight from javap.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("ellipse-between-circles/ellipse-between-circles-core.js", "EllipseBetweenCirclesCore");

/* --------------------------------------------- 1. the applet's start picture */

{
  const s = C.start();
  equal("slider starts at 20 and the diameter ends are the applet's A and D",
    [s.slider, s.d, C.A, C.B], [20, { x: 10, y: 230 }, { x: 10, y: 230 }, { x: 390, y: 230 }]);
  check("C starts two thirds of the way from A to B, as init's 1/3 does",
    Math.abs(s.c.x - (C.A.x / 3 + C.B.x * 2 / 3)) < 1e-12 && s.c.y === 230,
    `got ${JSON.stringify(s.c)}`);
  equal("the scrollbar runs from 0 to 101, with T = value/100",
    [C.SLIDER_MIN, C.SLIDER_MAX, C.compute(s).t], [0, 101, 0.2]);
  const g = C.compute(s);
  check("the big circle has radius 190 and the small one starts at 126.67",
    g.big.r === 190 && Math.abs(g.small.r - (380 / 3)) < 1e-12,
    `got ${g.big.r}, ${g.small.r}`);
  check("a new picture is not finished and has recorded no move",
    C.result(s) === null && s.moves === 0 && !s.explored);
}

{
  const s = C.start({ slider: 55 });
  check("the slider clamps below, above and for non-numbers",
    C.setSlider(s, -9).slider === 0 && C.setSlider(s, 999).slider === 101 &&
    C.start({ slider: "x" }).slider === 20 && C.setSlider(s, 12.9).slider === 12);
  const moved = C.setSlider(s, 80);
  check("moving the slider keeps the handles, records a move and finishes the demo",
    moved.slider === 80 && moved.d.x === s.d.x && moved.c.x === s.c.x &&
    moved.moves === 1 && C.result(moved) === "done" && C.setSlider(moved, 80) === moved);
  const dragged = C.setHandle(s, "d", { x: -50, y: 99 });
  check("a drag keeps y on the diameter and clamps x inside the canvas",
    dragged.d.x === 1 && dragged.d.y === 230 && dragged.c.x === s.c.x && dragged.moves === 1);
  check("dragging to the same place is a no-op; an unknown handle is refused",
    C.setHandle(s, "c", { x: s.c.x, y: 10 }) === s && C.setHandle(s, "z", { x: 20 }) === s);
}

/* -------------------------------- 2. the applet's own Compute/Circle, again */

/* Literal javap transcription. p3 is local 3 (big), p4 local 4 (small),
   L1 the x argument, L5 the slider's T; F holds the canvas fields A, B, D. */
const jr = (v) => Number.isNaN(v) ? 0 : Math.floor(v + 0.5);
const jdist = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);

function appletDiameter(p, q) {
  const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  return { x: m.x, y: m.y, r: jdist(m, p) };
}

function appletCircle(L1, p3, p4, L5, F) {
  const L7 = p3.r, L9 = p4.r;
  const L11 = L7 * L9;                              // never read by the applet
  const L13 = p3.x - p4.x;
  const L15 = (p3.x + p4.x) / 2;
  const L17 = L7 + L9;
  const L19 = L17 / 2;
  const L21 = Math.sqrt((L17 * L17) / 4 - (L13 * L13) / 4);
  const rect = {
    x: jr(L15 - L19), y: jr(F.D.y - L21),
    w: jr(2 * L19), h: jr(2 * L21),
  };
  let L23 = (L5 > 0 ? -1 : 1) * L21 *
    Math.sqrt(1 - ((L1 - L15) * (L1 - L15)) / (L19 * L19)) + p3.y;
  let L25 = jdist({ x: L1, y: L23 }, p4) - L9;
  const fallback = L25 < 0 || Number.isNaN(L25);    // dcmpg/iflt, then isNaN
  if (fallback) {
    L23 = F.A.y;
    if (L1 < p4.x) {
      L1 = (F.A.x + p4.x - L9) / 2;
      L25 = L1 - F.A.x;
    } else {
      L1 = (F.B.x + p4.x + L9) / 2;
      L25 = F.B.x - L1;
    }
  }
  return { x: L1, y: L23, r: L25, rect, product: L11, a: L19, h: L21, mx: L15, sum: L17, fallback };
}

function appletCompute(state) {
  const T = state.slider / 100;
  const p3 = appletDiameter(C.A, C.B);
  const p4 = appletDiameter(state.d, state.c);
  const L1 = C.A.x + Math.abs(T) * (C.B.x - C.A.x);
  return { ...appletCircle(L1, p3, p4, T, { A: C.A, B: C.B, D: state.d }), big: p3, small: p4 };
}

const same = (a, b) => Object.is(a, b);
let cases = 0, mismatch = 0;
function compare(state) {
  const got = C.compute(state), ref = appletCompute(state);
  cases++;
  for (const key of ["x", "y", "r", "a", "h", "mx", "sum", "product"]) {
    if (!same(got[key], ref[key])) mismatch++;
  }
  for (const key of ["x", "y", "w", "h"]) {
    if (!same(got.rect[key], ref.rect[key])) mismatch++;
  }
  if (!same(got.big.x, ref.big.x) || !same(got.big.r, ref.big.r) ||
      !same(got.small.x, ref.small.x) || !same(got.small.r, ref.small.r)) mismatch++;
  if (got.fallback !== ref.fallback) mismatch++;
}

{
  const D = [];
  for (let x = 10; x <= 190; x += 10) D.push(x);
  const E = [];
  for (let x = 12; x <= 398; x += 13) E.push(x);
  for (const dx of D) {
    for (const ex of E) {
      if (ex <= dx) continue;
      for (let slider = C.SLIDER_MIN; slider <= C.SLIDER_MAX; slider++) {
        compare(C.start({ slider, d: { x: dx, y: 230 }, c: { x: ex, y: 230 } }));
      }
    }
  }
  equal(`core = bytecode field for field for all ${cases} slider/handle configurations`, mismatch, 0);
}

/* ------------------------------- 3. the page's three claims, on that grid */

/* Re-run the grid, this time checking the geometry instead of the bytecode. */
{
  let sumBad = 0, ellipseBad = 0, minorBad = 0, tangentBad = 0;
  let points = 0, tangents = 0, maxSumError = 0;
  for (let dx = 10; dx <= 190; dx += 10) {
    for (let ex = 12; ex <= 398; ex += 13) {
      if (ex <= dx) continue;
      const state = C.start({ slider: 20, d: { x: dx, y: 230 }, c: { x: ex, y: 230 } });
      for (let slider = C.SLIDER_MIN; slider <= C.SLIDER_MAX; slider++) {
        const g = C.compute({ ...state, slider });
        const dBig = C.dist(g.centre, g.big), dSmall = C.dist(g.centre, g.small);
        points++;
        // Claim 1: the distances to the two given centres add to r1+r2.
        const err = Math.abs(dBig + dSmall - g.sum);
        maxSumError = Math.max(maxSumError, err);
        if (err > 1e-8) sumBad++;
        // The same point obeys the ellipse equation with the stated axes.
        if (Number.isFinite(g.h) && g.h > 0 && g.a > 0) {
          const lhs = ((g.centre.x - g.mx) / g.a) ** 2 + ((g.centre.y - g.big.y) / g.h) ** 2;
          if (Math.abs(lhs - 1) > 1e-8) ellipseBad++;
        }
        // Claim 2: the page's h^2 formula, with x2-x1 the focal distance.
        const pageH2 = ((g.big.r + g.small.r) / 2) ** 2 - ((g.big.x - g.small.x) / 2) ** 2;
        if (Math.abs(g.h * g.h - pageH2) > 1e-8) minorBad++;
        // Tangency: inside the big circle, outside the small one.
        if (g.r > 0 && g.small.r >= 0 && Math.abs(g.big.x - g.small.x) + g.small.r <= g.big.r + 1e-9) {
          tangents++;
          if (Math.abs(dBig + g.r - g.big.r) > 1e-8 ||
              Math.abs(dSmall - g.r - g.small.r) > 1e-8) tangentBad++;
        }
      }
    }
  }
  check(`dist(centre, big) + dist(centre, small) = r1+r2 at all ${points} points`,
    sumBad === 0, `${sumBad} bad, worst error ${maxSumError}`);
  check(`each centre obeys the ellipse equation at all ${points} points`, ellipseBad === 0, `${ellipseBad} bad`);
  check(`the page's h^2 = ((r1+r2)/2)^2 - ((x2-x1)/2)^2 at all ${points} points`,
    minorBad === 0, `${minorBad} bad`);
  check(`the new circle touches both given circles at all ${tangents} valid configurations`,
    tangentBad === 0, `${tangentBad} bad`);
}

{
  let bad = 0, tested = 0;
  for (let ex = 12; ex <= 398; ex += 2) {
    for (const d of [C.A.x, C.B.x]) {           // tangent to the big circle at A or B
      const g = C.compute(C.start({ slider: 20, d: { x: d, y: 230 }, c: { x: ex, y: 230 } }));
      const tangentAtA = d === C.A.x && ex <= C.B.x;
      const tangentAtB = d === C.B.x && ex < C.B.x;
      if (!tangentAtA && !tangentAtB) continue;
      tested++;
      // With tangency the focal distance is r1-r2, so h^2 simplifies to r1*r2.
      if (Math.abs(g.h * g.h - g.big.r * g.small.r) > 1e-8) bad++;
    }
  }
  check(`blunt arbelos: h^2 = r1*r2 for all ${tested} tangent configurations`, bad === 0, `${bad} bad`);
}

/* The top point of the ellipse: an isosceles triangle with equal sides a. */
{
  let bad = 0, tested = 0;
  for (let ex = 12; ex <= C.B.x; ex += 7) {
    const g0 = C.compute(C.start({ slider: 20, d: { x: 10, y: 230 }, c: { x: ex, y: 230 } }));
    if (!(g0.h > 0)) continue;
    const top = C.circle(g0.mx, g0.big, g0.small, 1, { A: C.A, B: C.B, D: C.A });
    const bottom = C.circle(g0.mx, g0.big, g0.small, 0, { A: C.A, B: C.B, D: C.A });
    tested++;
    if (Math.abs(top.y - (g0.big.y - g0.h)) > 1e-8 ||
        Math.abs(bottom.y - (g0.big.y + g0.h)) > 1e-8 ||
        Math.abs(C.dist({ x: g0.mx, y: top.y }, g0.big) - g0.a) > 1e-8 ||
        Math.abs(C.dist({ x: g0.mx, y: top.y }, g0.small) - g0.a) > 1e-8) bad++;
  }
  check(`the ellipse's top point is as high as the page's altitude h (${tested} shapes)`,
    bad === 0, `${bad} bad`);
  check("the applet takes the upper branch for positive T and the lower at T=0",
    C.circle(168.33333333333334, C.compute(C.start()).big, C.compute(C.start()).small, 1,
      { A: C.A, B: C.B, D: C.A }).y < 230 &&
    C.circle(168.33333333333334, C.compute(C.start()).big, C.compute(C.start()).small, 0,
      { A: C.A, B: C.B, D: C.A }).y > 230);
}

/* The NaN/negative-radius fallback keeps the centre on the ellipse's axis. */
{
  let fallbacks = 0, bad = 0;
  for (let slider = C.SLIDER_MIN; slider <= C.SLIDER_MAX; slider++) {
    const s = C.start({ slider });
    const g = C.compute(s);
    if (!g.fallback) continue;
    fallbacks++;
    if (g.y !== C.A.y ||
        Math.abs(Math.abs(g.x - g.mx) - g.a) > 1e-9 ||
        Math.abs(C.dist(g.centre, g.big) + g.r - g.big.r) > 1e-8 ||
        Math.abs(C.dist(g.centre, g.small) - g.r - g.small.r) > 1e-8) bad++;
  }
  check(`the fallback keeps every centre on an ellipse vertex (${fallbacks} slider settings)`,
    fallbacks > 0 && bad === 0, `${bad} bad of ${fallbacks}`);
}

/* ------------------------------------------------- 4. the status and tutor */

{
  const g = C.compute(C.start());
  const text = C.status(C.start(), g);
  check("the status names the slider, both radii, the centre and the long axis",
    /Slider 20/.test(text) && /with radius 15\b/.test(text) && /long axis is 317/.test(text), text);
  const high = C.start({ slider: 100 });
  check("the status says when the applet used its horizontal fallback",
    /horizontal axis/.test(C.status(high, C.compute(high))));
  const s0 = C.start();
  check("handles are clamped to the diameter and the same spot is a no-op",
    C.clampHandle({ x: -9, y: 40 }, "d").x === 1 &&
    C.clampHandle({ x: 999, y: 40 }, "c").x === 398 &&
    C.clampHandle({ x: 50, y: 40 }, "c").y === C.STAY &&
    C.setHandle(s0, "c", { x: s0.c.x, y: 0 }) === s0);
}

console.log(`  (${cases} configurations compared exactly with a second javap transcription)`);
done("ellipse-between-circles");
