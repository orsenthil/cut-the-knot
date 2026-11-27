#!/usr/bin/env node
"use strict";

/*
 * Logic test for coaxal-circles/coaxal-circles-core.js.
 *
 *   node porting/check-coaxal-circles.mjs
 *
 * (1) A second, literal transcription of the applet's Compute, DrawFamilyOne
 * and DrawSecondFamily bytecode, compared over a grid of A, B and N (including
 * both ends of the 1..100 spinner).  (2) The cut-the-knot article's claims,
 * checked over the same grid and over further random configurations: no two
 * Apollonian circles cross, their centres lie outside AB, their common radical
 * axis is the perpendicular bisector, and every circle of one pencil is
 * orthogonal to every circle of the other.  (3) The panel's ranges, the
 * horizontal-only dragging, and the tangent-circle half of the theorem.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("coaxal-circles/coaxal-circles-core.js", "CoaxalCirclesCore");
const EPS = 1e-7;
const near = (a, b, tol = EPS) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const nearPoint = (p, q, tol = EPS) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);

/* ----------------------------------------------------------- 1. the applet */

/* Bytecode of Compute() and the two DrawFamily... methods, transcribed again
 * without using any core helper.  DoubCircle(x, y, radius) is a circle with
 * centre (x, y); the loops and the literal 10-pixel step are kept as they are. */
function applet(A, B, n) {
  const Xc = Math.round((A.x + B.x) / 2);
  const s = Math.abs(B.x - A.x) / 2;
  const y = A.y;
  const one = [];
  for (let k = 0; k < n; k++) {
    const t = s + (k + 1) * 10;
    const r = Math.sqrt(t * t - s * s);
    one.push({ c: { x: Xc + t, y: y }, r: r });
    one.push({ c: { x: Xc - t, y: y }, r: r });
  }
  const two = [];
  for (let k = 1; k < n; k++) {
    const t = k * 10;
    const r = Math.sqrt(t * t + s * s);
    two.push({ c: { x: Xc, y: y + t }, r: r });
    two.push({ c: { x: Xc, y: y - t }, r: r });
  }
  two.push({ c: { x: Xc, y: y }, r: s }); // the circle with diameter AB
  return { Xc: Xc, s: s, one: one, two: two };
}

function compareLists(actual, ref) {
  if (actual.length !== ref.length) return false;
  for (let i = 0; i < ref.length; i++) {
    if (!nearPoint(actual[i].c, ref[i].c, 1e-12) || !near(actual[i].r, ref[i].r, 1e-12)) return false;
  }
  return true;
}

{
  const ax = [40, 100, 205, 250, 300, 420, 560];
  const bx = [60, 150, 290, 350, 470, 580];
  const ns = [1, 2, 3, 5, 17, 100];
  let cases = 0, oneOk = 0, twoOk = 0, worst = 0;
  for (const a of ax) {
    for (const b of bx) {
      for (const n of ns) {
        const state = Object.assign(C.start({ n: n }), {
          A: C.point(a, 220), B: C.point(b, 220),
        });
        const g = C.geometry(state);
        const ref = applet(state.A, state.B, n);
        cases++;
        if (g.Xc === ref.Xc && near(g.s, ref.s, 1e-12)) oneOk++;
        if (compareLists(C.familyOne(state), ref.one)) oneOk++;
        if (compareLists(C.familyTwo(state), ref.two)) twoOk++;
        for (const circle of C.familyOne(state)) {
          const t = Math.abs(circle.c.x - g.Xc);
          worst = Math.max(worst, Math.abs(circle.r * circle.r - (t * t - ref.s * ref.s)));
        }
      }
    }
  }
  check("the grid covers the whole option range", cases === 7 * 6 * 6, `${cases} configurations`);
  check("Compute() and DrawFamilyOne match the bytecode everywhere", oneOk === 2 * cases,
    `${oneOk}/${2 * cases} exact comparisons`);
  check("DrawSecondFamily matches the bytecode everywhere", twoOk === cases,
    `${twoOk}/${cases} exact comparisons`);
  check("no radius drift between the two transcriptions", worst < 1e-7, `worst ${worst}`);

  const s = C.start({});
  check("the start position is the applet's A, B and N",
    nearPoint(s.A, C.point(250, 220)) && nearPoint(s.B, C.point(350, 220)) && s.options.n === 5);
  check("the applet opens with Family 1 on, Family 2 off and names off",
    s.options.familyOne === true && s.options.familyTwo === false && s.options.names === false);
  check("the applet's midpoint and half-distance are exact",
    C.geometry(s).Xc === 300 && C.geometry(s).s === 50);
  check("N is clamped to the panel's 1..100 range",
    C.clampN(0) === 1 && C.clampN(101) === 100 && C.clampN(3.7) === 3 && C.clampN(NaN) === 5);
}

