#!/usr/bin/env node
"use strict";

/*
 * Logic test for fourth-degree/fourth-degree-core.js.
 *
 *   node porting/check-fourth-degree.mjs
 *
 * McMullin and Weeks' facts, tested on 200,000 random quartics (coefficients -10..10 in steps of 0.1, as the
 * sliders) that have two inflection points: p - L has roots xL, a, b, xR (found numerically from the polynomial
 * and compared with the formula (1)); a + b = xL + xR (2); p - L is symmetric about the midpoint;
 * (b - a)/(a - xL) is the golden ratio; the three areas are in the ratio 1 : 2 : 1 (5), the areas by exact
 * integration; the page's coefficients (*) of p - L; and the quadratic (7) x^2 - (a+b)x - (a^2 - 3ab + b^2) = 0.
 * Quartics without two inflection points are recognised.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("fourth-degree/fourth-degree-core.js", "FourthDegreeCore");
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e * Math.max(1, Math.abs(a), Math.abs(b));

{
  const s = C.start({});
  check("the start is x^4 - 6x^2 + x, inflection points -1 and 1, graph and line shown", s.c.join() === "0,1,-6,0,1" && s.showGraph && s.showLine && !s.showDiff && C.result(s) === null);
  const f = C.inflection(s.c);
  check("its inflection points are -1 and 1", near(f.a, -1) && near(f.b, 1));
  const k = C.crossings(s.c);
  check("for it the line meets the graph at (1 -/+ ... ): xL = -sqrt 5, xR = sqrt 5", near(k.xL, -Math.sqrt(5)) && near(k.xR, Math.sqrt(5)) && Math.abs(C.evalPoly(k.diff, k.xL)) < 1e-9 && Math.abs(C.evalPoly(k.diff, k.xR)) < 1e-9);
  const ar = C.areas(s.c);
  check("the areas for the start are in ratio 1 : 2 : 1", near(ar.middle / ar.left, 2) && near(ar.right / ar.left, 1));
  check("a coefficient is clamped to -10..10 in steps of 0.1 and any change counts as exploring", C.move(s, { type: "coef", index: 4, value: 99 }).c[4] === 10 && C.move(s, { type: "coef", index: 0, value: 1.04 }).c[0] === 1 && C.result(C.move(s, { type: "coef", index: 1, value: 2 })) === "done" && C.move(s, { type: "coef", index: 5, value: 1 }) === null);
  check("the check boxes and Reset", C.move(s, { type: "show", which: "diff", value: true }).showDiff === true && C.move(s, { type: "show", which: "x", value: true }) === null && C.move(C.move(s, { type: "coef", index: 4, value: 2 }), { type: "reset" }).c.join() === s.c.join());
  check("the old position is untouched", s.c.join() === "0,1,-6,0,1" && s.moves === 0);
  check("no inflection points: x^4 + x^2 (p'' > 0) and a cubic (m4 = 0)", C.inflection([0, 0, 1, 0, 1]) === null && C.inflection([0, 0, 1, 1, 0]) === null && C.line([0, 0, 1, 0, 1]) === null);
}

{
  let seed = 123, n = 0, bad = null, worstArea = 0;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 2147483648; };
  const val = () => Math.round((rnd() * 20 - 10) * 10) / 10;
  while (n < 200000 && !bad) {
    const c = [val(), val(), val(), val(), val()];
    const f = C.inflection(c);
    if (!f || Math.abs(c[4]) < 0.1 || f.b - f.a < 0.2) continue; // nearly equal inflection points make the areas vanish into rounding noise
    n++;
    const k = C.crossings(c), { a, b, xL, xR } = k;
    // numerically: p - L vanishes at the four roots
    for (const x of [a, b, xL, xR]) if (Math.abs(C.evalPoly(k.diff, x)) > 1e-6 * Math.max(1, Math.abs(c[4]) * x ** 4)) bad = `root ${x} of ${c}`;
    // the page's coefficients (*), with m4 = c[4]
    const m4 = c[4];
    const star = [-a * b * (a * a - 3 * a * b + b * b) * m4, (a ** 3 - 3 * a * a * b - 3 * a * b * b + b ** 3) * m4, 6 * a * b * m4, -2 * (a + b) * m4, m4];
    for (let i = 0; i < 5; i++) if (!near(star[i], k.diff[i], 1e-7)) bad = `(*) coefficient ${i} of ${c}: ${star[i]} vs ${k.diff[i]}`;
    if (!near(a + b, xL + xR, 1e-9)) bad = `(2) ${c}`;
    if (!near(xL * xR, -(a * a - 3 * a * b + b * b), 1e-7)) bad = `(6) ${c}`;
    if (!(xL < a && a < b && b < xR)) bad = `order ${c}`;
    if (!near((b - a) / (a - xL), k.phi, 1e-7)) bad = `golden ratio ${c}`;
    // symmetry of p - L about the midpoint
    const mid = (a + b) / 2, t = 0.37 * (b - a);
    if (!near(C.evalPoly(k.diff, mid + t), C.evalPoly(k.diff, mid - t), 1e-6)) bad = `symmetry ${c}`;
    const ar = C.areas(c);
    if (!near(ar.middle / ar.left, 2, 1e-6) || !near(ar.right / ar.left, 1, 1e-6)) bad = `areas ${c}: ${ar.left} ${ar.middle} ${ar.right}`;
    worstArea = Math.max(worstArea, Math.abs(ar.middle / ar.left - 2));
  }
  check(`for ${n} random quartics with two inflection points: p - L has the roots xL, a, b, xR; (*) holds; a + b = xL + xR; xL xR = -(a^2 - 3ab + b^2); (b - a)/(a - xL) is the golden ratio; p - L is symmetric; the areas are 1 : 2 : 1 (worst error ${worstArea.toExponential(1)})`, bad === null, String(bad));
}

{
  const k = C.crossings([0, 0, -24, 0, 1]); // p = x^4 - 24 x^2
  check("a second example by hand: x^4 - 24x^2 has inflection points -2 and 2, and meets the line y = -80 at +-sqrt 20 = +-2 sqrt 5", near(k.a, -2) && near(k.b, 2) && near(k.xR, 2 * Math.sqrt(5)) && near(k.s, 0, 1e-9) && near(k.t, -80, 1e-9));
}

done("fourth-degree");
