#!/usr/bin/env node
"use strict";

/*
 * Logic test for menelaus-bisector/menelaus-bisector-core.js.
 *
 *   node porting/check-menelaus-bisector.mjs
 *
 * What is checked:
 *  - the opening triangle and the four unchecked boxes against Canvas.init()
 *    and the panel constructor at many canvas sizes;
 *  - a second, literal transcription of GeoSDoub.ComputeAngle, FindOrientation,
 *    Rotate, Intersect, FindIncenter, FindExcenter and DrawBisectors, compared
 *    with the core over thousands of random triangles and all 16 checkbox
 *    combinations;
 *  - both claims on the page: the signed bisector product is (-1)^external,
 *    so the chosen lines concur for 0 or 2 external bisectors and the chosen
 *    feet are collinear for 0 or 2 internal bisectors — checked for all eight
 *    choices on every random triangle, against independent line/foot geometry;
 *  - the exceptions: an exterior bisector at the apex of an isosceles triangle
 *    is parallel to the base (the applet's Intersect returns NaN), and the
 *    red triangle of three inside feet is not the collinear triple.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("menelaus-bisector/menelaus-bisector-core.js", "MenelausBisectorCore");
const near = (a, b, tol = 1e-8) =>
  a === b || (Number.isNaN(a) && Number.isNaN(b)) ||
  (Number.isFinite(a) && Number.isFinite(b) &&
    Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)));
const pointNear = (p, q, tol = 1e-8) =>
  !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const det = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/* --------------------------------- the applet's own methods, transcribed again */

/** GeoSDoub.SqDist / Dist / ComputeAngle, op for op. */
function jSqDist(p, q) { return (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y); }
function jComputeAngle(v, p, q) {
  const s3 = (jSqDist(v, p) + jSqDist(v, q) - jSqDist(p, q)) / 2;
  const s5 = s3 / (Math.sqrt(jSqDist(v, p)) * Math.sqrt(jSqDist(v, q)));
  return Math.acos(s5);
}
function jOrientation(a, b, c) {
  const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return s > 0 ? 1 : -1;
}
function jRotate(a, b, t, o) {
  const s5 = Math.cos(t), s7 = Math.sin(t);
  const s9 = a.x + s5 * (b.x - a.x) - o * s7 * (b.y - a.y);
  const s11 = a.y + o * s7 * (b.x - a.x) + s5 * (b.y - a.y);
  return { x: s9, y: s11 };
}
function jIntersect(a, b, c, e) {
  const s4 = a.y - b.y, s6 = b.x - a.x, s8 = a.x * b.y - a.y * b.x;
  const s10 = c.y - e.y, s12 = e.x - c.x, s14 = c.x * e.y - c.y * e.x;
  const s16 = s6 * s14 - s12 * s8;
  const s18 = s8 * s10 - s14 * s4;
  const s20 = s4 * s12 - s10 * s6;
  if (!(Math.abs(s20) >= 1)) return { x: NaN, y: NaN }; // dcmpg against 1.0
  return { x: s16 / s20, y: s18 / s20 };
}
function jFindIncenter(a, b, c) {
  const s3 = jComputeAngle(a, b, c);
  const s5 = jComputeAngle(b, c, a);
  const s7 = s3 / 2, s9 = s5 / 2;
  const s12 = jOrientation(a, b, c);
  const r0 = jRotate(a, b, s7, s12);
  const r1 = jRotate(b, c, s9, s12);
  return jIntersect(a, r0, b, r1);
}
function jFindExcenter(a, b, c) {
  const s3 = jComputeAngle(b, a, c);
  const s5 = jComputeAngle(c, a, b);
  const s7 = (Math.PI - s3) / 2, s9 = (Math.PI - s5) / 2;
  const s12 = jOrientation(b, a, c);
  const r0 = jRotate(b, c, s7, s12);
  const r1 = jRotate(c, b, s9, -s12);
  return jIntersect(b, r0, c, r1);
}
/** MenelausBisectorCanvas.DrawBisectors(), as points and paint flags. */
function jDrawBisectors(corners, modes) {
  const { A, B, C } = corners;
  const I = jFindIncenter(A, B, C);
  const Ia = jFindExcenter(A, B, C);
  const Ib = jFindExcenter(B, C, A);
  const Ic = jFindExcenter(C, A, B);
  const lines = [[B, C], [A, C], [A, B]];
  const inside = [[A, I], [B, I], [C, I]];
  const outside = [[Ib, Ic], [Ic, Ia], [Ia, Ib]];
  const intFeet = [0, 1, 2].map((i) => jIntersect(inside[i][0], inside[i][1], lines[i][0], lines[i][1]));
  const extFeet = [0, 1, 2].map((i) => jIntersect(outside[i][0], outside[i][1], lines[i][0], lines[i][1]));
  const drawInside = !!(modes.I3E0 || modes.I2E1 || modes.I1E2);
  const drawOutside = !!(modes.I2E1 || modes.I1E2 || modes.I0E3);
  const drawJoin = !!modes.I0E3;
  const drawTriangle = !!modes.I2E1;
  const centers = [];
  if (modes.I3E0) centers.push(I);
  if (modes.I1E2) centers.push(Ia, Ib, Ic);
  const feet = [];
  if (modes.I0E3 || modes.I2E1) feet.push(...extFeet);
  if (modes.I2E1) feet.push(...intFeet);
  return { I, Ia, Ib, Ic, inside, outside, intFeet, extFeet,
    drawInside, drawOutside, drawJoin, drawTriangle, centers, feet };
}

