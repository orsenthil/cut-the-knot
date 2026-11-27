#!/usr/bin/env node
"use strict";

/*
 * Logic test for cyclic-quadrilateral/cyclic-quadrilateral-core.js.
 *
 *   node porting/check-cyclic-quadrilateral.mjs
 *
 * The page's exact claim is "The incenters of the four triangles form a
 * rectangle".  It also claims rABC + rACD = rABD + rBCD, that PQ is
 * perpendicular to RS and parallel to the rectangle's sides through their
 * midpoints (P,Q,R,S are the midpoints of arcs AB,CD,BC,AD), and that the
 * four lines through the incenters parallel to the diagonals make a rhombus.
 *
 * 1. The applet's Reset(), corners and check boxes, and what an illustration
 *    can and cannot do.
 * 2. A second, literal transcription of the applet's own bytecode
 *    (GeoSDoub.ComputeAngle / FindOrientation / Rotate / Intersect /
 *    FindIncenter / NearestPoint / GetParallelTo and the canvas's HalveArc,
 *    DrawIncenter and DrawIncenters), compared with the core on every
 *    quadrilateral in a 20-angle grid and on random triangles elsewhere.
 * 3. The page's claims checked exhaustively on all C(20,4)=4845 convex
 *    quadrilaterals in that grid and on 500 random ones, including the
 *    applet's minor-arc limitation when a side subtends more than 180°.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cyclic-quadrilateral/cyclic-quadrilateral-core.js", "CyclicQuadrilateralCore");

const P = (x, y) => ({ x, y });
const TAU = 2 * Math.PI;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const quad = (angles, c, r) => angles.map((t) => C.circlePoint(t, c, r));
const gaps = (angles) => angles.map((t, i) => (angles[(i + 1) % 4] - t + TAU) % TAU);
const norm = (v) => Math.hypot(v.x, v.y);

/* ---------------------------------------------------------------------------
 * The applet again, straight from javap.  Nothing here calls the core.
 * ------------------------------------------------------------------------- */

function apSqDist(p, q) {
  return (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
}
function apAngle(p1, p2, p3) {
  return Math.acos((apSqDist(p1, p2) + apSqDist(p1, p3) - apSqDist(p2, p3))
    / (2 * Math.sqrt(apSqDist(p1, p2)) * Math.sqrt(apSqDist(p1, p3))));
}
function apOrientation(p1, p2, p3) {
  const s = p3.x * (p1.y - p2.y) + p3.y * (p2.x - p1.x)
    + p1.x * p2.y - p2.x * p1.y;
  return s > 0 ? 1 : -1;
}
function apRotate(p1, p2, t, sign) {
  const cs = Math.cos(t), sn = Math.sin(t);
  return P(p1.x + cs * (p2.x - p1.x) - sign * sn * (p2.y - p1.y),
    p1.y + sign * sn * (p2.x - p1.x) + cs * (p2.y - p1.y));
}
function apIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN); // the applet's own fallback
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}
function apFindIncenter(p0, p1, p2) {
  const a0 = apAngle(p0, p1, p2) / 2;  // half the angle at the first corner
  const a1 = apAngle(p1, p0, p2) / 2;  // half the angle at the second
  const sign = apOrientation(p0, p1, p2);
  const r0 = apRotate(p0, p1, a0, sign);
  const r1 = apRotate(p1, p2, a1, sign);
  return apIntersect(p0, r0, p1, r1);
}
function apNearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (apSqDist(a, b) < 0.1) return p;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return P(a.x + dx * t, a.y + dy * t);
}
function apInradius(a, b, c, i) {
  return (dist(i, apNearestPoint(i, b, c)) + dist(i, apNearestPoint(i, a, c))
    + dist(i, apNearestPoint(i, b, a))) / 3;
}
function apHalveArc(o, a, b) {
  return apRotate(o, a, apAngle(o, a, b) / 2, 1);
}
function apGetParallelTo(p, q1, q2) {
  return P(p.x + 100 * (q1.x - q2.x), p.y + 100 * (q1.y - q2.y));
}
/* DrawIncenters: the rectangle order and the four rhombus lines. */
function apConstruction(A, B, Cc, D, o) {
  const IABC = apFindIncenter(A, B, Cc);
  const IACD = apFindIncenter(A, Cc, D);
  const IABD = apFindIncenter(A, B, D);
  const IBCD = apFindIncenter(B, Cc, D);
  return {
    IABC: IABC, IACD: IACD, IABD: IABD, IBCD: IBCD,
    P: apHalveArc(o, A, B), Q: apHalveArc(o, Cc, D),
    R: apHalveArc(o, B, Cc), S: apHalveArc(o, D, A),
    radii: {
      ABC: apInradius(A, B, Cc, IABC), ACD: apInradius(A, Cc, D, IACD),
      ABD: apInradius(A, B, D, IABD), BCD: apInradius(B, Cc, D, IBCD),
    },
    lines: [
      [IBCD, apGetParallelTo(IBCD, B, D)],
      [IACD, apGetParallelTo(IACD, A, Cc)],
      [IABD, apGetParallelTo(IABD, B, D)],
      [IABC, apGetParallelTo(IABC, A, Cc)],
    ],
  };
}

