#!/usr/bin/env node
"use strict";

/*
 * Logic test for common-multiples/common-multiples-core.js (applet "CommonMultiples").
 *
 *   node porting/check-common-multiples.mjs
 *
 * This is a demonstration, so there is no opponent or win condition. What is
 * checked instead:
 *
 *  1. the start position, the two dots' ranges, snapping, illegal and no-op
 *     moves, and "done" once the picture has been explored;
 *  2. the applet's own methods transcribed a second time, straight from the
 *     bytecode, and compared to the core over the whole parameter space:
 *     GCD.gcd, the blue-dot formula p*q/GCD.gcd(p,q) in Draw(), Snap(), and
 *     the exact multiples loop in Draw() (including its one-past-the-window
 *     quirk);
 *  3. every claim on the cut-the-knot page, exhaustively: lcm = p*q/gcd,
 *     P|Q iff lcm(P,Q)=Q (Theorem 1), P|R and Q|R imply lcm(P,Q)|R (Theorem 2),
 *     the lcm is the least common multiple, common multiples are multiples of
 *     it, and 5k includes negative multiples and zero;
 *  4. the drawn axis, tick spacing, spoken messages, plain-JSON positions,
 *     and the harmless applet/page difference in which dot starts at 2.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("common-multiples/common-multiples-core.js", "CommonMultiplesCore");

/* ----------------------------------------- 1. positions, options and moves */

{
  const s = C.start({});
  equal("a new picture starts at P=2, Q=3", [s.p, s.q], [2, 3]);
  equal("the core's control range is 1..50", [C.MIN_VALUE, C.MAX_VALUE], [1, 50]);
  equal("a new picture has no moves and is unexplored", [s.moves, s.explored], [0, false]);
  check("the demo is not finished before it is touched", C.result(s) === null);
  check("the demo is finished once explored", C.result(C.setP(s, 4)) === "done");
  check("explored() agrees with result()", C.explored(C.setQ(s, 4)) && !C.explored(s));

  check("setP changes only P", C.setP(s, 7).p === 7 && C.setP(s, 7).q === 3);
  check("setQ changes only Q", C.setQ(s, 7).q === 7 && C.setQ(s, 7).p === 2);
  check("a move counts one step", C.setP(C.setQ(s, 5), 4).moves === 2);
  check("a no-op move leaves the position alone", C.setP(s, 2) === s);
  check("an unknown dot is refused", C.move(s, { which: "r", value: 4 }) === null);
  check("a non-numeric value is refused", C.move(s, { which: "p", value: "many" }) === null);
  check("a value below 1 snaps up to 1", C.setP(s, -30).p === 1);
  check("zero snaps up to 1", C.setQ(s, 0).q === 1);
  check("a value above 50 snaps down to 50", C.setQ(s, 999).q === 50);
  check("a fraction is rounded", C.setP(s, 4.6).p === 5 && C.setP(s, 4.4).p === 4);
  check("start({p,q}) honours the controls", C.start({ p: 6, q: 9 }).p === 6 && C.start({ p: 6, q: 9 }).q === 9);
  check("start clamps its options too", C.start({ p: -5, q: 80 }).p === 1 && C.start({ p: -5, q: 80 }).q === 50);
  check("the core does not mutate its input", s.p === 2 && s.q === 3 && s.moves === 0);

  const lm = C.legalMoves(s);
  equal("legal moves are the other 49 values of each dot", lm.length, 2 * (C.MAX_VALUE - 1));
  check("legal moves never repeat the current value", lm.every((m) => (m.which === "p" ? m.value !== s.p : m.value !== s.q)));
  check("every legal move is accepted", lm.every((m) => C.move(s, m) !== null));
  const round = JSON.parse(JSON.stringify(C.setP(s, 8)));
  equal("a position survives a JSON round-trip", round, C.setP(s, 8));
}

/* ---------------------------- 2. the applet's own methods, transcribed again */

