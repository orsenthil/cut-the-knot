#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-center-by-ruler/circle-center-by-ruler-core.js.
 *
 *   node porting/check-circle-center-by-ruler.mjs
 *
 * The page claims that the two circles meeting at M and N give equal chords
 * AA' = CC' and AC = A'C', that the four angles in the hint have the same sine
 * (the applet calls them equal; from opposite arcs they are supplementary),
 * and that P = AC ∩ A'C' and Q = AA' ∩ CC' lie on a diameter of the first
 * circle. The test checks all of these on the start diagram, on fixed diagrams
 * and on thousands of non-degenerate random ones, checks that AC really is
 * independent of where B' sits on the second circle, and checks the tangent
 * branch used when A' falls on A.
 *
 * Section 3 is a second, literal transcription of the applet's own Compute,
 * GetCircle, GeoSDoub.Intersect / IntersectX / IntersectY, Other and Tangent
 * bytecode. It is compared with the core point by point over all configurations
 * that give a diagram at all.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circle-center-by-ruler/circle-center-by-ruler-core.js", "CircleCenterByRulerCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol));
const pos = (M, N, A, Bp, extra) => ({ M: { ...M }, N: { ...N }, A: { ...A }, Bp: { ...Bp }, ...(extra || {}) });
const onCircle = (c, t) => ({ x: c.center.x + c.radius * Math.cos(t), y: c.center.y + c.radius * Math.sin(t) });

/* ------------------------- the applet's own computation, transcribed again */

function aDist(p, q) { return Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2); }

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint) */
function aIntersect(p0, p1, p2, p3) {
  const a1 = p0.y - p1.y, b1 = p1.x - p0.x, c1 = p0.x * p1.y - p0.y * p1.x;
  const a2 = p2.y - p3.y, b2 = p3.x - p2.x, c2 = p2.x * p3.y - p2.y * p3.x;
  const xnum = b1 * c2 - b2 * c1;
  const ynum = c1 * a2 - c2 * a1;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: xnum / det, y: ynum / det };
}

/* GeoSDoub.FindCircumcenter */
function aCircumcenter(p0, p1, p2) {
  const m01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const m12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const q01 = { x: m01.x + (p1.y - p0.y), y: m01.y - (p1.x - p0.x) };
  const q12 = { x: m12.x + (p2.y - p1.y), y: m12.y - (p2.x - p1.x) };
  return aIntersect(m01, q01, m12, q12);
}

/* GetCircle(DoubPoint,DoubPoint,DoubPoint) */
function aCircle3(p0, p1, p2) {
  const center = aCircumcenter(p0, p1, p2);
  const radius = (aDist(center, p0) + aDist(center, p1) + aDist(center, p2)) / 3;
  return { center, radius };
}

/* GeoSDoub.IntersectX / IntersectY, including the order of the two solutions */
function aIntersectX(line, circle) {
  const p = line[0], q = line[1];
  const k = (q.x - p.x) / (q.y - p.y);
  const b = q.x - k * q.y;
  const A = k * k + 1;
  const B = k * (b - circle.center.x) - circle.center.y;
  const Cc = circle.center.y * circle.center.y + (b - circle.center.x) ** 2 - circle.radius ** 2;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y0 = (-B + root) / A, y1 = (-B - root) / A;
  return [{ x: k * y0 + b, y: y0 }, { x: k * y1 + b, y: y1 }];
}
function aIntersectY(line, circle) {
  const p = line[0], q = line[1];
  const k = (q.y - p.y) / (q.x - p.x);
  const b = q.y - k * q.x;
  const A = k * k + 1;
  const B = k * (b - circle.center.y) - circle.center.x;
  const Cc = circle.center.x * circle.center.x + (b - circle.center.y) ** 2 - circle.radius ** 2;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x0 = (-B + root) / A, x1 = (-B - root) / A;
  return [{ x: x0, y: k * x0 + b }, { x: x1, y: k * x1 + b }];
}
function aIntersectLineCircle(line, circle) {
  if (Math.abs(line[0].y - line[1].y) > 1) return aIntersectX(line, circle);
  if (Math.abs(line[0].x - line[1].x) > 1) return aIntersectY(line, circle);
  return null;
}
function aOther(points, known) {
  if (!points) return null;
  return aDist(points[0], known) >= 1 ? points[0] : points[1];
}
function aTangent(circle, p) {
  if (Math.abs(aDist(circle.center, p) - circle.radius) > 1) return null;
  return { x: p.x + circle.center.y - p.y, y: p.y - (circle.center.x - p.x) };
}
function aFinite(p) { return p && Number.isFinite(p.x) && Number.isFinite(p.y); }