/** A fresh, scalene triangle from a seeded generator, in viewBox units. */
function randomTriangle(r) {
  const A = { x: 60 + r() * 160, y: 50 + r() * 120 };
  const B = { x: 60 + r() * 160, y: 170 + r() * 130 };
  const C = { x: 250 + r() * 170, y: 90 + r() * 160 };
  return { A, B, C };
}
const finitePt = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);

/* ------------------------------------------------------------ 1. the start */

{
  let ok = true;
  for (let w = 100; w <= 900; w += 80) {
    for (const h of [100, 300, 500, 750]) {
      const s = C.start({ width: w, height: h });
      ok = ok && pointNear(s.corners.A, { x: w / 2, y: h / 4 + 20 })
        && pointNear(s.corners.B, { x: w / 2, y: h / 3 + 20 })
        && pointNear(s.corners.C, { x: w / 2 + w / 5, y: h / 2 - h / 20 + 20 });
    }
  }
  check("Canvas.init() corners at 40 canvas sizes", ok);
  const s = C.start();
  equal("all four panel checkboxes begin unchecked", s.modes,
    { I3E0: false, I2E1: false, I1E2: false, I0E3: false });
  check("the opening triangle is scalene and non-degenerate",
    Math.abs(det(s.corners.A, s.corners.B, s.corners.C)) > 1000 &&
    new Set([d(s.corners.A, s.corners.B), d(s.corners.B, s.corners.C), d(s.corners.A, s.corners.C)]
      .map((v) => v.toFixed(4))).size === 3);
  equal("result() is null: an illustration has no winner", C.result(s), null);
}

/* ------------------------------------- 2. second transcription of the geometry */

{
  const r = rng(20261128);
  let centersOk = true, drawOk = true, n = 0;
  for (let k = 0; k < 1200; k++) {
    const corners = randomTriangle(r);
    const pos = { corners, modes: C.start().modes };
    const c = C.compute(pos);
    const j = jDrawBisectors(corners, pos.modes);
    centersOk = centersOk && pointNear(c.I, j.I) && pointNear(c.Ia, j.Ia)
      && pointNear(c.Ib, j.Ib) && pointNear(c.Ic, j.Ic);
    for (let i = 0; i < 3; i++) {
      drawOk = drawOk && pointNear(c.intFeet[i], j.intFeet[i])
        && pointNear(c.extFeet[i], j.extFeet[i])
        && pointNear(c.internal[i][0], j.inside[i][0]) && pointNear(c.internal[i][1], j.inside[i][1])
        && pointNear(c.external[i][0], j.outside[i][0]) && pointNear(c.external[i][1], j.outside[i][1]);
    }
    n++;
  }
  check(`FindIncenter and all three FindExcenters match the bytecode in ${n} triangles`, centersOk);
  check(`DrawBisectors' six bisectors and six feet match the bytecode in ${n} triangles`, drawOk);

  const r2 = rng(3141592);
  let flags = 0, flagOk = true, shapesOk = true;
  for (let k = 0; k < 250; k++) {
    const corners = randomTriangle(r2);
    for (let mask = 0; mask < 16; mask++) {
      const modes = {};
      C.MODES.forEach((m, i) => { modes[m] = !!(mask & (1 << i)); });
      const pos = { corners, modes };
      const j = jDrawBisectors(corners, modes);
      const v = C.visible(pos, C.compute(pos));
      flagOk = flagOk && v.internalLines === j.drawInside && v.externalLines === j.drawOutside
        && v.externalLine === j.drawJoin && v.internalTriangle === j.drawTriangle
        && v.centers.length === j.centers.length && v.feet.length === j.feet.length;
      shapesOk = shapesOk && v.centers.every((p, i) => pointNear(p, j.centers[i]))
        && v.feet.every((p, i) => pointNear(p, j.feet[i]));
      flags++;
    }
  }
  check(`ShowPoints / draw conditions match the bytecode in ${flags} checkbox combinations`, flagOk);
  check("the shown centers and feet are the bytecode's points in every combination", shapesOk);
}

