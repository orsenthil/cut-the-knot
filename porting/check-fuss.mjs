#!/usr/bin/env node
"use strict";

/*
 * Logic test for fuss/fuss-core.js.
 *
 *   node porting/check-fuss.mjs
 *
 * The page's exact claim is Fuss' relation for a bicentric quadrilateral,
 *
 *     1/(R - d)^2 + 1/(R + d)^2 = 1/r^2.
 *
 * It is checked for every slider position the applet allows (d = 0 ..
 * floor(0.8R)) at many outer radii and, at the applet's own size, for every
 * whole degree of the dragged corner A.  The test also checks that the four
 * constructed sides are really tangent, that the quadrilateral closes on A
 * (Poncelet's porism), and that the crossing P of the contact diagonals is
 * fixed and has the value the construction gives.  Finally the core is
 * compared with a second, literal transcription of the applet's bytecode:
 * GeoSDoub.Intersect (circle/circle and line/circle), FindOrientation,
 * NearestPoint, Other, ComputeTangents and FussCanvas.Compute.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("fuss/fuss-core.js", "FussCore");

/* --------------------------------- a second transcription of the bytecode */

const P = (x, y) => ({ x, y });
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const add = (a, b) => P(a.x + b.x, a.y + b.y);
const mul = (a, t) => P(a.x * t, a.y * t);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const maxErr = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// GeoSDoub.FindOrientation: 1 when c is left of a->b, else -1 (never 0).
function orientation(a, b, c) {
  const v = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return v > 0 ? 1 : -1;
}

// GeoSDoub.IntersectCirclesX: x = m*y + b, root 0 uses +sqrt(disc).
function circlesX(c0, r0, c1, r1) {
  const m = -(c0.y - c1.y) / (c0.x - c1.x);
  const b = (c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y - r0 * r0 + r1 * r1) /
            (2 * (c0.x - c1.x));
  const h = b - c0.x;
  const A = m * m + 1;
  const B = m * h - c0.y;
  const Cc = h * h + c0.y * c0.y - r0 * r0;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-B + s) / A, t1 = (-B - s) / A;
  return [P(m * t0 + b, t0), P(m * t1 + b, t1)];
}

// GeoSDoub.IntersectCirclesY: y = m*x + b, root 0 uses +sqrt(disc).
function circlesY(c0, r0, c1, r1) {
  const m = -(c0.x - c1.x) / (c0.y - c1.y);
  const b = (c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x - r0 * r0 + r1 * r1) /
            (2 * (c0.y - c1.y));
  const h = b - c0.y;
  const A = m * m + 1;
  const B = m * h - c0.x;
  const Cc = h * h + c0.x * c0.x - r0 * r0;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-B + s) / A, t1 = (-B - s) / A;
  return [P(t0, m * t0 + b), P(t1, m * t1 + b)];
}

// GeoSDoub.Intersect(DoubCircle, DoubCircle), including its 1-unit branches.
function circlesIntersect(c0, r0, c1, r1) {
  if (Math.abs(c0.x - c1.x) > 1) return circlesX(c0, r0, c1, r1);
  if (Math.abs(c0.y - c1.y) > 1) return circlesY(c0, r0, c1, r1);
  return [P(c0.x, c0.y), P(c0.x, c0.y)];
}

// FussCanvas.TangentFrom: meet the circle about p with the inner circle.
function tangentFromApplet(p, circle) {
  const t = Math.sqrt(sqDist(p, circle.c) - circle.r * circle.r);
  const pts = circlesIntersect(P(p.x, p.y), t, circle.c, circle.r);
  if (!pts) return null;
  return orientation(p, pts[0], circle.c) > 0 ? pts[0] : pts[1];
}

// GeoSDoub.IntersectX(DoubLine, DoubCircle): x = m*y + b.
function lineCircleX(a, b, circle) {
  const m = (a.x - b.x) / (a.y - b.y);
  const h = b.x - m * b.y;
  const A = m * m + 1;
  const B = m * (h - circle.c.x) - circle.c.y;
  const Cc = circle.c.y * circle.c.y + (h - circle.c.x) ** 2 - circle.r * circle.r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-B + s) / A, t1 = (-B - s) / A;
  return [P(m * t0 + h, t0), P(m * t1 + h, t1)];
}

