#!/usr/bin/env node
"use strict";

/*
 * Logic test for cross-circle/cross-circle-core.js.
 *
 *   node porting/check-cross-circle.mjs
 *
 * Checked: CrossCircleCanvas.init's four starting points, its random P rule,
 * the handle clamps and Hint; then a second, literal transcription of the
 * applet's own Draw methods (NearestPoint, FindCircumcenter/GetCircle, GetOther
 * and Perp) compared with the core on the start picture, 72 places for P on
 * the circumcircle, over a thousand random triangles with P anywhere inside
 * the board, the sqrt(0.1) snap zone and the degenerate cases. Finally the
 * page's claim is tested on every non-degenerate picture: both intersections
 * of each side line lie on the circle, the three new perpendiculars pass
 * through the half-turn image of P, and the three lines meet there.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cross-circle/cross-circle-core.js", "CrossCircleCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePt = (p, q, tol) => Boolean(p && q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const nanEqual = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || close(a, b, 1e-9);
const samePt = (p, q, tol = 1e-8) => Boolean(p && q) &&
  (nanEqual(p.x, q.x) && nanEqual(p.y, q.y) ||
    (close(p.x, q.x, tol) && close(p.y, q.y, tol)));
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/* ----------- a second transcription, straight from the applet's bytecode ---- */

function jSqDist(p, q) { return (p.x - q.x) ** 2 + (p.y - q.y) ** 2; }
function jDist(p, q) { return Math.sqrt(jSqDist(p, q)); }

/* GeoSDoub.Intersect: a1 = P1.y−P2.y, b1 = P2.x−P1.x, c1 = P1.x·P2.y−P1.y·P2.x. */
function jIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / den, y: (c1 * a2 - c2 * a1) / den };
}

/* GeoSDoub.FindCircumcenter, then CrossCircleCanvas.GetCircle's average radius. */
function jCircle(F1, F2, F3) {
  const m12 = { x: (F1.x + F2.x) / 2, y: (F1.y + F2.y) / 2 };
  const m23 = { x: (F2.x + F3.x) / 2, y: (F2.y + F3.y) / 2 };
  const d1 = { x: m12.x + F2.y - F1.y, y: m12.y - F2.x + F1.x };
  const d2 = { x: m23.x + F3.y - F2.y, y: m23.y - F3.x + F2.x };
  const centre = jIntersect(m12, d1, m23, d2);
  const r = (jDist(centre, F1) + jDist(centre, F2) + jDist(centre, F3)) / 3;
  return { x: centre.x, y: centre.y, r };
}

/* GeoSDoub.NearestPoint(P,X,Y), including its SqDist(X,P) < 0.1 early return. */
function jNearest(P, X, Y) {
  const dx = Y.x - X.x, dy = Y.y - X.y;
  if (jSqDist(X, P) < 0.1) return { x: P.x, y: P.y };
  const t = ((P.x - X.x) * dx + (P.y - X.y) * dy) / (dx * dx + dy * dy);
  return { x: X.x + dx * t, y: X.y + dy * t };
}

/* CrossCircleCanvas.GetOther(U,V,foot,circle): 2·projection − foot. */
function jOther(U, V, foot, circle) {
  const n = jNearest(circle, U, V);
  return { x: 2 * n.x - foot.x, y: 2 * n.y - foot.y };
}

/* CrossCircleCanvas.Perp(U,V,other): the endpoint of the perpendicular stub. */
function jPerp(U, V, other) {
  return { x: other.x + U.y - V.y, y: other.y - U.x + V.x };
}

/* CrossCircleCanvas.Draw, in bytecode order. */
function jDraw(s) {
  const A = s.A, B = s.B, CC = s.C, P = s.P;
  const f2 = jNearest(P, B, CC);
  const f3 = jNearest(P, CC, A);
  const f4 = jNearest(P, A, B);
  const k = jCircle(f2, f3, f4);
  const o6 = jOther(B, CC, f2, k);
  const o7 = jOther(A, CC, f3, k);
  const o8 = jOther(B, A, f4, k);
  const e9 = jPerp(B, CC, o6);
  const e10 = jPerp(CC, A, o7);
  const e11 = jPerp(A, B, o8);
  const reflected = { x: 2 * k.x - P.x, y: 2 * k.y - P.y };
  const projections = [
    jNearest(k, B, CC), jNearest(k, CC, A), jNearest(k, B, A),
  ];
  return { feet: [f2, f3, f4], circle: k, others: [o6, o7, o8],
    ends: [e9, e10, e11], reflected, projections };
}

