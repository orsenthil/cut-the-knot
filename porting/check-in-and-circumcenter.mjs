#!/usr/bin/env node
"use strict";

/*
 * Logic test for in-and-circumcenter/in-and-circumcenter-core.js.
 *
 *   node porting/check-in-and-circumcenter.mjs
 *
 * Checked: the starting triangle against the applet's init() at two canvas
 * sizes; a second, literal transcription of GeoSDoub.FindIncenter,
 * FindCircumcenter and NearestPoint plus InAndCircumcenterCanvas.Compute,
 * compared point by point with the core over fixed and 300 random triangles;
 * the page's claims (BD = AE = AB, DE perpendicular to IO for every triangle,
 * DE = 2·IO·sin(C), equality at C = 30 degrees, and the three parallel lines)
 * over fixed and 400 random triangles; the right-angle mark at S; and the
 * degenerate cases where no triangle can be drawn.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "in-and-circumcenter/in-and-circumcenter-core.js",
  "InAndCircumcenterCore",
);

const tri = (A, B, D) => ({ A: { ...A }, B: { ...B }, C: { ...D } });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const dot = (u, v) => u.x * v.x + u.y * v.y;

/* ------------------ the applet's computation, transcribed a second time ---- */
/* Straight from javap of GeoSDoub and InAndCircumcenterCanvas.                */

function apSq(p, q) {
  const dx = p.x - q.x, dy = p.y - q.y;
  return dx * dx + dy * dy;
}
function apDist(p, q) { return Math.sqrt(apSq(p, q)); }
function apMid(p, q) { return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; }
function apOrientation(p, q, r) {
  const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return s > 0 ? 1 : -1;
}
function apAngle(p, q, r) {
  const cos = (apSq(p, q) + apSq(p, r) - apSq(q, r)) / (2 * apDist(p, q) * apDist(p, r));
  return Math.acos(cos);
}
function apRotate(p, q, angle, handed) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: p.x + cs * (q.x - p.x) - handed * sn * (q.y - p.y),
    y: p.y + handed * sn * (q.x - p.x) + cs * (q.y - p.y),
  };
}
function apIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}
function apIncenter(a, b, c) {
  const hand = apOrientation(a, b, c);
  const ra = apRotate(a, b, apAngle(a, b, c) / 2, hand);
  const rb = apRotate(b, c, apAngle(b, c, a) / 2, hand);
  return apIntersect(a, ra, b, rb);
}
function apCircumcenter(a, b, c) {
  const m1 = apMid(a, b), m2 = apMid(b, c);
  const o1 = { x: m1.x + b.y - a.y, y: m1.y - (b.x - a.x) };
  const o2 = { x: m2.x + c.y - b.y, y: m2.y - (c.x - b.x) };
  return apIntersect(m1, o1, m2, o2);
}
function apNearest(p, x, y) {
  const den = apSq(x, y);
  if (den < 0.1) return { x: p.x, y: p.y };
  const dx = y.x - x.x, dy = y.y - x.y;
  const t = ((p.x - x.x) * dx + (p.y - x.y) * dy) / den;
  return { x: x.x + dx * t, y: x.y + dy * t };
}
function apPlace(p, q, r) {
  const t = apDist(p, q) / apDist(p, r);
  return { x: p.x + (r.x - p.x) * t, y: p.y + (r.y - p.y) * t };
}
function apCompute(s) {
  const { A, B, C: V } = s;
  const I = apIncenter(A, B, V);
  const O = apCircumcenter(A, B, V);
  const rIn = (apDist(I, apNearest(I, A, B)) + apDist(I, apNearest(I, B, V)) +
    apDist(I, apNearest(I, V, A))) / 3;
  const rOut = (apDist(O, A) + apDist(O, B) + apDist(O, V)) / 3;
  const D = apPlace(B, A, V);
  const E = apPlace(A, B, V);
  const Ap = apMid(B, V), Bp = apMid(A, V);
  const Dp = apNearest(O, I, Ap), Ep = apNearest(O, I, Bp);
  const X = apNearest(I, B, V), Y = apNearest(I, A, V);
  const S = apIntersect(I, O, D, E);
  return { I, O, rIn, rOut, D, E, Ap, Bp, Dp, Ep, X, Y, S };
}

/* --------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  equal("start A is the applet's (W/3, 4H/5)", s.A, { x: 150, y: 360 });
  equal("start B is the applet's (11W/15, 2H/3)", s.B, { x: 330, y: 300 });
  equal("start C is the applet's (W/4, H/4)", s.C, { x: 112, y: 112 });
  const small = C.start({ width: 400, height: 250 });
  equal("start at the applet's suggested 400x250", small, {
    A: { x: 133, y: 200 }, B: { x: 293, y: 166 }, C: { x: 100, y: 62 },
  });
  check("an illustration has no win or loss", C.result(s) === null);
  check("the starting triangle is not degenerate", !C.isDegenerate(s));
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === 150 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown handle leaves the position alone",
    C.withPoint(s, "Z", { x: 1, y: 2 }).C.x === 112);
}

/* ----------------------- 2. the second bytecode transcription vs the core */

