#!/usr/bin/env node
"use strict";

/*
 * Logic test for binomial-distribution/binomial-distribution-core.js.
 *
 *   node porting/check-binomial-distribution.mjs
 *
 * The applet's ranges are small enough to walk completely: p has 111 raw
 * positions (0 .. 110, mapped by p = raw * 0.01) and n has 104 (2 .. 105),
 * 11,544 combinations. Every one is checked against a second, independent
 * transcription of the closed-form binomial formula (exact integer binomial
 * coefficients via BigInt), plus every k in 0 .. n. The maths claims on the
 * cut-the-knot page are each tested here, including the two that need care:
 * the "most likely value is always different from the average" claim fails
 * for the integer mode (n = 10, p = 0.5 gives mode = mean = 5), and the applet
 * lets p reach 1.10, outside the probability range.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("binomial-distribution/binomial-distribution-core.js", "BinomialDistributionCore");

const P_RAWS = Array.from({ length: 111 }, (_, r) => r);
const P_VALS = P_RAWS.map((r) => r * 0.01);
const N_VALS = Array.from({ length: 104 }, (_, i) => i + 2);
const COMBOS = [];
for (const p of P_VALS) for (const n of N_VALS) COMBOS.push([p, n]);

function near(a, b, tol = 1e-8) {
  return Math.abs(a - b) <= tol * (1 + Math.abs(a) + Math.abs(b));
}

/** Exact C(n, k) as a BigInt, for an independent reference. */
function chooseBig(n, k) {
  if (k < 0 || k > n) return 0n;
  let c = 1n;
  for (let i = 1n, j = 1; i <= BigInt(k); i++, j++) {
    c = (c * BigInt(n - j + 1)) / i;
  }
  return c;
}

