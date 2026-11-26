#!/usr/bin/env node
"use strict";

/*
 * Logic test for arbelos-rect/arbelos-rect-core.js.
 *
 *   node porting/check-arbelos-rect.mjs
 *
 * The cut-the-knot page makes two exact claims: (1) CEDF is a rectangle;
 * (2) EF is the common tangent to the two small semicircles. Its proof also
 * asserts the angle chain AEOa = EAOa = DCE = CEF and, in the remark, OE = OC.
 * The related area equality of the arbelos family is CD^2 = AC*CB, so the
 * shoemaker's knife has area pi*CD^2/4, the area of the circle on CD.
 *
 * Every one of those claims is checked at 1001 draggable positions of C and
 * at 2000 random ones. The geometry is also compared against a second,
 * literal transcription of the applet's own methods from its bytecode:
 * init() (margin and rectangle), Draw() (D via the square root),
 * FindCrossPoint(i) (second circle/line intersection via Other), Midpoint,
 * and PointIsEligible.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("arbelos-rect/arbelos-rect-core.js", "ArbelosRectCore");
const near = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol;
const PI = Math.PI;

/* ------- a second transcription, straight from ArbelosRectCanvas's bytecode */

/** init(): side = min(w - 2m, 2(h - 2m)); rect(m, h - m - side/2, side, side). */
function appletRect(width, height, margin) {
  const side = Math.min(width - 2 * margin, 2 * (height - 2 * margin));
  return { x: margin, y: height - margin - side / 2, width: side, height: side };
}

/** DoubLine.RestrictToSegment + CreateMidPoint(f): a point f along AB. */
function appletPoint(rect, f) {
  const A = { x: rect.x, y: rect.y + rect.height / 2 };
  const B = { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f };
}

/** Draw(): D.x = C.x; D.y = C.y - sqrt((C.x - A.x) * (B.x - C.x)). */
function appletD(rect, point) {
  const product = (point.x - rect.x) * (rect.x + rect.width - point.x);
  return { x: point.x, y: point.y - Math.sqrt(product) };
}

