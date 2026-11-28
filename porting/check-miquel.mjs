#!/usr/bin/env node
"use strict";

/*
 * Logic test for miquel/miquel-core.js.
 *
 *   node porting/check-miquel.mjs
 *
 * The page claims two things: (1) for any three points on a triangle's sides
 * or their extensions, the three circles shown pass through one point (the
 * Pivot Theorem); (2) when those three points are collinear, the triangle's
 * circumcircle passes through the same point. Both are checked on hundreds of
 * generated configurations, including points on side extensions and exact
 * transversals across a triangle.
 *
 * Section 3 is a second, literal transcription of the applet's own methods
 * from the bytecode: RandomPoint, CreateMidPoint / UpdateMidPoint (DoubLine),
 * UpdateEndPoints, GeoSDoub.FindCircumcenter, GetCircle, IntersectCirclesX/Y,
 * Other and DrawSimson. The two implementations share no geometry code, and
 * their answers are compared on every case.
 *
 * The old page lives at https://www.cut-the-knot.org/Curriculum/Geometry/Miquel.shtml.
 * Its applet is gone from the live page; the Wayback snapshot of 28 Sep 2006
 * still embeds <applet code="Miquel" width="480" height="300">.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("miquel/miquel-core.js", "MiquelCore");

/* ------------------------------------------------ the applet, transcribed again */

const P = (x, y) => ({ x: x, y: y });
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const mul = (a, t) => P(a.x * t, a.y * t);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const d2 = (a, b) => dot(sub(a, b), sub(a, b));
const distance = (a, b) => Math.sqrt(d2(a, b));
const midpoint = (a, b) => P((a.x + b.x) / 2, (a.y + b.y) / 2);

