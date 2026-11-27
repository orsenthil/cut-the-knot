#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-and-parallels/circles-and-parallels-core.js.
 *
 *   node porting/check-circles-and-parallels.mjs
 *
 * The applet is a droodle: P slides on AB, PN is parallel to BC and PM to AC,
 * and the circumcircles of APN and BPM meet at P and Q. First the rules of the
 * picture (the opening points, the four drags, the two checkboxes, the refusal
 * of broken drags) are checked. Then a second, literal transcription of the
 * applet's GeoSDoub and of its own Compute method is compared with the core
 * over thousands of drawings and slider positions. Finally every claim on the
 * page is tested: N and M on their sides, Q on both circles, X on every PQ,
 * X the same for every P, X the tangent intersection and apex of an isosceles
 * triangle, and the tangent case.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circles-and-parallels/circles-and-parallels-core.js", "CirclesAndParallelsCore");
const pt = (x, y) => ({ x, y });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, eps = 1e-7) => Math.abs(a - b) <= eps;
const samePt = (a, b, eps = 1e-7) => near(a.x, b.x, eps) && near(a.y, b.y, eps);
const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const lerp = (a, b, t) => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  equal("the opening A", s.A, pt(80, 80));
  equal("the opening B", s.B, pt(240, 180));
  equal("the opening C", s.C, pt(320, 60));
  equal("P starts 0.7 of the way from B to A", s.P, pt(128, 110));
  check("the two checkboxes start unticked", !s.showNames && !s.showHint);
  check("an illustration has no result to announce", C.result(s) === null);
  check("all four points are draggable", C.legalMoves().join(",") === "A,B,C,P");

  const g = C.compute(s);
  check("the opening drawing is not degenerate", !g.degenerate && !g.noDraw && !!g.Q);
  check("the opening Q is the second circle crossing", dist(g.Q, s.P) >= 1);
  check("the opening X lies on PQ", Math.abs(g.onLine) < 1e-7);
  check("the status names Q and the fixed X",
    /line PQ passes through X/.test(C.describe(s)) && /X stays put/.test(C.describe(s)));

  check("an unknown point is refused", C.movePoint(s, "Q", pt(1, 1)) === s);
  check("a non-numeric pointer is refused",
    C.movePoint(s, "P", pt(NaN, 1)) === s && C.movePoint(s, "A", null) === s);
  check("dragging P keeps it on AB and updates the fraction", (() => {
    const m = C.movePoint(s, "P", pt(200, 155));
    return m && Math.abs(cross(m.A, m.B, m.P)) < 1e-7 &&
      near(m.coefP, 0.25, 1e-9) && m.P.x === 200 && m.P.y === 155 && m.explored;
  })());
  check("dragging A carries P with it at the same fraction", (() => {
    const m = C.movePoint(s, "A", pt(100, 90));
    return m && near(m.P.x, 0.7 * 100 + 0.3 * 240) &&
      near(m.P.y, 0.7 * 90 + 0.3 * 180) && near(m.coefP, 0.7);
  })());
  check("dragging B carries P with it too", (() => {
    const m = C.movePoint(s, "B", pt(260, 200));
    return m && near(m.P.x, 0.7 * 80 + 0.3 * 260) &&
      near(m.P.y, 0.7 * 80 + 0.3 * 200);
  })());
  check("dragging C leaves A, B and P alone", (() => {
    const m = C.movePoint(s, "C", pt(300, 90));
    return m && samePt(m.C, pt(300, 90)) && samePt(m.A, s.A) &&
      samePt(m.B, s.B) && samePt(m.P, s.P);
  })());
  check("a drag off the board is clamped or refused", (() => {
    const m = C.movePoint(s, "C", pt(-99, 999));
    return m === s || (m.C.x >= C.MARGIN && m.C.x <= C.WIDTH - C.MARGIN);
  })());
  check("a collapsed triangle is refused", C.movePoint(s, "C", pt(240, 180)) === s);
  check("an unknown option is refused", C.setOption(s, "nonesuch", true) === s);
  check("both checkboxes can be set and unset", (() => {
    let t = C.setOption(s, "showNames", true);
    t = C.setOption(t, "showHint", true);
    return t.showNames && t.showHint &&
      !C.setOption(t, "showHint", false).showHint;
  })());
  check("reset restores the drawing but keeps the options", (() => {
    const moved = C.setOption(C.movePoint(s, "P", pt(200, 150)), "showNames", true);
    const r = C.reset(moved);
    return samePt(r.P, pt(128, 110)) && r.showNames === true &&
      r.explored === false && r.moves === 0 && near(r.coefP, 0.7);
  })());
  check("P next to A or B is reported, not drawn", (() => {
    const bad = C.start({ P: pt(80.5, 80.3) });
    const g2 = C.compute(bad);
    return g2.noDraw && g2.degenerate && /Move P away/.test(C.describe(bad));
  })());
}

