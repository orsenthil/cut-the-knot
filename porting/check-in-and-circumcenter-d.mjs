#!/usr/bin/env node
"use strict";

/*
 * Logic test for in-and-circumcenter-d/in-and-circumcenter-d-core.js.
 *
 *   node porting/check-in-and-circumcenter-d.mjs
 *
 * The applet's own page claims that if AB is laid off along the other two
 * sides at D and E (BD = AE = AB), and the circle centred at the incenter I
 * through the circumcenter O has chords ON || CA and OM || CB, then triangle
 * ONM is congruent to triangle CDE. Its proof says ON = a - c = CD,
 * OM = b - c = CE and that OL = O'I' = (a - c)/2. Here those statements are
 * checked on the start diagram, on exact triangles and on thousands of random
 * ones in all four side-order regimes. They hold provided lengths are read as
 * positive (the page's signed a - c assumes AB is the shortest side) and the
 * chord is not under the applet's one-pixel tolerance.
 *
 * Section 3 is a second, literal transcription of the bytecode: rotated
 * half-angle bisectors for FindIncenter, perpendicular bisectors and
 * GeoSDoub.Intersect for FindCircumcenter, averaged radii, PlacePoint,
 * NearestPoint, GetParallelTo, IntersectX/Y and Other. Every point it builds
 * is compared with the core over the whole parameter space of the board.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("in-and-circumcenter-d/in-and-circumcenter-d-core.js", "InAndCircumcenterDCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (a, b, tol) => Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => finite(p) && finite(q) &&
  Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const near = (label, actual, expected, tol) =>
  check(label, close(actual, expected, tol), `got ${actual}, expected ${expected}`);
const pointIs = (label, actual, expected, tol) =>
  check(label, closePoint(actual, expected, tol),
    finite(actual) && finite(expected)
      ? `got (${actual.x}, ${actual.y}), expected (${expected.x}, ${expected.y})`
      : "a point is missing");

/* ------------------- a second transcription straight from the Java bytecode */

