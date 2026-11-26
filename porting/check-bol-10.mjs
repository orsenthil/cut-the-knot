#!/usr/bin/env node
"use strict";

/*
 * Logic test for bol-10/bol-10-core.js.
 *
 *   node porting/check-bol-10.mjs
 *
 * Checked: the start position against BOL10Canvas.init; dragging O, Bo, T and C;
 * and every claim of the Book of Lemmas Proposition 10 page (BH = HD, plus the
 * equalities in its proof) over 360 configurations, including tangency, near-
 * tangent C, short and long secants, and T close to the circle. The last group
 * is a second, literal transcription of the applet's own Draw method and the
 * GeoSDoub routines it calls (axis-split line/circle and circle/circle
 * intersections, GetParallelTo, Other and NearestPoint); each derived point is
 * compared with the core's point over 240 configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bol-10/bol-10-core.js", "Bol10Core");

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, t) => ({ x: a.x * t, y: a.y * t });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dot = (a, b) => a.x * b.x + a.y * b.y;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const len = (a) => Math.hypot(a.x, a.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const sameOrSupp = (a, b, tol) =>
  Number.isFinite(a) && Number.isFinite(b) &&
  (Math.abs(a - b) <= tol || Math.abs(a + b - Math.PI) <= tol);
const angleAt = (v, p, q) => {
  const u = sub(p, v), w = sub(q, v);
  const n = len(u) * len(w);
  return n < 1e-12 ? NaN : Math.acos(Math.max(-1, Math.min(1, dot(u, w) / n)));
};
const stateOf = (O, r, T, theta) => ({
  O: { ...O },
  Bo: add(O, { x: r, y: 0 }),
  T: { ...T },
  C: add(O, mul({ x: Math.cos(theta), y: Math.sin(theta) }, r)),
  radius: r,
});

/* ------------------------------------------------------------ 1. the start */

{
  /* BOL10Canvas.init: O = (w/2 - (w/2)/3, h/2), Bo = O - (w/2)/3,
   * T = (w/2 + (w/2)/3, h/2), C = O - r(cos a, sin a), r = (w/2)/3. */
  const s = C.start({ width: 400, height: 300, angle: 0.75 * Math.PI });
  const r = 400 / 6;
  check("start O matches the applet", closePoint(s.O, { x: 400 / 2 - r, y: 150 }, 1e-9));
  check("start Bo matches the applet", closePoint(s.Bo, { x: 400 / 2 - 2 * r, y: 150 }, 1e-9));
  check("start T matches the applet", closePoint(s.T, { x: 400 / 2 + r, y: 150 }, 1e-9));
  check("start radius is (width/2)/3", close(s.radius, r, 1e-9));
  check("start C is on the circle", close(dist(s.C, s.O), r, 1e-9));
  check("start C is above the centre", s.C.y < s.O.y);
  check("start T is outside the circle", dist(s.T, s.O) > s.radius);
  const s2 = C.start({});
  check("default start is deterministic", closePoint(s2.O, C.start({}).O, 0) && closePoint(s2.T, C.start({}).T, 0));
  check("nothing is won or lost", C.result(s) === null && C.result(s2) === null);
  equal("result is always null", C.result({}), null);
}

/* ------------------------------------------------------------ 2. dragging */

