#!/usr/bin/env node
"use strict";

/*
 * Logic test for in-and-circumcenter-c/in-and-circumcenter-c-core.js.
 *
 *   node porting/check-in-and-circumcenter-c.mjs
 *
 * 1. The demo's rules: the opening triangle from the Java init, the handles,
 *    the five checkboxes, Reset, and the fact that nothing is ever won.
 * 2. A second, literal transcription of InAndCircumcenterCCanvas.Compute and
 *    the GeoSDoub methods it calls, compared point by point with the core on
 *    every well-defined triangle in a seeded spread plus the opening one.
 * 3. The page's claims: DE ⟂ IO for every angle C, DE = 2·IO·sin(C), so
 *    DE = IO exactly at 30°, K/L/M collinear and parallel to DE, the two
 *    ratios CK/CL = CD/CE, the excentral triangle's Euler relation and the
 *    radical-axis power equalities. The page writes the three Menelaus ratios
 *    as b/c, c/a, a/b; the test measures their reciprocals and records that.
 * 4. The applet's two degenerate guards and the 1-pixel parallel test.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("in-and-circumcenter-c/in-and-circumcenter-c-core.js", "InAndCircumcenterCCore");

const pt = C.point, sub = C.sub, add = C.add, mul = C.mul;
const dot = C.dot, cross = C.cross, dist = C.dist, sq = C.sqdist;
const near = (a, b, scale = 1) => Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= 1e-7 * Math.max(1, scale, Math.abs(a), Math.abs(b));
const same = (p, q) => {
  if (!p || !q) return false;
  if (!Number.isFinite(p.x) && !Number.isFinite(q.x) && !Number.isFinite(p.y) && !Number.isFinite(q.y)) return true;
  return near(p.x, q.x) && near(p.y, q.y);
};
const collinearDot = (u, v) => Math.abs(dot(u, v)) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
const parallelCross = (u, v) => Math.abs(cross(u, v)) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
const angleAt = (v, p, q) => {
  const u = sub(p, v), w = sub(q, v);
  return Math.acos(Math.max(-1, Math.min(1, dot(u, w) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y)))));
};
const power = (p, centre, radius) => sq(p, centre) - radius * radius;

/* ------------------------------------------ 1. the demo's own rules and moves */

{
  const s = C.start();
  check("the opening A is the applet's GetVertex(0)", near(s.A.x, 200) && near(s.A.y, 400 / 2 - 20 + 400 / 12));
  check("the opening B is A + (W/10, -H/8)", near(s.B.x, s.A.x + 40) && near(s.B.y, s.A.y - 50));
  check("the opening C is A - (W/12, H/15)", near(s.C.x, s.A.x - 400 / 12) && near(s.C.y, s.A.y - 400 / 15));
  check("the opening triangle is not the 30° special case", Math.abs(C.angleC(s) - 30) > 1);
  check("a fresh picture is neither won nor explored", C.result(s) === null && s.moves === 0 && !s.explored);
  const types = new Set(C.legalMoves().map((m) => m.type));
  const pointNames = new Set(C.legalMoves().filter((m) => m.type === "point").map((m) => m.name));
  check("legal moves cover every handle, overlay and Reset",
    ["A", "B", "C"].every((t) => pointNames.has(t)) &&
    [...C.OPTIONS, "reset", "point"].every((t) => types.has(t)));
  check("all overlays start unchecked", C.OPTIONS.every((name) => s[name] === false));

  const dragged = C.move(s, { type: "point", name: "C", x: 180, y: 120 });
  check("a drag moves the handle and marks the picture explored",
    same(dragged.C, pt(180, 120)) && dragged.moves === 1 && dragged.explored && C.result(dragged) === "done");
  check("the original position is untouched", same(s.C, pt(s.C.x, s.C.y)) && s.moves === 0 && !s.explored);
  const shown = C.move(dragged, { type: "centerLine", value: true });
  check("the centre-line switch toggles independently", shown.centerLine && !shown.circleA && shown.explored);
  check("a switch counts as exploring even without a drag",
    C.result(C.move(s, { type: "names", value: true })) === "done");
  const reset = C.move(shown, { type: "reset" });
  check("Reset rebuilds the opening picture exactly", JSON.stringify(reset) === JSON.stringify(C.start()));
  check("every handle is clamped to the board",
    ["A", "B", "C"].every((name) => {
      const p = C.limit(s, name, pt(-500, 900));
      return p.x === C.MARGIN && p.y === C.HEIGHT - C.MARGIN;
    }));
  check("bad moves are refused",
    C.move(null, { type: "reset" }) === null &&
    C.move(s, null) === null &&
    C.move(s, { type: "nonsense" }) === null &&
    C.move(s, { type: "point", name: "X", x: 1, y: 1 }) === null &&
    C.move(s, { type: "point", name: "A", x: NaN, y: 3 }) === null &&
    C.move(s, { type: "names", value: "yes" }) === null &&
    C.move(s, { type: "centerLine", value: 1 }) === null);
  check("the status names both lengths and the 30° condition",
    /DE is .* and IO is /.test(C.status(s)) && /only when angle C is 30/.test(C.status(s)));
  check("no position ever wins or loses",
    C.result(dragged) !== "win" && C.result(dragged) !== "lose" && C.result(shown) !== "lose");
}

