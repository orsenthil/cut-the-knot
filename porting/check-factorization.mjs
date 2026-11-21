#!/usr/bin/env node
"use strict";

/*
 * Logic test for factorization/factorization-core.js.
 *
 *   node porting/check-factorization.mjs
 *
 * The factorization of EVERY number from 2 to 300,000 is checked: the primes are really
 * prime (trial division), the factors multiply back, in increasing order; and numbers up
 * to the page's 7,000,000,000 (the largest ones, squares of primes, primorials and 2,000
 * random ones) multiply back as well. The page's claims: the lcm takes the larger
 * exponent and the gcd the smaller (compared with Euclid's algorithm and with
 * M N / gcd for every pair from 1 to 400, and for 20,000 random pairs up to 7e9), and
 * gcd x lcm = M x N. The product parser follows MultiplicationParser: "*" only, any
 * other text gives 0.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("factorization/factorization-core.js", "FactorizationCore");
const gcd = (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; };
const isPrime = (p) => { if (p < 2) return false; for (let d = 2; d * d <= p; d++) if (p % d === 0) return false; return true; };

{
  equal("parse a plain number", C.parse("360"), 360);
  equal("parse a product", C.parse("12*5*7"), 420);
  equal("parse ignores blanks", C.parse(" 2 * 3 * 7 "), 42);
  equal("a letter gives 0", C.parse("12x5"), 0);
  equal("an empty text gives 0", C.parse(""), 0);
  equal("a trailing * gives 0", C.parse("12*"), 0);
  equal("a minus sign gives 0", C.parse("-4"), 0);
  equal("a decimal point gives 0", C.parse("1.5"), 0);
  equal("a product above 7,000,000,000 gives 0", C.parse("70001*100000"), 0);
  equal("7,000,000,000 itself is allowed", C.parse("7000000000"), 7000000000);
  equal("short form", C.show(360, true), "2^3 x 3^2 x 5");
  equal("long form", C.show(360, false), "2 x 2 x 2 x 3 x 3 x 5");
  equal("1 and 0", C.show(1, true) + "|" + C.show(0, false), "1|0");
  equal("a prime is itself", C.show(97, true), "97");
  const s = C.start({});
  check("the page opens on 360 and 84, not yet computed", s.n1 === 360 && s.n2 === 84 && s.computed === false && C.result(s) === null);
  const t = C.move(s, { type: "compute", t1: "12*5", t2: "x" });
  check("Compute reads the products and shows an unreadable text as 0 (as the applet writes 0 back)", t.n1 === 60 && t.n2 === 0 && t.t1 === "60" && t.t2 === "0" && C.result(t) === "done");
  check("the old position is untouched", s.n1 === 360 && s.moves === 0);
  check("the format can be switched without computing again", C.move(s, { type: "format", brief: false }).brief === false);
}

{
  let bad = null;
  for (let n = 2; n <= 300000 && !bad; n++) {
    const f = C.factor(n);
    let prod = 1, last = 0;
    for (const [p, e] of f) { prod *= Math.pow(p, e); if (p <= last || e < 1) bad = `order ${n}`; last = p; if (n < 20000 && !isPrime(p)) bad = `composite factor ${p} of ${n}`; }
    if (prod !== n) bad = `product ${n}`;
  }
  check("the factorization of every n from 2 to 300,000 multiplies back, with increasing primes (and the primes are prime, checked for n < 20,000)", bad === null, String(bad));
  let seed = 11, bad2 = null;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  const big = [6999999999, 7000000000, 6983776800, 4294967296, 2147483647, 83497 * 83497, 83591 * 83591, 2 * 3 * 5 * 7 * 11 * 13 * 17 * 19 * 23, 6469693230];
  for (let t = 0; t < 2000; t++) big.push(5000000000 + rnd(2000000000));
  for (const n of big) {
    if (n > C.LIMIT) continue;
    const f = C.factor(n);
    let prod = 1; for (const [p, e] of f) prod *= Math.pow(p, e);
    if (prod !== n) bad2 = `product ${n}`;
    if (!f.every(([p]) => isPrime(p))) bad2 = `composite factor in ${n}`;
  }
  check(`${big.length} numbers up to 7,000,000,000 factor correctly, with prime factors`, bad2 === null, String(bad2));
}

{
  let n = 0, bad = null;
  for (let a = 1; a <= 400; a++) for (let b = 1; b <= 400; b++) {
    const c = C.compare(a, b);
    if (c.gcd !== gcd(a, b)) bad = `gcd ${a},${b}`;
    if (c.lcm !== (a * b) / gcd(a, b)) bad = `lcm ${a},${b}`;
    if (c.gcd * c.lcm !== a * b) bad = `gcd x lcm ${a},${b}`;
    for (const r of c.rows) { if (r.min !== Math.min(r.e1, r.e2) || r.max !== Math.max(r.e1, r.e2) || r.min + r.max !== r.e1 + r.e2) bad = `exponents ${a},${b}`; }
    n++;
  }
  check(`gcd takes the smaller and lcm the larger exponent: agrees with Euclid and MN/gcd, and gcd x lcm = MN, for every pair from 1 to 400 (${n})`, bad === null, String(bad));
  let seed = 5, bad2 = null;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  for (let t = 0; t < 20000; t++) {
    const a = 1 + rnd(2000000000), b = 1 + rnd(3000), g = gcd(a, b);
    const c = C.compare(a, b);
    if (c.gcd !== g || c.lcm !== (a / g) * b) bad2 = `${a},${b}`;
  }
  check("20,000 random pairs with a number up to 2,000,000,000: the same", bad2 === null, String(bad2));
  const huge = C.compare(6999999999, 7000000000);
  check("the lcm of two numbers near 7e9 is exact (BigInt): 6999999999 x 7000000000, and gcd x lcm = MN", huge.lcmBig === 6999999999n * 7000000000n && huge.gcdBig === 1n && huge.gcdBig * huge.lcmBig === 6999999999n * 7000000000n);
  const z = C.compare(0, 12);
  check("with a 0 there is no gcd or lcm to show", z.gcd === null && z.lcm === null);
}

done("factorization");
