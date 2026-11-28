#!/usr/bin/env node
"use strict";

/*
 * Logic test for max-common-chord-2/max-common-chord-2-core.js.
 *
 *   node porting/check-max-common-chord-2.mjs
 *
 * 1. The applet's own init() and its circle/line arithmetic, transcribed a
 *    second time straight from the bytecode, compared with the core.
 * 2. The two drag modes ("Adjust circles" / "Adjust chord") and the Fix()
 *    step that keeps A-P-B collinear, compared with the transcribed handlers.
 * 3. The page's claims, over a grid of P, Q, circle centres and chord angles
 *    plus seeded random configurations: S lies on C(O), S is the centre of
 *    the circumcircle of ABQ, L-S-M-Q is cyclic, SA = SB = SQ, QP bisects
 *    angle LQM, and AQ/BQ are diameters when the applet flags "Finished".
 * 4. The two maxima: AB is longest when AQ is a diameter, while AP×PB has a
 *    different maximum for asymmetric circles (the page only claims the
 *    former, and the test says so explicitly).
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const SLUG = "max-common-chord-2";
const C = loadCore(`${SLUG}/${SLUG}-core.js`, "MaxCommonChord2Core");

const p = (x, y) => ({ x, y });
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sub = (a, b) => p(a.x - b.x, a.y - b.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cr = (a, b) => a.x * b.y - a.y * b.x;
const close = (a, b, t) => Math.abs(a - b) <= t;
const closeP = (a, b, t) => finite(a) === finite(b)
  && (!finite(a) || (Math.abs(a.x - b.x) <= t && Math.abs(a.y - b.y) <= t));
const finite = (a) => !!a && Number.isFinite(a.x) && Number.isFinite(a.y);
const ang = (u, v, w) => {
  const a = d(v, u), b = d(v, w), c = d(u, w);
  if (a < 1e-12 || b < 1e-12) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b))));
};

/* ------------------------------------- the applet's arithmetic, transcribed */

/* GeoSDoub.SqDist/Dist — plain Euclidean distance. */
const aDist = (u, v) => Math.sqrt((u.x - v.x) * (u.x - v.x) + (u.y - v.y) * (u.y - v.y));

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), with its
 * |denominator| < 1 guard and (NaN,NaN) result. */
function aLineCross(u, v, s, t) {
  const d1 = v.y - u.y, e1 = u.x - v.x, f1 = u.x * v.y - u.y * v.x;
  const d2 = t.y - s.y, e2 = s.x - t.x, f2 = s.x * t.y - s.y * t.x;
  const det = d1 * e2 - d2 * e1;
  if (Math.abs(det) < 1) return p(NaN, NaN);
  return p((f1 * e2 - f2 * e1) / det, (d1 * f2 - d2 * f1) / det);
}

/* GeoSDoub.FindCircumcenter: two perpendicular bisectors through midpoints. */
function aCircum(u, v, w) {
  const mUV = p((u.x + v.x) / 2, (u.y + v.y) / 2);
  const mVW = p((v.x + w.x) / 2, (v.y + w.y) / 2);
  const nUV = p(mUV.x + (v.y - u.y), mUV.y - (v.x - u.x));
  const nVW = p(mVW.x + (w.y - v.y), mVW.y - (w.x - v.x));
  return aLineCross(mUV, nUV, mVW, nVW);
}

/* MaxCommonChord2Canvas.GetCircle: centre plus the average of three radii. */
function aCircle(u, v, w) {
  const o = aCircum(u, v, w);
  return { x: o.x, y: o.y, radius: (aDist(o, u) + aDist(o, v) + aDist(o, w)) / 3 };
}

