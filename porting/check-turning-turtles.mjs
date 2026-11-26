#!/usr/bin/env node
"use strict";

/*
 * Logic test for turning-turtles/turning-turtles-core.js.
 *
 *   node porting/check-turning-turtles.mjs
 *
 * 1. The page's claim that this is Nim: over all 2^11 rows, the positions
 *    lost for the player to move (computed by game-tree search on the
 *    turtle rules themselves) are exactly those with Nim-sum 0.
 * 2. The computer: from every row with Nim-sum not 0 its move is legal and
 *    leaves Nim-sum 0 (the applet's own heap rule fails in 9 rows); from Nim-sum 0 it makes a legal move. So
 *    against every reply, starting from a winning row it always wins
 *    (checked over all rows and all replies).
 * 3. The moves: O to X plus one flip to the left, scores, the end.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("turning-turtles/turning-turtles-core.js", "TurningTurtlesCore");
const N = C.N, FULL = (1 << N) - 1;
const toX = (mask) => Array.from({ length: N }, (_, i) => !!((mask >> i) & 1)); // bit set = X
const moves = (mask) => {
  const out = [];
  for (let i = 0; i < N; i++) if (!((mask >> i) & 1)) {
    const m = mask | (1 << i);
    out.push([m, i, null]);
    for (let j = 0; j < i; j++) out.push([m ^ (1 << j), i, j]);
  }
  return out;
};

const win = new Int8Array(1 << N).fill(-1); // win for the player to move?
const W = (mask) => {
  if (win[mask] >= 0) return win[mask];
  if (mask === FULL) return (win[mask] = 0);
  // every move turns an O to X, adding at least... the flip can turn an X back to O, so recurse on the Nim-sum order:
  let w = 0;
  for (const [m] of moves(mask)) if (!W(m)) { w = 1; break; }
  return (win[mask] = w);
};
{
  // termination: sum of 2^i over O squares strictly decreases with every move
  let dec = true;
  const weight = (mask) => { let t = 0; for (let i = 0; i < N; i++) if (!((mask >> i) & 1)) t += 1 << i; return t; };
  for (let mask = 0; mask <= FULL; mask++) for (const [m] of moves(mask)) if (weight(m) >= weight(mask)) dec = false;
  check("every move lowers the binary number read from the O's, so games end", dec);
  let nim = true;
  for (let mask = 0; mask <= FULL; mask++) if ((W(mask) === 0) !== (C.nimSum(toX(mask)) === 0)) nim = false;
  check("all 2,048 rows: lost for the player to move exactly when the Nim-sum is 0", nim);
}

{
  let good = true, legal = true;
  for (let mask = 0; mask < FULL; mask++) {
    const s = { ...C.start({ x: toX(mask), seed: mask * 7 + 1 }), turn: "me" };
    const c = C.choose(s);
    if (!C.legal(s, c.i, c.j)) legal = false;
    const t = C.reply(s);
    if (C.nimSum(toX(mask)) !== 0 && C.nimSum(t.x) !== 0) good = false;
  }
  check("from every row the computer's move is legal", legal);
  let appletBad = 0;
  for (let mask = 0; mask < FULL; mask++) { const x = toX(mask), sum = C.nimSum(x); if (sum && (C.appletHeap(x) ^ sum) > C.appletHeap(x)) appletBad++; }
  equal("the applet's own heap rule asks for a flip to the right in 9 rows (fixed here)", appletBad, 9);
  check("and from every row with Nim-sum not 0 it leaves Nim-sum 0", good);
  // the computer, moving from a winning row, wins against every reply
  const memo = new Map();
  const beats = (mask, seed) => {
    const s = { ...C.start({ x: toX(mask), seed }), turn: "me" };
    const t = C.reply(s);
    if (t.winner === "me") return true;
    const k = t.x.reduce((a, v, i) => a | (v ? 1 << i : 0), 0);
    if (memo.has(k)) return memo.get(k);
    memo.set(k, true);
    let ok = true;
    for (const [m] of moves(k)) { if (m === FULL || !beats(m, (seed * 31 + m) >>> 0)) { ok = false; break; } }
    memo.set(k, ok);
    return ok;
  };
  let always = true;
  for (let mask = 0; mask < FULL; mask++) if (C.nimSum(toX(mask)) !== 0 && !beats(mask, 5)) always = false;
  check("moving from any row with Nim-sum not 0, the computer wins against every reply", always);
}

{
  let s = C.start({ x: toX(0b00000000101) }); // squares 1 and 3 are X; 2, 4..11 are O
  equal("O squares and their Nim-sum", C.nimSum(s.x), 2 ^ 4 ^ 5 ^ 6 ^ 7 ^ 8 ^ 9 ^ 10 ^ 11);
  check("a move must turn an O; the second square must be to its left", C.play(s, 0, null) === null && C.play(s, 3, 5) === null && C.play(s, 5, 0) !== null);
  const t = C.play(s, 5, 0);
  check("turning square 6 and flipping square 1: X at 6, O at 1, the computer to move", t.x[5] && !t.x[0] && t.turn === "me" && C.play(t, 1, null) === null);
  let e = C.start({ x: toX(FULL ^ 1) });
  e = C.play(e, 0, null);
  check("turning the last O wins and scores", e.winner === "you" && C.result(e) === "win" && e.score.you === 1 && C.reply(e) === null);
  const n = C.again(e);
  check("Reset deals a new row with some O, and keeps the score", n.score.you === 1 && !C.over(n) && n.turn === "you");
  let dealt = true, seed = 1;
  for (let k = 0; k < 500; k++) { const z = C.start({ seed: k }); if (C.over(z)) dealt = false; seed = z.seed; }
  check("random rows always have an O", dealt && seed > 0);
  const before = JSON.stringify(s);
  C.play(s, 5, 0);
  equal("a move leaves the old position alone", JSON.stringify(s), before);
}

done("turning-turtles");
