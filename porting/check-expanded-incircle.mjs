#!/usr/bin/env node
"use strict";

/*
 * Logic test for expanded-incircle/expanded-incircle-core.js.
 *
 *   node porting/check-expanded-incircle.mjs
 *
 * 1. The applet's own state: init() puts A=(W/5,H/5), B=(3W/5,4H/5),
 *    C=(4W/5,H/5) and P at coefP=0.7 along B->C; dragging B or C carries P
 *    with the side line, dragging P rewrites coefP.
 * 2. The page's claims, over hundreds of triangles and six positions of P:
 *    the construction closes (CP = CR'), the six points are concyclic about
 *    I, FQ = ER = DP' = FQ' = ER' = DP, D/E/F are the midpoints of the three
 *    equal segments, and Conway's extension gives DP = s + x.
 * 3. Every point is compared with a second, independent transcription of the
 *    applet's Compute() and of the GeoSDoub methods it calls, taken from
 *    `javap -c -p` on ExpandedIncircleCanvas and CTKGeometry.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("expanded-incircle/expanded-incircle-core.js", "ExpandedIncircleCore");

/* ------------------------------------------------------------ 1. the state */

{
  const s = C.start({});
  const g = C.geometry(s);
  check("init() uses the applet's three corners",
    s.A.x === 80 && s.A.y === 60 && s.B.x === 240 && s.B.y === 240 &&
    s.C.x === 320 && s.C.y === 60);
  check("init() starts P at coefP = 0.7 on B->C", s.coefP === 0.7 &&
    Math.abs(g.P.x - 264) < 1e-12 && Math.abs(g.P.y - 186) < 1e-12);
  check("the drawing is valid at the start", g.valid);
  check("the applet's default checkboxes are reproduced",
    JSON.stringify(s.options) === JSON.stringify({
      names: false, rotations: false, circle: false, incircle: true, gergonne: false,
    }));
  check("an illustration has no win or loss", C.result(s) === null);

  const moved = C.moveVertex(s, "A", { x: 9000, y: -20 });
  check("a corner is clamped to the board",
    moved.A.x === C.VIEW.width - 10 && moved.A.y === 10);
  check("moving a corner leaves the old state alone",
    s.A.x === 80 && s.touches === 0 && moved.touches === 1);
  check("unknown corners and bad points are ignored",
    C.moveVertex(s, "Z", { x: 1, y: 1 }) === s &&
    C.moveVertex(s, "B", { x: NaN, y: 3 }) === s &&
    C.moveP(s, { x: Infinity, y: 1 }) === s);

  // Apply the applet's UpgradePoints() after a drag of B or C.
  const dragged = C.moveVertex(s, "B", { x: 180, y: 260 });
  const gd = C.geometry(dragged);
  check("dragging B carries P along the side line",
    Math.abs((gd.P.x - (0.7 * dragged.B.x + 0.3 * dragged.C.x))) < 1e-12 &&
    Math.abs((gd.P.y - (0.7 * dragged.B.y + 0.3 * dragged.C.y))) < 1e-12);

  const afterP = C.moveP(s, C.geometry(s).P);
  check("dragging P onto its own spot keeps coefP", Math.abs(afterP.coefP - 0.7) < 1e-12);
  const beyond = C.moveP(s, C.conwayPoint(s, "B", 30));
  check("dragging P past B gives coefP > 1", beyond.coefP > 1, `coefP ${beyond.coefP}`);
  check("each option can be switched independently",
    C.setOption(s, "circle", true).options.circle === true &&
    C.setOption(s, "circle", true).A === s.A &&
    C.setOption(s, "missing", true) === s);
  check("a flat triangle cannot be drawn",
    !C.geometry({ ...s, A: { x: 0, y: 0 }, B: { x: 1, y: 0 }, C: { x: 2, y: 0 } }).valid);
}

/* ----------------------------- 2. a second transcription of the applet --- */

/*
 * Literal transcription of ExpandedIncircleCanvas.Compute()/Rotate() and the
 * GeoSDoub methods from javap -c -p of classes/ExpandedIncircle.zip and
 * classes/CTKGeometry.zip. Deliberately does not use the core's helpers.
 */
