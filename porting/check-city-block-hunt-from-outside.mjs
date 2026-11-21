#!/usr/bin/env node
"use strict";

/*
 * Logic test for city-block-hunt-from-outside/city-block-hunt-from-outside-core.js.
 *
 *   node porting/check-city-block-hunt-from-outside.mjs
 *
 * The board is small: N runs from 2 to 8, and from every one of the N^2
 * treasure squares there are N^2 + 4N touchable squares. All of those are
 * walked (13,951 treasure/touch pairs). Each touch is compared with a second,
 * literal transcription of the applet's mouseClicked method -- including its
 * swapped Point fields, its corner rejection, its clamping to -1 / N and its
 * rule that only outside touches become clues.
 *
 * The cut-the-knot page's claims are checked over the same space: every clue
 * leaves a locus of grid squares that contains the treasure; a touch next to
 * a corner leaves exactly one diagonal; and the equidistant squares of a
 * corner touch are the two extreme squares joined by a single diagonal.
 * The applet's own showing of the treasure and the end of the play are tested
 * too (the page says the game stops on a find; the applet would keep clicking).
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("city-block-hunt-from-outside/city-block-hunt-from-outside-core.js", "CityBlockHuntFromOutsideCore");

const NS = [2, 3, 4, 5, 6, 7, 8];
const key = (c, r) => c + "," + r;

/**
 * A second transcription of CityBlockHuntFromOutsideCanvas.mouseClicked,
 * straight from javap. The applet's Point stores row in x and column in y.
 * `x` and `y` here are the computed cell coordinates (column, row).
 */
function appletClick(n, point, x, y) {
  // if (x < 0 || x >= N) then y must be in [0, N); otherwise x is in [0, N).
  let accepted = x >= 0 && x < n;
  if (!accepted) accepted = y >= 0 && y < n;
  if (!accepted) return { accepted: false };

  let cx = x;
  let cy = y;
  if (cx < 0) cx = -1;
  if (cy < 0) cy = -1;
  if (cx >= n) cx = n;
  if (cy >= n) cy = n;

  // d = abs(x - Treasure.y) + abs(y - Treasure.x) -- the applet's swap.
  let d = Math.abs(cx - point.y) + Math.abs(cy - point.x);
  let finished = false;
  if (d === 0) {
    d = -1;
    finished = true;
  }
  // The clue is stored only for the four strips outside the grid.
  let clue = null;
  if (cx < 0 || cy < 0 || cx === n || cy === n) clue = { col: cx, row: cy, d };
  return { accepted: true, finished, clue, d };
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("start uses the applet's default N = 4", s.n, 4);
  equal("start has no clues", s.clues, []);
  equal("start is not over", s.finished, false);
  check("a new game has no result yet", C.result(s) === null);
  check("the treasure starts inside the grid",
    s.treasure.col >= 0 && s.treasure.col < 4 && s.treasure.row >= 0 && s.treasure.row < 4);
  check("the position is plain JSON", JSON.parse(JSON.stringify(s)).n === 4);
}

{
  const s = C.start({ n: 4, treasure: { col: 2, row: 1 } });
  equal("a fixed treasure can be supplied for tests", s.treasure, { col: 2, row: 1 });
  equal("N clamps below the spinner's minimum", C.start({ n: -3 }).n, 2);
  equal("N clamps above the spinner's maximum", C.start({ n: 99 }).n, 8);
  equal("N is rounded like a spinner value", C.start({ n: 5.6 }).n, 6);
  equal("the distance is the city-block distance", C.taxicab(0, 0, { col: 2, row: 1 }), 3);
  check("outside strips are recognised", C.isOutside(4, -1, 2) && C.isOutside(4, 4, 2) &&
    C.isOutside(4, 2, -1) && C.isOutside(4, 2, 4) && !C.isOutside(4, 2, 3));
}

