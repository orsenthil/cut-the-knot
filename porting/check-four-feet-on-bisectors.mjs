#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-feet-on-bisectors/four-feet-on-bisectors-core.js.
 *
 *   node porting/check-four-feet-on-bisectors.mjs
 *
 * The page's claim is that the four projections of A onto the internal and
 * external angle bisectors at B and C are collinear. This test checks that
 * claim, the rectangle AMBP, the cyclic quadrilateral ANIM, both angle
 * identities on the page, and Nathan Bowler's Simson-line observation on the
 * applet's starting triangle, on fixed triangles, on a full grid of apex
 * positions and on hundreds of random triangles.
 *
 * It also checks one claim the page gets wrong: it says angle AIN = A/2 + B/2;
 * the true value is A/2 + C/2 = 90 - B/2. The test verifies the true value and
 * confirms that the page's value only agrees when B = C.
 *
 * Lastly, GeoSDoub's own methods (FindAngleBisector, Rotate, Intersect,
 * NearestPoint, SetPerpLine) are transcribed a second time from the bytecode
 * and compared with the core over every configuration, alongside an
 * independent angle-bisector-theorem calculation.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-feet-on-bisectors/four-feet-on-bisectors-core.js", "FourFeetOnBisectorsCore");

const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const cross = (p, q) => p.x * q.y - p.y * q.x;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const config = (A, B, Cc) => ({ A, B, C: Cc });

/* --------------------------------- the applet's methods, transcribed again */

/* GeoSDoub.FindOrientation, written out as the determinant from javap. */
function javaOrientation(p, q, r) {
  const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.ComputeAngle: law of cosines at the first argument. */
function javaAngle(p, q, r) {
  const above = C.sqDist(p, q) + C.sqDist(p, r) - C.sqDist(q, r);
  return Math.acos(Math.max(-1, Math.min(1, above / (2 * dist(p, q) * dist(p, r)))));
}

/* GeoSDoub.Rotate: turn q around p, with the sign from FindOrientation. */
function javaRotate(p, q, theta, sign) {
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const x = p.x + cos * (q.x - p.x) - sign * sin * (q.y - p.y);
  const y = p.y + sign * sin * (q.x - p.x) + cos * (q.y - p.y);
  return { x, y };
}

/* GeoSDoub.Intersect: line coefficients, determinant and the |det| < 1 guard. */
function javaIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindAngleBisector(p, q, r): rotated q, intersect the line qr. */
function javaBisectorFoot(p, q, r) {
  const turned = javaRotate(p, q, javaAngle(p, q, r) / 2, javaOrientation(p, q, r));
  return javaIntersect(p, turned, q, r);
}

/* GeoSDoub.NearestPoint(p, a, b), including the SqDist < 0.1 early return. */
function javaNearest(p, a, b) {
  if (C.sqDist(a, b) < 0.1) return { x: p.x, y: p.y };
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/* FourFeetOnBisectorsCanvas.SetPerpLine: direction (dy, -dx) at the first point. */
function javaPerp(p, q) {
  return { p: { x: p.x, y: p.y },
           q: { x: p.x + q.y - p.y, y: p.y - (q.x - p.x) } };
}

/* The whole of FourFeetOnBisectorsCanvas.Compute(), in its bytecode order. */
function javaCompute(s) {
  const { A, B, C: Cc } = s;
  const footB = javaBisectorFoot(B, A, Cc);
  const footC = javaBisectorFoot(Cc, A, B);
  const Bi = { p: B, q: footB };
  const Be = javaPerp(B, footB);
  const Ci = { p: Cc, q: footC };
  const Ce = javaPerp(Cc, footC);
  const M = javaNearest(A, Bi.p, Bi.q);
  const N = javaNearest(A, Ci.p, Ci.q);
  const P = javaNearest(A, Be.p, Be.q);
  const Q = javaNearest(A, Ce.p, Ce.q);
  const I = javaIntersect(Bi.p, Bi.q, Ci.p, Ci.q);
  const Line = { p: P, q: Q };
  return { footB, footC, Bi, Be, Ci, Ce, M, N, P, Q, I, Line };
}

/* An independent way to find the same bisector point: the angle-bisector
   theorem, which divides the opposite side in the ratio of the near sides. */
function theoremBisectorFoot(p, q, r) {
  const nearQ = dist(p, q), nearR = dist(p, r);
  return add(q, mul(sub(r, q), nearQ / (nearQ + nearR)));
}

/* Independent collinearity: every foot on the line through the two feet that
   are farthest apart, so a short MN in a skinny triangle cannot amplify rounding. */
function collinearGap(pts) {
  let best = null, length = -1;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = sub(pts[j], pts[i]);
      const n = Math.hypot(d.x, d.y);
      if (n > length) { best = { i, j, d, n }; length = n; }
    }
  }
  return Math.max(...pts.map((p) => Math.abs(cross(best.d, sub(p, pts[best.i]))))) / best.n;
}