function aSq(p, q) { return (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y); }
function aDist(p, q) { return Math.sqrt(aSq(p, q)); }
function aAngle(p, q, r) {
  const v = (aSq(p, q) + aSq(p, r) - aSq(q, r)) / (2 * aDist(p, q) * aDist(p, r));
  return Math.acos(v);
}
function aOrientation(p, q, r) {
  const v = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return v > 0 ? 1 : -1;
}
function aRotate(center, point, angle, dir) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  return {
    x: center.x + ca * (point.x - center.x) - dir * sa * (point.y - center.y),
    y: center.y + dir * sa * (point.x - center.x) + ca * (point.y - center.y),
  };
}
function aSignedAngle(p, q, r) {
  let value = aAngle(p, q, r);
  if (value > 0.99) {
    const dx = q.x - p.x, dy = q.y - p.y;
    if (dx * dx + dy * dy < 0) value = Math.PI;
  }
  return aOrientation(p, q, r) === 1 ? value : -value;
}
function aIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}
function aIncenter(A, B, Cc) {
  const dir = aOrientation(A, B, Cc);
  return aIntersect(
    aRotate(A, B, aAngle(A, B, Cc) / 2, dir), A,
    aRotate(B, Cc, aAngle(B, Cc, A) / 2, dir), B);
}
function aNearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (aSq(a, p) < 0.1) return p;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
function aCircumcenter(p, q, r) {
  const m1 = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const m2 = { x: (q.x + r.x) / 2, y: (q.y + r.y) / 2 };
  return aIntersect(m1, { x: m1.x + q.y - p.y, y: m1.y - (q.x - p.x) },
    m2, { x: m2.x + r.y - q.y, y: m2.y - (r.x - q.x) });
}
function aGetCircle(p, q, r) {
  const center = aCircumcenter(p, q, r);
  return {
    center,
    radius: (aDist(center, p) + aDist(center, q) + aDist(center, r)) / 3,
  };
}
function appletCompute(A, B, Cc, coefP) {
  const I = aIncenter(A, B, Cc);
  const D = aNearestPoint(I, B, Cc);
  const E = aNearestPoint(I, Cc, A);
  const F = aNearestPoint(I, A, B);
  const Incircle = aGetCircle(D, E, F);
  const P = { x: coefP * B.x + (1 - coefP) * Cc.x, y: coefP * B.y + (1 - coefP) * Cc.y };
  const Circle = { center: I, radius: aDist(I, P) };
  const Q = aRotate(B, P, aSignedAngle(B, Cc, A), 1);
  const R = aRotate(A, Q, aSignedAngle(A, B, Cc), 1);
  const Pp = aRotate(Cc, R, aSignedAngle(Cc, A, B), 1);
  const Qp = aRotate(B, Pp, aSignedAngle(B, Cc, A), 1);
  const Rp = aRotate(A, Qp, aSignedAngle(A, B, Cc), 1);
  return { I, D, E, F, P, Q, R, Pp, Qp, Rp, Incircle, Circle };
}
function pointError(p, q) {
  if (!p || !q || !Number.isFinite(p.x) || !Number.isFinite(q.x)) return Infinity;
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y));
}

const fixedTriangles = [
  [[80, 60], [240, 240], [320, 60]],       // the applet's own start
  [[180, 40], [60, 220], [300, 220]],      // near equilateral
  [[40, 40], [320, 40], [40, 220]],        // right angle at A
  [[60, 220], [300, 220], [180, 50]],      // isosceles at C
  [[30, 130], [330, 130], [165, 137]],     // very flat
  [[40, 30], [320, 70], [200, 230]],       // scalene, obtuse
  [[180, 30], [175, 230], [330, 120]],     // one near-vertical side
];
const positions = [-1.5, 0, 0.15, 0.7, 1, 2.6];
const rand = rng(4742);
const cases = [];
for (const [aa, bb, cc] of fixedTriangles) {
  for (const t of positions) {
    cases.push({ A: { x: aa[0], y: aa[1] }, B: { x: bb[0], y: bb[1] },
      C: { x: cc[0], y: cc[1] }, coefP: t });
  }
}
for (let i = 0; i < 700; i++) {
  const tri = [
    { x: 10 + rand() * 380, y: 10 + rand() * 280 },
    { x: 10 + rand() * 380, y: 10 + rand() * 280 },
    { x: 10 + rand() * 380, y: 10 + rand() * 280 },
  ];
  const area = Math.abs((tri[1].x - tri[0].x) * (tri[2].y - tri[0].y) -
    (tri[1].y - tri[0].y) * (tri[2].x - tri[0].x));
  if (area < 4000) continue;
  cases.push({ A: tri[0], B: tri[1], C: tri[2], coefP: rand() * 3 - 1 });
}
check("the sample spans hundreds of non-flat configurations", cases.length >= 300,
  `${cases.length} configurations`);