// GeoSDoub.IntersectY(DoubLine, DoubCircle): y = m*x + b.
function lineCircleY(a, b, circle) {
  const m = (a.y - b.y) / (a.x - b.x);
  const h = b.y - m * b.x;
  const A = m * m + 1;
  const B = m * (h - circle.c.y) - circle.c.x;
  const Cc = circle.c.x * circle.c.x + (h - circle.c.y) ** 2 - circle.r * circle.r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t0 = (-B + s) / A, t1 = (-B - s) / A;
  return [P(t0, m * t0 + h), P(t1, m * t1 + h)];
}

function lineCircleIntersect(a, b, circle) {
  if (Math.abs(a.y - b.y) > 1) return lineCircleX(a, b, circle);
  if (Math.abs(a.x - b.x) > 1) return lineCircleY(a, b, circle);
  return null;
}

// FussCanvas.Other: the intersection that is not the current corner.
function other(points, vertex) {
  return dist(points[0], vertex) < 1 ? points[1] : points[0];
}

// GeoSDoub.NearestPoint(circle, line) - the foot on a side of the quadrilateral.
function nearestOnSide(centre, a, b) {
  if (sqDist(a, centre) < 0.1) return P(centre.x, centre.y);
  const v = sub(b, a);
  const t = dot(sub(centre, a), v) / dot(v, v);
  return add(a, mul(v, t));
}

// GeoSDoub.Intersect(DoubPoint x4), with the bytecode's 1-unit degeneracy test.
function intersectFourLines(a, b, c, d) {
  const x1 = a.y - b.y, x2 = b.x - a.x, x3 = a.x * b.y - a.y * b.x;
  const y1 = c.y - d.y, y2 = d.x - c.x, y3 = c.x * d.y - c.y * d.x;
  const den = x1 * y2 - y1 * x2;
  if (Math.abs(den) < 1) return P(NaN, NaN);
  return P((x2 * y3 - y2 * x3) / den, (x3 * y1 - y3 * x1) / den);
}

/** FussCanvas.Compute() + ComputeTangents(), straight from the bytecode. */
function appletGeometry(R, d, angle) {
  const O = P(C.CENTER.x, C.CENTER.y);
  // The applet's stack arithmetic for 1/sqrt(1/(R+d)^2 + 1/(R-d)^2).
  const one = 1;
  const plus = one / (R + d) / (R + d);
  const minus = one / (R - d) / (R - d);
  const r = Math.sqrt(one / (plus + minus));
  const I = { c: P(O.x + d, O.y), r: r };
  const outer = { c: O, r: R };
  const v = [P(O.x + R * Math.cos(angle), O.y + R * Math.sin(angle))];
  const tangents = [];
  for (let i = 0; i < 4; i++) {
    const t = tangentFromApplet(v[i], I);
    if (!t) return null;
    tangents.push(t);
    const pts = lineCircleIntersect(v[i], t, outer);
    if (!pts) return null;
    v.push(other(pts, v[i]));
  }
  const K = nearestOnSide(I.c, v[0], v[1]);
  const L = nearestOnSide(I.c, v[1], v[2]);
  const M = nearestOnSide(I.c, v[2], v[3]);
  const N = nearestOnSide(I.c, v[3], v[0]);
  const pointP = intersectFourLines(K, M, L, N);
  return { O, R, I, vertices: v.slice(0, 4), tangents, touch: [K, L, M, N], P: pointP };
}

/* ------------------------------------------------------ 1. the applet's UI */

{
  const s = C.start({});
  equal("the applet's outer radius at 400x300", s.radius, 50);
  equal("the slider starts at 40", s.d, 40);
  equal("the slider maximum is (int)(0.8R)", C.maxDistance(s.radius), 40);
  check("both checkboxes start unticked", s.names === false && s.diagonals === false);
  check("a fresh demo is not yet finished", C.result(s) === null);
  check("A starts on the circumcircle",
    Math.abs(C.dist(s.center, C.point(s.center.x + s.radius * Math.cos(s.angle),
                                     s.center.y + s.radius * Math.sin(s.angle))) - s.radius) < 1e-12);
}

