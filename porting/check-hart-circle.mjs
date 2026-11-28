#!/usr/bin/env node
"use strict";

/*
 * Logic test for hart-circle/hart-circle-core.js.
 *
 *   node porting/check-hart-circle.mjs
 *
 * (1) The whole drawing is compared with a second transcription of the
 * applet's own bytecode (ApolloniusCircle.SetCircles/Compute, the two
 * DrawOneCircle overloads, ComputePoint and update's order) over every
 * dropdown value, both display switches and 48 generated configurations.
 * (2) The page's claims are checked: the i+j+k=6 index rule, the eight
 * curvilinear triangles, one shared arc per associated triangle, the
 * incircle's tangency to the three circles, and the Hart circle's tangency
 * to the four incircles. (3) The illustration's own edges: clamped handles,
 * translated circles, the disabled tangency switch, Reset and "no win".
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("hart-circle/hart-circle-core.js", "HartCircleCore");
const near = (a, b, tol = 1e-8) =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearPoint = (p, q, tol) =>
  !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const nearCircle = (a, b, tol = 1e-8) =>
  (!a && !b) || (!!a && !!b && nearPoint(a, b, tol) && near(a.r, b.r, tol));
const sameList = (a, b, tol) =>
  a.length === b.length && a.every((x, i) => nearCircle(x, b[i], tol));

/* The five sign tables as declared in HartCircleCanvas, written out again
 * here rather than read from the core. */
const T0 = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1],
  [1, -1, -1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
];
const TH = [
  [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1],
  [-1, 1, 1], [1, -1, 1], [-1, -1, 1], [-1, -1, -1],
];
const T1 = [
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [1, 1, 1],
  [-1, -1, -1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
];
const T2 = [
  [1, -1, 1], [1, -1, -1], [1, 1, 1], [-1, -1, 1],
  [1, 1, -1], [-1, -1, -1], [-1, 1, 1], [-1, 1, -1],
];
const T3 = [
  [1, 1, -1], [1, 1, 1], [1, -1, -1], [-1, 1, -1],
  [1, -1, 1], [-1, 1, 1], [-1, -1, -1], [-1, -1, 1],
];

/* ---------------------------------------- 1. a second, literal transcription
 * of the applet's bytecode. Nothing below calls a helper from the core. */

function referencePrepare(circles) {
  const ci = (c) => c.x * c.x + c.y * c.y - c.r * c.r;
  const A1 = 2 * (circles[1].x - circles[0].x);
  const A2 = 2 * (circles[2].x - circles[0].x);
  const B1 = 2 * (circles[1].y - circles[0].y);
  const B2 = 2 * (circles[2].y - circles[0].y);
  const o = ci(circles[0]);
  const D1 = o - ci(circles[1]);
  const D2 = o - ci(circles[2]);
  const K = A1 * B2 - A2 * B1;
  return {
    circles: circles, A1: A1, A2: A2, B1: B1, B2: B2,
    o: o, D1: D1, D2: D2, K: K,
    G: (B1 * D2 - B2 * D1) / K,
    I: -(A1 * D2 - A2 * D1) / K,
  };
}

function referenceCompute(ctx, signs) {
  const s1 = signs[0], s2 = signs[1], s3 = signs[2];
  if (!(Math.abs(ctx.K) >= 0.01)) return null; // TreatZeroDeterminant: null
  const L3 = 2 * (s1 * ctx.circles[0].r - s2 * ctx.circles[1].r);
  const L5 = 2 * (s1 * ctx.circles[0].r - s3 * ctx.circles[2].r);
  const X = (ctx.B1 * L5 - ctx.B2 * L3) / ctx.K;
  const Y = -(ctx.A1 * L5 - ctx.A2 * L3) / ctx.K;
  const Q = X * X + Y * Y - 1;
  if (!(Math.abs(Q) >= 0.001)) return null;
  // The bytecode's last dmul multiplies the entire bracket by two.
  const P = 2 * (X * ctx.G + Y * ctx.I - X * ctx.circles[0].x
    - Y * ctx.circles[0].y + s1 * ctx.circles[0].r);
  const R = ctx.G * ctx.G + ctx.I * ctx.I - 2 * ctx.G * ctx.circles[0].x
    - 2 * ctx.I * ctx.circles[0].y + ctx.o;
  let disc = P * P - 4 * Q * R;
  if (!(disc >= 0)) return null;
  disc = Math.sqrt(disc);
  const result = [];
  for (const root of [(-P + disc) / (2 * Q), (-P - disc) / (2 * Q)]) {
    // Signed root for x and y, absolute value for m_R.
    result.push({
      x: X * root + ctx.G,
      y: Y * root + ctx.I,
      r: root < 0 ? -root : root,
    });
  }
  return result;
}

function referenceDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.r - b.r);
}

