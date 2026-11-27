#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-of-similitude/circle-of-similitude-core.js.
 *
 *   node porting/check-circle-of-similitude.mjs
 *
 * 1. A second, independent transcription of the applet's bytecode —
 *    Inversion.Tangent, Tangents.GetExternalTangents / GetInternalTangents,
 *    GeoSDoub.Intersect and CircleOfSimilitudeCanvas.Compute — compared with
 *    the core's P, Q and circle of similitude over a grid of configurations.
 * 2. The article's claims over hundreds of generated, disjoint circles:
 *    P and Q are the tangent intersections, PQ is a diameter of CS, and at
 *    every sampled T on CS, d1/d2 = R1/R2 = t1/t2 with equal viewing angles.
 * 3. The illustration's edges: equal radii, overlapping circles, clamped
 *    handles, moves, options, reset, and a saveable position.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circle-of-similitude/circle-of-similitude-core.js", "CircleOfSimilitudeCore");
const EPS = 1e-8;
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a, b, tol = EPS) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearPoint = (p, q, tol = EPS) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);

/* ---------------------------------------- 1. the applet's own computation,
 * written a second time straight from javap. No core helper is used here. */

const pt = (x, y) => ({ x, y });
const plus = (p, q) => pt(p.x + q.x, p.y + q.y);
const minus = (p, q) => pt(p.x - q.x, p.y - q.y);
const times = (p, k) => pt(p.x * k, p.y * k);
const length = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* GeoSDoub.Intersect(DoubCircle, DoubCircle), reduced to the two points. */
function circleHits(a, b) {
  const dx = b.c.x - a.c.x, dy = b.c.y - a.c.y;
  const dd = Math.hypot(dx, dy);
  if (!(dd > 0) || dd > a.r + b.r + 1e-9 || dd < Math.abs(a.r - b.r) - 1e-9) return null;
  const t = (dd * dd + a.r * a.r - b.r * b.r) / (2 * dd);
  const h2 = a.r * a.r - t * t;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2);
  const ux = dx / dd, uy = dy / dd;
  return [pt(a.c.x + t * ux - h * uy, a.c.y + t * uy + h * ux),
          pt(a.c.x + t * ux + h * uy, a.c.y + t * uy - h * ux)];
}

/* Inversion.Tangent(circle, point): circle ∩ circle(point, sqrt(dist²-r²)),
 * then one DoubLine from the point to each intersection. */
function inversionTangent(circle, p) {
  const dd = length(p, circle.c);
  const t = dd * dd - circle.r * circle.r;
  if (t < 0) return null;
  const hits = circleHits(circle, { c: p, r: Math.sqrt(t) });
  return hits ? hits.map((h) => ({ m1: p, m2: h })) : null;
}

/* GeoSDoub.Intersect(DoubLine, DoubLine), from the four Cramer terms in
 * the bytecode: A=p1.y-p2.y, B=p2.x-p1.x, C=p1.x*p2.y-p1.y*p2.x. */
function lineIntersect(l1, l2) {
  const p1 = l1.m1, p2 = l1.m2, p3 = l2.m1, p4 = l2.m2;
  const A = p1.y - p2.y, B = p2.x - p1.x, CC = p1.x * p2.y - p1.y * p2.x;
  const D = p3.y - p4.y, E = p4.x - p3.x, F = p3.x * p4.y - p3.y * p4.x;
  const det = A * E - D * B;
  if (Math.abs(det) < 1e-12) return pt(NaN, NaN);
  return pt((B * F - E * CC) / det, (CC * D - F * A) / det);
}

