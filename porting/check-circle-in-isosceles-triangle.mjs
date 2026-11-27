#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-in-isosceles-triangle/circle-in-isosceles-triangle-core.js.
 *
 *   node porting/check-circle-in-isosceles-triangle.mjs
 *
 * Checked: the start against CircleInIsoscelesTriangleCanvas.init, the
 * placement of P and Q against DoubLine.CreateMidPoint, the circumcenters and
 * circle against a second, literal transcription of GeoSDoub.FindCircumcenter
 * (midpoint + perpendicular + Intersect, det < 1 -> NaN) and GetCircle (radius
 * is the mean of the three distances), the inverse parameter against
 * DoubLine.UpdateMidPoint, the base-foot against GeoSDoub.NearestPoint, the
 * mirrored drag against UpgradePoints, and every claim of the article over
 * 500 isosceles configurations: AP = CQ, PA·PB = QC·QA, OP = OQ, A/P/Q/O
 * concyclic, O on the circumcircle of APQ, and angle POQ = 2·angle ACB.
 * The article's "harmonic ratio is real" (solution 1) is checked as well.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circle-in-isosceles-triangle/circle-in-isosceles-triangle-core.js", "CircleInIsoscelesTriangleCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const angleAt = (v, p, q) => {
  const a = { x: p.x - v.x, y: p.y - v.y }, b = { x: q.x - v.x, y: q.y - v.y };
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (dist(a, { x: 0, y: 0 }) * dist(b, { x: 0, y: 0 })))));
};

/* ---------------- the applet's own computation, transcribed from bytecode */

const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/* GeoSDoub.Intersect(P1,P2,P3,P4) */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindCircumcenter(A,B,C): two midpoint perpendiculars, then Intersect. */
function appletCircumcenter(A, B, Cc) {
  const m1 = mid(A, B), m2 = mid(B, Cc);
  const q1 = { x: m1.x + (B.y - A.y), y: m1.y - (B.x - A.x) };
  const q2 = { x: m2.x + (Cc.y - B.y), y: m2.y - (Cc.x - B.x) };
  return appletIntersect(m1, q1, m2, q2);
}

/* DoubLine.CreateMidPoint(t): m_1*t + m_2*(1−t). */
const appletSidePoint = (m1, m2, t) => ({
  x: m1.x * t + m2.x * (1 - t),
  y: m1.y * t + m2.y * (1 - t),
});

/* DoubLine.UpdateMidPoint(m): −dot(m1−m2, m2−m) / |m1−m2|², clamped to [0,1]. */
function appletParameter(m, m1, m2) {
  const u = { x: m1.x - m2.x, y: m1.y - m2.y };
  const t = -dot(u, { x: m2.x - m.x, y: m2.y - m.y }) / dot(u, u);
  return Math.max(0, Math.min(1, t));
}

/* GeoSDoub.NearestPoint(p,a,b) */
function appletFoot(p, a, b) {
  const u = { x: b.x - a.x, y: b.y - a.y };
  const t = dot(u, { x: p.x - a.x, y: p.y - a.y }) / dot(u, u);
  return { x: a.x + u.x * t, y: a.y + u.y * t };
}

/* CircleInIsoscelesTriangleCanvas.GetCircle: mean of three radii. */
function appletCircle(A, P, Q) {
  const center = appletCircumcenter(A, P, Q);
  return {
    center,
    radius: (dist(center, A) + dist(center, P) + dist(center, Q)) / 3,
  };
}

/* Solution 1's cross ratio, as complex arithmetic. */
const csub = (a, b) => ({ re: a.x - b.x, im: a.y - b.y });
const cdiv = (a, b) => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};

/* --------------------------------------------- 1. the start, from the applet */

