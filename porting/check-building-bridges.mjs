#!/usr/bin/env node
"use strict";

/*
 * Logic test for building-bridges/building-bridges-core.js.
 *
 *   node porting/check-building-bridges.mjs
 *
 * Checked here:
 *  1. the start position against BuildingBridgesCanvas.init over the whole
 *     random range, and the mutations that keep the banks parallel;
 *  2. the exact page claim (AC || C'C'' || C'''B, both bridges of fixed width,
 *     shortest length = |A'B'| + |d0| + |d1|) over hundreds of configurations;
 *  3. a second, literal transcription of ComputePoints / GeoSDoub.Intersect /
 *     NearestPoint from the bytecode, compared with the core on every one of
 *     those configurations;
 *  4. an independent brute-force search over both bridge positions, so the
 *     "shortest" claim is tested rather than assumed;
 *  5. the configurations the page itself calls nonsensical (a town inside a
 *     river, rivers dragged over one another, parallel banks).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("building-bridges/building-bridges-core.js", "BuildingBridgesCore");

const P = (x, y) => ({ x, y });
const plus = (a, b) => P(a.x + b.x, a.y + b.y);
const minus = (a, b) => P(a.x - b.x, a.y - b.y);
const len = (a) => Math.hypot(a.x, a.y);
const dist = (a, b) => len(minus(a, b));
const near = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const nearP = (a, b, tol) => Boolean(a) && Boolean(b)
  && near(a.x, b.x, tol) && near(a.y, b.y, tol);

/* ------------------------------------------------ the applet's own arithmetic */

/* GeoSDoub.Intersect(P1,P2,P3,P4), transcribed in its ax+by+c form. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x;
  const c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x;
  const c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* GeoSDoub.NearestPoint(P,A,B), with its `SqDist(A,P) < 0.1` short cut. */
function appletNearest(Pt, A, B) {
  const dx = B.x - A.x, dy = B.y - A.y;
  if ((A.x - Pt.x) ** 2 + (A.y - Pt.y) ** 2 < 0.1) return P(Pt.x, Pt.y);
  const t = (dx * (Pt.x - A.x) + dy * (Pt.y - A.y)) / (dx * dx + dy * dy);
  return P(A.x + dx * t, A.y + dy * t);
}

const appletMid = (A, B) => P((A.x + B.x) / 2, (A.y + B.y) / 2);

/* ComputeBridge(MoveableLine, MoveableLine) and its point overload. */
function appletBridge(upper, lower) {
  const m = appletMid(upper.a, upper.b);
  const foot = appletNearest(m, lower.a, lower.b);
  return minus(foot, m);
}

/* BuildingBridgesCanvas.ComputePoints, instruction for instruction. */
function appletComputePoints(s) {
  const d0 = appletBridge(s.rivers[0].upper, s.rivers[0].lower);
  const d1 = appletBridge(s.rivers[1].upper, s.rivers[1].lower);
  const AA = plus(s.A, d0);
  const BB = minus(s.B, d1);
  const dx = AA.x - BB.x, dy = AA.y - BB.y;
  const KU0 = appletIntersect(
    s.rivers[0].upper.a, s.rivers[0].upper.b,
    s.A, plus(s.A, P(dx, dy)),
  );
  const KL0 = appletNearest(KU0, s.rivers[0].lower.a, s.rivers[0].lower.b);
  const KL1 = appletIntersect(
    s.rivers[1].lower.a, s.rivers[1].lower.b,
    s.B, minus(s.B, P(dx, dy)),
  );
  const KU1 = appletNearest(KL1, s.rivers[1].upper.a, s.rivers[1].upper.b);
  return { d0, d1, AA, BB, KU0, KL0, KL1, KU1 };
}

/* ------------------------------------------------- 1. start and bank dragging */