// Literal transcription of GCD.gcd(int,int) from the applet's utility class.
function appletGcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) { const t = a % b; a = b; b = t; }
  return a;
}
// Literal transcription of the leftmost blue dot in Draw(): p*q/GCD.gcd(p,q).
function appletLcm(p, q) {
  return (p * q) / appletGcd(p, q);
}
// Literal transcription of CommonMultiplesCanvas.Snap on a grid value:
// n = Math.round((x-O)/DX); n = n < 1 ? 1 : n; x = O + n*DX.
function appletSnap(raw) {
  let n = Math.round(raw);
  if (n < 1) n = 1;
  return n;
}
// Literal transcription of the red-dot loop in Draw(). The test on the loop
// condition happens before i is advanced, so the last dot can sit one step
// past the window — an applet quirk that the core documents and preserves.
function appletMultiples(n, window) {
  const out = [];
  let i = 0;
  for (;;) {
    if (!(i < window)) break; // the test is i*DX < width, i.e. i < width/DX
    i = i + n;
    out.push(i);
  }
  return out;
}

{
  let bad = 0;
  let where = "";
  for (let p = 1; p <= C.MAX_VALUE; p++) {
    for (let q = 1; q <= C.MAX_VALUE; q++) {
      if (C.gcd(p, q) !== appletGcd(p, q) || C.lcm(p, q) !== appletLcm(p, q)) {
        bad++;
        if (!where) where = `${p}, ${q}`;
      }
    }
  }
  check("gcd and lcm match the applet at all 2,500 pairs", bad === 0, where);

  bad = 0;
  where = "";
  for (let raw = -30; raw <= 80; raw += 0.25) {
    if (C.snap(raw) !== appletSnap(raw)) {
      bad++;
      if (!where) where = String(raw);
    }
  }
  check("snap matches the applet at all 441 raw positions", bad === 0, where);
  check("snap of a tiny fraction is 1", C.snap(0.4) === appletSnap(0.4));
  check("clampValue adds this port's upper end", C.clampValue(60) === C.MAX_VALUE && C.snap(60) === 60);

  bad = 0;
  where = "";
  for (let n = 1; n <= 20; n++) {
    for (let win = 1; win <= 80; win++) {
      // The applet's list ends at the largest multiple of n not exceeding
      // win + n - 1; that is exactly the core's clean list with that limit.
      const a = appletMultiples(n, win);
      const b = C.multiples(n, win + n - 1);
      if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
        bad++;
        if (!where) where = `n=${n}, window=${win}: ${a} vs ${b}`;
      }
    }
  }
  check("the red-dot loop matches its literal transcription at 1,600 cases", bad === 0, where);
  check("the applet's loop really can draw one dot past the window", appletMultiples(6, 40).includes(42));
  check("multiples stop at the limit", C.multiples(7, 30).join(",") === "7,14,21,28");
  check("no multiples below the first one", C.multiples(9, 8).length === 0);
}

/* ------------------------------------------ 3. every claim on the page */

