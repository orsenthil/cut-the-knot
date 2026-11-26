#!/usr/bin/env node
"use strict";

/*
 * Logic test for angle-bisector-ratio/angle-bisector-ratio-core.js.
 *
 *   node porting/check-angle-bisector-ratio.mjs
 *
 * The page's exact claim is: "If, in ABC, AD is an angle bisector of angle A,
 * then AB/AC = DB/DC." It adds that the same holds for the external angle
 * bisector, that the line through C parallel to AD meets AB in E with AE = AC
 * (an isosceles triangle), that triangles BEC and BAD are similar, and that
 * the converse follows because there is only one point on a segment dividing
 * it in a given ratio. Every one of those is checked here, on fixed triangles
 * (acute, right, obtuse, isosceles, flat) and on hundreds of random ones in
 * both orientations.
 *
 * The last section is a second, literal transcription of the applet's own
 * arithmetic from the bytecode: GeoSDoub.ComputeAngle, FindOrientation,
 * Rotate, Intersect, FindAngleBisector and GetParallelTo, then
 * AngleBisectorRatioCanvas.Compute (which calls them in that order). It is
 * compared with the core's weighted-point formulas over the same triangles.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("angle-bisector-ratio/angle-bisector-ratio-core.js", "AngleBisectorRatioCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });
const allClaims = (s) => C.claims(s);
const claimsPass = (cl) => Object.values(cl).every(Boolean);

/* ---------------- the applet's own computation, transcribed from bytecode */

/* GeoSDoub.ComputeAngle: law of cosines, no clamping, as in the class file. */
function sq(P, Q) {
  const dx = P.x - Q.x, dy = P.y - Q.y;
  return dx * dx + dy * dy;
}
function appletComputeAngle(P, Q, R) {
  const num = sq(P, Q) + sq(P, R) - sq(Q, R);
  return Math.acos(num / (2 * Math.sqrt(sq(P, Q)) * Math.sqrt(sq(P, R))));
}

