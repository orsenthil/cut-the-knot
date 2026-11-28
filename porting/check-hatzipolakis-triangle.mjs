#!/usr/bin/env node
"use strict";

/*
 * Logic test for hatzipolakis-triangle/hatzipolakis-triangle-core.js.
 *
 *   node porting/check-hatzipolakis-triangle.mjs
 *
 * Checked: the start position against the applet's init(); the two numbered
 * claims on the cut-the-knot page (M,N,E,F collinear; X,Y,M and X,Z,N
 * straight) and every step of its proof, on fixed cases and on thousands of
 * random triangles; the page's signed length chain, which is only true as a
 * length after an absolute value; and a second, independent transcription of
 * the applet's own Compute() — GeoSDoub.FindIncenter by rotated bisectors and
 * line intersection, NearestPoint by the applet's parameter formula, and the
 * average inradius — compared point by point over hundreds of configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hatzipolakis-triangle/hatzipolakis-triangle-core.js", "HatzipolakisTriangleCore");

const near = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const nearPoint = (p, q, tol) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const area = (A, B, Cc) => Math.abs((B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x)) / 2;
const cfg = (A, B, Cc) => ({ A, B, C: Cc, width: 400, height: 300 });
const allClaims = (s) => C.claims(s);
const everyClaim = (s) => Object.values(allClaims(s)).every(Boolean);

/* ------------------------------------------------------------------------- *
 * A second transcription of the applet's bytecode, using different formulas.
 * GeoSDoub.FindIncenter rotates each side by half the angle at its vertex and
 * intersects the two bisectors; NearestPoint projects with a parameter.
 * ------------------------------------------------------------------------- */

function appletAngle(P, Q, R) { // ComputeAngle: angle at P
  const pq = dist(P, Q), pr = dist(P, R), qr = dist(Q, R);
  const v = (pq * pq + pr * pr - qr * qr) / (2 * pq * pr);
  return Math.acos(Math.max(-1, Math.min(1, v)));
}

function appletOrientation(A, B, Cc) {
  return (Cc.x * (A.y - B.y) + Cc.y * (B.x - A.x) + A.x * B.y - B.x * A.y) > 0 ? 1 : -1;
}