{
  // Formula and the promised example P=2, Q=3 -> 2,4,6,8,... and 3,6,9,12,...
  equal("multiples of 2 (the page's example)", C.multiples(2, 12), [2, 4, 6, 8, 10, 12]);
  equal("multiples of 3 (the page's example)", C.multiples(3, 12), [3, 6, 9, 12]);
  equal("common multiples of 2 and 3", C.commonMultiples(2, 3, 24), [6, 12, 18, 24]);
  check("their least common multiple is 6", C.lcm(2, 3) === 6);
  equal("p*q/gcd is the page's formula", [C.lcm(4, 6), C.gcd(4, 6)], [12, 2]);

  let bad = 0;
  for (let p = 1; p <= C.MAX_VALUE; p++) {
    for (let q = 1; q <= C.MAX_VALUE; q++) {
      const L = C.lcm(p, q);
      if (!C.divides(p, L) || !C.divides(q, L)) bad++; // P|lcm and Q|lcm
      // lcm is the LEAST positive integer divisible by both: search every k.
      let least = 0;
      for (let k = 1; k <= p * q; k++) {
        if (k % p === 0 && k % q === 0) { least = k; break; }
      }
      if (least !== L) bad++;
    }
  }
  check("P and Q divide the lcm, and it is least: all 2,500 pairs", bad === 0);

  // Theorem 1: lcm(P,Q) = Q exactly when P|Q.
  bad = 0;
  let where = "";
  for (let p = 1; p <= C.MAX_VALUE; p++) {
    for (let q = 1; q <= C.MAX_VALUE; q++) {
      if ((C.lcm(p, q) === q) !== C.divides(p, q)) {
        bad++;
        if (!where) where = `${p}, ${q}`;
      }
    }
  }
  check("Theorem 1 holds for all 2,500 pairs", bad === 0, where);

  // Theorem 2: if P|R and Q|R then lcm(P,Q)|R, i.e. every common multiple is
  // a multiple of the lcm. Checked over the whole small box, not samples.
  bad = 0;
  where = "";
  for (let p = 1; p <= 20; p++) {
    for (let q = 1; q <= 20; q++) {
      const L = C.lcm(p, q);
      for (let r = 1; r <= 400; r++) {
        if (r % p === 0 && r % q === 0 && r % L !== 0) {
          bad++;
          if (!where) where = `P=${p}, Q=${q}, R=${r}, lcm=${L}`;
        }
      }
    }
  }
  check("Theorem 2 holds for all 160,000 triples", bad === 0, where);

  bad = 0;
  where = "";
  for (let p = 1; p <= 20; p++) {
    for (let q = 1; q <= 20; q++) {
      const blues = C.commonMultiples(p, q, 200);
      const want = C.multiples(C.lcm(p, q), 200);
      if (blues.length !== want.length || blues.some((v, i) => v !== want[i])) bad++;
      if (blues.some((v) => v % p !== 0 || v % q !== 0)) bad++;
      if (blues.length && blues[0] !== C.lcm(p, q)) bad++;
      if (!where) where = `P=${p}, Q=${q}`;
    }
  }
  check("blue dots are exactly the multiples of the lcm for all 400 pairs", bad === 0, where);

  // Multiples may be negative or zero: -10,-5,0,5,10 for 5 and for -5.
  for (const k of [-10, -5, 0, 5, 10]) check(k + " is a multiple of 5", C.isMultiple(k, 5));
  for (const k of [-10, -5, 0, 5, 10]) check(k + " is a multiple of -5", C.isMultiple(k, -5));
  check("1 is not a multiple of 5", !C.isMultiple(1, 5));
  check("zero is not a divisor", !C.isMultiple(10, 0));
  check("1 divides every Q (Theorem 1 at the edge)", C.lcm(1, 17) === 17 && C.divides(1, 17));
  check("equal dots give the lcm equal to both", C.lcm(12, 12) === 12);
}

/* ------------------------- 4. drawing data, words and the applet's quirk */

{
  for (const [p, q] of [[2, 3], [1, 1], [50, 50], [49, 50], [6, 9]]) {
    const s = C.start({ p, q });
    const L = C.lcm(p, q);
    const max = C.axisMax(s);
    check(`axis(P=${p},Q=${q}) shows both dots and two blue dots`, max >= 4 * p && max >= 4 * q && max >= 2 * L && max >= 12);
    check(`axis(P=${p},Q=${q}) shows the lcm`, C.commonMultiples(p, q, max).length >= 2);
  }
  for (const max of [12, 18, 60, 150, 7350]) {
    const step = C.tickStep(max);
    check(`tick step ${step} is a round number for max ${max}`, [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000].includes(step));
    check(`tick step ${step} gives a readable number of labels for max ${max}`, Math.ceil(max / step) <= 16);
  }

  const s = C.start({});
  check("the opening message names both dots and the lcm", /P = 2, Q = 3/.test(C.describe("start", s)) && /6/.test(C.describe("start", s)));
  check("the reset message says Back to the start", /Back to the start/.test(C.describe("reset", s)));
  check("when P divides Q the message names Q", /first blue dot is Q itself \(12\)/.test(C.describe("move", C.setQ(s, 12))));
  check("when Q divides P the message names P", /first blue dot is P itself \(12\)/.test(C.describe("move", C.setP(s, 12))));

  // The applet's Reset puts grid point (3,1) on the upper dot and (2,-1) on
  // the lower one, i.e. 3 above and 2 below, while its page says P=2, Q=3.
  // The lcm is symmetric, so the blue dots are identical; this port follows
  // the page's labelling. Assert that harmless fact rather than hide it.
  check("the applet's (3,2) and the page's (2,3) give the same first blue dot", C.lcm(3, 2) === C.lcm(2, 3));
  equal("the applet's upper and lower rows still have the page's multiples", [C.multiples(3, 6), C.multiples(2, 6)], [[3, 6], [2, 4, 6]]);
}

done("common-multiples");