{
  let ok = true;
  for (let i = 0; i <= 20; i++) {
    const random = i / 20;
    const s = C.start({ random });
    const A = P(s.width / 4, s.height * (random / 6 + 0.2));
    const B = P((3 * s.width) / 4, (s.height / 6) * (random + 4.8));
    const y0 = s.height / 2 - (s.height / 6) * random;
    const y1 = s.height / 2 + (s.height / 6) * random;
    if (!nearP(s.A, A, 1e-12) || !nearP(s.B, B, 1e-12)
      || !near(s.rivers[0].upper.a.y, y0, 1e-12)
      || !near(s.rivers[1].upper.a.y, y1, 1e-12)) ok = false;
  }
  check("init's A, B and both river banks match all 21 random values", ok);

  const s = C.start({});
  check("an illustration has no result", C.result(s) === null);
  check("the default diagram is a sensible one", C.valid(s));
  check("the default diagram meets every claim", Object.values(C.claims(s)).every(Boolean));
  equal("the applet's banks are 30 units apart", C.WIDTH, 30);
  check("withPoint leaves the old state untouched", (() => {
    const next = C.withPoint(s, "U0a", P(12, 90));
    return s.rivers[0].upper.a.x === 10 && next.rivers[0].upper.a.x === 12;
  })());
  check("an unknown handle changes nothing", (() => {
    const next = C.withPoint(s, "Z", P(1, 2));
    return next.A.x === s.A.x && next.rivers[0].upper.a.x === 10;
  })());
  check("dragging a bank keeps its mate parallel at the same width", (() => {
    const next = C.withPoint(s, "U0b", P(370, 145));
    const u = next.rivers[0].upper, l = next.rivers[0].lower;
    const d0 = C.bridgeVector(next.rivers[0]);
    const offset = minus(u.a, l.a);
    const direction = minus(u.b, u.a);
    return Math.abs(len(d0) - 30) < 1e-9
      && Math.abs(offset.x * direction.x + offset.y * direction.y) < 1e-9;
  })());
  check("dragging a bank's middle dot slides both banks together", (() => {
    const next = C.withPoint(s, "M1", P(250, 190));
    const oldMid = C.midpoint(s.rivers[1].upper.a, s.rivers[1].upper.b);
    const delta = minus(P(250, 190), oldMid);
    return nearP(next.rivers[1].upper.a, plus(s.rivers[1].upper.a, delta), 1e-12)
      && nearP(next.rivers[1].lower.b, plus(s.rivers[1].lower.b, delta), 1e-12);
  })());
  check("a position can be saved and restored exactly", (() => {
    const next = C.withPoint(s, "A", P(70, 40));
    const back = C.start({ position: next });
    return nearP(back.A, P(70, 40), 0) && nearP(back.rivers[0].lower.a, next.rivers[0].lower.a, 0);
  })());
}

/* --------------------------------------------- 2. many sensible configurations */

const rand = rng(20261126);
/** Perturb the applet's start into a valid two-river diagram, or return null. */
function randomConfiguration() {
  let s = C.start({ random: 0.45 + rand() * 0.1 });
  // Towns stay outside the rivers; the banks stay in order and never cross.
  s = C.withPoint(s, "A", P(30 + rand() * 340, 15 + rand() * 50));
  s = C.withPoint(s, "B", P(30 + rand() * 340, 250 + rand() * 40));
  s = C.withPoint(s, "U0a", P(5 + rand() * 18, 112 + rand() * 14));
  s = C.withPoint(s, "U0b", P(375 + rand() * 18, 112 + rand() * 14));
  s = C.withPoint(s, "U1a", P(5 + rand() * 18, 180 + rand() * 14));
  s = C.withPoint(s, "U1b", P(375 + rand() * 18, 180 + rand() * 14));
  if (rand() < 0.5) s = C.withPoint(s, "M0", P(190 + rand() * 30, 118 + rand() * 12));
  if (rand() < 0.5) s = C.withPoint(s, "M1", P(190 + rand() * 30, 184 + rand() * 12));
  if (rand() < 0.35) s = C.withPoint(s, "L0a", P(8 + rand() * 18, 145 + rand() * 14));
  if (rand() < 0.35) s = C.withPoint(s, "L1b", P(378 + rand() * 16, 210 + rand() * 14));
  if (rand() < 0.5) s = C.withPoint(s, "C0", P(60 + rand() * 280, 125 + rand() * 20));
  if (rand() < 0.5) s = C.withPoint(s, "C1", P(60 + rand() * 280, 195 + rand() * 20));
  return C.valid(s) ? s : null;
}

const configurations = [];
for (let i = 0; i < 600 && configurations.length < 400; i++) {
  const s = randomConfiguration();
  if (s) configurations.push(s);
}

/* ------------------------------- 3. the core against the applet's own method */

{
  let compared = 0, bad = null;
  for (const s of configurations) {
    const m = C.geometry(s);
    const a = appletComputePoints(s);
    const tol = 1e-7 * Math.max(1, dist(s.A, s.B));
    for (const key of ["KU0", "KL0", "KL1", "KU1"]) {
      if (!nearP(m[key], a[key], tol)) {
        bad = `${key}: core ${JSON.stringify(m[key])}, applet ${JSON.stringify(a[key])}`;
        break;
      }
    }
    if (!bad && !nearP(m.d0, a.d0, tol)) bad = `d0: ${JSON.stringify(m.d0)} vs ${JSON.stringify(a.d0)}`;
    if (!bad && !nearP(m.d1, a.d1, tol)) bad = `d1: ${JSON.stringify(m.d1)} vs ${JSON.stringify(a.d1)}`;
    if (!bad && !nearP(m.Aprime, a.AA, tol)) bad = `AA: ${JSON.stringify(m.Aprime)} vs ${JSON.stringify(a.AA)}`;
    if (!bad && !nearP(m.Bprime, a.BB, tol)) bad = `BB: ${JSON.stringify(m.Bprime)} vs ${JSON.stringify(a.BB)}`;
    if (bad) break;
    compared++;
  }
  check(`core matches ComputePoints on all ${compared} configurations`, compared === 400, bad || "");
}

