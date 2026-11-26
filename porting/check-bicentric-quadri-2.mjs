#!/usr/bin/env node
"use strict";

/*
 * Logic test for bicentric-quadri-2/bicentric-quadri-2-core.js.
 *
 *   node porting/check-bicentric-quadri-2.mjs
 *
 * This port is about the *second* claim on the cut-the-knot page: KLMN, the
 * quadrilateral of feet from P = AC ∩ BD to the four sides of ABCD, is cyclic
 * iff ABCD is orthodiagonal. That is deliberately different from the first
 * claim (KLMN has an incircle at P whenever ABCD is cyclic): the incircle
 * claim holds in both the starting and the orthodiagonal picture, while the
 * circumcircle appears only in the latter. The test checks that distinction
 * on the applet's start picture, on hundreds of configurations with all four
 * points on the circle, and on hundreds of general (not necessarily cyclic)
 * orthodiagonal quadrilaterals, since the page's converse does not need ABCD
 * cyclic. Finally the whole construction is written out a second time from
 * the bytecode (GeoSDoub.Intersect / NearestPoint, the canvas's Midpoint,
 * GetPerp, DrawKLMN and DrawCircumCircle) and compared with the core.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bicentric-quadri-2/bicentric-quadri-2-core.js", "BicentricQuadri2Core");
const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const scaleOf = (a, b, c, d) => Math.max(1, dist(a, c), dist(b, d),
  dist(a, b), dist(b, c), dist(c, d), dist(d, a));
const pointAt = (center, radius, angle) =>
  P(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
const TAU = 2 * Math.PI;

/* ------------------------- the applet's own arithmetic, straight from bytecode */

/** GeoSDoub.Intersect(P1,P2,P3,P4): NaN pair when |det| < 1. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/** GeoSDoub.NearestPoint(p,a,b): project p onto ab. */
function appletFoot(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const sq = dx * dx + dy * dy;
  if (sq < 0.1) return P(p.x, p.y);
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / sq;
  return P(a.x + dx * t, a.y + dy * t);
}

/* Midpoint and GetPerp from BicentricQuadri2Canvas. */
const appletMidpoint = (a, b) => P((a.x + b.x) / 2, (a.y + b.y) / 2);
function appletPerp(m, p) {
  return P(m.x + p.y - m.y, m.y - p.x + m.x);
}

/** DrawConfiguration + DrawKLMN + DrawCircumCircle, in bytecode order. */
function appletConfiguration(A, B, Cc, D) {
  const pp = appletIntersect(A, Cc, B, D);
  if (!Number.isFinite(pp.x)) return null;
  const K = appletFoot(pp, A, B);
  const L = appletFoot(pp, B, Cc);
  const M = appletFoot(pp, Cc, D);
  const N = appletFoot(pp, D, A);
  const mKM = appletMidpoint(K, M);
  const mLN = appletMidpoint(L, N);
  const circum = appletIntersect(mKM, appletPerp(mKM, K), mLN, appletPerp(mLN, L));
  const circumradius = [K, L, M, N].reduce((s, v) => s + dist(circum, v), 0) / 4;
  const sideFeet = [K, L, M, N].map((v, i) =>
    appletFoot(pp, v, [K, L, M, N][(i + 1) % 4]));
  const inradius = sideFeet.reduce((s, v) => s + dist(pp, v), 0) / 4;
  const E = appletIntersect(K, M, L, N);
  return { P: pp, K, L, M, N, circumcenter: circum, circumradius, inradius, E };
}

/** AreOrtho(A,C,B,D) from the applet: |dot(A-C,B-D)| < 200. */
function appletFinished(A, B, Cc, D) {
  const value = (A.x - Cc.x) * (B.x - D.x) + (A.y - Cc.y) * (B.y - D.y);
  return Math.abs(value) < 200;
}

/* ---------------------------------------------- 1. start position and moves */

