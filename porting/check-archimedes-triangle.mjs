#!/usr/bin/env node
"use strict";

/*
 * Logic test for archimedes-triangle/archimedes-triangle-core.js.
 *
 *   node porting/check-archimedes-triangle.mjs
 *
 * Checks the switches and drags, then every claim on the cut-the-knot page
 * (the lemma's three midpoints, SM parallel to the axis, and the 2:1 area
 * split) over the opening picture, ten deliberate configurations and 400
 * seeded random ones. Finally the applet's own bytecode is transcribed a
 * second time — Parabola(), Compute(), the two tangents, GeoSDoub.Intersect,
 * DrawTangentAtO() and the pink sub-triangles — and compared with the core on
 * every configuration.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("archimedes-triangle/archimedes-triangle-core.js", "ArchimedesTriangleCore");

/* ------------------------------------------- a second transcription of the applet */

const a = C.A_FOCAL;        // applet field a = 60
const Dh = C.DH;            // applet field Dh = 100
const H = C.HEIGHT;         // applet canvas height (we give it 320 rows)
const half = C.WIDTH / 2;   // applet local 3 = width/2

/** ArchimedesTriangleCanvas.Parabola(int): Java int division truncates. */
function appletParabola(x) {
  return Math.trunc(x * x / (4 * a));
}

/** ArchimedesTriangleCanvas.Compute(int p, int q). */
function appletCompute(p, q) {
  return p - a - appletParabola(q) - Dh;
}

/** GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), from javap -c. */
function appletIntersect(a1p, b1p, c1p, d1p) {
  const A1 = a1p.y - b1p.y, B1 = b1p.x - a1p.x, C1 = a1p.x * b1p.y - a1p.y * b1p.x;
  const A2 = c1p.y - d1p.y, B2 = d1p.x - c1p.x, C2 = c1p.x * d1p.y - c1p.y * d1p.x;
  const det = A1 * B2 - A2 * B1;
  return { x: (B1 * C2 - B2 * C1) / det, y: (C1 * A2 - C2 * A1) / det };
}

/** DrawTangent1/DrawTangent2: A (or B) and the point 50 px along its tangent. */
function appletTangent(t) {
  const p = { x: half + t, y: appletCompute(H, t) };
  return { p, tip: { x: p.x + 50, y: p.y - 50 * (t / a / 2) } };
}

/** DrawTangents + DrawTangentAtO, with the pink triangles' apexes as well. */
function appletPicture(t1, t2) {
  const TA = appletTangent(t1), TB = appletTangent(t2);
  const A = TA.p, B = TB.p;
  const S = appletIntersect(TA.p, TA.tip, TB.p, TB.tip); // the two tangents meet
  const M = C.midpoint(A, B);
  // DrawTangentAtO rounds S.x - width/2 for the parabola point, but uses the
  // unrounded offset for the tangent's slope. Both quirks are kept here.
  const k = Math.round(S.x - half);
  const O = { x: S.x, y: appletCompute(H, k) };
  const slopeO = (S.x - half) / a / 2;
  const OT = { x: S.x + 50, y: O.y - 50 * slopeO };
  const A1 = appletIntersect(O, OT, A, S);
  const B1 = appletIntersect(O, OT, B, S);
  // A1+50 and B1+50 are vertical cuts; their crossing with OA / OB is where
  // the applet starts its pink "inner" Archimedes triangles.
  const cutA = appletIntersect({ x: A1.x, y: A1.y + 50 }, A1, O, A);
  const cutB = appletIntersect({ x: B1.x, y: B1.y + 50 }, B1, O, B);
  const apexA = { x: cutA.x, y: appletCompute(H, Math.round(cutA.x - half)) };
  const apexB = { x: cutB.x, y: appletCompute(H, Math.round(cutB.x - half)) };
  return { A, B, S, M, O, OT, A1, B1, apexA, apexB, TA, TB };
}

const len = (p, q) => C.dist(p, q);

/* ------------------------------------------------------------- configurations */

const pairs = [
  [180, -130],   // the applet's opening scrollbar values
  [120, -120], [60, -60], [170, -170], [20, -40],
  [40, 160], [-160, -40], [-130, 180], [100, 120], [-120, -100],
  [180, -180], [1, -180], [180, -1],
];
const next = rng(20261126);
for (let i = 0; i < 600 && pairs.length < 413; i++) {
  const t1 = Math.round((next() * 2 - 1) * 180);
  const t2 = Math.round((next() * 2 - 1) * 180);
  if (Math.abs(t2 - t1) >= C.MIN_GAP) pairs.push([t1, t2]);
}
const sample = pairs.map(([t1, t2]) => C.start({ t1, t2 }));

/* ------------------------------------------------------------- 1. the rules */

