#!/usr/bin/env node
"use strict";

/*
 * Logic test for bisectal-circle/bisectal-circle-core.js.
 *
 *   node porting/check-bisectal-circle.mjs
 *
 * Checked: the starting circles against BisectalCircleCanvas.init; the external
 * and internal homothety centres, the bisectal-circle radius, the inversion that
 * swaps the two circles, the orthogonal test circle and the equal crossing
 * angles, over hundreds of random configurations (equal radii, unequal radii,
 * disjoint, intersecting and nested). The last group is a second, literal
 * transcription of the applet's own Compute(): Tangents.GetExternalTangents /
 * GetInternalTangents (auxiliary circle, tangents from a point, scale the
 * contact points back), GeoSDoub.Intersect of the two tangent lines, the
 * sqrt((dist(Q,C1)-r1)(dist(Q,C2)+r2)) power, and the point-circle tangents used
 * for CT. It is compared with the core's direct homothety formulas.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bisectal-circle/bisectal-circle-core.js", "BisectalCircleCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p, t) => ({ x: p.x * t, y: p.y * t });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const circle = (center, r) => ({ center, r });
const stateOf = (a, ra, b, rb, T) => ({
  O1: { ...a }, R1: { x: a.x + ra, y: a.y },
  O2: { ...b }, R2: { x: b.x + rb, y: b.y },
  T: { ...T },
});

/* ---------------------- the applet's own construction, transcribed twice ---- */

/* GeoSDoub.IntersectCirclesX/Y, used by Inversion.Tangent. */
function appletCirclePoints(A, B) {
  const d = dist(A.center, B.center);
  if (!d || d > A.r + B.r || d < Math.abs(A.r - B.r)) return null;
  const a = (A.r * A.r - B.r * B.r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, A.r * A.r - a * a));
  const u = mul(sub(B.center, A.center), 1 / d);
  const base = add(A.center, mul(u, a));
  return [
    add(base, { x: -u.y * h, y: u.x * h }),
    add(base, { x: u.y * h, y: -u.x * h }),
  ];
}

/* Inversion.Tangent(circle, point): the two tangents from a point to a circle. */
function appletTangentsFrom(A, P) {
  const d2 = dot(sub(P, A.center), sub(P, A.center)) - A.r * A.r;
  if (d2 < 0) return null;
  const pts = appletCirclePoints(A, circle(P, Math.sqrt(d2)));
  if (!pts) return null;
  return pts.map((q) => ({ m_1: P, m_2: q }));
}

/* Tangents.GetExternalTangents / GetInternalTangents, step for step. */
function appletTangents(c1, c2, internal) {
  let big, small, Rb, Rs;
  if (internal) {
    big = c1; small = c2; Rb = c1.r; Rs = c2.r;
    const lines = appletTangentsFrom(circle(c1.center, c1.r + c2.r), c2.center);
    if (!lines) return null;
    return lines.map((ln) => ({
      m_1: add(c1.center, mul(sub(ln.m_2, c1.center), Rb / (Rb + Rs))),
      m_2: add(c2.center, mul(sub(ln.m_2, c1.center), -Rs / (Rb + Rs))),
    }));
  }
  if (c1.r >= c2.r) { big = c1; small = c2; } else { big = c2; small = c1; }
  Rb = big.r; Rs = small.r;
  if (Math.abs(Rb - Rs) < 1e-9) return null; // the applet divides by zero here
  const lines = appletTangentsFrom(circle(big.center, Rb - Rs), small.center);
  if (!lines) return null;
  return lines.map((ln) => ({
    m_1: add(big.center, mul(sub(ln.m_2, big.center), Rb / (Rb - Rs))),
    m_2: add(small.center, mul(sub(ln.m_2, big.center), Rs / (Rb - Rs))),
  }));
}

/* GeoSDoub.Intersect(DoubLine, DoubLine), with its |det| < 1 pixel cutoff. */
function appletIntersectLines(l1, l2) {
  const s4 = l1.m_1.y - l1.m_2.y;
  const s6 = l1.m_2.x - l1.m_1.x;
  const s8 = l1.m_1.x * l1.m_2.y - l1.m_1.y * l1.m_2.x;
  const s10 = l2.m_1.y - l2.m_2.y;
  const s12 = l2.m_2.x - l2.m_1.x;
  const s14 = l2.m_1.x * l2.m_2.y - l2.m_1.y * l2.m_2.x;
  const s16 = s6 * s14 - s12 * s8;
  const s18 = s8 * s10 - s14 * s4;
  const det = s4 * s12 - s10 * s6;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: s16 / det, y: s18 / det };
}

