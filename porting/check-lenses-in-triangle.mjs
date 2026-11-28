#!/usr/bin/env node
"use strict";

/*
 * Logic test for lenses-in-triangle/lenses-in-triangle-core.js.
 *
 *   node porting/check-lenses-in-triangle.mjs
 *
 * The core's intersections use a closed form; section 3 writes the applet's
 * own GeoSDoub.IntersectX / LensesInTriangleCanvas.Compute method a second
 * time, literally (slope, intercept, quadratic, higher-y choice, Prorate's
 * short-distance guard, rounded arc angles), and compares both over the
 * scrollbar's whole range [-50, 55] and extra fractional positions and side
 * lengths. Section 4 tests both claims on the cut-the-knot page: arc DE is
 * 60 degrees, and the reflected lens stays inside the triangle. The second
 * claim holds only up to the rolling limit dist = +50; the Java scrollbar
 * runs to +55, where the lens crosses side AC, and the test says so.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("lenses-in-triangle/lenses-in-triangle-core.js", "LensesInTriangleCore");
const PI = Math.PI;
const near = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;
const ptNear = (a, b, eps = 1e-8) => near(a.x, b.x, eps) && near(a.y, b.y, eps);
const O = { x: 0, y: 0 };
const ORIGIN = { x: 180, y: 40 };
const SIDE = 240;

/* ------------------------------------------------------------ 1. the rules */

{
  equal("the scrollbar keeps the applet's range", C.RANGE, { min: -50, max: 55, step: 1 });
  const s = C.start({});
  equal("the scrollbar starts in the middle", s.dist, 0);
  equal("hint starts unchecked", s.hint, false);
  equal("names starts unchecked", s.names, false);
  check("there are 106 whole scrollbar positions", C.legalMoves(s).length === 106);
  equal("the lowest position", C.legalMoves(s)[0], -50);
  equal("the highest position", C.legalMoves(s)[105], 55);
  check("dist below the minimum stops at -50", C.setDist(s, -100).dist === -50);
  check("dist above the maximum stops at 55", C.setDist(s, 100).dist === 55);
  check("fractional dist rounds as the scrollbar does", C.setDist(s, 12.7).dist === 13);
  check("stepping moves one notch", C.stepDist(s, 1).dist === 1 && C.stepDist(s, -1).dist === -1);
  check("stepping past an end is clamped", C.stepDist(C.start({ dist: -50 }), -9).dist === -50);
  check("a bad number leaves the picture alone", C.setDist(s, "nonsense") === s);
  check("both checkboxes toggle", C.toggleHint(C.toggleHint(s)).hint === false &&
    C.toggleNames(C.toggleNames(s)).names === false);
  check("an illustration has no outcome", C.result(s) === null && C.result(C.start({ dist: 55 })) === null);
  check("Prorate keeps its small-distance guard", ptNear(C.prorate({ x: 1, y: 2 }, { x: 1.01, y: 2 }, 5), { x: 1, y: 2 }));
  equal("midpoint is the average", C.midpoint({ x: 1, y: 3 }, { x: 5, y: 9 }), { x: 3, y: 6 });
}

/* ----------------------------- 2. the page's claims at the whole-dot scale */

{
  let arcBad = null;
  let sweepBad = null;
  let insideBad = null;
  for (let d = -50; d <= 50; d++) {
    const st = C.start({ dist: d });
    const g = C.geometry(st, SIDE, ORIGIN);
    if (!near(g.arcDegrees, 60, 1e-8)) arcBad = [d, g.arcDegrees];
    if (g.sweep !== -60) sweepBad = [d, g.sweep];
    if (!C.lensInside(st, SIDE, ORIGIN, 96)) insideBad = d;
  }
  check("arc DE is 60 degrees at all 101 rolling positions", arcBad === null, String(arcBad));
  check("the drawn arc keeps a -60 degree sweep at every rolling position", sweepBad === null, String(sweepBad));
  check("the lens is inside the triangle at all 101 rolling positions", insideBad === null,
    `first escape at dist ${insideBad}`);

  let tilted = null;
  for (let d = -50; d <= 50; d++) {
    const g = C.geometry(C.start({ dist: d }), SIDE, ORIGIN);
    if (g.tilt > 30 + 1e-9) tilted = [d, g.tilt];
  }
  check("DE leans at most 30 degrees between the extremes", tilted === null, String(tilted));
  check("the left extreme leans exactly 30 degrees",
    near(C.geometry(C.start({ dist: -50 }), SIDE, ORIGIN).tilt, 30, 1e-9));
  check("the right extreme leans exactly 30 degrees",
    near(C.geometry(C.start({ dist: 50 }), SIDE, ORIGIN).tilt, 30, 1e-9));
  check("in between, DE leans less than 30 degrees",
    C.geometry(C.start({ dist: 25 }), SIDE, ORIGIN).tilt < 30);

  let beyond = true;
  for (let d = 51; d <= 55; d++) {
    if (C.lensInside(C.start({ dist: d }), SIDE, ORIGIN, 256)) beyond = false;
  }
  check("past the rolling limit the lens leaves the triangle at every extra step", beyond);
  check("past the rolling limit DE leans more than 30 degrees",
    C.geometry(C.start({ dist: 55 }), SIDE, ORIGIN).tilt > 33);
  check("the warning names the crossed side",
    /crosses the side AC/.test(C.describe(C.geometry(C.start({ dist: 55 }), SIDE, ORIGIN))));
  check("inside the limit there is no warning",
    !/crosses/.test(C.describe(C.geometry(C.start({ dist: 0 }), SIDE, ORIGIN))));
}

