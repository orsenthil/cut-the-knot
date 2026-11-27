#!/usr/bin/env node
"use strict";

/*
 * Logic test for gergonne-medial/gergonne-medial-core.js.
 *
 *   node porting/check-gergonne-medial.mjs
 *
 * The page's exact claim: "In ABC, let Ma, Mb, Mc be the midpoints of sides
 * BC, AC, and AB. Let A', B', C' be the points where the incircle touches
 * those sides ... Then the perpendiculars from the midpoints Ma, Mb, Mc onto
 * the opposite sides of A'B'C' are concurrent." It also states the Maxwell
 * converse: the perpendiculars from the touch points onto the medial
 * triangle's sides concur at the incenter.
 *
 * Section 3 re-transcribes the applet's Compute() a second way: the incenter
 * by side-length weights, the touch points by equal tangent lengths, the feet
 * by cross products, and the concurrency point by parametric intersection.
 * Section 2 checks all those claims over thousands of deterministic triangles,
 * plus a lattice sweep and the applet's own Reset position. Flat triangles
 * where Java's NearestPoint/Intersect guards stop being projections are
 * excluded from the geometric claims and checked separately.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("gergonne-medial/gergonne-medial-core.js", "GergonneMedialCore");

/* ------------------------------------------------------------ 1. the position */

{
  const s = C.start({});
  const r = Math.min(s.width, s.height) / 3;
  const cx = s.width / 2, cy = s.height / 2;
  equal("Reset: A is cx-r, cy+70", s.A, { x: cx - r, y: cy + 70 });
  equal("Reset: B is cx+1.2r, cy+100", s.B, { x: cx + 1.2 * r, y: cy + 100 });
  equal("Reset: C is cx+r cos60, cy-r sin60", s.C, {
    x: cx + r * Math.cos(Math.PI / 3), y: cy - r * Math.sin(Math.PI / 3),
  });
  equal("Reset: names default on, hint off", [s.showNames, s.showHint], [true, false]);

  const moved = C.withPoint(s, "B", { x: 10, y: 20 });
  equal("withPoint moves only the named corner", moved.A, s.A);
  equal("withPoint does not mutate the old position", s.B.x, cx + 1.2 * r);
  equal("withPoint ignores an unknown corner", C.withPoint(s, "Z", { x: 0, y: 0 }), s);
  const reset = C.reset(moved);
  equal("reset keeps the view and toggles", [reset.width, reset.height, reset.showNames, reset.showHint],
    [s.width, s.height, s.showNames, s.showHint]);
  equal("reset rebuilds the triangle", reset.B, s.B);
  equal("toggle names", C.withOption(s, "names", false).showNames, false);
  equal("toggle hint", C.withOption(s, "hint", true).showHint, true);
}

/* ------------------------ 2. independent geometry, second transcription ------- */

const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p, t) => ({ x: p.x * t, y: p.y * t });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const cross = (p, q) => p.x * q.y - p.y * q.x;
const len = (p) => Math.hypot(p.x, p.y);
const dist = (p, q) => len(sub(p, q));
const mid = (p, q) => mul(add(p, q), 0.5);

/** Incenter from side lengths, not from the applet's rotated bisectors. */
function baryIncenter(A, B, Cc) {
  const a = dist(B, Cc), b = dist(Cc, A), c = dist(A, B);
  const total = a + b + c;
  return {
    x: (a * A.x + b * B.x + c * Cc.x) / total,
    y: (a * A.y + b * B.y + c * Cc.y) / total,
  };
}

/** Tangency points from equal tangent lengths: from A and B both s-a, etc. */
function touchPoints(A, B, Cc) {
  const a = dist(B, Cc), b = dist(Cc, A), c = dist(A, B);
  const s = (a + b + c) / 2;
  return {
    Ga: add(B, mul(sub(Cc, B), (s - b) / a)), // on BC
    Gb: add(Cc, mul(sub(A, Cc), (s - c) / b)), // on CA
    Gc: add(A, mul(sub(B, A), (s - a) / c)), // on AB
  };
}

/** Foot of the perpendicular from p onto the infinite line qr, by cross product. */
function foot(p, q, r) {
  const v = sub(r, q);
  const t = dot(sub(p, q), v) / dot(v, v);
  return add(q, mul(v, t));
}

