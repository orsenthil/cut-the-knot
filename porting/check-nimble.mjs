#!/usr/bin/env node
"use strict";

/*
 * Logic test for nimble/nimble-core.js.
 *
 * Nimble is Nim in disguise: each chip's position is a Nim heap. A move
 * slides one chip left by any number of squares (at least one). Position 0
 * means the heap is gone. The player who moves the last chip to 0 wins.
 *
 * What is checked:
 *
 *   1. The Nim-sum (XOR of all chip positions) correctly decides who wins.
 *      Brute-force search over all reachable positions for 1-3 chips on
 *      boards of length ≤ 8 confirms the player to move loses iff XOR = 0.
 *   2. The computer's "right move" (MakeRightMove) always leaves a position
 *      with XOR = 0, verified over every non-zero-XOR position with up to
 *      3 chips on length ≤ 10.
 *   3. The random move is legal (dest < pos, dest ≥ 0).
 *   4. The page's claim: "Nimble is Nim in disguise", with the Sprague-Grundy
 *      function g(p) = p for a single chip at position p.
 *   5. start() places chips in the correct range, turns alternate, the game
 *      ends correctly.
 *   6. Whole games: from XOR=0 starts the computer beats random opponents;
 *      from XOR≠0 starts perfect first-player play always wins.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const N = loadCore("nimble/nimble-core.js", "NimbleCore");

/* ---------------------------------------------------- 1. Nim correctness */

// For 1-chip Nim, the Sprague-Grundy value is just the position.
for (let p = 0; p <= 30; p++) {
  const s = { length: 31, chips: [{ id: 0, pos: p }], turn: "you", over: false, winner: null, wins: 0, losses: 0 };
  const xor = N.nimSum(s);
  check(`single chip at ${p}: nimSum = ${p}`, xor === p);
}

// Brute-force: player to move loses exactly when XOR of positions is 0.
// Test all configurations of 1-3 chips on positions 0..7.
const memo = new Map();
function toMoveLoses(positions) {
  const key = positions.slice().sort((a, b) => a - b).join(",");
  if (memo.has(key)) return memo.get(key);
  // If all at 0, previous player won, so current player has lost (no moves).
  if (positions.every((p) => p === 0)) { memo.set(key, true); return true; }
  let loses = true;
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] === 0) continue;
    for (let dest = 0; dest < positions[i]; dest++) {
      const next = positions.slice();
      next[i] = dest;
      if (toMoveLoses(next)) { loses = false; break; }
    }
    if (!loses) break;
  }
  memo.set(key, loses);
  return loses;
}

let sgChecks = 0;
let sgMismatch = 0;
const MAX_POS = 8;
// 1 chip
for (let a = 0; a < MAX_POS; a++) {
  const xor = a;
  if (toMoveLoses([a]) !== (xor === 0)) sgMismatch++;
  sgChecks++;
}
// 2 chips
for (let a = 0; a < MAX_POS; a++) {
  for (let b = a; b < MAX_POS; b++) {
    const xor = a ^ b;
    if (toMoveLoses([a, b]) !== (xor === 0)) sgMismatch++;
    sgChecks++;
  }
}
// 3 chips
for (let a = 0; a < MAX_POS; a++) {
  for (let b = a; b < MAX_POS; b++) {
    for (let c = b; c < MAX_POS; c++) {
      const xor = a ^ b ^ c;
      if (toMoveLoses([a, b, c]) !== (xor === 0)) sgMismatch++;
      sgChecks++;
    }
  }
}
check(`Sprague-Grundy: XOR decides winner in all ${sgChecks} positions`, sgMismatch === 0, `${sgMismatch} mismatches`);

/* ------------------------------------------- 2. the computer's right move */

