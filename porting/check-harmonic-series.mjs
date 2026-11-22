#!/usr/bin/env node
"use strict";

/*
 * Logic test for harmonic-series/harmonic-series-core.js.
 *
 *   node porting/check-harmonic-series.mjs
 *
 * H(n) against exact fractions (BigInt) for n up to 300, including that H(n)
 * is never a whole number for n > 1; Oresme's blocks (each at least 1/2, so
 * H(2^k) >= 1 + k/2) for every k to 19; the first n that passes 1, 2, 3, ...
 * against the known values; and H(n) - ln n - gamma squeezed between
 * 1/(2n+2) and 1/(2n).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("harmonic-series/harmonic-series-core.js", "HarmonicSeriesCore");
const close = (a, b, tol) => Math.abs(a - b) <= tol;

/* ------------------------------------------------------------ 1. the rules */
{
  equal("H(1) = 1", C.H(1), 1);
  check("H(2) = 3/2, H(3) = 11/6, H(4) = 25/12", close(C.H(2), 1.5, 1e-15) && close(C.H(3), 11 / 6, 1e-15) && close(C.H(4), 25 / 12, 1e-15));
  check("H(10) = 7381/2520", close(C.H(10), 7381 / 2520, 1e-14));
  equal("n is clamped to 1..10^6", [C.clampN(0), C.clampN(1e9)], [1, 1e6]);
  check("a million terms give 14.3927...", close(C.H(1e6), 14.392726722865724, 1e-9));
  const a = C.at(1000);
  check("at(1000): sum 7.4854..., estimate within 0.0006", close(a.sum, 7.485470860550345, 1e-9) && Math.abs(a.gap) < 6e-4);
  equal("at(1000) fits 9 whole blocks", a.blocks, 9);
}

/* ------------------------------------------- 2. every case, where it is small */
{
  // exact fractions: H(n) never an integer for n > 1, and the float agrees
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let num = 0n, den = 1n, integers = 0, off = 0;
  for (let n = 1; n <= 300; n++) {
    num = num * BigInt(n) + den; den = den * BigInt(n);
    const g = gcd(num, den); num /= g; den /= g;
    if (n > 1 && den === 1n) integers++;
    if (!close(Number(num) / Number(den), C.H(n), 1e-12)) off++;
  }
  check("H(n) is not a whole number for 2 <= n <= 300", integers === 0);
  check("H(n) matches exact fractions for n up to 300", off === 0);

  // Oresme: each block at least 1/2, H(2^k) >= 1 + k/2 (k = 1..19)
  let blocksOk = true, boundOk = true, total = 1;
  for (let k = 1; k <= 19; k++) {
    const b = C.block(k);
    total += b;
    if (b < 0.5 - 1e-15) blocksOk = false;
    if (!close(total, C.H(2 ** k), 1e-9) || C.H(2 ** k) < 1 + k / 2) boundOk = false;
  }
  check("every Oresme block is at least 1/2 (k = 1..19)", blocksOk);
  check("H(2^k) = 1 + the blocks, and >= 1 + k/2 (k = 1..19)", boundOk);
  check("block 1 is exactly 1/2 and block 2 is 1/3 + 1/4", C.block(1) === 0.5 && close(C.block(2), 1 / 3 + 1 / 4, 1e-15));

  // terms needed to pass m
  const known = { 1: 2, 2: 4, 3: 11, 4: 31, 5: 83, 6: 227, 7: 616, 8: 1674, 9: 4550, 10: 12367 };
  let ok = true;
  for (const [m, n] of Object.entries(known)) if (C.termsToPass(Number(m)) !== n) ok = false;
  check("first n with H(n) > m is 2, 4, 11, 31, 83, 227, 616, 1674, 4550, 12367 for m = 1..10", ok);
  check("a million terms do not pass 15", C.termsToPass(15) === null);
  equal("at() lists those targets", C.at(5).toPass.map((p) => p.terms).slice(0, 4), [2, 4, 11, 31]);
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // H(n) - ln n - gamma lies in (1/(2n+2), 1/(2n)) for n >= 1
  let bad = 0;
  for (let n = 1; n <= 1e6; n += n < 2000 ? 1 : 997) {
    const g = C.H(n) - Math.log(n) - C.EULER_GAMMA;
    if (!(g > 1 / (2 * n + 2) - 1e-12 && g < 1 / (2 * n) + 1e-12)) bad++;
  }
  check("1/(2n+2) < H(n) - ln n - gamma < 1/(2n) for n up to 10^6 (sampled past 2000)", bad === 0);
  // the series is increasing without bound: every doubling adds close to ln 2
  let steps = true;
  for (let k = 1; k < 19; k++) if (!close(C.H(2 ** (k + 1)) - C.H(2 ** k), Math.LN2, 1 / 2 ** k)) steps = false;
  check("each doubling of n adds about ln 2 (0.693) to H(n)", steps);
  const s = C.series(1e5, 120);
  check("series starts at n = 1, ends at 10^5, increases", s[0].n === 1 && s[s.length - 1].n === 1e5 && s.every((p, i) => !i || (p.n > s[i - 1].n && p.sum > s[i - 1].sum)));
  check("the Oresme line stays under the sum in every sample", s.every((p) => p.oresme <= p.sum));
}

done("harmonic-series");
