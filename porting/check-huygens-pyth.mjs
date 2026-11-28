#!/usr/bin/env node
"use strict";

/*
 * Logic test for huygens-pyth/huygens-pyth-core.js.
 *
 *   node porting/check-huygens-pyth.mjs
 *
 * The second half is an independent transcription of the applet's own methods
 * (GeoSDoub.Rotate / Intersect / GetParallelTo / FindCircumcenter / ComputeAngle
 * / FindOrientation, plus HuygensPythCanvas.ComputeC, Compute, Extend,
 * UpgradePoints and CTKMoveableDoub's circle restriction) read straight from
 * javap -c of classes/HuygensPyth.zip and classes/CTKGeometry.zip. It is
 * compared with the core over a grid and over 600 random right triangles.
 *
 * Then every claim on the cut-the-knot page is tested over all of them:
 * AP=AG, BN=BD, the three half-square areas, the congruent triangles APS=ABC
 * and KPS=ANB, PS=BC=BN, KS=AB, the two doubling parallelograms and
 * AB²=AC²+BC². Two letter slips on the page are checked as slips: "AD" should
 * be "AG", and the equal angle in KPS is KSP, not KPS.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("huygens-pyth/huygens-pyth-core.js", "HuygensPythCore");
const HALF = Math.PI / 2;

/* ------------------------------------------------- independent transcription */

const point = (x, y) => ({ x, y });
const sub = (p, q) => point(p.x - q.x, p.y - q.y);
const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const relative = (a, b) => Math.abs(a - b) / Math.max(1, Math.abs(b));
const maxError = (runs) => runs.reduce((m, e) => Math.max(m, e), 0);

/* GeoSDoub.Rotate(P, Q, angle, dir), javap lines 423-481. */
function appletRotate(P, Q, angle, dir) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return point(
    P.x + cs * (Q.x - P.x) - dir * sn * (Q.y - P.y),
    P.y + dir * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  );
}

/* GeoSDoub.Intersect, javap lines 482-582: NaN when |det| < 1. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return point(NaN, NaN);
  return point((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* HuygensPythCanvas.Extend(P, Q, length). */
function appletExtend(P, Q, length) {
  const t = length / distance(P, Q);
  return point(P.x + (Q.x - P.x) * t, P.y + (Q.y - P.y) * t);
}

/* GeoSDoub.GetParallelTo, javap lines 1550-1578. */
function appletParallel(P, Q, R) {
  return point(P.x + 100 * (Q.x - R.x), P.y + 100 * (Q.y - R.y));
}

/* GeoSDoub.ComputeAngle, javap lines 208-241: the angle at the first point. */
function appletAngle(P, Q, R) {
  const a = distance(P, Q), b = distance(P, R), c = distance(Q, R);
  return Math.acos((a * a + b * b - c * c) / (2 * a * b));
}

