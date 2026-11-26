#!/usr/bin/env node
"use strict";

/*
 * Logic test for area-of-parallelogram/area-of-parallelogram-core.js.
 *
 *   node porting/check-area-of-parallelogram.mjs
 *
 * The applet has no moves and no opponent: it draws a parallelogram ABCD,
 * drops perpendiculars from A and D onto BC (feet F and G, cyan triangles ABF
 * and DCG), and shows the pink overlap triangles CFK and BLG in the case its
 * page calls Figure 2. First the rules of the drawing (the parallelogram
 * invariant and the applet's Fix(2) on A and C) are checked. Then a second,
 * literal transcription of GeoSDoub.NearestPoint, GeoSDoub.Intersect and
 * AreaOfParallelogramCanvas.Between/Draw is compared with the core over a grid
 * of 1,044 parallelograms and 2,000 random ones. Finally every claim on the
 * page is checked over all of them: area = side times the distance to its
 * parallel mate, the rectangle has the same area, the two blue triangles are
 * equal, the three written equalities hold (with signed areas for Figure 2),
 * and each diagonal triangle is half the parallelogram.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("area-of-parallelogram/area-of-parallelogram-core.js", "AreaOfParallelogramCore");
const pt = (x, y) => ({ x, y });
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps;
const mid = (a, b) => pt((a.x + b.x) / 2, (a.y + b.y) / 2);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the starting top side", [s.A, s.D], [pt(110, 70), pt(270, 70)]);
  equal("the starting bottom side", [s.B, s.C], [pt(70, 230), pt(230, 230)]);
  check("the start is a parallelogram: A + C = B + D",
    near(s.A.x + s.C.x, s.B.x + s.D.x) && near(s.A.y + s.C.y, s.B.y + s.D.y));
  check("the start has horizontal parallel sides", s.A.y === s.D.y && s.B.y === s.C.y);
  check("an illustration has no result to report", C.result(s) === null);
  const g = C.compute(s);
  check("the start's area is base times height", near(g.area, 160 * 160, 1e-9) && near(g.base * g.height, g.area, 1e-9));
  check("the start is the ordinary Figure 1 case", g.figure === 1 && !g.kBetween && !g.lBetween);
  check("the blue triangles start equal", near(g.cyan1, g.cyan2, 1e-9) && near(g.cyan1, 3200, 1e-9));
  check("the cut-and-paste is shown by default", s.showCut === true);
  check("the cut-and-paste can be hidden and shown again",
    C.setOption(C.setOption(s, "showCut", false), "showCut", true).showCut === true);
  check("an unknown option is refused", C.setOption(s, "nonesuch", true) === s);
  check("a drag leaves the old position alone", C.movePoint(s, "A", pt(200, 150)) !== s && s.A.x === 110);
  check("A and C are Fix(2): dragging A keeps its y and moves C", (() => {
    const m = C.movePoint(s, "A", pt(200, 150));
    return m.A.y === 70 && m.A.x === 200 && near(m.C.x, 70 + 270 - 200, 1e-9) && m.C.y === 230;
  })());
  check("dragging C keeps its y and moves A", (() => {
    const m = C.movePoint(s, "C", pt(100, 150));
    return m.C.y === 230 && m.C.x === 100 && near(m.A.x, 270 + 70 - 100, 1e-9) && m.A.y === 70;
  })());
  check("dragging B is free and moves C", (() => {
    const m = C.movePoint(s, "B", pt(90, 190));
    return m.B.x === 90 && m.B.y === 190 && near(m.C.x, 90 + 160, 1e-9) && m.C.y === 190 && m.A.y === m.D.y;
  })());
  check("dragging D is free and moves A", (() => {
    const m = C.movePoint(s, "D", pt(300, 110));
    return m.D.x === 300 && m.D.y === 110 && near(m.A.x, 300 + 70 - 230, 1e-9) && m.A.y === 110 && m.B.y === m.C.y;
  })());
  check("the status describes base, height and the Figure 1 cut",
    /Base 160 times height 160 = 25600/.test(C.describe(s)) && /Figure 1/.test(C.describe(s)));
  check("a drag is remembered as explored", C.movePoint(s, "A", pt(120, 70)).explored === true);
  check("reset restores the picture but keeps the options", (() => {
    const m = C.setOption(C.movePoint(s, "D", pt(300, 110)), "showCut", false);
    const r = C.reset(m);
    return r.A.x === 110 && r.D.x === 270 && r.showCut === false && r.explored === false;
  })());
  check("an unknown point is refused", C.movePoint(s, "Q", pt(1, 1)) === s);
  check("a non-numeric pointer is refused", C.movePoint(s, "A", pt(NaN, 1)) === s && C.movePoint(s, "A", null) === s);
  equal("a drag off the board is clamped", C.movePoint(s, "A", pt(-99, 999)).A, pt(14, 70));
  const rand = rng(4242);
  let badShape = 0, badBounds = 0;
  for (let i = 0; i < 500; i++) {
    const r = C.randomize(s);
    const g2 = C.compute(r);
    if (!near(r.A.x + r.C.x, r.B.x + r.D.x, 1e-9) || !near(r.A.y + r.C.y, r.B.y + r.D.y, 1e-9) ||
        !near(g2.cyan1, g2.cyan2, 1e-7)) badShape++;
    for (const p of [r.A, r.B, r.C, r.D]) {
      if (p.x < C.MARGIN - 1e-9 || p.x > C.WIDTH - C.MARGIN + 1e-9 ||
          p.y < C.MARGIN - 1e-9 || p.y > C.HEIGHT - C.MARGIN + 1e-9) badBounds++;
    }
    /* Every drag of every corner must keep a parallelogram on the board. */
    const name = ["A", "B", "C", "D"][Math.floor(rand() * 4)];
    const m = C.movePoint(r, name, pt(rand() * 500 - 50, rand() * 400 - 50));
    const gm = C.compute(m);
    if (!near(m.A.x + m.C.x, m.B.x + m.D.x, 1e-8) || !near(m.A.y + m.C.y, m.B.y + m.D.y, 1e-8) ||
        !near(m.A.y, m.D.y, 1e-9) || !near(m.B.y, m.C.y, 1e-9) || !Number.isFinite(gm.area)) badShape++;
  }
  check("500 random shapes and a drag of any corner stay parallelograms", badShape === 0, `${badShape} wrong`);
  check("500 random shapes keep all four corners on the board", badBounds === 0, `${badBounds} wrong`);
}

