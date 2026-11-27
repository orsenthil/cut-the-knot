#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-circles-in-triangle/four-circles-in-triangle-core.js.
 *
 *   node porting/check-four-circles-in-triangle.mjs
 *
 * The cut-the-knot page states one theorem: given the incircle and three
 * circles in the corners that touch it and the two sides at that corner, the
 * three lines joining opposite tangency points concur. This test checks that
 * claim over hundreds of triangles, and also checks that the tangencies
 * really hold. Section 3 is a second, literal transcription of the applet's
 * own bytecode methods (FindIncenter, GetIncircle, GetTouchingCircle,
 * FindCommonPoint, FindAltitude, Intersect and Solve2); every triangle is run
 * through both implementations and compared.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "four-circles-in-triangle/four-circles-in-triangle-core.js",
  "FourCirclesInTriangleCore",
);

const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const closePoint = (p, q, tol = 1e-7) => isFinite(p.x) && isFinite(p.y) &&
  Math.hypot(p.x - q.x, p.y - q.y) <= tol;

/* ------------------------------------------------------------------ helpers */

let max = (acc, value) => Math.max(acc, Number.isFinite(value) ? value : Infinity);

function triangleArea(a, b, c) {
  return Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}

function inradiusFromSides(v) {
  const a = C.dist(v[1], v[2]), b = C.dist(v[2], v[0]), c = C.dist(v[0], v[1]);
  const s = (a + b + c) / 2;
  const product = (s - a) * (s - b) * (s - c);
  return product > 0 ? Math.sqrt(product / s) : 0;
}

function triangles() {
  const data = [];
  data.push(["applet Reset", C.start({}).vertices]);
  data.push(["right", [{ x: 40, y: 220 }, { x: 40, y: 40 }, { x: 320, y: 40 }]]);
  data.push(["near equilateral", [{ x: 180, y: 20 }, { x: 24, y: 250 }, { x: 336, y: 250 }]]);
  data.push(["obtuse", [{ x: 30, y: 220 }, { x: 170, y: 30 }, { x: 330, y: 220 }]]);
  data.push(["skinny", [{ x: 20, y: 30 }, { x: 340, y: 210 }, { x: 340, y: 215 }]]);
  const random = rng(20261127);
  for (let i = 0; i < 240; i++) {
    const v = [];
    for (let k = 0; k < 3; k++) {
      v.push({ x: 10 + random() * 340, y: 10 + random() * 240 });
    }
    if (triangleArea(v[0], v[1], v[2]) < 120) { i--; continue; }
    data.push(["random " + i, v]);
  }
  return data;
}

const SAMPLES = triangles();

/* The applet's Solve2 refuses |a| < 0.01, which happens when a vertex angle is
 * almost 180 degrees (the incenter is then almost a radius from that vertex).
 * Those triangles make ShowCircles return early; keep them in the comparison
 * with the bytecode, but only assert the theorem where the applet draws. */
const DRAWABLE = SAMPLES.filter(([, v]) => {
  const inc = C.getIncircle(v);
  return inc && inc.radius >= 0.5 && [0, 1, 2].every((k) =>
    C.getTouchingCircle(v[(k + 2) % 3], inc, v[k], inc.center));
});

/* ------------------------------------- a second transcription of the bytecode */

const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

/** GeoSDoub.ComputeAngle(a,b,c): the angle at a. */
function angleAt(a, b, c) {
  const cosine = (sq(a, b) + sq(a, c) - sq(b, c)) /
    (2 * Math.hypot(a.x - b.x, a.y - b.y) * Math.hypot(a.x - c.x, a.y - c.y));
  return Math.acos(Math.min(1, Math.max(-1, cosine)));
}

/** GeoSDoub.FindOrientation(a,b,c), including its +1/-1 (never zero) choice. */
function orientation(a, b, c) {
  const cross = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - a.y * b.x;
  return cross > 0 ? 1 : -1;
}

