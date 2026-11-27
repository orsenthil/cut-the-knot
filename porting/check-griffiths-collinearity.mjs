#!/usr/bin/env node
"use strict";

/*
 * Logic test for griffiths-collinearity/griffiths-collinearity-core.js.
 *
 *   node porting/check-griffiths-collinearity.mjs
 *
 * Two independent readings of the applet are compared here:
 *
 * 1. A second, literal transcription of Compute() and of the CTK geometry
 *    routines it calls: GeoSDoub.Intersect (Cramer's rule, |det| < 1 is NaN),
 *    NearestPoint, FindCircumcenter, GetCircle, IntersectCirclesX/Y,
 *    CTKGeometryPlus.DefineLine and InsideTest.IsInside. It shares no code
 *    with the core. Both are run on the default picture and on 260 generated
 *    triangles and transversals.
 * 2. The page's claims, checked on every usable case: the three pedal circles
 *    of P, Q, R pass through two common points; their centres are collinear;
 *    and the Griffiths special case (a line through the circumcentre) puts one
 *    of those points on the nine-point circle. The page says the line "does
 *    need" to pass through the circumcentre; the rest of its paragraph, the
 *    applet and these tests show it does NOT need to (a typo on the page).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("griffiths-collinearity/griffiths-collinearity-core.js", "GriffithsCollinearityCore");

/* ------------------------------------------------------------- small tools */

const pt = (x, y) => ({ x, y });
const add = (a, b) => pt(a.x + b.x, a.y + b.y);
const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
const mul = (a, t) => pt(a.x * t, a.y * t);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const mid = (a, b) => pt((a.x + b.x) / 2, (a.y + b.y) / 2);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
const lineDist = (p, a, b) => Math.abs(cross(a, b, p)) / dist(a, b);

/* ------------------------- the applet's own methods, transcribed a second time */

// GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint).
function jLineX(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return null;
  return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

// GeoSDoub.NearestPoint: p itself when the side is shorter than sqrt(0.1).
function jFoot(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx * dx + dy * dy < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return pt(a.x + dx * t, a.y + dy * t);
}

// GeoSDoub.FindCircumcenter: intersect the two perpendicular bisectors as
// GeoSDoub.Intersect does, rather than solving a vector equation.
function jCircumcenter(a, b, c) {
  const m1 = mid(a, b), m2 = mid(b, c);
  const u = pt(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
  const v = pt(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
  return jLineX(m1, u, m2, v);
}

// GetCircle: centre, then the mean of the three radii (NaN for collinear feet).
function jCircle(a, b, c) {
  if (!a || !b || !c) return null;
  const centre = jCircumcenter(a, b, c);
  if (!centre || !Number.isFinite(centre.x) || !Number.isFinite(centre.y)) return null;
  const r = (dist(centre, a) + dist(centre, b) + dist(centre, c)) / 3;
  return Number.isFinite(r) ? { c: centre, r } : null;
}

// GeoSDoub.IntersectCirclesX: x = k*y + x0 is the radical axis.
function jCirclesX(c0, r0, c1, r1) {
  const k = -(c0.y - c1.y) / (c0.x - c1.x);
  const x0 = (c0.x ** 2 - c1.x ** 2 + c0.y ** 2 - c1.y ** 2 - r0 ** 2 + r1 ** 2) /
             (2 * (c0.x - c1.x));
  const dx = x0 - c0.x;
  const b = k * dx - c0.y;
  const c = dx * dx + c0.y ** 2 - r0 ** 2;
  const disc = b * b - (k * k + 1) * c;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  const y1 = (-b + s) / (k * k + 1), y2 = (-b - s) / (k * k + 1);
  return [pt(k * y1 + x0, y1), pt(k * y2 + x0, y2)];
}

// GeoSDoub.IntersectCirclesY: y = k*x + y0 is the radical axis.
function jCirclesY(c0, r0, c1, r1) {
  const k = -(c0.x - c1.x) / (c0.y - c1.y);
  const y0 = (c0.x ** 2 - c1.x ** 2 + c0.y ** 2 - c1.y ** 2 - r0 ** 2 + r1 ** 2) /
             (2 * (c0.y - c1.y));
  const dy = y0 - c0.y;
  const b = k * dy - c0.x;
  const c = dy * dy + c0.x ** 2 - r0 ** 2;
  const disc = b * b - (k * k + 1) * c;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  const x1 = (-b + s) / (k * k + 1), x2 = (-b - s) / (k * k + 1);
  return [pt(x1, k * x1 + y0), pt(x2, k * x2 + y0)];
}

function jCircleCircle(c0, c1) {
  if (Math.abs(c0.c.x - c1.c.x) > 1) return jCirclesX(c0.c, c0.r, c1.c, c1.r);
  if (Math.abs(c0.c.y - c1.c.y) > 1) return jCirclesY(c0.c, c0.r, c1.c, c1.r);
  return [pt(c0.c.x, c0.c.y), pt(c0.c.x, c0.c.y)]; // the applet's degenerate pair
}

// InsideTest.IsInside(a,b,c): (a-b)·(a-c) <= 0.
function jInside(a, b, c) {
  return (a.x - b.x) * (a.x - c.x) + (a.y - b.y) * (a.y - c.y) <= 0;
}

// CTKGeometryPlus.DefineLine(p0,p1,p2), including its odd argument order.
function jDefineLine(p0, p1, p2) {
  if (jInside(p1, p0, p2)) return [p0, p2];
  if (jInside(p2, p0, p1)) return [p0, p1];
  return [p1, p2];
}

function jClip(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) + Math.abs(dy) < 1e-12) return [a, b];
  let lo = -Infinity, hi = Infinity;
  for (const [p, d, max] of [[a.x, dx, 500], [a.y, dy, 400]]) {
    if (Math.abs(d) < 1e-12) continue;
    const t0 = -p / d, t1 = (max - p) / d;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [a, b];
  return [pt(a.x + dx * lo, a.y + dy * lo), pt(a.x + dx * hi, a.y + dy * hi)];
}

// Compute(), method for method.
function jCompute(state) {
  const sides = [[state.B, state.C], [state.C, state.A], [state.A, state.B]];
  const [l0, l1] = state.line;
  const feet = sides.map(([a, b]) => jLineX(a, b, l0, l1));
  const intersection = feet.map((f, i) => sides.map(([a, b], j) =>
    !f ? null : j === i ? f : jFoot(f, a, b)));
  const circles = intersection.map((row) => jCircle(row[0], row[1], row[2]));
  let axis = null, common = [];
  if (circles.every(Boolean)) axis = jClip(...jDefineLine(circles[0].c, circles[1].c, circles[2].c));
  if (circles[0] && circles[1]) common = jCircleCircle(circles[0], circles[1]);
  return { feet, intersection, circles, axis, common };
}

/* -------------------------------------------------------------- test cases */

const rand = rng(20261127);
const cases = [];
const start = C.start({});
cases.push({ name: "applet default", state: start });

const centre = C.circleOf(start.A, start.B, start.C).c;
const onCentre = (angle) => C.clipLine(centre, add(centre, pt(200 * Math.cos(angle), 200 * Math.sin(angle))));
cases.push({ name: "through circumcentre", state: Object.assign({}, start, { line: onCentre(0.4) }) });
cases.push({ name: "line parallel to BC", state: Object.assign({}, start, {
  line: C.clipLine(pt(20, 140), pt(480, 140 + (start.C.y - start.B.y) /
    (start.C.x - start.B.x) * 460)),
}) });
cases.push({ name: "line through A", state: Object.assign({}, start, {
  line: C.clipLine(start.A, pt(450, 30)),
}) });
cases.push({ name: "line far from circumcentre", state: Object.assign({}, start, {
  line: C.clipLine(pt(0, 375), pt(500, 385)),
}) });

for (let i = 0; i < 260; i++) {
  const p = () => pt(30 + rand() * 440, 30 + rand() * 340);
  const A = p(), B = p(), Cc = p();
  if (Math.abs(cross(A, B, Cc)) < 3000 || dist(A, B) < 80 ||
      dist(B, Cc) < 80 || dist(Cc, A) < 80) continue;
  const anchor = pt(-60 + rand() * 620, -60 + rand() * 520);
  const angle = rand() * Math.PI;
  const line = C.clipLine(anchor, add(anchor, pt(300 * Math.cos(angle), 300 * Math.sin(angle))));
  cases.push({ name: `generated ${i}`, state: { A, B, C: Cc, line,
    options: { names: false, circles: false, perps: false }, explored: false } });
}

/* ---------------------------------------------- 1. the rules and the options */

{
  check("the page embeds the applet at 500 by 400", C.VIEW.width === 500 && C.VIEW.height === 400);
  check("the default triangle is the applet's A, B and C",
    Math.abs(start.A.x - (250 + 80 * Math.cos(-1.6))) < 1e-12 &&
    Math.abs(start.B.y - (200 + 80 * Math.sin(-4.0))) < 1e-12 &&
    Math.abs(start.C.x - (250 + 1.1 * 80 * Math.cos(0.5))) < 1e-12);
  const appletLinePoint = pt(250 + 200 * Math.cos(-3.6), 200 + 200 * Math.sin(-3.6));
  check("the default line joins the applet's two points on the border",
    start.line[0].x === 0 && start.line[1].x === 500 &&
    C.distanceToLine(appletLinePoint, start.line[0], start.line[1]) < 1e-9);
  check("names are on but circles and perpendiculars are off",
    start.options.names === true && !start.options.circles && !start.options.perps);
  equal("the six draggable things", C.legalMoves(start),
    ["A", "B", "C", "line1", "line2", "lineMid"]);
  check("an unknown handle is refused", C.move(start, "Z", pt(1, 2)) === start);
  const moved = C.move(start, "A", pt(9999, -9999));
  check("a vertex drag stays on the board and leaves the old state alone",
    moved.A.x === 500 && moved.A.y === 0 && start.A.x < 500 && moved.explored && !start.explored);
  const end = C.move(start, "line1", pt(250, 10));
  check("dragging a line end keeps both ends on the border",
    end.line.every((p) => p.x === 0 || p.x === 500 || p.y === 0 || p.y === 400));
  const slid = C.move(start, "lineMid", pt(mid(start.line[0], start.line[1]).x + 30,
    mid(start.line[0], start.line[1]).y + 20));
  check("sliding the line's middle moves the whole line",
    dist(mid(slid.line[0], slid.line[1]), mid(start.line[0], start.line[1])) > 1);
  check("an option toggle is immutable", C.setOption(start, "circles", true).options.circles &&
    !start.options.circles && C.setOption(start, "nope", true) === start);
  check("reset keeps the shown options", C.reset(C.setOption(start, "perps", true)).options.perps &&
    dist(C.reset(start).A, start.A) === 0 && dist(C.reset(start).line[0], start.line[0]) === 0);
  check("a demo never wins or loses", C.result(start) === null &&
    C.result(C.move(start, "B", pt(200, 200))) === "done");
  const flat = Object.assign({}, start, { C: pt(mid(start.A, start.B).x, mid(start.A, start.B).y) });
  check("a collapsed triangle has no nine-point circle", C.geometry(flat).nine === null &&
    typeof C.describe(flat) === "string");
}

/* ---------------------------- 2. the core against the applet's own Compute() */

let live = 0, matched = 0, collinear = 0, withCommon = 0, twoCommon = 0;
let noCommon = 0, nineOk = 0, farNotNine = 0;
let maxCompute = 0, maxCol = 0, maxCommon = 0, maxNine = 0;

for (const { state } of cases) {
  const g = C.geometry(state);
  const x = jCompute(state);
  if (!g.feet.every(Boolean) || g.circles.some((c) => !c)) continue;
  if (!x.feet.every(Boolean) || x.circles.some((c) => !c)) continue;
  live++;

  // The second transcription and the core must agree on every intermediate.
  let worst = 0;
  for (let i = 0; i < 3; i++) {
    worst = Math.max(worst, dist(g.feet[i], x.feet[i]),
      dist(g.circles[i].c, x.circles[i].c), Math.abs(g.circles[i].r - x.circles[i].r));
    for (let j = 0; j < 3; j++) {
      worst = Math.max(worst, dist(g.intersection[i][j], x.intersection[i][j]));
    }
  }
  if (g.axis && x.axis) {
    worst = Math.max(worst, Math.min(dist(g.axis[0], x.axis[0]) + dist(g.axis[1], x.axis[1]),
      dist(g.axis[0], x.axis[1]) + dist(g.axis[1], x.axis[0])));
  }
  if (g.common.length === x.common.length) {
    for (const p of g.common) {
      worst = Math.max(worst, Math.min(...x.common.map((q) => dist(p, q))));
    }
  } else worst = Infinity;
  maxCompute = Math.max(maxCompute, worst);
  if (worst < 1e-6) matched++;

  // Page claim 1: the three centres are collinear (the line FindAxis draws).
  const col = lineDist(g.circles[2].c, g.axis[0], g.axis[1]);
  maxCol = Math.max(maxCol, col);
  if (col < 1e-7) collinear++;

  // Page claim 2: when the first two circles really meet, their two meetings
  // also lie on the third. Sometimes one circle contains another: then there
  // are no real common points and the applet draws none either.
  if (g.common.length === 2 && x.common.length === 2) {
    withCommon++;
    const err = Math.max(...g.common.map((p) =>
      Math.max(...g.circles.map((c) => Math.abs(dist(p, c.c) - c.r)))));
    maxCommon = Math.max(maxCommon, err);
    if (err < 1e-7) twoCommon++;
  } else if (!g.common.length && !x.common.length) noCommon++;

  // Griffiths' theorem is the special case where the transversal crosses the
  // circumcentre: one common point then lies on the nine-point circle.
  if (g.nine) {
    const err = Math.min(...g.common.map((p) => Math.abs(dist(p, g.nine.c) - g.nine.r)));
    maxNine = Math.max(maxNine, err);
    if (lineDist(centre, state.line[0], state.line[1]) < 1e-9) {
      if (err < 1e-7) nineOk++;
    } else if (err > 0.5) farNotNine++;
  }
}

check(`plenty of configurations have a full geometry (${live} of ${cases.length})`,
  live > 140, `${live}/${cases.length}`);
check(`the core matches Compute() on all cases (worst ${maxCompute.toExponential(1)})`,
  matched === live, `${matched}/${live}`);
check(`the three pedal-circle centres are collinear (worst ${maxCol.toExponential(1)})`,
  collinear === live, `${collinear}/${live}`);
check(`both common points lie on all three circles (worst ${maxCommon.toExponential(1)})`,
  twoCommon === withCommon && withCommon > 100, `${twoCommon}/${withCommon}`);
check(`some circles have no real common point, as in the applet (${noCommon} cases)`,
  noCommon > 10 && withCommon + noCommon === live, `${noCommon}/${live}`);
check("Griffiths' nine-point-circle point appears when the line hits the centre",
  nineOk === 1, `${nineOk} of one exact case, worst ${maxNine.toExponential(1)}`);
check("off-centre lines do not in general put a common point on that circle",
  farNotNine > 100, `${farNotNine}/${live}`);

/* --------------------------- 3. the page's claims, away from the applet code */

{
  let ok = 0, total = 0, worst = 0;
  for (let i = 0; i < 200; i++) {
    const p = () => pt(20 + rand() * 460, 20 + rand() * 360);
    const a = p(), b = p(), c = p();
    if (Math.abs(cross(a, b, c)) < 5000) continue;
    // A fresh transversal is enough: P, Q, R need not be on the segments.
    const q = p(), dir = pt(Math.cos(rand() * Math.PI), Math.sin(rand() * Math.PI));
    const line = C.clipLine(q, add(q, mul(dir, 400)));
    const g = C.geometry({ A: a, B: b, C: c, line,
      options: { names: true, circles: false, perps: false }, explored: false });
    if (g.feet.some((f) => !f) || g.circles.some((s) => !s) || g.common.length !== 2) continue;
    total++;
    const err = Math.max(...g.common.map((t) => Math.max(...g.circles.map((s) =>
      Math.abs(dist(t, s.c) - s.r)))));
    worst = Math.max(worst, err);
    if (err < 1e-7 && lineDist(g.circles[2].c, g.axis[0], g.axis[1]) < 1e-7) ok++;
  }
  check(`coaxality holds for arbitrary triangles and transversals (${ok}/${total}, worst ${worst.toExponential(1)})`,
    total > 100 && ok === total);
}

/* --------------------------------- 4. the drawing options and the status line */

{
  const g = C.geometry(start);
  check("there are three feet, one on each side", g.feet.length === 3 &&
    Math.abs(cross(start.B, start.C, g.feet[0])) < 1e-6 &&
    Math.abs(cross(start.C, start.A, g.feet[1])) < 1e-6 &&
    Math.abs(cross(start.A, start.B, g.feet[2])) < 1e-6);
  check("each row reuses its own foot and projects it onto the other two sides",
    C.foot(g.feet[0], start.B, start.C) !== null &&
    dist(g.intersection[0][0], g.feet[0]) === 0 &&
    Math.abs(cross(start.A, start.B, g.intersection[0][2])) < 1e-6);
  check("the three pedal circles have different centres at the start",
    dist(g.circles[0].c, g.circles[1].c) > 1 && dist(g.circles[1].c, g.circles[2].c) > 1);
  check("the status names P, Q and R and the two common points",
    C.describe(start).includes("P, Q and R") && C.describe(start).includes("two points"));
  const toggled = C.setOption(start, "circles", true);
  check("the circles checkbox is a state change, not a geometry change",
    toggled.options.circles && C.geometry(toggled).circles[0].c.x === g.circles[0].c.x);
  const p1 = C.move(start, "line1", pt(0, 200));
  check("rotating a line end changes the feet and finishes the exploration",
    p1.explored && dist(C.geometry(p1).feet[0], g.feet[0]) > 1);
}

done("griffiths-collinearity");
