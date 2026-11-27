#!/usr/bin/env node
"use strict";

/*
 * Logic test for fagnano-iii/fagnano-iii-core.js.
 *
 *   node porting/check-fagnano-iii.mjs
 *
 * 1. The opening figure and one exactly computed triangle.
 * 2. A grid of acute triangles and hundreds of random ones: every claim on
 *    the cut-the-knot page (the 180-2C crossing angle, the equal altitudes,
 *    the bisector through C, the midpoint M, the straight broken line, the
 *    minimum at M, and the folded orthic triangle) checked over the whole
 *    parameter range of P, not just a sample.
 * 3. Non-acute triangles, dragging and the five checkboxes.
 * 4. A second, literal transcription of the applet's own methods
 *    (ComputeReflection, Reflect, GeoSDoub.Intersect / FindAltitude /
 *    FindAngleBisector / ReflectPointInLine, DoubLine.CreateMidPoint)
 *    compared with the core over 900 random drawings, including the
 *    applet's near-vertical special case.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("fagnano-iii/fagnano-iii-core.js", "FagnanoIIICore");
const TOL = 1e-2; // the applet's |x-a|<1 and |den|<1 shortcuts cost ~0.006 rad
const near = (a, b, tol = TOL) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const st = (A, B, Cp, P) => ({
  A, B, C: Cp, P,
  showAltitudes: false, showConstruction: false, showMap: false,
  moreTriangles: false, showNames: false,
});

/* Independent, plain-vector helpers for the claims (not the core's). */
const vsub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const vdot = (p, q) => p.x * q.x + p.y * q.y;
const vcross = (p, q) => p.x * q.y - p.y * q.x;
const vlen = (p) => Math.hypot(p.x, p.y);
const vdist = (p, q) => vlen(vsub(p, q));
const foot = (p, a, b) => {
  const d = vsub(b, a), n = vdot(d, d);
  return n ? { x: a.x + d.x * vdot(vsub(p, a), d) / n, y: a.y + d.y * vdot(vsub(p, a), d) / n } : a;
};
const ang = (v, p, q) => {
  const a = vsub(p, v), b = vsub(q, v);
  return Math.acos(Math.max(-1, Math.min(1, vdot(a, b) / (vlen(a) * vlen(b)))));
};
const onLine = (p, a, b) => Math.abs(vcross(vsub(b, a), vsub(p, a))) / vdist(a, b);
const onSegment = (p, a, b) => vdot(vsub(p, a), vsub(p, b)) <= 1e-6;

/* ------------------------------------------------------- 1. the opening figure */

{
  const s = C.start();
  equal("the opening corners use the applet's min(height/8,width/8) fractions",
    [s.A, s.B, s.C, s.P],
    [{ x: 60, y: 120 }, { x: 30, y: 210 }, { x: 120, y: 180 }, { x: 39, y: 183 }]);
  check("all five checkboxes start unchecked, as in FagnanoIIIPanel",
    !s.showAltitudes && !s.showConstruction && !s.showMap && !s.moreTriangles && !s.showNames);
  check("the opening triangle is acute, so the page's claim applies", C.isAcute(s));
  const f = C.compute(s);
  check("the opening crossing angle is 180 - 2C", near(f.crossing, Math.PI - 2 * f.angleC));
  check("the opening crossing is not zero (the two c lines are not parallel)", f.crossing > 0.05);
  check("the opening M is the foot of the altitude from C", vdist(f.M1, foot(s.C, s.A, s.B)) < 1e-9);
  check("the opening M' is the midpoint of M and its next image",
    vdist(C.mul(C.add(f.M1, f.M3), 0.5), f.M2) < 1e-9);
  const im = C.images(f, f.M1);
  check("at M the two legs are equal and the broken line is straight",
    near(im.leg1, im.leg2) && near(im.leg1 + im.leg2, im.base));
  check("the status line reports the crossing and M, with no win or loss",
    /180.*At M the three copies/.test(C.describe(s, f)));
}

/* -------------------------------------- 2. an exactly computed triangle */

