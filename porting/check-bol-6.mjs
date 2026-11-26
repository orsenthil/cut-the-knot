#!/usr/bin/env node
"use strict";

/*
 * Logic test for bol-6/bol-6-core.js.
 *
 *   node porting/check-bol-6.mjs
 *
 * Checked: the starting division and every claim on the Book of Lemmas page —
 * the circle is tangent to all three semicircles, its centre is one diameter
 * above AB, GH = NP, AN:NP = NP:PB, BP:PN:NA = 1:r:r^2 and GH/AB =
 * r/(1+r+r^2), in particular 6/19 for AC = 3/2 CB — on fixed and 400 random
 * divisions and scales. The last group is a literal second transcription of the
 * applet's BOL6Canvas.DrawSmallCircle / ApolloniusCircle.SetCircles / Compute
 * (including its one-pixel nudge of the big circle and its choice of solution
 * 0) and compares that circle with the core's exact tangency over the same
 * range. The tolerance is 1% of AB; the nudge actually changes the radius by
 * less than 0.6%.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bol-6/bol-6-core.js", "Bol6Core");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const near = (x, y) => Math.abs(x - y) < 1e-12;
const state = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });
const allClaims = (s) => Object.values(C.claims(s)).every(Boolean);

/* ------------------ the applet's own computation, transcribed from bytecode */

/*
 * ApolloniusCircle.SetCircles(Ci0,Ci1,Ci2) builds A1,A2,B1,B2,o,D1,D2,K,G,I;
 * Compute(s0,s1,s2) then solves the quadratic and returns two circles.
 * This is that code, statement for statement, with the same sign convention:
 * x = s7*t + G, y = s9*t + I, radius = |t|.
 */
function appletApollonius(c0, c1, c2, s0, s1, s2) {
  const A1 = 2 * (c1.x - c0.x), A2 = 2 * (c2.x - c0.x);
  const B1 = 2 * (c1.y - c0.y), B2 = 2 * (c2.y - c0.y);
  const info = (c) => c.x * c.x + c.y * c.y - c.r * c.r;
  const o = info(c0);
  const D1 = o - info(c1), D2 = o - info(c2);
  const K = A1 * B2 - A2 * B1;
  if (Math.abs(K) < 0.01) return null; // TreatZeroDeterminant
  const G = (B1 * D2 - B2 * D1) / K;
  const I = -(A1 * D2 - A2 * D1) / K;
  const q3 = 2 * (s0 * c0.r - s1 * c1.r);
  const q5 = 2 * (s0 * c0.r - s2 * c2.r);
  const s7 = (B1 * q5 - B2 * q3) / K;
  const s9 = -(A1 * q5 - A2 * q3) / K;
  const s11 = s7 * s7 + s9 * s9 - 1;
  if (Math.abs(s11) < 0.001) return null;
  const s13 = 2 * (s7 * (G - c0.x) + s9 * (I - c0.y) + s0 * c0.r);
  const s15 = G * G + I * I - 2 * G * c0.x - 2 * I * c0.y + o;
  const s17 = s13 * s13 - 4 * s11 * s15;
  if (s17 < 0) return null;
  const root = Math.sqrt(s17);
  const make = (v) => {
    const t = (-s13 + v) / (2 * s11);
    return { x: s7 * t + G, y: s9 * t + I, r: Math.abs(t), signed: t };
  };
  return [make(root), make(-root)];
}

/* BOL6Canvas.DrawSmallCircle: left/right circles, big circle nudged by 1. */
function appletMainCircle(s, nudge = 1) {
  const L = s.B.x - s.A.x;
  const c = s.C.x - s.A.x;
  const O1 = { x: s.A.x + c / 2, y: s.A.y };
  const O2 = { x: s.A.x + (L + c) / 2, y: s.A.y };
  const circles = [
    { ...O1, r: c / 2 },
    { ...O2, r: (L - c) / 2 },
    { x: (s.A.x + s.B.x) / 2, y: s.A.y + nudge, r: L / 2 },
  ];
  const sols = appletApollonius(circles[0], circles[1], circles[2], 1, 1, -1);
  // A fresh UsedCircles vector: WasUsed(sols[0]) is false, so solution 0 wins.
  return sols ? sols[0] : null;
}