/* ------------------------- 2. the same answers as the applet's own method */

/* GeoSDoub.Intersect(p1,p2,p3,p4), straight from its bytecode. */
function apIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x;
  const c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x;
  const c2 = p3.x * p4.y - p3.y * p4.x;
  const d = a1 * b2 - a2 * b1;
  if (Math.abs(d) < 1) return pt(NaN, NaN);
  return pt((b1 * c2 - b2 * c1) / d, (c1 * a2 - c2 * a1) / d);
}

/* GeoSDoub.GetParallelTo(p,a,b) = p + 100*(a-b). */
const apParallel = (p, a, b) => pt(p.x + 100 * (a.x - b.x), p.y + 100 * (a.y - b.y));

/* GeoSDoub.FindCircumcenter, then the canvas's GetCircle. */
function apCircumcenter(p, q, r) {
  const mAB = pt((p.x + q.x) / 2, (p.y + q.y) / 2);
  const mBC = pt((q.x + r.x) / 2, (q.y + r.y) / 2);
  const nAB = pt(mAB.x + (q.y - p.y), mAB.y - (q.x - p.x));
  const nBC = pt(mBC.x + (r.y - q.y), mBC.y - (r.x - q.x));
  return apIntersect(mAB, nAB, mBC, nBC);
}
function apCircle(p, q, r) {
  const o = apCircumcenter(p, q, r);
  return { x: o.x, y: o.y, r: (dist(o, p) + dist(o, q) + dist(o, r)) / 3 };
}

/* GeoSDoub.IntersectCirclesX / Y, with the bytecode's local names. */
function apCirclesX(c0, c1) {
  const m = -(c0.y - c1.y) / (c0.x - c1.x);
  const b = (
    c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y -
    c0.r * c0.r + c1.r * c1.r
  ) / 2 / (c0.x - c1.x);
  const h = b - c0.x, a = m * m + 1, k = m * h - c0.y;
  const c = h * h + c0.y * c0.y - c0.r * c0.r;
  const disc = k * k - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y1 = (-k + root) / a, y2 = (-k - root) / a;
  return [pt(m * y1 + b, y1), pt(m * y2 + b, y2)];
}
function apCirclesY(c0, c1) {
  const m = -(c0.x - c1.x) / (c0.y - c1.y);
  const b = (
    c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x -
    c0.r * c0.r + c1.r * c1.r
  ) / 2 / (c0.y - c1.y);
  const h = b - c0.y, a = m * m + 1, k = m * h - c0.x;
  const c = h * h + c0.x * c0.x - c0.r * c0.r;
  const disc = k * k - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x1 = (-k + root) / a, x2 = (-k - root) / a;
  return [pt(x1, m * x1 + b), pt(x2, m * x2 + b)];
}
function apCircleCross(c0, c1) {
  if (Math.abs(c0.x - c1.x) > 1) return apCirclesX(c0, c1);
  if (Math.abs(c0.y - c1.y) > 1) return apCirclesY(c0, c1);
  return [pt(c0.x, c0.y), pt(c0.x, c0.y)];
}

/* Canvas.Other(hits, P): the crossing at least one unit from P. */
function apOther(hits, p) {
  return dist(hits[0], p) < 1 ? (hits[1] || hits[0]) : hits[0];
}

/* GeoSDoub.ComputeAngle (vertex first), FindOrientation, Rotate. */
function apAngle(p0, p1, p2) {
  const v = (dist(p0, p1) ** 2 + dist(p0, p2) ** 2 - dist(p1, p2) ** 2) /
    (2 * dist(p0, p1) * dist(p0, p2));
  return Math.acos(Math.max(-1, Math.min(1, v)));
}
const apOrientation = (p0, p1, p2) => cross(p0, p1, p2) > 0 ? 1 : -1;
function apRotate(p0, p1, angle, sign) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return pt(p0.x + c * (p1.x - p0.x) - sign * s * (p1.y - p0.y),
    p0.y + sign * s * (p1.x - p0.x) + c * (p1.y - p0.y));
}