{
  const names = ["I", "D", "E", "F", "P", "Q", "R", "Pp", "Qp", "Rp"];
  const worst = Object.fromEntries(names.concat(["incircleCenter", "incircleRadius",
    "circleCenter", "circleRadius"]).map((n) => [n, 0]));
  let valid = 0;
  for (const state of cases) {
    const core = C.geometry(state);
    const applet = appletCompute(state.A, state.B, state.C, state.coefP);
    if (!core.valid) continue;
    valid++;
    for (const name of names) worst[name] = Math.max(worst[name], pointError(core[name], applet[name]));
    worst.incircleCenter = Math.max(worst.incircleCenter, pointError(core.incircle.center, applet.Incircle.center));
    worst.incircleRadius = Math.max(worst.incircleRadius, Math.abs(core.incircle.radius - applet.Incircle.radius));
    worst.circleCenter = Math.max(worst.circleCenter, pointError(core.circle.center, applet.Circle.center));
    worst.circleRadius = Math.max(worst.circleRadius, Math.abs(core.circle.radius - applet.Circle.radius));
  }
  check("every configuration was compared", valid === cases.length);
  for (const name of names) {
    check(`the applet's ${name} matches the core in every configuration`,
      worst[name] < 1e-6, `largest error ${worst[name]}`);
  }
  check("the applet's incircle centre and radius match", worst.incircleCenter < 1e-6 &&
    worst.incircleRadius < 1e-6, `${worst.incircleCenter}, ${worst.incircleRadius}`);
  check("the applet's six-point circle matches", worst.circleCenter < 1e-6 &&
    worst.circleRadius < 1e-6, `${worst.circleCenter}, ${worst.circleRadius}`);
}

/* ------------------------------------------ 3. every claim on the page --- */

