#!/usr/bin/env node
"use strict";

/*
 * Logic test for carpets-in-parallelogram/carpets-in-parallelogram-core.js.
 *
 *   node porting/check-carpets-in-parallelogram.mjs
 *
 * The applet has no opponent and no win: it draws P on BC, Q on CD and R on
 * AD, cuts the four lines AQ, BR, AP and PR, and paints the pieces. First the
 * rules of the drawing are checked (the opening points, the horizontal-corner
 * drags and the three side-point coefficients). Then the five intersections,
 * the InsideTest calls and the four corner drags are compared with a second,
 * literal transcription of GeoSDoub.Intersect, InsideTest.IsInside,
 * UpgradePoints and UpgradeMoveable from the bytecode, over a grid and 2,000
 * random configurations. Finally both equalities on the page are checked over
 * every drawn configuration: pink + blue = orange, and painted red - blue =
 * half the parallelogram, independent of P, Q and R.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("carpets-in-parallelogram/carpets-in-parallelogram-core.js", "CarpetsInParallelogramCore");
const pt = (x, y) => ({ x, y });
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const at = (a, b, t) => pt((1 - t) * a.x + t * b.x, (1 - t) * a.y + t * b.y);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the opening lower side", [s.A, s.B], [pt(80, 240), pt(240, 240)]);
  equal("the opening upper side", [s.C, s.D], [pt(320, 60), pt(160, 60)]);
  equal("the opening coefficients", [s.coefP, s.coefQ, s.coefR], [0.7, 0.5, 0.6]);
  check("the opening sides are parallel and equal",
    near(s.B.x - s.A.x, s.C.x - s.D.x) && s.A.y === s.B.y && s.C.y === s.D.y);
  check("the three side points start on their sides",
    C.inside(at(s.B, s.C, s.coefP), s.B, s.C) &&
    C.inside(at(s.C, s.D, s.coefQ), s.C, s.D) &&
    C.inside(at(s.A, s.D, s.coefR), s.A, s.D));
  check("an illustration has no result", C.result(s) === null);
  check("both checkboxes start off, as in the applet", !s.showNames && !s.showHint);
  check("the two checkboxes can be set and cleared", (() => {
    const t = C.setOption(C.setOption(s, "showHint", true), "showNames", true);
    return t.showHint && t.showNames && !C.setOption(t, "showHint", false).showHint;
  })());
  check("an unknown option is refused", C.setOption(s, "nonesuch", true) === s);
  check("reset keeps the checkboxes", (() => {
    const t = C.setOption(C.movePoint(s, "P", pt(300, 100)), "showHint", true);
    const r = C.reset(t);
    return r.A.x === 80 && r.coefP === 0.7 && r.showHint && !r.explored;
  })());
  check("an unknown handle is refused", C.movePoint(s, "X", pt(1, 1)) === s);
  check("a non-numeric pointer is refused",
    C.movePoint(s, "A", pt(NaN, 1)) === s && C.movePoint(s, "P", null) === s);
  check("a drag is remembered as explored", C.movePoint(s, "P", pt(300, 100)).explored === true);
  check("a pointer far off the board is clamped", (() => {
    const m = C.movePoint(s, "A", pt(-99, 999));
    return m.A.x === C.MARGIN && m.A.y === 240 && m.D.x >= C.MARGIN;
  })());
  check("the status line reports the constant difference",
    /Painted red \d+ minus blue \d+ = 14400/.test(C.describe(s)) && /Half the parallelogram is 14400/.test(C.describe(s)));
  const g = C.compute(s);
  equal("the opening red pieces", [g.redA, g.redD, g.redC, g.redB].map(Math.round),
    [1994, 4472, 3840, 2613]);
  check("the opening picture is drawn", !g.noDraw && g.finite && g.insideP && g.insideQ && g.insideR);
}

/* ------------------------- 2. a literal second transcription of the code */