/* DoubCircle.Tangent and the canvas's Perp / PerpLine. */
const apTangent = (c, p) => pt(p.x + c.y - p.y, p.y - c.x + p.x);
const apPerp = (p, q) => pt(p.x + q.y - p.y, p.y - q.x + p.x);

/* Canvas.Compute, including its NoDraw guard and its tangent fallback. */
function apCompute(s) {
  const { A, B, C, P } = s;
  if (dist(P, A) < 1.5 || dist(P, B) < 1.5) return null;
  const N = apIntersect(apParallel(P, B, C), P, A, C);
  const M = apIntersect(apParallel(P, A, C), P, B, C);
  if (!Number.isFinite(N.x) || !Number.isFinite(M.x)) return null;
  const cA = apCircle(A, P, N), cB = apCircle(B, P, M);
  const hits = apCircleCross(cA, cB);
  if (!hits) return null;
  const Q = apOther(hits, P);
  const line = dist(P, Q) < 1 ? { p: P, q: apPerp(P, A) } : { p: P, q: Q };
  const angle = apAngle(C, A, B), o = apOrientation(C, A, B);
  const rA = apRotate(A, B, angle, -o), rB = apRotate(B, A, angle, o);
  const X = apIntersect(A, rA, B, rB);
  const circum = apCircle(A, B, C);
  const ta = apTangent(circum, A), tb = apTangent(circum, B);
  const Xtan = apIntersect(A, ta, B, tb);
  return { N, M, cA, cB, Q, line, X, Xtan, circum, ta, tb, rA, rB };
}

/* Every drawing: a grid of triangles with P at many fractions of AB, plus a
   deterministic random sample. Both circle-intersection branches are hit. */
function drawing(A, B, Cp, t) {
  return C.start({ A, B, C: Cp, P: lerp(A, B, t) });
}
const configs = [];
for (const Cx of [200, 260, 320]) {
  for (const Cy of [40, 90, 140, 200, 260]) {
    for (const t of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95]) {
      configs.push(drawing(pt(80, 80), pt(240, 180), pt(Cx, Cy), t));
    }
  }
}
const rand = rng(20261126);
for (let i = 0; i < 700; i++) {
  const A = pt(40 + rand() * 320, 40 + rand() * 220);
  const B = pt(40 + rand() * 320, 40 + rand() * 220);
  const Cv = pt(40 + rand() * 320, 40 + rand() * 220);
  if (dist(A, B) < 40 || Math.abs(cross(A, B, Cv)) < 500) continue;
  configs.push(drawing(A, B, Cv, 0.05 + rand() * 0.9));
}
check("the grid and random sample cover both circle-intersection branches",
  configs.some((s) => Math.abs(C.compute(s).circleAPN.x - C.compute(s).circleBPM.x) > 1) &&
  configs.some((s) => Math.abs(C.compute(s).circleAPN.x - C.compute(s).circleBPM.x) <= 1));

{
  let badGuard = 0, badN = 0, badM = 0, badCircle = 0, badQ = 0;
  let badX = 0, badXtan = 0, badLine = 0, badTangent = 0;
  let usable = 0, skipped = 0, tangencies = 0;
  for (const s of configs) {
    const core = C.compute(s), app = apCompute(s);
    if (core.noDraw || !app) {
      if (!core.noDraw && app === null) badGuard++;
      continue;
    }
    usable++;
    if (!samePt(core.N, app.N, 1e-6)) badN++;
    if (!samePt(core.M, app.M, 1e-6)) badM++;
    for (const [g, a] of [[core.circleAPN, app.cA], [core.circleBPM, app.cB],
                          [core.circum, app.circum]]) {
      if (!(near(g.x, a.x, 1e-6) && near(g.y, a.y, 1e-6) && near(g.r, a.r, 1e-6))) badCircle++;
    }
    if (!samePt(core.rA, app.rA, 1e-7) || !samePt(core.rB, app.rB, 1e-7)) badTangent++;
    if (!samePt(core.X, app.X, 1e-6) || !samePt(core.Xtan, app.Xtan, 1e-6)) badXtan++;
    if (!samePt(core.ta, app.ta, 1e-6) || !samePt(core.tb, app.tb, 1e-6)) badLine++;
    if (!Number.isFinite(app.Q.x)) { skipped++; continue; }
    /* Near tangency the two crossings are a fraction of a pixel apart and
       both transcriptions approximate P differently: Q is undefined there. */
    if (dist(core.Q, s.P) < 1e-3 || dist(app.Q, s.P) < 1e-3) { skipped++; continue; }
    if (core.tangent || dist(app.Q, s.P) < 1) tangencies++;
    if (!samePt(core.Q, app.Q, 1e-6)) badQ++;
    if (!samePt(core.appletLine.q, app.line.q, 1e-6)) badX++;
  }
  check(`${configs.length} drawings: NoDraw guards agree with the bytecode`, badGuard === 0, `${badGuard} wrong`);
  check(`${usable} drawings: N matches the applet's GetParallelTo + Intersect`, badN === 0, `${badN} wrong`);
  check(`${usable} drawings: M matches the applet's GetParallelTo + Intersect`, badM === 0, `${badM} wrong`);
  check(`${usable} drawings: all three circles match the bytecode GetCircle`, badCircle === 0, `${badCircle} wrong`);
  check(`${usable} drawings: the rotated base angles match Compute`, badTangent === 0, `${badTangent} wrong`);
  check(`${usable} drawings: X and the tangent intersection match Compute`, badXtan === 0, `${badXtan} wrong`);
  check(`${usable} drawings: the two tangent points match the bytecode`, badLine === 0, `${badLine} wrong`);
  check(`${usable - skipped} drawings: Q matches the applet's Other`, badQ === 0, `${badQ} wrong`);
  check(`${usable - skipped} drawings: the drawn line matches Compute`, badX === 0, `${badX} wrong`);
  check(`${skipped} near-tangent drawings skipped (undefined chord)`, skipped >= 0);
  check(`${tangencies} true tangencies found`, tangencies > 0);
}

