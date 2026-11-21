#!/usr/bin/env node
"use strict";

/*
 * Logic test for curry-paradox/curry-paradox-core.js.
 *
 *   node porting/check-curry-paradox.mjs
 *
 * For every FN 3..10: the pieces' areas are exactly the triangles' and the
 * rectangle's; the three pieces fill the big triangle with a deficit of half a
 * square in the first arrangement and a surplus of half a square in the second
 * (so the "paradox" is area half a square either way, from the slivers); the
 * rectangles' areas differ by exactly 1 with the sign of (-1)^n as the page
 * claims (1); the page's identities (1) and d'Ocagne's (2) are checked over a
 * range of integer indices, positive and negative; the three hypotenuse slopes
 * are all different, and the gap between the slopes shrinks with n; the pieces
 * are exact translations of each other between the boxes; every piece placed
 * snaps and all pieces placed is "done", with the applet's 20-pixel rule;
 * the four-piece mode for FN = 5 (both holes) has exactly a one-square hole.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("curry-paradox/curry-paradox-core.js", "CurryParadoxCore");

/* ------------------------------------------------------------ 1. the rules */
{
  const s = C.start();
  check("a new game is not over", C.result(s) === null);
  equal("opens with FN = 5, two pieces, nothing moved", [s.fn, s.four, s.offsets.length, s.moves], [5, false, 2, 0]);
  equal("the applet's Fibonacci numbers start 1, 1, 2, 3, 5, 8, 13", [0, 1, 2, 3, 4, 5, 6].map(C.getNum), [1, 1, 2, 3, 5, 8, 13]);
  equal("lengths for FN = 5", (({ S3, S4, S5, S6, S7 }) => [S3, S4, S5, S6, S7])(C.lengths(5)), [8, 5, 3, 2, 13]);
  const g = C.geometry(5, false, true);
  equal("the big triangle has legs 13 and 5", [g.width, g.height], [13, 5]);
  equal("the leftover rectangles are 5 x 3 and 8 x 2", [[g.leftRect.w, g.leftRect.h], [g.rightRect.w, g.rightRect.h]], [[5, 3], [8, 2]]);
  const d = C.move(s, { type: "drag", piece: 0, dx: -3, dy: 4 });
  check("a drag moves a piece and marks the demo explored", d.offsets[0].dx === -3 && d.offsets[0].dy === 4 && d.moves === 1 && d.explored);
  check("the old position is untouched", s.offsets[0].dx === 0 && s.moves === 0);
  const edge = C.move(s, { type: "drag", piece: 0, dx: 999, dy: -999 });
  check("a drag past the edge stays near the board", edge.offsets[0].dx < 20 && edge.offsets[0].dy > -20);
  check("bad moves are refused", C.move(s, null) === null && C.move(s, { type: "drag", piece: 2, dx: 0, dy: 0 }) === null && C.move(s, { type: "drag", piece: 0, dx: NaN, dy: 0 }) === null && C.move(s, { type: "place", piece: -1 }) === null && C.move(s, { type: "pieces", value: 3 }) === null && C.move(s, { type: "hole", value: "x" }) === null && C.move(s, { type: "nope" }) === null);
  equal("FN is kept between 3 and 10", [C.move(s, { type: "fn", value: 1 }).fn, C.move(s, { type: "fn", value: 99 }).fn], [3, 10]);
  check("four pieces only at FN = 5", C.move(C.move(s, { type: "fn", value: 7 }), { type: "pieces", value: 4 }) === null && C.move(s, { type: "pieces", value: 4 }).four === true);
  equal("changing FN while four pieces are shown drops to two", C.move(C.move(s, { type: "pieces", value: 4 }), { type: "fn", value: 6 }).four, false);
  const placed = C.move(C.move(s, { type: "place", piece: 0 }), { type: "place", piece: 1 });
  equal("placing both pieces is done", C.result(placed), "done");
  equal("placing one piece is not", C.result(C.move(s, { type: "place", piece: 0 })), null);
  const r = C.move(placed, { type: "reset" });
  check("reset puts the pieces back", r.offsets.every((o) => o.dx === 0 && o.dy === 0) && r.moves === 0 && !r.explored);
  // The 20-pixel rule: within 20 / A cells of the final offset snaps.
  const f0 = C.finalOffset(s, 0);
  const tol = C.geometry(5, false, true).snap;
  equal("the snap distance at FN = 5 is 20 / 30 of a cell", tol, 20 / 30);
  check("just inside the distance snaps, just outside does not", C.inPlace(C.move(s, { type: "drag", piece: 0, dx: f0.dx + tol * 0.99, dy: f0.dy }), 0) && !C.inPlace(C.move(s, { type: "drag", piece: 0, dx: f0.dx + tol * 1.01, dy: f0.dy }), 0));
  check("a snapped piece is drawn at its final place", C.vertices(C.move(s, { type: "drag", piece: 0, dx: f0.dx + 0.1, dy: f0.dy }), 0).every((v, k) => v[0] === C.geometry(5, false, true).pieces[0].final[k][0]));
}