/* CircleCenterByRulerCanvas.Compute (bounds clipping omitted: drawing only). */
function aCompute(s) {
  const { M, N, A, Bp } = s;
  if (aDist(M, N) < 2) return null;
  const circleA = aCircle3(A, M, N), circleB = aCircle3(Bp, M, N);
  const B = aOther(aIntersectLineCircle([A, M], circleB), M);
  const C = aOther(aIntersectLineCircle([B, N], circleA), N);
  const Ap = aOther(aIntersectLineCircle([Bp, M], circleA), M);
  const Cp = aOther(aIntersectLineCircle([Bp, N], circleA), N);
  if (![B, C, Ap, Cp].every(aFinite)) return null;
  const tangentBranch = aDist(A, Ap) < 1;
  const dirA = tangentBranch ? aTangent(circleA, A) : Ap;
  const dirC = tangentBranch ? aTangent(circleA, C) : Cp;
  if (!aFinite(dirA) || !aFinite(dirC)) return null;
  const P = aIntersect(A, C, Ap, Cp);
  const Q = aIntersect(A, dirA, C, dirC);
  if (!aFinite(P) || !aFinite(Q)) return null;
  return { circleA, circleB, B, C, Ap, Cp, P, Q, tangentBranch };
}

/* ------------------------------------------------------- 1. the start state */