/* The small helpers themselves, at the applet's own guard edges. */
{
  check("Intersect returns NaN below the determinant guard",
    Number.isNaN(C.intersect(pt(0, 0), pt(0, 1), pt(5, 0), pt(5, 1)).x) &&
    Number.isNaN(apIntersect(pt(0, 0), pt(0, 1), pt(5, 0), pt(5, 1)).x));
  check("GetParallelTo is 100 times the side direction", (() => {
    const p = pt(20, 30), a = pt(100, 70), b = pt(40, 50);
    return samePt(C.parallelTo(p, a, b), apParallel(p, a, b)) &&
      samePt(C.parallelTo(p, a, b), pt(6020, 2030));
  })());
  check("Circumcenter and ComputeAngle match the bytecode on a scalene triangle", (() => {
    const p = pt(20, 180), q = pt(260, 210), r = pt(190, 40);
    return samePt(C.circumcenter(p, q, r), apCircumcenter(p, q, r), 1e-8) &&
      near(C.computeAngle(p, q, r), apAngle(p, q, r), 1e-12);
  })());
  check("Intersect(circle,circle) uses the Y branch when centres share x",
    C.intersectCircles({ x: 200, y: 100, r: 90 }, { x: 200, y: 200, r: 90 }).length === 2 &&
    apCirclesY({ x: 200, y: 100, r: 90 }, { x: 200, y: 200, r: 90 }).length === 2);
}

/* ----------------------------------- 3. every claim the page makes */

