#!/usr/bin/env node
"use strict";

/*
 * Logic test for arbelos-concyclic/arbelos-concyclic-core.js.
 *
 *   node porting/check-arbelos-concyclic.mjs
 *
 * The cut-the-knot page makes three exact claims: (1) A, C, F, D lie on the
 * circle centred at M through C; (2) B, C, E, D lie on the circle centred at N
 * through C; (3) the remark's A, B, F, E lie on the circle centred at L1, the
 * mirror of the big semicircle's top L in AB. Each is checked at every one of
 * 321 draggable positions and at 1000 random ones, together with the tangency
 * of the incircle and the Woo construction of E, F and D.
 *
 * The second half transcribes ApolloniusCircle.SetCircles/Compute and
 * GeoSDoub.Intersect from the applet's bytecode line by line and compares them
 * with the core. One deviation is deliberate and recorded: the applet builds
 * BigCircle with radius AB (twice the drawn radius AB/2), so its own incircle
 * is about twice too big and its E, F, D are not tangency points at all. The
 * page's construction is followed instead; the test checks both facts.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("arbelos-concyclic/arbelos-concyclic-core.js", "ArbelosConcyclicCore");
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const onCircle = (p, circle, tol = 1e-7) => near(dist(p, circle.center), circle.radius, tol);
const positions = [];
for (let i = 0; i <= 320; i++) positions.push(C.start({ t: C.MIN_T + (i / 320) * (C.MAX_T - C.MIN_T) }));

/* ----------------------------------------- a literal second transcription */

/** ApolloniusCircle.CInfo, from classes/CTKGeometry.zip. */
function cInfo(c) { return c.x * c.x + c.y * c.y - c.r * c.r; }

/** ApolloniusCircle.SetCircles: static A1,A2,B1,B2,D1,D2,K,G,I,o. */
function setCircles(c0, c1, c2) {
  const A1 = 2 * (c1.x - c0.x), A2 = 2 * (c2.x - c0.x);
  const B1 = 2 * (c1.y - c0.y), B2 = 2 * (c2.y - c0.y);
  const o = cInfo(c0);
  const D1 = o - cInfo(c1), D2 = o - cInfo(c2);
  const K = A1 * B2 - A2 * B1;
  const G = (B1 * D2 - B2 * D1) / K;
  const I = -(A1 * D2 - A2 * D1) / K;
  return { c0, c1, c2, A1, A2, B1, B2, K, G, I, o };
}

/** ApolloniusCircle.Compute(s0,s1,s2): the two signed solutions. */
function apollonius(S, s0, s1, s2) {
  const { c0, c1, c2, A1, A2, B1, B2, K, G, I, o } = S;
  if (Math.abs(K) < 0.01) return null; // TreatZeroDeterminant returns null
  const d3 = 2 * (s0 * c0.r - s1 * c1.r);
  const d5 = 2 * (s0 * c0.r - s2 * c2.r);
  const u = (B1 * d5 - B2 * d3) / K;
  const v = -(A1 * d5 - A2 * d3) / K;
  const q = u * u + v * v - 1;
  if (Math.abs(q) < 0.001) return null;
  const L = 2 * (u * G + v * I - u * c0.x - v * c0.y + s0 * c0.r);
  const M = G * G + I * I - 2 * G * c0.x - 2 * I * c0.y + o;
  const disc = L * L - 4 * q * M;
  if (disc < 0) return null;
  const signed = [(-L + Math.sqrt(disc)) / (2 * q), (-L - Math.sqrt(disc)) / (2 * q)];
  // The bytecode places the circles with the *signed* roots but stores the
  // absolute value as the radius (locals 19 and 21 of Compute).
  return signed.map((r) => ({ x: u * r + G, y: v * r + I, r: Math.abs(r) }));
}

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), literally. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p2.y - p1.y, b1 = p1.x - p2.x, c1 = p2.x * p1.y - p1.x * p2.y;
  const a2 = p4.y - p3.y, b2 = p3.x - p4.x, c2 = p4.x * p3.y - p3.x * p4.y;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
}

/** The applet's three Apollonius circles. radius = R follows the *page*; the
 *  +1 in y is the applet's own degeneracy breaker in DrawSmallCircle. */
function appletIncircle(g, bigRadius) {
  const left = { x: g.O1.x, y: g.O1.y, r: g.r1 };
  const right = { x: g.O2.x, y: g.O2.y, r: g.r2 };
  const big = { x: g.bigCenter.x, y: g.bigCenter.y + 1, r: bigRadius };
  const sol = apollonius(setCircles(left, right, big), 1, 1, -1);
  if (!sol) return null;
  // y grows downward on the canvas: the incircle of the arbelos is the upper
  // of the two Apollonius solutions.
  return sol.reduce((a, b) => (a.y < b.y ? a : b));
}

/** ArbelosConcyclicCanvas.DefinePoints, with the incircle supplied. */
function appletDefinePoints(g, inc) {
  const rightEnd = { x: inc.x + inc.r, y: inc.y };
  const leftEnd = { x: inc.x - inc.r, y: inc.y };
  return {
    E: appletIntersect(g.A, rightEnd, g.C, leftEnd),
    F: appletIntersect(leftEnd, g.B, g.C, rightEnd),
    D: appletIntersect(g.A, leftEnd, g.B, rightEnd),
  };
}

