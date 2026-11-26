#!/usr/bin/env node
"use strict";

/*
 * Logic test for angle-bisector-in-rectangle/angle-bisector-in-rectangle-core.js.
 *
 *   node porting/check-angle-bisector-in-rectangle.mjs
 *
 * What is checked:
 *   - the start position against Canvas.init's integer arithmetic, and the
 *     corner/P constraints against Canvas.AdjustPoints and Fix(1);
 *   - the five constructed points against a second, literal transcription of
 *     Canvas.Compute (CTKGeometryPlus.Midpoint / GetParallelTo and
 *     GeoSDoub.Intersect, including its |det| < 1 parallel test), over a grid
 *     of rectangle sizes and P positions plus random rectangles;
 *   - the page's theorem, angle QNM = angle MNP, on every non-degenerate case;
 *     the reflection form of the bisector, both similarity proportions, the
 *     corrected transitivity, KM = KN, KM || NP and the incidences;
 *   - the typo in the archived page's "MP/MQ = KN/NQ" (it must be KN/KQ for
 *     KM || NP to follow), and the degenerate case where MP || AC.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "angle-bisector-in-rectangle/angle-bisector-in-rectangle-core.js",
  "AngleBisectorInRectangleCore",
);

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => {
  if (!p || !q) return false;
  // GeoSDoub.Intersect returns (NaN, NaN) for parallel lines: both sides do.
  if (!Number.isFinite(p.x) && !Number.isFinite(q.x)) return true;
  return close(p.x, q.x, tol) && close(p.y, q.y, tol);
};

/* --------------------------------------------------------------------------
 * The applet's own construction, transcribed a second time from the bytecode.
 * Deliberately does not call the core: GeoSDoub.Intersect's ax+by+c=0 form and
 * its 1.0 determinant cutoff are kept as they are in classes.zip.
 * -------------------------------------------------------------------------- */