function referenceDrawOne(ctx, used, signs) {
  const pair = referenceCompute(ctx, signs);
  if (!pair) return null;
  let chosen = pair[0];
  for (const old of used) {
    if (referenceDistance(pair[0], old) < 1) chosen = pair[1];
  }
  if (chosen) used.push(chosen);
  return chosen;
}

function referenceComputePoint(a, b) {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  const scale = b.r / d;
  let sign = 1;
  if ((b.r > d || a.r > d) && a.r > b.r) sign = -1;
  return { x: b.x + sign * (a.x - b.x) * scale,
           y: b.y + sign * (a.y - b.y) * scale };
}

function referenceIsTangent(a, b) {
  if (!a || !b) return false;
  const q = referenceComputePoint(a, b);
  return Math.abs(Math.hypot(q.x - a.x, q.y - a.y) - a.r) < 2;
}

function referenceDrawOneTangent(ctx, used, signs, target) {
  const pair = referenceCompute(ctx, signs);
  if (!pair) return null;
  const chosen = referenceIsTangent(pair[0], target) ? pair[0] : pair[1];
  if (chosen) used.push(chosen);
  return chosen;
}

function referenceUpdate(state) {
  const given = state.circles.map((item) => ({
    x: item.c.x, y: item.c.y, r: Math.hypot(item.c.x - item.b.x, item.c.y - item.b.y),
  }));
  const s0 = T0[state.variant], s1 = T1[state.variant];
  const s2 = T2[state.variant], s3 = T3[state.variant];
  const sH = TH[state.variant];
  const base = referenceDrawOne(referencePrepare(given), [], s0);
  const extras = [];
  let hart = null;
  if (state.showAddOns) {
    extras.push(referenceDrawOne(referencePrepare(given), [], s1));
    extras.push(referenceDrawOne(referencePrepare(given), [], s2));
    extras.push(referenceDrawOne(referencePrepare(given), [], s3));
    if (extras.every(Boolean)) {
      hart = referenceDrawOneTangent(referencePrepare(extras), [], sH, base);
    }
  } else {
    extras.push(null, null, null);
  }
  const dots = [];
  if (state.showTangency && state.showAddOns) {
    const pairs = [];
    if (base) for (const c of given) pairs.push([base, c, "base"]);
    for (const e of extras) if (e) for (const c of given) pairs.push([e, c, "extra"]);
    if (hart && base) pairs.push([hart, base, "hart"]);
    if (hart) for (const e of extras) if (e) pairs.push([hart, e, "hart"]);
    for (const [a, b, kind] of pairs) {
      dots.push({ p: referenceComputePoint(a, b), kind: kind });
    }
  }
  return { given: given, base: base, extras: extras, hart: hart, dots: dots };
}

{
  equal("the core's five sign tables match the bytecode", [
    C.SIGNS0, C.SIGNS, C.SIGNS1, C.SIGNS2, C.SIGNS3,
  ], [T0, TH, T1, T2, T3]);

  const rand = rng(90210);
  const configurations = [C.start({})];
  for (let i = 0; i < 48; i++) {
    const s = C.start({});
    s.circles = [0, 1, 2].map(() => {
      const c = C.point(55 + rand() * 290, 45 + rand() * 210);
      const a = rand() * 2 * Math.PI;
      const r = 30 + rand() * 95;
      return { c: c, b: C.point(c.x + r * Math.cos(a), c.y + r * Math.sin(a)) };
    });
    configurations.push(s);
  }
  let cases = 0;
  for (const configuration of configurations) {
    for (let v = 0; v < 8; v++) {
      for (const showAddOns of [false, true]) {
        for (const showTangency of [false, true]) {
          const state = C.setOption(C.setOption(
            Object.assign({}, configuration, { variant: v }),
            "showAddOns", showAddOns), "showTangency", showTangency);
          const got = C.geometry(state);
          const ref = referenceUpdate(state);
          cases++;
          check("core matches applet's three given circles", sameList(got.given, ref.given));
          check("core matches applet's base incircle", nearCircle(got.base, ref.base));
          check("core matches applet's three associated incircles", sameList(got.extras, ref.extras));
          check("core matches applet's Hart circle", nearCircle(got.hart, ref.hart));
          check("core matches applet's tangency dots",
            got.tangency.length === ref.dots.length
            && got.tangency.every((dot, i) => nearPoint(dot.p, ref.dots[i].p)
              && dot.kind === ref.dots[i].kind));
        }
      }
    }
  }
  check("the comparison covered the option space", cases === 49 * 8 * 4, `${cases} cases`);
}

