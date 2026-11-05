#!/usr/bin/env node
"use strict";

/*
 * Logic test for frogs-toads-2d/frogs-core.js.
 *
 * The puzzle: a grid with one empty square in the middle, frogs on one side
 * and toads on the other. Frogs step down or right, toads step up or left,
 * and either may jump over exactly one piece of the OTHER kind into the
 * empty square. Swap the two sides.
 *
 * What is checked:
 *
 *   1. The opening position is the applet's InitValues(), tested against an
 *      independent copy of that rule rather than against the core's own.
 *   2. won() is the applet's Finished(), which tests four regions plus the
 *      hole; that region test is re-implemented here and compared with the
 *      core's "start with the two kinds exchanged" on every board size.
 *   3. Every branch of the applet's CanMoveTo(): the four legal moves for
 *      each kind, and the refusals - backwards, sideways the wrong way,
 *      jumping over your own kind, jumping with nothing in between.
 *   4. The MINIMUM table is re-derived by breadth-first search through the
 *      core's own target()/move() for every board small enough to search.
 *   5. The single-row and single-column boards are the classic
 *      one-dimensional puzzle, where the cut-the-knot page proves the answer
 *      is M*N + M + N; the search agrees for all of them, and shows that the
 *      two-dimensional boards are far cheaper than that formula.
 *   6. A dead end really is reachable, so the applet's "You are stuck!" is
 *      not a state the port can never show.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const F = loadCore("frogs-toads-2d/frogs-core.js", "FrogsCore");
const { EMPTY, FROG, TOAD } = F;

const show = (s) => {
  const rows = [];
  for (let y = 0; y < s.rows; y++) {
    rows.push(s.cells.slice(y * s.cols, (y + 1) * s.cols).map((v) => ".FT"[v]).join(""));
  }
  return rows.join("/");
};

/* ------------------------------------------------- 1. the opening position */

{
  // The applet's InitValues(), written out again from the bytecode.
  function appletStart(cols, rows) {
    const hx = (cols - 1) >> 1;
    const hy = (rows - 1) >> 1;
    const v = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) v[y * cols + x] = 1;
    for (let y = 0; y < hy; y++) for (let x = hx + 1; x < cols; x++) v[y * cols + x] = 2;
    for (let y = hy; y < rows; y++) for (let x = hx; x < cols; x++) v[y * cols + x] = 2;
    v[hy * cols + hx] = 0;
    return v;
  }

  equal("3x3 opening position", show(F.start(3, 3)), "FFT/F.T/FTT");
  equal("1x5 opening position is the 1-D puzzle", show(F.start(1, 5)), "F/F/./T/T");
  equal("5x1 opening position is the 1-D puzzle lying down", show(F.start(5, 1)), "FF.TT");
  equal("5x5 opening position", show(F.start(5, 5)), "FFFTT/FFFTT/FF.TT/FFTTT/FFTTT");

  for (const cols of F.SIDES) {
    for (const rows of F.SIDES) {
      equal(`${cols}x${rows}: matches the applet's InitValues`, F.start(cols, rows).cells, appletStart(cols, rows));
      const c = F.census(cols, rows);
      equal(
        `${cols}x${rows}: every square is a frog, a toad or the hole`,
        c.frogs + c.toads + 1,
        cols * rows
      );
    }
  }
}

/* ------------------------------------------------------ 2. the goal position */

{
  // The applet's Finished(), written out again from the bytecode.
  function appletFinished(s) {
    const hx = (s.cols - 1) >> 1;
    const hy = (s.rows - 1) >> 1;
    const at = (x, y) => s.cells[y * s.cols + x];
    for (let y = 0; y < hy; y++) for (let x = 0; x <= hx; x++) if (at(x, y) === FROG) return false;
    for (let y = hy; y < s.rows; y++) for (let x = 0; x < hx; x++) if (at(x, y) === FROG) return false;
    for (let y = 0; y <= hy; y++) for (let x = hx + 1; x < s.cols; x++) if (at(x, y) === TOAD) return false;
    for (let y = hy + 1; y < s.rows; y++) for (let x = hx; x < s.cols; x++) if (at(x, y) === TOAD) return false;
    return at(hx, hy) === EMPTY;
  }

  for (const cols of F.SIDES) {
    for (const rows of F.SIDES) {
      const s = F.start(cols, rows);
      check(`${cols}x${rows}: the opening is not the goal`, cols * rows === 1 || !F.won(s));
      const finished = { cols: cols, rows: rows, cells: F.goal(cols, rows), moves: 0, history: [] };
      check(`${cols}x${rows}: won() agrees with the applet's Finished()`, F.won(finished) && appletFinished(finished));
      // and the two disagree nowhere: a near-miss must fail both
      if (cols * rows > 1) {
        const near = F.clone(finished);
        const i = near.cells.findIndex((v) => v !== EMPTY);
        near.cells[i] = near.cells[i] === FROG ? TOAD : FROG;
        check(`${cols}x${rows}: a single wrong square fails both tests`, !F.won(near) && !appletFinished(near));
      }
    }
  }
}

/* -------------------------------------------------------- 3. the move rule */