/* BisectalCircleCanvas.Compute: centres, power and the test circle CT. */
function appletCompute(s, internal) {
  const { c1, c2 } = C.circles(s);
  const E = appletTangents(c1, c2, false), I = appletTangents(c1, c2, true);
  const Q = E ? appletIntersectLines(E[0], E[1]) : null;
  const P = I ? appletIntersectLines(I[0], I[1]) : null;
  const center = internal ? P : Q;
  const radius = center && Number.isFinite(center.x)
    ? Math.sqrt((dist(center, c1.center) - c1.r) * (dist(center, c2.center) + c2.r))
    : null;
  let testRadius = null;
  if (center && Number.isFinite(center.x) && Number.isFinite(radius)) {
    const pointCircle = circle(s.T, 0);
    const t = appletTangents(pointCircle, circle(center, radius), false);
    if (t) testRadius = dist(t[0].m_1, t[1].m_2);
  }
  return { Q, P, center, radius, testRadius };
}

/* --------------------------------------------- 1. the start and the API */

{
  const s = C.start();
  equal("start O1 matches init (width/2 - width/5, height/2)", s.O1, { x: 120, y: 150 });
  equal("start R1 matches init (one width/20 to the left)", s.R1, { x: 100, y: 150 });
  equal("start O2 matches init (width/2 + width/5, height/2)", s.O2, { x: 280, y: 150 });
  equal("start R2 matches init (one width/20 to the right)", s.R2, { x: 300, y: 150 });
  equal("start T matches init (canvas centre)", s.T, { x: 200, y: 150 });
  check("an illustration is never won or lost", C.result(s) === null);
  equal("the draggable points are the applet's five movables", C.legalMoves(s),
    ["O1", "R1", "O2", "R2", "T"]);
  check("the starting radii are equal, as in the applet", C.close(C.circles(s).c1.r, C.circles(s).c2.r, 1e-12));
  check("withPoint leaves the old position alone", (() => {
    const n = C.withPoint(s, "T", { x: 10, y: 20 });
    return s.T.x === 200 && n.T.x === 10 && n.O1.x === s.O1.x;
  })());
  check("an unknown point name changes nothing", C.withPoint(s, "Z", { x: 0, y: 0 }).T.x === 200);
}

/* ------------------------------- 2. the equal-radii (infinite Q) case */

{
  const s = C.start();
  const m = C.measurements(s, "external");
  const cl = C.claims(s, "external");
  check("equal radii make Q infinite", m.bisectal.infinite === true && m.bisectal.center === null);
  check("the limiting bisectal circle is a line", m.bisectal.line.length === 2);
  check("the page's claim: equal radii give an infinite Q", cl.radiiEqual);
  check("the line passes through the midpoint of the centres", cl.midpointOnLine);
  check("reflection in the line swaps the two circles", cl.mirrorSwaps);
  check("no test circle is drawn for an infinite Q", m.test === null);
  check("the internal bisectal circle still exists", C.bisectal(s, "internal").radius !== null);
  const stretched = C.withPoint(s, "R2", { x: 340, y: 150 });
  check("moving one radius dot makes Q finite", C.bisectal(stretched, "external").infinite === false);
}

/* ----------------------- 3. fixed configurations quoted by the article */

const fixed = [
  ["disjoint, unequal", stateOf({ x: 110, y: 150 }, 20, { x: 280, y: 150 }, 45, { x: 195, y: 60 })],
  ["disjoint, equal", stateOf({ x: 110, y: 150 }, 30, { x: 280, y: 150 }, 30, { x: 195, y: 60 })],
  ["intersecting", stateOf({ x: 120, y: 150 }, 70, { x: 280, y: 150 }, 70, { x: 200, y: 40 })],
  ["one much larger", stateOf({ x: 150, y: 160 }, 16, { x: 280, y: 140 }, 95, { x: 230, y: 35 })],
  ["tilted centres", stateOf({ x: 90, y: 210 }, 26, { x: 300, y: 90 }, 52, { x: 190, y: 150 })],
  ["applet start", C.start()],
];

for (const [name, s] of fixed) {
  for (const kind of ["external", "internal"]) {
    const m = C.measurements(s, kind);
    const cl = C.claims(s, kind);
    if (!m.possible || !m.bisectal) continue;
    const ok = Object.values(cl).filter((v) => typeof v === "boolean").every(Boolean);
    check(`${name}, ${kind}: every applicable claim holds`, ok, JSON.stringify(cl));
  }
}

/* ---------------- 4. the claims over hundreds of random configurations */

