#!/usr/bin/env node
"use strict";

/*
 * Logic test for center-circle/center-circle-core.js.
 *
 *   node porting/check-center-circle.mjs
 *
 * The page's claims: for n lines the n center-circles of the (n-1)-line
 * subsets all pass through one point, and their centers lie on one circle
 * (the next center-circle). The extra sentence saying that point is also on
 * that circle is checked separately: true for four lines, false from five on.
 * All of this is tested at fixed layouts and at hundreds of random layouts
 * for n = 3..7, and the core is compared with a second, literal transcription
 * of the applet's own computation, read from the bytecode of GeoSDoub
 * (Intersect, FindCircumcenter, IntersectCirclesX/Y, Equals) and of
 * CenterCircleCanvas (DoDrawCircles, DrawCircle, FindCommonPoint).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("center-circle/center-circle-core.js", "CenterCircleCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const closeCircle = (p, q, tol) =>
  closePoint(p, q, tol) && close(p && p.radius, q && q.radius, tol);
const L = (x1, y1, x2, y2) => ({ a: { x: x1, y: y1 }, b: { x: x2, y: y2 } });
const stateOf = (lines, shown) =>
  C.start({ lines, shown: shown || lines.map(() => true) });

/* -------------------------------- the applet's own methods, transcribed */

/* GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint): det < 1 -> NaN. */
function aIntersectLines(l, m) {
  const a1 = l.a.y - l.b.y, b1 = l.b.x - l.a.x;
  const c1 = l.a.x * l.b.y - l.a.y * l.b.x;
  const a2 = m.a.y - m.b.y, b2 = m.b.x - m.a.x;
  const c2 = m.a.x * m.b.y - m.a.y * m.b.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.Dist and FindCircumcenter (intersect two perpendicular bisectors). */
const aDist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
function aCircumcircle(p, q, r) {
  const m1 = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const m2 = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
  const u = { x: m1.x + q.y - p.y, y: m1.y - (q.x - p.x) };
  const v = { x: m2.x + r.y - q.y, y: m2.y - (r.x - q.x) };
  const c = aIntersectLines({ a: m1, b: u }, { a: m2, b: v });
  return { x: c.x, y: c.y, radius: aDist(c, p) };
}

/* GeoSDoub.IntersectCirclesX: x = m*y + b on the radical axis. */
function aIntersectCirclesX(c0, c1) {
  const m = -(c0.y - c1.y) / (c0.x - c1.x);
  const b = (c0.x ** 2 - c1.x ** 2 + c0.y ** 2 - c1.y ** 2 - c0.radius ** 2 + c1.radius ** 2)
    / (2 * (c0.x - c1.x));
  const dx = b - c0.x;
  const A = 1 + m * m;
  const B = 2 * m * dx - 2 * c0.y;
  const Cc = dx * dx + c0.y * c0.y - c0.radius * c0.radius;
  const disc = B * B - 4 * A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const y1 = (-B + s) / (2 * A), y2 = (-B - s) / (2 * A);
  return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
}

/* GeoSDoub.IntersectCirclesY: y = m*x + b. */
function aIntersectCirclesY(c0, c1) {
  const m = -(c0.x - c1.x) / (c0.y - c1.y);
  const b = (c0.x ** 2 - c1.x ** 2 + c0.y ** 2 - c1.y ** 2 - c0.radius ** 2 + c1.radius ** 2)
    / (2 * (c0.y - c1.y));
  const dy = b - c0.y;
  const A = 1 + m * m;
  const B = 2 * m * dy - 2 * c0.x;
  const Cc = dy * dy + c0.x * c0.x - c0.radius * c0.radius;
  const disc = B * B - 4 * A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const x1 = (-B + s) / (2 * A), x2 = (-B - s) / (2 * A);
  return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
}

/* GeoSDoub.Intersect(DoubCircle, DoubCircle). */
function aIntersectCircles(c0, c1) {
  if (Math.abs(c0.x - c1.x) > 1) return aIntersectCirclesX(c0, c1);
  if (Math.abs(c0.y - c1.y) > 1) return aIntersectCirclesY(c0, c1);
  return [{ x: c0.x, y: c0.y }, { x: c0.x, y: c0.y }];
}

/* DoubPoint.Equals: squared distance < 0.1. */
const aEquals = (p, q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < 0.1;

/* CenterCircleCanvas.FindCommonPoint: first three circles only. */
function aCommonPoint(circles) {
  const p = aIntersectCircles(circles[0], circles[1]);
  const q = aIntersectCircles(circles[0], circles[2]);
  if (!p || !q) return null;
  if (aEquals(p[0], q[0]) || aEquals(p[0], q[1])) return p[0];
  if (aEquals(p[1], q[0]) || aEquals(p[1], q[1])) return p[1];
  return null;
}

/* CenterCircleCanvas.DrawCircle: circle through three child centers. */
function aDrawCircle(circles) {
  const center = aCircumcircle(circles[0], circles[1], circles[2]);
  return {
    circle: { x: center.x, y: center.y, radius: aDist(center, circles[0]) },
    point: aCommonPoint(circles),
  };
}

/* CenterCircleCanvas.DoDrawCircles, with the drawing stripped out. */
function aCenterCircle(lines) {
  const n = lines.length;
  if (n > 3) {
    const children = [];
    for (let i = 0; i < n; i++) {
      const subset = lines.filter((_, j) => j !== i);
      const c = aCenterCircle(subset);
      if (c) children.push(c);
    }
    if (children.length <= 2) return null;
    return aDrawCircle(children).circle;
  }
  if (n === 3) {
    const p01 = aIntersectLines(lines[0], lines[1]);
    const p12 = aIntersectLines(lines[1], lines[2]);
    const p20 = aIntersectLines(lines[2], lines[0]);
    const center = aCircumcircle(p01, p12, p20);
    return { x: center.x, y: center.y, radius: aDist(center, p01) };
  }
  return null;
}

/** Skip layouts where the applet's fixed pixel cut-offs make the picture moot. */
function usable(lines) {
  if (lines.length < 3) return false;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const p = aIntersectLines(lines[i], lines[j]);
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    }
  }
  const root = aCenterCircle(lines);
  return Boolean(root) && Number.isFinite(root.radius) && root.radius < 1e6;
}

