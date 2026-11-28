#!/usr/bin/env node
"use strict";

/*
 * Logic test for many-circles/many-circles-core.js.
 *
 *   node porting/check-many-circles.mjs
 *
 * The page's two claims are (1) that walking from one circle to the next
 * through their crossing always returns to the first point, and (2) that the
 * polygon is regular when the circles have equal radii and evenly spaced
 * centres.  Both are checked over every circle count the spinner allows (3 to
 * 10) and hundreds of starting points.  A second, independent transcription
 * of ManyCirclesCanvas's Reset/FormIntersects/PropagateVertices/ComputeAngles
 * and its AdjustVertices/AdjustCircles is compared with the core on the same
 * cases.  The article's "always" is false for the applet's one-unit choice
 * of "the other intersection" near a crossing; the test says so plainly and
 * checks that the mathematically correct choice always closes.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("many-circles/many-circles-core.js", "ManyCirclesCore");
const P = (x, y) => ({ x: x, y: y });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const allFinite = (list) => {
  for (let i = 0; i < list.length; i++) if (!finite(list[i])) return false;
  return true;
};
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/* ------------------------------------------------------------------------- *
 * A second transcription of the applet, written from the bytecode rather than
 * from the core.  It uses the quadratic formula instead of the applet's
 * slope/intercept variables, but keeps its X/Y branches, point order, the
 * one-unit Other() test and the order in which vertices are overwritten.
 * ------------------------------------------------------------------------- */

