#!/usr/bin/env node
"use strict";

/*
 * Logic test for eurica-cyclic/eurica-cyclic-core.js.
 *
 *   node porting/check-eurica-cyclic.mjs
 *
 * The archived cut-the-knot page makes two claims: the circumcircles
 * C(ABQ), C(BCP), C(ADP) and C(CDQ) all pass through one point K (true even
 * for a non-cyclic ABCD, by Miquel's theorem), and that K is collinear with
 * P = AB ∩ CD and Q = BC ∩ AD when ABCD is cyclic.
 *
 * 1. The applet's Reset(), free corner drags, whole-quadrilateral drag, its
 *    two check boxes, and the fact that this is an illustration (no win).
 * 2. A second, literal transcription of the applet's own bytecode
 *    (GeoSDoub.FindCircumcenter / Intersect / IntersectCirclesX and Y,
 *    EuricaCyclicCanvas.GetCircle / Other / Intersect / CreateCircle /
 *    CheckFinished / Compute), compared with the core over every grid
 *    quadrilateral and 800 random ones, with random previous P and Q.
 * 3. The page's claims, over all 4,845 four-corner choices in a 20-angle
 *    grid, 2,000 random cyclic and 2,000 random non-cyclic configurations:
 *    concurrency, collinearity exactly on the circle, and the applet's
 *    one-unit shortcut that sometimes names B instead of the Miquel point.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("eurica-cyclic/eurica-cyclic-core.js", "EuricaCyclicCore");

const P = (x, y) => ({ x, y });
const TAU = 2 * Math.PI;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const circle = (x, y, r) => ({ x, y, r });

/* ---------------------------------------------------------------------------
 * The applet again, straight from javap. Nothing below calls the core.
 * ------------------------------------------------------------------------- */