/* GeoSDoub.Intersect(DoubLine,DoubCircle), slope branches in bytecode order. */
function aLineCircle(c, u, v) {
  if (Math.abs(u.y - v.y) > 1) {
    const slope = (u.x - v.x) / (u.y - v.y);
    const intercept = v.x - slope * v.y;
    const A = slope * slope + 1;
    const B = slope * (intercept - c.x) - c.y;
    const Cc = (intercept - c.x) ** 2 + c.y * c.y - c.radius * c.radius;
    const disc = B * B - A * Cc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t0 = (-B + root) / A, t1 = (-B - root) / A;
    return [p(slope * t0 + intercept, t0), p(slope * t1 + intercept, t1)];
  }
  if (Math.abs(u.x - v.x) > 1) {
    const slope = (u.y - v.y) / (u.x - v.x);
    const intercept = v.y - slope * v.x;
    const A = slope * slope + 1;
    const B = slope * (intercept - c.y) - c.x;
    const Cc = (intercept - c.y) ** 2 + c.x * c.x - c.radius * c.radius;
    const disc = B * B - A * Cc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t0 = (-B + root) / A, t1 = (-B - root) / A;
    return [p(t0, slope * t0 + intercept), p(t1, slope * t1 + intercept)];
  }
  return null;
}

/* GeoSDoub.Intersect(DoubCircle,DoubCircle) in radical-axis slope form. */
function aCircleCircle(c1, c2) {
  if (Math.abs(c1.x - c2.x) > 1) {
    const slope = -(c1.y - c2.y) / (c1.x - c2.x);
    const intercept = (c1.x ** 2 - c2.x ** 2 + c1.y ** 2 - c2.y ** 2
      - c1.radius ** 2 + c2.radius ** 2) / (2 * (c1.x - c2.x));
    const a0 = intercept - c1.x;
    const B = slope * a0 - c1.y;
    const Cc = a0 * a0 + c1.y ** 2 - c1.radius ** 2;
    const disc = B * B - (slope * slope + 1) * Cc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc), den = slope * slope + 1;
    const t0 = (-B + root) / den, t1 = (-B - root) / den;
    return [p(slope * t0 + intercept, t0), p(slope * t1 + intercept, t1)];
  }
  if (Math.abs(c1.y - c2.y) > 1) {
    const slope = -(c1.x - c2.x) / (c1.y - c2.y);
    const intercept = (c1.x ** 2 - c2.x ** 2 + c1.y ** 2 - c2.y ** 2
      - c1.radius ** 2 + c2.radius ** 2) / (2 * (c1.y - c2.y));
    const a0 = intercept - c1.y;
    const B = slope * a0 - c1.x;
    const Cc = a0 * a0 + c1.x ** 2 - c1.radius ** 2;
    const disc = B * B - (slope * slope + 1) * Cc;
    if (disc < 0) return null;
    const root = Math.sqrt(disc), den = slope * slope + 1;
    const t0 = (-B + root) / den, t1 = (-B - root) / den;
    return [p(t0, slope * t0 + intercept), p(t1, slope * t1 + intercept)];
  }
  return [p(c1.x, c1.y), p(c1.x, c1.y)];
}

/* Canvas.Other: points[1] when points[0] is within one unit of the reference. */
function aOther(points, ref) {
  if (!points || !points[0] || !points[1]) return null;
  return aDist(points[0], ref) < 1 ? points[1] : points[0];
}

/* Canvas.Fix(target, circle, other), used by init() and every A/B drag. */
function aFix(target, c, other, P) {
  if (aDist(other, P) < 1) return p(target.x, target.y);
  const hit = aOther(aLineCircle(c, other, P), P);
  return hit ? p(hit.x, hit.y) : p(target.x, target.y);
}

/* CTKMoveableDoub.UpdateLocation under STAY_ON_CIRCLE. */
function aGlide(q, c) {
  const radius = c.radius;
  const distance = aDist(q, c);
  return p(c.x + ((q.x - c.x) * radius) / distance,
    c.y + ((q.y - c.y) * radius) / distance);
}

/* Canvas.init() at the applet's 640×460 size, without any UI. */
function aStart() {
  const W = 640, H = 460;
  const P = p(W / 2, (2 * H) / 5 + H / 5);
  const Q = p(W / 2, (3 * H) / 5 + H / 5);
  const A = p((3 * W) / 10, H / 2 + H / 5);
  const B0 = p((17 * W) / 20, (3 * H) / 5 + H / 5);
  const circleF = aCircle(B0, P, Q);
  const B = aFix(B0, circleF, A, P);
  return { P, Q, A, B };
}

