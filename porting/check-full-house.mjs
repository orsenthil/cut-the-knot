#!/usr/bin/env node
"use strict";

/*
 * Logic test for full-house/fullhouse-core.js.
 *
 * Full House: cover every free square of a grid with one path that may only
 * turn when the way ahead is shut. A move is therefore a whole slide, and the
 * puzzle is only a puzzle if that rule is implemented exactly - a path allowed
 * to stop early could cover almost any board.
 *
 * The strongest check available is the applet's own puzzle library. All 75
 * boards it ships (Positions5..Positions8) are solved here, and each solution
 * is then verified by a second, independent reading of the rule: consecutive
 * squares must be neighbours, no square may be used twice, every free square
 * must be used, and at every turn the path must have been unable to carry
 * straight on. If the slide rule were wrong - too loose or too tight - the
 * boards would not all come out solvable and the verifier would reject the
 * paths.
 *
 * The move, undo and dead-end machinery is then exercised on hand-made boards.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const F = loadCore("full-house/fullhouse-core.js", "FullHouseCore");

/* ----------------------------------------------------- 1. the puzzle library */

{
  equal("the four board sizes", F.SIZES, [5, 6, 7, 8]);
  equal("how many puzzles of each size",
    F.SIZES.map((s) => F.PUZZLES[s].length), [23, 28, 17, 7]);

  let problems = 0;
  for (const size of F.SIZES) {
    for (const puzzle of F.PUZZLES[size]) {
      const seen = new Set();
      for (const [r, c] of puzzle) {
        if (!Number.isInteger(r) || !Number.isInteger(c)) problems++;
        if (r < 0 || r >= size || c < 0 || c >= size) problems++;
        if (seen.has(`${r},${c}`)) problems++;
        seen.add(`${r},${c}`);
      }
      if (puzzle.length < 2 || puzzle.length >= size * size) problems++;
    }
  }
  check("every blocked square is on its board, and listed once", problems === 0, `${problems} problems`);
}

/* ------------------------------------- 2. every shipped puzzle can be solved */

/**
 * Read the rule back off a finished path, without using the core at all.
 * Returns an error string, or null when the path is legal and complete.
 */
function verifyPath(size, blocked, path) {
  const isBlocked = new Set(blocked.map(([r, c]) => `${r},${c}`));
  const seen = new Set();
  for (const [r, c] of path) {
    const k = `${r},${c}`;
    if (r < 0 || r >= size || c < 0 || c >= size) return `off the board at ${k}`;
    if (isBlocked.has(k)) return `walks over the blocked square ${k}`;
    if (seen.has(k)) return `visits ${k} twice`;
    seen.add(k);
  }
  if (seen.size !== size * size - isBlocked.size) return `covers ${seen.size} squares, not all of them`;

  // Walked so far, so "already walked over" can be judged at each step.
  const walked = new Set([`${path[0][0]},${path[0][1]}`]);
  for (let i = 1; i < path.length; i++) {
    const [pr, pc] = path[i - 1];
    const [r, c] = path[i];
    const dr = Math.sign(r - pr);
    const dc = Math.sign(c - pc);
    if (Math.abs(r - pr) + Math.abs(c - pc) !== 1) return `step ${i} is not to a neighbour`;
    // A turn is only allowed when the way straight ahead was shut.
    if (i >= 2) {
      const [qr, qc] = path[i - 2];
      const wasDr = Math.sign(pr - qr);
      const wasDc = Math.sign(pc - qc);
      const turned = wasDr !== dr || wasDc !== dc;
      if (turned) {
        const ar = pr + wasDr;
        const ac = pc + wasDc;
        const open = ar >= 0 && ar < size && ac >= 0 && ac < size
          && !isBlocked.has(`${ar},${ac}`) && !walked.has(`${ar},${ac}`);
        if (open) return `turns at ${pr},${pc} although it could have carried on`;
      }
    }
    walked.add(`${r},${c}`);
  }
  return null;
}

{
  let solved = 0;
  let bad = [];
  let replayFailures = 0;
  for (const size of F.SIZES) {
    F.PUZZLES[size].forEach((puzzle, i) => {
      const path = F.solve(size, puzzle);
      if (!path) { bad.push(`${size}x${size} #${i + 1}: no solution found`); return; }
      const why = verifyPath(size, puzzle, path);
      if (why) { bad.push(`${size}x${size} #${i + 1}: ${why}`); return; }
      solved++;

      // Replay it through the board's own clicks, slide by slide.
      const board = F.Board.fromLibrary(size, i);
      let at = 0;
      board.click(path[0][0], path[0][1]);
      at = 1;
      while (at < path.length) {
        // The next leg runs to the last square before the direction changes.
        const [pr, pc] = path[at - 1];
        const dr = Math.sign(path[at][0] - pr);
        const dc = Math.sign(path[at][1] - pc);
        let end = at;
        while (end + 1 < path.length
          && Math.sign(path[end + 1][0] - path[end][0]) === dr
          && Math.sign(path[end + 1][1] - path[end][1]) === dc) end++;
        const moved = board.click(path[end][0], path[end][1]);
        if (!moved) { replayFailures++; break; }
        at = end + 1;
      }
      if (!board.finished) replayFailures++;
    });
  }
  equal("all 75 shipped puzzles solve, and the paths obey the rule", bad, []);
  equal("solved", solved, 75);
  equal("and each solution replays through the board's own moves", replayFailures, 0);
}

