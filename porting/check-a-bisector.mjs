#!/usr/bin/env node
"use strict";

/*
 * Logic test for a-bisector/a-bisector-core.js.
 *
 *   node porting/check-a-bisector.mjs
 *
 * Checked: the starting triangle against the applet's GetPoint, and every
 * claim on the applet's page over 600 random triangles (acute, right, obtuse
 * and near-degenerate) plus a set of fixed triangles: the bisectors halve the
 * angles, AB/AC = BD/DC, the three feet lie on the opposite sides, the three
 * bisectors concur, and their common point is equally far from all three sides.
 * The last group is a second, literal transcription of the applet's own
 * GeoSDoub.FindAngleBisector / FindIncenter (rotate a ray by half an angle,
 * then intersect two lines) and compares it with the core's weighted-point
 * formula over the same triangles.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("a-bisector/a-bisector-core.js", "ABisectorCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });

/* ------------------------------ the applet's own construction, transcribed */

/* GeoSDoub.ComputeAngle: law of cosines at the first point. */
function appletAngle(P, Q, R) {
  const num = C_sq(P, Q) + C_sq(P, R) - C_sq(Q, R);
  return Math.acos(num / (2 * dist(P, Q) * dist(P, R)));
}
function C_sq(P, Q) {
  const dx = P.x - Q.x, dy = P.y - Q.y;
  return dx * dx + dy * dy;
}