{
  const s = C.start({ angle: 2.2 });
  const movedO = C.withPoint(s, "O", { x: 180, y: 160 });
  check("moving O leaves Bo behind", closePoint(movedO.Bo, s.Bo, 0));
  check("moving O changes the radius to |Bo-O|", close(movedO.radius, dist(movedO.Bo, movedO.O), 1e-9));
  check("moving O keeps C on the circle", close(dist(movedO.C, movedO.O), movedO.radius, 1e-9));
  const movedBo = C.withPoint(s, "Bo", { x: 60, y: 150 });
  check("moving Bo changes the radius", close(movedBo.radius, dist(movedBo.Bo, movedBo.O), 1e-9));
  check("moving Bo keeps C on the circle", close(dist(movedBo.C, movedBo.O), movedBo.radius, 1e-9));
  const movedT = C.withPoint(s, "T", { x: 320, y: 40 });
  check("moving T keeps circle and C", close(movedT.radius, s.radius, 0) && closePoint(movedT.C, s.C, 0));
  const movedC = C.withPoint(s, "C", { x: s.O.x + 30, y: s.O.y - 30 });
  check("moving C projects onto the circle", close(dist(movedC.C, s.O), s.radius, 1e-9));
  check("moving C does not move the other handles",
    closePoint(movedC.O, s.O, 0) && closePoint(movedC.T, s.T, 0) && close(movedC.radius, s.radius, 0));
  check("an unknown handle changes nothing", closePoint(C.withPoint(s, "X", { x: 1, y: 2 }).T, s.T, 0));
  check("the input state is not mutated",
    closePoint(s.O, C.start({ angle: 2.2 }).O, 0) && close(s.radius, 400 / 6, 0));
  const zero = C.withPoint(s, "Bo", { ...s.O });
  check("a zero radius is reported, not drawn", C.construct(zero).valid === false && C.construct(zero).reason === "radius");
}

/* ------------------------------------------------------------ 3. the claim */

const configurations = [];
{
  configurations.push(C.start({ angle: 2.2 }));
  configurations.push(C.start({ angle: 0.4 }));
  configurations.push(C.start({ angle: 4.9 }));
  const rnd = rng(20261126);
  for (let i = 0; i < 357; i++) {
    const O = { x: -120 + rnd() * 240, y: -120 + rnd() * 240 };
    const r = 30 + rnd() * 50;
    const R = r * (1.05 + rnd() * 3.5); // T just outside up to far away
    const phi = rnd() * 2 * Math.PI;
    const T = add(O, mul({ x: Math.cos(phi), y: Math.sin(phi) }, R));
    const theta = rnd() * 2 * Math.PI;
    configurations.push(stateOf(O, r, T, theta));
  }
  // A few exact tangent directions for C, and C diametrically opposite T.
  for (const R of [1.2, 2, 5]) {
    for (const phi of [0, 0.7, 2.4, 4.2]) {
      const O = { x: 0, y: 0 }, r = 60;
      const T = add(O, mul({ x: Math.cos(phi), y: Math.sin(phi) }, r * R));
      for (const theta of [phi, phi + Math.PI / 2, phi + Math.PI]) {
        configurations.push(stateOf(O, r, T, theta));
      }
    }
  }
}

let validCount = 0, skipped = 0;
for (let i = 0; i < configurations.length; i++) {
  const s = configurations[i];
  const m = C.construct(s);
  /* When the secant is nearly tangent, C2 or D is within the applet's
   * one-pixel Other() threshold: the construction is numerically undefined. */
  if (!m.valid || dist(m.C, m.C2) < 2 || dist(m.B, m.D) < 2) { skipped++; continue; }
  validCount++;
  const { A, B, C: P, C2, D, E, F, H, O, radius, T } = m;
  const L = {
    TA: dist(T, A), TB: dist(T, B), ET: dist(E, T), TF: dist(T, F),
    EB: dist(E, B), ED: dist(E, D), BH: dist(B, H), HD: dist(H, D),
  };
  const scale = Math.max(radius, L.TA, L.ET, dist(B, D));
  const tol = 1e-7 * scale;
  const mid = mul(add(B, D), 0.5);
  const tag = `config ${i}`;
  check(`${tag}: EH bisects BD (BH = HD)`, close(L.BH, L.HD, tol), `${L.BH} vs ${L.HD}`);
  check(`${tag}: H is the midpoint of BD`, dist(H, mid) <= tol);
  check(`${tag}: E is as far from B as from D`, close(L.EB, L.ED, tol));
  check(`${tag}: EH is perpendicular to BD`,
    close(dot(sub(H, E), sub(D, B)) / dist(B, D), 0, tol));
  check(`${tag}: BD is parallel to TC`,
    Math.abs(cross(sub(D, B), sub(P, T))) / (dist(D, B) * dist(P, T)) <= 1e-9);
  check(`${tag}: ET*TF = TA^2`, close(L.ET * L.TF, L.TA * L.TA, tol));
  check(`${tag}: the tangents TA and TB are equal`, close(L.TA, L.TB, tol));
  check(`${tag}: A, B, C, C2 and D lie on the circle`,
    [A, B, P, C2, D].every((p) => close(dist(p, O), radius, 1e-6 * Math.max(1, radius))));
  check(`${tag}: angle TAB = ADB = AET (or the supplement)`,
    sameOrSupp(angleAt(A, T, B), angleAt(D, A, B), 1e-7) &&
    sameOrSupp(angleAt(D, A, B), angleAt(E, A, T), 1e-7));
  check(`${tag}: angle TEB = TBF = TAB (or the supplement)`,
    sameOrSupp(angleAt(E, T, B), angleAt(B, T, F), 1e-7) &&
    sameOrSupp(angleAt(E, T, B), angleAt(A, T, B), 1e-7));
  check(`${tag}: angle EDB = EBD`,
    sameOrSupp(angleAt(D, E, B), angleAt(B, E, D), 1e-7));
  const cl = C.claims(s);
  check(`${tag}: the page's claims are reported true`,
    cl.midpoint && cl.equalSides && cl.bdParallel && cl.powerOfPoint &&
    cl.alternateSegment && cl.similarTriangles && cl.baseAngles && cl.cyclic);
}
check("the sweep used at least 300 valid configurations", validCount >= 300, `${validCount} valid, ${skipped} degenerate`);
console.log(`     swept ${validCount} valid configurations (${skipped} degenerate skipped)`);

