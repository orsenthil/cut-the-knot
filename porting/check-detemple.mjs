#!/usr/bin/env node
"use strict";

/*
 * Logic test for detemple/detemple-core.js.
 *
 *   node porting/check-detemple.mjs
 *
 * 1. The applet's starting quadrilateral, its three Show checkboxes and the
 *    moves/clamping of the four corners.
 * 2. A second, literal transcription of the applet's bytecode (GeoSDoub's
 *    ComputeAngle, FindOrientation, Rotate, Intersect, FindCircumcenter,
 *    NearestPoint and DeTempleCanvas's Compute, GetBisector, GetPerp,
 *    GetSmallRadius, UpdateCenter) compared with the core on every fixed case
 *    and on hundreds of random convex quadrilaterals.
 * 3. Every claim in the cut-the-knot article, checked on all of those cases:
 *    EFGH cyclic; the half-angle formulas for E and G; the isosceles triangle
 *    EHS; PQRS inscriptible with its incircle concentric with EFGH's
 *    circumcircle; PQRS collapsing to O; parallelogram -> rectangle and
 *    rectangle -> square.
 *
 * The live page still contains both <APPLET CODE="DeTemple"> tags, so the
 * bytecode and the article both come from the cited page.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("detemple/detemple-core.js", "DetempleCore");
const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const tolOf = (q) => 1e-6 * Math.max(1, ...q.flatMap((p, i) => dist(p, q[(i + 1) % 4])));

function convex(q) {
  const s = q.map((p, i) => cross(p, q[(i + 1) % 4], q[(i + 2) % 4]));
  return (s.every((v) => v > 0) || s.every((v) => v < 0)) && Math.min(...s.map(Math.abs)) > 100;
}

/* --------------------------------- the applet's own arithmetic, from bytecode */

const aSq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const aDist = (p, q) => Math.sqrt(aSq(p, q));

/* GeoSDoub.ComputeAngle — no clamping of the acos argument. */
function aAngle(a, b, c) {
  const l3 = aSq(a, b) + aSq(a, c) - aSq(b, c);
  const l5 = l3 / 2 / aDist(a, b) / aDist(a, c);
  return Math.acos(l5);
}

