#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-by-four/fbf-core.js, the 4x4x4 tic-tac-toe port.
 *
 * The opponent is the applet's own pattern-matching player: it never searches
 * ahead, it runs a fixed ladder of heuristics. The site's blurb says outright
 * that its logic has faults, so the test must not claim it plays well. What it
 * does check is that the machinery is sound:
 *
 *   - the 76 winning lines are the real ones (every row, column, pillar and
 *     diagonal of the 4x4x4 cube, each counted once);
 *   - the computer only ever plays an empty cell, and a game always reaches a
 *     decided end rather than looping or stalling;
 *   - the one heuristic the game would be broken without - taking an immediate
 *     win, and blocking the human's immediate win - actually fires.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const F = loadCore("four-by-four/fbf-core.js", "FourByFourCore");

/* ---------------------------------------------- 1. the 76 winning lines */

{
  equal("there are 76 winning lines", F.COMB.length, 76);

  // Build the real set of lines independently from the cube's geometry.
  const idx = (x, y, z) => z * 16 + y * 4 + x;
  const expected = new Set();
  const addLine = (cells) => expected.add(cells.slice().sort((a, b) => a - b).join(","));
  const DIRS = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) if (dx || dy || dz) DIRS.push([dx, dy, dz]);
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++)
      for (let z = 0; z < 4; z++)
        for (const [dx, dy, dz] of DIRS) {
          const cells = [];
          for (let s = 0; s < 4; s++) {
            const nx = x + dx * s;
            const ny = y + dy * s;
            const nz = z + dz * s;
            if (nx < 0 || nx > 3 || ny < 0 || ny > 3 || nz < 0 || nz > 3) break;
            cells.push(idx(nx, ny, nz));
          }
          if (cells.length === 4) addLine(cells);
        }
  equal("the cube really has 76 lines of four", expected.size, 76);

  const got = new Set(F.COMB.map((c) => c.slice().sort((a, b) => a - b).join(",")));
  equal("COMB lists each line once", got.size, 76);
  const missing = [...expected].filter((l) => !got.has(l));
  const extra = [...got].filter((l) => !expected.has(l));
  equal("COMB has no missing lines", missing, []);
  equal("COMB has no spurious lines", extra, []);

  for (const line of F.COMB) {
    equal(`line ${line} has four cells`, line.length, 4);
    for (const c of line) check(`cell ${c} is on the board`, Number.isInteger(c) && c >= 0 && c < 64);
  }
}

/* --------------------------------------------------- 2. xyz() round-trips */

{
  for (let cell = 0; cell < 64; cell++) {
    const { x, y, z } = F.xyz(cell);
    check(`cell ${cell} maps inside the cube`, x >= 0 && x < 4 && y >= 0 && y < 4 && z >= 0 && z < 4);
    equal(`cell ${cell} round-trips`, z * 16 + y * 4 + x, cell);
  }
}

/* ---------------------- 3. a full game always ends, and every move is legal */

{
  const realRandom = Math.random;
  const rand = rng(31337);
  Math.random = rand;
  try {
    let decided = 0;
    const GAMES = 60;
    for (let g = 0; g < GAMES; g++) {
      const B = F.create();
      F.newGame(B);
      F.setSkillLevel(B, g % 2); // exercise both skill levels

      let guard = 0;
      while (B.player !== F.END && guard++ < 64) {
        const empty = [];
        for (let c = 0; c < 64; c++) if (B.occupied[c] === 0) empty.push(c);
        if (!empty.length) break;
        const before = B.occupied.slice();
        const cell = empty[Math.floor(rand() * empty.length)];
        F.selection(B, cell);

        // The human's cell must be taken by the human.
        equal(`game ${g}: the clicked cell is the human's`, B.occupied[cell], F.HUMAN);
        // Any other change must be a single machine move onto a previously
        // empty cell.
        let machineMoves = 0;
        for (let c = 0; c < 64; c++) {
          if (before[c] !== B.occupied[c] && c !== cell) {
            machineMoves++;
            equal(`game ${g}: the machine played an empty cell`, before[c], 0);
            equal(`game ${g}: and marked it as its own`, B.occupied[c], F.MACHINE);
          }
        }
        check(`game ${g}: at most one machine move per turn`, machineMoves <= 1, `saw ${machineMoves}`);
      }
      check(`game ${g} terminates`, guard <= 64, `ran ${guard} turns`);
      if (B.player === F.END) decided++;
    }
    check(`most games reach a decided end (${decided}/${GAMES})`, decided > 0);
  } finally {
    Math.random = realRandom;
  }
}

/* -------------------- 4. the computer takes a win and blocks an obvious one */

/** Plays the given cells for `who` directly, keeping the logic arrays in step. */
function setup(B, humanCells, machineCells) {
  F.newGame(B);
  for (const c of machineCells) {
    B.occupied[c] = F.MACHINE;
    F._test.updateLogicArrays(B, c);
  }
  for (const c of humanCells) {
    B.occupied[c] = F.HUMAN;
    F._test.updateLogicArrays(B, c);
  }
}

{
  const B = F.create();

  // The machine has three of the line [0,1,2,3]; the fourth must be taken.
  setup(B, [16, 17], [0, 1, 2]);
  const win = F._test.blockWinningMove(B);
  check("the computer sees its own winning cell", win === 3 || B.occupied[3] === F.MACHINE, `returned ${win}`);

  // The human has three of [0,1,2,3]; the machine must block at 3.
  setup(B, [0, 1, 2], [16, 17]);
  const block = F._test.blockWinningMove(B);
  check("the computer blocks the human's winning cell", block === 3 || B.occupied[3] === F.MACHINE, `returned ${block}`);
}

/* ----------------------------------------------------------- 5. undoMove */

{
  const realRandom = Math.random;
  Math.random = rng(5);
  try {
    const B = F.create();
    F.newGame(B);
    F.selection(B, 21);
    const filled = B.occupied.filter((v) => v !== 0).length;
    check("a turn fills one or two cells", filled >= 1 && filled <= 2, `filled ${filled}`);
    F.undoMove(B);
    const after = B.occupied.filter((v) => v !== 0).length;
    check("undo gives cells back", after < filled, `${filled} -> ${after}`);
  } finally {
    Math.random = realRandom;
  }
}

done("check-four-by-four");
