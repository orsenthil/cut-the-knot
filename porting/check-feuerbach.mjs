#!/usr/bin/env node
"use strict";

/*
 * Logic test for feuerbach/feuerbach-core.js.
 *
 *   node porting/check-feuerbach.mjs
 *
 * 1. The applet's state: init() puts A, B and C at centre + min(W,H)/4 on
 *    angles -1.6, -4.0 and -0.2 in a 400 by 250 board; the four display
 *    options start off; a corner can be dragged and clamped to the board.
 * 2. A second, independent transcription of the applet's own bytecode:
 *    GeoSDoub.FindIncenter/FindExcenter/FindCircumcenter/NearestPoint/Rotate/
 *    Intersect/ComputeAngle and the canvas's GetCircle, DrawNPC,
 *    DrawExcircle and both ShowPoint overloads. Compare every drawn point
 *    and radius over hundreds of triangles, including the start, right,
 *    obtuse, flat and equilateral cases.
 * 3. The page's claim, exhaustively on the sample: the nine-point circle
 *    touches the incircle internally (IN = R/2 - r) and all three excircles
 *    externally (IN_a = R/2 + r_a); every ShowPoint dot lies on both circles
 *    and on their line of centres. At an equilateral triangle the incircle
 *    and the nine-point circle coincide, so there is no single Feuerbach
 *    point: the test says so instead of claiming a false uniqueness.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("feuerbach/feuerbach-core.js", "FeuerbachCore");

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  const cx = 200, cy = 125, k = 62.5;
  const at = (a) => ({ x: cx + k * Math.cos(a), y: cy + k * Math.sin(a) });
  const A = at(-1.6), B = at(-4.0), Cc = at(-0.2);
  check("init() uses the applet's three points and suggested 400x250 board",
    C.VIEW.width === 400 && C.VIEW.height === 250 &&
    s.A.x === A.x && s.A.y === A.y && s.B.x === B.x &&
    s.B.y === B.y && s.C.x === Cc.x && s.C.y === Cc.y);
  check("the applet's four display options start off",
    JSON.stringify(s.options) === JSON.stringify({
      medians: false, altitudes: false, circles: false, names: false,
    }));
  check("an illustration has no win, loss or end", C.result(s) === null);
  check("the starting triangle is drawable", C.geometry(s).valid);

  const moved = C.moveVertex(s, "A", { x: 9000, y: -20 });
  check("a corner dragged off the board is clamped",
    moved.A.x === C.VIEW.width - C.MARGIN && moved.A.y === C.MARGIN);
  check("moving a corner leaves the old state alone",
    s.A.x === A.x && s.touches === 0 && moved.touches === 1);
  check("unknown corners and non-finite points are ignored",
    C.moveVertex(s, "Z", { x: 1, y: 1 }) === s &&
    C.moveVertex(s, "B", { x: NaN, y: 3 }) === s &&
    C.moveVertex(s, "C", { x: Infinity, y: 1 }) === s);
  check("every option toggles on its own",
    C.setOption(s, "circles", true).options.circles === true &&
    C.setOption(s, "circles", true).A === s.A &&
    C.setOption(s, "medians", true).options.altitudes === false &&
    C.setOption(s, "missing", true) === s);

  const flat = C.geometry({ ...s, A: { x: 0, y: 0 }, B: { x: 1, y: 0 }, C: { x: 2, y: 0 } });
  check("a flat triangle cannot be drawn", flat.valid === false);
  const g = C.geometry(s);
  check("the drawing has the applet's three median and nine altitude segments",
    g.medians.length === 3 && g.altitudes.length === 9);
  check("the drawing has exactly four touch dots, not the Incidence lines",
    g.touches.length === 4 && !("lines" in g) && !("triangles" in g));
}

/* ------------------------ 2. the applet's method, a second transcription */

/*
 * Written straight from javap -c -p on classes/Feuerbach.zip and
 * classes/CTKGeometry.zip. It deliberately does not call the core's helpers.
 */
