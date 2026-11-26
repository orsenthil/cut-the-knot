#!/usr/bin/env node
"use strict";

/*
 * Logic test for bid/bid-core.js.
 *
 *   node porting/check-bid.mjs
 *
 * Checked: the whole scrollbar range (20..80 degrees) against a second,
 * literal transcription of BIDCanvas.Reset/Compute (GeoSDoub.Intersect,
 * IntersectX and Other included), plus 400 random triangles of different
 * sizes and centres. Then every claim on the applet's page: AF = EF and the
 * three other equal sides for 0 < angle < 60; a four-triangle tiling below
 * 45, three triangles at 45, crossing lines above 45 up to 60; no chain
 * above 60; the angle table; the golden-triangle similarity at 36; and the
 * exact window where the obtuse pair is CDE/AEF (30 < angle < 45, not the
 * whole range the page's sentence seems to suggest).
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bid/bid-core.js", "BidCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tri = (A, B, Cc) => ({ A: { ...A }, B: { ...B }, C: { ...Cc } });

/* -------------------------------- the applet's own methods, transcribed */

/* BIDCanvas.Reset: margin 10, dy 30, 400x300 by default. */
function appletReset(angle, width, height) {
  const w = width, h = height;
  const rad = (angle * Math.PI) / 180;
  let margin = 10;
  const dy = 30;
  let hgt = h - margin - 2 * dy;
  let x = hgt * Math.tan(rad / 2);
  let twice = 2 * x;
  if (twice > w - 2 * dy) {
    twice = w - 2 * dy;
    x = twice / 2;
    hgt = x / Math.tan(rad / 2);
    margin = h - hgt - 2 * dy;
  }
  const A = { x: Math.floor(w / 2), y: margin + dy };
  return { A, B: { x: A.x - x, y: A.y + hgt }, C: { x: A.x + x, y: A.y + hgt } };
}

/* GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint). */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.IntersectX(DoubLine, DoubCircle), the x = a*y + b form. */
function appletIntersectX(circle, P, Q) {
  const a = (P.x - Q.x) / (P.y - Q.y);
  const b = Q.x - a * Q.y;
  const A = a * a + 1;
  const m = a * (b - circle.x) - circle.y;
  const c = circle.y * circle.y + (b - circle.x) * (b - circle.x) - circle.r * circle.r;
  const disc = m * m - A * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [{ x: a * ((-m + s) / A) + b, y: (-m + s) / A },
          { x: a * ((-m - s) / A) + b, y: (-m - s) / A }];
}

function appletCircleLine(circle, P, Q) {
  if (Math.abs(P.y - Q.y) > 1) return appletIntersectX(circle, P, Q);
  return null;
}

/* BIDCanvas.Other: the second hit, or the old point when there is no hit. */
function appletOther(hits, p, fallback) {
  try {
    if (dist(hits[0], p) < 1) return hits[1];
    return hits[0];
  } catch (e) {
    return fallback;
  }
}

/* BIDCanvas.Compute, including the `while (n-- >= 0)` loop. */
function appletCompute(A, B, Cc, angle) {
  const points = [{ ...Cc }, { ...B }];
  let s = dist(B, Cc);
  let n = Math.round(180 / angle / 2);
  while (n-- >= 0) {
    const size = points.length;
    const last = points[size - 1];
    const prev = points[size - 2];
    if (size === 3) {
      const mid = { x: (prev.x + last.x) / 2, y: (prev.y + last.y) / 2 };
      const perp = { x: mid.x + (prev.y - last.y), y: mid.y + (last.x - prev.x) };
      const p = appletIntersect(A, prev, mid, perp);
      points.push(p);
      s = dist(B, p);
    } else {
      const hits = appletCircleLine({ x: last.x, y: last.y, r: s }, prev, A);
      const p = appletOther(hits, prev, prev);
      if (p.y <= A.y - 0.001) break;
      points.push({ ...p });
    }
  }
  return points;
}

function matches(a, b, tol) {
  if (a.length !== b.length) return false;
  return a.every((p, i) => closePoint(p, b[i], tol));
}

/* ------------------------------------------- 1. the start and the options */

