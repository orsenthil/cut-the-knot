#!/usr/bin/env node
"use strict";

/*
 * Logic test for mean-value-theorem/mean-value-theorem-core.js.
 *
 *   node porting/check-mean-value-theorem.mjs
 *
 * The curve first: the natural cubic spline passes through its control points, is
 * continuous with continuous first and second derivatives at the knots, has zero
 * second derivative at the ends, and its derivative agrees with a numerical
 * difference. Then the page's theorems, on thousands of random curves and
 * intervals: the Mean Value Theorem (there is always a point c strictly between
 * a and b with f'(c) equal to the secant's slope: found by sign changes and checked
 * against the exact equation), Rolle's theorem (on curves with equal ends found by
 * search, a point with f'(c) = 0), the bound the page quotes from Dieudonne and
 * Boas: |f(b) - f(a)| <= sup|f'| (b - a), and the page's proof with g(x) the
 * secant line: f - g is zero at both ends. The drag snap lands on the exact
 * crossing.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("mean-value-theorem/mean-value-theorem-core.js", "MVTCore");

/* ------------------------------------------------------------ 1. the curve */
{
  const s = C.start();
  equal("11 control points on the parabola 25/3 - (x - 5)^2, A at 1.1, B at 8.1, X at 3.1", [s.ys.length, s.ys[0], s.ys[5], s.ys[10], s.a, s.b, s.x], [11, 25 / 3 - 25, 25 / 3, 25 / 3 - 25, 1.1, 8.1, 3.1]);
  const cv = C.curve(s);
  let worst = 0; for (let i = 0; i < 11; i++) worst = Math.max(worst, Math.abs(cv.f(i) - s.ys[i]));
  check("the curve passes through every control point", worst < 1e-9, String(worst));
  const r = rng(5);
  let bad = { c0: 0, c1: 0, c2: 0, nat: 0, num: 0 };
  for (let t = 0; t < 300; t++) {
    const st = { ...s, ys: Array.from({ length: 11 }, () => r() * 20 - 10) }, c = C.curve(st);
    const e = 1e-7;
    for (let i = 1; i < 10; i++) {
      if (Math.abs(c.f(i - e) - c.f(i + e)) > 1e-5) bad.c0++;
      if (Math.abs(c.df(i - e) - c.df(i + e)) > 1e-4) bad.c1++;
      if (Math.abs(c.ddf(i - e) - c.ddf(i + e)) > 1e-4) bad.c2++;
    }
    if (Math.abs(c.ddf(0)) > 1e-9 || Math.abs(c.ddf(10)) > 1e-9) bad.nat++;
    for (const x of [0.3, 2.7, 5.5, 9.2]) { const h = 1e-5; if (Math.abs((c.f(x + h) - c.f(x - h)) / (2 * h) - c.df(x)) > 1e-5) bad.num++; }
  }
  equal("300 random curves: continuous, with continuous slope and curvature at the knots, curvature 0 at the ends, derivative = the numerical slope", bad, { c0: 0, c1: 0, c2: 0, nat: 0, num: 0 });
}

/* --------------------------- 2. the Mean Value Theorem on random curves */
{
  const r = rng(77);
  let tried = 0, missing = 0, wrong = 0, manyPoints = 0, maxPoints = 0;
  for (let t = 0; t < 4000; t++) {
    const st = { ys: Array.from({ length: 11 }, () => r() * 24 - 12), a: 0, b: 0, x: 5 };
    const a = r() * 9.5, b = a + 0.2 + r() * (10 - a - 0.2);
    st.a = a; st.b = b;
    const cv = C.curve(st), cs = C.meanValuePoints(st), slope = (cv.f(b) - cv.f(a)) / (b - a);
    tried++;
    if (cs.length === 0) missing++;
    for (const c of cs) if (!(c > a && c < b) || Math.abs(cv.df(c) - slope) > 1e-6) wrong++;
    if (cs.length > 1) manyPoints++;
    maxPoints = Math.max(maxPoints, cs.length);
  }
  console.log(`  (of ${tried} random curves and intervals: ${manyPoints} have more than one mean-value point, at most ${maxPoints})`);
  equal("the Mean Value Theorem: every one of 4,000 random curves and intervals has a point c in (a, b) with f'(c) = the secant slope", missing, 0);
  equal("every point found really is in (a, b) with the right slope", wrong, 0);
  check("some curves have several such points", manyPoints > 100);
}