const apSq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const apLen = (p, q) => Math.sqrt(apSq(p, q));
function apAngle(p, q, r) {
  const cosine = (apSq(p, q) + apSq(p, r) - apSq(q, r)) / (2 * apLen(p, q) * apLen(p, r));
  return Math.acos(cosine);
}
function apOrient(p, q, r) {
  const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return v > 0 ? 1 : -1;
}
function apRot(o, p, angle, dir) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return {
    x: o.x + co * (p.x - o.x) - dir * si * (p.y - o.y),
    y: o.y + dir * si * (p.x - o.x) + co * (p.y - o.y),
  };
}
function apCross(u, v, w, z) {
  const a = u.y - v.y, b = v.x - u.x, c = u.x * v.y - u.y * v.x;
  const d = w.y - z.y, e = z.x - w.x, f = w.x * z.y - w.y * z.x;
  const det = a * e - d * b;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b * f - e * c) / det, y: (c * d - f * a) / det };
}
function apIncenter(A, B, C) {
  const dir = apOrient(A, B, C);
  const halfA = apAngle(A, B, C) / 2, halfB = apAngle(B, C, A) / 2;
  return apCross(apRot(A, B, halfA, dir), A, apRot(B, C, halfB, dir), B);
}
function apExcenter(A, B, C) {
  const dir = apOrient(B, A, C);
  const halfB = (Math.PI - apAngle(B, A, C)) / 2;
  const halfC = (Math.PI - apAngle(C, A, B)) / 2;
  return apCross(apRot(B, C, halfB, dir), B, apRot(C, B, halfC, -dir), C);
}
function apNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (apSq(a, p) < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
function apCircumcenter(p, q, r) {
  const m1 = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const m2 = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
  const u1 = { x: m1.x + q.y - p.y, y: m1.y - (q.x - p.x) };
  const u2 = { x: m2.x + r.y - q.y, y: m2.y - (r.x - q.x) };
  return apCross(m1, u1, m2, u2);
}
function apMeanCircle(centre, p, q, r) {
  return { center: centre, radius: (apLen(centre, p) + apLen(centre, q) + apLen(centre, r)) / 3 };
}
function apTouch(other, circle, away) {
  const scale = other.radius / apLen(circle.center, other.center) * (away ? -1 : 1);
  return {
    x: other.center.x + scale * (circle.center.x - other.center.x),
    y: other.center.y + scale * (circle.center.y - other.center.y),
  };
}
function appletDrawing(A, B, C) {
  const I = apIncenter(A, B, C);
  const incircle = apMeanCircle(I, apNearest(I, A, B), apNearest(I, B, C), apNearest(I, C, A));
  const triplets = [[A, B, C], [B, C, A], [C, A, B]];
  const excircles = triplets.map(([p, q, r]) => {
    const J = apExcenter(p, q, r);
    return apMeanCircle(J, apNearest(J, p, q), apNearest(J, q, r), apNearest(J, r, p));
  });
  const mids = [
    { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 },
    { x: (C.x + A.x) / 2, y: (C.y + A.y) / 2 },
    { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 },
  ];
  const nine = apMeanCircle(apCircumcenter(mids[0], mids[1], mids[2]), ...mids);
  return {
    I, incircle, excenters: excircles.map((c) => c.center), excircles,
    N: nine.center, nine, mids,
    touches: [
      apTouch(excircles[0], nine, false),
      apTouch(excircles[1], nine, false),
      apTouch(excircles[2], nine, false),
      apTouch(incircle, nine, true),
    ],
    feet: [apNearest(I, A, B), apNearest(I, B, C), apNearest(I, C, A)],
  };
}
function pointError(p, q) {
  if (!p || !q || !Number.isFinite(p.x) || !Number.isFinite(q.x)) return Infinity;
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
}

const fixed = [
  [[201.8, 62.4], [159.2, 172.5], [261.3, 137.4]],  // the applet's start
  [[200, 62.5], [200 + 62.5 * Math.cos(Math.PI / 6), 156.25],
    [200 + 62.5 * Math.cos(5 * Math.PI / 6), 156.25]], // equilateral
  [[60, 60], [330, 60], [60, 210]],                   // right angle at A
  [[80, 210], [320, 210], [200, 45]],                 // isosceles
  [[30, 130], [370, 130], [200, 135]],                // very flat
  [[45, 45], [350, 200], [110, 220]],                 // obtuse scalene
  [[195, 25], [180, 225], [355, 110]],                // near-vertical side
];
const rand = rng(4822);
const cases = [];
for (const tri of fixed) {
  cases.push({ A: { x: tri[0][0], y: tri[0][1] },
    B: { x: tri[1][0], y: tri[1][1] }, C: { x: tri[2][0], y: tri[2][1] } });
}
for (let i = 0; i < 600; i++) {
  const tri = [
    { x: 12 + rand() * 376, y: 12 + rand() * 226 },
    { x: 12 + rand() * 376, y: 12 + rand() * 226 },
    { x: 12 + rand() * 376, y: 12 + rand() * 226 },
  ];
  const area = Math.abs((tri[1].x - tri[0].x) * (tri[2].y - tri[0].y) -
    (tri[1].y - tri[0].y) * (tri[2].x - tri[0].x));
  if (area < 3000) continue;
  cases.push({ A: tri[0], B: tri[1], C: tri[2] });
}
check("the sample spans hundreds of non-flat configurations", cases.length >= 300,
  `${cases.length} triangles`);

{
  const worst = {
    I: 0, inradius: 0, N: 0, nineRadius: 0, feet: 0, mids: 0, O: 0,
    ex0: 0, ex1: 0, ex2: 0, radius0: 0, radius1: 0, radius2: 0,
    touch0: 0, touch1: 0, touch2: 0, touch3: 0,
  };
  let valid = 0;
  for (const tri of cases) {
    const g = C.geometry(tri);
    const ap = appletDrawing(tri.A, tri.B, tri.C);
    if (!g.valid) continue;
    valid++;
    worst.I = Math.max(worst.I, pointError(g.I, ap.I));
    worst.inradius = Math.max(worst.inradius, Math.abs(g.inradius - ap.incircle.radius));
    worst.N = Math.max(worst.N, pointError(g.N, ap.N));
    worst.nineRadius = Math.max(worst.nineRadius, Math.abs(g.nineRadius - ap.nine.radius));
    worst.feet = Math.max(worst.feet, ...g.feet.map((p, i) => pointError(p, ap.feet[i])));
    worst.mids = Math.max(worst.mids, ...g.midpoints.map((p, i) => pointError(p, ap.mids[i])));
    worst.O = Math.max(worst.O, pointError(g.O, apCircumcenter(tri.A, tri.B, tri.C)));
    [0, 1, 2].forEach((i) => {
      worst[`ex${i}`] = Math.max(worst[`ex${i}`], pointError(g.excenters[i], ap.excenters[i]));
      worst[`radius${i}`] = Math.max(worst[`radius${i}`],
        Math.abs(g.exradii[i] - ap.excircles[i].radius));
      worst[`touch${i}`] = Math.max(worst[`touch${i}`], pointError(g.touches[i], ap.touches[i]));
    });
    worst.touch3 = Math.max(worst.touch3, pointError(g.touches[3], ap.touches[3]));
  }
  check("every sample configuration was compared with the applet", valid === cases.length);
  check("the incenter and inradius match the applet", worst.I < 1e-6 && worst.inradius < 1e-6,
    `${worst.I}, ${worst.inradius}`);
  check("the nine-point centre and radius match DrawNPC", worst.N < 1e-6 && worst.nineRadius < 1e-6,
    `${worst.N}, ${worst.nineRadius}`);
  check("the three incircle feet match NearestPoint", worst.feet < 1e-6, `${worst.feet}`);
  check("the three side midpoints match the applet", worst.mids < 1e-9, `${worst.mids}`);
  check("the circumcentre of ABC matches FindCircumcenter", worst.O < 1e-6, `${worst.O}`);
  for (const i of [0, 1, 2]) {
    check(`excircle ${i + 1} centre matches FindExcenter`, worst[`ex${i}`] < 1e-6,
      `${worst[`ex${i}`]}`);
    check(`excircle ${i + 1} radius matches DrawExcircle`, worst[`radius${i}`] < 1e-6,
      `${worst[`radius${i}`]}`);
    check(`excircle ${i + 1} touch dot matches ShowPoint`, worst[`touch${i}`] < 1e-6,
      `${worst[`touch${i}`]}`);
  }
  check("the incircle Feuerbach dot matches ShowPoint's boolean branch",
    worst.touch3 < 1e-6, `${worst.touch3}`);
}

/* ------------------------------------------ 3. every claim on the page --- */

{
  const geometries = cases.map(C.geometry).filter((g) => g.valid);
  const ordinary = geometries.filter((g) => !C.coincidentIncircle(g));
  const max = (list, fn) => list.reduce((m, g) => Math.max(m, fn(g)), 0);
  const flat = geometries.filter(C.coincidentIncircle);
  check("the sample includes the equilateral coincidence case", flat.length >= 1,
    `${flat.length} coincident triangles`);
  check("the page's incircle tangency IN = R/2 - r holds everywhere",
    max(ordinary, (g) => C.centreGapErrors(g)[0]) < 1e-6,
    `${max(ordinary, (g) => C.centreGapErrors(g)[0])}`);
  [0, 1, 2].forEach((i) => {
    check(`the page's excircle ${i + 1} tangency IN = R/2 + r holds everywhere`,
      max(ordinary, (g) => C.centreGapErrors(g)[i + 1]) < 1e-6,
      `${max(ordinary, (g) => C.centreGapErrors(g)[i + 1])}`);
    check(`the excircle ${i + 1} dot lies on both circles`,
      max(ordinary, (g) => C.touchErrors(g)[i]) < 1e-6,
      `${max(ordinary, (g) => C.touchErrors(g)[i])}`);
    check(`the excircle ${i + 1} dot lies on the line of centres`,
      max(ordinary, (g) => C.touchCollinearity(g)[i]) < 1e-9,
      `${max(ordinary, (g) => C.touchCollinearity(g)[i])}`);
  });
  check("the Feuerbach point lies on both the incircle and the nine-point circle",
    max(ordinary, (g) => C.touchErrors(g)[3]) < 1e-6,
    `${max(ordinary, (g) => C.touchErrors(g)[3])}`);
  check("the Feuerbach point lies on the line of centres",
    max(ordinary, (g) => C.touchCollinearity(g)[3]) < 1e-9,
    `${max(ordinary, (g) => C.touchCollinearity(g)[3])}`);
  check("the Feuerbach point is on the far side of the incenter from N",
    ordinary.every((g) => {
      const d = { x: g.N.x - g.I.x, y: g.N.y - g.I.y };
      const f = { x: g.touches[3].x - g.I.x, y: g.touches[3].y - g.I.y };
      return d.x * f.x + d.y * f.y < 0;
    }));
  check("each excircle dot is between the excenter and N",
    ordinary.every((g) => g.excenters.every((J, i) =>
      C.dist(J, g.touches[i]) < C.dist(J, g.N))));
  check("the nine-point radius is R/2 in every configuration",
    max(geometries, C.nineRadiusError) < 1e-6,
    `${max(geometries, C.nineRadiusError)}`);
  check("Euler's OI^2 = R(R-2r) holds in every configuration",
    max(geometries, (g) => C.eulerError(g) / (g.circumradius ** 2)) < 1e-8,
    `${max(geometries, (g) => C.eulerError(g) / (g.circumradius ** 2))}`);
  check("N is midway between the circumcentre and the orthocenter",
    max(geometries, (g) => C.dist(g.N, C.mid(g.O, g.H)) / g.circumradius) < 1e-9);
  check("at equilateral the two circles coincide, so there is no unique touch point",
    flat.every((g) => C.dist(g.N, g.I) / g.circumradius < 1e-6 &&
      Math.abs(g.nineRadius - g.inradius) / g.circumradius < 1e-6 &&
      Math.abs(C.centreGapErrors(g)[0]) / g.circumradius < 1e-6));
  check("the page's claim is true for every non-coincident triangle tested",
    ordinary.every((g) => C.centreGapErrors(g).every((e) => e < 1e-6) &&
      C.touchErrors(g).every((e) => e < 1e-6)));
  check("draw options do not change the geometry", (() => {
    const base = C.start({});
    const all = C.setOption(C.setOption(C.setOption(C.setOption(base,
      "medians", true), "altitudes", true), "circles", true), "names", true);
    const a = C.geometry(base), b = C.geometry(all);
    return pointError(a.I, b.I) === 0 && pointError(a.touches[3], b.touches[3]) === 0 &&
      a.nineRadius === b.nineRadius;
  })());
}

done("feuerbach");
