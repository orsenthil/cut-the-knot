#!/usr/bin/env node
"use strict";

/*
 * Logic test for forced-cyclic-quad/forced-cyclic-quad-core.js.
 *
 *   node porting/check-forced-cyclic-quad.mjs
 *
 * The page claims: from a cyclic ABCD with equal add-on angles at A and D,
 * E and F on BC make AEFD cyclic, angle EAF = angle EDF and in particular
 * angle CAF = angle BDE; the same conclusion survives when B and C coalesce
 * and BC becomes the tangent; and the proof's sum angle ADF + AEF = 180°.
 *
 * This test (a) checks the start state, the applet's -45..45 / 0.1 angle
 * control, the circle constraint and the one-pixel skip, (b) checks every
 * claim over a grid of cyclic quadrilaterals where A,B,C,D keep their cyclic
 * order, and (c) transcribes GeoSDoub.Rotate / Intersect / FindCircumcenter
 * and the canvas's Compute a second time from the bytecode and compares all
 * constructed points with the core over the whole angle range.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("forced-cyclic-quad/forced-cyclic-quad-core.js", "ForcedCyclicQuadCore");

const P = (x, y) => ({ x, y });
const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const finitePoint = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const TOL_ANGLE = 5e-5; // radians; the core itself uses 2e-6
const TOL_POINT = 1e-6;

/* The applet's canvas: centre (w/2,h/2), radius min(w,h)/4, AddAPoint. */
function at(t) {
  return P(
    C.CENTER.x + C.RADIUS * Math.cos(t),
    C.CENTER.y - C.RADIUS * Math.sin(t),
  );
}

/* ------------------------------------------------ 1. state and controls */

{
  const s = C.start();
  equal("applet starts A at angle PI", s.angles.A, Math.PI);
  equal("applet starts B at angle PI/4", s.angles.B, Math.PI / 4);
  equal("applet starts C at angle 0", s.angles.C, 0);
  equal("applet starts D at angle 3PI/2", s.angles.D, 3 * Math.PI / 2);
  check("applet starts with an add-on angle of 20 degrees", s.angle === 20);
  check("all three Show boxes start unchecked",
    !s.options.names && !s.options.premise && !s.options.statement);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  const p = C.points(s);
  check("the start points lie on the applet's circle",
    Object.keys(p).every((k) => close(dist(p[k], C.CENTER), C.RADIUS, 1e-9)));
  check("the start points match AddAPoint(centre + r(cos t, -sin t))",
    closePoint(p.A, P(125, 150), 1e-9) && closePoint(p.C, P(275, 150), 1e-9));
}

{
  const s = C.start();
  check("the angle control stops at +45", C.setAngle(s, 99).angle === 45);
  check("the angle control stops at -45", C.setAngle(s, -99).angle === -45);
  check("the angle control keeps one decimal", C.setAngle(s, 12.345).angle === 12.3);
  check("a non-numeric angle is ignored", C.setAngle(s, "twenty") === s);
  check("the spinner steps by 0.1", C.nudgeAngle(C.setAngle(s, 44.9), 0.1).angle === 45);
  check("the angle is clamped again on a nudge beyond the range",
    C.nudgeAngle(C.setAngle(s, 45), 0.1).angle === 45);
  check("changing the angle marks the diagram explored", C.setAngle(s, 5).explored && !s.explored);
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  const opts = C.setOption(C.setOption(s, "names", true), "statement", true);
  check("options change independently",
    opts.options.names && opts.options.statement && !opts.options.premise);
  const r = C.reset(opts);
  check("Reset restores every point and the 20 degree angle",
    r.angle === 20 && r.angles.A === Math.PI && r.angles.B === Math.PI / 4);
  check("Reset keeps the Show boxes", r.options.names && r.options.statement);
}

