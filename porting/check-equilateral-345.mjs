#!/usr/bin/env node
"use strict";

/*
 * Logic test for equilateral-345/equilateral-345-core.js.
 *
 *   node porting/check-equilateral-345.mjs
 *
 * Checks the applet's controls (angle 0..65, its two checkboxes and its
 * draggable vertices), its FindP and Compute bytecode against two independent
 * transcriptions over every angle and over more than a hundred triangle sizes,
 * and the cut-the-knot page's area claim: Area(hexagon) = 2 Area(ABC), the
 * hexagon splits into three equilateral and three 3-4-5 right triangles, and
 * a² = 25 + 12√3 when AP = 3, BP = 4, CP = 5. It also measures the applet's
 * own FindP constant, which uses 24 + 12√3 instead.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("equilateral-345/equilateral-345-core.js", "Equilateral345Core");
const nearNum = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
const near = (p, q, tol = 1e-7) => p && q && nearNum(p.x, q.x, tol) && nearNum(p.y, q.y, tol);
const S3 = Math.sqrt(3);

/* ------------------------------------------------ 1. the applet's controls */

{
  const s = C.start();
  check("init starts with side 200, angle 0 and both boxes unticked",
    s.side === 200 && s.angle === 0 && !s.showNames && !s.showLengths);
  check("init puts A to the right, C to the left and B above the midpoint",
    near(s.A, C.pt(420, 230)) && near(s.C, C.pt(220, 230)) &&
    nearNum(s.B.y, 230 - 100 * S3));
  check("the three sides are 200", [C.distance(s.A, s.B), C.distance(s.B, s.C),
    C.distance(s.C, s.A)].every((d) => nearNum(d, 200, 1e-9)));
  check("P is inside the triangle at the start", C.inside(s.P, [s.A, s.B, s.C]));
  equal("the scrollbar's range is 0..65 with page size 5", C.APPLET.angle,
    { min: 0, max: 65, page: 5, initial: 0 });
  check("the angle is clamped at both ends", C.withAngle(s, -80).angle === 0 &&
    C.withAngle(s, 999).angle === 65);
  check("the angle is a whole number like the Java scrollbar", C.withAngle(s, 30.7).angle === 31);
  const marked = C.withFlag(C.withFlag(s, "showNames", true), "showLengths", true);
  check("the two checkboxes change only themselves",
    marked.showNames && marked.showLengths && marked.side === s.side &&
    near(marked.P, s.P) && s.showNames === false);
  const dragged = C.withVertex(s, "A", C.pt(9999, -9999));
  check("a dragged vertex stays on the 640x460 canvas with a 16-unit margin",
    near(dragged.A, C.pt(624, 16)) && s.A.x === 420);
  check("dragging a vertex leaves P where init put it", near(dragged.P, s.P));
  check("an unknown handle is ignored", near(C.withVertex(s, "P", C.pt(0, 0)).P, s.P));
}

/* --------------------------- 2. FindP against a second, independent method */

/*
 * A second transcription of FindP(double): the same constant
 * a/sqrt(4*(6√3+9)/√3), three pairwise circle intersections, the candidate
 * inside ABC for each pair, then their average. This version finds an
 * intersection with the cosine rule in a rotated local frame instead of the
 * perpendicular-offset formula used by the core.
 */
function findPAgain(a, A, B, Cc) {
  const s5 = a / Math.sqrt(4 * (6 * S3 + 9) / S3);
  const rr = [3 * s5, 4 * s5, 5 * s5];
  const pair = (X, r, Y, s) => {
    const d = Math.hypot(Y.x - X.x, Y.y - X.y);
    const along = (r * r - s * s + d * d) / (2 * d);
    const off = Math.sqrt(Math.max(0, r * r - along * along));
    const ux = (Y.x - X.x) / d, uy = (Y.y - X.y) / d;
    return [
      { x: X.x + along * ux - off * uy, y: X.y + along * uy + off * ux },
      { x: X.x + along * ux + off * uy, y: X.y + along * uy - off * ux },
    ];
  };
  // Independent inside test: the three sub-triangle areas add to the whole.
  const triArea = (p, q, r) => Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)) / 2;
  const whole = triArea(A, B, Cc);
  const pick = (hits) => (nearNum(triArea(A, B, Cc) + triArea(hits[0], B, Cc) +
    triArea(A, hits[0], Cc), whole, 1e-7) ? hits[0] : hits[1]);
  const ab = pick(pair(A, rr[0], B, rr[1]));
  const bc = pick(pair(B, rr[1], Cc, rr[2]));
  const ca = pick(pair(Cc, rr[2], A, rr[0]));
  return { x: (ab.x + bc.x + ca.x) / 3, y: (ab.y + bc.y + ca.y) / 3 };
}