/* ---------------------------------------------------- 3. what a slide does */

{
  // 5x5 with one blocked square in the middle of the top row.
  const b = new F.Board(5, [[0, 2]]);
  equal("24 free squares", b.empties, 24);
  check("nothing has started", !b.started && !b.finished);
  equal("a click on the blocked square is not a move", b.click(0, 2), null);

  equal("the path starts where you click", b.click(2, 0).map(String), ["2,0"]);
  equal("one square covered", b.path.length, 1);

  // Sliding right from (2,0) runs to the far wall, however near you click.
  const run = b.click(2, 1);
  equal("clicking the next square along still slides to the wall",
    run.map((x) => x.join(",")), ["2,1", "2,2", "2,3", "2,4"]);
  equal("the head is at the wall", b.head, [2, 4]);

  equal("a square out of line is not a move", b.click(0, 0), null);
  equal("and nor is a square behind a wall", b.click(2, 4), null);

  // Up from (2,4) to the top row, then left: the blocked square stops it.
  b.click(0, 4);
  equal("up to the top row", b.head, [0, 4]);
  equal("a square on the far side of a blocked one is not a move", b.click(0, 0), null);
  const left = b.click(0, 3);
  equal("the slide stops next to the blocked square", b.head, [0, 3]);
  equal("covering one square", left.length, 1);

  // Its own path blocks it too.
  b.click(1, 3);  // down from (0,3): stops above (2,3), which is already walked
  equal("the path's own trail stops a slide", b.head, [1, 3]);

  const legs = b.legs.length;
  const undone = b.undo();
  equal("undo takes back one slide", [b.legs.length, b.head], [legs - 1, [0, 3]]);
  equal("and frees the squares it covered", undone.cells.length, 1);
  check("those squares can be used again", b.click(1, 3) !== null);

  check("canClick agrees with click", (() => {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const before = b.path.length;
        const said = b.canClick(r, c);
        const did = b.click(r, c) !== null;
        if (said !== did) return false;
        while (b.path.length > before) b.undo();
      }
    }
    return true;
  })());

  b.reset();
  check("reset clears the path", !b.started && b.path.length === 0);
  equal("and the blocked square survives it", b.grid[0][2], F.BLOCKED);
}

/* ------------------------------------------------------ 4. getting stuck */

{
  // Start in a corner of a clear 5x5 and go round the outside: after four
  // slides the path is back at its start's neighbour and walled in.
  const b = new F.Board(5, [[2, 2], [2, 3]]);
  b.click(0, 0);
  b.click(0, 4);   // right along the top
  b.click(4, 4);   // down the right edge
  b.click(4, 0);   // left along the bottom
  b.click(1, 0);   // up the left edge, stopping below the start
  check("the loop closes on itself", b.head[0] === 1 && b.head[1] === 0);
  equal("only one way out is left", b.availableDirections().map((d) => d.name), ["right"]);
  b.click(1, 3);   // right, stopping short: (1,4) is already on the path
  equal("the last slide is cut short by the path itself", b.head, [1, 3]);
  check("and now the path is stuck", b.stuck);
  check("stuck is not finished", !b.finished);
  equal("with four squares walled off behind it", b.empties - b.path.length, 4);
  b.undo();
  check("stepping back unsticks it", !b.stuck);
}

/* -------------------------------------------------- 5. a board is winnable */

{
  const b = F.Board.fromLibrary(5, 0);
  equal("the first 5x5 puzzle has two blocked squares", b.blocked.length, 2);
  const path = F.solve(5, b.blocked);
  check("it has a solution", Boolean(path));
  check("the solution is legal", verifyPath(5, b.blocked, path) === null);

  // fromLibrary wraps round, so the puzzle number can be stepped forever.
  equal("puzzle numbers wrap", F.Board.fromLibrary(5, 23).blocked, F.Board.fromLibrary(5, 0).blocked);
  equal("and wrap backwards", F.Board.fromLibrary(5, -1).blocked, F.Board.fromLibrary(5, 22).blocked);
}

done("full-house");
