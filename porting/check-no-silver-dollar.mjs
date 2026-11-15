#!/usr/bin/env node
"use strict";

/* Exhaustive checks for No Silver Dollar's gap-Nim encoding and applet move. */
import { loadCore, check, equal, done } from "./lib/load-core.mjs";
const C = loadCore("no-silver-dollar/no-silver-dollar-core.js", "NoSilverDollarCore");

// A second transcription of the applet's CreateItinerary and MakeRightMove,
// written from the bytecode with its own loops: the best starts at 0 and an
// empty gap is skipped.
function refMove(pos) {
  const n = pos.length;
  let x = 0;
  for (let k = n - 1; k >= 0; k -= 2) x ^= k === 0 ? pos[k] : pos[k] - pos[k - 1] - 1;
  if (x === 0) return null;
  let best = 0, chosen = 0;
  for (let k = n - 1; k >= 0; k -= 2) {
    const g = k === 0 ? pos[k] : pos[k] - pos[k - 1] - 1;
    if (g === 0) continue;
    if (best < (g & x)) { best = g & x; chosen = k; }
  }
  const g = chosen === 0 ? pos[chosen] : pos[chosen] - pos[chosen - 1] - 1;
  const left = chosen === 0 ? 0 : pos[chosen - 1];
  return { chip: chosen, from: pos[chosen], to: chosen === 0 ? (x ^ g) : left + (x ^ g) + 1 };
}
function combinations(n, k, start = 0, pre = [], out = []) {
  if (pre.length === k) { out.push(pre); return out; }
  for (let i = start; i < n; i++) combinations(n, k, i + 1, pre.concat(i), out);
  return out;
}

let count = 0, bad = 0, mismatch = 0, xorBad = 0;
for (let length = 5; length <= 13; length++) {
  for (let n = 1; n <= Math.min(5, length); n++) {
    for (const positions of combinations(length, n)) {
      const s = { length, positions, turn: "computer", over: false, winner: null, moves: 0 };
      const expected = refMove(positions);
      const actual = C.winningMove(s);
      count++;
      if (JSON.stringify(expected) !== JSON.stringify(actual)) mismatch++;
      if (actual) {
        const after = positions.slice(); after[actual.chip] = actual.to;
        if (!(actual.to < actual.from && (!actual.chip || actual.to > positions[actual.chip - 1]))) bad++;
        if (C.nimSum({ positions: after }) !== 0) xorBad++;
      }
    }
  }
}
check(`applet's alternating-gap move matches in ${count} positions`, mismatch === 0, `${mismatch} mismatches`);
check("winning moves stay legal and leave zero Nim sum", bad === 0 && xorBad === 0, `${bad} illegal, ${xorBad} nonzero`);

{
  const values = [0.08, 0.42, 0.91]; let ri = 0;
  const s = C.start({ length: 25, chips: 3 }, () => values[ri++ % values.length]);
  equal("default length accepted", s.length, 25);
  equal("three counters start", s.positions.length, 3);
  check("starting counters are ordered and distinct", s.positions.every((p, i) => p >= 2 && (i === 0 || p > s.positions[i - 1])));
  check("each legal move shifts one counter into an empty earlier space", C.legalMoves(s).every(m => m.to < m.from && (!m.chip || m.to > s.positions[m.chip - 1])));
  check("start is in progress", s.over === false && s.winner === null);
  equal("length minimum is five", C.MIN_LENGTH, 5);
  equal("length maximum is thirty", C.MAX_LENGTH, 30);
  equal("counter maximum is twelve", C.MAX_CHIPS, 12);
  const invalid = C.move(s, { chip: 0, to: s.positions[0] });
  equal("a counter cannot stay in place", invalid, null);
  const firstMove = C.legalMoves(s)[0];
  const after = C.move(s, firstMove);
  check("a legal player move changes one position", after && after.moves === 1 && after.positions.filter((p, i) => p !== s.positions[i]).length === 1);
  equal("custom setup can reposition a counter", C.setupMove(s, 0, 0).positions[0], 0);
  equal("custom setup refuses an occupied space", C.setupMove(s, 0, s.positions[1]), null);
  equal("five squares allow two counters, as the applet's chip spinner does", C.start({ length: 5, chips: 12 }).positions.length, 2);
  equal("thirty squares allow twelve", C.maxChips(30), 12);
  equal("the computer does not move on the player's turn", C.computerMove(s), null);
  equal("the player moves first", s.turn, "you");
  equal("snapshot round-trips through restore", JSON.stringify(C.snapshot(C.restore(C.snapshot(s)))), JSON.stringify(C.snapshot(s)));
  let rejected = false; try { C.restore({ length: 5, positions: [1, 1], turn: "you" }); } catch { rejected = true; }
  check("restore rejects overlapping counters", rejected);
}