{
  const rand = rng(3452015);
  let bad = 0, worst = 0, cases = 0;
  for (let side = 40; side <= 400; side += 6) {
    for (let c = 0; c < 3; c++) {
      const center = C.pt(200 + rand() * 240, 170 + rand() * 120);
      const t = C.triangle(side, center);
      const got = C.findP(side, t.A, t.B, t.C);
      const want = findPAgain(side, t.A, t.B, t.C);
      const err = Math.hypot(got.x - want.x, got.y - want.y);
      worst = Math.max(worst, err);
      if (err > 1e-6) bad++;
      cases++;
    }
  }
  check(`FindP matches the second transcription on all ${cases} triangles`, bad === 0,
    `${bad} failures, worst error ${worst.toExponential(2)}`);
  const s = C.start();
  check("the place P is drawn matches FindP", near(s.P, C.findP(200, s.A, s.B, s.C)));
  check("the applet's scale uses 24 + 12√3, not the exact 25 + 12√3",
    nearNum(C.APPLET_FACTOR, 24 + 12 * S3, 1e-12) &&
    nearNum(C.FACTOR, 25 + 12 * S3, 1e-12));
  const k = 200 / Math.sqrt(C.APPLET_FACTOR);
  const ds = [C.distance(s.P, s.A), C.distance(s.P, s.B), C.distance(s.P, s.C)];
  const rel = Math.max(...ds.map((d, i) => Math.abs(d / (i + 3) / k - 1)));
  check("the applet's barycenter is close to, but not exactly, 3:4:5",
    rel > 1e-4 && rel < 0.02, `largest relative error ${rel}`);
}

/* ---------------- 3. Compute against a second transcription, every angle */

/* A direct rewrite of Compute() from the bytecode, with Rotate's own formula. */
function computeAgain(s) {
  const t = s.angle * Math.PI / 180;
  const co = Math.cos(t), si = Math.sin(t);
  const R = (p, q) => ({
    x: p.x + co * (q.x - p.x) + si * (q.y - p.y),
    y: p.y - si * (q.x - p.x) + co * (q.y - p.y),
  });
  return {
    Ap: R(s.B, s.C), Bp: R(s.C, s.A), Cp: R(s.A, s.B),
    Aq: R(s.B, s.A), Bq: R(s.C, s.B), Cq: R(s.A, s.C),
    Pa: R(s.B, s.P), Pb: R(s.C, s.P), Pc: R(s.A, s.P),
  };
}

{
  const rand = rng(6010);
  let bad = 0, worst = 0, cases = 0;
  for (let angle = 0; angle <= 65; angle++) {
    for (let layout = 0; layout < 4; layout++) {
      const side = 60 + rand() * 260;
      const t = C.triangle(side, C.pt(320, 230));
      const s = { ...t, P: C.findP(side, t.A, t.B, t.C), angle };
      const got = C.compute(s), want = computeAgain(s);
      for (const key of Object.keys(want)) {
        const err = Math.hypot(got[key].x - want[key].x, got[key].y - want[key].y);
        worst = Math.max(worst, err);
        if (err > 1e-8) bad++;
      }
      cases++;
    }
  }
  check(`Compute agrees on all ${cases} layouts at every angle 0..65`, bad === 0,
    `${bad} failures, worst error ${worst.toExponential(2)}`);

  const at60 = C.compute(C.withAngle(C.start(), 60));
  check("Java's Rotate(B, A, 60°, -1) lands on (520, 56.794919…)",
    near(at60.Aq, C.pt(520, 230 - 100 * S3)));
  check("Rotate(C, B, 60°, -1) lands on (120, 56.794919…)",
    near(at60.Bq, C.pt(120, 230 - 100 * S3)));
  check("Rotate(A, C, 60°, -1) lands on (320, 403.205080…)",
    near(at60.Cq, C.pt(320, 230 + 100 * S3)));
  check("the three inner images land back on A, B and C at 60°",
    near(at60.Ap, C.pt(420, 230)) && near(at60.Bp, C.pt(320, 230 - 100 * S3)) &&
    near(at60.Cp, C.pt(220, 230)));
  check("the outer triangle has four times the area of ABC",
    nearNum(C.area([at60.Aq, at60.Bq, at60.Cq]),
      4 * C.area([C.pt(420, 230), C.pt(320, 230 - 100 * S3), C.pt(220, 230)]), 1e-6));
  check("rotation keeps lengths: BP equals BPa at every angle",
    [0, 17, 33, 60, 65].every((a) => {
      const s = C.withAngle(C.start(), a), r = C.compute(s);
      return nearNum(C.distance(s.B, s.P), C.distance(s.B, r.Pa), 1e-9);
    }));
}

