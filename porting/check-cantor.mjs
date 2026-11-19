#!/usr/bin/env node
"use strict";

/*
 * Logic test for cantor/cantor-core.js.
 *
 *   node porting/check-cantor.mjs
 *
 * Three parts:
 *  1. A second, literal transcription of the applet's own methods (T,
 *     TInverse, ComputeIterates, Draw, Convert, mouseDragged) compared with
 *     the core over the whole small parameter space — not a few samples.
 *  2. Every claim of the cut-the-knot article, checked with exact fractions:
 *     the 2^(p-1) / 2^p counts, (2/3)^p lengths, the named gaps, the ternary
 *     description of C0, the members 1/4, 3/4, 1/13, and the Cantor function
 *     (f(1/3)=f(2/3)=1/2, constant on gaps, f o T_3 = tent_2 o f).
 *  3. The rules' edge cases: the drag range, the 15 warm-up repaints before a
 *     mark is drawn, the orbit staying in [0, 1] at a = 3, and plain-JSON
 *     positions. One page claim is false and is asserted as false below.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cantor/cantor-core.js", "CantorCore");
const F = C.F;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const sameFrac = (a, b) => a.n === b.n && a.d === b.d;

/* --------------------------------------- 1. the core vs the applet's methods */

// T(double) from CantorCanvas, straight from javap: dcmpg 0.5, a*x or a*(1-x).
function appletT(a, x) {
  return x <= 0.5 ? a * x : a * (1 - x);
}
// TInverse(double): (int)(random*2); if y > 1 return 0; y/a or (a-y)/a.
function appletTInverse(a, y, coin) {
  if (y > 1) return 0;
  return coin > 0 ? y / a : (a - y) / a;
}
// Convert(double): rect.y + rect.height - rect.height/2 * value.
function appletConvert(value, rect) {
  return rect.y + rect.height - (rect.height / 2) * value;
}
// mouseDragged: a = 4*(rect.y+rect.height-(mouseY+deffectY))/rect.height.
function appletDragA(mouseY, deffectY, rect) {
  return (4 * (rect.y + rect.height - (mouseY + deffectY))) / rect.height;
}

{
  const as = [0.05, 0.5, 1, 1.5, 2, 3];
  for (const a of as) {
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      check(`T(a=${a}, x=${i}/100)`, C.tent(a, x) === appletT(a, x));
    }
  }
  for (const a of as) {
    for (let i = 0; i <= 20; i++) {
      const y = i / 20;
      for (const coin of [0, 1]) {
        check(`TInverse(a=${a}, y=${i}/20, coin=${coin})`,
          C.inverseTent(a, y, coin) === appletTInverse(a, y, coin));
      }
    }
    check(`TInverse(a=${a}, y=1.2) falls back to 0`, C.inverseTent(a, 1.2, 0) === 0);
  }

  const rect = { x: 20, y: 20, width: 280, height: 144 };
  for (const v of [0, 0.5, 1, 1.5, 2, 3]) {
    check(`Convert(${v})`, C.convert(v, rect) === appletConvert(v, rect));
    check(`tentPeak(${v})`, C.tentPeak(v, rect).y === appletConvert(v / 2, rect));
  }
  for (let y = 1; y <= 160; y += 3) {
    for (const off of [-4, 0, 7]) {
      check(`dragA(mouseY=${y}, off=${off})`, C.dragA(y, off, rect) === appletDragA(y, off, rect));
      const raw = appletDragA(y, off, rect);
      check(`validDrag(mouseY=${y}, a=${raw.toFixed(3)})`, C.validDrag(y, raw) === (y > 0 && raw > 0 && raw < 2));
    }
  }
}

// ComputeIterates and Draw, transcribed literally (post-increment of the old
// counter, marks only when the old counter is > 15).
function appletRun(a, coins, steps) {
  let x0 = 0.123456;
  let y0 = 0;
  let n = 0;
  const orbit = [];
  const marks = [];
  for (let i = 0; i < steps; i++) {
    const old = n++;
    if (old > 15) marks.push({ x: y0, top: x0 });
    x0 = y0;
    y0 = appletTInverse(a, x0, coins[i]);
    orbit.push(x0);
    if (orbit.length > 24) orbit.shift(); // the core keeps the last 24
  }
  return { step: n, x: x0, y: y0, orbit, marks };
}