function appletCompute(C1, R1, C2, R2) {
  const r1 = length(C1, R1), r2 = length(C2, R2);
  const result = { r1, r2, P: null, Q: null, cs: null };
  // Tangents.GetExternalTangents: shrink the larger circle to a point,
  // draw tangents to the auxiliary circle, then scale both contact points.
  const big = r1 > r2 ? { c: C1, r: r1 } : { c: C2, r: r2 };
  const small = r1 > r2 ? { c: C2, r: r2 } : { c: C1, r: r1 };
  const aux = { c: big.c, r: big.r - small.r };
  const eLines = inversionTangent(aux, small.c);
  if (eLines) {
    const scale = big.r / aux.r;
    const lines = eLines.map((l) => ({
      m1: plus(big.c, times(minus(l.m2, big.c), scale)),
      m2: plus(small.c, times(minus(l.m2, big.c), small.r / aux.r)),
    }));
    result.Q = lineIntersect(lines[0], lines[1]);
  }
  // Tangents.GetInternalTangents: auxiliary circle radius r1+r2.
  const auxI = { c: C1, r: r1 + r2 };
  const iLines = inversionTangent(auxI, C2);
  if (iLines) {
    const lines = iLines.map((l) => ({
      m1: plus(C1, times(minus(l.m2, C1), r1 / (r1 + r2))),
      m2: minus(C2, times(minus(l.m2, C1), r2 / (r1 + r2))),
    }));
    result.P = lineIntersect(lines[0], lines[1]);
  }
  // CircleOfSimilitudeCanvas.Compute: C.x is the mean of the two x's, and
  // B.x is C.x + |P.x-Q.x|/2. With level centres, B.y == C.y == C1.y, so
  // the radius is simply |P.x-Q.x|/2.
  if (result.P && result.Q && Number.isFinite(result.Q.x)) {
    const cx = (result.P.x + result.Q.x) / 2;
    result.cs = { c: pt(cx, C1.y), r: Math.abs(result.P.x - result.Q.x) / 2 };
  }
  return result;
}

{
  const centres = [pt(60, 70), pt(110, 150), pt(220, 60), pt(70, 230), pt(300, 240), pt(180, 200)];
  const targets = [pt(300, 70), pt(300, 150), pt(330, 60), pt(310, 230), pt(60, 240), pt(340, 200)];
  const radii = [[57, 20], [30, 45], [70, 30], [15, 40], [50, 25]];
  let cases = 0, worstP = 0, worstQ = 0, worstCentre = 0, worstRadius = 0;
  for (let i = 0; i < centres.length; i++) {
    for (const [r1, r2] of radii) {
      const C1 = centres[i], C2 = targets[i];
      const R1 = pt(C1.x - r1, C1.y), R2 = pt(C2.x + r2, C2.y);
      const ref = appletCompute(C1, R1, C2, R2);
      const s = Object.assign(C.start({}), { C1, R1, C2, R2 });
      const g = C.compute(s);
      if (!ref.P || !ref.Q || !g.valid || !g.Q) continue;
      cases++;
      check("core P matches the applet's internal-tangent intersection", nearPoint(g.P, ref.P));
      check("core Q matches the applet's external-tangent intersection", nearPoint(g.Q, ref.Q));
      check("core CS centre x matches Compute", near(g.cs.c.x, ref.cs.c.x));
      check("core CS radius matches Compute for level centres", near(g.cs.r, ref.cs.r));
      worstP = Math.max(worstP, d(g.P, ref.P));
      worstQ = Math.max(worstQ, d(g.Q, ref.Q));
      worstCentre = Math.max(worstCentre, Math.abs(g.cs.c.x - ref.cs.c.x));
      worstRadius = Math.max(worstRadius, Math.abs(g.cs.r - ref.cs.r));
    }
  }
  check("the grid covered enough configurations", cases >= 25, `${cases} cases`);
  check("no drift in P", worstP < EPS, `${worstP}`);
  check("no drift in Q", worstQ < EPS, `${worstQ}`);
  check("no drift in the CS centre", worstCentre < EPS, `${worstCentre}`);
  check("no drift in the CS radius", worstRadius < EPS, `${worstRadius}`);

  // The old applet kept C.y = C1.y even when the centres are not level.
  const C1 = pt(100, 90), C2 = pt(300, 210);
  const r1 = 40, r2 = 20;
  const s = Object.assign(C.start({}), { C1, C2,
    R1: pt(C1.x - r1, C1.y), R2: pt(C2.x + r2, C2.y) });
  const g = C.compute(s), ref = appletCompute(s.C1, s.R1, s.C2, s.R2);
  check("P and Q still match when the centres are not level",
    nearPoint(g.P, ref.P) && nearPoint(g.Q, ref.Q));
  check("the true CS midpoint keeps the applet's x", near(g.cs.c.x, ref.cs.c.x));
  check("the true midpoint differs from the applet's y, as documented",
    Math.abs(g.cs.c.y - ref.cs.c.y) > 1);
}

