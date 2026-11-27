#!/usr/bin/env node
"use strict";

/*
 * Logic test for cosine-law/cosine-law-core.js.
 *
 *   node porting/check-cosine-law.mjs
 *
 * The page's exact claim is that CP is equal and perpendicular to AB, so the
 * median CP of parallelogram CTPR is the altitude of triangle ABC; with the
 * two outward squares and three parallelograms the heptagon ABQNPMS can then
 * be cut in two ways, giving c² = a² + b² - 2ab cos(C) for acute and obtuse C.
 * Every point of figure() is compared with a second, literal transcription of
 * FormSquares(), Compute(), ShiftPoints() and the SwitchParas test, over a
 * grid of triangles plus 900 seeded random ones. The claims are checked over
 * the same set: perpendicularity, equal lengths, the parallelograms, both
 * cuttings' area, the law itself and the acute/obtuse branch of Euclid II.12
 * and II.13.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cosine-law/cosine-law-core.js", "CosineLawCore");
const HALF = Math.PI / 2;
const pt = (x, y) => ({ x, y });
const add = (p, q) => pt(p.x + q.x, p.y + q.y);
const sub = (p, q) => pt(p.x - q.x, p.y - q.y);
const cross = (p, q) => p.x * q.y - p.y * q.x;
const dot = (p, q) => p.x * q.x + p.y * q.y;
const len = (p) => Math.hypot(p.x, p.y);
const dist = (p, q) => len(sub(p, q));
const near = (p, q, tol = 1e-7) =>
  p && q && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const nearNum = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const polyArea = (ps) =>
  Math.abs(ps.reduce((s, p, i) => s + cross(p, ps[(i + 1) % ps.length]), 0)) / 2;

/* ---- a second transcription, written straight from the Java bytecode ---- */

function javaOrientation(p, q, r) {
  // GeoSDoub.FindOrientation: r.x*(p.y-q.y) + r.y*(q.x-p.x) + p.x*q.y - q.x*p.y
  const d = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return d > 0 ? 1 : -1;
}

function javaRotate(pivot, point, angle, sense) {
  // GeoSDoub.Rotate: the orientation multiplier lives on the sine term.
  const dx = point.x - pivot.x, dy = point.y - pivot.y;
  const c = Math.cos(angle), s = Math.sin(angle);
  return pt(pivot.x + c * dx - sense * s * dy,
    pivot.y + sense * s * dx + c * dy);
}

function javaFigure(A, B, C0, width) {
  // FormSquares(), then Compute() and ShiftPoints() from CosineLawCanvas.
  const sense = javaOrientation(C0, A, B);
  const S = javaRotate(A, C0, HALF, sense);
  const T = javaRotate(S, A, HALF, sense);
  const Q = javaRotate(B, C0, -HALF, sense);
  const R = javaRotate(Q, B, -HALF, sense);
  const P = pt(T.x + R.x - C0.x, T.y + R.y - C0.y);
  const M = pt(A.x + P.x - C0.x, A.y + P.y - C0.y);
  const N = pt(B.x + P.x - C0.x, B.y + P.y - C0.y);
  const mid = pt((A.x + B.x + C0.x) / 3, (A.y + B.y + C0.y) / 3);
  const V = pt(2 * (Math.floor(width / 2) - mid.x), 0);
  const jump = (p) => pt(p.x + V.x, p.y + V.y);
  // ComputeAngle(C,A,B) < PI/2, written with the bytecode's own distance sum.
  const u = sub(A, C0), v = sub(B, C0);
  const angle = Math.acos((len(u) ** 2 + len(v) ** 2 - len(sub(A, B)) ** 2) /
    (2 * len(u) * len(v)));
  return {
    sense, S, T, Q, R, P, M, N, V,
    Ap: jump(A), Bp: jump(B), Cp: jump(C0), Sp: jump(S), Tp: jump(T),
    Qp: jump(Q), Rp: jump(R), Pp: jump(P), Mp: jump(M), Np: jump(N),
    switchParas: angle < HALF,
  };
}

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start();
  check("start puts C at width/3.5 and 2*height/3",
    near(s.C, pt(500 / 3.5, 300)));
  check("start puts A 50 left and 40 below C", near(s.A, pt(s.C.x - 50, s.C.y + 40)));
  check("start puts B 60 right and 20 below C", near(s.B, pt(s.C.x + 60, s.C.y + 20)));
  check("the two panel checkboxes start unchecked",
    s.showColors === false && s.showNames === false);
  const ui = C.start({ width: 600, height: 440 });
  check("the port's board keeps the same start offsets",
    near(ui.C, pt(600 / 3.5, 2 * 440 / 3)) &&
    near(ui.A, pt(ui.C.x - 50, ui.C.y + 40)) &&
    near(ui.B, pt(ui.C.x + 60, ui.C.y + 20)));
  const moved = C.withPoint(ui, "C", pt(10, 20));
  check("withPoint moves only the named corner and keeps the board",
    near(moved.C, pt(10, 20)) && near(moved.A, ui.A) &&
    near(moved.B, ui.B) && moved.width === 600 && moved.height === 440 && ui.C.x !== 10);
  check("withPoint refuses an unknown corner", C.withPoint(ui, "P", pt(1, 2)) === ui);
  check("withOption flips a checkbox and leaves the points alone",
    C.withOption(ui, "showColors", true).showColors === true &&
    C.withOption(ui, "showNames", true).showNames === true &&
    near(C.withOption(ui, "showColors", true).C, ui.C));
}

