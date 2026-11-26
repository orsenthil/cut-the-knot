#!/usr/bin/env node
"use strict";

/*
 * Logic test for two-numbers/two-numbers-core.js.
 *
 *   node porting/check-two-numbers.mjs
 *
 * 1. The rules of the demo: no answer until a sum is entered, "done" after
 *    one, and Try again clears it.
 * 2. NewGuess: the ranges (even 2..10, odd 1..9), odd1 meaning "n is odd",
 *    and the exact choice order compared with a second transcription over
 *    many seeded random streams.
 * 3. The page's claim, exhaustively: for every pair of numbers, both orders,
 *    both multiplier instructions and every odd/even factor, a player who
 *    follows the instructions is named correctly by the parity of the sum.
 * 4. Guess(): the announcement compared with a second transcription of the
 *    bytecode over every n, m, odd1, odd2 and sum in a wide range.
 * 5. The quirks the claim glosses over: only the parity of the typed sum is
 *    read, so a mistyped sum flips the answer, and Java's % sends a negative
 *    odd sum down the "even" branch.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("two-numbers/two-numbers-core.js", "TwoNumbersCore");

/* A literal second reading of TwoNumbersCanvas.NewGuess (javap -c -p). */
function appletNewGuess(rand) {
  // dcmpg; ifge -> 0, fall-through -> 1, for both random flags.
  const odd1 = rand() < 0.5 ? 1 : 0;
  const odd2 = rand() < 0.5 ? 1 : 0;
  let n = ((rand() * 5) | 0) * 2 + 2;
  let m = ((rand() * 5) | 0) * 2 + 1;
  if (odd1) { const t = n; n = m; m = t; }
  return { n, m, odd1: !!odd1, odd2: !!odd2 };
}

/* A literal second reading of TwoNumbersCanvas.Guess(int). */
function appletGuess(s, sum) {
  const remainder = sum % 2; // Java irem, the same as JS % on integers
  const matches = remainder === (s.odd2 ? 1 : 0);
  return matches ? (s.odd1 ? s.n : s.m) : (s.odd1 ? s.m : s.n);
}

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start({ seed: 1 });
  check("a new puzzle has no announcement and the demo is not over", s.announcement === null && C.result(s) === null);
  const g = C.guess(s, 12);
  check("entering a sum ends the demo", C.result(g) === "done" && /^You chose \d+\.$/.test(g.announcement));
  const t = C.tryAgain(g);
  check("Try again clears the answer and asks for a new sum", C.result(t) === null && t.announcement === null && t.sum === null);
  check("another Try again gives another puzzle", C.tryAgain(t).seed === t.seed + 1);
  const before = JSON.stringify(g);
  C.guess(g, 7); C.tryAgain(g);
  equal("moves do not change the position they are given", JSON.stringify(g), before);
  check("only digits are accepted as a sum", C.guess(s, "12abc") === s && C.guess(s, "") === s);
}

/* --------------------------------------------- 2. NewGuess and its ranges */
{
  let ranges = true, firstIsOdd = true, parities = true;
  for (let seed = 1; seed <= 2000; seed++) {
    const p = C.newPuzzle(seed);
    ranges = ranges && C.EVENS.includes(p.n) === !p.odd1 && C.ODDS.includes(p.n) === !!p.odd1 &&
      C.EVENS.includes(p.m) === !!p.odd1 && C.ODDS.includes(p.m) === !p.odd1;
    firstIsOdd = firstIsOdd && (p.odd1 === (p.n % 2 === 1));
    parities = parities && (p.n % 2 !== p.m % 2);
  }
  check("2,000 generated puzzles stay inside the applet's ranges: 2..10 even, 1..9 odd", ranges);
  check("odd1 always means the first displayed number is odd", firstIsOdd);
  check("the two displayed numbers always have different parity", parities);

  // Same random stream into the core and into the bytecode transcription.
  const streams = [
    [0.01, 0.99, 0.999, 0.001], [0.4999, 0.5, 0, 0.9999], [0.5, 0.4999, 0.2, 0.8],
    [0.9999, 0.0001, 0.9999, 0.0001], [0.3, 0.7, 0.41, 0.59], [0.7, 0.3, 0.79, 0.21],
  ];
  for (let seed = 1; seed <= 300; seed++) { const r = C.rng(seed); streams.push([r(), r(), r(), r()]); }
  let same = 0;
  for (const stream of streams) {
    let i = 0, j = 0;
    const mine = C.newPuzzle(1, () => stream[i++]);
    const theirs = appletNewGuess(() => stream[j++]);
    const pick = (p) => JSON.stringify({ n: p.n, m: p.m, odd1: p.odd1, odd2: p.odd2 });
    if (pick(mine) === pick(theirs)) same++;
  }
  check(`NewGuess matches the bytecode on ${same}/${streams.length} random streams`, same === streams.length);
}