/* GeoSDoub.FindOrientation: sign of (B-A) x (C-A), exactly as compiled. */
function appletOrientation(A, B, D) {
  const s = D.x * (A.y - B.y) + D.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate: turn Q about P by orientation * angle. */
function appletRotate(P, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* GeoSDoub.Intersect: ax+by+c = 0 form; the applet refuses |det| < 1. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindAngleBisector: rotate a ray by half the angle, intersect BC. */
function appletBisectorFoot(A, B, D) {
  const half = appletComputeAngle(A, B, D) / 2;
  const orient = appletOrientation(A, B, D);
  const ray = appletRotate(A, B, half, orient);
  return appletIntersect(A, ray, B, D);
}

/* GeoSDoub.GetParallelTo(P,Q,R) = P + 100*(Q-R). */
function appletGetParallelTo(P, Q, R) {
  return { x: P.x + 100 * (Q.x - R.x), y: P.y + 100 * (Q.y - R.y) };
}

/* AngleBisectorRatioCanvas.Compute(), in the bytecode's order. */
function appletCompute(A, B, Cc) {
  const Dfoot = appletBisectorFoot(A, B, Cc);
  const parallel = appletGetParallelTo(Cc, A, Dfoot); // GetParallelTo(C, A, D)
  const E = appletIntersect(B, A, Cc, parallel);     // Intersect(B, A, C, parallel)
  return { D: Dfoot, parallel, E };
}

/* --------------------------------------------- 1. the start and the options */

{
  const s = C.start({});
  equal("start A matches Canvas.init for a 400x300 applet", s.A, { x: 200, y: 230 });
  equal("start B matches Canvas.init for a 400x300 applet", s.B, { x: 300, y: 230 });
  check("start C x matches Canvas.init", close(s.C.x, 225, 1e-12), `got ${s.C.x}`);
  check("start C y matches Canvas.init", close(s.C.y, 180 - 50 * Math.sin(Math.PI / 3) - 75, 1e-12), `got ${s.C.y}`);
  check("ShowNames starts on, as the applet's parameter '1' does", s.showNames === true);
  check("Hint and Extra construction start off", s.hint === false && s.extra === false);
  check("an illustration has no result", C.result(s) === null);
  check("the starting triangle is not degenerate", !C.isDegenerate(s));
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === 200 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("withOption changes only the named option", (() => {
    const next = C.withOption(s, "extra", true);
    return next.extra === true && next.hint === false && s.extra === false;
  })());
}

/* -------------------------------------- 2. a hand-checkable right triangle */

{
  // A=(0,0), B=(4,0), C=(0,3): c=4, b=3, a=5, so DB/DC must be 4/3.
  const s = tri({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 });
  const m = C.measurements(s);
  check("right triangle: sides are 5, 3, 4", close(m.sides.a, 5, 1e-12) && close(m.sides.b, 3, 1e-12) && close(m.sides.c, 4, 1e-12));
  check("right triangle: AB/AC is 4/3", close(m.ratios.AB_AC, 4 / 3, 1e-12));
  check("right triangle: DB/DC is 4/3 (the page's exact claim)", close(m.ratios.DB_DC, 4 / 3, 1e-12), `got ${m.ratios.DB_DC}`);
  check("right triangle: D is (12/7, 12/7)", closePoint(m.D, { x: 12 / 7, y: 12 / 7 }, 1e-12));
  check("right triangle: E is (-3, 0)", closePoint(m.E, { x: -3, y: 0 }, 1e-12), JSON.stringify(m.E));
  check("right triangle: AE = AC = 3", close(m.ratios.AE_AC, 1, 1e-12));
  check("right triangle: the external foot divides BC externally as 4/3", close(m.ratios.externalDB_DC, 4 / 3, 1e-12));
  check("right triangle: every claim passes", claimsPass(allClaims(s)), JSON.stringify(allClaims(s)));
}

/* --------------------------------- 3. fixed triangles, both orientations */

const fixed = [
  ["applet start", C.start()],
  ["equilateral", tri({ x: 200, y: 40 }, { x: 60, y: 285 }, { x: 340, y: 285 })],
  ["isosceles at A", tri({ x: 200, y: 40 }, { x: 70, y: 250 }, { x: 330, y: 250 })],
  ["right", tri({ x: 60, y: 250 }, { x: 60, y: 45 }, { x: 330, y: 250 })],
  ["obtuse at A", tri({ x: 60, y: 150 }, { x: 330, y: 95 }, { x: 305, y: 245 })],
  ["obtuse at B", tri({ x: 185, y: 40 }, { x: 45, y: 265 }, { x: 360, y: 250 })],
  ["obtuse at C", tri({ x: 40, y: 45 }, { x: 360, y: 65 }, { x: 190, y: 255 })],
  ["clockwise order", tri({ x: 200, y: 250 }, { x: 60, y: 60 }, { x: 340, y: 70 })],
  ["long thin", tri({ x: 35, y: 150 }, { x: 365, y: 160 }, { x: 200, y: 178 })],
];

for (const [name, s] of fixed) {
  const cl = allClaims(s);
  check(`${name}: AB/AC = DB/DC`, cl.bisectorRatio);
  check(`${name}: D lies on the side BC`, cl.footOnSide);
  check(`${name}: AD splits angle A in half`, cl.bisectsAngle);
  check(`${name}: AE = AC in the extra construction`, cl.isosceles);
  check(`${name}: CE is parallel to AD`, cl.parallel);
  check(`${name}: triangles BEC and BAD are similar`, cl.similarTriangles);
  check(`${name}: the converse's point is unique`, cl.converseUnique);
  check(`${name}: the external bisector keeps the ratio`, cl.externalRatio);
  check(`${name}: all claims hold together`, claimsPass(cl), JSON.stringify(cl));
}

/* --------------------- 4. the page's claims over hundreds of random cases */

{
  const rand = rng(2172);
  let tested = 0;
  for (let trial = 0; trial < 700; trial++) {
    const s = tri(
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
    );
    if (C.isDegenerate(s) || C.doubleArea(s) < 900) continue;
    tested++;
    const cl = allClaims(s);
    if (!claimsPass(cl)) {
      check(`random ${trial}: every claim holds`, false, JSON.stringify(cl));
    }
  }
  check(`all claims hold on ${tested} random triangles`, tested > 600);
}

/* ------------- 5. the core against the applet's own bytecode arithmetic */

{
  let compared = 0;
  const tolFor = (s) => 2e-6 * Math.max(C.sides(s).a, C.sides(s).b, C.sides(s).c);
  for (const [name, s] of fixed) {
    const applet = appletCompute(s.A, s.B, s.C);
    const core = C.measurements(s);
    const tol = tolFor(s);
    check(`${name}: applet FindAngleBisector matches the core's D`,
      closePoint(applet.D, core.D, tol), `applet ${JSON.stringify(applet.D)}, core ${JSON.stringify(core.D)}`);
    check(`${name}: applet GetParallelTo matches the core's parallel point`,
      closePoint(applet.parallel, core.parallel, tol),
      `applet ${JSON.stringify(applet.parallel)}, core ${JSON.stringify(core.parallel)}`);
    check(`${name}: applet E matches the core's E`,
      closePoint(applet.E, core.E, tol), `applet ${JSON.stringify(applet.E)}, core ${JSON.stringify(core.E)}`);
    compared++;
  }

  const rand = rng(4711);
  let randomCompared = 0;
  for (let trial = 0; trial < 500; trial++) {
    const s = tri(
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
    );
    if (C.isDegenerate(s) || C.doubleArea(s) < 2000) continue;
    const tol = tolFor(s);
    const applet = appletCompute(s.A, s.B, s.C);
    const core = C.measurements(s);
    if (!closePoint(applet.D, core.D, tol)) {
      check(`random ${trial}: applet D matches core D`, false,
        `applet ${JSON.stringify(applet.D)}, core ${JSON.stringify(core.D)}`);
    }
    if (!closePoint(applet.E, core.E, tol)) {
      check(`random ${trial}: applet E matches core E`, false,
        `applet ${JSON.stringify(applet.E)}, core ${JSON.stringify(core.E)}`);
    }
    randomCompared++;
  }
  check(`applet and core agree on ${compared} fixed triangles`, compared === fixed.length);
  check(`applet and core agree on ${randomCompared} random triangles`, randomCompared > 350);
}

/* ------------------------------------ 6. degenerate input is handled safely */

{
  const flat = tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 });
  check("collinear points are degenerate", C.isDegenerate(flat));
  check("no bisector foot for a degenerate triangle", C.bisectorFoot(flat) === null);
  check("no auxiliary construction for a degenerate triangle", C.auxiliary(flat).E === null);
  check("no external foot for a degenerate triangle", C.externalFoot(flat) === null);
  check("no claims pass for a degenerate triangle", !claimsPass(allClaims(flat)));
  check("duplicate points are degenerate too",
    C.isDegenerate(tri({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 100, y: 100 })));
  check("intersect returns null for parallel lines",
    C.intersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }) === null);
}

done("angle-bisector-ratio");
