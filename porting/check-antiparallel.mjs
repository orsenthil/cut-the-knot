#!/usr/bin/env node
"use strict";

/*
 * Logic test for antiparallel/antiparallel-core.js.
 *
 *   node porting/check-antiparallel.mjs
 *
 * Checks the four handles and their constraints, then every claim on the
 * cut-the-knot page over named triangles and hundreds of generated ones:
 * the circle through A and B, its second cuts D and E, the antiparallel
 * angle equality, the cyclic quadrilateral's opposite angles when D and E
 * lie on the sides, and the equal-or-supplementary inscribed angles.
 * Finally it rebuilds the construction a second way, straight from the
 * applet's bytecode (GeoSDoub.IntersectX/IntersectY, Other, Compute and
 * AdjustAxisAndP), and compares both implementations case by case.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("antiparallel/antiparallel-core.js", "AntiparallelCore");

const P = (x, y) => ({ x, y });
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const add = (a, b) => P(a.x + b.x, a.y + b.y);
const mul = (a, t) => P(a.x * t, a.y * t);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const same = (a, b, tol = 1e-6) => near(a.x, b.x, tol) && near(a.y, b.y, tol);

/* ------------------------------------------- the applet's own construction */

// GeoSDoub.FindOrientation(DoubPoint, DoubPoint, DoubPoint).
function orientation(a, b, c) {
  return cross(sub(b, a), sub(c, a)) > 0 ? 1 : -1;
}

// AntiparallelCanvas.Perp(DoubPoint, DoubPoint).
function perp(p, q) {
  return P(p.x + q.y - p.y, p.y - q.x + p.x);
}

// AntiparallelCanvas.Midpoint(DoubPoint, DoubPoint).
function midpoint(p, q) {
  return P((p.x + q.x) / 2, (p.y + q.y) / 2);
}

// GeoSDoub.Intersect(DoubLine, DoubCircle) -> IntersectX, from the bytecode.
function intersectX(l, circle) {
  const k = (l.a.x - l.b.x) / (l.a.y - l.b.y);
  const b = l.b.x - k * l.b.y;
  const A = k * k + 1;
  const c = k * (b - circle.c.x) - circle.c.y;
  const q = circle.c.y * circle.c.y + (b - circle.c.x) * (b - circle.c.x) - circle.r * circle.r;
  const disc = c * c - A * q;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [P(k * ((-c + s) / A) + b, (-c + s) / A),
          P(k * ((-c - s) / A) + b, (-c - s) / A)];
}

// GeoSDoub.Intersect(DoubLine, DoubCircle) -> IntersectY, from the bytecode.
function intersectY(l, circle) {
  const k = (l.a.y - l.b.y) / (l.a.x - l.b.x);
  const b = l.b.y - k * l.b.x;
  const A = k * k + 1;
  const c = k * (b - circle.c.y) - circle.c.x;
  const q = circle.c.x * circle.c.x + (b - circle.c.y) * (b - circle.c.y) - circle.r * circle.r;
  const disc = c * c - A * q;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [P((-c + s) / A, k * ((-c + s) / A) + b),
          P((-c - s) / A, k * ((-c - s) / A) + b)];
}

function geoIntersect(l, circle) {
  if (Math.abs(l.a.y - l.b.y) > 1) return intersectX(l, circle);
  if (Math.abs(l.a.x - l.b.x) > 1) return intersectY(l, circle);
  return null;
}

// AntiparallelCanvasCanvas.Other(DoubPoint[], DoubPoint).
function other(points, vertex) {
  return dist(points[0], vertex) >= 1 ? points[0] : points[1];
}

// AntiparallelCanvas.Compute(), method for method.
function appletCompute(a, b, c, p) {
  if (dist(a, c) < 2 || dist(b, c) < 2 || dist(a, b) < 2) return null;
  const r = (dist(p, a) + dist(p, b)) / 2;
  const circle = { c: p, r: r };
  const D = other(geoIntersect({ a: b, b: c }, circle), b);
  const E = other(geoIntersect({ a: a, b: c }, circle), a);
  return { circle: circle, D: D, E: E };
}