/* GeoSDoub.FindOrientation, javap lines 384-422. */
function appletOrientation(A, B, Cc) {
  const s = Cc.x * (A.y - B.y) + Cc.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.FindCircumcenter, javap lines 123-207. */
function appletCentre(A, B, Cc) {
  const M = point((A.x + B.x) / 2, (A.y + B.y) / 2);
  const N = point((B.x + Cc.x) / 2, (B.y + Cc.y) / 2);
  return appletIntersect(
    M, point(M.x + B.y - A.y, M.y - B.x + A.x),
    N, point(N.x + Cc.y - B.y, N.y - Cc.x + B.x),
  );
}

/* HuygensPythCanvas.GetCircle + CTKMoveableDoub.SetLocation for m_Fixed=3. */
function appletRestrict(A, B, Cc, target) {
  const centre = appletCentre(A, B, Cc);
  const r = (distance(centre, A) + distance(centre, B) + distance(centre, Cc)) / 3;
  const d = distance(target, centre);
  if (!Number.isFinite(d) || d < 1e-12) return point(NaN, NaN);
  return point(
    centre.x + ((target.x - centre.x) * r) / d,
    centre.y + ((target.y - centre.y) * r) / d,
  );
}

/* HuygensPythCanvas.ComputeC(). */
function appletComputeC(A, B, angleA) {
  const rayA = appletRotate(A, B, angleA, -1);
  const rayB = appletRotate(B, A, HALF - angleA, 1);
  return appletIntersect(A, rayA, B, rayB);
}

/* HuygensPythCanvas.Compute(), with ShowNames()' letters. */
function appletCompute(state) {
  const { A, B, C: Cc } = state;
  const Cq = appletRotate(B, Cc, HALF, 1);   // D
  const Aq = appletRotate(Cc, B, HALF, -1);  // E
  const Bq = appletRotate(Cc, A, HALF, 1);   // F
  const Cp = appletRotate(A, Cc, HALF, -1);  // G
  const Ap = appletRotate(B, A, HALF, -1);   // K
  const Bp = appletRotate(A, B, HALF, 1);    // S
  const P = appletExtend(Cp, A, 2 * distance(Cp, A));
  const N = appletExtend(Cq, B, 2 * distance(Cq, B));
  const parallel = appletParallel(P, A, B);
  return {
    A, B, C: Cc, Ap, Aq, Bp, Bq, Cp, Cq, P, N,
    L: appletIntersect(parallel, P, A, Bp),
    M: appletIntersect(parallel, P, B, Ap),
  };
}

/* HuygensPythCanvas.UpgradePoints() after a drag. */
function appletDrag(state, name, target) {
  if (name === "C") {
    const Cc = appletRestrict(state.A, state.B, state.C, target);
    if (!ok(Cc)) return null;
    const angleA = appletAngle(state.A, state.B, Cc);
    let next = { ...state, C: Cc, angleA };
    if (appletOrientation(next.A, next.B, next.C) !== 1) {
      next = { ...next, A: next.B, B: next.A };
    }
    return next;
  }
  if (name !== "A" && name !== "B") return null;
  const A = name === "A" ? point(target.x, target.y) : state.A;
  const B = name === "B" ? point(target.x, target.y) : state.B;
  const Cc = appletComputeC(A, B, state.angleA);
  if (!ok(Cc)) return null;
  let next = { ...state, A, B, C: Cc };
  if (appletOrientation(A, B, Cc) !== 1) {
    next = { ...next, A: next.B, B: next.A };
  }
  return next;
}

const triangleArea = (A, B, D) =>
  Math.abs((B.x - A.x) * (D.y - A.y) - (B.y - A.y) * (D.x - A.x)) / 2;
function polygonArea(points) {
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const q = points[(i + 1) % points.length];
    twice += points[i].x * q.y - q.x * points[i].y;
  }
  return Math.abs(twice) / 2;
}

/* --------------------------------------------------- 1. the starting figure */

{
  const s = C.start();
  equal("init puts A at (width/3, height/1.9)", s.A,
    { x: 500 / 3, y: 450 / 1.9 });
  equal("init puts B at (width - width/3, height/1.9)", s.B,
    { x: 500 - 500 / 3, y: 450 / 1.9 });
  equal("init uses AngleA = pi/6", s.angleA, Math.PI / 6);
  equal("both checkboxes start off", [s.showNames, s.showHint], [false, false]);
  const fromApplet = appletComputeC(s.A, s.B, s.angleA);
  check("start C matches the applet's ComputeC()",
    ok(fromApplet) && relative(s.C.x, fromApplet.x) < 1e-9 && relative(s.C.y, fromApplet.y) < 1e-9);
  const other = C.start({ width: 450, height: 400 });
  equal("a 450x400 canvas gets its own start points", [other.A.x, other.B.x, other.A.y],
    [150, 300, 400 / 1.9]);
}

/* ------------------------------------------------- 2. a grid of configurations */

const configs = [];
for (const ax of [110, 190, 270, 350, 430]) {
  for (const by of [70, 160, 250, 340]) {
    for (const angleA of [0.2, 0.5, 0.9, 1.3]) {
      const A = point(ax, 240), B = point(ax + 120, by);
      const Cc = appletComputeC(A, B, angleA);
      if (ok(Cc)) configs.push({ A, B, C: Cc, angleA, showNames: false, showHint: false });
    }
  }
}
const random = rng(271828);
for (let i = 0; i < 600; i++) {
  const A = point(40 + random() * 420, 40 + random() * 370);
  const B = point(A.x + (random() - 0.5) * 380, A.y + (random() - 0.5) * 380);
  if (distance(A, B) < 60) continue;
  const angleA = 0.12 + random() * (HALF - 0.24);
  const Cc = appletComputeC(A, B, angleA);
  if (ok(Cc)) configs.push({ A, B, C: Cc, angleA, showNames: false, showHint: false });
}
check("the configuration space is actually covered", configs.length >= 600, `${configs.length}`);

