#!/usr/bin/env node
"use strict";

/*
 * Logic test for collatz/collatz-core.js.
 *
 *   node porting/check-collatz.mjs
 *
 * Three parts:
 *  1. The applet's own methods (Func, SetNumOfDigits, RunIterations) written a
 *     second time, straight from the bytecode, and compared with the core over
 *     the whole option space and every reachable start in the range tested.
 *  2. Every claim on the cut-the-knot page, checked exhaustively: the 4,2,1 and
 *     4,1 cycles for all starts 1..20000, "the first number needing more than
 *     100 steps is 27", the page's list of such numbers, and the poem's day 59
 *     and day 69. One list on the page is only a sample, and the test says so.
 *  3. The rules' edge cases: invalid starts, the 150-step cap, the "problematic"
 *     message, stepping backwards and forwards, plain-JSON positions and the
 *     words used to close a trail.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("collatz/collatz-core.js", "CollatzCore");

/* ------------------------------- 1. the core against the applet's own code */

// Func(long) from CollatzCanvas, literally: OriginalCollatz divides an even
// number once; otherwise the even loop strips every factor of two. Shorten
// divides the odd result by two; Factor defaults to 3.
function appletFunc(n, originalCollatz, shorten, factor) {
  if (n % 2 === 0) {
    if (originalCollatz) return n / 2;
    while (n % 2 === 0) n = n / 2;
    return n;
  }
  return shorten ? Math.trunc((factor * n + 1) / 2) : factor * n + 1;
}

// SetNumOfDigits: a first digit 1..9, then digits-1 digits 0..9, parsed as long.
function appletRandomNumber(digits, rand) {
  let text = String(Math.floor(rand() * 9) + 1);
  for (let i = 1; i < digits; i++) text += String(Math.floor(rand() * 10));
  return Number(text);
}

// RunIterations: Vec holds the values, Hash detects a repeat. The repeated
// value is appended before stopping; otherwise MaxIter applications are made.
function appletIterate(number, originalCollatz, shorten, factor, maxIter) {
  const hash = new Set();
  const vec = [];
  let n = number;
  hash.add(String(n));
  vec.push(String(n));
  let stop = false;
  for (let iter = 0; !stop && iter < maxIter; iter++) {
    n = appletFunc(n, originalCollatz, shorten, factor);
    const key = String(n);
    if (!hash.has(key)) {
      hash.add(key);
      vec.push(key);
    } else {
      vec.push(key);
      stop = true;
    }
  }
  return { sequence: vec.map(Number), stop };
}

{
  for (let n = 1; n <= 400; n++) {
    for (const original of [true, false]) {
      for (const shorten of [true, false]) {
        for (const factor of [2, 3, 5]) {
          const opts = { mode: original ? "divide" : "strip", shorten, factor };
          check(`Func(${n}, ${JSON.stringify(opts)}) matches the applet`,
            C.func(n, opts) === appletFunc(n, original, shorten, factor));
        }
      }
    }
  }
}

{
  for (const seed of [1, 7, 20261120]) {
    for (let d = 1; d <= C.MAX_DIGITS; d++) {
      const a = rng(seed);
      const b = rng(seed);
      const got = C.randomNumber(d, a);
      const want = appletRandomNumber(d, b);
      check(`random number with ${d} digits (seed ${seed})`, got === want, `${got} vs ${want}`);
    }
  }
}

{
  for (let n = 1; n <= 300; n++) {
    for (const original of [true, false]) {
      for (const shorten of [true, false]) {
        for (const maxIter of [150, 10, 1]) {
          const opts = {
            number: n,
            mode: original ? "divide" : "strip",
            shorten,
            factor: 3,
            maxIter,
          };
          const ref = appletIterate(n, original, shorten, 3, maxIter);
          const got = C.iterate(opts);
          equal(`RunIterations(n=${n}, ${original ? "divide" : "strip"}, shorten=${shorten}, MaxIter=${maxIter})`,
            got.sequence, ref.sequence);
          check(`stop flag matches (n=${n}, MaxIter=${maxIter}, ${original ? "divide" : "strip"})`,
            (got.stop === "cycle") === ref.stop);
          if (got.stop === "cycle") {
            const last = got.sequence[got.sequence.length - 1];
            check(`cycleFrom is the first ${last} (n=${n})`,
              got.sequence[got.cycleFrom] === last && got.sequence.indexOf(last) === got.cycleFrom);
          }
        }
      }
    }
  }
}