/* ------------------- 2. a literal second transcription of the Java bytecode */

// GeoSDoub.SqDist, Dist, ComputeAngle, FindOrientation, Rotate.
function apSq(p, q) { return (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y); }
function apDist(p, q) { return Math.sqrt(apSq(p, q)); }
function apAngle(p0, p1, p2) {
  const num = apSq(p0, p1) + apSq(p0, p2) - apSq(p1, p2);
  const den = 2 * Math.sqrt(apSq(p0, p1)) * Math.sqrt(apSq(p0, p2));
  return Math.acos(Math.max(-1, Math.min(1, num / den)));
}
function apOrient(p0, p1, p2) {
  const s = p2.x * (p0.y - p1.y) + p2.y * (p1.x - p0.x) + p0.x * p1.y - p1.x * p0.y;
  return s > 0 ? 1 : -1;
}
function apRotate(p, q, angle, orientation) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return pt(
    p.x + co * (q.x - p.x) - orientation * si * (q.y - p.y),
    p.y + orientation * si * (q.x - p.x) + co * (q.y - p.y),
  );
}

// GeoSDoub.Intersect(p1,p2,p3,p4): ax+by+c = 0 lines, NaN when |det| < 1.
function apIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return pt(NaN, NaN);
  return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

// GeoSDoub.FindIncenter / FindExcenter: rotate two rays and intersect them.
function apIncenter(a, b, c) {
  const halfA = apAngle(a, b, c) / 2, halfB = apAngle(b, c, a) / 2;
  const o = apOrient(a, b, c);
  return apIntersect(a, apRotate(a, b, halfA, o), b, apRotate(b, c, halfB, o));
}
function apExcenter(a, b, c) {
  const halfB = (Math.PI - apAngle(b, a, c)) / 2, halfC = (Math.PI - apAngle(c, a, b)) / 2;
  const o = apOrient(b, a, c);
  return apIntersect(b, apRotate(b, c, halfB, o), c, apRotate(c, b, halfC, -o));
}

