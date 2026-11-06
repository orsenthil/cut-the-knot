#!/usr/bin/env node
"use strict";

/*
 * Logic test for euclid-game/euclid-game-core.js.
 *
 *   1. legal() and computerMove() against JEuclidGameGame's RecordMove() and
 *      Play(), transcribed again from the bytecode with its 0-based cells,
 *      on many positions from every grid size.
 *   2. The mathematics, for every starting pair on the biggest grid (all
 *      10,296 pairs from 1..144): the marked numbers can only ever be
 *      multiples of g = gcd(a, b) no bigger than the maximum, and every game
 *      - whatever moves are chosen - ends with all of them marked, so it lasts
 *      exactly max/g - 2 moves. Random play from every pair, many times,
 *      never differs.
 *   3. So the winner is fixed: whoever moves first wins exactly when
 *      max/g - 2 is odd, and you can always win by choosing whether to start.
 *   4. Start: two different numbers on the grid; sizes 4 to 12.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const E = loadCore("euclid-game/euclid-game-core.js", "EuclidGameCore");

/* ----------------------------------------------- 1. the applet's methods */

// Nums[k] is number k+1; N is the number of cells.
function appletRecord(Nums, N, Gcd, Max, k) {
  if (Nums[k] || Math.trunc((k + 1) / Gcd) * Gcd !== k + 1) return false;
  for (let i = Gcd - 1; i < Max; i += Gcd) {
    if (!Nums[i]) continue;
    for (let j = i + Gcd; j < Max; j += Gcd) {
      if (!Nums[j]) continue;
      if (k === j - i - 1) return true;
    }
  }
  return false;
}
function appletPlay(Nums, N, Gcd) {
  for (let i = Gcd - 1; i < N; i += Gcd) {
    if (!Nums[i]) continue;
    for (let j = i + Gcd; j < N; j += Gcd) {
      if (!Nums[j]) continue;
      if (!Nums[j - i - 1]) return j - i;
    }
  }
  return -1;
}

{
  const random = rng(21);
  let bad = 0;
  let positions = 0;
  for (let n = E.MIN_N; n <= E.MAX_N; n++) {
    for (let t = 0; t < 25; t++) {
      const s = E.start(n, random);
      for (let step = 0; step < 40 && !s.winner; step++) {
        const Nums = s.marked.slice(1).map((v) => v !== null);
        positions++;
        for (let x = 1; x <= n * n; x++) if (E.legal(s, x) !== appletRecord(Nums, n * n, s.g, s.max, x - 1)) bad++;
        if (E.computerMove(s) !== appletPlay(Nums, n * n, s.g)) bad++;
        const options = [];
        for (let x = 1; x <= n * n; x++) if (E.legal(s, x)) options.push(x);
        E.mark(s, options[Math.floor(random() * options.length)], s.turn);
      }
    }
  }
  check(`legal() and computerMove() match the applet on ${positions} positions`, bad === 0, `${bad} differ`);
}

/* --------------------------------------------- 2 and 3. the mathematics */

{
  const random = rng(5);
  const cells = 144;
  let pairs = 0;
  let wrongSet = 0;
  let wrongLength = 0;
  let wrongWinner = 0;
  for (let a = 1; a <= cells; a++) {
    for (let b = a + 1; b <= cells; b++) {
      pairs++;
      const f = E.forecast(E.fromPair(12, a, b));
      for (let t = 0; t < 2; t++) {
        const s = E.fromPair(12, a, b);
        s.turn = t % 2 ? "computer" : "you";
        const first = s.turn;
        for (;;) {
          // The legal moves are the new differences of marked numbers (legal() itself
          // is checked against the applet in section 1; this is the same set, faster).
          const marked = [];
          for (let x = s.g; x <= s.max; x += s.g) if (E.isMarked(s, x)) marked.push(x);
          const options = new Set();
          for (let i = 0; i < marked.length; i++) for (let j = i + 1; j < marked.length; j++) {
            const d = marked[j] - marked[i];
            if (!E.isMarked(s, d)) options.add(d);
          }
          if (!options.size) break;
          const list = [...options];
          E.mark(s, list[Math.floor(random() * list.length)], s.turn);
        }
        const markedSet = [];
        for (let x = 1; x <= cells; x++) if (E.isMarked(s, x)) markedSet.push(x);
        const expected = [];
        for (let x = s.g; x <= s.max; x += s.g) expected.push(x);
        if (markedSet.join() !== expected.join()) wrongSet++;
        if (s.moves !== f.total) wrongLength++;
        const firstWon = s.moves === 0 ? false : s.winner === first;
        if (s.moves > 0 && firstWon !== f.firstPlayerWins) wrongWinner++;
      }
    }
  }
  equal("starting pairs on the 12 by 12 grid", pairs, 10296);
  equal("every game ends with exactly the multiples of gcd up to the maximum", wrongSet, 0);
  equal("every game lasts max/gcd - 2 moves, whatever is played", wrongLength, 0);
  equal("the first player wins exactly when that number is odd", wrongWinner, 0);
}
{
  // A worked example: 12 and 30, gcd 6, ends with 6 12 18 24 30: 3 moves, so the first player wins.
  const s = E.fromPair(6, 12, 30);
  equal("12 and 30: gcd 6, 3 moves, first player wins", [s.g, E.forecast(s).total, E.forecast(s).firstPlayerWins], [6, 3, true]);
  check("18 = 30 - 12 is a legal first move", E.legal(s, 18));
  check("7 is not (not a multiple of 6)", !E.legal(s, 7));
  check("6 is not yet (no two marked numbers differ by 6)", !E.legal(s, 6));
}

/* -------------------------------------------------------- 4. start */

{
  const random = rng(8);
  let bad = 0;
  for (let t = 0; t < 3000; t++) {
    const n = E.MIN_N + (t % (E.MAX_N - E.MIN_N + 1));
    const s = E.start(n, random);
    if (s.a === s.b || s.a < 1 || s.b < 1 || s.a > n * n || s.b > n * n) bad++;
  }
  equal("start marks two different numbers on the grid", bad, 0);
  equal("sizes 4 to 12, 6 to start", [E.MIN_N, E.MAX_N, E.DEFAULT_N], [4, 12, 6]);
}

done("euclid-game");
