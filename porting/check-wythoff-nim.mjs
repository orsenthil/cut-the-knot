#!/usr/bin/env node
"use strict";

/*
 * Logic test for wythoff-nim/wythoff-nim-core.js.
 *
 *   1. The rules: the option range, both remove modes, refused clicks, turns,
 *      wins and losses, and the applet's messages.
 *   2. The maths: compute every losing position of the full game by dynamic
 *      programming, check it against the golden-ratio formula, and show exactly
 *      where the applet's own 24-pair table goes wrong.
 *   3. The computer: transcribe Play/MakeMove/MakeRandomMove from the bytecode
 *      into a second, heap-object implementation and compare it with the core
 *      on every board up to 40 counters, with several seeded random streams.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("wythoff-nim/wythoff-nim-core.js", "WythoffNimCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({ max: 15, second: 7 });
  equal("the chosen maximum sets heap one", s.heaps[0], 15);
  equal("the fixed second heap is used", s.heaps[1], 7);
  equal("the human starts", s.turn, "you");
  equal("one heap is the default mode", s.mode, "one");
  equal("no moves yet", s.moves, 0);
  check("a fresh board is not over", C.result(s) === null);
  check("the default maximum is 15", C.start({ second: 3 }).max === 15);

  equal("the maximum is clamped below", C.clampMax(0), 1);
  equal("the maximum is clamped above", C.clampMax(99), 40);
  equal("a fractional maximum is truncated", C.clampMax(7.9), 7);
  equal("a bad maximum falls back to 15", C.clampMax("x"), 15);
  check("the random heap is at least 3", C.randomSecond(15, () => 0) === 3);
  check("the random heap is at most the maximum", C.randomSecond(15, () => 0.999) === 15);
  check("max below three keeps the applet's quirk", C.randomSecond(1, () => 0.5) === 3);

  const one = C.legalMoves(s, "one");
  equal("one-heap mode offers 15 + 7 moves", one.length, 15 + 7);
  check("one-heap mode has no diagonal move", one.every((m) => m.type === "one"));
  const two = C.legalMoves(s, "two");
  check("two-heap mode offers diagonal moves", two.some((m) => m.type === "two"));
  check("two-heap mode also offers single-heap moves", two.some((m) => m.type === "one"));

  const first = C.move(s, { type: "one", heap: 0, remaining: 4 });
  equal("a one-heap move reduces that heap", first.heaps[0], 4);
  equal("the other heap is untouched", first.heaps[1], 7);
  equal("the turn passes to the computer", first.turn, "computer");
  equal("the move was counted", first.moves, 1);
  equal("the old position is untouched", s.heaps[0], 15);

  const both = C.move(s, { type: "two", heap: 0, remaining: 11 });
  equal("a two-heap click reduces both heaps", JSON.stringify(both.heaps), JSON.stringify([11, 3]));

  check("a click on the last counter leaves nothing and is refused",
    C.move(s, { type: "one", heap: 0, remaining: 15 }) === null);
  check("a click past the end is refused", C.move(s, { type: "one", heap: 0, remaining: 16 }) === null);
  check("a negative remainder is refused", C.move(s, { type: "one", heap: 0, remaining: -1 }) === null);
  check("a bad heap is refused", C.move(s, { type: "one", heap: 2, remaining: 0 }) === null);
  check("an unknown move is refused", C.move(s, { type: "sideways" }) === null);
  check("taking too many from both heaps is not allowed",
    C.move(s, { type: "two", heap: 0, remaining: 0 }) === null);

  const oneLeft = { max: 15, heaps: [1, 0], mode: "one", turn: "you", moves: 0 };
  const cleared = C.move(oneLeft, { type: "one", heap: 0, remaining: 0 });
  check("taking the last counter ends the game", C.isOver(cleared));
  equal("the human who took last wins", C.result(cleared), "win");
  const computerLast = C.move({ ...oneLeft, turn: "computer" }, { type: "one", heap: 0, remaining: 0 });
  equal("the computer taking last is a loss", C.result(computerLast), "lose");
}

/* ------------------------------------- 2. the losing positions and the table */

{
  const N = 64;
  const losing = Array.from({ length: N }, () => Array(N).fill(false));
  for (let sum = 0; sum <= 2 * (N - 1); sum++) {
    for (let a = 0; a < N; a++) {
      const b = sum - a;
      if (b < 0 || b >= N) continue;
      let p = true;
      for (let x = 0; x < a && p; x++) if (losing[x][b]) p = false;
      for (let y = 0; y < b && p; y++) if (losing[a][y]) p = false;
      for (let d = 1; d <= Math.min(a, b) && p; d++) if (losing[a - d][b - d]) p = false;
      losing[a][b] = p;
    }
  }
  const found = [];
  for (let a = 0; a < N; a++) for (let b = a; b < N; b++) if (losing[a][b]) found.push([a, b]);
  const expected = [];
  for (let k = 0; ; k++) {
    const pair = C.truePair(k);
    if (pair[1] >= N) break;
    expected.push(pair);
  }
  equal("the golden-ratio formula gives every losing position up to 63", found, expected);
  equal("there are 25 losing positions up to 63", found.length, 25);
  check("the empty board is losing for whoever must move", losing[0][0]);
  check("an equal non-empty pair is winning (both may be removed)", !losing[3][3]);
  check("the core agrees with the computed losing positions", (() => {
    for (const [a, b] of found) if (!C.cold([a, b])) return false;
    for (let a = 0; a < N; a++) {
      for (let b = 0; b < N; b++) {
        if (C.cold([a, b]) !== losing[a][b]) return false;
      }
    }
    return true;
  })());

  equal("the applet's table has 24 entries", C.PAIRS.length, 24);
  check("the first 20 entries are the true Wythoff pairs", (() => {
    for (let i = 0; i < 20; i++) {
      if (JSON.stringify(C.PAIRS[i]) !== JSON.stringify(C.truePair(i))) return false;
    }
    return true;
  })());
  equal("entry 20 in the applet is wrong by one", C.PAIRS[20], [32, 53]);
  equal("entry 21 in the applet is wrong", C.PAIRS[21], [33, 56]);
  equal("entry 22 in the applet is wrong", C.PAIRS[22], [35, 60]);
  equal("entry 23 in the applet is wrong", C.PAIRS[23], [37, 63]);
  check("all four wrong entries are reproduced faithfully", (() => {
    const right = [[32, 52], [33, 54], [35, 57], [37, 60]];
    for (let i = 20; i < 24; i++) {
      if (JSON.stringify(C.PAIRS[i]) === JSON.stringify(right[i - 20])) return false;
    }
    return true;
  })());
}