/** Midpoint(p, q), used for the two small centres and for O. */
function appletMid(p, q) {
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

/** GeoSDoub.Dist(p, q). */
function appletDist(p, q) {
  return Math.hypot(q.x - p.x, q.y - p.y);
}

/** GeoSDoub.Intersect(DoubCircle(centre, r), DoubLine(p, q)). */
function appletIntersections(p, q, centre, r) {
  const dx = q.x - p.x, dy = q.y - p.y;
  const fx = p.x - centre.x, fy = p.y - centre.y;
  const A = dx * dx + dy * dy;
  const B = 2 * (fx * dx + fy * dy);
  const Cc = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * Cc;
  if (disc < 0) return [];
  if (disc === 0) return [{ x: p.x - B / (2 * A) * dx, y: p.y - B / (2 * A) * dy }];
  const s = Math.sqrt(disc);
  return [(-B + s) / (2 * A), (-B - s) / (2 * A)].map((u) => ({
    x: p.x + u * dx, y: p.y + u * dy,
  }));
}

/** Other(points, endpoint): the intersection that is not the endpoint. */
function appletOther(points, endpoint) {
  const found = points.find((p) => appletDist(p, endpoint) >= 1);
  return found ?? points[0];
}

/** FindCrossPoint(i): second meeting of A/B-to-D with the small circle on AC/CB. */
function appletCross(rect, point, D, i) {
  const end = i === 0
    ? { x: rect.x, y: rect.y + rect.height / 2 }
    : { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  const centre = appletMid(end, point); // Midpoint of A and C, or B and C
  const radius = appletDist(end, centre); // GeoSDoub.Dist(A, centre)
  return appletOther(appletIntersections(end, D, centre, radius), end);
}

/** PointIsEligible(x, y): strictly inside the first/last 5px and above AB. */
function appletEligible(rect, x, y) {
  return x > rect.x + 5 && y > rect.y &&
    x < rect.x + rect.width - 5 && y < rect.y + rect.height / 2 - 2;
}

/** The ordinary angle at a vertex, for the page's equal-angle claims. */
function angleAt(vertex, p, q) {
  const u = { x: p.x - vertex.x, y: p.y - vertex.y };
  const v = { x: q.x - vertex.x, y: q.y - vertex.y };
  const dot = u.x * v.x + u.y * v.y;
  const cos = dot / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

const dot = (u, v) => u.x * v.x + u.y * v.y;
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const len = (p) => Math.hypot(p.x, p.y);

/* ---------------------------------------------- 1. the applet's constants */

{
  const r = appletRect(C.WIDTH, C.HEIGHT, C.MARGIN);
  check("the applet's margin is 30", C.MARGIN === 30);
  check("the board is 400 x 250, the applet's optimal size",
    C.WIDTH === 400 && C.HEIGHT === 250);
  check("the square follows init() exactly",
    JSON.stringify(C.RECT) === JSON.stringify(r));
  check("the diameter is min(w-2m, 2(h-2m)) = 340",
    C.SIDE === 340 && C.SIDE === r.width && C.SIDE === r.height);
  check("AB lies 30px above the bottom, as init() gives",
    C.BASE_Y === 220 && near(C.BASE_Y, r.y + r.height / 2));
  check("the applet starts C at 0.3 along AB",
    C.START_T === 0.3 && C.start({}).t === 0.3 &&
    near(C.geometry(C.start({})).C.x, appletPoint(r, 0.3).x));
  check("the eligible drag region keeps 5px from each end, as PointIsEligible does",
    C.MIN_GAP === 5 &&
    !C.eligible(r.x + 5, C.BASE_Y - 5) &&
    !C.eligible(r.x + r.width - 5, C.BASE_Y - 5) &&
    C.eligible(r.x + 50, C.BASE_Y - 5));
}

/* ------------------------------- 2. state, clamps, and the saved position */

{
  const s = C.start({});
  check("start is plain data, nothing more", JSON.stringify(s) === '{"t":0.3}');
  check("start is driven only by its options",
    JSON.stringify(C.start({ t: 0.72 })) === JSON.stringify(C.start({ t: 0.72 })));
  const next = C.setT(s, 0.8);
  check("setT leaves the old state alone and returns a new one",
    s.t === 0.3 && next.t === 0.8 && next !== s);
  check("a missing or bad t falls back to the start",
    C.clampT(undefined) === 0.3 && C.clampT(NaN) === 0.3);
  check("t is clamped just inside A and B",
    C.clampT(-5) === C.MIN_GAP / C.SIDE &&
    C.clampT(9) === 1 - C.MIN_GAP / C.SIDE &&
    near(C.geometry(C.setT(s, -5)).a, C.MIN_GAP));
  const p = C.position(s);
  check("the saved position is JSON-safe and has the drawn points and areas",
    JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))) &&
    p.t === 0.3 && p.C.x > p.A.x && p.C.x < p.B.x &&
    near(p.EF, p.CD, 1e-5) && near(p.arbelosArea, p.circleArea, 1e-5));
}

/* ------------------------ 3. 1001 positions against the applet's bytecode */

{
  const r = appletRect(C.WIDTH, C.HEIGHT, C.MARGIN);
  let base = true, up = true, cross = true, mids = true;
  for (let i = 0; i <= 1000; i++) {
    const t = C.MIN_GAP / C.SIDE + (i / 1000) * (1 - (2 * C.MIN_GAP) / C.SIDE);
    const g = C.geometry(C.setT({}, t));
    const p = appletPoint(r, t);
    const D = appletD(r, p);
    base = base && near(g.A.x, r.x) && near(g.B.x, r.x + r.width) &&
      near(g.C.x, p.x) && near(g.C.y, p.y);
    up = up && near(g.D.x, D.x) && near(g.D.y, D.y, 1e-6);
    const E = appletCross(r, p, D, 0);
    const F = appletCross(r, p, D, 1);
    cross = cross && near(g.E.x, E.x, 1e-6) && near(g.E.y, E.y, 1e-6) &&
      near(g.F.x, F.x, 1e-6) && near(g.F.y, F.y, 1e-6);
    mids = mids && near(g.Oa.x, appletMid(g.A, g.C).x) &&
      near(g.Ob.x, appletMid(g.B, g.C).x) &&
      near(g.O.x, appletMid(g.C, g.D).x);
  }
  check("A, B and the draggable C match the applet's init()", base);
  check("D matches the applet's square-root formula in Draw()", up);
  check("E and F match FindCrossPoint's second circle/line intersections", cross);
  check("O, Oa and Ob are the applet's three Midpoints", mids);
}