{
  const s = C.start({});
  equal("the starting position is the 45-degree Reset", { A: s.A, B: s.B, C: s.C },
    { A: { x: 200, y: 40 }, B: { x: 104.73088065418814, y: 270 }, C: { x: 295.2691193458119, y: 270 } });
  check("a new illustration is not a win or a loss", C.result(s) === null);
  check("the starting angle is 45 degrees", s.angle === 45);
  check("withPoint does not change the old position", (() => {
    const next = C.withPoint(s, "A", { x: 50, y: 50 });
    return s.A.x === 200 && next.A.x === 50 && next.B.y === 270;
  })());
  check("an unknown handle leaves the position alone", C.withPoint(s, "Z", { x: 1, y: 2 }).A.x === 200);
}

/* --------------- 2. every option value against the applet's own computation */

{
  let startOK = true, chainOK = true, checked = 0;
  for (let angle = 20; angle <= 80; angle++) {
    const s = C.start({ angle });
    const ref = appletReset(angle, 400, 300);
    const tol = 1e-8 * Math.max(1, dist(ref.B, ref.C));
    if (!closePoint(s.A, ref.A, tol) || !closePoint(s.B, ref.B, tol) || !closePoint(s.C, ref.C, tol)) startOK = false;
    const appletPoints = appletCompute(ref.A, ref.B, ref.C, angle);
    const corePoints = C.construct(s).points;
    if (!matches(appletPoints, corePoints, tol)) {
      chainOK = false;
      if (checked < 3) console.error(`  angle ${angle}: applet ${JSON.stringify(appletPoints)} core ${JSON.stringify(corePoints)}`);
    }
    checked++;
  }
  check("all 61 scrollbar values lay out the triangle as Reset does", startOK);
  check("all 61 scrollbar values draw the same chain as Compute", chainOK);
  check("the 20-to-80 range was walked without gaps", checked === 61);
}

/* --------------------- 3. random sizes, centres and angles vs the applet */

{
  const rand = rng(2602);
  let resetOK = true, chainOK = true, arbitraryOK = true;
  for (let trial = 0; trial < 400; trial++) {
    const width = 280 + Math.floor(rand() * 400);
    const height = 220 + Math.floor(rand() * 300);
    const angle = 20 + rand() * 60; // fractional values too
    const s = C.start({ angle, width, height });
    const ref = appletReset(angle, width, height);
    const tol = 1e-7 * Math.max(1, dist(ref.B, ref.C));
    if (!closePoint(s.A, ref.A, tol) || !closePoint(s.B, ref.B, tol) || !closePoint(s.C, ref.C, tol)) resetOK = false;
    if (!matches(appletCompute(ref.A, ref.B, ref.C, angle), C.construct(s).points, tol)) chainOK = false;

    // An isosceles triangle that does not come from Reset at all.
    const A = { x: 100 + rand() * 400, y: 20 + rand() * 100 };
    const baseY = A.y + 100 + rand() * 200;
    const half = (baseY - A.y) * Math.tan(((20 + rand() * 58) * Math.PI) / 360);
    const B = { x: A.x - half, y: baseY }, Cc = { x: A.x + half, y: baseY };
    const a = C.angleOf(tri(A, B, Cc));
    const arbitrary = tri(A, B, Cc);
    arbitrary.angle = a;
    const tol2 = 1e-7 * Math.max(1, 2 * half);
    if (!matches(appletCompute(A, B, Cc, a), C.construct(arbitrary).points, tol2)) arbitraryOK = false;
  }
  check("400 random canvas sizes match the applet's Reset", resetOK);
  check("400 random scrollbar values match the applet's Compute", chainOK);
  check("400 arbitrary isosceles triangles match the applet's Compute", arbitraryOK);
}

/* ------------------------- 4. the page's equalities, for every angle < 60 */

{
  let equalities = true, formulas = true, cases = 0;
  for (let a = 0.5; a < 60; a += 0.25) {
    if (a > 45 && a < 45.14) continue; // the applet repeats D here; tested below
    const cl = C.claims(C.start({ angle: a }));
    if (!cl.equalSides) { equalities = false; console.error(`  equal sides fail at ${a}`); }
    if (!cl.angleFormulas) { formulas = false; console.error(`  angle table fails at ${a}`); }
    cases++;
  }
  check(`BD = BC, BE = DE, EF = DE and AF = EF for ${cases} angles under 60 (outside a tiny gap)`, equalities);
  check(`the page's four angle formulas hold at those ${cases} angles`, formulas);

  /* The circle centred at E misses the line DA for angles just above 45:
   * GeoSDoub.Other then hands back the old point, so F = D and AF = AD,
   * not EF. The article's "goes through for 0 < A < 60" is not literally
   * true in that gap; the port keeps the applet's behaviour. */
  let gapOK = true, gapCases = 0;
  for (let k = 1; k <= 13; k++) {
    const a = 45 + k / 100;
    const s = C.start({ angle: a });
    const m = C.analyze(s);
    const ref = appletCompute(s.A, s.B, s.C, a);
    if (!closePoint(m.F, ref[4], 1e-7 * m.lengths.BC) ||
        !close(m.lengths.AF, m.lengths.AD, 1e-7 * m.lengths.BC) ||
        close(m.lengths.AF, m.lengths.EF, 1e-7 * m.lengths.BC)) {
      gapOK = false;
      console.error(`  gap ${a}: F=${JSON.stringify(m.F)} ref=${JSON.stringify(ref[4])} AF=${m.lengths.AF} AD=${m.lengths.AD} EF=${m.lengths.EF}`);
    }
    gapCases++;
  }
  check(`the ${gapCases} angles just above 45 repeat D exactly as the applet does`, gapOK);
}