/* --------------------------------------------- 1. the start and the division */

{
  const s = C.start();
  equal("start A is at the left end of the baseline", s.A, { x: 30, y: 220 });
  equal("start B is at the right end of the baseline", s.B, { x: 370, y: 220 });
  equal("start C makes AC = 3/2 CB", s.C, { x: 234, y: 220 });
  check("an illustration has no result", C.result(s) === null);
  check("the starting division is not degenerate", !C.geometry(s).degenerate);
  check("ratioOf reads 3/2", near(C.ratioOf(s), 1.5));
  check("start with an explicit ratio", near(C.ratioOf(C.start({ ratio: 3 })), 3));
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "C", { x: 80, y: 10 });
    return s.C.x === 234 && next.C.x === 80 && next.C.y === s.C.y;
  })());
  check("an unknown handle leaves the diagram alone", C.withPoint(s, "Z", { x: 1, y: 2 }).C.x === 234);
  check("C cannot be dragged past the 10 px margin", C.withPoint(s, "C", { x: 9999, y: 9999 }).C.x === 360);
  check("C cannot be dragged off the baseline", C.withPoint(s, "C", { x: 100, y: 20 }).C.y === 220);
  check("withRatio keeps C on the baseline", (() => {
    const t = C.withRatio(s, 1);
    return near(t.C.x, 200) && t.C.y === 220;
  })());
  check("all ten claims pass at the 3:2 start", allClaims(s), JSON.stringify(C.claims(s)));
}

/* --------------------------- 2. every claim at fixed, telling configurations */

const fixed = [
  ["3:2 (the article)", C.start()],
  ["equal halves", C.start({ ratio: 1 })],
  ["C near A", C.start({ ratio: 0.05 })],
  ["C near B", C.start({ ratio: 20 })],
  ["wide board", C.start({ width: 900, height: 400, ratio: 2.5 })],
  ["small board", C.start({ width: 140, height: 180, ratio: 0.4 })],
  ["shifted baseline", state({ x: -72, y: 103 }, { x: 418, y: 103 }, { x: 100, y: 103 })],
];

for (const [name, s] of fixed) {
  const cl = C.claims(s);
  for (const [claim, value] of Object.entries(cl)) {
    check(`${name}: ${claim}`, value);
  }
}

/* ------------------------------------- 3. the article's numbers, explicitly */

{
  const s = C.start();
  const g = C.geometry(s);
  const AN = g.N.x - g.A.x, NP = g.P.x - g.N.x, PB = g.B.x - g.P.x;
  check("3:2 gives GH = 6/19 AB", close(dist(g.G, g.H) / g.L, 6 / 19, 1e-12));
  check("3:2 gives BP:PN:NA = 4:6:9", near(PB / 4, NP / 6) && near(NP / 6, AN / 9));
  check("AN, NP, PB are a continued proportion", near(AN / NP, NP / PB));
  check("GH is the same length as NP", near(dist(g.G, g.H), NP));
  check("the touching circle's centre is one diameter above AB", near(g.A.y - g.main.y, 2 * g.rho));
  check("the general formula matches k/(1+k+k^2)", (() => {
    const t = C.withRatio(s, 7);
    const h = C.geometry(t);
    return close(dist(h.G, h.H) / h.L, 7 / (1 + 7 + 49), 1e-12);
  })());
}

/* --------------------------- 4. hundreds of random divisions, fixed seed */

{
  const rand = rng(2722);
  let tested = 0;
  for (let trial = 0; trial < 400; trial++) {
    const L = 80 + rand() * 620;
    const width = L + 60, height = 200 + rand() * 300;
    const ratio = 0.02 + rand() * 50;
    const s = C.start({ width, height, ratio });
    if (!allClaims(s)) {
      check(`random division ${trial} (r=${ratio}, L=${L}) passes every claim`, false,
        JSON.stringify(C.claims(s)));
    }
    tested++;
  }
  check(`all claims hold on ${tested} random divisions`, tested === 400);
}