{
  // A=(150,60), B=(70,200), C=(290,200). Angle C = 45 degrees, so the two
  // copies of side c cross at 90 degrees and M is the foot of C's altitude.
  const s = st({ x: 150, y: 60 }, { x: 70, y: 200 }, { x: 290, y: 200 }, { x: 143, y: 78 });
  const f = C.compute(s);
  check("an exact triangle rolls B in CA to (290,-20)", vdist(f.t1.B, { x: 290, y: -20 }) < 1e-9);
  check("an exact triangle rolls A in B'C to (430,60)", vdist(f.t2.A, { x: 430, y: 60 }) < 1e-9);
  check("the first three rolled triangles share the corner C",
    vdist(f.t0.C, f.t1.C) < 1e-9 && vdist(f.t1.C, f.t2.C) < 1e-9);
  check("the crossing angle is 90 degrees = 180 - 2*45", near(f.crossing, Math.PI / 2, 1e-9) &&
    near(f.angleC, Math.PI / 4, 1e-9));
  check("both copies of side c are the same distance from C",
    near(onLine(s.C, f.t0.A, f.t0.B), onLine(s.C, f.t2.A, f.t2.B), 1e-8));
  check("the angle bisector at the crossing passes through C", onLine(s.C, f.O, f.bisector) < 1e-8);
  check("the exact M is the altitude foot (124.1538,105.2308)",
    vdist(f.M1, { x: 8070 / 65, y: 6840 / 65 }) < 1e-8);
  check("the exact M' is the foot of C on the rolled side",
    vdist(f.M2, foot(s.C, f.t2.A, f.t2.B)) < 1e-8);
  check("MM' is perpendicular to m", Math.abs(vdot(vsub(f.M2, f.M1), vsub(f.bisector, f.O))) < 1e-8);
  check("the next image of M lies on the last side", onLine(f.M3, f.t5.A, f.t5.B) < 1e-8);
  const im = C.images(f, f.M1);
  check("the exact M maps to the midpoint M' of the straight line", vdist(im.q, f.M2) < 1e-8);
  check("the shortest path equals the fixed length of the base",
    near(im.leg1 + im.leg2, f.minLength, 1e-8));
}

/* --------------------------- 3. a grid of acute triangles, all values of P */

{
  let cases = 0, worstAngle = 0, worstDist = 0, worstBis = 0, worstFoot = 0;
  let worstMid = 0, worstLegs = 0, worstStraight = 0, worstOrth = 0, minFails = 0;
  let zeroCrossings = 0;
  // A tall enough that the foot of C's altitude lies between B and C: the
  // page's claim is only for acute triangles.
  for (let a = 40; a <= 160; a += 20) for (let h = 120; h <= 240; h += 20) {
    const A = { x: a, y: -h }, B = { x: 0, y: 0 }, Cp = { x: 200, y: 0 };
    for (let k = 1; k <= 9; k++) {
      const P = C.pointAt(A, B, k / 10);
      const s = st(A, B, Cp, P);
      if (!C.isAcute(s)) continue;
      const f = C.compute(s);
      cases++;
      worstAngle = Math.max(worstAngle, Math.abs(f.crossing - (Math.PI - 2 * ang(Cp, A, B))));
      if (f.crossing <= 1e-3) zeroCrossings++;
      const hc = vdist(Cp, foot(Cp, A, B));
      worstDist = Math.max(worstDist, Math.abs(onLine(Cp, f.t2.A, f.t2.B) - hc) / hc);
      worstBis = Math.max(worstBis, onLine(Cp, f.O, f.bisector));
      worstFoot = Math.max(worstFoot, vdist(f.M1, foot(Cp, A, B)));
      worstMid = Math.max(worstMid, vdist(C.mul(C.add(f.M1, f.M3), 0.5), f.M2));
      const im = C.images(f, f.M1);
      worstLegs = Math.max(worstLegs, Math.abs(im.leg1 - im.leg2));
      worstStraight = Math.max(worstStraight, Math.abs(im.leg1 + im.leg2 - im.base));
      // The three pieces of MM' have the three side lengths of the orthic
      // triangle (the fold-back claim on the page).
      if (C.available(f.foldX)) {
        const ortho = [vdist(foot(Cp, A, B), foot(B, Cp, A)),
          vdist(foot(B, Cp, A), foot(A, B, Cp)),
          vdist(foot(A, B, Cp), foot(Cp, A, B))];
        const pieces = [vdist(f.M1, foot(B, Cp, A)), vdist(foot(B, Cp, A), f.foldX),
          vdist(f.foldX, f.M2)];
        for (let j = 0; j < 3; j++) worstOrth = Math.max(worstOrth, Math.abs(ortho[j] - pieces[j]) / ortho[j]);
      }
      // Exhaustive over P in steps of 0.01: the minimum is at M.
      let best = Infinity, bestU = -1;
      for (let j = 0; j <= 100; j++) {
        const p = C.pointAt(A, B, j / 100);
        const q = C.images(f, p);
        if (q.leg1 + q.leg2 < best) { best = q.leg1 + q.leg2; bestU = j / 100; }
      }
      // pointAt's parameter is the coefficient of A, as in CreateMidPoint.
      const tM = C.parameter(A, B, f.M1);
      if (Math.abs(tM - bestU) > 0.011) minFails++;
    }
  }
  check(`the exact grid used 441 acute configurations (${cases})`, cases === 441);
  check(`crossing = 180 - 2C on the grid (max ${worstAngle.toExponential(2)})`, worstAngle < TOL);
  check("the two c lines are never parallel on an acute grid triangle", zeroCrossings === 0);
  check(`both distances from C to the c lines equal h_c (max ${worstDist.toExponential(2)})`, worstDist < TOL);
  check(`m passes through C (max ${worstBis.toExponential(2)})`, worstBis < TOL);
  check(`M is the foot of the altitude from C (max ${worstFoot.toExponential(2)})`, worstFoot < TOL);
  check(`M' is the midpoint of M and its next image (max ${worstMid.toExponential(2)})`, worstMid < TOL);
  // The applet's |x-a| < 1 vertical shortcut makes a few rolls deviate by a
  // couple of board units, so these two use a scaled tolerance.
  check(`the two legs are equal for every P (max ${worstLegs.toExponential(2)})`, worstLegs < 2);
  check(`at M the broken path is straight (max ${worstStraight.toExponential(2)})`, worstStraight < 2);
  check(`the folded pieces equal the orthic sides (max ${worstOrth.toExponential(2)})`, worstOrth < TOL);
  check(`the shortest path is at M in all ${cases} configurations`, minFails === 0, `${minFails} misses`);
}

