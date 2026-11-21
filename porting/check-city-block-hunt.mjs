#!/usr/bin/env node
"use strict";

/*
 * Logic test for city-block-hunt/city-block-hunt-core.js.
 *
 *   node porting/check-city-block-hunt.mjs
 *
 * Three parts:
 *  1. A second, literal transcription of the applet's mouseClicked and reset
 *     (including its Point x/y swap) compared with the core for every board
 *     size 2..8, every treasure cell and every click on and just off the grid.
 *  2. Every claim on the cut-the-knot page, checked exhaustively: the answer
 *     10 to Problem 1 on a 4 by 4 board (and the general n^2 - 2n + 2 rule),
 *     Discover's underestimate of 4, the ten-cell layout, "two squares are
 *     always enough" via two adjacent corners, and the corner/diagonal claim.
 *  3. The rules' edge cases: the spinner range, illegal and repeated clicks,
 *     the end of the hunt, the hint's candidate sets, status words and plain
 *     data positions.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("city-block-hunt/city-block-hunt-core.js", "CityBlockHuntCore");
const cells = (n) => {
  const out = [];
  for (let col = 0; col < n; col++) {
    for (let row = 0; row < n; row++) out.push({ col, row });
  }
  return out;
};
const dist = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
const key = (c) => c.col + "," + c.row;

/* --------------------------------------- 1. the core vs the applet's methods */

/*
 * reset(): Treasure = new Point((int)(Math.random()*N), (int)(Math.random()*N));
 *          Squares = new int[N][N].
 * mouseClicked(): gridX = (mx - X0 + N*Side)/Side - N  (Java int division)
 *                 gridY = (my - Y0 + N*Side)/Side - N
 *                 if outside, return
 *                 d = |gridX - Treasure.y| + |gridY - Treasure.x|
 *                 if d == 0: d = -1, Finished = true
 *                 Squares[gridX][gridY] = d
 * The Point's x is used as the row and its y as the column in the distance;
 * both coordinates are uniform, so this is a harmless swap. We keep it here
 * so this transcription follows the bytecode literally.
 */
function appletClick(squares, point, n, mx, my, X0, Y0, Side) {
  const gx = Math.floor((mx - X0 + n * Side) / Side) - n;
  const gy = Math.floor((my - Y0 + n * Side) / Side) - n;
  if (gx < 0 || gx >= n || gy < 0 || gy >= n) return false;
  let d = Math.abs(gx - point.y) + Math.abs(gy - point.x);
  if (d === 0) d = -1;
  squares[gx][gy] = d;
  return true;
}

{
  const X0 = 12;
  const Y0 = 20;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    const Side = 40;
    for (const point of cells(n).map((c) => ({ x: c.row, y: c.col }))) {
      // The treasure the core sees is the applet's Point with x/y exchanged.
      const treasure = { col: point.y, row: point.x };
      const squares = [];
      for (let col = 0; col < n; col++) squares.push(new Array(n).fill(0));
      let state = C.start({ n, treasure });

      // Every cell in the board, then three clicks just outside it.
      const pixels = [];
      for (const cell of cells(n)) {
        pixels.push({ mx: X0 + cell.col * Side + 7, my: Y0 + cell.row * Side + 13 });
      }
      pixels.push({ mx: X0 - 1, my: Y0 + 3 });
      pixels.push({ mx: X0 + n * Side + 2, my: Y0 + 3 });
      pixels.push({ mx: X0 + 3, my: Y0 + n * Side + 1 });

      for (const p of pixels) {
        const gx = Math.floor((p.mx - X0 + n * Side) / Side) - n;
        const gy = Math.floor((p.my - Y0 + n * Side) / Side) - n;
        if (state.won) {
          // The page says the game stops at the treasure; the core refuses
          // further clicks while the applet's mouseClicked would overwrite.
          check(`n=${n} treasure=${key(treasure)} no move after the find`,
            C.move(state, { col: gx, row: gy }) === null);
          continue;
        }
        const touched = appletClick(squares, point, n, p.mx, p.my, X0, Y0, Side);
        if (touched) {
          const next = C.move(state, { col: gx, row: gy });
          check(`n=${n} treasure=${key(treasure)} click=${gx},${gy} allowed`, !!next);
          if (next) state = next;
        } else {
          check(`n=${n} treasure=${key(treasure)} off-board click ignored`,
            C.move(state, { col: gx, row: gy }) === null);
        }
        let same = true;
        for (const cell of cells(n)) {
          if (squares[cell.col][cell.row] !== state.grid[cell.col][cell.row]) same = false;
        }
        check(`n=${n} treasure=${key(treasure)} grid after ${key({ col: gx, row: gy })}`, same);
        check(`n=${n} treasure=${key(treasure)} won flag after ${key({ col: gx, row: gy })}`,
          state.won === squares.some((column) => column.indexOf(-1) >= 0));
      }
    }
  }
}