{
  const s = C.start({});
  equal("the applet's start angles, in A B C D order",
    s.angles.map((a) => Math.round(a * 180 / Math.PI)), [0, 300, 240, 99]);
  check("the circle starts at the applet's centre and radius",
    close(s.center.x, 200, 1e-9) && close(s.center.y, 250 / 2 + 250 / 12, 1e-9)
      && close(s.radius, 250 / 3, 1e-9));
  check("all four Show boxes start unchecked",
    !s.options.names && !s.options.incircle && !s.options.diagonals && !s.options.extend);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);

  const g = C.geometry(s);
  check("the start construction exists", !!g);
  check("first claim: KLMN has an incircle at P on the start picture", g.inscriptible);
  check("the start picture is not orthodiagonal", !g.orthodiagonal);
  check("second claim: the start picture's KLMN has no circumcircle", !g.cyclic);
  check("the applet would not draw the circumcircle at the start", !g.appletFinished);
  check("the start status names the missing condition", /right angles/.test(C.describe(s)));
}

{
  const s = C.start({});
  const next = C.move(s, { type: "rotate", index: 2, delta: 0.1 });
  check("rotating a corner leaves the old position alone",
    s.angles[2] !== next.angles[2] && close(s.angles[2], 4.1887902047863905, 1e-12));
  check("rotating marks the diagram explored", next.explored && !s.explored);
  check("rotateTo puts a corner at the pointer's angle",
    close(C.move(s, { type: "rotateTo", index: 0, angle: Math.PI }).angles[0], Math.PI, 1e-12));
  check("angles wrap into [0, 2*pi)",
    C.move(s, { type: "rotateTo", index: 0, angle: -0.1 }).angles[0] > 6);
  check("unknown moves are ignored", C.move(s, { type: "nope" }) === s);
  check("non-finite moves are ignored",
    C.move(s, { type: "rotate", index: 0, delta: NaN }) === s
      && C.move(s, { type: "center", x: NaN, y: 1 }) === s
      && C.move(s, { type: "radius", value: Infinity }) === s);
  check("the centre is clamped to the board", (() => {
    const q = C.move(s, { type: "center", x: -50, y: 9999 });
    return q.center.x === C.PAD && q.center.y === C.VIEW.height - C.PAD;
  })());
  check("the radius is clamped to the applet's range", (() => {
    return C.move(s, { type: "radius", value: -5 }).radius === C.MIN_RADIUS
      && C.move(s, { type: "radius", value: 9999 }).radius === C.MAX_RADIUS;
  })());
  check("options change independently and do not explore the diagram", (() => {
    const q = C.move(s, { type: "option", key: "names", value: true });
    return q.options.names && !q.explored && !q.options.incircle;
  })());
  check("an unknown option is ignored", C.move(s, { type: "option", key: "nope", value: true }) === s);
  check("Reset keeps the options but restores the angles", (() => {
    const q = C.move(C.move(s, { type: "bicentric" }), { type: "option", key: "names", value: true });
    const r = C.move(q, { type: "reset" });
    return r.options.names && r.angles[2] === s.angles[2] && !r.explored;
  })());
  check("legal moves cover the applet's handles, button and boxes", C.legalMoves(s).length >= 10);
}

/* ------------------------ 2. the two claims on the applet's starting picture */

