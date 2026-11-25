#!/usr/bin/env node
"use strict";

/*
 * Logic test for newtons-method/newtons-method-core.js.
 *
 *   node porting/check-newtons-method.mjs
 *
 * The spline (it passes through every control point, is smooth, and its slope
 * is the true derivative), the starting cubic, the rules for clicking, the
 * steps and where they stop. Then the page's claims: the worked example for the
 * square root of 2 (the page's own table to the last digit, and the fractions
 * 3/2, 17/12 and 577/408); the error formula a - x_next = -f''(xi)/(2 f'(x)) (a - x)^2,
 * which for x^2 - N reads (a - x_next) = -(a - x)^2 / (2x); quadratic convergence;
 * the page's warning that the iterations may loop near a local extreme (a period-2
 * loop for x^3 - 2x + 2 from 0, and a spline curve that leaves the picture); and
 * the page's convergence condition |a - x0| < 1/|M|, which holds near a root but
 * not as stated for a start on the far side (x0 = -1.3 for x^2 - 2 meets the
 * other root).
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("newtons-method/newtons-method-core.js", "NewtonCore");
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  equal("11 control points, one step, no starting point", [s.ys.length, s.n, s.x0], [11, 1, null]);
  check("the control points start on the applet's cubic -x^3 - 4x^2 + 5x + 95.83...", s.ys.every((y, i) => near(y, -((i - 5) ** 3) - 4 * (i - 5) ** 2 + 5 * (i - 5) + 95.83333333333333)));
  equal("applet's cubic at 0 and at 5", [near(C.func(0), 95.83333333333333), near(C.func(5), -104.16666666666667)], [true, true]);
  equal("first click sets x0, second clears it", [C.click(s, 1.5).x0, C.click(C.click(s, 1.5), 2).x0], [1.5, null]);
  equal("x0 is kept inside the control points' range", [C.setStart(s, 9).x0, C.setStart(s, -9).x0], [5, -5]);
  equal("a bad start is refused", C.setStart(s, NaN), null);
  equal("steps are kept in 1..10", [C.setSteps(s, 0).n, C.setSteps(s, 4).n, C.setSteps(s, 99).n, C.setSteps(s, "x")], [1, 4, 10, null]);
  const t = C.setHeight(s, 3, 500);
  equal("a control point is dragged and kept in +-120", [t.ys[3], s.ys[3] === C.func(-2)], [120, true]);
  equal("a bad control point is refused", [C.setHeight(s, 11, 0), C.setHeight(s, 1.5, 0), C.setHeight(s, 0, NaN)], [null, null, null]);
  equal("no steps before a start is chosen", C.steps(s), []);
  equal("reset is the starting position", C.reset(), s);
}

/* ------------------------------------------------------------ 2. the spline */
{
  let ok = true, smooth = true, slopeOk = true;
  const r = rng(11);
  for (let t = 0; t < 300; t++) {
    const ys = Array.from({ length: 11 }, () => (r() - 0.5) * 200);
    const c = C.curve({ ys });
    for (let i = 0; i < 11; i++) if (!near(c.f(i - 5), ys[i], 1e-9)) ok = false;
    for (let i = 1; i < 10; i++) {
      const e = 1e-9;
      if (Math.abs(c.f(i - 5 - e) - c.f(i - 5 + e)) > 1e-4) smooth = false;
      if (Math.abs(c.df(i - 5 - e) - c.df(i - 5 + e)) > 1e-4) smooth = false;
    }
    for (let k = 0; k < 20; k++) {
      const x = -5 + r() * 10, h = 1e-5;
      if (Math.abs((c.f(x + h) - c.f(x - h)) / (2 * h) - c.df(x)) > 1e-3 * Math.max(1, Math.abs(c.df(x)))) slopeOk = false;
    }
  }
  check("the spline passes through all 11 control points (300 random sets)", ok);
  check("it is continuous and has a continuous slope at every inner knot", smooth);
  check("its slope is the derivative of its value", slopeOk);
  // the starting spline follows the cubic closely in the middle (a natural spline bends to zero curvature at the ends)
  const c = C.curve(C.start());
  const dev = Math.max(...[-3, -2.5, -1, 0, 1, 2.5, 3].map((x) => Math.abs(c.f(x) - C.func(x))));
  check(`the starting spline stays close to the cubic in the middle (largest gap ${dev.toFixed(2)} of a curve 200 tall)`, dev < 3);
}