/* ------------------------------------------------------ 1. start and state */

{
  equal("the applet's default is seven lines", C.N_LINES, 7);
  equal("four of them are shown at the start", C.SHOWN_AT_START, 4);
  equal("the applet's edge margin is 20", C.MARGIN, 20);
  const s = C.start();
  equal("a new position has seven lines", s.lines.length, 7);
  equal("the first four are shown", s.shown, [true, true, true, true, false, false, false]);
  equal("no circle is shown to begin with",
    [s.showCircles, s.showCenters, s.showCommon], [false, false, false]);
  check("nothing is won or lost in an illustration", C.result(s) === null);
  check("the diagram uses exactly the shown lines", C.diagram(s).lines.length === 4);
  check("moving one endpoint does not change the old position", (() => {
    const next = C.withPoint(s, 0, "a", { x: 7, y: 9 });
    return s.lines[0].a !== next.lines[0].a && s.lines[0].b.x === next.lines[0].b.x
      && s.lines[1].a.x === next.lines[1].a.x;
  })());
  check("an unknown endpoint leaves the line alone",
    C.withPoint(s, 0, "z", { x: 7, y: 9 }).lines[0].a.x === s.lines[0].a.x);
  check("a line toggle does not change the lines",
    C.withShown(s, 4, true).shown[4] === true && C.withShown(s, 4, true).lines[0].a.x === s.lines[0].a.x);
  check("an unknown display flag is ignored",
    C.withFlag(s, "nonsense", true).showCircles === false);
  const seeded = C.start({ random: (() => { let n = 0; return () => (n++ / 100) % 1; })() });
  check("start accepts a deterministic random source",
    Number.isFinite(seeded.lines[0].a.x) && Number.isFinite(seeded.lines[6].b.y));
}

/* ------------------------------ 2. fixed layouts: the page's claim, and code */

