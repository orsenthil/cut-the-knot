#!/usr/bin/env node
"use strict";

/*
 * Logic test for brahmagupta-2/brahmagupta-2-core.js.
 *
 *   node porting/check-brahmagupta-2.mjs
 *
 * Checks the applet's exact start position at several canvas sizes, the
 * radial snapping of a dragged point, the four maltitudes, T (the anticenter)
 * and K (the centre of gravity) on the start figure and on 600 seeded random
 * cyclic quadrilaterals. Every page claim is tested: the four lines concur,
 * each is perpendicular to the opposite side, K is the midpoint of P-R, Q-S
 * and O-T (so PK = KR and OK = KT), T = (A+B+C+D)/2 - O, U T is perpendicular
 * to SQ, and T is the midpoint of the two reflected centres. The perpendicular-
 * diagonals case is checked separately to show how the first Brahmagupta
 * theorem is the special case of this one. The last group is a second, literal
 * transcription of the applet's own init(), MoveablePoint.UpdateLocation(),
 * GeoSDoub.NearestPoint() and GeoSDoub.Intersect() bytecode, compared point by
 * point with the core on all the same configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("brahmagupta-2/brahmagupta-2-core.js", "Brahmagupta2Core");
const P = C.pt;
const near = (p, q, tol = 1e-6) => p && q && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const nearNum = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/* ------------------------------------------------ the applet's own methods */