{
  const s = C.start();
  const moved = C.move(s, "B", P(300, 160));
  check("dragging B keeps it on the circle and marks it explored",
    moved.explored && close(dist(C.points(moved).B, C.CENTER), C.RADIUS, 1e-9)
    && moved.angles.B !== s.angles.B);
  check("dragging leaves the old position alone", s.angles.B === Math.PI / 4);
  check("an unknown point is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("a non-finite pointer is ignored", C.move(s, "A", P(NaN, 4)) === s);
  check("the centre projects to a definite point on the circle", finitePoint(C.clamp(P(200, 150))));
  const q = C.move(s, "C", P(1e6, 1e6));
  check("a far pointer still lands on the circle",
    close(dist(C.points(q).C, C.CENTER), C.RADIUS, 1e-8));
}

/* ---------------------------- 2. the constructed points and the page's claims */

/* Ordinary angles in radians, independent of the core's implementation. */
function angleAt(v, p, q) {
  const a = P(p.x - v.x, p.y - v.y), b = P(q.x - v.x, q.y - v.y);
  const c = (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

{
  const s = C.start();
  const g = C.compute(s);
  check("the start configuration is drawn", g.valid);
  check("the two add-on angles come out equal to 20 degrees",
    close(g.measures.BAE, 20, 1e-6) && close(g.measures.CDF, 20, 1e-6));
  check("A, E, F and D are cyclic at the start", g.claims.aefdCyclic);
  check("angle EAF = angle EDF at the start", g.claims.eafEqualsEdf);
  check("angle CAF = angle BDE at the start (about 11.6 degrees)",
    g.claims.cafEqualsBde && close(g.measures.CAF, 11.568, 0.01));
  check("angle BAC = angle BDC at the start (22.5 degrees)",
    g.claims.bacEqualsBdc && close(g.measures.BAC, 22.5, 1e-6));
  check("E is before B and F beyond C at the start",
    g.claims.eBeforeBBeforeCBeforeF && g.measures.tE < 0 && g.measures.tF > 1);
  check("the start's angles ADF and AEF add to 180 degrees",
    g.claims.supplementary && close(g.measures.ADFplusAEF, 180, 1e-3));
  check("the status describes the conclusion", /Angle CAF = angle BDE/.test(C.describe(s)));
  check("the status mentions the 180 degree order at the start", /180/.test(C.describe(s)));
}

{
  // The grid keeps A,B,C,D in cyclic order: C at 0, then B, A, D.
  let n = 0, badPremise = 0, badCircle = 0, badEAF = 0, badBAC = 0;
  let badCAF = 0, badMod = 0, badSum = 0, counted = 0;
  let badPremiseMod = 0, outsideFailures = 0;
  let straddles = 0, insideBoth = 0, negAngle = 0;
  for (let ib = 1; ib < 24; ib++) {
    for (let ia = ib + 1; ia < 24; ia++) {
      for (let id = ia + 1; id < 24; id++) {
        const s = C.start();
        s.angles = { C: 0, B: ib * Math.PI / 12, A: ia * Math.PI / 12, D: id * Math.PI / 12 };
        for (let deg = -45; deg <= 45; deg += 5) {
          const g = C.compute(C.setAngle(s, deg));
          if (!g.valid) continue;
          n++;
          const m = g.measures, cl = g.claims;
          if (!cl.premiseAnglesEqualModPi) badPremiseMod++;
          if (!cl.aefdCyclic) badCircle++;
          if (!cl.eafEqualsEdf) badEAF++;
          if (!cl.bacEqualsBdc) badBAC++;
          if (cl.eBeforeBBeforeCBeforeF) straddles++;
          if (m.tE > 0 && m.tE < 1 && m.tF > 0 && m.tF < 1) insideBoth++;
          if (deg < 0) negAngle++;
          // The page's premise puts B and C on the side EF of AEFD.  When E
          // and F are both outside BC on the same side that fails: ordinary
          // angles can then be supplementary instead of equal.
          if (cl.sameSideOutside) {
            if (!cl.premiseAnglesEqual || !cl.cafEqualsBde || !cl.cafEqualsBdeModPi) outsideFailures++;
          } else {
            if (!cl.premiseAnglesEqual) badPremise++;
            if (!cl.cafEqualsBde) badCAF++;
            if (!cl.cafEqualsBdeModPi) badMod++;
          }
          if (cl.eBeforeBBeforeCBeforeF && !cl.supplementary) badSum++;
        }
      }
    }
  }
  check(`the grid produced ${n} drawable configurations`, n > 20000, `n=${n}`);
  check(`all ${n} configurations construct the two add-on angles (mod 180)`, badPremiseMod === 0,
    `failures=${badPremiseMod}`);
  check(`F lies on the circle through A,D,E in all ${n} configurations`, badCircle === 0,
    `failures=${badCircle}`);
  check(`angle EAF = angle EDF in all ${n} configurations`, badEAF === 0,
    `failures=${badEAF}`);
  check(`angle BAC = angle BDC in all ${n} configurations`, badBAC === 0,
    `failures=${badBAC}`);
  check("the two add-on angles are equal in every configuration in the page's domain",
    badPremise === 0, `failures=${badPremise}`);
  check("angle CAF = angle BDE in every configuration in the page's domain",
    badCAF === 0, `failures=${badCAF}`);
  check("the directed conclusion also holds mod 180 in that domain",
    badMod === 0, `failures=${badMod}`);
  check("configurations where E and F are both outside BC show the page's caveat",
    outsideFailures > 100, `outsideFailures=${outsideFailures}`);
  check("the page's sum ADF + AEF = 180 holds in the E-B-C-F order",
    straddles > 10000 && badSum === 0, `straddles=${straddles}, failures=${badSum}`);
  check("the conclusion also holds with both E and F between B and C",
    insideBoth > 5000, `insideBoth=${insideBoth}`);
  check("the grid includes negative add-on angles", negAngle > 10000, `negAngle=${negAngle}`);
  counted = straddles + insideBoth;
  check("the two named orders cover a large part of the grid", counted > 15000);
}

{
  // The degenerate skip in ForcedCyclicQuadCanvas.Compute: Dist(B,C) < 1.
  const s = C.start();
  const tiny = Object.assign({}, s, {
    angles: Object.assign({}, s.angles, { C: s.angles.B + 0.001 }),
  });
  check("B and C closer than one pixel have no construction", !C.compute(tiny).valid);
  check("the reason names the two close points", /too close/.test(C.describe(tiny)));
  check("a missing angle list has no construction", !C.compute({}).valid);
  const flat = C.compute(Object.assign({}, s, { angle: 0 }));
  check("angle zero is allowed: E and F collapse onto B and C",
    flat.valid && closePoint(flat.E, C.points(s).B, 1e-6)
    && closePoint(flat.F, C.points(s).C, 1e-6));
  check("angle zero still puts E and F on the new circle", flat.claims.aefdCyclic);

  // A configuration where the page's premise fails must not be reported as
  // a proof of its conclusion in the status line.
  const smallArc = C.start();
  smallArc.angles = { C: 0, B: Math.PI / 12, A: Math.PI / 6, D: Math.PI / 4 };
  const odd = C.compute(C.setAngle(smallArc, 20));
  check("a small-arc configuration is drawable", odd.valid);
  check("that configuration is outside the page's stated domain",
    odd.claims.sameSideOutside && !odd.claims.cafEqualsBde);
  check("the status does not claim equality in that configuration",
    !/Angle CAF = angle BDE/.test(C.describe(C.setAngle(smallArc, 20)))
    && /Angle CAF is/.test(C.describe(C.setAngle(smallArc, 20))));
}

/* ---------------- 3. a second transcription of the applet's bytecode methods */

/*
 * GeoSDoub.Rotate(P,Q,alpha,dir), from its bytecode:
 *   x' = P.x + cos(alpha)*(Q.x-P.x) - dir*sin(alpha)*(Q.y-P.y)
 *   y' = P.y + dir*sin(alpha)*(Q.x-P.x) + cos(alpha)*(Q.y-P.y)
 */
function appletRotate(p, q, alpha, dir) {
  const c = Math.cos(alpha), s = Math.sin(alpha);
  return P(
    p.x + c * (q.x - p.x) - dir * s * (q.y - p.y),
    p.y + dir * s * (q.x - p.x) + c * (q.y - p.y),
  );
}

/* GeoSDoub.Intersect(P1,P2,P3,P4): a1*x+b1*y=c1 lines, |det|<1 -> NaN. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (a2 * c1 - a1 * c2) / det);
}

/* GeoSDoub.FindCircumcenter(P1,P2,P3): intersect two perpendicular bisectors. */
function appletCircumcenter(p1, p2, p3) {
  const m12 = P((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  const m23 = P((p2.x + p3.x) / 2, (p2.y + p3.y) / 2);
  return appletIntersect(
    m12, P(m12.x + p2.y - p1.y, m12.y - (p2.x - p1.x)),
    m23, P(m23.x + p3.y - p2.y, m23.y - (p3.x - p2.x)),
  );
}

/* Canvas.GetCircumcircle: centre plus the mean of the three radii. */
function appletCircumcircle(p1, p2, p3) {
  const o = appletCircumcenter(p1, p2, p3);
  return { c: o, r: (dist(o, p1) + dist(o, p2) + dist(o, p3)) / 3 };
}

/* Canvas.Compute(), verbatim: the Dist(B,C)<1 guard, two rotations, two
 * intersections with line BC and the circle through A,D,E. */
function appletCompute(A, B, Cc, D, angleDegrees) {
  if (dist(B, Cc) < 1) return null;
  const t = angleDegrees * Math.PI / 180;
  const a2 = appletRotate(A, B, t, -1);
  const d2 = appletRotate(D, Cc, t, 1);
  const E = appletIntersect(A, a2, B, Cc);
  const F = appletIntersect(D, d2, B, Cc);
  const circle = appletCircumcircle(A, D, E);
  return { a2, d2, E, F, circle };
}

function compareCoreWithApplet(label, state, core, applet) {
  const tol = TOL_POINT * Math.max(1, core.circle ? core.circle.r : 1);
  for (const key of ["a2", "d2", "E", "F"]) {
    const mine = key === "a2" ? core.A2 : key === "d2" ? core.D2 : core[key];
    if (!closePoint(mine, applet[key], tol)) {
      check(`${label}: ${key} matches the applet's Compute`, false,
        `applet ${JSON.stringify(applet[key])}, core ${JSON.stringify(mine)}`);
      return false;
    }
  }
  if (!closePoint(core.circle.c, applet.circle.c, tol)
      || !close(core.circle.r, applet.circle.r, tol)) {
    check(`${label}: the circumcircle matches the applet's GetCircumcircle`, false);
    return false;
  }
  return true;
}

{
  let compared = 0, mismatches = 0;
  const one = (label, s) => {
    const g = C.compute(s);
    const p = C.points(s);
    const ap = appletCompute(p.A, p.B, p.C, p.D, s.angle);
    if (!g.valid || !ap || !finitePoint(ap.E) || !finitePoint(ap.F)
        || !finitePoint(ap.circle.c)) return;
    if (!compareCoreWithApplet(label, s, g, ap)) mismatches++;
    compared++;
  };
  one("the start", C.start());
  for (let ib = 0; ib < 24; ib++) {
    for (let ia = 0; ia < 24; ia++) {
      for (let id = 0; id < 24; id += 4) {
        const s = C.start();
        s.angles = { C: 0, B: ib * Math.PI / 12, A: ia * Math.PI / 12, D: id * Math.PI / 12 };
        for (let deg = -45; deg <= 45; deg += 9) one(`grid ${ib},${ia},${id},${deg}`, C.setAngle(s, deg));
      }
    }
  }
  check(`core and applet agree on ${compared} configurations`, compared > 8000 && mismatches === 0,
    `compared=${compared}, mismatches=${mismatches}`);
  check("the applet's own start E is on the line BC",
    (() => {
      const p = C.points(C.start());
      const ap = appletCompute(p.A, p.B, p.C, p.D, 20);
      return close((ap.E.x - p.B.x) * (p.C.y - p.B.y)
        - (ap.E.y - p.B.y) * (p.C.x - p.B.x), 0, 1e-6);
    })());
  check("the applet's own start A2 is 20 degrees from AB",
    (() => {
      const p = C.points(C.start());
      const ap = appletCompute(p.A, p.B, p.C, p.D, 20);
      return close(angleAt(p.A, p.B, ap.a2), 20 * DEG, 1e-9);
    })());
}

/* --------------------------- 4. the page's tangent version of the same claim */

{
  // B,C coalesce: line BC is the tangent at T.  The core/applet skip a gap
  // below one pixel, so this is tested as the analytic limit, separately.
  let n = 0, bad = 0;
  for (let it = 0; it < 8; it++) {
    for (let ia = 4; ia < 12; ia++) {
      for (let id = ia + 3; id < 24; id++) {
        const tT = it * Math.PI / 4;
        const A = at(tT + ia * Math.PI / 12), D = at(tT + id * Math.PI / 12), T = at(tT);
        const radius = P(T.x - C.CENTER.x, T.y - C.CENTER.y);
        const Q = P(T.x - radius.y, T.y + radius.x); // tangent direction
        for (const deg of [-5, 5, 20, 40]) {
          const t = deg * DEG;
          const e = appletIntersect(A, appletRotate(A, T, t, -1), T, Q);
          const f = appletIntersect(D, appletRotate(D, T, t, 1), T, Q);
          if (!finitePoint(e) || !finitePoint(f)) continue;
          n++;
          if (!close(angleAt(A, T, f), angleAt(D, T, e), TOL_ANGLE)) bad++;
        }
      }
    }
  }
  check(`the tangent version holds on ${n} coalesced configurations`, n > 1000 && bad === 0,
    `n=${n}, failures=${bad}`);
  check("the tangent at T is perpendicular to the radius CT", (() => {
    const T = at(0), radius = P(T.x - C.CENTER.x, T.y - C.CENTER.y);
    const tangent = P(-radius.y, radius.x);
    return close(radius.x * tangent.x + radius.y * tangent.y, 0, 1e-9)
      && close(dist(T, C.CENTER), C.RADIUS, 1e-9);
  })());
}

done("forced-cyclic-quad");