/* ------------------------------------- 3. the product, straight from the applet */

{
  const r = rng(2718281);
  let ok = true, tested = 0;
  for (let k = 0; k < 600; k++) {
    const pos = { corners: randomTriangle(r), modes: C.start().modes };
    const { A, B, C: V } = pos.corners;
    const a = d(B, V), b = d(A, V), c = d(A, B);
    for (let mask = 0; mask < 8; mask++) {
      const outside = [0, 1, 2].filter((i) => mask & (1 << i));
      let p = 1;
      const ratios = [c / b, a / c, b / a]; // internal bisector ratios at A, B, C
      ratios.forEach((ratio, i) => { p *= ratio * (outside.includes(i) ? -1 : 1); });
      ok = ok && near(C.product(pos, outside), p) && near(p, (outside.length % 2 ? -1 : 1));
      tested++;
    }
  }
  check(`the signed bisector product is (-1)^external in all ${tested} choices`, ok);
}

/* ------------------------------------------ 4. both page claims, exhaustively */

{
  const r = rng(1618033);
  let concurOk = true, lineOk = true, finiteCases = 0, concurrentHits = 0, collinearHits = 0;
  equal("there are exactly four one-bisector-per-corner label choices per mode",
    C.MODES.map((m) => C.choices(m).length), [1, 3, 3, 1]);

  for (let k = 0; k < 800; k++) {
    const pos = { corners: randomTriangle(r), modes: C.start().modes };
    const g = C.compute(pos);
    for (let mask = 0; mask < 8; mask++) {
      const outside = [0, 1, 2].filter((i) => mask & (1 << i));
      const chosen = C.chosen(pos, g, outside);
      const finiteAll = chosen.feet.every(finitePt) && finitePt(chosen.point);
      if (!finiteAll) continue; // parallel exterior bisector: no foot to test
      finiteCases++;
      const wantConcur = Math.abs(chosen.product - 1) < 1e-9;
      const wantLine = Math.abs(chosen.product + 1) < 1e-9;
      if (wantConcur) concurrentHits++;
      if (wantLine) collinearHits++;
      concurOk = concurOk && chosen.concurrent === wantConcur;
      lineOk = lineOk && chosen.collinear === wantLine;
    }
  }
  check(`0 or 2 external bisectors concur: ${finiteCases} finite choices, ${concurrentHits} concurrent`, concurOk);
  check(`0 or 2 internal bisectors give collinear feet: ${collinearHits} of ${finiteCases} finite choices`, lineOk);
  check("both kinds of configuration really occurred", concurrentHits > 1500 && collinearHits > 1500);
  const claims = C.checkClaims(C.start());
  equal("all eight choices are reported, with counts adding to three", claims.length, 8);
  check("checkClaims agrees with the product for every choice on the opening triangle",
    claims.every((x) => x.productSaysConcurrent === x.concurrent &&
      x.productSaysCollinear === x.collinear));
  check("the opening triangle has four concurrent and four collinear choices",
    claims.filter((x) => x.concurrent).length === 4 &&
    claims.filter((x) => x.collinear).length === 4);
}

/* ----------------------------------- 5. the particular pictures of the applet */

