#!/usr/bin/env node
"use strict";

/*
 * Logic test for eyeball-2/eyeball-2-core.js.
 *
 *   node porting/check-eyeball-2.mjs
 *
 * The Squinting Eyes page claims that the two "incircles" are always equal,
 * with radius 2 RA RB / (RA + RB + AB), whenever the tangents can be drawn.
 * This test checks that claim over a grid of radii and separations, and
 * compares the core with a second, deliberately literal transcription of the
 * applet's own methods (DrawTangents, DrawDrawExtraCircle, GeoS'Doub
 * IntersectCirclesX/Y, GeoSDoub.Intersect) read from javap.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("eyeball-2/eyeball-2-core.js", "Eyeball2Core");
const EPS = 1e-6;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

function samePoints(actual, expected, label) {
  if (!actual || !expected) return false;
  // At tangency the discriminant is zero and the two formulas lose a few
  // digits in different orders, so this comparison is a little looser.
  const TOL = 1e-4;
  if (expected.length === 2 && dist(expected[0], expected[1]) < TOL) {
    expected = [expected[0]];
  }
  if (actual.length === 2 && dist(actual[0], actual[1]) < TOL) {
    actual = [actual[0]];
  }
  if (actual.length !== expected.length) return false;
  const a = actual.map((p) => [p.x, p.y]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const b = expected.map((p) => [p.x, p.y]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i][0] - b[i][0]) > TOL || Math.abs(a[i][1] - b[i][1]) > TOL) {
      if (label) console.error(`    ${label}: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
      return false;
    }
  }
  return true;
}

/* ------------------------------------------- the applet's own methods, again */

// GeoSDoub.IntersectCirclesX(DoubCircle, DoubCircle), javap 1168-1325.
function javaIntersectX(c0, c1) {
  const m = -(c0.y - c1.y) / (c0.x - c1.x);
  const b = (c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y -
    c0.r * c0.r + c1.r * c1.r) / (2 * (c0.x - c1.x));
  const a = b - c0.x;
  const q = m * m + 1;
  const p = m * a - c0.y;
  const disc = a * a + c0.y * c0.y - c0.r * c0.r;
  const det = p * p - q * disc;
  if (det < 0) return null;
  const root = Math.sqrt(det);
  const t0 = (-p + root) / q, t1 = (-p - root) / q;
  return [{ x: m * t0 + b, y: t0 }, { x: m * t1 + b, y: t1 }];
}

// GeoSDoub.IntersectCirclesY(DoubCircle, DoubCircle), javap 1326-1483.
function javaIntersectY(c0, c1) {
  const m = -(c0.x - c1.x) / (c0.y - c1.y);
  const b = (c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x -
    c0.r * c0.r + c1.r * c1.r) / (2 * (c0.y - c1.y));
  const a = b - c0.y;
  const q = m * m + 1;
  const p = m * a - c0.x;
  const disc = a * a + c0.x * c0.x - c0.r * c0.r;
  const det = p * p - q * disc;
  if (det < 0) return null;
  const root = Math.sqrt(det);
  const t0 = (-p + root) / q, t1 = (-p - root) / q;
  return [{ x: t0, y: m * t0 + b }, { x: t1, y: m * t1 + b }];
}

// GeoSDoub.Intersect(DoubCircle, DoubCircle), javap 1123-1167.
function javaIntersect(c0, c1) {
  if (Math.abs(c0.x - c1.x) > 1) return javaIntersectX(c0, c1);
  if (Math.abs(c0.y - c1.y) > 1) return javaIntersectY(c0, c1);
  return [{ x: c0.x, y: c0.y }, { x: c0.x, y: c0.y }];
}

// Eyeball2Canvas.DrawTangents(g, source, target, colour), javap 318-428.
// source = the circle the tangents touch, target = the circle holding the vertex.
function javaTangents(source, target) {
  const d = dist(source, target);
  const s7 = d + target.r;
  const s9 = s7 * s7 - source.r * source.r;
  if (s9 < 0) return null;
  const vertex = {
    x: target.x + ((target.x - source.x) * target.r) / d,
    y: target.y + ((target.y - source.y) * target.r) / d,
  };
  const tangentCircle = { x: vertex.x, y: vertex.y, r: Math.sqrt(s9) };
  const hits = javaIntersect(source, tangentCircle);
  if (!hits) return null;
  return { vertex: vertex, points: [hits[0], hits[1]] };
}

// Eyeball2Canvas.DrawDrawExtraCircle(g, c2, c3), javap 237-317.
function javaExtraCircle(c2, c3) {
  const d = dist(c2, c3);
  const r = (2 * c2.r * c3.r) / (c2.r + c3.r + d);
  return {
    radius: r,
    centre: {
      x: c3.x + ((c3.x - c2.x) * (c3.r - r)) / d,
      y: c3.y + ((c3.y - c2.y) * (c3.r - r)) / d,
    },
  };
}

