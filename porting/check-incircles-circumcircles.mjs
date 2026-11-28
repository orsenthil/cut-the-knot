#!/usr/bin/env node
"use strict";

/*
 * Logic test for incircles-circumcircles/incircles-circumcircles-core.js.
 *
 *   node porting/check-incircles-circumcircles.mjs
 *
 * 1. The start triangle and the object API.
 * 2. A second, literal transcription of the applet's own GeoSDoub methods
 *    (ComputeAngle, FindOrientation, Rotate, Intersect, FindIncenter,
 *    FindCircumcenter, NearestPoint, Dist) plus DrawAddOns' circle radii,
 *    compared with the core over ~1200 triangles on a deterministic grid and
 *    a seeded random sweep, acute, right, obtuse and very flat.
 * 3. Every claim made by the cut-the-knot page, checked at every one of those
 *    configurations: the three circumcenters lie on the circumcircle; each is
 *    the second crossing of its angle bisector; D_A is on AI and DB = DC = DI;
 *    the angle equations MaDMc = IBC = B/2 and MaDMb = ICB = C/2;
 *    angle BDC = B + C; the applet's average radii are true radii; and the
 *    1988 Olympiad's concentric variant (asserted after measuring it).
 * 4. Degenerate and immutability edge cases.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("incircles-circumcircles/incircles-circumcircles-core.js", "IncirclesCircumcirclesCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p) && Boolean(q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });

/* ------------------------ the applet's own methods, transcribed a second time */

/* GeoSDoub.ComputeAngle(P,Q,R), using Math.acos of the law of cosines. */
function appletAngle(P, Q, R) {
  const numerator = sq(P, Q) + sq(P, R) - sq(Q, R);
  return Math.acos(numerator / (2 * dist(P, Q) * dist(P, R)));
}

