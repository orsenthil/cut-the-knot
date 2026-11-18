#!/usr/bin/env node
"use strict";

/*
 * Logic test for subtraction-game/subtraction-game-core.js.
 *
 *   1. The rules: option ranges, random boards, legal moves, refusals, turns,
 *      wins and losses.
 *   2. The page's claim: with consecutive subtrahends 1..s the game is the
 *      "Scoring" game, whose heap value is n mod (s+1). Check the mex table
 *      against an independent recursion and that claim for all s and all
 *      heap sizes up to 100; check that the good move restores a zero Nim-sum.
 *   3. The computer: Play/MakeGoodMove/MakeRandomMove transcribed a second time
 *      from the bytecode and compared on many boards over the whole option
 *      range with seeded random streams.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("subtraction-game/subtraction-game-core.js", "SubtractionGameCore");

/* ------------------------------------------------------------ 1. the rules */

{
  equal("minuend count is clamped low", C.clampNums(0), 1);
  equal("minuend count is clamped high", C.clampNums(99), 12);
  equal("subtrahend count is clamped high", C.clampSubs(99), 8);
  equal("maximum is clamped low", C.clampMax(1), 10);
  equal("maximum is clamped high", C.clampMax(999), 100);
  equal("a bad option falls back", C.clampMax("x"), 20);

  const s = C.start({ nnums: 4, nsubs: 3, max: 20, random: () => 0 });
  equal("four minuends", s.nums.length, 4);
  check("every minuend is at least one", s.nums.every((n) => n >= 1));
  check("every minuend is at most max", s.nums.every((n) => n <= 20));
  equal("the default subtrahends are 1..nsubs", s.subs.join(","), "1,2,3");
  equal("the human starts", s.turn, "you");
  equal("no moves yet", s.moves, 0);
  check("a fresh board is not over", C.result(s) === null);
  check("a fresh board has moves", C.legalMoves(s).length > 0);

  const given = C.start({ nnums: 3, nsubs: 2, max: 10, subs: [5, 2, 5], random: () => 0 });
  equal("custom subtrahends are sorted, duplicates kept as in the applet", given.subs.join(","), "2,5,5");
  check("custom subtrahends stay in 1..9", given.subs.every((v) => v >= 1 && v <= 9));

  const board = { ...s, nums: [9, 4, 1, 12], subs: [1, 3, 5] };
  equal("legal moves count heap by subtrahend", C.legalMoves(board).length, 3 + 2 + 1 + 3);
  const next = C.move(board, { heap: 0, sub: 5 });
  equal("a move subtracts from the chosen heap", next.nums[0], 4);
  equal("other heaps are untouched", next.nums.join(","), "4,4,1,12");
  equal("the turn passes to the computer", next.turn, "computer");
  equal("the move was counted", next.moves, 1);
  equal("the old board is untouched", board.nums[0], 9);
  check("taking too much is refused", C.move(board, { heap: 2, sub: 5 }) === null);
  check("an unknown subtrahend is refused", C.move(board, { heap: 0, sub: 7 }) === null);
  check("a bad heap is refused", C.move(board, { heap: 4, sub: 1 }) === null);
  check("a negative heap is refused", C.move(board, { heap: -1, sub: 1 }) === null);
  check("a missing move is refused", C.move(board, null) === null);

  const last = { ...board, nums: [2, 0, 0, 0], subs: [3, 5], turn: "you" };
  check("no move exists when every heap is below the smallest sub", C.isFinished(last));
  const won = C.move({ ...board, nums: [5, 0, 0, 0], subs: [3, 5], turn: "you" }, { heap: 0, sub: 5 });
  check("taking the last possible counters wins", C.result(won) === "win");
  const lost = C.move({ ...board, nums: [5, 0, 0, 0], subs: [3, 5], turn: "computer" }, { heap: 0, sub: 5 });
  equal("the computer taking last is a loss", C.result(lost), "lose");
  check("nothing can be moved after the game ends", C.legalMoves(won).length === 0);
}

/* ------------------------------------- 2. the mex table and the page's claim */

