#!/usr/bin/env node
"use strict";

/*
 * Logic test for basel-problem/basel-problem-core.js.
 *
 *   node porting/check-basel-problem.mjs
 *
 * S(n) against exact fractions for n up to 40; the telescoping bound for every
 * n up to 10^5; the limit pi^2/6; that n times the error tends to 1; the
 * corrected estimate's error under 1/(12 n^3); and the even zeta values
 * against direct sums.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("basel-problem/basel-problem-core.js", "BaselProblemCore");
const close = (a, b, tol) => Math.abs(a - b) <= tol;

/* ------------------------------------------------------------ 1. the rules */
{
  equal("S(1) = 1", C.S(1), 1);
  check("S(2) = 5/4, S(3) = 49/36", close(C.S(2), 1.25, 1e-15) && close(C.S(3), 49 / 36, 1e-15));
  check("the target is pi^2/6 = 1.6449340668", close(C.TARGET, 1.6449340668482264, 1e-15));
  equal("n is clamped to 1..10^5", [C.clampN(0), C.clampN(1e9)], [1, 1e5]);
  const a = C.at(10);
  check("S(10) = 1.5497677...", close(a.sum, 1.5497677311665408, 1e-12));
  check("at(10): error 0.0951..., n times error 0.951...", close(a.error, 0.0951663356816856, 1e-12) && close(a.errorTimesN, 0.951663356816856, 1e-11));
}

/* ------------------------------------------- 2. every case, where it is small */
{
  // exact fractions for n up to 40
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let num = 0n, den = 1n, off = 0;
  for (let n = 1; n <= 40; n++) {
    const d = BigInt(n * n);
    num = num * d + den; den *= d;
    const g = gcd(num, den); num /= g; den /= g;
    if (!close(Number(num) / Number(den), C.S(n), 1e-13)) off++;
  }
  check("S(n) matches exact fractions for n = 1..40", off === 0);

  // telescoping bound, increasing, below the limit
  let bound = true, inc = true, below = true;
  let prev = 0;
  for (let n = 1; n <= 1e5; n++) {
    const cur = prev + 1 / (n * n); // running sum
    if (cur > C.telescoping(n) + 1e-12) bound = false;
    if (cur <= prev) inc = false;
    if (cur >= C.TARGET) below = false;
    prev = cur;
  }
  check("S(n) <= 2 - 1/n for every n up to 10^5 (the page's telescoping bound)", bound);
  check("S(n) increases and stays below pi^2/6 up to 10^5", inc && below);

  // the tail is about 1/n: n * error -> 1 from below
  let up = true, last = 0;
  for (const n of [1, 10, 100, 1000, 10000, 100000]) { const v = C.at(n).errorTimesN; if (!(v > last && v < 1)) up = false; last = v; }
  check("n times the error rises towards 1 (0.64, 0.95, 0.995, ...) along powers of ten", up, String(last));

  // the corrected estimate: error between 0 and 1/(12 n^3)... check |error| < 1/(12 n^3)
  let ok = true;
  for (let n = 1; n <= 20000; n += n < 200 ? 1 : 131) if (Math.abs(C.at(n).correctedError) > 1 / (12 * n ** 3) + 1e-13) ok = false;
  check("|pi^2/6 - (S(n) + 1/(n + 1/2))| < 1/(12 n^3) for n = 1..200 and beyond", ok);
  check("at n = 10 the corrected estimate is right to 5 digits, the plain sum to 1", Math.abs(C.at(10).correctedError) < 1e-4 && C.at(10).error > 0.09);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // zeta(2k) from the Bernoulli formula against direct sums of 1/n^(2k)
  const direct = (s) => { let t = 0; for (let n = 2e6; n >= 1; n--) t += Math.pow(n, -s); return t; };
  check("zeta(2) = pi^2/6", close(C.zetaEven(1), Math.PI ** 2 / 6, 1e-14));
  check("zeta(4) = pi^4/90", close(C.zetaEven(2), Math.PI ** 4 / 90, 1e-14));
  check("zeta(6) = pi^6/945", close(C.zetaEven(3), Math.PI ** 6 / 945, 1e-14));
  check("zeta(8) = pi^8/9450", close(C.zetaEven(4), Math.PI ** 8 / 9450, 1e-13));
  let ok = true;
  for (let k = 1; k <= 6; k++) if (!close(C.zetaEven(k), direct(2 * k), k === 1 ? 1e-6 : 1e-9)) ok = false; // the direct sum to 2e6 still misses a tail of about 5e-7 at s = 2
  check("zeta(2k) from Bernoulli numbers matches direct sums, k = 1..6", ok);
  let threw = false; try { C.zetaEven(7); } catch (e) { threw = true; }
  check("zetaEven refuses k outside 1..6", threw);
  const s = C.series(5000, 100);
  check("series ends at n and is increasing", s[s.length - 1].k === 5000 && s.every((p, i) => !i || p.sum > s[i - 1].sum));
}

done("basel-problem");