/* Canvas.Compute(), line for line from the bytecode. */
function aCompute(state) {
  const A = state.A, P = state.P, Q = state.Q, B = state.B;
  if (aDist(A, P) < 2 || aDist(A, Q) < 2 || aDist(B, P) < 2 || aDist(B, Q) < 2 || aDist(P, Q) < 1) return null;
  const E = aCircle(A, P, Q), F = aCircle(B, P, Q);
  const EQF = aCircle(E, F, Q), ABQ = aCircle(A, B, Q);
  const R = aOther(aLineCircle(ABQ, P, Q), Q);
  if (!R || aDist(P, R) < 1) return null;
  const L = aOther(aCircleCircle(EQF, E), Q);
  const M = aOther(aCircleCircle(EQF, F), Q);
  if (!L || !M) return null;
  const S = aLineCross(A, L, B, M);
  return { E, F, O: EQF, ABQ, R, L, M, S, finished: Math.abs(2 * aDist(Q, E) - aDist(Q, A)) < 0.01 };
}

/* Canvas.mouseDragged for A/B, transcription of the arcs 60..166. */
function aDrag(state, which, q, adjustCircles) {
  const next = { P: state.P, Q: state.Q, A: state.A, B: state.B };
  const cE = aCircle(next.A, next.P, next.Q);
  const cF = aCircle(next.B, next.P, next.Q);
  if (which === "A") {
    next.A = adjustCircles ? p(q.x, q.y) : aGlide(q, cE);
    next.B = aFix(next.B, cF, next.A, next.P);
  } else {
    next.B = adjustCircles ? p(q.x, q.y) : aGlide(q, cF);
    next.A = aFix(next.A, cE, next.B, next.P);
  }
  return next;
}

/* ------------------------------------------- independent page-claim formulas */

/* Circumcentre from the determinant formula, not the applet's bisectors. */
function trueCircum(u, v, w) {
  const det = 2 * (u.x * (v.y - w.y) + v.x * (w.y - u.y) + w.x * (u.y - v.y));
  if (!det) return p(NaN, NaN);
  const u2 = u.x * u.x + u.y * u.y, v2 = v.x * v.x + v.y * v.y, w2 = w.x * w.x + w.y * w.y;
  return p(
    (u2 * (v.y - w.y) + v2 * (w.y - u.y) + w2 * (u.y - v.y)) / det,
    (u2 * (w.x - v.x) + v2 * (u.x - w.x) + w2 * (v.x - u.x)) / det,
  );
}

function circumcircle(u, v, w) {
  const o = trueCircum(u, v, w);
  return { center: o, radius: aDist(o, u) };
}

/* A chord direction u (from P to A, then from P to B along -u). */
function chordPoints(P, Q, centreE, centreF, theta) {
  const mid = p((P.x + Q.x) / 2, (P.y + Q.y) / 2);
  const v = sub(Q, P), qLen = Math.hypot(v.x, v.y);
  const perp = p(-v.y / qLen, v.x / qLen);
  const u = p(perp.x * Math.cos(theta) + (v.x / qLen) * Math.sin(theta),
    perp.y * Math.cos(theta) + (v.y / qLen) * Math.sin(theta));
  const hit = (centre) => {
    const t = 2 * dot(sub(centre, P), u);
    return p(P.x + t * u.x, P.y + t * u.y);
  };
  return { A: hit(centreE), B: hit(centreF), u };
}

/* ------------------------------------------------- build a parameter grid */

