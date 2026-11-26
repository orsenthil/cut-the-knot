#!/usr/bin/env node
"use strict";

/*
 * Logic test for arrange-pyth/arrange-pyth-core.js.
 *
 *   node porting/check-arrange-pyth.mjs
 *
 * The applet has one continuous option: the point M can sit at any integer
 * pixel on the bottom edge of the left square, so A + B = S. We walk that
 * whole range for the applet's own 500x300 canvas and for six other canvases,
 * then try many more canvas sizes. For every position we check the shapes the
 * applet draws (four right triangles with legs A and B on each side, a square
 * of side c on the left, squares of sides A and B on the right), that both
 * squares are tiled exactly, and the page's claim c² = A² + B². Finally a
 * second, literal transcription of init(), DrawLPyth() and DrawRPyth() from
 * the bytecode is compared point by point with the core.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("arrange-pyth/arrange-pyth-core.js", "ArrangePythCore");
const P = C.pt;
const near = (p, q, tol = 1e-7) =>
  p && q && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const nearNum = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;

const insidePolygon = (p, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

/* ------------------------------------ 1. init(): the start and both squares */

{
  const g = C.layout();
  equal("the applet's canvas is 500 by 300", [g.width, g.height], [500, 300]);
  check("side is min(250,150) - 40 = 110", g.side === 110);
  check("the left square starts at x=70, y=95", g.x === 70 && g.y === 95);
  equal("left square corners, from bottom-left", g.L,
    [P(70, 205), P(180, 205), P(180, 95), P(70, 95)]);
  equal("right square corners, from bottom-left", g.R,
    [P(320, 205), P(430, 205), P(430, 95), P(320, 95)]);
  const s = C.start();
  equal("M starts one third along the bottom edge", s.m, P(83, 205));
  check("the start splits the side into 13 and 97", s.a === 13 && s.b === 97 && s.a + s.b === g.side);
}

/* --------------------------------- 2. the mouse band and the whole x range */

{
  const s = C.start();
  check("pressing on the bottom edge is allowed", C.canGrab(s, 83, 205));
  check("the 20-pixel band is inclusive", C.canGrab(s, 70, 185) && C.canGrab(s, 180, 225));
  check("a press just outside the band is ignored", !C.canGrab(s, 83, 184) && !C.canGrab(s, 83, 226));
  check("a press outside the edge's x range is ignored", !C.canGrab(s, 69, 205) && !C.canGrab(s, 181, 205));
  check("a drag outside the band leaves M alone", C.withM(s, 100, 300).m.x === 83);
  check("a fractional mouse x is rounded like AWT's int", C.withM(s, 117.6).m.x === 118);
  check("M is clamped to the edge", C.withM(s, -20).m.x === 70 && C.withM(s, 999).m.x === 180);
  const mid = C.midpoint(s);
  check("the midpoint button gives 55 and 55", mid.a === 55 && mid.b === 55);
  check("M never leaves the bottom edge", C.withM(s, 99).m.y === 205);
}

/* ------------------------ 3. every split on the applet's 500x300 canvas */

const canonical = [];
for (let x = 70; x <= 180; x++) canonical.push(C.withM(C.start(), x));

{
  let badSum = 0, badTriangles = 0, badSquares = 0, badAreas = 0, badIdentity = 0;
  for (const s of canonical) {
    const { a, b } = s;
    const g = C.layout(s.width, s.height);
    const m = C.measures(s);
    if (a + b !== g.side) badSum++;
    // Every yellow triangle, on either side, has legs a and b and area ab/2.
    const p = C.pieces(s);
    for (const piece of [...p.left, ...p.right].filter((q) => q.color === "yellow")) {
      const v = piece.points;
      const sides = [0, 1, 2].map((i) => Math.hypot(
        v[(i + 1) % 3].x - v[i].x, v[(i + 1) % 3].y - v[i].y));
      const legs = sides.slice().sort((u, w) => u - w);
      if (!nearNum(legs[0], Math.min(a, b)) || !nearNum(legs[1], Math.max(a, b)) ||
          !nearNum(legs[2], Math.hypot(a, b), 1e-6) ||
          !nearNum(C.area(v), (a * b) / 2, 1e-6)) badTriangles++;
    }
    // The red square on the left has side c; the two on the right have a and b.
    const redL = p.left[4].points, redA = p.right[4].points, redB = p.right[5].points;
    const sideLengths = (poly) => poly.map((v, i) => Math.hypot(
      poly[(i + 1) % poly.length].x - v.x, poly[(i + 1) % poly.length].y - v.y));
    const sL = sideLengths(redL), sA = sideLengths(redA), sB = sideLengths(redB);
    if (sL.some((d) => !nearNum(d, Math.hypot(a, b), 1e-6)) ||
        sA.some((d) => !nearNum(d, a)) || sB.some((d) => !nearNum(d, b))) badSquares++;
    if (!nearNum(m.leftArea, g.side * g.side, 1e-6) ||
        !nearNum(m.rightArea, g.side * g.side, 1e-6) ||
        !nearNum(m.hypotenuseArea, m.a2 + m.b2, 1e-6) ||
        !nearNum(m.squareAArea + m.squareBArea, m.a2 + m.b2, 1e-6)) badAreas++;
    if (!nearNum(m.c2, a * a + b * b) || !nearNum(m.hypotenuseSide * m.hypotenuseSide, m.c2, 1e-6)) badIdentity++;
  }
  check("all 111 positions split the side exactly", badSum === 0, `${badSum} failures`);
  check("all eight yellow triangles are right triangles with legs a and b", badTriangles === 0, `${badTriangles} failures`);
  check("the red pieces are squares on c, a and b", badSquares === 0, `${badSquares} failures`);
  check("both arrangements fill their square exactly once", badAreas === 0, `${badAreas} failures`);
  check("the page's claim c² = a² + b² holds at every position", badIdentity === 0, `${badIdentity} failures`);
}