/* --------------------------- 3. the applet's method, transcribed a second time */

function appletComputer(heaps, rnd) {
  // The applet's vector never holds an empty heap: Cut(0) leaves no remainder.
  const v = heaps.filter((width) => width > 0).map((width) => ({ width, rem: null }));
  const cut = (h, k) => { h.rem = k === 0 ? null : { width: k, rem: null }; };
  const replace = (h) => {
    const i = v.indexOf(h);
    v.splice(i, 1);
    if (h.rem) v.push(h.rem);
  };
  const equalsSmall = (x) => C.PAIRS.findIndex((p) => p[0] === x);
  const equalsLarge = (x) => C.PAIRS.findIndex((p) => p[1] === x);
  const jint = (x) => Math.trunc(x);

  function randomMove(big, small) {
    if (rnd() >= 0.5) {
      const k = jint(rnd() * small.width);
      cut(small, k);
      const bigTo = big.width - small.width + k;
      replace(small);
      cut(big, bigTo);
      replace(big);
    } else {
      const h = rnd() < 0.5 ? big : small;
      cut(h, jint(rnd() * h.width));
      replace(h);
    }
  }

  function makeMove(big, small) {
    let idx = equalsSmall(small.width);
    if (idx !== -1) {
      if (big.width === C.PAIRS[idx][1]) return randomMove(big, small);
      if (big.width > C.PAIRS[idx][1]) {
        cut(big, C.PAIRS[idx][1]);
        replace(big);
        return;
      }
    }
    idx = equalsLarge(small.width);
    if (idx !== -1) {
      cut(small, C.PAIRS[idx][1]);
      replace(small);
      cut(big, C.PAIRS[idx][0]);
      replace(big);
      return;
    }
    const diff = big.width - small.width;
    if (diff >= C.PAIRS.length) throw new Error("applet would index past its table");
    if (small.width > C.PAIRS[diff][0]) {
      cut(big, C.PAIRS[diff][1]);
      replace(big);
      cut(small, C.PAIRS[diff][0]);
      replace(small);
    } else randomMove(big, small);
  }

  if (v.length === 0) {
    return [];
  } else if (v.length === 1) {
    cut(v[0], 0);
    replace(v[0]);
  } else if (v[0].width === v[1].width) {
    v.splice(0, 2);
  } else if (v[0].width > v[1].width) {
    makeMove(v[0], v[1]);
  } else {
    makeMove(v[1], v[0]);
  }
  return v.map((h) => h.width).sort((a, b) => a - b);
}

{
  let compared = 0;
  let safe = 0;
  for (const seed of [1, 7, 12345]) {
    for (let a = 0; a <= 40; a++) {
      for (let b = 0; b <= 40; b++) {
        // A fresh stream per board keeps a divergence in one case from
        // contaminating all the later ones.
        const key = seed * 100000 + a * 41 + b + 1;
        const rndApplet = rng(key);
        const rndCore = rng(key);
        const state = { max: 40, heaps: [a, b], mode: "two", turn: "you", moves: 0 };
        const diff = Math.abs(a - b);
        if (diff < C.PAIRS.length) {
          let expected;
          try {
            expected = appletComputer([a, b], rndApplet);
          } catch (err) {
            check(`no table error at ${a},${b}`, false, err.message);
            continue;
          }
          const m = C.computerMove(state, rndCore);
          const next = m && C.move(state, m);
          const actual = next ? next.heaps.filter((n) => n > 0).sort((x, y) => x - y) : [];
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            check(`computer agrees at ${a},${b}`, false, `${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
          } else compared++;
          safe++;
        } else if (a !== 0 || b !== 0) {
          // The applet would throw here; the port must keep playing.
          const m = C.computerMove(state, rndCore);
          const next = m && C.move(state, m);
          if (!next || next.heaps.some((n, i) => n < 0 || n > state.heaps[i]) ||
              !next.heaps.some((n, i) => n < state.heaps[i])) {
            check(`a wide board still gets a legal move at ${a},${b}`, false, JSON.stringify(next));
          }
        }
      }
    }
  }
  check("the computer matches the bytecode on every safe board", compared === safe && compared > 3000);
  equal("every safe board was compared three times", safe, 3 * 1375);
}

done("wythoff-nim");