/* --------------------------- 3. a second, literal bytecode transcription */

/*
 * GeoSDoub.Intersect(DoubLine, DoubCircle) -> IntersectX. The line is stored
 * as points m_1, m_2; x = slope*y + intercept, where slope is dx/dy. The two
 * roots of the quadratic are returned in the order (+sqrt, -sqrt).
 */
function bytecodeIntersect(circle, p1, p2) {
  const slope = (p1.x - p2.x) / (p1.y - p2.y);
  const intercept = p2.x - slope * p2.y;
  const aa = slope * slope + 1;
  const bb = slope * (intercept - circle.x) - circle.y;
  const cc = circle.y * circle.y + (intercept - circle.x) ** 2 - circle.r * circle.r;
  const disc = bb * bb - aa * cc; // d8*d8 - d6*d10 in the bytecode
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y0 = (-bb + root) / aa;
  const y1 = (-bb - root) / aa;
  return [
    { x: slope * y0 + intercept, y: y0 },
    { x: slope * y1 + intercept, y: y1 },
  ];
}

/* GeoSDoub.ComputeAngle(a, b, c): acos of the law-of-cosines ratio. */
function bytecodeAngle(a, b, c) {
  const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const len = (p, q) => Math.sqrt(sq(p, q));
  const num = (sq(a, b) + sq(a, c) - sq(b, c)) / 2;
  return Math.acos(num / (len(a, b) * len(a, c)));
}

/* CTKGeometryPlus.Prorate(P, Q, d), with the original 0.1 guard. */
function bytecodeProrate(p, q, d) {
  const len = Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  if (len < 0.1) return { x: p.x, y: p.y };
  const t = d / len;
  // The original Prorate(p, q, d) moves from q towards p by d units.
  return { x: q.x + t * (p.x - q.x), y: q.y + t * (p.y - q.y) };
}

/* LensesInTriangleCanvas.Compute, one statement per bytecode statement. */
function bytecodeCompute(distValue, side, origin) {
  const h = Math.sqrt(3) * side / 2;
  const A = { x: origin.x, y: origin.y };
  const B = { x: origin.x - side / 2, y: origin.y + h };
  const Cc = { x: origin.x + side / 2, y: origin.y + h };
  const offset = distValue * side / 100;
  const circle = { x: A.x + offset, y: A.y, r: h };

  const fromAB = bytecodeIntersect(circle, A, B);
  const D = fromAB[0].y > fromAB[1].y ? fromAB[0] : fromAB[1];
  const fromAC = bytecodeIntersect(circle, A, Cc);
  const E = fromAC[0].y > fromAC[1].y ? fromAC[0] : fromAC[1];

  const mid = { x: (D.x + E.x) / 2, y: (D.y + E.y) / 2 };
  const circleLength = Math.sqrt((mid.x - circle.x) ** 2 + (mid.y - circle.y) ** 2);
  const O2 = bytecodeProrate(mid, circle, 2 * circleLength);
  const circle2 = { x: O2.x, y: O2.y, r: circle.r };
  const right = { x: circle2.x + 200, y: circle2.y };
  const alphaD = Math.round(bytecodeAngle(O2, D, right) * 180 / PI);
  const alphaE = Math.round(bytecodeAngle(O2, E, right) * 180 / PI);

  const ab = Math.sqrt((B.x - A.x) ** 2 + (B.y - A.y) ** 2);
  const ac = Math.sqrt((A.x - Cc.x) ** 2 + (A.y - Cc.y) ** 2);
  const Cp = bytecodeProrate(A, B, 2 * ab);
  const Bp = bytecodeProrate(A, Cc, 2 * ac);
  const centre = { x: (A.x + B.x + Cc.x) / 3, y: (A.y + B.y + Cc.y) / 3 };
  return { D, E, O: circle, O2, Bp, Cp, alphaD, alphaE, centre, h };
}

