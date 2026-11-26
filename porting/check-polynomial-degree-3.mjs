#!/usr/bin/env node
"use strict";

/*
 * Logic test for polynomial-degree-3/polynomial-degree-3-core.js.
 *
 *   node porting/check-polynomial-degree-3.mjs
 *
 * 1. The options: the start, the slider range and step, the formula.
 * 2. The roots, against a second transcription of FindOneRoot, RootByHalves
 *    and DivideHorner, on a grid of 9^4 cubics over the sliders' range, and the
 *    three roots against the coefficients (Vieta) for all of them.
 * 3. The page's claims: one real root always; the graph is symmetric about
 *    the inflection point; P minus the tangent there is a (x - x0)^3.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("polynomial-degree-3/polynomial-degree-3-core.js", "PolynomialDegree3Core");

/* ------------------------------------------------------------ 1. the options */

{
  const s = C.start({ random: () => 0.5 });
  equal("the start is a = 1 and b, c, d = 11 * random - 5", s.c, [0.5, 0.5, 0.5, 1]);
  check("the tangent starts hidden", s.tangent === false);
  check("random starts stay in [-5, 6)", [0, 0.999999].every((r) => C.start({ random: () => r }).c.slice(0, 3).every((v) => v >= -5 && v < 6)));
  check("sliders clamp to -20..20", C.move(s, { type: "coef", index: 3, value: 25 }).c[3] === 20 && C.move(s, { type: "coef", index: 0, value: -30 }).c[0] === -20);
  check("sliders truncate to hundredths like (int)(v*100)/100", C.move(s, { type: "coef", index: 1, value: 1.239 }).c[1] === 1.23 && C.move(s, { type: "coef", index: 1, value: -1.239 }).c[1] === -1.23);
  check("a bad move is refused", C.move(s, { type: "coef", index: 4, value: 1 }) === null && C.move(s, null) === null);
  check("the formula", C.formula(C.start({ c: [-6, 11, -6, 1] })) === "P(x) = x³ − 6x² + 11x − 6" && C.formula(C.start({ c: [0, 0, 0, 0] })) === "P(x) = 0" && C.formula(C.start({ c: [0.5, 0, -2.25, -1] })) === "P(x) = −x³ − 2.25x² + 0.5");
  check("with a = 0 there are no roots and no inflection point", C.roots(C.start({ c: [1, 2, 3, 0] })) === null && C.inflection(C.start({ c: [1, 2, 3, 0] })) === null);
}

/* --------------------------- 2. the roots, against the applet's own method */

function appletRoot(Coef, eps) {
  const ValueDirect = (x) => { let v = Coef[3]; for (let k = 2; k >= 0; k--) v = v * x + Coef[k]; return v; };
  if (Coef[3] === 0) return NaN;
  let L4 = 0, L6 = ValueDirect(L4);
  while (L6 === 0) { L4 += 1; L6 = ValueDirect(L4); }
  if (Math.abs(L6) < eps) return L4;
  const L8 = L4, L12 = L6 * Coef[3] > 0 ? -1 : 1;
  L4 += L12;
  let L13 = ValueDirect(L4);
  while (L13 * L6 > 0) { L4 += L12; L13 = ValueDirect(L4); if (Math.abs(L13) < eps) return L4; }
  // RootByHalves(L4, L8, eps)
  let a = L4, b = L8, fa = ValueDirect(a), m = b, fm = ValueDirect(b);
  while (Math.abs(fm) > eps) { m = (a + b) / 2; fm = ValueDirect(m); if (Math.abs(fm) < eps) break; if (fa * fm > 0) { a = m; fa = fm; } else { b = m; } }
  return m;
}

{
  const vals = [-20, -13.37, -5, -1, 0, 0.5, 3.21, 9.99, 20];
  let cubics = 0, same = 0, small = 0, vieta = 0;
  for (const a of vals) for (const b of vals) for (const c of vals) for (const d of vals) {
    if (a === 0) continue;
    cubics++;
    const s = C.start({ c: [d, c, b, a] });
    const r = C.roots(s);
    if (r.real === appletRoot([d, c, b, a], 0.001)) same++;
    if (Math.abs(C.value(s.c, r.real)) < 0.001) small++;
    // Vieta, with the found root: sum = -b/a, sum of products = c/a, product = -d/a.
    const [p, q] = r.others;
    const sum = r.real + p.re + q.re;
    const pq = p.re * q.re - p.im * q.im;
    const sumProd = r.real * (p.re + q.re) + pq;
    const prod = r.real * pq;
    const scale = 1 + Math.abs(b / a) + Math.abs(c / a) + Math.abs(d / a);
    if (Math.abs(sum + b / a) < 1e-3 * scale && Math.abs(sumProd - c / a) < 1e-2 * scale * scale && Math.abs(prod + d / a) < 1e-2 * scale ** 3 && Math.abs(p.im + q.im) < 1e-12) vieta++;
  }
  check(`the core finds the applet's root in all ${cubics} cubics`, same === cubics);
  check("each found root has |P| < 0.001", small === cubics);
  check("the three roots fit Vieta's formulas, the complex pair conjugate", vieta === cubics);
  const t = C.roots(C.start({ c: [-6, 11, -6, 1] }));
  check("x³ − 6x² + 11x − 6 has the roots 1, 2, 3", [t.real, ...t.others.map((o) => o.re)].map((x) => Math.round(x * 100) / 100).sort().join() === "1,2,3" && !t.complex);
  const u = C.roots(C.start({ c: [-1, 1, -1, 1] }));
  check("x³ − x² + x − 1 has 1 and ± i", Math.abs(u.real - 1) < 1e-3 && u.complex && Math.abs(Math.abs(u.others[0].im) - 1) < 1e-3 && Math.abs(u.others[0].re) < 1e-3);
  const z = C.roots(C.start({ c: [0, -1, 0, 1] }));
  check("with P(0) = 0 the applet steps off 0 and still finds a root (x³ − x gives 1)", Math.abs(z.real - 1) < 1e-3);
}

/* ------------------------------------------------------------- 3. the claims */

{
  let seed = 3;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let n = 0, realRoot = 0, symmetric = 0, cube = 0;
  for (let k = 0; k < 20000; k++) {
    const c = [0, 1, 2, 3].map(() => C.toSlider(rnd() * 40 - 20));
    if (c[3] === 0) continue;
    n++;
    const s = C.start({ c });
    if (C.roots(s)) realRoot++;
    const f = C.inflection(s);
    let sym = true, cub = true;
    for (const h of [0.3, 1, 2.7]) {
      const m = Math.abs(C.value(c, f.x + h)) + Math.abs(C.value(c, f.x - h)) + 1;
      if (Math.abs(C.value(c, f.x + h) + C.value(c, f.x - h) - 2 * f.y) > 1e-9 * m) sym = false;
      const dv = C.value(f.difference, f.x + h), want = c[3] * h ** 3;
      if (Math.abs(dv - want) > 1e-9 * (Math.abs(want) + Math.abs(C.value(c, f.x + h)) + 1)) cub = false;
    }
    if (sym) symmetric++;
    if (cub) cube++;
  }
  check(`every one of ${n} random cubics has a real root`, realRoot === n);
  check("each graph is symmetric about its inflection point: P(x0 + h) + P(x0 − h) = 2 P(x0)", symmetric === n);
  check("P minus its tangent at the inflection point is a (x − x0)³, three equal roots", cube === n);
}

done("polynomial-degree-3");
