#!/usr/bin/env node
"use strict";

/*
 * Logic test for homothety/homothety-core.js.
 *
 *   node porting/check-homothety.mjs
 *
 * The first sections transcribe CTKHSlider.Value/UpdateValue/UpdateValuePoint
 * and Transform.PerformTransform straight from javap and compare them with the
 * core over grids of slider positions, centers and coefficients. Later
 * sections check every claim the cut-the-knot page makes: the signed ratio
 * OP'/OP = k, angles, parallel lines, orientation, the inverse and fixed
 * point, and the composition of two homotheties, over grids of configurations.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("homothety/homothety-core.js", "HomothetyCore");
const EPS = 1e-8;
const close = (a, b, eps = EPS) => Math.abs(a - b) <= eps;
const ptClose = (a, b, eps = EPS) => close(a.x, b.x, eps) && close(a.y, b.y, eps);
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const area2 = (a, b, c) => cross(a, b, c);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const dot = (a, b, c) => (b.x - a.x) * (c.x - a.x) + (b.y - a.y) * (c.y - a.y);

/* ------------------------ second transcription of the applet's own bytecode */

// CTKHSlider.UpdateValuePoint(): MPValue.P.x = O.x + (U.x - O.x) * Value.
function appletValuePoint(s) {
  return s.O.x + (s.U.x - s.O.x) * s.k;
}
// CTKHSlider.UpdateValue(): only if Math.abs(U.x - O.x) > 1.
function appletUpdateValue(s, v) {
  return Math.abs(s.U.x - s.O.x) > 1 ? (v - s.O.x) / (s.U.x - s.O.x) : s.k;
}
// Transform.PerformTransform(): O + k * (P - O), k = Slider.Value().
function appletPerform(t, p) {
  const k = t.slider.k;
  return {
    x: t.center.x + k * (p.x - t.center.x),
    y: t.center.y + k * (p.y - t.center.y),
  };
}
function sliderForK(k, y = 20) {
  return { O: { x: 30, y: y }, U: { x: 60, y: y }, V: { x: 30 + 30 * k, y: y }, k: k };
}
function transformFor(k, center) {
  return { center: center, slider: sliderForK(k) };
}

/* ------------------------------------------------------ 1. the start state */

{
  const s = C.start({});
  equal("new arrangement has one homothety", s.transforms.length, 1);
  equal("new arrangement has no polygons, as in the applet", s.polygons.length, 0);
  equal("default polygon sides", s.sides, 5);
  equal("default # homotheties", s.count, 1);
  equal("default slider origin is 0", s.transforms[0].slider.O, { x: 30, y: 20 });
  equal("default slider unit is 1", s.transforms[0].slider.U, { x: 60, y: 20 });
  equal("default slider value is 1.5", s.transforms[0].slider.V, { x: 75, y: 20 });
  equal("default coefficient", C.coefficient(s.transforms[0]), 1.5);
  equal("the illustration has no outcome", C.result(s), null);
  check("center x is inside the applet's width",
    s.transforms[0].center.x >= 0 && s.transforms[0].center.x <= C.WIDTH);
  check("center y is inside the applet's height",
    s.transforms[0].center.y >= 0 && s.transforms[0].center.y <= C.HEIGHT);

  const big = C.start({ count: 99, sides: 99, seed: 7 });
  equal("# homotheties is capped at 20", big.transforms.length, 20);
  equal("sides are capped at 20", big.sides, 20);
  const small = C.start({ count: -4, sides: 0, seed: 7 });
  equal("# homotheties is at least 1", small.transforms.length, 1);
  equal("sides are at least 3", small.sides, 3);
  const twenty = C.start({ count: 20, sides: 20, seed: 11 });
  equal("twenty rows are all present", twenty.transforms.length, 20);
  check("last slider row stays on the board",
    twenty.transforms[19].slider.O.y <= 330, `y=${twenty.transforms[19].slider.O.y}`);
  check("seed reproduces the arrangement", JSON.stringify(C.start({ seed: 11, count: 20 }).transforms) ===
    JSON.stringify(twenty.transforms));
}

/* ------------------------- 2. slider arithmetic against the Java bytecode */

