#!/usr/bin/env node
"use strict";

/*
 * Logic test for cosine-law-unfolded/cosine-law-unfolded-core.js.
 *
 *   node porting/check-cosine-law-unfolded.mjs
 *
 * Checks the page's exact claim - "CP is equal and perpendicular to AB",
 * "CTPR is a parallelogram, so CP is the median of CTR", "ABC and CTR are
 * friendly" and the apparent symmetry about the midpoint O of AB - over a
 * lattice of 550 draggable positions and 500 seeded random configurations,
 * in both unfoldings. Every computed point is also compared with a second,
 * literal transcription of the applet's own FormSquares / Translate / Compute
 * bytecode, written independently of the core.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cosine-law-unfolded/cosine-law-unfolded-core.js", "CosineLawUnfoldedCore");
const P = (x, y) => ({ x, y });
const TOL = 1e-7;
const near = (p, q, tol = TOL) =>
  p && q && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const nearNum = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
const zero = (p, tol = TOL) => near(p, P(0, 0), tol);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const add = (p, q) => P(p.x + q.x, p.y + q.y);
const dot = (p, q) => p.x * q.x + p.y * q.y;

/* ------------------------------------------------------- 1. the start shape */

{
  const s = C.start();
  check("the applet puts C at (width/2, 3*height/7)",
    near(s.C, P(250, (450 * 3) / 7)));
  check("A starts 50 left and 40 below C", near(s.A, P(s.C.x - 50, s.C.y + 40)));
  check("B starts 90 right and 20 below C", near(s.B, P(s.C.x + 90, s.C.y + 20)));
  const q = C.compute(s);
  check("the starting triangle takes the obtuse-at-C unfolding",
    q.SwitchParas === false && C.computeAngle(s.C, s.A, s.B) > Math.PI / 2);
  check("the starting P is C shifted by a perpendicular copy of AB",
    near(sub(q.P, q.C), P(-20, -140), 1e-9));
}

/* -------------------------------- 2. a second, literal bytecode transcription */

/* GeoSDoub.FindOrientation: the bytecode's three cross-product terms. */
function orient2(p0, p1, p2) {
  const d = p2.x * (p0.y - p1.y) + p2.y * (p1.x - p0.x) +
    p0.x * p1.y - p1.x * p0.y;
  return d > 0 ? 1 : -1;
}

/* GeoSDoub.Rotate(base, tip, angle, dir) as the JVM computes it. */
function rot2(base, tip, angle, dir) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return P(
    base.x + co * (tip.x - base.x) - dir * si * (tip.y - base.y),
    base.y + dir * si * (tip.x - base.x) + co * (tip.y - base.y),
  );
}

/* GeoSDoub.ComputeAngle(p0, p1, p2) via SqDist and Dist. */
function angle2(p0, p1, p2) {
  const sq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const d = (a, b) => Math.sqrt(sq(a, b));
  return Math.acos((sq(p0, p1) + sq(p0, p2) - sq(p1, p2)) / 2 / d(p0, p1) / d(p0, p2));
}

/* The canvas's Translate(a, b, c) = a + c - b. */
function tr2(a, b, c) { return P(a.x + c.x - b.x, a.y + c.y - b.y); }

/* CosineLawUnfoldedCanvas.FormSquares() and Compute(), local by local. */
function applet2(A, B, C0) {
  const ori = orient2(C0, B, A);
  const h = Math.PI / 2;
  const S = rot2(A, C0, h, -ori);
  const T = rot2(S, A, h, -ori);
  const Q = rot2(B, C0, h, ori);
  const R = rot2(Q, B, h, ori);
  const E = rot2(A, B, h, ori);
  const D = rot2(B, A, h, -ori);
  const Pt = tr2(T, C0, R);
  const F = tr2(A, Pt, T);
  const G = tr2(B, Pt, R);
  const H = tr2(E, C0, B);
  const J = tr2(H, C0, Pt);
  const sw = angle2(C0, A, B) < h;
  let M, N, K, L;
  if (sw) {
    M = tr2(F, E, H);
    L = M;
    N = tr2(G, D, H);
    K = N;
  } else {
    M = tr2(A, C0, Pt);
    N = tr2(B, C0, Pt);
    K = tr2(H, T, Pt);
    L = tr2(H, R, Pt);
  }
  const O = P((A.x + B.x) / 2, (A.y + B.y) / 2);
  const center = P((A.x + B.x + C0.x) / 3, (A.y + B.y + C0.y) / 3);
  return { S, T, Q, R, E, D, P: Pt, F, G, H, J, M, N, K, L, O, center,
    orientation: ori, SwitchParas: sw };
}

/* A lattice over the whole board plus seeded positions in all three points. */
const configs = [];
{
  const base = C.start();
  for (let x = 40; x <= 460; x += 20) {
    for (let y = 20; y <= 500; y += 20) {
      configs.push({ A: base.A, B: base.B, C: P(x, y) });
    }
  }
  const rand = rng(3872);
  for (let i = 0; i < 500; i++) {
    configs.push({
      A: P(30 + rand() * 200, 30 + rand() * 330),
      B: P(280 + rand() * 190, 30 + rand() * 330),
      C: P(50 + rand() * 400, 20 + rand() * 380),
    });
  }
}

