#!/usr/bin/env node
"use strict";

/*
 * Logic test for domino-faults/domino-core.js.
 *
 * The puzzle: cover an N by M board with dominoes so that every interior grid
 * line is crossed by at least one of them. A line nothing crosses is a fault.
 *
 * What is checked:
 *
 *   1. Placing and removing: only two free squares sharing an edge take a
 *      domino (the applet's IsConsistent), and removing one anywhere leaves
 *      the rest of the board exactly as it was.
 *   2. Fault detection: a line counts as crossed only by a domino straddling
 *      it, which is the applet's VCrossed/HCrossed bookkeeping, and won() is
 *      its CheckFinished(): a full board AND no faults.
 *   3. The page's theorem - fault-free iff N*M is even, N > 4, M > 4 and the
 *      board is not 6x6 - is NOT taken on trust. Every board from 3x3 up to
 *      7x8 is decided by enumerating tilings through the core's own place(),
 *      and the answer is compared with the formula. The hard cases (4xM, 6x6)
 *      are the ones where the search has to exhaust every tiling, and they
 *      are small enough to do exactly that.
 *   4. The page's two counting claims for the 6x6 are checked on real
 *      tilings: no line is ever crossed by exactly one domino, and the best
 *      a 6x6 covering can do is one fault line.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const D = loadCore("domino-faults/domino-core.js", "DominoCore");

/* ------------------------------------------------- 1. placing and removing */

{
  const s = D.create(3, 4);
  check("place: two squares side by side", D.place(s, 0, 0, 0, 1));
  equal("place: one domino on the board", s.dominoes.length, 1);
  equal("place: it knows its top-left square and that it lies flat", s.dominoes[0], {
    r: 0,
    c: 0,
    vertical: false,
  });
  check("place: the squares under it are taken", !D.free(s, 0, 0) && !D.free(s, 0, 1));
  check("illegal: a square cannot take a second domino", !D.place(s, 0, 1, 0, 2));
  check("illegal: diagonal neighbours are not neighbours", !D.place(s, 1, 1, 2, 2));
  check("illegal: two squares apart is not adjacent", !D.place(s, 1, 0, 1, 2));
  check("illegal: off the board", !D.place(s, 2, 3, 3, 3) && !D.place(s, 0, 3, 0, 4));
  check("illegal: a square is not adjacent to itself", !D.place(s, 1, 1, 1, 1));

  check("place: standing up as well", D.place(s, 1, 0, 2, 0));
  check("the upright one is marked vertical", s.dominoes[1].vertical);
  equal("a square reports which domino holds it", D.dominoAt(s, 2, 0), 1);
  equal("and -1 where there is none", D.dominoAt(s, 2, 3), -1);

  check("remove: by pointing at either of its squares", D.removeAt(s, 0, 1));
  equal("remove: it is gone", s.dominoes.length, 1);
  check("remove: its squares are free again", D.free(s, 0, 0) && D.free(s, 0, 1));
  equal("remove: the survivor kept its squares", D.dominoAt(s, 1, 0), 0);
  check("remove: nothing to remove on an empty square", !D.removeAt(s, 0, 0));
  check("removeLast: takes the newest", D.removeLast(s) && s.dominoes.length === 0);
  check("removeLast: and stops at empty", !D.removeLast(s));
}

/* ------------------------------------------------------ 2. faults and won */

{
  const s = D.create(2, 2);
  let f = D.faults(s);
  equal("empty 2x2: both interior lines are faults", [f.horizontal, f.vertical], [[1], [1]]);

  D.place(s, 0, 0, 0, 1); // flat along the top: crosses the vertical line
  f = D.faults(s);
  equal("a flat domino crosses the line between the columns", f.vertical, []);
  equal("and leaves the one between the rows alone", f.horizontal, [1]);
  check("not won yet: the board is not full", !D.won(s) && !D.isFull(s));

  D.place(s, 1, 0, 1, 1);
  check("full board", D.isFull(s));
  equal("two flat dominoes leave the row line uncrossed", D.faultCount(s), 1);
  check("so the 2x2 is covered but not won", !D.won(s));

  const t = D.create(2, 2);
  D.place(t, 0, 0, 1, 0);
  D.place(t, 0, 1, 1, 1);
  equal("two upright dominoes leave the column line uncrossed", D.faultCount(t), 1);
  check("the 2x2 cannot be won either way", !D.won(t));
}