function appletMidpoint(p, q) {
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

/* CTKGeometryPlus.GetParallelTo(p, q, r): p + 100 * (q - r). */
function appletGetParallelTo(p, q, r) {
  return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
}

/* GeoSDoub.Intersect(p1,p2,p3,p4), including the NaN parallel result. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* AngleBisectorInRectangleCanvas.Compute(), in its original order. */
function appletCompute(s) {
  const M = appletMidpoint(s.A, s.D);
  const N = appletMidpoint(s.B, s.C);
  const Q = appletIntersect(s.A, s.C, M, s.P);
  const O = appletMidpoint(s.A, s.C);
  const K = appletIntersect(Q, N, O, appletGetParallelTo(O, s.B, s.C));
  return { M, N, Q, O, K };
}

/* Canvas.init: w = width/3 and h = height/4 with Java integer division. */
function appletInit(width, height) {
  const w = Math.trunc(width / 3), h = Math.trunc(height / 4);
  const A = { x: w, y: h };
  const B = { x: A.x, y: height - h };
  const C = { x: width - w, y: B.y };
  const D = { x: C.x, y: A.y };
  const P = { x: C.x, y: A.y - Math.trunc(h / 2) };
  return { A, B, C, D, P };
}

/* A rectangle with P at fraction t of the way from D down to CD's line. */
function config(width, height, t) {
  const s = C.start({ width, height });
  return { ...s, P: { x: s.D.x, y: s.D.y + t * (s.C.y - s.D.y) } };
}

/* ------------------------------------------------------ 1. start and input */

{
  equal("start matches Canvas.init on a 400x300 canvas", C.start({ width: 400, height: 300 }),
    appletInit(400, 300));
  equal("start matches Canvas.init on a 300x200 canvas", C.start({ width: 300, height: 200 }),
    appletInit(300, 200));
  equal("start matches the odd-size integer division of Canvas.init", C.start({ width: 401, height: 301 }),
    appletInit(401, 301));
  check("the default canvas is 400x300", JSON.stringify(C.start({})) === JSON.stringify(appletInit(400, 300)));
  check("an illustration is never won or lost",
    C.result(C.start({})) === null && C.result(config(600, 400, 1.3)) === null);

  const s = C.start({});
  check("withPoint leaves the old position untouched", (() => {
    C.withPoint(s, "A", { x: 40, y: 40 });
    return s.A.x === 133 && s.B.x === 133 && s.P.x === 267;
  })());

  const a = C.withPoint(s, "A", { x: 90, y: 60 });
  check("dragging A keeps B.x and D.y with it (AdjustPoints)",
    a.A.x === 90 && a.A.y === 60 && a.B.x === 90 && a.D.y === 60 && a.C.x === 267 && a.B.y === 225);

  const b = C.withPoint(s, "B", { x: 150, y: 260 });
  check("dragging B keeps A.x and C.y with it (AdjustPoints)",
    b.B.x === 150 && b.B.y === 260 && b.A.x === 150 && b.C.y === 260 && b.D.x === 267 && b.A.y === 75);

  const c = C.withPoint(s, "C", { x: 300, y: 210 });
  check("dragging C takes D.x, B.y and P.x along (AdjustPoints)",
    c.C.x === 300 && c.C.y === 210 && c.D.x === 300 && c.B.y === 210 && c.P.x === 300 && c.A.x === 133);

  const d = C.withPoint(s, "D", { x: 310, y: 50 });
  check("dragging D takes C.x, A.y and P.x along (AdjustPoints)",
    d.D.x === 310 && d.D.y === 50 && d.C.x === 310 && d.A.y === 50 && d.P.x === 310 && d.B.y === 225);

  const p = C.withPoint(s, "P", { x: 10, y: 120 });
  check("dragging P fixes its x (Canvas.Fix(1)) and leaves the rectangle alone",
    p.P.x === s.C.x && p.P.y === 120 && p.C.x === 267 && p.A.y === 75);

  check("an unknown handle name changes nothing",
    JSON.stringify(C.withPoint(s, "Z", { x: 1, y: 2 })) === JSON.stringify(s));
}

/* --------------------------- 2. the core vs the applet's own construction */

{
  const widths = [101, 160, 267, 400, 640, 999];
  const heights = [90, 151, 300, 480];
  const ts = [-0.4, 0, 0.15, 0.5, 0.85, 1, 1.5];
  let compared = 0;
  let mismatches = 0;
  for (const width of widths) {
    for (const height of heights) {
      for (const t of ts) {
        const s = config(width, height, t);
        const want = appletCompute(s);
        const got = C.construct(s);
        const tol = 1e-8 * Math.max(width, height);
        for (const name of ["M", "N", "O", "Q", "K"]) {
          if (!closePoint(got[name], want[name], tol)) {
            mismatches++;
            check(`${width}x${height} t=${t}: ${name} matches the applet`, false,
              `applet ${JSON.stringify(want[name])}, core ${JSON.stringify(got[name])}`);
          }
        }
        compared++;
      }
    }
  }

  const rand = rng(4162);
  for (let i = 0; i < 300; i++) {
    const width = 120 + rand() * 900, height = 90 + rand() * 500;
    const s = config(width, height, -0.5 + rand() * 2);
    const want = appletCompute(s), got = C.construct(s);
    const tol = 1e-8 * Math.max(width, height);
    for (const name of ["M", "N", "O", "Q", "K"]) {
      if (!closePoint(got[name], want[name], tol)) {
        mismatches++;
        check(`random ${i}: ${name} matches the applet`, false);
      }
    }
    compared++;
  }

  check(`construct agrees with Canvas.Compute on ${compared} configurations`, mismatches === 0);
}

/* --------------------------------------------- 3. the theorem, exhaustively */

{
  const widths = [110, 180, 267, 400, 620, 940];
  const heights = [80, 151, 300, 460];
  // t < 0.5 puts P above O, the range in which the page's equality is true.
  const ts = [-0.45, -0.1, 0, 0.1, 0.25, 0.4];
  let tested = 0, bad = 0;
  for (const width of widths) {
    for (const height of heights) {
      for (const t of ts) {
        const s = config(width, height, t);
        const g = C.construct(s);
        // P at the level of O makes MP parallel to AC: the theorem has no Q.
        if (!Number.isFinite(g.Q.x) || !Number.isFinite(g.K.x)) continue;
        const cl = C.claims(s);
        if (!cl.valid) continue;
        tested++;
        if (!cl.anglesEqual || !cl.aboveO || !cl.reflectionCollinear || !cl.firstProportion ||
            !cl.secondProportion || !cl.correctedThird || !cl.isosceles ||
            !cl.KMparallelNP || !cl.QonAC || !cl.QonMP || !cl.KonQN ||
            !cl.KOparallelBC || !cl.midpointM || !cl.midpointN || !cl.midpointO) {
          bad++;
          check(`${width}x${height} t=${t}: all claims hold`, false, JSON.stringify(cl));
        }
      }
    }
  }
  check(`the page's equality and construction claims hold on ${tested} rectangles`, bad === 0 && tested === widths.length * heights.length * ts.length);

  const rand = rng(90210);
  let randomTested = 0, randomBad = 0;
  for (let i = 0; i < 500; i++) {
    const s = config(100 + rand() * 900, 90 + rand() * 500, -0.6 + rand() * 0.95);
    const cl = C.claims(s);
    if (!cl.valid) continue;
    randomTested++;
    if (!cl.anglesEqual || !cl.aboveO || !cl.firstProportion ||
        !cl.secondProportion || !cl.correctedThird || !cl.isosceles ||
        !cl.KMparallelNP || !cl.reflectionCollinear) {
      randomBad++;
      check(`random rectangle ${i}: all claims hold`, false);
    }
  }
  check(`all claims hold on ${randomTested} random rectangles`, randomBad === 0 && randomTested > 450);
}

/* --------------------- 3b. below O: the exterior bisector, not the claim */

{
  let tested = 0, bad = 0;
  for (const width of [110, 267, 400, 940]) {
    for (const height of [80, 151, 300]) {
      for (const t of [0.6, 0.75, 0.9, 1.2, 1.45]) {
        const s = config(width, height, t);
        const cl = C.claims(s);
        if (!cl.valid) continue;
        tested++;
        // The page's equality fails here; MN bisects the angle outside N.
        if (cl.aboveO || cl.anglesEqual || !cl.exteriorEqual) {
          bad++;
          check(`${width}x${height} t=${t}: exterior relation`, false, JSON.stringify(cl));
        }
      }
    }
  }
  check(`below O, MN bisects the exterior angle on ${tested} rectangles`,
    bad === 0 && tested === 4 * 3 * 5);
}

/* --------------------------- 4. the exact page claim, and its printed typo */

{
  const s = C.start({});
  const cl = C.claims(s);
  check("the page's exact equality holds: angle QNM = angle MNP", cl.anglesEqual,
    `${cl.angleQNM} vs ${cl.angleMNP}`);
  check("the two angles agree to 12 places", close(cl.angleQNM, cl.angleMNP, 1e-12));
  check("MP/MQ = CO/OQ (first similarity)", cl.firstProportion);
  check("CO/OQ = KN/KQ (second similarity)", cl.secondProportion);
  check("the valid transitivity is MP/MQ = KN/KQ", cl.correctedThird);
  check("KM || NP follows from that proportion", cl.KMparallelNP);
  check("KM = KN, so KMN is isosceles", cl.isosceles);
  check("reflecting P in MN lands on the line NQ (another form of bisection)", cl.reflectionCollinear);
  check("the archived page prints KN/NQ, which is not equal to MP/MQ",
    cl.printedThird === false && Math.abs(cl.r_KN_NQ - cl.r_MP_MQ) > 0.1,
    `MP/MQ=${cl.r_MP_MQ}, KN/NQ=${cl.r_KN_NQ}`);
  check("K is on NQ and OK is parallel to BC", cl.KonQN && cl.KOparallelBC);
  check("M, N and O are the three midpoints", cl.midpointM && cl.midpointN && cl.midpointO);
  check("Q lies on both AC and MP", cl.QonAC && cl.QonMP);
}

/* ------------------------------------------- 5. degenerate input is safe */

{
  const s = config(400, 300, 0.5); // P level with O: MP is parallel to AC
  const g = C.construct(s);
  check("the applet's parallel test gives NaN for Q", !Number.isFinite(g.Q.x));
  const cl = C.claims(s);
  check("no claim is made when Q does not exist", !cl.valid && !cl.anglesEqual);

  const flat = C.withPoint(s, "B", { x: 133, y: 75 });
  check("a zero-height rectangle is still handled without throwing", (() => {
    const c = C.claims(flat);
    return typeof c.valid === "boolean" && C.result(flat) === null;
  })());
}

done("angle-bisector-in-rectangle");