{
  let ok = true, worst = "";
  const origins = [0, 20, 30, 41, 60, 100];
  const units = [-20, 0, 29, 30, 31, 60, 90];
  const values = [-40, 0, 30, 45, 75, 120];
  for (const O of origins) for (const U of units) for (const V of values) {
    const s0 = { O: { x: O, y: 20 }, U: { x: U, y: 20 }, V: { x: 0, y: 20 }, k: 1.5 };
    // SetValue(1.5) calls UpdateValuePoint, then dragging V calls UpdateValue.
    s0.V.x = appletValuePoint(s0);
    const expectedK = appletUpdateValue(s0, V);
    // UpdateValue() only moves V indirectly when it can read the coefficient;
    // with a degenerate slider the dragged point simply stays where it was.
    const expectedV = Math.abs(s0.U.x - s0.O.x) > 1
      ? s0.O.x + (s0.U.x - s0.O.x) * expectedK : V;
    const t = transformFor(1.5, { x: 123, y: 77 });
    t.slider = s0;
    let got = C.withTransformPoint({ transforms: [t], polygons: [] }, 0, "V", { x: V, y: 20 });
    const t2 = got.transforms[0];
    if (!close(t2.slider.k, expectedK) || !close(t2.slider.V.x, expectedV) ||
        !close(C.coefficient(t2), expectedK)) {
      ok = false;
      worst = `O=${O} U=${U} V=${V}: expected k=${expectedK}, V=${expectedV}, got k=${t2.slider.k}, V=${t2.slider.V.x}`;
    }
  }
  check("dragging V matches CTKHSlider.UpdateValue on 252 slider settings", ok, worst);

  ok = true; worst = "";
  for (const O of origins) for (const U of units) {
    const k = 1.5;
    const s0 = { O: { x: O, y: 20 }, U: { x: U, y: 20 }, V: { x: 0, y: 20 }, k: k };
    s0.V.x = appletValuePoint(s0);
    const t = transformFor(k, { x: 123, y: 77 });
    t.slider = s0;
    let state = { transforms: [t], polygons: [] };
    state = C.withTransformPoint(state, 0, "O", { x: O + 7, y: 20 });
    const afterO = state.transforms[0].slider;
    const expO = O + 7 + (U - (O + 7)) * k;
    state = C.withTransformPoint(state, 0, "U", { x: U - 5, y: 20 });
    const afterU = state.transforms[0].slider;
    const expU = (O + 7) + ((U - 5) - (O + 7)) * k;
    if (!close(afterO.V.x, expO) || !close(afterO.k, k) ||
        !close(afterU.V.x, expU) || !close(afterU.k, k)) {
      ok = false;
      worst = `O=${O} U=${U}: expected V ${expO}/${expU}, got ${afterO.V.x}/${afterU.V.x}`;
    }
  }
  check("dragging O or U calls UpdateValuePoint but keeps k (42 settings)", ok, worst);

  ok = true;
  for (const gap of [0, 0.25, -0.5, 1, -1]) {
    const t = transformFor(1.5, { x: 0, y: 0 });
    t.slider.O.x = 30;
    t.slider.U.x = 30 + gap;
    t.slider.V.x = 30 + gap * 1.5;
    const next = C.withTransformPoint({ transforms: [t], polygons: [] }, 0, "V", { x: 200, y: 20 });
    if (!close(next.transforms[0].slider.k, 1.5)) ok = false;
  }
  check("a slider shorter than two pixels refuses to change k", ok);
}

/* ----------------- 3. PerformTransform and the chain of images, exhaustively */

{
  let ok = true, worst = "";
  const ks = [-3, -1.5, -0.25, 0, 0.25, 0.5, 1, 1.5, 3, 7];
  const centers = [{ x: 0, y: 0 }, { x: 123.4, y: -77 }, { x: 400, y: 300 }];
  const points = [{ x: 5, y: 9 }, { x: -80, y: 310 }, { x: 250, y: 145 }];
  for (const k of ks) for (const center of centers) {
    const t = transformFor(k, center);
    for (const p of points) {
      const expected = appletPerform(t, p);
      const got = C.transformPoint(t, p);
      if (!ptClose(got, expected)) {
        ok = false;
        worst = `k=${k} O=${JSON.stringify(center)} P=${JSON.stringify(p)}: got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`;
      }
    }
  }
  check("Transform.PerformTransform matches the core on 90 configurations", ok, worst);

  ok = true; worst = "";
  for (let n = 1; n <= 20; n++) for (let sides = 3; sides <= 20; sides += 2) {
    let s = C.start({ count: n, sides: sides, seed: 31 });
    for (let j = 0; j < 3; j++) s = C.addPolygon(s, sides);
    let shapes = s.polygons.map((p) => p.vertices);
    const chain = C.images(s);
    for (let i = 0; i < n; i++) {
      const t = s.transforms[i];
      shapes = shapes.map((poly) => poly.map((p) => appletPerform(t, p)));
      if (chain[i].length !== shapes.length) { ok = false; worst = `n=${n}, i=${i}`; }
      for (let j = 0; j < shapes.length; j++) {
        if (shapes[j].length !== sides) { ok = false; worst = `sides=${sides}`; }
        for (let v = 0; v < sides; v++) {
          if (!ptClose(chain[i][j][v], shapes[j][v])) {
            ok = false;
            worst = `n=${n} sides=${sides} i=${i} v=${v}`;
          }
        }
      }
    }
    if (!ptClose(C.finalPolygons(s)[0][0], chain[n - 1][0][0])) ok = false;
  }
  check("chained images match a second transcript for all 180 (n, sides) pairs", ok, worst);

  let s = C.start({ count: 4, sides: 7, seed: 5 });
  s = C.addPolygon(s, 7);
  s = C.addPolygon(s, 7);
  const removed = C.removeLastPolygon(s);
  equal("RemoveNGon removes one polygon", removed.polygons.length, 1);
  check("RemoveNGon takes the last one",
    JSON.stringify(removed.polygons[0]) === JSON.stringify(s.polygons[0]));
  s = C.setCount(s, 2);
  equal("SetN shrinks the array", s.transforms.length, 2);
  equal("SetN updates count", s.count, 2);
  s = C.setCount(s, 6);
  equal("SetN grows it again", s.transforms.length, 6);
  equal("new sliders start at 1.5", C.coefficient(s.transforms[5]), 1.5);
  check("old centers survive SetN",
    ptClose(s.transforms[0].center, C.start({ count: 4, seed: 5 }).transforms[0].center));
}