/* ------------------------------------------------------- 2. the page's claims */

function claimState(A, B, n) {
  return Object.assign(C.start({ n: n }), { A: C.point(A, 220), B: C.point(B, 220) });
}

/* "No two of the circles intersect" (about the Apollonian pencil): circles
 * are either disjoint or nested; a crossing with d between |r1-r2| and
 * r1+r2 would mean the claim is false. */
{
  let pairs = 0, crossings = 0;
  for (const a of [20, 100, 205, 250, 300, 420, 560]) {
    for (const b of [60, 150, 290, 350, 470, 580]) {
      if (Math.abs(a - b) < 10) continue;
      const state = claimState(a, b, 12);
      const circles = C.familyOne(state);
      for (let i = 0; i < circles.length; i++) {
        for (let j = i + 1; j < circles.length; j++) {
          const d = dist(circles[i].c, circles[j].c);
          const r1 = circles[i].r, r2 = circles[j].r;
          pairs++;
          if (d > Math.abs(r1 - r2) + 1e-9 && d < r1 + r2 - 1e-9) crossings++;
        }
      }
    }
  }
  check("many pairs of Apollonian circles were compared", pairs > 3000, `${pairs} pairs`);
  check("no two Apollonian circles intersect", crossings === 0, `${crossings} crossings`);
}

/* Centres on a line, none between A and B, and the straight-line member. */
{
  let checked = 0, badCentres = 0, inside = 0, realRadius = 0;
  const rand = rng(20261126);
  for (let i = 0; i < 120; i++) {
    const a = 20 + Math.floor(rand() * 540);
    const b = 20 + Math.floor(rand() * 540);
    if (a === b) continue;
    const state = claimState(a, b, 1 + (i % 40));
    const g = C.geometry(state);
    for (const c of C.familyOne(state)) {
      checked++;
      if (!near(c.c.y, g.y, 1e-12) || !Number.isFinite(c.r) || !(c.r > 0)) badCentres++;
      if (Math.abs(c.c.x - g.Xc) <= g.s + 1e-12) inside++;
      const t = Math.abs(c.c.x - g.Xc);
      if (!near(c.r * c.r + g.s * g.s, t * t, 1e-12)) realRadius++;
    }
    for (const c of C.familyTwo(state)) {
      if (!near(c.c.x, g.Xc, 1e-12)) badCentres++;
    }
  }
  check("many configurations were sampled", checked > 2000, `${checked} circles`);
  check("family-one centres are collinear with A and B, family-two centres with the bisector",
    badCentres === 0, `${badCentres} off-axis centres`);
  check("no Apollonian centre lies between A and B", inside === 0, `${inside} inside`);
  check("every family-one radius is a finite positive number", realRadius === 0);
}

/* Radical axis: the power of any point on x = Xc is the same for every
 * Apollonian circle; on y = A.y it is the same for every circle through A, B. */
{
  let worstOne = 0, worstTwo = 0, samples = 0;
  for (const [a, b] of [[250, 350], [100, 500], [200, 240], [40, 580]]) {
    const state = claimState(a, b, 6);
    const one = C.familyOne(state), two = C.familyTwo(state);
    const g = C.geometry(state);
    for (let k = -3; k <= 3; k++) {
      const onAxis = C.point(g.Xc, g.y + k * 17);
      let p0 = C.power(one[0], onAxis);
      for (const c of one) worstOne = Math.max(worstOne, Math.abs(C.power(c, onAxis) - p0));
      const onAB = C.point(g.Xc + k * 17, g.y);
      p0 = C.power(two[0], onAB);
      for (const c of two) worstTwo = Math.max(worstTwo, Math.abs(C.power(c, onAB) - p0));
      samples++;
    }
  }
  check("the radical axis was sampled", samples === 28, `${samples} points`);
  check("every Apollonian circle has the perpendicular bisector as radical axis",
    worstOne < 1e-6, `worst ${worstOne}`);
  check("every circle through A and B has AB as radical axis", worstTwo < 1e-6, `worst ${worstTwo}`);
}