/* ---------------------------------- 4. a second transcription of the applet */

/* GeoSDoub.Other, from BOL10Canvas.Draw's Other(DoubPoint[], DoubPoint). */
function appletOther(points, p) {
  if (!points || points.length < 2) return points && points[0];
  return dist(points[0], p) > 1 ? points[0] : points[1];
}

/* GeoSDoub.Intersect(DoubPoint,...) — parallel lines give NaN, as in bytecode. */
function appletIntersect(a, b, c, d) {
  const u = sub(b, a), v = sub(d, c);
  const det = u.x * v.y - u.y * v.x;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return add(a, mul(u, cross(sub(c, a), v) / det));
}

/* GeoSDoub.IntersectX(DoubLine, DoubCircle): x = m*y + b. */
function appletIntersectX(p, q, O, r) {
  const m = (p.x - q.x) / (p.y - q.y);
  const b = q.x - m * q.y;
  const k = 1 + m * m;
  const v = b - O.x;
  const t = m * v - O.y;
  const disc = t * t - k * (O.y * O.y + v * v - r * r);
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const y1 = (-t + s) / k, y2 = (-t - s) / k;
  return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
}

/* GeoSDoub.IntersectY(DoubLine, DoubCircle): y = m*x + b. */
function appletIntersectY(p, q, O, r) {
  const m = (p.y - q.y) / (p.x - q.x);
  const b = q.y - m * q.x;
  const k = 1 + m * m;
  const v = b - O.y;
  const t = m * v - O.x;
  const disc = t * t - k * (O.x * O.x + v * v - r * r);
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const x1 = (-t + s) / k, x2 = (-t - s) / k;
  return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
}

function appletLineCircle(p, q, O, r) {
  if (Math.abs(p.y - q.y) > 1) return appletIntersectX(p, q, O, r);
  if (Math.abs(p.x - q.x) > 1) return appletIntersectY(p, q, O, r);
  return [p, q];
}

/* GeoSDoub.IntersectCirclesX/Y — the tangent points come from these. */
function appletCircleX(c1, r1, c2, r2) {
  const m = -(c1.y - c2.y) / (c1.x - c2.x);
  const b = (c1.x ** 2 - c2.x ** 2 + c1.y ** 2 - c2.y ** 2 - r1 ** 2 + r2 ** 2) /
    (2 * (c1.x - c2.x));
  const a = b - c1.x, k = 1 + m * m;
  const t = m * a - c1.y;
  const disc = t * t - k * (c1.y ** 2 + a * a - r1 ** 2);
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const y1 = (-t + s) / k, y2 = (-t - s) / k;
  return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
}
function appletCircleY(c1, r1, c2, r2) {
  const m = -(c1.y - c2.y) / (c1.x - c2.x);
  const b = (c1.x ** 2 - c2.x ** 2 + c1.y ** 2 - c2.y ** 2 - r1 ** 2 + r2 ** 2) /
    (2 * (c1.y - c2.y));
  const a = b - c1.y, k = 1 + m * m;
  const t = m * a - c1.x;
  const disc = t * t - k * (c1.x ** 2 + a * a - r1 ** 2);
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const x1 = (-t + s) / k, x2 = (-t - s) / k;
  return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
}
function appletCircles(c1, r1, c2, r2) {
  if (Math.abs(c1.x - c2.x) > 1) return appletCircleX(c1, r1, c2, r2);
  if (Math.abs(c1.y - c2.y) > 1) return appletCircleY(c1, r1, c2, r2);
  return [{ ...c1 }, { ...c1 }];
}

