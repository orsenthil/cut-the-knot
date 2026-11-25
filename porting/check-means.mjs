#!/usr/bin/env node
"use strict";

/*
 * Logic test for means/means-core.js.
 *
 *   node porting/check-means.mjs
 *
 * The page's two problems (20 and 30 mph: average speed 25 over equal times,
 * 24 over equal distances), H(a) = 1/A(1/a), the named means, and the page's
 * claims on 5,000 random sets of up to 30 numbers 1..100 for every exponent
 * from -50 to 50: M_r lies between the smallest and largest number, never
 * decreases as r grows, M_r > M_(r/2) for r > 0 (the Lemma), the geometric mean
 * is the limit as r goes to 0 (against M of a tiny exponent), arithmetic >=
 * geometric >= harmonic, with equality exactly when all numbers are equal. The
 * applet's loop (sum of powers, then the 1/r power) is written again as a second
 * version and compared, and the Java-style float print is checked.
 */

import { loadCore, check, equal, rng, done } from "./lib/load-core.mjs";

const C = loadCore("means/means-core.js", "MeansCore");
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/* ------------------------------------------------------------ 1. the page's examples */
{
  equal("problem 1: equal times, the arithmetic mean of 20 and 30 is 25", C.mean([20, 30], 1), 25);
  check("problem 2: equal distances, the harmonic mean of 20 and 30 is 24", close(C.mean([20, 30], -1), 24));
  check("2d / (d/20 + d/30) = 24", close(2 / (1 / 20 + 1 / 30), 24));
  check("the geometric mean of 20 and 30 is sqrt 600", close(C.mean([20, 30], 0), Math.sqrt(600)));
  check("the quadratic mean of 20 and 30 is sqrt 650", close(C.mean([20, 30], 2), Math.sqrt(650)));
  equal("names", [C.nameOf(1), C.nameOf(0), C.nameOf(-1), C.nameOf(2), C.nameOf(7)], ["arithmetic mean", "geometric mean", "harmonic mean", "quadratic mean", null]);
  equal("a trip of 50 miles at 24 mph takes 2 h 5 min: 125 minutes", Math.round((50 / 24) * 60), 125);
}

/* ------------------------------------------------------------ 2. the rules */
{
  equal("clamps", [C.clampN(1), C.clampN(99), C.clampN("12"), C.clampValue(0), C.clampValue(500), C.clampR(-99), C.clampR(99), C.clampR(3.4)], [2, 30, 12, 1, 100, -50, 50, 3]);
  const s = C.start({ random: rng(3) });
  equal("ten values to begin with, exponent 0", [s.values.length, s.r], [10, 0]);
  check("values are whole numbers 1..100", s.values.every((v) => Number.isInteger(v) && v >= 1 && v <= 100));
  const t = C.resize(s, 4), u = C.resize(s, 14, rng(5));
  equal("fewer: the first values are kept", t.values, s.values.slice(0, 4));
  equal("more: the old ones are kept and new ones added", [u.values.slice(0, 10), u.values.length], [s.values, 14]);
  equal("setValue clamps and keeps the rest", [C.setValue(s, 0, 1000).values[0], C.setValue(s, 0, 1000).values.slice(1)], [100, s.values.slice(1)]);
  equal("setValue refuses a missing bar", [C.setValue(s, 99, 5), C.setValue(s, 0, NaN)], [null, null]);
  equal("setExponent", [C.setExponent(s, 99).r, C.setExponent(s, -3).r, C.setExponent(s, "x")], [50, -3, null]);
  equal("the old position is untouched", s.values.length, 10);
}

/* -------- 3. a second version of the applet's DrawAverage, and the page's claims */
const second = (a, r) => {
  const n = a.length;
  if (r === 0) return Math.pow(a.reduce((p, x) => p * x, 1), 1 / n);
  return Math.pow(a.reduce((t, x) => t + Math.pow(x, r), 0) / n, 1 / r);
};
{
  const random = rng(2024);
  let nSets = 0, bad = { second: 0, bounds: 0, mono: 0, lemma: 0, amgm: 0, hm: 0, limit: 0 };
  for (let k = 0; k < 5000; k++) {
    const n = 2 + Math.floor(random() * 29);
    const a = Array.from({ length: n }, () => C.randomValue(random));
    nSets++;
    const lo = Math.min(...a), hi = Math.max(...a);
    let prev = -Infinity;
    for (let r = -50; r <= 50; r++) {
      const m = C.mean(a, r);
      if (m !== second(a, r)) bad.second++;
      if (m < lo - 1e-9 || m > hi + 1e-9) bad.bounds++;
      if (m < prev - 1e-9 * prev) bad.mono++;
      prev = m;
      if (r > 0 && r % 2 === 0 && !(m >= C.mean(a, r / 2) - 1e-9)) bad.lemma++;
    }
    const A = C.mean(a, 1), G = C.mean(a, 0), H = C.mean(a, -1);
    if (!(A >= G - 1e-9 && G >= H - 1e-9)) bad.amgm++;
    if (!close(H, 1 / C.mean(a.map((x) => 1 / x), 1))) bad.hm++;
    // the geometric mean is the limit r -> 0
    const eps = (M) => Math.abs(M - G) / G;
    if (!(eps(C.mean(a, 1e-4)) < 2e-3 && eps(C.mean(a, -1e-4)) < 2e-3)) bad.limit++;
  }
  equal(`${nSets} random sets: the applet's loop agrees with the second version at every exponent`, bad.second, 0);
  equal("M_r lies between the smallest and the largest number", bad.bounds, 0);
  equal("M_r never decreases as r grows from -50 to 50", bad.mono, 0);
  equal("the Lemma: M_r >= M_(r/2) for r > 0", bad.lemma, 0);
  equal("A >= G >= H", bad.amgm, 0);
  equal("H(a) = 1 / A(1/a)", bad.hm, 0);
  equal("M_r tends to the geometric mean as r goes to 0 (r = +-0.0001)", bad.limit, 0);
}

/* ---------------------------------------------- 4. equal numbers, strictness, extremes */
{
  equal("all numbers equal: every mean is that number", [-50, -1, 0, 1, 2, 50].every((r) => close(C.mean([7, 7, 7], r), 7)), true);
  check("unequal numbers: the means are strictly ordered", C.mean([1, 100], -1) < C.mean([1, 100], 0) && C.mean([1, 100], 0) < C.mean([1, 100], 1) && C.mean([1, 100], 1) < C.mean([1, 100], 2));
  const a = [3, 9, 27, 81];
  const f = Math.pow(4, 1 / 50);
  check("r = -50 is within a factor n^(1/50) above the minimum", C.mean(a, -50) >= 3 && C.mean(a, -50) <= 3 * f + 1e-9, String(C.mean(a, -50)));
  check("r = 50 is within a factor n^(1/50) below the maximum", C.mean(a, 50) <= 81 && C.mean(a, 50) >= 81 / f - 1e-9, String(C.mean(a, 50)));
}

/* ---------------------------------------------- 5. the printed value */
{
  equal("format: whole numbers get .0", [C.formatMean(25), C.formatMean(24)], ["25.0", "24.0"]);
  equal("format: float32 digits", [C.formatMean(1 / 3), C.formatMean(Math.sqrt(600))], ["0.33333334", "24.494898"]);
}

done("means");