// AntiparallelCanvas.AdjustAxisAndP(), method for method: the sign is
// computed but only used as a divisor, so it flips the unit direction.
function appletPlace(a, b, oldP, height) {
  const m = midpoint(a, b);
  const q = perp(m, a);
  const sign = orientation(a, b, oldP) === orientation(a, b, q) ? 1 : -1;
  q.x -= m.x;
  q.y -= m.y;
  const len = Math.hypot(q.x, q.y) * sign;
  q.x /= len;
  q.y /= len;
  return P(m.x + q.x * height, m.y + q.y * height);
}

/* ------------------------------------------------------------- test cases */

const named = [
  ["initial", P(90, 220), P(310, 220), P(200, 40), 30],
  ["tall", P(110, 240), P(290, 240), P(200, 25), 20],
  ["flat", P(70, 160), P(330, 160), P(200, 60), 10],
  ["obtuse", P(60, 240), P(340, 240), P(80, 50), 45],
  ["scalene", P(55, 215), P(345, 255), P(165, 40), 60],
  ["low centre", P(90, 215), P(310, 215), P(200, 45), -35],
  ["far centre", P(100, 235), P(300, 235), P(210, 35), 130],
  ["near base", P(140, 270), P(260, 270), P(200, 40), 4],
  ["wide base", P(30, 255), P(370, 255), P(200, 60), 70],
];

function onAxis(a, b, height, side) {
  const m = midpoint(a, b);
  const u = C.unit(P(-(b.y - a.y), b.x - a.x));
  return add(m, mul(u, height * side));
}

const rand = rng(20261126);
const cases = named.map(([name, a, b, c, height]) => ({
  name, a, b, c, p: onAxis(a, b, height, 1),
}));
for (let i = 0; i < 220; i++) {
  let a, b, c;
  do {
    a = P(25 + rand() * 350, 25 + rand() * 250);
    b = P(25 + rand() * 350, 25 + rand() * 250);
    c = P(25 + rand() * 350, 25 + rand() * 250);
  } while (dist(a, b) < 70 || dist(a, c) < 60 || dist(b, c) < 60 ||
           Math.abs(cross(sub(b, a), sub(c, a))) < 2500);
  cases.push({
    name: `random-${i}`, a, b, c,
    p: onAxis(a, b, 3 + rand() * 120, rand() < 0.5 ? 1 : -1),
  });
}

/* --------------------------------------------------------------- 1. moves */