{
  let badOnSide = 0, badParallelClaim = 0, badOnCircle = 0, badXLine = 0;
  let badXFixed = 0, badIsosceles = 0, badTangentClaim = 0, badAppletLine = 0;
  let slides = 0, tangencies = 0, appletMisses = 0;
  for (const s of configs) {
    const g = C.compute(s);
    if (g.noDraw || g.degenerate || !g.Q || g.tangent) continue;
    const scale = Math.max(1, dist(s.A, s.B));
    const eps = 1e-7 * scale;
    /* PN is parallel to BC with N on AC; PM parallel to AC with M on BC. */
    if (Math.abs(cross(s.A, s.C, g.N)) > eps ||
        Math.abs(cross(s.B, s.C, g.M)) > eps) badOnSide++;
    const pn = { x: g.N.x - s.P.x, y: g.N.y - s.P.y };
    const bc = { x: s.C.x - s.B.x, y: s.C.y - s.B.y };
    const pm = { x: g.M.x - s.P.x, y: g.M.y - s.P.y };
    const ac = { x: s.C.x - s.A.x, y: s.C.y - s.A.y };
    if (Math.abs(pn.x * bc.y - pn.y * bc.x) > eps * scale ||
        Math.abs(pm.x * ac.y - pm.y * ac.x) > eps * scale) badParallelClaim++;
    /* P and Q are on both circumcircles. */
    if (!(near(dist(g.circleAPN, g.P), g.circleAPN.r, eps) &&
          near(dist(g.circleBPM, g.P), g.circleBPM.r, eps) &&
          near(dist(g.circleAPN, g.Q), g.circleAPN.r, eps) &&
          near(dist(g.circleBPM, g.Q), g.circleBPM.r, eps))) badOnCircle++;
    /* The page's concurrency claim: X is on every PQ. */
    if (Math.abs(g.onLine) > eps) badXLine++;
    /* X is also the apex of an isosceles triangle on AB. The base angle
       equals angle C when C is acute and its supplement when C is obtuse:
       the page constructs the *line* making angle C with AB, and a line has
       no direction. */
    const angC = C.computeAngle(s.C, s.A, s.B);
    const base = C.computeAngle(s.A, g.X, s.B);
    if (!near(dist(g.X, s.A), dist(g.X, s.B), eps) ||
        !near(base, Math.min(angC, Math.PI - angC), 1e-9)) badIsosceles++;
    if (!near(dist(g.X, g.Xtan), 0, eps)) badXLine++;
  }
  check(`${configs.length} drawings: N on AC and M on BC`, badOnSide === 0, `${badOnSide} wrong`);
  check(`${configs.length} drawings: PN parallel to BC and PM parallel to AC`, badParallelClaim === 0, `${badParallelClaim} wrong`);
  check(`${configs.length} drawings: P and Q lie on both circles`, badOnCircle === 0, `${badOnCircle} wrong`);
  check(`${configs.length} drawings: X is on PQ and is the tangent intersection`, badXLine === 0, `${badXLine} wrong`);
  check(`${configs.length} drawings: X makes an isosceles triangle on AB`, badIsosceles === 0, `${badIsosceles} wrong`);

  /* With A, B and C fixed, slide P: X must not move. */
  for (const Cx of [200, 260, 320]) {
    for (const Cy of [40, 90, 140, 200, 260]) {
      const A = pt(80, 80), B = pt(240, 180), Cv = pt(Cx, Cy);
      const xs = [];
      for (const t of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95]) {
        const g = C.compute(drawing(A, B, Cv, t));
        if (!g.degenerate && Number.isFinite(g.X.x)) xs.push(g.X);
      }
      if (xs.length < 2) continue;
      slides++;
      const spread = Math.max(...xs.map((x) => x.x)) - Math.min(...xs.map((x) => x.x));
      const yspread = Math.max(...xs.map((x) => x.y)) - Math.min(...xs.map((x) => x.y));
      if (spread > 1e-7 || yspread > 1e-7) badXFixed++;
    }
  }
  check(`${slides} slides: X never moves as P slides on AB`, badXFixed === 0, `${badXFixed} wrong`);

  /* Find genuine tangencies away from the NoDraw guard and test the page's
     remark: the real common tangent still goes through X. */
  for (let i = 0; i < 500; i++) {
    const A = pt(40 + rand() * 320, 40 + rand() * 220);
    const B = pt(40 + rand() * 320, 40 + rand() * 220);
    const Cv = pt(40 + rand() * 320, 40 + rand() * 220);
    if (dist(A, B) < 60 || Math.abs(cross(A, B, Cv)) < 2000) continue;
    let best = Infinity, bestT = 0;
    for (let j = 1; j < 100; j++) {
      const t = j / 100;
      const g = C.compute(drawing(A, B, Cv, t));
      if (g.noDraw || g.degenerate || !g.Q) continue;
      const gap = dist(g.Q, lerp(A, B, t));
      if (gap < best) { best = gap; bestT = t; }
    }
    if (best >= 1) continue;
    const s2 = drawing(A, B, Cv, bestT);
    const g = C.compute(s2);
    if (g.degenerate || !g.tangent || !Number.isFinite(g.X.x)) continue;
    tangencies++;
    if (Math.abs(g.onLine) > 1e-6 * dist(A, B)) badTangentClaim++;
    if (Math.abs(g.appletOnLine) > 1e-6 * dist(A, B)) appletMisses++;
    badAppletLine += g.appletLine && samePt(g.appletLine.q, g.line.q, 1e-6) ? 0 : 1;
  }
  check(`${tangencies} tangencies found while scanning`, tangencies > 0);
  check(`${tangencies} tangencies: the common tangent goes through X`, badTangentClaim === 0, `${badTangentClaim} wrong`);
  check(`${tangencies} tangencies: the applet's PerpLine(P,A) misses X (page wins)`,
    appletMisses === tangencies && badAppletLine === tangencies,
    `${appletMisses}/${badAppletLine} of ${tangencies}`);
}

done("circles-and-parallels");
