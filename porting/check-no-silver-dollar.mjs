#!/usr/bin/env node
"use strict";

/* Exhaustive checks for No Silver Dollar's gap-Nim encoding and applet move. */
import { loadCore, check, equal, done } from "./lib/load-core.mjs";
const C = loadCore("no-silver-dollar/no-silver-dollar-core.js", "NoSilverDollarCore");

function refMove(pos) {
  let x = 0;
  for (let i = pos.length - 1; i >= 0; i -= 2) x ^= i === 0 ? pos[0] : pos[i] - pos[i - 1] - 1;
  if (!x) return null;
  let best = -1, k = -1;
  for (let i = pos.length - 1; i >= 0; i -= 2) {
    const h = i === 0 ? pos[0] : pos[i] - pos[i - 1] - 1;
    if ((h & x) > best) { best = h & x; k = i; }
  }
  const h = k === 0 ? pos[0] : pos[k] - pos[k - 1] - 1;
  const to = k === 0 ? (h ^ x) : pos[k - 1] + (h ^ x) + 1;
  return { chip: k, from: pos[k], to };
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
  check("start is in progress", C.result(s) === null);
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
  equal("five spaces allow one counter", C.start({ length: 5, chips: 12 }, () => 0).positions.length, 1);
  equal("snapshot round-trips through restore", JSON.stringify(C.snapshot(C.restore(C.snapshot(s)))), JSON.stringify(C.snapshot(s)));
  let rejected = false; try { C.restore({ length: 5, positions: [1, 1], turn: "you" }); } catch { rejected = true; }
  check("restore rejects overlapping counters", rejected);
}

// Small boards: every reachable play terminates, and no move crosses a counter.
let terminalStates = 0, illegalStates = 0;
for (let length = 5; length <= 9; length++) {
  for (let n = 1; n <= Math.min(4, length - 3); n++) {
    for (const start of combinations(length, n).filter(xs => xs[0] >= 2)) {
      const seen = new Set(), stack = [{ length, positions: start, turn: "you", over: false, winner: null, moves: 0 }];
      while (stack.length) {
        const s = stack.pop(), key = `${s.positions.join(",")}|${s.turn}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!C.legalMoves(s).length) { terminalStates++; if (C.result(s) === null) illegalStates++; continue; }
        for (const m of C.legalMoves(s)) {
          const next = s.turn === "you" ? C.move(s, m) : C.computerMove(s, () => 0);
          if (next) stack.push(next);
        }
      }
    }
  }
}
check(`terminal boards all have no legal moves (${terminalStates} reached)`, illegalStates === 0, `${illegalStates} incorrect`);

done("no-silver-dollar");