let rightChecks = 0;
let rightBad = 0;
const MAX_RM = 10;
// 1 chip
for (let a = 1; a < MAX_RM; a++) {
  const s = { length: MAX_RM, chips: [{ id: 0, pos: a }], turn: "computer", over: false, winner: null, wins: 0, losses: 0 };
  const m = N.rightMove(s);
  if (m) {
    if (m.dest < 0 || m.dest >= m.chip.pos) rightBad++;
    // After the move, XOR should be 0
    const afterXor = s.chips.reduce((x, c) => x ^ (c === m.chip ? m.dest : c.pos), 0);
    if (afterXor !== 0) rightBad++;
    rightChecks++;
  }
}
// 2 chips
for (let a = 0; a < MAX_RM; a++) {
  for (let b = 0; b < MAX_RM; b++) {
    const xor = a ^ b;
    if (xor === 0) continue;
    const s = { length: MAX_RM, chips: [{ id: 0, pos: a }, { id: 1, pos: b }], turn: "computer", over: false, winner: null, wins: 0, losses: 0 };
    const m = N.rightMove(s);
    if (!m) { rightBad++; rightChecks++; continue; }
    if (m.dest < 0 || m.dest >= m.chip.pos) rightBad++;
    const afterXor = s.chips.reduce((x, c) => x ^ (c === m.chip ? m.dest : c.pos), 0);
    if (afterXor !== 0) rightBad++;
    rightChecks++;
  }
}
// 3 chips
for (let a = 0; a < MAX_RM; a++) {
  for (let b = a; b < MAX_RM; b++) {
    for (let c = b; c < MAX_RM; c++) {
      const xor = a ^ b ^ c;
      if (xor === 0) continue;
      if (a === 0 && b === 0 && c === 0) continue;
      const s = { length: MAX_RM, chips: [{ id: 0, pos: a }, { id: 1, pos: b }, { id: 2, pos: c }], turn: "computer", over: false, winner: null, wins: 0, losses: 0 };
      const m = N.rightMove(s);
      if (!m) { rightBad++; rightChecks++; continue; }
      if (m.dest < 0 || m.dest >= m.chip.pos) rightBad++;
      const afterXor = s.chips.reduce((x, c2) => x ^ (c2 === m.chip ? m.dest : c2.pos), 0);
      if (afterXor !== 0) rightBad++;
      rightChecks++;
    }
  }
}
check(`right move leaves XOR=0 in all ${rightChecks} non-zero positions`, rightBad === 0, `${rightBad} bad`);

/* --------------------------------------------------- 3. the random move */

const random = rng(20261115);
{
  let illegal = 0;
  let trials = 0;
  for (let t = 0; t < 2000; t++) {
    // Create a position with XOR=0 so the computer uses randomMove
    const a = 1 + Math.trunc(random() * 10);
    const s = { length: 20, chips: [{ id: 0, pos: a }, { id: 1, pos: a }], turn: "computer", over: false, winner: null, wins: 0, losses: 0 };
    const m = N.computerMove(s, random);
    trials++;
    if (!m) { illegal++; continue; }
    if (m.dest < 0 || m.dest >= m.from) illegal++;
  }
  check(`random moves are legal in ${trials} trials`, illegal === 0, `${illegal} illegal`);
}

/* -------------------------------------------------- 4. page claims */

// "Nimble is Nim in disguise": g(p) = p for each chip.
// Already verified in section 1 (single chip nimSum = position).
// Also: "Each chip represents the size of a heap."
// Verified by the brute-force XOR check above.

/* ------------------------------------------ 5. start, moves, end of game */

