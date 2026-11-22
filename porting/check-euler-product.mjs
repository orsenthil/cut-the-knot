#!/usr/bin/env node
"use strict";

/*
 * Logic test for euler-product/euler-product-core.js.
 *
 *   node porting/check-euler-product.mjs
 *
 * Checks zeta against known values, that the sum and the product over primes
 * agree, the finite form of Euler's identity (the product over primes up to P
 * equals the sum over the numbers built from those primes), and that at s = 1
 * both grow without limit and at the same speed (Mertens).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("euler-product/euler-product-core.js", "EulerProductCore");
const close = (a, b, tol) => Math.abs(a - b) <= tol;

/* ------------------------------------------------------------ 1. the rules */
{
  equal("primes up to 30", C.primesUpTo(30), [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  equal("no primes below 2", C.primesUpTo(1), []);
  check("zeta(2) = pi^2/6", close(C.zeta(2), Math.PI ** 2 / 6, 1e-12));
  check("zeta(4) = pi^4/90", close(C.zeta(4), Math.PI ** 4 / 90, 1e-12));
  check("zeta(3) = 1.2020569031595942", close(C.zeta(3), 1.2020569031595942, 1e-12));
  check("zeta(1.5) = 2.612375348685488", close(C.zeta(1.5), 2.612375348685488, 1e-11));
  check("zeta(1.05) = 20.5808844...", close(C.zeta(1.05), 20.58084442, 1e-4));
  equal("s is clamped to 1..4", [C.clampS(0), C.clampS(9)], [1, 4]);
  const a = C.analyze({ s: 2, n: 10 });
  check("the sum and the product have one value per n", a.sums.length === 10 && a.prods.length === 10);
  equal("4 primes up to 10", a.primeCount, 4);
  check("limit is zeta(2)", close(a.limit, Math.PI ** 2 / 6, 1e-12));
  check("no limit at s = 1", C.analyze({ s: 1, n: 10 }).limit === null);
}

/* ------------------------------------------- 2. every case, where it is small */
{
  // for each s in a grid, sum and product both rise towards zeta(s) and stay below it
  let bad = 0, cases = 0;
  for (let s = 1.5; s <= 4; s += 0.25) {
    const a = C.analyze({ s, n: 2000 });
    for (let k = 1; k < 2000; k++) {
      cases++;
      if (a.sums[k] < a.sums[k - 1] || a.prods[k] < a.prods[k - 1]) bad++;
      if (a.sums[k] > a.limit + 1e-12 || a.prods[k] > a.limit + 1e-12) bad++;
    }
    if (!close(a.sum, a.limit, a.limit)) bad++;
  }
  check(`both rise and stay below zeta(s): ${cases} steps over s = 1.5..4`, bad === 0);

  // at s = 3, 2000 terms are within 1/(2*2000^2) of zeta (integral bound)
  const a3 = C.analyze({ s: 3, n: 2000 });
  check("sum within 1e-6 of zeta(3) at n = 2000", close(a3.sum, a3.limit, 1e-6));
  check("product within 1e-6 of zeta(3) at n = 2000", close(a3.product, a3.limit, 1e-6));

  // finite Euler identity: product over p <= P of 1/(1-p^-s) = sum of n^-s over n whose prime factors are all <= P
  for (const [s, P] of [[2, 7], [3, 13], [2, 5]]) {
    const primes = C.primesUpTo(P);
    const M = 2e6;
    let smooth = 0;
    for (let n = 1; n <= M; n++) {
      let m = n;
      for (const p of primes) while (m % p === 0) m /= p;
      if (m === 1) smooth += Math.pow(n, -s);
    }
    check(`product over primes <= ${P} = sum over ${P}-smooth numbers, s = ${s}`, close(smooth, C.partialProduct(s, P), 1e-6), `${smooth} vs ${C.partialProduct(s, P)}`);
  }
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // partial results agree with the direct definitions
  const s = 2.5, n = 500;
  const a = C.analyze({ s, n });
  check("analyze().sum equals partialSum", close(a.sum, C.partialSum(s, n), 1e-12));
  check("analyze().product equals partialProduct", close(a.product, C.partialProduct(s, n), 1e-12));

  // s = 1: the sum is the harmonic series, the product the same growth: sum ~ ln n + gamma, product ~ e^gamma ln n (Mertens)
  const gamma = 0.5772156649015329;
  const h = C.analyze({ s: 1, n: 2000 });
  check("harmonic sum ~ ln n + gamma at n = 2000", close(h.sum, Math.log(2000) + gamma, 1e-3));
  check("both diverge: still growing at 2000", h.sum > h.sums[1000] && h.product > h.prods[1000]);
  const ratio = C.partialProduct(1, 1e6) / (Math.exp(gamma) * Math.log(1e6));
  check("product over primes <= 1e6 is e^gamma ln(1e6) to within 0.1%", close(ratio, 1, 1e-3), String(ratio));
}

done("euler-product");
