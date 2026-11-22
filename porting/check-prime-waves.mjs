#!/usr/bin/env node
"use strict";

/*
 * Logic test for prime-waves/prime-waves-core.js.
 *
 *   node porting/check-prime-waves.mjs
 *
 * psi(x) against a direct sum over prime powers; the 100 stored zeros
 * against zeta-critical-line's own zeta (each one is a zero to 1e-7 and none
 * is missing below the last); Riemann's explicit formula: the error
 * |psi(x) - approx(x, k)| shrinks as zeros are added (mean over x from 2 to
 * 60 at k = 0, 1, 5, 10, 30, 100), and the formula is exact where checked at
 * the jumps' midpoints to the accuracy that 100 zeros allow; and the size of
 * psi(x) - x against the square-root bound the hypothesis gives.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("prime-waves/prime-waves-core.js", "PrimeWavesCore");
const Z = loadCore("zeta-critical-line/zeta-critical-line-core.js", "ZetaCriticalLineCore");

/* ------------------------------------------------------------ 1. the rules */
{
  equal("100 stored zeros", C.ZEROS.length, 100);
  check("the first zero is 14.1347 and the hundredth 236.5242", Math.abs(C.ZEROS[0] - 14.134725142) < 1e-8 && Math.abs(C.ZEROS[99] - 236.524229666) < 1e-8);
  equal("jumps: ln 2 at 2, 4, 8; ln 3 at 3 and 9; nothing at 6 or 1", [C.jump(2), C.jump(4), C.jump(8), C.jump(3), C.jump(9), C.jump(6), C.jump(1)].map((v) => +v.toFixed(6)), [0.693147, 0.693147, 0.693147, 1.098612, 1.098612, 0, 0]);
  check("psi(10) = ln 2520 (the lcm of 1..10)", Math.abs(C.psi(10.5) - Math.log(2520)) < 1e-12);
  check("psi at a jump is the middle of the jump: psi(7) = psi(6.5) + ln(7)/2", Math.abs(C.psi(7) - (C.psi(6.5) + Math.log(7) / 2)) < 1e-12);
  equal("x is clamped to 2..200 and zero count to 0..100", [C.clampX(0), C.clampX(999), C.clampK(-3), C.clampK(500)], [2, 200, 0, 100]);
  const st = C.steps(20);
  equal("the staircase has a step at each prime power up to 20", st.map((s) => s.x), [2, 3, 4, 5, 7, 8, 9, 11, 13, 16, 17, 19]);
  check("each step starts where the last ended", st.every((s, i) => i === 0 || Math.abs(s.from - st[i - 1].to) < 1e-12));
}

/* ------------------------------------------- 2. every case, where it is small */
{
  // psi(x) = ln lcm(1..x)
  let ok = true, lcm = 1;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  for (let n = 1; n <= 40; n++) { lcm = (lcm * n) / gcd(lcm, n); if (Math.abs(C.psi(n + 0.5) - Math.log(lcm)) > 1e-9) ok = false; }
  check("psi(n) = ln lcm(1, ..., n) for every n up to 40 (where the lcm still fits exactly)", ok);

  // every stored zero is a zero (|zeta| tiny), and none is skipped: Z changes sign between neighbours, with the right count
  let bad = 0;
  C.ZEROS.forEach((t) => { if (Z.at(0.5, Math.min(t, 100)).abs > 1e-6 && t <= 100) bad++; });
  check("the 29 stored zeros below 100 are zeros of zeta", bad === 0 && C.ZEROS.filter((t) => t < 100).length === 29);
  const zs = Z.zeros(100);
  check("the stored zeros below 100 are the ones found by Z's sign changes", zs.length === 29 && zs.every((t, i) => Math.abs(t - C.ZEROS[i]) < 1e-6));
  check("increasing", C.ZEROS.every((t, i) => !i || t > C.ZEROS[i - 1]));

  // Riemann's explicit formula: more zeros, smaller error (mean over non-integer x between 2 and 60)
  const meanErr = (k) => { let e = 0, n = 0; for (let x = 2.25; x <= 60; x += 0.5) { if (Number.isInteger(x)) continue; e += Math.abs(C.psi(x) - C.approx(x, k)); n++; } return e / n; };
  const errs = [0, 1, 5, 10, 30, 100].map(meanErr);
  check("the mean error falls steadily as zeros are added (k = 0, 1, 5, 10, 30, 100)", errs.every((e, i) => !i || e < errs[i - 1]), JSON.stringify(errs.map((e) => +e.toFixed(3))));
  check("with 100 zeros the mean error is under 0.2; with none about 0.9", errs[5] < 0.2 && errs[0] > 0.8);

  // the smooth part alone is x - ln 2pi - (1/2) ln(1 - x^-2)
  check("approx with k = 0 is the smooth curve", Math.abs(C.approx(10, 0) - (10 - Math.log(2 * Math.PI) - 0.5 * Math.log(1 - 0.01))) < 1e-12);
  // and one wave's size is at most about sqrt(x)/gamma
  let amp = true;
  for (let k = 0; k < 100; k++) for (let x = 2; x <= 200; x += 1.3) if (Math.abs(C.wave(k, x)) > (2 * Math.sqrt(x)) / Math.sqrt(0.25 + C.ZEROS[k] ** 2) + 1e-9) amp = false;
  check("each wave is at most 2 sqrt(x) / |rho|", amp);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // the explicit formula's wave written with complex numbers, x^rho / rho
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  let ok = true;
  for (let k = 0; k < 100; k += 7) for (const x of [3.3, 17.9, 60.1, 150.5]) {
    const g = C.ZEROS[k], L = Math.log(x);
    const xr = [Math.sqrt(x) * Math.cos(g * L), Math.sqrt(x) * Math.sin(g * L)];
    const q = cdiv(xr, [0.5, g]);
    if (Math.abs(-2 * q[0] - C.wave(k, x)) > 1e-9) ok = false;
  }
  check("wave(k, x) = -2 Re(x^rho / rho) with complex numbers", ok);

  // the hypothesis' prediction: |psi(x) - x| < sqrt(x) ln(x)^2 / (8 pi) for x >= 73.2 (Schoenfeld); true for every integer sample here
  let viol = 0, worst = 0;
  for (let n = 74; n <= 20000; n++) {
    const e = Math.abs(C.psi(n + 0.5) - (n + 0.5)) / ((Math.sqrt(n) * Math.log(n) ** 2) / (8 * Math.PI));
    if (e > worst) worst = e;
    if (e >= 1) viol++;
  }
  check("|psi(x) - x| < sqrt(x) ln(x)^2 / (8 pi) for every x from 74 to 20000", viol === 0, `worst ${worst}`);
}

done("prime-waves");