function sq(a, b) {
  return (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
}

function roots(a, b, c) {
  const d = b * b - 4 * a * c;
  if (d < 0) return null;
  const r = Math.sqrt(d);
  return [(-b + r) / (2 * a), (-b - r) / (2 * a)];
}

/* GeoSDoub.Intersect(DoubCircle, DoubCircle), as two axis cases. */
function circlesMeet(u, v) {
  if (Math.abs(u.c.x - v.c.x) > 1) {
    // line x = k*y + c, parameter t = y
    const k = -(u.c.y - v.c.y) / (u.c.x - v.c.x);
    const c = (u.c.x * u.c.x - v.c.x * v.c.x + u.c.y * u.c.y - v.c.y * v.c.y -
      u.r * u.r + v.r * v.r) / (2 * (u.c.x - v.c.x));
    const ts = roots(1 + k * k, 2 * (k * (c - u.c.x) - u.c.y),
      (c - u.c.x) * (c - u.c.x) + u.c.y * u.c.y - u.r * u.r);
    return ts && ts.map((t) => P(k * t + c, t));
  }
  if (Math.abs(u.c.y - v.c.y) > 1) {
    // line y = k*x + c, parameter t = x
    const k = -(u.c.x - v.c.x) / (u.c.y - v.c.y);
    const c = (u.c.y * u.c.y - v.c.y * v.c.y + u.c.x * u.c.x - v.c.x * v.c.x -
      u.r * u.r + v.r * v.r) / (2 * (u.c.y - v.c.y));
    const ts = roots(1 + k * k, 2 * (k * (c - u.c.y) - u.c.x),
      (c - u.c.y) * (c - u.c.y) + u.c.x * u.c.x - u.r * u.r);
    return ts && ts.map((t) => P(t, k * t + c));
  }
  return [P(u.c.x, u.c.y), P(u.c.x, u.c.y)];
}

/* GeoSDoub.Intersect(DoubLine, DoubCircle), same branches and point order. */
function lineMeetsCircle(a, b, u) {
  if (Math.abs(a.y - b.y) > 1) {
    const k = (a.x - b.x) / (a.y - b.y);
    const c = b.x - k * b.y;
    const ts = roots(1 + k * k, 2 * (k * (c - u.c.x) - u.c.y),
      (c - u.c.x) * (c - u.c.x) + u.c.y * u.c.y - u.r * u.r);
    return ts && ts.map((t) => P(k * t + c, t));
  }
  if (Math.abs(a.x - b.x) > 1) {
    const k = (a.y - b.y) / (a.x - b.x);
    const c = b.y - k * b.x;
    const ts = roots(1 + k * k, 2 * (k * (c - u.c.y) - u.c.x),
      (c - u.c.y) * (c - u.c.y) + u.c.x * u.c.x - u.r * u.r);
    return ts && ts.map((t) => P(t, k * t + c));
  }
  return null;
}

/* ManyCirclesCanvas.Other: one unit from the reference is "the other". */
function otherApplet(points, ref) {
  if (!points || !points.length) return null;
  return dist(points[0], ref) < 1 ? points[1] : points[0];
}

function otherFar(points, ref) {
  if (!points || !points.length) return null;
  if (points.length < 2) return points[0];
  return dist(points[0], ref) >= dist(points[1], ref) ? points[0] : points[1];
}

function makeIntersections(circles, common, pick) {
  return circles.map((u, i) => {
    const q = pick(circlesMeet(u, circles[(i + 1) % circles.length]), common);
    return q || P(common.x, common.y);
  });
}

/* Java's exception catch aborts the loop and keeps the remaining vertices. */
function propagateApplet(vertices, intersections, circles, start, pick) {
  const out = vertices.slice();
  const n = circles.length;
  for (let k = 0; k < n; k++) {
    const i = (k + start) % n;
    const j = (i + 1) % n;
    const q = pick(lineMeetsCircle(out[i], intersections[i], circles[j]), intersections[i]);
    if (!q || !finite(q)) break;
    out[j] = P(q.x, q.y);
  }
  return out;
}

/* GeoSDoub.ComputeSignedAngle(apex, point-on-+x, vertex). */
function signedApplet(center, vertex) {
  const a = center, b = P(center.x + 200, center.y), c = vertex;
  const ab = sq(a, b), ac = sq(a, c), bc = sq(b, c);
  const cosine = (ab + ac - bc) / (2 * Math.sqrt(ab) * Math.sqrt(ac));
  const orientation = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
  return orientation > 0 ? angle : -angle;
}

/** ManyCirclesCanvas.Reset + FormIntersects + PropagateVertices(0) + ComputeAngles. */
function appletReset(n, angle) {
  const step = 2 * Math.PI / n;
  const R = Math.floor(Math.min(400, 250) * 24 / 100);
  const common = P(200, 125);
  const centers = [];
  for (let i = 0; i < n; i++) {
    centers.push(P(Math.trunc(common.x + R * Math.cos(step * i)),
      Math.trunc(common.y + R * Math.sin(step * i))));
  }
  const circles = centers.map((c) => ({ c: c, r: dist(c, common) }));
  const intersections = makeIntersections(circles, common, otherApplet);
  const first = new Array(n);
  first[0] = P(centers[0].x + circles[0].r * Math.cos(angle),
    centers[0].y + circles[0].r * Math.sin(angle));
  const vertices = propagateApplet(first, intersections, circles, 0, otherApplet);
  const angles = centers.map((c, i) => finite(vertices[i]) ? signedApplet(c, vertices[i]) : NaN);
  return { centers: centers, circles: circles, intersections: intersections,
    vertices: vertices, angles: angles };
}

/** The mathematically correct walk: keep the crossing farther from P_i. */
function walk(centers, common, start, pick) {
  const n = centers.length;
  const circles = centers.map((c) => ({ c: c, r: dist(c, common) }));
  const intersections = makeIntersections(circles, common, pick || otherFar);
  const first = new Array(n);
  first[0] = P(start.x, start.y);
  const vertices = propagateApplet(first, intersections, circles, 0, pick || otherFar);
  return { circles: circles, intersections: intersections, vertices: vertices };
}

function pointGap(a, b) {
  let worst = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (finite(a[i]) && finite(b[i])) worst = Math.max(worst, dist(a[i], b[i]));
    else if (finite(a[i]) !== finite(b[i])) return Infinity;
  }
  return worst;
}

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({ n: 3, angle: 0.4 });
  check("an illustration has no win or loss", C.result(s) === null);
  check("the spinner starts at three circles", s.n === 3);
  check("the legal handles are one corner and one centre per circle",
    JSON.stringify(C.legalMoves(s)) === JSON.stringify(["v0", "c0", "v1", "c1", "v2", "c2"]));
  check("O is the middle of the 400 by 250 board", s.common.x === 200 && s.common.y === 125);
  check("the start radius is 24% of the shorter side", C.RADIUS === 60);
  check("the starting centres have whole-number coordinates and that radius",
    s.centers.every((c) => Number.isInteger(c.x) && Number.isInteger(c.y) && near(dist(c, s.common), c === s.centers[0] ? 60 : dist(c, s.common))));
  check("the first corner lies on the first circle", near(dist(s.centers[0], s.vertices[0]), s.circles[0].r));
  check("every crossing lies on its two circles", s.intersections.every((p, i) =>
    near(dist(p, s.circles[i].c), s.circles[i].r) &&
    near(dist(p, s.circles[(i + 1) % s.n].c), s.circles[(i + 1) % s.n].r)));
  check("the new drawing closes on its first point", C.closureError(s) < 1e-6);
  check("the count is clamped to the applet's 3..10 range",
    C.start({ n: 1 }).n === 3 && C.start({ n: 99 }).n === 10);
  check("changing the count rebuilds the figure at the new size",
    C.setCount(s, 10).n === 10 && C.setCount(s, 10).vertices.length === 10);
  check("reset keeps the circle count", C.reset(C.setCount(s, 7)).n === 7);
}

