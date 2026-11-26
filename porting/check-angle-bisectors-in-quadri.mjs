#!/usr/bin/env node
"use strict";

/*
 * Logic test for angle-bisectors-in-quadri/angle-bisectors-in-quadri-core.js.
 *
 *   node porting/check-angle-bisectors-in-quadri.mjs
 *
 * Checks the applet's starting quadrilateral from Reset(), all four angle
 * bisectors, U = AX ∩ DY, V = BX ∩ CY, G = AC ∩ BD, and every claim on the
 * cut-the-knot article: U, G, V collinear; X and Y on the circumcircle when
 * ABCD is cyclic; X and Y are the midpoints of arcs CD and AB; and the
 * circle-free version (X on the circle through B,C,D iff A is, and then Y
 * is too).  These are tried on fixed quadrilaterals and hundreds of random
 * convex ones, including cyclic and almost-cyclic ones.  Finally the whole
 * construction is transcribed a second time, literally from the applet's
 * GeoSDoub bytecode (ComputeAngle / FindOrientation / Rotate / Intersect /
 * FindCircumcenter and the canvas's Compute), and compared with the core.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("angle-bisectors-in-quadri/angle-bisectors-in-quadri-core.js", "AngleBisectorsInQuadriCore");

const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const scaleOf = (a, b, c, d) => Math.max(1, dist(a, b), dist(b, c), dist(c, d), dist(d, a), dist(a, c), dist(b, d));
const tolOf = (a, b, c, d) => 1e-6 * scaleOf(a, b, c, d);

function convex(a, b, c, d) {
  const s = [a, b, c, d].map((p, i) => {
    const q = [a, b, c, d][(i + 1) % 4], r = [a, b, c, d][(i + 2) % 4];
    return C.cross(C.sub(q, p), C.sub(r, q));
  });
  return (s.every((v) => v > 0) || s.every((v) => v < 0)) && Math.min(...s.map(Math.abs)) > 200;
}

function cyclicQuad(center, radius, angles) {
  return angles.map((t) => P(center.x + radius * Math.cos(t), center.y + radius * Math.sin(t)));
}

/* --------------------------------- the applet's own arithmetic, from bytecode */

/*
 * GeoSDoub.ComputeAngle: acos((SqDist(P,Q)+SqDist(P,R)-SqDist(Q,R)) /
 *                            (2*Dist(P,Q)*Dist(P,R))) — no clamping.
 */
function appletAngle(P1, P2, P3) {
  const sq = (u, v) => ((u.x - v.x) ** 2 + (u.y - v.y) ** 2);
  const cos = (sq(P1, P2) + sq(P1, P3) - sq(P2, P3)) / (2 * Math.sqrt(sq(P1, P2)) * Math.sqrt(sq(P1, P3)));
  return Math.acos(cos);
}