{
  const s = C.start({});
  check("start has four finite draggable points",
    [s.A, s.B, s.C, s.P].every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)));
  check("start has the applet's show options", s.options.names === true && s.options.hint === false);
  check("a picture has no win, loss or end", C.result(s) === null && !s.explored);
  check("the starting construction exists", !!C.geometry(s));
  check("P starts on the perpendicular bisector of AB",
    near(dist(s.P, s.A), dist(s.P, s.B), 1e-9));
  check("an unknown handle is refused", C.move(s, "Z", P(1, 1)) === s);

  const h0 = C.distanceToLine(s.P, s.A, s.B);
  const side0 = C.orientation(s.A, s.B, s.P);
  const moved = C.move(s, "A", P(120, 190));
  check("dragging A keeps P at the same distance from AB",
    near(C.distanceToLine(moved.P, moved.A, moved.B), h0, 1e-9));
  check("dragging A keeps P on the same side of AB",
    C.orientation(moved.A, moved.B, moved.P) === side0);
  check("dragging A keeps P on the new perpendicular bisector",
    near(dist(moved.P, moved.A), dist(moved.P, moved.B), 1e-9));
  const movedB = C.move(s, "B", P(280, 180));
  check("dragging B keeps the circle through A and B",
    near(dist(movedB.P, movedB.A), dist(movedB.P, movedB.B), 1e-9));

  const dragged = C.move(s, "P", P(200, 130));
  check("dragging P slides it onto the perpendicular bisector",
    near(dist(dragged.P, dragged.A), dist(dragged.P, dragged.B), 1e-9) &&
    near(dragged.P.x, 200, 1e-9) && dragged.P.y < s.P.y);
  check("dragging P adopts the new height for later drags",
    near(C.distanceToLine(dragged.P, dragged.A, dragged.B), 90, 1e-9));
  check("a drag marks the picture explored and leaves the old state alone",
    dragged.explored === true && s.explored === false);

  const far = C.move(s, "C", P(9999, -9999));
  check("dragging C clamps it to the board", far.C.x <= C.VIEW.width - C.PAD && far.C.y >= C.PAD);
  const tight = C.move(s, "A", P(-9999, 9999));
  check("dragging A clamps it to the board", tight.A.x >= C.PAD && tight.A.y <= C.VIEW.height - C.PAD);

  const hinted = C.setOption(s, "hint", true);
  check("toggling a checkbox keeps the old state", hinted.options.hint && !s.options.hint);
  check("reset restores the points and keeps the options",
    same(C.reset(hinted).A, s.A) && C.reset(hinted).options.hint === true);
  check("the hint speaks about the two equal angles", /same as|same angle|reversed/.test(C.describe(hinted)));
}

/* ------------------------------------------ 2. the claims, in every case */

let live = 0, finite = 0, centered = 0, onCircle = 0, onSides = 0, antiparallel = 0;
let inscribed = 0, cyclic = 0, convex = 0, ready = 0, interior = 0;
let maxAngleErr = 0, maxCircleErr = 0, maxInsErr = 0, maxCyclicErr = 0;

for (const { a, b, c, p } of cases) {
  const g = C.compute(a, b, c, p);
  if (!g) continue;
  live++;

  const vals = [g.circle.c.x, g.circle.c.y, g.circle.r, g.D.x, g.D.y, g.E.x, g.E.y];
  if (vals.every(Number.isFinite)) finite++;
  if (near(dist(p, a), dist(p, b), 1e-8)) centered++;

  const R = g.circle.r;
  const errs = [a, b, g.D, g.E].map((q) => Math.abs(dist(q, p) - R));
  maxCircleErr = Math.max(maxCircleErr, ...errs);
  if (errs.every((e) => e < 1e-6)) onCircle++;

  if (Math.abs(C.cross(sub(g.D, b), sub(c, b))) < 1e-5 &&
      Math.abs(C.cross(sub(g.E, a), sub(c, a))) < 1e-5) onSides++;

  // Skip only configurations where a cut is within 3px of its vertex: the
  // line DE is then almost the side itself and angles are ill-conditioned.
  const wellCut = dist(g.D, b) >= 3 && dist(g.E, a) >= 3;

  // Inscribed angles ADB and AEB: equal on one arc, supplementary on the
  // other. This is the page's last claim, and it holds in every well-cut case.
  const i1 = C.angle(g.D, a, b), i2 = C.angle(g.E, a, b);
  const ierr = Math.min(Math.abs(i1 - i2), Math.abs(i1 + i2 - Math.PI));
  maxInsErr = Math.max(maxInsErr, ierr);
  if (wellCut && ierr < 1e-6) inscribed++;

  if (g.tD > 0 && g.tD < 1 && g.tE > 0 && g.tE < 1) {
    interior++;
    // Both points on the sides: ABDE is convex and cyclic, so its opposite
    // angles add to 180 degrees, as the page says.
    const quad = [g.A, g.B, g.D, g.E];
    let turn = 0, isConvex = true;
    for (let i = 0; i < 4; i++) {
      const z = cross(sub(quad[(i + 1) % 4], quad[i]), sub(quad[(i + 2) % 4], quad[i]));
      if (Math.abs(z) > 1e-9 && turn && Math.sign(z) !== turn) isConvex = false;
      if (z) turn = Math.sign(z);
    }
    if (isConvex) convex++;
    const opp = C.angle(a, g.E, b) + C.angle(g.D, b, g.E);
    const oerr = Math.abs(opp - Math.PI);
    maxCyclicErr = Math.max(maxCyclicErr, oerr);
    if (oerr < 1e-6) cyclic++;
  }

  if (!wellCut) continue;
  ready++;
  const err = Math.max(
    Math.abs(C.lineAngle(sub(g.E, g.D), sub(a, c)) - C.lineAngle(sub(a, b), sub(b, c))),
    Math.abs(C.lineAngle(sub(g.E, g.D), sub(b, c)) - C.lineAngle(sub(b, a), sub(c, a))),
  );
  maxAngleErr = Math.max(maxAngleErr, err);
  if (err < 1e-6) antiparallel++;
}