/* ------------------------------- 2. the page's claims, checked exhaustively */

{
  // "Regardless of the starting point the iterations settle eventually into a
  // 3-cycle: 4, 2, 1, 4." Every start 1..20000 closes that loop when allowed
  // enough steps. The applet itself only allows 150, so some starts there stop
  // at the cap instead; those are counted below rather than called a failure.
  let capped = 0;
  let firstCapped = null;
  let longest = 0;
  for (let n = 1; n <= 20000; n++) {
    const t = C.iterate({ number: n, maxIter: 1000 });
    check(`start ${n} reaches a cycle given enough steps`, t.stop === "cycle");
    equal(`start ${n} ends in the 4,2,1 loop`, C.cycle(t).slice().sort((a, b) => a - b), [1, 2, 4]);
    check(`start ${n} passes through 1`, t.sequence.indexOf(1) >= 0);
    longest = Math.max(longest, C.steps(t));

    const appletTrail = C.iterate({ number: n });
    check(`start ${n} either closes a loop or hits the 150-step cap`,
      appletTrail.stop === "cycle" || appletTrail.stop === "max");
    if (appletTrail.stop === "max") {
      capped++;
      if (firstCapped === null) firstCapped = n;
    } else {
      equal(`applet trail for ${n} closes on the same loop`, C.cycle(appletTrail).slice().sort((a, b) => a - b), [1, 2, 4]);
    }
  }
  check("the 150-step cap first bites at 703", firstCapped === 703);
  check("2817 starts up to 20000 hit the applet's cap", capped === 2817);
  check("the longest trail up to 20000 takes 279 steps", longest === 279);
  equal("4 -> 2 -> 1 -> 4", C.iterate({ number: 4 }).sequence.slice(0, 4), [4, 2, 1, 4]);
  equal("2 -> 1 -> 4 -> 2", C.iterate({ number: 2 }).sequence.slice(0, 4), [2, 1, 4, 2]);
  equal("1 -> 4 -> 2 -> 1", C.iterate({ number: 1 }).sequence.slice(0, 4), [1, 4, 2, 1]);
}

{
  // The variant: strip an even number of all its twos in one step leads to the
  // shorter 2-cycle 4, 1, 4. Checked for the same 20000 starts, again allowing
  // more than the applet's 150 steps where needed.
  let capped = 0;
  let firstCapped = null;
  let longest = 0;
  for (let n = 1; n <= 20000; n++) {
    const t = C.iterate({ number: n, mode: "strip", maxIter: 1000 });
    check(`strip start ${n} reaches a cycle given enough steps`, t.stop === "cycle");
    equal(`strip start ${n} ends in the 4,1 loop`, C.cycle(t).slice().sort((a, b) => a - b), [1, 4]);
    longest = Math.max(longest, C.steps(t));
    const appletTrail = C.iterate({ number: n, mode: "strip" });
    check(`strip start ${n} either closes a loop or hits the cap`,
      appletTrail.stop === "cycle" || appletTrail.stop === "max");
    if (appletTrail.stop === "max") {
      capped++;
      if (firstCapped === null) firstCapped = n;
    }
  }
  check("stripping first hits the 150-step cap at 2463", firstCapped === 2463);
  check("158 strip starts up to 20000 hit the cap", capped === 158);
  check("the longest stripped trail up to 20000 takes 206 steps", longest === 206);
  equal("4 -> 1 -> 4 when stripping", C.iterate({ number: 4, mode: "strip" }).sequence.slice(0, 3), [4, 1, 4]);
  equal("8 -> 1 when stripping", C.iterate({ number: 8, mode: "strip" }).sequence.slice(0, 2), [8, 1]);
  equal("8 -> 4 -> 2 -> 1 when dividing", C.iterate({ number: 8 }).sequence.slice(0, 4), [8, 4, 2, 1]);
}

