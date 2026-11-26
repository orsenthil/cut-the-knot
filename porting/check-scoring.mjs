#!/usr/bin/env node
"use strict";

/*
 * Logic test for scoring/scoring-core.js.
 *
 *   node porting/check-scoring.mjs
 *
 * 1. The page's theory, by solving the game outright: for every MaxStep
 *    2..6, Length up to 12 and every placement of 1 to 3 counters, a
 *    position is lost for the player to move exactly when the xor of
 *    t mod (MaxStep+1) is 0; for one counter, exactly when its square is a
 *    multiple of MaxStep+1; g(t) by the mex rule is t mod (MaxStep+1).
 * 2. The computer: from every winning position it moves to a losing one
 *    (so it never lets a won game go), from a losing one it still makes a
 *    legal move; and its choice matches a second transcription of
 *    MakeRightMove / MakeRandomMove over the applet's ring order.
 * 3. The deal, the rules of a move, the end and the applet's messages.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("scoring/scoring-core.js", "ScoringCore");

/* ---------------------------------------------- 1. solve the game */
function solver(ms) {
  const memo = new Map();
  function win(pos) { // pos: sorted array of squares > 0
    const key = pos.join(",");
    if (memo.has(key)) return memo.get(key);
    let w = false;
    for (let i = 0; i < pos.length && !w; i++) {
      if (i > 0 && pos[i] === pos[i - 1]) continue;
      for (let k = 1; k <= ms && k <= pos[i]; k++) {
        const q = pos.slice(); q[i] -= k;
        const r = q.filter((v) => v > 0).sort((a, b) => a - b);
        if (!win(r)) { w = true; break; }
      }
    }
    memo.set(key, w);
    return w;
  }
  return win;
}

function* placements(len, n, from = 0) {
  if (n === 0) { yield []; return; }
  for (let t = from; t < len; t++) for (const rest of placements(len, n - 1, t)) yield [t, ...rest];
}

let positions = 0, theory = true, single = true, mex = true;
for (let ms = 2; ms <= 6; ms++) {
  const win = solver(ms);
  // mex rule for one counter
  const g = [];
  for (let t = 0; t < 30; t++) {
    const seen = new Set();
    for (let k = 1; k <= ms && k <= t; k++) seen.add(g[t - k]);
    let m = 0; while (seen.has(m)) m++;
    g.push(m);
    if (m !== C.value(t, ms)) mex = false;
  }
  for (let t = 0; t < 12; t++) if (win(t ? [t] : []) !== (t % (ms + 1) !== 0)) single = false;
  for (let n = 1; n <= 3; n++) for (const p of placements(12, n)) {
    positions++;
    const x = p.reduce((a, t) => a ^ (t % (ms + 1)), 0);
    if (win(p.filter((v) => v > 0)) !== (x !== 0)) theory = false;
  }
}
check("g(t) by the mex rule is t mod (MaxStep+1), MaxStep 2..6", mex);
check("one counter: lost for the mover exactly on multiples of MaxStep+1", single);
check(`with 1-3 counters, lost for the mover exactly when the nim-sum is 0 (${positions} positions)`, theory);

/* ---------------------------------------------- 2. the computer */
/** The applet's choice, written again from the bytecode over rings 0..n-1. */
function appletChoice(count, ms, r) {
  const st = C.start({ length: count.length, maxStep: ms, count });
  const rings = st.towers.map((t, id) => ({ id, t }));
  const top = (id) => { const s = st.stacks[st.towers[id]]; return s[s.length - 1] === id; };
  let L1 = 0;
  for (const ring of rings) L1 ^= ring.t % (ms + 1);
  if (L1 === 0) {
    let t = 0;
    for (const ring of rings) { if (ring.t === 0) continue; if (top(ring.id)) { t = ring.t; break; } }
    const L5 = Math.trunc(Math.min(ms * r + 1, t));
    return { from: t, to: Math.max(0, t - L5) };
  }
  let L4 = 0, L3 = 0;
  for (const ring of rings) {
    if (ring.t === 0 || !top(ring.id)) continue;
    if (L4 < (L1 & (ring.t % (ms + 1)))) { L4 = L1 & (ring.t % (ms + 1)); L3 = ring.id; }
  }
  const t = rings[L3].t;
  return { from: t, to: Math.max(0, t - (L4 - (L1 ^ L4))) };
}

