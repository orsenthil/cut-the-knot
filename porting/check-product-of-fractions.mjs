#!/usr/bin/env node
"use strict";

/*
 * Logic test for product-of-fractions/product-of-fractions-core.js.
 *
 *   node porting/check-product-of-fractions.mjs
 *
 * 1. The random start as the applet makes it, and the editing rules against
 *    a transcription of WorkOutValues and GetInt, for every value -2..101 on
 *    every starting pair p <= q up to 12.
 * 2. The page's claims for every pair of fractions with denominators up to
 *    20: the doubly coloured cells number pr of qs, pr/qs is the product,
 *    r/s = rq/sq, and simplifying keeps the values.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("product-of-fractions/product-of-fractions-core.js", "ProductOfFractionsCore");

/* ------------------------------------------------------ 1. start and editing */

{
  equal("random 0.5 gives q = 5, p = 3", C.start({ random: () => 0.5 }), { p: 3, q: 5, r: 3, s: 5 });
  let ok = true;
  for (let i = 0; i < 1000; i++) {
    const t = C.start({ random: () => i / 1000 });
    if (t.q < 1 || t.q > 9 || t.p < 1 || t.p > Math.max(1, t.q - 1)) ok = false;
  }
  check("a random start has q from 1 to 9 and p from 1 to q - 1 (1 when q = 1)", ok);

  const applet = (st, which, v) => {
    // GetInt: <= 0 -> 1, > 99 -> 99. Then the numerator/denominator fix-up.
    const g = v <= 0 ? 1 : v > 99 ? 99 : v;
    const o = { ...st, [which]: g };
    if (which === "p" && o.p > o.q) o.p = o.q;
    if (which === "q" && o.p > o.q) o.q = o.p;
    if (which === "r" && o.r > o.s) o.r = o.s;
    if (which === "s" && o.r > o.s) o.s = o.r;
    return o;
  };
  let cases = 0, same = 0;
  for (let q = 1; q <= 12; q++) for (let p = 1; p <= q; p++) for (const which of ["p", "q", "r", "s"]) for (let v = -2; v <= 101; v++) {
    const st = { p, q, r: p, s: q };
    cases++;
    if (JSON.stringify(C.set(st, which, v)) === JSON.stringify(applet(st, which, v))) same++;
  }
  check(`every edit matches the applet's rules (${cases} edits)`, same === cases);
  check("a numerator can equal its denominator", JSON.stringify(C.set({ p: 2, q: 5, r: 1, s: 1 }, "p", 5)) === JSON.stringify({ p: 5, q: 5, r: 1, s: 1 }));
  check("a bad edit is refused", C.set({ p: 1, q: 2, r: 1, s: 2 }, "x", 3) === null);
}

/* ------------------------------------------------------------- 2. the claims */

{
  let pairs = 0, cells = 0, value = 0, equiv = 0, simp = 0, smaller = 0;
  for (let q = 1; q <= 20; q++) for (let p = 1; p <= q; p++) for (let s = 1; s <= 20; s++) for (let r = 1; r <= s; r++) {
    pairs++;
    const st = { p, q, r, s };
    let both = 0, all = 0;
    for (let i = 0; i < q; i++) for (let j = 0; j < s; j++) { all++; if (C.cell(st, i, j).both) both++; }
    const pr = C.product(st);
    if (both === pr.n && all === pr.d) cells++;
    if (Math.abs(pr.n / pr.d - (p / q) * (r / s)) < 1e-15) value++;
    if ((r * q) * s === r * (s * q)) equiv++;
    if (pr.n * q <= p * pr.d && pr.n * s <= r * pr.d) smaller++;
    const t = C.simplify(st), red = C.reducedProduct(st);
    if (t.p * q === p * t.q && t.r * s === r * t.s && C.gcd(t.p, t.q) === 1 && C.gcd(t.r, t.s) === 1 && C.gcd(red.n, red.d) === 1 && red.n * pr.d === pr.n * red.d) simp++;
  }
  check(`the doubly coloured cells are pr of qs, for all ${pairs} pairs`, cells === pairs);
  check("pr/qs is the product of the values", value === pairs);
  check("r/s = rq/sq: r parts of s are rq parts of sq", equiv === pairs);
  check("simplifying keeps every value and leaves lowest terms", simp === pairs);
  check("taking a part of a part never gives more than either part: pr/qs <= p/q and <= r/s", smaller === pairs);
}

done("product-of-fractions");