/* ------------------------------------------------- 1. start position, rules */

{
  const s = C.start();
  const a = C.circlePoint(Math.PI / 6), b = C.circlePoint(5 * Math.PI / 6);
  const c = C.circlePoint(6 * Math.PI / 5), d = C.circlePoint(5 * Math.PI / 3);
  equal("Reset puts A at +30 degrees", s.A, a);
  equal("Reset puts B at +150 degrees", s.B, b);
  equal("Reset puts C at +216 degrees", s.C, c);
  equal("Reset puts D at +300 degrees", s.D, d);
  equal("Reset uses the 560x400 canvas", C.VIEW, { x: 0, y: 0, width: 560, height: 400 });
  equal("the circle centre is (280,200)", C.CENTER, P(280, 200));
  check("the radius is min(560,400)/3", close(C.RADIUS, 400 / 3, 1e-12));
  check("all eight check boxes start unchecked",
    C.OPTION_KEYS.every((k) => s.options[k] === false));
  check("an untouched illustration has no result", C.result(s) === null);
  check("the starting four corners are on the circle",
    C.geometry(s).claims.onCircle);
  check("the starting rectangle claim holds", C.geometry(s).claims.rectangle);
  check("status describes the rectangle and the radius sum",
    /rectangle/.test(C.describe(s)) && /rABC \+ rACD/.test(C.describe(s)));
}