let keeps = true, legal = true, same = true, tried = 0;
for (const ms of [2, 3, 4, 6]) for (const len of [5, 8, 11]) for (let n = 1; n <= 3; n++) for (const p of placements(len, n)) {
  if (p.every((t) => t === 0)) continue;
  const count = new Array(len).fill(0); p.forEach((t) => count[t]++);
  const s = { ...C.start({ length: len, maxStep: ms, count }), turn: "computer" };
  for (const r of [0, 0.37, 0.999]) {
    const m = C.computerMove(s, () => r);
    const a = appletChoice(count, ms, r);
    if (m.from !== a.from || m.to !== a.to) same = false;
    const next = C.move(s, m);
    if (!next) { legal = false; continue; }
    if (C.nimSum(s) !== 0 && C.nimSum(next) !== 0) keeps = false;
    tried++;
  }
}
check(`from every winning position the computer moves to a losing one (${tried} tries)`, keeps);
check("its move is always legal, even from a losing position", legal);
check("and the same as a second transcription of the applet's choice", same);

{
  // Against every reply, from a winning position the computer wins: play out exhaustively.
  function computerWins(s) {
    if (s.over) return s.winner === "computer";
    if (s.turn === "computer") return computerWins(C.playComputer(s, () => 0.5));
    return C.legalMoves(s).every((m) => computerWins(C.move(s, m)));
  }
  let all = true, n = 0;
  for (const ms of [2, 3]) for (const p of placements(9, 2)) {
    const count = new Array(9).fill(0); p.forEach((t) => count[t]++);
    const s = C.start({ length: 9, maxStep: ms, count });
    if (C.finished(s)) continue;
    // you move first; if you leave a winning position for the computer, it must win
    for (const m of C.legalMoves(s)) {
      const t = C.move(s, m);
      if (t.over || C.nimSum(t) === 0) continue;
      n++;
      if (!computerWins(t)) all = false;
    }
  }
  check(`whatever you reply, the computer wins once handed a winning position (${n} games)`, all);
}

/* ---------------------------------------------- 3. deal, rules, messages */
{
  const R = rng(7);
  let ok1 = true, okN = true;
  for (let i = 0; i < 3000; i++) {
    const ms = 2 + (i % 5), len = 5 + (i % 16);
    const one = C.deal(1, ms, len, R);
    const t = one.findIndex((v) => v);
    const span = Math.max(3, len % (ms + 1));
    if (one.reduce((a, b) => a + b) !== 1 || t < len - span) ok1 = false;
    const many = C.deal(4, ms, len, R);
    if (many.reduce((a, b) => a + b) !== 4 || many.some((v, k) => v && k < Math.min(ms - 1, len - 1))) okN = false;
  }
  check("one counter is dealt into the last max(3, Length mod (MaxStep+1)) squares", ok1);
  check("several counters are dealt from square MaxStep-1 on", okN);

  let s = C.start({ length: 8, maxStep: 3, count: [0, 0, 0, 0, 0, 1, 0, 0] });
  equal("defaults: 1 counter, Max Step 3, 8 squares", [C.start().nRings, C.start().maxStep, C.start().length].join(","), "1,3,8");
  check("a move longer than Max Step is refused", C.move(s, { from: 5, to: 1 }) === null);
  check("a move to the right is refused", C.move(s, { from: 5, to: 6 }) === null);
  check("an empty square cannot move", C.move(s, { from: 4, to: 3 }) === null);
  s = C.move(s, { from: 5, to: 4 });
  equal("you leave square 4, a multiple of 4: the computer is to move", s.turn, "computer");
  s = C.playComputer(s, () => 0);
  s = C.move(s, { from: s.towers[0], to: 0 });
  equal("you then move the last counter home and win", C.result(s), "win");
  equal("with the applet's message", C.message(s), "Congratulations! You won! It's now 0:1.");
  let u = C.start({ length: 8, maxStep: 3, count: [0, 0, 0, 0, 0, 1, 0, 0] });
  u = C.playComputer(C.move(u, { from: 5, to: 3 }));
  equal("from square 3 the computer goes home and wins", C.result(u), "lose");
  equal("I won! message", C.message(u), "I won! It's now 1:0.");
  check("the game is over: no more moves", C.legalMoves(u).length === 0 && C.move(u, { from: 0, to: 0 }) === null);
  const a = C.start({ length: 6, maxStep: 2, count: [0, 0, 0, 2, 0, 0] });
  const b = C.move(a, { from: 3, to: 2 });
  equal("only the top counter of a pile moves", b.last.id, 1);
  equal("hints: Forward, Backward, Modular", [1, 2, 3].map((h) => C.hintLabel(a, h, 4)).join("|"), "2|5|•");
  const before = JSON.stringify(a);
  C.move(a, { from: 3, to: 1 });
  equal("moves leave the old position alone", JSON.stringify(a), before);
}

done("scoring");