/* -------------------------------------------------- 2. every case, where small */
{
  let bad = 0;
  for (let fn = 3; fn <= 10; fn++) {
    const f = C.facts(fn);
    const g = C.geometry(fn, false, true);
    const [p1, p2] = g.pieces;
    const twice = (p) => C.twiceArea(p.verts);
    // the pieces: the two triangles are right triangles with the legs of the lengths table
    const { S3, S4, S5, S6, S7 } = C.lengths(fn);
    if (twice(p1) !== S4 * S6 || twice(p2) !== S3 * S5) bad++;
    if (C.twiceArea(p1.final) !== twice(p1) || C.twiceArea(p2.final) !== twice(p2)) bad++;
    // legs and rectangles from the Fibonacci identities of the page
    if (S7 !== C.fib(fn + 2) || S4 !== C.fib(fn) || S3 !== C.fib(fn + 1) || S5 !== C.fib(fn - 1) || S6 !== C.fib(fn - 2)) bad++;
    // the page's legs F(n+1), F(n-1) and rectangles F(n-1)F(n-2), F(n)F(n-3) with n = FN + 1
    const n = fn + 1;
    if (f.legs[0] !== C.fib(n + 1) || f.legs[1] !== C.fib(n - 1)) bad++;
    if (f.rectangles[0].area !== C.fib(n - 1) * C.fib(n - 2) || f.rectangles[1].area !== C.fib(n) * C.fib(n - 3)) bad++;
    // identity (1): F(n)F(n-3) - F(n-1)F(n-2) = (-1)^n
    if (C.fib(n) * C.fib(n - 3) - C.fib(n - 1) * C.fib(n - 2) !== (n % 2 === 0 ? 1 : -1)) bad++;
    if (f.areaDifference !== (n % 2 === 0 ? 1 : -1)) bad++;
    // the big triangle against the pieces: half a square short in one arrangement, half over in the other
    const big = f.bigTriangleTwiceArea;
    const d1 = big - f.firstArrangementTwiceArea, d2 = f.secondArrangementTwiceArea - big;
    if (Math.abs(d1) !== 1 || Math.abs(d2) !== 1) bad++;
    if (f.firstArrangementTwiceArea + 2 * f.areaDifference !== f.secondArrangementTwiceArea) bad++;
    // the three slopes are all different
    const sl = f.slopes;
    if (sl.big === sl.small || sl.big === sl.large || sl.small === sl.large) bad++;
    // pieces move by pure translation, and fit inside the boxes
    for (const p of g.pieces) {
      const dx = p.final[0][0] - p.verts[0][0], dy = p.final[0][1] - p.verts[0][1];
      if (!p.verts.every((v, k) => p.final[k][0] - v[0] === dx && p.final[k][1] - v[1] === dy)) bad++;
    }
    for (const [x, y] of p1.verts.concat(p2.verts)) if (x < 0 || x > S7 || y < 0 || y > S4) bad++;
    for (const [x, y] of p1.final.concat(p2.final)) if (x < g.off.x || x > g.off.x + S7 || y < g.off.y || y > g.off.y + S4) bad++;
  }
  equal("every FN 3..10: areas, Fibonacci identities, half a square of slack and distinct slopes", bad, 0);

  // The pieces and the rectangle fill the box with only the sliver of half a square unaccounted for.
  bad = 0;
  for (let fn = 3; fn <= 10; fn++) {
    const { S3, S4, S5, S6, S7 } = C.lengths(fn);
    // first box: small + large + rectangle(S4 x S5) = S4*S6/2 + S3*S5/2 + S4*S5 versus S7*S4/2
    const lhs = S4 * S6 + S3 * S5 + 2 * S4 * S5, rhs = S7 * S4;
    if (Math.abs(rhs - lhs) !== 1) bad++; // twice the area: half a square either way
  }
  equal("the first arrangement is within half a square of the triangle for every FN", bad, 0);

  // The page's identities over a range of integers, positive and negative.
  bad = 0; let count = 0;
  for (let n = -12; n <= 12; n++) for (let m = -12; m <= 12; m++) {
    count++;
    // d'Ocagne: F(n+1) F(m) - F(n) F(m+1) = (-1)^n F(m-n)
    if (C.fib(n + 1) * C.fib(m) - C.fib(n) * C.fib(m + 1) !== (n % 2 === 0 ? 1 : -1) * C.fib(m - n)) bad++;
  }
  equal(`d'Ocagne's identity (2) holds for ${count} pairs of indices`, bad, 0);
  check("Cassini's identity: F(n+1) F(n-1) - F(n)^2 = (-1)^n", Array.from({ length: 25 }, (_, i) => i - 12).every((n) => C.fib(n + 1) * C.fib(n - 1) - C.fib(n) ** 2 === (n % 2 === 0 ? 1 : -1)));

  // The page's claim: the slopes are distinct but agree better and better; large for n = 4 and 3 (FN 3, 2).
  const gap = (fn) => { const s = C.facts(fn).slopes; return Math.max(s.big, s.small, s.large) - Math.min(s.big, s.small, s.large); };
  const gaps = [3, 4, 5, 6, 7, 8, 9, 10].map(gap);
  check("the slope gap shrinks as n grows", gaps.every((x, i) => !i || x < gaps[i - 1]));
  check("for the smallest case (n = 4) the slopes differ a lot", gaps[0] > 0.15 && gaps[2] < 0.03);

  // Every piece snaps from every offset within the distance, for every FN.
  bad = 0;
  for (let fn = 3; fn <= 10; fn++) {
    const s0 = C.start({ fn });
    s0.offsets.forEach((_, i) => {
      const f = C.finalOffset(s0, i), snap = C.geometry(fn, false, true).snap;
      for (let a = 0; a < 16; a++) {
        const t = (a / 16) * 2 * Math.PI;
        const r = C.move(s0, { type: "drag", piece: i, dx: f.dx + 0.9 * snap * Math.cos(t), dy: f.dy + 0.9 * snap * Math.sin(t) });
        if (!C.inPlace(r, i)) bad++;
        const want = { dx: f.dx + 1.1 * snap * Math.cos(t), dy: f.dy + 1.1 * snap * Math.sin(t) };
        const q = C.move(s0, { type: "drag", piece: i, dx: want.dx, dy: want.dy });
        const clamped = Math.abs(q.offsets[i].dx - want.dx) > 1e-9 || Math.abs(q.offsets[i].dy - want.dy) > 1e-9; // kept on the board
        if (!clamped && C.inPlace(q, i)) bad++;
      }
    });
  }
  equal("snapping inside 20 pixels and not outside, for every piece and FN", bad, 0);

  // Four pieces (FN = 5): the two shapes plus the two triangles fill the second box with a one-square hole.
  for (const inner of [true, false]) {
    const g = C.geometry(5, true, inner);
    const [p1, p2, p3, p4] = g.pieces;
    const t = (p) => C.twiceArea(p.verts);
    equal(`the two shapes together have area 15 (inner hole = ${inner})`, (t(p3) + t(p4)) / 2, 15);
    // the cells of the 8 x 2 region of the second box covered by the two shapes
    const covered = new Set();
    for (const p of [p3, p4]) {
      for (let x = 0; x < 20; x++) for (let y = 0; y < 20; y++) {
        // a unit cell is inside a polygon when its centre is (the shapes have integer vertices)
        const cx = g.off.x + x + 0.5, cy = g.off.y + y + 0.5;
        if (inside(p.final, cx, cy)) covered.add(x + "," + y);
      }
    }
    // the 8 x 2 region: x from S4 to S7, y from S5 to S4 inside the second box
    let hole = [];
    for (let x = 5; x < 13; x++) for (let y = 3; y < 5; y++) if (!covered.has(x + "," + y)) hole.push([x, y]);
    equal(`exactly one square of the 8 x 2 region is left uncovered (inner hole = ${inner})`, hole.length, 1);
    equal(`the hole is ${inner ? "in the top edge's interior" : "on the perimeter"} of the 8 x 2 region`, inner ? hole[0][0] > 5 && hole[0][0] < 12 : hole[0][0] === 5 || hole[0][0] === 12 || hole[0][1] === 3 || hole[0][1] === 4, true);
    check("the four-piece pieces are translations too", g.pieces.every((p) => { const dx = p.final[0][0] - p.verts[0][0], dy = p.final[0][1] - p.verts[0][1]; return p.verts.every((v, k) => p.final[k][0] - v[0] === dx && p.final[k][1] - v[1] === dy); }));
    // the four pieces' shapes fill the original 5 x 3 rectangle in the first box
    const start = new Set();
    for (const p of [p3, p4]) for (let x = 0; x < 20; x++) for (let y = 0; y < 8; y++) if (inside(p.verts, x + 0.5, y + 0.5)) start.add(x + "," + y);
    let ok = start.size === 15;
    for (let x = 8; x < 13; x++) for (let y = 2; y < 5; y++) if (!start.has(x + "," + y)) ok = false;
    check(`the two shapes exactly tile the 5 x 3 rectangle in the first box (inner hole = ${inner})`, ok);
  }
}

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/* ----------------------------- 3. the same answers as the applet's own method */
{
  // The applet's Reset() arithmetic, with the page's board, for FN = 5: unit 30 pixels, pieces at 13 x 5 cells.
  const A = Math.floor(390 / C.getNum(6));
  equal("the board unit at FN = 5 is 30 pixels", A, 30);
  equal("the unit shrinks with FN", [3, 4, 5, 6, 7, 8, 9, 10].map((fn) => C.lengths(fn).A), [78, 48, 30, 18, 11, 7, 4, 2]);
  const g = C.geometry(5, false, true);
  // vertices as the bytecode writes them: x = StartRect.x + A*S3 for the first piece, and so on.
  equal("the first piece's vertices", g.pieces[0].verts, [[13, 0], [13, 2], [8, 2]]);
  equal("the second piece's vertices", g.pieces[1].verts, [[8, 2], [8, 5], [0, 5]]);
  equal("their final offsets are (-8, +3) and (+5, -2) from the box offset", [C.finalOffset(C.start(), 0), C.finalOffset(C.start(), 1)].map((o) => [o.dx, o.dy - g.gap]), [[-8, 3], [5, -2]]);
}

done("curry-paradox");