{
  const geometries = cases.map((s) => C.geometry(s)).filter((g) => g.valid);
  const max = (fn) => geometries.reduce((m, g) => Math.max(m, fn(g)), 0);
  const maxAt = (fn) => geometries.reduce((m, g, i) => Math.max(m, fn(g, i)), 0);
  const minAt = (fn) => geometries.reduce((m, g, i) => Math.min(m, fn(g, i)), Infinity);

  // Eves: "the six points lie on the same circle" and it is centred at I.
  const spread = max(C.radiusSpread);
  check("all six points are the same distance from I", spread < 1e-6,
    `largest spread ${spread}`);
  check("the circle drawn by the applet has the same radius",
    max((g) => Math.abs(g.circle.radius - C.radii(g)[0])) < 1e-6);

  // Eves: "the construction closes, i.e. CP = CR'".
  const closing = max((g) => Math.abs(C.closingError(g)));
  check("CP = CR' in every configuration", closing < 1e-6, `largest error ${closing}`);

  // Page equation (1): FQ = ER = DP' = FQ' = ER' = DP.
  const tangents = max(C.tangentSpread);
  check("FQ = ER = DP' = FQ' = ER' = DP", tangents < 1e-6, `largest spread ${tangents}`);

  // "D, E, F serve as the midpoints of equal segments PP', RR', QQ'."
  const mids = geometries.map(C.midpointErrors);
  const midErr = Math.max(...mids.map((e) => Math.max(...e)));
  check("D, E, F are the midpoints of PP', RR', QQ'", midErr < 1e-6,
    `largest error ${midErr}`);

  const chords = geometries.map(C.chordLengths);
  const chordErr = Math.max(...chords.map((l) => Math.max(...l) - Math.min(...l)));
  check("PP' = QQ' = RR'", chordErr < 1e-6, `largest spread ${chordErr}`);
  const twice = max((g) => Math.max(...C.chordLengths(g).map((v, i) =>
    v - 2 * C.tangentLengths(g)[i])));
  check("each chord is twice the corresponding distance from its touch point",
    Math.abs(twice) < 1e-6, `largest error ${twice}`);

  // The touch points are the feet of I; the classic tangent-length formulas.
  const footErr = max((g) => Math.max(
    C.dot({ x: g.D.x - g.I.x, y: g.D.y - g.I.y }, { x: g.B.x - g.C.x, y: g.B.y - g.C.y }),
    C.dot({ x: g.E.x - g.I.x, y: g.E.y - g.I.y }, { x: g.C.x - g.A.x, y: g.C.y - g.A.y }),
    C.dot({ x: g.F.x - g.I.x, y: g.F.y - g.I.y }, { x: g.A.x - g.B.x, y: g.A.y - g.B.y }),
  ));
  check("D, E, F are the perpendicular feet from I", footErr < 1e-6,
    `largest dot product ${footErr}`);
  const tangentFormula = max((g) => {
    const a = C.dist(g.B, g.C), b = C.dist(g.C, g.A), c = C.dist(g.A, g.B);
    return Math.max(
      Math.abs(C.dist(g.B, g.D) - (a - b + c) / 2),
      Math.abs(C.dist(g.C, g.D) - (a + b - c) / 2),
      Math.abs(C.dist(g.A, g.E) - (-a + b + c) / 2),
      Math.abs(C.dist(g.A, g.F) - (-a + b + c) / 2),
    );
  });
  check("page: BD=(a-b+c)/2, CD=(a+b-c)/2, AE=AF=(-a+b+c)/2",
    tangentFormula < 1e-6, `largest error ${tangentFormula}`);

  // "If DP = 0 to start with, then after three rotations DP' = 0."
  const fixed = C.start({});
  const gf = C.geometry(fixed);
  const tD = C.dot({ x: gf.D.x - fixed.C.x, y: gf.D.y - fixed.C.y },
    { x: fixed.B.x - fixed.C.x, y: fixed.B.y - fixed.C.y }) / C.sqDist(fixed.B, fixed.C);
  const atTouch = C.geometry(C.moveP(fixed, gf.D));
  check("starting at D gives DP = 0 and DP' = 0",
    C.dist(atTouch.D, atTouch.P) < 1e-6 && C.dist(atTouch.D, atTouch.Pp) < 1e-6);

  // Conway: extend B by b+x along BC. Then DP = s+x and PP' = 2(s+x).
  const conwayErr = maxAt((g, i) => {
    const state = cases[i];
    const x = -20 + (i % 9) * 12;
    const beyondB = C.conwayPoint(state, "B", x);
    const moved = C.geometry(C.moveP(state, beyondB));
    const a = C.dist(state.B, state.C), b = C.dist(state.C, state.A), c = C.dist(state.A, state.B);
    const s = (a + b + c) / 2;
    return Math.max(
      Math.abs(C.dist(moved.D, moved.P) - (s + x)),
      Math.abs(C.chordLengths(moved)[0] - 2 * (s + x)),
    );
  });
  check("Conway's extension gives DP = s+x and PP' = 2(s+x)", conwayErr < 1e-6,
    `largest error ${conwayErr}`);
  const pageFormula = minAt((g, i) => {
    const x = -20 + (i % 9) * 12;
    const moved = C.geometry(C.moveP(cases[i], C.conwayPoint(cases[i], "B", x)));
    const a = C.dist(moved.B, moved.C), b = C.dist(moved.C, moved.A), c = C.dist(moved.A, moved.B);
    return Math.abs(C.chordLengths(moved)[0] - ((a + b + c) / 2 + x));
  });
  check("page's constant-width paragraph understates the chord by a factor of two",
    pageFormula > 1, `smallest discrepancy ${pageFormula}`);

  // "Concentric circles are also obtained if all the extensions are
  // modified by a fixed amount, say, x."
  const concentric = maxAt((g, i) => {
    const x = -20 + (i % 9) * 12;
    const pts = C.conwaySix(cases[i], x);
    const rs = pts.map((p) => C.dist(g.I, p));
    return Math.max(...rs) - Math.min(...rs);
  });
  check("Conway's three extensions give the same concentric circle", concentric < 1e-6,
    `largest spread ${concentric}`);
}

done("expanded-incircle");