/* --------------------------------- 2. every derived point, against bytecode */

const cases = [];
const us = [pt(-50, 40), pt(-70, 40), pt(-30, 80), pt(40, 60),
  pt(-40, -60), pt(10, 10), pt(0, 50), pt(-90, -20), pt(-20, 120)];
const vs = [pt(60, 20), pt(60, 110), pt(90, -30), pt(-40, 70),
  pt(10, 80), pt(-70, -50), pt(30, -60), pt(120, 10), pt(-20, -90)];
const origins = [pt(0, 0), pt(142.85714285714286, 300), pt(171.42857142857144, 293.3333333333333)];
for (const O of origins) {
  for (const u of us) {
    for (const v of vs) {
      if (len(u) > 1 && len(v) > 1 && len(sub(u, v)) > 1) {
        cases.push({ A: add(O, u), B: add(O, v), C: O });
      }
    }
  }
}
const rand = rng(20261127);
for (let i = 0; i < 900; i++) {
  const O = pt(rand() * 400 - 200, rand() * 400 - 200);
  const u = pt(rand() * 200 - 100, rand() * 200 - 100);
  const v = pt(rand() * 200 - 100, rand() * 200 - 100);
  if (Math.min(len(u), len(v), len(sub(u, v))) > 1) {
    cases.push({ A: add(O, u), B: add(O, v), C: O });
  }
}

{
  let badPoints = 0, badSense = 0, badSwitch = 0, badShift = 0;
  const keys = ["S", "T", "Q", "R", "P", "M", "N",
    "Ap", "Bp", "Cp", "Sp", "Tp", "Qp", "Rp", "Pp", "Mp", "Np"];
  for (const pos of cases) {
    const state = { ...pos, width: 600, height: 440, showColors: false, showNames: false };
    const got = C.figure(state);
    const want = javaFigure(pos.A, pos.B, pos.C, 600);
    if (got.sense !== want.sense || C.orientation(pos.C, pos.A, pos.B) !== want.sense) badSense++;
    if (got.switchParas !== want.switchParas) badSwitch++;
    if (!near(got.V, want.V) || got.V.y !== 0) badShift++;
    for (const k of keys) if (!near(got[k], want[k], 1e-8)) badPoints++;
  }
  check(`all 17 derived points match the bytecode on ${cases.length} triangles`,
    badPoints === 0, `${badPoints} failures`);
  check("the outward orientation matches FindOrientation everywhere", badSense === 0);
  check("SwitchParas matches ComputeAngle(C,A,B) < PI/2 everywhere", badSwitch === 0);
  check("the unfolded copy is translated by V=(2*(width/2-centroid.x),0)", badShift === 0);
}

/* -------------------------------------- 3. the claim about CP and AB, etc. */

{
  let broken = 0, wrongPar = 0, wrongSquareA = 0, wrongSquareB = 0;
  for (const pos of cases) {
    const d = C.figure({ ...pos, width: 600, height: 440 });
    const cp = sub(d.P, pos.C), ab = sub(pos.B, pos.A);
    if (!nearNum(dot(cp, ab), 0, 1e-7) || !nearNum(len(cp), len(ab), 1e-7)) broken++;
    // CTPR, STPM and QRPN really are parallelograms, as the page says.
    if (!near(sub(d.T, pos.C), sub(d.P, d.R)) ||
        !near(sub(d.T, d.S), sub(d.P, d.M)) ||
        !near(sub(d.R, d.Q), sub(d.P, d.N))) wrongPar++;
    // C-A-S-T and C-B-Q-R are outward squares.
    const sqA = [pos.C, pos.A, d.S, d.T], sqB = [pos.C, pos.B, d.Q, d.R];
    for (const [sq, u] of [[sqA, sub(pos.A, pos.C)], [sqB, sub(pos.B, pos.C)]]) {
      if (!nearNum(len(sub(sq[1], sq[0])), len(u), 1e-7) ||
          !nearNum(len(sub(sq[2], sq[1])), len(u), 1e-7) ||
          !nearNum(dot(sub(sq[1], sq[0]), sub(sq[2], sq[1])), 0, 1e-7) ||
          !nearNum(polyArea(sq), len(u) ** 2, 1e-6)) {
        if (sq === sqA) wrongSquareA++; else wrongSquareB++;
      }
    }
  }
  check(`CP is perpendicular to AB and as long as AB on ${cases.length} triangles`,
    broken === 0, `${broken} failures`);
  check("CTPR, STPM and QRPN are parallelograms on every triangle", wrongPar === 0);
  check("C-A-S-T is a square on AC on every triangle", wrongSquareA === 0);
  check("C-B-Q-R is a square on BC on every triangle", wrongSquareB === 0);
}