/* ------------------- 3. Rolle's theorem, the page's proof and the bounded-derivative form */
{
  const r = rng(12);
  let rolle = 0, rolleBad = 0, proofBad = 0, boundBad = 0, total = 0;
  for (let t = 0; t < 4000; t++) {
    const st = { ys: Array.from({ length: 11 }, () => r() * 24 - 12), a: 1, b: 9, x: 5 };
    const cv = C.curve(st);
    // find a pair a < b with equal heights by scanning for a sign change of f(b) - f(a) in b
    const a = r() * 4;
    let b0 = a + 0.5, g0 = cv.f(b0) - cv.f(a), found = null;
    for (let i = 1; i <= 200 && found === null; i++) { const b1 = a + 0.5 + ((10 - a - 0.5) * i) / 200, g1 = cv.f(b1) - cv.f(a); if (g0 * g1 < 0) { let lo = b0, hi = b1, glo = g0; for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2, gm = cv.f(mid) - cv.f(a); if (glo * gm <= 0) hi = mid; else { lo = mid; glo = gm; } } found = (lo + hi) / 2; } b0 = b1; g0 = g1; }
    if (found !== null) {
      rolle++;
      const s2 = { ...st, a, b: found }, cs = C.meanValuePoints(s2);
      if (Math.abs(cv.f(found) - cv.f(a)) > 1e-6 || cs.length === 0 || cs.some((c) => Math.abs(cv.df(c)) > 1e-4)) rolleBad++;
    }
    // the page's proof: g is the secant line; f - g vanishes at both ends
    const a2 = r() * 9, b2 = a2 + 0.3 + r() * (10 - a2 - 0.3), slope = (cv.f(b2) - cv.f(a2)) / (b2 - a2), g = (x) => cv.f(a2) + slope * (x - a2);
    if (Math.abs(cv.f(a2) - g(a2)) > 1e-9 || Math.abs(cv.f(b2) - g(b2)) > 1e-9) proofBad++;
    // |f(b) - f(a)| <= sup|f'| (b - a), the sup found on a fine grid (f' is piecewise linear, so the grid hits the extremes at knots)
    let sup = 0; for (let i = 0; i <= 400; i++) { const x = a2 + ((b2 - a2) * i) / 400; sup = Math.max(sup, Math.abs(cv.df(x))); }
    total++;
    if (Math.abs(cv.f(b2) - cv.f(a2)) > sup * (b2 - a2) + 1e-6) boundBad++;
  }
  equal(`Rolle's theorem: on ${rolle.toLocaleString()} curves with f(a) = f(b) there is a point with f' = 0`, rolleBad, 0);
  check("equal-height pairs were found often", rolle > 500);
  equal("the page's proof: the secant line g agrees with f at both ends, on 4,000 cases", proofBad, 0);
  equal("the bounded-derivative form: |f(b) - f(a)| <= sup|f'| (b - a) on 4,000 cases", boundBad, 0);
}

/* --------------------------- 4. readings, snapping and dragging */
{
  const s = C.start();
  const r0 = C.readings(s);
  check("the starting picture: A at 1.1, B at 8.1, X inside, slopes read", r0.a === 1.1 && r0.b === 8.1 && r0.inside && typeof r0.secant === "number" && typeof r0.tangent === "number");
  equal("the starting tangent is not parallel to the secant", r0.parallel, false);
  const pts = C.meanValuePoints(s);
  check("there is a mean-value point for the parabola-like start", pts.length >= 1);
  // the parabola has exactly one: the midpoint of A and B for an exact parabola; the spline is close
  console.log(`  (starting curve: mean-value point(s) ${pts.map((x) => x.toFixed(3)).join(", ")}; the midpoint is ${(r0.a + r0.b) / 2})`);
  const at = { ...s, x: pts[0] }, rr = C.readings(at);
  equal("with X at c the tangent is parallel (within the tolerance) and counts as parallel", rr.parallel, true);
  // dragging X across c lands exactly on c
  const lo = pts[0] - 0.3, hi = pts[0] + 0.3;
  const dragged = C.moveX({ ...s, x: lo }, hi);
  check("dragging across the mean-value point lands on it (to 1e-9)", Math.abs(dragged.x - pts[0]) < 1e-9, `${dragged.x} vs ${pts[0]}`);
  check("dragging that does not cross it goes where it is put", C.moveX({ ...s, x: 2 }, 2.4).x === 2.4);
  equal("X is kept in 0..10", [C.moveX(s, -5).x, C.moveX(s, 50).x], [0, 10]);
  equal("A and B slide along the curve and are kept in range", [C.moveEnd(s, "a", 3).a, C.moveEnd(s, "b", 99).b, C.moveEnd(s, "c", 1)], [3, 10, null]);
  equal("a control point goes up and down and is bounded", [C.setHeight(s, 3, 2).ys[3], C.setHeight(s, 3, 500).ys[3], C.setHeight(s, 11, 1), C.setHeight(s, 0, NaN)], [2, 30, null, null]);
  const flat = { ...s, ys: Array(11).fill(1) };
  equal("a flat curve: Rolle's case (equal ends), slope 0, parallel everywhere inside", [C.readings(flat).rolle, Math.abs(C.readings(flat).secant) < 1e-12, C.readings({ ...flat, x: 5 }).parallel], [true, true, true]);
  equal("a = b: no secant", C.readings({ ...s, a: 4, b: 4 }), null);
}

done("mean-value-theorem");