/* ------------------------------- 4. the page's exact claim, verified fully */

{
  const claim = C.claim();
  check("the page's formula gives a² = 25 + 12√3 ≈ 45.7846",
    nearNum(claim.factor, 25 + 12 * S3, 1e-12) &&
    nearNum(claim.side, 6.766432567522307, 1e-12));
  check("3² + 4² = 5², so the 3-4-5 triangles are right", 9 + 16 === 25 && claim.rightTriangles === 18);

  // Solve the distance relation a²/k² = t independently: 3(t-7)²+(t-25)²=108t.
  const roots = [25 - 12 * S3, 25 + 12 * S3];
  const poly = (t) => 3 * (t - 7) ** 2 + (t - 25) ** 2 - 108 * t;
  check("the quadratic from AP=3, BP=4, CP=5 has exactly these two roots",
    roots.every((t) => nearNum(poly(t), 0, 1e-9)) &&
    poly(0) > 0 && poly(30) < 0 && poly(50) > 0);

  const sizes = [];
  for (let side = 30; side <= 300; side += 5) sizes.push(side);
  const rand = rng(777);
  for (let i = 0; i < 120; i++) sizes.push(25 + rand() * 400);
  let bad = 0, worstRatio = 0, worstArea = 0;
  for (const side of sizes) {
    const t = C.triangle(side, C.pt(320, 230));
    const { P, k } = C.exactP(side, t.A, t.B, t.C);
    const s = { ...t, P, angle: 60 };
    const r = C.compute(s);
    const ds = [C.distance(P, t.A), C.distance(P, t.B), C.distance(P, t.C)];

    // The three distances really are 3k, 4k and 5k for the exact point.
    if (!ds.every((d, j) => nearNum(d, (j + 3) * k, 1e-7))) bad++;
    // And the side really is sqrt(25+12√3) times that scale.
    const ratio = side * side / (k * k);
    worstRatio = Math.max(worstRatio, Math.abs(ratio - claim.factor));
    if (!nearNum(ratio, claim.factor, 1e-7)) bad++;

    // The hexagon APcBPaCPb, measured two ways. The applet prints the image
    // of P about B as Pc, the one about C as Pa and the one about A as Pb.
    const abc = C.area([t.A, t.B, t.C]);
    const hex = C.area([t.A, r.Pa, t.B, r.Pb, t.C, r.Pc]);
    if (!nearNum(hex, 2 * abc, 1e-6 * Math.max(1, abc))) bad++;
    worstArea = Math.max(worstArea, Math.abs(hex / abc - 2));

    // Its six pieces: three equilateral, then three 3-4-5 right triangles.
    const pieces = [
      [t.A, P, r.Pc], [t.B, P, r.Pa], [t.C, P, r.Pb],
      [t.A, P, r.Pa], [t.B, P, r.Pb], [t.C, P, r.Pc],
    ];
    const expected = [3, 4, 5].map((n) => claim.equilateralArea(n * k))
      .concat([0, 1, 2].map(() => 3 * 4 * k * k / 2));
    const actual = pieces.map(C.area);
    if (!actual.every((x, j) => nearNum(x, expected[j], 1e-6 * Math.max(1, expected[j])))) bad++;
    if (!nearNum(actual.reduce((x, y) => x + y, 0), hex, 1e-6 * Math.max(1, hex))) bad++;
    // The complement of the hexagon in the big triangle is each of ABP,
    // BCP, CAP twice over.
    const complement = C.area([r.Aq, r.Bq, r.Cq]) - hex;
    const twice = 2 * (C.area([t.A, t.B, P]) + C.area([t.B, t.C, P]) + C.area([t.C, t.A, P]));
    if (!nearNum(complement, twice, 1e-6 * Math.max(1, twice))) bad++;
  }
  check(`the exact point and the two hexagon areas hold on all ${sizes.length} sizes`,
    bad === 0, `${bad} failures, worst ratio error ${worstRatio.toExponential(2)}, ` +
    `worst area ratio error ${worstArea.toExponential(2)}`);
  const m = C.metrics({ ...C.start(), P: C.exactP(200, C.start().A, C.start().B, C.start().C).P });
  check("the readout's predicted side² matches the actual side²",
    nearNum(m.sideSquared, m.predictedSideSquared, 1e-7));
}

done("equilateral-345");