/* --------------------------------------------- 1. the applet's constants */

{
  equal("the board is 400 x 250", [C.WIDTH, C.HEIGHT], [400, 250]);
  check("the margin is 30 and the side is 340", C.MARGIN === 30 && C.DIAMETER === 340);
  equal("the applet's rectangle", C.RECT, { x: 30, y: 50, width: 340, height: 340 });
  check("AB is the middle line of the rectangle", C.BASE_Y === 220 &&
    near(C.A.x, 30) && near(C.B.x, 370));
  check("the starting point is 0.6*A.x + 0.7*B.x", near(C.A.x + C.DIAMETER * C.START_T, 277) &&
    near(C.geometry(C.start({})).C.x, 277));
  check("PointIsEligible keeps C 10px off each end", near(C.MIN_T * C.DIAMETER, 10) &&
    near(C.MAX_T * C.DIAMETER, 330));
}

/* ------------------------------------ 2. start, setT, clamp and the record */

{
  const s = C.start({});
  equal("a fresh position is plain data", s, { t: C.START_T });
  const next = C.setT(s, 0.4);
  check("setT returns a new position and leaves the old one alone",
    next !== s && next.t === 0.4 && s.t === C.START_T);
  check("bad t values fall back or clamp", C.clampT(NaN) === C.START_T &&
    C.clampT(-9) === C.MIN_T && C.clampT(9) === C.MAX_T &&
    C.start({ t: undefined }).t === C.START_T);
  check("fractionAtX maps board x to t and clamps outside AB",
    near(C.fractionAtX(30 + 340 * 0.25), 0.25) &&
    C.fractionAtX(0) === C.MIN_T && C.fractionAtX(400) === C.MAX_T);
  const p = C.position(s);
  check("the saved position is JSON-safe and holds the construction",
    JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))) &&
    near(p.t, C.START_T, 1e-6) && near(p.C.x, 277) && p.E && p.F && p.D &&
    p.circleM.radius > 0 && p.circleN.radius > 0);
}

/* -------------------------------------- 3. tangency and the Woo construction */

{
  let tangent = true, onArcs = true, radial = true, inside = true;
  for (const s of positions) {
    const g = C.geometry(s);
    const { P, incircle } = g;
    const t = incircle.radius;
    tangent = tangent &&
      near(dist(P, g.O1), g.r1 + t, 1e-7) &&
      near(dist(P, g.O2), g.r2 + t, 1e-7) &&
      near(dist(P, g.bigCenter), g.R - t, 1e-7);
    onArcs = onArcs &&
      near(dist(g.E, g.O1), g.r1, 1e-7) &&
      near(dist(g.F, g.O2), g.r2, 1e-7) &&
      near(dist(g.D, g.bigCenter), g.R, 1e-7);
    radial = radial &&
      Math.abs(cross(g.O1, P, g.E)) < 1e-6 &&
      Math.abs(cross(g.O2, P, g.F)) < 1e-6 &&
      Math.abs(cross(g.bigCenter, P, g.D)) < 1e-6;
    inside = inside && g.E.y <= C.BASE_Y && g.F.y <= C.BASE_Y &&
      g.D.y <= C.BASE_Y && t > 0 && t < g.R;
  }
  check("the incircle touches all three semicircles at 321 positions", tangent);
  check("E, F and D lie on the left, right and big semicircles", onArcs);
  check("each tangency point lies on the line of centres", radial);
  check("all three tangencies are on the upper half of the arbelos", inside);
}

{
  // An independent transcription of the tangency points from the radii,
  // compared with the applet's DefinePoints construction used by the core.
  let ok = true;
  for (const s of positions) {
    const g = C.geometry(s), P = g.P, t = g.incircle.radius;
    const E = { x: g.O1.x + (g.r1 / (g.r1 + t)) * (P.x - g.O1.x),
                y: g.O1.y + (g.r1 / (g.r1 + t)) * (P.y - g.O1.y) };
    const F = { x: g.O2.x + (g.r2 / (g.r2 + t)) * (P.x - g.O2.x),
                y: g.O2.y + (g.r2 / (g.r2 + t)) * (P.y - g.O2.y) };
    const D = { x: g.bigCenter.x + (g.R / (g.R - t)) * (P.x - g.bigCenter.x),
                y: g.bigCenter.y + (g.R / (g.R - t)) * (P.y - g.bigCenter.y) };
    ok = ok && dist(E, g.E) < 1e-7 && dist(F, g.F) < 1e-7 && dist(D, g.D) < 1e-7;
  }
  check("DefinePoints agrees with the tangency formula at every position", ok);
}

/* ------------------------------------- 4. the page's three concyclic claims */