const fixed = [
  ["three lines", [
    L(20, 30, 380, 45), L(15, 210, 390, 195), L(200, 5, 225, 245),
  ]],
  ["four lines", [
    L(20, 30, 380, 45), L(15, 210, 390, 195), L(200, 5, 225, 245),
    L(40, 120, 360, 150),
  ]],
  ["five lines", [
    L(20, 30, 380, 45), L(15, 210, 390, 195), L(200, 5, 225, 245),
    L(40, 120, 360, 150), L(90, 15, 310, 235),
  ]],
  ["six lines", [
    L(20, 30, 380, 45), L(15, 210, 390, 195), L(200, 5, 225, 245),
    L(40, 120, 360, 150), L(90, 15, 310, 235), L(160, 0, 250, 250),
  ]],
  ["seven lines", [
    L(20, 30, 380, 45), L(15, 210, 390, 195), L(200, 5, 225, 245),
    L(40, 120, 360, 150), L(90, 15, 310, 235), L(160, 0, 250, 250),
    L(0, 90, 400, 130),
  ]],
];

for (const [name, lines] of fixed) {
  const s = stateOf(lines);
  const d = C.diagram(s);
  const cl = C.claims(s);
  check(`${name}: a circle is built at every level`,
    d.root && d.nodes.length > 0 && d.nodes.every((n) => C.finiteCircle(n.circle)));
  check(`${name}: three lines give a circumcircle through all three corners`,
    cl.threeLinesMakeACircle && cl.circlesThroughTheirCorners);
  check(`${name}: the child centers lie on the next circle`, cl.centersConcyclic);
  check(`${name}: the common point is found at every higher level`, cl.pointFoundAtEveryLevel);
  check(`${name}: the common point lies on every child circle`, cl.commonOnEveryCircle);
  check(`${name}: for four lines the Miquel point lies on the Steiner circle`,
    cl.miquelOnSteinerCircle);
  check(`${name}: every claim holds at once`, Object.values(cl).every(Boolean));
  const tol = 1e-5 * Math.max(1, d.scale);
  check(`${name}: the covering circle matches the applet's DoDrawCircles`,
    closeCircle(d.root.circle, aCenterCircle(lines), tol),
    `core ${JSON.stringify(d.root.circle)}, applet ${JSON.stringify(aCenterCircle(lines))}`);
  if (d.root.order >= 4) {
    const children = d.root.children.map((c) => c.circle);
    check(`${name}: the common point matches FindCommonPoint`,
      closePoint(d.root.point, aCommonPoint(children), Math.max(tol, 0.5)));
  }
}

/* ------------------------------- 3. many random layouts, n = 3..7, both ways */

{
  const rand = rng(20241126);
  let compared = 0, theorem = 0, skipped = 0;
  for (let trial = 0; trial < 700; trial++) {
    const n = 3 + (trial % 5);
    const lines = Array.from({ length: n }, () => {
      const a = { x: 12 + rand() * 376, y: 12 + rand() * 226 };
      const b = { x: 12 + rand() * 376, y: 12 + rand() * 226 };
      return { a, b };
    });
    if (!usable(lines)) { skipped++; continue; }
    const s = stateOf(lines);
    const core = C.diagram(s).root;
    const applet = aCenterCircle(lines);
    const tol = 2e-5 * Math.max(1, core.circle.radius, applet.radius);
    if (!closeCircle(core.circle, applet, tol)) {
      check(`random ${trial} (n=${n}): covering circle matches the applet`, false,
        `core ${JSON.stringify(core.circle)}, applet ${JSON.stringify(applet)}`);
    }
    const cl = C.claims(s);
    if (!Object.values(cl).every(Boolean)) {
      check(`random ${trial} (n=${n}): all claims hold`, false, JSON.stringify(cl));
    }
    if (n >= 4) {
      const children = core.children.map((c) => c.circle);
      const aPoint = aCommonPoint(children);
      if (aPoint && !closePoint(core.point, aPoint, Math.max(tol, 0.5))) {
        check(`random ${trial} (n=${n}): common point matches the applet`, false,
          `core ${JSON.stringify(core.point)}, applet ${JSON.stringify(aPoint)}`);
      }
    }
    compared++;
    theorem++;
  }
  check(`core and applet agree on ${compared} random layouts`, compared >= 600,
    `compared ${compared}, skipped ${skipped}`);
  check(`the theorem holds on ${theorem} random layouts`, theorem >= 600);
}

