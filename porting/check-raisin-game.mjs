#!/usr/bin/env node
"use strict";

/*
 * Logic test for raisin-game/raisin-game-core.js.
 *
 *   node porting/check-raisin-game.mjs
 *
 * Checks the move rules, the page's even/odd strategy claim for every pair of
 * heaps up to 20, and that MakeGoodMove / Play match a second transcription.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("raisin-game/raisin-game-core.js", "RaisinGameCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ max: 10, random: false, heaps: [5, 5] });
  check("start is not over", C.result(s) === null && C.canMove(s));
  const bad = C.move(s, 0, 0);
  check("split at 0 refused", bad.note && /not allowed/i.test(bad.note));
  const ok = C.move(s, 0, 2);
  equal("split 5 after 2 leaves 2 and 3", ok.heaps, [2, 3]);
  check("after a human move it is the computer's turn", ok.turn === "computer");
}

{
  let s = C.start({ heaps: [2, 1], random: false });
  s = C.move(s, 0, 1); // leave (1,1)
  check("splitting the last long heap wins", s.over && C.result(s) === "win");
}

{
  let s = C.start({ heaps: [1, 1], random: false, turn: "computer" });
  // computer to move on (1,1) — should lose... but canMove is false. computerMove:
  const next = C.computerMove(Object.assign(C.start({ heaps: [2, 1], random: false }), { turn: "computer" }), () => 0);
  check("computer finishing wins for the computer", next.over && C.result(next) === "lose");
}

/* ------------------------------------------- 2. every case, where it is small */

{
  // Page claim: winning iff at least one heap even; from winning, a move to
  // both-odd exists; from both-odd (and not terminal), every move leaves an even.
  let positions = 0;
  for (let a = 1; a <= 20; a++) {
    for (let b = 1; b <= 20; b++) {
      const heaps = [a, b];
      const s = C.start({ heaps, random: false });
      const win = C.isWinning(heaps);
      const moves = C.legalMoves(s);
      positions++;
      if (a === 1 && b === 1) {
        check("(1,1) has no moves", moves.length === 0);
        check("(1,1) both odd (losing)", !win);
        continue;
      }
      if (!win) {
        // both odd: every move leaves a winning position for the opponent
        check(
          "from odd-odd every move leaves an even n=" + a + "," + b,
          moves.every((m) => C.isWinning([m.k, heaps[m.which] - m.k])),
        );
      } else {
        const toOdd = C.winningMoves(s);
        check("from a position with an even, a move to odd-odd exists " + a + "," + b, toOdd.length > 0);
      }
    }
  }
  check("walked 400 heap pairs", positions === 400);
}

{
  // Perfect play: from both-odd the player to move loses if the other always
  // answers to both-odd — checked by recursion on small sizes.
  const memo = new Map();
  function loserToMove(a, b) {
    if (a > b) return loserToMove(b, a);
    const key = a + "," + b;
    if (memo.has(key)) return memo.get(key);
    if (a === 1 && b === 1) {
      memo.set(key, true); // current loses
      return true;
    }
    const s = C.start({ heaps: [a, b], random: false });
    const moves = C.legalMoves(s);
    // Current loses iff every move leaves a position where opponent does not lose
    let lose = true;
    for (const m of moves) {
      const na = m.k;
      const nb = s.heaps[m.which] - m.k;
      if (loserToMove(na, nb)) {
        // opponent loses ⇒ we can win
        lose = false;
        break;
      }
    }
    if (moves.length === 0) lose = true;
    memo.set(key, lose);
    return lose;
  }
  for (let a = 1; a <= 12; a++) {
    for (let b = 1; b <= 12; b++) {
      const shouldLose = !C.isWinning([a, b]); // both odd
      check(
        "perfect-play loser matches both-odd " + a + "," + b,
        loserToMove(a, b) === shouldLose,
      );
    }
  }
}

/* ----------------------------- 3. the same answers as the applet's own method */

{
  function appletGood(size, rnd) {
    let k = 2 * Math.trunc(rnd() * Math.floor(size / 2)) + 1;
    return k;
  }
  function appletPlay(heaps, rnd) {
    let which = null;
    if (heaps[0] % 2 === 0) which = 0;
    if (heaps[1] % 2 === 0) {
      if (which === null) which = 1;
      else if (rnd() < 0.5) which = 0;
      else which = 1;
    }
    if (which !== null && heaps[which] >= 2) {
      return { which, k: appletGood(heaps[which], rnd) };
    }
    return null; // random path — skip compare
  }

  let compared = 0;
  for (let a = 2; a <= 16; a += 2) {
    for (let b = 1; b <= 16; b += 2) {
      const s = C.start({ heaps: [a, b], random: false, turn: "computer" });
      const rnd = () => 0.25;
      const core = C.chooseComputerMove(s, rnd);
      const ref = appletPlay([a, b], rnd);
      check("Play matches applet on even heap", core.which === ref.which && core.k === ref.k);
      check("good split leaves two odds", core.k % 2 === 1 && (a - core.k) % 2 === 1);
      compared++;
    }
  }
  check("compared many good moves", compared > 20);
}

{
  // Random deal: second heap in 3..max.
  for (let i = 0; i < 30; i++) {
    const s = C.start({ max: 15, random: true }, () => i / 30);
    check("random second heap in range", s.heaps[1] >= 3 && s.heaps[1] <= 15);
  }
}

done("raisin-game");