/** Intersection of the lines p+t*u and q+s*v, parametric rather than Java's Cramer. */
function lineCross(p, u, q, v) {
  const d = cross(u, v);
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return { x: NaN, y: NaN };
  const t = cross(sub(q, p), v) / d;
  return add(p, mul(u, t));
}

const perpen = (p, q, r, s) => {
  const u = sub(p, q), v = sub(r, s);
  return Math.abs(dot(u, v)) / (len(u) * len(v));
};

/** The applet's diagram, recomputed from scratch with independent formulas. */
function reference(A, B, Cc) {
  const Ma = mid(B, Cc), Mb = mid(A, Cc), Mc = mid(A, B);
  const I = baryIncenter(A, B, Cc);
  const { Ga, Gb, Gc } = touchPoints(A, B, Cc);
  const D = foot(Ma, Gb, Gc), E = foot(Mb, Ga, Gc), F = foot(Mc, Ga, Gb);
  const perp = (p) => ({ x: -(p.y), y: p.x });
  const T = lineCross(Ma, perp(sub(Gc, Gb)), Mb, perp(sub(Gc, Ga)));
  const TfromThird = lineCross(Mb, perp(sub(Gc, Ga)), Mc, perp(sub(Gb, Ga)));
  const MedialCenter = mul(add(add(A, B), sub(Cc, I)), 0.5);
  const reverse = lineCross(Ga, perp(sub(Mc, Mb)), Gb, perp(sub(Ma, Mc)));
  return { Ma, Mb, Mc, I, Ga, Gb, Gc, D, E, F, T, TfromThird, MedialCenter, reverse };
}

const sizeOf = (A, B, Cc) => Math.max(dist(A, B), dist(B, Cc), dist(Cc, A));

/* Deterministic triangles: seeded random, a lattice sweep, and the applet's own. */
function samples() {
  const out = [C.start({})];
  const rand = rng(20261127);
  for (let i = 0; i < 6000; i++) {
    out.push({
      ...out[0],
      A: { x: 15 + rand() * 390, y: 15 + rand() * 330 },
      B: { x: 15 + rand() * 390, y: 15 + rand() * 330 },
      C: { x: 15 + rand() * 390, y: 15 + rand() * 330 },
    });
  }
  // A lattice of long/thin, right, obtuse and near-equilateral triangles.
  const grid = [30, 75, 120, 190, 260, 330, 390];
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid.length; j++) {
      for (let k = 0; k < grid.length; k += 2) {
        out.push({ ...out[0], A: { x: grid[i], y: grid[j] }, B: { x: grid[k], y: 30 }, C: { x: 390, y: 330 } });
      }
    }
  }
  return out;
}

const positions = samples();
const usable = positions.filter((s) => C.compute(s).valid);

check("the sample has both valid and flat triangles", usable.length > 4000 && usable.length < positions.length);

/* The core's Java-style incenter against the side-length formula. */
{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = reference(s.A, s.B, s.C);
    worst = Math.max(worst, dist(m.I, ref.I) / sizeOf(s.A, s.B, s.C));
  }
  check("incenter: rotated bisectors == barycentric weights", worst < 1e-7, `worst relative error ${worst}`);
}

/* The touch points against the equal-tangent formula. */
{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = reference(s.A, s.B, s.C);
    const scale = sizeOf(s.A, s.B, s.C);
    for (const name of ["Ga", "Gb", "Gc"]) worst = Math.max(worst, dist(m[name], ref[name]) / scale);
  }
  check("touch points == equal tangent lengths", worst < 1e-7, `worst relative error ${worst}`);
}

/* The three feet against an independent projection. */
{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = reference(s.A, s.B, s.C);
    const scale = sizeOf(s.A, s.B, s.C);
    for (const name of ["D", "E", "F"]) worst = Math.max(worst, dist(m[name], ref[name]) / scale);
  }
  check("D, E, F are the perpendicular feet", worst < 1e-6, `worst relative error ${worst}`);
}

/* The applet's Cramer intersection against a parametric one. */
{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = reference(s.A, s.B, s.C);
    worst = Math.max(worst, dist(m.T, ref.T) / sizeOf(s.A, s.B, s.C));
  }
  check("concurrency point T matches the second transcription", worst < 1e-6, `worst relative error ${worst}`);
}