{
  const s = C.start();
  equal("the applet opens at Tt1=180, Tt2=-130 with every switch off",
    [s.t1, s.t2, s.showNames, s.showLemma, s.showTheorem, s.showFill],
    [180, -130, false, false, false, false]);
  equal("the applet's own constants are kept", [C.A_FOCAL, C.DH, C.WIDTH], [60, 100, 400]);
  const g = C.compute(s);
  check("the opening points are where Compute(H, Tt) puts them",
    Math.abs(g.A.x - 380) < 1e-9 && Math.abs(g.A.y - 25) < 1e-9
      && Math.abs(g.B.x - 70) < 1e-9 && Math.abs(g.B.y - C.VY + 130 ** 2 / 240) < 1e-9);
  check("the focus is one focal length above the vertex and the directrix one below",
    Math.abs(g.F.y - (C.VY - C.A_FOCAL)) < 1e-9
      && Math.abs(g.directrixY - (C.VY + C.A_FOCAL)) < 1e-9
      && Math.abs(g.F.x - C.CX) < 1e-9);
  check("a demo has no result until it has been explored", C.result(s) === null);
  check("legal moves cover two handles, four switches and reset", C.legalMoves(s).length === 7);
  check("starting with options keeps the applet's defaults for the rest",
    C.start({ t1: 40, showTheorem: true }).showLemma === false
      && C.start({ t1: 40, showTheorem: true }).t1 === 40);
}

/* ------------------------------------------------------- 2. moves and options */

{
  const s = C.start();
  const moved = C.move(s, { type: "point", name: "A", t: 20 });
  check("dragging A changes only t1 and marks the picture explored",
    moved && moved.t1 === 20 && moved.t2 === s.t2 && C.result(moved) === "done");
  const off = C.move(s, { type: "point", name: "A", t: 9999 });
  check("a drag past the edge stops at the handle's range", off.t1 === C.T_MAX);
  const byPoint = C.move(s, { type: "point", name: "B", point: { x: C.CX - 80, y: 0 } });
  check("a handle can be moved by its board point as well as by t", byPoint.t2 === -80);
  const close = C.move(s, { type: "point", name: "A", t: -125 });
  check("the two points cannot coincide: the tangents would never meet",
    Math.abs(close.t1 - close.t2) >= C.MIN_GAP);
  const crossed = C.move(s, { type: "point", name: "A", t: -170 });
  check("dragging A past B is allowed and keeps a usable gap", Math.abs(crossed.t1 - crossed.t2) >= C.MIN_GAP);
  check("an unknown handle or switch is refused",
    C.move(s, { type: "point", name: "X", t: 0 }) === null
      && C.move(s, { type: "option", key: "wrong", value: true }) === null
      && C.move(s, { type: "point", name: "A", t: NaN }) === null);
  let t = s;
  for (const key of C.OPTION_KEYS) t = C.move(t, { type: "option", key, value: true });
  check("all four applet switches can be ticked",
    C.OPTION_KEYS.every((k) => t[k] === true) && t.moves === 4);
  check("switching does not move either point",
    t.t1 === s.t1 && t.t2 === s.t2);
  const reset = C.move(t, { type: "reset" });
  check("reset restores the opening points but keeps the switches",
    reset.t1 === s.t1 && reset.t2 === s.t2 && C.OPTION_KEYS.every((k) => reset[k] === true));
  check("moves do not change the position they were made from",
    s.moves === 0 && !s.explored && !s.showTheorem);
}

/* -------------------------------------- 3. the page's claims over every sample */

{
  let max = Object.create(null);
  for (const key of ["axisParallel", "A1Mid", "B1Mid", "OMid", "tangentOParallel",
    "SOnTangentA", "SOnTangentB", "OOnParabola", "focusProperty", "innerHalf",
    "topQuarter", "sidesQuarter", "partition", "segmentRatio"]) max[key] = 0;
  let minRatio = Infinity, maxRatio = 0, minArea = Infinity;
  for (const state of sample) {
    const g = C.compute(state);
    const r = C.residuals(g);
    for (const key of Object.keys(max)) max[key] = Math.max(max[key], r[key]);
    const ratio = g.areaSegment / g.areaABS;
    minRatio = Math.min(minRatio, ratio);
    maxRatio = Math.max(maxRatio, ratio);
    minArea = Math.min(minArea, g.areaABS);
  }
  const tol = 1e-8;
  check("MS is parallel to the axis: S and M have the same x", max.axisParallel < tol, `max ${max.axisParallel}`);
  check("A1 is the midpoint of AS", max.A1Mid < tol, `max ${max.A1Mid}`);
  check("B1 is the midpoint of BS", max.B1Mid < tol, `max ${max.B1Mid}`);
  check("O is the midpoint of MS", max.OMid < tol, `max ${max.OMid}`);
  check("the tangent at O is parallel to the chord AB", max.tangentOParallel < tol, `max ${max.tangentOParallel}`);
  check("S lies on both tangents at A and B",
    Math.max(max.SOnTangentA, max.SOnTangentB) < tol);
  check("O lies on the parabola", max.OOnParabola < tol, `max ${max.OOnParabola}`);
  check("every point of the parabola is equally far from F and the directrix",
    max.focusProperty < tol, `max ${max.focusProperty}`);
  check("the inner triangle ABO has half the area of ABS", max.innerHalf < tol, `max ${max.innerHalf}`);
  check("the top triangle A1B1S has a quarter of the area of ABS", max.topQuarter < tol, `max ${max.topQuarter}`);
  check("the two side triangles AA1O and BB1O together have a quarter", max.sidesQuarter < tol, `max ${max.sidesQuarter}`);
  let sideEighth = 0;
  for (const state of sample) {
    const g = C.compute(state);
    sideEighth = Math.max(sideEighth,
      Math.abs(g.areaAA1O / g.areaABS - 1 / 8), Math.abs(g.areaBB1O / g.areaABS - 1 / 8));
  }
  check("each side triangle AA1O and BB1O has an eighth of ABS", sideEighth < tol, `max ${sideEighth}`);
  check("those four triangles exactly fill ABS", max.partition < tol, `max ${max.partition}`);
  check(`the parabolic segment is exactly 2/3 of the triangle - all ${sample.length} shapes`,
    max.segmentRatio < tol, `max ${max.segmentRatio}`);
  check("the ratio is constant, not just at the opening", minRatio > 2 / 3 - tol && maxRatio < 2 / 3 + tol);
  check("every sampled triangle has a real area", minArea > 1);
  check("the sample spans both orders of A and B and a narrow triangle",
    sample.some((s) => s.t1 > s.t2) && sample.some((s) => s.t1 < s.t2)
      && sample.some((s) => Math.abs(s.t2 - s.t1) === C.MIN_GAP));
}

