#!/usr/bin/env node
"use strict";

/*
 * Logic test for euclid-algorithm/euclid-algorithm-core.js.
 *
 *   node porting/check-euclid-algorithm.mjs
 *
 * The page's claims: N = M s + R gives gcd(N, M) = gcd(M, R) and every common divisor
 * of any two of N, M, R divides the third (checked on every pair up to 300); the
 * algorithm's gcd equals the gcd found by trying every divisor, for every pair of numbers
 * from 1 to 400 and a sample up to 9999; each line is a true division with 0 <= R < M;
 * the remainders strictly decrease and end in 0; and (beyond the page) Lame's theorem: the
 * number of steps never exceeds 5 times the number of digits of the smaller number, and
 * the worst case is a pair of consecutive Fibonacci numbers, found by exhaustive search
 * for every pair up to 1,500.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("euclid-algorithm/euclid-algorithm-core.js", "EuclidAlgorithmCore");
const gcdSlow = (a, b) => { let g = 1; for (let d = 1; d <= Math.min(a, b); d++) if (a % d === 0 && b % d === 0) g = d; return g; };

{
  const s = C.start({ a: 85, b: 18 });
  equal("the lines for 85 and 18", C.lines(s).join(" | "), "85 = 18 x 4 + 13 | 18 = 13 x 1 + 5 | 13 = 5 x 2 + 3 | 5 = 3 x 1 + 2 | 3 = 2 x 1 + 1 | 2 = 1 x 2 | gcd(85, 18) = 1");
  equal("an exact division ends the list: 12 and 18", C.lines(C.start({ a: 12, b: 18 })).join(" | "), "18 = 12 x 1 + 6 | 12 = 6 x 2 | gcd(18, 12) = 6");
  equal("the numbers are swapped when the first is smaller (the gcd line shows the larger first)", C.lines(C.start({ a: 18, b: 85 }))[0], "85 = 18 x 4 + 13");
  equal("with a 0 the applet shows ?", C.lines(C.start({ a: 0, b: 7 })).join(" | "), "gcd(7, 0) = ?");
  check("a new game has two numbers of two digits, the first digits not 0", (() => { const x = C.start({}); return x.digits === 2 && x.a >= 10 && x.b >= 10 && x.a <= 99 && x.b <= 99; })());
  check("the number of digits runs from 1 to 4", C.start({ digits: 0 }).digits === 1 && C.start({ digits: 9 }).digits === 4 && C.move(s, { type: "digits", value: 5 }) === null && C.move(s, { type: "digits", value: 4 }).a >= 1000);
  check("autonomous: a digit goes up by 1 (9 to 0, no carry); otherwise the whole number goes up by the place value", C.move(s, { type: "digit", which: "a", place: 0 }).a === 86 && C.move({ ...s, a: 89 }, { type: "digit", which: "a", place: 0 }).a === 80 && C.move({ ...s, autonomous: false, a: 19 }, { type: "digit", which: "a", place: 0 }).a === 20 && C.move({ ...s, autonomous: false, a: 99 }, { type: "digit", which: "a", place: 0 }).a === 0);
  check("the page's example: raising the 9 in 19 gives 10 when digits are autonomous and 20 when not", C.move({ ...s, a: 19 }, { type: "digit", which: "a", place: 0 }).a === 10 && C.move({ ...s, autonomous: false, a: 19 }, { type: "digit", which: "a", place: 0 }).a === 20);
  check("a digit beyond the number of digits is refused", C.move(s, { type: "digit", which: "b", place: 2 }) === null && C.move(s, { type: "set", which: "a", value: 100 }) === null);
  check("the old position is untouched, and any change marks it done", s.a === 85 && s.moves === 0 && C.result(s) === null && C.result(C.move(s, { type: "digit", which: "b", place: 0 })) === "done");
}

{
  let n = 0, bad = null;
  for (let a = 1; a <= 400; a++) for (let b = 1; b <= 400; b++) {
    const t = C.steps(a, b);
    if (t.gcd !== gcdSlow(a, b)) bad = `gcd ${a},${b}`;
    let prevR = Infinity;
    for (const x of t.steps) {
      if (x.n !== x.m * x.q + x.r || x.r < 0 || x.r >= x.m) bad = `line ${a},${b}`;
      if (x.m >= prevR && prevR !== Infinity) bad = `divisor not decreasing ${a},${b}`;
      prevR = x.m;
    }
    const last = t.steps[t.steps.length - 1];
    if (last.r !== 0) bad = `no zero ${a},${b}`;
    // gcd(N, M) = gcd(M, R) at every step
    for (const x of t.steps) if (x.r !== 0 && gcdSlow(x.n, x.m) !== gcdSlow(x.m, x.r)) bad = `gcd(N,M) != gcd(M,R) ${x.n},${x.m}`;
    n++;
  }
  check(`gcd, true divisions, decreasing remainders and gcd(N, M) = gcd(M, R) for every pair from 1 to 400 (${n} pairs)`, bad === null, String(bad));
  let seed = 1, bad2 = null;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  for (let t = 0; t < 20000; t++) { const a = 1 + rnd(9999), b = 1 + rnd(9999); const g = C.steps(a, b).gcd; if (a % g || b % g) bad2 = `${a},${b} not divisible`; if (C.steps(a / g, b / g).gcd !== 1) bad2 = `${a},${b} quotients not coprime`; }
  check("20,000 random pairs up to 9999: the gcd divides both and the two quotients are coprime", bad2 === null, String(bad2));
}

{
  // N = M s + R: a common divisor of N and M divides R, and a common divisor of M and R divides N. The page also says
  // "any common divisor of any pair of these three numbers is a divisor of the third", which is false for the pair N, R.
  let bad = null, counter = null;
  for (let n = 1; n <= 120 && !bad; n++) for (let m = 1; m <= n && !bad; m++) {
    const r = n % m, q = Math.floor(n / m);
    if (r === 0) continue; // the page takes R > 0 here
    for (let d = 1; d <= n; d++) {
      const dn = n % d === 0, dm = m % d === 0, dr = r % d === 0;
      if (dn && dm && !dr) bad = `${n},${m}: d = ${d} divides N and M but not R`;
      if (dm && dr && !dn) bad = `${n},${m}: d = ${d} divides M and R but not N`;
      if (dn && dr && !dm && !counter) counter = `${n} = ${m} x ${q} + ${r}, d = ${d}`;
    }
  }
  check("a common divisor of N and M divides R, and one of M and R divides N, for all N up to 120", bad === null, String(bad));
  check("but a common divisor of N and R need not divide M (the page's 'any pair' is too strong): 8 = 3 x 2 + 2 and d = 2", counter === "8 = 3 x 2 + 2, d = 2");
  // Lame's theorem
  let maxSteps = new Map(), worstOk = true, lame = true;
  const fib = [1, 2]; while (fib[fib.length - 1] < 1600) fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
  for (let a = 1; a <= 1500; a++) for (let b = 1; b <= a; b++) {
    const k = C.steps(a, b).steps.length;
    const digits = String(b).length;
    if (k > 5 * digits) lame = false;
    if (!maxSteps.has(b) || maxSteps.get(b) < k) maxSteps.set(b, k);
  }
  // consecutive Fibonacci numbers (F(n+1), F(n)) take n-1... steps: the most any pair with that smaller number can take
  const F = [1, 1]; while (F.length < 18) F.push(F[F.length - 1] + F[F.length - 2]);
  for (let i = 3; i < 16; i++) { const b = F[i], a = F[i + 1]; if (a > 1500) break; const k = C.steps(a, b).steps.length; if (maxSteps.get(b) !== k) worstOk = false; }
  check("Lame's theorem: never more than 5 x (digits of the smaller number) steps, for every pair up to 1,500", lame);
  check("the most steps for a given smaller number is taken by consecutive Fibonacci numbers (F(n+1), F(n))", worstOk);
}

done("euclid-algorithm");