{
  let ok = true;
  for (const n of NS) {
    const s = C.start({ n, treasure: { col: 0, row: 0 } });
    if (C.legalMoves(s).length !== n * n + 4 * n) ok = false;
  }
  check("every grid square and every edge strip is touchable, corners are not", ok);

  const s = C.start({ n: 4, treasure: { col: 2, row: 1 } });
  check("a diagonal square outside the corners is refused", C.move(s, { col: -1, row: -1 }) === null);
  check("a far outside square is folded onto the edge strip", C.move(s, { col: -7, row: 2 }) !== null);
  check("two far outside coordinates are still refused", C.move(s, { col: -7, row: 9 }) === null);
  check("a non-integer touch is refused", C.move(s, { col: "x", row: 2 }) === null);

  const empty = C.move(s, { col: 0, row: 0 });
  check("touching an empty interior square adds no clue", empty.clues.length === 0 && !empty.finished);
  const clue = C.move(s, { col: -1, row: 1 });
  equal("touching the left strip adds its distance as a clue", clue.clues, [{ col: -1, row: 1, d: 3 }]);
  const found = C.move(s, { col: 2, row: 1 });
  check("touching the treasure square ends the hunt", found.finished && C.result(found) === "done");
  check("finding the treasure adds no clue", found.clues.length === 0);
  check("no further touch is accepted after a find", C.move(found, { col: 0, row: 0 }) === null);
  check("a move never changes the position it was given", s.clues.length === 0 && !s.finished);
}

/* --------------------------- 2. the same answers as the applet's own method */

{
  let pairs = 0;
  let badAccept = 0, badFinish = 0, badClue = 0, badDistance = 0;
  for (const n of NS) {
    for (let tc = 0; tc < n; tc++) {
      for (let tr = 0; tr < n; tr++) {
        const s = C.start({ n, treasure: { col: tc, row: tr } });
        for (const m of C.legalMoves(s)) {
          pairs++;
          const got = C.move(s, m);
          const ref = appletClick(n, { x: tr, y: tc }, m.col, m.row);
          if ((got !== null) !== ref.accepted) badAccept++;
          if (!got) continue;
          if (got.finished !== ref.finished) badFinish++;
          const clue = got.clues.length ? got.clues[got.clues.length - 1] : null;
          if (clue === null && ref.clue !== null) badClue++;
          if (clue !== null && (ref.clue === null || key(clue.col, clue.row) !== key(ref.clue.col, ref.clue.row) || clue.d !== ref.clue.d)) badClue++;
          if (!got.finished && C.taxicab(m.col, m.row, s.treasure) !== ref.d) badDistance++;
        }
      }
    }
  }
  check(`all ${pairs} treasure/touch pairs share the applet's acceptance`, badAccept === 0, `${badAccept} bad`);
  check("the app's finish test matches the applet on every pair", badFinish === 0, `${badFinish} bad`);
  check("the applet records exactly the same clues (and no interior ones)", badClue === 0, `${badClue} bad`);
  check("the applet's own distance formula agrees on every pair", badDistance === 0, `${badDistance} bad`);
}

{
  // The applet's computed coordinates can land two strips outside the grid;
  // its clamps (x < 0 -> -1, x >= N -> N) fold those onto the edge strip.
  const s = C.start({ n: 4, treasure: { col: 1, row: 3 } });
  const ref = appletClick(4, { x: 3, y: 1 }, -2, 2);
  const got = C.move(s, { col: -2, row: 2 });
  check("a touch two strips left is folded to col -1 as in the applet",
    got !== null && got.clues[0].col === ref.clue.col && got.clues[0].d === ref.clue.d);
  const ref2 = appletClick(4, { x: 3, y: 1 }, 6, 2);
  const got2 = C.move(s, { col: 6, row: 2 });
  check("a touch two strips right is folded to col N as in the applet",
    got2 !== null && got2.clues[0].col === ref2.clue.col && got2.clues[0].d === ref2.clue.d);
}

/* -------------------------------------- 3. the claims the page makes, exhaustively */

{
  // Every clue's distance locus must still contain the treasure.
  let cases = 0;
  let bad = 0;
  for (const n of NS) {
    for (let tc = 0; tc < n; tc++) {
      for (let tr = 0; tr < n; tr++) {
        const s = C.start({ n, treasure: { col: tc, row: tr } });
        for (const m of C.legalMoves(s)) {
          const next = C.move(s, m);
          if (!next || next.finished || !next.clues.length) continue;
          const clue = next.clues[next.clues.length - 1];
          cases++;
          const locus = C.clueLocus(n, clue.col, clue.row, clue.d);
          if (!locus.some((c) => c.col === tc && c.row === tr)) bad++;
        }
      }
    }
  }
  check(`the treasure is on every clue's locus (${cases} clue cases)`, cases > 0 && bad === 0, `${bad} bad`);
}

