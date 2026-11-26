#!/usr/bin/env node
"use strict";

/*
 * Logic test for baltic-darij-1/baltic-darij-1-core.js.
 *
 *   node porting/check-baltic-darij-1.mjs
 *
 * Checked: the applet's opening triangle; all 32 states of its five checkboxes
 * (including the "equal angles" checkbox being disabled without "lines" or
 * "big circle"); the applet's minimum-separation guard; and every claim on
 * BalticDarij1's page — P,Q,A',H_a concyclic, A'P||AC, A'Q||AB, A'P=A'Q,
 * P the midpoint of BR with R on AC, A,H_a,Q,C on the circle with diameter AC,
 * and QPH_a inversely similar to ABC — at fixed triangles and at 1,500 random
 * ones (acute, right, obtuse and very flat).
 *
 * Section 3 is a second, literal transcription of the applet's own bytecode
 * (GeoSDoub.FindAngleBisector / NearestPoint / FindCircumcenter / Intersect,
 * BalticDarij1Canvas.Compute / Midpoint / GetCircle), written without using any
 * core helper. It is compared with the core's construct over every fixed and
 * random triangle. Section 4 checks concyclicity a third way, with a 4x4
 * determinant, so the claim cannot pass just because both sides use a circle.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("baltic-darij-1/baltic-darij-1-core.js", "BalticDarij1Core");

const pt = (x, y) => ({ x, y });
const sub = (a, b) => pt(a.x - b.x, a.y - b.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const norm = (a) => Math.hypot(a.x, a.y);
const dist = (a, b) => norm(sub(a, b));
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc },
  options: { names: true, rightAngles: false, equalAngles: false, lines: false, bigCircle: false } });

/* ------------------------------ the applet's computation, transcribed again */

function aSq(P, Q) { return (P.x - Q.x) ** 2 + (P.y - Q.y) ** 2; }
function aDist(P, Q) { return Math.sqrt(aSq(P, Q)); }

/* GeoSDoub.ComputeAngle: law of cosines at P. */
function aAngle(P, Q, R) {
  const num = aSq(P, Q) + aSq(P, R) - aSq(Q, R);
  return Math.acos(num / (2 * aDist(P, Q) * aDist(P, R)));
}