{
  const s = C.start();
  const n = C.move(s, "B", P(100, 10));
  check("a drag leaves the old position alone", dist(s.B, n.B) > 1);
  check("a drag marks the diagram explored", n.explored && !s.explored);
  check("a dragged corner stays on the circle", close(dist(n.B, C.CENTER), C.RADIUS, 1e-9));
  check("an unknown corner is ignored", C.move(s, "Z", P(1, 2)) === s);
  check("a non-finite corner is ignored", C.move(s, "A", P(NaN, 2)) === s);
  check("a drag at the centre is still a circle point", (() => {
    const q = C.move(s, "A", C.CENTER);
    return close(dist(q.A, C.CENTER), C.RADIUS, 1e-9);
  })());
  const t = C.setOption(C.setOption(s, "incircles", true), "rhombus", true);
  check("two tick boxes change independently",
    t.options.incircles && t.options.rhombus && !t.options.names);
  check("an unknown tick box is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(t);
  check("Reset restores all four corners", ["A", "B", "C", "D"].every((k) => closePoint(r[k], s[k], 1e-12)));
  check("Reset keeps the tick boxes and the explored flag",
    r.options.incircles && r.options.rhombus && r.explored);
  check("an explored illustration reports done", C.result(n) === "done"
    && C.result(t) === "done");
  check("compute rejects non-finite and repeated corners",
    C.compute(P(NaN, 0), s.B, s.C, s.D) === null
    && C.compute(s.A, s.A, s.C, s.D) === null);
}

/* --------------------------- 2. core against the applet's own bytecode */

{
  const rnd = rng(20261127);
  let worstIncenter = 0, worstRadius = 0, worstArc = 0, worstParallel = 0;
  let mismatches = 0, triangles = 0;
  for (let k = 0; k < 500; k++) {
    const o = P((rnd() - 0.5) * 400, (rnd() - 0.5) * 400);
    const r = 20 + 180 * rnd();
    const A = C.circlePoint(rnd() * TAU, o, r);
    const B = C.circlePoint(rnd() * TAU, o, r);
    const D = C.circlePoint(rnd() * TAU, o, r);
    const Cc = C.circlePoint(rnd() * TAU, o, r);
    const g = C.compute(A, B, Cc, D, { c: o, r: r });
    const ap = apConstruction(A, B, Cc, D, o);
    // A triangle with an angle only a few thousandths of a radian makes the
    // applet's own |det| < 1 guard return NaN: nothing to compare there.
    if (!g || !["IABC", "IACD", "IABD", "IBCD"].every((k) => Number.isFinite(ap[k].x))) continue;
    triangles++;
    for (const key of ["IABC", "IACD", "IABD", "IBCD"]) {
      const e = dist(g[key], ap[key]);
      if (!(e < 1e-6)) mismatches++;
      worstIncenter = Math.max(worstIncenter, e);
    }
    for (const key of ["ABC", "ACD", "ABD", "BCD"]) {
      const e = Math.abs(g.radii[key] - ap.radii[key]);
      if (!(e < 1e-6)) mismatches++;
      worstRadius = Math.max(worstRadius, e);
    }
    for (const [key, value] of [["P", ap.P], ["Q", ap.Q], ["R", ap.R], ["S", ap.S]]) {
      const e = dist(g[key], value);
      if (!(e < 1e-6)) mismatches++;
      worstArc = Math.max(worstArc, e);
    }
    for (let i = 0; i < 4; i++) {
      const e = dist(g.rhombus.lines[i].q, ap.lines[i][1]);
      if (!(e < 1e-6)) mismatches++;
      worstParallel = Math.max(worstParallel, e);
    }
  }
  check("nearly all random quadrilaterals were non-degenerate", triangles >= 495,
    `${triangles}/500`);
  check("core incenters equal apFindIncenter in every case", mismatches === 0 && worstIncenter < 1e-6,
    `max ${worstIncenter.toExponential(2)}`);
  check("core inradii equal the applet's mean-of-three-distances", worstRadius < 1e-6,
    `max ${worstRadius.toExponential(2)}`);
  check("core HalveArc equals the applet's rotate-by-half-angle", worstArc < 1e-6,
    `max ${worstArc.toExponential(2)}`);
  check("core rhombus lines equal GeoSDoub.GetParallelTo", worstParallel < 1e-6,
    `max ${worstParallel.toExponential(2)}`);
  check("GeoSDoub.FindOrientation agrees with the core", (() => {
    const a = P(0, 0), b = P(10, 0), c = P(3, 7), d = P(3, -7);
    return C.orientation(a, b, c) === apOrientation(a, b, c) && C.orientation(a, b, d) === apOrientation(a, b, d);
  })());
  check("GeoSDoub.Rotate agrees with the core", closePoint(
    C.rotate(P(10, 20), P(40, 60), 0.7, 1), apRotate(P(10, 20), P(40, 60), 0.7, 1), 1e-12));
  check("GeoSDoub.Intersect agrees with the core", closePoint(
    C.intersect(P(0, 0), P(10, 10), P(0, 10), P(10, 0)),
    apIntersect(P(0, 0), P(10, 10), P(0, 10), P(10, 0)), 1e-12));
  check("GeoSDoub.NearestPoint agrees with the core's foot", closePoint(
    C.foot(P(3, 9), P(0, 0), P(10, 0)),
    apNearestPoint(P(3, 9), P(0, 0), P(10, 0)), 1e-12));
  check("the applet's start is reproduced by its bytecode too", (() => {
    const s = C.start();
    const ap = apConstruction(s.A, s.B, s.C, s.D, C.CENTER);
    return dist(ap.IABD, C.geometry(s).IABD) < 1e-6;
  })());
}

/* ------------------------ 3. every claim, over the whole angle grid */

{
  const n = 20;
  const angles = Array.from({ length: n }, (_, i) => (i * TAU) / n);
  let cases = 0, failures = 0;
  let rectangleFails = 0, radiusFails = 0, rhombusFails = 0, arcFails = 0;
  let midFails = 0, insideFails = 0;
  let largeGap = 0, drawnDifferent = 0, drawnPerpOnLarge = 0;
  let smallGap = 0, drawnPerpOnSmall = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        for (let l = k + 1; l < n; l++) {
          const ts = [angles[i], angles[j], angles[k], angles[l]];
          const [A, B, Cc, D] = quad(ts);
          const g = C.compute(A, B, Cc, D);
          if (!g) { failures++; continue; }
          cases++;
          if (!g.claims.rectangle) rectangleFails++;
          if (!g.claims.radiusSum) radiusFails++;
          if (!g.claims.rhombus) rhombusFails++;
          if (!g.claims.arcsPerpendicular) arcFails++;
          if (!g.claims.rectangleMidpoints) midFails++;
          if (!g.claims.incentersInside) insideFails++;
          const gs = gaps(ts);
          const big = gs.some((v) => v > Math.PI + 1e-9);
          if (big) {
            largeGap++;
            if (Math.abs(g.measures.drawnArcCross - g.measures.sideArcCross) > 1e-7) drawnDifferent++;
            if (g.claims.drawnArcsPerpendicular) drawnPerpOnLarge++;
          } else {
            smallGap++;
            if (g.claims.drawnArcsPerpendicular) drawnPerpOnSmall++;
            // At an exactly antipodal pair, acos(-1) loses a couple of ulps
            // and the drawn arc can miss the side arc by a few micrometres.
            if (dist(g.P, g.sideP) > 1e-5 || dist(g.Q, g.sideQ) > 1e-5) failures++;
          }
        }
      }
    }
  }
  check("all 4845 grid quadrilaterals were computed", cases === 4845 && failures === 0,
    `${cases} cases, ${failures} degenerate`);
  check("the four incenters form a rectangle in every case", rectangleFails === 0,
    `${rectangleFails} failures`);
  check("rABC + rACD = rABD + rBCD in every case", radiusFails === 0,
    `${radiusFails} failures`);
  check("the four diagonal-parallel lines form a rhombus in every case", rhombusFails === 0,
    `${rhombusFails} failures`);
  check("PQ is perpendicular to RS in every case (side arcs)", arcFails === 0,
    `${arcFails} failures`);
  check("PQ and RS pass through the rectangle's side midpoints", midFails === 0,
    `${midFails} failures`);
  check("each incenter lies inside its own triangle", insideFails === 0,
    `${insideFails} failures`);
  check("the grid really contains sides spanning more than a semicircle", largeGap > 0,
    `${largeGap} cases`);
  check("the applet's minor-arc HalveArc differs for those sides", drawnDifferent === largeGap,
    `${drawnDifferent}/${largeGap}`);
  check("the drawn PQ and RS fail to be perpendicular for some of those cases",
    drawnPerpOnLarge < largeGap, `${drawnPerpOnLarge}/${largeGap} still perpendicular`);
  check("for gaps below 180 degrees the drawn arcs are the side arcs",
    drawnPerpOnSmall === smallGap, `${drawnPerpOnSmall}/${smallGap}`);
}