function configurations() {
  const out = [];
  const ps = [p(200, 180), p(320, 276), p(440, 360)];
  const qs = [p(0, 90), p(60, 130), p(-50, 70)];
  const offsets = [-150, -90, -40, 40, 90, 150];
  const angles = [];
  for (let i = 0; i < 24; i++) angles.push((i * Math.PI) / 24 - Math.PI / 2);
  for (const P of ps) {
    for (const q of qs) {
      const Q = p(P.x + q.x, P.y + q.y);
      const mid = p((P.x + Q.x) / 2, (P.y + Q.y) / 2);
      for (const a of offsets) {
        for (const b of offsets) {
          if (a * b >= 0) continue; // opposite sides of PQ: a genuine chord
          const centreE = p(mid.x + a, mid.y), centreF = p(mid.x + b, mid.y);
          for (const th of angles) {
            const ab = chordPoints(P, Q, centreE, centreF, th);
            if (aDist(ab.A, P) < 3 || aDist(ab.B, P) < 3) continue;
            const cF = aCircle(ab.B, P, Q);
            const B = aFix(ab.B, cF, ab.A, P);
            out.push({ P, Q, A: ab.A, B, theta: th, centreE, centreF });
          }
        }
      }
    }
  }
  const rnd = rng(20261128);
  for (let i = 0; i < 2500; i++) {
    const P = p(40 + rnd() * 560, 40 + rnd() * 380);
    const Q = p(P.x + (rnd() - 0.5) * 220, P.y + 30 + rnd() * 190);
    const mid = p((P.x + Q.x) / 2, (P.y + Q.y) / 2);
    const a = (rnd() < 0.5 ? -1 : 1) * (20 + rnd() * 170);
    const b = (rnd() < 0.5 ? -1 : 1) * (20 + rnd() * 170);
    if (a * b >= 0) continue;
    const centreE = p(mid.x + a, mid.y), centreF = p(mid.x + b, mid.y);
    const ab = chordPoints(P, Q, centreE, centreF, (rnd() - 0.5) * 0.9);
    if (aDist(ab.A, P) < 3 || aDist(ab.B, P) < 3) continue;
    const B = aFix(ab.B, aCircle(ab.B, P, Q), ab.A, P);
    out.push({ P, Q, A: ab.A, B, theta: 0, centreE, centreF });
  }
  return out;
}

/* ------------------------------------------------------------ 1. the setup */

{
  const s = C.start(), a = aStart();
  for (const name of ["P", "Q", "A", "B"]) {
    check(`init puts ${name} at the applet's position`, closeP(s[name], a[name], 1e-10));
  }
  check("the applet actually moved B onto the chord AP", close(cr(sub(a.B, a.P), sub(a.A, a.P)), 0, 1e-8));
  check("the board is the applet's 640 by 460 canvas", C.VIEW.width === 640 && C.VIEW.height === 460);
  check("the start has names and hint unchecked and Adjust circles selected",
    !s.options.names && !s.options.hint && s.adjust === "circles" && !s.explored);
  check("a picture has no result", C.result(s) === null);
  const g = C.compute(s);
  check("the start diagram has a construction", !!g && g.claims.valid);
  check("the start chord passes through P", g.claims.throughP);
  check("the start description names S and the circle ABQ", /third circle/.test(C.describe(s)));
}

/* ----------------------------------- 2. the core against the bytecode again */

{
  const cases = configurations();
  let compared = 0, skipped = 0, worst = 0, worstFinished = 0;
  for (const cfg of cases) {
    const state = { P: cfg.P, Q: cfg.Q, A: cfg.A, B: cfg.B };
    const mine = C.compute(state), theirs = aCompute(state);
    if (!mine || !theirs || !mine.claims.valid || !finite(theirs.S)) { skipped++; continue; }
    const keys = ["E", "F", "O", "ABQ", "R", "L", "M", "S"];
    for (const key of keys) worst = Math.max(worst, d(mine[key], theirs[key]));
    worstFinished = Math.max(worstFinished, mine.claims.finished === theirs.finished ? 0 : 1);
    compared++;
  }
  check(`the second transcription was compared on ${compared} configurations`, compared > 3000,
    `compared ${compared}, skipped ${skipped}`);
  check("every constructed point matches the bytecode transcription", worst < 1e-8, `worst ${worst}`);
  check("the 0.01 Finished test matches the applet on every case", worstFinished === 0);
  check("degenerate configurations were exercised too", skipped > 0, `skipped ${skipped}`);

  // The transcribed drag handlers and Fix() against Core.move().
  const s = C.start();
  let dragWorst = 0, dragCases = 0;
  const targets = [p(260, 300), p(380, 250), p(150, 360), p(500, 320)];
  for (const mode of ["circles", "chord"]) {
    for (const name of ["A", "B"]) {
      for (const q of targets) {
        const mine = C.move(Object.assign({}, s, { adjust: mode }), name, q);
        const theirs = aDrag(s, name, q, mode === "circles");
        dragWorst = Math.max(dragWorst, d(mine.A, theirs.A), d(mine.B, theirs.B));
        dragCases++;
      }
    }
  }
  check(`both drag modes matched the applet's handlers in ${dragCases} drags`,
    dragWorst < 1e-8, `worst ${dragWorst}`);
  check("a dragged chord still passes through P", C.compute(C.move(s, "A", p(260, 300))).claims.throughP);
  check("unknown handles and non-finite points are ignored",
    C.move(s, "Z", p(1, 2)) === s && C.move(s, "A", p(NaN, 4)) === s);
  check("toggling a display box marks the diagram explored",
    C.setOption(s, "hint", true).options.hint && C.setOption(s, "hint", true).explored && !s.explored);
  check("unknown display boxes are ignored", C.setOption(s, "nope", true) === s);
  check("Reset restores the points and keeps the boxes",
    closeP(C.reset(C.setOption(s, "names", true)).B, s.B, 1e-10)
    && C.reset(C.setOption(s, "names", true)).options.names);
}

