#!/usr/bin/env node
"use strict";

/*
 * Logic test for cid/cid-core.js.
 *
 *   node porting/check-cid.mjs
 *
 * Checks the whole spinner range (2..178) on four canvas sizes, every claim
 * printed on the cut-the-knot page (the 20/40/60/80 chain, gamma = 180/(2n+1),
 * the equilateral and golden-triangle cases), and a second, literal
 * transcription of CIDCanvas.Reset/Compute from the applet's bytecode. Random
 * drags of the three corners are compared the same way.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cid/cid-core.js", "CidCore");
const DEGS = (r) => (r * 180) / Math.PI;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const samePoint = (a, b, tol) => near(a.x, b.x, tol) && near(a.y, b.y, tol);

/* ------------------------------------------------------------------ *
 * The applet's own computation, written a second time from the bytecode.
 * CIDCanvas.Reset:  getSize(); gamma = TopAngle*PI/180; top = 10; side = 30;
 * h = height - top - 2*side; half = h*tan(gamma/2); if 2*half > width-2*side
 * then refit; A = (width/2, top+side), B = (A.x-half, A.y+h), C = (A.x+half, A.y+h).
 * ------------------------------------------------------------------ */
function appletReset(n, width, height) {
  const gamma = ((180 / n) * Math.PI) / 180;
  let top = 10.0;
  let side = 30.0;
  let h = height - top - 2 * side;
  let half = h * Math.tan(gamma / 2);
  let base = 2 * half;
  if (base > width - 2 * side) {
    base = width - 2 * side;
    half = base / 2;
    h = half / Math.tan(gamma / 2);
    top = height - h - 2 * side;
  }
  const A = { x: Math.floor(width / 2), y: top + side };
  return {
    A: A,
    B: { x: A.x - half, y: A.y + h },
    C: { x: A.x + half, y: A.y + h },
  };
}

/* GeoSDoub.Intersect(DoubCircle, DoubLine): line x = m*y + c if |dy|>1,
   otherwise y = m*x + c; roots (-B +/- sqrt(B*B - A*C))/A. */
function appletIntersect(p, q, circle) {
  const dy = p.y - q.y;
  const dx = p.x - q.x;
  if (Math.abs(dy) > 1) {
    const m = dx / dy;
    const cc = q.x - m * q.y;
    const k = cc - circle.x;
    const B = m * k - circle.y;
    const Cv = circle.y * circle.y + k * k - circle.r * circle.r;
    const A = m * m + 1;
    const disc = B * B - A * Cv;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t0 = (-B + root) / A;
    const t1 = (-B - root) / A;
    return [{ x: m * t0 + cc, y: t0 }, { x: m * t1 + cc, y: t1 }];
  }
  if (Math.abs(dx) > 1) {
    const m = dy / dx;
    const cc = q.y - m * q.x;
    const k = cc - circle.y;
    const B = m * k - circle.x;
    const Cv = circle.x * circle.x + k * k - circle.r * circle.r;
    const A = m * m + 1;
    const disc = B * B - A * Cv;
    if (disc < 0) return null;
    const root = Math.sqrt(disc);
    const t0 = (-B + root) / A;
    const t1 = (-B - root) / A;
    return [{ x: t0, y: m * t0 + cc }, { x: t1, y: m * t1 + cc }];
  }
  return null;
}

/* CIDCanvas.Other: if hit[0] is within 1 of the point we came from, use hit[1]. */
function appletOther(hits, previous) {
  if (!hits || !hits.length) return null;
  if (hits.length < 2) return hits[0];
  return dist(hits[0], previous) < 1 ? hits[1] : hits[0];
}

/* CIDCanvas.Compute: Points = [B, C]; S1 = Dist(B,C);
   S3 = Math.round((180/TopAngle)/2) - 1;
   while (S3-- >= 0) { L5 = last, L6 = second-last; circle(L5,S1),
   line(L6,A), hit = Other(Intersect(...),L6);
   if (hit.y <= A.y - 0.001) break; Points.add(hit); } */
function appletCompute(A, B, Cc, n) {
  const points = [{ x: B.x, y: B.y }, { x: Cc.x, y: Cc.y }];
  const S1 = dist(B, Cc);
  let S3 = Math.floor(180 / (180 / n) / 2 + 0.5) - 1;
  while (S3 >= 0) {
    S3 = S3 - 1;
    const size = points.length;
    const L5 = points[size - 1];
    const L6 = points[size - 2];
    const hit = appletOther(
      appletIntersect(L6, A, { x: L5.x, y: L5.y, r: S1 }),
      L6,
    );
    if (!hit) break;
    if (hit.y <= A.y - 0.001) break;
    points.push({ x: hit.x, y: hit.y });
  }
  return points;
}