/** A configuration of the two circles, with non-horizontal centres. */
function config(ra, rb, d, tilt) {
  const A = { x: 260, y: 180 };
  const u = { x: Math.cos(tilt), y: Math.sin(tilt) };
  const B = { x: A.x + d * u.x, y: A.y + d * u.y };
  return {
    width: 900, height: 600,
    A: A, B: B,
    boundaryA: { x: A.x + ra, y: A.y },
    boundaryB: { x: B.x + rb, y: B.y },
  };
}

const circlesOf = (s) => {
  const g = C.measure(s);
  return [
    { x: g.A.x, y: g.A.y, r: g.ra },
    { x: g.B.x, y: g.B.y, r: g.rb },
  ];
};

/** Distance from p to the infinite line through a and b. */
function lineDistance(p, a, b) {
  const ux = b.x - a.x, uy = b.y - a.y;
  return Math.abs((p.x - a.x) * uy - (p.y - a.y) * ux) / Math.hypot(ux, uy);
}

/* ------------------------------------------------------------ 1. the layout */

{
  const s = C.start({});
  equal("the applet's canvas is 600 by 400", [s.width, s.height], [600, 400]);
  equal("centre A is at width/3", s.A, { x: 200, y: 200 });
  equal("centre B is at 2*width/3", s.B, { x: 400, y: 200 });
  check("the starting radii are min(W,H)/6", Math.abs(C.measure(s).ra - 200 / 3) < EPS &&
    Math.abs(C.measure(s).rb - 200 / 3) < EPS);
  const g = C.measure(s);
  check("P and Q are the farthest points", Math.abs(g.P.x - 133.33333333333334) < EPS &&
    Math.abs(g.Q.x - 466.6666666666667) < EPS);
  check("the default construction is possible", g.possible);
  check("the position is plain data", JSON.stringify(C.position(s)).indexOf("function") < 0);
}

/* ------------------------------------- 2. the core against the applet's code */

{
  let radiusOk = true, tangentsOk = true, extrasOk = true, possibleOk = true, intersectionsOk = true;
  let cases = 0;
  // The whole grid of radii and separations the applet can be given by drag.
  for (let ra = 10; ra <= 90; ra += 8) {
    for (let rb = 10; rb <= 90; rb += 8) {
      for (let d = 16; d <= 280; d += 8) {
        // At exact tangency Java's discriminant is zero and its X/Y branch
        // flips on a rounding error; skip that measure-zero set here.
        if (d === Math.abs(ra - rb) || d === ra + rb) continue;
        for (const tilt of [0, 0.37, -1.1]) {
          const s = config(ra, rb, d, tilt);
          const g = C.measure(s);
          const [ca, cb] = circlesOf(s);
          const javaP = javaTangents(cb, ca); // Draw(C2, C1): vertex on A
          const javaQ = javaTangents(ca, cb); // Draw(C1, C2): vertex on B
          const javaExtraA = javaExtraCircle(cb, ca); // Draw(C2, C1): circle inside A
          const javaExtraB = javaExtraCircle(ca, cb); // Draw(C1, C2): circle inside B
          cases++;

          if (Math.abs(g.r - javaExtraA.radius) > EPS || Math.abs(g.r - javaExtraB.radius) > EPS) radiusOk = false;
          if (!samePoints([g.appletCircles[0].centre], [javaExtraA.centre], "extra A") ||
            !samePoints([g.appletCircles[1].centre], [javaExtraB.centre], "extra B")) extrasOk = false;
          if (javaP === null || javaQ === null) {
            if (g.possible) possibleOk = false;
          } else {
            if (!g.possible) possibleOk = false;
            if (!samePoints(g.tangents.fromP, javaP.points, "tangents from P") ||
              !samePoints(g.tangents.fromQ, javaQ.points, "tangents from Q")) tangentsOk = false;
          }
          // The core's circle intersection against the applet's own X/Y branch.
          const probeRadius = javaP ? Math.sqrt((d + ra) ** 2 - rb * rb) : 1;
          const probe = C.circleIntersections(cb, rb, g.P, probeRadius);
          const javaProbe = javaIntersect(cb, { x: g.P.x, y: g.P.y, r: probeRadius });
          if (!!probe.length !== !!javaProbe || (javaProbe && !samePoints(probe, javaProbe, "circle intersection"))) {
            intersectionsOk = false;
          }
        }
      }
    }
  }
  check(`core radius = applet extra-circle radius in all ${cases} configurations`, radiusOk);
  check(`core extra-circle centres = Java bytecode centres in all ${cases} configurations`, extrasOk);
  check(`core tangents = Java DrawTangents in all ${cases} configurations`, tangentsOk);
  check("core's possible flag = null returned by Java DrawTangents", possibleOk);
  check("core circle intersection = GeoSDoub's X/Y branch", intersectionsOk);
}

/* ------------------------------------------- 3. the page's claim, exhaustively */