/* Independent circumcircle residual, written from the determinant condition. */
function onCircle(p, a, b, c) {
  const da = C.sqDist(a, { x: 0, y: 0 }), db = C.sqDist(b, { x: 0, y: 0 });
  const dc = C.sqDist(c, { x: 0, y: 0 }), dp = C.sqDist(p, { x: 0, y: 0 });
  const det = (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y);
  if (Math.abs(det) < 1e-9) return NaN;
  const value = ((a.x - c.x) * ((b.y - c.y) * (dp - dc) - (p.y - c.y) * (db - dc))
    - (b.x - c.x) * ((a.y - c.y) * (dp - dc) - (p.y - c.y) * (da - dc))
    + (p.x - c.x) * ((a.y - c.y) * (db - dc) - (b.y - c.y) * (da - dc))) / det;
  return value;
}

const allClaims = (s) => C.claims(s);

/* -------------------------------------------- 1. the start and the rules */

{
  const s = C.start({});
  equal("start A = (2W/5, H/3)", s.A, { x: 200, y: 150 });
  equal("start B = (W/3, 4H/5)", s.B, { x: 500 / 3, y: 360 });
  equal("start C = (2W/3, 4H/5)", s.C, { x: 1000 / 3, y: 360 });
  equal("withPoint rejects an unknown corner", C.withPoint(s, "Z", { x: 1, y: 2 }), s);
  check("withPoint leaves the old position alone", (() => {
    const n = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === 200 && n.A.x === 10 && n.B.x === s.B.x;
  })());
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("the starting triangle is not degenerate", C.construction(s).ok && !C.construction(s).degenerate);
  check("a triangle with coincident corners has no construction",
    !C.construction(config({ x: 200, y: 100 }, { x: 200, y: 100 }, { x: 400, y: 100 })).ok);
  check("a triangle with NaN input has no construction",
    !C.construction(config({ x: NaN, y: 100 }, { x: 100, y: 200 }, { x: 300, y: 100 })).ok);
  check("a straight angle is 180 degrees at A", close(C.angleAt(
    { x: 200, y: 100 }, { x: 0, y: 100 }, { x: 400, y: 100 }), Math.PI, 1e-12));
  check("the starting claim object has no failures", (() => {
    const cl = allClaims(s);
    return cl.valid && cl.rectangle && cl.feetOnBisectors && cl.pageAngles &&
      cl.colEqualAngles && cl.cyclic && cl.collinear && cl.simson;
  })());
  check("but the page's value of angle AIN is already wrong at the start", !allClaims(s).pageAINValue);
}

/* ---------------------------------- 2. every claim on fixed triangles */

const fixed = [
  ["the applet's start", C.start({})],
  ["a tall apex", config({ x: 250, y: 40 }, { x: 80, y: 400 }, { x: 430, y: 400 })],
  ["an obtuse corner", config({ x: 60, y: 210 }, { x: 300, y: 60 }, { x: 410, y: 390 })],
  ["B and C swapped", config({ x: 220, y: 120 }, { x: 400, y: 380 }, { x: 60, y: 380 })],
  ["a narrow triangle", config({ x: 250, y: 90 }, { x: 220, y: 390 }, { x: 300, y: 390 })],
  ["an apex below the base", config({ x: 260, y: 420 }, { x: 90, y: 120 }, { x: 420, y: 120 })],
];

