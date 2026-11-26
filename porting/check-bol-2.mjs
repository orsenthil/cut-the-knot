#!/usr/bin/env node
"use strict";

/*
 * Logic test for bol-2/bol-2-core.js.
 *
 *   node porting/check-bol-2.mjs
 *
 * The exact claim from the applet's page is: let AB be the diameter of a
 * semicircle, D any other point on it; the tangents at B and D meet at T; DE
 * is perpendicular to AB; AT meets DE at F; then DF = FE. The page's proof
 * also asserts TB = TD, TH = TB (H = AD ∩ tangent at B), and DE ∥ BH.
 *
 * Section 1 checks the start position and the default switches. Section 2
 * checks the claim and its proof over a dense sweep of the whole open arc
 * (four diameters, 48 positions each) — every case the geometry allows, not
 * a handful of samples. Section 3 transcribes BOL2Canvas's own primitives
 * from the bytecode a second time (GetPerp, Tangent, NearestPoint, Intersect,
 * MidPoint, GetCircle) and compares all constructed points with the core at
 * the same 192 configurations. Section 4 checks dragging A, B and D.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bol-2/bol-2-core.js", "Bol2Core");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (p, q, tol) => Boolean(p && q) && dist(p, q) <= tol;
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start({});
  check("start has the applet's horizontal diameter", s.A.y === 270 && s.B.y === 270 && s.A.x === 60 && s.B.x === 360);
  check("start keeps names on, hint and statement off", s.showNames === true && s.showHint === false && s.showStatement === false);
  check("start puts D on the upper arc", s.D.y < s.A.y && C.measurements(s).onArc);
  check("an illustration can never be won or lost", C.result(s) === null);
  check("start clamps a D too close to A", C.start({ theta: Math.PI - 0.001 }).theta === C.MAX_THETA);
  check("start clamps a D too close to B", C.start({ theta: 0.001 }).theta === C.MIN_THETA);

  const m = C.measurements(s);
  check("start E is the foot from D to AB", Math.abs(m.E.x - m.D.x) < 1e-9 && Math.abs(m.E.y - s.A.y) < 1e-9);
  const claims = C.claims(s);
  check("all page claims hold at the start", claims && Object.values(claims).every(Boolean));
}

/* ----------------------------- 2. the page's claim over the whole open arc */

const radii = [60, 100, 150, 210];
const count = 48;
const allClaims = [
  "onArc", "DEperpendicular", "tangentsMeet", "tangentLengths",
  "FOnLines", "bisected", "rightAngleADB", "hintSemicircle", "parallelDE_BH",
];
let sweeps = 0;

for (const radius of radii) {
  const A = { x: 200 - radius, y: 260 };
  const B = { x: 200 + radius, y: 260 };
  const O = { x: 200, y: 260 };
  for (let i = 0; i < count; i++) {
    const theta = 0.12 + (Math.PI - 0.24) * (i / (count - 1)); // open arc, ends excluded
    const D = C.arcPoint(O, radius, theta);
    const s = { A, B, D, theta, showNames: true, showHint: false, showStatement: false };
    const m = C.measurements(s);
    const tol = 1e-7 * radius;
    const claims = C.claims(s);
    sweeps++;

    check(`DF = FE at r=${radius}, i=${i}`, claims.bisected && Math.abs(m.ratio - 1) < 1e-8);
    check(`F is the midpoint of DE at r=${radius}, i=${i}`, near(m.F, mid(m.D, m.E), tol));
    check(`F lies on the perpendicular at r=${radius}, i=${i}`, claims.FOnLines);
    check(`tangent lengths equal at r=${radius}, i=${i}`, claims.tangentLengths && Math.abs(m.TB - radius * Math.tan(theta / 2)) < tol);
    check(`H makes a half-circle with centre T at r=${radius}, i=${i}`, claims.hintSemicircle && Math.abs(m.TH - m.TB) < tol);
    check(`angle ADB is right at r=${radius}, i=${i}`, claims.rightAngleADB);
    check(`DE parallel BH at r=${radius}, i=${i}`, claims.parallelDE_BH);
    check(`every claim on the page holds at r=${radius}, i=${i}`, allClaims.every((k) => claims[k]));
  }
}
check("the sweep really covered 192 configurations", sweeps === 4 * 48);

/* -------- 3. a second, literal transcription of BOL2Canvas's own geometry */

/* GetPerp(p, q) from the bytecode: p + (-(q.y-p.y), q.x-p.x).
 * Tangent(circle, p) calls it with the point first and the centre second:
 * the direction is (p.y-c.y, c.x-p.x), perpendicular to the radius. */