/* -------------------------------- 2. the page's claims, checked exhaustively */

// Two treasures can be told apart only by a cell whose distances to them
// differ. The greatest number of touches that can leave a doubt is therefore
// the largest set of cells on which two treasures agree.
function maxAmbiguousTouches(n) {
  const all = cells(n);
  let best = 0;
  let pair = null;
  for (const t of all) {
    for (const u of all) {
      if (key(t) === key(u)) continue;
      const same = all.filter((c) => dist(c, t) === dist(c, u));
      if (same.length > best) { best = same.length; pair = [t, u]; }
    }
  }
  return { best, pair };
}

{
  // Problem 1: "10!" on the 4 by 4 board. Discover's 4 is an underestimate.
  const four = maxAmbiguousTouches(4);
  check("Problem 1: 10 touches can still leave a doubt on a 4x4 board", four.best === 10);
  check("Problem 1: Discover's answer of 4 is an underestimate", 4 < four.best);
  check("Problem 1: the page's ambiguous pair is (0,1) vs (1,0)",
    key(four.pair[0]) === "0,1" && key(four.pair[1]) === "1,0");

  // The ten cells of that layout all give the same two distances; there is no
  // eleventh cell that does, so an eleventh touch always breaks the tie.
  const t = { col: 0, row: 1 };
  const u = { col: 1, row: 0 };
  const layout = cells(4).filter((c) => dist(c, t) === dist(c, u));
  const want = ["0,0", "1,1", "1,2", "1,3", "2,1", "2,2", "2,3", "3,1", "3,2", "3,3"];
  equal("Problem 1: the page's ten-cell layout", layout.map(key).sort(), want.slice().sort());
  for (const c of cells(4)) {
    if (want.indexOf(key(c)) >= 0) continue;
    check(`Problem 1: ${key(c)} distinguishes the two treasures`, dist(c, t) !== dist(c, u));
  }

  // The general pattern, checked at every size the spinner offers.
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    const got = maxAmbiguousTouches(n).best;
    check(`max ambiguous touches on ${n}x${n} = n^2 - 2n + 2 (${got})`,
      got === n * n - 2 * n + 2);
  }
}

{
  // Problem 2: "two squares are always enough". Touching the two adjacent
  // corners (0,0) and (n-1,0) gives d1 = c + r and d2 = (n-1-c) + r, from
  // which c = (d1 - d2 + n - 1)/2 and r = d1 - c: exactly one cell. Check the
  // core's own candidate set for every treasure on every board.
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (const treasure of cells(n)) {
      const plan = C.twoCornerPlan(n, treasure);
      let s = C.start({ n, treasure });
      s = C.move(s, plan.first);
      if (!s.won) s = C.move(s, plan.second);
      const left = C.candidates(s);
      check(`two corners locate ${key(treasure)} on ${n}x${n}`,
        left.length === 1 && key(left[0]) === key(treasure));
      check(`two corners agree with the formula on ${n}x${n}`,
        plan.d1 === treasure.col + treasure.row &&
        plan.d2 === n - 1 - treasure.col + treasure.row);
    }
  }
}

{
  // A single touch of corner (0,0) returns all cells with col+row = d: a
  // diagonal band. That is the page's "the number reveals which diagonal".
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (const treasure of cells(n)) {
      const d = treasure.col + treasure.row;
      const band = cells(n).filter((c) => c.col + c.row === d);
      const s = C.move(C.start({ n, treasure }), { col: 0, row: 0 });
      check(`corner clue ${d} on ${n}x${n}: band has ${band.length} cells`,
        band.length === Math.min(d + 1, 2 * n - 1 - d));
      for (const c of band) {
        check(`corner clue ${d} includes ${key(c)} on ${n}x${n}`,
          C.distance({ col: 0, row: 0 }, c) === d);
      }
      if (!s.won) check(`corner clue rules out off-diagonal cells on ${n}x${n}`,
        C.candidates(s).every((c) => c.col + c.row === d));
    }
  }
}

