#!/usr/bin/env node
"use strict";

/*
 * Logic test for angles-in-triangle/angles-in-triangle-core.js.
 *
 *   node porting/check-angles-in-triangle.mjs
 *
 * Two independent claims are checked. (1) The applet's own page says the three
 * corners of ANY triangle fold onto the foot of the altitude from the largest
 * angle and fill a straight angle there: 2,000 random triangles are compared
 * field by field with a second, literal transcription of FindLargestAngle,
 * FindFolding, Compute, NearestPoint and ComputeAngle from the bytecode.
 * (2) The article the manifest points at ("Angles in a Triangle: an Exercise")
 * claims angle ADC = 60 degrees for AB = AC, angle BAC = 120, BC = sqrt(5),
 * BD = 1 and CD = sqrt(2): the exact coordinates of its Solution 2 and 300
 * randomly rotated, scaled, translated and reflected copies are checked, plus
 * the intermediate steps of its Law of Cosines solution.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("angles-in-triangle/angles-in-triangle-core.js", "AnglesInTriangleCore");
const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;
const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const pt = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  const R = Math.min(C.WIDTH, C.HEIGHT) / 3;
  const cx = C.WIDTH / 3, cy = C.HEIGHT / 2;
  equal("A starts where init puts it", s.A,
    pt(cx + R - C.WIDTH / 8, cy + C.HEIGHT / 6));
  equal("B starts at 120 degrees from the centre", s.B,
    pt(cx + R * Math.cos(C.TWO_THIRDS_PI), cy - R * Math.sin(C.TWO_THIRDS_PI)));
  equal("C starts at 240 degrees from the centre", s.C,
    pt(cx + R * Math.cos(2 * C.TWO_THIRDS_PI), cy - R * Math.sin(2 * C.TWO_THIRDS_PI)));
  equal("the copy's centre P starts at two thirds across", s.P, pt(2 * cx, cy));
  check("the opening picture is a folding picture", s.preset === "folding" && s.exercisePoint === null);
  check("names start hidden, as in the applet's checkbox", s.showNames === false);
  check("an illustration has no result to report", C.result(s) === null);
  check("A is the largest-angle vertex on opening", C.compute(s).largest === "A");
  check("the opening angles sum to two right angles", near(deg(C.compute(s).sum), 180, 1e-9));
  check("showing names is a separate, reversible option",
    C.setShowNames(s, true).showNames && !C.setShowNames(C.setShowNames(s, true), false).showNames);
  check("a drag leaves the old position alone", C.movePoint(s, "A", pt(10, 20)) !== s && s.A.x !== 10);
  equal("a drag stays inside the board", C.movePoint(s, "A", pt(-99, 999)).A, pt(12, C.HEIGHT - 12));
  check("the exercise point cannot be dragged when it is hidden", C.movePoint(s, "D", pt(1, 1)) === s);
  check("an unknown point is refused", C.movePoint(s, "Q", pt(1, 1)) === s);
  check("a non-numeric pointer is refused", C.movePoint(s, "A", pt(NaN, 1)) === s);
  check("the status describes the folding, with 180 degrees", /180\u00b0/.test(C.describe(s)));
}

/* --------------------------- 2. a literal second transcription of the code */

/* GeoSDoub.ComputeAngle: note the applet does NOT clamp the cosine. */
function appletAngle(v, p, q) {
  const sq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const d = (a, b) => Math.sqrt(sq(a, b));
  const cos = (sq(v, p) + sq(v, q) - sq(p, q)) / 2 / d(v, p) / d(v, q);
  return Math.acos(cos);
}

/* GeoSDoub.NearestPoint(p, a, b), including the applet's |p-a| < sqrt(0.1)
   guard (it compares p with a, not the length of the segment). */
function appletNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return pt(p.x, p.y);
  const dot = (p.x - a.x) * dx + (p.y - a.y) * dy;
  const t = dot / (dx * dx + dy * dy);
  return pt(a.x + dx * t, a.y + dy * t);
}

const mid = (a, b) => pt((a.x + b.x) / 2, (a.y + b.y) / 2);

function appletLargest(s) {
  const a = appletAngle(s.A, s.B, s.C);
  const b = appletAngle(s.B, s.C, s.A);
  const c = appletAngle(s.C, s.A, s.B);
  if (!(a < b) && !(a < c)) return { name: "A", point: s.A };
  if (!(b < a) && !(b < c)) return { name: "B", point: s.B };
  if (!(c < a) && !(c < b)) return { name: "C", point: s.C };
  return null;
}