/* -------------------------------------------- 2. the formula on the page */

let worstClaim = 0;
let claimCases = 0;
for (let R = 20; R <= 100; R++) {
  for (let d = 0; d <= C.maxDistance(R); d++) {
    const g = C.geometry(C.start({ radius: R, d, angle: 0.3 }));
    worstClaim = Math.max(worstClaim, Math.abs(g.formulaSum - g.inverseRSquared));
    claimCases++;
  }
}
check(`Fuss' relation holds for all ${claimCases} slider/radius pairs`, worstClaim < 1e-9,
      `worst error ${worstClaim}`);

// At the applet's own size the dragged corner sweeps every whole degree.
let worstDegree = 0;
for (let deg = 0; deg < 360; deg++) {
  for (let d = 0; d <= 40; d++) {
    const g = C.geometry(C.start({ radius: 50, d, angle: deg * Math.PI / 180 }));
    worstDegree = Math.max(worstDegree, Math.abs(g.formulaSum - g.inverseRSquared));
  }
}
check("the relation holds for every degree of A at every slider position", worstDegree < 1e-9,
      `worst error ${worstDegree}`);

/* ------------------------------------ 3. the geometry the relation creates */

let worstCircle = 0, worstTangent = 0, worstTouch = 0, worstClosure = 0;
for (let R = 20; R <= 100; R += 4) {
  for (let d = 0; d <= C.maxDistance(R); d++) {
    for (let k = 0; k < 24; k++) {
      const state = C.start({ radius: R, d, angle: k * Math.PI / 12 });
      const g = C.geometry(state);
      for (const v of g.vertices) worstCircle = Math.max(worstCircle, Math.abs(C.dist(v, g.outer.c) - R));
      for (let i = 0; i < 4; i++) {
        const a = g.vertices[i], b = g.vertices[(i + 1) % 4];
        worstTangent = Math.max(worstTangent, Math.abs(C.dist(g.inner.c, a) > 0
          ? Math.abs((g.inner.c.x - a.x) * (b.y - a.y) - (g.inner.c.y - a.y) * (b.x - a.x)) /
            C.dist(a, b) - g.inner.r : 0));
        worstTouch = Math.max(worstTouch, Math.abs(C.dist(g.touch[i], g.inner.c) - g.inner.r));
      }
      // Poncelet's porism: the fourth tangent takes us back to A.
      worstClosure = Math.max(worstClosure, g.closureError);
    }
  }
}
check("all four corners lie on the circumcircle", worstCircle < 1e-8, `worst error ${worstCircle}`);
check("all four sides touch the incircle", worstTangent < 1e-8, `worst error ${worstTangent}`);
check("K, L, M, N lie on the incircle", worstTouch < 1e-8, `worst error ${worstTouch}`);
check("the bicentric quadrilateral closes on A (Poncelet)", worstClosure < 1e-7,
      `worst closing gap ${worstClosure}`);

/* ------------------------ 4. P is fixed, as the porism predicts */

let worstP = 0, worstPFormula = 0;
for (const R of [25, 50, 80]) {
  for (let d = 0; d <= C.maxDistance(R); d++) {
    const first = C.geometry(C.start({ radius: R, d, angle: 0 }));
    for (let k = 1; k < 36; k++) {
      const g = C.geometry(C.start({ radius: R, d, angle: k * Math.PI / 18 }));
      worstP = Math.max(worstP, C.dist(g.P, first.P));
    }
    // The contact-diagonal crossing lies on OI, 2dR^2/(R^2+d^2) from O.
    const expected = P(C.CENTER.x + 2 * d * R * R / (R * R + d * d), C.CENTER.y);
    worstPFormula = Math.max(worstPFormula, C.dist(first.P, expected));
  }
}
check("P does not move when A is dragged", worstP < 1e-7, `worst spread ${worstP}`);
check("P lies on OI at 2dR^2/(R^2+d^2)", worstPFormula < 1e-7, `worst error ${worstPFormula}`);

/* ------------------- 5. core against the applet's own bytecode, exhaustively */