{
  const random = rng(20261118);
  for (const a of [0.5, 1, 1.5, 2, 3]) {
    const coins = Array.from({ length: 40 }, () => (random() < 0.5 ? 0 : 1));
    let state = C.setRunning(C.start({ a }), true);
    const ref = appletRun(a, coins, 40);
    for (const coin of coins) state = C.tick(state, coin);
    check(`40 Draw repaints at a=${a}: step`, state.step === ref.step);
    check(`40 Draw repaints at a=${a}: x`, near(state.x, ref.x, 1e-12));
    check(`40 Draw repaints at a=${a}: y`, near(state.y, ref.y, 1e-12));
    equal(`40 Draw repaints at a=${a}: marks`, state.marks, ref.marks);
    equal(`40 Draw repaints at a=${a}: orbit`, state.orbit, ref.orbit);
  }
}

/* ------------------------------- 2. the article's claims, checked exhaustively */

{
  // Step p removes 2^(p-1) open thirds, leaves 2^p closed ones, whose total
  // length is (2/3)^p. Checked for every p the arithmetic can hold exactly.
  for (let p = 1; p <= 10; p++) {
    const removed = C.removedIntervals(p);
    const left = C.remainingIntervals(p);
    const len = C.remainingLength(p);
    const atThisStep = removed.filter((g) => g.p === p);
    check(`step ${p} removes 2^${p - 1}=${atThisStep.length} gaps`, atThisStep.length === Math.pow(2, p - 1));
    check(`step ${p} removes ${removed.length} gaps in all`, removed.length === Math.pow(2, p) - 1);
    check(`step ${p} leaves 2^${p}=${left.length} intervals`, left.length === Math.pow(2, p));
    check(`step ${p} total length = (2/3)^${p}`, near(C.fnum(len), Math.pow(2 / 3, p)));
    for (const g of removed) check(`step ${p} gap ${g.p},${g.k} ordered inside [0,1]`,
      C.fnum(g.lo) >= 0 && C.fnum(g.hi) <= 1 && C.fnum(g.lo) < C.fnum(g.hi));
  }
  for (const iv of C.remainingIntervals(8)) {
    check(`remaining interval ${JSON.stringify(iv.lo)}..${JSON.stringify(iv.hi)} ordered`,
      C.fnum(iv.lo) < C.fnum(iv.hi));
  }
}

{
  // The gaps the article names, and the four intervals left after round 2.
  const g = C.removedIntervals(2);
  check("d(1,1) = (1/3, 2/3)", sameFrac(g[0].lo, F(1, 3)) && sameFrac(g[0].hi, F(2, 3)));
  check("d(2,1) = (1/9, 2/9)", sameFrac(g[1].lo, F(1, 9)) && sameFrac(g[1].hi, F(2, 9)));
  check("d(2,2) = (7/9, 8/9)", sameFrac(g[2].lo, F(7, 9)) && sameFrac(g[2].hi, F(8, 9)));
  const rem2 = C.remainingIntervals(2);
  const want2 = [{ lo: F(0, 1), hi: F(1, 9) }, { lo: F(2, 9), hi: F(1, 3) },
    { lo: F(2, 3), hi: F(7, 9) }, { lo: F(8, 9), hi: F(1, 1) }];
  check("after round 2: [0,1/9] [2/9,1/3] [2/3,7/9] [8/9,1]",
    rem2.every((iv, i) => sameFrac(iv.lo, want2[i].lo) && sameFrac(iv.hi, want2[i].hi)));
  equal("1/3 = 0.1 ternary (the finite form the article prints)", C.ternaryDigits(F(1, 3), 6), [1, 0, 0, 0, 0, 0]);
  equal("1/3 = 0.0222... under the article's convention", C.cantorDigits(F(1, 3), 6), [0, 2, 2, 2, 2, 2]);
  equal("2/3 = 0.2 ternary", C.ternaryDigits(F(2, 3), 6), [2, 0, 0, 0, 0, 0]);
  equal("1/9 = 0.01 ternary (finite), 0.0022... under the convention", C.cantorDigits(F(1, 9), 6), [0, 0, 2, 2, 2, 2]);
  equal("2/9 = 0.02 ternary", C.ternaryDigits(F(2, 9), 6), [0, 2, 0, 0, 0, 0]);
  equal("7/9 = 0.21 ternary", C.ternaryDigits(F(7, 9), 6), [2, 1, 0, 0, 0, 0]);
  equal("8/9 = 0.22 ternary", C.ternaryDigits(F(8, 9), 6), [2, 2, 0, 0, 0, 0]);
}

