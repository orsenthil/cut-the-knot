#!/usr/bin/env node
"use strict";

/*
 * Logic test for sam-loyd-son/sam-loyd-son-core.js.
 *
 *   node porting/check-sam-loyd-son.mjs
 *
 * For every n the applet allows (3..10):
 * 1. The four pieces tile the c x c square exactly (areas, and a fine grid
 *    of sample points each inside exactly one piece, for n <= 7).
 * 2. Without Cheat each piece's place in the figure is the piece itself,
 *    moved, the trapezoids turned a quarter turn: nothing is stretched.
 * 3. The page's claim: the figure the pieces seem to make has 63 cells for
 *    the 8 x 8 square, and in general c*c - 1 or c*c + 1 (Cassini's
 *    identity), alternately. The honest pieces overlap by exactly 1 where
 *    the figure is smaller and leave a gap of exactly 1 where it is larger
 *    (sampled coverage, n <= 6).
 * 4. With Cheat the nudged pieces' total area is within 0.1 of the figure.
 * 5. The moves: drag snapping, Animate's per-piece steps, reset, option
 *    changes, and the end of the play.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("sam-loyd-son/sam-loyd-son-core.js", "SamLoydSonCore");
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

equal("Fibonacci.GetNum starts 1, 1, 2, 3, 5, 8, 13", [0, 1, 2, 3, 4, 5, 6].map(C.fib).join(","), "1,1,2,3,5,8,13");
equal("the applet's default is the 8 x 8 square", C.sizes(C.DEFAULT_N).c, 8);
equal("and the figure 13 wide", C.sizes(C.DEFAULT_N).d, 13);

let tile = true, rigid = true, cassini = true, cover = true, cheatClose = true, sign = [];
for (let n = C.MIN_N; n <= C.MAX_N; n++) {
  const S = C.sizes(n);
  const P = C.pieces(n, false);
  // 1. tiling
  const sum = P.reduce((t, p) => t + C.area(p.start), 0);
  if (!near(sum, S.c * S.c)) tile = false;
  if (n <= 7) {
    const k = 7;
    for (let i = 0; i < S.c * k; i++) for (let j = 0; j < S.c * k; j++) {
      const pt = [(i + 0.37) / k, (j + 0.61) / k];
      if (P.filter((p) => inside(pt, p.start)).length !== 1) tile = false;
    }
  }
  // 2. rigid: final = start (turned) moved
  for (const p of P) {
    const c0 = C.middle(p.start);
    const turned = p.turns ? C.turn(p.start, c0, 1) : p.start;
    const m0 = C.middle(turned), m1 = C.middle(p.fin);
    const moved = turned.map(([x, y]) => [x - m0[0] + m1[0], y - m0[1] + m1[1]]);
    // the same corners, perhaps listed from a different one
    const same = p.fin.some((_, r) => moved.every(([x, y], i) => near(x, p.fin[(i + r) % p.fin.length][0], 1e-6) && near(y, p.fin[(i + r) % p.fin.length][1], 1e-6)));
    if (!same) rigid = false;
  }
  // 3. the count
  const k = C.counts(n);
  const diff = k.figure - k.square;
  sign.push(diff);
  if (Math.abs(diff) !== 1 || diff !== (n % 2 ? -1 : 1)) cassini = false;
  if (n >= 4 && n <= 6) {
    // Sampled: cells of the figure left uncovered, cells covered twice, and
    // slivers of piece outside the figure. Honest: they account for exactly
    // the one cell. With Cheat: all three almost vanish.
    for (const cheat of [false, true]) {
      const fig = C.figure(n), Q = C.pieces(n, cheat);
      const res = 40;
      let gap = 0, overlap = 0, out = 0;
      for (let i = 0; i < S.d * res; i++) for (let j = 0; j < (S.c + S.a) * res; j++) {
        const pt = [(i + 0.5) / res, (j + 0.5) / res];
        const cnt = Q.filter((p) => inside(pt, p.fin)).length;
        const inFig = inside(pt, fig);
        if (inFig && cnt === 0) gap++;
        if (cnt > 1) overlap += cnt - 1;
        if (!inFig && cnt > 0) out++;
      }
      gap /= res * res; overlap /= res * res; out /= res * res;
      if (!cheat) {
        if (Math.abs(overlap + out - gap + diff) > 0.05) cover = false;
        if (diff < 0 ? overlap < 0.9 : gap < 0.95) cover = false;
      } else if (gap > 0.05 || overlap > 0.05 || out > 0.05) cheatClose = false;
    }
  }
  // 4. cheat
  const cheatSum = C.pieces(n, true).reduce((t, p) => t + C.area(p.fin), 0);
  if (n >= 4 && Math.abs(cheatSum - k.figure) > 0.1) { cheatClose = false; console.log("  n", n, "cheat", cheatSum, k.figure); }
}
check("for n = 3..10 the four pieces tile the square exactly", tile);
check("honest pieces are only moved and turned, never stretched", rigid);
check("the figure is c*c - 1 for odd n and c*c + 1 for even n", cassini, sign.join(","));
equal("for the 8 x 8 square the figure has 63 cells", C.counts(5).figure, 63);
check("for n = 4..6 the honest pieces overlap by one cell (odd n) or leave a one-cell gap (even n)", cover);
check("with Cheat the nudged pieces' area is within 0.1 of the figure's, and the gap and overlap all but vanish", cheatClose);

{
  // n = 3: the middle band of the figure is 2a - b = 0 cells thick, so the
  // figure is two blocks meeting at a line and the pieces cannot fit it.
  const S = C.sizes(3);
  equal("for n = 3 the band in the middle has no thickness", 2 * S.a - S.b, 0);
  const P = C.pieces(3, false), fig = C.figure(3);
  let out = 0;
  for (let i = 0; i < S.d * 20; i++) for (let j = 0; j < (S.c + S.a) * 20; j++) {
    const pt = [(i + 0.5) / 20, (j + 0.5) / 20];
    if (!inside(pt, fig) && P.some((p) => inside(pt, p.fin))) out++;
  }
  check("so there the honest pieces stick out of the figure", out > 0);
}

/* 5. moves */
{
  let s = C.start();
  check("a new play starts in the square and is not over", s.pieces.every((p) => !p.placed && p.f === 0) && C.result(s) === null);
  const fin = C.middle(C.pieces(5, false)[0].finW);
  const t = C.move(s, { type: "drag", id: 0, x: fin[0] + 0.5, y: fin[1] });
  check("a piece dragged within 0.8 cell of its place snaps in", t.pieces[0].placed);
  const u = C.move(s, { type: "drag", id: 2, x: fin[0] + 3, y: fin[1] + 3 });
  check("a piece dragged elsewhere stays loose", !u.pieces[2].placed && u.pieces[2].f > 0);
  for (let id = 0; id < 4; id++) for (let k = 1; k <= C.STEPS; k++) s = C.move(s, { type: "toward", id, f: k / C.STEPS });
  check("Animate's steps put all four pieces in place", s.pieces.every((p) => p.placed));
  equal("and the play is then done", C.result(s), "done");
  const r = C.move(s, { type: "reset" });
  check("Reset puts them back", r.pieces.every((p) => !p.placed) && C.result(r) === null);
  equal("changing n starts again at that size", C.move(s, { type: "n", value: 7 }).n, 7);
  check("n outside 3..10 is refused", C.move(s, { type: "n", value: 2 }) === null && C.move(s, { type: "n", value: 11 }) === null);
  check("Cheat starts again with the nudged pieces", C.move(s, { type: "cheat", value: true }).cheat === true && !C.move(s, { type: "cheat", value: true }).pieces[0].placed);
  const before = JSON.stringify(r);
  C.move(r, { type: "place", id: 1 });
  equal("moves leave the old position alone", JSON.stringify(r), before);
  check("bad moves are refused", C.move(r, { type: "place", id: 4 }) === null && C.move(r, { type: "fly" }) === null);
}

done("sam-loyd-son");