// MiquelCanvas.RandomPoint, with Java's integer divisions.
function javaRandomPoint(i, w, h) {
  if (i === 0) return P(Math.trunc(w / 3), Math.trunc(3 * h / 5));
  if (i === 1) return P(Math.trunc(5 * w / 7), Math.trunc(3 * h / 5));
  return P(Math.trunc(w / 2), Math.trunc(h / 7));
}
// DoubLine.CreateMidPoint / UpdateEndPoints: x = m1*t + m2*(1-t).
const javaPointAt = (a, b, t) => P(a.x * t + b.x * (1 - t), a.y * t + b.y * (1 - t));
// DoubLine.UpdateMidPoint(p) with RestrictToSegment(false) — never clamped.
function javaProjectParameter(p, a, b) {
  const u = sub(a, b);
  return -dot(u, sub(b, p)) / dot(u, u);
}
// GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint).
function javaIntersectLines(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return P(NaN, NaN); // the applet's 1-unit tolerance
  return P((b1 * c2 - b2 * c1) / den, (c1 * a2 - c2 * a1) / den);
}
// GeoSDoub.FindCircumcenter and MiquelCanvas.GetCircle (radius from the first point).
function javaGetCircle(a, b, c) {
  const m1 = midpoint(a, b), m2 = midpoint(b, c);
  const t1 = P(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
  const t2 = P(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
  const o = javaIntersectLines(m1, t1, m2, t2);
  return { c: o, r: distance(o, a) };
}
// GeoSDoub.IntersectCirclesX: solve the quadratic in y.
function javaIntersectCirclesX(a, b) {
  const m = -(a.c.y - b.c.y) / (a.c.x - b.c.x);
  const q = (a.c.x * a.c.x - b.c.x * b.c.x + a.c.y * a.c.y - b.c.y * b.c.y
             - a.r * a.r + b.r * b.r) / (2 * (a.c.x - b.c.x));
  const d = q - a.c.x;
  const k = 1 + m * m;
  const c = m * d - a.c.y;
  const disc = c * c - k * (d * d + a.c.y * a.c.y - a.r * a.r);
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y1 = (-c + root) / k, y2 = (-c - root) / k;
  return [P(m * y1 + q, y1), P(m * y2 + q, y2)];
}
// GeoSDoub.IntersectCirclesY: the same quadratic in x.
function javaIntersectCirclesY(a, b) {
  const m = -(a.c.x - b.c.x) / (a.c.y - b.c.y);
  const q = (a.c.y * a.c.y - b.c.y * b.c.y + a.c.x * a.c.x - b.c.x * b.c.x
             - a.r * a.r + b.r * b.r) / (2 * (a.c.y - b.c.y));
  const d = q - a.c.y;
  const k = 1 + m * m;
  const c = m * d - a.c.x;
  const disc = c * c - k * (d * d + a.c.x * a.c.x - a.r * a.r);
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x1 = (-c + root) / k, x2 = (-c - root) / k;
  return [P(x1, m * x1 + q), P(x2, m * x2 + q)];
}
function javaIntersectCircles(a, b) {
  if (Math.abs(a.c.x - b.c.x) > 1) return javaIntersectCirclesX(a, b);
  if (Math.abs(a.c.y - b.c.y) > 1) return javaIntersectCirclesY(a, b);
  return [P(a.c.x, a.c.y), P(a.c.x, a.c.y)];
}
// MiquelCanvas.Other: the meeting that is not the shared point.
function javaOther(points, ref) {
  return distance(points[0], ref) < 1 ? points[1] : points[0];
}
// GeoSDoub.Dist(DoubPoint, DoubLine), used by DrawSimson.
function javaDistanceToLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (d2(a, p) < 0.1) return 0;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return distance(p, P(a.x + dx * t, a.y + dy * t));
}
// MiquelCanvas.DrawCircles(g) — the page's three circles and the yellow dot.
function javaDrawCircles(v, m) {
  const circles = [javaGetCircle(v[0], m[1], m[2]),
                   javaGetCircle(v[1], m[0], m[2]),
                   javaGetCircle(v[2], m[0], m[1])];
  const pair = javaIntersectCircles(circles[0], circles[1]);
  return { circles: circles, p: pair ? javaOther(pair, m[2]) : null };
}
// MiquelCanvas.DrawSimson: the first of the three pairs within one unit.
function javaDrawSimson(m) {
  const ds = [javaDistanceToLine(m[0], m[1], m[2]),
              javaDistanceToLine(m[1], m[0], m[2]),
              javaDistanceToLine(m[2], m[0], m[1])];
  for (let i = 0; i < 3; i++) if (ds[i] < 1) return { pair: [[1, 2], [0, 2], [0, 1]][i], ds: ds };
  return { pair: null, ds: ds };
}

/* ---------------------------------------------------------------- 1. the state */

{
  const s = C.start({});
  check("start uses the applet's three vertices from RandomPoint",
    s.vertices.every((p, i) => distance(p, javaRandomPoint(i, C.VIEW.width, C.VIEW.height)) === 0));
  check("start gives each side a random fraction in [0,1)",
    s.t.length === 3 && s.t.every((t) => t >= 0 && t < 1));
  check("the illustration has no win and no loss", C.result(s) === null && C.result(C.reset(s)) === null);
  check("reset keeps the same vertices", C.reset(s).vertices.every((p, i) => distance(p, s.vertices[i]) === 0));
  const moved = C.moveVertex(s, 0, P(9999, -9999));
  check("dragging a corner clamps it inside the board",
    moved.vertices[0].x <= C.VIEW.width - C.PAD && moved.vertices[0].y >= C.PAD);
  check("dragging a corner keeps the side fractions", moved.t.every((t, i) => t === s.t[i]));
  check("an unknown corner is refused", C.moveVertex(s, 7, P(1, 1)) === s);
  check("moving something marks the picture explored", moved.explored && !s.explored);
  const projected = C.moveSidePoint(s, 0, P(10, 280));
  check("a side point is projected onto its side line",
    C.distanceToLine(C.sidePoints(projected)[0], s.vertices[1], s.vertices[2]) < 1e-9);
  check("an unknown side point is refused", C.moveSidePoint(s, 9, P(1, 1)) === s);
  const aligned = C.makeCollinear(s);
  check("the collinearity button makes the three points line up",
    C.collinearity(C.sidePoints(aligned)).collinear);
}

/* --------------------------------------------- 2. generated configurations */

const rand = rng(20261128);
const cases = [];
for (let i = 0; i < 320; i++) {
  const v = [P(25 + rand() * 430, 25 + rand() * 250),
             P(25 + rand() * 430, 25 + rand() * 250),
             P(25 + rand() * 430, 25 + rand() * 250)];
  const area = Math.abs((v[1].x - v[0].x) * (v[2].y - v[0].y)
                      - (v[2].x - v[0].x) * (v[1].y - v[0].y)) / 2;
  if (area < 2200) continue;
  // Half the cases use side extensions, as the applet's hint allows.
  const t = [0, 1, 2].map(() => (i % 2 ? -0.6 - rand() * 0.5 : 0.15 + rand() * 0.7));
  cases.push({ name: `random-${i}`, v: v, t: t });
}

let live = 0, finite = 0, onLine = 0, sameCenters = 0, sameP = 0, samePairs = 0;
let pivot = 0, javaPivot = 0, notOnCircum = 0, simsonAgree = 0;
let maxClaim = 0, maxApplet = 0;

for (const { v, t } of cases) {
  const state = { vertices: v, t: t, explored: false };
  const g = C.geometry(state);
  const j = javaDrawCircles(v, C.sidePoints(state));
  if (!g || !j.p || !Number.isFinite(j.p.x) || !Number.isFinite(j.p.y)) continue;
  live++;

  const vals = [g.point.x, g.point.y, ...g.circles.flatMap((c) => [c.c.x, c.c.y, c.r])];
  if (vals.every(Number.isFinite)) finite++;

  // The side points stay on their side lines, extensions included.
  if (g.side.every((m, i) => C.distanceToLine(m, C.ends(v, i)[0], C.ends(v, i)[1]) < 1e-7)) onLine++;

  // Pivot theorem: all three circles pass through the same point P.
  const gaps = g.circles.map((c) => Math.abs(C.dist(c.c, g.point) - c.r));
  maxClaim = Math.max(maxClaim, ...gaps);
  if (gaps.every((x) => x < 1e-6)) pivot++;

  // The applet's own transcription has the same conclusion.
  const jgaps = j.circles.map((c) => Math.abs(distance(c.c, j.p) - c.r));
  if (jgaps.every((x) => x < 1e-5)) javaPivot++;

  // The page's "when collinear" condition is not met here; P is off the
  // circumcircle, which is why the applet draws that circle only then.
  if (Math.abs(g.circumGap) > 0.05) notOnCircum++;

  // Both ways to find the three centres and radii agree.
  const centerErr = Math.max(...g.circles.map((c, i) =>
    Math.max(distance(c.c, j.circles[i].c), Math.abs(c.r - j.circles[i].r))));
  maxApplet = Math.max(maxApplet, centerErr);
  if (centerErr < 1e-5) sameCenters++;

  // And they find the same Miquel point, via the same Other() rule.
  const pErr = distance(g.point, j.p);
  maxApplet = Math.max(maxApplet, pErr);
  if (pErr < 1e-5) sameP++;

  const corePairs = C.circleIntersection(g.circles[0], g.circles[1]).sort((a, b) => a.x - b.x);
  const javaPairs = javaIntersectCircles(j.circles[0], j.circles[1]).sort((a, b) => a.x - b.x);
  if (corePairs.length === javaPairs.length && corePairs.length > 0
      && corePairs.every((p, i) => distance(p, javaPairs[i]) < 1e-5)) samePairs++;

  if (C.collinearity(g.side).collinear === !!javaDrawSimson(g.side).pair) simsonAgree++;
}

check(`all ${cases.length} generated triangles give a drawing`, live === cases.length, `${live}/${cases.length}`);
check("all computed coordinates are finite", finite === live, `${finite}/${live}`);
check("the three side points lie on their side lines or extensions", onLine === live, `${onLine}/${live}`);
check("the pivot theorem holds on every configuration", pivot === live, `${pivot}/${live}`);
check("the applet's own transcription also finds one point on all three circles", javaPivot === live, `${javaPivot}/${live}`);
check("off a transversal, the Miquel point is not on the circumcircle", notOnCircum === live, `${notOnCircum}/${live}`);
check("core and bytecode agree on all three centres and radii", sameCenters === live, `${sameCenters}/${live}`);
check("core and bytecode agree on every Miquel point", sameP === live, `${sameP}/${live}`);
check("core and bytecode agree on both circle intersections", samePairs === live, `${samePairs}/${live}`);
check("core and bytecode agree on when points count as collinear", simsonAgree === live, `${simsonAgree}/${live}`);
check(`the pivot claim holds to ${maxClaim.toExponential(1)}`, maxClaim < 1e-5);

/* ---------------------- 3. exact transversals: the page's four-line claim */

const transversals = [];
for (let i = 0; i < 260; i++) {
  const v = [P(40 + rand() * 400, 40 + rand() * 220),
             P(40 + rand() * 400, 40 + rand() * 220),
             P(40 + rand() * 400, 40 + rand() * 220)];
  const area = Math.abs((v[1].x - v[0].x) * (v[2].y - v[0].y)
                      - (v[2].x - v[0].x) * (v[1].y - v[0].y)) / 2;
  if (area < 3000) continue;
  const g = P((v[0].x + v[1].x + v[2].x) / 3, (v[0].y + v[1].y + v[2].y) / 3);
  const a = rand() * Math.PI;
  const d = P(Math.cos(a), Math.sin(a));
  let ok = true;
  const t = [];
  for (let side = 0; side < 3; side++) {
    const e = C.ends(v, side);
    const q = C.lineIntersection(g, C.add(g, d), e[0], e[1]);
    if (!q) { ok = false; break; }
    // Drag each marked point to the transversal crossing: the core projects
    // it onto the side line, just as MiquelCanvas.mouseDragged does.
    t.push(javaProjectParameter(q, e[0], e[1]));
  }
  // A marked point coinciding with a corner makes the circles tangent;
  // keep those out of the exact-transversal checks, as the applet would
  // have no visible Miquel dot there either.
  if (ok && t.every((x) => Math.abs(x) > 0.08 && Math.abs(1 - x) > 0.08 && Math.abs(x) < 3)) {
    transversals.push({ v: v, t: t });
  }
}

let collinear = 0, javaCollinear = 0, fourCircles = 0, onSimson = 0, matched = 0;
let brokeOff = 0, maxFour = 0, maxLine = 0;
for (const { v, t } of transversals) {
  const s = { vertices: v, t: t, explored: false };
  const g = C.geometry(s);
  if (!g) continue;
  const j = javaDrawCircles(v, C.sidePoints(s));
  if (!j.p) continue;

  const col = C.collinearity(g.side);
  const jcol = javaDrawSimson(g.side);
  if (col.collinear) collinear++;
  if (jcol.pair) javaCollinear++;
  if (col.pair && jcol.pair && col.pair[0] === jcol.pair[0] && col.pair[1] === jcol.pair[1]) matched++;

  if (col.collinear && g.circum) {
    const errs = g.circles.concat([g.circum]).map((c) => Math.abs(C.dist(c.c, g.point) - c.r));
    maxFour = Math.max(maxFour, ...errs);
    if (errs.every((x) => x < 1e-5)) fourCircles++;
  }
  if (col.pair) {
    const [a, b] = col.pair;
    const err = Math.max(...g.side.map((m) => C.distanceToLine(m, g.side[a], g.side[b])));
    maxLine = Math.max(maxLine, err);
    if (err < 1e-6) onSimson++;
  }

  // A small slide along one side breaks the collinearity and the concurrency.
  const shifted = t.slice();
  shifted[0] += 1;
  const g2 = C.geometry({ vertices: v, t: shifted, explored: false });
  if (g2 && !C.collinearity(g2.side).collinear && Math.abs(g2.circumGap) > 0.05) brokeOff++;
}

check(`${transversals.length} exact transversals were constructed`, transversals.length > 90, `${transversals.length}`);
check("the core sees every transversal as collinear", collinear === transversals.length, `${collinear}/${transversals.length}`);
check("the applet's DrawSimson sees the same transversals", javaCollinear === transversals.length, `${javaCollinear}/${transversals.length}`);
check("both pick the same first pair of points for the simson line", matched === transversals.length, `${matched}/${transversals.length}`);
check("all three points lie on the reported line", onSimson === transversals.length, `${onSimson}/${transversals.length}`);
check("the four circles share the Miquel point, as the page claims", fourCircles === transversals.length, `${fourCircles}/${transversals.length}`);
check(`the four-line claim holds to ${maxFour.toExponential(1)}`, maxFour < 1e-5);
check(`the marked points lie on the simson line to ${maxLine.toExponential(1)}`, maxLine < 1e-6);
check("sliding one point off the line loses the circumcircle", brokeOff === transversals.length, `${brokeOff}/${transversals.length}`);

/* ------------------- 4. the initial drawing and the extension behaviour */

{
  const s = C.start({ vertices: C.HOME, t: [0.42, 0.63, 0.28] });
  const g = C.geometry(s);
  const j = javaDrawCircles(s.vertices, C.sidePoints(s));
  check("the initial drawing has a Miquel point", !!g && !!j.p);
  check("the initial point matches the bytecode transcription", distance(g.point, j.p) < 1e-5);

  // Extensions: t < 0 puts the marked point beyond the other corner.
  const ext = C.moveSidePoint(s, 2, C.pointAt(s.vertices[0], s.vertices[1], -0.4));
  check("a point can sit on a side's extension", ext.t[2] < 0);
  check("the extension point is still projected on the side line",
    C.distanceToLine(C.sidePoints(ext)[2], s.vertices[0], s.vertices[1]) < 1e-9);
  const gExt = C.geometry(ext);
  check("the pivot theorem survives a point on an extension",
    gExt && gExt.circles.every((c) => Math.abs(C.dist(c.c, gExt.point) - c.r) < 1e-6));

  // Moving a vertex keeps the fraction, as UpdateEndPoints does.
  const moved = C.moveVertex(s, 1, P(280, 100));
  const jm = C.sidePoints({ vertices: moved.vertices, t: s.t });
  const jExpected = [javaPointAt(moved.vertices[1], moved.vertices[2], s.t[0]),
                     javaPointAt(moved.vertices[0], moved.vertices[2], s.t[1]),
                     javaPointAt(moved.vertices[0], moved.vertices[1], s.t[2])];
  check("UpdateEndPoints is reproduced point for point",
    jm.every((m, i) => distance(m, jExpected[i]) < 1e-12));

  const description = C.describe(s);
  check("the status keeps the applet's hint", /midpoints/.test(description));
  check("a transversal status reports the circumcircle",
    /circumcircle/.test(C.describe(C.makeCollinear(s))));
}

done("miquel");