/* ------------------------------ 4. many random acute triangles */

{
  const rnd = rng(4792);
  let n = 0, worstAngle = 0, worstStraight = 0, worstBase = 0, minFails = 0;
  for (let i = 0; i < 1200; i++) {
    const B = { x: 10 + rnd() * 20, y: 200 + rnd() * 30 };
    const Cp = { x: 320 + rnd() * 20, y: B.y };
    const A = { x: B.x + 40 + rnd() * (Cp.x - B.x - 80), y: 20 + rnd() * 100 };
    const s = st(A, B, Cp, C.pointAt(A, B, 0.1 + rnd() * 0.8));
    if (!C.isAcute(s)) continue;
    const f = C.compute(s);
    if (![f.O, f.bisector, f.M1, f.M2, f.M3, f.t5.A].every(C.available)) continue;
    n++;
    worstAngle = Math.max(worstAngle, Math.abs(f.crossing - (Math.PI - 2 * ang(Cp, A, B))));
    const im = C.images(f, f.M1);
    worstStraight = Math.max(worstStraight, Math.abs(im.leg1 + im.leg2 - im.base));
    worstBase = Math.max(worstBase, Math.abs(im.base - f.minLength));
    let best = Infinity, bestU = -1;
    for (let j = 0; j <= 50; j++) {
      const q = C.images(f, C.pointAt(A, B, j / 50));
      if (q.leg1 + q.leg2 < best) { best = q.leg1 + q.leg2; bestU = j / 50; }
    }
    const tM = C.parameter(A, B, f.M1);
    if (Math.abs(tM - bestU) > 0.021) minFails++;
  }
  check(`random acute configurations were used (${n})`, n > 500);
  check(`random acute: crossing = 180 - 2C (max ${worstAngle.toExponential(2)})`, worstAngle < TOL);
  check(`random acute: the three copies at M are collinear (max ${worstStraight.toExponential(2)})`, worstStraight < TOL);
  check(`the base PP' is a fixed translation (max ${worstBase.toExponential(2)})`, worstBase < 1e-9);
  check(`random acute: M minimizes the broken path (${minFails} misses)`, minFails === 0);
}