{
  // "The first number that takes more than 100 iterations is 27. Then such
  // numbers become more frequent: 27, 31, 41, 47, 55, 62, ..."
  const over = [];
  for (let n = 1; n <= 20000; n++) {
    if (C.stoppingTime(n) > 100) over.push(n);
  }
  check("no start below 27 takes more than 100 steps", over.every((n) => n >= 27));
  check("27 takes more than 100 steps", over.includes(27));
  check("27 takes exactly 111 steps to reach 1", C.stoppingTime(27) === 111);
  equal("the first six numbers needing over 100 steps", over.slice(0, 6), [27, 31, 41, 47, 54, 55]);

  const pageList = [27, 31, 41, 47, 55, 62];
  check("every number the page lists really needs over 100 steps", pageList.every((n) => over.includes(n)));
  check("the page's list is not the true prefix: 54 is missing", over.includes(54) && !pageList.includes(54));
  check("the page's list is not the true prefix: 63 is missing", over.includes(63) && !pageList.includes(63));
  check("the page's list agrees with the true order apart from the omissions",
    pageList.every((n) => over.indexOf(n) < 10));
  const counts = [100, 1000, 20000].map((bound) => over.filter((n) => n <= bound).length);
  check("such numbers become more frequent as the bound grows", counts[0] < counts[1] && counts[1] < counts[2]);
}

{
  // The poem: with (3n + 1)/2 for odd numbers and divide-by-2 for even ones,
  // starting at 27 the first price below $27 is on day 59, and the 2,1 loop is
  // reached on day 69.
  const t = C.iterate({ number: 27, shorten: true });
  const firstBelow = t.sequence.findIndex((v) => v < 27);
  const firstLoop = t.sequence.findIndex((v) => v <= 2);
  check("the first value below 27 is on step 59", firstBelow === 59);
  check("that 59th value is 23", t.sequence[59] === 23);
  check("every earlier value is at least 27", t.sequence.slice(0, 59).every((v) => v >= 27));
  check("the 2,1 loop is entered on step 69", firstLoop === 69 && t.sequence[69] === 2);
  check("step 70 is 1, closing the 2,1 loop", t.sequence[70] === 1);
  equal("the shorter loop is 2, 1", C.cycle({ ...t, stop: t.stop }), [2, 1]);
  check("the economical form takes fewer steps than the original from 27",
    C.steps(C.start({ number: 27, shorten: true })) < C.steps(C.start({ number: 27 })));
}

/* ------------------------------------------------- 3. rules and edge cases */

