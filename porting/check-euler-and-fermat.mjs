#!/usr/bin/env node
"use strict";

/*
 * Logic test for euler-and-fermat/euler-and-fermat-core.js.
 *
 *   node porting/check-euler-and-fermat.mjs
 *
 * Checked: the applet's init() triangle and option defaults; a second, literal
 * transcription of EulerAndFermatCanvas.Compute (GeoSDoub.Rotate, Intersect,
 * FindCircumcenter and CTKGeometryPlus.Barycenter/Midpoint/Prorate) over the
 * fixed configuration and hundreds of random ones, comparing every one of its
 * 21 derived points; and the page's claims on every usable configuration:
 * all ten Euler lines pass through G, both Napoleon triangles are equilateral
 * around G, the 120-degree rotation takes O to P, O/G/a'/P/B' are concyclic,
 * the four chained angle equalities hold as directed angles, and the two
 * parallel pairs really are parallel. Degenerate positions are reported.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("euler-and-fermat/euler-and-fermat-core.js", "EulerAndFermatCore");

const P = (x, y) => ({ x: x, y: y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closeP = (p, q, tol) => finite(p) && finite(q) && dist(p, q) <= tol;
const scaleOf = (s) => Math.max(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A));
const triangle = (A, B, Cc) => ({
  A: { ...A }, B: { ...B }, C: { ...Cc }, showNames: false, showAngles: false,
});

/* ------------------------------------------------------------------------- *
 * The applet's own computation, transcribed a second time from the bytecode. *
 * ------------------------------------------------------------------------- */

/* GeoSDoub.Rotate(P,Q,theta,s): x = P.x + cos*dx - s*sin*dy, etc. */
function aRotate(p, q, theta, s) {
  const cs = Math.cos(theta), sn = Math.sin(theta);
  return P(p.x + cs * (q.x - p.x) - s * sn * (q.y - p.y),
    p.y + s * sn * (q.x - p.x) + cs * (q.y - p.y));
}