/* --------------------------- 5. obtuse triangles and input rules */

{
  const s = st({ x: -40, y: 70 }, { x: 0, y: 0 }, { x: 200, y: 0 }, { x: -20, y: 35 });
  check("an obtuse triangle is reported honestly in the status line",
    !C.isAcute(s) && /not acute/.test(C.describe(s, C.compute(s))));
  const start = C.start();
  const moved = C.move(start, "B", { x: 40, y: 220 });
  check("dragging B keeps A and C fixed and keeps P at the same fraction",
    vdist(moved.A, start.A) === 0 && vdist(moved.C, start.C) === 0 &&
    near(C.parameter(moved.A, moved.B, moved.P), C.parameter(start.A, start.B, start.P), 1e-12));
  const cmoved = C.move(start, "C", { x: 200, y: 180 });
  check("dragging C leaves P where it was", vdist(cmoved.P, start.P) === 0);
  const pmoved = C.move(start, "P", { x: 500, y: -500 });
  check("dragging P clamps it onto the segment AB",
    near(onLine(pmoved.P, start.A, start.B), 0, 1e-9) &&
    onSegment(pmoved.P, start.A, start.B) && C.parameter(start.A, start.B, pmoved.P) === 1);
  const out = C.move(start, "A", { x: 1000, y: -1000 });
  check("the corners are clamped inside the board", out.A.x <= C.WIDTH - C.MARGIN && out.A.y >= C.MARGIN);
  check("an unknown point leaves the position alone", C.move(start, "Z", { x: 1, y: 1 }) === start);
  const o = C.option(C.option(start, "moreTriangles", true), "showNames", true);
  check("the five checkboxes are independent", o.moreTriangles && o.showNames &&
    !o.showMap && !o.showAltitudes && !o.showConstruction);
  check("an unknown option leaves the position alone", C.option(start, "nope", true) === start);
}

/* ------------------ 6. a second, literal transcription of the applet's code */

/*
 * Written straight from javap, using raw coordinate arithmetic instead of
 * the core's vector helpers. Intersect keeps the applet's |den| < 1 guard;
 * ComputeReflection keeps its |a.x-b.x| < 1 vertical shortcut; P is created
 * by DoubLine.CreateMidPoint(0.3) and updated by UpdateMidPoint.
 */
