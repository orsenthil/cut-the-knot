#!/usr/bin/env node
"use strict";

/*
 * Logic test for huberts-dissection/huberts-dissection-core.js.
 *
 *   node porting/check-huberts-dissection.mjs
 *
 * 1. The opening triangle, angle range, drags, switches and Reset follow the
 *    applet (canvas init, Scrollbar(0,0,5,0,185) and the panel listeners).
 * 2. HubertsDissectionCanvas.Compute is transcribed a second time straight
 *    from the bytecode, including GeoSDoub.Intersect's IntersectX/IntersectY
 *    choice, InsideTest, FindOrientation and the two opposite rotations. It
 *    is compared point by point with the core over ~650 triangles at eight
 *    slider positions, including rotated and random ones.
 * 3. The page's one hard claim — all four sides of N'N''MM' equal AB after
 *    the half-turn — is checked independently on every constructible sample,
 *    along with the midline, the area and the two cut points. The page's
 *    hypotheses are probed too: BM < AB is needed for this construction and
 *    does NOT follow from the olympiad's "median AM longer than AB".
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("huberts-dissection/huberts-dissection-core.js", "HubertsDissectionCore");

/* ----------------------- a second, literal transcription of the applet code */

const oSub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const oMid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const oDist = (p, q) => Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
const oBary = (a, b, c) => ({
  x: (a.x + b.x + c.x) / 3,
  y: (a.y + b.y + c.y) / 3,
});

