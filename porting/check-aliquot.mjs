#!/usr/bin/env node
"use strict";

/*
 * Logic test for aliquot/aliquot-core.js.
 *
 * The state space is tiny - the applet starts between 20 and 99 and the number
 * only ever shrinks - so everything here is exhaustive rather than sampled:
 *
 *   - aliquotParts really is the set of proper divisors;
 *   - the computer's move (the applet's FindFactor) is always a legal aliquot
 *     part, and from an even number always leaves an odd one;
 *   - the parity theory is the truth: a retrograde solve of the whole game
 *     agrees with "even wins, odd loses" for every n up to 2000;
 *   - the computer never loses from an even number however the human replies,
 *     exhaustively over every start and every reply;
 *   - and it does win from every even start, which is the claim the page makes.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const A = loadCore("aliquot/aliquot-core.js", "AliquotCore");

/* --------------------------------------------------- 1. the aliquot parts */

{
  equal("12 has aliquot parts 1,2,3,4,6", A.aliquotParts(12), [1, 2, 3, 4, 6]);
  equal("a prime has only 1", A.aliquotParts(7), [1]);
  equal("1 has no aliquot parts", A.aliquotParts(1), []);

  for (let n = 2; n <= 400; n++) {
    const parts = A.aliquotParts(n);
    const expected = [];
    for (let d = 1; d < n; d++) if (n % d === 0) expected.push(d);
    equal(`aliquotParts(${n}) is every proper divisor`, parts, expected);
    // Every part is a legal move, and nothing else is.
    for (let d = 0; d <= n; d++) {
      equal(`isLegalMove(${n}, ${d})`, A.isLegalMove(n, d), parts.includes(d));
    }
  }
}

/* ------------------------------------------------ 2. the computer's move */

{
  // The worked cases from reading AliquotCanvas.FindFactor.
  equal("from 12 the computer takes 3", A.findFactor(12), 3);
  equal("from 8 (a power of two) it takes 1", A.findFactor(8), 1);
  equal("from 7 (prime) it takes 1, not 7", A.findFactor(7), 1);
  equal("from 10 it takes 5", A.findFactor(10), 5);
  equal("from 9 it takes 3", A.findFactor(9), 3);

  for (let n = 2; n <= 2000; n++) {
    const f = A.findFactor(n);
    check(`findFactor(${n}) = ${f} is a legal move`, A.isLegalMove(n, f));
    if (A.isEven(n)) {
      check(`findFactor leaves an odd number from ${n}`, !A.isEven(n - f), `left ${n - f}`);
      // It is the smallest odd prime factor of n's odd part, or 1.
      let odd = n;
      while (A.isEven(odd)) odd /= 2;
      let want = 1;
      for (let i = 3; i <= odd; i++) if (odd % i === 0) { want = i; break; }
      equal(`findFactor(${n}) is the odd part's least factor >= 3`, f, want);
    } else {
      // An odd number is lost: every move hands back an even one.
      check(`findFactor leaves an even number from odd ${n}`, A.isEven(n - f), `left ${n - f}`);
    }
  }
}

/* ------------------------------------- 3. parity really is the whole theory */

{
  // Retrograde analysis, independent of the core: n is won by the mover iff
  // some aliquot part leaves the opponent a lost position. 1 is lost.
  const LIMIT = 2000;
  const won = new Array(LIMIT + 1).fill(false);
  for (let n = 2; n <= LIMIT; n++) {
    won[n] = A.aliquotParts(n).some((d) => !won[n - d]);
  }
  check("1 is a loss for the player facing it", !won[1]);
  for (let n = 1; n <= LIMIT; n++) {
    equal(`solver and isWinning agree on ${n}`, A.isWinning(n), won[n]);
  }
}

/* ------------------------- 4. the opponent never loses from an even number */

{
  // Exhaustive: every start the applet can deal, every human reply, all the way
  // down. The computer moves second (the human opens, as in the applet).
  //
  // humanToMove(n): true if the human, facing n, can beat this computer.
  const memo = new Map();
  function humanCanWin(n) {
    if (n === 1) return false; // handed 1, no move, human loses
    if (memo.has(n)) return memo.get(n);
    memo.set(n, false); // the game strictly decreases, so no cycles to guard
    let win = false;
    for (const d of A.aliquotParts(n)) {
      const after = n - d;
      if (after === 1) { win = true; break; } // computer handed 1, it loses
      const left = after - A.findFactor(after); // the computer's forced reply
      if (left === 1) continue;                 // human handed 1, this line loses
      if (humanCanWin(left)) { win = true; break; }
    }
    memo.set(n, win);
    return win;
  }

  let evenStarts = 0;
  let oddStarts = 0;
  for (let n = A.MIN_START; n <= A.MAX_START; n++) {
    if (A.isEven(n)) {
      // The human opens on an even number, so the human is the one who should
      // win - and against a correct opponent, every losing reply must lose.
      evenStarts++;
      check(`human opening on even ${n} can win`, humanCanWin(n));
      for (const d of A.aliquotParts(n)) {
        const after = n - d;
        if (after === 1) continue; // the human won outright
        if (!A.isEven(after)) continue; // the human played correctly
        // The human handed over an even number: the computer must now win.
        const left = after - A.findFactor(after);
        check(`after the blunder ${n} - ${d} the computer leaves odd`, !A.isEven(left));
        check(`the computer wins from the blunder ${n} - ${d}`, !humanCanWin(left));
      }
    } else {
      // The human opens on an odd number and is lost from the start.
      oddStarts++;
      check(`human opening on odd ${n} cannot win`, !humanCanWin(n));
    }
  }
  check("checked every even start in range", evenStarts === 49, `${evenStarts}`);
  check("checked every odd start in range", oddStarts === 49, `${oddStarts}`);
}

/* ------------------------------------------------- 5. the random start */

{
  for (let i = 0; i < 1000; i++) {
    const s = A.randomStart(Math.random);
    check(`randomStart in [${A.START_MIN}, ${A.START_MAX}]`, s >= A.START_MIN && s <= A.START_MAX, `${s}`);
    check("randomStart is an integer", Number.isInteger(s));
  }
  equal("randomStart(0) is the low end", A.randomStart(() => 0), 20);
  equal("randomStart(~1) is the high end", A.randomStart(() => 0.999999), 99);
}

done("check-aliquot");
