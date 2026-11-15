#!/usr/bin/env node
"use strict";

/*
 * Logic test for odd-scoring/odd-scoring-core.js.
 *
 *   node porting/check-odd-scoring.mjs
 *
 * Everything is tried: every band length, every position, every move. The
 * game is small (at most 25 steps, two parities), so nothing is sampled.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("odd-scoring/odd-scoring-core.js", "OddScoringCore");
const LENGTHS = [];
for (let n = C.MIN_STEPS; n <= C.MAX_STEPS; n += 2) LENGTHS.push(n);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the applet's default is 11 steps", s.steps, 11);
  equal("the lengths on offer are the odd numbers 1 to 25", LENGTHS.join(","), "1,3,5,7,9,11,13,15,17,19,21,23,25");
  check("a new game: chip at the right end, nobody has stepped, you move", s.left === 11 && s.you === 0 && s.computer === 0 && s.turn === "you" && !s.over);
  equal("an even length is made odd", C.start({ steps: 12 }).steps, 11);
  equal("too long is cut to 25", C.start({ steps: 99 }).steps, 25);
  equal("you may step 1, 2 or 3", C.legalMoves(s).join(","), "1,2,3");
  equal("0 steps is refused", C.move(s, 0), null);
  equal("4 steps is refused", C.move(s, 4), null);
  equal("half a step is refused", C.move(s, 1.5), null);
  const t = C.move(s, 2);
  check("a move adds to your steps and passes the turn", t.left === 9 && t.you === 2 && t.turn === "computer");
  equal("you cannot move on the computer's turn", C.move(t, 1), null);
  equal("the computer does not move on your turn", C.computerMove(s), null);
  const near = { steps: 3, left: 2, you: 0, computer: 1, turn: "you", over: false, winner: null };
  equal("near the end only the steps that are left", C.legalMoves(near).join(","), "1,2");
  equal("the chip cannot pass the last cell", C.move(near, 3), null);
  const won = C.move(near, 2);
  check("an even total wins", won.over && won.winner === "you" && won.you === 2);
  const one = C.move(C.start({ steps: 1 }), 1);
  check("one step: you must take it, and an odd total loses", one.over && one.winner === "computer");
  equal("a saved position reads back", JSON.stringify(C.snapshot(C.restore(C.snapshot(t)))), JSON.stringify(C.snapshot(t)));
  let refused = false;
  try { C.restore({ steps: 11, left: 5, you: 1, computer: 1, turn: "you" }); } catch { refused = true; }
  check("a position whose steps do not add up is refused", refused);
}

/* ------------------------------------------- 2. every case, where it is small */

// Every play from every start: it ends, the steps add up, exactly one total
// is even (so there is never a draw, as the page says), and that player wins.
{
  let plays = 0, wrong = 0;
  const walk = (s) => {
    if (s.over) {
      plays++;
      const evenYou = s.you % 2 === 0, evenComp = s.computer % 2 === 0;
      if (s.you + s.computer !== s.steps || evenYou === evenComp || (s.winner === "you") !== evenYou) wrong++;
      return;
    }
    for (const d of C.legalMoves(s)) walk(s.turn === "you" ? C.move(s, d) : { ...C.computerMove({ ...s }, () => (d - 0.5) / 3) });
  };
  // The computer's reply is fixed where it has an evaluation, so this walks
  // every player move against every computer reply the applet can make.
  for (const n of LENGTHS.filter((n) => n <= 15)) walk(C.start({ steps: n }));
  check(`every play ends with exactly one even total, and that player wins (${plays} plays)`, wrong === 0, `${wrong} wrong`);
}