/* GeoSDoub.FindOrientation: sign of cross(B-A, C-A). */
function aOrientation(A, B, Cc) {
  const s = Cc.x * (A.y - B.y) + Cc.y * (B.x - A.x) + A.x * B.y - B.x * A.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate: rotate Q about P by angle * orientation. */
function aRotate(P, Q, angleRad, orient) {
  const cs = Math.cos(angleRad), sn = Math.sin(angleRad);
  return pt(P.x + cs * (Q.x - P.x) - orient * sn * (Q.y - P.y),
    P.y + orient * sn * (Q.x - P.x) + cs * (Q.y - P.y));
}

/* GeoSDoub.Intersect: ax+by+c=0 form, NaN when |det| < 1. */
function aIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return pt(NaN, NaN);
  return pt((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* GeoSDoub.FindAngleBisector: bisector foot on BC. */
function aBisector(A, B, Cc) {
  const half = aAngle(A, B, Cc) / 2;
  const ray = aRotate(A, B, half, aOrientation(A, B, Cc));
  return aIntersect(A, ray, B, Cc);
}

/* GeoSDoub.NearestPoint: foot of the perpendicular to the line XY. */
function aNearest(P, X, Y) {
  if (aSq(X, Y) < 0.1) return pt(P.x, P.y);
  const dx = Y.x - X.x, dy = Y.y - X.y;
  const t = ((P.x - X.x) * dx + (P.y - X.y) * dy) / (dx * dx + dy * dy);
  return pt(X.x + dx * t, X.y + dy * t);
}

function aMid(P, Q) { return pt((P.x + Q.x) / 2, (P.y + Q.y) / 2); }

/* GeoSDoub.FindCircumcenter: intersect the perpendicular bisectors. */
function aCircum(P, Q, R) {
  const m1 = aMid(P, Q), m2 = aMid(Q, R);
  const u1 = pt(m1.x + (Q.y - P.y), m1.y - (Q.x - P.x));
  const u2 = pt(m2.x + (R.y - Q.y), m2.y - (R.x - Q.x));
  return aIntersect(m1, u1, m2, u2);
}

/* BalticDarij1Canvas.GetCircle: radius is the average of the three distances. */
function aCircle(P, Q, R) {
  const o = aCircum(P, Q, R);
  return { center: o, radius: (aDist(o, P) + aDist(o, Q) + aDist(o, R)) / 3 };
}

/* BalticDarij1Canvas.Compute, including the "closer than 3" guard. */
function aCompute(s) {
  if (aDist(s.A, s.B) < 3 || aDist(s.A, s.C) < 3) return null;
  const La = aBisector(s.A, s.B, s.C);
  const P = aNearest(s.B, s.A, La);
  const Q = aNearest(s.C, s.A, La);
  const Ha = aNearest(s.A, s.B, s.C);
  const Ap = aMid(s.B, s.C);
  return {
    La: La, P: P, Q: Q, Ha: Ha, Ap: Ap,
    circleAC: aCircle(s.A, s.C, Ha),
    circle: aCircle(P, Q, Ha),
    R: aIntersect(s.A, s.C, s.B, P),
  };
}

/* A third way to test concyclicity: the 4x4 circle determinant after scaling. */
function det3(m) {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}
function det4(m) {
  let sum = 0;
  for (let col = 0; col < 4; col++) {
    const rows = [0, 1, 2, 3].filter((r) => r !== 0);
    const minor = rows.map((r) => [m[r][(col + 1) % 4], m[r][(col + 2) % 4], m[r][(col + 3) % 4]]);
    sum += (col % 2 ? -1 : 1) * m[0][col] * det3(minor);
  }
  return sum;
}
function cyclicDeterminant(s) {
  const g = C.standard(s);
  if (!g) return NaN;
  const scale = Math.max(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A));
  const at = (p) => pt((p.x - g.Ap.x) / scale, (p.y - g.Ap.y) / scale);
  const row = (p) => { const q = at(p); return [q.x, q.y, q.x * q.x + q.y * q.y, 1]; };
  return Math.abs(det4([row(g.P), row(g.Q), row(g.Ha), row(g.Ap)]));
}

/* ------------------------------------------------- 1. start, state and options */

{
  const s = C.start();
  equal("opening A matches BalticDarij1Canvas.init at 400x300", s.A, { x: 160, y: 100 });
  equal("opening B matches BalticDarij1Canvas.init at 400x300", s.B, { x: 400 / 3, y: 200 });
  equal("opening C matches BalticDarij1Canvas.init at 400x300", s.C, { x: 300, y: 200 });
  equal("the applet starts with only names shown", s.options,
    { names: true, rightAngles: false, equalAngles: false, lines: false, bigCircle: false });
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("the opening triangle is computable", C.isComputable(s) && C.construct(s) !== null);
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "A", pt(10, 20));
    return s.A.x === 160 && next.A.x === 10 && next.B.x === s.B.x;
  })());
  check("an unknown handle leaves the position alone", C.withPoint(s, "Z", pt(1, 2)).A.x === 160);
  check("withOption does not change the old options", (() => {
    const next = C.withOption(s, "lines", true);
    return !s.options.lines && next.options.lines && next.options.names;
  })());
  check("the applet's minimum separation is 3", C.MIN_SEP === 3);
  check("A and B too close: the canvas does not compute",
    C.construct(tri(pt(100, 100), pt(102, 101), pt(300, 200))) === null);
  check("A and C too close: the canvas does not compute",
    C.construct(tri(pt(100, 100), pt(300, 200), pt(101, 102))) === null);
  check("collinear corners have no figure",
    C.construct(tri(pt(50, 50), pt(150, 50), pt(300, 50))) === null);
  check("a triangle just above the guard still computes",
    C.construct(tri(pt(100, 100), pt(103.5, 100), pt(100, 200))) !== null);
}

/* ------------------------------------------- 2. the option range, exhaustively */

{
  const keys = ["names", "rightAngles", "equalAngles", "lines", "bigCircle"];
  let tested = 0;
  for (let mask = 0; mask < 32; mask++) {
    const options = {};
    keys.forEach((k, i) => { options[k] = Boolean(mask & (1 << i)); });
    const enabled = Boolean(options.lines || options.bigCircle);
    check(`options ${mask}: equal-angles enabled exactly when lines or big-circle`,
      C.equalAnglesEnabled(options) === enabled);
    const effective = C.effectiveOptions(options);
    check(`options ${mask}: the canvas sees no disabled equal-angle mark`,
      effective.equalAngles === (options.equalAngles && enabled));
    check(`options ${mask}: the other four checkboxes pass through`,
      keys.filter((k) => k !== "equalAngles").every((k) => effective[k] === options[k]));
    const s = C.start();
    let toggled = s;
    for (const k of keys) toggled = C.withOption(toggled, k, options[k]);
    check(`options ${mask}: toggling every checkbox reaches this state`,
      keys.every((k) => toggled.options[k] === options[k]));
    check(`options ${mask}: checkboxes do not move the corners`,
      C.dist(toggled.A, s.A) === 0 && C.dist(toggled.B, s.B) === 0 && C.dist(toggled.C, s.C) === 0);
    tested++;
  }
  check("all 32 checkbox states were exercised", tested === 32);
}

/* ----------------------------------------- 3. fixed triangles and every claim */

const fixed = [
  ["the applet's opening triangle", C.start()],
  ["acute", tri(pt(215, 40), pt(60, 280), pt(340, 280))],
  ["right", tri(pt(60, 250), pt(60, 40), pt(320, 250))],
  ["obtuse at A", tri(pt(60, 150), pt(320, 90), pt(300, 240))],
  ["obtuse at B", tri(pt(180, 40), pt(50, 260), pt(360, 250))],
  ["obtuse at C", tri(pt(40, 40), pt(360, 60), pt(190, 250))],
  ["very flat", tri(pt(40, 150), pt(360, 160), pt(200, 175))],
];