let worstR = 0, worstV = 0, worstT = 0, worstK = 0, worstPointP = 0;
let compared = 0, shortSegments = 0, coreFailures = 0, appletNull = 0;
for (let R = 20; R <= 100; R++) {
  for (let d = 0; d <= C.maxDistance(R); d++) {
    for (let k = 0; k < 36; k++) {
      const angle = k * Math.PI / 18;
      const g = C.geometry(C.start({ radius: R, d, angle }));
      const a = appletGeometry(R, d, angle);
      if (!g) { coreFailures++; continue; }
      if (!a) {
        appletNull++;
        // GeoSDoub.Intersect(DoubLine, DoubCircle) returns null when both
        // coordinate differences are <= 1: a tangent shorter than a pixel.
        // The core solves the same quadratic without that screen-space cut.
        const shortest = Math.min(...g.tangents.map((t, i) => C.dist(t, g.vertices[i])));
        if (shortest < 1.5) shortSegments++;
        continue;
      }
      compared++;
      worstR = Math.max(worstR, Math.abs(g.inner.r - a.I.r));
      for (let i = 0; i < 4; i++) {
        worstV = Math.max(worstV, maxErr(g.vertices[i], a.vertices[i]));
        worstT = Math.max(worstT, maxErr(g.tangents[i], a.tangents[i]));
        worstK = Math.max(worstK, maxErr(g.touch[i], a.touch[i]));
      }
      worstPointP = Math.max(worstPointP, maxErr(g.P, a.P));
    }
  }
}
check("the core constructs a drawing on every configuration", coreFailures === 0,
      `${coreFailures} failures`);
check("every place the applet's helper quits has a sub-pixel tangent", appletNull > 0 &&
      shortSegments === appletNull,
      `${shortSegments} of ${appletNull} short-tangent cases, ${compared} comparable cases`);
check(`${compared} configurations: identical inner radius`, worstR < 1e-8, `worst error ${worstR}`);
check(`${compared} configurations: identical A, B, C, D`, worstV < 1e-7, `worst error ${worstV}`);
check(`${compared} configurations: identical tangent points`, worstT < 1e-7, `worst error ${worstT}`);
check(`${compared} configurations: identical K, L, M, N`, worstK < 1e-7, `worst error ${worstK}`);
check(`${compared} configurations: identical P`, worstPointP < 1e-7, `worst error ${worstPointP}`);

/* -------------------------------------------- 6. moves, options and edges */

{
  const s = C.start({ radius: 50, d: 40 });
  equal("the slider refuses values above its maximum", C.setDistance(s, 100).d, 40);
  equal("the slider refuses negative values", C.setDistance(s, -7).d, 0);
  equal("an integer slider keeps whole positions", C.setDistance(s, 17.6).d, 18);
  const dragged = C.movePoint(s, { x: 260, y: 180 });
  const snapped = C.onCircle(s, { x: 260, y: 180 });
  const draggedPoint = P(s.center.x + s.radius * Math.cos(dragged.angle),
                         s.center.y + s.radius * Math.sin(dragged.angle));
  check("a drag snaps to the circumcircle", C.dist(draggedPoint, snapped) < 1e-9);
  check("unknown moves are refused", C.move(s, { type: "nonsense" }) === null);
  const named = C.setOption(s, "names", true);
  check("ticking names keeps the position", named.names && named.d === s.d && named.angle === s.angle);
  check("a reset keeps the slider and the tickboxes",
    C.reset(named).d === 40 && C.reset(named).names === true);
  const moved = C.setDistance(s, 12);
  check("an explored demo reports 'done'", C.result(moved) === "done");
  check("a tick alone does not finish the demo", C.result(named) === null);
  const d0 = C.geometry(C.start({ d: 0, radius: 50 }));
  check("concentric circles make a square",
    Math.abs(C.dist(d0.vertices[0], d0.vertices[2]) - 2 * 50) < 1e-8 ||
    Math.abs(C.dist(d0.vertices[1], d0.vertices[3]) - 2 * 50) < 1e-8);
  check("the status line speaks in words", /Outer radius/.test(C.describe(moved)));
}

done("fuss");