/* ------------------------------- 3. the page's claim, for every honest play */
{
  let cases = 0, wrong = 0, parityWrong = 0;
  for (const even of C.EVENS) for (const odd of C.ODDS) for (const odd1 of [false, true]) for (const odd2 of [false, true]) {
    const n = odd1 ? odd : even;
    const m = odd1 ? even : odd;
    const s = { n, m, odd1, odd2 };
    const chosenFactors = odd2 ? C.ODDS : C.EVENS;
    const otherFactors = odd2 ? C.EVENS : C.ODDS;
    for (const pickedFirst of [false, true]) {
      const chosen = pickedFirst ? n : m, other = pickedFirst ? m : n;
      for (const cf of chosenFactors) for (const of of otherFactors) {
        const sum = chosen * cf + other * of;
        const named = C.announce(s, sum).number;
        cases++;
        if (named !== chosen) wrong++;
        // Independently: the even number gives an even product; the odd
        // number's product has the parity of its multiplier.
        const shouldBeOdd = odd2 ? (chosen % 2 === 1) : (other % 2 === 1);
        if ((sum % 2 === 1) !== shouldBeOdd) parityWrong++;
      }
    }
  }
  check(`the page's claim holds in all ${cases} honest plays: the announced number is the one picked`, wrong === 0, `${wrong} wrong`);
  check(`the parity of the product sum follows the odd multiplier in all ${cases} plays`, parityWrong === 0, `${parityWrong} wrong`);
  check("every play has one even product and one odd-or-even product", C.EVENS.every((e) => e * 3 % 2 === 0) && C.ODDS.every((o) => o * 2 % 2 === 0));
}

/* ----------------------- 4. Guess(), compared with the bytecode everywhere */
{
  let cases = 0, wrong = 0;
  for (let n = 0; n <= 12; n++) for (let m = 0; m <= 12; m++) for (const odd1 of [false, true]) for (const odd2 of [false, true]) {
    const s = { n, m, odd1, odd2 };
    for (let sum = -8; sum <= 32; sum++) {
      const a = C.announce(s, sum);
      const expected = appletGuess(s, sum);
      cases++;
      if (a.number !== expected || a.text !== `You chose ${expected}.`) wrong++;
    }
  }
  check(`Guess matches the bytecode in all ${cases} states and sums`, wrong === 0, `${wrong} wrong`);
}

/* ------------------------------------------- 5. what the applet really reads */
{
  const s = { n: 3, m: 8, odd1: true, odd2: true };
  check("the applet reads only parity: sums of the same parity give the same answer",
    C.announce(s, 14).number === C.announce(s, 140).number && C.announce(s, 15).number === C.announce(s, 301).number);
  let flips = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const p = C.start({ seed });
    const a = C.announce(p, p.n + p.m).number; // this sum's parity is odd (even + odd)
    const b = C.announce(p, p.n + p.m + 1).number;
    if (a !== b) flips++;
  }
  check("typing a sum of the other parity makes the applet name the other number", flips === 5);
  check("Java % keeps a negative remainder: -3 % 2 is -1", C.javaRem(-3, 2) === -1 && C.javaRem(-4, 2) === 0);
  const neg = { n: 3, m: 8, odd1: true, odd2: true };
  check("a negative odd sum falls down the 'does not match' branch, unlike a positive one",
    C.announce(neg, -3).number === 8 && C.announce(neg, 3).number === 3);
  const words = C.instruction({ odd2: true });
  const otherWords = C.instruction({ odd2: false });
  equal("the applet's instruction lines use odd2 for the chosen multiplier", words, { chosenWord: "odd", otherWord: "even" });
  equal("and the reverse when odd2 is false", otherWords, { chosenWord: "even", otherWord: "odd" });
}

done("two-numbers");