/* --------------------------- 3. the page's claims, exhaustively ------------------ */

{
  let failures = 0;
  for (const s of usable) if (!C.claims(s).all) failures++;
  check(`the page's claim holds for ${usable.length} triangles`, failures === 0, `${failures} counterexamples`);
}

{
  let failures = 0;
  for (const s of usable) {
    const q = C.claims(s);
    if (!q.perpendicularMa || !q.perpendicularMb || !q.perpendicularMc) failures++;
  }
  check("MaD, MbE, McF are perpendicular to the opposite contact sides", failures === 0, `${failures} failures`);
}

{
  let failures = 0;
  for (const s of usable) {
    const q = C.claims(s);
    if (!q.firstTwo || !q.thirdPasses || !q.triple) failures++;
  }
  check("the third perpendicular passes through the first two's crossing", failures === 0, `${failures} failures`);
}

{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s);
    worst = Math.max(worst, dist(m.T, C.medialIncenter(m)) / sizeOf(s.A, s.B, s.C));
  }
  check("T is the incenter of the medial triangle (A+B+C-I)/2", worst < 1e-6, `worst relative error ${worst}`);
}

{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = reference(s.A, s.B, s.C);
    worst = Math.max(worst, dist(m.T, ref.MedialCenter) / sizeOf(s.A, s.B, s.C));
  }
  check("Groenman's homothety gives the same center", worst < 1e-6, `worst relative error ${worst}`);
}

{
  let failures = 0;
  for (const s of usable) {
    const q = C.claims(s);
    if (!q.radiusToSideBC || !q.radiusToSideCA || !q.radiusToSideAB) failures++;
  }
  check("the incenter is equidistant from the three sides", failures === 0, `${failures} failures`);
}

{
  let failures = 0;
  for (const s of usable) {
    const q = C.claims(s);
    if (!q.tangentAtA || !q.tangentAtB || !q.tangentAtC) failures++;
  }
  check("equal tangents from each vertex", failures === 0, `${failures} failures`);
}

{
  let failures = 0;
  for (const s of usable) {
    const q = C.claims(s);
    if (!q.bisectorAtA || !q.bisectorAtB || !q.bisectorAtC) failures++;
  }
  check("each angle bisector is perpendicular to the opposite touch chord", failures === 0, `${failures} failures`);
}

{
  let failures = 0;
  for (const s of usable) {
    const q = C.claims(s);
    if (!q.reverseA || !q.reverseB || !q.reverseC || !q.reverseConcurrence) failures++;
  }
  check("Maxwell's converse: reverse perpendiculars meet at I", failures === 0, `${failures} failures`);
}

{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = reference(s.A, s.B, s.C);
    worst = Math.max(worst, dist(m.I, ref.reverse) / sizeOf(s.A, s.B, s.C));
  }
  check("the reverse crossing is the incenter itself", worst < 1e-6, `worst relative error ${worst}`);
}

{
  let worst = 0;
  for (const s of usable) {
    const m = C.compute(s), ref = reference(s.A, s.B, s.C);
    worst = Math.max(worst, perpen(m.Ma, m.D, ref.Gb, ref.Gc));
  }
  check("right angles survive the independent touch points", worst < 1e-7, `worst cosine ${worst}`);
}

/* Flat triangles, the Java guards and the incircle radius. */
{
  let checkedFlat = 0;
  for (const s of positions) {
    const m = C.compute(s);
    if (m.valid) continue;
    checkedFlat++;
    check("flat triangle gives no claim", C.claims(s) === null);
    if (checkedFlat >= 3) break;
  }
  check("flat triangles exist and are refused", checkedFlat === 3);
}

{
  const collinear = { ...C.start({}), A: { x: 20, y: 100 }, B: { x: 200, y: 100 }, C: { x: 390, y: 100 } };
  const m = C.compute(collinear);
  check("a straight line has no incircle to test", !m.valid && C.claims(collinear) === null);
}

{
  let failures = 0;
  for (const s of usable) {
    const m = C.compute(s);
    if (!(m.radius > 0) || Math.abs(m.radius - dist(m.I, m.Ga)) > 1e-7) failures++;
  }
  check("the drawn incircle radius is positive and touches BC", failures === 0, `${failures} failures`);
}

done("gergonne-medial");