/* ------------------------- 2. a literal second transcription of the code */

/* GeoSDoub.NearestPoint(p, a, b), from the bytecode: the guard compares p
   with a, not the length of the segment. */
function appletNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return pt(p.x, p.y);
  const dot = (p.x - a.x) * dx + (p.y - a.y) * dy;
  const t = dot / (dx * dx + dy * dy);
  return pt(a.x + dx * t, a.y + dy * t);
}

/* GeoSDoub.Intersect(p1,p2,p3,p4), from the bytecode: the NaN guard on the
   determinant is |d| < 1, not d === 0. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const d = a1 * b2 - a2 * b1;
  if (Math.abs(d) < 1) return pt(NaN, NaN);
  return pt((b1 * c2 - b2 * c1) / d, (c1 * a2 - c2 * a1) / d);
}

/* AreaOfParallelogramCanvas.Between(p1,p2,p3), from the bytecode, 0.1 slop. */
function appletBetween(p1, p2, p3) {
  const tol = 0.1;
  if (p1.x - tol > p2.x || p2.x - tol > p3.x) {
    if (p1.x < p2.x - tol || p2.x < p3.x - tol) return false;
  }
  if (p1.y - tol > p2.y || p2.y - tol > p3.y) {
    if (p1.y < p2.y - tol || p2.y < p3.y - tol) return false;
  }
  return true;
}

/* AreaOfParallelogramCanvas.Draw, with the bytecode's four locals S2..S4. */
function appletDraw(s) {
  const F = appletNearest(s.A, s.B, s.C);
  const G = appletNearest(s.D, s.B, s.C);
  const K = appletIntersect(s.A, F, s.C, s.D);
  const kB = appletBetween(s.A, K, F);
  const L = appletIntersect(s.D, G, s.A, s.B);
  const lB = appletBetween(s.D, L, G);
  return { F, G, K, L, kB, lB };
}

/* A grid over every reachable kind of shape: where the feet fall and how
   far the top side is slid from the bottom one. */
function parallelogram(bx, by, L, ax, ay) {
  return { A: pt(ax, ay), B: pt(bx, by), C: pt(bx + L, by), D: pt(ax + L, ay),
    showCut: true, showNames: false, explored: false };
}

const shapes = [];
for (const L of [90, 130, 170]) {
  for (const bx of [30, 70, 110, 150]) {
    for (let ax = 20; ax <= 300; ax += 10) {
      for (const ay of [50, 90, 130]) shapes.push(parallelogram(bx, 230, L, ax, ay));
    }
  }
}
const rand2 = rng(20261126);
for (let i = 0; i < 2000; i++) {
  shapes.push(parallelogram(
    20 + rand2() * 180, 180 + rand2() * 70, 60 + rand2() * 140,
    20 + rand2() * 180, 30 + rand2() * 100,
  ));
}
check("the grid and random sample cover both figure cases",
  shapes.some((s) => C.compute(s).figure === 1) && shapes.some((s) => C.compute(s).figure === 2));

