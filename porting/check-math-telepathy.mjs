#!/usr/bin/env node
"use strict";

/*
 * Logic test for math-telepathy/math-telepathy-core.js.
 *
 *   node porting/check-math-telepathy.mjs
 *
 * The trick on every case it is meant for: every number up to 99,999 and every
 * reshuffle of its digits (distinct ones), every non-zero digit of the
 * difference circled in turn: giving the other digits always makes the
 * computer name the circled one. The page's reason is checked as well: every
 * such difference is a multiple of 9. The trick fails when the subtraction is
 * wrong (the page's warning): a slip of 1 makes the digits add up to 1 mod 9, so
 * the computer is never right (counted). The applet's own Guess (sum of the digits) and take-back are
 * written a second time and compared.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("math-telepathy/math-telepathy-core.js", "MathTelepathyCore");

/* ------------------------------------------------------------ 1. the rules */
{
  let s = C.start();
  equal("starts empty, nothing to take back, no guess", [s.digits, s.guessed, C.canTakeBack(s)], [[], null, false]);
  s = C.add(s, 3); s = C.add(s, 5);
  equal("digits are kept in the order given", s.digits, [3, 5]);
  equal("nine instructions", C.INSTRUCTIONS.length, 9);
  equal("a digit outside 0..9 is refused", [C.add(s, 10), C.add(s, -1), C.add(s, 2.5)], [null, null, null]);
  equal("the old position is not changed", C.add(s, 1) !== s && s.digits.length === 2, true);
  const g = C.guess(s);
  equal("3 and 5 sum to 8: the circled digit is 1", g.guessed, 1);
  equal("a digit given afterwards clears the guess", C.add(g, 0).guessed, null);
  equal("take back removes the last digit and clears the guess", [C.takeBack(g).digits, C.takeBack(g).guessed], [[3], null]);
  equal("nothing to take back from empty", C.takeBack(C.start()), null);
  equal("an empty list reads 9 (a multiple of 9 already)", C.read([]), 9);
  equal("a circled 9: the rest sum to a multiple of 9", [C.read([4, 5]), C.read([9, 9, 0])], [9, 9]);
  equal("the example: difference 63, other digit 6 means 3", C.read([6]), 3);
}

/* --------------------------- 2. the trick on every number up to 5 digits */
const sumDigits = (n) => String(n).split("").reduce((t, c) => t + Number(c), 0);
function* distinctPerms(arr) {
  const a = arr.slice().sort(), used = Array(a.length).fill(false), cur = [];
  function* rec() {
    if (cur.length === a.length) { yield cur.slice(); return; }
    for (let i = 0; i < a.length; i++) {
      if (used[i] || (i > 0 && a[i] === a[i - 1] && !used[i - 1])) continue;
      used[i] = true; cur.push(a[i]); yield* rec(); cur.pop(); used[i] = false;
    }
  }
  yield* rec();
}
{
  let pairs = 0, circled = 0, wrong = 0, notNine = 0, slipRight = 0, slips = 0;
  for (let n = 10; n <= 99999; n++) {
    const digits = String(n).split("");
    for (const p of distinctPerms(digits)) {
      const m = Number(p.join(""));
      pairs++;
      const diff = Math.abs(n - m);
      if (diff % 9 !== 0) notNine++;
      const ds = String(diff).split("").map(Number);
      ds.forEach((c, i) => {
        if (c === 0) return;
        circled++;
        const rest = ds.filter((_, j) => j !== i);
        if (C.read(rest) !== c) wrong++;
      });
      // a slip in the subtraction: the answer is one too big
      if (diff > 0 && n % 997 === 0) {
        const bad = String(diff + 1).split("").map(Number);
        bad.forEach((c, i) => { if (c === 0) return; slips++; if (C.read(bad.filter((_, j) => j !== i)) === c) slipRight++; });
      }
    }
  }
  console.log(`  (${pairs.toLocaleString()} number and reshuffle pairs, ${circled.toLocaleString()} circled digits; with a slip of 1 the guess was right ${slipRight} of ${slips})`);
  equal("every difference of a number and a reshuffle is a multiple of 9", notNine, 0);
  equal("every circled digit of every difference is named correctly", wrong, 0);
  equal("a slip of 1 in the subtraction: the computer is never right", [slips > 1000, slipRight], [true, 0]);
}

/* --------------- 3. the applet's own Guess: sum of i * count[i], and take-back */
{
  const appletGuess = (digits) => { const cnt = Array(10).fill(0); digits.forEach((d) => cnt[d]++); let g = 0; for (let i = 0; i < 10; i++) g += i * cnt[i]; return 9 - (g % 9); };
  let bad = 0;
  for (let n = 0; n < 5000; n++) { const ds = C.digitsOf(n * 7919); if (appletGuess(ds) !== C.read(ds)) bad++; }
  equal("the applet's counting sum agrees with read()", bad, 0);
  let s = C.start(); [4, 4, 0].forEach((d) => { s = C.add(s, d); });
  equal("add, add, add, take back gives the first two", C.takeBack(s).digits, [4, 4]);
  equal("digitsOf", C.digitsOf(1905), [1, 9, 0, 5]);
}

done("math-telepathy");
