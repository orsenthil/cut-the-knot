#!/usr/bin/env node
"use strict";

/*
 * Logic test for primes-from-triangle/primes-from-triangle-core.js.
 *
 *   node porting/check-primes-from-triangle.mjs
 *
 * 1. The options: visible rows 10..100 (20 to start), the finished picture,
 *    Clear and One step.
 * 2. The marks against a second transcription of the applet's OneStep (a
 *    Value grid with PRIME / EXTREME / ACTIVE), after every step 1..99.
 * 3. The page's claims, on all 5,050 dots: marked inside exactly when
 *    gcd(r, k) > 1, so prime rows stay clear; L and R keep the gcd;
 *    ancestors and descendants share it; the top progenitors theorem; the
 *    row-12 sibling example; and the "sieve in disguise" order.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("primes-from-triangle/primes-from-triangle-core.js", "PrimesFromTriangleCore");

/* ------------------------------------------------------------ 1. the options */

{
  const s = C.start({});
  check("20 visible rows and the finished picture to start", s.rows === 20 && s.step === 99);
  check("visible rows are kept in 10..100", C.start({ rows: 5 }).rows === 10 && C.start({ rows: 500 }).rows === 100);
  const c = C.clear(s);
  check("Clear leaves only the edges marked", c.step === 1 && C.marks(c.step).every((row, r) => row.every((m, k) => m === (k === 0 || k === r))));
  check("One step goes one row at a time and stops at 99", C.oneStep(c).step === 2 && C.oneStep(s).step === 99);
  check("(0, 0) has no siblings (the applet looped forever on it)", C.siblings(0, 0).length === 0);
}

/* ------------------------------------------------ 2. against the applet's OneStep */

{
  const PRIME = 0, EXTREME = 1, ACTIVE = 2, Max = 100;
  const T = [];
  for (let i = 0; i < Max; i++) { T.push([]); for (let j = 0; j <= i; j++) T[i].push(j === 0 || j === i ? EXTREME : PRIME); }
  let CurrentRow = 1, agree = 0;
  for (let step = 2; step <= 100; step++) {
    CurrentRow++;
    for (let L1 = 1; L1 <= CurrentRow && CurrentRow < Max; L1++) {
      const v = T[CurrentRow][L1];
      if (v === EXTREME || v === ACTIVE) {
        const L2 = CurrentRow + L1;
        if (L2 < Max) { T[L2][L1] = ACTIVE; T[L2][L2 - L1] = ACTIVE; }
      }
    }
    const mine = C.marks(Math.min(step, 99));
    if (T.every((row, r) => row.every((v, k) => (v !== PRIME) === mine[r][k]))) agree++;
  }
  check("the marks match the applet's OneStep after every one of its 99 calls", agree === 99);
}

/* ------------------------------------------------------------- 3. the claims */

{
  const m = C.marks(99);
  let gcdRule = true, primeRows = true;
  for (let r = 0; r < 100; r++) for (let k = 1; k < r; k++) if (m[r][k] !== (C.gcd(r, k) > 1)) gcdRule = false;
  for (let r = 2; r < 100; r++) if (C.isPrime(r) && m[r].slice(1, -1).some(Boolean)) primeRows = false;
  check("inside the triangle a dot ends up marked exactly when gcd(r, k) > 1 (all 5,050 dots)", gcdRule);
  check("the prime rows stay clear, and every other row from 4 on has a mark", primeRows && [...Array(100).keys()].filter((r) => r >= 4 && !C.isPrime(r)).every((r) => m[r].slice(1, -1).some(Boolean)));

  let keep = true, family = true, theorem = true;
  for (let r = 2; r < 100; r++) for (let k = 1; k < r; k++) {
    const g = C.gcd(r, k);
    if (C.gcd(r + k, k) !== g || C.gcd(2 * r - k, r) !== g) keep = false;
    for (const [i, j] of [...C.ancestors(r, k), ...C.descendants(r, k)]) if (C.gcd(i, j) !== g) family = false;
    // Climb with L^-1 when k <= r/2, else R^-1, to the top: the theorem's progenitors.
    let a = r, b = k;
    for (;;) {
      if (2 * b < a && a - b > 1) { a = a - b; continue; }
      if (2 * b > a && b > 1 && 2 * b - a < b) { [a, b] = [b, 2 * b - a]; continue; }
      break;
    }
    const tops = C.progenitors(r, k).map((p) => p.join());
    const reached = g > 1 ? (a === 2 * g && b === g) || tops.includes(`${a},${b}`) : `${a},${b}` === "2,1";
    if (!reached) theorem = false;
  }
  check("L and R keep the gcd", keep);
  check("every ancestor and descendant of a dot shares its gcd", family);
  check("climbing up always ends at the theorem's top progenitors (via (2g, g) for g > 1)", theorem);

  const groups = new Set();
  for (let k = 1; k < 12; k++) if (C.gcd(12, k) > 1) groups.add(C.gcd(12, k));
  equal("row 12 has four sibling groups, gcd 2, 3, 4, 6", [...groups].sort((a, b) => a - b), [2, 3, 4, 6]);
  const s6 = C.siblings(12, 6).map((p) => p[1]);
  check("(12, 6)'s siblings by its own gcd 6 are (12, 0), (12, 6), (12, 12)", s6.join() === "0,6,12");

  // The sieve in disguise: process rows divisible by 2, then 3, then 5, ... and get the same picture.
  const sieve = [];
  for (let r = 0; r < 100; r++) { sieve.push(new Array(r + 1).fill(false)); sieve[r][0] = sieve[r][r] = true; }
  const order = [];
  for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]) for (let r = p; r < 100; r += p) if (!order.includes(r)) order.push(r);
  // Rows taken out of order can be processed before all their marks arrive, so repeat to the end.
  for (let changed = true; changed;) {
    changed = false;
    for (const r of order) for (let k = 1; k <= r; k++) if (sieve[r][k] && r + k < 100 && !(sieve[r + k][k] && sieve[r + k][r])) { sieve[r + k][k] = true; sieve[r + k][r] = true; changed = true; }
  }
  check("processing rows by prime factors, as in the sieve, gives the same picture", sieve.every((row, r) => row.every((v, k) => v === m[r][k])));
}

done("primes-from-triangle");