/* GeoSDoub.Intersect, from javap -c -p of GeoSDoub.class. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const d = a1 * b2 - a2 * b1;
  if (Math.abs(d) < 1) return pt(NaN, NaN);
  return pt((b1 * c2 - b2 * c1) / d, (c1 * a2 - c2 * a1) / d);
}

/* InsideTest.IsInside, from javap -c -p of InsideTest.class. */
function appletInside(p, a, b) {
  return (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 0;
}

/* UpgradePoints + UpgradeMoveable, from CarpetsInParallelogramCanvas.
   Only horizontal drags are considered: CTKMoveableDoub.Fix(2) locks y. */
function appletDrag(s, name, p) {
  const next = Object.assign({}, s);
  const A = Object.assign({}, s.A), B = Object.assign({}, s.B);
  const C0 = Object.assign({}, s.C), D = Object.assign({}, s.D);
  const width = B.x - A.x;
  if (name === "A") { A.x = p.x; D.x = C0.x - (B.x - A.x); }
  else if (name === "B") { B.x = p.x; C0.x = D.x + (B.x - A.x); }
  else if (name === "C") { C0.x = p.x; D.x = C0.x - width; }
  else if (name === "D") { D.x = p.x; C0.x = D.x + width; }
  else if (name === "P") next.coefP = dist(p, s.B) / dist(s.B, s.C);
  else if (name === "Q") next.coefQ = dist(p, s.C) / dist(s.D, s.C);
  else if (name === "R") next.coefR = dist(p, s.A) / dist(s.A, s.D);
  Object.assign(next, { A, B, C: C0, D });
  /* UpgradeMoveable runs after a corner drag, not after a side-point drag. */
  if (["A", "B", "C", "D"].includes(name)) {
    next.R = at(A, D, s.coefR);
    next.P = at(B, C0, s.coefP);
    next.Q = at(C0, D, s.coefQ);
  }
  return next;
}

/* Compute() and Draw()'s five intersections, independently transcribed. */
function appletDraw(s) {
  const P = at(s.B, s.C, s.coefP), Q = at(s.C, s.D, s.coefQ), R = at(s.A, s.D, s.coefR);
  const S = appletIntersect(s.B, R, s.A, Q);
  const T = appletIntersect(P, R, s.A, Q);
  const U = appletIntersect(s.B, Q, P, R);
  const V = appletIntersect(s.B, Q, s.A, P);
  const W = appletIntersect(s.B, R, s.A, P);
  const noDraw = [S, T, U, V, W].some((p) => Number.isNaN(p.x)) ||
    !appletInside(P, s.B, s.C) || !appletInside(Q, s.C, s.D) || !appletInside(R, s.A, s.D);
  return { P, Q, R, S, T, U, V, W, noDraw };
}

/* Every corner drag the applet allows, compared with its own formulas. */
{
  const s = C.start({});
  let wrong = 0;
  for (const [name, x] of [["A", 100], ["A", 60], ["B", 200], ["B", 290],
                           ["C", 300], ["C", 270], ["D", 180], ["D", 130]]) {
    const m = C.movePoint(s, name, pt(x, 123));
    const a = appletDrag(s, name, pt(x, 123));
    if (!near(m.A.x, a.A.x) || !near(m.B.x, a.B.x) || !near(m.C.x, a.C.x) || !near(m.D.x, a.D.x)) wrong++;
    const gm = C.compute(m);
    if (!near(gm.P.x, a.P.x) || !near(gm.Q.x, a.Q.x) || !near(gm.R.x, a.R.x)) wrong++;
  }
  check("eight corner drags match the applet's UpgradePoints/UpgradeMoveable", wrong === 0, `${wrong} wrong`);
  check("a corner drag keeps the top and bottom sides equal", (() => {
    const m = C.movePoint(s, "B", pt(200, 123));
    return near(m.B.x - m.A.x, m.C.x - m.D.x) && m.A.y === m.B.y && m.C.y === m.D.y;
  })());
  let coefWrong = 0;
  const rand = rng(1984);
  for (const name of ["P", "Q", "R"]) {
    const [a, b, key] = name === "P" ? [s.B, s.C, "coefP"]
      : name === "Q" ? [s.C, s.D, "coefQ"] : [s.A, s.D, "coefR"];
    for (let i = 0; i < 200; i++) {
      const t = rand();
      const m = C.movePoint(s, name, at(a, b, t));
      if (!near(m[key], t, 1e-9)) coefWrong++;
    }
  }
  check("600 side-point drags reproduce the applet's distance-ratio coefficients", coefWrong === 0, `${coefWrong} wrong`);
  check("the side points never leave their sides", (() => {
    let bad = 0;
    for (let i = 0; i < 200; i++) {
      const t = rand() * 2 - 0.5; // deliberately off the segment
      const m = C.movePoint(s, "P", at(s.B, s.C, t));
      if (m.coefP < 0 || m.coefP > 1) bad++;
    }
    return bad === 0;
  })());
  check("projectCoef clamps to the side", C.projectCoef(at(s.B, s.C, -10), s.B, s.C) === 0 &&
    C.projectCoef(at(s.B, s.C, 10), s.B, s.C) === 1);
}

/* A grid plus random configurations, of exactly the kind the applet draws. */
function shape(ax, base, skew, ay, dy, p, q, r) {
  return {
    A: pt(ax, ay), B: pt(ax + base, ay),
    C: pt(ax + skew + base, dy), D: pt(ax + skew, dy),
    coefP: p, coefQ: q, coefR: r,
    showNames: false, showHint: false, explored: false,
  };
}
const shapes = [];
for (const ax of [30, 70, 110]) {
  for (const base of [100, 160]) {
    for (const skew of [-40, 0, 40, 80]) {
      for (const p of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        for (const q of [0.2, 0.5, 0.8]) {
          for (const r of [0.15, 0.6, 0.85]) shapes.push(shape(ax, base, skew, 240, 60, p, q, r));
        }
      }
    }
  }
}
const rand2 = rng(20261126);
for (let i = 0; i < 2000; i++) {
  shapes.push(shape(
    20 + rand2() * 160, 80 + rand2() * 140, -60 + rand2() * 180,
    200 + rand2() * 60, 40 + rand2() * 80,
    0.05 + rand2() * 0.9, 0.05 + rand2() * 0.9, 0.05 + rand2() * 0.9,
  ));
}
/* P = B and R = A make BR and AP the same horizontal line, so GeoSDoub's
   Intersect returns NaN and the applet hides the carpet (NoDraw). */
shapes.push(shape(70, 160, 40, 240, 60, 0, 0.5, 0));
shapes.push(shape(40, 130, -30, 220, 70, 0, 0.4, 0));
check("the sample includes drawn and hidden pictures",
  shapes.some((s) => !C.compute(s).noDraw) && shapes.some((s) => C.compute(s).noDraw));

{
  let badS = 0, badT = 0, badU = 0, badV = 0, badW = 0;
  let badSide = 0, badNoDraw = 0;
  const same = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || near(a, b, 1e-7);
  for (const s of shapes) {
    const core = C.compute(s), app = appletDraw(s);
    for (const [key, bad] of [["S", () => badS++], ["T", () => badT++], ["U", () => badU++],
                              ["V", () => badV++], ["W", () => badW++]]) {
      if (!same(core[key].x, app[key].x) || !same(core[key].y, app[key].y)) bad();
    }
    if (core.insideP !== appletInside(app.P, s.B, s.C) ||
        core.insideQ !== appletInside(app.Q, s.C, s.D) ||
        core.insideR !== appletInside(app.R, s.A, s.D)) badSide++;
    if (core.noDraw !== app.noDraw) badNoDraw++;
  }
  const n = shapes.length;
  check(`${n} intersections S match the bytecode`, badS === 0, `${badS} wrong`);
  check(`${n} intersections T match the bytecode`, badT === 0, `${badT} wrong`);
  check(`${n} intersections U match the bytecode`, badU === 0, `${badU} wrong`);
  check(`${n} intersections V match the bytecode`, badV === 0, `${badV} wrong`);
  check(`${n} intersections W match the bytecode`, badW === 0, `${badW} wrong`);
  check(`${n} InsideTest results match the bytecode`, badSide === 0, `${badSide} wrong`);
  check(`${n} NoDraw flags match the bytecode`, badNoDraw === 0, `${badNoDraw} wrong`);
}

/* The applet's own small guards, directly. */
{
  check("Intersect returns NaN when the determinant is under one",
    Number.isNaN(C.intersect(pt(0, 0), pt(0, 1), pt(5, 0), pt(5, 1)).x));
  check("Intersect returns NaN for two horizontal lines",
    Number.isNaN(C.intersect(pt(0, 0), pt(10, 0), pt(0, 5), pt(10, 5)).x));
  check("InsideTest accepts a point between its ends",
    C.inside(pt(5, 0), pt(0, 0), pt(10, 0)) && C.inside(pt(10, 0), pt(0, 0), pt(10, 0)));
  check("InsideTest refuses a point beyond an end", !C.inside(pt(11, 0), pt(0, 0), pt(10, 0)));
}

/* ----------------------------------- 3. every claim the page makes */

{
  let badBig = 0, badCarpet = 0, badConclusion = 0, badPaint = 0, badDiff = 0;
  let drawn = 0, skipped = 0;
  for (const s of shapes) {
    const g = C.compute(s);
    if (g.noDraw) { skipped++; continue; }
    drawn++;
    const eps = 1e-7 * Math.max(1, g.para);
    if (!near(g.bigRed, g.half, eps)) badBig++;
    if (!near(g.carpet, 0, eps)) badCarpet++;
    if (!near(g.leftover, 0, eps)) badConclusion++;
    if (!near(g.difference, g.bigRed, eps)) badPaint++;
    if (!near(g.red, g.bigRed - g.pinkR - g.pinkP + g.orange, eps)) badDiff++;
  }
  check("RED, the two triangles ADQ and BCQ, is half the parallelogram", badBig === 0, `${badBig} wrong`);
  check("page's (1): pink RST + blue + pink PUV = orange ABW", badCarpet === 0, `${badCarpet} wrong`);
  check("page's conclusion: painted red minus blue = RED", badConclusion === 0, `${badConclusion} wrong`);
  check("painted red minus blue = half the parallelogram", badPaint === 0, `${badPaint} wrong`);
  check("the four red pieces are the two big triangles minus the pink pieces plus the orange one",
    badDiff === 0, `${badDiff} wrong`);
  check("enough drawn configurations were checked", drawn > 2500, `${drawn} drawn, ${skipped} hidden`);
}

/* Independence of P, Q and R for one fixed parallelogram. */
{
  const base = shape(70, 160, 40, 240, 60, 0.5, 0.5, 0.5);
  let bad = 0, values = new Set();
  const rand3 = rng(777);
  for (let i = 0; i < 500; i++) {
    const s = Object.assign({}, base, {
      coefP: 0.01 + rand3() * 0.98,
      coefQ: 0.01 + rand3() * 0.98,
      coefR: 0.01 + rand3() * 0.98,
    });
    const g = C.compute(s);
    if (g.noDraw) continue;
    values.add(Math.round(g.difference));
    if (!near(g.difference, C.compute(base).para / 2, 1e-7 * g.para)) bad++;
  }
  check("500 positions of P, Q and R all give the same difference", bad === 0 && values.size === 1,
    `${bad} wrong, ${values.size} values`);
}

done("carpets-in-parallelogram");