/* -------------------------------------- 4. the recursion, one level at a time */

{
  const rand = rng(77123);
  let levels = 0;
  for (let trial = 0; trial < 120; trial++) {
    const lines = Array.from({ length: 7 }, () => ({
      a: { x: 15 + rand() * 370, y: 15 + rand() * 220 },
      b: { x: 15 + rand() * 370, y: 15 + rand() * 220 },
    }));
    if (!usable(lines)) continue;
    const d = C.diagram(stateOf(lines));
    for (const node of d.nodes) {
      const subset = node.subset.map((i) => lines[i]);
      const appletCircle = node.order === 3
        ? aCenterCircle(subset)
        : aDrawCircle(node.children.map((c) => c.circle)).circle;
      // The applet uses a fixed 1px cut-off in its line intersections and so
      // drops circles whose three centers nearly coincide; the core keeps them.
      if (!Number.isFinite(appletCircle.radius)) continue;
      const tol = 2e-5 * Math.max(1, node.circle.radius, appletCircle.radius);
      if (!closeCircle(node.circle, appletCircle, tol)) {
        check(`trial ${trial}, order ${node.order}: circle matches the applet`, false,
          `core ${JSON.stringify(node.circle)}, applet ${JSON.stringify(appletCircle)}`);
      }
      levels++;
    }
  }
  check(`all ${levels} circles in the hierarchy match the applet's method`, levels > 700);
}

/* ------------------------- 5. the page's sentence, read as a general claim */

{
  // The article says "The point P is also incident to this latter center-circle"
  // right after describing a 4-line. True there (Miquel on the Steiner circle).
  // Read as "for every n", it is false: from five lines on the common point of
  // the child circles is not on the circle through their centers. This test
  // keeps that honest rather than asserting the false version.
  const rand = rng(31337);
  let four = 0, fourOn = 0, more = 0, moreOff = 0;
  for (let trial = 0; trial < 800; trial++) {
    const n = 4 + (trial % 4);
    const lines = Array.from({ length: n }, () => ({
      a: { x: 12 + rand() * 376, y: 12 + rand() * 226 },
      b: { x: 12 + rand() * 376, y: 12 + rand() * 226 },
    }));
    const root = C.diagram(stateOf(lines)).root;
    if (!root || !root.circle || !root.point) continue;
    const rel = Math.abs(C.dist(root.point, root.circle) - root.circle.radius)
      / Math.max(1, root.circle.radius);
    if (n === 4) { four++; if (rel < 1e-5) fourOn++; }
    else { more++; if (rel > 1e-3) moreOff++; }
  }
  check(`the Miquel point is on the Steiner circle in ${fourOn}/${four} four-line cases`,
    four >= 190 && fourOn >= four - 4);
  check(`from five lines on, P is NOT on the next circle in ${moreOff}/${more} cases`,
    more >= 590 && moreOff >= more - 20);
}

/* ------------------------------------ 6. the applet's awkward cases stay safe */

{
  const parallel = [L(10, 20, 390, 20), L(10, 60, 390, 60)];
  check("parallel lines have no intersection", C.lineIntersection(parallel[0], parallel[1]) === null);
  check("three collinear points have no circumcircle",
    C.circumcircle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }) === null);
  check("two lines make no node", C.diagram(stateOf(parallel)).root === null);
  check("disjoint circles have no intersection",
    C.circleIntersections({ x: 0, y: 0, radius: 2 }, { x: 20, y: 0, radius: 3 }) === null);
  check("concentric circles have no common point",
    C.commonPoint([
      { x: 0, y: 0, radius: 5 }, { x: 0, y: 0, radius: 6 }, { x: 0, y: 0, radius: 7 },
    ]) === null);
  check("a degenerate layout makes no claims",
    !Object.values(C.claims(stateOf(parallel))).every(Boolean));
  const s = C.start();
  const all = C.withShown(s, 4, true);
  all.shown[0] = false; all.shown[1] = false; all.shown[2] = false;
  check("hiding all but one line leaves no diagram", C.diagram(all).nodes.length === 0);
}

done("center-circle");