/* ------------------- 4. sampled coverage: no gaps, no overlapping pieces */

{
  let bad = 0, samples = 0;
  for (const s of [canonical[0], canonical[13], canonical[55], canonical[110]]) {
    const g = C.layout(s.width, s.height);
    const p = C.pieces(s);
    for (let i = 1; i < 23; i++) {
      for (let j = 1; j < 23; j++) {
        // Non-integer points cannot land exactly on an applet edge.
        const u = i / 23 + 0.00013, v = j / 23 + 0.00007;
        const left = P(g.L[0].x + u * g.side, g.L[0].y - v * g.side);
        const right = P(g.R[0].x + u * g.side, g.R[0].y - v * g.side);
        const leftCover = p.left.filter((piece) => insidePolygon(left, piece.points)).length;
        const rightCover = p.right.filter((piece) => insidePolygon(right, piece.points)).length;
        if (leftCover !== 1 || rightCover !== 1) bad++;
        samples += 2;
      }
    }
  }
  check(`${samples} interior points are covered exactly once`, bad === 0, `${bad} failures`);
}

/* --------------------------- 5. many other canvas sizes and every split */

{
  const sizes = [[500, 300], [200, 200], [320, 240], [640, 400], [900, 300], [260, 700], [111, 137]];
  let bad = 0, positions = 0;
  for (const [w, h] of sizes) {
    const g = C.layout(w, h);
    if (g.side <= 0) continue;
    for (let x = g.L[0].x; x <= g.L[1].x; x++) {
      const s = C.withM(C.start(w, h), x);
      const m = C.measures(s);
      const p = C.pieces(s);
      if (s.a + s.b !== g.side || s.m.x !== x ||
          !nearNum(m.leftArea, g.side * g.side, 1e-6) ||
          !nearNum(m.rightArea, g.side * g.side, 1e-6) ||
          !nearNum(m.hypotenuseArea, m.squareAArea + m.squareBArea, 1e-6) ||
          p.left.length !== 5 || p.right.length !== 6) bad++;
      positions++;
    }
  }
  check(`the rearrangement holds at all ${positions} splits on seven canvases`, bad === 0, `${bad} failures`);

  const rand = rng(20261126);
  bad = 0;
  let configs = 0, odd = 0, oddDifferent = 0;
  for (let i = 0; i < 400; i++) {
    const w = 160 + Math.floor(rand() * 800), h = 160 + Math.floor(rand() * 600);
    const g = C.layout(w, h);
    if (g.side <= 0) continue;
    const s = C.withM(C.start(w, h), g.L[0].x + Math.floor(rand() * (g.side + 1)));
    const m = C.measures(s);
    if ((h - g.side) % 2 !== 0) {
      // A real applet quirk: with an odd (height - side) its integer y makes
      // the drawn square one pixel too tall, so the polygons carry a sliver.
      odd++;
      if (!nearNum(m.hypotenuseArea, m.a2 + m.b2, 1e-6)) oddDifferent++;
      continue;
    }
    if (s.a + s.b !== g.side ||
        !nearNum(m.hypotenuseArea, m.a2 + m.b2, 1e-6) ||
        !nearNum(m.leftArea, m.rightArea, 1e-6) ||
        !nearNum(m.squareAArea + m.squareBArea, m.c2, 1e-6)) bad++;
    configs++;
  }
  check(`the rearrangement holds on ${configs} random whole-pixel canvases`, bad === 0, `${bad} failures`);
  check(`the one-pixel rounding quirk appears on ${odd} odd-height canvases`, odd > 0 && oddDifferent > 0,
    `${odd} odd, ${oddDifferent} slivers`);
}

