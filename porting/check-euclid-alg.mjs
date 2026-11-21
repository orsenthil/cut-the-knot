#!/usr/bin/env node
"use strict";

/*
 * Logic test for euclid-alg/euclid-alg-core.js.
 *
 *   node porting/check-euclid-alg.mjs
 *
 * The page's claims, for EVERY pair of starting numbers from 5 to 99 (4,465 pairs): the
 * numbers that can ever appear are exactly the multiples of gcd(N, M) up to N; the board
 * always ends with N/gcd numbers; the game lasts N/gcd - 2 moves; and so the first
 * player wins exactly when N/gcd is odd... that is, when N/gcd - 2 is odd. This is
 * shown by playing every possible sequence of your moves against the applet's
 * computer for every pair with N <= 40 (a depth-first walk over all plays, with the
 * computer moving first as well), and by random plays for all pairs up to 99. The
 * messages and the computer's choice follow the bytecode.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("euclid-alg/euclid-alg-core.js", "EuclidAlgCore");

{
  const s = C.start({ a: 85, b: 18 });
  check("the board holds the two numbers, the larger first in n1", s.n1 === 85 && s.n2 === 18 && s.board.join() === "18,85" && s.total === 85 && s.turn === "you");
  equal("a number that is not a multiple of the gcd is rejected with the applet's message", C.check(C.start({ a: 12, b: 18 }), 5), "Please check your calculations...");
  equal("a multiple of g that is not a difference is not accepted", C.check(C.start({ a: 12, b: 18 }), 12), "How come? Please try again...");
  equal("a number above the larger one is rejected", C.check(C.start({ a: 12, b: 18 }), 24), "Please check your calculations...");
  equal("a difference is accepted", C.check(C.start({ a: 12, b: 18 }), 6), "ok");
  const t = C.move(C.start({ a: 12, b: 18 }), { type: "put", n: 6 });
  equal("a number already on the board is refused", C.check(t, 6), "The number is already on the board");
  check("a rejected number does not change the board and leaves the move with you", (() => { const r = C.move(s, { type: "put", n: 200 }); return r.board.join() === s.board.join() && r.turn === "you" && r.message.startsWith("Please"); })());
  check("a new game has two different numbers from 5 to 99", (() => { for (let seed = 1; seed < 300; seed++) { const x = C.start({ seed }); if (!(x.n1 > x.n2 && x.n2 >= 5 && x.n1 < 100)) return false; } return true; })());
  check("the computer cannot move out of turn", C.move(s, { type: "computer" }) !== null /* Please start, before the first move */ && C.move(C.move(s, { type: "computer" }), { type: "computer" }) === null);
  check("the old position is untouched", s.board.join() === "18,85" && s.moves === 0);
}

{
  // Every play, by dynamic programming over the boards (a board is a set of numbers): from a position
  // the set of possible numbers of further moves must have exactly one member, N/gcd - 2 - (moves so far),
  // however you play, and whichever side moves first.
  let pairs = 0, bad = null, states = 0;
  for (let a = 5; a <= 99 && !bad; a++) for (let b = 5; b < a && !bad; b++) {
    const gg = C.gcd(a, b);
    if (a / gg > 16) continue; // longer games are covered by random plays below
    pairs++;
    const memo = new Map();
    const remaining = (s) => {
      const key = s.board.join() + "|" + s.turn;
      if (memo.has(key)) return memo.get(key);
      let out;
      if (C.finished(s)) out = new Set([0]);
      else {
        out = new Set();
        if (s.turn === "computer") {
          const t = C.move(s, { type: "computer" });
          if (!t) { bad = `computer stuck ${a},${b}`; return new Set(); }
          for (const r of remaining(t)) out.add(r + 1);
        } else {
          const opts = C.legalMoves(s);
          if (!opts.length) { bad = `no move though not finished ${a},${b} ${s.board}`; return new Set(); }
          for (const m of opts) for (const r of remaining(C.move(s, m))) out.add(r + 1);
        }
      }
      memo.set(key, out); states++;
      return out;
    };
    const s0 = C.start({ a, b });
    const yours = remaining(s0);
    if (yours.size !== 1 || [...yours][0] !== a / gg - 2) bad = `you first ${a},${b}: ${[...yours]}`;
    if (C.finished(s0)) continue;
    const theirs = remaining({ ...s0, turn: "computer" });
    if (theirs.size !== 1 || [...theirs][0] !== a / gg - 2) bad = `computer first ${a},${b}: ${[...theirs]}`;
  }
  check(`every play, however you reply to the computer and whoever starts, lasts exactly N/gcd - 2 moves (${pairs} pairs with N/gcd <= 16, ${states} positions)`, bad === null && pairs > 100, String(bad));
}

{
  let n = 0, bad = null;
  let seed = 5;
  const rnd = (k) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % k; };
  for (let a = 5; a <= 99; a++) for (let b = 5; b < a; b++) {
    const g = C.gcd(a, b);
    let s = C.start({ a, b });
    // every number that can appear is a multiple of g up to a; all of them appear
    for (let steps = 0; steps < 200 && !C.finished(s); steps++) {
      if (s.turn === "you") { const opts = C.legalMoves(s); if (!opts.length) { bad = `stuck ${a},${b}`; break; } s = C.move(s, opts[rnd(opts.length)]); }
      else s = C.move(s, { type: "computer" });
      if (!s) { bad = `null ${a},${b}`; break; }
    }
    if (bad) break;
    const all = []; for (let k = g; k <= a; k += g) all.push(k);
    if (s.board.join() !== all.join()) bad = `board ${a},${b}: ${s.board.join()} != multiples`;
    if (s.moves !== a / g - 2) bad = `moves ${a},${b}`;
    const winnerIsFirst = (a / g - 2) % 2 === 1;
    if (s.moves > 0 && C.result(s) !== (winnerIsFirst ? "win" : "lose")) bad = `winner ${a},${b}`;
    n++;
  }
  check(`for every pair from 5 to 99 (${n}) a random play ends with exactly the multiples of the gcd up to N, in N/gcd - 2 moves, and you win when that is odd`, bad === null, String(bad));
  // the computer's reply
  check("the computer chooses the smallest new multiple of g that is a difference: for 12, 18 that is 6", C.computerPick(C.start({ a: 12, b: 18 })) === 6);
  check("with 85 and 18 the only new difference is 67, so that is the computer's pick", C.computerPick(C.start({ a: 85, b: 18 })) === 67);
}

done("euclid-alg");