/* --------------------------------------------- 4. every claim on the old page */

{
  const names = [
    "bridgesPerpendicular", "bridgeWidths", "translationsTowardRivers",
    "bridgeEndsOnBanks", "landSegmentsParallel", "shortestRouteParallel",
    "shortestLengthFormula", "attemptNoShorter",
  ];
  let passed = 0;
  for (const s of configurations) {
    const cl = C.claims(s);
    if (names.every((n) => cl[n])) passed++;
    else check(`claims fail for ${JSON.stringify(s.A)}`, false, JSON.stringify(cl));
  }
  check(`all eight page claims hold on all ${passed} configurations`, passed === 400);

  const m = C.geometry(configurations[0]);
  const cl = C.claims(configurations[0]);
  check("AC is parallel to the constructed A'B' line", cl.landSegmentsParallel);
  check("both bridges are perpendicular to their banks and 30 long",
    cl.bridgesPerpendicular && cl.bridgeWidths);
  check("A' moves toward river 1 while B' moves toward river 2",
    cl.translationsTowardRivers);
  check("the player's dragged bridges cannot beat the construction", cl.attemptNoShorter);
  check("the constructed route has the claimed length", cl.shortestLengthFormula);
  check("the claimed length uses just |A'B'| plus the two widths",
    near(C.pathLength(C.route(configurations[0], m)),
      dist(m.Aprime, m.Bprime) + 60, 1e-7));
}

/* ------------------------- 5. brute force over both bridge positions, honestly */

/** Length of the route for arbitrary points on the far bank of river 1 and
 *  near bank of river 2, parameterised by distance along those bank lines. */
function routeAt(s, t0, t1) {
  const d0 = C.bridgeVector(s.rivers[0]), d1 = C.bridgeVector(s.rivers[1]);
  const u0 = minus(s.rivers[0].upper.b, s.rivers[0].upper.a);
  const u1 = minus(s.rivers[1].upper.b, s.rivers[1].upper.a);
  const n0 = len(u0), n1 = len(u1);
  const KL0 = plus(s.rivers[0].lower.a, C.scale(u0, t0 / n0));
  const KU1 = plus(s.rivers[1].upper.a, C.scale(u1, t1 / n1));
  const Aprime = plus(s.A, d0), Bprime = minus(s.B, d1);
  return dist(Aprime, KL0) + dist(KL0, KU1) + dist(KU1, Bprime) + len(d0) + len(d1);
}

function bruteMinimum(s) {
  let best = Infinity, bt0 = 0, bt1 = 0;
  for (let t0 = -400; t0 <= 400; t0 += 16) {
    for (let t1 = -400; t1 <= 400; t1 += 16) {
      const v = routeAt(s, t0, t1);
      if (v < best) { best = v; bt0 = t0; bt1 = t1; }
    }
  }
  for (let t0 = bt0 - 16; t0 <= bt0 + 16; t0 += 0.25) {
    for (let t1 = bt1 - 16; t1 <= bt1 + 16; t1 += 0.25) {
      const v = routeAt(s, t0, t1);
      if (v < best) best = v;
    }
  }
  return best;
}

{
  let checked = 0, winners = 0;
  for (const s of configurations.slice(0, 80)) {
    const optimum = C.shortestLength(s);
    const brute = bruteMinimum(s);
    const tol = 2e-5 * Math.max(1, dist(s.A, s.B));
    if (optimum <= brute + tol && near(optimum, brute, tol)) winners++;
    else check(`brute force disagrees at ${JSON.stringify(s.A)}`, false,
      `construction ${optimum}, brute ${brute}`);
    checked++;
  }
  check(`the construction is the true minimum in all ${checked} brute-force searches`,
    winners === checked && checked === 80);
}

/* ------------------------------------------- 6. the page's nonsensical cases */

{
  const s = C.start({});
  // A town inside a river, as the page warns can happen.
  const inside = C.withPoint(s, "A", P(100, 140));
  check("a town inside the first river is rejected", !C.valid(inside));
  check("no claim is made for an impossible diagram",
    !Object.values(C.claims(inside)).some(Boolean));
  // Rivers dragged over each other: the far bank of the first is past the
  // near bank of the second.
  const crossed = C.withPoint(s, "M1", P(200, 140));
  check("one river dragged over the other is rejected", !C.valid(crossed));
  // Equal banks give no intersection at all.
  const flat = C.start({ random: 0 });
  check("coincident rivers give no construction", !C.valid(flat));
  check("parallel lines have no crossing, as GeoSDoub.Intersect says",
    C.intersect(P(0, 0), P(10, 0), P(0, 30), P(10, 30)) === null
    && C.intersect(P(0, 0), P(0, 10), P(30, 0), P(30, 10)) === null);
}

done("building-bridges");
