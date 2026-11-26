#!/usr/bin/env node
"use strict";

/*
 * Logic test for angle-bisector-ratio-2/angle-bisector-ratio-2-core.js.
 *
 *   node porting/check-angle-bisector-ratio-2.mjs
 *
 * Checked: the applet's own starting triangle; the page's exact claim
 * AB/AC = DB/DC on fixed triangles and on hundreds of random triangles,
 * including obtuse and very flat ones; the two steps of McWorter's proof
 * (AB/AC = BE/DC and BE = BD, with angle ACB = angle ABE); the external
 * bisector note from the first applet; and a second, literal transcription of
 * GeoSDoub.FindAngleBisector / ComputeSignedAngle / Rotate / Intersect from the
 * bytecode, compared point by point with the core's weighted-point method.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("angle-bisector-ratio-2/angle-bisector-ratio-2-core.js", "AngleBisectorRatio2Core");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol));
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });

/* ----------------- the applet's own computation, transcribed from the bytecode */

/* GeoSDoub.SqDist and Dist. */
const sq = (P, Q) => (P.x - Q.x) ** 2 + (P.y - Q.y) ** 2;

/* GeoSDoub.ComputeAngle: the law of cosines at the first point. */
function appletAngle(P, Q, R) {
  const top = sq(P, Q) + sq(P, R) - sq(Q, R);
  return Math.acos(top / (2 * dist(P, Q) * dist(P, R)));
}

/* GeoSDoub.FindOrientation: the bytecode's cross product, +1 when > 0. */
function appletOrientation(P, Q, R) {
  const s = R.x * (P.y - Q.y) + R.y * (Q.x - P.x) + P.x * Q.y - Q.x * P.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.ComputeSignedAngle: the unsigned angle with the orientation's sign. */
function appletSignedAngle(P, Q, R) {
  const angle = appletAngle(P, Q, R);
  return appletOrientation(P, Q, R) === 1 ? angle : -angle;
}

/* GeoSDoub.Rotate: rotate Q about P; sign multiplies the sine term. */
function appletRotate(P, Q, angle, sign) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - sign * sn * (Q.y - P.y),
    y: P.y + sign * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* GeoSDoub.Intersect: lines in ax+by+c=0 form; |det| < 1 gives NaN in Java. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindAngleBisector(A, B, C): rotate AB by half angle A toward AC,
 * then intersect that ray with BC. */
function appletD(A, B, Cc) {
  const half = appletAngle(A, B, Cc) / 2;
  const ray = appletRotate(A, B, half, appletOrientation(A, B, Cc));
  return appletIntersect(A, ray, B, Cc);
}

/* AngleBisectorRatio2Canvas.Compute: E = Intersect(B, Rotate(B, A,
 * ComputeSignedAngle(C, A, B), -1), A, D). The three arguments of the signed
 * angle are C, A, B because the bytecode pushes B first for Rotate's centre. */
function appletE(A, B, Cc, D) {
  const ray = appletRotate(B, A, appletSignedAngle(Cc, A, B), -1);
  return appletIntersect(B, ray, A, D);
}

/* The applet's init(), for its 600x550 canvas. */
function appletStart() {
  const width = 600, height = 550;
  const cx = width / 2, base = (height * 3) / 5, unit = width / 8;
  return tri(
    { x: cx - 2 * unit + 100, y: base + 100 },
    { x: cx + 2 * unit + 100, y: base + 100 },
    { x: cx + unit * Math.cos(Math.PI / 3) * (6 / 5), y: base - unit * Math.sin(Math.PI / 3) - 150 },
  );
}

/* ---------------------------------------- 1. the start and the no-win rule */

{
  const s = C.start();
  equal("start A matches the applet's init", s.A, appletStart().A);
  equal("start B matches the applet's init", s.B, appletStart().B);
  equal("start C matches the applet's init", s.C, appletStart().C);
  check("a fresh diagram has no win or loss", C.result(s) === null);
  check("the starting triangle is not degenerate", !C.isDegenerate(s));
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === 250 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown handle name leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === 250);
  check("an explicit set of points is cloned", (() => {
    const p = { A: { x: 1, y: 2 }, B: { x: 3, y: 4 }, C: { x: 5, y: 6 } };
    const s2 = C.start({ points: p });
    p.A.x = 99;
    return s2.A.x === 1 && C.isDegenerate(s2);
  })());
}

/* ---------------------------- 2. fixed triangles, including obtuse and flat ones */

const fixed = [
  ["applet's own start", C.start()],
  ["equilateral", tri({ x: 300, y: 60 }, { x: 100, y: 420 }, { x: 500, y: 420 })],
  ["right at A", tri({ x: 120, y: 400 }, { x: 120, y: 100 }, { x: 480, y: 400 })],
  ["obtuse at A", tri({ x: 120, y: 300 }, { x: 540, y: 180 }, { x: 460, y: 450 })],
  ["obtuse at B", tri({ x: 300, y: 80 }, { x: 90, y: 450 }, { x: 540, y: 430 })],
  ["obtuse at C", tri({ x: 80, y: 80 }, { x: 540, y: 120 }, { x: 280, y: 460 })],
  ["very flat", tri({ x: 80, y: 300 }, { x: 540, y: 320 }, { x: 300, y: 340 })],
  ["tall and thin", tri({ x: 300, y: 20 }, { x: 295, y: 520 }, { x: 305, y: 300 })],
];