/* GeoSDoub.FindOrientation: sign of the cross product, +1 when positive. */
function appletOrientation(A, B, D) {
  const s = D.x * (A.y - B.y) + D.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate: rotate Q about P by angle * orientation. */
function appletRotate(P, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* GeoSDoub.Intersect: the lines through P1,P2 and P3,P4 in ax+by+c=0 form. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return {
    x: (b1 * c2 - b2 * c1) / det,
    y: (c1 * a2 - c2 * a1) / det,
  };
}

/* GeoSDoub.FindAngleBisector: the foot where the internal bisector meets BC. */
function appletBisectorFoot(A, B, D) {
  const half = appletAngle(A, B, D) / 2;
  const orient = appletOrientation(A, B, D);
  const ray = appletRotate(A, B, half, orient);
  return appletIntersect(A, ray, B, D);
}

/* ABisectorCanvas.ShowIncenter: intersect the A- and B-bisectors. */
function appletIncenter(A, B, D) {
  return appletIntersect(
    A, appletBisectorFoot(A, D, B),
    B, appletBisectorFoot(B, A, D),
  );
}

/* --------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  equal("start A matches GetPoint(0) for a 400x300 canvas", s.A, { x: 150, y: 287 });
  equal("start B matches GetPoint(1) for a 400x300 canvas", s.B, { x: 150, y: 113 });
  equal("start C matches GetPoint(2) for a 400x300 canvas", s.C, { x: 300, y: 200 });
  check("a fresh diagram has no result", C.result(s) === null);
  check("the starting triangle is not degenerate", !C.isDegenerate(s));
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === 150 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown handle name leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === 150);
}

/* --------------------------------- 2. fixed triangles, including obtuse ones */

const fixed = [
  ["equilateral", tri({ x: 200, y: 40 }, { x: 60, y: 280 }, { x: 340, y: 280 })],
  ["right", tri({ x: 60, y: 250 }, { x: 60, y: 40 }, { x: 320, y: 250 })],
  ["obtuse at A", tri({ x: 60, y: 150 }, { x: 320, y: 90 }, { x: 300, y: 240 })],
  ["obtuse at B", tri({ x: 180, y: 40 }, { x: 50, y: 260 }, { x: 360, y: 250 })],
  ["obtuse at C", tri({ x: 40, y: 40 }, { x: 360, y: 60 }, { x: 190, y: 250 })],
  ["very flat", tri({ x: 40, y: 150 }, { x: 360, y: 160 }, { x: 200, y: 175 })],
  ["the applet's own start", C.start()],
];

for (const [name, s] of fixed) {
  const m = C.measurements(s);
  const cl = C.claims(s);
  check(`${name}: the three angles are halved`, cl.anglesSplit);
  check(`${name}: AB/AC = BD/DC (and the cyclic forms)`, cl.bisectorRatio);
  check(`${name}: the feet lie inside the opposite sides`, cl.feetOnSides);
  check(`${name}: the three bisectors concur`, cl.concurrent);
  check(`${name}: the incenter is equidistant from all sides`, cl.equidistant);
  check(`${name}: r times perimeter equals twice the area`, cl.inradiusFormula);
  check(`${name}: Ceva's product is 1`, cl.ceva);
  check(`${name}: every claim passes at once`, Object.values(cl).every(Boolean));
}

/* ----------------------- 3. every claim over many non-degenerate triangles */

{
  const rand = rng(2032);
  let tested = 0;
  for (let trial = 0; trial < 600; trial++) {
    const s = tri(
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
    );
    if (C.isDegenerate(s) || C.doubleArea(s) < 500) continue;
    tested++;
    const cl = C.claims(s);
    if (!Object.values(cl).every(Boolean)) {
      check(`random triangle ${trial}: all claims hold`, false, JSON.stringify(cl));
    }
  }
  check(`all claims hold on all ${tested} random triangles`, tested > 550);
}

/* -------------------------- 4. the applet's construction vs the core's math */

{
  const rand = rng(777);
  let compared = 0;
  for (const [, s] of fixed) {
    if (C.isDegenerate(s)) continue;
    const tol = 2e-5 * Math.max(C.sides(s).a, C.sides(s).b, C.sides(s).c);
    for (const v of ["A", "B", "C"]) {
      const opp = { A: [s.B, s.C], B: [s.A, s.C], C: [s.A, s.B] }[v];
      const applet = appletBisectorFoot(s[v], opp[0], opp[1]);
      const core = C.bisectorFoot(s, v);
      check(`fixed ${v}-foot matches appletBisectorFoot`, closePoint(applet, core, tol),
        `applet ${JSON.stringify(applet)}, core ${JSON.stringify(core)}`);
    }
    const appletI = appletIncenter(s.A, s.B, s.C);
    const coreI = C.incenter(s);
    check("fixed incenter matches applet Intersect", closePoint(appletI, coreI, tol),
      `applet ${JSON.stringify(appletI)}, core ${JSON.stringify(coreI)}`);
    compared++;
  }
  for (let trial = 0; trial < 400; trial++) {
    const s = tri(
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
    );
    if (C.isDegenerate(s) || C.doubleArea(s) < 1000) continue;
    const tol = 2e-5 * Math.max(C.sides(s).a, C.sides(s).b, C.sides(s).c);
    const coreI = C.incenter(s);
    const appletI = appletIncenter(s.A, s.B, s.C);
    if (!closePoint(appletI, coreI, tol)) {
      check(`random ${trial}: incenter matches the applet`, false,
        `applet ${JSON.stringify(appletI)}, core ${JSON.stringify(coreI)}`);
    }
    const footD = appletBisectorFoot(s.A, s.C, s.B);
    const coreD = C.bisectorFoot(s, "A");
    if (!closePoint(footD, coreD, tol)) {
      check(`random ${trial}: bisector foot matches the applet`, false);
    }
    compared++;
  }
  check(`applet and core agree on ${compared} triangles`, compared > 350);
}

/* ------------------------------------ 5. degenerate input is handled safely */

{
  const flat = tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 });
  check("collinear points are degenerate", C.isDegenerate(flat));
  check("no incenter for a degenerate triangle", C.incenter(flat) === null);
  check("no bisector foot for a degenerate triangle", C.bisectorFoot(flat, "A") === null);
  check("no claims pass for a degenerate triangle", !Object.values(C.claims(flat)).some(Boolean));
  check("the duplicate-point case is degenerate too",
    C.isDegenerate(tri({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 100, y: 100 })));
  check("projectOnSegment keeps a point between its ends", (() => {
    const q = C.projectOnSegment({ x: 500, y: 500 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    return closePoint(q, { x: 10, y: 0 }, 1e-12);
  })());
}

done("a-bisector");
