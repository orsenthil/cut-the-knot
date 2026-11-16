#!/usr/bin/env node
"use strict";

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("scoring-misere/scoring-misere-core.js", "ScoringMisereCore");

const seq = (arr) => {
  let i = 0;
  return () => arr[i++] ?? 0;
};

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ nRings: 1, maxStep: 3, length: 8, positions: [5] });
  equal("one counter at 5", s.positions, [5]);
  equal("legal steps 1..3", C.legalMoves(s).map((m) => m.steps).sort().join(","), "1,2,3");
  const a = C.applyMove(s, 0, 2);
  equal("moved to 2", a.positions, [2]);
  equal("computer to play", a.turn, "computer");
}

{
  // Misère: last move loses
  let s = C.start({ positions: [1], maxStep: 3, length: 5, nRings: 1 });
  s = C.applyMove(s, 0, 0);
  check("moving last chip to 0 loses", s.over && s.winner === "computer");
}

{
  let s = C.start({ positions: [2], maxStep: 3, length: 5, nRings: 1 });
  s = C.applyMove(s, 0, 1); // you leave 1
  s = C.playComputer(s, () => 0);
  check("computer takes the last and you win", s.over && s.winner === "you");
}

/* ------------------------------------------- 2. strategies */

{
  // NormalStrategy: tower 5, maxStep 3 → rem 1 → leave 4
  equal("normal steps from 5", C.normalSteps(5, 3, () => 0), 1);
  // rem 0 → random 1..maxStep
  equal("normal rem0 uses rng", C.normalSteps(4, 3, () => 0.9), 3);
  // Misere: (5+3)%4 = 0 → random; (6+3)%4 = 1
  equal("misere from 6", C.misereSteps(6, 3, () => 0), 1);
}

{
  // CreateItinerary: single heap >1, even number of size-1 → MisereStrategy
  const s = C.start({
    positions: [5, 1, 1],
    maxStep: 3,
    length: 8,
    nRings: 3,
    turn: "computer",
  });
  // at1.length=2 even → misere on the 5: rem (5+3)%4=0 → rng
  const m = C.computerMove(s, () => 0.0); // steps = 1+0 = 1
  equal("even ones → misere on big", [m.index, m.to], [0, 4]);
}

{
  const s = C.start({
    positions: [5, 1],
    maxStep: 3,
    length: 8,
    nRings: 2,
    turn: "computer",
  });
  // at1.length=1 odd → NormalStrategy on 5: rem 1 → to 4
  const m = C.computerMove(s, () => 0);
  equal("odd ones → normal on big", [m.index, m.to], [0, 4]);
}

{
  // xor path: positions 3,3 maxStep 3 → rem 3^3=0 → random
  const s = C.start({
    positions: [3, 3],
    maxStep: 3,
    length: 8,
    turn: "computer",
  });
  // rnd first call is for 50% branch: >=0.5 → xor path; xor=0 → random
  const rnd = seq([0.6, 0.0, 0.0]);
  const m = C.computerMove(s, rnd);
  check("xor0 falls back to a legal move", m && m.to < s.positions[m.index]);
}

{
  // MakeRightMove: 2 and 3, maxStep 3 → rem 2^3=1
  const m = C.makeRightMove([2, 3], 3, 1);
  // bestAnd picks max(1&2=0, 1&3=1) → index 1 tower 3; amount = 1+0 =1 → to 2
  equal("right move cuts xor to 0", [m.index, m.to], [1, 2]);
}

/* ----------------------------- 3. deal / ranges */

{
  for (let n = 1; n <= 5; n++) {
    for (let step = 2; step <= 6; step++) {
      for (let len = 5; len <= 12; len++) {
        const pos = C.deal(n, step, len, () => 0.5);
        equal("deal length n=" + n, pos.length, n);
        check(
          "deal in range n=" + n + " s=" + step + " L=" + len,
          pos.every((p) => p >= 0 && p < len),
        );
      }
    }
  }
}

{
  // Single-counter misère: moving to 0 loses; leaving 1 wins.
  function toMoveWins(pos, maxStep) {
    for (let t = Math.max(0, pos - maxStep); t < pos; t++) {
      if (t === 0) continue; // last move loses
      if (!toMoveWins(t, maxStep)) return true;
    }
    return false;
  }
  check("pos 1 is a loss", toMoveWins(1, 3) === false);
  check("pos 2 is a win", toMoveWins(2, 3) === true);
  check("pos 4 is a win with M=3", toMoveWins(4, 3) === true);
}

done("scoring-misere");