{
  let mismatches = 0;
  for (let d = -50; d <= 55; d++) {
    const state = C.start({ dist: d });
    const a = C.geometry(state, SIDE, ORIGIN);
    const b = bytecodeCompute(d, SIDE, ORIGIN);
    const ok = ptNear(a.D, b.D, 2e-7) && ptNear(a.E, b.E, 2e-7) &&
      ptNear(a.O, b.O, 2e-7) && ptNear(a.O2, b.O2, 2e-7) &&
      ptNear(a.Bp, b.Bp, 2e-7) && ptNear(a.Cp, b.Cp, 2e-7) &&
      a.alphaD === b.alphaD && a.alphaE === b.alphaE;
    if (!ok) mismatches++;
    check(`the core matches Compute at dist ${d}`, ok,
      `core ${JSON.stringify([a.D, a.E, a.alphaD, a.alphaE])}, ` +
      `bytecode ${JSON.stringify([b.D, b.E, b.alphaD, b.alphaE])}`);
  }
  check("every scrollbar position matches the second transcription", mismatches === 0);

  let extra = 0;
  const extras = [-49.6, -12.3, 0.1, 12.7, 49.5, 50.25, 54.9];
  const sides = [150, 240, 333.7];
  const origins = [O, ORIGIN];
  for (const d of extras) for (const side of sides) for (const origin of origins) {
    const a = C.geometry({ dist: d, hint: false, names: false }, side, origin);
    const b = bytecodeCompute(d, side, origin);
    if (!(ptNear(a.D, b.D, 2e-7) && ptNear(a.E, b.E, 2e-7) &&
      ptNear(a.O2, b.O2, 2e-7) && a.alphaD === b.alphaD && a.alphaE === b.alphaE)) {
      extra++;
    }
  }
  check("fractional positions, three sizes and two origins all match", extra === 0, `${extra} mismatches`);
}

/* ------------------------------------ 4. invariant, reflections and symmetry */

{
  let bad = null;
  for (let d = -50; d <= 55; d++) {
    const g = C.geometry(C.start({ dist: d }), SIDE, ORIGIN);
    const centreGap = C.distance(g.O, g.O2);
    if (!ptNear(g.M, C.midpoint(g.D, g.E)) ||
        !near(centreGap, 3 * SIDE / 2, 1e-7) ||
        !near(C.distance(g.O2, g.D), g.r, 1e-7) ||
        !near(C.distance(g.O2, g.E), g.r, 1e-7) ||
        !near(C.distance(g.O, g.D), g.r, 1e-7) ||
        !near(C.distance(g.O, g.E), g.r, 1e-7)) bad = d;
  }
  check("both circles pass through D and E, and their centres stay 3s/2 apart", bad === null,
    `first failure at ${bad}`);

  const g = C.geometry(C.start({ dist: 17 }), SIDE, ORIGIN);
  check("B' is C reflected in A", ptNear(g.Bp, { x: 2 * g.A.x - g.C.x, y: 2 * g.A.y - g.C.y }));
  check("C' is B reflected in A", ptNear(g.Cp, { x: 2 * g.A.x - g.B.x, y: 2 * g.A.y - g.B.y }));
  check("D lies on the line AB", near((g.D.y - g.A.y) * (g.B.x - g.A.x),
    (g.D.x - g.A.x) * (g.B.y - g.A.y), 1e-6));
  check("E lies on the line AC", near((g.E.y - g.A.y) * (g.C.x - g.A.x),
    (g.E.x - g.A.x) * (g.C.y - g.A.y), 1e-6));

  let mirror = true;
  for (let d = 0; d <= 50; d++) {
    const left = C.geometry(C.start({ dist: -d }), SIDE, ORIGIN);
    const right = C.geometry(C.start({ dist: d }), SIDE, ORIGIN);
    if (!ptNear({ x: left.D.x + right.E.x - 2 * ORIGIN.x, y: left.D.y - right.E.y }, O, 1e-7) ||
        !ptNear({ x: left.E.x + right.D.x - 2 * ORIGIN.x, y: left.E.y - right.D.y }, O, 1e-7)) mirror = false;
  }
  check("left and right rolls are mirror images of one another", mirror);

  check("the extreme left roll puts D exactly at B",
    ptNear(C.geometry(C.start({ dist: -50 }), SIDE, ORIGIN).D,
      C.geometry(C.start({ dist: -50 }), SIDE, ORIGIN).B, 1e-7));
  check("the extreme right roll puts E exactly at C",
    ptNear(C.geometry(C.start({ dist: 50 }), SIDE, ORIGIN).E,
      C.geometry(C.start({ dist: 50 }), SIDE, ORIGIN).C, 1e-7));

  let fine = true;
  let firstEscape = null;
  for (let tenth = -500; tenth <= 500; tenth++) {
    const d = tenth / 10;
    if (d <= 50 && !C.lensInside(C.start({ dist: d }), SIDE, ORIGIN, 128)) fine = false;
  }
  for (let hundredth = 5010; hundredth <= 5500; hundredth++) {
    const d = hundredth / 100;
    if (!C.lensInside(C.start({ dist: d }), SIDE, ORIGIN, 512)) { firstEscape = d; break; }
  }
  check("a tenth-step scan finds no escape up to dist 50", fine);
  check("the first escape is past dist 50, before the scrollbar's 55", firstEscape !== null && firstEscape > 50 && firstEscape <= 50.5,
    `first escape ${firstEscape}`);
  check("the point-in-triangle test does not depend on winding",
    C.inTriangle({ x: 180, y: 220 }, g) &&
    C.inTriangle({ x: 180, y: 220 }, { A: g.C, B: g.B, C: g.A }));
}

done("lenses-in-triangle");