/* ---------------------------------- 4. the page's exact claims, everywhere */

{
  let rectangle = true, parallelogram = true, diagonals = true;
  let tangent = true, rightAngles = true, angleChain = true;
  let radii = true, centre = true, areas = true, mean = true;
  for (let i = 0; i <= 1000; i++) {
    const g = C.geometry(C.setT({}, i / 1000));
    const { A, B, C: p, D, E, F, O, Oa, Ob, a, b } = g;
    // Claim 1: CEDF is a rectangle - a parallelogram with one right corner.
    const CE = sub(E, p), ED = sub(D, E), DF = sub(F, D), FC = sub(p, F);
    parallelogram = parallelogram &&
      near(CE.x, -DF.x) && near(CE.y, -DF.y) &&
      near(ED.x, -FC.x) && near(ED.y, -FC.y);
    rectangle = rectangle && near(dot(CE, ED), 0, 1e-6) &&
      near(len(CE) * len(ED), g.rectangleArea, 1e-6);
    diagonals = diagonals && near(g.EF, g.CD, 1e-6);
    // Claim 2: EF touches the small circles at E and F.
    const EF = sub(F, E);
    tangent = tangent &&
      near(dot(sub(E, Oa), EF), 0, 1e-6) &&
      near(dot(sub(F, Ob), EF), 0, 1e-6) &&
      near(appletDist(Oa, E), g.r1) && near(appletDist(Ob, F), g.r2);
    // The proof's three inscribed right angles and the two tangent angles.
    rightAngles = rightAngles &&
      near(angleAt(E, A, p), PI / 2) &&
      near(angleAt(D, A, B), PI / 2) &&
      near(angleAt(F, p, B), PI / 2) &&
      near(angleAt(E, Oa, F), PI / 2) &&
      near(angleAt(F, Ob, E), PI / 2);
    const aEOa = angleAt(E, A, Oa);
    angleChain = angleChain &&
      near(aEOa, angleAt(A, E, Oa)) &&
      near(angleAt(A, p, D), angleAt(p, D, E), 1e-6) &&
      near(angleAt(E, p, F), angleAt(p, D, E), 1e-6) &&
      near(angleAt(E, p, F), aEOa, 1e-6);
    // Isosceles triangles AOaE and BObF, and the remark's OE = OC.
    radii = radii && near(appletDist(Oa, A), appletDist(Oa, E)) &&
      near(appletDist(Ob, B), appletDist(Ob, F));
    centre = centre && near(appletDist(O, E), appletDist(O, p)) &&
      near(appletDist(O, F), appletDist(O, p));
    // CD^2 = AC*CB and the arbelos / circle-on-CD area equality.
    mean = mean && near(g.CD * g.CD, a * b) && near(g.CD, Math.sqrt(a * b));
    areas = areas && near(g.arbelosArea, g.circleArea) &&
      near(g.arbelosArea, PI * a * b / 4) &&
      near(g.rectangleArea, (a * b * g.CD) / g.L, 1e-6);
  }
  check("CEDF is a parallelogram at all 1001 positions", parallelogram);
  check("CEDF has a right corner, so it is a rectangle (claim 1)", rectangle);
  check("the diagonals CD and EF are equal", diagonals);
  check("EF is tangent to both small semicircles (claim 2)", tangent);
  check("AEC, ADB, CFB, OaEF and ObFE are right angles", rightAngles);
  check("the proof's angle chain AEOa = EAOa = DCE = CEF holds", angleChain);
  check("the triangles AOaE and BObF are isosceles", radii);
  check("the rectangle's centre O satisfies OE = OC = OF", centre);
  check("CD^2 = AC*CB at every position", mean);
  check("arbelos area = circle on CD = pi*AC*CB/4 (1001 positions)", areas);
}

/* ---------------------------------- 5. symmetry, extremes, random positions */

