#!/usr/bin/env node
"use strict";

/*
 * Logic test for prime-counting/prime-counting-core.js.
 *
 *   node porting/check-prime-counting.mjs
 *
 * pi(x) against known values and against trial division; Li against known
 * values; the prime number theorem's ratio creeping to 1; and the
 * Riemann-Hypothesis-sized error bound, checked for every x from 2657 to
 * the table's end (where it holds, as it should: it is proven under RH and
 * has been checked far beyond this range by others).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("prime-counting/prime-counting-core.js", "PrimeCountingCore");
const close = (a, b, tol) => Math.abs(a - b) <= tol;

/* ------------------------------------------------------------ 1. the rules */
{
  equal("pi(10) = 4", C.pi(10), 4);
  equal("pi(100) = 25", C.pi(100), 25);
  equal("pi(1000) = 168", C.pi(1000), 168);
  equal("pi(10^4) = 1229", C.pi(1e4), 1229);
  equal("pi(10^5) = 9592", C.pi(1e5), 9592);
  equal("pi(10^6) = 78498", C.pi(1e6), 78498);
  equal("pi(2) = 1, pi(3) = 2", [C.pi(2), C.pi(3)], [1, 2]);
  equal("x is clamped to 2..10^6", [C.clampX(1), C.clampX(1e9)], [2, 1e6]);
  // li(10^k) - li(2): known Li values 5.1, 17.6, 69.6, 245.2 ...
  check("Li(10^3) = 176.56...", close(C.Li(1e3), 176.5644, 1e-3), String(C.Li(1e3)));
  check("Li(10^6) = 78626.5...", close(C.Li(1e6), 78626.5, 0.1) || close(C.Li(1e6), 78627.5, 0.1), String(C.Li(1e6)));
  check("li(2) = 1.0451637801...", close(C.li(2), 1.0451637801174927, 1e-12));
  check("li(e) = 1.8951178163559...", close(C.li(Math.E), 1.8951178163559368, 1e-12));
  const a = C.at(1000);
  equal("at(1000) carries pi and the guesses", [a.pi, Math.round(a.xOverLn), Math.round(a.li)], [168, 145, 178]);
}

/* ------------------------------------------- 2. every case, where it is small */
{
  // pi against trial division for every x up to 20000
  const isPrime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
  let count = 0, bad = 0;
  for (let x = 2; x <= 20000; x++) { if (isPrime(x)) count++; if (C.pi(x) !== count) bad++; }
  check("pi(x) agrees with trial division for every x up to 20000", bad === 0);

  // Li overestimates pi for every x checked after the first few; x/ln x underestimates for x >= 17
  let liHigh = 0, gaussLow = 0, n = 0;
  for (let x = 20; x <= 1e6; x += 997) { n++; if (C.li(x) > C.pi(x)) liHigh++; if (C.xOverLn(x) < C.pi(x)) gaussLow++; }
  check(`li(x) > pi(x) at all ${n} sampled x from 20 to 10^6`, liHigh === n);
  check(`x/ln x < pi(x) at all ${n} sampled x from 20 to 10^6`, gaussLow === n);

  // the ratio pi(x) / (x / ln x) tends to 1 (slowly): decreasing along powers of ten
  let prev = Infinity, ok = true;
  for (const e of [3, 4, 5, 6]) { const r = C.pi(10 ** e) / C.xOverLn(10 ** e); if (!(r < prev)) ok = false; prev = r; }
  check("pi/(x/ln x) falls towards 1 along 10^3 .. 10^6 (it first rises from 10^2 to 10^3)", ok && prev > 1 && prev < 1.09, String(prev));

  // the RH-size bound for every x from 2657 to 10^6
  let worst = 0, viol = 0;
  for (let x = 2657; x <= C.MAX_X; x++) {
    const e = Math.abs(C.pi(x) - C.li(x)) / C.allowance(x);
    if (e > worst) worst = e;
    if (e >= 1) viol++;
  }
  check("|pi(x) - li(x)| < sqrt(x) ln(x) / (8 pi) for every x from 2657 to 10^6", viol === 0, `worst ratio ${worst}`);
  check("the true error uses a good share of that allowance somewhere (it is not far from tight)", worst > 0.05, `worst ${worst}`);

  // the Gauss guess x / ln x is far worse than that allowance
  check("x/ln x breaks the bound at x = 10^6", Math.abs(C.pi(1e6) - C.xOverLn(1e6)) > C.allowance(1e6));
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // li by direct numerical integration (Simpson), away from the singularity at 1: li(x) - li(2) = integral from 2 to x
  function simpson(f, a, b, n) { const h = (b - a) / n; let s = f(a) + f(b); for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2); return (s * h) / 3; }
  let ok = true;
  for (const x of [10, 50, 1000, 12345, 1e5, 1e6]) {
    const Lint = simpson((t) => 1 / Math.log(t), 2, x, 200000);
    if (!close(C.Li(x), Lint, 1e-5 * Lint)) ok = false;
  }
  check("Li(x) matches numerical integration of 1/ln t from 2 to x", ok);
  const s = C.series(5000, 100);
  check("series covers 2..max and is increasing", s[0].x === 2 && s[s.length - 1].x === 5000 && s.every((p, i) => !i || p.x > s[i - 1].x));
}

done("prime-counting");