check("every named and generated case gives a construction", live === cases.length);
check("the construction is finite in every case", finite === live);
check("P is equidistant from A and B in every case", centered === live);
check("A, B, D and E all lie on the circle about P", onCircle === live,
  `worst radius error ${maxCircleErr}`);
check("D lies on BC and E lies on AC", onSides === live);
check("the inscribed angles ADB and AEB are equal or supplementary", inscribed === ready,
  `${inscribed}/${ready}, worst error ${maxInsErr}`);
check("ABDE is convex when both cuts lie on the sides", convex === interior && interior > 40);
check("with both cuts on the sides the opposite angles add to 180 degrees",
  cyclic === interior && interior > 40, `${cyclic}/${interior}, worst error ${maxCyclicErr}`);
check("in the symmetric case the antiparallel becomes an ordinary parallel",
  Math.abs(C.cross(C.sub(C.geometry(C.start({})).E, C.geometry(C.start({})).D),
    C.sub(P(310, 220), P(90, 220)))) < 1e-9);
check("DE is antiparallel to AB in every well-cut case", antiparallel === ready && ready > 150,
  `${antiparallel}/${ready}, worst error ${maxAngleErr}`);

/* ------------------------ 3. the same answers as the applet's own bytecode */

let matchCompute = 0, matchPlace = 0, noDraw = 0, placeCases = 0;
for (const { a, b, c, p } of cases) {
  const g = C.compute(a, b, c, p);
  const x = appletCompute(a, b, c, p);
  if (!g || !x) { if (!g && !x) noDraw++; continue; }
  if (same(g.circle.c, x.circle.c) && near(g.circle.r, x.circle.r) &&
      same(g.D, x.D) && same(g.E, x.E)) matchCompute++;
}
check("the core matches the applet's Compute, circle and both cuts",
  matchCompute + noDraw === cases.length, `${matchCompute}/${cases.length}`);

const grid = rng(777);
for (let i = 0; i < 400; i++) {
  const a = P(20 + grid() * 360, 20 + grid() * 260);
  const b = P(20 + grid() * 360, 20 + grid() * 260);
  if (dist(a, b) < 30) continue;
  const height = -100 + grid() * 200;
  const oldP = P(20 + grid() * 360, 20 + grid() * 260);
  placeCases++;
  if (same(C.placeOnAxis(a, b, oldP, height), appletPlace(a, b, oldP, height))) matchPlace++;
}
check("the core matches the applet's AdjustAxisAndP over its whole range",
  matchPlace === placeCases && placeCases > 300, `${matchPlace}/${placeCases}`);
check("the applet draws nothing for a degenerate triangle",
  C.compute(P(10, 10), P(100, 10), P(11, 10), P(55, 20)) === null);

console.log(`  cases ${live}, well cut ${ready}, cuts on sides ${interior}; ` +
  `worst angle error ${maxAngleErr.toExponential(2)} rad, circle ${maxCircleErr.toExponential(2)}px`);
done("antiparallel");