/* GeoSDoub.FindOrientation: +1 when the cross expression is > 0, else -1. */
function appletOrientation(P1, P2, P3) {
  const s = P3.x * (P1.y - P2.y) + P3.y * (P2.x - P1.x) + P1.x * P2.y - P2.x * P1.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate(P1, P2, angle, orientation): rotate P2 about P1. */
function appletRotate(P1, P2, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return P(
    P1.x + cs * (P2.x - P1.x) - orientation * sn * (P2.y - P1.y),
    P1.y + orientation * sn * (P2.x - P1.x) + cs * (P2.y - P1.y),
  );
}

/* AngleBisectorsInQuadriCanvas.FindAngleBisector: rotate a ray by half the angle. */
function appletBisector(P1, P2, P3) {
  return appletRotate(P1, P2, appletAngle(P1, P2, P3) / 2, appletOrientation(P1, P2, P3));
}

/* GeoSDoub.Intersect: ax+by+c=0 lines, with the applet's |det| < 1 fallback
 * to NaN instead of a null. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* GeoSDoub.FindCircumcenter plus the canvas's GetCircle: mean of the three
 * centre-to-vertex distances. */
function appletCircle(P1, P2, P3) {
  const m12 = P((P1.x + P2.x) / 2, (P1.y + P2.y) / 2);
  const m23 = P((P2.x + P3.x) / 2, (P2.y + P3.y) / 2);
  const o = appletIntersect(
    m12, P(m12.x + P1.y - P2.y, m12.y + P2.x - P1.x),
    m23, P(m23.x + P2.y - P3.y, m23.y + P3.x - P2.x),
  );
  return { c: o, r: (dist(o, P1) + dist(o, P2) + dist(o, P3)) / 3 };
}

/* AngleBisectorsInQuadriCanvas.Compute(), step by step from the bytecode. */
function appletCompute(A, B, Cc, D) {
  const s1 = appletBisector(A, D, Cc);      // bisector of CAD
  const s2 = appletBisector(B, D, Cc);      // bisector of CBD
  const s3 = appletBisector(Cc, A, B);      // bisector of ACB
  const s4 = appletBisector(D, A, B);       // bisector of ADB
  const X = appletIntersect(A, s1, B, s2);  // field AB in the applet
  const Y = appletIntersect(Cc, s3, D, s4); // field CD in the applet
  const U = appletIntersect(A, X, D, Y);    // field AD
  const V = appletIntersect(B, X, Cc, Y);   // field BC
  const G = appletIntersect(A, Cc, B, D);
  const circle = appletCircle(A, B, Cc);
  return { X, Y, U, V, G, circle };
}

/* ------------------------------------------------ 1. start position and rules */

{
  const s = C.start();
  equal("Reset puts A at (120,160) on a 400x300 canvas", s.A, P(120, 160));
  equal("Reset puts B at (280,240)", s.B, P(280, 240));
  equal("Reset puts C at (320,80)", s.C, P(320, 80));
  equal("Reset puts D at (180,130)", s.D, P(180, 130));
  check("all three Show boxes start unchecked",
    !s.options.angles && !s.options.names && !s.options.extra);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("the start quadrilateral is convex", convex(s.A, s.B, s.C, s.D));
  check("the start quadrilateral is not cyclic", !C.geometry(s).claims.cyclic);
  check("a fresh diagram is not marked explored", !s.explored);
}

{
  const s = C.start();
  const next = C.move(s, "A", P(10, 10));
  check("moving a corner leaves the old position alone", s.A.x === 120 && next.A.x === C.PAD);
  check("moving a corner marks it explored", next.explored && !s.explored);
  check("an unknown corner is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("a non-finite corner is ignored", C.move(s, "A", P(NaN, 4)) === s);
  check("corners are clamped inside the board", (() => {
    const q = C.move(s, "B", P(9999, -9999));
    return q.B.x === C.VIEW.width - C.PAD && q.B.y === C.PAD;
  })());
  const withOptions = C.setOption(C.setOption(s, "angles", true), "extra", true);
  check("options change independently", withOptions.options.angles && withOptions.options.extra
    && !withOptions.options.names);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(withOptions);
  check("Reset restores all four corners", r.A.x === 120 && r.D.y === 130);
  check("Reset keeps the Show boxes", r.options.angles && r.options.extra);
  check("status describes the collinearity", /U, G and V are on one straight line/.test(C.describe(s)));
}

/* ---------------------------------- 2. fixed quadrilaterals, including cyclic */

const square = [P(80, 80), P(320, 80), P(320, 320), P(80, 320)];
const rectangle = [P(60, 100), P(340, 100), P(340, 260), P(60, 260)];
const cyclic = cyclicQuad(P(200, 150), 120, [0.1, 1.2, 2.7, 4.9]);
const tilted = [P(70, 180), P(250, 260), P(340, 110), P(140, 60)];
const startQ = [P(120, 160), P(280, 240), P(320, 80), P(180, 130)];
const fixed = [
  ["the applet's start", startQ, false],
  ["a square", square, true],
  ["a rectangle", rectangle, true],
  ["a tilted cyclic quadrilateral", cyclic, true],
  ["a tilted non-cyclic quadrilateral", tilted, false],
];

for (const [name, q, wantCyclic] of fixed) {
  const [a, b, c, d] = q;
  const g = C.compute(a, b, c, d);
  const tol = tolOf(a, b, c, d);
  check(`${name}: the construction exists`, !!g);
  if (!g) continue;
  check(`${name}: U, G, V are collinear`, g.measures.collinearError <= tol,
    `error ${g.measures.collinearError}`);
  check(`${name}: all four bisectors halve their angles`,
    g.claims.bisectedAtA && g.claims.bisectedAtB && g.claims.bisectedAtC && g.claims.bisectedAtD);
  check(`${name}: U and V are the incenters of ADG and BCG`,
    g.claims.uIncenter && g.claims.vIncenter);
  check(`${name}: GU and GV bisect vertical angles`, g.claims.verticalAngles);
  check(`${name}: the cyclic test agrees with the geometry`,
    g.claims.cyclic === (g.measures.cyclicError <= tol));
  check(`${name}: cyclicity is ${wantCyclic ? "detected" : "not falsely reported"}`,
    g.claims.cyclic === wantCyclic, `circle error ${g.measures.cyclicError}`);
  if (wantCyclic) {
    check(`${name}: X and Y lie on the circumcircle`,
      g.measures.xCircleError <= tol && g.measures.yCircleError <= tol);
    check(`${name}: X and Y are the midpoints of arcs CD and AB`,
      g.claims.cyclicImpliesArcMidpoints);
    check(`${name}: the applet would show the circle`, g.appletCyclic);
  } else {
    check(`${name}: the applet hides the circle`, !g.appletCyclic);
  }
  check(`${name}: the generalised circle claim holds`, g.claims.generalized);
  check(`${name}: G lies on both diagonals`,
    C.distanceToLine(g.G, a, c) <= tol && C.distanceToLine(g.G, b, d) <= tol);
}

/* --------------------------------- 3. hundreds of generated convex quadrilaterals */

{
  const rand = rng(2042);
  let tested = 0, cyclicTested = 0, nonCyclicTested = 0, failures = 0;
  for (let trial = 0; trial < 2800; trial++) {
    const q = [0, 1, 2, 3].map(() => P(20 + rand() * 360, 20 + rand() * 260));
    if (!convex(...q)) continue;
    const g = C.compute(...q);
    if (!g) continue;
    tested++;
    const tol = tolOf(...q);
    const general = g.claims.collinear && g.claims.bisectedAtA && g.claims.bisectedAtB
      && g.claims.bisectedAtC && g.claims.bisectedAtD && g.claims.uIncenter
      && g.claims.vIncenter && g.claims.verticalAngles && g.claims.generalized;
    const circleOK = g.claims.cyclicImpliesXOnCircle && g.claims.cyclicImpliesYOnCircle
      && g.claims.cyclicImpliesArcMidpoints;
    if (!general || !circleOK || g.measures.collinearError > tol) {
      failures++;
      check(`random ${trial}: every claim holds`, false, JSON.stringify(g.claims));
    }
    if (g.claims.cyclic) cyclicTested++; else nonCyclicTested++;
  }
  check(`all claims hold on ${tested} random convex quadrilaterals`, tested > 500 && failures === 0);
  check(`the sample includes non-cyclic cases (random quads are almost never cyclic)`,
    nonCyclicTested > 500);

  // Build cyclic quadrilaterals directly, then move D off its circle.
  const rand2 = rng(77);
  let made = 0, circleFailures = 0;
  for (let trial = 0; trial < 400; trial++) {
    const t = [rand2() * 1.2, 1.4 + rand2() * 1.2, 3.0 + rand2() * 1.2, 4.7 + rand2() * 1.2];
    const q = cyclicQuad(P(200, 150), 90 + rand2() * 30, t);
    if (!convex(...q)) continue;
    const g = C.compute(...q);
    if (!g) continue;
    made++;
    const tol = tolOf(...q);
    if (!g.claims.cyclic || !g.claims.cyclicImpliesXOnCircle || !g.claims.cyclicImpliesYOnCircle
      || !g.claims.cyclicImpliesArcMidpoints || g.measures.xCircleError > tol
      || g.measures.yCircleError > tol) {
      circleFailures++;
      check(`cyclic ${trial}: X and Y lie on the circle`, false, JSON.stringify(g.measures));
    }
    // Move A off the circle through B,C,D: X must leave it as well.
    const moved = [P(q[0].x + 4, q[0].y + 4), q[1], q[2], q[3]];
    const gm = C.compute(...moved);
    if (gm && (gm.measures.aCircleBCD < 1e-6 || gm.measures.xCircleBCD < 1e-6)) {
      circleFailures++;
      check(`near-cyclic ${trial}: X leaves the circle with A`, false);
    }
  }
  check(`${made} cyclic quadrilaterals put X and Y on the circle`, made > 350 && circleFailures === 0);
}

/* --------------------- 4. the same points from the applet's own bytecode method */

{
  const rand = rng(1994);
  let compared = 0, mismatches = 0;
  const compare = (label, q) => {
    const [a, b, c, d] = q;
    const g = C.compute(a, b, c, d);
    const ap = appletCompute(a, b, c, d);
    if (!g || !ap.X || !Number.isFinite(ap.X.x) || !Number.isFinite(ap.Y.x)
      || !Number.isFinite(ap.U.x) || !Number.isFinite(ap.V.x) || !Number.isFinite(ap.G.x)) return;
    const tol = 2e-5 * scaleOf(a, b, c, d);
    for (const key of ["X", "Y", "U", "V", "G"]) {
      if (!closePoint(g[key], ap[key], tol)) {
        mismatches++;
        check(`${label}: core ${key} matches the applet's Compute`, false,
          `applet ${JSON.stringify(ap[key])}, core ${JSON.stringify(g[key])}`);
      }
    }
    if (!closePoint(g.circle.c, ap.circle.c, tol) || !close(g.circle.r, ap.circle.r, tol)) {
      mismatches++;
      check(`${label}: circumcircle matches the applet's GetCircle`, false);
    }
    compared++;
  };
  for (const [name, q] of fixed) compare(name, q);
  for (let trial = 0; trial < 1000; trial++) {
    const q = [0, 1, 2, 3].map(() => P(25 + rand() * 350, 25 + rand() * 250));
    if (convex(...q)) compare(`random ${trial}`, q);
  }
  check(`core and applet agree on ${compared} quadrilaterals`, compared > 180 && mismatches === 0);
  const ap = appletCompute(P(80, 80), P(320, 80), P(320, 320), P(80, 320));
  check("the applet's own X is the midpoint of arc CD of the square",
    close(ap.X.x, 200, 1e-6) && close(ap.X.y, 200 + 120 * Math.SQRT2, 1e-6));
  check("the applet's own U, G, V are collinear",
    C.distanceToLine(ap.G, ap.U, ap.V) < 1e-6);
}

/* ------------------------------------------------ 5. degenerate input is safe */

{
  const flat = [P(10, 10), P(50, 10), P(90, 10), P(130, 10)];
  check("four collinear corners give no construction", C.compute(...flat) === null);
  check("a repeated corner gives no construction",
    C.compute(P(10, 10), P(10, 10), P(90, 20), P(40, 80)) === null);
  const degenerateState = C.move(C.start(), "A", P(280, 240));
  check("a degenerate position has a helpful status",
    /quadrilateral/.test(C.describe(degenerateState)));
  check("a degenerate position still has no result", C.result(degenerateState) === null);
  check("describe works without a geometry", typeof C.describe({}) === "string");
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("angle-bisectors-in-quadri");