for (const [name, s] of fixed) {
  const m = C.measurements(s);
  const cl = C.claims(s);
  check(`${name}: AB/AC = DB/DC, the page's exact claim`, cl.pageRatio,
    `${m.ratios.AB_AC} vs ${m.ratios.DB_DC}`);
  check(`${name}: the half angles at A agree`, cl.anglesHalved);
  check(`${name}: D lies on the side BC`, cl.footOnBC);
  check(`${name}: the extra point E lies on line AD`, cl.EOnAD);
  check(`${name}: the page's proof steps (AB/AC = BE/DC, BE = BD, angle ACB = ABE)`,
    cl.similarity && cl.isosceles && cl.equalAngles, JSON.stringify(m.ratios));
  check(`${name}: the Ceva product of the three bisectors is 1`, cl.ceva);
  check(`${name}: all claims hold together`, Object.values(cl).every(Boolean), JSON.stringify(cl));
}

/* --------------------- 3. the page's claim over hundreds of random triangles */

{
  const rand = rng(2182);
  let tested = 0, worst = 0, worstProof = 0, externalTested = 0;
  for (let trial = 0; trial < 800; trial++) {
    const s = tri(
      { x: 20 + rand() * 560, y: 20 + rand() * 510 },
      { x: 20 + rand() * 560, y: 20 + rand() * 510 },
      { x: 20 + rand() * 560, y: 20 + rand() * 510 },
    );
    if (C.isDegenerate(s) || C.doubleArea(s) < 2000) continue;
    tested++;
    const m = C.measurements(s);
    const cl = C.claims(s);
    worst = Math.max(worst, Math.abs(m.ratios.AB_AC - m.ratios.DB_DC));
    worstProof = Math.max(worstProof, Math.abs(m.ratios.BE_BD - 1),
      Math.abs(m.ratios.AB_AC - m.ratios.BE_DC));
    if (!cl.pageRatio || !cl.similarity || !cl.isosceles || !cl.equalAngles || !cl.footOnBC) {
      check(`random triangle ${trial}: the page's claim and proof hold`, false, JSON.stringify(cl));
    }
    if (C.externalFoot(s)) {
      externalTested++;
      if (!cl.externalRatio) check(`random triangle ${trial}: external bisector ratio`, false);
    }
  }
  check(`AB/AC = DB/DC on ${tested} random triangles`, tested > 700);
  check(`the page's ratio is exact to floating point (worst error ${worst.toExponential(2)})`, worst < 1e-8);
  check(`the proof's two equalities hold (worst error ${worstProof.toExponential(2)})`, worstProof < 1e-8);
  check(`the first applet's external-bisector note holds on ${externalTested} triangles`, externalTested > 650);
  check("the mistaken AB/BC form of the ratio is not the page's claim", (() => {
    const s = fixed[2][1];
    const m = C.measurements(s);
    return Math.abs(m.sides.AB / m.sides.BC - m.ratios.DB_DC) > 0.1;
  })());
}

/* —— 4. the same answers as the applet's own methods, over the whole range —— */

{
  let compared = 0;
  const rand = rng(777);
  for (let trial = 0; trial < 400; trial++) {
    const s = trial < fixed.length
      ? fixed[trial][1]
      : tri(
        { x: 20 + rand() * 560, y: 20 + rand() * 510 },
        { x: 20 + rand() * 560, y: 20 + rand() * 510 },
        { x: 20 + rand() * 560, y: 20 + rand() * 510 },
      );
    if (C.isDegenerate(s) || C.doubleArea(s) < 2000) continue;
    const tol = 1e-5 * Math.max(C.sides(s).AB, C.sides(s).AC, C.sides(s).BC);
    const m = C.measurements(s);
    const aD = appletD(s.A, s.B, s.C);
    const aE = appletE(s.A, s.B, s.C, aD);
    if (!closePoint(m.D, aD, tol)) {
      check(`triangle ${trial}: D matches GeoSDoub.FindAngleBisector`, false,
        `applet ${JSON.stringify(aD)}, core ${JSON.stringify(m.D)}`);
    }
    if (!closePoint(m.E, aE, tol)) {
      check(`triangle ${trial}: E matches Canvas.Compute`, false,
        `applet ${JSON.stringify(aE)}, core ${JSON.stringify(m.E)}`);
    }
    // The applet's own D obeys the printed formula; this is not a tautology,
    // it checks the transcription used above against the page's statement.
    const appletRatio = dist(s.B, aD) / dist(aD, s.C);
    if (!close(appletRatio, C.sides(s).AB / C.sides(s).AC, 1e-7)) {
      check(`triangle ${trial}: the applet's own D gives AB/AC = DB/DC`, false);
    }
    compared++;
  }
  check(`D and E match the applet on ${compared} triangles`, compared > 350);
}

done("angle-bisector-ratio-2");