function getPerp(p, q) {
  return { x: p.x + p.y - q.y, y: p.y - p.x + q.x };
}
function tangent(circle, p) {
  const q = getPerp(p, circle.c); // DoubLine(q, p), clipped by SetBounds in the applet
  return { a: q, b: p };
}
function nearestPoint(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  return { x: a.x + dx * t, y: a.y + dy * t };
}
function intersectLine(a, b, c, d) {
  /* DoubLine is slope-intercept; the tangent at B is vertical, so guard it. */
  const vertical = (p, q) => Math.abs(q.x - p.x) < 1e-12;
  if (vertical(a, b)) {
    if (vertical(c, d)) return null;
    const t = (a.x - c.x) / (d.x - c.x);
    return { x: a.x, y: c.y + t * (d.y - c.y) };
  }
  if (vertical(c, d)) {
    const t = (c.x - a.x) / (b.x - a.x);
    return { x: c.x, y: a.y + t * (b.y - a.y) };
  }
  const m1 = (b.y - a.y) / (b.x - a.x), m2 = (d.y - c.y) / (d.x - c.x);
  const k1 = a.y - m1 * a.x, k2 = c.y - m2 * c.x;
  if (Math.abs(m1 - m2) < 1e-12) return null;
  const x = (k2 - k1) / (m1 - m2);
  return { x, y: m1 * x + k1 };
}
function findCircumcenter(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
}
/* GetCircle: circumcentre, with the mean of the three distances as radius. */
function getCircle(a, b, c) {
  const center = findCircumcenter(a, b, c);
  if (!center) return null;
  return { c: center, r: (dist(center, a) + dist(center, b) + dist(center, c)) / 3 };
}

let compared = 0;
for (const radius of radii) {
  const A = { x: 200 - radius, y: 260 };
  const B = { x: 200 + radius, y: 260 };
  const O = C.midpoint(A, B);
  const circle = { c: O, r: C.distance(A, O) };
  /* init(): Bp = (B.x, height - B.y), a vertical tangent through B. */
  const height = A.y + radius;
  const Bp = { x: B.x, y: height - B.y };
  for (let i = 0; i < count; i++) {
    const theta = 0.12 + (Math.PI - 0.24) * (i / (count - 1));
    const D = C.arcPoint(O, radius, theta);
    const s = { A, B, D, theta, showNames: true, showHint: false, showStatement: false };
    const m = C.measurements(s);
    const tol = 1e-7 * radius;
    compared++;

    /* Draw(): T = Intersect(B,Bp, Tangent(Circle,D)). */
    const tan = tangent(circle, D);
    const Ta = intersectLine(B, Bp, tan.a, tan.b);
    check(`applet T matches core at r=${radius}, i=${i}`, near(Ta, m.T, tol));
    /* Draw(): E = NearestPoint(D,A,B), F = Intersect(A,T,D,E),
     * H = Intersect(A,D,B,Bp). */
    const Ea = nearestPoint(D, A, B);
    const Fa = intersectLine(A, Ta, D, Ea);
    const Ha = intersectLine(A, D, B, Bp);
    check(`applet E matches core at r=${radius}, i=${i}`, near(Ea, m.E, tol));
    check(`applet F matches core at r=${radius}, i=${i}`, near(Fa, m.F, tol));
    check(`applet H matches core at r=${radius}, i=${i}`, near(Ha, m.H, tol));
    /* ShowHint(): GetCircle(D,B,H) is centred at T with radius TB. */
    const hint = getCircle(D, B, Ha);
    check(`applet's hint circle has centre T at r=${radius}, i=${i}`,
      hint && near(hint.c, Ta, 1e-6 * radius) && Math.abs(hint.r - dist(Ta, B)) < 1e-6 * radius);
    /* Extend(p,q) = 2q-p, used by the applet to carry lines to the edge. */
    const ext = { x: 2 * D.x - O.x, y: 2 * D.y - O.y };
    check(`applet Extend reaches twice the radius at r=${radius}, i=${i}`,
      Math.abs(dist(O, ext) - 2 * radius) < 1e-9);
  }
}
check("the transcription covered the same 192 configurations", compared === 192);

/* ------------------------------------------- 4. dragging the three points */

{
  const random = rng(42);
  for (let i = 0; i < 24; i++) {
    const before = C.start({ theta: 0.5 + random() * 1.6 });
    const p = { x: 40 + random() * 320, y: 120 + random() * 120 };
    const after = C.withPoint(before, "D", p);
    const m = C.measurements(after);
    check(`dragging D keeps it on the arc, case ${i}`, m.onArc &&
      m.theta >= C.MIN_THETA - 1e-12 && m.theta <= C.MAX_THETA + 1e-12);
    const cl = C.claims(after);
    check(`the claim survives dragging D, case ${i}`, cl && cl.bisected && cl.tangentLengths);
  }
  const base = C.start({});
  const left = C.withPoint(base, "A", { x: 90, y: 270 });
  check("dragging A changes the diameter but keeps D at its angle", left.A.x === 90 && Math.abs(left.theta - base.theta) < 1e-12);
  check("the claim still holds after dragging A", C.claims(left).bisected);
  const right = C.withPoint(base, "B", { x: 300, y: 270 });
  check("dragging B keeps A fixed", right.A.x === base.A.x && right.B.x === 300);
  check("the claim still holds after dragging B", C.claims(right).bisected);
  const shorter = C.withPoint(base, "A", { x: 400, y: 270 });
  check("A cannot be dragged past B", shorter.A.x <= shorter.B.x - 60);
  const longer = C.withPoint(base, "B", { x: 0, y: 270 });
  check("B cannot be dragged past A", longer.B.x >= longer.A.x + 60);
}

done("bol-2");
