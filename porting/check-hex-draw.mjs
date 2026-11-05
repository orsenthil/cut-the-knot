#!/usr/bin/env node
"use strict";

/*
 * Logic test for hex-draw/hex-draw-core.js.
 *
 *   1. The chain the page highlights is the applet's: CellGame's
 *      SearchForOn/SearchForOff/SearchForChain are transcribed again here
 *      (blue from column 0 first, then red from row 0, the neighbour tables'
 *      own order, unmarking on the way back) and compared on every board of
 *      size 2 to 4, for all four grids. Every chain found is a real chain.
 *   2. The page's claims, on every one of the 2^(n*n) boards for n = 2 .. 4,
 *      and on random larger ones:
 *      - hexagonal grid: exactly one colour wins, always;
 *      - 6-grid (four sides and one diagonal): the same, "equivalent to playing
 *        the game on the standard hexagonal board";
 *      - 4-grid: "the draw is possible" (counted), and two winners never;
 *      - 8-grid: "chains of different colors can cross" (counted), and
 *        somebody always wins.
 *   3. Gale's walk on every hexagonal board up to 4 by 4 and on random boards
 *      up to 10 by 10: it never revisits a vertex, stops at another corner
 *      (a degree-1 vertex), and the cells along it hold a chain for the colour
 *      that really wins, and none for the other.
 *      The two counts are equal, and the test shows why: on every board, red has
 *      no 4-connected chain exactly when blue has an 8-connected one.
 *   4. The step limit: a 10 by 10 board built to make the applet's search
 *      explode still answers quickly.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const H = loadCore("hex-draw/hex-draw-core.js", "HexDrawCore");
const QUOTED = { draws4: [2, 118, 21150], both8: [2, 118, 21150] }; // quoted on the page
const { RED, BLUE, GRIDS } = H;

const boardFromMask = (n, grid, mask) => ({
  n, grid, cells: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Boolean(mask & (1 << (i * n + j))))),
});

/* --------------------------------------- the applet's search, transcribed */

function appletGetChain(s) {
  const { n, cells } = s;
  const included = cells.map((r) => r.map(() => false));
  const chain = [];
  function searchForChain(i, j, isOnSearch) {
    // SearchForChain(cell, chain, flag): flag true is the red search
    if (i === n - 1 && cells[i][j] && isOnSearch) return true;
    if (j === n - 1 && !cells[i][j] && !isOnSearch) return true;
    const adj = GRIDS[s.grid][isOnSearch ? "red" : "blue"];
    for (const [di, dj] of adj) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || a >= n || b < 0 || b >= n) continue;
      if (cells[a][b] !== cells[i][j] || included[a][b]) continue;
      chain.push([a, b]);
      included[a][b] = true;
      if (searchForChain(a, b, isOnSearch)) return true;
      included[a][b] = false;
      chain.pop();
    }
    return false;
  }
  // SearchForOn: from Cells[i][0] that are NOT on (blue)
  for (let i = 0; i < n; i++) {
    if (cells[i][0]) continue;
    included[i][0] = true;
    chain.push([i, 0]);
    if (searchForChain(i, 0, false)) return { colour: "blue", chain: chain.slice() };
    included[i][0] = false;
    chain.pop();
  }
  // SearchForOff: from Cells[0][j] that ARE on (red)
  for (let j = 0; j < n; j++) {
    if (!cells[0][j]) continue;
    included[0][j] = true;
    chain.push([0, j]);
    if (searchForChain(0, j, true)) return { colour: "red", chain: chain.slice() };
    included[0][j] = false;
    chain.pop();
  }
  return { colour: null, chain: [] };
}

function isChain(s, colour, path) {
  const { n, cells } = s;
  const adj = GRIDS[s.grid][colour === RED ? "red" : "blue"];
  if (!path.length) return false;
  const [i0, j0] = path[0];
  const [i1, j1] = path[path.length - 1];
  if (colour === RED ? i0 !== 0 || i1 !== n - 1 : j0 !== 0 || j1 !== n - 1) return false;
  for (let k = 0; k < path.length; k++) {
    const [i, j] = path[k];
    if (cells[i][j] !== colour) return false;
    if (k && !adj.some(([di, dj]) => path[k - 1][0] + di === i && path[k - 1][1] + dj === j)) return false;
  }
  return true;
}

const COUNTS = {};
for (const grid of Object.keys(GRIDS)) {
  for (let n = 2; n <= 4; n++) {
    let differ = 0;
    let bad = 0;
    const tally = { none: 0, one: 0, both: 0 };
    for (let mask = 0; mask < 2 ** (n * n); mask++) {
      const s = boardFromMask(n, grid, mask);
      const red = H.connects(s, RED);
      const blue = H.connects(s, BLUE);
      tally[red && blue ? "both" : red || blue ? "one" : "none"]++;
      const c = H.chains(s);
      if ((c.red !== null) !== red || (c.blue !== null) !== blue) bad++;
      if (c.red && !isChain(s, RED, c.red)) bad++;
      if (c.blue && !isChain(s, BLUE, c.blue)) bad++;
      // The applet shows blue if it has a chain, else red; and only red on the 8-grid.
      const ap = appletGetChain(s);
      const shown = grid === "sq8" ? (c.red ? "red" : null) : c.blue ? "blue" : c.red ? "red" : null;
      const apShown = grid === "sq8" ? (H.appletChain(s, RED) ? "red" : null) : ap.colour;
      if (shown !== apShown) differ++;
      if (ap.colour === "blue" && JSON.stringify(ap.chain) !== JSON.stringify(c.blue)) differ++;
      if (ap.colour === "red" && JSON.stringify(ap.chain) !== JSON.stringify(c.red)) differ++;
    }
    COUNTS[grid + n] = tally;
    check(`${grid} ${n}x${n}: chains are real and match the flood fill`, bad === 0, `${bad} bad`);
    check(`${grid} ${n}x${n}: same chain as the applet's search`, differ === 0, `${differ} differ`);
  }
}

