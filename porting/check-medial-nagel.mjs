#!/usr/bin/env node
"use strict";

/*
 * Logic test for medial-nagel/medial-nagel-core.js.
 *
 *   node porting/check-medial-nagel.mjs
 *
 * Exact claim checked (Problem 188, page of MedialNagel): "Let EDF be the
 * medial triangle of ABC. The incircles of triangles AEF, BDF, and CDE are
 * tangent to EF, FD, and DE at P, Q, R, respectively. Prove that DP, EQ, FR
 * are concurrent. Furthermore, the point of concurrency is the Nagel point of
 * DEF." The page also claims ER=FQ, DR=FP, DQ=EP, EF+ER=DF+DR, that P,Q,R are
 * the excircle touch points, that Nagel and Gergonne are isotomic conjugates,
 * and that M is the incenter of ABC.
 *
 * Section 2 transcribes ComputePoints a second time directly from the applet's
 * bytecode (different expressions for every GeoSDoub helper) and compares it
 * with the core over thousands of triangles. Section 3 re-derives the same
 * points from side lengths and tangent lengths, and checks all claims over the
 * whole sample, including a lattice of thin and obtuse triangles. Flat
 * triangles where Java's NearestPoint/Intersect guards stop being projections
 * are excluded from the geometric claims and checked separately.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("medial-nagel/medial-nagel-core.js", "MedialNagelCore");

/* ------------------------------------------------------------ 1. the position */

{
  const s = C.start({});
  const cx = 500 / 2, cy = (3 * 450) / 5, u = 500 / 5;
  equal("Reset mirrors the applet's 500x450 canvas", [s.width, s.height], [500, 450]);
  equal("Reset: A is cx-u, cy+70", s.A, { x: cx - u, y: cy + 70 });
  equal("Reset: B is cx+2u, cy+70", s.B, { x: cx + 2 * u, y: cy + 70 });
  equal("Reset: C is cx+u cos60-u/2, cy-u sin60-140", s.C, {
    x: cx + u * Math.cos(Math.PI / 3) - u / 2,
    y: cy - u * Math.sin(Math.PI / 3) - 140,
  });
  equal("Reset: names and incircle on, hint and extra off",
    [s.showNames, s.showIncircle, s.showHint, s.showExtra], [true, true, false, false]);

  const moved = C.withPoint(s, "B", { x: 10, y: 20 });
  equal("withPoint moves only the named corner", moved.A, s.A);
  equal("withPoint does not mutate the old position", s.B.x, cx + 2 * u);
  equal("withPoint ignores an unknown corner", C.withPoint(s, "Z", { x: 0, y: 0 }), s);

  const toggled = C.withOption(C.withOption(s, "hint", true), "extra", true);
  equal("the four applet switches", [toggled.showHint, toggled.showExtra], [true, true]);
  equal("an unknown switch changes nothing", C.withOption(s, "nope", true), s);
  const reset = C.reset(toggled);
  equal("reset keeps the switches and the view",
    [reset.width, reset.height, reset.showHint, reset.showExtra, reset.B],
    [500, 450, true, true, s.B]);
}

/* ------------------------ 2. a second transcription of the bytecode ----------- */

const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p, t) => ({ x: p.x * t, y: p.y * t });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const cross = (p, q) => p.x * q.y - p.y * q.x;
const len = (p) => Math.hypot(p.x, p.y);
const dist = (p, q) => len(sub(p, q));
const sq = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const mid = (p, q) => mul(add(p, q), 0.5);
const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);

/** ComputeAngle, written as the bytecode'slaw of cosines. */
function ang(p, q, r) {
  const co = (sq(p, q) + sq(p, r) - sq(q, r)) / (2 * dist(p, q) * dist(p, r));
  return Math.acos(Math.min(1, Math.max(-1, co)));
}

/** FindOrientation, written as the bytecode's raw expression, not a cross product. */
function orient(p, q, r) {
  const value = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - p.y * q.x;
  return value > 0 ? 1 : -1;
}