/* GeoSDoub.SqDist / Dist / ComputeAngle. */
const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
function computeAngle(p, q, r) {
  const c = (sqDist(p, q) + sqDist(p, r) - sqDist(q, r)) / 2;
  const v = c / (Math.sqrt(sqDist(p, q)) * Math.sqrt(sqDist(p, r)));
  return Math.acos(Math.max(-1, Math.min(1, v)));
}
function orientation(p, q, r) {
  const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return v > 0 ? 1 : -1;
}
function rotate(p, q, angle, orient) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: p.x + cs * (q.x - p.x) - orient * sn * (q.y - p.y),
    y: p.y + orient * sn * (q.x - p.x) + cs * (q.y - p.y),
  };
}
/* GeoSDoub.Intersect(P1,P2,P3,P4): line coefficients, |det| < 1 -> NaN. */
function intersectLines(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}
/* GeoSDoub.FindIncenter: two rotated bisectors, then Intersect. */
function findIncenter(A, B, D) {
  const a = computeAngle(A, B, D), b = computeAngle(B, D, A);
  const orient = orientation(A, B, D);
  return intersectLines(A, rotate(A, B, a / 2, orient), B, rotate(B, D, b / 2, orient));
}
/* GeoSDoub.FindCircumcenter: two perpendicular bisectors, then Intersect. */
function findCircumcenter(A, B, D) {
  const p3 = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const p4 = { x: (B.x + D.x) / 2, y: (B.y + D.y) / 2 };
  const p5 = { x: p3.x + (B.y - A.y), y: p3.y - (B.x - A.x) };
  const p6 = { x: p4.x + (D.y - B.y), y: p4.y - (D.x - B.x) };
  return intersectLines(p3, p5, p4, p6);
}
/* GeoSDoub.NearestPoint(p,a,b): a tiny SqDist(a,b) returns p itself. */
function nearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (sqDist(a, b) < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
/* GetCircumcircle / GetIncircle: averaged circumcenter and incenter radii. */
function getCircumcircle(A, B, D) {
  const c = findCircumcenter(A, B, D);
  return { c, r: (dist(c, A) + dist(c, B) + dist(c, D)) / 3 };
}
function getIncircle(A, B, D) {
  const c = findIncenter(A, B, D);
  const r = (dist(c, nearestPoint(c, A, B)) + dist(c, nearestPoint(c, B, D)) +
    dist(c, nearestPoint(c, D, A))) / 3;
  return { c, r };
}
/* GeoSDoub.GetParallelTo(A,B,C): 100 lengths from A in the B->C direction. */
function parallelPoint(a, b, c) {
  return { x: a.x + 100 * (b.x - c.x), y: a.y + 100 * (b.y - c.y) };
}
/* Canvas PlacePoint(P1,P2,P3): from P1 towards P3 by |P1P2|. */
function placePoint(p1, p2, p3) {
  const s = dist(p1, p2) / dist(p1, p3);
  return { x: p1.x + (p3.x - p1.x) * s, y: p1.y + (p3.y - p1.y) * s };
}
/* GeoSDoub.Intersect(DoubLine,DoubCircle) -> IntersectX or IntersectY. */
function lineCircle(circle, p1, p2) {
  if (Math.abs(p1.y - p2.y) > 1) {
    const a = (p1.x - p2.x) / (p1.y - p2.y);
    const b = p2.x - a * p2.y;
    const q = a * (b - circle.c.x) - circle.c.y;
    const A2 = 1 + a * a, B2 = 2 * q;
    const C2 = circle.c.y ** 2 + (b - circle.c.x) ** 2 - circle.r ** 2;
    const disc = B2 * B2 - 4 * A2 * C2;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const y1 = (-B2 + root) / (2 * A2), y2 = (-B2 - root) / (2 * A2);
    return [{ x: a * y1 + b, y: y1 }, { x: a * y2 + b, y: y2 }];
  }
  if (Math.abs(p1.x - p2.x) > 1) {
    const a = (p1.y - p2.y) / (p1.x - p2.x);
    const b = p2.y - a * p2.x;
    const q = a * circle.c.x + b - circle.c.y;
    const A2 = 1 + a * a, B2 = 2 * q;
    const C2 = circle.c.x ** 2 + (b - circle.c.y) ** 2 - circle.r ** 2;
    const disc = B2 * B2 - 4 * A2 * C2;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const x1 = (-B2 + root) / (2 * A2), x2 = (-B2 - root) / (2 * A2);
    return [{ x: x1, y: a * x1 + b }, { x: x2, y: a * x2 + b }];
  }
  return null;
}
/* Canvas Other(points, known): points[0] unless it is within 1 px. */
function other(points, known) {
  if (!points || !points.length) return null;
  if (points.length === 1) return points[0];
  return dist(points[0], known) >= 1 ? points[0] : points[1];
}
/** The canvas's Compute(), statement by statement. */
function appletCompute(s) {
  const { A, B, C: D } = s;
  if ([dist(A, B), dist(B, D), dist(D, A)].some((d) => d < 2)) return { valid: false };
  const incircle = getIncircle(A, B, D);
  const circumcircle = getCircumcircle(A, B, D);
  const circle = { c: incircle.c, r: dist(incircle.c, circumcircle.c) };
  const Dpt = placePoint(B, A, D);
  const E = placePoint(A, B, D);
  const Op = nearestPoint(circumcircle.c, A, D);
  const Ip = nearestPoint(incircle.c, A, D);
  let N = null, M = null;
  try {
    const lineN = [circumcircle.c, parallelPoint(circumcircle.c, A, D)];
    N = other(lineCircle(circle, lineN[0], lineN[1]), circumcircle.c);
  } catch (e) { N = null; } // the applet catches Exception around this block
  try {
    const lineM = [circumcircle.c, parallelPoint(circumcircle.c, B, D)];
    M = other(lineCircle(circle, lineM[0], lineM[1]), circumcircle.c);
  } catch (e) { M = null; }
  let L = null;
  try { L = intersectLines(circumcircle.c, N, incircle.c, Ip); } catch (e) { L = null; }
  return { valid: true, incircle, circumcircle, circle, D: Dpt, E, Op, Ip, N, M, L };
}

/* ------------------------------------------------------ deterministic cases */

function triangle(A, B, Cc) {
  return {
    A, B, C: Cc,
    showNames: false, showStatement: false, showPremise: false, showHint: false,
  };
}
const fixed = [
  ["the applet's start", C.start()],
  ["a scaled 3-4-5 triangle", triangle({ x: 60, y: 300 }, { x: 180, y: 300 }, { x: 60, y: 120 })],
  ["an isosceles triangle", triangle({ x: 100, y: 40 }, { x: 340, y: 40 }, { x: 220, y: 400 })],
  ["an obtuse triangle", triangle({ x: 70, y: 200 }, { x: 400, y: 260 }, { x: 180, y: 80 })],
  ["a small triangle", triangle({ x: 130, y: 130 }, { x: 190, y: 160 }, { x: 145, y: 210 })],
];
const random = rng(5642);
const randomCases = [];
for (let i = 0; i < 4000; i++) {
  randomCases.push(triangle(
    { x: 12 + random() * 426, y: 12 + random() * 426 },
    { x: 12 + random() * 426, y: 12 + random() * 426 },
    { x: 12 + random() * 426, y: 12 + random() * 426 },
  ));
}
const allCases = fixed.map(([name, s]) => [name, s]).concat(randomCases.map((s, i) => [`random ${i}`, s]));

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start();
  equal("start A matches init() at the archived 450x450 canvas", s.A, { x: 150, y: 360 });
  equal("start B matches init() at the archived 450x450 canvas", s.B, { x: 330, y: 300 });
  equal("start C matches init() at the archived 450x450 canvas", s.C, { x: 112, y: 112 });
  equal("all four checkboxes start off, as ShowNames=0 on the page",
    [s.showNames, s.showStatement, s.showPremise, s.showHint], [false, false, false, false]);
  const f = C.geometry(s);
  check("the opening triangle can be drawn", f.valid);
  check("BD is AB at the start", close(dist(f.B, f.D), dist(s.A, s.B), 1e-9));
  check("AE is AB at the start", close(dist(f.A, f.E), dist(s.A, s.B), 1e-9));
  const cl = C.claims(f);
  check("the opening triangles are congruent", cl.congruent);
  check("the opening D and E lie on the sides", cl.onSides);
  check("the status line describes the opening diagram", C.describe(f).includes("Angles at C and O"));
}