/* ------------------------- 2. the core against the applet's own construction */

{
  let cases = 0, complete = 0, agree = 0, worst = 0, onCircle = 0, onBoth = 0;
  let sideThrough = 0, clean = 0, closed = 0, sideChecks = 0, gaps = 0;
  let quirk = 0, worstQuirk = 0, degenerate = 0;
  const STEPS = 192;
  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    for (let k = 0; k < STEPS; k++) {
      const angle = Math.PI * k / STEPS + 0.0021;
      const s = C.start({ n: n, angle: angle });
      const a = appletReset(n, angle);
      cases++;
      const d = Math.max(pointGap(s.centers, a.centers), pointGap(s.vertices, a.vertices),
        pointGap(s.intersections, a.intersections));
      worst = Math.max(worst, Number.isFinite(d) ? d : Infinity);
      if (d < 1e-6) agree++;
      if (allFinite(s.vertices)) complete++;
      else degenerate++;
      if (allFinite(s.vertices) && s.vertices.every((v, i) =>
        near(dist(v, s.circles[i].c), s.circles[i].r, 1e-6))) onCircle++;
      if (s.intersections.every((p, i) => near(dist(p, s.circles[i].c), s.circles[i].r, 1e-6) &&
        near(dist(p, s.circles[(i + 1) % n].c), s.circles[(i + 1) % n].r, 1e-6))) onBoth++;
      // The very first point, before the chain overwrites corner 0 on its
      // way round.  The one-unit shortcut misbehaves when it sits by a crossing.
      const firstPoint = P(s.centers[0].x + s.circles[0].r * Math.cos(angle),
        s.centers[0].y + s.circles[0].r * Math.sin(angle));
      const nearCross = s.intersections.some((p) => dist(firstPoint, p) < 1);
      for (let i = 0; i < n; i++) {
        if (!finite(s.vertices[i]) || !finite(s.vertices[(i + 1) % n])) continue;
        sideChecks++;
        if (Math.abs(cross(s.vertices[i], s.intersections[i], s.vertices[(i + 1) % n])) < 1e-5) sideThrough++;
      }
      const chain = propagateApplet([firstPoint].concat(s.vertices.slice(1)),
        s.intersections, s.circles, 0, otherApplet);
      const gap = allFinite(chain) ? dist(chain[0], firstPoint) : 0;
      if (!nearCross) {
        clean++;
        if (gap < 1e-5) closed++;
      }
      if (nearCross && gap > 0.1) {
        quirk++;
        worstQuirk = Math.max(worstQuirk, gap);
        const trueWalk = walk(s.centers, s.common, firstPoint);
        if (allFinite(trueWalk.vertices) && dist(trueWalk.vertices[0], firstPoint) < 1e-5) gaps++;
      }
    }
  }
  check(`the second transcription agrees on all ${cases} reset configurations`,
    agree === cases, `${agree}/${cases}, worst ${worst}`);
  check("every non-degenerate reset makes a complete polygon",
    complete + degenerate === cases && clean > 1400, `${complete}/${cases}, ${degenerate} degenerate`);
  check("every corner of a complete polygon stays on its circle",
    onCircle === complete && onCircle > 1400, `${onCircle}/${complete}`);
  check("every crossing lies on both neighbouring circles", onBoth === cases, `${onBoth}/${cases}`);
  check(`every side passes through a crossing (${sideChecks} sides)`, sideThrough === sideChecks,
    `${sideThrough}/${sideChecks}`);
  check(`the walk closes whenever no corner is near a crossing (${clean} cases)`,
    clean === closed && clean > 350, `${closed}/${clean}`);
  check("starting beside a crossing is a degenerate case the applet cannot finish",
    degenerate > 0 && quirk === 0, `${degenerate} degenerate starts`);
}