{
  const rnd = rng(777);
  let cases = 0, bad = 0, guarded = 0;
  for (let k = 0; k < 500; k++) {
    const o = P((rnd() - 0.5) * 900, (rnd() - 0.5) * 900);
    const r = 30 + 200 * rnd();
    const ts = [0, 0, 0, 0].map(() => rnd() * TAU).sort((x, y) => x - y);
    const [A, B, Cc, D] = quad(ts, o, r);
    const g = C.compute(A, B, Cc, D, { c: o, r: r });
    if (!g) continue;
    cases++;
    // GeoSDoub.NearestPoint returns the point itself for a side with
    // squared length < 0.1, so the applet's own radius sum is wrong when a
    // triangle side is shorter than sqrt(0.1) board units.
    const sides = [dist(A, B), dist(B, Cc), dist(Cc, D), dist(D, A), dist(A, Cc), dist(B, D)];
    const tiny = sides.some((s) => s * s < 0.1);
    if (tiny) guarded++;
    const claimsOk = g.claims.rectangle && (g.claims.radiusSum || tiny) && g.claims.rhombus
      && g.claims.arcsPerpendicular && g.claims.rectangleMidpoints
      && g.claims.incentersInside && g.claims.onCircle;
    if (!claimsOk) bad++;
  }
  check("500 random convex quadrilaterals elsewhere on the plane", cases === 500);
  check("every random claim holds away from the starting circle too", bad === 0,
    `${bad} failures`);
  check("the random set includes the applet's tiny-side guard", guarded > 0,
    `${guarded} cases`);

  const off = C.compute(C.circlePoint(0), C.circlePoint(1.5), C.circlePoint(3),
    P(C.CENTER.x + 10, C.CENTER.y + 20));
  check("a corner off the circle is reported as not cyclic", off && !off.claims.onCircle);

  // The theorem needs a cyclic quadrilateral: collect counterexamples where
  // the fourth corner is off the circle by a substantial amount.
  let noncyclic = 0, rectangleBreaks = 0;
  for (let k = 0; k < 100; k++) {
    const ts = [0.2, 1.6, 3.1, 4.7];
    const pts = quad(ts);
    pts[3] = P(pts[3].x + 20 + 30 * rnd(), pts[3].y + 10 * rnd());
    const g = C.compute(pts[0], pts[1], pts[2], pts[3]);
    if (!g) continue;
    noncyclic++;
    if (!g.claims.rectangle || !g.claims.radiusSum) rectangleBreaks++;
  }
  check("non-cyclic quadrilaterals were tried", noncyclic > 0);
  check("the rectangle and radius claims are not true off the circle", rectangleBreaks > 0,
    `${rectangleBreaks}/${noncyclic} broke`);
}

done("cyclic-quadrilateral");