/** The page's formula, computed a second way (not via the applet's recurrence). */
function pmfClosed(p, n, k) {
  return Number(chooseBig(n, k)) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

/* ------------------------------------------------------------ 1. the rules */

equal("start uses the applet's defaults", C.start({}), { p: 0.55, n: 10, k: 6, explored: false });
check("start is not yet explored", C.result(C.start({})) === null);
equal("p below the range clamps to 0", C.start({ p: -0.5, n: 10 }).p, 0);
equal("p above the range clamps to 1.10", C.start({ p: 2, n: 10 }).p, 1.1);
equal("n below the range clamps to 2", C.start({ p: 0.5, n: -3 }).n, 2);
equal("n above the range clamps to 105", C.start({ p: 0.5, n: 999 }).n, 105);
equal("p is kept to two decimals", C.start({ p: 0.555, n: 10 }).p, 0.56);
check("the position is plain JSON", JSON.parse(JSON.stringify(C.start({}))).p === 0.55);
equal("formatP matches the applet's .55 label", C.formatP(0.55), ".55");
equal("formatP keeps two decimals at p = 1", C.formatP(1), "1.00");

/* ---------------------------------- 2. the recurrence against the formula */

{
  let bad = 0;
  let worst = 0;
  for (const [p, n] of COMBOS) {
    const d = C.distribution(p, n);
    if (d.length !== n + 1) { bad++; continue; }
    for (let k = 0; k <= n; k++) {
      const ref = pmfClosed(p, n, k);
      const err = Math.abs(d[k] - ref) / (1 + Math.abs(ref));
      if (err > worst) worst = err;
      if (!near(d[k], ref, 1e-8)) bad++;
    }
  }
  check("recurrence equals C(n,k)p^k(1-p)^(n-k) over all 11,544 combos and all k", bad === 0,
    `${bad} mismatches, worst relative error ${worst.toExponential(2)}`);
}

{
  let bad = 0;
  for (const [p, n] of COMBOS) {
    if (!near(C.total(p, n), 1, 1e-8)) bad++;
  }
  check("the probabilities sum to 1 over every combo", bad === 0, `${bad} bad sums`);
}

/* ---------------------------------------- 3. the page's claims, exhaustively */

{
  // b(k)/b(k-1) = (n-k+1)p / (k(1-p)). Use the closed form as the reference so
  // tiny probabilities do not turn into divide-by-zero noise. p <= 0.9 keeps
  // every denominator used here away from zero.
  let bad = 0;
  for (const p of P_VALS.filter((v) => v <= 0.9 && v > 0)) {
    for (const n of N_VALS) {
      for (let k = 1; k <= n; k++) {
        const prev = pmfClosed(p, n, k - 1);
        if (prev < 1e-12) continue;
        const ref = pmfClosed(p, n, k) / prev;
        const got = C.ratio(p, n, k);
        if (got === null || !near(got, ref, 1e-8)) bad++;
      }
    }
  }
  check("b(k)/b(k-1) = (n-k+1)p/(k(1-p)) (page equation 1)", bad === 0, `${bad} bad ratios`);
}

{
  // For every probability in the true range 0 <= p <= 1 the bars rise up to
  // the mode m and fall after it; when (n+1)p is an integer there are two
  // equal maxima at m and m-1.
  let bad = 0;
  for (const p of P_VALS.filter((v) => v <= 1)) {
    for (const n of N_VALS) {
      const d = C.distribution(p, n);
      const m = C.mode(p, n);
      for (let k = 1; k <= m; k++) if (d[k] < d[k - 1] - 1e-12) bad++;
      for (let k = m + 1; k <= n; k++) if (d[k] > d[k - 1] + 1e-12) bad++;
      const x = (n + 1) * p;
      if (Number.isInteger(x) && x >= 1 && x <= n && !near(d[x], d[x - 1], 1e-8)) bad++;
    }
  }
  check("bars increase up to m and decrease after m (page monotonicity claim)", bad === 0,
    `${bad} violations`);
}

{
  // Exactly one integer satisfies (n+1)p - 1 < m <= (n+1)p, and for the
  // interior of the range it is the mode.
  let bad = 0;
  for (const [p, n] of COMBOS) {
    const x = (n + 1) * p;
    const m = Math.floor(x);
    if (!(m > x - 1 && m <= x)) { bad++; continue; }
    if (m - 1 > x - 1 || m + 1 <= x) bad++; // neighbours do not also fit
    if (p > 0 && p <= n / (n + 1) && C.mode(p, n) !== m) bad++;
  }
  check("exactly one integer m satisfies (n+1)p-1 < m <= (n+1)p (page equation 2)", bad === 0,
    `${bad} violations`);
}

{
  let bad = 0;
  for (const [p, n] of COMBOS) {
    if (!near(C.expectedValue(p, n), n * p, 1e-8)) bad++;
  }
  check("sum k*b(k) = n*p over every combo (the page's expected value)", bad === 0,
    `${bad} bad expectations`);
}

{
  // The identity used on the page to derive the mean.
  let bad = 0;
  for (let n = 2; n <= 25; n++) {
    for (const x of [0, 0.1, 0.5, 1, 2, -0.3]) {
      let sum = 0;
      for (let k = 1; k <= n; k++) sum += k * Number(chooseBig(n, k)) * Math.pow(x, k - 1);
      if (!near(sum, n * Math.pow(1 + x, n - 1), 1e-7)) bad++;
    }
  }
  check("sum k*C(n,k)x^(k-1) = n(1+x)^(n-1)", bad === 0, `${bad} bad identities`);
}

{
  let bad = 0;
  for (const [p, n] of COMBOS) {
    if (p !== 0 && !near((n + 1) * p - n * p, p, 1e-12)) bad++;
  }
  check("(n+1)p differs from n*p by exactly p for p != 0 (last claim)", bad === 0,
    `${bad} violations`);
}

{
  // The page also says the number m is "always different from the average".
  // That is false for the integer mode: n = 10, p = 0.5 gives m = 5 = np.
  let equalCount = 0;
  for (const p of P_VALS.filter((v) => v > 0 && v <= 1)) {
    for (const n of N_VALS) {
      if (C.mode(p, n) === n * p) equalCount++;
    }
  }
  check("mode equals the mean in at least one real case", equalCount > 0,
    `${equalCount} cases found`);
  check("concrete counterexample: mode(0.5, 10) = 5 = 10*0.5",
    C.mode(0.5, 10) === 5 && near(C.expectedValue(0.5, 10), 5, 1e-9));
}

{
  // When (n+1)p is an integer in 1..n there are two equal maximum bars.
  let cases = 0;
  let bad = 0;
  for (const p of P_VALS.filter((v) => v > 0 && v < 1)) {
    for (const n of N_VALS) {
      const x = (n + 1) * p;
      if (!Number.isInteger(x) || x < 1 || x > n) continue;
      cases++;
      const ms = C.modes(p, n);
      if (ms.length !== 2 || ms[0] !== x - 1 || ms[1] !== x) bad++;
    }
  }
  check("two equal maxima when (n+1)p is an integer", cases > 0 && bad === 0,
    `${cases} cases, ${bad} bad`);
}

{
  // "b(m; n, p) is quite small for a large n, even for a reasonable p."
  const maxAt = (p, n) => Math.max(...C.distribution(p, n));
  check("the highest bar shrinks as n grows at p = 0.5", maxAt(0.5, 10) > maxAt(0.5, 100));
  check("the highest bar is below 0.1 by n = 100 at p = 0.5", maxAt(0.5, 100) < 0.1);
}

{
  // The applet's p scrollbar reaches 1.10. Keep the quirk: the recurrence
  // still matches the binomial expansion and still sums to 1, but the bars
  // alternate in sign because (1 - p) is negative.
  const d = C.distribution(1.1, 10);
  let bad = 0;
  for (let k = 0; k <= 10; k++) if (!near(d[k], pmfClosed(1.1, 10, k), 1e-8)) bad++;
  check("p = 1.10 keeps matching the algebraic expansion", bad === 0 && near(C.total(1.1, 10), 1, 1e-8));
  check("p > 1 really does make at least one bar negative", d.some((v) => v < 0));
}

/* ---------------------------------------- 4. the controls and how it ends */

{
  const s = C.start({ p: 0.55, n: 10 });
  const pMoved = C.setP(s, 0.8);
  check("setP changes p and keeps n", pMoved.p === 0.8 && pMoved.n === 10);
  check("setP marks the demo explored", C.result(pMoved) === "done");
  const nMoved = C.setN(s, 20);
  check("setN changes n and keeps p", nMoved.n === 20 && nMoved.p === 0.55);
  const shrunk = C.setN(C.setN(s, 20), 3);
  check("setN clamps the selected bar into the new range", shrunk.k <= 3);
  check("selectK clamps below 0 and above n", C.selectK(s, -4).k === 0 && C.selectK(s, 99).k === 10);
  check("stepK moves one bar and stops at the ends",
    C.stepK(s, 1).k === 7 && C.stepK(C.setN(s, 2), 50).k === 2);
  check("setP clamps out-of-range values", C.setP(s, -1).p === 0 && C.setP(s, 9).p === 1.1);
  check("setN clamps out-of-range values", C.setN(s, 0).n === 2 && C.setN(s, 500).n === 105);
  check("explore ends a demo with done", C.result(C.explore(s)) === "done");
  check("pmf returns 0 outside 0..n", C.pmf(0.5, 10, -1) === 0 && C.pmf(0.5, 10, 11) === 0);
  check("pmf agrees with distribution", near(C.pmf(0.5, 10, 3), C.distribution(0.5, 10)[3]));
}

done("binomial-distribution");