/** InsideTest.IsInside: (p-a).(p-b) <= 0. */
function oInside(p, a, b) {
  return (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 0;
}

/** GeoSDoub.FindOrientation, exactly the bytecode's expression. */
function oOrientation(a, b, c) {
  const turn = c.x * (a.y - b.y) + c.y * (b.x - a.x)
    + a.x * b.y - b.x * a.y;
  return turn > 0 ? 1 : -1;
}

/** GeoSDoub.Rotate: the integer sense multiplies the sine term. */
function oRotate(center, p, theta, sense) {
  const cos = Math.cos(theta), sin = Math.sin(theta);
  return {
    x: center.x + cos * (p.x - center.x) - sense * sin * (p.y - center.y),
    y: center.y + sense * sin * (p.x - center.x) + cos * (p.y - center.y),
  };
}

/** GeoSDoub.IntersectX(DoubLine p-q, DoubCircle o-r). */
function oIntersectX(p, q, o, r) {
  const m = (p.x - q.x) / (p.y - q.y);
  const z = q.x - m * q.y;
  const A = m * m + 1;
  const B = m * (z - o.x) - o.y;
  const Cc = o.y * o.y + (z - o.x) * (z - o.x) - r * r;
  const D = B * B - A * Cc;
  if (D < 0) return null;
  const d = Math.sqrt(D);
  const y1 = (-B + d) / A, y2 = (-B - d) / A;
  return [{ x: m * y1 + z, y: y1 }, { x: m * y2 + z, y: y2 }];
}

/** GeoSDoub.IntersectY(DoubLine p-q, DoubCircle o-r). */
function oIntersectY(p, q, o, r) {
  const m = (p.y - q.y) / (p.x - q.x);
  const z = q.y - m * q.x;
  const A = m * m + 1;
  const B = m * (z - o.y) - o.x;
  const Cc = o.x * o.x + (z - o.y) * (z - o.y) - r * r;
  const D = B * B - A * Cc;
  if (D < 0) return null;
  const d = Math.sqrt(D);
  const x1 = (-B + d) / A, x2 = (-B - d) / A;
  return [{ x: x1, y: m * x1 + z }, { x: x2, y: m * x2 + z }];
}

/** GeoSDoub.Intersect(DoubLine, DoubCircle): X when |dy|>1, else Y. */
function oLineCircle(p, q, o, r) {
  if (Math.abs(p.y - q.y) > 1) return oIntersectX(p, q, o, r);
  if (Math.abs(p.x - q.x) > 1) return oIntersectY(p, q, o, r);
  return null;
}

/** HubertsDissectionCanvas.Compute(), in bytecode order. */
function oldCompute(A, B, Cc, angle) {
  const bary = oBary(A, B, Cc);          // the first Nice centre
  const M = oMid(B, Cc);
  const Bp = oMid(A, Cc);
  const sense = oOrientation(A, B, Cc);
  const hits = oLineCircle(A, B, M, oDist(A, B));
  let N = null;
  if (hits !== null && !Number.isNaN(hits[0].x)) {
    if (oInside(hits[0], A, B)) N = hits[0];
    else if (oInside(hits[1], A, B)) N = hits[1];
  }
  if (N === null) return { good: false, A, B, Cc, bary, center: bary, M, Bp, sense };
  const theta = angle * Math.PI / 180;
  const Mm = oRotate(Bp, M, theta, -sense);
  const Nam = oRotate(Bp, N, theta, -sense);
  const Nam1 = oRotate(Bp, A, theta, -sense);   // the applet's Am
  const Bm = oRotate(M, B, theta, sense);
  const Nbm = oRotate(M, N, theta, sense);
  const center = angle === 180 ? oBary(A, B, Cc) : oBary(Nbm, Bp, Cc);
  return {
    good: true, A, B, Cc, bary, M, Bp, sense, N, Mm, Nam, Bm, Nbm, center,
    AMoving: [Nam1, Bp, Mm, Nam], BMoving: [M, Nbm, Bm], Triangle: [Cc, Bp, M],
  };
}

/** Shoelace area of a polygon, for the piece/rhombus area claim. */
function oArea(poly) {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return Math.abs(sum) / 2;
}

/** The rhombus the page names, built from the old transcription's points. */
function oldRhombus(g) {
  const turn = (o, p) => ({ x: 2 * o.x - p.x, y: 2 * o.y - p.y });
  const Np = turn(g.Bp, g.N), Npp = turn(g.M, g.N), Mm = turn(g.Bp, g.M);
  return {
    Np, Npp, Mm,
    sides: [oDist(Np, Npp), oDist(Npp, g.M), oDist(g.M, Mm), oDist(Mm, Np)],
    ab: oDist(g.A, g.B),
  };
}

const same = (p, q, tol = 1e-8) =>
  !!p && !!q && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const sameList = (a, b, tol = 1e-8) =>
  !!a && !!b && a.length === b.length && a.every((p, i) => same(p, b[i], tol));

/* ------------------------------------------------------------- 1. the rules */

{
  equal("opening corners match the applet's canvas init at 480x320", C.start({}), {
    A: { x: 200, y: 280 },
    B: { x: 288, y: 213.33333333333334 },
    C: { x: 240, y: 64 },
    angle: 60,
    showNames: false,
    showHint: false,
    moves: 0,
    explored: false,
  });
  equal("the opening triangle scales with another canvas size",
    [C.start({ width: 240, height: 160 }).A, C.start({ width: 240, height: 160 }).C],
    [{ x: 100, y: 140 }, { x: 120, y: 32 }]);
  const s = C.start();
  check("both checkboxes start unticked and the slider starts at 60",
    !s.showNames && !s.showHint && s.angle === C.ANGLE_START);
  check("the angle range is the applet's scrollbar range",
    C.ANGLE_MIN === 0 && C.ANGLE_MAX === 185);
  check("a fresh illustration has not been explored", C.result(s) === null);
  equal("the legal moves are three corners, two slider steps, two switches and Reset",
    C.legalMoves(s).length, 8);
  check("legal moves name every corner and switch",
    C.legalMoves(s).slice(0, 3).map((m) => m.name).join(",") === "A,B,C"
    && C.legalMoves(s).slice(5, 7).map((m) => m.key).join(",") === C.OPTION_KEYS.join(","));

  const moved = C.move(s, { type: "point", name: "C", point: { x: 300, y: 50 } });
  check("a drag moves only the named corner",
    same(moved.C, { x: 300, y: 50 }) && same(moved.A, s.A) && same(moved.B, s.B));
  check("a move leaves the old position untouched", same(s.C, { x: 240, y: 64 }));
  check("a corner outside the board is clamped",
    C.move(s, { type: "point", name: "A", point: { x: 9999, y: -40 } }).A.x === C.WIDTH - C.EDGE);
  check("an unknown or non-finite corner is refused",
    C.move(s, { type: "point", name: "D", point: s.A }) === null
    && C.move(s, { type: "point", name: "A", point: { x: NaN, y: 10 } }) === null);
  check("the slider cannot leave 0..185",
    C.move(s, { type: "angle", value: -5 }).angle === 0
    && C.move(s, { type: "angle", value: 999 }).angle === 185
    && C.move(s, { type: "angle", value: NaN }) === null);
  const ticked = C.move(s, { type: "option", key: "showNames", value: true });
  check("a switch changes only its own flag",
    ticked.showNames && !ticked.showHint && !s.showNames);
  check("an unknown switch or a non-boolean value is refused",
    C.move(s, { type: "option", key: "showHint2", value: true }) === null
    && C.move(s, { type: "option", key: "showHint", value: 1 }) === null);
  check("a null or unknown move is refused",
    C.move(s, null) === null && C.move(null, { type: "reset" }) === null
    && C.move(s, { type: "fly" }) === null);
  check("Reset keeps the controls but restores the triangle",
    same(C.move(ticked, { type: "reset" }).C, s.C)
    && C.move(ticked, { type: "reset" }).showNames);
  check("an explored illustration is finished, with no win or loss",
    C.result(moved) === "done" && moved.moves === 1);
}

/* --------------------------------------------- 2. the sample configurations */

const samples = [];
const bases = [
  [90, 250, 390, 250], [100, 90, 380, 260], [150, 280, 350, 60],
  [120, 160, 360, 160], [200, 300, 280, 30], [70, 300, 410, 120],
];
for (const ax of [60, 140, 220, 300, 380]) {
  for (const ay of [25, 80, 140, 200, 260, 300]) {
    for (const [bx, by, cx, cy] of bases) {
      samples.push({ A: { x: ax, y: ay }, B: { x: bx, y: by }, C: { x: cx, y: cy } });
    }
  }
}
// Rotate the first batch: AB is no longer horizontal, so IntersectX is used.
for (const s of samples.slice()) {
  const o = oBary(s.A, s.B, s.C);
  const t = 0.6, cos = Math.cos(t), sin = Math.sin(t);
  const spin = (p) => ({
    x: o.x + cos * (p.x - o.x) - sin * (p.y - o.y),
    y: o.y + sin * (p.x - o.x) + cos * (p.y - o.y),
  });
  samples.push({ A: spin(s.A), B: spin(s.B), C: spin(s.C) });
}
const rnd = rng(20100808);
for (let i = 0; i < 500; i++) {
  const p = () => ({ x: 20 + rnd() * 440, y: 20 + rnd() * 280 });
  const A = p(), B = p(), Cc = p();
  if (oDist(A, B) < 20 || oDist(B, Cc) < 20 || oDist(Cc, A) < 20) continue;
  if (Math.abs((B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x)) < 800) continue;
  samples.push({ A, B, C: Cc });
}

const angles = [0, 1, 45, 60, 90, 179, 180, 185];
let compared = 0, constructible = 0, oldConstructible = 0;

/* ---------------- 3. the bytecode transcription against the core, point by point */

{
  let allAgree = true, allGoodAgree = true, allPolyAgree = true, allSenseAgree = true;
  for (const s of samples) {
    for (const angle of angles) {
      const state = C.start({ A: s.A, B: s.B, C: s.C, angle });
      const mine = C.compute(state);
      const theirs = oldCompute(s.A, s.B, s.C, angle);
      compared++;
      allGoodAgree &&= mine.good === theirs.good;
      allAgree &&= same(mine.M, theirs.M) && same(mine.Bm, theirs.Bp)
        && same(mine.center, theirs.center);
      allSenseAgree &&= mine.sense === theirs.sense;
      if (mine.good !== theirs.good) continue;
      if (!mine.good) continue;
      constructible++;
      allAgree &&= same(mine.N, theirs.N) && same(mine.Mm, theirs.Mm)
        && same(mine.Np, theirs.Nam) && same(mine.Ap, theirs.AMoving[0])
        && same(mine.Bp, theirs.Bm) && same(mine.Npp, theirs.Nbm);
      allPolyAgree &&= sameList(mine.movingA, theirs.AMoving)
        && sameList(mine.movingB, theirs.BMoving)
        && sameList(mine.fixed, theirs.Triangle);
    }
  }
  check(`the core and the bytecode agree on Good at all ${compared} configurations`, allGoodAgree);
  check("the core and the bytecode agree on M, Bm, orientation and the label centre",
    allAgree && allSenseAgree);
  check("the three moving/fixed polygons match the applet's polygons", allPolyAgree);
  check("the sample really includes a few thousand configurations", compared > 4000);
  check("the sample includes many constructible triangles", constructible > 500);
}

/* ----------------------- 4. the page's rhombus claim, independently checked */

{
  let sidesOK = true, segmentOK = true, midlineOK = true, parallelOK = true;
  let areaOK = true, piecesOK = true, coreOK = true, worst = 0;
  for (const s of samples) {
    const state = C.start({ A: s.A, B: s.B, C: s.C, angle: 180 });
    const g = C.compute(state);
    const theirs = oldCompute(s.A, s.B, s.C, 180);
    if (!g.good || !theirs.good) continue;
    oldConstructible++;
    const h = oldRhombus(theirs);
    const rel = Math.max(...h.sides.map((v) => Math.abs(v - h.ab) / h.ab));
    worst = Math.max(worst, rel);
    sidesOK &&= rel < 1e-9;
    segmentOK &&= oInside(theirs.N, s.A, s.B) && Math.abs(oDist(theirs.M, theirs.N) - h.ab) < 1e-7;
    midlineOK &&= Math.abs(2 * oDist(theirs.Bp, theirs.M) - h.ab) < 1e-7;
    parallelOK &&= Math.abs((h.Npp.x - h.Np.x) * (h.Mm.y - theirs.M.y)
      - (h.Npp.y - h.Np.y) * (h.Mm.x - theirs.M.x)) < 1e-6 * h.ab;
    const tri = Math.abs((s.B.x - s.A.x) * (s.C.y - s.A.y)
      - (s.B.y - s.A.y) * (s.C.x - s.A.x)) / 2;
    const rhombusArea = oArea([h.Np, h.Npp, theirs.M, h.Mm]);
    areaOK &&= Math.abs(rhombusArea - tri) < 1e-5 * Math.max(1, tri);
    piecesOK &&= C.claims(g).piecesFillRhombus && C.claims(g).areaPreserved;
    coreOK &&= Object.values(C.claims(g)).every(Boolean);
  }
  check(`all four sides equal AB at 180° on ${oldConstructible} configurations (worst relative error ${worst.toExponential(2)})`, sidesOK);
  check("N lies on segment AB and MN = AB wherever the cut is made", segmentOK);
  check("twice the mid-segment BmM equals AB", midlineOK);
  check("the half-turn rhombus has parallel opposite sides", parallelOK);
  check("the rhombus and the original triangle have the same area", areaOK);
  check("the three pieces fill the rhombus without changing area", piecesOK);
  check("every boolean in the core's claims() is true for a good cut", coreOK);
  check("the claim sample contains enough rhombi", oldConstructible > 150);
}

/* --------------------- 5. the page's hypotheses and their limits */

{
  // The olympiad hypothesis alone is not enough for THIS construction:
  // a tall, very narrow acute triangle has AM > AB but BM > AB as well.
  const narrow = C.start({ A: { x: 220, y: 280 }, B: { x: 260, y: 280 }, C: { x: 240, y: 60 } });
  const h = C.hypotheses(narrow);
  const g = C.compute(narrow);
  check("a narrow acute triangle has AM > AB yet BM > AB",
    h.acute && h.medianLonger && !h.halfSideShorter && h.am > h.ab && h.bm > h.ab);
  check("that triangle admits no point N on AB with MN = AB", !g.good);
  check("its area exceeds AB², so no rhombus of side AB could hold its pieces",
    h.area > h.ab * h.ab);

  // BM < AB alone is not enough either: with A also inside the circle the
  // circle misses the segment AB, matching the applet's dashed median.
  const flat = C.start({ A: { x: 240, y: 60 }, B: { x: 160, y: 260 }, C: { x: 320, y: 260 } });
  const hf = C.hypotheses(flat);
  check("BM < AB with AM < AB leaves both ends inside the circle",
    hf.halfSideShorter && !hf.medianLonger && !C.compute(flat).good);

  let both = 0, allConstructible = true, acuteAndLong = 0, missingHalfSide = 0;
  for (const s of samples) {
    const st = C.start({ A: s.A, B: s.B, C: s.C, angle: 180 });
    const h2 = C.hypotheses(st);
    if (!h2 || Math.abs((s.B.x - s.A.x) * (s.C.y - s.A.y)
      - (s.B.y - s.A.y) * (s.C.x - s.A.x)) < 50) continue;
    if (h2.medianLonger && h2.halfSideShorter) {
      both++;
      allConstructible &&= C.compute(st).good && C.claims(C.compute(st)).nOnSegment;
    }
    if (h2.acute && h2.medianLonger) {
      acuteAndLong++;
      if (!h2.halfSideShorter) missingHalfSide++;
    }
  }
  check(`AM > AB and BM < AB together always give the cut (${both} cases)`, both > 20 && allConstructible);
  check(`the olympiad hypothesis alone is not sufficient (${missingHalfSide} of ${acuteAndLong} acute cases lack BM < AB)`,
    missingHalfSide > 0);

  // The slider is an animation: at intermediate angles the outline is not a
  // rhombus, so the page's four-equal-sides claim is about the 180° end.
  const open = C.compute(C.start({ angle: 60 }));
  const movingSides = [oDist(open.Np, open.Npp), oDist(open.Npp, open.M),
    oDist(open.M, open.Mm), oDist(open.Mm, open.Np)];
  check("the claim is specific to the half-turn, not to the moving animation",
    movingSides.some((s) => Math.abs(s - open.ab) > 1));
  check("the status line reports the rhombus only at 180°",
    C.describe(C.start({ angle: 180 }), C.compute(C.start({ angle: 180 }))).includes("rhombus is complete")
    && C.describe(C.start(), open).includes("part way"));
}

done("huberts-dissection");