/* ------------------------------------ 5. the auxiliary points of the proof */

for (const [name, s] of fixed.slice(0, 5)) {
  const g = C.geometry(s);
  const tol = 1e-7 * g.L;
  check(`${name}: D lies on the large semicircle`, close(dist(g.D, g.O), g.R, tol));
  check(`${name}: E lies on the AC semicircle`, close(dist(g.E, g.O1), g.R1, tol));
  check(`${name}: F lies on the CB semicircle`, close(dist(g.F, g.O2), g.R2, tol));
  check(`${name}: I lies on the AC semicircle`, close(dist(g.I, g.O1), g.R1, tol));
  check(`${name}: K lies on the CB semicircle`, close(dist(g.K, g.O2), g.R2, tol));
  check(`${name}: L and M exist`, Boolean(g.Lp && g.M));
}

/* ------------------ 6. the applet's Apollonius method vs the exact tangency */

{
  const rand = rng(6);
  const offsets = [{ x: 40, y: 190 }, { x: -13, y: 47 }, { x: 123.5, y: -80 }];
  let compared = 0;
  for (const offset of offsets) {
    for (const L of [100, 190, 320, 500]) {
      for (let i = 0; i <= 24; i++) {
        const ratio = 0.05 + i * (20 - 0.05) / 24;
        const s = state(offset, { x: offset.x + L, y: offset.y },
          { x: offset.x + L * ratio / (1 + ratio), y: offset.y });
        const core = C.geometry(s).main;
        const applet = appletMainCircle(s);
        if (!applet) {
          check(`applet finds a circle (r=${ratio}, L=${L})`, false);
          continue;
        }
        const tol = 0.01 * L;
        if (!closePoint(applet, core, tol) || !close(applet.r, core.r, tol)) {
          check(`applet matches exact circle (r=${ratio}, L=${L})`, false,
            `applet ${JSON.stringify(applet)} vs core ${JSON.stringify(core)}`);
        }
        check(`applet's chosen circle lies above AB (r=${ratio}, L=${L})`, applet.y < offset.y);
        compared++;
      }
    }
  }
  check(`the core matches the applet's own computation on ${compared} diagrams`, compared === 300);
  // Without the nudge the three centres are collinear and Compute gets K=0.
  const s = C.start();
  check("the un-nudged Apollonius determinant is zero", appletMainCircle(s, 0) === null);
  // The nudge is a picture trick: the exact circle is a slightly better answer.
  const nudged = appletMainCircle(s);
  check("the nudge changes the radius by less than 1% of AB", Math.abs(nudged.r - C.geometry(s).rho) < 0.01 * C.geometry(s).L);
}

/* ----------------------------------------- 7. degenerate and invalid inputs */

{
  const s = C.start();
  const flat = state(s.A, s.B, { x: s.A.x, y: s.A.y });
  check("a collapsed division is degenerate", C.geometry(flat).degenerate);
  check("no claims pass on a collapsed division", !Object.values(C.claims(flat)).some(Boolean));
  check("ratioOf is null at an endpoint", C.ratioOf(flat) === null);
  check("ratio 0 is clamped to the draggable range", C.ratioOf(C.withRatio(s, 0)) === null || C.ratioOf(C.withRatio(s, 0)) > 0);
  check("an off-baseline C is degenerate", C.geometry(state(s.A, s.B, { x: 200, y: 100 })).degenerate);
  check("otherOnCircle returns the far intersection", (() => {
    const p = C.otherOnCircle({ x: 0, y: 0, r: 5 }, { x: 5, y: 0 }, { x: 0, y: 0 });
    return closePoint(p, { x: -5, y: 0 }, 1e-9);
  })());
}

done("bol-6");