function appletFolding(K, L, M) {
  const E = mid(K, L), F = mid(M, K);
  const D = appletNearest(K, L, M);
  return { K, L, M, E, F, D, G: mid(D, L), H: mid(D, M) };
}

/* AnglesInTriangleCanvas.Compute, with the field names kept from the bytecode. */
function appletCompute(s) {
  const S1 = (s.A.x + s.B.x + s.C.x) / 3;
  const S3 = (s.A.y + s.B.y + s.C.y) / 3;
  const shift = (p) => pt(s.P.x + p.x - S1, s.P.y + p.y - S3);
  const v = appletLargest(s);
  const [K, L, M] = v.name === "A" ? [s.A, s.B, s.C]
    : v.name === "B" ? [s.B, s.C, s.A] : [s.C, s.A, s.B];
  const f = appletFolding(K, L, M);
  return {
    Ap: shift(s.A), Bp: shift(s.B), Cp: shift(s.C),
    Dp: shift(f.D), Ep: shift(f.E), Fp: shift(f.F),
    Gp: shift(f.G), Hp: shift(f.H),
    fold: f, largest: v.name,
  };
}

const rand = rng(20261126);
function randomTriangle() {
  for (;;) {
    const A = pt(20 + rand() * 320, 20 + rand() * 200);
    const B = pt(20 + rand() * 320, 20 + rand() * 200);
    const Cc = pt(20 + rand() * 320, 20 + rand() * 200);
    const cross = (B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x);
    if (Math.min(dist(A, B), dist(B, Cc), dist(Cc, A)) > 25 && Math.abs(cross) > 2500) {
      return { A, B, C: Cc, P: pt(20 + rand() * 320, 20 + rand() * 200),
        exercisePoint: null, scale: C.EX_SCALE, preset: "folding", showNames: false };
    }
  }
}

{
  let badAngle = 0, badFold = 0, badCopy = 0, badVertex = 0, badCentroid = 0;
  let badSum = 0, badFoot = 0, badFolded = 0, badBisector = 0;
  for (let i = 0; i < 2000; i++) {
    const s = randomTriangle();
    const g = C.compute(s);
    const a = appletCompute(s);
    for (const name of ["A", "B", "C"]) {
      if (!near(g.angles[name], appletAngle(s[name],
        name === "A" ? s.B : name === "B" ? s.C : s.A,
        name === "A" ? s.C : name === "B" ? s.A : s.B), 1e-9)) badAngle++;
    }
    if (g.largest !== a.largest) badVertex++;
    for (const key of Object.keys(a.fold)) {
      if (!near(g.fold[key].x, a.fold[key].x, 1e-9) ||
          !near(g.fold[key].y, a.fold[key].y, 1e-9)) badFold++;
    }
    for (const [key, other] of [["A", "Ap"], ["B", "Bp"], ["C", "Cp"]]) {
      if (!near(g.copy[key].x, a[other].x, 1e-9) ||
          !near(g.copy[key].y, a[other].y, 1e-9)) badCopy++;
    }
    for (const [key, other] of [["D", "Dp"], ["E", "Ep"], ["F", "Fp"], ["G", "Gp"], ["H", "Hp"]]) {
      if (!near(g.folded[key].x, a[other].x, 1e-9) ||
          !near(g.folded[key].y, a[other].y, 1e-9)) badCopy++;
    }
    if (!near(g.copy.A.x + g.copy.B.x + g.copy.C.x, 3 * s.P.x, 1e-8) ||
        !near(g.copy.A.y + g.copy.B.y + g.copy.C.y, 3 * s.P.y, 1e-8)) badCentroid++;
    if (!near(g.sum, Math.PI, 1e-9)) badSum++;

    /* The page's claim: D is on the base LM, between L and M. */
    const f = g.fold, u = { x: f.M.x - f.L.x, y: f.M.y - f.L.y };
    const t = ((f.D.x - f.L.x) * u.x + (f.D.y - f.L.y) * u.y) / (u.x * u.x + u.y * u.y);
    if (t < -1e-9 || t > 1 + 1e-9) badFoot++;
    /* The folded angles really are the three corners of the triangle:
       EF folds K onto D, EG folds L onto D, FH folds M onto D. */
    const originals = {
      K: appletAngle(f.K, f.L, f.M),
      L: appletAngle(f.L, f.K, f.M),
      M: appletAngle(f.M, f.K, f.L),
    };
    for (const name of ["K", "L", "M"]) {
      if (!near(g.foldedAngles[name], originals[name], 1e-8)) badFolded++;
    }
    /* EF and EG are perpendicular bisectors: E is equidistant from K, L, D,
       and F from M, K, D. */
    if (!near(dist(f.E, f.K), dist(f.E, f.L), 1e-8) ||
        !near(dist(f.E, f.L), dist(f.E, f.D), 1e-8) ||
        !near(dist(f.F, f.M), dist(f.F, f.K), 1e-8) ||
        !near(dist(f.F, f.K), dist(f.F, f.D), 1e-8)) badBisector++;
  }
  check("2,000 triangle angles match the bytecode transcription", badAngle === 0, `${badAngle} wrong`);
  check("2,000 largest-angle choices match FindLargestAngle", badVertex === 0, `${badVertex} wrong`);
  check("2,000 folding points match FindFolding", badFold === 0, `${badFold} wrong`);
  check("2,000 translated points match Compute", badCopy === 0, `${badCopy} wrong`);
  check("the translated copy always has its centroid at P", badCentroid === 0, `${badCentroid} wrong`);
  check("the page's claim: folded angles always add to 180 degrees", badSum === 0, `${badSum} wrong`);
  check("the page's claim: the altitude foot lies on the opposite side", badFoot === 0, `${badFoot} wrong`);
  check("each folded angle equals its original corner", badFolded === 0, `${badFolded} wrong`);
  check("the fold lines are perpendicular bisectors", badBisector === 0, `${badBisector} wrong`);
}