/* ---------------------------------------------- 3. the page's claims, all grid cases */

{
  const cases = configurations();
  let n = 0, bad = 0;
  let worstOnO = 0, worstCyclic = 0, worstCenter = 0, worstEqual = 0, worstBisect = 0, worstCross = 0;
  for (const cfg of cases) {
    const g = C.compute({ P: cfg.P, Q: cfg.Q, A: cfg.A, B: cfg.B });
    if (!g || !g.claims.valid) continue;
    n++;
    worstOnO = Math.max(worstOnO, g.measures.sOnO);
    worstCyclic = Math.max(worstCyclic, g.measures.cyclic);
    worstCenter = Math.max(worstCenter, g.measures.centerOnO, g.measures.sIsCenter);
    worstEqual = Math.max(worstEqual, g.measures.saSb, g.measures.saSq, g.measures.sbSq);
    worstBisect = Math.max(worstBisect, g.measures.bisect);
    worstCross = Math.max(worstCross, g.measures.crossErr);
    if (!g.claims.throughP || !g.claims.sOnO || !g.claims.centerOnO || !g.claims.sIsCenter
      || !g.claims.lsmqCyclic || !g.claims.equalRadii || !g.claims.bisector) bad++;

    // Check S and the cyclic quadrilateral with completely independent circles.
    const circumABQ = circumcircle(g.A, g.B, g.Q);
    if (d(g.S, circumABQ.center) > 1e-6) bad++;
    const throughLSQ = circumcircle(g.L, g.S, g.Q);
    if (Math.abs(aDist(g.M, throughLSQ.center) - throughLSQ.radius) > 1e-6) bad++;
    const CO = circumcircle(g.E, g.F, g.Q);
    if (Math.abs(aDist(g.S, CO.center) - CO.radius) > 1e-6) bad++;
  }
  check(`the page's invariants were checked on ${n} configurations`, n > 3000, `${n} cases`);
  check("no configuration contradicted the page's invariants", bad === 0, `${bad} failures`);
  check("S stays on C(O)", worstOnO < 1e-6, `worst ${worstOnO}`);
  check("L, S, M, Q stay cyclic", worstCyclic < 1e-6, `worst ${worstCyclic}`);
  check("S is the circumcentre of ABQ and that centre is on C(O)", worstCenter < 1e-6, `worst ${worstCenter}`);
  check("SA = SB = SQ", worstEqual < 1e-7, `worst ${worstEqual}`);
  check("QP bisects angle LQM", worstBisect < 1e-7, `worst ${worstBisect}`);
  check("A, P and B stay collinear", worstCross < 1e-7, `worst ${worstCross}`);

  // At the applet's Finished configuration all three diameters are present.
  const s = C.start(), o = C.optimal(s), og = C.compute(o);
  check("the diameter button reaches the applet's Finished state", og.claims.finished && og.claims.bothDiameters);
  check("AQ is a diameter of C(E) and BQ one of C(F)",
    close(og.measures.diameterErr, 0, 1e-7) && close(og.measures.bDiameterErr, 0, 1e-7));
  check("QS is a diameter of C(O) at the Finished state",
    close(og.measures.sq, 2 * og.O.radius, 1e-7), `QS=${og.measures.sq}, rO=${og.O.radius}`);
  check("the status line reports the finished configuration", /AQ is now a diameter/.test(C.describe(o)));
  // Moving A along the line through P perpendicular to PQ keeps PA ⟂ QA, so
  // it stays a diameter; a vertical move is the one that breaks the test.
  const near = C.move(o, "A", p(o.A.x, o.A.y + 5));
  check("moving A off the diameter clears the 0.01 Finished test", !C.compute(near).claims.finished);
}