// The page's claim, by playing every position out: the player to move loses
// exactly when the Nim-sum of the alternate gaps is 0.
{
  let positions = 0, wrong = 0;
  for (let length = 5; length <= 16; length++) {
    const memo = new Map();
    const wins = (p) => {
      const key = p.join(",");
      if (memo.has(key)) return memo.get(key);
      let w = false;
      for (const m of C.legalMoves({ positions: p })) {
        const q = p.slice(); q[m.chip] = m.to;
        if (!wins(q)) { w = true; break; }
      }
      memo.set(key, w);
      return w;
    };
    for (let n = 1; n <= 7; n++) {
      for (const p of combinations(length, n)) {
        positions++;
        if (wins(p) !== (C.nimSum({ positions: p }) !== 0)) wrong++;
      }
    }
  }
  check(`zero Nim-sum is exactly a lost position (${positions} positions played out)`, wrong === 0, `${wrong} disagree`);
}

// The random move, for a Nim-sum of 0: always legal, and every legal move can come up.
{
  let illegal = 0, missed = 0, tried = 0;
  for (let length = 5; length <= 10; length++) {
    for (let n = 1; n <= 4; n++) {
      for (const positions of combinations(length, n)) {
        const s = { length, positions, turn: "computer", over: false, winner: null, moves: 0 };
        const legal = C.legalMoves(s);
        if (C.nimSum(s) !== 0 || !legal.length) continue;
        tried++;
        const seen = new Set();
        for (let a = 0; a < 40; a++) for (let b = 0; b < 40; b++) {
          const r = [(a + 0.5) / 40, (b + 0.5) / 40]; let i = 0;
          const m = C.computerChoice(s, () => r[i++]);
          if (!legal.some((x) => x.chip === m.chip && x.to === m.to)) illegal++;
          seen.add(`${m.chip}:${m.to}`);
        }
        if (seen.size !== legal.length) missed++;
      }
    }
  }
  check(`the random move is legal and reaches every legal move (${tried} lost positions)`, illegal === 0 && missed === 0, `${illegal} illegal, ${missed} boards with a move never made`);
}

// Small boards: every play ends, and it ends exactly when nobody can move.
let terminalStates = 0, illegalStates = 0;
for (let length = 5; length <= 9; length++) {
  for (let n = 1; n <= Math.min(4, length - 3); n++) {
    for (const start of combinations(length, n).filter(xs => xs[0] >= 2)) {
      const seen = new Set(), stack = [{ length, positions: start, turn: "you", over: false, winner: null, moves: 0 }];
      while (stack.length) {
        const s = stack.pop(), key = `${s.positions.join(",")}|${s.turn}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const none = C.legalMoves(s).length === 0;
        if (s.over !== none) illegalStates++;
        if (none) { terminalStates++; if (s.winner === s.turn) illegalStates++; continue; }
        if (s.turn === "you") for (const m of C.legalMoves(s)) stack.push(C.move(s, m));
        else stack.push(C.computerMove(s, () => 0), C.computerMove(s, () => 0.999));
      }
    }
  }
}
check(`play ends exactly when nobody can move, and the last mover wins (${terminalStates} endings)`, illegalStates === 0, `${illegalStates} incorrect`);

done("no-silver-dollar");