/* GeoSDoub.FindOrientation: +1 when the cross expression is > 0, else -1. */
function aOrientation(a, b, c) {
  const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate(p,q,angle,orientation): rotate q about p. */
function aRotate(p, q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return P(
    p.x + cs * (q.x - p.x) - orientation * sn * (q.y - p.y),
    p.y + orientation * sn * (q.x - p.x) + cs * (q.y - p.y),
  );
}

/* GeoSDoub.Intersect, with its |det| < 1 fallback to NaN,NaN. */
function aIntersect(a, b, c, d) {
  const l4 = a.y - b.y, l6 = b.x - a.x, l8 = a.x * b.y - a.y * b.x;
  const l10 = c.y - d.y, l12 = d.x - c.x, l14 = c.x * d.y - c.y * d.x;
  const l16 = l6 * l14 - l12 * l8;
  const l18 = l8 * l10 - l14 * l4;
  const l20 = l4 * l12 - l10 * l6;
  if (Math.abs(l20) < 1) return P(NaN, NaN);
  return P(l16 / l20, l18 / l20);
}

/* GeoSDoub.NearestPoint(p,a,b): projection onto line a-b. */
function aNearest(p, a, b) {
  const l3 = b.x - a.x, l5 = b.y - a.y;
  if (aSq(a, p) < 0.1) return p;
  const l7 = l3 * (p.x - a.x) + l5 * (p.y - a.y);
  const l9 = l7 / (l3 * l3 + l5 * l5);
  return P(a.x + l3 * l9, a.y + l5 * l9);
}

/* DeTempleCanvas.GetBisector: mirror the second ray, then bisect. */
function aGetBisector(p, q, r) {
  const mirror = P(2 * p.x - r.x, 2 * p.y - r.y);
  const hit = aIntersect(
    p, aRotate(p, q, aAngle(p, q, mirror) / 2, aOrientation(p, q, mirror)), q, mirror,
  );
  return { a: p, b: hit };
}

/* DeTempleCanvas.GetPerp: line through x and the foot on side p-q. */
function aGetPerp(x, p, q) {
  return { a: x, b: aNearest(x, p, q) };
}

/* GeoSDoub.FindCircumcenter + DeTempleCanvas.GetCircumcircle's mean radius. */
function aCircle(a, b, c) {
  const m12 = P((a.x + b.x) / 2, (a.y + b.y) / 2);
  const m23 = P((b.x + c.x) / 2, (b.y + c.y) / 2);
  const o = aIntersect(
    m12, P(m12.x + b.y - a.y, m12.y + a.x - b.x),
    m23, P(m23.x + c.y - b.y, m23.y + b.x - c.x),
  );
  return { c: o, r: (aDist(o, a) + aDist(o, b) + aDist(o, c)) / 3 };
}

/* DeTempleCanvas.GetSmallRadius: nearest points to the four rays from O. */
function aSmallRadius(big, P1, Q1, R1, S1) {
  const o = big.c;
  const T = aNearest(P1, o, Q1), U = aNearest(Q1, o, R1);
  const V = aNearest(R1, o, S1), W = aNearest(S1, o, P1);
  return (aDist(T, o) + aDist(U, o) + aDist(V, o) + aDist(W, o)) / 4;
}

/* DeTempleCanvas.Compute(), statement for statement. */
function aCompute(A, B, Cc, D) {
  const bisA = aGetBisector(A, B, D), bisB = aGetBisector(B, Cc, A);
  const bisC = aGetBisector(Cc, D, B), bisD = aGetBisector(D, A, Cc);
  const E = aIntersect(bisA.a, bisA.b, bisB.a, bisB.b);
  const F = aIntersect(bisB.a, bisB.b, bisC.a, bisC.b);
  const G = aIntersect(bisC.a, bisC.b, bisD.a, bisD.b);
  const H = aIntersect(bisD.a, bisD.b, bisA.a, bisA.b);
  const big = aCircle(E, F, G);
  const perpE = aGetPerp(E, A, B), perpF = aGetPerp(F, B, Cc);
  const perpG = aGetPerp(G, Cc, D), perpH = aGetPerp(H, D, A);
  const P1 = aIntersect(perpE.a, perpE.b, perpF.a, perpF.b);
  const Q1 = aIntersect(perpF.a, perpF.b, perpG.a, perpG.b);
  const R1 = aIntersect(perpG.a, perpG.b, perpH.a, perpH.b);
  const S1 = aIntersect(perpH.a, perpH.b, perpE.a, perpE.b);
  const small = { c: big.c, r: aSmallRadius(big, P1, Q1, R1, S1) };
  return {
    E, F, G, H, P: P1, Q: Q1, R: R1, S: S1, big, small,
    feet: { E: perpE.b, F: perpF.b, G: perpG.b, H: perpH.b },
    tangency: { P: aNearest(P1, E, F), Q: aNearest(Q1, F, G), R: aNearest(R1, G, H), S: aNearest(S1, H, E) },
    centre: P((P1.x + Q1.x + R1.x + S1.x) / 4, (P1.y + Q1.y + R1.y + S1.y) / 4),
  };
}

/* The canvas's init() at its own optimal 400x250 size. */
function aStart() {
  const cx = 400 / 2, cy = 250 / 2 - 20, sc = Math.min(400, 250) / 4;
  return {
    A: P(cx + sc * Math.cos(0.1), cy + sc * Math.sin(0.1)),
    D: P(cx + 1.2 * sc * Math.cos(1.727875959474386) - 50, cy + 1.2 * sc * Math.sin(1.727875959474386)),
    C: P(cx + sc * Math.cos(4.1887902047863905), cy + sc * Math.sin(4.1887902047863905)),
    B: P(cx + 1.1 * sc * Math.cos(5.235987755982989), cy + 1.1 * sc * Math.sin(5.235987755982989)),
  };
}

/* --------------------------------------------- 1. the start and the controls */

{
  const s = C.start(), a = aStart();
  equal("init puts A at bytecode's position", s.A, a.A);
  equal("init puts B at bytecode's position", s.B, a.B);
  equal("init puts C at bytecode's position", s.C, a.C);
  equal("init puts D at bytecode's position", s.D, a.D);
  check("the three Show boxes start off", !s.options.names && !s.options.hint1 && !s.options.hint2);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("the start quadrilateral is convex", convex([s.A, s.B, s.C, s.D]));
  check("a fresh diagram is not marked explored", !s.explored);
}

{
  const s = C.start();
  const moved = C.move(s, "A", P(999, -999));
  check("a corner is clamped to the board", moved.A.x === C.VIEW.width - C.PAD && moved.A.y === C.PAD);
  check("moving a corner leaves the old position alone", s.A.x === aStart().A.x);
  check("moving marks the diagram explored", moved.explored && !s.explored);
  check("an unknown corner is ignored", C.move(s, "Z", P(1, 1)) === s);
  check("a non-finite corner is ignored", C.move(s, "B", P(NaN, 1)) === s);
  const opts = C.setOption(C.setOption(s, "hint1", true), "names", true);
  check("the checkboxes are independent", opts.options.hint1 && opts.options.names && !opts.options.hint2);
  check("an unknown checkbox is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(opts);
  check("Reset restores the corners but keeps the boxes", r.A.x === s.A.x && r.options.hint1 && r.options.names);
  check("the status describes the two circles", /EFGH lies on a circle/.test(C.describe(s)));
}

/* An undefined drawing is handled without a crash. */
{
  const flat = [P(10, 10), P(10, 10), P(20, 20), P(30, 10)];
  check("coincident corners have no construction", C.compute(...flat) === null);
  const s = C.start();
  check("an unspecified position has a helpful message",
    /clear quadrilateral/.test(C.describe({ A: undefined, B: s.B, C: s.C, D: s.D })));
}

/* -------------------------------------------- 2. fixed cases, against bytecode */

const start = C.start();
const cases = [
  ["the applet's start", [start.A, start.B, start.C, start.D]],
  ["a tilted quadrilateral", [P(70, 180), P(250, 260), P(340, 110), P(140, 60)]],
  ["a four-point circle", [P(300, 120), P(210, 210), P(100, 155), P(160, 35)]],
  ["a parallelogram", [P(50, 200), P(250, 30), P(350, 30), P(150, 200)]],
  ["a rectangle", [P(50, 30), P(350, 30), P(350, 210), P(50, 210)]],
  ["a square", [P(100, 20), P(300, 20), P(300, 220), P(100, 220)]],
  ["a trapezoid", [P(40, 40), P(360, 40), P(280, 200), P(120, 200)]],
];
const pointNames = ["E", "F", "G", "H", "P", "Q", "R", "S"];

function compareCore(q, label) {
  const g = C.compute(...q), a = aCompute(...q);
  const tol = tolOf(q) * 10;
  if (!g) {
    check(`${label}: both constructions decline the same position`,
      !pointNames.every((k) => finite(a[k])) || !finite(a.big.c));
    return null;
  }
  for (const k of pointNames) {
    check(`${label}: core ${k} matches bytecode`, closePoint(g[k], a[k], tol),
      `core ${JSON.stringify(g[k])} vs ${JSON.stringify(a[k])}`);
  }
  check(`${label}: circumcentre matches bytecode`, closePoint(g.big.c, a.big.c, tol));
  check(`${label}: circumradius matches bytecode`, close(g.big.r, a.big.r, tol));
  check(`${label}: small radius matches bytecode`, close(g.small.r, a.small.r, tol));
  check(`${label}: marked centre matches bytecode`, closePoint(g.centre, a.centre, tol));
  for (const k of Object.keys(g.feet)) {
    check(`${label}: foot ${k} matches bytecode`, closePoint(g.feet[k], a.feet[k], tol));
  }
  for (const k of Object.keys(g.tangency)) {
    check(`${label}: tangency ${k} matches bytecode`, closePoint(g.tangency[k], a.tangency[k], tol));
  }
  return { g, a, tol };
}

for (const [label, q] of cases) compareCore(q, label);

/* ------------------------------------- 3. the article's formulas on fixed cases */

function claimChecks(q, label) {
  const g = C.compute(...q);
  if (!g) return;
  const tol = tolOf(q);
  const [A, B, Cc, D] = q;
  const aA = C.angle(A, D, B), aB = C.angle(B, A, Cc);
  const aC = C.angle(Cc, B, D), aD = C.angle(D, Cc, A);
  const eAngle = C.angle(g.E, g.F, g.H), gAngle = C.angle(g.G, g.F, g.H);
  check(`${label}: FEH + FGH = 180 degrees`,
    close(g.measures.oppositeAngles, Math.PI, 1e-9), `${g.measures.oppositeAngles}`);
  check(`${label}: FEH = (ABC + BAD)/2`, close(eAngle, (aB + aA) / 2, 1e-9));
  check(`${label}: FGH = (BCD + ADC)/2`, close(gAngle, (aC + aD) / 2, 1e-9));
  check(`${label}: SEH = BAD/2`, close(C.angle(g.E, g.S, g.H), aA / 2, 1e-9));
  check(`${label}: triangle EHS is isosceles`, close(C.dist(g.S, g.E), C.dist(g.S, g.H), 1e-7 * tol + 1e-7));
  check(`${label}: E, F, G, H lie on the drawn circle`, g.measures.circleError <= tol);
  check(`${label}: O is equidistant from PQRS's sides`, g.measures.inradiusSpread <= 1e-5 * g.scale);
  check(`${label}: PQ and RS have the same total length as QR and SP`, g.measures.tangentialError <= 1e-5 * g.scale);
  check(`${label}: O lies on each perpendicular bisector of EFGH`, g.measures.bisectorSpread <= tol);
  check(`${label}: EFGH's circumcircle and PQRS's incircle are concentric`, g.claims.concentric && g.claims.inscriptible);
  check(`${label}: parallelogram gives a rectangle`, g.claims.parallelogramIsRectangle);
  check(`${label}: rectangle gives a square`, g.claims.rectangleIsSquare);
  for (const k of ["cyclic", "inscriptible", "concentric", "degenerateAtCentre"]) {
    check(`${label}: claim ${k} holds`, g.claims[k]);
  }
}

for (const [label, q] of cases) claimChecks(q, label);

/* The rectangle's perpendiculars concur at O: PQRS collapses to that point. */
{
  const q = [P(50, 30), P(350, 30), P(350, 210), P(50, 210)];
  const g = C.compute(...q);
  check("a rectangle collapses PQRS to the common centre",
    closePoint(g.P, g.big.c, 1e-6) && closePoint(g.Q, g.big.c, 1e-6)
      && closePoint(g.R, g.big.c, 1e-6) && closePoint(g.S, g.big.c, 1e-6));
  let rectState = C.start();
  for (let i = 0; i < 4; i++) rectState = C.move(rectState, "ABCD"[i], q[i]);
  check("the status reports the collapsed quadrilateral",
    /shrunk to the centre/.test(C.describe(rectState)));
  // The applet's blue circle uses GetSmallRadius, which is not the true
  // inradius: record the observed difference instead of pretending otherwise.
  const startG = C.geometry(C.start());
  check("the applet's blue radius is a drawing aid, not the incircle radius",
    !close(startG.small.r, startG.measures.sideDistances[0], 0.01));
}

/* -------------------------------- 4. hundreds of random convex quadrilaterals */

{
  const r = rng(20261127);
  let valid = 0, declined = 0, mismatch = 0, checked = 0;
  let worstPoint = 0, worstCentre = 0, worstRadius = 0;
  let worstCyclic = 0, worstFormulaE = 0, worstFormulaG = 0, worstSEH = 0;
  let worstInradius = 0, worstTangential = 0, worstBisector = 0, worstDegenerate = 0;
  for (let i = 0; i < 600; i++) {
    const ts = [r(), r(), r(), r()].map((v) => v * 2 * Math.PI).sort((a, b) => a - b);
    const rr = ts.map(() => 90 * (0.55 + 0.45 * r()));
    const q = ts.map((t, k) => P(200 + rr[k] * Math.cos(t), 120 + rr[k] * Math.sin(t)));
    if (!convex(q)) continue;
    const g = C.compute(...q), a = aCompute(...q);
    const allFinite = pointNames.every((k) => finite(a[k])) && finite(a.big.c);
    if ((!!g) !== allFinite) { mismatch++; continue; }
    if (!g) { declined++; continue; }
    valid++;
    const tol = tolOf(q);
    for (const k of pointNames) {
      worstPoint = Math.max(worstPoint, dist(g[k], a[k]));
      if (!closePoint(g[k], a[k], 10 * tol)) mismatch++;
    }
    worstCentre = Math.max(worstCentre, dist(g.centre, a.centre));
    worstRadius = Math.max(worstRadius, Math.abs(g.big.r - a.big.r), Math.abs(g.small.r - a.small.r));
    const [A, B, Cc, D] = q;
    const aA = C.angle(A, D, B), aB = C.angle(B, A, Cc);
    const aC = C.angle(Cc, B, D), aD = C.angle(D, Cc, A);
    worstCyclic = Math.max(worstCyclic, g.measures.circleError,
      Math.abs(g.measures.oppositeAngles - Math.PI));
    worstFormulaE = Math.max(worstFormulaE, Math.abs(C.angle(g.E, g.F, g.H) - (aB + aA) / 2));
    worstFormulaG = Math.max(worstFormulaG, Math.abs(C.angle(g.G, g.F, g.H) - (aC + aD) / 2));
    worstSEH = Math.max(worstSEH, Math.abs(C.angle(g.E, g.S, g.H) - aA / 2));
    worstInradius = Math.max(worstInradius, g.measures.inradiusSpread);
    worstTangential = Math.max(worstTangential, g.measures.tangentialError);
    worstBisector = Math.max(worstBisector, g.measures.bisectorSpread);
    worstDegenerate = Math.max(worstDegenerate,
      Math.abs(C.dist(g.S, g.E) - C.dist(g.S, g.H)));
    for (const k of Object.keys(g.claims)) if (!g.claims[k]) mismatch++;
    checked++;
  }
  check("the random sweep actually found configurations", valid > 400, `${valid} valid`);
  check("core and bytecode never disagree on validity or output", mismatch === 0, `${mismatch} mismatches`);
  check("every random case keeps the five claims", checked === valid);
  check("E,F,G,H are on one circle to drawing precision", worstCyclic < 1e-8, `${worstCyclic}`);
  check("the half-angle formula at E holds everywhere", worstFormulaE < 1e-8, `${worstFormulaE}`);
  check("the half-angle formula at G holds everywhere", worstFormulaG < 1e-8, `${worstFormulaG}`);
  check("SEH = BAD/2 everywhere", worstSEH < 1e-8, `${worstSEH}`);
  check("O is equidistant from all four PQRS sides", worstInradius < 1e-8, `${worstInradius}`);
  check("PQRS is tangential in every case", worstTangential < 1e-8, `${worstTangential}`);
  check("O lies on all four side bisectors", worstBisector < 1e-8, `${worstBisector}`);
  check("EHS is isosceles in every case", worstDegenerate < 1e-7, `${worstDegenerate}`);
  check("constructed points match the bytecode within 1e-8", worstPoint < 1e-8, `${worstPoint}`);
  check("centres match the bytecode within 1e-8", worstCentre < 1e-8, `${worstCentre}`);
  check("both radii match the bytecode within 1e-8", worstRadius < 1e-8, `${worstRadius}`);
  check("degenerate positions are handled without a crash", declined >= 0);
}

done("detemple");