/* GeoSDoub.Intersect(P1,P2,P3,P4), including its |det| < 1 guard. */
function aIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* CTKGeometryPlus.Midpoint / Barycenter, in that order. */
const aMid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const aBarycenter = (p, q, r) => P((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);

/* GeoSDoub.FindCircumcenter: perpendicular bisectors of AB and BC. */
function aCircumcenter(p, q, r) {
  const m1 = aMid(p, q), m2 = aMid(q, r);
  return aIntersect(m1, P(m1.x + (q.y - p.y), m1.y - (q.x - p.x)),
    m2, P(m2.x + (r.y - q.y), m2.y - (r.x - q.x)));
}

/* CTKGeometryPlus.Prorate(P,Q,t): t is a length, not a fraction. */
function aProrate(p, q, t) {
  const d = Math.hypot(p.x - q.x, p.y - q.y);
  if (d < 0.1) return P(p.x, p.y);
  const k = t / d;
  return P(p.x + k * (q.x - p.x), p.y + k * (q.y - p.y));
}

/* EulerAndFermatCanvas.Compute, field by field in bytecode order. */
function aCompute(s) {
  const theta = 1.0471975511965976;
  const Ap = aRotate(s.B, s.C, theta, 1);
  const Bp = aRotate(s.C, s.A, theta, 1);
  const Cp = aRotate(s.A, s.B, theta, 1);
  const Aq = aBarycenter(Ap, s.B, s.C);
  const Bq = aBarycenter(s.A, Bp, s.C);
  const Cq = aBarycenter(s.A, s.B, Cp);
  const ap = aRotate(s.B, s.C, theta, -1);
  const bp = aRotate(s.C, s.A, theta, -1);
  const cp = aRotate(s.A, s.B, theta, -1);
  const aq = aBarycenter(ap, s.B, s.C);
  const bq = aBarycenter(s.A, bp, s.C);
  const cq = aBarycenter(s.A, s.B, cp);
  const Cm = aMid(s.A, s.B);
  const F1 = aBarycenter(
    aIntersect(s.A, Ap, s.B, Bp), aIntersect(s.B, Bp, s.C, Cp), aIntersect(s.C, Cp, s.A, Ap));
  const F2 = aBarycenter(
    aIntersect(s.A, ap, s.B, bp), aIntersect(s.B, bp, s.C, cp), aIntersect(s.C, cp, s.A, ap));
  const Fm = aMid(F1, F2);
  const G = aBarycenter(s.A, s.B, s.C);
  const Gf = aBarycenter(s.C, F1, F2);
  const O = aCircumcenter(s.C, F1, F2);
  const Pt = aIntersect(Bq, Cq, aq, cq);
  const Fp = aProrate(F1, Cm, 2 * Math.hypot(F1.x - Cm.x, F1.y - Cm.y));
  return { Ap, Bp, Cp, Aq, Bq, Cq, ap, bp, cp, aq, bq, cq, Cm,
    F1, F2, Fm, G, Gf, O, P: Pt, Fp };
}

/* The same fields in the port's naming. */
const portName = {
  Ap: "Ap", Bp: "Bp", Cp: "Cp", Aq: "Aq", Bq: "Bq", Cq: "Cq",
  ap: "ap", bp: "bp", cp: "cp", aq: "aq", bq: "bq", cq: "cq", Cm: "Cm",
  F1: "F", F2: "f", Fm: "fm", G: "G", Gf: "Gp", O: "O", P: "P", Fp: "Fp",
};

/* ------------------------------------------------------- 1. the constants */

{
  const s = C.start();
  equal("start A matches init() at 480x360", s.A, P(160, 300));
  equal("start B matches init() at 480x360", s.B, P(320, 300));
  equal("start C matches init() at 480x360", s.C, P(172, 60));
  check("both show boxes start unchecked", !s.showNames && !s.showAngles);
  check("an illustration has no win, loss or end", C.result(s) === null);
  const big = C.start({ width: 640, height: 460 });
  equal("start scales with the canvas", [big.A, big.B, big.C],
    [P(213, 383), P(426, 383), P(229, 76)]);
  check("turn is the applet's 60 degrees", close(C.TURN, 1.0471975511965976, 1e-15));
  check("withPoint moves one corner and keeps the options", (() => {
    const next = C.withPoint(s, "B", P(12, 34));
    return next.B.x === 12 && next.B.y === 34 && s.B.x === 320 &&
      next.A.x === 160 && !next.showNames && !next.showAngles;
  })());
  check("withOptions toggles one checkbox and keeps the triangle", (() => {
    const next = C.withOptions(s, { showAngles: true });
    return next.showAngles && !next.showNames && next.C.x === 172 && !s.showAngles;
  })());
  check("parallel lines have no intersection", !finite(C.intersect(P(0, 0), P(10, 0), P(0, 5), P(10, 5))));
  check("prorate uses a length from the first point", (() => {
    const q = C.prorate(P(0, 0), P(10, 0), 15);
    return closeP(q, P(15, 0), 1e-12);
  })());
  check("rotate moves a point around its centre", (() => {
    const q = C.rotate(P(0, 0), P(10, 0), Math.PI / 2, 1);
    return closeP(q, P(0, 10), 1e-12);
  })());
  check("circumcenter of a right triangle is its hypotenuse midpoint", (() => {
    const o = C.circumcenter(P(0, 0), P(20, 0), P(0, 20));
    return closeP(o, P(10, 10), 1e-9);
  })());
  check("a collinear triangle is reported unusable", (() => {
    const flat = triangle(P(10, 10), P(100, 10), P(200, 10));
    return !C.claims(flat).usable && C.measure(flat).P !== undefined;
  })());
}

/* --------------------------- 2. the core against the applet's own method */

const fixed = [
  ["the applet's start", triangle(P(160, 300), P(320, 300), P(172, 60))],
  ["nearly equilateral", triangle(P(160, 300), P(320, 300), P(240, 161))],
  ["right angled", triangle(P(80, 300), P(80, 80), P(340, 300))],
  ["obtuse at A", triangle(P(100, 180), P(360, 100), P(320, 260))],
  ["obtuse at B", triangle(P(180, 60), P(60, 300), P(400, 280))],
  ["wide and flat", triangle(P(40, 160), P(420, 170), P(230, 190))],
  ["an angle over 120 degrees", triangle(P(240, 60), P(160, 300), P(330, 300))],
];

{
  let compared = 0, worst = 0;
  const compare = (label, s) => {
    const a = aCompute(s), m = C.measure(s);
    const tol = 1e-6 * Math.max(1, scaleOf(s));
    for (const [javaKey, coreKey] of Object.entries(portName)) {
      const bothNaN = !finite(a[javaKey]) && !finite(m[coreKey]);
      if (!bothNaN && !closeP(a[javaKey], m[coreKey], tol)) {
        check(`${label}: ${coreKey} matches the applet's ${javaKey}`, false,
          `applet ${JSON.stringify(a[javaKey])}, core ${JSON.stringify(m[coreKey])}`);
      } else {
        compared++;
        if (finite(a[javaKey])) worst = Math.max(worst, dist(a[javaKey], m[coreKey]));
      }
    }
  };
  for (const [name, s] of fixed) compare(name, s);
  const rand = rng(4311);
  let randomCases = 0;
  for (let trial = 0; trial < 450; trial++) {
    const s = triangle(
      P(10 + rand() * 460, 10 + rand() * 340),
      P(10 + rand() * 460, 10 + rand() * 340),
      P(10 + rand() * 460, 10 + rand() * 340),
    );
    if (scaleOf(s) < 60) continue;
    randomCases++;
    compare(`random ${trial}`, s);
  }
  check(`compared ${compared} derived points with the applet`, compared >= 9000);
  check(`the largest disagreement is tiny (${worst.toExponential(2)} px)`, worst < 1e-7);
  check("random configurations really were used", randomCases > 350);
}

/* ------------------------------- 3. the page's claims on all configurations */

{
  const claimKeys = ["usable", "tenConcurrent", "eulerC", "eulerA", "eulerB",
    "napoleonOuter", "napoleonInner", "rotateOP", "angleOGP", "concyclic",
    "angle1", "angle2", "angle3", "angle4", "fPrimeParallel", "gPrimeParallel"];
  const all = fixed.slice();
  const rand = rng(9071);
  for (let i = 0; i < 320; i++) {
    all.push([`random ${i}`, triangle(
      P(10 + rand() * 460, 10 + rand() * 340),
      P(10 + rand() * 460, 10 + rand() * 340),
      P(10 + rand() * 460, 10 + rand() * 340),
    )]);
  }
  let usable = 0, tenLines = 0, failed = 0;
  for (const [name, s] of all) {
    const cl = C.claims(s);
    if (!cl.usable) continue; // parallel Fermat cevians: the applet draws NaN too
    usable++;
    tenLines += cl.tenCount;
    for (const key of claimKeys) {
      if (!cl[key]) {
        failed++;
        check(`${name}: ${key}`, false, JSON.stringify(cl));
      }
    }
  }
  check(`${usable} usable configurations were checked`, usable >= 300);
  check(`all ${tenLines} Euler lines (ten per triangle) pass through G`, tenLines === usable * 10);
  check("every page claim held in every usable configuration", failed === 0);
}

/* --------------------------------------------- 4. page-claim spot checks */

{
  const s = fixed[0][1], m = C.measure(s), cl = C.claims(s);
  check("the ten triples are exactly the 3-choices from five points", cl.tenCount === 10);
  check("G is the mean of A, B and C", (() => {
    const g = C.barycenter(m.A, m.B, m.C);
    return closeP(g, m.G, 1e-12);
  })());
  check("G' is the centroid of C, F and f", (() => {
    const g = C.barycenter(m.C, m.F, m.f);
    return closeP(g, m.Gp, 1e-12);
  })());
  check("the angle OGP is exactly 120 degrees in the start position",
    close(C.angle(m.O, m.G, m.P) * 180 / Math.PI, 120, 1e-9));
  check("F' is the applet's reflection of F in M", (() => {
    const twice = P(2 * m.Cm.x - m.F.x, 2 * m.Cm.y - m.F.y);
    return closeP(twice, m.Fp, 1e-9);
  })());
  check("the page's 'reflection of f in M' is a slip, not what the applet draws", (() => {
    const ofF = P(2 * m.Cm.x - m.F.x, 2 * m.Cm.y - m.F.y);
    const off = P(2 * m.Cm.x - m.f.x, 2 * m.Cm.y - m.f.y);
    return closeP(ofF, m.Fp, 1e-9) && dist(off, m.Fp) > 10;
  })());
  check("m is the midpoint of Ff", closeP(m.fm, C.midpoint(m.F, m.f), 1e-12));
  check("showNames/showAngles do not change the geometry", (() => {
    const other = C.measure(C.withOptions(s, { showNames: true, showAngles: true }));
    return closeP(other.F, m.F, 0) && closeP(other.O, m.O, 0);
  })());
}

done("euler-and-fermat");