/** GeoSDoub.Rotate(pivot, point, theta, sign). */
function rotate(pivot, point, theta, sign) {
  const co = Math.cos(theta), si = Math.sin(theta);
  const dx = point.x - pivot.x, dy = point.y - pivot.y;
  return {
    x: pivot.x + co * dx - sign * si * dy,
    y: pivot.y + sign * si * dx + co * dy,
  };
}

/** GeoSDoub.Intersect of two lines, transcribed instruction by instruction. */
function bytecodeIntersect(a, b, c, d) {
  const rx = a.y - b.y;
  const sx = b.x - a.x;
  const q = a.x * b.y - a.y * b.x;
  const ry = c.y - d.y;
  const sy = d.x - c.x;
  const r = c.x * d.y - c.y * d.x;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (sx * r - sy * q) / den, y: (q * ry - r * rx) / den };
}

/** GeoSDoub.FindIncenter: two rotated side rays, then intersect. */
function bytecodeIncenter(v) {
  const a = angleAt(v[0], v[1], v[2]) / 2;
  const b = angleAt(v[1], v[2], v[0]) / 2;
  const sign = orientation(v[0], v[1], v[2]);
  const ray1 = rotate(v[0], v[1], a, sign);
  const ray2 = rotate(v[1], v[2], b, sign);
  return bytecodeIntersect(v[0], ray1, v[1], ray2);
}