/* Ties and the applet's small guard. */
{
  const half = 52, height = 52 * Math.sqrt(3);
  const eq = { A: pt(100, 40), B: pt(100 - half, 40 + height), C: pt(100 + half, 40 + height),
    P: pt(200, 100), exercisePoint: null, scale: 110, preset: "folding", showNames: false };
  check("an equilateral tie goes to A", C.compute(eq).largest === "A");
  check("a tie between B and C, with A smaller, goes to B",
    C.largestVertex({ A: pt(100, 40), B: pt(40, 160), C: pt(160, 160) }).name === "B");
  check("the applet's near-point guard returns the point itself",
    C.nearestPoint(pt(1, 1), pt(1.05, 1.05), pt(90, 4)).x === 1);
  const degenerate = C.compute({ ...eq, A: pt(100, 100), B: pt(100, 100) });
  check("a collapsed triangle still returns a finite status", Number.isFinite(deg(degenerate.sum || 0)));
}

/* --------------------------- 3. the exercise's exact claim, and its proof */

const g = C.exerciseGeometry();
const len = (p, q) => dist(p, q);
const degAngle = (v, p, q) => deg(C.angle(v, p, q));

{
  check("AB = AC", near(len(g.A, g.B), len(g.A, g.C), 1e-12));
  check("BC = sqrt(5)", near(len(g.B, g.C), C.ROOT5, 1e-12));
  check("BD = 1", near(len(g.B, g.D), 1, 1e-12));
  check("CD = sqrt(2)", near(len(g.C, g.D), C.ROOT2, 1e-12));
  check("angle BAC = 120 degrees", near(degAngle(g.A, g.B, g.C), 120, 1e-9));
  check("the exercise's claim: angle ADC = 60 degrees", near(degAngle(g.D, g.A, g.C), 60, 1e-9));
  check("the intermediate angle BDC = 135 degrees", near(degAngle(g.D, g.B, g.C), 135, 1e-9));
  const cosBDC = (1 + 2 - 5) / (2 * C.ROOT2);
  check("cos BDC = -sqrt(2)/2 from the Law of Cosines", near(cosBDC, -C.ROOT2 / 2, 1e-12));
  check("5 = 1 - 2 sqrt(2) cos(BDC) + 2",
    near(1 - 2 * C.ROOT2 * cosBDC + 2, 5, 1e-12));
  check("sin(15 degrees) = (sqrt(6) - sqrt(2))/4",
    near(Math.sin(rad(15)), (Math.sqrt(6) - C.ROOT2) / 4, 1e-12));
  check("cos(15 degrees) = (sqrt(6) + sqrt(2))/4",
    near(Math.cos(rad(15)), (Math.sqrt(6) + C.ROOT2) / 4, 1e-12));
  const dd2 = 1 - 2 * C.ROOT2 * (Math.sqrt(6) + C.ROOT2) / 4 + 2;
  check("DD squared = 2 - sqrt(3)", near(dd2, 2 - C.ROOT3, 1e-12));
  /* The article drops the square on sin(15) in this line; with it, the
     printed ratio really is 4 and the angle CDD' is 30 degrees. */
  const sin15 = (Math.sqrt(6) - C.ROOT2) / 4;
  check("(2 - sqrt(3)) / sin squared 15 is 4", near((2 - C.ROOT3) / sin15 ** 2, 4, 1e-12));
  check("the Law of Sines gives sin(CDD') = 1/2, so CDD' = 30 degrees",
    near(sin15 / Math.sqrt(dd2), 0.5, 1e-12) && near(deg(Math.asin(0.5)), 30, 1e-12));

  /* D is inside the triangle: all three cross products have the same sign. */
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const signs = [cross(g.A, g.B, g.D), cross(g.B, g.C, g.D), cross(g.C, g.A, g.D)];
  check("D lies inside triangle ABC", signs.every((v) => v > 0) || signs.every((v) => v < 0));
}