{
  const keys = ["S", "T", "Q", "R", "E", "D", "P", "F", "G", "H", "J",
    "M", "N", "K", "L", "O", "center"];
  let badPoint = 0, badFlag = 0, badOri = 0;
  for (const s of configs) {
    const ours = C.compute(s), theirs = applet2(s.A, s.B, s.C);
    for (const key of keys) if (!near(ours[key], theirs[key])) badPoint++;
    if (ours.SwitchParas !== theirs.SwitchParas) badFlag++;
    if (ours.orientation !== theirs.orientation) badOri++;
  }
  check(`all ${keys.length} computed points match the bytecode on ${configs.length} configurations`,
    badPoint === 0, `${badPoint} differences`);
  check("SwitchParas matches the bytecode's dcmpg comparison everywhere",
    badFlag === 0, `${badFlag} differences`);
  check("FindOrientation matches the bytecode everywhere", badOri === 0, `${badOri} differences`);
}

/* ------------------------------------------- 3. the page's claims, one by one */

{
  let badLen = 0, badPerp = 0, badPara = 0, badMedian = 0;
  for (const s of configs) {
    const m = C.measure(s);
    if (!nearNum(m.cp, m.ab, 1e-8 * Math.max(1, m.ab))) badLen++;
    if (!nearNum(m.cpDot, 0, 1e-7 * Math.max(1, m.ab * m.cp))) badPerp++;
    if (!zero(m.parallelogram, 1e-7 * Math.max(1, m.ab))) badPara++;
    if (!nearNum(m.median, m.ab / 2, 1e-7 * Math.max(1, m.ab)) ||
        !nearNum(m.medianDot, 0, 1e-7 * Math.max(1, m.ab * m.cp))) badMedian++;
  }
  check("CP is equal to AB on every configuration", badLen === 0, `${badLen} failures`);
  check("CP is perpendicular to AB on every configuration", badPerp === 0, `${badPerp} failures`);
  check("CTPR is a parallelogram (T+R = C+P) on every configuration",
    badPara === 0, `${badPara} failures`);
  check("CP is the median of CTR through C and is an altitude of ABC",
    badMedian === 0, `${badMedian} failures`);
}

{
  let badSides = 0, badArea = 0;
  for (const s of configs) {
    const m = C.measure(s);
    if (!nearNum(m.ct, m.ac, 1e-7 * Math.max(1, m.ac)) ||
        !nearNum(m.cr, m.bc, 1e-7 * Math.max(1, m.bc))) badSides++;
    if (!nearNum(m.areaCTR, m.areaABC, 1e-6 * Math.max(1, m.areaABC))) badArea++;
  }
  check("CT = AC and CR = BC: ABC and CTR are friendly", badSides === 0, `${badSides} failures`);
  check("friendly triangles ABC and CTR have equal area", badArea === 0, `${badArea} failures`);
}

{
  let bad = 0;
  for (const s of configs) {
    const m = C.measure(s);
    if (m.symmetry.some((v) => !zero(v, 1e-7 * Math.max(1, m.ab))) ||
        m.branchSymmetry.some((v) => !zero(v, 1e-7 * Math.max(1, m.ab)))) bad++;
  }
  check("the diagram is symmetric about O: C/J, S/G, Q/F and the branch pairs",
    bad === 0, `${bad} failures`);
}

{
  let badArea = 0, badShape = 0, badLaw = 0;
  for (const s of configs) {
    const m = C.measure(s);
    for (const a of m.quadAreas) {
      if (!nearNum(a, m.expectedQuadArea, 1e-6 * Math.max(1, m.expectedQuadArea))) badArea++;
    }
    for (const quad of m.quadrilaterals) {
      if (!near(add(quad[0], quad[2]), add(quad[1], quad[3]), 1e-6 * Math.max(1, m.ab))) badShape++;
    }
    if (!nearNum(m.lawResidual, 0, 1e-6 * Math.max(1, m.ab * m.ab))) badLaw++;
  }
  check("both unfolded parallelograms have area AC·BC·|cos C|",
    badArea === 0, `${badArea} failures`);
  check("both unfolded pieces really are parallelograms", badShape === 0, `${badShape} failures`);
  check("the law of cosines AB² = AC² + BC² − 2·AC·BC·cos C holds everywhere",
    badLaw === 0, `${badLaw} failures`);
}

/* -------------------------------------------- 4. controls and edge cases */

{
  const acute = configs.filter((s) => C.compute(s).SwitchParas);
  const obtuse = configs.filter((s) => !C.compute(s).SwitchParas);
  check("the lattice exercises both unfoldings", acute.length > 50 && obtuse.length > 50,
    `${acute.length} acute, ${obtuse.length} other`);
  check("each unfolding draws two orange pieces",
    C.foldedParallelograms(C.compute(configs[0])).length === 2 &&
    C.foldedParallelograms(C.compute(obtuse[0])).length === 2);

  const s = C.start();
  const low = C.withPoint(s, "C", P(-99, -99));
  const high = C.withPoint(s, "C", P(9999, 9999));
  check("dragging clamps a vertex to the board on both sides",
    near(low.C, P(C.BOARD.margin, C.BOARD.margin)) &&
    near(high.C, P(C.BOARD.width - C.BOARD.margin, C.BOARD.height - C.BOARD.margin)));
  check("dragging one vertex leaves the other two untouched",
    near(low.A, s.A) && near(low.B, s.B) && near(high.A, s.A) && near(high.B, s.B));

  const collinear = { A: P(100, 100), B: P(300, 100), C: P(100, 100) };
  check("a collinear triangle is reported instead of crashing",
    /off the line AB/.test(C.status(collinear)) && !Number.isFinite(C.measure(collinear).cosC));
  check("a live configuration reports the four measured numbers",
    /AB .*CP .*angle A .*angle C/.test(C.status(s)));
}

done("cosine-law-unfolded");