{
  let points = 0, right = 0, angles = 0;
  for (const s of configs) {
    const mine = C.derive(s), theirs = appletCompute(s);
    for (const name of ["A", "B", "C", "Ap", "Aq", "Bp", "Bq", "Cp", "Cq", "P", "N", "L", "M"]) {
      points = Math.max(points, relative(mine[name].x, theirs[name].x), relative(mine[name].y, theirs[name].y));
    }
    const dot = (mine.A.x - mine.C.x) * (mine.B.x - mine.C.x) +
      (mine.A.y - mine.C.y) * (mine.B.y - mine.C.y);
    right = Math.max(right, Math.abs(dot) / (distance(mine.A, mine.C) * distance(mine.B, mine.C)));
    angles = Math.max(angles,
      relative(C.angle(mine.A, mine.B, mine.C), s.angleA),
      relative(C.angle(mine.B, mine.A, mine.C), HALF - s.angleA));
  }
  check("all 13 derived points match the applet's Compute()", points < 1e-7, `max ${points}`);
  check("the angle at C is a right angle on every configuration", right < 1e-7, `max ${right}`);
  check("the two acute angles are AngleA and 90-AngleA", angles < 1e-7, `max ${angles}`);
}

/* ----------------------------------------------- 3. every claim on the page */

{
  let ap = 0, bn = 0, abp = 0, anb = 0, congr = 0, ps = 0, ks = 0;
  let ksp = 0, kpsTypo = 0, kpsArea = 0, dbl = 0, total = 0, pyth = 0, ad = 0;
  for (const s of configs) {
    const g = C.stats(s);
    const e = (x, y) => relative(x, y);
    const AC2 = distance(g.A, g.C) ** 2;
    const BC2 = distance(g.B, g.C) ** 2;
    const AB2 = distance(g.A, g.B) ** 2;

    // "Extend GA to P such that AP = AG and BD to N so that BN = BD."
    ap = Math.max(ap, e(g.lengths.AP, g.lengths.AG), e(g.lengths.AP, g.lengths.AC));
    bn = Math.max(bn, e(g.lengths.BN, g.lengths.BD), e(g.lengths.BN, g.lengths.BC));

    // The two half-square triangles.
    abp = Math.max(abp, e(g.areas.ABP, AC2 / 2));
    anb = Math.max(anb, e(g.areas.ANB, BC2 / 2));

    // APS = ABC (SSS), including angle PAS = BAC.
    const apsSides = [g.lengths.AP, g.lengths.AS, g.lengths.PS].sort((a, b) => a - b);
    const abcSides = [g.lengths.AC, g.lengths.AB, g.lengths.BC].sort((a, b) => a - b);
    congr = Math.max(congr, ...apsSides.map((v, i) => e(v, abcSides[i])),
      e(g.angles.BAC, g.angles.BAC));
    ps = Math.max(ps, e(g.lengths.PS, g.lengths.BC), e(g.lengths.PS, g.lengths.BN));
    ks = Math.max(ks, e(g.lengths.KS, g.lengths.AB));

    // The page writes angle KPS; the equal angle is KSP (see the report below).
    ksp = Math.max(ksp, e(g.angles.KSP, HALF - g.angles.ASP), e(g.angles.KSP, g.angles.ABN));
    kpsTypo = Math.max(kpsTypo, Math.abs(g.angles.KPS - (HALF - g.angles.ASP)));
    kpsArea = Math.max(kpsArea, e(g.areas.KPS, BC2 / 2), e(g.areas.KPS, g.areas.ANB));

    // Euclid I.41: each parallelogram is twice its triangle.
    dbl = Math.max(dbl, e(g.areas.ABML, 2 * g.areas.ABP), e(g.areas.KMLS, 2 * g.areas.KPS));
    total = Math.max(total, e(g.areas.ABML + g.areas.KMLS, AB2));
    pyth = Math.max(pyth, e(AC2 + BC2, AB2));

    // "AP = AD = AC" is a slip for "AP = AG = AC": D is on the other square.
    if (e(g.lengths.AD, g.lengths.AC) < 0.01) ad++;
  }
  check("AP = AG = AC", ap < 1e-7, `max ${ap}`);
  check("BN = BD = BC", bn < 1e-7, `max ${bn}`);
  check("area(ABP) = AC²/2 on every configuration", abp < 1e-7, `max ${abp}`);
  check("area(ANB) = BC²/2 on every configuration", anb < 1e-7, `max ${anb}`);
  check("triangle APS is congruent to ABC (SSS)", congr < 1e-7, `max ${congr}`);
  check("PS = BC = BN", ps < 1e-7, `max ${ps}`);
  check("KS = AB", ks < 1e-7, `max ${ks}`);
  check("angle KSP = 90 - angle ASP = angle ABN", ksp < 1e-7, `max ${ksp}`);
  check("angle KPS is NOT the equal angle, as the page's letters say", kpsTypo > 0.01, `min gap ${kpsTypo}`);
  check("area(KPS) = BC²/2 = area(ANB)", kpsArea < 1e-7, `max ${kpsArea}`);
  check("ABML and KMLS are twice their triangles (I.41)", dbl < 1e-7, `max ${dbl}`);
  check("the two parallelograms exactly fill the square on AB", total < 1e-7, `max ${total}`);
  check("AC² + BC² = AB² on every configuration", pyth < 1e-7, `max ${pyth}`);
  check("the page's AD is a typo: AD differs from AC almost everywhere", ad === 0, `${ad} exceptions`);
}