/** GeoSDoub.NearestPoint(p,a,b), with the applet's 0.1 guard. */
function bytecodeNearest(p, a, b) {
  if (sq(a, p) < 0.1) return { x: p.x, y: p.y };
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** GeoSDoub.FindAltitude(p,a,b). */
function bytecodeAltitude(p, a, b) {
  const q = { x: p.x + b.y - a.y, y: p.y - b.x + a.x };
  return bytecodeIntersect(p, q, a, b);
}

/** GetIncircle from FourCirclesInTriangleCanvas. */
function bytecodeIncircle(v) {
  const center = bytecodeIncenter(v);
  const foot = bytecodeNearest(center, v[0], v[1]);
  const d = Math.hypot(center.x - foot.x, center.y - foot.y);
  return { center, radius: (d + d + d) / 3 };
}

/** QuadraticEquation.Solve2, including both early returns. */
function bytecodeSolve2(a, b, c) {
  if (Math.abs(a) < 0.01) return null;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  return [(-b + root) / a, (-b - root) / a];
}

/** GetTouchingCircle from the applet canvas. */
function bytecodeTouching(sideMate, inc, corner, guide) {
  const d = Math.hypot(
    guide.x - bytecodeNearest(guide, corner, sideMate).x,
    guide.y - bytecodeNearest(guide, corner, sideMate).y,
  );
  const ux = guide.x - corner.x, uy = guide.y - corner.y;
  const a = ux * ux + uy * uy - d * d;
  const b = ux * (corner.x - inc.center.x) + uy * (corner.y - inc.center.y) - inc.radius * d;
  const c = sq(corner, inc.center) - inc.radius * inc.radius;
  const roots = bytecodeSolve2(a, b, c);
  if (!roots || Number.isNaN(roots[0]) || Number.isNaN(roots[1])) return null;
  let t = -1;
  if (roots[0] >= 0 && roots[0] <= 1) t = roots[0];
  if (t < 0) {
    if (roots[1] >= 0 && roots[1] <= 1) t = roots[1];
    else return null;
  }
  const center = { x: corner.x + t * (guide.x - corner.x), y: corner.y + t * (guide.y - corner.y) };
  return { center, radius: d * t, ratio: t, roots };
}

/** FindCommonPoint(c1,c2): weighted average by the other circle's radius. */
function bytecodeCommon(c1, c2) {
  const sum = c1.radius + c2.radius;
  return {
    x: (c1.center.x * c2.radius + c2.center.x * c1.radius) / sum,
    y: (c1.center.y * c2.radius + c2.center.y * c1.radius) / sum,
  };
}

/** A full ShowCircles computation, straight from the disassembly. */
function bytecodeDiagram(v) {
  const inc = bytecodeIncircle(v);
  const circles = [
    bytecodeTouching(v[2], inc, v[0], inc.center),
    bytecodeTouching(v[0], inc, v[1], inc.center),
    bytecodeTouching(v[1], inc, v[2], inc.center),
  ];
  if (!inc || circles.some((c) => !c) || inc.radius < 0.5) return null;
  const feet = [
    bytecodeAltitude(inc.center, v[1], v[2]),
    bytecodeAltitude(inc.center, v[2], v[0]),
    bytecodeAltitude(inc.center, v[0], v[1]),
  ];
  const touch = circles.map((c) => bytecodeCommon(inc, c));
  const lines = feet.map((f, i) => ({ a: f, b: touch[i] }));
  return {
    inc, circles, feet, touch, lines,
    meeting: bytecodeIntersect(lines[0].a, lines[0].b, lines[1].a, lines[1].b),
  };
}

/* ------------------------------------------------------------ 1. the starting board */

{
  const s = C.start({});
  equal("Reset uses the applet's first vertex (W/2, 20)", s.vertices[0], { x: 180, y: 20 });
  equal("Reset uses the applet's second vertex (W/8, H-20)", s.vertices[1], { x: 45, y: 240 });
  equal("Reset uses the applet's third vertex (7W/8, 4H/5)", s.vertices[2], { x: 315, y: 208 });
  const d = C.diagram(s);
  check("the default triangle draws all four circles", d.visible && d.circles.length === 3);
}

/* ---------------------- 2. incenter and inradius against the bytecode method */

{
  let worst = 0;
  for (const [label, v] of SAMPLES) {
    const actual = C.incenter(v);
    const expected = bytecodeIncenter(v);
    worst = max(worst, Math.hypot(actual.x - expected.x, actual.y - expected.y));
    if (!closePoint(actual, expected, 1e-7)) {
      check("incenter: " + label, false, `${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
    }
  }
  check("FindIncenter: core matches the two rotated bisectors in all triangles", worst < 1e-7,
    "worst " + worst);
}

{
  let worst = 0;
  for (const [label, v] of SAMPLES) {
    const inc = C.getIncircle(v);
    const expected = bytecodeIncircle(v);
    worst = max(worst, Math.hypot(
      inc.center.x - expected.center.x, inc.center.y - expected.center.y,
    ), Math.abs(inc.radius - expected.radius));
    if (!closePoint(inc.center, expected.center, 1e-7) || !near(inc.radius, expected.radius)) {
      check("incircle: " + label, false);
    }
  }
  check("GetIncircle matches the applet's triple-averaged side distance", worst < 1e-7,
    "worst " + worst);
}

{
  let worst = 0;
  for (const [, v] of SAMPLES) {
    worst = max(worst, Math.abs(C.getIncircle(v).radius - inradiusFromSides(v)));
  }
  check("the inradius also equals area/semiperimeter", worst < 1e-7, "worst " + worst);
}

/* ------------------- 3. GetTouchingCircle: second transcription over all samples */

{
  let worst = 0;
  let nulls = 0;
  for (const [label, v] of SAMPLES) {
    const inc = bytecodeIncircle(v);
    for (let k = 0; k < 3; k++) {
      const actual = C.getTouchingCircle(v[(k + 2) % 3], C.getIncircle(v), v[k], inc.center);
      const expected = bytecodeTouching(v[(k + 2) % 3], inc, v[k], inc.center);
      if (!actual || !expected) {
        nulls++;
        if (!!actual !== !!expected) check("touching circle null: " + label + " " + k, false);
        continue;
      }
      worst = max(worst, Math.hypot(
        actual.center.x - expected.center.x, actual.center.y - expected.center.y,
      ), Math.abs(actual.radius - expected.radius), Math.abs(actual.ratio - expected.ratio));
    }
  }
  check("GetTouchingCircle matches the quadratic root selection everywhere", worst < 1e-7,
    `worst ${worst}, ${nulls} rejected circles`);
  check("most sampled triangles draw all three corner circles", DRAWABLE.length >= SAMPLES.length - 10,
    `${DRAWABLE.length} of ${SAMPLES.length} drawable`);
}

{
  let worst = 0;
  for (const [, v] of DRAWABLE) {
    const inc = C.getIncircle(v);
    for (let k = 0; k < 3; k++) {
      const c = C.getTouchingCircle(v[(k + 2) % 3], inc, v[k], inc.center);
      const roots = bytecodeTouching(v[(k + 2) % 3], inc, v[k], inc.center).roots;
      worst = max(worst, Math.abs(c.ratio - Math.min(...roots)));
    }
  }
  check("the chosen root is always the one in [0, 1]", worst < 1e-9, "worst " + worst);
}

/* --------------------------------------- 4. the tangencies the page describes */

{
  let worst = 0;
  for (const [, v] of DRAWABLE) {
    const d = C.diagram({ vertices: v, width: 360, height: 260 });
    const inc = d.incircle;
    for (let k = 0; k < 3; k++) {
      const c = d.circles[k];
      const corner = v[k];
      const D = C.dist(corner, inc.center);
      worst = max(worst,
        Math.abs(C.dist(c.center, inc.center) - (inc.radius + c.radius)), // external tangency
        Math.abs(c.radius - C.lineDistance(c.center, corner, v[(k + 1) % 3])),
        Math.abs(c.radius - C.lineDistance(c.center, corner, v[(k + 2) % 3])),
        Math.abs(c.radius - inc.radius * c.ratio),                      // homothety
        Math.abs(D * (1 - c.ratio) - (inc.radius + c.radius)) / D,
        Math.abs(C.dist(d.touch[k], inc.center) - inc.radius),
        Math.abs(C.dist(d.touch[k], c.center) - c.radius));
    }
  }
  check("each corner circle touches both adjacent sides and the incircle", worst < 1e-6,
    "worst " + worst);
}

/* ------------------------------------ 5. the page's claim: the three lines meet */

{
  let worst = 0;
  let worstPoint = 0;
  for (const [label, v] of DRAWABLE) {
    const d = C.diagram({ vertices: v, width: 360, height: 260 });
    const expected = bytecodeDiagram(v);
    if (!d.visible || !expected) {
      check("diagram exists: " + label, false);
      continue;
    }
    worst = max(worst, C.lineDistance(d.meeting, d.lines[2].a, d.lines[2].b));
    worstPoint = max(worstPoint, Math.hypot(
      d.meeting.x - expected.meeting.x, d.meeting.y - expected.meeting.y,
    ));
    for (let k = 0; k < 3; k++) {
      worst = max(worst,
        Math.hypot(d.feet[k].x - expected.feet[k].x, d.feet[k].y - expected.feet[k].y),
        Math.hypot(d.touch[k].x - expected.touch[k].x, d.touch[k].y - expected.touch[k].y),
        C.lineDistance(d.meeting, d.lines[k].a, d.lines[k].b));
    }
  }
  check("all three joining lines pass through one point in every triangle", worst < 1e-6,
    "worst off-line distance " + worst);
  check("ShowCircles' two-line intersection matches the bytecode", worstPoint < 1e-7,
    "worst point difference " + worstPoint);
}

/* ------------------------- 6. why they meet: the contact triangle's incenter */

{
  let worst = 0;
  let arcWorst = 0;
  let angleWorst = 0;
  for (const [, v] of DRAWABLE) {
    const d = C.diagram({ vertices: v, width: 360, height: 260 });
    const F = d.feet;
    const contactIncenter = C.incenter(F);
    // A point of the contact triangle and the arc midpoint opposite it.
    for (let k = 0; k < 3; k++) {
      // The tangency point lies on the incircle, equally far from the two
      // neighbouring side contact points: it is the arc midpoint.
      arcWorst = max(arcWorst,
        Math.abs(C.dist(d.touch[k], d.incircle.center) - d.incircle.radius),
        Math.abs(C.dist(d.touch[k], F[(k + 1) % 3]) - C.dist(d.touch[k], F[(k + 2) % 3])));
      // The join is therefore the angle bisector at F[k]. Compare the two
      // angles between the join and the sides of the contact triangle.
      const toJoin = { x: d.touch[k].x - F[k].x, y: d.touch[k].y - F[k].y };
      const u1 = { x: F[(k + 1) % 3].x - F[k].x, y: F[(k + 1) % 3].y - F[k].y };
      const u2 = { x: F[(k + 2) % 3].x - F[k].x, y: F[(k + 2) % 3].y - F[k].y };
      const cos1 = (toJoin.x * u1.x + toJoin.y * u1.y) / (Math.hypot(toJoin.x, toJoin.y) * Math.hypot(u1.x, u1.y));
      const cos2 = (toJoin.x * u2.x + toJoin.y * u2.y) / (Math.hypot(toJoin.x, toJoin.y) * Math.hypot(u2.x, u2.y));
      angleWorst = max(angleWorst, Math.abs(cos1 - cos2));
    }
    worst = max(worst, Math.hypot(
      d.meeting.x - contactIncenter.x, d.meeting.y - contactIncenter.y,
    ));
  }
  check("the meeting point is the incenter of the contact triangle", worst < 1e-6,
    "worst " + worst);
  check("each tangency point is the midpoint of the opposite contact arc", arcWorst < 1e-6,
    "worst " + arcWorst);
  check("each joining line bisects an angle of the contact triangle", angleWorst < 1e-6,
    "worst " + angleWorst);
}

/* -------------------------------------------- 7. the applet's drawing guards */

{
  check("Solve2 refuses |a| below 0.01", C.solve2(0.005, 1, 1) === null &&
    bytecodeSolve2(0.005, 1, 1) === null);
  check("Solve2 refuses a negative discriminant", C.solve2(1, 0, 1) === null &&
    bytecodeSolve2(1, 0, 1) === null);
  check("Solve2 agrees with the bytecode on ordinary roots", (() => {
    const a = C.solve2(1, -3, 2), b = bytecodeSolve2(1, -3, 2);
    return a && b && a.every((v, i) => near(v, b[i]));
  })());

  const tiny = {
    ...C.start({}),
    vertices: [{ x: 100, y: 100 }, { x: 102, y: 100 }, { x: 101, y: 101 }],
  };
  check("a triangle smaller than half a unit is not drawn", !C.diagram(tiny).visible);

  const collapsed = C.setVertex(C.setVertex(C.start({}), 0, { x: 100, y: 100 }), 1, { x: 100, y: 100 });
  check("three coincident corners produce no drawing",
    !C.diagram(C.setVertex(collapsed, 2, { x: 100, y: 100 })).visible);
}

/* -------------------------------------------- 8. state handling and the record */

{
  const s = C.start({});
  const moved = C.setVertex(s, 0, { x: 10, y: 10 });
  check("setVertex clamps to the board", moved.vertices[0].x === C.MARGIN &&
    moved.vertices[0].y === C.MARGIN);
  check("setVertex leaves the old position alone", s.vertices[0].x === 180 &&
    s.vertices[0].y === 20);
  check("setVertex ignores an out-of-range corner", C.setVertex(s, 9, { x: 1, y: 1 }) === s);
  const r = C.reset({ ...moved, showLines: false });
  check("reset restores the starting triangle and keeps display options",
    r.vertices[0].x === 180 && r.vertices[0].y === 20 && r.showLines === false);
  check("the saved position is plain, finite data", (() => {
    const p = C.position(moved);
    return p.vertices.length === 3 && p.visible &&
      p.vertices.every((q) => isFinite(q.x) && isFinite(q.y)) &&
      isFinite(p.meeting.x) && isFinite(p.incircle.radius);
  })());
  const collapsedState = C.setVertex(C.setVertex(C.setVertex(s, 0, { x: 100, y: 100 }),
    1, { x: 100, y: 100 }), 2, { x: 100, y: 100 });
  check("a collapsed position is reported as invisible",
    C.position(collapsedState).visible === false);
  check("a moved triangle still obeys the theorem", (() => {
    const d = C.diagram(moved);
    return d.visible && C.lineDistance(d.meeting, d.lines[2].a, d.lines[2].b) < 1e-6;
  })());
}

done("four-circles-in-triangle");