/** Rotate, written with an explicit rotation matrix. */
function turn(center, q, t, sense) {
  const dx = q.x - center.x, dy = q.y - center.y;
  const c = Math.cos(t), sn = Math.sin(t);
  return {
    x: center.x + c * dx - sense * sn * dy,
    y: center.y + sense * sn * dx + c * dy,
  };
}

/** Intersect, written with Cramer's rule and Java's |det| < 1 guard. */
function meet(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

function incenter(p, q, r) {
  const sense = orient(p, q, r);
  const u = turn(p, q, ang(p, q, r) / 2, sense);
  const v = turn(q, r, ang(q, r, p) / 2, sense);
  return meet(p, u, q, v);
}

function excenter(p, q, r) {
  const sense = orient(q, p, r);
  const u = turn(q, r, (Math.PI - ang(q, p, r)) / 2, sense);
  const v = turn(r, q, (Math.PI - ang(r, p, q)) / 2, -sense);
  return meet(q, u, r, v);
}

/** NearestPoint, including the SqDist(a,p) < 0.1 early return. */
function proj(p, a, b) {
  if (sq(a, p) < 0.1) return { x: p.x, y: p.y };
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return { x: a.x + t * dx, y: a.y + t * dy };
}

/** GetIncircle: average of the three distances to the projected sides. */
function inCircle(p, q, r) {
  const o = incenter(p, q, r);
  const radius = (dist(o, proj(o, q, r)) + dist(o, proj(o, r, p)) + dist(o, proj(o, p, q))) / 3;
  return { center: o, radius };
}

/** A fresh copy of ComputePoints() and the extra circles in Draw(). */
function bytecodeCompute(A, B, Cc) {
  const D = mid(B, Cc), E = mid(Cc, A), F = mid(A, B);
  const ca = inCircle(A, E, F), cb = inCircle(B, D, F);
  const cc = inCircle(Cc, D, E), ci = inCircle(D, E, F);
  const P = proj(ca.center, E, F), Q = proj(cb.center, D, F), R = proj(cc.center, D, E);
  const Pp = proj(ci.center, E, F), Qp = proj(ci.center, D, F), Rp = proj(ci.center, D, E);
  const M = meet(D, P, E, Q), G = meet(D, Pp, E, Qp);
  const xa = excenter(D, F, E), xb = excenter(E, F, D), xc = excenter(F, D, E);
  return {
    D, E, F, P, Q, R, Pp, Qp, Rp, M, G,
    centers: [ca.center, cb.center, cc.center, ci.center],
    radii: [ca.radius, cb.radius, cc.radius, ci.radius],
    ex: [xa, xb, xc], I: incenter(A, B, Cc),
  };
}

/* --------------------------- 3. independent side-length geometry ------------- */

function baryIncenter(A, B, Cc) {
  const a = dist(B, Cc), b = dist(Cc, A), c = dist(A, B);
  return mul(add(add(mul(A, a), mul(B, b)), mul(Cc, c)), 1 / (a + b + c));
}

function baryPoint(D, E, F, u, v, w) {
  return mul(add(add(mul(D, u), mul(E, v)), mul(F, w)), 1 / (u + v + w));
}

/** Tangency points of the three corner incircles, from equal tangent lengths. */
function tangentPoints(A, B, Cc) {
  const D = mid(B, Cc), E = mid(Cc, A), F = mid(A, B);
  const d = dist(E, F), e = dist(D, F), f = dist(D, E), s = (d + e + f) / 2;
  // On EF: EP = s-f, FP = s-e; on DF: DQ = s-f, FQ = s-d; on DE: DR = s-e.
  const P = add(E, mul(sub(F, E), (s - f) / d));
  const Q = add(D, mul(sub(F, D), (s - f) / e));
  const R = add(D, mul(sub(E, D), (s - e) / f));
  return { D, E, F, P, Q, R, d, e, f, s };
}

/** Excenters and their touch points, from barycentric weights (-d:e:f), etc. */
function excirclePoints(D, E, F) {
  const d = dist(E, F), e = dist(D, F), f = dist(D, E);
  const X = baryPoint(D, E, F, -d, e, f);
  const Y = baryPoint(D, E, F, d, -e, f);
  const Z = baryPoint(D, E, F, d, e, -f);
  const s = (d + e + f) / 2;
  return {
    centers: [X, Y, Z],
    feet: [
      add(E, mul(sub(F, E), (s - f) / d)),
      add(D, mul(sub(F, D), (s - f) / e)),
      add(D, mul(sub(E, D), (s - e) / f)),
    ],
  };
}

/* Deterministic triangles: the applet's own, seeded random, and a lattice sweep. */
function samples() {
  const out = [C.start({})];
  const rand = rng(63021988);
  for (let i = 0; i < 6000; i++) {
    out.push({
      ...out[0],
      A: { x: 15 + rand() * 470, y: 15 + rand() * 420 },
      B: { x: 15 + rand() * 470, y: 15 + rand() * 420 },
      C: { x: 15 + rand() * 470, y: 15 + rand() * 420 },
    });
  }
  const grid = [25, 60, 110, 180, 260, 340, 470];
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid.length; j++) {
      for (let k = 0; k < grid.length; k += 2) {
        out.push({
          ...out[0],
          A: { x: grid[i], y: grid[j] }, B: { x: grid[k], y: 25 }, C: { x: 470, y: 425 },
        });
      }
    }
  }
  return out;
}

