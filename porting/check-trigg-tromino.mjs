#!/usr/bin/env node
"use strict";

/*
 * Logic test for trigg-tromino/trigg-tromino-core.js.
 *
 *   node porting/check-trigg-tromino.mjs
 *
 * 1. Placement follows the applet: neighbours only, no straight line of three,
 *    holes and covered squares refused, Remove last undoes a piece, finished
 *    when all 60 non-hole squares are covered (20 L-trominoes).
 * 2. Fault lines: a line between two rows (or columns) that no tromino
 *    straddles. Exhaustive search of every covering of the 8x8-with-hole
 *    board (3,427 tilings) checks Trigg's claims and Schwartz's addition:
 *    coverings exist with 0, 1, 2 and 3 fault lines, and none with 4 or more.
 * 3. Schwartz's lemmas on every covering found: no fault next to the rim,
 *    no two adjacent fault lines.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const T = loadCore("trigg-tromino/trigg-tromino-core.js", "TriggTrominoCore");

/* ------------------------------------------------------------ 1. the rules */

{
  const s = T.start();
  equal("board is 8 by 8", s.size, 8);
  check("centre four are holes", T.isHole(3, 3) && T.isHole(3, 4) && T.isHole(4, 3) && T.isHole(4, 4));
  equal("a hole click is refused", T.click(s, 3, 3), "refused");
  equal("first free square", T.click(s, 0, 0), "added");
  equal("a square that does not touch it starts again", T.click(s, 2, 2), "added");
  equal("restarted there", s.building, [[2, 2]]);
  T.click(s, 2, 1);
  equal("a straight third square restarts the piece", T.click(s, 2, 0), "added");
  equal("piece restarted at the refused square", s.building, [[2, 0]]);

  const t = T.start();
  T.click(t, 0, 0);
  T.click(t, 0, 1);
  equal("an L: (0,0), corner (0,1), (1,1)", T.click(t, 1, 1), "placed");
  equal("a covered square is refused", T.click(t, 0, 0), "refused");
  check("Remove last frees it", T.removeLast(t) && T.click(t, 0, 0) === "added");
  check("a fresh board is not finished", !T.finished(T.start()));
}

/* -------------------------------- 2. every covering: Trigg's fault counts */

{
  const SIZE = T.SIZE;
  const used = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  for (const key of T.HOLE) {
    const [r, c] = key.split(",").map(Number);
    used[r][c] = true;
  }
  const pieces = [];
  const hist = Object.create(null);
  let tilings = 0;
  let lemmaFails = 0;
  let badPieces = 0;
  let unfinished = 0;

  const isL = (cells) => {
    const rs = cells.map((c) => c[0]);
    const cs = cells.map((c) => c[1]);
    return (
      new Set(cells.map((c) => c.join())).size === 3 &&
      Math.max(...rs) - Math.min(...rs) === 1 &&
      Math.max(...cs) - Math.min(...cs) === 1
    );
  };

  function next() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) if (!used[r][c]) return [r, c];
    }
    return null;
  }

  function go() {
    const at = next();
    if (!at) {
      tilings++;
      const s = T.start();
      for (const p of pieces) {
        if (!isL(p)) badPieces++;
        T.placePiece(s, p);
      }
      if (!T.finished(s)) unfinished++;
      const f = T.faultCount(s);
      hist[f] = (hist[f] || 0) + 1;
      if (!T.lemmaOk(s)) lemmaFails++;
      return;
    }
    for (const shape of T.SHAPES) {
      const cells = shape.map(([dr, dc]) => [at[0] + dr, at[1] + dc]);
      if (cells.every(([r, c]) => r >= 0 && r < SIZE && c >= 0 && c < SIZE && !used[r][c])) {
        for (const [r, c] of cells) used[r][c] = true;
        pieces.push(cells);
        go();
        pieces.pop();
        for (const [r, c] of cells) used[r][c] = false;
      }
    }
  }
  go();

  // Re-check finished once (the loop above called check thousands of times —
  // replace with a single equal on tilings and hist).
  equal("every L covering uses real L pieces", badPieces, 0);
  equal("every covering finishes the board", unfinished, 0);
  equal("there are 3427 L-tromino coverings of the holed board", tilings, 3427);
  equal("fault-count histogram", hist, { 0: 1250, 1: 128, 2: 1, 3: 2048 });
  check("Trigg: a covering with no fault lines exists", (hist[0] || 0) > 0);
  check("Schwartz: a covering with exactly one fault line exists", (hist[1] || 0) > 0);
  check("Trigg: a covering with exactly two fault lines exists", (hist[2] || 0) > 0);
  check("Trigg: a covering with exactly three fault lines exists", (hist[3] || 0) > 0);
  check("Trigg: no covering has four or more fault lines", !hist[4] && !hist[5]);
  equal("Schwartz's lemmas hold on every covering", lemmaFails, 0);

  // Enter one covering through clicks (fault-free).
  const zero = T.findCovering(0);
  check("findCovering(0) finds a tiling", !!zero && zero.length === 20);
  const s = T.start();
  const touch = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  for (const p of zero) {
    const corner = p.find((a) => p.filter((b) => b !== a && touch(a, b)).length === 2);
    const ends = p.filter((a) => a !== corner);
    for (const cell of [ends[0], corner, ends[1]]) T.click(s, ...cell);
  }
  check("a fault-free covering can be clicked in", T.finished(s) && T.faultCount(s) === 0);
}

/* ----------------------------- 3. the four-fault case is the corner trap */

{
  // Schwartz: the only prospect for four faults is CD, EF, 34, 56 (lines 3,5
  // horizontal and 3,5 vertical). That isolates four 3x3 corner blocks, none
  // of which can be tiled with L-trominoes.
  const s = T.start();
  // Mark the "forced" seams by placing nothing across them and covering the
  // four 3x3 corners is impossible: 9 is not divisible by 3? Wait 9 IS
  // divisible by 3, but L-trominoes cannot tile a 3x3 (straight trominoes
  // would, Ls cannot — centre square problem / known).
  check("a 3 by 3 cannot be tiled with L-trominoes", (() => {
    // local mini-search
    const used = Array.from({ length: 3 }, () => Array(3).fill(false));
    const shapes = T.SHAPES;
    function next() {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (!used[r][c]) return [r, c];
      return null;
    }
    function go() {
      const at = next();
      if (!at) return true;
      for (const shape of shapes) {
        const cells = shape.map(([dr, dc]) => [at[0] + dr, at[1] + dc]);
        if (cells.every(([r, c]) => r >= 0 && r < 3 && c >= 0 && c < 3 && !used[r][c])) {
          for (const [r, c] of cells) used[r][c] = true;
          if (go()) return true;
          for (const [r, c] of cells) used[r][c] = false;
        }
      }
      return false;
    }
    return !go();
  })());
  check("findCovering(4) finds nothing", T.findCovering(4) === null);
  void s;
}

done("trigg-tromino");