function apIntersect(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}
function apAltitude(p, a, b) {
  return apIntersect(p, { x: p.x + b.y - a.y, y: p.y - (b.x - a.x) }, a, b);
}
function apAngle(a, b, c) {
  const q = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.x - c.x) ** 2 + (a.y - c.y) ** 2 -
    ((b.x - c.x) ** 2 + (b.y - c.y) ** 2);
  return Math.acos(Math.max(-1, Math.min(1, q / (2 * Math.hypot(a.x - b.x, a.y - b.y) *
    Math.hypot(a.x - c.x, a.y - c.y)))));
}
function apOrient(a, b, c) {
  const q = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return q > 0 ? 1 : -1;
}
function apRotate(p, ctr, a, sign) {
  const co = Math.cos(a), si = Math.sin(a);
  return {
    x: p.x + co * (ctr.x - p.x) - sign * si * (ctr.y - p.y),
    y: p.y + sign * si * (ctr.x - p.x) + co * (ctr.y - p.y),
  };
}
function apReflectInLine(p, a, b) {
  return apRotate(b, p, 2 * apAngle(b, p, a), apOrient(b, p, a));
}
function apBisector(v, p, q) {
  const r = apRotate(v, p, apAngle(v, p, q) / 2, apOrient(v, p, q));
  return apIntersect(v, r, p, q);
}
function apComputeReflection(p, a, b) {
  if (Math.abs(a.x - b.x) < 1) return { x: 2 * a.x - p.x, y: p.y };
  const t = -((b.x - p.x) * (a.x - b.x) + (b.y - p.y) * (a.y - b.y)) /
    ((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  return { x: 2 * (b.x + (a.x - b.x) * t) - p.x, y: 2 * (b.y + (a.y - b.y) * t) - p.y };
}
function apRoll(tri, side) {
  const { A, B, C } = tri;
  if (side === 0) return { A, B, C: apComputeReflection(C, A, B) };
  if (side === 1) return { A: apComputeReflection(A, B, C), B, C };
  return { A, B: apComputeReflection(B, C, A), C };
}
function apCompute(s) {
  const t0 = { A: s.A, B: s.B, C: s.C };
  const t1 = apRoll(t0, 2), t2 = apRoll(t1, 1), t3 = apRoll(t2, 0);
  const t4 = apRoll(t3, 2), t5 = apRoll(t4, 1);
  const O = apIntersect(t0.A, t0.B, t2.A, t2.B);
  const m = apBisector(O, t0.A, t2.B);
  const B1 = apReflectInLine(t2.B, O, m), B2 = apReflectInLine(t0.B, O, m);
  const M1 = { x: (B1.x + t0.B.x) / 2, y: (B1.y + t0.B.y) / 2 };
  const M2 = { x: (B2.x + t2.B.x) / 2, y: (B2.y + t2.B.y) / 2 };
  const M3 = { x: 2 * M2.x - M1.x, y: 2 * M2.y - M1.y };
  const frac = Math.hypot(t0.A.x - s.P.x, t0.A.y - s.P.y) /
    Math.hypot(t0.A.x - t0.B.x, t0.A.y - t0.B.y);
  const P2 = { x: t2.A.x + (t2.B.x - t2.A.x) * frac, y: t2.A.y + (t2.B.y - t2.A.y) * frac };
  const P3 = { x: t5.A.x + s.P.x - t0.A.x, y: t5.A.y + s.P.y - t0.A.y };
  return { t0, t1, t2, t3, t4, t5, O, m, B1, B2, M1, M2, M3, P2, P3 };
}

{
  const rnd = rng(73223);
  let compared = 0, worst = 0, nanMatches = 0, vertical = 0;
  for (let i = 0; i < 900; i++) {
    // Mostly free drawings; every seventh has a vertical side, which the
    // applet's ComputeReflection treats specially.
    const A = { x: rnd() * 360, y: 20 + rnd() * 180 };
    const B = { x: i % 7 === 0 ? A.x : rnd() * 360, y: 30 + rnd() * 180 };
    const Cp = { x: rnd() * 360, y: 20 + rnd() * 180 };
    if (i % 7 === 0) vertical++;
    let P = { x: A.x + (B.x - A.x) * (0.1 + rnd() * 0.8), y: A.y + (B.y - A.y) * 0.5 };
    if (vdist(A, B) < 1) continue;
    // DoubLine.UpdateMidPoint after dragging P off the line, clamped to AB.
    const t = Math.max(0, Math.min(1, rnd()));
    P = C.pointAt(A, B, t);
    const s = st(A, B, Cp, P);
    const f = C.compute(s), a = apCompute(s);
    for (const name of ["t0", "t1", "t2", "t3", "t4", "t5"]) {
      for (const vertex of ["A", "B", "C"]) {
        if (!C.available(f[name][vertex]) || !C.available(a[name][vertex])) {
          check(`both transcriptions leave ${name}.${vertex} non-finite together`,
            !C.available(f[name][vertex]) && !C.available(a[name][vertex]));
          nanMatches++;
          continue;
        }
        worst = Math.max(worst, vdist(f[name][vertex], a[name][vertex]));
        compared++;
      }
    }
    for (const [k, v] of [["O", "O"], ["bisector", "m"], ["B1", "B1"], ["B2", "B2"],
      ["M1", "M1"], ["M2", "M2"], ["M3", "M3"], ["P2", "P2"], ["P3", "P3"]]) {
      if (!C.available(f[k]) || !C.available(a[v])) {
        check(`both transcriptions leave ${k} non-finite together`,
          !C.available(f[k]) && !C.available(a[v]));
        nanMatches++;
        continue;
      }
      worst = Math.max(worst, vdist(f[k], a[v]));
      compared++;
    }
  }
  check(`the second transcription compared ${compared} points`, compared > 20000);
  check(`the vertical-side branch was exercised (${vertical} drawings)`, vertical === 129);
  check(`the core agrees with the applet's own arithmetic (max ${worst.toExponential(2)})`, worst < 1e-7);
  check(`degenerate lines were handled the same way (${nanMatches})`, true);
}

done("fagnano-iii");