{
  let badFootF = 0, badFootG = 0, badK = 0, badL = 0, badBetween = 0;
  for (const s of shapes) {
    const core = C.compute(s), app = appletDraw(s);
    if (!near(core.F.x, app.F.x, 1e-8) || !near(core.F.y, app.F.y, 1e-8)) badFootF++;
    if (!near(core.G.x, app.G.x, 1e-8) || !near(core.G.y, app.G.y, 1e-8)) badFootG++;
    const same = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || near(a, b, 1e-7);
    if (!same(core.K.x, app.K.x) || !same(core.K.y, app.K.y)) badK++;
    if (!same(core.L.x, app.L.x) || !same(core.L.y, app.L.y)) badL++;
    if (core.kBetween !== app.kB || core.lBetween !== app.lB) badBetween++;
  }
  check(`${shapes.length} feet F match the bytecode NearestPoint`, badFootF === 0, `${badFootF} wrong`);
  check(`${shapes.length} feet G match the bytecode NearestPoint`, badFootG === 0, `${badFootG} wrong`);
  check(`${shapes.length} intersections K match the bytecode Intersect`, badK === 0, `${badK} wrong`);
  check(`${shapes.length} intersections L match the bytecode Intersect`, badL === 0, `${badL} wrong`);
  check(`${shapes.length} pink-triangle tests match the bytecode Between`, badBetween === 0, `${badBetween} wrong`);
}

/* The applet's own small guards, checked directly. */
{
  check("NearestPoint returns the point itself when p is within 0.1 of a",
    C.nearestPoint(pt(1, 1), pt(1.05, 1.05), pt(90, 4)).x === 1);
  check("Intersect returns NaN for lines whose determinant is under one",
    Number.isNaN(C.intersect(pt(0, 0), pt(0, 1), pt(5, 0), pt(5, 1)).x));
  check("Between accepts a point on the segment either way round",
    C.between(pt(0, 0), pt(5, 0), pt(10, 0)) && C.between(pt(10, 0), pt(5, 0), pt(0, 0)));
  check("Between refuses a point beyond the segment and allows the 0.1 slop",
    !C.between(pt(0, 0), pt(11, 0), pt(10, 0)) && C.between(pt(0, 0), pt(10.05, 0), pt(10, 0)));
}

/* ----------------------------------- 3. every claim the page makes */

{
  let badArea = 0, badRect = 0, badWidth = 0, badBlue = 0;
  let bad1 = 0, bad2 = 0, bad2b = 0, bad3 = 0, badHalf = 0, badPink = 0, skipped = 0;
  for (const s of shapes) {
    const g = C.compute(s);
    const scale = Math.max(1, g.area);
    const eps = 1e-8 * scale;
    if (!near(g.area, g.base * g.height, eps)) badArea++;
    if (!near(g.rectArea, g.area, eps)) badRect++;
    if (!near(g.rectWidth, g.base, eps)) badWidth++;
    if (!near(g.cyan1, g.cyan2, eps)) badBlue++;
    if (!near(g.id1, 0, eps)) bad1++;
    if (!near(g.id3, 0, eps)) bad3++;
    if (!near(g.diagonal1, g.area / 2, eps) || !near(g.diagonal2, g.area / 2, eps)) badHalf++;
    /* When AF is parallel to CD (or DG to AB) the applet's Intersect returns
       NaN; the identities involving K or L are then undefined, as in the
       applet. At the exact boundary K = F the pink triangle has zero area. */
    if (!Number.isFinite(g.K.x) || !Number.isFinite(g.L.x)) {
      skipped++;
      continue;
    }
    if (!near(g.id2, 0, eps)) bad2++;
    if (!near(g.id2b, 0, eps)) bad2b++;
    if (g.figure === 1 && (g.pink1 || g.pink2)) badPink++;
    if (g.kBetween && !(g.pink1 >= 0)) badPink++;
    if (g.lBetween && !(g.pink2 >= 0)) badPink++;
  }
  check(`${shapes.length} parallelograms: area is one side times its height`, badArea === 0, `${badArea} wrong`);
  check(`${shapes.length} parallelograms: the cut-and-paste rectangle has that area`, badRect === 0, `${badRect} wrong`);
  check(`${shapes.length} parallelograms: the rectangle's width is the base`, badWidth === 0, `${badWidth} wrong`);
  check(`${shapes.length} parallelograms: the two blue triangles are congruent`, badBlue === 0, `${badBlue} wrong`);
  check("page's equality (1), Area(ABCD) = blue + rest = rectangle", bad1 === 0, `${bad1} wrong`);
  check("page's equality (2), with the pink overlap subtracted", bad2 === 0, `${bad2} wrong`);
  check("the reflected equality (2), with the other pink overlap", bad2b === 0, `${bad2b} wrong`);
  check("page's equality (3), the trapezoid minus a blue triangle", bad3 === 0, `${bad3} wrong`);
  check("the corollary: each diagonal triangle is half the parallelogram", badHalf === 0, `${badHalf} wrong`);
  check("the pink triangles appear exactly in the Figure 2 cases", badPink === 0, `${badPink} wrong`);
}

done("area-of-parallelogram");