/* GeoSDoub.FindOrientation: +1 when the signed area is positive. */
function appletOrientation(A, B, Cc) {
  const s = Cc.x * (A.y - B.y) + Cc.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate: rotate Q about P through angle * handedness. */
function appletRotate(P, Q, angle, handedness) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - handedness * sn * (Q.y - P.y),
    y: P.y + handedness * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

/* GeoSDoub.Intersect: solve two lines in ax + by = c form; det < 1 is NaN. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.FindIncenter: two half-angle rays, intersected. */
function appletIncenter(A, B, Cc) {
  const halfA = appletAngle(A, B, Cc) / 2;
  const halfB = appletAngle(B, Cc, A) / 2;
  const side = appletOrientation(A, B, Cc);
  return appletIntersect(A, appletRotate(A, B, halfA, side),
    B, appletRotate(B, Cc, halfB, side));
}

/* GeoSDoub.FindCircumcenter: the two perpendicular bisectors. */
function appletCircumcenter(P, Q, R) {
  const m1 = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  const m2 = { x: (Q.x + R.x) / 2, y: (Q.y + R.y) / 2 };
  const o1 = { x: m1.x + (Q.y - P.y), y: m1.y - (Q.x - P.x) };
  const o2 = { x: m2.x + (R.y - Q.y), y: m2.y - (R.x - Q.x) };
  return appletIntersect(m1, o1, m2, o2);
}

/* GeoSDoub.NearestPoint(P, X, Y): projection onto the infinite line XY. */
function appletNearest(P, X, Y) {
  const dx = Y.x - X.x, dy = Y.y - X.y;
  if (sq(X, P) < 0.1) return { x: P.x, y: P.y };
  const t = (dx * (P.x - X.x) + dy * (P.y - X.y)) / (dx * dx + dy * dy);
  return { x: X.x + dx * t, y: X.y + dy * t };
}

/* DrawAddOns: the incircle radius is the mean of the three feet distances. */
function appletInradius(A, B, Cc, I) {
  return (dist(I, appletNearest(I, B, Cc)) +
    dist(I, appletNearest(I, Cc, A)) +
    dist(I, appletNearest(I, A, B))) / 3;
}

/* DrawCircumcircle(P,Q,R): centre plus the mean of three distances. */
function appletSmallCircle(P, Q, R) {
  const D = appletCircumcenter(P, Q, R);
  return { center: D, radius: (dist(D, P) + dist(D, Q) + dist(D, R)) / 3 };
}

/* ------------------------------------------------ 1. start and basic rules */

{
  const s = C.start();
  equal("start A is W/2 - 4k, H/2 at 400x300", s.A, { x: 40, y: 150 });
  equal("start B is W/2 + 2k, H/2 + 2k at 400x300", s.B, { x: 280, y: 230 });
  equal("start C is W/2, H/2 - 2k at 400x300", s.C, { x: 200, y: 70 });
  const other = C.start({ width: 600, height: 400 });
  equal("start scales with the canvas width", other.A, { x: 140, y: 200 });
  equal("start scales with the canvas height", other.C, { x: 300, y: 120 });
  check("a fresh illustration has no result", C.result(s) === null);
  check("the starting triangle is non-degenerate", !C.isDegenerate(s));
  check("withPoint keeps the old position", (() => {
    const next = C.withPoint(s, "B", { x: 1, y: 2 });
    return s.B.x === 280 && next.B.x === 1 && next.A.x === s.A.x;
  })());
  check("withPoint ignores an unknown handle", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === 40);
  check("the core keeps only three corners", Object.keys(s).sort().join() === "A,B,C");
}

/* ------------------------------- 2. a broad deterministic set of triangles */

const fixed = [
  ["equilateral", tri({ x: 200, y: 40 }, { x: 60, y: 280 }, { x: 340, y: 280 })],
  ["right", tri({ x: 60, y: 250 }, { x: 60, y: 40 }, { x: 320, y: 250 })],
  ["obtuse at A", tri({ x: 60, y: 150 }, { x: 320, y: 90 }, { x: 300, y: 240 })],
  ["obtuse at B", tri({ x: 180, y: 40 }, { x: 50, y: 260 }, { x: 360, y: 250 })],
  ["obtuse at C", tri({ x: 40, y: 40 }, { x: 360, y: 60 }, { x: 190, y: 250 })],
  ["the applet's start", C.start()],
];

const samples = [...fixed.map(([, s]) => s)];
{
  /* A regular grid catches mirror images and re-labellings the RNG misses. */
  for (let ax = 20; ax <= 220; ax += 50) {
    for (let ay = 20; ay <= 220; ay += 50) {
      for (const [bx, by, cx, cy] of [[360, 40, 300, 280], [40, 280, 360, 280], [350, 260, 30, 180]]) {
        samples.push(tri({ x: ax, y: ay }, { x: bx, y: by }, { x: cx, y: cy }));
      }
    }
  }
  const rand = rng(19880420);
  for (let i = 0; i < 900; i++) {
    samples.push(tri(
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      { x: 10 + rand() * 380, y: 10 + rand() * 280 },
    ));
  }
}

let usable = 0;
for (const s of samples) {
  if (!C.isDegenerate(s) && C.doubleArea(s) > 500) usable++;
}
check(`the sample set has at least 700 usable triangles (got ${usable})`, usable >= 700);

/* 2a. the core's construction against the second transcription */
{
  let compared = 0;
  for (const s of samples) {
    if (C.isDegenerate(s) || C.doubleArea(s) < 500) continue;
    const scale = Math.max(C.sides(s).a, C.sides(s).b, C.sides(s).c);
    const tol = 1e-6 * scale;
    const m = C.measure(s);
    const I = appletIncenter(s.A, s.B, s.C);
    const O = appletCircumcenter(s.A, s.B, s.C);

    if (!closePoint(m.I, I, tol)) {
      check("FindIncenter matches the applet's rotate-and-intersect", false,
        `core ${JSON.stringify(m.I)}, applet ${JSON.stringify(I)}`);
      continue;
    }
    if (!closePoint(m.bigCircle.center, O, tol)) {
      check("FindCircumcenter matches the applet's perpendicular bisectors", false);
      continue;
    }
    if (!close(m.bigCircle.radius, dist(O, s.A), tol)) {
      check("the big circle radius matches Dist(O,A)", false);
      continue;
    }
    if (!close(m.incircle.radius, appletInradius(s.A, s.B, s.C, I), tol)) {
      check("incircle radius matches the applet's mean of three feet", false);
      continue;
    }
    const triples = {
      C: [I, s.A, s.B], A: [I, s.B, s.C], B: [I, s.C, s.A],
    };
    for (const key of Object.keys(triples)) {
      const expected = appletSmallCircle(...triples[key]);
      const actual = m.small[key];
      if (!closePoint(actual.center, expected.center, tol) ||
          !close(actual.radius, expected.radius, tol)) {
        check(`${key} circumcircle matches DrawCircumcircle`, false,
          `core ${JSON.stringify(actual)}, applet ${JSON.stringify(expected)}`);
      }
    }
    compared++;
  }
  check(`core matches the applet's own construction on ${compared} triangles`, compared === usable);
}

/* 2b. the independent side-length incenter formula, everywhere */
{
  let checked = 0;
  for (const s of samples) {
    if (C.isDegenerate(s) || C.doubleArea(s) < 500) continue;
    const { a, b, c } = C.sides(s);
    const sum = a + b + c;
    const bary = {
      x: (a * s.A.x + b * s.B.x + c * s.C.x) / sum,
      y: (a * s.A.y + b * s.B.y + c * s.C.y) / sum,
    };
    const tol = 1e-6 * Math.max(a, b, c);
    const m = C.measure(s);
    if (!closePoint(m.I, bary, tol)) {
      check("the applet's incenter equals the side-weight formula", false);
    }
    if (!close(m.incircle.radius, C.doubleArea(s) / sum, tol)) {
      check("the mean feet distance equals area / semiperimeter", false);
    }
    checked++;
  }
  check(`incenter and inradius formulas checked on ${checked} triangles`, checked === usable);
}

/* --------------------------- 3. each claim on the original page, exhaustively */

{
  let checked = 0;
  let failures = 0;
  const seen = {};
  for (const s of samples) {
    if (C.isDegenerate(s) || C.doubleArea(s) < 500) continue;
    const cl = C.claims(s);
    for (const [name, ok] of Object.entries(cl)) {
      if (name === "all") continue;
      seen[name] = (seen[name] || 0) + (ok ? 1 : 0);
      if (!ok && failures++ < 8) {
        console.error(`  claim "${name}" failed on ${JSON.stringify(s)}`);
      }
    }
    checked++;
  }
  check(`all ten claims hold on all ${checked} configurations`, failures === 0);
  for (const name of [
    "incenterFormula", "incircleTouchesSides", "radiiAreTrue",
    "centersOnCircumcircle", "centersOnBisectors", "arcMidpoints",
    "johnsonCircle", "angleHalves", "angleBDC", "concentric",
  ]) {
    check(`claim ${name} was exercised ${checked} times`, seen[name] === checked);
  }

  /* The principal claim, re-measured without using the core's claims(): the
     three centers lie on the circumcircle of ABC. */
  let onCircle = 0;
  for (const s of samples) {
    if (C.isDegenerate(s) || C.doubleArea(s) < 500) continue;
    const I = appletIncenter(s.A, s.B, s.C);
    const O = appletCircumcenter(s.A, s.B, s.C);
    const R = dist(O, s.A);
    const tol = 1e-6 * Math.max(C.sides(s).a, C.sides(s).b, C.sides(s).c);
    const centers = [appletCircumcenter(I, s.A, s.B),
      appletCircumcenter(I, s.B, s.C), appletCircumcenter(I, s.C, s.A)];
    if (centers.every((D) => Math.abs(dist(O, D) - R) <= tol)) onCircle++;
  }
  check(`the three circumcenters lie on the big circle in all ${onCircle} cases`, onCircle === usable);

  /* The Johnson variant: the A-bisector's second crossing D has DB = DC = DI. */
  let johnson = 0;
  for (const s of samples) {
    if (C.isDegenerate(s) || C.doubleArea(s) < 500) continue;
    const I = appletIncenter(s.A, s.B, s.C);
    const D = appletCircumcenter(I, s.B, s.C);
    const tol = 1e-6 * Math.max(C.sides(s).a, C.sides(s).b, C.sides(s).c);
    if (Math.abs(dist(D, s.B) - dist(D, s.C)) <= tol &&
        Math.abs(dist(D, s.B) - dist(D, I)) <= tol) johnson++;
    /* D on line AI, measured by the cross product. */
    const cross = (s.B.x - s.A.x) * (I.y - s.A.y) - (s.B.y - s.A.y) * (I.x - s.A.x);
    if (!(Math.abs((D.x - s.A.x) * (I.y - s.A.y) - (D.y - s.A.y) * (I.x - s.A.x)) <= tol * Math.abs(cross) / dist(s.A, I) + tol)) {
      check("the circumcenter of IBC lies on AI", false, JSON.stringify(s));
    }
  }
  check(`DB = DC = DI holds in all ${johnson} cases`, johnson === usable);

  /* The 1988 variant really is true here: the circumcircle of the three
     centers has the same centre as the circumcircle of ABC. */
  let concentric = 0;
  for (const s of samples) {
    if (C.isDegenerate(s) || C.doubleArea(s) < 500) continue;
    const I = appletIncenter(s.A, s.B, s.C);
    const centers = [appletCircumcenter(I, s.B, s.C),
      appletCircumcenter(I, s.C, s.A), appletCircumcenter(I, s.A, s.B)];
    const O = appletCircumcenter(s.A, s.B, s.C);
    const O3 = appletCircumcenter(centers[0], centers[1], centers[2]);
    const tol = 1e-6 * Math.max(C.sides(s).a, C.sides(s).b, C.sides(s).c);
    if (closePoint(O, O3, tol)) concentric++;
  }
  check(`the concentric variant holds in all ${concentric} cases`, concentric === usable);
}

/* ----------------------------------------- 4. degenerate and edge cases */

{
  const flat = tri({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 });
  check("three collinear corners are degenerate", C.isDegenerate(flat));
  check("a degenerate triangle has no claims", !C.claims(flat).all &&
    !Object.values(C.claims(flat)).some((v) => v === true));
  const duplicate = tri({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 100, y: 100 });
  check("a repeated corner is degenerate", C.isDegenerate(duplicate));
  const thin = tri({ x: 10, y: 10 }, { x: 390, y: 11 }, { x: 200, y: 13 });
  check("a very flat triangle is still measurable and all claims hold there",
    !C.isDegenerate(thin) && C.measure(thin).bigCircle !== null && C.claims(thin).all);
  const mirror = tri({ x: 200, y: 40 }, { x: 340, y: 280 }, { x: 60, y: 280 });
  check("the claims are orientation independent", C.claims(mirror).all);
  check("measurements never mutate the state", (() => {
    const s = C.start();
    const before = JSON.stringify(s);
    C.measure(s); C.claims(s);
    return JSON.stringify(s) === before;
  })());
}

done("incircles-circumcircles");