{
  const s = C.start();
  equal("start M matches applet init for a 400x250 canvas", s.M, { x: 200, y: 115 });
  equal("start N matches applet init", s.N, { x: 220, y: 135 });
  equal("start A matches applet init", s.A, { x: 120, y: 120 });
  equal("start Bp matches applet init", s.Bp, { x: 350, y: 125 });
  check("names are on by default, statement and hint off",
    s.showNames === true && s.showStatement === false && s.showHint === false);
  check("an illustration has no win, loss or end", C.result(s) === null);
  check("the starting diagram is computable", C.compute(s).valid);
  check("withPoint leaves the old position alone", (() => {
    const next = C.withPoint(s, "A", { x: 10, y: 20 });
    return s.A.x === 120 && next.A.x === 10 && next.M.x === s.M.x;
  })());
  check("an unknown handle name changes nothing", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
  check("an unknown option changes nothing", C.withOption(s, "speed", true) === s);
  check("a custom canvas size follows the applet's init formula", (() => {
    const q = C.start({ width: 600, height: 400 });
    return q.M.x === 300 && q.M.y === 184 && q.Bp.x === 525 && q.N.x === 330;
  })());
  check("a too-close pair M,N has no diagram", !C.compute(pos({ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 90, y: 90 }, { x: 200, y: 90 })).valid);
}

/* ---------------------------------------- 2. the start and fixed diagrams */

const startState = C.start();
const tangentCase = pos(
  { x: 270.50732235160615, y: 122.73572502205432 },
  { x: 294.6447755027335, y: 189.15670201092018 },
  { x: 245.48448353678765, y: 131.81442054100734 },
  { x: 92.14074767600117, y: 184.8724477645323 },
);
const fixed = [
  ["start", startState],
  ["wide circles", pos({ x: 130, y: 80 }, { x: 270, y: 180 }, { x: 40, y: 210 }, { x: 370, y: 40 })],
  ["mirror image", pos({ x: 200, y: 160 }, { x: 220, y: 90 }, { x: 340, y: 200 }, { x: 60, y: 80 })],
  ["near horizontal chord", pos({ x: 160, y: 125 }, { x: 250, y: 127 }, { x: 90, y: 60 }, { x: 330, y: 210 })],
  ["tangent branch", tangentCase],
];

for (const [name, s] of fixed) {
  const g = C.compute(s);
  const cl = C.claims(s);
  check(`${name}: the diagram computes`, g.valid);
  check(`${name}: AA' and CC' are equal`, cl.equalShortChords,
    `${g.valid ? dist(g.points.A, g.points.Ap) : "-"} vs ${g.valid ? dist(g.points.C, g.points.Cp) : "-"}`);
  check(`${name}: AC and A'C' are equal`, cl.equalLongChords);
  check(`${name}: P, Q and O lie on one line`, cl.diameterThroughPQ);
  check(`${name}: the four hint angles have one sine`, cl.equalAngleSines);
  check(`${name}: every claim passes together`, cl.all);
}
check("the tangent branch really is exercised (A' coincides with A)", C.compute(tangentCase).coincident);
check("the tangent branch still gives a finite Q", Number.isFinite(C.compute(tangentCase).points.Q.x));
check("in the tangent branch Q lies on the diameter perpendicular to chord AC",
  C.measurements(tangentCase).tangentDiameterOffset < 1e-6);

/* ------------------------ 3. core vs the applet's own bytecode transcription */

{
  const rand = rng(20261126);
  let compared = 0, usable = 0, mismatches = 0, details = "";
  for (const [, s] of fixed) {
    const a = aCompute(s), b = C.compute(s);
    compared++;
    if (!a || !b.valid) continue;
    usable++;
    const tol = 1e-7 * Math.max(1, aDist(s.A, a.C));
    for (const key of ["B", "C", "Ap", "Cp", "P", "Q"]) {
      if (!closePoint(a[key], b.points[key], tol)) {
        mismatches++;
        details = `${key}: applet ${JSON.stringify(a[key])}, core ${JSON.stringify(b.points[key])}`;
      }
    }
    for (const key of ["A", "B"]) {
      if (!closePoint(a[`circle${key}`].center, b.circles[key].center, tol) ||
          !close(a[`circle${key}`].radius, b.circles[key].radius, tol)) {
        mismatches++;
        details = `circle ${key}`;
      }
    }
  }
  for (let trial = 0; trial < 600; trial++) {
    const s = pos(
      { x: 60 + rand() * 280, y: 30 + rand() * 190 },
      { x: 60 + rand() * 280, y: 30 + rand() * 190 },
      { x: 10 + rand() * 380, y: 10 + rand() * 230 },
      { x: 10 + rand() * 380, y: 10 + rand() * 230 },
    );
    const a = aCompute(s), b = C.compute(s);
    compared++;
    if (!a || !b.valid) continue;
    usable++;
    const tol = 1e-7 * Math.max(1, aDist(s.A, a.C));
    for (const key of ["B", "C", "Ap", "Cp", "P", "Q"]) {
      if (!closePoint(a[key], b.points[key], tol)) {
        mismatches++;
        if (!details) details = `trial ${trial} ${key}: applet ${JSON.stringify(a[key])}, core ${JSON.stringify(b.points[key])}`;
      }
    }
    for (const key of ["A", "B"]) {
      if (!closePoint(a[`circle${key}`].center, b.circles[key].center, tol) ||
          !close(a[`circle${key}`].radius, b.circles[key].radius, tol)) {
        mismatches++;
        if (!details) details = `trial ${trial} circle ${key}`;
      }
    }
    check(`trial ${trial}: tangent branch agrees`, a.tangentBranch === b.coincident);
  }
  check(`all ${compared} configurations agree between the core and the applet (${usable} computable)`,
    mismatches === 0 && usable > 300, details);
}

/* ------------------------ 4. every claim over many random configurations */

{
  const rand = rng(3152);
  let tested = 0, skipped = 0, failures = 0, detail = "";
  for (let trial = 0; trial < 4000; trial++) {
    const s = pos(
      { x: 70 + rand() * 260, y: 30 + rand() * 190 },
      { x: 70 + rand() * 260, y: 30 + rand() * 190 },
      { x: 15 + rand() * 370, y: 15 + rand() * 220 },
      { x: 15 + rand() * 370, y: 15 + rand() * 220 },
    );
    if (dist(s.M, s.N) < 12) { skipped++; continue; }
    const g = C.compute(s);
    if (!g.valid) { skipped++; continue; }
    const p = g.points;
    /* Java's one-pixel Other() cannot separate coincident crossings. */
    if (dist(p.A, p.Ap) < 3 || dist(p.C, p.Cp) < 3 ||
        dist(p.B, s.M) < 3 || dist(p.C, s.N) < 3 ||
        dist(p.Ap, s.M) < 3 || dist(p.Cp, s.N) < 3 ||
        dist(p.B, s.Bp) < 3 || dist(p.P, p.O) < 3 || dist(p.Q, p.O) < 3) {
      skipped++;
      continue;
    }
    tested++;
    const cl = C.claims(s);
    if (!cl.all) {
      failures++;
      if (!detail) detail = `trial ${trial}: ${JSON.stringify(cl)}`;
    }
  }
  check(`all four claims hold on ${tested} non-degenerate random diagrams`,
    failures === 0 && tested > 1500, detail);
  check(`degenerate diagrams were skipped, not silently counted (${skipped})`, skipped > 0);
}

/* ------------- 5. AC does not depend on where B' sits on its own circle */

{
  const M = { x: 200, y: 115 }, N = { x: 210, y: 135 }, A = { x: 120, y: 120 };
  const circleB = C.circle3({ x: 350, y: 125 }, M, N);
  const circleA = C.circle3(A, M, N);
  const lengths = [];
  for (let i = 0; i < 24; i++) {
    const Bp = onCircle(circleB, (i * Math.PI) / 12);
    const g = C.compute(pos(M, N, A, Bp));
    if (g.valid && dist(A, g.points.Ap) > 2 && dist(g.points.C, g.points.Cp) > 2) {
      lengths.push(dist(A, g.points.C));
    }
  }
  const spread = Math.max(...lengths) - Math.min(...lengths);
  check(`AC is unchanged as B' travels around the second circle (${lengths.length} positions)`,
    lengths.length >= 20 && spread < 1e-5, `spread ${spread}`);

  const alongA = [];
  for (let i = 0; i < 24; i++) {
    const a = onCircle(circleA, (i * Math.PI) / 12);
    const g = C.compute(pos(M, N, a, { x: 350, y: 125 }));
    if (g.valid && dist(a, g.points.Ap) > 2 && dist(g.points.C, g.points.Cp) > 2) {
      alongA.push(dist(a, g.points.C));
    }
  }
  check(`AC is also unchanged as A travels around the first circle (${alongA.length} positions)`,
    alongA.length >= 20 && Math.max(...alongA) - Math.min(...alongA) < 1e-5);
  check("the two traversals give the same length",
    Math.abs(lengths[0] - alongA[0]) < 1e-5);

  /* A different second circle does give a different chord: the test is not vacuous. */
  const otherCircle = C.circle3({ x: 310, y: 30 }, M, N);
  const g2 = C.compute(pos(M, N, A, { x: 310, y: 30 }));
  check("a different second circle gives a different AC", g2.valid && Math.abs(dist(A, g2.points.C) - lengths[0]) > 1);
  check("the second circle through B' is the one used for B", g2.valid && dist(g2.points.B, g2.circles.B.center) > 0);
}

done("circle-center-by-ruler");