for (const [name, s] of fixed) {
  const cl = C.claims(s);
  const m = C.measurements(s);
  const scale = m.scale;
  check(`${name}: P, Q, A' and H_a are concyclic`, cl.concyclic, JSON.stringify(m.residuals));
  check(`${name}: A'P is parallel to AC`, cl.apParallelAc);
  check(`${name}: A'Q is parallel to AB`, cl.aqParallelAb);
  check(`${name}: A'P equals A'Q`, cl.equalLegs);
  check(`${name}: P is the midpoint of BR, with R on AC`, cl.midpointBR);
  check(`${name}: H_a and Q lie on the circle with diameter AC`, cl.circleAC);
  check(`${name}: QPH_a is inversely similar to ABC`, cl.similarQPH, JSON.stringify(m.residuals));
  check(`${name}: the 4x4 cyclic determinant vanishes`, cyclicDeterminant(s) < 1e-6);
  const built = C.construct(s);
  const expect = aCompute(s);
  check(`${name}: the applet's bisector foot matches the core`,
    closePoint(expect.La, built.La, 1e-6 * scale));
  check(`${name}: the applet's P, Q, H_a, A' match the core`,
    ["P", "Q", "Ha", "Ap"].every((k) => closePoint(expect[k], built[k], 1e-6 * scale)));
  check(`${name}: the applet's R matches the core`, closePoint(expect.R, built.R, 1e-6 * scale));
  check(`${name}: both circles match the core`,
    closePoint(expect.circle.center, built.circle.center, 1e-6 * scale) &&
    close(expect.circle.radius, built.circle.radius, 1e-6 * scale) &&
    closePoint(expect.circleAC.center, built.circleAC.center, 1e-6 * scale) &&
    close(expect.circleAC.radius, built.circleAC.radius, 1e-6 * scale));
}

/* ---------------------------- 4. many random triangles, claims and transcript */

{
  const rand = rng(2492);
  let tested = 0, skipped = 0;
  let maxCyclic = 0, maxApplet = 0;
  const finiteCircle = (c) => Number.isFinite(c.center.x) && Number.isFinite(c.center.y) && Number.isFinite(c.radius);
  const finiteBuild = (b) => b && ["La", "P", "Q", "Ha", "Ap", "R"].every((k) =>
    Number.isFinite(b[k].x) && Number.isFinite(b[k].y)) &&
    finiteCircle(b.circle) && finiteCircle(b.circleAC);
  for (let trial = 0; trial < 8000 && tested < 1500; trial++) {
    const s = tri(pt(10 + rand() * 380, 10 + rand() * 280),
      pt(10 + rand() * 380, 10 + rand() * 280),
      pt(10 + rand() * 380, 10 + rand() * 280));
    if (Math.abs(cross(sub(s.B, s.A), sub(s.C, s.A))) < 250) continue;
    if (dist(s.A, s.B) < 20 || dist(s.A, s.C) < 20) continue;
    if (!C.isComputable(s)) continue;
    const built = C.construct(s);
    const expect = aCompute(s);
    if (!finiteBuild(built) || !finiteBuild(expect)) { skipped++; continue; }
    tested++;
    const cl = C.claims(s);
    const m = C.measurements(s);
    const tol = 1e-6 * m.scale;
    maxCyclic = Math.max(maxCyclic, m.residuals.concyclic);
    const keys = ["La", "P", "Q", "Ha", "Ap", "R"];
    const worstApplet = Math.max(
      ...keys.map((k) => Math.max(Math.abs(expect[k].x - built[k].x), Math.abs(expect[k].y - built[k].y))),
      Math.abs(expect.circle.radius - built.circle.radius),
      Math.abs(expect.circleAC.radius - built.circleAC.radius),
    );
    maxApplet = Math.max(maxApplet, worstApplet / m.scale);
    if (!Object.values(cl).every(Boolean)) {
      check(`random ${trial}: every page claim holds`, false, JSON.stringify({ residuals: m.residuals, cl }));
    }
    if (worstApplet > tol) {
      check(`random ${trial}: applet transcription matches the core`, false, `${worstApplet} > ${tol}`);
    }
    if (cyclicDeterminant(s) > 1e-6) {
      check(`random ${trial}: the cyclic determinant vanishes`, false);
    }
  }
  check(`1,500 random triangles were tested (${tested}, ${skipped} right-angle cases skipped)`, tested === 1500);
  check(`concyclic residual stays tiny (worst ${maxCyclic.toExponential(2)})`, maxCyclic < 1e-7);
  check(`applet vs core stays tiny (worst ${maxApplet.toExponential(2)})`, maxApplet < 1e-7);
}

done("baltic-darij-1");