/* The Coaxal Circles Theorem itself: each circle of one pencil is orthogonal
 * to every circle of the other, including the circle on AB as diameter. */
{
  let pairs = 0, worst = 0;
  for (const [a, b] of [[250, 350], [100, 500], [200, 240], [40, 580], [310, 320], [80, 470]]) {
    const state = claimState(a, b, 9);
    const one = C.familyOne(state), two = C.familyTwo(state);
    for (const p of one) {
      for (const q of two) {
        const d2 = (p.c.x - q.c.x) ** 2 + (p.c.y - q.c.y) ** 2;
        worst = Math.max(worst, Math.abs(d2 - (p.r * p.r + q.r * q.r)));
        pairs++;
      }
    }
  }
  check("all pencil pairs were compared", pairs === 6 * 18 * 17, `${pairs} pairs`);
  check("every Apollonian circle is orthogonal to every circle through A and B",
    worst < 1e-6, `worst d² − (r² + R²) = ${worst}`);

  /* Circles through A and B really do pass through both points. */
  let worstThrough = 0;
  for (const [a, b] of [[250, 350], [100, 500], [200, 240]]) {
    const state = claimState(a, b, 8);
    for (const c of C.familyTwo(state)) {
      worstThrough = Math.max(worstThrough,
        Math.abs(dist(c.c, state.A) - c.r), Math.abs(dist(c.c, state.B) - c.r));
    }
  }
  check("every second-family circle passes through both A and B", worstThrough < 1e-6,
    `worst ${worstThrough}`);
}

/* The second half of the theorem: the two tangent pencils at a point. */
{
  let worst = 0;
  for (let t = 1; t <= 25; t++) {
    for (let u = 1; u <= 25; u++) {
      const [c1, c2] = C.tangentPair(C.point(240, 220), t * 10, u * 10);
      const d2 = (c1.c.x - c2.c.x) ** 2 + (c1.c.y - c2.c.y) ** 2;
      worst = Math.max(worst, Math.abs(d2 - (c1.r * c1.r + c2.r * c2.r)));
    }
  }
  check("the tangent pencils are orthogonal at their common point", worst < 1e-9, `worst ${worst}`);
}

/* ------------------------------------------- 3. panel options and dragging */

{
  const s0 = C.start({});
  const moved = C.move(s0, "A", C.point(430, 60));
  check("dragging A changes only its x and stays on the line of centres",
    moved.A.x === 430 && moved.A.y === 220 && moved.B.x === 350);
  check("dragging B changes only B", C.move(s0, "B", C.point(90, 10)).B.x === 90);
  check("an unknown handle is refused", C.move(s0, "X", C.point(1, 1)) === s0);
  check("the handles stay inside the board",
    C.clampPoint(C.point(-100, 999)).x === C.PAD
    && C.clampPoint(C.point(9999, -500)).x === C.VIEW.width - C.PAD
    && C.clampPoint(C.point(100, -500)).y === C.VIEW.height / 2);
  check("the two family checkboxes and the names checkbox are independent",
    C.setOption(C.setOption(s0, "familyTwo", true), "familyOne", false).options.familyOne === false
    && C.setOption(s0, "familyTwo", true).options.familyOne === true
    && C.setOption(s0, "names", false).options.names === false);
  check("an unknown option is refused", C.setOption(s0, "noSuchOption", 9) === s0);
  check("N = 1 draws two Apollonian circles and the circle on AB",
    C.familyOne(C.start({ n: 1 })).length === 2 && C.familyTwo(C.start({ n: 1 })).length === 1);
  check("N = 100 draws all 200 + 199 circles",
    C.familyOne(C.start({ n: 100 })).length === 200
    && C.familyTwo(C.start({ n: 100 })).length === 199);
  const changed = C.setOption(moved, "n", 40);
  check("Reset restores the starting points but keeps the choices",
    nearPoint(C.reset(changed).A, s0.A) && nearPoint(C.reset(changed).B, s0.B)
    && C.reset(changed).options.n === 40);
  check("A = B is not a crash: the radii stay finite",
    C.familyOne(claimState(250, 250, 4)).every((c) => Number.isFinite(c.r) && c.r > 0)
    && C.familyTwo(claimState(250, 250, 4)).every((c) => Number.isFinite(c.r) && c.r >= 0));
  check("an illustration has no win or loss", C.result(changed) === null);
  check("the position is plain, saveable data",
    JSON.stringify(changed).includes("familyOne") && JSON.stringify(changed).includes("A"));
  check("the status line describes both families in words",
    C.describe(C.setOption(s0, "familyTwo", true)).includes("9 circles through A and B"));
}

done("coaxal-circles");