/* ------------------------------------------------------- 2. the claims */

for (let n = 2; n <= 4; n++) {
  const total = 2 ** (n * n);
  equal(`hex ${n}x${n}: exactly one winner on all ${total} boards`, COUNTS["hex" + n].one, total);
  equal(`6-grid ${n}x${n}: exactly one winner on all ${total} boards`, COUNTS["sq6" + n].one, total);
  equal(`4-grid ${n}x${n}: never two winners`, COUNTS["sq4" + n].both, 0);
  equal(`8-grid ${n}x${n}: never no winner`, COUNTS["sq8" + n].none, 0);
}
check("4-grid: a draw is possible (2x2 and up)", COUNTS.sq42.none > 0 && COUNTS.sq44.none > 0);
check("8-grid: both colours can win at once", COUNTS.sq82.both > 0 && COUNTS.sq84.both > 0);
console.log(`  4-grid draws: ${COUNTS.sq42.none} of 16, ${COUNTS.sq43.none} of 512, ${COUNTS.sq44.none} of 65536`);
console.log(`  8-grid double wins: ${COUNTS.sq82.both} of 16, ${COUNTS.sq83.both} of 512, ${COUNTS.sq84.both} of 65536`);
equal("4-grid draws, 2x2 / 3x3 / 4x4", [COUNTS.sq42.none, COUNTS.sq43.none, COUNTS.sq44.none], QUOTED.draws4);
equal("8-grid double wins, 2x2 / 3x3 / 4x4", [COUNTS.sq82.both, COUNTS.sq83.both, COUNTS.sq84.both], QUOTED.both8);

// Why the two counts agree: 4- and 8-connectedness are dual. Red has no
// 4-connected top-to-bottom chain exactly when blue has an 8-connected
// left-to-right one, and the other way round, so a 4-grid draw is precisely
// an 8-grid double win - board by board, not just in number.
for (let n = 2; n <= 4; n++) {
  let differ = 0;
  for (let mask = 0; mask < 2 ** (n * n); mask++) {
    const s4 = boardFromMask(n, "sq4", mask);
    const s8 = boardFromMask(n, "sq8", mask);
    if (H.connects(s4, RED) !== !H.connects(s8, BLUE)) differ++;
    if (H.connects(s4, BLUE) !== !H.connects(s8, RED)) differ++;
  }
  check(`${n}x${n}: no 4-connected red chain exactly when there is an 8-connected blue one, and back`, differ === 0, `${differ} differ`);
}

{
  const random = rng(31);
  let bad = 0;
  for (let t = 0; t < 3000; t++) {
    const n = 5 + (t % 6);
    for (const grid of ["hex", "sq6"]) {
      const s = H.start(n, grid, random);
      if (H.connects(s, RED) === H.connects(s, BLUE)) bad++;
    }
  }
  check("hex and 6-grid, 3,000 random boards 5x5 to 10x10 each: exactly one winner", bad === 0, `${bad} bad`);
}

/* ------------------------------------------------------- 3. Gale's walk */

function walkOk(s) {
  const w = H.galeWalk(s);
  if (w.revisited || w.endDegree !== 1 || w.points.length < 2) return false;
  const truth = H.connects(s, RED) ? "red" : "blue";
  return H.walkWinner(s, w) === truth;
}
for (let n = 2; n <= 4; n++) {
  let bad = 0;
  for (let mask = 0; mask < 2 ** (n * n); mask++) if (!walkOk(boardFromMask(n, "hex", mask))) bad++;
  check(`Gale's walk, every ${n}x${n} board: no revisits, ends at a corner, finds the winner`, bad === 0, `${bad} bad`);
}
{
  const random = rng(8);
  let bad = 0;
  for (let t = 0; t < 600; t++) if (!walkOk(H.start(5 + (t % 6), "hex", random))) bad++;
  check("Gale's walk, 600 random boards 5x5 to 10x10", bad === 0, `${bad} bad`);
}

/* --------------------------------------------------------- 4. step limit */

{
  // Blue everywhere except a red column just before the right edge: the blue
  // search has a huge region and no way through.
  const n = 10;
  const s = { n, grid: "sq8", cells: Array.from({ length: n }, () => Array.from({ length: n }, (_, j) => j === n - 2)) };
  const t0 = Date.now();
  const c = H.chains(s);
  const ms = Date.now() - t0;
  check(`a board that defeats the applet's search answers in ${ms} ms`, ms < 2000 && c.red !== null);
  equal("default board size and limits", [H.MIN_N, H.MAX_N, H.DEFAULT_N], [2, 10, 7]);
  check("start() colours both ways", H.start(10).cells.flat().some((v) => v) && H.start(10).cells.flat().some((v) => !v));
}

done("hex-draw");