/* ------------- 3. the theorem, decided by search instead of by formula ---- */

/**
 * Enumerates tilings through the core's own place(), always covering the
 * first free square, and stops at the first fault-free one.
 */
function faultFreeBySearch(rows, cols) {
  const s = D.create(rows, cols);
  let found = false;
  let tilings = 0;

  function firstFree() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) if (D.free(s, r, c)) return [r, c];
    }
    return null;
  }

  function step() {
    if (found) return;
    const at = firstFree();
    if (!at) {
      tilings++;
      if (D.faultCount(s) === 0) found = true;
      return;
    }
    const [r, c] = at;
    // Only right and down: the square above and the one to the left are
    // already covered, so every tiling is reached exactly once.
    for (const [r2, c2] of [
      [r, c + 1],
      [r + 1, c],
    ]) {
      if (!D.place(s, r, c, r2, c2)) continue;
      step();
      D.removeLast(s);
      if (found) return;
    }
  }
  step();
  return { found: found, tilings: tilings };
}

{
  // 7x8 is the largest board here; the ones the formula calls impossible are
  // the ones the search has to exhaust, and those are all small.
  for (let rows = 3; rows <= 7; rows++) {
    for (let cols = 3; cols <= 8; cols++) {
      const { found } = faultFreeBySearch(rows, cols);
      check(
        `${rows}x${cols}: search and formula agree (${found ? "fault-free exists" : "impossible"})`,
        found === D.faultFree(rows, cols),
        `search says ${found}, faultFree() says ${D.faultFree(rows, cols)}`
      );
    }
  }
  check("5x6 is the smallest fault-free board", D.faultFree(5, 6) && !D.faultFree(4, 6) && !D.faultFree(5, 5));
  check("the 6x6 is the exception", !D.faultFree(6, 6) && D.faultFree(6, 8) && D.faultFree(8, 6));
  check("an odd number of squares cannot be covered at all", !D.coverable(5, 5) && !D.coverable(3, 7));
}

/* ----------------------------- 4. the page's counting claims, on real tilings */

{
  const rows = 6;
  const cols = 6;
  const s = D.create(rows, cols);
  let best = Infinity;
  let everExactlyOne = false;
  let tilings = 0;

  function crossingsOf(line, vertical) {
    return s.dominoes.filter((d) =>
      vertical ? !d.vertical && d.c === line - 1 : d.vertical && d.r === line - 1
    ).length;
  }

  function step() {
    let at = null;
    for (let r = 0; r < rows && !at; r++) {
      for (let c = 0; c < cols && !at; c++) if (D.free(s, r, c)) at = [r, c];
    }
    if (!at) {
      tilings++;
      best = Math.min(best, D.faultCount(s));
      for (let i = 1; i < rows; i++) if (crossingsOf(i, false) === 1) everExactlyOne = true;
      for (let j = 1; j < cols; j++) if (crossingsOf(j, true) === 1) everExactlyOne = true;
      return;
    }
    const [r, c] = at;
    for (const [r2, c2] of [
      [r, c + 1],
      [r + 1, c],
    ]) {
      if (!D.place(s, r, c, r2, c2)) continue;
      step();
      D.removeLast(s);
    }
  }
  step();

  equal("the 6x6 has 6728 domino tilings", tilings, 6728);
  check("no line is ever crossed by exactly one domino", !everExactlyOne);
  equal("the best a 6x6 covering can do is one fault line", best, 1);
}

done("domino-faults");
