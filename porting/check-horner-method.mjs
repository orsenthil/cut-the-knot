#!/usr/bin/env node
"use strict";

/*
 * Logic test for horner-method/horner-method-core.js.
 *
 *   1. The page's example 2x^4-3x^3+x+7 at 2: value 17, quotient and derivative.
 *   2. For many random polynomials: Horner's value matches direct evaluation,
 *      P(x) = (x-t)Q(x) + r as polynomials, and the second pass gives P'(t).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("horner-method/horner-method-core.js", "HornerMethodCore");

{
  const s = C.start();
  equal("default degree", s.coefficients.length - 1, 4);
  equal("default t", s.t, 2);
  const r = C.analyze(s);
  equal("page example P(2)", r.value, 17);
  equal("page example quotient", r.quotient.join(","), "2,1,2,5");
  equal("page example remainder", r.remainder, 17);
  // P'(x) = 8x^3 - 9x^2 + 1, so P'(2) = 64 - 36 + 1 = 29.
  equal("page example derivative", r.derivative, 29);
  equal("first b", r.rows[0], 2);
  equal("last b", r.rows[r.rows.length - 1], 17);
  equal("coefficient clamped", C.setCoefficient(s, 0, 999).coefficients[0], 99);
  equal("t clamped", C.setT(s, 999).t, 20);
}

{
  const rnd = rng(1786);
  let values = 0;
  let divisions = 0;
  let derivatives = 0;
  let cases = 0;
  for (let t = 0; t < 500; t++) {
    const n = 1 + Math.floor(rnd() * 7);
    const coeffs = Array.from({ length: n + 1 }, () => -9 + Math.floor(rnd() * 19));
    const x = -4 + Math.floor(rnd() * 9);
    cases++;
    const r = C.analyze({ coefficients: coeffs, t: x });
    if (r.value === C.direct(coeffs, x)) values++;
    // Verify P(y) = (y - x) Q(y) + r at several sample y.
    let ok = true;
    for (const y of [-3, 0, 1, 5]) {
      const lhs = C.direct(coeffs, y);
      const rhs = (y - x) * C.direct(r.quotient, y) + r.remainder;
      if (lhs !== rhs) ok = false;
    }
    if (ok) divisions++;
    // Analytic derivative by the power rule.
    let deriv = 0;
    for (let i = 1; i <= n; i++) deriv += i * coeffs[n - i] * x ** (i - 1);
    if (r.derivative === deriv) derivatives++;
  }
  equal("all polynomials checked", cases, 500);
  equal("Horner matches direct evaluation", values, cases);
  equal("the division identity holds", divisions, cases);
  equal("the second pass gives the derivative", derivatives, cases);
}

done("horner-method");
