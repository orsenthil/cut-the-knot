#!/usr/bin/env node
"use strict";

/*
 * Logic test for midpoints-in-isosceles-triangle/midpoints-in-isosceles-triangle-core.js.
 *
 *   node porting/check-midpoints-in-isosceles-triangle.mjs
 *
 * Checked: the canvas layout in Canvas.init; the drag constraints in
 * UpgradePoints and Fix(1); a second, literal transcription of Canvas.Compute
 * (CTKGeometryPlus.Midpoint, GeoSDoub.NearestPoint and GeoSDoub.Intersect,
 * including their 0.1 and 1.0 cut-offs) compared with the core on a grid of
 * about 19,000 configurations; and every claim on the applet's page over that
 * whole grid. In particular AD ⟂ CH always holds, while the page's side list
 * "CH ⟂ AM" does not — the perpendicular pair is BC ⟂ AM.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore(
  "midpoints-in-isosceles-triangle/midpoints-in-isosceles-triangle-core.js",
  "MidpointsInIsoscelesTriangleCore",
);

/* ------------------------------------------------ the applet, transcribed again */

const sq = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
const mid = (p, q) => ({ x: (p.x + q.x) / 2.0, y: (p.y + q.y) / 2.0 });

/** GeoSDoub.NearestPoint(p, a, b), straight from the bytecode. */
function appletNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (sq(a, p) < 0.1) return { x: p.x, y: p.y };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** GeoSDoub.Intersect(p1, p2, p3, p4), with its determinant cut-off of 1. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/** MidpointsInIsoscelesTriangleCanvas.Compute, statement by statement. */
function appletCompute(s) {
  const M = mid(s.B, s.C);
  const H = appletNearest(M, s.A, s.B);
  const D = mid(M, H);
  const L = appletNearest(s.C, s.A, s.B);
  const K = appletIntersect(s.A, D, s.C, H);
  const E = mid(H, D); // the applet's unused local, used for the label position
  return { M, H, D, L, K, label: { x: Math.round(M.x), y: Math.round(E.y) } };
}

/** Canvas.UpgradePoints after a drag of B or C. */
function appletDrag(s, name, p) {
  const A = { x: s.A.x, y: s.A.y };
  const B = { x: s.B.x, y: s.B.y };
  const Cc = { x: s.C.x, y: s.C.y };
  if (name === "B") {
    B.x = p.x; B.y = p.y;
    Cc.x = 2 * A.x - B.x; Cc.y = B.y;
  } else if (name === "C") {
    Cc.x = p.x; Cc.y = p.y;
    B.x = 2 * A.x - Cc.x; B.y = Cc.y;
  } else if (name === "A") {
    A.y = p.y; // CTKMoveableDoub.Fix(1) holds A.x still
  }
  return { A, B, C: Cc };
}

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => {
  if (!p || !q) return false;
  if (Number.isNaN(p.x) && Number.isNaN(q.x) && Number.isNaN(p.y) && Number.isNaN(q.y)) return true;
  return Number.isFinite(p.x) && Number.isFinite(q.x) &&
    Number.isFinite(p.y) && Number.isFinite(q.y) &&
    Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
};
const state = (cx, apexY, half, baseY) => ({
  A: { x: cx, y: apexY }, B: { x: cx - half, y: baseY }, C: { x: cx + half, y: baseY },
});

/* -------------------------------------------------- 1. init, moves, no result */

{
  const s = C.start();
  equal("start A matches Canvas.init on 400x300", s.A, { x: 200, y: 100 });
  equal("start B matches Canvas.init on 400x300", s.B, { x: 100, y: 200 });
  equal("start C matches Canvas.init on 400x300", s.C, { x: 300, y: 200 });
  equal("integer division in init for an odd canvas", C.start({ width: 401, height: 301 }).A, { x: 200, y: 100 });
  equal("odd canvas base height", C.start({ width: 401, height: 301 }).B.y, 201);
  check("an illustration has no win, loss or end", C.result(s) === null);
  check("withPoint leaves the old state alone", (() => {
    const next = C.withPoint(s, "A", { x: 3, y: 3 });
    return s.A.y === 100 && next.A.y === 3 && next.B.y === s.B.y;
  })());
  check("dragging A keeps its x fixed like Fix(1)", C.withPoint(s, "A", { x: 3, y: 55 }).A.x === 200);
  check("an unknown handle changes nothing", (() => {
    const next = C.withPoint(s, "Z", { x: 3, y: 4 });
    return JSON.stringify(next) === JSON.stringify(s);
  })());
}

/* ----------------------------------------- 2. the page's claims on fixed shapes */

const fixed = [
  ["applet's start", state(200, 100, 100, 200)],
  ["wide, low apex", state(200, 20, 180, 260)],
  ["narrow, high apex", state(200, 260, 25, 40)],
  ["inverted triangle", state(200, 250, 130, 60)],
  ["nearly flat", state(200, 140, 160, 150)],
  ["compact", state(137, 90, 35, 140)],
];

for (const [name, s] of fixed) {
  const cl = C.claims(s);
  for (const key of ["isosceles", "MmidBC", "MHperpAB", "DmidMH", "ADperpCH",
    "rightAngleAtK", "HmidBL", "CLperpAH", "BLperpMH", "BCperpAM",
    "similarBLC_MHA", "medians"]) {
    check(`${name}: ${key}`, cl[key]);
  }
  check(`${name}: the page's "CH ⟂ AM" side list is a slip`, !cl.pageCHperpAM);
  const g = C.compute(s);
  check(`${name}: K is the crossing of AD and CH`,
    Math.abs((g.K.x - s.A.x) * (g.D.y - s.A.y) - (g.K.y - s.A.y) * (g.D.x - s.A.x)) < 1e-7 &&
    Math.abs((g.K.x - s.C.x) * (g.H.y - s.C.y) - (g.K.y - s.C.y) * (g.H.x - s.C.x)) < 1e-7);
}

