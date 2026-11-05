#!/usr/bin/env node
"use strict";

/*
 * Logic test for gergonne/gergonne-core.js.
 *
 * The trick: 27 numbers are dealt into 3 rows of 9. You pick one silently and
 * say which row it is in; the rows are gathered with the one you named in the
 * middle and dealt out again. Three rounds later the computer names your
 * number, and it is always the middle number of the middle row.
 *
 * This is a trick with no randomness in its outcome, so it can be checked
 * completely rather than sampled: for every one of the 27 numbers, over many
 * random deals, the test plays the three rounds answering truthfully and
 * confirms the number lands on the one cell the applet predicts.
 *
 * It also checks the reason it works -- the set of numbers still consistent
 * with the answers shrinks 27 -> 9 -> 3 -> 1 -- and that the applet's choice
 * of three piles is not arbitrary: the same construction corners the card for
 * 2, 3 and 5 piles but not for 4.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const G = loadCore("gergonne/gergonne-core.js", "GergonneCore");

/* --------------------------------------------------------------- 1. the deal */

{
  equal("the applet's three piles", G.DEFAULT_PILES, 3);
  equal("nine numbers to a pile: M = N^(N-1)", G.rowsPerPile(3), 9);
  equal("twenty-seven numbers: N^N", G.cardCount(3), 27);
  equal("three rounds", G.rounds(3), 3);
  // Reset()'s Loc = (M / 2, N / 2).
  equal("the trick always lands on the middle of the middle pile", G.finalCell(3), { col: 1, row: 4 });

  const rand = rng(2718);
  for (let t = 0; t < 50; t++) {
    const g = G.deal(3, rand);
    equal("three piles", g.piles.length, 3);
    for (const p of g.piles) equal("of nine", p.length, 9);
    const all = g.piles.flat().sort((a, b) => a - b);
    equal("holding 1..27 exactly once each", all, Array.from({ length: 27 }, (_, i) => i + 1));
    check("and not already finished", !G.finished(g));
  }
}

/* ----------------------------------------- 2. a pile is shown out of order */

{
  // at(): while the trick runs each pile is displayed through Aux[col], so the
  // player cannot follow a number's place inside a pile. The last step shows
  // the real order.
  const rand = rng(99);
  let scrambledSomewhere = 0;
  for (let t = 0; t < 50; t++) {
    const g = G.deal(3, rand);
    for (let c = 0; c < 3; c++) {
      const seen = Array.from({ length: 9 }, (_, r) => G.shown(g, c, r));
      equal(`pile ${c} shows all of its own numbers, just rearranged`,
        seen.slice().sort((a, b) => a - b), g.piles[c].slice().sort((a, b) => a - b));
      if (seen.some((v, r) => v !== g.piles[c][r])) scrambledSomewhere++;
    }
  }
  check(`the display really is shuffled (${scrambledSomewhere} of 150 piles)`, scrambledSomewhere > 120);

  let g = G.deal(3, rand);
  for (let r = 0; r < 3; r++) g = G.reportSelection(g, G.pileOf(g, 7));
  check("once finished, the display is the true order",
    [0, 1, 2].every((c) => Array.from({ length: 9 }, (_, r) => G.shown(g, c, r)).every((v, r) => v === g.piles[c][r])));
}

/* ------------------------ 3. every number, every deal, lands on that one cell */

{
  const rand = rng(31415);
  const { col, row } = G.finalCell(3);
  let plays = 0;
  let wrong = 0;
  for (let t = 0; t < 60; t++) {
    const start = G.deal(3, rand);
    for (let card = 1; card <= 27; card++) {
      let g = start;
      for (let r = 0; r < 3; r++) {
        check(`round ${r + 1} is not the end yet`, !G.finished(g));
        g = G.reportSelection(g, G.pileOf(g, card));
      }
      plays++;
      if (!G.finished(g)) { wrong++; continue; }
      if (g.piles[col][row] !== card || G.revealed(g) !== card) wrong++;
    }
  }
  equal(`all ${plays} plays ended on the middle of the middle pile`, wrong, 0);
  check(`that is 27 numbers over 60 deals`, plays === 27 * 60);

  // The same cell is the 14th number counting across the rows, which is what
  // makes the classic version of this trick "your card is the 14th of 27".
  equal("the middle cell is the 14th number in reading order", row * 3 + col + 1, 14);
}