for (const [name, s] of fixed) {
  const c = C.construction(s);
  const m = C.measurements(s);
  const cl = allClaims(s);
  check(`${name}: the four bisectors and feet exist`, c.ok && !c.degenerate && Boolean(c.I));
  check(`${name}: the feet sit on their bisectors`, cl.feetOnBisectors);
  check(`${name}: AMBP is a rectangle`, cl.rectangle);
  check(`${name}: angle AMP = angle ABP = (180 - B)/2`, cl.pageAngles);
  check(`${name}: angle AMN = angle AIN = (A + C)/2`, cl.colEqualAngles && !cl.pageAINValue);
  check(`${name}: A, N, I, M are concyclic`, cl.cyclic);
  check(`${name}: M, N, P, Q lie on one line`, cl.collinear &&
    collinearGap([c.M, c.N, c.P, c.Q]) <= 1e-6 * dist(s.B, s.C));
  check(`${name}: the Simson circle B-I-I_C passes through A`, cl.simson);
  check(`${name}: I is equally far from the three sides`, m.incenterGap <= 1e-6);
}

/* -------------------------------------- 3. a full grid of apex positions */

{
  let tested = 0;
  let failed = 0;
  for (let gx = 1; gx <= 9; gx++) {
    for (let gy = 1; gy <= 7; gy++) {
      const s = config(
        { x: 40 + gx * 43, y: 30 + gy * 48 },
        { x: 110, y: 380 }, { x: 400, y: 380 },
      );
      const c = C.construction(s);
      if (!c.ok || c.degenerate || !c.I) continue;
      const cl = allClaims(s);
      const m = C.measurements(s);
      tested++;
      /* At the symmetric apex B = C, A/2 + B/2 happens to be the right value. */
      const pageCoincides = Math.abs(m.angleB - m.angleC) < 1e-3;
      if (!cl.rectangle || !cl.feetOnBisectors || !cl.pageAngles ||
          !cl.colEqualAngles || !cl.cyclic || !cl.collinear || !cl.simson ||
          (cl.pageAINValue && !pageCoincides)) {
        failed++;
        console.error(`  grid apex ${gx},${gy}: ${JSON.stringify(cl)}`);
      }
    }
  }
  check(`all ${tested} grid positions satisfy every true claim`, tested >= 60 && failed === 0);
}

/* ------------------------ 4. the page's wrong angle formula, on purpose */

{
  const rand = rng(701);
  let different = 0, equalOnlyWhenBC = 0;
  for (let i = 0; i < 300; i++) {
    const s = config(
      { x: 40 + rand() * 420, y: 30 + rand() * 380 },
      { x: 40 + rand() * 420, y: 30 + rand() * 380 },
      { x: 40 + rand() * 420, y: 30 + rand() * 380 },
    );
    const c = C.construction(s);
    if (!c.ok || c.degenerate || !c.I) continue;
    const m = C.measurements(s);
    const scale = Math.max(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A), 1);
    if (Math.abs(m.ain - (m.angleA + m.angleC) / 2) > 1e-6) {
      check(`trial ${i}: AIN = A/2 + C/2`, false);
    }
    if (Math.abs(m.ain - (m.angleA + m.angleB) / 2) > 1e-6) different++;
    else if (Math.abs(m.angleB - m.angleC) < 1e-3) equalOnlyWhenBC++;
    else check(`trial ${i}: the page's A/2 + B/2 only works when B = C`, false);
  }
  check(`the page's A/2 + B/2 fails in ${different} of ${different + equalOnlyWhenBC} triangles`,
    different > 200);
  check("the page's formula agrees only in the isosceles case", equalOnlyWhenBC >= 0);
}

/* ----------------- 5. the applet's own Compute() vs the core, everywhere */