{
  const mid = C.geometry(C.setT({}, 0.5));
  check("with C in the middle D is the top of the big semicircle",
    near(mid.CD, mid.R) && near(mid.D.y, C.RECT.y));
  let symmetric = true, largest = true;
  for (let i = 0; i <= 200; i++) {
    const t = i / 1000;
    const g = C.geometry(C.setT({}, t));
    const m = C.geometry(C.setT({}, 1 - t));
    symmetric = symmetric && near(g.CD, m.CD) && near(g.rectangleArea, m.rectangleArea, 1e-6) &&
      near(g.arbelosArea, m.arbelosArea) &&
      near(g.E.x + m.F.x, g.A.x + g.B.x, 1e-6) &&
      near(g.F.x + m.E.x, g.A.x + g.B.x, 1e-6) &&
      near(g.EF, m.EF);
    largest = largest && g.CD <= mid.CD + 1e-9 &&
      g.arbelosArea <= mid.arbelosArea + 1e-9;
  }
  check("mirroring C about the midpoint mirrors the whole construction", symmetric);
  check("CD and the arbelos area are largest when C is in the middle", largest);
  check("at the middle the rectangle is a square standing on CD",
    near(mid.CE, mid.ED) && near(mid.EF, mid.CD));
}

{
  const random = rng(2362);
  const r = appletRect(C.WIDTH, C.HEIGHT, C.MARGIN);
  let ok = true, matches = true;
  for (let i = 0; i < 2000; i++) {
    const t = C.MIN_GAP / C.SIDE + random() * (1 - (2 * C.MIN_GAP) / C.SIDE);
    const g = C.geometry(C.setT({}, t));
    const p = appletPoint(r, t);
    const D = appletD(r, p);
    const E = appletCross(r, p, D, 0);
    const F = appletCross(r, p, D, 1);
    ok = ok &&
      near(g.a + g.b, C.SIDE) &&
      near(g.CD * g.CD, g.a * g.b) &&
      near(g.EF, g.CD) &&
      near(dot(sub(E, p), sub(D, E)), 0, 1e-6) &&
      near(dot(sub(E, g.Oa), sub(F, E)), 0, 1e-6) &&
      near(dot(sub(F, g.Ob), sub(F, E)), 0, 1e-6) &&
      near(g.arbelosArea, g.circleArea) &&
      near(C.fractionAtX(g.C.x), g.t, 1e-9);
    matches = matches &&
      near(g.E.x, E.x, 1e-6) && near(g.E.y, E.y, 1e-6) &&
      near(g.F.x, F.x, 1e-6) && near(g.F.y, F.y, 1e-6);
  }
  check("2000 random drags keep every page claim true", ok);
  check("2000 random drags match the applet's FindCrossPoint", matches);
  const edges = [C.geometry(C.setT({}, 0)), C.geometry(C.setT({}, 1))];
  check("the ends clamp just inside A and B, never onto them",
    edges.every((g) => g.CD > 0 && g.a >= C.MIN_GAP - 1e-9 &&
      g.b >= C.MIN_GAP - 1e-9 && g.a < C.SIDE - 1e-9) &&
    near(edges[0].CD, edges[1].CD));
}

/* ------------------------------- 6. the eligible drag region, from bytecode */

{
  const r = appletRect(C.WIDTH, C.HEIGHT, C.MARGIN);
  let accepted = true;
  for (let i = 0; i <= 500; i++) {
    const p = appletPoint(r, (C.MIN_GAP + 1) / C.SIDE +
      (i / 500) * (1 - (2 * (C.MIN_GAP + 1)) / C.SIDE));
    accepted = accepted && appletEligible(r, Math.round(p.x), Math.round(p.y) - 5);
  }
  check("every interior drop just above AB is eligible in the applet", accepted);
  check("PointIsEligible refuses A, B and releases on the diameter",
    !appletEligible(r, r.x + 5, C.BASE_Y - 5) &&
    !appletEligible(r, r.x + r.width - 5, C.BASE_Y - 5) &&
    !appletEligible(r, r.x + 100, C.BASE_Y) &&
    !appletEligible(r, r.x + 100, r.y));
}

done("arbelos-rect");