/* Every value in Draw must agree with the core, including NaN on degeneracy. */
function compareCore(label, states) {
  let worst = 0, bad = 0;
  for (const s of states) {
    const a = C.compute(s), b = jDraw(s);
    const pairs = [
      ["circle", a.circle, b.circle],
      ["reflected", a.reflected, b.reflected],
      ["feet", a.feet, b.feet],
      ["others", a.others, b.others],
      ["ends", a.ends, b.ends],
      ["projections", a.projections, b.projections],
    ];
    for (const [, core, java] of pairs) {
      const group = Array.isArray(core) ? core : [core];
      const jgroup = Array.isArray(java) ? java : [java];
      for (let i = 0; i < group.length; i++) {
        if (!samePt(group[i], jgroup[i])) { bad++; continue; }
        if (!Number.isFinite(group[i].x) || !Number.isFinite(jgroup[i].x)) continue;
        worst = Math.max(worst, Math.abs(group[i].x - jgroup[i].x),
          Math.abs(group[i].y - jgroup[i].y));
      }
    }
  }
  check(label, bad === 0 && worst < 1e-7,
    `${states.length} drawings, ${bad} mismatches, worst ${worst.toExponential(2)}`);
  return worst;
}

/* ------------------------------------------------------- 1. the starting picture */

const start = C.start();
{
  const cx = 200, cy = 150, r = 75; // Java integer division: 300 / 4
  const expect = (a) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  check("init places A at angle −1.6", samePt(start.A, expect(-1.6), 1e-12));
  check("init places B at angle −4", samePt(start.B, expect(-4), 1e-12));
  check("init places C at angle −0.2", samePt(start.C, expect(-0.2), 1e-12));
  const tri = jCircle(start.A, start.B, start.C);
  const gap = Math.max(1, tri.r - 20);
  const expectedP = {
    x: tri.x + gap * Math.cos(C.START_ANGLE),
    y: tri.y + gap * Math.sin(C.START_ANGLE),
  };
  check("init places P on the triangle's circle, 20 units in", samePt(start.P, expectedP, 1e-12));
  check("Hint starts off", start.hint === false);
  check("the illustration has no win or loss", !("result" in C) && !("move" in C));
}

{
  const moved = C.randomP(start, () => 0.25);
  const tri = jCircle(start.A, start.B, start.C);
  const gap = Math.max(1, tri.r - 20);
  const expected = { x: tri.x + gap * Math.cos(Math.PI / 4),
    y: tri.y + gap * Math.sin(Math.PI / 4) };
  check("Move P uses the applet's random angle and radius", samePt(moved.P, expected, 1e-12));
  check("Move P leaves A, B and C alone",
    samePt(moved.A, start.A) && samePt(moved.B, start.B) && samePt(moved.C, start.C));
}

/* ------------------------------------------------------------ 2. handle rules */

{
  const moved = C.withPoint(start, "P", { x: -500, y: 1000 });
  check("a handle is clamped into the board",
    moved.P.x === 12 && moved.P.y === C.VIEW.height - 12);
  check("clamping does not change the old position", start.P.x < 400 && start.P.y < 300);
  check("an unknown handle is a no-op", C.withPoint(start, "Q", { x: 0, y: 0 }) === start);
  check("Hint toggles without mutating", C.withHint(start, true).hint === true && start.hint === false);
}

/* --------------------------- 3. the applet's own method, over many drawings */

/* P at 72 places on the triangle's circumcircle, as the applet may start it. */
const tri = jCircle(start.A, start.B, start.C);
const onCircle = [];
for (let i = 0; i < 72; i++) {
  const a = (Math.PI * i) / 72;
  onCircle.push({ ...start, P: {
    x: tri.x + Math.max(1, tri.r - 20) * Math.cos(a),
    y: tri.y + Math.max(1, tri.r - 20) * Math.sin(a),
  } });
}
compareCore("72 starts around the triangle's circle", onCircle);