{
  // The page: "why touching a corner square reveals a diagonal that contains
  // the treasure." In the outside version the touches next to a corner do it.
  let cases = 0;
  let bad = 0;
  for (const n of NS) {
    const cornerTouches = [
      [-1, 0], [-1, n - 1], [n, 0], [n, n - 1],
      [0, -1], [n - 1, -1], [0, n], [n - 1, n],
    ];
    for (let tc = 0; tc < n; tc++) {
      for (let tr = 0; tr < n; tr++) {
        for (const [col, row] of cornerTouches) {
          const s = C.start({ n, treasure: { col: tc, row: tr } });
          const next = C.move(s, { col, row });
          if (!next || next.finished) continue;
          const clue = next.clues[0];
          const locus = C.clueLocus(n, clue.col, clue.row, clue.d);
          cases++;
          // One diagonal: either col + row or col - row is the same everywhere.
          const sum = locus[0].col + locus[0].row;
          const diff = locus[0].col - locus[0].row;
          const onOneDiagonal = locus.every((c) => c.col + c.row === sum) ||
            locus.every((c) => c.col - c.row === diff);
          const containsTreasure = locus.some((c) => c.col === tc && c.row === tr);
          if (!onOneDiagonal || !containsTreasure) bad++;
        }
      }
    }
  }
  check(`a corner-adjacent outside touch leaves one diagonal (${cases} cases)`, cases > 0 && bad === 0, `${bad} bad`);
}

{
  // The page's geometric picture: from a corner of the grid the equidistant
  // squares form a rhombus whose sides run at 45 degrees; for distance 1 the
  // two "vertices" are the two extreme neighbouring squares, and for distance
  // N-1 the diagonal is the full one across the board.
  let bad = 0;
  for (const n of NS) {
    for (let d = 1; d <= 2 * (n - 1); d++) {
      const locus = C.clueLocus(n, 0, 0, d);
      if (!locus.every((c) => c.col + c.row === d)) bad++;
      if (d < n && locus.length !== d + 1) bad++;
      if (d === 1) {
        if (locus.length !== 2 || !locus.some((c) => c.col === 1 && c.row === 0) ||
            !locus.some((c) => c.col === 0 && c.row === 1)) bad++;
      }
      if (d === n - 1 && locus.length !== n) bad++;
    }
  }
  check("a corner's equidistant squares are diagonals of the grid", bad === 0, `${bad} bad`);
}

{
  // "Show hint" must light exactly the squares at the clue distances (the
  // applet's HighlightDist), and the treasure must never be ruled out.
  let cases = 0;
  let bad = 0;
  for (const n of NS) {
    for (let tc = 0; tc < n; tc++) {
      for (let tr = 0; tr < n; tr++) {
        let s = C.start({ n, treasure: { col: tc, row: tr } });
        for (const m of [[-1, 0], [n - 1, -1], [n, n - 1], [0, n]]) {
          const next = C.move(s, { col: m[0], row: m[1] });
          if (next) s = next;
        }
        cases++;
        const expected = new Set();
        for (const clue of s.clues) {
          for (const c of C.clueLocus(n, clue.col, clue.row, clue.d)) expected.add(key(c.col, c.row));
        }
        const got = C.hintCells(s);
        if (got.length !== expected.size || got.some((c) => !expected.has(key(c.col, c.row)))) bad++;
        if (!got.some((c) => c.col === tc && c.row === tr)) bad++;
      }
    }
  }
  check(`Show hint is the union of the clue loci, with the treasure in it (${cases} cases)`, cases > 0 && bad === 0, `${bad} bad`);
}

/* ---------------------------------------- 4. controls and the end of a play */

{
  const s = C.start({ n: 4, treasure: { col: 2, row: 1 } });
  const one = C.move(s, { col: -1, row: 1 });
  const two = C.move(one, { col: 4, row: 1 });
  check("a second outside touch keeps the first clue", two.clues.length === 2 && two.clues[0].d === 3);
  check("the two clue distances are computed from the same treasure", two.clues[1].d === 2);
  check("the game is still open after clues", C.result(two) === null);
  const won = C.move(two, { col: 2, row: 1 });
  check("the hunt ends 'done', with nobody winning or losing", C.result(won) === "done");
  check("the clues survive the find", won.clues.length === 2);
  check("N = 2 is a legal board", C.legalMoves(C.start({ n: 2, treasure: { col: 0, row: 0 } })).length === 12);
  check("N = 8 is a legal board", C.legalMoves(C.start({ n: 8, treasure: { col: 0, row: 0 } })).length === 96);
}

done("city-block-hunt-from-outside");