{
  const s = C.start({});
  equal("apex A is (W/2, H/4) from init", s.A, { x: 200, y: 75 });
  equal("base corner B is (W/4, H−H/8)", s.B, { x: 100, y: 262.5 });
  equal("base corner C mirrors B", s.C, { x: 300, y: 262.5 });
  check("init places P and Q at t = 0.3", close(s.t, 0.3, 1e-15));
  const p = C.points(s);
  equal("P from CreateMidPoint(0.3) on AB", p.P, appletSidePoint(s.A, s.B, 0.3));
  equal("Q from CreateMidPoint(0.3) on CA", p.Q, appletSidePoint(s.C, s.A, 0.3));
  check("no result in an illustration", C.result(s) === null);
  check("start is not degenerate", !C.isDegenerate(s));
  check("start is isosceles", C.claims(s).isosceles);
  check("start has AP = CQ", C.claims(s).equalLengths);
  check("the start satisfies every part of the claim", Object.values(C.claims(s)).every(Boolean));
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "A", { x: 42, y: 90 });
    return s.A.x === 200 && next.A.x === 200 && next.A.y === 90 && next.B.x === s.B.x;
  })());
  check("an unknown handle is ignored", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
  check("non-numeric input is ignored", C.withPoint(s, "B", { x: NaN, y: 2 }) === s);
}

/* ---------------------------------- 2. many configurations, both computations */

const rand = rng(3182);
const config = () => {
  const axis = 200;
  const apexY = 35 + rand() * 95;
  const half = 30 + rand() * 140;
  const baseY = 150 + rand() * 130;
  const t = 0.04 + rand() * 0.92;
  return {
    axis,
    A: { x: axis, y: apexY },
    B: { x: axis - half, y: baseY },
    C: { x: axis + half, y: baseY },
    t,
  };
};
const stateOf = (c) => C.start({ points: { A: c.A, B: c.B, C: c.C }, t: c.t, axis: c.axis });
const configs = Array.from({ length: 500 }, config);

{
  let pointsOK = 0, centerOK = 0, circleOK = 0, footOK = 0, claimsOK = 0;
  for (const c of configs) {
    const s = stateOf(c), p = C.points(s), tol = 1e-7 * dist(s.B, s.C);
    if (closePoint(p.P, appletSidePoint(s.A, s.B, s.t), tol) &&
        closePoint(p.Q, appletSidePoint(s.C, s.A, s.t), tol)) pointsOK++;
    const appletO = appletCircumcenter(s.A, s.B, s.C);
    if (closePoint(C.measurements(s).O, appletO, 1e-6 * dist(s.B, s.C))) centerOK++;
    const appletCirc = appletCircle(p.A, p.P, p.Q);
    const coreCirc = C.circle(s);
    if (closePoint(coreCirc.center, appletCirc.center, 1e-6 * dist(s.B, s.C)) &&
        close(coreCirc.radius, appletCirc.radius, 1e-6 * dist(s.B, s.C))) circleOK++;
    if (closePoint(C.foot(p.A, p.B, p.C), appletFoot(p.A, p.B, p.C), tol)) footOK++;
    const cl = C.claims(s);
    if (Object.values(cl).every(Boolean)) claimsOK++;
  }
  check(`P and Q match DoubLine.CreateMidPoint on ${pointsOK}/500 configurations`, pointsOK === 500);
  check(`O matches the applet's FindCircumcenter on ${centerOK}/500 configurations`, centerOK === 500);
  check(`the APQ circle matches the applet's GetCircle on ${circleOK}/500`, circleOK === 500);
  check(`the altitude foot matches NearestPoint on ${footOK}/500`, footOK === 500);
  check(`every part of the theorem holds on ${claimsOK}/500 configurations`, claimsOK === 500);
}

/* ---------------------------- 3. the page's proof claims over those shapes */

{
  let powers = 0, equalRadii = 0, angles = 0, ratios = 0, ratioOK = 0;
  for (const c of configs) {
    const s = stateOf(c), p = C.points(s), m = C.measurements(s);
    const { A, B, P, Q } = p, Cc = s.C, O = m.O;
    const powerP = dist(P, A) * dist(P, B), powerQ = dist(Q, Cc) * dist(Q, A);
    if (close(powerP, powerQ, 1e-6 * dist(B, Cc))) powers++;
    if (close(dist(O, P), dist(O, Q), 1e-6 * dist(B, Cc))) equalRadii++;
    if (close(angleAt(O, P, Q), 2 * angleAt(Cc, A, B), 1e-4)) angles++;
    const r1 = cdiv(csub(P, A), csub(Q, A));
    const r2 = cdiv(csub(P, O), csub(Q, O));
    if (Math.hypot(r2.re, r2.im) > 1e-6) {
      ratioOK++;
      const ratio = cdiv(r1, r2);
      if (Math.abs(ratio.im) < 1e-5 * Math.max(1, Math.hypot(ratio.re, ratio.im))) ratios++;
    }
    if (!m.O || !m.circle) throw new Error("missing center in a non-degenerate configuration");
  }
  check(`PA·PB = QC·QA on ${powers}/500 configurations`, powers === 500);
  check(`OP = OQ on ${equalRadii}/500 configurations`, equalRadii === 500);
  check(`angle POQ = 2·angle ACB on ${angles}/500`, angles === 500);
  check(`the cross ratio of solution 1 is real on ${ratioOK} shapes`, ratioOK > 480);
  check(`and its imaginary part vanishes on ${ratios}/${ratioOK}`, ratios === ratioOK);
}