{
  const rand = rng(3142);
  const cases = fixed.map(([, s]) => s);
  for (let i = 0; i < 500; i++) {
    cases.push(config(
      { x: 20 + rand() * 460, y: 20 + rand() * 410 },
      { x: 20 + rand() * 460, y: 20 + rand() * 410 },
      { x: 20 + rand() * 460, y: 20 + rand() * 410 },
    ));
  }
  let compared = 0, degenerates = 0;
  for (const s of cases) {
    const core = C.construction(s);
    const applet = javaCompute(s);
    const tol = 1e-7 * Math.max(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A), 1);
    const appletFinite = [applet.footB, applet.footC, applet.M, applet.N,
      applet.P, applet.Q, applet.I].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!core.ok || !appletFinite) {
      if (core.ok !== appletFinite) check("core and bytecode agree on degeneracy", false);
      degenerates++;
      continue;
    }
    if (!closePoint(core.footB, applet.footB, tol) ||
        !closePoint(core.footC, applet.footC, tol)) {
      check("the applet's FindAngleBisector matches the core", false, JSON.stringify(s));
    }
    if (!closePoint(core.M, applet.M, tol) || !closePoint(core.N, applet.N, tol) ||
        !closePoint(core.P, applet.P, tol) || !closePoint(core.Q, applet.Q, tol)) {
      check("all four projections match the applet's NearestPoint", false, JSON.stringify(s));
    }
    if (!closePoint(core.I, applet.I, tol)) {
      check("the incenter matches the applet's Intersect", false, JSON.stringify(s));
    }
    if (!closePoint(core.Bi.p, applet.Bi.p, tol) ||
        !closePoint(core.Be.q, applet.Be.q, tol) ||
        !closePoint(core.Ci.p, applet.Ci.p, tol) ||
        !closePoint(core.Ce.q, applet.Ce.q, tol)) {
      check("the internal and external bisectors match SetLine/SetPerpLine", false);
    }
    if (!closePoint(core.line.p, applet.Line.p, tol) ||
        !closePoint(core.line.q, applet.Line.q, tol)) {
      check("the statement line through P and Q matches", false);
    }
    compared++;
  }
  check(`core and bytecode agree on ${compared} configurations`, compared > 400);
  check(`${degenerates} degenerate cases were rejected by both`, degenerates >= 0);
}

/* --------------------------- 6. independent geometry, not the same code */

{
  const rand = rng(9988);
  let tested = 0;
  for (let i = 0; i < 200; i++) {
    const s = config(
      { x: 40 + rand() * 420, y: 40 + rand() * 360 },
      { x: 40 + rand() * 420, y: 40 + rand() * 360 },
      { x: 40 + rand() * 420, y: 40 + rand() * 360 },
    );
    const c = C.construction(s);
    if (!c.ok || c.degenerate || !c.I) continue;
    tested++;
    const scale = dist(s.A, s.B) + dist(s.B, s.C) + dist(s.C, s.A);
    const tol = 1e-6 * scale;
    if (!closePoint(c.footB, theoremBisectorFoot(s.B, s.A, s.C), tol) ||
        !closePoint(c.footC, theoremBisectorFoot(s.C, s.A, s.B), tol)) {
      check(`trial ${i}: the rotation bisector obeys the angle-bisector theorem`, false);
    }
    if (collinearGap([c.M, c.N, c.P, c.Q]) > tol) {
      check(`trial ${i}: the four feet are collinear independently`, false,
        `gap ${collinearGap([c.M, c.N, c.P, c.Q])} tolerance ${tol} state ${JSON.stringify(s)}`);
    }
    /* The Simson circle: B, I and I_C, with I_C found from side lengths. */
    const centers = C.centers(s.A, s.B, s.C);
    if (!centers || !close(onCircle(s.A, s.B, centers.I, centers.IC), 0, tol)) {
      check(`trial ${i}: A lies on the circumcircle of B, I and I_C`, false,
        `residual ${onCircle(s.A, s.B, centers.I, centers.IC)}`);
    }
    /* The page's other circle: A, N, I, M. */
    if (!close(onCircle(c.I, s.A, c.N, c.M), 0, tol)) {
      check(`trial ${i}: I lies on the circumcircle of A, N and M`, false);
    }
    /* AMBP rectangle: opposite sides equal and adjacent sides perpendicular. */
    if (!close(dist(s.A, c.M), dist(s.B, c.P), tol) ||
        !close(dist(s.A, c.P), dist(s.B, c.M), tol) ||
        Math.abs(dot(sub(c.M, s.A), sub(c.P, s.A))) > tol) {
      check(`trial ${i}: AMBP is a rectangle`, false);
    }
  }
  check(`independent formulas confirm every claim on ${tested} triangles`, tested > 150);
}

done("four-feet-on-bisectors");