// The true answer, by a second solver written on its own: who wins with
// perfect play, for every number of steps left and both parities.
{
  // lost[left][parity of the mover's own total]; the other's parity follows,
  // since the three numbers add up to an odd band.
  const lost = [[false, true]]; // nothing left: an odd total has lost, but nobody "moves" here
  const moverLoses = (left, mine) => {
    for (let d = 1; d <= Math.min(3, left); d++) {
      const after = left - d, mineAfter = (mine + d) % 2;
      if (after === 0) { if (mineAfter === 0) return false; continue; }
      // the other player's parity: band odd => theirs = 1 - (left + mine) % 2
      const theirs = (1 + left + mine) % 2;
      if (lost[after][theirs]) return false;
    }
    return true;
  };
  for (let left = 1; left <= 25; left++) lost.push([moverLoses(left, 0), moverLoses(left, 1)]);

  let differ = 0, pattern = 0;
  for (let left = 1; left <= 25; left++) for (const mine of [0, 1]) {
    const theirs = (1 + left + mine) % 2;
    if (C.moverWins(left, mine, theirs) === lost[left][mine]) differ++;
    const expected = mine === 0 ? [1, 4].includes(left % 8) : [0, 5].includes(left % 8);
    if (lost[left][mine] !== expected) pattern++;
  }
  check("the core's solver agrees with a second one, for every position", differ === 0, `${differ} differ`);
  check("lost positions repeat every 8: even total at 1 or 4, odd total at 0 or 5 (mod 8)", pattern === 0, `${pattern} off`);

  const youWin = LENGTHS.filter((n) => C.winningMoves(C.start({ steps: n })).length > 0);
  equal("with perfect play you win unless the length is 1, 9, 17 or 25", youWin.join(","), "3,5,7,11,13,15,19,21,23");
  equal("11 steps: the winning first move is 2", C.winningMoves(C.start({ steps: 11 })).join(","), "2");
  check("a winning move always leaves the other player lost", (() => {
    for (let left = 1; left <= 25; left++) for (const y of [0, 1]) {
      const s = { steps: 25, left, you: y, computer: (1 + left + y) % 2, turn: "you", over: false, winner: null };
      for (const d of C.winningMoves(s)) {
        const t = C.move(s, d);
        if (t.over ? t.winner !== "you" : C.winningMoves(t).length) return false;
      }
    }
    return true;
  })());
}

/* ----------------------------- 3. the same answers as the applet's own method */

// PileEvaluation, a second time from the bytecode: its tableswitch over 1 to
// 8, with Points[1] (the computer's steps) tested as "% 2 != 0".
function pileEvaluation(tower, points1) {
  const mod = tower % (3 + 1);
  if (tower > 8) return mod;
  const odd = points1 % 2 !== 0;
  switch (tower) {
    case 7: return odd ? 2 : 3;
    case 6: return odd ? 2 : 1;
    case 5: return odd ? 0 : 1;
    case 4: return odd ? 3 : 0;
    case 3: return odd ? 3 : 2;
    case 2: return odd ? 1 : 2;
    case 1: return 1;
    default: return 0;
  }
}
// CreateItinerary + MakeRightMove + MakeRandomMove: where the chip goes.
function appletTarget(tower, points1, random) {
  const e = pileEvaluation(tower, points1);
  if (e !== 0) return Math.max(0, tower - e);
  const step = Math.trunc(Math.min(3 * random + 1, tower));
  return Math.max(0, tower - step);
}

{
  let differ = 0, illegal = 0, tried = 0;
  for (let left = 1; left <= 25; left++) for (let comp = 0; comp <= 25 - left; comp++) {
    for (const r of [0, 0.2, 0.34, 0.5, 0.67, 0.9, 0.999]) {
      const you = 25 - left - comp;
      const s = { steps: 25, left, you, computer: comp, turn: "computer", over: false, winner: null };
      const t = C.computerMove(s, () => r);
      tried++;
      if (!t || t.left < 0 || left - t.left < 1 || left - t.left > 3) { illegal++; continue; }
      if (t.left !== appletTarget(left, comp, r)) differ++;
    }
  }
  check(`the computer moves as the applet does (${tried} positions and random draws)`, differ === 0 && illegal === 0, `${differ} differ, ${illegal} illegal`);

  // Where the applet's computer is right, and where it is not.
  const wrongAt = [];
  let rightNearEnd = true;
  for (let left = 1; left <= 25; left++) for (const comp of [0, 1]) {
    const s = { steps: 25, left, you: (1 + left + comp) % 2, computer: comp, turn: "computer", over: false, winner: null };
    const wins = C.winningMoves(s), e = C.evaluation(left, comp);
    const right = wins.length === 0 || wins.includes(e);
    if (!right) wrongAt.push(left);
    if (left <= 7 && !right) rightNearEnd = false;
  }
  check("with 7 steps or fewer left the applet's computer never misses a win", rightNearEnd);
  equal("further out it misses one at each of these", wrongAt.join(","), "8,10,11,12,14,15,16,18,19,20,22,23,24");

  // So the player can be sure of beating it from 17 and 25, which perfect play would lose.
  const sure = (s) => {
    if (s.over) return s.winner === "you";
    if (s.turn === "you") return C.legalMoves(s).some((d) => sure(C.move(s, d)));
    return [0.1, 0.5, 0.9].every((r) => sure(C.computerMove(s, () => r)));
  };
  equal("lengths from which the player can be sure of beating the applet", LENGTHS.filter((n) => sure(C.start({ steps: n }))).join(","), "3,5,7,11,13,15,17,19,21,23,25");
}

done("odd-scoring");