{
  const s0 = C.start({});
  const s1 = C.move(s0, { type: "bicentric" });
  const g0 = C.geometry(s0);
  const g1 = C.geometry(s1);
  check("the button changes only C", s1.angles.filter((a, i) => i !== 2)
    .every((a, i) => a === s0.angles.filter((_, j) => j !== 2)[i]));
  check("the new angle satisfies a+c-b-d = pi (mod 2*pi)", (() => {
    const [a, b, c, d] = s1.angles;
    return close(Math.cos((a + c - b - d) / 2), 0, 1e-12);
  })());
  check("both pictures give KLMN an incircle (the first claim)", g0.inscriptible && g1.inscriptible);
  check("only the orthodiagonal picture gives KLMN a circumcircle (the second claim)",
    !g0.cyclic && g1.cyclic);
  check("the diagonal dot product becomes zero", Math.abs(g1.diagonalProduct) < 1e-8);
  check("all four circumradii agree to drawing precision",
    g1.radiusSpread < 1e-7 * g1.circumradius, `spread ${g1.radiusSpread}`);
  check("the applet would draw the new circumcircle", g1.appletFinished);
  check("O, P and E are collinear in the new picture", g1.collinear);
  check("the status says the inner quadrilateral is bicentric", /bicentric/.test(C.describe(s1)));
  check("the inner circle is centred at P in both pictures",
    close(g0.inradius, g0.inradii[0], 1e-9) && close(g1.inradius, g1.inradii[0], 1e-9));
}

/* ---------------- 3. every configuration with the four points on the circle */

{
  const rand = rng(20261126);
  let tested = 0, wrong = 0, ortho = 0, nonOrtho = 0, inscriptibleFails = 0;
  for (let trial = 0; trial < 1600; trial++) {
    // Four increasing angles with gaps big enough that the order is kept.
    const t = [rand() * 0.4];
    for (let i = 0; i < 3; i++) t.push(t[i] + 0.5 + rand() * 1.6);
    if (t[3] > TAU - 0.3) continue;
    const state = C.start({ angles: t, radius: 30 + rand() * 50 });
    const g = C.geometry(state);
    if (!g) continue;
    tested++;
    if (!g.inscriptible) inscriptibleFails++;
    const radiiAgree = g.radiusSpread <= 1e-6 * Math.max(1, g.circumradius);
    if (radiiAgree !== g.orthodiagonal || radiiAgree !== g.cyclic) wrong++;
    if (g.orthodiagonal) ortho++; else nonOrtho++;
  }
  check(`the first claim holds on ${tested} cyclic configurations`,
    tested > 1000 && inscriptibleFails === 0, `${inscriptibleFails} failures`);
  check(`the second claim holds on ${tested} cyclic configurations`,
    wrong === 0 && nonOrtho > 1000, `${wrong} failures, ${nonOrtho} not orthodiagonal`);

  // Make exactly orthodiagonal configurations on the circle with the button.
  const rand2 = rng(71);
  let made = 0, bad = 0;
  for (let trial = 0; trial < 500; trial++) {
    const t = [rand2() * 0.3];
    for (let i = 0; i < 3; i++) t.push(t[i] + 0.5 + rand2() * 1.5);
    if (t[3] > TAU - 0.2) continue;
    const g = C.geometry(C.move(C.start({ angles: t }), { type: "bicentric" }));
    if (!g) continue;
    made++;
    if (!g.orthodiagonal || !g.cyclic || !g.appletFinished
      || g.radiusSpread > 1e-7 * Math.max(1, g.circumradius)) bad++;
  }
  check(`${made} pictures made orthodiagonal by the button are cyclic`, made > 350 && bad === 0);
}

/* --------------- 4. the converse for quadrilaterals that are not cyclic at all */

{
  const rand = rng(31415);
  let tested = 0, bad = 0, maxRelativeSpread = 0;
  for (let trial = 0; trial < 1200; trial++) {
    // A right, C left, B up, D down: AC is perpendicular to BD by construction.
    const a = 20 + rand() * 100, c = 20 + rand() * 100;
    const b = 20 + rand() * 100, d = 20 + rand() * 100;
    const ox = 100 + rand() * 100, oy = 100 + rand() * 40;
    const A = P(ox + a, oy), B = P(ox, oy + b), Cc = P(ox - c, oy), D = P(ox, oy - d);
    const g = C.compute(A, B, Cc, D);
    if (!g) continue;
    tested++;
    maxRelativeSpread = Math.max(maxRelativeSpread, g.radiusSpread / g.circumradius);
    if (!g.orthodiagonal || !g.cyclic || !g.appletFinished) bad++;
    // Nudging B breaks both the right angle and the circle through K,L,M,N.
    const g2 = C.compute(A, P(B.x + 0.5, B.y), Cc, D);
    if (g2 && Math.abs(g2.diagonalProduct) > 1e-4 && g2.cyclic) bad++;
  }
  check(`${tested} general orthodiagonal quadrilaterals give a cyclic KLMN`,
    tested > 900 && bad === 0, `${bad} failures`);
  check("the radii agree to better than 1e-12 relative on those cases",
    maxRelativeSpread < 1e-12, `worst ${maxRelativeSpread}`);
}