{
  let first = true, second = true, mirror = true, third = true, radii = true;
  for (const s of positions) {
    const g = C.geometry(s);
    first = first && [g.A, g.C, g.F, g.D].every((p) => onCircle(p, g.circleM));
    second = second && [g.B, g.C, g.E, g.D].every((p) => onCircle(p, g.circleN));
    mirror = mirror && near(g.L1.x, g.L.x) &&
      near(g.L1.y - C.BASE_Y, C.BASE_Y - g.L.y);
    third = third && [g.A, g.B, g.F, g.E].every((p) => onCircle(p, g.circleL1));
    radii = radii &&
      near(g.circleM.radius, g.r1 * Math.SQRT2) &&
      near(g.circleN.radius, g.r2 * Math.SQRT2) &&
      near(g.circleL1.radius, C.DIAMETER / Math.SQRT2) &&
      near(g.M.y, C.BASE_Y - g.r1) && near(g.N.y, C.BASE_Y - g.r2);
  }
  check("A, C, F, D are concyclic about M at 321 positions (page claim 1)", first);
  check("B, C, E, D are concyclic about N at 321 positions (page claim 2)", second);
  check("L1 is the reflection of L in AB", mirror);
  check("A, B, F, E are concyclic about L1 (page remark)", third);
  check("the three circle radii are r1*sqrt2, r2*sqrt2 and AB/sqrt2", radii);
}

{
  // Symmetry of the construction under swapping the two halves.
  let symmetric = true;
  for (let i = 0; i <= 160; i++) {
    const t = C.MIN_T + (i / 160) * (C.MAX_T - C.MIN_T);
    const g = C.geometry(C.start({ t }));
    const h = C.geometry(C.start({ t: 1 - t }));
    symmetric = symmetric && near(g.incircle.radius, h.incircle.radius) &&
      near(g.P.y, h.P.y) && near(g.P.x + h.P.x, C.A.x + C.B.x) &&
      near(g.D.y, h.D.y) && near(g.D.x + h.D.x, C.A.x + C.B.x);
  }
  check("reflecting C in the middle mirrors the whole picture", symmetric);
  const mid = C.geometry(C.start({ t: 0.5 }));
  check("at the middle the two small semicircles are equal", near(mid.r1, mid.r2) &&
    near(mid.P.x, C.bigCenter.x) && near(mid.D.x, C.bigCenter.x));
}

/* ------------------------ 5. the applet's own arithmetic, transcribed again */

{
  let inc = true, points = true, rel = true;
  let worstCenter = 0, worstRadius = 0;
  for (const s of positions) {
    const g = C.geometry(s);
    // The drawn big semicircle has radius R = AB/2. Feed that to the
    // applet's Apollonius computation (with its +1 y nudge).
    const a = appletIncircle(g, g.R);
    const tol = 0.02 * g.incircle.radius + 0.2; // the +1 nudge perturbs it
    worstCenter = Math.max(worstCenter, dist(a, g.P));
    worstRadius = Math.max(worstRadius, Math.abs(a.r - g.incircle.radius));
    inc = inc && dist(a, g.P) <= tol && Math.abs(a.r - g.incircle.radius) <= tol;
    const dp = appletDefinePoints(g, { x: g.P.x, y: g.P.y, r: g.incircle.radius });
    points = points &&
      dist(dp.E, g.E) < 1e-7 && dist(dp.F, g.F) < 1e-7 && dist(dp.D, g.D) < 1e-7;
    // The very same code with the applet's literal BigCircle radius AB gives
    // a much larger circle, which is not the arbelos incircle on the page.
    const raw = appletIncircle(g, C.DIAMETER);
    // It is internally tangent to a circle of radius AB, not to the drawn
    // semicircle of radius AB/2: its gap to that arc is enormous.
    rel = rel && raw.r > 2 * g.incircle.radius &&
      dist(raw, g.bigCenter) - (g.R - raw.r) > 1;
  }
  check("ApolloniusCircle.Compute finds the incircle with radius AB/2", inc,
    `worst centre ${worstCenter.toFixed(3)}, worst radius ${worstRadius.toFixed(3)}`);
  check("GeoSDoub.Intersect reproduces DefinePoints' E, F and D", points);
  check("the applet's BigCircle radius AB is twice too big (ported per the page)", rel);
}

/* ------------------------------------------- 6. random drags, every identity */

{
  const random = rng(2332);
  let ok = true;
  for (let i = 0; i < 1000; i++) {
    const s = C.start({ t: random() });
    const g = C.geometry(s);
    ok = ok &&
      onCircle(g.A, g.circleM) && onCircle(g.C, g.circleM) &&
      onCircle(g.F, g.circleM) && onCircle(g.D, g.circleM) &&
      onCircle(g.B, g.circleN) && onCircle(g.C, g.circleN) &&
      onCircle(g.E, g.circleN) && onCircle(g.D, g.circleN) &&
      onCircle(g.A, g.circleL1) && onCircle(g.B, g.circleL1) &&
      onCircle(g.E, g.circleL1) && onCircle(g.F, g.circleL1) &&
      near(C.fractionAtX(g.C.x), g.t, 1e-9);
  }
  check("1000 random drags keep all three circle claims true", ok);
}

done("arbelos-concyclic");
