#!/usr/bin/env node
"use strict";

/*
 * Logic test for directly-similar-1/directly-similar-1-core.js.
 *
 *   node porting/check-directly-similar-1.mjs
 *
 * Three things are checked. (1) init(), GetSquare() and TranslateLines() are
 * compared with a second, literal transcription of DirectlySimilar1Canvas's
 * bytecode: init over many canvas sizes, GetSquare over every pair of integer
 * corners in a 13x13 grid plus 2,000 fractional pairs, and the translation
 * over 59,049 configurations plus 3,000 fractional ones. (2) The page's exact
 * claim ("A1B1C1D1 is a square") is tested over 8,100 non-coincident
 * configurations built from 45 different squares and 5 positions of P, and
 * over 2,000 randomly generated directly similar figures; a real counterexample
 * to the page would fail this test. (3) The limits of the claim are checked:
 * the order of the corresponding corners matters, and two squares that are
 * translates of each other collapse to one point at P.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("directly-similar-1/directly-similar-1-core.js", "DirectlySimilar1Core");
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const samePoint = (a, b, eps = 1e-9) => near(a.x, b.x, eps) && near(a.y, b.y, eps);
const samePoints = (a, b, eps = 1e-9) =>
  a.length === b.length && a.every((p, i) => samePoint(p, b[i], eps));

/* ------------------------------------------------------------------ 1. init */

/* Literal translation of DirectlySimilar1Canvas.init(), including Java's
 * integer division and the second halving of s before corners 3 and 4. */
function appletInit(w, h) {
  const size = { width: w, height: h };
  const rect = { x: 0, y: 0, width: w, height: h };
  const h2 = Math.trunc(rect.height / 2);
  let s = Math.trunc(Math.min(size.width, size.height) / 4);
  const v = [];
  v.push({
    x: Math.trunc(size.width / 3) - Math.trunc(s / 2),
    y: Math.trunc(size.height / 2) - Math.trunc(s / 2),
  });
  v.push({
    x: Math.trunc(size.width / 3) + Math.trunc(s / 2),
    y: Math.trunc(size.height / 2) + Math.trunc(s / 2),
  });
  s = Math.trunc(s / 2);
  v.push({
    x: Math.trunc(size.width / 3) + Math.trunc(s / 2),
    y: Math.trunc(size.height / 2) - Math.trunc(s / 2),
  });
  v.push({
    x: Math.trunc(size.width / 3) - Math.trunc(s / 2),
    y: Math.trunc(size.height / 2) + Math.trunc(s / 2),
  });
  v.push({ x: Math.trunc(3 * size.width / 4), y: h2 });
  return v;
}

{
  const s = C.start({});
  check("the applet's canvas is 500 by 500", s.width === 500 && s.height === 500);
  check("the position holds five points", s.points.length === 5);
  equal("the old page's first corner", s.points[0], { x: 104, y: 188 });
  equal("the old page's second corner", s.points[1], { x: 228, y: 312 });
  equal("the old page's third corner", s.points[2], { x: 197, y: 219 });
  equal("the old page's fourth corner", s.points[3], { x: 135, y: 281 });
  equal("the old page's point P", s.points[4], { x: 375, y: 250 });
  check("all starting points lie on the board", s.points.every((p) =>
    p.x >= 0 && p.x <= 500 && p.y >= 0 && p.y <= 500));
  check("an illustration has no result to report", C.result(s) === null);
  check("the status describes the third square", /square/.test(C.describe(s)) && /degrees/.test(C.describe(s)));

  let bad = 0;
  for (let w = 1; w <= 640; w += 7) {
    for (const h of [1, 2, 7, 63, 250, 500, 777]) {
      if (!samePoints(C.start({ width: w, height: h }).points, appletInit(w, h))) bad++;
    }
  }
  check("init layout matches the bytecode for 644 canvas sizes", bad === 0, `${bad} layouts wrong`);

  const moved = C.movePoint(s, 4, { x: 12, y: 34 });
  check("moving P keeps the other four corners", samePoints(moved.points.slice(0, 4), s.points.slice(0, 4)));
  check("moving P changes only P", moved.points[4].x === 12 && moved.points[4].y === 34);
  check("the old position is not mutated", s.points[4].x === 375);
  check("an invalid point index is refused", C.movePoint(s, 5, { x: 1, y: 1 }) === s);
  check("a non-finite point is refused", C.movePoint(s, 0, { x: NaN, y: 1 }) === s);
}

/* ------------------------------------------------ 2. GetSquare against bytecode */

/* Literal GetSquare(DoubPoint,DoubPoint); the order of the additions matters
 * for exact floating point, so the locals follow the bytecode operands. */
function appletSquare(A, B) {
  const m = { x: (A.x + B.x) / 2.0, y: (A.y + B.y) / 2.0 };
  return [
    { x: A.x, y: A.y },
    { x: m.x + (A.y - m.y), y: m.y + (m.x - A.x) },
    { x: B.x, y: B.y },
    { x: m.x - (A.y - m.y), y: m.y + (A.x - m.x) },
  ];
}

