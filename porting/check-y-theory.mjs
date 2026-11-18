#!/usr/bin/env node
"use strict";

/*
 * Logic test for y-theory/y-theory-core.js.
 *
 *   1. The board model: sizes, cells, neighbours, triples, the majority rule,
 *      reduction, toggling and the three subgames.
 *   2. The page's claims, exhaustively for every colouring of Y_1..Y_5 and on a
 *      large deterministic sample of Y_6: exactly one winner on every board,
 *      reduction preserves the winner, and Meyers' "two of three subgames" rule
 *      agrees with it.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("y-theory/y-theory-core.js", "YTheoryCore");

/* ------------------------------------------------------------ 1. the model */

{
  equal("the size range starts at 1", C.MIN_N, 1);
  equal("the size range ends at 12", C.MAX_N, 12);
  equal("a small size is clamped", C.clampN(0), 1);
  equal("a large size is clamped", C.clampN(99), 12);
  equal("the default size is 7", C.clampN("x"), 7);

  const s = C.start({ n: 4, random: () => 0.1 });
  equal("a Y_4 board has 10 cells", s.cells.filter((v) => v !== null).length, 10);
  check("every cell is coloured", s.cells.filter((v) => v === null).length === s.cells.length - 10);
  check("a low random draw gives blue", s.cells[0] === C.BLUE);
  check("a high random draw gives red", C.start({ n: 3, random: () => 0.9 }).cells[0] === C.RED);
  check("the old board is untouched after a toggle", (() => {
    const next = C.toggle(s, 0);
    return next.cells[0] !== s.cells[0] && s.cells[0] === C.BLUE;
  })());
  equal("toggling twice returns to the start", C.toggle(C.toggle(s, 0), 0).cells[0], C.BLUE);
  check("a cell outside the board is ignored", C.toggle(s, 3 * 4 + 3) === s);

  equal("an interior cell of Y_5 has six neighbours", C.neighbours(5, C.index(5, 2, 1)).length, 6);
  equal("a corner of Y_3 has two neighbours", C.neighbours(3, C.index(3, 0, 0)).length, 2);
  equal("Y_5 has ten upward triangles", C.triples(5).length, 10);
  equal("Y_7 has 21 upward triangles", C.triples(7).length, 21);
  check("a triangle's three cells are mutually adjacent", (() => {
    for (const [a, b, c] of C.triples(7)) {
      const nb = C.neighbours(7, a);
      if (!nb.includes(b) || !nb.includes(c)) return false;
      if (!C.neighbours(7, b).includes(c)) return false;
    }
    return true;
  })());

  equal("majority of two blue and one red is blue", C.majority(C.BLUE, C.BLUE, C.RED), C.BLUE);
  equal("majority of two red and one blue is red", C.majority(C.RED, C.BLUE, C.RED), C.RED);
  equal("majority of three blue is blue", C.majority(C.BLUE, C.BLUE, C.BLUE), C.BLUE);

  const allBlue2 = C.start({ n: 2, random: () => 0 });
  const reduced = C.reduce(allBlue2);
  equal("reduction lowers the size by one", reduced.n, 1);
  equal("the reduced cell is blue", reduced.cells[0], C.BLUE);
  check("Y_1 cannot be reduced", C.reduce(reduced) === null);

  const allBlue3 = C.start({ n: 3, random: () => 0 });
  equal("a full blue Y_3 board has one six-cell chain", C.winningChain(allBlue3, C.BLUE).length, 6);
  check("red does not win an all-blue board", !C.winner(allBlue3, C.RED));
  check("a single cell touches all three sides", C.winner(C.start({ n: 1, random: () => 0 }), C.BLUE));
  check("a single cell of the other colour does not", !C.winner(C.start({ n: 1, random: () => 0.9 }), C.BLUE));

  for (const side of [0, 1, 2]) {
    const sub = C.subgame(allBlue3, side);
    equal(`subgame ${side} of Y_3 has size 2`, sub.n, 2);
    equal(`subgame ${side} of Y_3 has three cells`, sub.cells.filter((v) => v !== null).length, 3);
    check(`subgame ${side} of an all-blue board is an all-blue win`, C.winner(sub, C.BLUE));
  }
  check("Y_1 has no subgame", C.subgame(reduced, 0) === null);
}

/* ------------------------------------------- 2. every colouring, small n */

/** Calls fn for every way to colour the n(n+1)/2 cells of Y_n. */
function eachColoring(n, fn) {
  const slots = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) slots.push(C.index(n, i, j));
  const cells = Array(n * n).fill(null);
  for (let mask = 0; mask < 2 ** slots.length; mask++) {
    slots.forEach((id, bit) => { cells[id] = mask & (1 << bit) ? C.BLUE : C.RED; });
    fn({ n, cells: cells.slice() });
  }
}

for (const n of [1, 2, 3, 4, 5]) {
  let seen = 0;
  let exactlyOne = 0;
  let reductionPreserves = 0;
  let meyersAgrees = 0;
  eachColoring(n, (state) => {
    const blue = C.winner(state, C.BLUE);
    const red = C.winner(state, C.RED);
    if (blue !== red) exactlyOne++; // binary: exactly one of the two wins
    const both = C.winners(state);
    if (both.blue === blue && both.red === red) seen++;
    if (n > 1) {
      const smaller = C.reduce(state);
      if (C.winner(smaller, C.BLUE) === blue && C.winner(smaller, C.RED) === red) reductionPreserves++;
    } else reductionPreserves++;
    if (C.meyersWins(state, C.BLUE) === blue && C.meyersWins(state, C.RED) === red) meyersAgrees++;
  });
  const count = 2 ** (n * (n + 1) / 2);
  equal(`Y_${n}: every colouring was examined`, seen, count);
  equal(`Y_${n}: every colouring has exactly one winner`, exactlyOne, count);
  equal(`Y_${n}: reduction preserves the winner`, reductionPreserves, count);
  equal(`Y_${n}: two of three subgames gives the same winner`, meyersAgrees, count);
}

// Y_6 has 2^21 colourings; take a reproducible sample large enough to catch a
// broken chain or reduction on the bigger board.
{
  const n = 6;
  const rnd = rng(20261117);
  const slots = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) slots.push(C.index(n, i, j));
  let good = 0;
  const SAMPLES = 20000;
  for (let t = 0; t < SAMPLES; t++) {
    const cells = Array(n * n).fill(null);
    for (const id of slots) cells[id] = rnd() < 0.5 ? C.BLUE : C.RED;
    const state = { n, cells };
    const blue = C.winner(state, C.BLUE);
    const red = C.winner(state, C.RED);
    const smaller = C.reduce(state);
    if (blue === red) continue;
    if (C.winner(smaller, C.BLUE) !== blue || C.winner(smaller, C.RED) !== red) continue;
    if (C.meyersWins(state, C.BLUE) !== blue || C.meyersWins(state, C.RED) !== red) continue;
    good++;
  }
  equal("Y_6: sampled boards keep all three properties", good, SAMPLES);
}

done("y-theory");
