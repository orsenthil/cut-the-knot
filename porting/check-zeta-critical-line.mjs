#!/usr/bin/env node
"use strict";

/*
 * Logic test for zeta-critical-line/zeta-critical-line-core.js.
 *
 *   node porting/check-zeta-critical-line.mjs
 *
 * zeta against known values (real and complex), the first ten zeros against
 * their published ordinates, the count of zeros below t = 100 (29), that
 * |Z(t)| = |zeta(1/2 + i t)|, conjugate symmetry, and that over 0 < t < 100
 * the curve only reaches the origin on the line, and how near it gets grows with the distance from the line.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("zeta-critical-line/zeta-critical-line-core.js", "ZetaCriticalLineCore");
const close = (a, b, tol) => Math.abs(a - b) <= tol;

/* ------------------------------------------------------------ 1. the rules */
{
  check("zeta(2) = pi^2/6", close(C.zeta(2, 0)[0], Math.PI ** 2 / 6, 1e-12));
  check("zeta(1/2) = -1.4603545088", close(C.zeta(0.5, 0)[0], -1.4603545088095868, 1e-10));
  const z = C.zeta(1, 1);
  check("zeta(1 + i) = 0.58215806 - 0.92684856 i", close(z[0], 0.5821580597520036, 1e-10) && close(z[1], -0.9268485643308071, 1e-10), JSON.stringify(z));
  check("zeta(0) = -1/2 (the continuation)", close(C.zeta(0, 0)[0], -0.5, 1e-10));
  check("zeta(-1) = -1/12", close(C.zeta(-1, 0)[0], -1 / 12, 1e-10));
  equal("sigma is clamped to 0.05..0.95, t to 0..100", [C.clampSigma(0), C.clampSigma(2), C.clampT(-3), C.clampT(500)], [0.05, 0.95, 0, 100]);
  const a = C.at(0.5, 14.134725141734693);
  check("at the first zero the value is zero", a.abs < 1e-9, String(a.abs));
  equal("curve has points+1 samples starting at t = 0", [C.curve(0.5, 10, 50).length, C.curve(0.5, 10, 50)[0].t], [51, 0]);
}

/* ------------------------------------------- 2. every case, where it is small */
{
  const known = [14.134725141734693, 21.022039638771555, 25.010857580145688, 30.424876125859513, 32.935061587739189, 37.586178158825671, 40.918719012147495, 43.327073280914999, 48.005150881167160, 49.773832477672302];
  const zs = C.zeros(100);
  check("29 zeros with 0 < t < 100", zs.length === 29, String(zs.length));
  let ok = true;
  known.forEach((k, i) => { if (!close(zs[i], k, 1e-8)) ok = false; });
  check("the first ten zeros match the published values to 1e-8", ok, JSON.stringify(zs.slice(0, 10)));
  check("each zero has |zeta| < 1e-8", zs.every((t) => C.at(0.5, t).abs < 1e-8));
  check("the last zero below 100 is 98.8311942...", close(zs[28], 98.83119421819369, 1e-6), String(zs[28]));

  // |Z| = |zeta| along the line; conjugate symmetry zeta(sigma - i t) = conj zeta(sigma + i t)
  let bad = 0;
  for (let t = 8; t <= 100; t += 0.37) {
    if (!close(Math.abs(C.Z(t)), C.at(0.5, t).abs, 1e-9)) bad++;
    const p = C.zeta(0.5, t), q = C.zeta(0.5, -t);
    if (!close(p[0], q[0], 1e-10) || !close(p[1], -q[1], 1e-10)) bad++;
  }
  check("|Z(t)| = |zeta(1/2 + it)| and conjugate symmetry at 250 values of t", bad === 0);

  // off the line, no sample comes close to zero; on the line, the dips are far smaller
  const minOn = Math.min(...C.curve(0.5, 100, 4000).map((p) => p.abs));
  const gaps = [0.3, 0.4, 0.45, 0.55, 0.6, 0.7].map((s) => Math.min(...C.curve(s, 100, 4000).map((p) => p.abs)));
  check("the line's curve gets within 0.01 of the origin", minOn < 0.01, String(minOn));
  const [g30, g40, g45, g55, g60, g70] = gaps;
  check("away from the line the curve misses the origin: closest approach grows as sigma leaves 1/2 (t < 100)",
    g45 > minOn * 3 && g40 > g45 && g30 > g40 && g55 > minOn * 3 && g60 > g55 && g70 > g60, JSON.stringify(gaps));
  check("and it stays clear of zero: at least 0.03 at sigma 0.45 / 0.55, 0.07 at 0.4 / 0.6, 0.14 at 0.3 / 0.7",
    g45 > 0.03 && g55 > 0.03 && g40 > 0.07 && g60 > 0.07 && g30 > 0.14 && g70 > 0.14);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // The defining sum converges for sigma > 1: the Euler-Maclaurin value agrees with direct summation
  let ok = true;
  for (const [s, t] of [[2, 3], [1.5, 10], [3, -20]]) {
    let re = 0, im = 0;
    for (let n = 1; n <= 200000; n++) { const m = Math.pow(n, -s), ph = -t * Math.log(n); re += m * Math.cos(ph); im += m * Math.sin(ph); }
    const z = C.zeta(s, t);
    if (!close(z[0], re, 1e-3) || !close(z[1], im, 1e-3)) ok = false;
  }
  check("matches the plain sum of n^-s where it converges (sigma = 1.5 .. 3)", ok);
}

done("zeta-critical-line");