{
  let formulaOk = true, symmetricOk = true, equalRadiiOk = true, tangentToLinesOk = true;
  let internalOk = true, ratioOk = true, impossibleOk = true, conditionOk = true;
  let possibleCases = 0, impossibleCases = 0;
  for (let ra = 10; ra <= 90; ra += 4) {
    for (let rb = 10; rb <= 90; rb += 4) {
      for (let d = 12; d <= 280; d += 4) {
        for (const tilt of [0, 0.83]) {
          const s = config(ra, rb, d, tilt);
          const g = C.measure(s);
          if (Math.abs(g.r - (2 * ra * rb) / (ra + rb + d)) > EPS) formulaOk = false;
          if (Math.abs(C.incircleRadius(ra, rb, d) - C.incircleRadius(rb, ra, d)) > EPS) symmetricOk = false;
          if (Math.abs(g.incircles[0].radius - g.incircles[1].radius) > EPS) equalRadiiOk = false;
          if (d > Math.abs(ra - rb) + EPS) {
            possibleCases++;
            if (!g.possible) conditionOk = false;
            if (g.tangents.fromP.length !== 2 || g.tangents.fromQ.length !== 2) conditionOk = false;
            if (g.r > Math.min(ra, rb) + EPS) impossibleOk = false;
            // Each small circle touches its own circle from inside, and the
            // two tangents from the far point: the page's "incircle".
            const [ca, cb] = [g.incircles[0], g.incircles[1]];
            if (Math.abs(dist(ca.centre, g.A) - (ra - g.r)) > EPS ||
              Math.abs(dist(cb.centre, g.B) - (rb - g.r)) > EPS) internalOk = false;
            if (Math.abs(dist(g.P, ca.centre) - (2 * ra - g.r)) > EPS ||
              Math.abs(dist(g.Q, cb.centre) - (2 * rb - g.r)) > EPS) ratioOk = false;
            for (const T of g.tangents.fromP) {
              if (Math.abs(lineDistance(ca.centre, g.P, T) - g.r) > 1e-5) tangentToLinesOk = false;
            }
            for (const T of g.tangents.fromQ) {
              if (Math.abs(lineDistance(cb.centre, g.Q, T) - g.r) > 1e-5) tangentToLinesOk = false;
            }
            // PB / BT = PR / RS, the page's own similarity step.
            const lhs = (d + ra) / rb, rhs = dist(g.P, ca.centre) / g.r;
            if (Math.abs(lhs - rhs) > 1e-5) ratioOk = false;
          } else {
            impossibleCases++;
            if (d < Math.abs(ra - rb) - EPS && g.possible) conditionOk = false;
            if (d < Math.abs(ra - rb) - EPS && g.r <= Math.min(ra, rb)) impossibleOk = false;
          }
        }
      }
    }
  }
  check(`page formula r = 2 RA RB/(RA+RB+AB) in all ${possibleCases + impossibleCases} cases`, formulaOk);
  check("the formula is symmetric in A and B", symmetricOk);
  check(`the two radii are equal in all ${possibleCases} drawable cases`, equalRadiiOk);
  check("tangents exist exactly when d > |RA - RB|", conditionOk);
  check("when no tangents exist the formula radius exceeds the smaller circle", impossibleOk);
  check("each small circle is internally tangent to its own circle", internalOk);
  check("PR = 2 RA - RS and PB/BT = PR/RS (the page's similarity)", ratioOk);
  check("each small circle is tangent to both tangents from the far point", tangentToLinesOk);
}

/* ------------------------------------------------- 4. moving the four points */

{
  const s = C.start({});
  const moved = C.setPoint(s, "A", { x: 160, y: 200 });
  const g0 = C.measure(s), g1 = C.measure(moved);
  check("dragging centre A keeps its radius", Math.abs(g1.ra - g0.ra) < EPS);
  check("dragging centre A moves its boundary point by the same amount",
    Math.abs(s.boundaryA.x - moved.boundaryA.x - 40) < EPS);
  check("dragging centre A leaves circle B alone", moved.B.x === s.B.x && moved.boundaryB.x === s.boundaryB.x);
  check("the original state is not changed", s.A.x === 200 && s.boundaryA.x === 200 - 200 / 3);

  const resized = C.setPoint(s, "boundaryB", { x: s.B.x + 120, y: 200 });
  check("dragging the boundary point changes only RB", Math.abs(C.measure(resized).rb - 120) < EPS &&
    Math.abs(C.measure(resized).ra - g0.ra) < EPS);
  check("resizing B changes the common radius", Math.abs(C.measure(resized).r - C.incircleRadius(g0.ra, 120, g0.d)) < EPS);
  check("a boundary point cannot collapse the circle", C.setPoint(s, "boundaryB", s.B) === s);
  equal("reset restores the applet's starting position", C.reset(moved), s);

  const nested = config(90, 10, 20, 0);
  check("nested circles have no tangents", !C.measure(nested).possible);
  const coincident = config(50, 30, 0, 0);
  check("coincident centres are handled without NaN", !C.measure(coincident).possible &&
    Number.isFinite(C.measure(coincident).r));
  check("the default radius is not Eyeball's AB/2", Math.abs(g0.r - g0.d / 2) > 1);
}

done("eyeball-2");