function appletTranslate(P, first, second) {
  return first.map((q, k) => ({
    x: P.x + q.x - second[k].x,
    y: P.y + q.y - second[k].y,
  }));
}

{
  equal("a diamond from opposite corners (0,0) and (2,0)",
    C.square({ x: 0, y: 0 }, { x: 2, y: 0 }),
    [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 1, y: -1 }]);

  let wrong = 0, notSquare = 0, wrongDiagonal = 0;
  const grid = [];
  for (let x = -6; x <= 6; x++) for (let y = -6; y <= 6; y++) grid.push({ x, y });
  let pairs = 0;
  for (const a of grid) {
    for (const b of grid) {
      pairs++;
      const got = C.square(a, b);
      if (!samePoints(got, appletSquare(a, b), 0)) wrong++;
      if (!samePoint(got[0], a, 0) || !samePoint(got[2], b, 0)) wrongDiagonal++;
      if (!samePoint(a, b, 0) && !C.isSquare(got)) notSquare++;
    }
  }
  check("all 28,561 integer corner pairs match GetSquare exactly", pairs === 28561 && wrong === 0,
    `${wrong} of ${pairs} wrong`);
  check("corners 0 and 2 are always the dragged points", wrongDiagonal === 0);
  check("every non-degenerate square from the grid is a square", notSquare === 0, `${notSquare} wrong`);

  const rand = rng(4617);
  let fractional = 0;
  for (let i = 0; i < 2000; i++) {
    const a = { x: (rand() - 0.5) * 2000, y: (rand() - 0.5) * 2000 };
    const b = { x: (rand() - 0.5) * 2000, y: (rand() - 0.5) * 2000 };
    if (!samePoints(C.square(a, b), appletSquare(a, b), 1e-9)) fractional++;
  }
  check("2,000 fractional corner pairs match GetSquare", fractional === 0, `${fractional} wrong`);
}

/* --------------------------------------- 3. TranslateLines against bytecode */

{
  const coords = [-3, 0, 4];
  const small = [];
  for (const x of coords) for (const y of coords) small.push({ x, y });
  const pairs = [];
  for (const a of small) for (const b of small) pairs.push([a, b]);

  let wrong = 0, total = 0;
  for (const [a1, b1] of pairs) {
    for (const [a2, b2] of pairs) {
      const s1 = C.square(a1, b1), s2 = C.square(a2, b2);
      for (const P of small) {
        const state = C.start({});
        state.points = [a1, b1, a2, b2, P];
        if (!samePoints(C.figures(state).third, appletTranslate(P, s1, s2), 0)) wrong++;
        total++;
      }
    }
  }
  check("59,049 configurations match TranslateLines exactly", total === 59049 && wrong === 0,
    `${wrong} of ${total} wrong`);

  const rand = rng(9011);
  let fractional = 0;
  for (let i = 0; i < 3000; i++) {
    const p = [0, 1, 2, 3, 4].map(() => ({
      x: (rand() - 0.5) * 4000, y: (rand() - 0.5) * 4000,
    }));
    const state = C.start({});
    state.points = p;
    const first = appletSquare(p[0], p[1]), second = appletSquare(p[2], p[3]);
    if (!samePoints(C.figures(state).first, first, 1e-9) ||
        !samePoints(C.figures(state).second, second, 1e-9) ||
        !samePoints(C.translated(state), appletTranslate(p[4], first, second), 1e-9)) fractional++;
  }
  check("3,000 fractional configurations match the drawing method", fractional === 0,
    `${fractional} wrong`);

  /* A side of the third square is the difference of the corresponding sides. */
  let sideErrors = 0;
  for (let i = 0; i < 2000; i++) {
    const p = [0, 1, 2, 3, 4].map(() => ({
      x: (rand() - 0.5) * 600, y: (rand() - 0.5) * 600,
    }));
    const state = C.start({});
    state.points = p;
    const f = C.figures(state);
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4;
      const expectedX = (f.first[k1].x - f.first[k].x) - (f.second[k1].x - f.second[k].x);
      const expectedY = (f.first[k1].y - f.first[k].y) - (f.second[k1].y - f.second[k].y);
      if (!near(f.third[k1].x - f.third[k].x, expectedX, 1e-9) ||
          !near(f.third[k1].y - f.third[k].y, expectedY, 1e-9)) sideErrors++;
    }
  }
  check("each new side is the difference of the two matching sides", sideErrors === 0,
    `${sideErrors} wrong sides`);

  const state = C.start({});
  const shifted = C.movePoint(state, 4, { x: state.points[4].x + 37, y: state.points[4].y - 21 });
  const a = C.translated(state), b = C.translated(shifted);
  check("moving P moves every new corner by the same amount",
    b.every((q, k) => samePoint(q, { x: a[k].x + 37, y: a[k].y - 21 }, 1e-9)));
  const before = C.squareInfo(a).side, after = C.squareInfo(b).side;
  check("moving P leaves the new square's side length alone", near(before, after, 1e-9));
}

/* -------------------------------------------------- 4. the page's exact claim */