{
  const rand = rng(37);
  let ok = true, cases = 0;
  for (let i = 0; i < 300; i++) {
    const a = 0.1 + rand() * 59.8;
    if (a > 45 && a < 45.14) continue;
    if (!C.claims(C.start({ angle: a })).equalSides) ok = false;
    cases++;
  }
  check(`${cases} random apex angles under 60 still close at AF = EF`, ok);
}

/* ------------------- 5. decomposition, the 45 case and the crossing range */

{
  let below = true, at45 = true, above = true, high = true;
  for (let a = 1; a < 45; a += 0.5) {
    const cl = C.claims(C.start({ angle: a }));
    if (!cl.tiles || Math.abs(cl.partsRatio - 1) > 1e-7) below = false;
  }
  for (let a = 45.5; a < 60; a += 0.5) {
    const cl = C.claims(C.start({ angle: a }));
    if (!cl.crossesAbove45 || cl.partsRatio < 1) above = false;
  }
  for (let a = 61; a <= 89; a++) {
    if (!C.claims(C.start({ angle: a })).noChainAbove60) high = false;
  }
  const at60 = C.analyze(C.start({ angle: 60 }));
  const degenerate60 = closePoint(at60.D, at60.A, 1e-7 * at60.lengths.BC) &&
    closePoint(at60.F, at60.A, 1e-7 * at60.lengths.BC);
  check("at exactly 60 degrees the chain collapses onto the apex A", degenerate60);
  const golden = C.claims(C.start({ angle: 36 }));
  check("all angles under 45 give four isosceles triangles that tile ABC", below);
  check("at 45 degrees D and F coincide and three triangles tile ABC",
    at45 && C.claims(C.start({ angle: 45 })).threeAt45);
  check("angles between 45 and 60 keep the equal sides but cross the lines", above);
  check("angles of 60 and more stop before the construction starts", high);
  check("at 36 degrees both pairs of triangles are similar (golden triangle)", golden.golden);
}

/* ----------- 6. the page's obtuse/acute sentence, and David's 45 degrees */

{
  let windowOK = true;
  for (let a = 1; a < 60; a++) {
    const want = a > 30 && a < 45;
    if (C.claims(C.start({ angle: a })).obtusePair !== want) windowOK = false;
  }
  check("the two obtuse triangles are BDE and AEF exactly for 30 < angle < 45", windowOK);

  const m = C.analyze(C.start({ angle: 45 }));
  check("in David's 45-degree case F is the same point as D", closePoint(m.F, m.D, 1e-7));
  check("in David's 45-degree case AEF is right isosceles at F",
    close(m.triangles.AEF[2], 90, 1e-7));
}

/* ------------------------------------------- 7. the state helpers are pure */

{
  const s = C.start({ angle: 36 });
  const changed = C.withAngle(s, 50);
  check("withAngle keeps the old position untouched", s.angle === 36 && changed.angle === 50);
  check("withAngle keeps the canvas size",
    changed.width === 400 && changed.height === 300 && C.angleOf(changed) > 49 && C.angleOf(changed) < 51);
  const dragged = C.withPoint(s, "B", { x: s.A.x - 130, y: 270 });
  check("dragging a base end keeps AB = AC",
    Math.abs(dist(dragged.A, dragged.B) - dist(dragged.A, dragged.C)) < 1e-9);
  const movedA = C.withPoint(s, "A", { x: 210, y: 30 });
  check("dragging the apex keeps the base horizontal and the equal sides",
    movedA.B.y === movedA.C.y && Math.abs(dist(movedA.A, movedA.B) - dist(movedA.A, movedA.C)) < 1e-9);
}

done("bid");