{
  const rand = rng(2622);
  let external = 0, internal = 0, equalCases = 0, crossings = 0;
  for (let trial = 0; trial < 700; trial++) {
    const a = { x: 50 + rand() * 300, y: 40 + rand() * 220 };
    let b = { x: 50 + rand() * 300, y: 40 + rand() * 220 };
    if (dist(a, b) < 60) b = { x: 380, y: 40 };
    const ra = 10 + rand() * 55;
    const rb = trial % 7 === 0 ? ra : 10 + rand() * 75; // every 7th has equal radii
    const T = { x: 30 + rand() * 340, y: 20 + rand() * 260 };
    const s = stateOf(a, ra, b, rb, T);
    if (!C.isPossible(s)) continue;

    const ce = C.claims(s, "external");
    const oe = Object.values(ce).filter((v) => typeof v === "boolean").every(Boolean);
    if (!oe) check(`trial ${trial}: external claims`, false, JSON.stringify(ce));
    external++;
    if (ce.radiiEqual) equalCases++;

    const m = C.measurements(s, "external");
    if (m.pair) {
      crossings++;
      if (!close(m.angle1, m.angle2, 1e-7)) {
        check(`trial ${trial}: equal crossing angles`, false,
          `${m.angle1} vs ${m.angle2}`);
      }
    }
    if (C.hasInternal(s)) {
      const ci = C.claims(s, "internal");
      if (!Object.values(ci).filter((v) => typeof v === "boolean").every(Boolean)) {
        check(`trial ${trial}: internal claims`, false, JSON.stringify(ci));
      }
      internal++;
    }
  }
  check(`external claims hold on ${external} configurations`, external > 400);
  check(`internal claims hold on ${internal} disjoint configurations`, internal > 200);
  check(`the infinite-Q case occurs ${equalCases} times`, equalCases > 40);
  check(`the equal-angle claim was tested on ${crossings} crossings`, crossings > 60);
}

/* --------- 4b. the internal circle is not an isogonal circle in general */

{
  // The page says the power of inversion at the internal homothety centre is
  // negative. The applet nevertheless draws a real circle there, of radius
  // sqrt(|power|). Circles orthogonal to that drawn circle do NOT in general
  // cut (O1) and (O2) at equal angles: the claim belongs to the external
  // bisectal circle only. This block keeps that failure visible rather than
  // hiding it, and confirms the external claim at the same configurations.
  const rand = rng(9091);
  let tested = 0, internalFailures = 0;
  for (let trial = 0; trial < 1000; trial++) {
    const a = { x: 40 + rand() * 320, y: 30 + rand() * 240 };
    const b = { x: 40 + rand() * 320, y: 30 + rand() * 240 };
    if (dist(a, b) < 90) continue;
    const provisional = stateOf(a, 12 + rand() * 45, b, 12 + rand() * 45, { x: 200, y: 150 });
    if (!C.hasInternal(provisional)) continue;
    // Put T outside the internal bisectal circle, along a perpendicular to the
    // line of centres, so the orthogonal test circle reaches both given circles.
    const bcI = C.bisectal(provisional, "internal");
    const u = C.sub(b, a), d = Math.hypot(u.x, u.y);
    const n = { x: -u.y / d, y: u.x / d };
    const sign = rand() < 0.5 ? 1 : -1;
    const uUnit = { x: u.x / d, y: u.y / d };
    const slide = (rand() - 0.5) * 90; // off the symmetry line: breaks the special case
    const T = C.add(C.add(bcI.center, C.mul(n, (bcI.radius + 70) * sign)), C.mul(uUnit, slide));
    const s = C.withPoint(provisional, "T", T);
    const ext = C.measurements(s, "external");
    const inn = C.measurements(s, "internal");
    if (!ext.pair || !inn.pair) continue;
    tested++;
    if (ext.pair.diff > 1e-7) check(`trial ${trial}: external angles still equal`, false);
    if (inn.pair.diff > 1e-3) internalFailures++;
  }
  check(`the internal circle was compared on ${tested} configurations`, tested > 40);
  check(`the isogonal claim fails for the internal circle in ${internalFailures} of them`,
    internalFailures > 0);
}

/* ---------- 4c. the tangent guide lines touch both circles */

{
  const distToLine = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / Math.hypot(dx, dy);
  };
  const rand = rng(5150);
  let tested = 0;
  for (const [, s] of fixed) {
    for (const kind of ["external", "internal"]) {
      const { c1, c2 } = C.circles(s);
      const lines = C.tangentLines(s, kind);
      if (!lines.length) continue;
      for (const [a, b] of lines) {
        check(`fixed tangent touches both circles (${kind})`,
          close(distToLine(c1.center, a, b), c1.r, 1e-7) &&
          close(distToLine(c2.center, a, b), c2.r, 1e-7));
      }
      tested++;
    }
  }
  for (let trial = 0; trial < 200; trial++) {
    const s = stateOf({ x: 40 + rand() * 320, y: 30 + rand() * 240 }, 12 + rand() * 50,
      { x: 40 + rand() * 320, y: 30 + rand() * 240 }, 12 + rand() * 50, { x: 200, y: 150 });
    if (!C.isPossible(s)) continue;
    const { c1, c2 } = C.circles(s);
    for (const kind of ["external", "internal"]) {
      const lines = C.tangentLines(s, kind);
      if (!lines.length) continue;
      for (const [a, b] of lines) {
        if (!close(distToLine(c1.center, a, b), c1.r, 1e-7) ||
            !close(distToLine(c2.center, a, b), c2.r, 1e-7)) {
          check(`trial ${trial}: ${kind} tangent touches both circles`, false);
        }
      }
      tested++;
    }
  }
  check(`tangent guide lines touch both circles in ${tested} cases`, tested > 100);
}

