#!/usr/bin/env node
"use strict";

/*
 * Logic test for circumcenter-on-angle-bisector/circumcenter-on-angle-bisector-core.js.
 *
 *   node porting/check-circumcenter-on-angle-bisector.mjs
 *
 * Checked: the starting triangle against the applet's init(); ten fixed
 * triangles (equilateral, right, obtuse at each vertex, very flat, mirrored)
 * and 500 random non-degenerate triangles. Every claim on the applet's page is
 * tested: I is the intersection of the internal bisectors, O lies on AI, E is
 * the A-excenter on AI, the external bisectors are perpendicular to the internal
 * ones, IE is a diameter and O its midpoint, BIC is cyclic, and O also lies on
 * the circumcircle of ABC. Section 4 is a second, literal transcription of the
 * applet's bytecode (FindAngleBisector / FindCircumcenter / Compute) and compares
 * all its points and the averaged radius with the core on the same triangles.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "circumcenter-on-angle-bisector/circumcenter-on-angle-bisector-core.js",
  "CircumcenterOnAngleBisectorCore",
);

const tri = (A, B, D) => ({ A: { ...A }, B: { ...B }, C: { ...D } });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const collinear = (p, q, r, tol) => Math.abs(cross(q, r, p)) <= tol;

/* ------------------ the applet's computation, transcribed a second time ---- */
/* Straight from javap of GeoSDoub and CircumcenterOnAngleBisectorCanvas.      */

function apSq(p, q) {
  const dx = p.x - q.x, dy = p.y - q.y;
  return dx * dx + dy * dy;
}
function apAngle(p, q, r) {
  const numerator = apSq(p, q) + apSq(p, r) - apSq(q, r);
  return Math.acos(numerator / (2 * Math.sqrt(apSq(p, q)) * Math.sqrt(apSq(p, r))));
}
function apOrientation(p, q, r) {
  const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return s > 0 ? 1 : -1;
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
function apBisectorFoot(p, q, r) {
  const half = apAngle(p, q, r) / 2;
  const ray = apRotate(p, q, half, apOrientation(p, q, r));
  return apIntersect(p, ray, q, r);
}
function apPerpThrough(p, q) {
  return { x: p.x + q.y - p.y, y: p.y - q.x + p.x };
}
function apCircumcenter(p, q, r) {
  const m1 = mid(p, q), m2 = mid(q, r);
  const off1 = { x: m1.x + (q.y - p.y), y: m1.y - (q.x - p.x) };
  const off2 = { x: m2.x + (r.y - q.y), y: m2.y - (r.x - q.x) };
  return apIntersect(m1, off1, m2, off2);
}
function appletCompute(s) {
  const Bf = apBisectorFoot(s.B, s.A, s.C);
  const Cf = apBisectorFoot(s.C, s.A, s.B);
  const Af = apBisectorFoot(s.A, s.B, s.C);
  const Be = apPerpThrough(s.B, Bf);
  const Ce = apPerpThrough(s.C, Cf);
  const I = apIntersect(s.B, Bf, s.C, Cf);
  const O = apCircumcenter(I, s.B, s.C);
  const radius = (dist(O, I) + dist(O, s.B) + dist(O, s.C)) / 3;
  return {
    I, O, radius, Bf, Cf, Af,
    K: mid(I, s.B), L: mid(I, s.C),
    E: apIntersect(s.B, Be, s.C, Ce),
  };
}

/* An independent, textbook computation of the same points (no rotations). */
function geometry(s) {
  const a = dist(s.B, s.C), b = dist(s.C, s.A), c = dist(s.A, s.B);
  const perimeter = a + b + c;
  const incenter = {
    x: (a * s.A.x + b * s.B.x + c * s.C.x) / perimeter,
    y: (a * s.A.y + b * s.B.y + c * s.C.y) / perimeter,
  };
  const excenter = {
    x: (-a * s.A.x + b * s.B.x + c * s.C.x) / (-a + b + c),
    y: (-a * s.A.y + b * s.B.y + c * s.C.y) / (-a + b + c),
  };
  /* Circumcenter as the solution of 2(q-p)·X = |q|²-|p|², by Cramer's rule. */
  function cc(p, q, r) {
    const d1 = 2 * (q.x - p.x), e1 = 2 * (q.y - p.y);
    const f1 = apSq(q, { x: 0, y: 0 }) - apSq(p, { x: 0, y: 0 });
    const d2 = 2 * (r.x - q.x), e2 = 2 * (r.y - q.y);
    const f2 = apSq(r, { x: 0, y: 0 }) - apSq(q, { x: 0, y: 0 });
    const det = d1 * e2 - d2 * e1;
    return { x: (f1 * e2 - f2 * e1) / det, y: (d1 * f2 - d2 * f1) / det };
  }
  const circumcenter = cc(s.A, s.B, s.C);
  return { incenter, excenter, circumcenter, circumradius: dist(circumcenter, s.A), perimeter };
}

/* --------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  equal("start A is the applet's (9W/20, H/4)", s.A, { x: 180, y: 75 });
  equal("start B is the applet's (W/3, 3H/5)", s.B, { x: 400 / 3, y: 180 });
  equal("start C is the applet's (2W/3, 3H/5)", s.C, { x: 800 / 3, y: 180 });
  check("an illustration has no win or loss", C.result(s) === null);
  check("the starting triangle is not degenerate", !C.isDegenerate(s));
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === 180 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown handle leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === 180);
}

/* --------------------------------- 2. the page's claims on fixed triangles */

const fixed = [
  ["the applet's start", C.start()],
  ["equilateral", tri({ x: 200, y: 40 }, { x: 60, y: 280 }, { x: 340, y: 280 })],
  ["right", tri({ x: 60, y: 250 }, { x: 60, y: 40 }, { x: 320, y: 250 })],
  ["obtuse at A", tri({ x: 60, y: 150 }, { x: 320, y: 90 }, { x: 300, y: 240 })],
  ["obtuse at B", tri({ x: 180, y: 40 }, { x: 50, y: 260 }, { x: 360, y: 250 })],
  ["obtuse at C", tri({ x: 40, y: 40 }, { x: 360, y: 60 }, { x: 190, y: 250 })],
  ["very flat", tri({ x: 40, y: 150 }, { x: 360, y: 160 }, { x: 200, y: 175 })],
  ["wider than tall", tri({ x: 20, y: 20 }, { x: 380, y: 90 }, { x: 70, y: 280 })],
  ["mirrored", tri({ x: 300, y: 40 }, { x: 340, y: 260 }, { x: 60, y: 260 })],
  ["rotated", tri({ x: 100, y: 250 }, { x: 250, y: 30 }, { x: 330, y: 260 })],
];

for (const [name, s] of fixed) {
  const all = C.claims(s);
  check(`${name}: all ten page claims hold`, all.all, JSON.stringify(all));
}

/* ----------------------- 3. every claim over hundreds of random triangles */

{
  const rand = rng(3402);
  const allClaims = Object.keys(C.claims(fixed[0][1])).filter((k) => k !== "all");
  let tested = 0;
  for (let trial = 0; trial < 500; trial++) {
    const s = tri(
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
    );
    if (C.isDegenerate(s) || C.measurements(s).doubleArea < 500) continue;
    tested++;
    const claims = C.claims(s);
    for (const key of allClaims) {
      check(`random ${trial} (${key})`, claims[key], JSON.stringify(claims));
    }
  }
  check(`all claims held on ${tested} random triangles`, tested > 450);
}

/* --------------- 4. the second bytecode transcription vs the core's result */

{
  const rand = rng(771);
  const triangles = fixed.map(([name, s]) => [name, s]);
  for (let trial = 0; trial < 300; trial++) {
    const s = tri(
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
    );
    if (C.isDegenerate(s) || C.measurements(s).doubleArea < 500) continue;
    triangles.push([`random ${trial}`, s]);
  }
  for (const [name, s] of triangles) {
    const m = C.measurements(s);
    const ap = appletCompute(s);
    const scale = Math.max(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A));
    const tol = 1e-6 * scale;
    check(`${name}: A-bisector foot matches FindAngleBisector`, closePoint(m.feet.A, ap.Af, tol));
    check(`${name}: B-bisector foot matches FindAngleBisector`, closePoint(m.feet.B, ap.Bf, tol));
    check(`${name}: C-bisector foot matches FindAngleBisector`, closePoint(m.feet.C, ap.Cf, tol));
    check(`${name}: I matches Bi ∩ Ci`, closePoint(m.I, ap.I, tol));
    check(`${name}: O matches GetCircle's FindCircumcenter`, closePoint(m.O, ap.O, tol));
    check(`${name}: radius matches the applet's average`, close(m.r, ap.radius, 1e-7 * scale),
      `core ${m.r}, applet ${ap.radius}`);
    check(`${name}: K matches Midpoint(I,B)`, closePoint(m.K, ap.K, tol));
    check(`${name}: L matches Midpoint(I,C)`, closePoint(m.L, ap.L, tol));
    check(`${name}: E matches Be ∩ Ce`, closePoint(m.E, ap.E, tol));
  }
}