function appletRotate(P, Q, ang, ori) { // rotate Q about P by ori*ang
  const cs = Math.cos(ang), sn = Math.sin(ang);
  return {
    x: P.x + cs * (Q.x - P.x) - ori * sn * (Q.y - P.y),
    y: P.y + ori * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

function appletIntersect(P, Q, R, S) {
  const d4 = P.y - Q.y, d6 = Q.x - P.x, d8 = P.x * Q.y - P.y * Q.x;
  const d10 = R.y - S.y, d12 = S.x - R.x, d14 = R.x * S.y - R.y * S.x;
  const nx = d6 * d14 - d12 * d8, ny = d8 * d10 - d14 * d4;
  const den = d4 * d12 - d10 * d6;
  if (Math.abs(den) < 1) return { x: NaN, y: NaN }; // the applet returns NaN here
  return { x: nx / den, y: ny / den };
}

function appletIncenter(A, B, Cc) {
  const halfA = appletAngle(A, B, Cc) / 2;
  const halfB = appletAngle(B, A, Cc) / 2;
  const ori = appletOrientation(A, B, Cc);
  const rayA = appletRotate(A, B, halfA, ori);
  const rayB = appletRotate(B, Cc, halfB, ori);
  return appletIntersect(A, rayA, B, rayB);
}

function appletFoot(P, Q, R) { // GeoSDoub.NearestPoint(P, Q, R)
  const dx = R.x - Q.x, dy = R.y - Q.y;
  if (dx * dx + dy * dy < 0.1) return { x: Q.x, y: Q.y };
  const t = (dx * (P.x - Q.x) + dy * (P.y - Q.y)) / (dx * dx + dy * dy);
  return { x: Q.x + dx * t, y: Q.y + dy * t };
}

function appletMid(P, Q) {
  return { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
}

/* HatzipolakisTriangleCanvas.Compute() in the order the bytecode executes it. */
function appletCompute(s) {
  const { A, B, C } = s;
  if (dist(A, B) < 2 || dist(B, C) < 2 || dist(C, A) < 2) return { ok: false };
  const I = appletIncenter(A, B, C);
  const X = appletFoot(I, B, C), Y = appletFoot(I, C, A), Z = appletFoot(I, A, B);
  const D = appletMid(B, C), E = appletMid(C, A), F = appletMid(A, B);
  const M = appletFoot(A, I, B), N = appletFoot(A, I, C);
  const radius = (dist(I, X) + dist(I, Y) + dist(I, Z)) / 3; // GetInTouchFrom
  return { ok: true, I, X, Y, Z, D, E, F, M, N, radius };
}

/* ------------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  equal("start A is (3W/4, H/7) with integer division", s.A, { x: 300, y: 42 });
  equal("start B is (W/5, 4H/5) with integer division", s.B, { x: 80, y: 240 });
  equal("start C is (5W/11, 6H/7) with integer division", s.C, { x: 181, y: 257 });
  const ci = C.construction(s);
  check("the starting triangle is valid for Compute()", ci.ok);
  check("a fresh illustration has no win or loss", C.result(s) === null);
  check("withPoint does not change the old position", (() => {
    const n = C.withPoint(s, "B", { x: 90, y: 90 });
    return s.B.x === 80 && n.B.x === 90 && n.A.x === s.A.x && n.C.x === s.C.x;
  })());
  check("withPoint ignores an unknown handle", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === s.A.x);
  check("the start's incenter is inside the triangle", (() => {
    const cross = C.cross;
    return [cross(s.A, s.B, ci.I), cross(s.B, s.C, ci.I), cross(s.C, s.A, ci.I)]
      .every((v) => Math.abs(v) > 0);
  })());
  check("the start's incircle radius is positive", ci.radius > 0);
}

/* -------------------------------------- 2. fixed configurations, every claim */

const fixed = [
  ["the applet's start", C.start()],
  ["a tall triangle", cfg({ x: 200, y: 30 }, { x: 60, y: 250 }, { x: 340, y: 250 })],
  ["a wide triangle", cfg({ x: 200, y: 60 }, { x: 20, y: 140 }, { x: 380, y: 140 })],
  ["an obtuse triangle", cfg({ x: 120, y: 70 }, { x: 350, y: 240 }, { x: 90, y: 250 })],
  ["AB shorter than BC", cfg({ x: 40, y: 40 }, { x: 150, y: 30 }, { x: 370, y: 250 })],
  ["nearly equilateral", cfg({ x: 200, y: 50 }, { x: 82, y: 250 }, { x: 318, y: 250 })],
  ["a thin triangle", cfg({ x: 200, y: 120 }, { x: 20, y: 180 }, { x: 380, y: 184 })],
];

for (const [name, s] of fixed) {
  const c = C.construction(s);
  const cl = allClaims(s);
  check(`${name}: the construction is valid`, c.ok);
  check(`${name}: claim (i), M, N, E, F are collinear`, c.ok && cl.mnEfCollinear);
  check(`${name}: claim (ii) first half, X, Y, M are straight`, c.ok && cl.xyMCollinear);
  check(`${name}: claim (ii) second half, X, Z, N are straight`, c.ok && cl.xzNCollinear);
  check(`${name}: the right angles at M and N`, cl.rightAtM && cl.rightAtN);
  check(`${name}: AF = BF = FM = AB/2`, cl.fmHalfAB && cl.fmEqualsAF && cl.fmEqualsBF);
  check(`${name}: AE = CE = EN = AC/2`, cl.enHalfAC);
  check(`${name}: EM = EY and FN = FZ`, cl.emEqualsEy && cl.fnEqualsFz);
  check(`${name}: EM = |AB - BC|/2`, cl.lengthChain);
  check(`${name}: the tangency lengths from each vertex match`, cl.tangentLengths);
  check(`${name}: Cabart's midpoint claim`, cl.cabartMidpoint);
  check(`${name}: the page's two angle equalities`, cl.angleXceEqualsCem && cl.angleXycEqualsEym);
  check(`${name}: every claim holds at once`, everyClaim(s));
}

/* ---------------------------------- 3. the page's claims, thousands of cases */

{
  const rand = rng(5392);
  let tested = 0, supplementary = 0, signedFails = 0;
  for (let i = 0; i < 3000; i++) {
    const s = cfg(
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
    );
    const c = C.construction(s);
    if (!c.ok || area(s.A, s.B, s.C) < 200) continue;
    tested++;
    const cl = allClaims(s);
    for (const key of Object.keys(cl)) {
      if (!cl[key]) check(`trial ${i}: ${key} fails at ${JSON.stringify(s)}`, false);
    }
    const m = C.measurements(s);
    if (Math.abs(m.angleXCE + m.angleCEM - Math.PI) < 1e-7) supplementary++;
    /* EM = (AB - BC)/2 in the page is a signed segment; the length needs |.|. */
    if (m.EM > Math.abs(c.sides.c - c.sides.a) / 2 + 1e-6 * m.scale) signedFails++;
  }
  check(`all claims hold on ${tested} well-formed random triangles`, tested > 2500);
  check("no configuration failed a claim", signedFails === 0);
  check("the page's ray-angle step is supplementary in some triangles", supplementary > 0);
  check("the page's signed length chain is not always a positive length", (() => {
    const s = cfg({ x: 40, y: 40 }, { x: 150, y: 30 }, { x: 370, y: 250 });
    const c = C.construction(s), m = C.measurements(s);
    return c.sides.c - c.sides.a < 0 && m.EM > 0 &&
      near(m.EM, (c.sides.a - c.sides.c) / 2, 1e-6 * m.scale);
  })());
}

/* ------------------------------- 4. the applet's Compute() vs the core layout */

{
  const rand = rng(94211);
  const cases = [...fixed.map(([, s]) => s)];
  for (let i = 0; i < 900; i++) {
    cases.push(cfg(
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
      { x: 20 + rand() * 360, y: 20 + rand() * 260 },
    ));
  }
  let compared = 0, skipped = 0;
  for (const s of cases) {
    const core = C.construction(s);
    const applet = appletCompute(s);
    if (!core.ok || !applet.ok || area(s.A, s.B, s.C) < 200) { skipped++; continue; }
    const tol = 1e-5 * Math.max(dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.A));
    for (const key of ["I", "X", "Y", "Z", "D", "E", "F", "M", "N"]) {
      if (!nearPoint(core[key], applet[key], tol)) {
        check(`applet ${key} matches the core at ${JSON.stringify(s)}`, false,
          `core ${JSON.stringify(core[key])}, applet ${JSON.stringify(applet[key])}`);
      }
    }
    if (!near(core.radius, applet.radius, tol)) {
      check(`applet inradius matches the core at ${JSON.stringify(s)}`, false);
    }
    /* The applet's own points satisfy both numbered claims. */
    const on = (p, q, r) => C.distToLine(p, C.line(q, r)) <= 1e-5 * 400;
    if (!on(applet.M, applet.E, applet.F) || !on(applet.N, applet.E, applet.F) ||
        !on(applet.M, applet.X, applet.Y) || !on(applet.N, applet.X, applet.Z)) {
      check(`the applet's own points are collinear at ${JSON.stringify(s)}`, false);
    }
    compared++;
  }
  check(`applet and core agree on ${compared} configurations`, compared > 700);
  check(`degenerate trials were skipped, not silently compared`, skipped < 250);
}

/* -------------------------------------- 5. degenerate input is handled safely */

{
  const tiny = cfg({ x: 100, y: 100 }, { x: 101, y: 100 }, { x: 300, y: 200 });
  check("a side under 2 stops Compute() and the core", !C.construction(tiny).ok && !appletCompute(tiny).ok);
  const coincident = cfg({ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 200, y: 200 });
  check("coincident vertices give no construction", !C.construction(coincident).ok);
  check("claims are all false when there is no construction",
    !Object.values(allClaims(coincident)).some(Boolean));
  check("an unbuilt diagram cannot be won or lost", C.result(coincident) === null);
  check("distToLine of a zero-length line is infinite",
    C.distToLine({ x: 1, y: 2 }, C.line({ x: 0, y: 0 }, { x: 0, y: 0 })) === Infinity);
  check("the applet's NearestPoint returns Q on a zero-length side",
    nearPoint(appletFoot({ x: 9, y: 9 }, { x: 2, y: 3 }, { x: 2, y: 3 }), { x: 2, y: 3 }, 0));
}

done("hatzipolakis-triangle");