function apSqDist(p, q) {
  return (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
}
function apIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}
function apFindCircumcenter(a, b, c) {
  const m1 = P((a.x + b.x) / 2, (a.y + b.y) / 2);
  const m2 = P((b.x + c.x) / 2, (b.y + c.y) / 2);
  const n1 = P(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
  const n2 = P(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
  return apIntersect(m1, n1, m2, n2);
}
function apGetCircle(a, b, c) {
  const o = apFindCircumcenter(a, b, c);
  if (![o.x, o.y].every(Number.isFinite)) return circle(NaN, NaN, NaN);
  return circle(o.x, o.y, (apSqDist(o, a) ** 0.5 + apSqDist(o, b) ** 0.5
    + apSqDist(o, c) ** 0.5) / 3);
}
function apCircleIntersections(c0, c1) {
  if (Math.abs(c0.x - c1.x) > 1) {
    const m = (c1.y - c0.y) / (c0.x - c1.x);
    const b = (c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y
      - c0.r * c0.r + c1.r * c1.r) / (2 * (c0.x - c1.x));
    const d = b - c0.x, A = m * m + 1, B = m * d - c0.y;
    const Cc = d * d + c0.y * c0.y - c0.r * c0.r;
    const D = B * B - A * Cc;
    if (D < 0) return null;
    const s = Math.sqrt(D);
    return [P(m * ((-B + s) / A) + b, (-B + s) / A),
      P(m * ((-B - s) / A) + b, (-B - s) / A)];
  }
  if (Math.abs(c0.y - c1.y) > 1) {
    const m = (c1.x - c0.x) / (c0.y - c1.y);
    const b = (c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x
      - c0.r * c0.r + c1.r * c1.r) / (2 * (c0.y - c1.y));
    const d = b - c0.y, A = m * m + 1, B = m * d - c0.x;
    const Cc = d * d + c0.x * c0.x - c0.r * c0.r;
    const D = B * B - A * Cc;
    if (D < 0) return null;
    const s = Math.sqrt(D);
    return [P((-B + s) / A, m * ((-B + s) / A) + b),
      P((-B - s) / A, m * ((-B - s) / A) + b)];
  }
  return [P(c0.x, c0.y), P(c0.x, c0.y)];
}
function apOther(pair, p) {
  return apSqDist(pair[0], p) < 1 ? pair[1] : pair[0];
}
function apKeptIntersect(a, b, c, d, old) {
  const q = apIntersect(a, b, c, d);
  if (q && !Number.isNaN(q.x) && !Number.isNaN(q.y)) return q;
  return old;
}
function apCreateCircle(A, B, Cc, D, selected, old) {
  const v = [];
  if (A !== selected) v.push(A);
  if (B !== selected) v.push(B);
  if (Cc !== selected) v.push(Cc);
  if (D !== selected) v.push(D);
  if (v.length === 3) return apGetCircle(v[0], v[1], v[2]);
  return old;
}
function apPointOnCircle(p, cc) {
  return Math.abs(Math.sqrt(apSqDist(p, cc)) - cc.r) < 1;
}
function apCompute(A, B, Cc, D, circle, oldP, oldQ) {
  const Ppt = apKeptIntersect(A, B, Cc, D, oldP);
  const Q = apKeptIntersect(B, Cc, D, A, oldQ);
  const QKBA = apGetCircle(Q, B, A);
  const BKPC = apGetCircle(B, Ppt, Cc);
  const KCDQ = apGetCircle(Cc, D, Q);
  const AKPD = apGetCircle(A, Ppt, D);
  const pair = apCircleIntersections(QKBA, BKPC);
  const K = pair ? apOther(pair, Ppt) : null;
  const cyclic = apPointOnCircle(A, circle) && apPointOnCircle(B, circle)
    && apPointOnCircle(Cc, circle) && apPointOnCircle(D, circle);
  return { P: Ppt, Q: Q, QKBA: QKBA, BKPC: BKPC, KCDQ: KCDQ, AKPD: AKPD,
    pair: pair, K: K, cyclic: cyclic };
}

/* ------------------------------------------------- 1. start position, rules */

{
  const s = C.start();
  equal("the board is the applet's 600x550 canvas", C.VIEW, { x: 0, y: 0, width: 600, height: 550 });
  equal("the circle centre is (600/3, 550*11/20)", C.CENTER, P(200, 302));
  check("the radius is min(600,550)/5", C.RADIUS === 110);
  equal("A starts at 90 degrees", s.A, C.circlePoint(Math.PI / 2));
  equal("B starts at 45 degrees", s.B, C.circlePoint(Math.PI / 4));
  equal("C starts at -20 degrees", s.C, C.circlePoint(-Math.PI / 9));
  equal("D starts at -135 degrees", s.D, C.circlePoint(-3 * Math.PI / 4));
  check("the starting circle is the applet's grey circle",
    s.circle.x === 200 && s.circle.y === 302 && s.circle.r === 110);
  check("names follows the page's ShowNames=1 parameter; hint is off",
    s.options.names === true && s.options.hint === false);
  check("an untouched illustration has no result", C.result(s) === null);
  const g = C.geometry(s);
  check("the start is cyclic and both page claims hold",
    g.ok && g.claims.cyclic && g.claims.concurrent && g.claims.collinear);
  check("the start description says K and P,Q line up",
    /line up/.test(C.describe(s)) && /on the circle/.test(C.describe(s)));
}

{
  const s = C.start();
  const n = C.move(s, "B", P(90, 30));
  check("a corner drag is free, not stuck to the circle",
    dist(n.B, C.CENTER) !== C.RADIUS && !closePoint(s.B, n.B, 1e-9));
  check("dragging a corner leaves the grey circle alone",
    n.circle.x === s.circle.x && n.circle.y === s.circle.y && n.circle.r === s.circle.r);
  check("a drag explores the illustration", n.explored && C.result(n) === "done");
  check("an unknown corner is ignored", C.move(s, "Z", P(1, 2)) === s);
  check("a non-finite corner is ignored", C.move(s, "A", P(NaN, 2)) === s);
  const t = C.setOption(C.setOption(s, "hint", true), "names", false);
  check("the two check boxes change independently",
    t.options.hint && !t.options.names && !s.options.hint);
  check("an unknown check box is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(t);
  check("Reset restores all four corners and the circle",
    C.CORNERS.every((k) => closePoint(r[k], s[k], 1e-12))
    && r.circle.r === C.RADIUS && r.circle.x === C.CENTER.x);
  check("Reset keeps the check boxes but is still explored",
    r.options.hint && !r.options.names && C.result(r) === "done"
    && C.geometry(r).claims.cyclic);

  const dragged = C.dragShape(s, P(30, -20));
  check("dragging the polygon moves all four corners together",
    C.CORNERS.every((k) => closePoint(dragged[k], C.add(s[k], P(30, -20)), 1e-12)));
  check("dragging the polygon replaces the circle with C(ABC)",
    closePoint(dragged.circle, C.getCircle(dragged.A, dragged.B, dragged.C), 1e-12));
  check("dragging the polygon keeps A,B,C on the new circle",
    [dragged.A, dragged.B, dragged.C].every((p) =>
      close(dist(p, dragged.circle), dragged.circle.r, 1e-8)));
  check("a bad drag delta is ignored", C.dragShape(s, P(NaN, 0)) === s);
  check("construct rejects non-finite corners",
    !C.construct(P(NaN, 0), s.B, s.C, s.D, s.circle).ok);
}

/* --------------------------- 2. core against the applet's own bytecode */

{
  const rnd = rng(20110728);
  let cases = 0, bad = 0, maxP = 0, maxCircle = 0, maxK = 0;
  let quadCases = 0;
  const grid = [];
  const n = 12;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
    for (let k = j + 1; k < n; k++) for (let l = k + 1; l < n; l++) {
      const ts = [i, j, k, l].map((m) => (m * TAU) / n);
      grid.push(ts.map((t) => C.circlePoint(t)));
    }
  for (const pts of grid.concat(Array.from({ length: 800 }, () => {
    const cc = P((rnd() - 0.5) * 600, (rnd() - 0.5) * 550);
    const r = 30 + 200 * rnd();
    return [0, 0, 0, 0].map(() => C.circlePoint(rnd() * TAU, cc, r));
  }))) {
    const cc = grid.indexOf(pts) >= 0
      ? circle(C.CENTER.x, C.CENTER.y, C.RADIUS)
      : circle(pts[0].x, pts[0].y, 100);
    const oldP = P((rnd() - 0.5) * 500, (rnd() - 0.5) * 500);
    const oldQ = P((rnd() - 0.5) * 500, (rnd() - 0.5) * 500);
    const g = C.construct(pts[0], pts[1], pts[2], pts[3], cc, { P: oldP, Q: oldQ });
    const ap = apCompute(pts[0], pts[1], pts[2], pts[3], cc, oldP, oldQ);
    if (!g.ok || !ap.pair || !Number.isFinite(ap.K.x)) continue;
    cases++;
    if (grid.indexOf(pts) >= 0) quadCases++;
    maxP = Math.max(maxP, dist(g.P, ap.P), dist(g.Q, ap.Q));
    for (const key of ["QKBA", "BKPC", "KCDQ", "AKPD"]) {
      maxCircle = Math.max(maxCircle, Math.abs(g.circles[key].x - ap[key].x),
        Math.abs(g.circles[key].y - ap[key].y),
        Math.abs(g.circles[key].r - ap[key].r));
    }
    maxK = Math.max(maxK, dist(g.K, ap.K));
    if (dist(g.P, ap.P) > 1e-6 || dist(g.Q, ap.Q) > 1e-6
      || dist(g.K, ap.K) > 1e-6 || g.cyclic !== ap.cyclic) bad++;
    if (!closePoint(g.pair[0], ap.pair[0], 1e-6)
      || !closePoint(g.pair[1], ap.pair[1], 1e-6)) bad++;
  }
  check("all 495 grid quadrilaterals and 800 random ones were comparable",
    cases >= 1200, `${cases} cases`);
  check("the grid cases were all counted", quadCases === 495, `${quadCases}`);
  check("core Compute matches the bytecode on P, Q, circles, pair and K",
    bad === 0 && maxP < 1e-6 && maxCircle < 1e-6 && maxK < 1e-6,
    `bad ${bad}, P ${maxP.toExponential(2)}, circle ${maxCircle.toExponential(2)}, K ${maxK.toExponential(2)}`);
  check("checkFinished agrees with the applet's one-unit test", (() => {
    const s = C.start(), off = C.move(s, "C", P(10, 10));
    return C.checkFinished(s.A, s.B, s.C, s.D, s.circle)
      === apPointOnCircle(s.A, s.circle)
      && C.checkFinished(off.A, off.B, off.C, off.D, off.circle) === false;
  })());
  check("CreateCircle keeps the old circle unless exactly three distinct points", (() => {
    const s = C.start();
    const same = apCreateCircle(s.A, s.B, s.C, s.D, P(-999, -999), s.circle);
    const three = apCreateCircle(s.A, s.B, s.C, s.D, s.D, s.circle);
    return same === s.circle && closePoint(three, C.getCircle(s.A, s.B, s.C), 1e-9);
  })());
  check("Other follows the applet's one-unit shortcut", (() => {
    const p = P(0, 0), near = P(0.5, 0), far = P(40, 0);
    return closePoint(apOther([near, far], p), far, 0)
      && closePoint(C.other([near, far], p), far, 0)
      && closePoint(C.other([far, near], p), far, 0);
  })());
  check("FindCircumcenter agrees on a simple right triangle", (() => {
    const a = P(0, 0), b = P(10, 0), c = P(0, 20);
    return closePoint(C.findCircumcenter(a, b, c), apFindCircumcenter(a, b, c), 1e-12)
      && closePoint(C.findCircumcenter(a, b, c), P(5, 10), 1e-12);
  })());
  check("the circle-circle X and Y branches agree with the bytecode", (() => {
    const c0 = circle(0, 0, 10), c1x = circle(15, 2, 10), c1y = circle(2, 15, 10);
    return closePoint(C.circleIntersections(c0, c1x)[0],
      apCircleIntersections(c0, c1x)[0], 1e-12)
      && closePoint(C.circleIntersections(c0, c1y)[1],
        apCircleIntersections(c0, c1y)[1], 1e-12);
  })());
  check("the applet's degenerate circle case returns two copies of its centre",
    (() => {
      const c0 = circle(10, 20, 30), c1 = circle(10.2, 20.1, 40);
      const a = C.circleIntersections(c0, c1), b = apCircleIntersections(c0, c1);
      return closePoint(a[0], b[0], 0) && closePoint(a[1], b[1], 0);
    })());
}

/* ------------------------ 3. both page claims over many configurations */

{
  const rnd = rng(9112011);
  const n = 20;
  const angles = Array.from({ length: n }, (_, i) => (i * TAU) / n);
  const cases = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
    for (let k = j + 1; k < n; k++) for (let l = k + 1; l < n; l++) {
      cases.push({ pts: [i, j, k, l].map((m) => C.circlePoint(angles[m])),
        cc: circle(C.CENTER.x, C.CENTER.y, C.RADIUS), cyclic: true });
    }
  for (let i = 0; i < 2000; i++) {
    const o = P((rnd() - 0.5) * 400, (rnd() - 0.5) * 400), r = 30 + 200 * rnd();
    const ts = [0, 0, 0, 0].map(() => rnd() * TAU).sort((a, b) => a - b);
    cases.push({ pts: ts.map((t) => C.circlePoint(t, o, r)),
      cc: circle(o.x, o.y, r), cyclic: true });
  }
  let compared = 0, gridCompared = 0, concFails = 0, collFails = 0, wrongPick = 0;
  let maxConc = 0, maxColl = 0;
  for (const { pts, cc } of cases) {
    const g = C.construct(pts[0], pts[1], pts[2], pts[3], cc);
    if (!g.ok || !g.cyclic) continue;
    compared++;
    if (cc.x === C.CENTER.x && cc.y === C.CENTER.y) gridCompared++;
    if (!g.claims.concurrent) concFails++;
    if (!g.claims.collinear) collFails++;
    if (!g.claims.appletKIsMiquel) wrongPick++;
    maxConc = Math.max(maxConc, g.measures.concurrencyError / g.measures.scale);
    maxColl = Math.max(maxColl, g.measures.collinearError / g.measures.scale);
  }
  // 765 of the 4,845 grid choices have a side pair the applet's |det| < 1
  // guard turns into NaN; those are not drawable and are counted as skipped.
  check("all drawable grid quadrilaterals plus thousands of random cyclic ones compared",
    gridCompared === 4080 && compared >= 6000, `${gridCompared} grid, ${compared} total`);
  check("all four circles pass through one point in every cyclic case",
    concFails === 0 && maxConc < 1e-7, `${concFails} failures, max ${maxConc.toExponential(2)}`);
  check("P, K and Q are collinear in every cyclic case",
    collFails === 0 && maxColl < 1e-7, `${collFails} failures, max ${maxColl.toExponential(2)}`);
  check("the applet's Other shortcut often names B instead of K",
    wrongPick > 1000, `${wrongPick}/${compared} wrong picks`);
  check("the core still exposes the applet's raw pick for display", (() => {
    const s = C.start(), g = C.geometry(s);
    return closePoint(g.K, g.Ktrue, 1e-7) && g.claims.appletKIsMiquel;
  })());
}

{
  const rnd = rng(4477);
  let cases = 0, concFails = 0, guardFails = 0, collHolds = 0;
  for (let i = 0; i < 2000; i++) {
    const pts = [0, 0, 0, 0].map(() => P((rnd() - 0.5) * 600, (rnd() - 0.5) * 550));
    const g = C.construct(pts[0], pts[1], pts[2], pts[3],
      circle(C.CENTER.x, C.CENTER.y, C.RADIUS));
    if (!g.ok || g.cyclic) continue;
    cases++;
    // GeoSDoub.Intersect returns two copies of a centre when the two circle
    // centres are within one unit: the applet has no Miquel point to draw.
    const sameCentre = Math.abs(g.circles.QKBA.x - g.circles.BKPC.x) <= 1
      && Math.abs(g.circles.QKBA.y - g.circles.BKPC.y) <= 1;
    if (sameCentre) guardFails++;
    else if (!g.claims.concurrent) concFails++;
    if (g.claims.collinear) collHolds++;
  }
  check("2,000 non-cyclic quadrilaterals were tried", cases > 1900, `${cases} cases`);
  check("Miquel concurrency holds for non-cyclic quadrilaterals too",
    concFails === 0, `${concFails} failures`);
  check("the applet's one-unit centre guard was hit in a few cases", guardFails > 0,
    `${guardFails} guarded`);
  check("collinearity is not claimed off the circle", collHolds < cases / 10,
    `${collHolds}/${cases} collinear`);
  check("a dragged corner off the circle is reported as non-cyclic", (() => {
    const s = C.start(), off = C.move(s, "D", P(150, 120));
    return !C.geometry(off).claims.cyclic;
  })());
  check("the hint data matches ShowHint's four angles and three lines", (() => {
    const g = C.geometry(C.start());
    return g.angles.length === 4 && g.angles[0][3] === 2 && g.angles[2][3] === 1
      && g.lines.length === 3 && g.sides.length === 4;
  })());
}

done("eurica-cyclic");