{
  // C0 = the numbers with no ternary digit 1.
  for (const x of [F(0, 1), F(1, 1), F(1, 3), F(2, 3), F(1, 9), F(2, 9),
    F(7, 9), F(8, 9), F(1, 4), F(3, 4), F(1, 13)]) {
    check(`${x.n}/${x.d} is in C0`, C.inCantor(x, 24));
  }
  for (const x of [F(1, 2), F(4, 9), F(5, 9), F(1, 6), F(1, 5)]) {
    check(`${x.n}/${x.d} is NOT in C0`, !C.inCantor(x, 24));
  }
  equal("1/4 = 0.020202... ternary", C.ternaryDigits(F(1, 4), 12), [0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2]);
  equal("3/4 = 0.202020... ternary", C.ternaryDigits(F(3, 4), 12), [2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0]);
  equal("1/13 = 0.002002002... ternary", C.ternaryDigits(F(1, 13), 12),
    [0, 0, 2, 0, 0, 2, 0, 0, 2, 0, 0, 2]);
}

{
  // Cantor function: 0 -> 0, 1 -> 1, f(1/3) = f(2/3) = 1/2, f(1/4)=1/3,
  // f(3/4)=2/3, f(1/13)=1/7; constant and equal at the ends of every gap.
  const f = (x) => C.cantorFunction(x, 24);
  check("f(0) = 0", near(f(F(0, 1)), 0, 1e-9));
  check("f(1) = 1", near(f(F(1, 1)), 1, 1e-6));
  check("f(1/3) = 1/2", near(f(F(1, 3)), 1 / 2, 1e-6));
  check("f(2/3) = 1/2", near(f(F(2, 3)), 1 / 2, 1e-6));
  check("f(1/3) = f(2/3)", near(f(F(1, 3)), f(F(2, 3)), 1e-6));
  check("f(1/4) = 1/3", near(f(F(1, 4)), 1 / 3, 1e-6));
  check("f(3/4) = 2/3", near(f(F(3, 4)), 2 / 3, 1e-6));
  check("f(1/13) = 1/7", near(f(F(1, 13)), 1 / 7, 1e-6));
  for (const g of C.removedIntervals(6)) {
    const value = (2 * g.k - 1) / Math.pow(2, g.p);
    check(`f constant = ${value} on d(${g.p},${g.k})`,
      near(f(g.lo), value, 1e-4) && near(f(g.hi), value, 1e-4) && near(f(g.lo), f(g.hi), 1e-6));
  }
  // The removed gaps have total length 1, so f is flat on length 1 overall.
  let pairs = [[0, 1]];
  let removedTotal = 0;
  for (let p = 1; p <= 12; p++) {
    const next = [];
    for (const [lo, hi] of pairs) {
      const t = (hi - lo) / 3;
      removedTotal += t;
      next.push([lo, lo + t], [hi - t, hi]);
    }
    pairs = next;
  }
  check("the flat intervals of f have total length 1-(2/3)^12",
    near(removedTotal, 1 - Math.pow(2 / 3, 12), 1e-9));
  check("their length tends to 1", near(1 - Math.pow(2 / 3, 60), 1, 1e-9));
}

{
  // T with a = 3 sends both ends of a gap removed at step p to 1 after p
  // steps — the same endpoints where f takes the same value.
  for (const g of C.removedIntervals(8)) {
    let lo = C.fnum(g.lo);
    let hi = C.fnum(g.hi);
    for (let i = 0; i < g.p; i++) { lo = C.tent(3, lo); hi = C.tent(3, hi); }
    check(`T_3^${g.p} sends both ends of d(${g.p},${g.k}) to 1`, near(lo, 1) && near(hi, 1));
    check(`T ends stay in [0,1] for d(${g.p},${g.k})`,
      lo >= -1e-9 && lo <= 1 + 1e-9 && hi >= -1e-9 && hi <= 1 + 1e-9);
  }

  // f conjugates the Cantor shift T_3 to the doubling tent on [0, 1]:
  // f(T_3(x)) = T_2(f(x)) for every x in C0 (page's Cantor function).
  const xs = [F(1, 4), F(3, 4), F(1, 13), F(0, 1), F(1, 1), F(1, 3), F(2, 3)];
  for (const g of C.removedIntervals(7)) xs.push(g.lo, g.hi);
  const f = (x) => C.cantorFunction(x, 24);
  const tentFrac = (x) => C.fnum(x) <= 0.5 ? F(3 * x.n, x.d) : F(3 * (x.d - x.n), x.d);
  for (const x of xs) {
    const left = f(tentFrac(x));
    const right = C.tent(2, f(x));
    check(`f(T_3(${x.n}/${x.d})) = T_2(f(x))`, near(left, right, 2e-4));
  }
}