const fixed = [
  ["the applet's start", C.start()],
  ["right at C", tri({ x: 60, y: 250 }, { x: 60, y: 40 }, { x: 320, y: 250 })],
  ["equilateral", tri({ x: 200, y: 40 }, { x: 60, y: 280 }, { x: 340, y: 280 })],
  ["obtuse at A", tri({ x: 60, y: 150 }, { x: 320, y: 90 }, { x: 300, y: 240 })],
  ["obtuse at B", tri({ x: 180, y: 40 }, { x: 50, y: 260 }, { x: 360, y: 250 })],
  ["obtuse at C", tri({ x: 40, y: 40 }, { x: 360, y: 60 }, { x: 190, y: 250 })],
  ["c longer than b", tri({ x: 30, y: 90 }, { x: 380, y: 260 }, { x: 120, y: 300 })],
  ["c longer than a", tri({ x: 380, y: 90 }, { x: 30, y: 260 }, { x: 350, y: 300 })],
  ["mirrored", tri({ x: 300, y: 40 }, { x: 340, y: 260 }, { x: 60, y: 260 })],
];

function usable(s) {
  if (C.isDegenerate(s)) return false;
  const m = C.measurements(s);
  return !m.degenerate && m.doubleArea > 400;
}

{
  const rand = rng(5612);
  const triangles = fixed.slice();
  for (let k = 0; k < 300; k++) {
    const s = tri(
      { x: 10 + rand() * 430, y: 10 + rand() * 430 },
      { x: 10 + rand() * 430, y: 10 + rand() * 430 },
      { x: 10 + rand() * 430, y: 10 + rand() * 430 },
    );
    if (usable(s)) triangles.push([`random ${k}`, s]);
  }
  for (const [name, s] of triangles) {
    const m = C.measurements(s);
    const ap = apCompute(s);
    const scale = Math.max(m.sides.a, m.sides.b, m.sides.c);
    const tol = 1e-6 * scale;
    const points = ["I", "O", "D", "E", "Ap", "Bp", "Dp", "Ep", "X", "Y", "S"];
    const wrong = points.filter((key) => !closePoint(m[key], ap[key], tol));
    check(`${name}: Compute's eleven points match the core`, wrong.length === 0, wrong.join(", "));
    check(`${name}: the averaged inradius and circumradius match`,
      close(m.rIn, ap.rIn, tol) && close(m.rOut, ap.rOut, tol));
    check(`${name}: core claims are self-consistent`, C.claims(s).all === true,
      JSON.stringify(C.claims(s)));
  }
  check(`the second transcription ran on ${triangles.length} triangles`, triangles.length > 250);
}

/* -------------------------------- 3. the page's claims on more triangles */

{
  const rand = rng(1996);
  let tested = 0;
  for (let k = 0; k < 400; k++) {
    const s = tri(
      { x: 10 + rand() * 430, y: 10 + rand() * 430 },
      { x: 10 + rand() * 430, y: 10 + rand() * 430 },
      { x: 10 + rand() * 430, y: 10 + rand() * 430 },
    );
    if (!usable(s)) continue;
    tested++;
    const cl = C.claims(s);
    check(`random ${k}: DE is perpendicular to IO`, cl.dePerpendicularIo);
    check(`random ${k}: DE = 2 IO sin(C)`, cl.deEqualsFormula);
    check(`random ${k}: the three constructed lines are parallel`, cl.threeParallel);
    check(`random ${k}: the right-angle mark is at S`, cl.rightMarkAtS);
  }
  check(`claims tested on ${tested} random triangles`, tested > 350);
}

/* ---------------------- 4. equality at 30 degrees (and the 150 degree twin) */

{
  const rand = rng(3021987);
  let tested = 0;
  for (let k = 0; k < 60; k++) {
    const s = tri(
      { x: 20 + rand() * 410, y: 20 + rand() * 410 },
      { x: 20 + rand() * 410, y: 20 + rand() * 410 },
      { x: 20 + rand() * 410, y: 20 + rand() * 410 },
    );
    if (!usable(s)) continue;
    const before = C.measurements(s);
    const s30 = C.withAngleC(s, 30);
    const m30 = C.measurements(s30);
    if (m30.degenerate) continue;
    tested++;
    const scale = Math.max(m30.sides.a, m30.sides.b, m30.sides.c);
    const tol = 1e-7 * scale;
    check(`30 degrees ${k}: the angle really is 30`, close(m30.angleC * 180 / Math.PI, 30, 1e-8));
    check(`30 degrees ${k}: DE = IO`, close(m30.deLength, m30.ioLength, tol));
    check(`30 degrees ${k}: withAngleC kept CA and CB`,
      close(dist(s30.C, s30.A), dist(s.C, s.A), tol) &&
      close(dist(s30.C, s30.B), dist(s.C, s.B), tol));
    check(`30 degrees ${k}: withAngleC kept BC as well`,
      close(dist(s30.B, s30.C), before.sides.a, tol));
    const s150 = C.withAngleC(s, 150);
    const m150 = C.measurements(s150);
    if (!m150.degenerate) {
      check(`150 degrees ${k}: sin(150)=1/2 gives DE = IO too`,
        close(m150.deLength, m150.ioLength, 1e-7 * Math.max(m150.sides.a, m150.sides.b, m150.sides.c)));
    }
  }
  check(`the 30-degree equality held on ${tested} triangles`, tested > 45);
}

/* ------------------------------------------------ 5. degenerate positions */

{
  const collinear = tri({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 });
  const coincident = tri({ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 200, y: 50 });
  check("three points on a line make no triangle", C.isDegenerate(collinear));
  check("coincident corners make no triangle", C.isDegenerate(coincident));
  check("no claims are made for a degenerate position", !C.claims(collinear).all && !C.claims(coincident).all);
  check("the measurement reports degeneracy", C.measurements(collinear).degenerate);
  const thin = tri({ x: 0, y: 0 }, { x: 400, y: 1 }, { x: 200, y: 100 });
  check("a thin but real triangle is still usable", !C.isDegenerate(thin) && C.claims(thin).all,
    JSON.stringify(C.claims(thin)));
}

done("in-and-circumcenter");