/* ------------------------- 5. the same answers as the applet's bytecode method */

{
  const rand = rng(1994);
  let compared = 0, mismatches = 0;
  const compare = (label, A, B, Cc, D) => {
    const g = C.compute(A, B, Cc, D);
    const ap = appletConfiguration(A, B, Cc, D);
    if (!g || !ap || !Number.isFinite(ap.circumcenter.x)) return;
    const tol = 2e-5 * scaleOf(A, B, Cc, D);
    for (const key of ["P", "K", "L", "M", "N"]) {
      if (!closePoint(g[key], ap[key], tol)) {
        mismatches++;
        check(`${label}: core ${key} matches the applet's NearestPoint/Intersect`, false,
          `applet ${JSON.stringify(ap[key])}, core ${JSON.stringify(g[key])}`);
      }
    }
    if (!closePoint(g.O, ap.circumcenter, tol)
      || !close(g.circumradius, ap.circumradius, tol)
      || !close(g.inradius, ap.inradius, tol)
      || !closePoint(g.E, ap.E, tol)) {
      mismatches++;
      check(`${label}: circles and E match the applet's DrawKLMN/DrawCircumCircle`, false);
    }
    if (g.appletFinished !== appletFinished(A, B, Cc, D)) {
      mismatches++;
      check(`${label}: Finished matches the applet's AreOrtho(A,C,B,D)`, false);
    }
    compared++;
  };

  const s0 = C.start({});
  const h = C.handles(s0);
  compare("start", h.A, h.B, h.C, h.D);
  const h1 = C.handles(C.move(s0, { type: "bicentric" }));
  compare("orthodiagonal", h1.A, h1.B, h1.C, h1.D);
  for (let trial = 0; trial < 600; trial++) {
    const t = [rand() * 0.5];
    for (let i = 0; i < 3; i++) t.push(t[i] + 0.5 + rand() * 1.6);
    if (t[3] > TAU - 0.2) continue;
    const h = C.handles(C.start({ angles: t }));
    compare(`on-circle ${trial}`, h.A, h.B, h.C, h.D);
  }
  const rand2 = rng(2718);
  for (let trial = 0; trial < 400; trial++) {
    const a = 20 + rand2() * 100, c = 20 + rand2() * 100;
    const b = 20 + rand2() * 100, d = 20 + rand2() * 100;
    const o = P(120 + rand2() * 80, 120 + rand2() * 30);
    compare(`off-circle ${trial}`, P(o.x + a, o.y), P(o.x, o.y + b),
      P(o.x - c, o.y), P(o.x, o.y - d));
  }
  check(`core and applet agree on ${compared} configurations`, compared > 700 && mismatches === 0);
}

/* ------------------------------------------------ 6. degenerate input is safe */

{
  const flat = [P(10, 10), P(50, 10), P(90, 10), P(130, 10)];
  check("four collinear corners have no construction", C.compute(...flat) === null);
  check("a repeated corner has no construction",
    C.compute(P(10, 10), P(10, 10), P(90, 20), P(40, 80)) === null);
  const same = C.move(C.start({}), { type: "rotateTo", index: 1, angle: 0 });
  check("a degenerate position has a helpful status", /parallel|point/.test(C.describe(same)));
  check("a degenerate position still has no result", C.result(same) === null);
  check("describe works without a geometry", typeof C.describe({}) === "string");
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("bicentric-quadri-2");