function grundyRef(subs, n, memo = new Map()) {
  if (n === 0) return 0;
  if (memo.has(n)) return memo.get(n);
  const seen = new Set();
  for (const s of subs) if (n >= s) seen.add(grundyRef(subs, n - s, memo));
  let g = 0;
  while (seen.has(g)) g++;
  memo.set(n, g);
  return g;
}

{
  const sets = [[1], [1, 2], [2], [1, 3], [2, 5], [1, 2, 3], [3, 4, 9], [1, 5, 7]];
  for (const subs of sets) {
    const table = C.grundy(subs, 60);
    const memo = new Map();
    let agrees = 0;
    for (let n = 0; n <= 60; n++) if (table[n] === grundyRef(subs, n, memo)) agrees++;
    equal(`mex table for ${subs.join(",")} matches the recursion`, agrees, 61);
  }

  let consecutive = 0;
  for (let s = 1; s <= 8; s++) {
    const subs = Array.from({ length: s }, (_, i) => i + 1);
    const table = C.grundy(subs, 100);
    for (let n = 0; n <= 100; n++) {
      if (table[n] === n % (s + 1)) consecutive++;
    }
  }
  equal("consecutive subtrahends give g(n) = n mod (s+1) throughout", consecutive, 8 * 101);

  // A good move exists from every non-zero Nim-sum board; it leaves a zero sum.
  let good = 0;
  let tested = 0;
  const rnd = rng(777);
  for (let t = 0; t < 3000; t++) {
    const s = C.start({ nnums: 1 + Math.floor(rnd() * 12), nsubs: 1 + Math.floor(rnd() * 8), max: 10 + Math.floor(rnd() * 91), random: rnd });
    const xor = C.nimSum(s);
    if (xor === 0) continue;
    tested++;
    const m = C.makeGoodMove(s, xor);
    if (!m) continue;
    const next = C.move(s, m);
    if (next && C.nimSum(next) === 0) good++;
  }
  check("every non-zero Nim-sum board has a move back to zero", good === tested && tested > 1000, `${good} of ${tested}`);
}

/* --------------------------- 3. the applet's method, transcribed again */

function appletComputer(state, rnd) {
  const subs = C.sortedSubs(state.subs);
  const table = new Array(state.max + 1).fill(0);
  for (let n = 1; n <= state.max; n++) {
    const options = [];
    for (const s of subs) if (n >= s) options.push(table[n - s]);
    let mex = 0;
    options.sort((a, b) => a - b);
    for (const v of options) {
      if (v === mex) mex++;
      else if (v > mex) break;
    }
    table[n] = mex;
  }
  const randomMove = () => {
    const legal = [];
    for (let i = 0; i < state.nums.length; i++) {
      if (subs[0] <= state.nums[i]) legal.push(i);
    }
    if (!legal.length) return null;
    const heap = legal[Math.floor(rnd() * legal.length)];
    const usable = subs.filter((s) => state.nums[heap] >= s);
    return { heap, sub: usable[Math.floor(rnd() * usable.length)] };
  };
  let xor = 0;
  for (const n of state.nums) xor ^= table[n];
  if (xor === 0) return randomMove();
  for (let heap = 0; heap < state.nums.length; heap++) {
    const size = state.nums[heap];
    if (size === 0) continue;
    const target = table[size] ^ xor;
    for (const sub of subs) {
      if (size >= sub && table[size - sub] === target) return { heap, sub };
    }
  }
  return randomMove();
}

{
  let compared = 0;
  for (const seed of [1, 7, 12345]) {
    const rndFor = rng(seed);
    for (let t = 0; t < 1000; t++) {
      const state = C.start({
        nnums: 1 + Math.floor(rndFor() * 12),
        nsubs: 1 + Math.floor(rndFor() * 8),
        max: 10 + Math.floor(rndFor() * 91),
        random: rndFor,
      });
      const key = seed * 1000000 + t * 7 + 1;
      const expected = appletComputer(state, rng(key));
      const actual = C.computerMove(state, rng(key));
      const move = actual && actual.move;
      if (JSON.stringify(move) !== JSON.stringify(expected)) {
        check(`computer agrees on board ${t} seed ${seed}`, false,
          `${JSON.stringify(move)} vs ${JSON.stringify(expected)}`);
      } else compared++;
    }
  }
  equal("the computer matches the bytecode on 3000 random boards", compared, 3000);
}

done("subtraction-game");