/* ------------------------------------------------ 4. dragging, as in the applet */

{
  const s0 = C.start({});
  const movedA = C.withPoint(s0, "A", { x: 0, y: 40 });
  check("A cannot leave the symmetry axis", movedA.A.x === 200 && movedA.A.y === 40);
  check("moving A keeps AP = CQ", C.claims(movedA).equalLengths);

  const draggedB = C.withPoint(s0, "B", { x: 40, y: 240 });
  equal("dragging B mirrors C (UpgradePoints)", draggedB.C, { x: 360, y: 240 });
  check("dragging B leaves a claimed-isosceles triangle", C.claims(draggedB).isosceles);
  const draggedC = C.withPoint(s0, "C", { x: 350, y: 230 });
  equal("dragging C mirrors B", draggedC.B, { x: 50, y: 230 });

  let inverseOK = 0, bothOK = 0, mirrorOK = 0;
  for (let i = 0; i < 300; i++) {
    const s = stateOf(configs[i]);
    const p = C.points(s);
    // A point dragged off the side is projected to the same t as in the applet.
    const off = { x: p.P.x + (rand() - 0.5) * 30, y: p.P.y + (rand() - 0.5) * 30 };
    const t = C.tFromPoint(off, s.A, s.B);
    if (close(t, appletParameter(off, s.A, s.B), 1e-12)) inverseOK++;
    const dragged = C.withPoint(s, "P", off);
    const pp = C.points(dragged);
    if (closePoint(pp.P, appletSidePoint(s.A, s.B, t), 1e-9) &&
        closePoint(pp.Q, appletSidePoint(s.C, s.A, t), 1e-9)) bothOK++;
    const q = { x: 100 + rand() * 200, y: 150 + rand() * 100 };
    const mirrored = C.withPoint(s, "C", q);
    if (closePoint(mirrored.B, { x: 2 * s.axis - q.x, y: q.y }, 1e-12)) mirrorOK++;
  }
  check(`the inverse parameter matches UpdateMidPoint on ${inverseOK}/300 drags`, inverseOK === 300);
  check(`dragging P moves Q to the same t on ${bothOK}/300 drags`, bothOK === 300);
  check(`dragging C mirrors B on ${mirrorOK}/300 drags`, mirrorOK === 300);
}

/* ------------------------------------------ 5. degenerate places are handled */

{
  const flat = C.start({ points: {
    A: { x: 200, y: 200 }, B: { x: 100, y: 200 }, C: { x: 300, y: 200 },
  }, t: 0.4 });
  check("a flat triangle is degenerate", C.isDegenerate(flat));
  check("no O for a flat triangle", C.measurements(flat).O === null);
  check("no circle for a flat triangle", C.circle(flat) === null);
  check("no claim passes for a flat triangle", !Object.values(C.claims(flat)).some(Boolean));
  const endpoint = C.start({ t: 1 });
  check("P at a vertex is not a valid instance of the puzzle", !C.claims(endpoint).valid);
  check("the midpoint case is a valid instance", Object.values(C.claims(C.start({ t: 0.5 }))).every(Boolean));
  check("cyclic determinant vanishes at the midpoint case", (() => {
    const p = C.points(C.start({ t: 0.5 }));
    const O = C.circumcenter(p.A, p.B, p.C);
    return Math.abs(C.cyclicDeterminant(p.A, p.P, p.Q, O)) < 1e-5;
  })());
  check("cyclic determinant does not vanish for a point off the circle", (() => {
    const p = C.points(C.start({}));
    const off = { x: p.O ? p.O.x : 0, y: 15 };
    return Math.abs(C.cyclicDeterminant(p.A, p.P, p.Q, off)) > 1;
  })());
}

done("circle-in-isosceles-triangle");
