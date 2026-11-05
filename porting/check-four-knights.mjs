#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-knights/knights-core.js.
 *
 * The puzzle: two red and two blue knights on the corners and edge-midpoints
 * of a 3x3 board, to be swapped using knight moves. The centre square is
 * unreachable by a knight, so the eight outer squares form a single cycle under
 * knight moves - that is the "second view of the board" the page is about.
 *
 * Once you see the cycle, the answer is forced: knights cannot pass each other
 * on a cycle, so their cyclic order never changes, and swapping the two colours
 * means rotating all four of them four places around an 8-cycle. That is 16
 * single-step moves, and no fewer.
 *
 * The test confirms the core really encodes that cycle, and that its BFS finds
 * 16 - the number is checked against an independent breadth-first search here,
 * not just asserted.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const K = loadCore("four-knights/knights-core.js", "KnightsCore");

/* ------------------------------------- 1. the eight outer squares form a cycle */

for (let ring = 1; ring <= 8; ring++) {
  const nb = K.neighbors(ring);
  equal(`ring ${ring} has two neighbours on the cycle`, nb.length, 2);
  for (const other of nb) {
    check(
      `the cycle is symmetric: ${ring} <-> ${other}`,
      K.neighbors(other).includes(ring),
      `neighbours of ${other} are ${K.neighbors(other)}`,
    );
  }
  check(`ring ${ring} is not its own neighbour`, !nb.includes(ring));
}

/* ------------------------- 2. each ring position maps to a real board square */

{
  const seen = new Set();
  for (let ring = 1; ring <= 8; ring++) {
    const c = K.cellOf(ring);
    check(`ring ${ring} maps to a square`, c && Number.isInteger(c.row) && Number.isInteger(c.col));
    check(`ring ${ring} is on the 3x3 board`, c.row >= 0 && c.row < 3 && c.col >= 0 && c.col < 3);
    check(`ring ${ring} is not the centre`, !(c.row === 1 && c.col === 1));
    const key = `${c.row},${c.col}`;
    check(`ring ${ring} has its own square`, !seen.has(key));
    seen.add(key);
    equal(`ringAt round-trips for ring ${ring}`, K.ringAt(c.row, c.col), ring);
  }
  equal("the eight outer squares are all used", seen.size, 8);
  equal("the centre square is not on the cycle", K.ringAt(1, 1), null);
}

/* -------------- 3. a knight move on the board is a single step on the cycle */

{
  const isKnightMove = (a, b) => {
    const dr = Math.abs(a.row - b.row);
    const dc = Math.abs(a.col - b.col);
    return (dr === 1 && dc === 2) || (dr === 2 && dc === 1);
  };
  for (let ring = 1; ring <= 8; ring++) {
    for (const other of K.neighbors(ring)) {
      check(
        `cycle step ${ring}->${other} is a real knight move`,
        isKnightMove(K.cellOf(ring), K.cellOf(other)),
        `${JSON.stringify(K.cellOf(ring))} -> ${JSON.stringify(K.cellOf(other))}`,
      );
    }
  }
}

/* ------------------------------------------------- 4. the starting position */

{
  const s = K.start();
  equal("four knights are on the board", Object.keys(s.occupied).length, 4);
  equal("the starting layout is the applet's", s.occupied, { 1: "red", 3: "red", 5: "blue", 7: "blue" });
  check("the start is not already solved", !K.isSolved(s));
  const solvedState = { occupied: { 1: "blue", 3: "blue", 5: "red", 7: "red" }, moves: 0 };
  check("the swapped layout counts as solved", K.isSolved(solvedState));
}

/* --------------------------- 5. moves only go to empty neighbouring squares */

{
  const s = K.start();
  for (const ring of [1, 3, 5, 7]) {
    for (const dest of K.legalMoves(s, Number(ring))) {
      check(`${ring}->${dest} lands on an empty square`, !(dest in s.occupied));
      check(`${ring}->${dest} is one step on the cycle`, K.neighbors(Number(ring)).includes(dest));
    }
  }
  equal("a knight cannot move onto an occupied square", K.legalMoves(s, 1).sort(), [2, 8]);
  const after = K.move(s, 1, 2);
  equal("moving leaves the old square empty", after.occupied[1], undefined);
  equal("moving fills the new square", after.occupied[2], "red");
  equal("moving counts a move", after.moves, s.moves + 1);
  check("the original state is not mutated", s.occupied[1] === "red" && !(2 in s.occupied));
}

/* ------- 6. the shortest solution is 16, confirmed by an independent search */

function independentBfs() {
  const key = (occ) =>
    Array.from({ length: 8 }, (_, i) => occ[i + 1] ?? ".").join("");
  const s0 = K.start();
  let frontier = [s0];
  const seen = new Set([key(s0.occupied)]);
  for (let depth = 0; depth <= 40; depth++) {
    for (const s of frontier) if (K.isSolved(s)) return depth;
    const next = [];
    for (const s of frontier) {
      for (const ring of Object.keys(s.occupied)) {
        for (const dest of K.legalMoves(s, Number(ring))) {
          const n = K.move(s, Number(ring), dest);
          const k = key(n.occupied);
          if (!seen.has(k)) {
            seen.add(k);
            next.push(n);
          }
        }
      }
    }
    if (!next.length) break;
    frontier = next;
  }
  return null;
}

const independent = independentBfs();
equal("an independent BFS finds 16 moves", independent, 16);
equal("shortestSolution() agrees", K.shortestSolution(), independent);

done("check-four-knights");