/* ---------------------------------------------- 4. maxima and the nuance */

{
  // Use the same two circles as the applet's start: centres on the line
  // perpendicular to PQ, with signed offsets e and f from that line.
  const P = p(0, 0), Q = p(0, 92);
  const mid = p(0, 46);
  let lengthMaxOk = 0, productFormulaOk = 0, productCounter = 0, sweeps = 0;
  const rnd = rng(1975);
  for (let k = 0; k < 200; k++) {
    const e = (rnd() < 0.5 ? -1 : 1) * (20 + rnd() * 150);
    const f = (rnd() < 0.5 ? -1 : 1) * (20 + rnd() * 150);
    if (e * f >= 0) continue;
    const CE = p(mid.x + e, mid.y), CF = p(mid.x + f, mid.y);
    const radiusE = aDist(CE, P), radiusF = aDist(CF, P);
    let bestLen = -1, bestLenTheta = NaN, bestProd = -1;
    for (let i = -450; i <= 450; i++) {
      const theta = (i * Math.PI) / 1800; // -45° to +45°
      const ab = chordPoints(P, Q, CE, CF, theta);
      const len = aDist(ab.A, ab.B), prod = aDist(ab.A, P) * aDist(P, ab.B);
      if (len > bestLen) { bestLen = len; bestLenTheta = theta; }
      if (prod > bestProd) bestProd = prod;
    }
    const diam = chordPoints(P, Q, CE, CF, 0);
    const lenAtDiameter = aDist(diam.A, diam.B), prodAtDiameter = aDist(diam.A, P) * aDist(P, diam.B);
    const analytic = 2 * (radiusE * radiusF - dot(sub(CE, P), sub(CF, P)));
    if (bestLen <= lenAtDiameter + 1e-7 && Math.abs(bestLenTheta) < 1e-9) lengthMaxOk++;
    // The grid step leaves a second-order gap of a few parts in a million.
    if (Math.abs(bestProd - analytic) < 1e-5 * analytic) productFormulaOk++;
    if (bestProd > prodAtDiameter + 1e-6) productCounter++;
    sweeps++;
  }
  check(`${sweeps} random circle pairs were swept over 901 chord directions`, sweeps > 50);
  check(`AB is longest exactly at the diameter chord in all ${lengthMaxOk} sweeps`, lengthMaxOk === sweeps);
  check("the closed form 2(R_E·R_F − E·F) gives the maximum of AP×PB", productFormulaOk === sweeps);
  check(`AP×PB beats its diameter value in ${productCounter} asymmetric pairs`, productCounter > 0);

  // A concrete asymmetric pair: same two-radius ratio as the classic example.
  const CE = p(45, 46), CF = p(-30, 46);
  const diam = chordPoints(P, Q, CE, CF, 0);
  const prodDiam = aDist(diam.A, P) * aDist(P, diam.B);
  const analytic = 2 * (aDist(CE, P) * aDist(CF, P) - dot(CE, CF));
  check("the diameter chord is not the product maximum for unequal circles",
    analytic > prodDiam + 1e-6, `at diameter ${prodDiam}, maximum ${analytic}`);
  check("but it is still the longest chord for those circles",
    aDist(diam.A, diam.B) === 2 * (45 + 30));
}

/* ---------------------------------------------- 5. edge cases of Compute() */

{
  const s = C.start();
  const near = C.move(s, "A", p(s.P.x + 1, s.P.y + 1));
  check("A closer than 2 units to P stops the construction", C.compute(near) === null);
  const closeQ = C.move(s, "Q", p(s.P.x, s.P.y + 0.5));
  check("P and Q closer than 1 unit stop the construction", C.compute(closeQ) === null);
  check("a non-finite corner gives no construction",
    C.compute(Object.assign({}, s, { B: p(NaN, 3) })) === null);
  check("the status explains when no construction can be drawn",
    /Move the four dots/.test(C.describe(near)));
  check("the tutor position records the four points and the finished flag",
    finite(C.position(s).A) && C.position(s).finished === false
    && C.position(C.optimal(s)).finished === true);
}

done(SLUG);