/* ------------------------------- 4. both cuttings and the page's law claim */

{
  let badLaw = 0, badHept = 0, badCut2 = 0, badBranch = 0, badMeasure = 0;
  for (const pos of cases) {
    const state = { ...pos, width: 600, height: 440 };
    const d = C.figure(state);
    const m = C.measure(state, d);
    const tri = C.area([pos.A, pos.B, pos.C]);
    const hept = C.area([pos.A, pos.B, d.Q, d.N, d.P, d.M, d.S]);
    // The second cutting: square ABNM plus three copies of triangle ABC.
    const cut2 = C.area([pos.A, pos.B, d.N, d.M]) +
      C.area([pos.A, d.S, d.M]) + C.area([pos.B, d.Q, d.N]) +
      C.area([d.M, d.P, d.N]);
    if (!nearNum(m.left, m.right, Math.max(1e-6, m.left * 1e-9))) badLaw++;
    if (!nearNum(hept, m.right + 3 * tri, Math.max(1e-6, hept * 1e-9))) badHept++;
    if (!nearNum(cut2, hept, Math.max(1e-6, hept * 1e-9))) badCut2++;
    if (d.switchParas !== (m.cosC > 0)) badBranch++;
    if (!nearNum(m.cp, m.ab, 1e-7) || !nearNum(m.perpendicular, 0, 1e-7) ||
        !nearNum(m.heptagonArea, hept, 1e-6)) badMeasure++;
  }
  check(`c² = a² + b² - 2ab cos(C) on all ${cases.length} triangles`,
    badLaw === 0, `${badLaw} failures`);
  check("the heptagon's area is a²+b²-2ab cos(C) plus three triangles", badHept === 0);
  check("the unfolded cutting is the square on AB plus three triangles", badCut2 === 0);
  check("SwitchParas is on exactly when angle C is acute", badBranch === 0);
  check("measure() reports equal CP/AB, zero dot product and the heptagon area", badMeasure === 0);
}

/* ------------------------- 5. acute, right and obtuse cases from the page */

{
  const C0 = pt(0, 0);
  const acute = { A: pt(-50, 120), B: pt(60, 110), C: C0, width: 600, height: 440 };
  const obtuse = { A: pt(-50, 40), B: pt(60, 20), C: C0, width: 600, height: 440 };
  const right = { A: pt(0, 50), B: pt(60, 0), C: C0, width: 600, height: 440 };
  const ma = C.measure(acute), mo = C.measure(obtuse), mr = C.measure(right);
  check("an acute C has c² < a²+b² and SwitchParas on",
    ma.acute && ma.cosC > 0 && ma.left < ma.a ** 2 + ma.b ** 2);
  check("an obtuse C has c² > a²+b² and SwitchParas off (Euclid II.12)",
    !mo.acute && mo.cosC < 0 && mo.left > mo.a ** 2 + mo.b ** 2);
  check("a right angle at C gives c² = a²+b² (Euclid II.13 boundary)",
    !mr.acute && nearNum(mr.cosC, 0, 1e-12) && nearNum(mr.left, mr.a ** 2 + mr.b ** 2, 1e-8));
  const start = C.measure(C.start({ width: 600, height: 440 }));
  check("the applet's starting triangle is obtuse", !start.acute && start.cosC < 0);
  check("the 3-4-5 triangle obeys the law exactly",
    nearNum(C.measure({ A: pt(0, 3), B: pt(4, 0), C: pt(0, 0), width: 600, height: 440 }).left, 25));
  equal("a degenerate drag does not change the board size",
    (() => { const s = C.withPoint(C.start(), "A", pt(999, -999)); return [s.width, s.height]; })(),
    [500, 450]);
}

done("cosine-law");