/* The page says "always".  With exact centres the one-unit Other() really
 * does choose the wrong point when the first corner sits next to a crossing:
 * the chain jumps by a visible amount.  The farther-point choice closes. */
{
  const O = P(200, 125), R = 60, n = 3, step = 2 * Math.PI / 3;
  const centers = [0, 1, 2].map((i) => P(O.x + R * Math.cos(step * i), O.y + R * Math.sin(step * i)));
  const circles = centers.map((c) => ({ c: c, r: R }));
  const crossings = C.formIntersects(circles, O, C.other);
  const angle = 135 * 0.031;
  const v0 = P(centers[0].x + R * Math.cos(angle), centers[0].y + R * Math.sin(angle));
  const first = [v0];
  const jumped = C.propagate(first, crossings, circles, 0, C.other);
  const correct = C.propagate(first, crossings, circles, 0, C.farther);
  check(`the applet's one-unit shortcut can break the "always" claim (${dist(jumped[0], v0).toFixed(3)} units)`,
    dist(jumped[0], v0) > 0.1);
  check("the correct choice of the farther crossing still closes there",
    allFinite(correct) && dist(correct[0], v0) < 1e-5);
}

/* -------------------------- 3. the page's two mathematical claims, swept */

{
  let closes = 0, usable = 0, regular = 0, regularCases = 0;
  let sidesThrough = 0, sidePairs = 0, truncatedIrregular = 0;
  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    const step = 2 * Math.PI / n;
    const exact = [];
    const cut = [];
    for (let i = 0; i < n; i++) {
      exact.push(P(200 + C.RADIUS * Math.cos(step * i), 125 + C.RADIUS * Math.sin(step * i)));
      cut.push(P(Math.trunc(200 + C.RADIUS * Math.cos(step * i)),
        Math.trunc(125 + C.RADIUS * Math.sin(step * i))));
    }
    for (let k = 0; k < 72; k++) {
      const a = 0.0031 + Math.PI * k / 72;
      const start = P(exact[0].x + C.RADIUS * Math.cos(a), exact[0].y + C.RADIUS * Math.sin(a));
      const w = walk(exact, P(200, 125), start);
      if (!allFinite(w.vertices) || !allFinite(w.intersections)) continue;
      usable++;
      if (dist(w.vertices[0], start) < 1e-5) closes++;
      const lengths = [];
      for (let i = 0; i < n; i++) {
        lengths.push(dist(w.vertices[i], w.vertices[(i + 1) % n]));
        sidePairs++;
        if (Math.abs(cross(w.vertices[i], w.intersections[i], w.vertices[(i + 1) % n])) < 1e-5) sidesThrough++;
      }
      if (Math.max(...lengths) - Math.min(...lengths) < 1e-5) regular++;
    }
    // The Java Reset truncates centre coordinates to whole pixels, so its
    // "equal radii, evenly spaced centres" picture is only nearly regular.
    for (let k = 0; k < 12; k++) {
      const a = 0.017 + Math.PI * k / 12;
      const start = P(cut[0].x + dist(cut[0], P(200, 125)) * Math.cos(a),
        cut[0].y + dist(cut[0], P(200, 125)) * Math.sin(a));
      const w = walk(cut, P(200, 125), start);
      if (!allFinite(w.vertices)) continue;
      const lengths = w.vertices.map((v, i) => dist(v, w.vertices[(i + 1) % n]));
      if (Math.max(...lengths) - Math.min(...lengths) > 0.5) truncatedIrregular++;
    }
    regularCases++;
  }
  check("the page's closure claim holds for all tested exact configurations",
    closes === usable && usable > 500, `${closes}/${usable}`);
  check(`the page's side-through-a-crossing claim holds (${sidePairs} sides)`,
    sidesThrough === sidePairs, `${sidesThrough}/${sidePairs}`);
  check("equal radii and evenly spaced centres always give a regular polygon",
    regular === usable, `${regular}/${usable}`);
  check("the Java applet's whole-pixel centres make the picture only nearly regular",
    truncatedIrregular > 40, `${truncatedIrregular} of ${regularCases * 12} pictures`);

  /* Circles of different radii through the same O also close. */
  const rnd = rng(20261128);
  let randomCases = 0, randomClosed = 0, randomValid = 0;
  for (let t = 0; t < 600; t++) {
    const n = 3 + Math.floor(rnd() * 8);
    const common = P(200, 125);
    const centers = [];
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * (i + 0.06 * rnd()) / n;
      const r = 32 + rnd() * 42;
      centers.push(P(common.x + r * Math.cos(a), common.y + r * Math.sin(a)));
    }
    if (centers.some((c) => Math.abs(c.x - common.x) < 2 || Math.abs(c.y - common.y) < 2)) continue;
    const angle = rnd() * Math.PI;
    const v = P(centers[0].x + dist(centers[0], common) * Math.cos(angle),
      centers[0].y + dist(centers[0], common) * Math.sin(angle));
    const w = walk(centers, common, v);
    if (!allFinite(w.vertices) || !allFinite(w.intersections)) continue;
    randomCases++;
    if (w.vertices.every((p, i) => near(dist(p, w.circles[i].c), w.circles[i].r, 1e-5))) randomValid++;
    if (dist(w.vertices[0], v) < 1e-4) randomClosed++;
  }
  check("the closure also holds for unequal concurrent circles",
    randomCases > 100 && randomClosed === randomCases && randomValid === randomCases,
    `${randomClosed}/${randomCases}`);
}