/* BOL10Canvas.Tangents: circle around T with radius sqrt(d^2 - r^2). */
function appletTangents(O, r, T) {
  const d = dist(O, T);
  if (d <= r) return null;
  return appletCircles(O, r, T, Math.sqrt(d * d - r * r));
}

/* GeoSDoub.NearestPoint(E, B, D). */
function appletNearest(p, x, y) {
  const dx = y.x - x.x, dy = y.y - x.y;
  if ((x.x - p.x) ** 2 + (x.y - p.y) ** 2 < 0.1) return { ...p };
  const t = (dx * (p.x - x.x) + dy * (p.y - x.y)) / (dx * dx + dy * dy);
  return { x: x.x + dx * t, y: x.y + dy * t };
}

/* BOL10Canvas.Draw, in the order the bytecode computes the points. */
function appletDraw(s) {
  const O = s.O, r = s.radius, T = s.T, Cc = s.C;
  const C2 = appletOther(appletLineCircle(T, Cc, O, r), Cc);
  const tangents = appletTangents(O, r, T);
  if (!tangents) return null;
  const A = tangents[1], B = tangents[0];
  /* GeoSDoub.GetParallelTo(B, C, T) = B + 100*(C - T). */
  const parallel = { x: B.x + 100 * (Cc.x - T.x), y: B.y + 100 * (Cc.y - T.y) };
  const D = appletOther(appletLineCircle(B, parallel, O, r), B);
  const E = appletIntersect(A, D, Cc, T);
  const F = appletIntersect(A, B, Cc, T);
  const H = appletNearest(E, B, D);
  return { C2, A, B, D, E, F, H };
}

let compared = 0;
for (let i = 0; i < configurations.length; i++) {
  const s = configurations[i];
  const ours = C.construct(s);
  if (!ours.valid) continue;
  /* Near-tangent secants put C2 or D inside the applet's 1px Other()
   * threshold, where it knowingly returns the wrong intersection. */
  if (dist(ours.C, ours.C2) < 2 || dist(ours.B, ours.D) < 2) continue;
  /* Near the axis switch the two Java routines choose different branches;
   * keep the comparison to configurations away from that boundary. */
  if (Math.abs(Math.abs(s.O.x - s.T.x) - 1) < 1e-3) continue;
  const theirs = appletDraw(s);
  if (!theirs) continue;
  compared++;
  const scale = Math.max(s.radius, dist(s.T, ours.A), dist(ours.B, ours.D));
  const tol = 1e-5 * scale;
  const tag = `applet config ${i}`;
  for (const name of ["A", "B", "C2", "D", "E", "F", "H"]) {
    check(`${tag}: ${name} matches the bytecode`, closePoint(ours[name], theirs[name], tol));
  }
}
check("the bytecode comparison covered at least 200 configurations", compared >= 200, `${compared}`);
console.log(`     compared ${compared} configurations against the applet's own method`);

/* The applet stops drawing when T is not outside the circle. */
{
  const s = C.start({});
  const inside = C.withPoint(s, "T", { ...s.O });
  const d = C.construct(inside);
  check("T at the centre has no tangents", d.valid === false && d.reason === "tangent");
  const onCircle = C.withPoint(s, "T", C.pointOnCircle(s.O, s.radius, 0.3));
  check("T on the circle has no tangents", C.construct(onCircle).valid === false);
  check("a non-position is not mutated", C.result(null) === null);
}

done("bol-10");