/* ------------------------------------------- 2. the article's claims */

{
  const rand = rng(20261126);
  let worstRatio = 0, worstTangent = 0, worstAngle = 0, worstPyth = 0;
  let worstDiameter = 0, worstHomothety = 0, sampled = 0, cases = 0;
  for (let i = 0; i < 220; i++) {
    const C1 = C.point(30 + rand() * 120, 30 + rand() * 240);
    const C2 = C.point(230 + rand() * 140, 30 + rand() * 240);
    const r1 = 12 + rand() * 40, r2 = 8 + rand() * 35;
    if (Math.abs(r1 - r2) < 3 || d(C1, C2) < r1 + r2 + 12) continue;
    const s = Object.assign(C.start({}), {
      C1, R1: C.point(C1.x - r1, C1.y),
      C2, R2: C.point(C2.x + r2, C2.y),
    });
    const g = C.compute(s);
    check("a generated configuration is valid", g.valid && !!g.cs);
    cases++;
    // P and Q lie on C1C2, divide it in the ratios -r2/r1 and +r2/r1,
    // and therefore are the ends of a diameter of CS.
    const cross = (g.P.x - C1.x) * (C2.y - C1.y) - (g.P.y - C1.y) * (C2.x - C1.x);
    const crossQ = (g.Q.x - C1.x) * (C2.y - C1.y) - (g.Q.y - C1.y) * (C2.x - C1.x);
    check("inner and outer centres lie on the line of centres",
      near(cross, 0, 1e-7) && near(crossQ, 0, 1e-7));
    const homothetyQ = d(C.add(g.Q, C.mul(C.sub(C1, g.Q), r2 / r1)), C2);
    const homothetyP = d(C.add(g.P, C.mul(C.sub(C1, g.P), -r2 / r1)), C2);
    worstHomothety = Math.max(worstHomothety, homothetyQ, homothetyP);
    worstDiameter = Math.max(worstDiameter,
      d(g.cs.c, C.midpoint(g.P, g.Q)), Math.abs(g.cs.r - d(g.P, g.Q) / 2));
    // The article's claim is about any T on CS. Walk all the way round it.
    for (let k = 0; k < 12; k++) {
      const ang = 2 * Math.PI * k / 12;
      const raw = C.point(g.cs.c.x + g.cs.r * Math.cos(ang), g.cs.c.y + g.cs.r * Math.sin(ang));
      const t = Object.assign({}, s, { T: C.restrict(s, raw) });
      const h = C.geometry(t);
      worstRatio = Math.max(worstRatio, Math.abs(h.measured - h.ratio));
      worstTangent = Math.max(worstTangent, Math.abs(h.tangentRatio - h.ratio));
      worstAngle = Math.max(worstAngle, Math.abs(h.angle1 - h.angle2));
      worstPyth = Math.max(worstPyth,
        Math.abs(h.d1 * h.d1 - h.t1 * h.t1 - h.r1 * h.r1),
        Math.abs(h.d2 * h.d2 - h.t2 * h.t2 - h.r2 * h.r2));
      sampled++;
    }
  }
  check("sampled enough points on enough circles", cases >= 150 && sampled > 1500,
    `${cases} circles, ${sampled} points`);
  check("d1/d2 = R1/R2 at every sampled point on CS", worstRatio < 1e-7, `${worstRatio}`);
  check("t1/t2 = R1/R2 at every sampled point on CS", worstTangent < 1e-7, `${worstTangent}`);
  check("the circles are seen under equal angles from T", worstAngle < 1e-8, `${worstAngle}`);
  check("d_i^2 = t_i^2 + R_i^2 at every sampled point", worstPyth < 1e-6, `${worstPyth}`);
  check("P and Q are the homotheties taking circle 1 to circle 2", worstHomothety < 1e-8, `${worstHomothety}`);
  check("PQ is a diameter of the circle of similitude", worstDiameter < EPS, `${worstDiameter}`);
}