/* --------------------------- 4. the applet's own bytecode, transcribed twice */

{
  // Java draws with integer y coordinates and rounds S.x - width/2 again for
  // O, so a near-parallel pair can drift a few pixels from the exact picture.
  let points = 0, centers = 0, offsets = 0, apexes = 0, midpoints = 0, median = 0, compared = 0;
  let wellConditioned = 0, loose = 0;
  for (const state of sample) {
    const g = C.compute(state);
    const ap = appletPicture(state.t1, state.t2);
    points = Math.max(points, len(ap.A, g.A), len(ap.B, g.B));
    centers = Math.max(centers, len(ap.S, g.S), len(ap.M, g.M));
    offsets = Math.max(offsets, len(ap.O, g.O));
    const err = Math.max(len(ap.A1, g.A1), len(ap.B1, g.B1));
    // When the two tangents are almost parallel, a one-pixel rounding of S.x
    // moves A1 and B1 a long way; keep those cases out of the tight comparison.
    if (Math.abs(state.t1 - state.t2) >= 50) {
      midpoints = Math.max(midpoints, err,
        len(ap.A1, C.midpoint(ap.A, ap.S)), len(ap.B1, C.midpoint(ap.B, ap.S)),
        len(ap.O, C.midpoint(ap.M, ap.S)));
      wellConditioned++;
    } else {
      loose = Math.max(loose, err);
    }
    median = Math.max(median, Math.abs(ap.S.x - (half + state.t1 / 2 + state.t2 / 2)));
    // The pink triangles start at a vertical cut through A1 and B1; their
    // apexes are the parabola points directly below those cuts.
    apexes = Math.max(apexes,
      Math.abs(ap.apexA.y - (C.VY - (ap.apexA.x - half) ** 2 / (4 * a))),
      Math.abs(ap.apexB.y - (C.VY - (ap.apexB.x - half) ** 2 / (4 * a))));
    compared++;
  }
  check(`Parabola()/Compute() put A and B within a pixel on all ${sample.length} shapes`,
    points < 1, `max ${points}`);
  check("GeoSDoub.Intersect finds the same S and midpoint M as the core",
    centers < 8, `max ${centers}`);
  check("DrawTangentAtO finds the same O as the core, allowing for Java's rounding",
    offsets < 8, `max ${offsets}`);
  check(`DrawTangentAtO finds the same A1 and B1 as the core on all ${wellConditioned} well-conditioned shapes`,
    midpoints < 10, `max ${midpoints}`);
  check("the applet's own A1, B1 and O really are the midpoints the page claims",
    midpoints < 10, `max ${midpoints}`);
  check("near-parallel tangents still meet and give finite points in the transcribed applet",
    loose < 60, `max ${loose}`);
  check("S has the x of the parabola's midpoint parameter, up to Java's pixel rounding",
    median < 5, `max ${median}`);
  check("the applet's pink triangle apexes lie on the parabola",
    apexes < 2.5, `max ${apexes}`);
  check("every configuration was compared against the transcribed applet", compared === sample.length);

  const opening = appletPicture(180, -130);
  check("the transcribed S is below the chord for the opening scrollbar values",
    opening.S.y > Math.max(opening.A.y, opening.B.y));
  check("the transcribed median is vertical", Math.abs(opening.S.x - opening.M.x) < 1);
}

done("archimedes-triangle");
