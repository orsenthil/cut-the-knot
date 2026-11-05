#!/usr/bin/env node
"use strict";

/*
 * Logic test for clone-escape/clones-core.js.
 *
 * The puzzle (Kontsevich's, by way of cut-the-knot): clones sit on the corner
 * of an infinite quarter plane. A clone splits into one copy below it and one
 * to its right, and the split only happens if both of those squares are free.
 * Empty the fenced-off prison in the corner.
 *
 * Give square (row, col) the weight 2^-(row+col). The split swaps 2^-(r+c) for
 * two copies of 2^-(r+c+1), so the total weight of the occupied squares never
 * changes -- that invariant is what makes the big prisons impossible. The test
 * checks it directly over every position reachable in a few moves rather than
 * taking the algebra on trust, confirms the five prisons are the applet's
 * (via PrisonIsEmpty's own M > 2 / M === 3 special cases) with the weights the
 * cut-the-knot page quotes, and then plays the puzzle: an iterative-deepening
 * search finds the shortest escape where one exists, and each answer is
 * replayed through the core's own split() to be sure it is legal and really
 * empties the prison.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("clone-escape/clones-core.js", "ClonesCore");
const key = (b) => b.join("");

/* --------------------------------------------------------- 1. the split rule */

{
  equal("the window is the applet's 10x10", C.N, 10);

  const b = C.startBoard(1);
  equal("one clone to start", C.occupied(b), [[0, 0]]);
  equal("it splits down and right", C.occupied(C.split(b, 0, 0)), [[0, 1], [1, 0]]);

  const two = C.split(b, 0, 0);
  equal("a split into an occupied square does not happen", C.split(two, 0, 1) && C.occupied(C.split(two, 0, 1)),
    [[0, 2], [1, 0], [1, 1]]);
  equal("blocked when the square below is taken", C.splitProblem(C.split(two, 0, 1), 1, 0), "blocked");
  equal("an empty square cannot be clicked", C.splitProblem(b, 3, 3), "empty");
  equal("the far edge of the window refuses", C.splitProblem(C.startBoard(10), 9, 0), "window");
  equal("off the board entirely", C.splitProblem(b, -1, 0), "offboard");
  equal("an illegal split returns null", C.split(b, 5, 5), null);

  equal("unsplit is the applet's Pop()", key(C.unsplit(C.split(b, 0, 0), 0, 0)), key(b));
}

/* ---------------------------------------- 2. weight is conserved by every split */

{
  // Every position reachable from one clone in up to 7 splits, checked
  // exhaustively: the occupied weight must still be exactly 1.
  let frontier = [C.startBoard(1)];
  const seen = new Set([key(frontier[0])]);
  let positions = 1;
  let splits = 0;
  for (let depth = 0; depth < 9; depth++) {
    const next = [];
    for (const board of frontier) {
      for (const [r, c] of C.legalSplits(board)) {
        splits++;
        const after = C.split(board, r, c);
        const w = C.occupiedWeight(after);
        if (Math.abs(w - 1) > 1e-12) {
          check(`split at ${r},${c} changed the total weight to ${w}`, false);
        }
        const k = key(after);
        if (!seen.has(k)) { seen.add(k); next.push(after); positions++; }
      }
    }
    frontier = next;
  }
  check(`weight held over ${splits} splits across ${positions} positions`, positions > 500, `only ${positions}`);

  // And from the bigger starting triangles, where the conserved total is not 1.
  const rand = rng(99);
  for (let d = 1; d <= 4; d++) {
    let board = C.startBoard(d);
    const w0 = C.occupiedWeight(board);
    for (let t = 0; t < 400; t++) {
      const moves = C.legalSplits(board);
      if (!moves.length) break;
      board = C.split(...[board, ...moves[Math.floor(rand() * moves.length)]]);
      if (Math.abs(C.occupiedWeight(board) - w0) > 1e-12) {
        check(`d=${d}: a random playout changed the weight to ${C.occupiedWeight(board)}`, false);
        break;
      }
    }
    equal(`d=${d}: the weight after a long random playout`, Math.round(C.occupiedWeight(board) * 1e9) / 1e9,
      Math.round(w0 * 1e9) / 1e9);
  }
}

/* ------------------------------------------- 3. the five prisons and their weights */