/* --------------- 5. degenerate and nested input is handled safely */

{
  const nested = stateOf({ x: 200, y: 150 }, 90, { x: 210, y: 150 }, 10, { x: 200, y: 150 });
  check("a circle inside another has no bisectal circle", C.bisectal(nested, "external") === null);
  check("nested circles are reported impossible", C.claims(nested, "external").possible === false);
  const coincident = stateOf({ x: 200, y: 150 }, 20, { x: 200, y: 150 }, 20, { x: 200, y: 150 });
  check("coincident centres are impossible", !C.isPossible(coincident));
  const zero = stateOf({ x: 200, y: 150 }, 0, { x: 280, y: 150 }, 20, { x: 200, y: 150 });
  check("a zero radius is impossible", !C.isPossible(zero));
  const inside = stateOf({ x: 120, y: 150 }, 20, { x: 280, y: 150 }, 60, { x: 150, y: 150 });
  check("a centre inside the bisectal circle has no test circle", C.testCircle(inside, "external") === null);
  check("move() applies a named point", C.move(inside, "T", { x: 1, y: 2 }).T.x === 1);
}

/* -------- 6. the applet's own Compute() against the core's direct formulas */

{
  const rand = rng(777);
  const scenarios = [];
  for (const [, s] of fixed) scenarios.push(s);
  for (let trial = 0; trial < 400; trial++) {
    const a = { x: 60 + rand() * 280, y: 50 + rand() * 200 };
    const b = { x: 60 + rand() * 280, y: 50 + rand() * 200 };
    if (dist(a, b) < 50) continue;
    const ra = 12 + rand() * 45;
    const rb = trial % 9 === 0 ? ra : 12 + rand() * 60;
    scenarios.push(stateOf(a, ra, b, rb, { x: 40 + rand() * 320, y: 30 + rand() * 240 }));
  }
  let compared = 0;
  for (let k = 0; k < scenarios.length; k++) {
    const s = scenarios[k];
    if (!C.isPossible(s)) continue;
    const { c1, c2 } = C.circles(s);
    const scale = Math.max(dist(c1.center, c2.center), c1.r, c2.r);
    const tol = 2e-5 * scale;
    const app = appletCompute(s, false);
    const Q = C.externalCenter(s);
    const bc = C.bisectal(s, "external");
    if (Q && Number.isFinite(app.Q.x)) {
      if (!closePoint(app.Q, Q, tol)) check(`case ${k}: Q matches the applet`, false,
        `applet ${JSON.stringify(app.Q)}, core ${JSON.stringify(Q)}`);
      if (!close(app.radius, bc.radius, tol)) check(`case ${k}: bisectal radius matches the applet`, false,
        `applet ${app.radius}, core ${bc.radius}`);
      const test = C.testCircle(s, "external");
      if (test && Number.isFinite(app.testRadius) &&
          !close(app.testRadius, test.r, tol)) {
        check(`case ${k}: CT radius matches the applet`, false,
          `applet ${app.testRadius}, core ${test.r}`);
      }
    } else if (!Q && (!app.Q || !Number.isFinite(app.Q.x) || app.radius === null)) {
      check(`case ${k}: both agree Q is infinite`, true);
    } else {
      check(`case ${k}: Q finiteness agrees`, false,
        `applet ${JSON.stringify(app.Q)}, core ${JSON.stringify(Q)}`);
    }
    if (C.hasInternal(s)) {
      const P = C.internalCenter(s);
      const bcI = C.bisectal(s, "internal");
      if (!closePoint(app.P, P, tol)) check(`case ${k}: P matches the applet`, false,
        `applet ${JSON.stringify(app.P)}, core ${JSON.stringify(P)}`);
      if (!close(Math.sqrt((dist(app.P, c1.center) - c1.r) * (dist(app.P, c2.center) + c2.r)),
        bcI.radius, tol)) check(`case ${k}: internal radius matches the applet`, false);
    }
    compared++;
  }
  check(`the core matches the applet's Compute on ${compared} configurations`, compared > 300);
}

done("bisectal-circle");