/* -------------------------------- 3. steps: the same as the tangent construction */
{
  const s = C.setStart(C.start(), 4.5);
  const c = C.curve(s);
  const o = C.steps({ ...s, n: 6 });
  // the applet's construction: tangent line y = f(x) + f'(x)(t - x), meet y = 0
  let ok = true, x = 4.5;
  for (const st of o) {
    const f = c.f(x), d = c.df(x), t = x - f / d;
    if (!near(st.x, x) || !near(st.next, t)) ok = false;
    x = t;
  }
  check("each step is where the tangent meets the axis", ok);
  check("from x0 = 4.5 the steps settle on the root near 3.837", Math.abs(o[o.length - 1].next - 3.8369) < 1e-3 && Math.abs(c.f(o[o.length - 1].next)) < 1e-9);
  const lost = C.steps({ ...C.setStart(C.start(), 0), n: 5 });
  equal("a tangent that meets the axis off the picture stops the iteration there", [lost.length, lost[0].status, lost[0].next], [1, "out", null]);
  const flat = C.orbit((x) => x * x + 1, (x) => 2 * x, 0, 3, -5, 5);
  equal("a flat tangent never meets the axis: status flat", [flat.length, flat[0].status], [1, "flat"]);
}

/* ------------------------------------- 4. the page's example: the square root of 2 */
{
  const xs = C.heron(2, 1, 6);
  equal("the page's table of Java doubles, to the last digit", xs, [1, 1.5, 1.4166666666666665, 1.4142156862745097, 1.4142135623746899, 1.414213562373095, 1.414213562373095]);
  equal("it stops changing at step 5, within one unit in the last place of the square root", [xs[5] === xs[6], Math.abs(xs[5] - Math.sqrt(2)) <= 2.3e-16], [true, true]);
  // exact fractions: 3/2, 17/12, 577/408
  const frac = [[1n, 1n]];
  for (let k = 0; k < 3; k++) { const [p, q] = frac[k]; frac.push([p * p + 2n * q * q, 2n * p * q]); }
  equal("exactly 3/2, 17/12, 577/408", frac.slice(1).map(([p, q]) => `${p}/${q}`), ["3/2", "17/12", "577/408"]);
  // the iteration for f = x^2 - 2 is Heron's (x + 2/x)/2: same as the generic step with f' = 2x
  let same = true;
  for (let x = 0.3; x < 6; x += 0.37) { const g = C.orbit((u) => u * u - 2, (u) => 2 * u, x, 1, -100, 100)[0].next; if (!near(g, (x + 2 / x) / 2, 1e-12)) same = false; }
  check("the generic step on x^2 - 2 is the Heron formula (x + 2/x)/2", same);
  // the same for several N
  let ok = true;
  for (const N of [2, 3, 5, 7, 10, 50, 1234]) { const xs2 = C.heron(N, N, 40); if (!near(xs2[40], Math.sqrt(N), 1e-12)) ok = false; }
  check("x_next = (x + N/x)/2 gives the square root of N, for N = 2, 3, 5, 7, 10, 50, 1234", ok);
  // Heron's remark: each x_n is at least sqrt(N) after the first step (AM-GM)
  let amgm = true;
  for (const N of [2, 3, 10, 99]) for (const x0 of [0.1, 1, N, 1000]) { const h = C.heron(N, x0, 12); for (let k = 1; k <= 12; k++) if (h[k] < Math.sqrt(N) - 1e-12) amgm = false; }
  check("after the first step the iterates are never below the square root (arithmetic mean >= geometric mean)", amgm);
}