function angleAt(v, p, q) {
  const u = { x: p.x - v.x, y: p.y - v.y };
  const w = { x: q.x - v.x, y: q.y - v.y };
  return DEGS(
    Math.acos(
      Math.max(-1, Math.min(1, (u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y)))),
    ),
  );
}

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start({});
  check("default denominator is 9 (a 20 degree apex)", s.n === 9 && near(C.topAngle(s), 20));
  check("default corners are the applet's canvas placement",
    samePoint(s.A, { x: 250, y: 40 }, 1e-9) && near(s.B.y, 420) && near(s.C.y, 420) &&
    near(s.A.x - s.B.x, s.C.x - s.A.x));
  check("an illustration has no result", C.result(s) === null && C.result({}) === null);
  check("spinner range is clamped at both ends",
    C.clampN(1) === 2 && C.clampN(900) === 178 && C.clampN(9.4) === 9 && C.clampN("oops") === 9);
  check("options from start are kept",
    C.start({ n: 7, showNames: true }).showNames === true &&
    C.start({ n: 7 }).showNames === false);
}

/* ------------------------------ 2. every spinner value, several canvas sizes */

{
  const sizes = [[500, 450], [400, 300], [375, 450], [900, 700]];
  let resets = true, computed = true, angles = true, loops = true;
  let steps = true, slices = true, finite = true, chainLen = true;
  for (const [width, height] of sizes) {
    for (let n = C.MIN_N; n <= C.MAX_N; n++) {
      const s = C.start({ n, width, height });
      const o = appletReset(n, width, height);
      if (!samePoint(s.A, o.A, 1e-9) || !samePoint(s.B, o.B, 1e-9) || !samePoint(s.C, o.C, 1e-9)) resets = false;
      if (!near(C.topAngle(s), 180 / n, 1e-12) || !near(C.apexAngle(s), 180 / n, 1e-7)) angles = false;
      if (C.iterations(s) !== Math.floor(180 / (180 / n) / 2 + 0.5) - 1) loops = false;

      const mine = C.compute(s);
      const theirs = appletCompute(o.A, o.B, o.C, n);
      if (mine.length !== theirs.length) computed = false;
      else for (let i = 0; i < mine.length; i++) {
        if (!samePoint(mine[i], theirs[i], 1e-5 * dist(o.B, o.C))) computed = false;
        if (!Number.isFinite(mine[i].x) || !Number.isFinite(mine[i].y)) finite = false;
      }
      const radius = dist(s.B, s.C);
      for (let i = 1; i < mine.length; i++) {
        if (!near(dist(mine[i - 1], mine[i]), radius, 1e-5 * radius)) steps = false;
      }
      // (2n+1)-gon: odd denominators get n slices and land on the apex;
      // even denominators stop one step short of closing.
      const expected = Math.floor(180 / (180 / n) / 2 + 0.5) - 1;
      if (mine.length < 2 || mine.length > expected + 3) chainLen = false;
      const tris = C.triangles(s);
      for (const t of tris) {
        if (!near(t.baseAngle, t.farAngle, 1e-6) ||
            !near(t.baseAngle + t.apexAngle + t.farAngle, 180, 1e-6)) slices = false;
      }
    }
  }
  check("Reset matches the bytecode on all 177 denominators and 4 canvas sizes", resets);
  check("Compute matches the bytecode on all configurations", computed);
  check("the drawn apex angle is 180/n everywhere", angles);
  check("iteration count is round((180/TopAngle)/2)-1 everywhere", loops);
  check("every step of the chain equals |BC|", steps);
  check("every slice is an isosceles triangle", slices);
  check("all computed points are finite", finite);
  check("the chain takes either n or n+1 steps, as the loop allows", chainLen);
}

/* ------------------------------------------------- 3. the page's own claims */