{
  const s = N.start(7, 1, () => 0.5);
  equal("default: 1 chip", s.chips.length, 1);
  equal("chip placed in range [2, length-1]", s.chips[0].pos >= 2 && s.chips[0].pos < 7, true);
  equal("you move first", s.turn, "you");

  // Placement range check
  const placements = new Set();
  for (let i = 0; i < 5000; i++) {
    const t = N.start(7, 1, random);
    placements.add(t.chips[0].pos);
  }
  check("chips placed in [2, length-1]",
    [...placements].every((p) => p >= 2 && p <= 6),
    `out of range: ${[...placements].filter((p) => p < 2 || p > 6)}`
  );
  check("chips reach position 2", placements.has(2));
  check("chips reach position 6", placements.has(6));

  // A move to a higher or equal position is illegal
  const t = N.start(10, 1, () => 0.5);
  const chipId = t.chips[0].id;
  const chipPos = t.chips[0].pos;
  equal("move to same position is illegal", N.playerMove(t, chipId, chipPos), "illegal");
  equal("move to higher position is illegal", N.playerMove(t, chipId, chipPos + 1), "illegal");
  equal("move to negative is illegal", N.playerMove(t, chipId, -1), "illegal");

  // A legal move
  const res = N.playerMove(t, chipId, 0);
  equal("move to 0 is ok", res, "ok");

  // Game should be over (1 chip, moved to 0)
  check("game is over after last chip reaches 0", t.over && t.winner === "you");

  // Turn alternation
  const g = N.start(10, 2, () => 0.5);
  equal("turn starts with you", g.turn, "you");
  N.playerMove(g, g.chips[0].id, 0);
  if (!g.over) {
    equal("after your move it is computer's turn", g.turn, "computer");
    N.computerMove(g, random);
    if (!g.over) equal("after computer's move it is your turn", g.turn, "you");
  }
}

/* ---------------------------------------------------- 6. whole games */

{
  // From XOR=0 positions, computer should always win against random play
  let computerLost = 0;
  let games = 0;
  for (let t = 0; t < 2000; t++) {
    // Create a 2-chip position with XOR=0 (same positions)
    const p = 1 + Math.trunc(random() * 8);
    const s = {
      length: 12,
      chips: [{ id: 0, pos: p }, { id: 1, pos: p }],
      turn: "you", over: false, winner: null, wins: 0, losses: 0,
    };
    let steps = 0;
    while (!s.over && steps < 200) {
      steps++;
      // Random human move
      const active = s.chips.filter((c) => c.pos > 0);
      if (active.length === 0) break;
      const chip = active[Math.trunc(random() * active.length)];
      const dest = Math.trunc(random() * chip.pos);
      N.playerMove(s, chip.id, dest);
      if (!s.over) N.computerMove(s, random);
    }
    games++;
    if (s.over && s.winner !== "computer") computerLost++;
  }
  check(`computer wins all ${games} games from XOR=0`, computerLost === 0, `${computerLost} lost`);

  // From XOR≠0 positions, perfect first-player play always wins
  let firstLost = 0;
  let wins = 0;
  for (let t = 0; t < 2000; t++) {
    const a = 1 + Math.trunc(random() * 8);
    const b = Math.trunc(random() * 8);
    if ((a ^ b) === 0) continue;
    const s = {
      length: 12,
      chips: [{ id: 0, pos: a }, { id: 1, pos: b }],
      turn: "you", over: false, winner: null, wins: 0, losses: 0,
    };
    let steps = 0;
    while (!s.over && steps < 200) {
      steps++;
      // Perfect play: move to XOR=0
      const xor = N.nimSum(s);
      let moved = false;
      for (const c of s.chips) {
        if (c.pos === 0) continue;
        const newPos = c.pos ^ xor;
        if (newPos < c.pos && newPos >= 0) {
          N.playerMove(s, c.id, newPos);
          moved = true;
          break;
        }
      }
      if (!moved) {
        // Fallback: any legal move
        const active = s.chips.filter((c2) => c2.pos > 0);
        if (active.length > 0) N.playerMove(s, active[0].id, 0);
      }
      if (!s.over) N.computerMove(s, random);
    }
    wins++;
    if (s.over && s.winner !== "you") firstLost++;
  }
  check(`perfect first player wins all ${wins} games from XOR≠0`, firstLost === 0, `${firstLost} lost`);
}

done("nimble");