/* --------------------------- 3. sweep: second transcription and every claim */

{
  let compared = 0, mismatches = 0, nondegenerate = 0, claimFails = 0, pageSlipFails = 0;
  let degenerate = 0, degenerateClaimPasses = 0, dragCompared = 0, dragMismatch = 0;
  for (const cx of [200, 137, 401]) {
    for (let apexY = 5; apexY <= 295; apexY += 20) {
      for (let half = 1; half <= 195; half += 7) {
        for (let baseY = 5; baseY <= 295; baseY += 19) {
          const s = state(cx, apexY, half, baseY);
          const g = C.compute(s);
          const a = appletCompute(s);
          for (const key of ["M", "H", "D", "L", "K", "label"]) {
            if (!closePoint(g[key], a[key], 1e-8 * Math.max(1, half))) {
              if (mismatches++ < 4) console.error(`  compute mismatch at ${JSON.stringify(s)} ${key}: core ${JSON.stringify(g[key])}, applet ${JSON.stringify(a[key])}`);
            }
          }
          compared++;
          const cl = C.claims(s);
          if (C.measurements(s).degenerate) {
            degenerate++;
            if (Object.values(cl).some(Boolean)) degenerateClaimPasses++;
          } else {
            nondegenerate++;
            if (!cl.ADperpCH || !cl.rightAngleAtK || !cl.HmidBL || !cl.medians ||
                !cl.similarBLC_MHA || !cl.isosceles || !cl.MmidBC || !cl.MHperpAB ||
                !cl.DmidMH || !cl.CLperpAH || !cl.BLperpMH || !cl.BCperpAM) {
              if (claimFails++ < 4) console.error(`  claim failed at ${JSON.stringify(s)}: ${JSON.stringify(cl)}`);
            }
            if (cl.pageCHperpAM) pageSlipFails++;
          }
          // One drag of each base corner, compared with UpgradePoints.
          const pB = { x: cx - half - 13, y: baseY + 7 };
          const pC = { x: cx + half + 11, y: baseY - 9 };
          const movedB = C.withPoint(s, "B", pB), movedC = C.withPoint(s, "C", pC);
          if (JSON.stringify(movedB) !== JSON.stringify(appletDrag(s, "B", pB))) dragMismatch++;
          if (JSON.stringify(movedC) !== JSON.stringify(appletDrag(s, "C", pC))) dragMismatch++;
          if (C.withPoint(s, "A", { x: 7, y: apexY - 5 }).A.x !== cx) dragMismatch++;
          dragCompared += 3;
        }
      }
    }
  }
  check(`core matches the applet's Compute on ${compared} configurations`, compared > 18000 && mismatches === 0,
    `${mismatches} mismatches`);
  check(`all page claims hold on ${nondegenerate} non-degenerate configurations`, nondegenerate > 18000 && claimFails === 0,
    `${claimFails} failures`);
  check("the page's CH ⟂ AM side list fails for every non-degenerate case", pageSlipFails === 0,
    `${pageSlipFails} unexpected passes`);
  check(`all ${degenerate} degenerate configurations refuse every claim`, degenerate > 0 && degenerateClaimPasses === 0,
    `${degenerateClaimPasses} passes`);
  check(`${dragCompared} drags match UpgradePoints / Fix(1)`, dragCompared > 50000 && dragMismatch === 0,
    `${dragMismatch} mismatches`);
}

/* ----------------------- 4. the applet's two numerical cut-offs and edge cases */

{
  const near = state(200, 100, 0.05, 100.05); // SqDist(A, M) < 0.1
  check("NearestPoint's 0.1 cut-off returns the point itself",
    closePoint(C.nearestPoint(near.B, near.A, near.C), near.B, 1e-12) &&
    closePoint(appletNearest(near.B, near.A, near.C), near.B, 1e-12));
  const flat = state(200, 100, 100, 100);
  const g = C.compute(flat), a = appletCompute(flat);
  check("Intersect's determinant cut-off gives NaN for a flat triangle",
    Number.isNaN(g.K.x) && Number.isNaN(g.K.y) &&
    Number.isNaN(a.K.x) && Number.isNaN(a.K.y));
  const cl = C.claims(flat);
  check("a flat triangle passes no claim, including the main one", !Object.values(cl).some(Boolean));
  const gone = state(200, 100, 0, 200);
  check("a collapsed base is refused safely", C.claims(gone).ADperpCH === false);
  const m = C.measurements(state(200, 100, 100, 200));
  check("the medians of BLC and MHA are CH and AD",
    close(dist(m.B, m.H), dist(m.H, m.L), 1e-8) && close(dist(m.M, m.D), dist(m.D, m.H), 1e-8));
  check("the three corresponding side ratios are equal (quarter turn)",
    close(m.lengths.BL / m.lengths.MH, m.lengths.LC / m.lengths.HA, 1e-8) &&
    close(m.lengths.LC / m.lengths.HA, m.lengths.BC / m.lengths.AM, 1e-8));
}

done("midpoints-in-isosceles-triangle");