{
  // candidates() and clueCandidates() must match a plain, independent reading
  // of every clue, and the Show hint outlines must be untouched cells only.
  for (let n = 2; n <= 5; n++) {
    for (const treasure of cells(n)) {
      const touched = cells(n).filter((_, i) => (i * 7 + treasure.col * 5 + treasure.row * 3 + n) % 5 < 2);
      let s = C.start({ n, treasure });
      for (const c of touched) {
        const next = C.move(s, c);
        if (next && !next.won) s = next;
      }
      const cs = C.clues(s);
      const brute = cells(n).filter((cell) =>
        cs.every((c) => dist(c, cell) === c.d));
      equal(`candidates match brute force n=${n} treasure=${key(treasure)}`,
        C.candidates(s).map(key).sort(), brute.map(key).sort());
      cs.forEach((clue, i) => {
        const wantH = cells(n).filter((cell) =>
          s.grid[cell.col][cell.row] <= 0 && dist(clue, cell) === clue.d);
        equal(`hint ${i} n=${n} treasure=${key(treasure)}`,
          C.clueCandidates(s, i).map(key).sort(), wantH.map(key).sort());
      });
      check(`candidates contain the treasure n=${n}`,
        C.candidates(s).some((c) => key(c) === key(treasure)));
    }
  }
}

/* -------------------------------------------------- 3. rules and edge cases */

{
  const s = C.start({});
  check("default board is 4x4", s.n === 4 && s.grid.length === 4);
  check("a new hunt is not over", C.result(s) === null);
  check("a new hunt has no touches", s.touches === 0 && !s.won && s.last === null);
  check("every cell starts untouched", C.legalMoves(s).length === 16);
  check("the treasure starts inside the board", s.treasure.col >= 0 && s.treasure.col < 4 &&
    s.treasure.row >= 0 && s.treasure.row < 4);
  check("start accepts a fixed treasure", key(C.start({ treasure: { col: 2, row: 3 } }).treasure) === "2,3");
  check("start accepts a fixed random source",
    key(C.start({ n: 3, random: () => 0.99 }).treasure) === "2,2");
  for (const bad of [0, 1, 9, 20, -3, NaN, Infinity]) {
    check(`clampN rejects ${bad}`, C.clampN(bad) === (bad > 8 ? 8 : bad < 2 ? 2 : 4));
  }
  for (const n of [2, 3, 5, 7, 8]) {
    check(`clampN keeps ${n}`, C.clampN(n) === n);
    check(`clampN rounds ${n}.4`, C.clampN(n + 0.4) === n);
  }

  const t = { col: 1, row: 2 };
  let p = C.start({ treasure: t });
  const far = C.move(p, { col: 3, row: 3 });
  check("a legal touch is allowed", !!far);
  check("a touch records the distance", far.grid[3][3] === 3 && far.touches === 1 && !!far.last);
  check("a touch does not change the old position", p.grid[3][3] === 0 && p.touches === 0);
  check("legal moves shrink after a touch", C.legalMoves(far).length === 15);
  check("an already-touched cell is a no-op", C.move(far, { col: 3, row: 3 }) === far);
  check("a click off the board is refused", C.move(far, { col: -1, row: 0 }) === null);
  check("a click past the board is refused", C.move(far, { col: 0, row: 4 }) === null);
  check("a fractional cell is refused", C.move(far, { col: 1.5, row: 2 }) === null);
  check("the hunt is still on after a miss", C.result(far) === null);

  const found = C.move(p, { col: t.col, row: t.row });
  check("touching the treasure wins", found.won && C.result(found) === "win");
  check("the found cell holds the applet's -1 chest", found.grid[t.col][t.row] === -1);
  check("there are no legal moves after the find", C.legalMoves(found).length === 0);
  check("no further clicks after the find", C.move(found, { col: 0, row: 0 }) === null);
  check("the winning cell holds the treasure", key(found.last) === key(t));

  const hinted = C.setHint(p, true);
  check("hint toggles on", hinted.hint === true && p.hint === false);
  check("hint toggles off", C.setHint(hinted, false).hint === false);
  check("a new board size is clamped and reset", C.setN(far, 99).n === 8 &&
    C.setN(far, 99).touches === 0);
  check("a new board keeps the hint setting", C.setN(hinted, 6).hint === true);
  check("an untouched clue has no candidates", C.clueCandidates(p, 0).length === 0);

  const round = JSON.parse(JSON.stringify(found));
  equal("a position survives JSON round-trip", round, found);
  check("the start sentence says how to play", /Touch a square/.test(C.describe("start", s)));
  check("a miss sentence names the distance and the remaining squares",
    /blocks from the treasure/.test(C.describe("touch", far)));
  check("the find sentence names the row, column and touch count",
    /Found it/.test(C.describe("touch", found)) && /row 3, column 2/.test(C.describe("touch", found)));
  check("the determined sentence asks for the last touch", /Only one square/.test(C.describe("determined", far)));
  check("the hint sentence mentions the outlines", /outlined squares/.test(C.describe("hint", hinted)));
  check("the size sentence names the new board", /6 by 6/.test(C.describe("n", C.setN(far, 6))));
}

done("city-block-hunt");