const positions = samples();
const usable = positions.filter((s) => C.compute(s).valid);

check("the sample mixes valid and flat triangles", usable.length > 4000 && usable.length < positions.length,
  `${usable.length} of ${positions.length} usable`);

/* The core's ComputePoints against a second transcription of the bytecode. */
{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = bytecodeCompute(s.A, s.B, s.C);
    const size = Math.max(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A));
    for (const name of ["D", "E", "F", "P", "Q", "R", "Pp", "Qp", "Rp", "M", "G"]) {
      worst = Math.max(worst, dist(m[name], ref[name]) / size);
    }
  }
  check(`P,Q,R, M, G and the midpoints match the bytecode on ${usable.length} triangles`,
    worst < 1e-8, `worst relative error ${worst}`);
}

{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = bytecodeCompute(s.A, s.B, s.C);
    for (let i = 0; i < 4; i++) {
      worst = Math.max(worst, dist(m[["circleA", "circleB", "circleC", "circleI"][i]].center, ref.centers[i]));
      worst = Math.max(worst, Math.abs(m[["circleA", "circleB", "circleC", "circleI"][i]].radius - ref.radii[i]));
    }
  }
  check("all four incircle centers and radii match the second transcription", worst < 1e-8,
    `worst absolute error ${worst}`);
}

{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = bytecodeCompute(s.A, s.B, s.C);
    for (let i = 0; i < 3; i++) worst = Math.max(worst, dist(m.excircles[i].center, ref.ex[i]));
  }
  check("the three excenters of the Extra construction match the bytecode", worst < 1e-7,
    `worst absolute error ${worst}`);
}

{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = bytecodeCompute(s.A, s.B, s.C);
    worst = Math.max(worst, dist(m.Iabc, ref.I));
  }
  check("the applet's FindIncenter(A,B,C) matches the second transcription", worst < 1e-8,
    `worst absolute error ${worst}`);
}

/* The claims, against the independent side-length geometry. */
{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = tangentPoints(s.A, s.B, s.C);
    const size = Math.max(ref.d, ref.e, ref.f);
    for (const name of ["P", "Q", "R"]) worst = Math.max(worst, dist(m[name], ref[name]) / size);
  }
  check("P,Q,R equal the equal-tangent-length touch points", worst < 1e-7,
    `worst relative error ${worst}`);
}