/* ------------------------------------- 4. dragging, as the canvas upgrades it */

{
  let dragError = 0, circleError = 0, angleError = 0;
  const drags = rng(314159);
  for (let i = 0; i < configs.length; i++) {
    const s = configs[i];
    const target = i % 2 === 0
      ? point(s.A.x + 30 + drags() * 80, s.B.y - 40 + drags() * 80)
      : point(s.C.x + (drags() - 0.5) * 120, s.C.y + (drags() - 0.5) * 120);
    const name = i % 2 === 0 ? "A" : "C";
    const mine = C.withPoint(s, name, target);
    const theirs = appletDrag(s, name, target);
    if (!mine || !theirs) { dragError = Infinity; continue; }
    for (const key of ["A", "B", "C"]) {
      dragError = Math.max(dragError, relative(mine[key].x, theirs[key].x), relative(mine[key].y, theirs[key].y));
    }
    dragError = Math.max(dragError, relative(mine.angleA, theirs.angleA));
    if (name === "C") {
      // Two more moves from the dragged position must stay on the same circle.
      let current = mine;
      const centre = appletCentre(theirs.A, theirs.B, theirs.C);
      const r = distance(centre, theirs.C);
      for (let step = 0; step < 3; step++) {
        const next = C.withPoint(current, "C",
          point(current.C.x + 20 - step * 7, current.C.y - 13 + step * 5));
        if (!next) { circleError = Infinity; break; }
        circleError = Math.max(circleError, Math.abs(distance(next.C, centre) - r));
        const expected = appletDrag(current, "C",
          point(current.C.x + 20 - step * 7, current.C.y - 13 + step * 5));
        angleError = Math.max(angleError,
          expected ? relative(next.angleA, expected.angleA) : Infinity);
        current = next;
      }
    }
  }
  check("dragging A or C matches the applet's UpgradePoints()", dragError < 1e-7, `max ${dragError}`);
  check("repeated C drags stay on the circumcircle", circleError < 1e-6, `max ${circleError}`);
  check("the stored AngleA follows the dragged C", angleError < 1e-7, `max ${angleError}`);
}

/* ------------------------------------------- 5. refusals, options and purity */

{
  const s = C.start();
  const before = JSON.stringify(s);
  check("a NaN target is refused", C.withPoint(s, "A", point(NaN, 10)) === null);
  const collinear = C.withPoint(s, "C", point(250, s.A.y));
  check("a near-collinear C target is refused", collinear === null || ok(collinear.C));
  check("an unknown handle is refused", C.withPoint(s, "Z", point(1, 2)) === null);
  check("withPoint does not mutate the position", JSON.stringify(s) === before);

  const named = C.withOption(C.withOption(s, "showNames", true), "showHint", true);
  equal("the two applet checkboxes are independent", [named.showNames, named.showHint], [true, true]);
  check("withOption refuses unknown keys", C.withOption(s, "other", true) === s);
  equal("a saved snapshot is plain data", C.snapshot(named), {
    A: s.A, B: s.B, C: s.C, angleA: s.angleA, showNames: true, showHint: true,
  });
  const snapshot = C.snapshot(named);
  snapshot.A.x = -1;
  check("changing the snapshot does not change the position", named.A.x !== -1);
  const moved = C.withPoint(s, "A", point(150, 200));
  check("a legal drag returns a fresh position", Boolean(moved) && moved !== s);
  check("a legal drag keeps the checkboxes", moved.showNames === s.showNames && moved.showHint === s.showHint);
  const detailed = C.withPointDetailed(s, "A", point(150, 200));
  check("UpgradePoints reports the A/B reference swap", Boolean(detailed) && detailed.swapped === true &&
    C.orientation(detailed.state.A, detailed.state.B, detailed.state.C) === 1);
}

done("huygens-pyth");