/* Rotate, scale, translate and reflect the whole exercise: the angle stays 60. */
{
  const rand2 = rng(77123);
  let badAngle = 0, badLength = 0, badApex = 0, badInside = 0;
  for (let i = 0; i < 300; i++) {
    const theta = rand2() * 2 * Math.PI;
    const scale = 0.1 + rand2() * 80;
    const ox = rand2() * 1000 - 500, oy = rand2() * 1000 - 500;
    const flip = rand2() < 0.5 ? 1 : -1;
    const T = (p) => pt(ox + scale * (p.x * Math.cos(theta) - flip * p.y * Math.sin(theta)),
      oy + scale * (p.x * Math.sin(theta) + flip * p.y * Math.cos(theta)));
    const A = T(g.A), B = T(g.B), Cc = T(g.C), D = T(g.D);
    if (!near(deg(C.angle(D, A, Cc)), 60, 1e-8)) badAngle++;
    if (!near(len(B, D) / scale, 1, 1e-9) || !near(len(Cc, D) / scale, C.ROOT2, 1e-9) ||
        !near(len(B, Cc) / scale, C.ROOT5, 1e-9)) badLength++;
    if (!near(deg(C.angle(A, B, Cc)), 120, 1e-8)) badApex++;
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const signs = [cross(A, B, D), cross(B, Cc, D), cross(Cc, A, D)];
    if (!(signs.every((v) => v > 0) || signs.every((v) => v < 0))) badInside++;
  }
  check("300 transformed exercises all have angle ADC = 60 degrees", badAngle === 0, `${badAngle} wrong`);
  check("their BD, CD and BC keep the stated lengths", badLength === 0, `${badLength} wrong`);
  check("their apex angle stays 120 degrees", badApex === 0, `${badApex} wrong`);
  check("their point D stays inside the triangle", badInside === 0, `${badInside} wrong`);
}

/* The preset shown on the page uses the same geometry, scaled to the board. */
{
  const s = C.exercisePreset();
  const e = C.compute(s).exercise;
  check("the preset reproduces BD = 1", near(e.lengths.BD, 1, 1e-9));
  check("the preset reproduces CD = sqrt(2)", near(e.lengths.CD, C.ROOT2, 1e-9));
  check("the preset reproduces BC = sqrt(5)", near(e.lengths.BC, C.ROOT5, 1e-9));
  check("the preset reproduces angle ADC = 60 degrees", near(deg(e.ADC), 60, 1e-8));
  check("the preset reproduces cos(BDC)", near(e.cosBDC, -C.ROOT2 / 2, 1e-9));
  check("the exercise's angles still fold to 180 degrees", near(deg(C.compute(s).sum), 180, 1e-8));
  const status = C.describe(s);
  check("the status names the exercise", /Exercise:/.test(status));
  check("the status prints 1, sqrt(2) and 60 degrees",
    /BD = 1/.test(status) && /CD = \u221a2/.test(status) && /60\u00b0/.test(status));
  const moved = C.movePoint(s, "D", pt(150, 100));
  check("dragging the exercise point changes the measured angle",
    !near(deg(C.compute(moved).exercise.ADC), 60, 1e-6));
}

done("angles-in-triangle");