/* ---------------------------------------- 5. the error analysis and convergence */
{
  // a - x_next = -(a - x)^2 / (2x) for f = x^2 - N, exactly
  const a = Math.sqrt(2);
  let ok = true;
  for (const x of [0.5, 1, 1.2, 1.9, 3, 10]) { const next = (x + 2 / x) / 2; if (!near(a - next, -((a - x) ** 2) / (2 * x), 1e-9)) ok = false; }
  check("for x^2 - 2 the error step is exactly a - x_next = -(a - x)^2 / (2x)", ok);
  // M = -f''(a) / (2 f'(a)) = -1/(2 sqrt 2): the ratio of consecutive errors to the square of the earlier one tends to M
  const M = -1 / (2 * a);
  const h = C.heron(2, 1, 4);
  const ratio = (a - h[4]) / ((a - h[3]) ** 2);
  check(`the ratio (a - x_{n+1}) / (a - x_n)^2 tends to M = -1/(2 sqrt 2) = ${M.toFixed(4)}: it is ${ratio.toFixed(4)} at n = 3`, Math.abs(ratio - M) < 1e-3);
  // quadratic: the number of correct digits roughly doubles
  const err = [1, 2, 3, 4].map((k) => Math.abs(h[k] - a));
  check("the error is about squared each step (0.0858, 0.00245, 2.1e-6, 1.6e-12)", err[1] < err[0] ** 2 && err[2] < err[1] ** 2 && err[3] < err[2] ** 2, err.join(" "));
  // |M(a - x0)| < 1 is the page's condition: holds for x0 near the root
  let near1 = true;
  for (let x0 = a - 0.5; x0 <= a + 0.5; x0 += 0.05) { const xs3 = C.heron(2, x0, 30); if (!near(xs3[30], a, 1e-12)) near1 = false; }
  check("starting within 1/|M| and near the root, the iterations converge to it", near1);
  // the page's bound 1/|M| = 2 sqrt 2 = 2.83: the starting points x0 in (a - 2.83, a + 2.83) = (-1.41, 4.24) include x0 = -1.3, which goes to the other root
  const left = C.heron(2, -1.3, 40)[40];
  equal("not as stated for a start across zero: x0 = -1.3 is within 1/|M| = 2.83 of the root yet goes to -sqrt 2", [near(left, -a, 1e-12), 2 * a > Math.abs(a - -1.3)], [true, true]);
  // a start on the positive side within the bound always reaches +sqrt 2
  let right = true;
  for (let x0 = 0.01; x0 < a + 2 * a; x0 += 0.013) if (!near(C.heron(2, x0, 80)[80], a, 1e-12)) right = false;
  check("every start in (0, a + 1/|M|) reaches the positive root", right);
}

/* ------------------------------------------- 6. when the method does not work */
{
  // x^3 - 2x + 2 from 0: 0 -> 1 -> 0 -> 1 ... a loop that never reaches the root (the textbook failure)
  const f = (x) => x ** 3 - 2 * x + 2, df = (x) => 3 * x * x - 2;
  const o = C.orbit(f, df, 0, 6, -10, 10);
  equal("x^3 - 2x + 2 from 0 loops 0, 1, 0, 1, ...", o.map((s) => s.x), [0, 1, 0, 1, 0, 1]);
  // a start near the local extreme of the default curve: the tangent is nearly flat and the next point leaves the picture
  const s0 = C.start();
  const c = C.curve(s0);
  let worst = null;
  for (let x = -3; x <= 2; x += 0.001) { const o2 = C.orbit(c.f, c.df, x, 1, -5, 5)[0]; if (o2.status === "out" && (worst === null || Math.abs(o2.slope) < worst.slope)) worst = { x, slope: Math.abs(o2.slope) }; }
  check(`near the local maximum (x about 0.6) of the starting curve the tangent is almost flat (slope ${worst && worst.slope.toFixed(3)}) and the next point is off the picture`, worst !== null && worst.slope < 0.5 && Math.abs(worst.x - 0.55) < 0.3);
  // every start in the picture ends in one of the three ways
  let converged = 0, lost = 0, total = 0;
  for (let x = -5; x <= 5; x += 0.01) {
    total++;
    const steps = C.orbit(c.f, c.df, x, 40, -5, 5);
    const last = steps[steps.length - 1];
    if (last.status !== "ok") lost++;
    else if (Math.abs(c.f(last.next)) < 1e-6) converged++;
  }
  check(`${converged} of ${total} starts reach the root (3.837), ${lost} leave the picture, the rest are still wandering`, converged > 0 && lost > 0 && converged + lost <= total);
}

done("newtons-method");