{
  let arithmetic = true, formulaForOdd = true, notFormulaForEven = true;
  for (let n = 3; n <= C.MAX_N; n++) {
    const s = C.start({ n });
    const c = C.claims(s);
    const bases = C.triangles(s).map((t) => t.baseAngle);
    for (let i = 1; i < bases.length; i++) {
      if (!near(bases[i - 1] - bases[i], 180 / n, 1e-6)) arithmetic = false;
    }
    if (n % 2 === 1 && (!c.complete || !c.formula)) formulaForOdd = false;
    if (n % 2 === 0 && (c.complete || c.formula)) notFormulaForEven = false;
  }
  check("base angles form an arithmetic sequence with difference gamma", arithmetic);
  check("odd denominator: gamma = 180/(2n+1) and the chain closes at A", formulaForOdd);
  check("even denominator: the chain stops short, so the page's formula does not apply", notFormulaForEven);
}

{
  const s9 = C.start({ n: 9 });
  const bases9 = C.triangles(s9).map((t) => Math.round(t.baseAngle));
  equal("20 degree apex gives base angles 80, 60, 40, 20", bases9, [80, 60, 40, 20]);
  check("20 degree apex gives exactly four slices", C.triangles(s9).length === 4 && C.claims(s9).twentyDegrees);

  const s5 = C.start({ n: 5 });
  const g5 = C.triangles(s5).map((t) => Math.round(t.apexAngle));
  equal("36 degree apex gives the golden triangle 72-72-36 then 36-108-36", g5, [36, 108]);
  check("36 degree apex gives two slices", C.triangles(s5).length === 2 && C.claims(s5).thirtySixDegrees);

  const s3 = C.start({ n: 3 });
  const tri3 = C.triangles(s3)[0];
  check("60 degree apex is its own one-slice equilateral decomposition",
    C.triangles(s3).length === 1 && C.claims(s3).sixtyDegrees &&
    near(tri3.baseAngle, 60, 1e-6) && near(tri3.apexAngle, 60, 1e-6));

  const s7 = C.start({ n: 7 });
  check("pi/7 apex gets three slices with base angles 180/7, 360/7, 540/7",
    C.triangles(s7).length === 3 &&
    near(C.triangles(s7)[0].baseAngle, 540 / 7, 1e-6) &&
    near(C.triangles(s7)[2].baseAngle, 180 / 7, 1e-6));
}

/* ---------------------------------------------- 4. options, drags, purity */

{
  const s = C.start({ n: 9 });
  const bigger = C.withOption(s, "n", 5);
  check("changing n restores the picture for that denominator",
    bigger.n === 5 && near(C.topAngle(bigger), 36) && samePoint(bigger.A, appletReset(5, 500, 450).A, 1e-9));
  check("changing n out of range clamps like the spinner", C.withOption(s, "n", 1).n === 2 && C.withOption(s, "n", 999).n === 178);
  check("the enumeration toggle does not move the picture",
    C.withOption(s, "showNames", true).showNames === true &&
    samePoint(C.withOption(s, "showNames", true).B, s.B, 0));
  check("an unknown option changes nothing", samePoint(C.withOption(s, "other", 4).A, s.A, 0));
}

{
  const rnd = rng(20261126);
  let symmetric = true, sameAngle = true, dragsMatch = true, inBounds = true, immutable = true;
  const before = C.start({ n: 9 });
  const snapshot = JSON.stringify(before);
  for (let i = 0; i < 240; i++) {
    const n = 3 + Math.floor(rnd() * 175);
    let s = C.start({ n });
    const name = ["A", "B", "C"][i % 3];
    const p = {
      x: 20 + rnd() * 460,
      y: 20 + rnd() * 420,
    };
    s = C.withPoint(s, name, p);
    const midX = (s.B.x + s.C.x) / 2;
    if (!near(s.A.x, midX, 1e-6) || !near(s.B.y, s.C.y, 1e-6)) symmetric = false;
    if (!near(C.apexAngle(s), 180 / n, 1e-6)) sameAngle = false;
    for (const q of [s.A, s.B, s.C]) {
      if (q.x < 0 || q.x > s.width || q.y < 0 || q.y > s.height) inBounds = false;
      if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) dragsMatch = false;
    }
    const mine = C.compute(s);
    const theirs = appletCompute(s.A, s.B, s.C, n);
    if (mine.length !== theirs.length) dragsMatch = false;
    else for (let j = 0; j < mine.length; j++) {
      if (!samePoint(mine[j], theirs[j], 1e-5 * dist(s.B, s.C))) dragsMatch = false;
    }
  }
  check("a drag keeps A above the midpoint of BC", symmetric);
  check("a drag keeps the apex angle at 180/n", sameAngle);
  check("dragged positions stay on the canvas", inBounds);
  check("Compute after a drag still matches the bytecode", dragsMatch);
  check("the original position is never changed", snapshot === JSON.stringify(before));
}

done("cid");
