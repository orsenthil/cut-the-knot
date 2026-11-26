#!/usr/bin/env node
"use strict";

/*
 * Logic test for polynomial-roots/polynomial-roots-core.js.
 *
 *   node porting/check-polynomial-roots.mjs
 *
 * 1. The options: degree 0..10, the random start as the applet makes it.
 * 2. P against a second transcription of DisplayRootPolynomial.Value, and
 *    against the expanded product, for every root list of degree <= 4 with
 *    roots in -2..2 and A in -3..3.
 * 3. The page's claims, exhaustively on the same lists: the end-behaviour
 *    table, crossing at odd and touching at even multiplicity, tangency at
 *    repeated roots, and A stretching and flipping the graph.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("polynomial-roots/polynomial-roots-core.js", "PolynomialRootsCore");

/* ------------------------------------------------------------ 1. the options */

{
  const s = C.start({ random: () => 0.5 });
  equal("the start is degree 3: roots (int)(11*0.5 - 5) = 0, A = (int)(5*0.5 + 1) = 3", s, { a: 3, roots: [0, 0, 0] });
  let lo = 99, hi = -99, alo = 99, ahi = -99, zeros = 0, total = 0;
  for (let k = 1; k < 1000; k++) {
    const r = k / 1000; // random() = 0 exactly would give -5, a 1 in 2^53 chance
    const t = C.start({ degree: 1, random: () => r });
    lo = Math.min(lo, t.roots[0]); hi = Math.max(hi, t.roots[0]); alo = Math.min(alo, t.a); ahi = Math.max(ahi, t.a);
    total++; if (t.roots[0] === 0) zeros++;
  }
  check("random roots run from -4 to 5 (and -5 only when random() is exactly 0)", lo === -4 && hi === 5);
  check("0 is twice as likely as any other root (Java's cast rounds towards zero)", Math.abs(zeros / total - 2 / 11) < 0.01);
  check("A runs from 1 to 5", alo === 1 && ahi === 5);
  check("degrees are kept in 0..10", C.start({ degree: 11 }).roots.length === 10 && C.start({ degree: -1 }).roots.length === 0);
  check("a degree change makes a new polynomial", C.move(s, { type: "degree", value: 5 }, () => 0.9).roots.length === 5);
  check("a root can be stepped", C.move(s, { type: "root", index: 1, value: -2 }).roots[1] === -2 && C.move(s, { type: "root", index: 3, value: 1 }) === null);
  check("the formula", C.formula({ a: 2, roots: [1, -3, 0] }) === "P(x) = 2(x − 1)(x + 3)(x − 0)" && C.formula({ a: -1, roots: [2] }) === "P(x) = −(x − 2)" && C.formula({ a: -4, roots: [] }) === "P(x) = −4");
}

/* ---------------- 2 and 3. every small polynomial: the value and the claims */

function appletValue(Coef, x) {
  // DisplayRootPolynomial.Value: c = Coef[N]; for k = N-1..0: c *= (x - Coef[k]).
  const N = Coef.length - 1;
  let c = Coef[N];
  for (let k = N - 1; k >= 0; k--) c *= x - Coef[k];
  return c;
}

function* lists(len, vals) {
  if (len === 0) { yield []; return; }
  for (const rest of lists(len - 1, vals)) for (const v of vals) yield [...rest, v];
}

{
  let polys = 0, same = 0, expand = 0, endsOk = 0, crossOk = 0, tangentOk = 0, scaleOk = 0;
  for (let n = 0; n <= 4; n++) for (const roots of lists(n, [-2, -1, 0, 1, 2])) for (let a = -3; a <= 3; a++) {
    if (a === 0) continue;
    polys++;
    const s = { a, roots };
    const xs = [-7.3, -2.5, -0.5, 0.25, 1.5, 3.1];
    if (xs.every((x) => C.value(s, x) === appletValue([...roots, a], x))) same++;
    // Expanded coefficients by convolution, low to high.
    let coef = [a];
    for (const r of roots) coef = coef.map((c, i) => -r * c + (coef[i - 1] || 0)).concat([coef[coef.length - 1]]);
    if (xs.every((x) => Math.abs(coef.reduceRight((acc, k) => acc * x + k, 0) - C.value(s, x)) < 1e-9 * (1 + Math.abs(C.value(s, x))))) expand++;
    // End behaviour: far out, the sign of P.
    const e = C.ends(s);
    if (Math.sign(C.value(s, 1e6)) === e.right && Math.sign(C.value(s, -1e6)) === e.left &&
        e.right === Math.sign(a) && e.left === (n % 2 === 0 ? 1 : -1) * Math.sign(a)) endsOk++;
    // Crossing: the sign on both sides of each root (gaps between roots are >= 1).
    const ms = C.multiplicities(s);
    if (ms.every(({ root, crosses }) => (Math.sign(C.value(s, root - 0.01)) !== Math.sign(C.value(s, root + 0.01))) === crosses)) crossOk++;
    // Tangent: P'(r) = 0 exactly when r is repeated (numerical derivative).
    const d = (x) => (C.value(s, x + 1e-6) - C.value(s, x - 1e-6)) / 2e-6;
    if (ms.every(({ root, times }) => (Math.abs(d(root)) < 1e-6) === (times > 1))) tangentOk++;
    // A stretches (|A|) and flips (sign): P_A = A * P_1.
    if (xs.every((x) => Math.abs(C.value(s, x) - a * C.value({ a: 1, roots }, x)) < 1e-9 * (1 + Math.abs(C.value(s, x))))) scaleOk++;
  }
  check(`P agrees with the applet's Value on ${polys} polynomials`, same === polys);
  check("P agrees with its expanded coefficients", expand === polys);
  check("the end-behaviour table: right has the sign of A, left the sign of A (-1)^n", endsOk === polys);
  check("the graph crosses at odd multiplicity and stays on one side at even", crossOk === polys);
  check("the graph is tangent to the axis exactly at repeated roots", tangentOk === polys);
  check("A stretches the graph and its sign flips it", scaleOk === polys);
}

done("polynomial-roots");