/* Random triangles and random P: a dense sweep of the reachable board. */
const next = rng(20261127);
const randomStates = [];
for (let i = 0; i < 1400; i++) {
  const p = () => ({ x: 20 + next() * 360, y: 20 + next() * 260 });
  randomStates.push({ A: p(), B: p(), C: p(), P: p(), hint: false });
}
compareCore("1400 random triangles with P anywhere", randomStates);

/* The applet's NearestPoint snaps P to itself within sqrt(0.1) of a vertex. */
const snaps = [
  { ...start, P: { x: start.B.x + 0.05, y: start.B.y + 0.02 } },
  { ...start, P: { x: start.C.x - 0.1, y: start.C.y + 0.1 } },
  { ...start, P: { x: start.A.x, y: start.A.y + 0.2 } },
];
compareCore("the three sqrt(0.1) snap zones", snaps);
check("the snap really returns P as the foot",
  samePt(C.compute(snaps[0]).feet[0], snaps[0].P, 0) &&
  samePt(jDraw(snaps[0]).feet[0], snaps[0].P, 0));

/* Degenerate drawings: P on the circumcircle (Simson line), or a flat triangle. */
const degenerate = [
  { ...start, P: start.A },
  { ...start, P: start.B },
  { ...start, P: start.C },
  { A: { x: 50, y: 50 }, B: { x: 150, y: 50 }, C: { x: 300, y: 50 },
    P: { x: 180, y: 200 }, hint: false },
];
compareCore("four degenerate drawings", degenerate);
check("a flat triangle has no pedal circle", !C.drawn(C.compute(degenerate[3])));
check("P on the circumcircle has no pedal circle",
  degenerate.slice(0, 3).every((s) => !C.drawn(C.compute(s))));

/* ---------------------------------------------- 4. the page's claims, exhaustively */

let tested = 0, radiusWorst = 0, chordWorst = 0, perpWorst = 0, meetWorst = 0;
for (const s of randomStates.concat(onCircle)) {
  const a = C.compute(s);
  if (!C.drawn(a) || !Number.isFinite(a.circle.r) || a.circle.r > 500) continue;
  // Away from the snap zone the applet's own rule is ordinary projection.
  const sideEnds = [[s.B, s.C], [s.C, s.A], [s.A, s.B]];
  if (sideEnds.some(([u, v]) => Math.min(jSqDist(u, s.P), jSqDist(v, s.P)) < 0.1)) continue;
  tested++;
  const scale = Math.max(1, a.circle.r);
  radiusWorst = Math.max(radiusWorst, Math.abs(dist(a.circle, a.reflected) -
    dist(a.circle, s.P)) / scale);
  for (let i = 0; i < 3; i++) {
    // Both ends of each chord must lie on the circle through the three feet.
    chordWorst = Math.max(chordWorst,
      Math.abs(dist(a.circle, a.feet[i]) - a.circle.r) / scale,
      Math.abs(dist(a.circle, a.others[i]) - a.circle.r) / scale);
    // The new perpendicular starts at the second point and passes through S.
    perpWorst = Math.max(perpWorst,
      Math.abs(cross(a.others[i], a.ends[i], a.reflected)) /
        (dist(a.others[i], a.ends[i]) * scale));
  }
  meetWorst = Math.max(meetWorst,
    dist(a.meet, a.reflected) / scale, C.concurrenceError(a) / scale);
}
check("enough non-degenerate pictures were checked", tested > 1200, `${tested} drawings`);
check("the circle is centred midway between P and S", radiusWorst < 1e-10,
  `worst ${radiusWorst.toExponential(2)}`);
check("both intersections of each side lie on the circle", chordWorst < 1e-10,
  `worst ${chordWorst.toExponential(2)}`);
check("each new perpendicular passes through the reflected point", perpWorst < 1e-10,
  `worst ${perpWorst.toExponential(2)}`);
check("the three new perpendiculars concur at the reflected point", meetWorst < 1e-9,
  `worst ${meetWorst.toExponential(2)}`);
check("the start picture itself shows the concurrence",
  C.reflectionError(C.compute(start)) < 1e-8 && C.concurrenceError(C.compute(start)) < 1e-8);

done("cross-circle");