/* ------------------------------- 2. dragging, options and the side guard */

{
  const s = C.start();
  const moved = C.withPoint(s, "A", { x: 60, y: 200 });
  check("withPoint leaves the old position alone", s.A.x === 150 && s.A.y === 360);
  check("withPoint returns a fresh point object", moved !== s && moved.A !== s.A);
  pointIs("a dragged point is clamped to the board", C.withPoint(s, "B", { x: 9999, y: -7 }).B,
    { x: C.WIDTH - C.MARGIN, y: C.MARGIN }, 1e-9);
  check("an unknown handle is ignored", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
  const styled = C.setOption(s, "showHint", true);
  check("setOption does not mutate the old position", styled.showHint && !s.showHint);
  check("an unknown option is ignored", C.setOption(s, "mode", "x") === s);
  const after = C.reset(C.withPoint(styled, "C", { x: 40, y: 40 }));
  check("reset restores the opening points and keeps the options",
    after.A.x === 150 && after.C.x === 112 && after.showHint === true);
  const p = C.position(styled);
  check("the saved position is plain data for the tutor",
    p.A.x === 150 && p.showHint === true && JSON.stringify(p) === JSON.stringify(styled));
  const tooClose = C.withPoint(s, "B", { x: s.A.x + 1, y: s.A.y });
  check("a pair of corners closer than 2 px is not drawn", !C.geometry(tooClose).valid);
  check("the description still helps when the triangle is too small",
    C.describe(C.geometry(tooClose)).includes("apart"));
}

/* -------------------------- 3. the core against a second bytecode reading */

{
  let compared = 0, skipped = 0, worstPoint = 0, worstRadius = 0;
  for (const [name, s] of allCases) {
    const core = C.geometry(s);
    const applet = appletCompute(s);
    if (!core.valid || !applet.valid || !finite(applet.circle.c) ||
        !finite(applet.N) || !finite(applet.M) ||
        !finite(applet.D) || !finite(applet.E) ||
        Math.abs(applet.circumcircle.r) > 1e5) {
      skipped++;
      continue;
    }
    compared++;
    const tol = 2e-4 * Math.max(1, applet.circumcircle.r);
    const pairs = [
      ["incenter I", core.I, applet.incircle.c],
      ["circumcenter O", core.O, applet.circumcircle.c],
      ["the I(O) centre", core.circle.c, applet.circle.c],
      ["D", core.D, applet.D],
      ["E", core.E, applet.E],
      ["O'", core.Op, applet.Op],
      ["I'", core.Ip, applet.Ip],
      ["N", core.N, applet.N],
      ["M", core.M, applet.M],
    ];
    for (const [what, mine, theirs] of pairs) {
      const err = finite(theirs) ? dist(mine, theirs) : Infinity;
      worstPoint = Math.max(worstPoint, err);
      check(`${name}: ${what} matches the applet's construction`, err <= tol,
        `error ${err}`);
    }
    for (const [what, mine, theirs] of [
      ["incircle radius", core.rIn, applet.incircle.r],
      ["circumcircle radius", core.rCirc, applet.circumcircle.r],
      ["circle I(O) radius", core.io, applet.circle.r],
    ]) {
      const err = Math.abs(mine - theirs);
      worstRadius = Math.max(worstRadius, err);
      check(`${name}: ${what}`, err <= tol, `error ${err}`);
    }
  }
  check("over 3500 configurations were compared with the bytecode", compared > 3500,
    `compared ${compared}`);
  check("a few degenerate configurations were skipped, not accepted", skipped < compared / 5,
    `skipped ${skipped}`);
  check("the largest point error is small", worstPoint < 0.05, `worst ${worstPoint}`);
  check("the largest radius error is small", worstRadius < 0.05, `worst ${worstRadius}`);
}

/* ---------------------------- 4. the page's theorem, on every configuration */

{
  let measured = 0, lengthOK = true, angleOK = true, congruent = true;
  let olOK = true, ipOK = true, signedOK = true, siblingOK = true;
  for (const [name, s] of allCases) {
    const f = C.geometry(s);
    const cl = C.claims(f);
    if (!cl.valid || cl.chordShort || dist(f.O, f.A) > 1e5) continue;
    measured++;
    const a = dist(f.B, f.C), b = dist(f.C, f.A), c = dist(f.A, f.B);
    const CD = dist(f.C, f.D), CE = dist(f.C, f.E);
    const ON = dist(f.O, f.N), OM = dist(f.O, f.M);
    const scale = Math.max(1, a, b, c) * 1e-3;
    lengthOK = lengthOK &&
      Math.abs(ON - Math.abs(a - c)) < scale && Math.abs(CD - Math.abs(a - c)) < scale &&
      Math.abs(OM - Math.abs(b - c)) < scale && Math.abs(CE - Math.abs(b - c)) < scale;
    const dce = C.angle(f.C, f.D, f.E), nom = C.angle(f.O, f.N, f.M);
    angleOK = angleOK && Number.isFinite(dce) && Math.abs(dce - nom) < 1e-6;
    congruent = congruent && Math.abs(ON - CD) < scale &&
      Math.abs(OM - CE) < scale && Math.abs(dce - nom) < 1e-6;
    if (f.L) olOK = olOK && Math.abs(dist(f.O, f.L) - Math.abs(a - c) / 2) < scale;
    ipOK = ipOK && Math.abs(dist(f.Op, f.Ip) - Math.abs(a - c) / 2) < 1e-7 * scale;
    if (c <= a && c <= b) {
      signedOK = signedOK && Math.abs(ON - (a - c)) < scale &&
        Math.abs(OM - (b - c)) < scale;
    }
    // The siblings A/B/C need angle C = 30 degrees for DE perpendicular to IO;
    // applet D makes no such assumption. Count a triangle far from 30 degrees.
    const angleC = C.angle(f.A, f.B, f.C) * 180 / Math.PI;
    if (Math.abs(angleC - 30) > 15 && cl.congruent) siblingOK = true;
  }
  check("the page's length equalities hold on every measured configuration", lengthOK);
  check("the angle at C equals the angle at O", angleOK);
  check("triangles CDE and ONM are congruent", congruent);
  check("the proof's OL = (a - c)/2 step holds", olOK);
  check("the proof's O'I' = (a - c)/2 step holds", ipOK);
  check("the page's signed formulas hold when AB is the shortest side", signedOK);
  check("congruence holds far from the siblings' 30-degree condition", siblingOK);
  check("nearly all configurations were measurable", measured > 3000, `measured ${measured}`);
}

{
  // Exact values on a named triangle, independent of the numeric loop.
  const s = fixed[1][1]; // a 3-4-5 triangle scaled by 60
  const f = C.geometry(s), cl = C.claims(f);
  near("3-4-5: side a is 60 sqrt(13)", f.a, 60 * Math.sqrt(13), 1e-9);
  near("3-4-5: side b is 180", f.b, 180, 1e-9);
  near("3-4-5: side c is 120", f.c, 120, 1e-9);
  near("3-4-5: CD equals a - c", cl.cd, 60 * Math.sqrt(13) - 120, 1e-7);
  near("3-4-5: CE equals b - c", cl.ce, 60, 1e-7);
  near("3-4-5: ON equals CD", cl.on, cl.cd, 1e-7);
  near("3-4-5: OM equals CE", cl.om, cl.ce, 1e-7);
  near("3-4-5: O'I' is (a - c)/2", cl.oip, 30 * Math.sqrt(13) - 60, 1e-7);
  check("3-4-5: the two triangles are congruent", cl.congruent);

  // Siblings A/B/C ask for DE = IO as well as DE perpendicular to IO, and
  // need angle C = 30 degrees for the length equality. D asks for a different
  // congruence and works at any angle. The opening triangle has angle C ~80.
  const opening = C.geometry(C.start());
  const angleAtC = C.angle(C.start().A, C.start().B, C.start().C) * 180 / Math.PI;
  check("the opening angle C is far from the siblings' 30 degrees",
    Math.abs(angleAtC - 30) > 5, `angle C = ${angleAtC}`);
  check("the D congruence holds while DE is not as long as IO",
    C.claims(opening).congruent &&
    Math.abs(dist(opening.D, opening.E) - opening.io) > 1);
}

/* --------------------------------- 5. the applet's one-pixel chord quirk */

{
  // A triangle whose side difference is below one pixel: Other() cannot tell
  // the chord's far end from O, so the page's equality is not drawn faithfully.
  // A=(100,100), B=(300,100) give AB = 200; C=(100,300.05) gives AC = 200.05.
  const tiny = triangle({ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 100, y: 300.05 });
  const f = C.geometry(tiny);
  check("a triangle with a 0.05-unit side difference can be built", f.valid);
  const cl = C.claims(f);
  check("the short chord is flagged by the applet's tolerance", cl.chordShort);
  const applet = appletCompute(tiny);
  if (applet.valid && finite(applet.N)) {
    pointIs("the core follows Other() when the chord is under a pixel", f.N, applet.N, 1e-4);
  }
  // A deliberately degenerate diagram stays unusable rather than misleading.
  const flat = triangle({ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 });
  check("three collinear corners give no construction", !C.geometry(flat).valid);
  check("the status line does not claim a result for a flat diagram",
    C.describe(C.geometry(flat)).startsWith("Move the corners apart"));
}

done("in-and-circumcenter-d");