/* --------------- 6. a second transcription of the applet's own bytecode */

/* init(), using Java's int division literally. */
function appletLayout(w, h) {
  const pad = 20;
  const side = Math.min(Math.floor(w / 2), Math.floor(h / 2)) - 2 * pad;
  const x = Math.floor((Math.floor(w / 2) - side) / 2);
  const y = Math.floor((h - side) / 2);
  const L = [P(x, h - y), P(x + side, h - y), P(x + side, y), P(x, y)];
  const R = [P(x + Math.floor(w / 2), h - y),
    P(x + side + Math.floor(w / 2), h - y),
    P(x + side + Math.floor(w / 2), y),
    P(x + Math.floor(w / 2), y)];
  return { side, L, R };
}

/* mousePressed/mouseDragged: M.x = e.getX(); A = M.x - L0.x; B = L1.x - M.x. */
function appletState(w, h, mx) {
  const g = appletLayout(w, h);
  const M = P(mx, g.L[0].y);
  return { g, M, A: mx - g.L[0].x, B: g.L[1].x - mx };
}

/* DrawLPyth() and DrawRPyth(): locals named after their bytecode slots. */
function appletPieces(w, h, mx) {
  const { g, M, A, B } = appletState(w, h, mx);
  const L = g.L, R = g.R;
  const l1 = P(L[0].x, L[0].y - B);
  const l2 = P(L[3].x + B, L[3].y);
  const l3 = P(L[2].x, L[2].y + B);
  const left = [
    ["yellow", [L[0], M, l1]],
    ["yellow", [l1, L[3], l2]],
    ["yellow", [l2, L[2], l3]],
    ["yellow", [l3, L[1], M]],
    ["red", [l1, l2, l3, M]],
  ];
  const r2 = P(R[0].x + A, R[0].y - B);
  const r3 = P(R[0].x, R[0].y - B);
  const r4 = P(R[3].x + A, R[3].y);
  const r5 = P(R[2].x, R[2].y + A);
  const r6 = P(R[0].x + A, R[0].y);
  const right = [
    ["yellow", [R[0], r2, r6]],
    ["yellow", [R[0], r3, r2]],
    ["yellow", [R[2], r2, r4]],
    ["yellow", [R[2], r5, r2]],
    ["red", [R[3], r4, r2, r3]],
    ["red", [R[1], r6, r2, r5]],
  ];
  return { left, right };
}

{
  let badPieces = 0, badStart = 0, badCorners = 0;
  const cases = [];
  for (const x of canonical.map((s) => s.m.x)) cases.push([500, 300, x]);
  for (const [w, h] of [[200, 200], [320, 240], [640, 400], [900, 300], [260, 700],
    [111, 137], [280, 278], [505, 465], [853, 474]]) {
    const g = appletLayout(w, h);
    for (let x = g.L[0].x; x <= g.L[1].x; x++) cases.push([w, h, x]);
  }
  for (const [w, h, mx] of cases) {
    const s = C.withM(C.start(w, h), mx);
    const ref = appletPieces(w, h, mx);
    const ours = C.pieces(s);
    for (const side of ["left", "right"]) {
      if (ours[side].length !== ref[side].length) { badPieces++; continue; }
      ours[side].forEach((piece, i) => {
        const [color, points] = ref[side][i];
        if (piece.color !== color || piece.points.length !== points.length) badPieces++;
        piece.points.forEach((p, k) => { if (!near(p, points[k])) badPieces++; });
      });
    }
    const g = C.layout(w, h), ag = appletLayout(w, h);
    if (!near(g.L[0], ag.L[0]) || !near(g.R[2], ag.R[2]) || g.side !== ag.side) badCorners++;
    const st = C.start(w, h), ast = appletState(w, h, Math.floor((ag.L[0].x + ag.L[1].x) / 3));
    if (!near(st.m, ast.M) || st.a !== ast.A || st.b !== ast.B) badStart++;
  }
  check(`all ${cases.length} positions match DrawLPyth and DrawRPyth point by point`, badPieces === 0, `${badPieces} differences`);
  check("init()'s square corners agree with a literal transcription", badCorners === 0, `${badCorners} differences`);
  check("init()'s one-third start agrees with a literal transcription", badStart === 0, `${badStart} differences`);
}

/* --------------------------------------- 7. the saved position is plain data */

{
  const s = C.midpoint(C.withM(C.start(), 40));
  equal("the player's position survives JSON unchanged", JSON.parse(JSON.stringify(s)), s);
  const again = C.withM(s, s.m.x);
  check("re-setting the same M is idempotent", again.a === s.a && again.b === s.b);
}

done("arrange-pyth");