{
  const board = (cols, rows, text) => ({
    cols: cols,
    rows: rows,
    cells: text.split("/").join("").split("").map((ch) => ".FT".indexOf(ch)),
    moves: 0,
    history: [],
  });

  // Frogs: step down, step right, jump down over a toad, jump right over one.
  equal("frog steps down", F.target(board(1, 2, "F/."), 0, 0), { x: 0, y: 1 });
  equal("frog steps right", F.target(board(2, 1, "F."), 0, 0), { x: 1, y: 0 });
  equal("frog jumps down over a toad", F.target(board(1, 3, "F/T/."), 0, 0), { x: 0, y: 2 });
  equal("frog jumps right over a toad", F.target(board(3, 1, "FT."), 0, 0), { x: 2, y: 0 });

  // Toads: the mirror image.
  equal("toad steps up", F.target(board(1, 2, "./T"), 0, 1), { x: 0, y: 0 });
  equal("toad steps left", F.target(board(2, 1, ".T"), 1, 0), { x: 0, y: 0 });
  equal("toad jumps up over a frog", F.target(board(1, 3, "./F/T"), 0, 2), { x: 0, y: 0 });
  equal("toad jumps left over a frog", F.target(board(3, 1, ".FT"), 2, 0), { x: 0, y: 0 });

  // Refusals.
  equal("a frog never goes back up", F.target(board(1, 2, "./F"), 0, 1), null);
  equal("a frog never goes back left", F.target(board(2, 1, ".F"), 1, 0), null);
  equal("a toad never goes down", F.target(board(1, 2, "T/."), 0, 0), null);
  equal("a toad never goes right", F.target(board(2, 1, "T."), 0, 0), null);
  equal("no jumping over your own kind", F.target(board(3, 1, "FF."), 0, 0), null);
  equal("no jumping over your own kind, the other way", F.target(board(3, 1, ".TT"), 2, 0), null);
  // the applet tries the step before the leap, so an empty neighbour wins
  equal("a step is preferred to a leap", F.target(board(3, 1, "F.."), 0, 0), { x: 1, y: 0 });
  equal("a blocked piece stays put", F.target(board(3, 1, "FTT"), 0, 0), null);
  equal("the empty square itself is not a piece", F.target(board(2, 1, ".F"), 0, 0), null);

  // Moving and taking it back.
  const s = F.start(3, 3);
  const before = show(s);
  check("a frog beside the hole can move", F.move(s, 1, 0));
  equal("it moved into the hole", show(s), "F.T/FFT/FTT");
  equal("and was counted", s.moves, 1);
  check("an impossible move changes nothing", !F.move(s, 2, 2) && s.moves === 1);
  check("take back", F.undo(s));
  equal("the board is exactly as it was", show(s), before);
  equal("and so is the count", [s.moves, s.history.length], [0, 0]);
  check("nothing left to take back", !F.undo(s));
}

/* ----------------------------------- 4+5. the minimums, re-derived by search */

function minimumBySearch(cols, rows) {
  const s = F.start(cols, rows);
  if (F.won(s)) return 0;
  const key = (st) => st.cells.join("");
  const seen = new Set([key(s)]);
  let frontier = [s];
  for (let d = 1; d < 200; d++) {
    const next = [];
    for (const st of frontier) {
      for (const p of F.movable(st)) {
        const t = F.clone(st);
        F.move(t, p.x, p.y);
        const k = key(t);
        if (seen.has(k)) continue;
        seen.add(k);
        if (F.won(t)) return d;
        next.push(t);
      }
    }
    if (!next.length) return Infinity;
    frontier = next;
  }
  return Infinity;
}

{
  // Everything up to 3x5; 3x7 and 7x3 are in the table from the same search
  // run, but they take a few seconds and a gigabyte, so they are not redone
  // on every verify.
  const searchable = [
    [1, 1], [1, 3], [3, 1], [1, 5], [5, 1], [1, 7], [7, 1], [1, 9], [9, 1],
    [3, 3], [3, 5], [5, 3],
  ];
  for (const [cols, rows] of searchable) {
    equal(`${cols}x${rows}: minimum by search`, minimumBySearch(cols, rows), F.minimum(cols, rows));
  }

  // The 1-D formula from the cut-the-knot page: M*N + M + N moves, of which
  // M*N are jumps. A single row or column of this puzzle IS that puzzle.
  for (const n of F.SIDES) {
    for (const [cols, rows] of [[1, n], [n, 1]]) {
      const c = F.census(cols, rows);
      equal(
        `${cols}x${rows}: the 1-D formula M*N + M + N`,
        F.minimum(cols, rows),
        c.frogs * c.toads + c.frogs + c.toads
      );
    }
  }

  // Two dimensions are much cheaper: the same eight pieces in a line need 24.
  const line = F.census(1, 9);
  const square = F.census(3, 3);
  equal("3x3 and 1x9 hold the same pieces", [square.frogs, square.toads], [line.frogs, line.toads]);
  check(
    "but the square needs far fewer moves than the line",
    F.minimum(3, 3) * 2 <= F.minimum(1, 9),
    `${F.minimum(3, 3)} against ${F.minimum(1, 9)}`
  );
  check("and the board is not symmetric: 3x5 and 5x3 differ", F.minimum(3, 5) !== F.minimum(5, 3));
}

/* ------------------------------------------------- 6. a dead end is reachable */

{
  // Depth-first from the 1x5 opening until a position with no move at all
  // turns up, which is the applet's "You are stuck!".
  const seen = new Set();
  let deadEnd = null;
  (function walk(s) {
    if (deadEnd) return;
    const k = s.cells.join("");
    if (seen.has(k)) return;
    seen.add(k);
    const moves = F.movable(s);
    if (!moves.length && !F.won(s)) {
      deadEnd = show(s);
      return;
    }
    for (const p of moves) {
      const t = F.clone(s);
      F.move(t, p.x, p.y);
      walk(t);
      if (deadEnd) return;
    }
  })(F.start(1, 5));
  check("a dead end exists in the 1x5 puzzle", deadEnd !== null, String(deadEnd));
}

done("frogs-toads-2d");