/* ------------------------------ 4. why: the answers cut the field by three */

{
  // After k answers, only the numbers that were in every named pile are still
  // possible. That set is the whole trick: 27, then 9, then 3, then 1.
  const rand = rng(1234);
  for (let t = 0; t < 30; t++) {
    const start = G.deal(3, rand);
    for (const card of [1, 14, 27]) {
      let g = start;
      let candidates = g.piles.flat();
      equal("before any answer, any of the 27 could be it", candidates.length, 27);
      const sizes = [];
      for (let r = 0; r < 3; r++) {
        const sel = G.pileOf(g, card);
        candidates = candidates.filter((v) => g.piles[sel].includes(v));
        sizes.push(candidates.length);
        g = G.reportSelection(g, sel);
      }
      equal(`each answer divides the field by three (card ${card})`, sizes, [9, 3, 1]);
      equal(`and the one left is the card (${card})`, candidates, [card]);
    }
  }
}

/* ------------------- 4b. and the card is squeezed towards the centre */

{
  // The page claims a specific narrowing, in the piles' real order: after one
  // answer the card is in the middle three places of its pile, after two it is
  // in the middle place exactly, after three it is also in the middle pile.
  const rand = rng(606);
  const seen = [{ rows: new Set(), cols: new Set() }, { rows: new Set(), cols: new Set() },
                { rows: new Set(), cols: new Set() }];
  for (let t = 0; t < 40; t++) {
    const start = G.deal(3, rand);
    for (let card = 1; card <= 27; card++) {
      let g = start;
      for (let r = 0; r < 3; r++) {
        g = G.reportSelection(g, G.pileOf(g, card));
        const col = g.piles.findIndex((p) => p.includes(card));
        seen[r].rows.add(g.piles[col].indexOf(card));
        seen[r].cols.add(col);
      }
    }
  }
  const sorted = (set) => [...set].sort((a, b) => a - b);
  equal("after one answer: the middle three places of a pile", sorted(seen[0].rows), [3, 4, 5]);
  equal("after one answer: still any pile", sorted(seen[0].cols), [0, 1, 2]);
  equal("after two: the middle place exactly", sorted(seen[1].rows), [4]);
  equal("after two: still any pile", sorted(seen[1].cols), [0, 1, 2]);
  equal("after three: the middle place of the middle pile", [sorted(seen[2].cols), sorted(seen[2].rows)],
    [[1], [4]]);
}

/* --------------------- 5. three piles is not an arbitrary choice */

{
  // The same gather-in-the-middle construction with n piles and n rounds.
  const probe = (n, deals) => {
    const rand = rng(77 + n);
    let missed = 0;
    for (let t = 0; t < deals; t++) {
      const start = G.deal(n, rand);
      for (let card = 1; card <= G.cardCount(n); card++) {
        let g = start;
        for (let r = 0; r < G.rounds(n); r++) g = G.reportSelection(g, G.pileOf(g, card));
        if (G.revealed(g) !== card) missed++;
      }
    }
    return missed;
  };
  equal("2 piles: the construction corners the card", probe(2, 40), 0);
  equal("3 piles: so does the applet's own size", probe(3, 20), 0);
  equal("5 piles: and so does the next odd size", probe(5, 2), 0);
  // With an even number of piles above two there is no true middle to gather
  // into, and the trick does not close: every single play misses.
  check("4 piles: it fails, and not just occasionally", probe(4, 4) === 4 * G.cardCount(4),
    `missed ${probe(4, 4)} of ${4 * G.cardCount(4)}`);
}

done("gergonne");