/* --------------------- 5. independent geometry agrees with the construction */

{
  const rand = rng(99003);
  let tested = 0;
  for (let trial = 0; trial < 200; trial++) {
    const s = tri(
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
    );
    if (C.isDegenerate(s) || C.measurements(s).doubleArea < 1000) continue;
    tested++;
    const m = C.measurements(s);
    const g = geometry(s);
    const scale = Math.max(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A));
    const tol = 1e-6 * scale;
    check(`independent I on triangle ${trial}`, closePoint(m.I, g.incenter, tol));
    check(`independent E on triangle ${trial}`, closePoint(m.E, g.excenter, tol));

    /* The page's theorem, computed without using the core's claims at all. */
    const circumABC = g.circumcenter;
    const radiusABC = g.circumradius;
    const I = g.incenter;
    const O = m.O;
    const E = g.excenter;
    check(`O lies on AI, triangle ${trial}`, collinear(O, s.A, I, tol));
    check(`E lies on AI, triangle ${trial}`, collinear(E, s.A, I, tol));
    check(`O is the midpoint of IE, triangle ${trial}`, closePoint(mid(I, E), O, tol));
    check(`IO = IB = IC, triangle ${trial}`, close(dist(O, I), dist(O, s.B), tol) &&
      close(dist(O, I), dist(O, s.C), tol));
    check(`O lies on the circumcircle of ABC, triangle ${trial}`,
      close(dist(O, circumABC), radiusABC, tol));
  }
  check(`independent geometry checked on ${tested} triangles`, tested > 170);
}

done("circumcenter-on-angle-bisector");