{
  const r = rng(424242);
  let incenterOk = true, excenterOk = true, n = 0;
  for (let k = 0; k < 400; k++) {
    const pos = { corners: randomTriangle(r), modes: C.start().modes };
    const g = C.compute(pos);
    const all = C.chosen(pos, g, []);
    incenterOk = incenterOk && finitePt(all.point) && pointNear(all.point, g.I) && all.concurrent;
    // External at B and C -> Ia, at A and C -> Ib, at A and B -> Ic.
    for (const [outside, ex] of [[[1, 2], g.Ia], [[0, 2], g.Ib], [[0, 1], g.Ic]]) {
      const one = C.chosen(pos, g, outside);
      excenterOk = excenterOk && finitePt(one.point) && pointNear(one.point, ex) && one.concurrent;
    }
    n++;
  }
  check(`3 internal bisectors meet at the incenter in ${n} triangles`, incenterOk);
  check(`1 internal and 2 external bisectors meet at the matching excenter in ${n} triangles`, excenterOk);

  let insideLineOk = true, redOk = true, magentaOk = true, representativeOk = true, m = 0;
  for (let k = 0; k < 300; k++) {
    const pos = { corners: randomTriangle(r), modes: C.start().modes };
    const g = C.compute(pos);
    if (!g.intFeet.every(finitePt) || !g.extFeet.every(finitePt)) continue;
    m++;
    insideLineOk = insideLineOk && !C.chosen(pos, g, []).collinear;
    redOk = redOk && Math.abs(det(g.intFeet[0], g.intFeet[1], g.intFeet[2])) > 1e-3;
    magentaOk = magentaOk && Math.abs(det(g.extFeet[0], g.extFeet[1], g.extFeet[2])) /
      Math.max(1, d(g.extFeet[0], g.extFeet[1]) * d(g.extFeet[1], g.extFeet[2])) < 1e-7;
    // 2 internal (at A, B) and 1 external (at C): the third inside foot is
    // deliberately NOT part of the collinear triple.
    const two = C.chosen(pos, g, [2]);
    representativeOk = representativeOk && two.collinear &&
      Math.abs(det(g.intFeet[0], g.intFeet[1], g.intFeet[2])) > 1e-3;
  }
  check(`the three inside feet are not collinear in ${m} triangles`, insideLineOk);
  check(`the red triangle of inside feet is a real triangle in ${m} pictures`, redOk);
  check(`the magenta line through two outside feet contains the third in ${m} pictures`, magentaOk);
  check("with 2 inside and 1 outside, two inside feet and one outside foot line up", representativeOk);
}

/* -------------------------- 6. where the page's "every bisector crosses" fails */

{
  // An exterior bisector at the apex of an isosceles triangle is parallel to
  // the base. GeoSDoub.Intersect gives NaN; the page's "in general" is not
  // literally "always".
  const iso = { corners: { A: { x: 240, y: 60 }, B: { x: 140, y: 240 }, C: { x: 340, y: 240 } },
    modes: C.start().modes };
  const g = C.compute(iso);
  check("the isosceles apex's outside foot is at infinity (NaN), as in the applet",
    Number.isNaN(g.extFeet[0].x) && Number.isNaN(g.extFeet[0].y));
  check("the apex's inside foot is finite and bisects the base",
    finitePt(g.intFeet[0]) && near(g.intFeet[0].x, 240) && near(g.intFeet[0].y, 240));
  check("the other two outside feet are finite", finitePt(g.extFeet[1]) && finitePt(g.extFeet[2]));
  const j = jDrawBisectors(iso.corners, iso.modes);
  check("the second transcription gives the same NaN for the parallel case",
    Number.isNaN(j.extFeet[0].x) && pointNear(g.extFeet[1], j.extFeet[1]));

  const flat = { corners: { A: { x: 0, y: 0 }, B: { x: 100, y: 0 }, C: { x: 200, y: 0 } },
    modes: C.start().modes };
  check("a degenerate triangle does not crash the construction",
    C.compute(flat) && C.checkClaims(flat).length === 8);
  const a = { x: 0, y: 0 }, b = { x: 100, y: 0 };
  check("Intersect keeps the applet's |denominator| < 1 NaN cutoff",
    Number.isNaN(C.intersect(a, b, { x: 0, y: 10 }, { x: 100, y: 10 }).x) &&
    Number.isNaN(C.intersect(a, b, { x: 0, y: 0.3 }, { x: 100, y: 0.3 }).x));
}

/* --------------------------------------------- 7. state, options and messages */

{
  const s = C.start();
  const moved = C.moveCorner(s, "A", { x: 10, y: 20 });
  check("moveCorner does not mutate the position", s.corners.A.x !== 10 && moved.corners.A.x === 10);
  const on = C.toggleMode(s, "I0E3");
  const all = C.setModes(s, { I3E0: true, I2E1: false, I1E2: true, I0E3: false });
  equal("toggleMode flips just one checkbox", on.modes,
    { I3E0: false, I2E1: false, I1E2: false, I0E3: true });
  equal("setModes copies the panel's four checkboxes", all.modes,
    { I3E0: true, I2E1: false, I1E2: true, I0E3: false });
  const round = JSON.parse(JSON.stringify(all));
  check("a position is plain data, safe to save for the tutor",
    pointNear(round.corners.A, all.corners.A) && round.modes.I1E2 === true);
  equal("unknown corners are ignored by moveCorner", C.moveCorner(s, "Z", { x: 1, y: 2 }).corners.A, s.corners.A);
  check("the empty picture says to check a box", C.describe(s).includes("empty"));
  check("each named mode says what is true in words",
    C.MODES.every((m) => C.describe(C.setModes(s, { [m]: true })).includes(
      { I3E0: "meet at one point", I2E1: "line up", I1E2: "meet at one point", I0E3: "line up" }[m])));
}

done("menelaus-bisector");