// GeoSDoub.FindCircumcenter and the applet's GetCircumcircle mean radius.
function apCircle(a, b, c) {
  const m1 = pt((a.x + b.x) / 2, (a.y + b.y) / 2);
  const m2 = pt((b.x + c.x) / 2, (b.y + c.y) / 2);
  const p = pt(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
  const q = pt(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
  const centre = apIntersect(m1, p, m2, q);
  return { centre, radius: (apDist(centre, a) + apDist(centre, b) + apDist(centre, c)) / 3 };
}

// GeoSDoub.FindAngleBisector, GetPerp (turn +90°), GetExBisector.
function apBisector(a, b, c) {
  const half = apAngle(a, b, c) / 2, o = apOrient(a, b, c);
  return apIntersect(a, apRotate(a, b, half, o), b, c);
}
function apExBisector(a, b, c) {
  const foot = apBisector(a, b, c);
  const perp = pt(a.x - (foot.y - a.y), a.y + (foot.x - a.x));
  return { a, b: perp };
}

// GeoSDoub.NearestPoint and the applet's PlacePoint.
function apNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (apSq(a, p) < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return pt(a.x + t * dx, a.y + t * dy);
}
function apPlace(p1, p2, p3) {
  const len = apDist(p1, p2), factor = len / apDist(p1, p3);
  return pt(p1.x + (p3.x - p1.x) * factor, p1.y + (p3.y - p1.y) * factor);
}

// InAndCircumcenterCCanvas.Compute, in the bytecode's order and with its guards.
function apCompute(A, B, C0) {
  if (apDist(A, B) < 2 || apDist(B, C0) < 2 || apDist(C0, A) < 2) return null;
  const I = apIncenter(A, B, C0);
  const Ia = apExcenter(A, B, C0), Ib = apExcenter(B, C0, A), Ic = apExcenter(C0, A, B);
  const abc = apCircle(A, B, C0), ex = apCircle(Ia, Ib, Ic);
  if (apDist(abc.centre, ex.centre) < 2) return null;
  const incircle = {
    centre: I,
    radius: (
      apDist(I, apNearest(I, A, B)) + apDist(I, apNearest(I, B, C0)) + apDist(I, apNearest(I, C0, A))
    ) / 3,
  };
  const sa = apExBisector(A, B, C0), sb = apExBisector(B, C0, A), sc = apExBisector(C0, A, B);
  return {
    I, O: abc.centre, Op: ex.centre, Ia, Ib, Ic,
    R: abc.radius, R2: ex.radius, r: incircle.radius,
    D: apPlace(B, A, C0), E: apPlace(A, B, C0),
    K: apIntersect(sa.a, sa.b, B, C0),
    L: apIntersect(sb.a, sb.b, C0, A),
    M: apIntersect(sc.a, sc.b, A, B),
    circleA: apCircle(B, C0, Ib).centre,
    circleB: apCircle(C0, A, Ic).centre,
    circleC: apCircle(A, B, Ia).centre,
  };
}

const POINTS = ["I", "O", "Op", "Ia", "Ib", "Ic", "D", "E", "K", "L", "M", "circleA", "circleB", "circleC"];
const RADII = ["R", "R2", "r"];
const corePoint = (g, name) => (name.startsWith("circle") ? g[name].centre : g[name]);
const coreRadius = (g, name) => (name === "R" ? g.circumcircle.radius
  : name === "R2" ? g.exCircle.radius : g.incircle.radius);

/* --------------------------------- 3. triangles to check: the whole spread */

const rand = rng(20261127);
const triangles = [C.start()];
for (let i = 0; i < 900; i++) {
  triangles.push({
    A: pt(20 + 360 * rand(), 20 + 360 * rand()),
    B: pt(20 + 360 * rand(), 20 + 360 * rand()),
    C: pt(20 + 360 * rand(), 20 + 360 * rand()),
  });
}
// The page's special angle, with arbitrary side lengths and rotation.
let thirty = 0;
for (let i = 0; i < 300; i++) {
  const ca = 40 + 220 * rand(), cb = 40 + 220 * rand(), phi = 2 * Math.PI * rand();
  const apex = pt(200, 200);
  triangles.push({
    A: add(apex, pt(ca * Math.cos(phi), ca * Math.sin(phi))),
    B: add(apex, pt(cb * Math.cos(phi + Math.PI / 6), cb * Math.sin(phi + Math.PI / 6))),
    C: apex,
  });
  thirty++;
}
const wellDefined = (A, B, C0) => {
  const a = dist(B, C0), b = dist(C0, A), c = dist(A, B);
  if (a < 20 || b < 20 || c < 20) return false;
  if (Math.abs(b + c - a) < 5 || Math.abs(c + a - b) < 5 || Math.abs(a + b - c) < 5) return false;
  const g = C.construct({ A, B, C: C0 });
  return g && [g.K, g.L, g.M, g.Op].every(C.finite);
};
const usable = triangles.filter((t) => wellDefined(t.A, t.B, t.C));
check("the seeded spread supplies well-defined triangles", usable.length > 800 && thirty > 200);

/* --------------------------- 4. the core against the applet's own methods */

for (const name of POINTS) {
  let count = 0, ok = true;
  for (const t of usable) {
    const g = C.construct(t), ap = apCompute(t.A, t.B, t.C);
    if (!g || !ap) continue;
    count++;
    if (!same(corePoint(g, name), ap[name])) ok = false;
  }
  check(`the applet's ${name} matches in ${count} triangles`, ok && count > 800);
}
for (const name of RADII) {
  let count = 0, ok = true;
  for (const t of usable) {
    const g = C.construct(t), ap = apCompute(t.A, t.B, t.C);
    if (!g || !ap) continue;
    count++;
    if (!near(coreRadius(g, name), ap[name])) ok = false;
  }
  check(`the applet's ${name} radius matches in ${count} triangles`, ok && count > 800);
}
{
  const eq = { A: pt(100, 100), B: pt(200, 100), C: pt(150, 100 + 50 * Math.sqrt(3)) };
  check("an equilateral triangle is refused by both the core and the applet",
    C.construct(eq) === null && apCompute(eq.A, eq.B, eq.C) === null);
  const thin = { A: pt(100, 100), B: pt(102, 100), C: pt(101, 101) };
  check("a triangle with a side under 2 pixels is refused by both",
    C.construct(thin) === null && apCompute(thin.A, thin.B, thin.C) === null);
}

/* ------------------------------------ 5. every claim from the applet's page */

const summary = {
  n: 0, thirty: 0, right: true, formula: true, equalThirty: true,
  collinear: true, deParallel: true, product: true, pageRatiosDiffer: 0,
  ck: true, cl: true, ratio: true, excentral: true, orthocenter: true,
  radical: true, cyclic: true, ratioCount: 0,
};
for (const t of usable) {
  const g = C.construct(t), ap = apCompute(t.A, t.B, t.C);
  if (!g || !ap) continue;
  summary.n++;
  const de = dist(g.D, g.E), io = dist(g.I, g.O);
  const sinC = Math.sin(angleAt(g.C, g.A, g.B));
  summary.right = summary.right && collinearDot(sub(g.E, g.D), sub(g.O, g.I)) < 1e-7;
  summary.formula = summary.formula && Math.abs(de - 2 * io * sinC) <= 1e-6 * Math.max(de, 1);
  if (Math.abs(C.angleC(t) - 30) < 1e-8) {
    summary.thirty++;
    summary.equalThirty = summary.equalThirty && Math.abs(de - io) <= 1e-6 * Math.max(de, 1);
  }

  summary.collinear = summary.collinear && parallelCross(sub(g.L, g.K), sub(g.M, g.K)) < 1e-7;
  summary.deParallel = summary.deParallel && parallelCross(sub(g.E, g.D), sub(g.L, g.K)) < 1e-7;

  // The page writes KB/KC = b/c, LC/LA = c/a, MA/MB = a/b. External
  // bisectors give the reciprocals; the product is 1 either way.
  const kbkc = dist(g.K, g.B) / dist(g.K, g.C);
  const lcla = dist(g.L, g.C) / dist(g.L, g.A);
  const mamb = dist(g.M, g.A) / dist(g.M, g.B);
  summary.ratioCount++;
  summary.product = summary.product && Math.abs(kbkc * lcla * mamb - 1) < 1e-6 &&
    Math.abs((g.b / g.c) * (g.c / g.a) * (g.a / g.b) - 1) < 1e-6;
  if (!near(kbkc, g.b / g.c)) summary.pageRatiosDiffer++;
  summary.ck = summary.ck && near(dist(g.C, g.K), Math.abs(g.a * g.b / (g.c - g.b)));
  summary.cl = summary.cl && near(dist(g.C, g.L), Math.abs(g.a * g.b / (g.c - g.a)));
  const pageRatio = (g.c - g.a) / (g.c - g.b);
  summary.ratio = summary.ratio && near(dist(g.C, g.D) / dist(g.C, g.E), Math.abs(pageRatio)) &&
    near(dist(g.C, g.K) / dist(g.C, g.L), Math.abs(pageRatio));

  // O' is the reflection of I in O, and O is the nine-point centre of the
  // excentral triangle; its circumradius is twice the original circumradius.
  summary.excentral = summary.excentral && same(g.Op, sub(mul(g.O, 2), g.I)) &&
    same(g.O, mul(add(g.I, g.Op), 0.5)) && near(g.exCircle.radius, 2 * g.circumcircle.radius);
  summary.orthocenter = summary.orthocenter &&
    collinearDot(sub(g.I, g.Ia), sub(g.Ib, g.Ic)) < 1e-7 &&
    collinearDot(sub(g.I, g.Ib), sub(g.Ic, g.Ia)) < 1e-7;

  // K lies on the radical axis of (O), (O') and the circle B C Ib; L on the
  // corresponding axis through C A Ic; M on the one through A B Ia.
  const radii = {
    a: (dist(g.circleA.centre, g.B) + dist(g.circleA.centre, g.C) + dist(g.circleA.centre, g.Ib)) / 3,
    b: (dist(g.circleB.centre, g.C) + dist(g.circleB.centre, g.A) + dist(g.circleB.centre, g.Ic)) / 3,
    c: (dist(g.circleC.centre, g.A) + dist(g.circleC.centre, g.B) + dist(g.circleC.centre, g.Ia)) / 3,
  };
  const eqPower = (p, circle, radius) => {
    const p1 = power(p, g.O, g.circumcircle.radius), p2 = power(p, g.Op, g.exCircle.radius);
    const p3 = power(p, circle, radius);
    const tol = 1e-5 * Math.max(1, Math.abs(p1), Math.abs(p2), Math.abs(p3));
    return Math.abs(p1 - p2) < tol && Math.abs(p1 - p3) < tol;
  };
  summary.radical = summary.radical && eqPower(g.K, g.circleA.centre, radii.a) &&
    eqPower(g.L, g.circleB.centre, radii.b) && eqPower(g.M, g.circleC.centre, radii.c);
  summary.cyclic = summary.cyclic && near(dist(g.circleA.centre, g.B), radii.a) &&
    near(dist(g.circleA.centre, g.Ib), radii.a) && near(dist(g.circleB.centre, g.C), radii.b) &&
    near(dist(g.circleB.centre, g.Ic), radii.b) && near(dist(g.circleC.centre, g.A), radii.c) &&
    near(dist(g.circleC.centre, g.Ia), radii.c);
}
check("all page claims were exercised on hundreds of triangles", summary.n > 800);
check("DE is perpendicular to IO for every angle C", summary.right);
check("DE = 2·IO·sin(C) for every triangle", summary.formula);
check(`DE = IO at angle C = 30° (${summary.thirty} cases)`, summary.thirty > 200 && summary.equalThirty);
check("K, L and M are collinear (Menelaus)", summary.collinear);
check("DE is parallel to the line KL", summary.deParallel);
check("the Menelaus ratio product is 1", summary.product);
check("the page's three individual ratios are the reciprocals of the measured ones",
  summary.pageRatiosDiffer > summary.ratioCount * 0.9);
check("CK = |ab/(c-b)|", summary.ck);
check("CL = |ab/(c-a)|", summary.cl);
check("CK/CL = (c-a)/(c-b) = CD/CE", summary.ratio);
check("O' is the reflection of I in O, O is the nine-point centre, R' = 2R", summary.excentral);
check("I is the orthocenter of the excentral triangle", summary.orthocenter);
check("K, L, M lie on the radical axes of the pairs of circles", summary.radical);
check("B C Ib, C A Ic and A B Ia are cyclic", summary.cyclic);

done("in-and-circumcenter-c");