{
  // PrisonIsEmpty(): side = M > 2 ? M - 1 : M, and M === 3 is the square.
  equal("M=1 is the corner square", C.prisonCells(1), [[0, 0]]);
  equal("M=2 is the 3-square L", C.prisonCells(2), [[0, 0], [0, 1], [1, 0]]);
  equal("M=3 is the 2x2 square", C.prisonCells(3), [[0, 0], [0, 1], [1, 0], [1, 1]]);
  equal("M=4 is the 6-square triangle", C.prisonCells(4).length, 6);
  equal("M=5 is the 10-square triangle", C.prisonCells(5).length, 10);
  equal("the prison sizes the page names", C.PRISONS.map((p) => p.size), [1, 3, 4, 6, 10]);

  // 1, 2, 9/4, 11/4 and 13/4. The page quotes 11/4 for the 6-square triangle
  // and says the 10-square one leaves 3/4 outside, which needs 13/4 -- the
  // "15/4" printed next to it does not add up (1 + 2/2 + 3/4 + 4/8 = 13/4).
  equal("the prison weights", C.PRISONS.map((p) => p.weight), [1, 2, 2.25, 2.75, 3.25]);
  equal("the 6-square triangle leaves 5/4 outside, as the page says",
    C.BOARD_WEIGHT - C.prison(4).weight, 1.25);
  equal("the 10-square triangle leaves 3/4 outside, as the page says",
    C.BOARD_WEIGHT - C.prison(5).weight, 0.75);

  // The whole quarter plane weighs (sum 2^-i)^2 = 4, which is what the bound
  // is measured against. Summed here far enough to see it.
  let total = 0;
  for (let r = 0; r < 60; r++) for (let c = 0; c < 60; c++) total += C.weightAt(r, c);
  check(`the whole board weighs 4 (partial sum ${total.toFixed(6)})`, Math.abs(total - 4) < 1e-6);

  // The starting triangle of side d weighs the same as the prison of that shape.
  equal("start weights for d = 1..4", [1, 2, 3, 4].map((d) => C.occupiedWeight(C.startBoard(d))),
    [1, 2, 2.75, 3.25]);
}

/* ------------------------------------------------ 4. play each puzzle out */

/** Replays a solution through split() and says what went wrong, or null. */
function replay(d, m, moves) {
  let board = C.startBoard(d);
  for (const [r, c] of moves) {
    const next = C.split(board, r, c);
    if (!next) return `illegal split at ${r},${c} (${C.splitProblem(board, r, c)})`;
    board = next;
  }
  if (!C.prisonEmpty(board, m)) return "the prison still holds a clone";
  if (Math.abs(C.occupiedWeight(board) - C.occupiedWeight(C.startBoard(d))) > 1e-12) return "weight changed";
  return null;
}

{
  // From one clone: the corner square, the L and the 2x2 square can be
  // emptied; the 6-square and 10-square triangles cannot. That is exactly the
  // list on the cut-the-knot page.
  const found = {};
  for (let m = 1; m <= 5; m++) found[m] = C.solve(1, m, m <= 3 ? 12 : 16, 8e6);

  for (const m of [1, 2, 3]) {
    const moves = found[m];
    check(`M=${m}: an escape exists`, Array.isArray(moves), String(moves));
    if (Array.isArray(moves)) {
      equal(`M=${m}: the escape is legal and empties the prison`, replay(1, m, moves), null);
    }
  }
  equal("the shortest escapes, in splits", [1, 2, 3].map((m) => found[m].length), [1, 4, 8]);

  for (const m of [4, 5]) {
    // null, not undefined: the search exhausted every position up to 16 splits
    // rather than running out of budget. Twice what the 2x2 prison needs.
    equal(`M=${m}: no escape exists within 16 splits`, found[m], null);
  }
}

/* --------------------------------- 5. the weight bound never contradicts the search */

{
  // provablyStuck() is a one-way test: when it fires the puzzle really is
  // impossible, so the search must never find an escape for such a pair.
  equal("the 10-square prison is ruled out by weight alone", C.provablyStuck(1, 5), true);
  equal("the 6-square prison is not: 1 < 5/4", C.provablyStuck(1, 4), false);
  equal("three clones cannot even clear the L", C.provablyStuck(2, 2), true);
  equal("but three clones can be got off the corner square", C.provablyStuck(2, 1), false);

  let stuckPairs = 0;
  for (let d = 1; d <= 3; d++) {
    for (let m = 1; m <= 5; m++) {
      if (!C.provablyStuck(d, m)) continue;
      stuckPairs++;
      const moves = C.solve(d, m, 8, 6e5);
      check(`d=${d} M=${m}: weight says impossible, so no escape may be found`,
        !Array.isArray(moves), `found ${JSON.stringify(moves)}`);
    }
  }
  check(`checked ${stuckPairs} pairs the weight bound rules out`, stuckPairs >= 9, `only ${stuckPairs}`);

  // And where it allows an escape with one clone, the search finds one.
  for (let m = 1; m <= 3; m++) {
    check(`d=1 M=${m}: allowed by weight and really solvable`, !C.provablyStuck(1, m));
  }
  equal("d=2 M=1 is solvable too", replay(2, 1, C.solve(2, 1, 12, 4e6)), null);
}

done("clone-escape");