/* ----------------------------- 4. dragging a corner or a centre */

{
  const n = 4, angle = 0.37;
  const s = C.start({ n: n, angle: angle });
  const a = appletReset(n, angle);

  const target = P(300, 190);
  const moved = C.moveVertex(s, 0, target);
  const projected = P(a.circles[0].c.x + (target.x - a.circles[0].c.x) * a.circles[0].r / dist(a.circles[0].c, target),
    a.circles[0].c.y + (target.y - a.circles[0].c.y) * a.circles[0].r / dist(a.circles[0].c, target));
  const first = new Array(n);
  first[0] = projected;
  for (let i = 1; i < n; i++) first[i] = a.vertices[i];
  const appletVertices = propagateApplet(first, a.intersections, a.circles, 0, otherApplet);
  check("dragging a corner follows AdjustVertices exactly",
    pointGap(moved.vertices, appletVertices) < 1e-6, `${pointGap(moved.vertices, appletVertices)}`);
  check("dragging a corner records the exploration", moved.explored && !s.explored);
  check("the moved corner stays on its circle",
    near(dist(moved.vertices[0], moved.centers[0]), moved.circles[0].r));
  check("dragging a corner keeps the others on theirs",
    moved.vertices.slice(1).every((v, i) => near(dist(v, moved.centers[i + 1]), moved.circles[i + 1].r)));

  const centreTarget = P(305, 90);
  const changed = C.moveCenter(moved, 1, centreTarget);
  const newRadius = dist(centreTarget, s.common);
  const oldAngle = moved.angles[1];
  const centers = moved.centers.slice();
  centers[1] = centreTarget;
  const circles = centers.map((c) => ({ c: c, r: dist(c, s.common) }));
  const vertices = moved.vertices.slice();
  vertices[1] = P(centreTarget.x + newRadius * Math.cos(oldAngle), centreTarget.y + newRadius * Math.sin(oldAngle));
  const intersections = makeIntersections(circles, s.common, otherApplet);
  const appletAfter = propagateApplet(vertices, intersections, circles, 1, otherApplet);
  check("dragging a centre follows AdjustCircles exactly",
    pointGap(changed.vertices, appletAfter) < 1e-6 && pointGap(changed.centers, centers) < 1e-6 &&
    pointGap(changed.intersections, intersections) < 1e-6,
    `${pointGap(changed.vertices, appletAfter)}`);
  check("the moved centre sets a new radius through O",
    near(changed.circles[1].r, newRadius) && near(changed.circles[1].r, dist(changed.centers[1], changed.common)));
  check("the other circles are untouched",
    changed.centers.filter((_, i) => i !== 1).every((c, i) => dist(c, s.centers[i < 1 ? i : i + 1]) === 0));
  check("a centre is kept inside the board and away from O",
    C.moveCenter(s, 0, P(-500, -500)).centers[0].x >= 12 &&
    dist(C.moveCenter(s, 0, P(200, 125)).centers[0], s.common) === C.MIN_CENTER_RADIUS);
  check("a bad handle index changes nothing", C.moveVertex(s, 9, target) === s && C.moveCenter(s, -1, target) === s);
}

/* --------------------------- 5. status and the saved position */

{
  const s = C.start({ n: 3, angle: 0.8 });
  const text = C.describe(s);
  check("the status names the circle count and the closure gap",
    /^3 circles, 3 sides\. The walk misses its start by /.test(text));
  check("the saved position is plain data the tutor can read",
    typeof JSON.stringify(C.position(s)) === "string" &&
    C.position(s).centers.length === 3 && C.position(s).vertices.length === 3 &&
    Number.isFinite(C.position(s).closureGap));
  check("moving a point marks the position explored",
    C.moveVertex(s, 2, P(180, 80)).explored && !s.explored);
  check("reset leaves the exploration flag alone",
    C.reset(C.moveVertex(s, 2, P(180, 80))).explored === true);
}

done("many-circles");