/* ---------------------------------------------- 2. the page's claims */

{
  // With i, j, k distinct in {1,2,3}, i+j+k=6 has exactly one solution.
  const triples = [];
  for (let i = 1; i <= 3; i++) {
    for (let j = 1; j <= 3; j++) {
      for (let k = 1; k <= 3; k++) {
        if (new Set([i, j, k]).size === 3 && i + j + k === 6) triples.push([i, j, k]);
      }
    }
  }
  equal("i+j+k=6 names only the triple 1,2,3",
    [...new Set(triples.map((t) => t.slice().sort().join(",")))], ["1,2,3"]);
  check("c1 and c3 meet at A2 (1+3+2=6)", triples[0].includes(2));
}

{
  // The default three circles cut the canvas into eight curvilinear triangles:
  // sample every inside/outside combination, including the outside region.
  const g = C.geometry(C.start({}));
  const seen = new Set();
  for (let x = 2; x < 400; x += 2) {
    for (let y = 2; y < 300; y += 2) {
      let mask = 0;
      for (let i = 0; i < 3; i++) {
        if (Math.hypot(x - g.given[i].x, y - g.given[i].y) < g.given[i].r) mask |= 1 << i;
      }
      seen.add(mask);
    }
  }
  equal("the starting circles form eight curved triangles", [...seen].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
}

{
  // Each associated triangle differs from the base at one intersection point,
  // so it shares the opposite arc (and two vertices) with the base.
  for (let v = 0; v < 8; v++) {
    const base = C.SIGNS0[v];
    const extras = [C.SIGNS1[v], C.SIGNS2[v], C.SIGNS3[v]];
    const changed = extras.map((e) => e.reduce((n, s, i) => n + (s !== base[i] ? 1 : 0), 0));
    equal(`variant ${v} has three one-arc neighbours`, changed, [1, 1, 1]);
    check(`variant ${v}'s neighbours use three different arcs`,
      new Set(extras.map((e) => e.findIndex((s, i) => s !== base[i]))).size === 3);
  }
}

{
  // At the applet's own starting placement, the theorem is exact in all
  // eight configurations: the green incircle touches all three given
  // circles, and the blue Hart circle touches all four incircles.
  for (let v = 0; v < 8; v++) {
    const g = C.geometry(C.start({ variant: v, showAddOns: true }));
    check(`base ${C.OPTIONS[v]}: green incircle tangent to c1,c2,c3`,
      !!g.base && g.given.every((c) => C.tangent(g.base, c, 1e-6)));
    check(`base ${C.OPTIONS[v]}: Hart circle tangent to all four incircles`,
      !!g.hart && [g.base, ...g.extras].every((c) => C.tangent(g.hart, c, 1e-6)));
  }
}

{
  // Dragged arrangements: keep only those where the three circles really do
  // form eight regions, as the page supposes, and check the claim there.
  const rand = rng(4242);
  let arrangements = 0, cases = 0, pairsChecked = 0, tangentWithinTolerance = 0, exactMisses = 0;
  for (let trial = 0; trial < 100 && arrangements < 25; trial++) {
    const s = C.start({ showAddOns: true });
    s.circles = [0, 1, 2].map(() => {
      const c = C.point(85 + rand() * 230, 70 + rand() * 160);
      const a = rand() * 2 * Math.PI;
      return { c: c, b: C.point(c.x + 50 * Math.cos(a), c.y + 50 * Math.sin(a)) };
    });
    const g0 = C.geometry(s);
    const masks = new Set();
    for (let x = 4; x < 400; x += 4) {
      for (let y = 4; y < 300; y += 4) {
        let mask = 0;
        for (let i = 0; i < 3; i++) {
          if (Math.hypot(x - g0.given[i].x, y - g0.given[i].y) < g0.given[i].r) mask |= 1 << i;
        }
        masks.add(mask);
      }
    }
    if (masks.size !== 8) continue;
    arrangements++;
    for (let v = 0; v < 8; v++) {
      const g = C.geometry(Object.assign({}, s, { variant: v }));
      cases++;
      check(`dragged ${arrangements}/${C.OPTIONS[v]}: incircle tangent to c1,c2,c3`,
        !!g.base && g.given.every((c) => C.tangent(g.base, c, 0.02)));
      if (!g.hart) continue;
      for (const c of [g.base, ...g.extras]) {
        pairsChecked++;
        if (C.tangent(g.hart, c, 2)) tangentWithinTolerance++;
        if (!C.tangent(g.hart, c, 0.02)) exactMisses++;
      }
    }
  }
  check("the drag test found eight-region arrangements", arrangements >= 10, `${arrangements}`);
  check("every generated case was examined", cases === arrangements * 8);
  check("every Hart tangency holds within the applet's 2px test",
    pairsChecked > 0 && tangentWithinTolerance === pairsChecked,
    `${tangentWithinTolerance}/${pairsChecked} tangent pairs`);
  check("the exact-miss count is small (the solver uses a 2px tolerance)",
    exactMisses <= 3, `${exactMisses} pairs off by more than 0.02px`);
}

/* ------------------------------------- 3. the illustration's own edges */

{
  const s0 = C.start({});
  equal("the applet's start has three circles on a 400x300 canvas",
    s0.circles.map((x) => [Math.round(x.c.x), Math.round(x.c.y), Math.round(C.dist(x.c, x.b))]),
    [[200, 200, 55], [243, 125, 75], [157, 125, 100]]);
  equal("the applet starts on the +++ base triangle", s0.variant, 0);
  check("the red circles and their tangency dots start hidden",
    !s0.showAddOns && !s0.showTangency && C.geometry(s0).tangency.length === 0);
  equal("result() is always null for an illustration",
    [C.result(s0), C.result(C.start({ showAddOns: true }))], [null, null]);

  const outside = C.move(s0, "c1", C.point(-500, 9999));
  check("a dragged centre is clamped to the board",
    outside.circles[0].c.x >= C.PAD && outside.circles[0].c.y <= 300 - C.PAD);
  check("moving a boundary point changes the radius",
    Math.abs(C.geometry(C.move(s0, "b1", C.point(200, 260))).given[0].r - 60) < 1e-9);
  check("unknown handle names are refused", C.move(s0, "z9", C.point(1, 1)) === s0);

  const radius = C.geometry(s0).given[1].r;
  const moved = C.moveCircle(s0, 1, C.point(25, -15));
  check("dragging the whole circle keeps its radius",
    near(C.geometry(moved).given[1].r, radius));
  check("dragging the whole circle moves centre and boundary together",
    near(moved.circles[1].c.x - s0.circles[1].c.x, 25)
    && near(moved.circles[1].b.y - s0.circles[1].b.y, -15));
  check("a circle drag past the edge stops at the edge",
    C.moveCircle(s0, 0, C.point(9999, -9999)).circles[0].c.x <= 400 - C.PAD);

  equal("dropdown values are clamped", [
    C.clampVariant(-3), C.clampVariant(12), C.clampVariant("---"), C.clampVariant("???"),
  ], [0, 7, 7, 0]);
  const withSwitches = C.setOption(C.setOption(s0, "showAddOns", true), "showTangency", true);
  check("the tangency switch works while the red circles are on", withSwitches.showTangency);
  const hidden = C.setOption(withSwitches, "showAddOns", false);
  check("hiding the red circles switches tangency dots off as the applet does",
    !hidden.showTangency && !C.geometry(hidden).tangencyShown);
  check("the tangency checkbox stays off while disabled",
    !C.setOption(hidden, "showTangency", true).showTangency);
  const afterReset = C.reset(withSwitches);
  check("Reset keeps the chosen options but restores the circles",
    afterReset.variant === withSwitches.variant && afterReset.showAddOns
    && afterReset.showTangency
    && nearCircle(C.geometry(afterReset).given[0], C.geometry(C.start({})).given[0]));
  check("the status line describes the shown circles",
    /Hart circle/.test(C.describe(withSwitches)) && /additional circles/.test(C.describe(s0)));

  // The applet's own tangent test is deliberately loose: this pair passes it
  // although its circles miss exact tangency by one pixel.
  const looseA = { x: 100, y: 0, r: 20 };
  const looseB = { x: 0, y: 0, r: 81 };
  check("the applet's 2px test can accept a 1px gap",
    C.isTangent(looseA, looseB) && !C.tangent(looseA, looseB, 0.02));
}

done("hart-circle");