{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = tangentPoints(s.A, s.B, s.C);
    const refI = baryIncenter(s.A, s.B, s.C);
    const size = Math.max(ref.d, ref.e, ref.f);
    const nagel = baryPoint(ref.D, ref.E, ref.F, ref.s - ref.d, ref.s - ref.e, ref.s - ref.f);
    worst = Math.max(worst, dist(m.M, nagel) / size, dist(m.M, refI) / size);
  }
  check("M is both the Nagel point of DEF and the incenter of ABC", worst < 1e-7,
    `worst relative error ${worst}`);
}

{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = tangentPoints(s.A, s.B, s.C);
    const gergonne = baryPoint(ref.D, ref.E, ref.F,
      1 / (ref.s - ref.d), 1 / (ref.s - ref.e), 1 / (ref.s - ref.f));
    worst = Math.max(worst, dist(m.G, gergonne) / Math.max(ref.d, ref.e, ref.f));
  }
  check("G is the Gergonne point of DEF", worst < 1e-7, `worst relative error ${worst}`);
}

{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = excirclePoints(m.D, m.E, m.F);
    for (let i = 0; i < 3; i++) {
      worst = Math.max(worst, dist(m.excircles[i].center, ref.centers[i]));
      worst = Math.max(worst, dist(m.excircles[i].foot, ref.feet[i]));
    }
  }
  check("the drawn excircles touch EF, DF and DE at P, Q, R", worst < 1e-6,
    `worst absolute error ${worst}`);
}

{
  let failures = 0;
  for (const s of usable) if (!C.claims(s).all) failures++;
  check(`every page claim holds on ${usable.length} triangles`, failures === 0, `${failures} counterexamples`);
}

{
  let failures = 0;
  for (const s of usable) {
    const q = C.claims(s);
    if (!q.ERFQ || !q.DRFP || !q.DQEP) failures++;
  }
  check("ER=FQ, DR=FP and DQ=EP", failures === 0, `${failures} failures`);
}

{
  let failures = 0;
  for (const s of usable) {
    const q = C.claims(s);
    if (!q.splitP || !q.splitQ || !q.splitR) failures++;
  }
  check("the perimeter-splitter equalities hold on all three sides", failures === 0, `${failures} failures`);
}

{
  let failures = 0;
  for (const s of usable) {
    const q = C.claims(s);
    if (!q.concurrence || !q.tangency) failures++;
  }
  check("DP, EQ and FR concur at P,Q,R's tangency points", failures === 0, `${failures} failures`);
}

{
  let failures = 0;
  for (const s of usable) {
    const q = C.claims(s);
    if (!q.exTouch || !q.touchLengths) failures++;
  }
  check("P,Q,R are the excircle contacts, with the right tangent lengths", failures === 0,
    `${failures} failures`);
}

{
  let failures = 0;
  for (const s of usable) {
    const q = C.claims(s);
    if (!q.isotomic || !q.gergonne || !q.conjugates) failures++;
  }
  check("P/P', Q/Q', R/R' are isotomic and Nagel/Gergonne are conjugates", failures === 0,
    `${failures} failures`);
}

/* Flat triangles, where the applet's own Java guards stop being projections. */
{
  let flat = 0;
  let answered = 0;
  for (const s of positions) {
    if (C.compute(s).valid) continue;
    flat++;
    answered += C.claims(s) === null ? 1 : 0;
  }
  check("flat triangles are refused rather than giving a false claim", flat > 0 && answered === flat,
    `${answered}/${flat} refused`);
}

{
  const collinear = { ...C.start({}), A: { x: 20, y: 100 }, B: { x: 200, y: 100 }, C: { x: 470, y: 100 } };
  const m = C.compute(collinear);
  check("a straight line has no Nagel point to draw", !m.valid && C.claims(collinear) === null);
}

{
  const s = C.start({});
  const m = C.compute(s);
  check("the applet's starting triangle is usable and the claim holds there", m.valid && C.claims(s).all);
  const moved = C.withPoint(s, "C", { x: 250, y: 60 });
  check("a thin but valid triangle still satisfies the claim", C.claims(moved)?.all === true);
}

done("medial-nagel");