{
  // A claim that does not survive checking: "the only other point with the
  // first digit 1 [besides (1/3, 2/3)] is 1/3". But 2/3 = 0.1222..._3 too.
  let alt = 0;
  let place = 9;
  alt += 1 / 3; // first digit 1
  for (let i = 0; i < 40; i++) { alt += 2 / place; place *= 3; }
  check("the article's 'only 1/3' claim is false: 2/3 = 0.1222..._3", near(alt, 2 / 3, 1e-9));
  check("2/3 also has first digit 1 in an allowed representation",
    C.ternaryDigits(F(2, 3), 6)[0] === 2 && near(alt, 2 / 3, 1e-9));
}

/* -------------------------------------------------- 3. rules and edge cases */

{
  const s = C.start({});
  check("start a = 3", s.a === C.DEFAULT_A);
  check("start x = 0.123456", s.x === C.X_START);
  check("start y = 0", s.y === C.Y_START);
  check("start is not running", s.running === false);
  check("start has no steps and no marks", s.step === 0 && s.marks.length === 0);
  check("the demo is unexplored at the start", !C.explored(s));
  check("tick while stopped changes nothing", C.tick(s, 1) === s);
  check("setRunning(true) resets the count", C.setRunning(C.tick(C.setRunning(s, true), 0), true).step === 0);
  check("setRunning(false) keeps the marks", C.setRunning(Object.assign({}, s, { marks: [1] }), false).marks.length === 1);

  for (const bad of [0, -1, 3.0001, NaN, Infinity]) {
    check(`setA rejects ${bad}`, C.setA(s, bad) === s);
  }
  check("setA accepts 0.01", C.setA(s, 0.01).a === 0.01);
  check("setA accepts 1.99", C.setA(s, 1.99).a === 1.99);
  check("setA accepts the opening 3", C.setA(s, 3).a === 3);
  check("setA does not mutate", s.a === 3 && C.setA(s, 1).a === 1);
  check("start({a}) honours the slider", C.start({ a: 1.5 }).a === 1.5);
  check("start({a: 4}) falls back to 3", C.start({ a: 4 }).a === 3);

  // Mark timing: the first mark appears on step 17 (old counter 16 > 15).
  let r = C.setRunning(C.start({}), true);
  const coins = Array.from({ length: 20 }, (_, i) => i % 2);
  for (let i = 1; i <= 20; i++) {
    r = C.tick(r, coins[i - 1]);
    check(`step ${i}: marks = ${i > 16 ? i - 16 : 0}`, r.marks.length === Math.max(0, i - 16));
  }
  const m = r.marks[0];
  let y16 = 0;
  for (let i = 0; i < 16; i++) y16 = C.inverseTent(3, y16, coins[i]);
  check("the first mark's x is the value after step 16", near(m.x, y16, 1e-12));

  // The applet's inverse branches keep a = 3 orbits inside [0, 1].
  for (const y0 of [0, 0.123456, 0.5, 1]) {
    let p = C.setRunning(C.start({}), true);
    p = Object.assign({}, p, { y: y0 });
    let inside = true;
    for (let i = 0; i < 200; i++) {
      p = C.tick(p, i % 2);
      if (p.y < 0 || p.y > 1 || p.x < 0 || p.x > 1) inside = false;
    }
    check(`a=3 orbit from y=${y0} stays in [0,1] for 200 steps`, inside);
  }

  // Positions are plain JSON, and the words say what changed.
  const round = JSON.parse(JSON.stringify(r));
  equal("a position survives JSON round-trip", round, r);
  check("reset sentence names a = 3.00", /a = 3\.00/.test(C.describe("reset", s)));
  check("a-change sentence says the peak moved", /peak moved/.test(C.describe("a", C.setA(s, 1.5))));
  check("iterate-on sentence names the starting value", /starts again/.test(C.describe("iterate-on", s)));
  check("iterate-off sentence names the step", /stopped at step/.test(C.describe("iterate-off", r)));
  check("step sentence names the new mark in words", /new mark stands at x =/.test(C.describe("step", r)));
  check("a step sentence names the orbit value before the first mark",
    /orbit moved to y =/.test(C.describe("step", C.start({}))));
}

done("cantor");