/* GeoSDoub.SqDist and NearestPoint(p, a, b), transcribed from javap. */
function apNearest(p, a, b) {
  const sq = (u, v) => (u.x - v.x) ** 2 + (u.y - v.y) ** 2;
  if (sq(a, p) < 0.1) return { x: p.x, y: p.y };
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/* GeoSDoub.Intersect, in its own ax+by+c form with the applet's det guard. */
function apMeet(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* Brahmagupta2Canvas.GetOtherH / GetOtherV, including the literal x+200. */
function apOtherH(circle, p) {
  const foot = apNearest(circle, p, P(p.x + 200, p.y));
  return P(2 * foot.x - p.x, p.y);
}
function apOtherV(circle, p) {
  const foot = apNearest(circle, p, P(p.x, p.y + 200));
  return P(p.x, 2 * foot.y - p.y);
}

/* Brahmagupta2Canvas.init() for any canvas size the applet could be given. */
function apStart(width, height) {
  const o = P(width / 2, height / 2);
  const r = (Math.min(width, height) * 5) / 12;
  const at = (angle) => P(o.x + r * Math.cos(angle), o.y + r * Math.sin(angle));
  const A = at(-2);
  const firstD = at(0.4);
  return { width, height, A, B: apOtherH(o, firstD), C: apOtherV(o, A), D: at(-0.2) };
}

/* CTKMoveableDoub.UpdateLocation on a circle glider: defect + radial snap. */
function apDrag(circle, r, point, mouse, defect) {
  const moved = P(point.x + defect.x + mouse.x, point.y + defect.y + mouse.y);
  const d = Math.hypot(moved.x - circle.x, moved.y - circle.y);
  return P(circle.x + ((moved.x - circle.x) * r) / d, circle.y + ((moved.y - circle.y) * r) / d);
}

/* Brahmagupta2Canvas.ComputePoints(), transcribed field by field. */
function apFigure(s) {
  const o = P(s.width / 2, s.height / 2);
  const mid = (u, v) => P((u.x + v.x) / 2, (u.y + v.y) / 2);
  const Pm = mid(s.A, s.B), Qm = mid(s.B, s.C), Rm = mid(s.C, s.D), Sm = mid(s.D, s.A);
  const E = apNearest(Pm, s.C, s.D);
  const F = apNearest(Qm, s.A, s.D);
  const G = apNearest(Rm, s.A, s.B);
  const H = apNearest(Sm, s.B, s.C);
  return { P: Pm, Q: Qm, R: Rm, S: Sm, E, F, G, H,
    T: apMeet(E, Pm, F, Qm), K: apMeet(Pm, Rm, Qm, Sm) };
}

/* ------------------------------------------------------------ 1. the start */

const start = C.start();
{
  const ref = apStart(400, 250);
  check("start matches init() at the applet's optimal size",
    ["A", "B", "C", "D"].every((n) => near(start[n], ref[n], 1e-9)));
  check("the circle has the applet's centre and 5/12 radius",
    near(C.center(start), P(200, 125)) && nearNum(C.radius(start), (250 * 5) / 12));
  check("all four starting corners lie on the circle",
    ["A", "B", "C", "D"].every((n) => nearNum(C.distance(start[n], C.center(start)), C.radius(start))));
  check("B is A's opposite corner across the vertical diameter only in x",
    nearNum(start.B.y, apStart(400, 250).B.y) && !nearNum(start.B.x, start.A.x, 1));
  check("C is A reflected in the horizontal diameter",
    nearNum(start.C.x, start.A.x) && nearNum(start.C.y + start.A.y, 250));
  equal("the saved position is plain data", JSON.parse(JSON.stringify(start)), start);
  let bad = 0;
  for (const [w, h] of [[400, 250], [500, 300], [240, 400], [800, 250], [1000, 700], [301, 251]]) {
    const ours = C.start({ width: w, height: h });
    const theirs = apStart(w, h);
    for (const n of ["A", "B", "C", "D"]) if (!near(ours[n], theirs[n], 1e-9)) bad++;
  }
  check("init() agrees at six different canvas sizes", bad === 0, `${bad} differences`);
}

/* ------------------------------------------- 2. dragging stays on the circle */

{
  const o = C.center(start), r = C.radius(start);
  const mouse = P(23, -17), defect = P(3, 4);
  const expected = apDrag(o, r, start.A, mouse, defect);
  const moved = C.withPoint(start, "A", P(start.A.x + defect.x + mouse.x, start.A.y + defect.y + mouse.y));
  check("a dragged corner lands where the applet's UpdateLocation puts it", near(moved.A, expected, 1e-9));
  check("dragging A leaves B, C and D alone",
    near(moved.B, start.B) && near(moved.C, start.C) && near(moved.D, start.D));
  check("dragging an unknown name is a no-op", C.withPoint(start, "X", P(0, 0)) === start);
  check("an angle move places the corner exactly on the circle",
    nearNum(C.distance(C.withAngle(start, "D", 1.1).D, o), r, 1e-9));
}

/* ------------------------------------ 3. every page claim, many quadrilaterals */

const configs = [start];
{
  const rand = rng(20261126);
  let tries = 0;
  while (configs.length < 601 && tries++ < 20000) {
    const angles = [rand() * 2 * Math.PI, rand() * 2 * Math.PI,
      rand() * 2 * Math.PI, rand() * 2 * Math.PI].sort((a, b) => a - b);
    const gaps = [0, 1, 2, 3].map((i) => angles[(i + 1) % 4] - angles[i] + (i === 3 ? 2 * Math.PI : 0));
    if (Math.min(...gaps) < 0.25) continue; // skip near-coincident corners
    let s = start;
    for (const [i, name] of ["A", "B", "C", "D"].entries()) s = C.withAngle(s, name, angles[i]);
    configs.push(s);
  }
}
check(`built ${configs.length} distinct cyclic quadrilaterals`, configs.length === 601);

{
  let badFig = 0, badMaltitude = 0, badPerp = 0, badAntipode = 0, badCentroid = 0;
  let badHalves = 0, badP1 = 0, badP2 = 0, badOk = 0;
  for (const s of configs) {
    const f = C.figure(s), a = apFigure(s);
    const tol = 1e-6;
    for (const n of ["P", "Q", "R", "S", "E", "F", "G", "H", "T", "K"]) {
      if (!near(f[n], a[n], tol)) badFig++;
    }
    const cl = C.claims(s);
    if (cl.maltitudeMiss > tol) badMaltitude++;
    if (cl.perpendicularResidual > tol) badPerp++;
    if (cl.anticenterGap > tol) badAntipode++;
    if (cl.centroidGap > tol) badCentroid++;
    if (cl.midpointGap > tol) badHalves++;
    if (cl.problem1 > tol) badP1++;
    if (cl.problem2 > tol) badP2++;
    if (!cl.ok) badOk++;
  }
  const count = configs.length;
  check(`figure matches the applet's ComputePoints on all ${count} quadrilaterals`, badFig === 0, `${badFig} differences`);
  check(`the four maltitudes pass through T on all ${count} quadrilaterals`, badMaltitude === 0, `${badMaltitude} failures`);
  check(`each maltitude is perpendicular to the opposite side on all ${count}`, badPerp === 0, `${badPerp} failures`);
  check(`T = (A+B+C+D)/2 - O on all ${count}`, badAntipode === 0, `${badAntipode} failures`);
  check(`K = (A+B+C+D)/4 on all ${count}`, badCentroid === 0, `${badCentroid} failures`);
  check(`K halves P-R, Q-S and O-T (PK=KR, OK=KT) on all ${count}`, badHalves === 0, `${badHalves} failures`);
  check(`Problem 1: UT is perpendicular to SQ on all ${count}`, badP1 === 0, `${badP1} failures`);
  check(`Problem 2: T is the midpoint of the two reflected centres on all ${count}`, badP2 === 0, `${badP2} failures`);
  check("the page's claims report true for every configuration", badOk === 0, `${badOk} failures`);
}

/* --------------------------- 4. the first theorem as a special case */

{
  // Chords at angles a,c and b,d are perpendicular when a+c = b+d+pi.
  const alpha = 0.3, beta = 3.9, gamma = 2.4;
  const delta = alpha + gamma - beta - Math.PI;
  let s = start;
  for (const [name, angle] of [["A", alpha], ["B", beta], ["C", gamma], ["D", delta]]) {
    s = C.withAngle(s, name, angle);
  }
  const ac = C.sub(s.C, s.A), bd = C.sub(s.D, s.B);
  check("the special configuration really has perpendicular diagonals",
    nearNum(C.dot(ac, bd), 0, 1e-9));
  const diagonalsCross = C.meet(s.A, s.C, s.B, s.D);
  const T = C.figure(s).T;
  check("with perpendicular diagonals their crossing is exactly T", near(diagonalsCross, T, 1e-6));
  // Brahmagupta I: the line through T perpendicular to a side bisects the
  // opposite side. The second theorem gives it as one of the four maltitudes.
  let badBisect = 0;
  const pairs = [[s.A, s.B, s.C, s.D], [s.B, s.C, s.D, s.A],
    [s.C, s.D, s.A, s.B], [s.D, s.A, s.B, s.C]];
  for (const [u, v, w, x] of pairs) {
    const midOpp = C.mid(w, x);
    const side = C.sub(v, u);
    if (Math.abs(C.dot(C.sub(midOpp, T), side)) > 1e-6) badBisect++;
  }
  check("the first theorem's four bisections hold in that special case", badBisect === 0, `${badBisect} failures`);
  check("the ordinary starting quadrilateral does not have perpendicular diagonals",
    Math.abs(C.dot(C.sub(start.C, start.A), C.sub(start.D, start.B))) > 1);
}

/* ------------------------------- 5. the applet's guard against parallel lines */

{
  const parallel = C.meet(P(0, 0), P(10, 0), P(0, 5), P(10, 5));
  check("parallel lines give NaN, as GeoSDoub.Intersect does",
    Number.isNaN(parallel.x) && Number.isNaN(parallel.y));
  check("a degenerate quadrilateral is reported, not silently trusted",
    !C.claims({ ...start, B: { ...start.A } }).ok);
}

done("brahmagupta-2");