{
  const centers = [];
  for (const cx of [0, 50, 120]) for (const cy of [0, 80, 150]) centers.push({ x: cx, y: cy });
  const diagonals = [[40, 0], [0, 40], [30, 20], [-20, 30], [60, -15]];
  const squares = [];
  for (const c of centers) {
    for (const [dx, dy] of diagonals) {
      squares.push([{ x: c.x + dx, y: c.y + dy }, { x: c.x - dx, y: c.y - dy }]);
    }
  }
  const Ps = [
    { x: 0, y: 0 }, { x: 250, y: 90 }, { x: -70, y: 30 },
    { x: 333, y: -17 }, { x: 12.5, y: 401 },
  ];
  check("the grid really holds 45 different squares", squares.length === 45);

  let bad = 0, total = 0, coincident = 0, collapsedWrong = 0;
  for (const [a1, b1] of squares) {
    for (const [a2, b2] of squares) {
      for (const P of Ps) {
        const state = C.start({});
        state.points = [a1, b1, a2, b2, P];
        const f = C.figures(state);
        /* A translated copy of the same square gives e - d = 0, so the
         * formula degenerates to one point at P + (first[0] - second[0]). */
        const degenerate = C.squareInfo(f.third).side < 1e-9;
        if (degenerate) {
          coincident++;
          const center = {
            x: P.x + f.first[0].x - f.second[0].x,
            y: P.y + f.first[0].y - f.second[0].y,
          };
          if (!f.third.every((q) => samePoint(q, center, 1e-9))) collapsedWrong++;
        } else {
          if (!C.isSquare(f.third, 1e-7)) bad++;
          total++;
        }
      }
    }
  }
  check("the page's claim holds in 8,100 non-coincident configurations",
    total === 8100 && bad === 0, `${bad} of ${total} failed`);
  check("translated copies of one square collapse to one point",
    coincident === 2025 && collapsedWrong === 0, `${coincident} collapses, ${collapsedWrong} wrong`);

  /* Independently generated directly similar figures, not the applet's
   * GetSquare: corners c + i^k*d and c' + i^k*e for random complex d,e. */
  const rand = rng(31337);
  const turn = (v) => ({ x: -v.y, y: v.x });
  let genericBad = 0;
  for (let i = 0; i < 2000; i++) {
    const c = { x: rand() * 300, y: rand() * 300 };
    const cp = { x: rand() * 300, y: rand() * 300 };
    let d = { x: rand() * 100, y: rand() * 100 };
    let e = { x: rand() * 100, y: rand() * 100 };
    if (i % 3 === 0) e = { x: 2 * d.x - d.y, y: d.x + 2 * d.y }; // rotated/scaled copy
    const z = [], w = [];
    for (let k = 0; k < 4; k++) {
      z.push({ x: c.x + d.x, y: c.y + d.y });
      w.push({ x: cp.x + e.x, y: cp.y + e.y });
      d = turn(d);
      e = turn(e);
    }
    const P = { x: rand() * 500, y: rand() * 500 };
    const third = appletTranslate(P, z, w);
    if (!C.isSquare(third, 1e-7)) genericBad++;
  }
  check("the claim holds for 2,000 arbitrary directly similar squares",
    genericBad === 0, `${genericBad} failed`);

  /* The correspondence must be direct: pairing one square in reverse order
   * can give a rectangle, not a square. This is why DirectlySimilar2's page
   * talks about directly similar figures. */
  const z = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
  const wReversed = [{ x: 2, y: 0 }, { x: 0, y: -2 }, { x: -2, y: 0 }, { x: 0, y: 2 }];
  const counter = appletTranslate({ x: 0, y: 0 }, z, wReversed);
  equal("a reversed correspondence gives four rectangle corners", counter,
    [{ x: -1, y: 0 }, { x: 0, y: 3 }, { x: 1, y: 0 }, { x: 0, y: -3 }]);
  check("that reversed figure is not a square", C.isSquare(counter) === false);
  check("the rectangle's corners are not right angles", C.squareInfo(counter).angleError > 10,
    `angle error ${C.squareInfo(counter).angleError}`);

  /* Degenerate limits: one collapsed square still mirrors the other; two
   * collapsed squares give four coincident points. Neither contradicts the
   * page, which assumes two genuine squares. */
  const state = C.start({});
  const one = C.start({});
  one.points = [{ x: 10, y: 10 }, { x: 10, y: 10 }, state.points[2], state.points[3], { x: 0, y: 0 }];
  check("one collapsed corner set still yields a square", C.isSquare(C.translated(one), 1e-7));
  const both = C.start({});
  both.points = [
    { x: 10, y: 10 }, { x: 10, y: 10 },
    { x: 20, y: 30 }, { x: 20, y: 30 },
    { x: 5, y: 5 },
  ];
  const collapsed = C.translated(both);
  check("two collapsed squares give one point, not a genuine square",
    !C.isSquare(collapsed) && collapsed.every((p) => samePoint(p, { x: -5, y: -15 })));
  check("the side length of a collapsed square is zero", C.squareInfo(collapsed).side === 0);
}

done("directly-similar-1");
