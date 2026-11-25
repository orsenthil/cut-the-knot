#!/usr/bin/env node
"use strict";

/*
 * Logic test for adding-functions/adding-functions-core.js.
 *
 *   node porting/check-adding-functions.mjs
 *
 * The starting graphs (the applet's f and g at the 11 control points), dragging a
 * point, the choice between f + g and f - g, grabbing a curve. Then the page's
 * definitions on a large sample: the result is f(x) + g(x) or f(x) - g(x) at every
 * x, so it is zero exactly where the graphs of f and g cross for the difference;
 * and one fact the applet uses without saying: the natural cubic spline through the
 * sums of the control points IS the sum of the two splines (interpolation is linear),
 * so the blue curve is itself the spline through (x_i, f_i + g_i).
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("adding-functions/adding-functions-core.js", "FunctionsCore");
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  equal("11 heights each, add, no shade, no points", [s.f.length, s.g.length, s.op, s.shade, s.points], [11, 11, "add", false, false]);
  check("f starts on -x^2/2 + 25/3 and g on 5 sin x at x = -5..5", s.f.every((y, i) => near(y, -((i - 5) ** 2) / 2 + 25 / 3)) && s.g.every((y, i) => near(y, 5 * Math.sin(i - 5))));
  const c = C.curves(s);
  check("the curves pass through the control points", s.f.every((y, i) => near(c.f(i - 5), y)) && s.g.every((y, i) => near(c.g(i - 5), y)) && s.f.every((y, i) => near(c.result(i - 5), y + s.g[i])));
  const d = C.setHeight(s, "f", 3, 7);
  equal("dragging a point of f changes only that height", [d.f[3], s.f[3] === -((3 - 5) ** 2) / 2 + 25 / 3, d.g.join() === s.g.join(), d.f.filter((v, i) => v !== s.f[i]).length], [7, true, true, 1]);
  equal("heights stay inside +-14", [C.setHeight(s, "g", 0, 99).g[0], C.setHeight(s, "g", 0, -99).g[0]], [14, -14]);
  equal("a bad point or curve or height is refused", [C.setHeight(s, "h", 0, 1), C.setHeight(s, "f", 11, 1), C.setHeight(s, "f", 1.5, 1), C.setHeight(s, "f", 0, NaN)], [null, null, null, null]);
  equal("the operation is add or sub", [C.setOp(s, "sub").op, C.setOp(s, "add").op, C.setOp(s, "mul")], ["sub", "add", null]);
  equal("check boxes", [C.setShade(s, true).shade, C.setPoints(s, true).points], [true, true]);
  equal("the old position is untouched", s, C.start());
  // grabbing: pressing on f at x = 2 takes f's point 7; pressing far from both curves takes nothing
  const onF = C.grab(s, 2.2, c.f(2.2), 0.5), onG = C.grab(s, -3.8, c.g(-3.8), 0.5);
  equal("grab a curve: f near x = 2.2 takes point 7 of f; g near x = -3.8 takes point 1 of g; far away takes nothing", [onF, onG, C.grab(s, 0, 40, 1)], [{ which: "f", index: 7 }, { which: "g", index: 1 }, null]);
}

/* ------------------------------ 2. the definitions, at every point of a sample */
{
  const r = rng(77);
  let sumOk = true, diffOk = true, linear = true, inverse = true, crossing = true, n = 0;
  for (let t = 0; t < 300; t++) {
    const s = { ...C.start(), f: Array.from({ length: 11 }, () => (r() - 0.5) * 28), g: Array.from({ length: 11 }, () => (r() - 0.5) * 28) };
    const add = C.curves(s), sub = C.curves({ ...s, op: "sub" });
    // the spline through the summed heights
    const sumKnots = s.f.map((v, i) => v + s.g[i]), diffKnots = s.f.map((v, i) => v - s.g[i]);
    const msum = C.secondDerivs(sumKnots), mdiff = C.secondDerivs(diffKnots);
    for (let k = 0; k < 40; k++) {
      const x = -5 + r() * 10;
      n++;
      if (!near(add.result(x), add.f(x) + add.g(x))) sumOk = false;
      if (!near(sub.result(x), sub.f(x) - sub.g(x))) diffOk = false;
      if (!near(add.result(x), C.evaluate(sumKnots, msum, x), 1e-8)) linear = false;
      if (!near(sub.result(x), C.evaluate(diffKnots, mdiff, x), 1e-8)) linear = false;
      if (!near(add.result(x) - add.g(x), add.f(x), 1e-8)) inverse = false;     // (f + g) - g = f
    }
    // where the graphs of f and g cross, f - g is zero (bisection on a sign change)
    let lo = -5, hi = 5, found = 0;
    for (let k = 0; k < 200; k++) {
      const a = -5 + (10 * k) / 200, b = -5 + (10 * (k + 1)) / 200;
      const fa = sub.result(a), fb = sub.result(b);
      if (fa === 0 || fa * fb < 0) {
        let x1 = a, x2 = b;
        for (let it = 0; it < 60; it++) { const mid = (x1 + x2) / 2; if (sub.result(x1) * sub.result(mid) <= 0) x2 = mid; else x1 = mid; }
        const x = (x1 + x2) / 2;
        found++;
        if (!near(sub.f(x), sub.g(x), 1e-6)) crossing = false;
      }
    }
  }
  check(`f + g equals f(x) + g(x) at each of ${n} random points`, sumOk);
  check(`f - g equals f(x) - g(x) at each of ${n} random points`, diffOk);
  check("the spline through the summed (or subtracted) control points is the sum (or difference) of the two splines", linear);
  check("(f + g) - g = f", inverse);
  check("where f - g changes sign, the graphs of f and g meet (300 random pairs, bisection)", crossing);
  // adding g to f and then subtracting returns the picture
  const s = C.start();
  const a = C.curves(s), b = C.curves({ ...s, op: "sub" });
  let sym = true;
  for (let x = -5; x <= 5; x += 0.25) if (!near(a.result(x) + b.result(x), 2 * a.f(x)) || !near(a.result(x) - b.result(x), 2 * a.g(x))) sym = false;
  check("(f + g) + (f - g) = 2f and (f + g) - (f - g) = 2g on the starting graphs", sym);
  // g = 0 leaves f alone; f = g gives zero difference
  const z = { ...C.start(), g: new Array(11).fill(0) };
  check("with g = 0 the sum and difference are both f", [-5, -2.5, 0, 3.3, 5].every((x) => near(C.curves(z).result(x), C.curves(z).f(x)) && near(C.curves({ ...z, op: "sub" }).result(x), C.curves(z).f(x))));
  const same = { ...C.start(), g: C.start().f.slice() };
  check("with g = f the difference is 0 everywhere and the sum is 2f", [-5, -1.5, 2, 4.4].every((x) => near(C.curves({ ...same, op: "sub" }).result(x), 0, 1e-9) && near(C.curves(same).result(x), 2 * C.curves(same).f(x))));
}

done("adding-functions");