/* Equal radii: the outer centre has run off to infinity and CS is the
 * perpendicular bisector. The theorem still holds there. */
{
  const C1 = C.point(100, 150), C2 = C.point(300, 110);
  const s = C.start({});
  const eq = Object.assign({}, s, { C1, C2,
    R1: C.point(C1.x - 40, C1.y), R2: C.point(C2.x + 40, C2.y) });
  const g = C.geometry(eq);
  const mid = C.midpoint(C1, C2), n = C.sub(C2, C1);
  check("equal radii have no outer centre and use a line", g.valid && !g.Q && !g.cs && !!g.line);
  check("equal radii put the inner centre midway between the centres", nearPoint(g.P, mid));
  let worst = 0;
  for (let k = 0; k < 12; k++) {
    const t = -1 + 2 * k / 11;
    const raw = C.point(mid.x - n.y * t, mid.y + n.x * t);
    const p = C.restrict(eq, raw);
    const h = C.geometry(Object.assign({}, eq, { T: p }));
    check("T stays on the perpendicular bisector",
      near((p.x - mid.x) * n.x + (p.y - mid.y) * n.y, 0, 1e-7));
    worst = Math.max(worst, Math.abs(h.measured - 1), Math.abs(h.tangentRatio - 1),
      Math.abs(h.angle1 - h.angle2));
  }
  check("the theorem holds on the equal-radii line", worst < 1e-7, `${worst}`);
}

/* ------------------------------------------- 3. moves, options and edges */

{
  const s0 = C.start({});
  const g0 = C.geometry(s0);
  check("the applet's starting radii are width/7 and width/20",
    near(g0.r1, 400 / 7) && near(g0.r2, 400 / 20));
  check("the first point T lies on CS", near(d(s0.T, g0.cs.c), g0.cs.r, 1e-7));
  check("a fresh picture is not a game and never ends", C.result(s0) === null);
  check("the start position is a plain, saveable object",
    JSON.stringify(s0).includes("C1") && JSON.stringify(s0).includes("options"));

  const movedT = C.move(s0, "T", C.point(s0.T.x + 37, s0.T.y + 21));
  check("dragging T keeps it on CS", near(d(movedT.T, C.compute(movedT).cs.c), C.compute(movedT).cs.r, 1e-7));
  const movedC1 = C.move(s0, "C1", C.point(120, 170));
  check("moving a centre reprojects T onto the new CS",
    near(d(movedC1.T, C.compute(movedC1).cs.c), C.compute(movedC1).cs.r, 1e-7));
  const movedR1 = C.move(s0, "R1", C.point(s0.C1.x - 70, s0.C1.y));
  check("moving a radius handle changes R1 and reprojects T",
    near(C.compute(movedR1).r1, 70) && near(d(movedR1.T, C.compute(movedR1).cs.c), C.compute(movedR1).cs.r, 1e-7));
  check("unknown handles are refused", C.move(s0, "X", C.point(1, 1)) === s0);
  check("handles stay inside the board",
    C.clamp(C.point(-10, 999)).x === C.PAD && C.clamp(C.point(-10, 999)).y === C.VIEW.height - C.PAD);

  const overlap = Object.assign({}, s0, { C2: C.point(150, 150) });
  check("overlapping circles have no construction", C.compute(overlap).valid === false);
  const zero = Object.assign({}, s0, { R1: C.point(100, 150) });
  check("a zero radius has no construction", C.compute(zero).valid === false);

  const named = C.setOption(s0, "names", false);
  const hinted = C.setOption(named, "hint", true);
  check("both applet checkboxes switch", named.options.names === false && hinted.options.hint === true);
  check("an unknown option is refused", C.setOption(s0, "extra", true) === s0);
  check("Reset keeps the options but restores the starting picture",
    nearPoint(C.reset(hinted).C1, s0.C1) && nearPoint(C.reset(hinted).R2, s0.R2)
      && C.reset(hinted).options.hint === true);
  check("touching anything marks the picture explored", movedT.explored && hinted.explored);
  check("the status describes the three equal ratios",
    /d1\/d2/.test(C.describe(s0)) && /t1\/t2/.test(C.describe(s0))
      && /R1\/R2/.test(C.describe(s0)));
  check("the status explains an invalid configuration", /apart/.test(C.describe(overlap)));
}

done("circle-of-similitude");