{
  const s = C.start({ number: 27 });
  check("new position starts at step 0", s.index === 0);
  check("new position shows only the start", s.sequence[0] === 27 && s.sequence.length > 1);
  check("default mode divides by 2", s.mode === "divide");
  check("default does not shorten", s.shorten === false);
  check("default Factor is 3", s.factor === 3);
  check("default MaxIter is 150", s.maxIter === 150);
  check("default digits are 2", s.digits === 2);
  check("a new trail is not finished", C.result(s) === null);
  equal("the only move is a step", C.legalMoves(s), ["step"]);

  const two = C.start({ digits: 2, rand: rng(3) });
  check("two digits give a number from 10 to 99", two.number >= 10 && two.number <= 99);
  check("no digits given uses the default 2", C.start({ rand: rng(3) }).number === two.number);
  const fifteen = C.start({ digits: 15, rand: rng(3) });
  check("fifteen digits give a number from 10^14 to 10^15", fifteen.number >= 1e14 && fifteen.number <= C.MAX_NUMBER);
  check("a digit count above the range falls back to 2",
    C.start({ digits: 99, rand: rng(3) }).number === two.number);

  for (const bad of [0, -5, 1.5, NaN, Infinity, C.MAX_NUMBER + 1]) {
    check(`invalid start ${bad} is replaced by a random one`,
      C.normalizeNumber(bad, 2, rng(3)) === C.randomNumber(2, rng(3)));
  }
  check("a numeric string is accepted", C.normalizeNumber("27", 2) === 27);
  check("an unknown mode falls back to divide", C.start({ number: 6, mode: "weird" }).mode === "divide");
  check("maxIter can be overridden", C.iterate({ number: 27, maxIter: 5 }).sequence.length === 6);
  check("a bad maxIter falls back to 150", C.iterate({ number: 27, maxIter: 0 }).maxIter === 150);

  // Stepping, going back, and the end of the trail.
  let p = C.start({ number: 27 });
  const before = p.sequence.slice();
  for (let i = 1; i <= 112; i++) {
    p = C.step(p);
    check(`step ${i} shows value ${p.sequence[p.index]}`, p.index === i);
  }
  check("the whole trail ends after 112 steps", C.result(p) === "done");
  equal("no moves remain at the end", C.legalMoves(p), []);
  check("stepping at the end changes nothing", C.step(p) === p);
  check("move('step') agrees with step", C.move(p, "step") === p);
  check("an unknown move is refused", C.move(p, "jump") === null);
  check("the trail never mutates", JSON.stringify(before) === JSON.stringify(p.sequence));
  check("show all jumps to the end", C.showAll(C.start({ number: 27 })).index === 112);
  check("back returns to the previous value", C.back(p).index === 111);
  const fresh = C.start({ number: 27 });
  check("back at the start changes nothing", C.back(fresh) === fresh);

  // Rebuilding keeps the start and applies just the changed option.
  const changed = C.rebuild(C.start({ number: 27 }), { mode: "strip" });
  check("rebuild keeps the start", changed.number === 27);
  check("rebuild applies the new mode", changed.mode === "strip");
  check("rebuild restarts the reveal", changed.index === 0);

  // Overflow: the applet's Exception path announces "<start> is problematic."
  const big = C.iterate({ number: C.MAX_NUMBER });
  check("a 15-digit start that overflows stops", big.stop === "error");
  check("the overflow message names the start", big.announce === C.MAX_NUMBER + " is problematic.");
  const held = C.iterate({ number: 100000000012345 });
  check("a 15-digit start within range reaches the 150-step cap", held.stop === "max" && held.sequence.length === 151);

  // Positions are plain JSON, and the words say what happened.
  const round = JSON.parse(JSON.stringify(p));
  equal("a position survives JSON round-trip", round, p);
  check("start sentence names the start", /Starting at 27/.test(C.describe("start", s)));
  check("step sentence names even and odd in words",
    /even 8 became 4/.test(C.describe("step", C.step(C.start({ number: 8 })))));
  check("reset sentence names the start", /reset to 27/.test(C.describe("reset", s)));
  check("mode sentence explains stripping", /stripped of all their twos/.test(C.describe("mode", changed)));
  check("shorten sentence names the odd rule", /\(3n \+ 1\)\/2/.test(C.describe("shorten", C.rebuild(s, { shorten: true }))));
  check("closing sentence names the loop and the step count",
    C.summary(p) === "Reached the 4, 2, 1 loop after 112 steps.");
  check("strip closing sentence names its loop", /4, 1|1, 4/.test(C.summary(C.showAll(C.start({ number: 27, mode: "strip" })))));
  check("cap closing sentence says the loop was not closed",
    /not closed a loop/.test(C.summary(C.showAll(C.start({ number: 100000000012345 })))));
  check("0 is refused as a start, and the strip loop cannot hang on it", C.func(0, { mode: "strip" }) === 0);
}

done("collatz");