/* ----------------------------------------------- 4. the page's exact claims */

{
  // (1) OP'/OP = k, with signed segments: the image is on line OP and its
  // signed projection onto OP is k times the original.
  let ok = true;
  for (const k of [-2.5, -1, -0.2, 0.2, 0.75, 1, 2, 4]) {
    const O = { x: 130, y: -45 };
    const P = { x: 71, y: 200 };
    const t = transformFor(k, O);
    const P2 = C.transformPoint(t, P);
    const len = dist(O, P);
    const signed = dot(O, P, P2) / (len * len);
    if (!close(signed, k, 1e-10) || !close(cross(O, P, P2), 0, 1e-9)) ok = false;
  }
  check("page claim (1): signed OP'/OP equals k and P' lies on OP", ok);

  // Negative k puts P and P' on opposite sides; k=1 is the identity; k=0
  // collapses everything to O (the case the page excludes).
  let okNeg = true, okIdentity = true, okZero = true;
  for (const k of [-4, -1.5, -0.1]) {
    const O = { x: 90, y: 60 }, P = { x: 200, y: 30 };
    const P2 = C.transformPoint(transformFor(k, O), P);
    if (dot(O, P, P2) >= 0) okNeg = false;
  }
  for (const p of [{ x: 0, y: 0 }, { x: 210, y: -30 }, { x: -70, y: 310 }]) {
    if (!ptClose(C.transformPoint(transformFor(1, { x: 90, y: 60 }), p), p)) okIdentity = false;
    if (!ptClose(C.transformPoint(transformFor(0, { x: 90, y: 60 }), p), { x: 90, y: 60 })) okZero = false;
  }
  check("negative k puts P and P' on opposite sides of O", okNeg);
  check("k = 1 is the identity transformation", okIdentity);
  check("k = 0 is the trivial map to O", okZero);

  // Parallel lines map to parallel lines, angles and oriented areas survive.
  let okParallel = true, okAngle = true, okOrientation = true, okArea = true;
  for (const k of [-3, -0.5, 0.25, 1.5, 5]) {
    const t = transformFor(k, { x: 18, y: 74 });
    const A = { x: 2, y: 3 }, B = { x: 120, y: 40 };
    const D = { x: -30, y: 90 }, E = { x: 88, y: 127 }; // DE parallel to AB
    const A2 = C.transformPoint(t, A), B2 = C.transformPoint(t, B);
    const D2 = C.transformPoint(t, D), E2 = C.transformPoint(t, E);
    if (Math.abs(cross(A2, B2, E2) - cross(A2, B2, D2)) > 1e-7) okParallel = false;

    const X = { x: 30, y: 15 }, Y = { x: 180, y: 40 }, Z = { x: 44, y: 130 };
    const X2 = C.transformPoint(t, X), Y2 = C.transformPoint(t, Y), Z2 = C.transformPoint(t, Z);
    const cosine = (a, b, c) => dot(a, b, c) / (dist(a, b) * dist(a, c));
    if (!close(cosine(X, Y, Z), cosine(X2, Y2, Z2), 1e-9)) okAngle = false;
    const before = area2(X, Y, Z), after = area2(X2, Y2, Z2);
    if (!close(after, k * k * before, 1e-6)) okArea = false;
    if (before * after < 0) okOrientation = false;
  }
  check("page claim: parallel lines map to parallel lines", okParallel);
  check("page claim: angles are preserved", okAngle);
  check("page claim: orientation is preserved", okOrientation);
  check("derived: area scales by k squared", okArea);

  // Every homothety with k != 1 has one fixed point, its center; k = 1 is
  // the identity. Solving O + k(P-O) = P gives (1-k)(P-O) = 0.
  let okFixed = true;
  for (const k of [-4, -0.5, 0, 0.3, 0.999, 1.001, 2, 9]) {
    const O = { x: 57, y: -12 };
    for (const p of [{ x: 0, y: 0 }, { x: 111, y: 200 }, { x: -90, y: 65 }]) {
      const p2 = C.transformPoint(transformFor(k, O), p);
      if (ptClose(p2, p, 1e-9) !== (k === 1 || ptClose(p, O, 1e-9))) okFixed = false;
    }
  }
  check("page claim: for k != 1 only the center is fixed", okFixed);

  // H_k(H_1/k(P)) = P = H_1/k(H_k(P)), for the k the page considers (k != 0).
  let okInverse = true;
  for (const k of [-5, -1, -0.25, 0.2, 0.5, 1, 2, 3, 10]) {
    const O = { x: 70, y: 110 };
    const h = transformFor(k, O), inv = transformFor(1 / k, O);
    for (const p of [{ x: 0, y: 0 }, { x: 250, y: -40 }, { x: 13, y: 301 }]) {
      if (!ptClose(C.transformPoint(inv, C.transformPoint(h, p)), p, 1e-8) ||
          !ptClose(C.transformPoint(h, C.transformPoint(inv, p)), p, 1e-8)) okInverse = false;
    }
  }
  check("page claim: H_k composed with H_1/k is the identity", okInverse);

  // Composition: coefficient k1*k2, collinear centers, and a translation
  // along C1C2 when the product is 1.
  let okProduct = true, okCollinear = true, okTranslate = true;
  const kGrid = [-3, -1, -0.5, 0, 0.25, 0.5, 1, 2, 4];
  for (const k1 of kGrid) for (const k2 of kGrid) {
    const c1 = { x: -20, y: 40 }, c2 = { x: 130, y: 190 };
    const h1 = transformFor(k1, c1), h2 = transformFor(k2, c2);
    const comp = C.composition(h1, h2);
    for (const p of [{ x: 0, y: 0 }, { x: 200, y: 80 }, { x: -77, y: 333 }]) {
      const sequential = C.transformPoint(h2, C.transformPoint(h1, p));
      if (!ptClose(C.applyComposition(comp, p), sequential, 1e-7)) okProduct = false;
    }
    if (Math.abs(k1 * k2 - 1) > 1e-12) {
      equal("composition kind is a homothety", comp.kind, "homothety");
      if (!close(comp.k, k1 * k2)) okProduct = false;
      if (Math.abs(cross(c1, c2, comp.center)) > 1e-6) okCollinear = false;
    } else {
      equal("composition kind is a translation", comp.kind, "translation");
      const dir = { x: c2.x - c1.x, y: c2.y - c1.y };
      if (Math.abs(comp.dx * dir.y - comp.dy * dir.x) > 1e-6) okTranslate = false;
    }
  }
  check("page claim: two homotheties compose to coefficient k1*k2 (81 pairs)", okProduct);
  check("page claim: the three centers are collinear when k1*k2 != 1", okCollinear);
  check("page claim: k1*k2 = 1 gives a translation parallel to C1C2", okTranslate);

  // Same center: commute. Different centers: not commutative in general.
  let okCommute = true;
  const O = { x: 45, y: 90 };
  for (const k1 of kGrid) for (const k2 of kGrid) {
    const h1 = transformFor(k1, O), h2 = transformFor(k2, O);
    const c12 = C.composition(h1, h2), c21 = C.composition(h2, h1);
    for (const p of [{ x: 0, y: 0 }, { x: 200, y: -30 }, { x: -60, y: 170 }]) {
      if (!ptClose(C.applyComposition(c12, p), C.applyComposition(c21, p), 1e-7)) okCommute = false;
    }
  }
  check("page claim: homotheties with a common center commute (81 pairs)", okCommute);
  const a = transformFor(2, { x: 0, y: 0 }), b = transformFor(3, { x: 10, y: 0 });
  const p = { x: 1, y: 1 };
  const ab = C.applyComposition(C.composition(a, b), p);
  const ba = C.applyComposition(C.composition(b, a), p);
  check("page claim: the product is not commutative in general", !ptClose(ab, ba),
    `H2H3(P)=${JSON.stringify(ab)}, H3H2(P)=${JSON.stringify(ba)}`);
}

done("homothety");
