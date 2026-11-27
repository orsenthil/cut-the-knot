#!/usr/bin/env node
"use strict";

/*
 * Logic test for four-incident-circles/four-incident-circles-core.js.
 *
 *   node porting/check-four-incident-circles.mjs
 *
 * The old page says that the quadrilateral made by four common tangents to
 * equal circles through one point "is always cyclic".  This test checks that
 * claim on thousands of configurations, using a second transcription of the
 * applet's own methods (Reset, UpgradePoints, GetTangents, GetCommonTangent,
 * DrawOuterCircle and GeoSDoub's Intersect / FindCircumcenter) written
 * straight from javap.  It also compares that transcription with the core
 * over many random drag sequences and checks the applet's starting values,
 * options and degenerate cases.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("four-incident-circles/four-incident-circles-core.js", "FourIncidentCirclesCore");
const random = rng(20261127);
const close = (a, b, eps = 1e-8) => Math.abs(a - b) <= eps;
const ptClose = (a, b, eps = 1e-8) => close(a.x, b.x, eps) && close(a.y, b.y, eps);
const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);

/* -------------------------------------------------------------------------- */
/* A second, independent transcription of the applet's bytecode.              */
/* -------------------------------------------------------------------------- */

const A_PT = (x, y) => ({ x, y });
const A_SUB = (p, q) => A_PT(p.x - q.x, p.y - q.y);
const A_DOT = (p, q) => p.x * q.x + p.y * q.y;
const A_DIST = (p, q) => Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
const A_OK = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);

/* GeoSDoub.Intersect(DoubLine, DoubLine) — the four-point determinant form. */
function aIntersect(a, b, c, d) {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const den = a1 * b2 - a2 * b1;
  if (Math.abs(den) < 1) return A_PT(NaN, NaN);
  return A_PT((b1 * c2 - b2 * c1) / den, (a2 * c1 - a1 * c2) / den);
}

/* GeoSDoub.NearestPoint(DoubPoint, DoubLine): includes the 0.1 short cut. */
function aNearest(p, a, b) {
  if ((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y) < 0.1) return A_PT(a.x, a.y);
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return A_PT(a.x + t * dx, a.y + t * dy);
}

/* GeoSDoub.FindCircumcenter + GetCircle's mean of three distances. */
function aGetCircle(p1, p2, p3) {
  const m1 = A_PT((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  const m2 = A_PT((p2.x + p3.x) / 2, (p2.y + p3.y) / 2);
  const q1 = A_PT(m1.x + (p2.y - p1.y), m1.y - (p2.x - p1.x));
  const q2 = A_PT(m2.x + (p3.y - p2.y), m2.y - (p3.x - p2.x));
  const o = aIntersect(m1, q1, m2, q2);
  if (!A_OK(o)) return null;
  return { c: o, r: (A_DIST(o, p1) + A_DIST(o, p2) + A_DIST(o, p3)) / 3 };
}

/* FourIncidentCirclesCanvas.GetCommonTangent(DoubCircle, DoubCircle). */
function aCommonTangent(c1, c2, R, common) {
  const d = A_DIST(c1.c, c2.c);
  if (d < 1) return null;
  const t = R / d;
  const vx = (c1.c.y - c2.c.y) * t;
  const vy = (c2.c.x - c1.c.x) * t;
  const L11 = [A_PT(c1.c.x + vx, c1.c.y + vy), A_PT(c2.c.x + vx, c2.c.y + vy)];
  const L12 = [A_PT(c1.c.x - vx, c1.c.y - vy), A_PT(c2.c.x - vx, c2.c.y - vy)];
  const p13 = aNearest(common, L11[0], L11[1]);
  const p14 = aNearest(common, L12[0], L12[1]);
  return A_DIST(common, p13) >= A_DIST(common, p14) ? L11 : L12;
}

/* GetTangents + DrawOuterCircle + the B names drawn by Draw. */
function aPicture(centers, R, common) {
  const circles = centers.map((c) => ({ c, r: R }));
  const T = [];
  for (let i = 0; i < 4; i++) T.push(aCommonTangent(circles[i], circles[(i + 1) % 4], R, common));
  if (T.some((t) => !t)) return { T, B: [], outer: null };
  const at = (i) => aIntersect(T[i][0], T[i][1], T[(i + 1) % 4][0], T[(i + 1) % 4][1]);
  const b2 = at(0), b3 = at(1), b4 = at(2), b1 = at(3);
  const B = [b1, b2, b3, b4];
  if (!B.every(A_OK)) return { T, B, outer: null };
  return { T, B, outer: aGetCircle(b2, b3, b4) };
}

/* FourIncidentCirclesCanvas.Reset, with the page's WIDTH=560 HEIGHT=500. */
function aReset() {
  const W = 560, H = 500;
  const R = Math.floor(Math.min(W, H) / 6);
  const common = A_PT(Math.floor(W / 2), Math.floor(H / 2));
  const angles = [0.5235987755982988, 2.6179938779914944, 3.765191430678208, 5.235987755982989];
  return {
    common, R,
    A: angles.map((a) => A_PT(common.x + R * Math.cos(a), common.y + R * Math.sin(a))),
  };
}

/* UpgradePoint + UpgradePoints, after the mover has placed A[index] at q. */
function aUpgrade(old, index, q) {
  const d = A_DIST(old.common, q);
  const A = old.A.slice();
  A[index] = A_PT(q.x, q.y);
  for (let j = 0; j < 4; j++) {
    if (j === index) continue;
    const dist = A_DIST(old.common, A[j]);
    A[j] = A_PT(old.common.x + (A[j].x - old.common.x) * d / dist,
                old.common.y + (A[j].y - old.common.y) * d / dist);
  }
  return { common: old.common, R: d, A };
}

function aAngle(v, p, q) {
  const a = A_SUB(p, v), b = A_SUB(q, v);
  const n = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  return n ? Math.acos(Math.max(-1, Math.min(1, A_DOT(a, b) / n))) : 0;
}

/* The page's "opposite angles add to 180°" is about corners in circular
 * order, which is not always the label order after a drag. */
function cyclicAngleSum(B, center) {
  const sorted = B.slice().sort((p, q) =>
    Math.atan2(p.y - center.y, p.x - center.x) - Math.atan2(q.y - center.y, q.x - center.x));
  return aAngle(sorted[0], sorted[3], sorted[1]) + aAngle(sorted[2], sorted[1], sorted[3]);
}

/* ------------------------------------------------------------ 1. the start */

{
  const s = C.start({});
  const a = aReset();
  check("the page's canvas gives radius floor(500/6) = 83", C.RADIUS === 83 && a.R === 83);
  check("the common point is the middle of the 560x500 applet", ptClose(s.center, { x: 280, y: 250 }));
  equal("the core's four starting centres match Reset", s.A, a.A);
  check("each starting centre is one radius from the common point",
    s.A.every((p) => close(A_DIST(p, s.center), 83, 1e-10)));
  check("all four starting circles pass through the common point",
    C.geometry(s).circles.every((c) => close(A_DIST(c.c, s.center), c.r, 1e-10)));
  check("no checkbox is ticked by default, as on the applet page",
    !s.options.hint && !s.options.names);
  check("the picture is not a game", C.result(s) === null);
}

/* ---------------------------------------------- 2. the claim at the start */

{
  const g = C.geometry(C.start({}));
  const a = aPicture(aReset().A, 83, aReset().common);
  check("all four tangents exist at the start", g.tangents.every(Boolean) && a.T.every(Boolean));
  check("the four B corners are finite", g.vertices.every(finite) && a.B.every(A_OK));
  check("the fourth corner lies on the circumcircle through the other three",
    g.cyclicError < 1e-8, `error ${g.cyclicError}`);
  check("the four corners make a cyclic quadrilateral at the start",
    close(cyclicAngleSum(a.B, a.outer.c), Math.PI, 1e-8));
  check("the opposite angles of the centre quadrilateral add to 180 degrees",
    close(cyclicAngleSum(aReset().A, aReset().common), Math.PI, 1e-8));
  check("each tangent is parallel to its chord of centres", g.parallelError < 1e-9);
}

/* --------------------------------------------------- 3. drags and options */

{
  const s = C.start({});
  const target = { x: 330, y: 160 };
  const moved = C.move(s, 2, target);
  const expected = aUpgrade(aReset(), 2, target);
  check("the dragged centre goes to the pointer", ptClose(moved.A[2], target));
  check("the other three centres are rescaled exactly as UpgradePoints does",
    moved.A.every((p, i) => ptClose(p, expected.A[i], 1e-8)));
  check("the radius becomes the dragged centre's distance from O",
    close(moved.radius, expected.R, 1e-10) && moved.radius === A_DIST(moved.center, moved.A[2]));
  check("every circle still has the new radius and passes through O",
    C.geometry(moved).circles.every((c) => close(c.r, moved.radius) && close(A_DIST(c.c, moved.center), moved.radius, 1e-8)));
  check("a drag does not change the state it was given", close(s.radius, 83) && ptClose(s.A[2], aReset().A[2]));
  check("an illegal drag is refused", C.move(s, 4, target) === s && C.move(s, 0, { x: NaN, y: 3 }) === s);
  check("dragging onto the common point is refused", C.move(s, 0, { x: 280, y: 250 }) === s);
  const ticked = C.setOption(C.setOption(s, "hint", true), "names", true);
  check("both checkboxes are independent and do not move the picture",
    ticked.options.hint && ticked.options.names
      && ticked.A.every((p, i) => ptClose(p, s.A[i])));
  check("an unknown option is ignored", C.setOption(s, "nonesuch", true) === s);
  check("Reset restores the applet's picture and keeps the options",
    ptClose(C.reset(ticked).A[0], aReset().A[0]) && C.reset(ticked).options.hint);
  check("a demonstration has no win and no loss", C.result(moved) === null && C.result(ticked) === null);
}

/* ------------------------ 4. the core against the applet's own method ---- */

{
  let cases = 0, maxPos = 0, maxGeo = 0, skipped = 0;
  for (let t = 0; t < 1200; t++) {
    let coreState = C.start({});
    let appletState = aReset();
    for (let step = 0; step < 4; step++) {
      const index = Math.floor(random() * 4);
      const q = { x: 20 + random() * 520, y: 20 + random() * 460 };
      coreState = C.move(coreState, index, q);
      appletState = aUpgrade(appletState, index, q);
    }
    const g = C.geometry(coreState);
    const a = aPicture(appletState.A, appletState.R, appletState.common);
    if (!a.outer || !g.outer || a.B.length !== 4) { skipped++; continue; }
    cases++;
    for (let i = 0; i < 4; i++) {
      maxPos = Math.max(maxPos, A_DIST(coreState.A[i], appletState.A[i]));
      for (const [p, q] of [[g.tangents[i][0], a.T[i][0]], [g.tangents[i][1], a.T[i][1]],
                            [g.vertices[i], a.B[i]]]) {
        maxGeo = Math.max(maxGeo, A_DIST(p, q));
      }
    }
    maxPos = Math.max(maxPos, Math.abs(coreState.radius - appletState.R));
    maxGeo = Math.max(maxGeo, A_DIST(g.outer.center, a.outer.c), Math.abs(g.outer.radius - a.outer.r));
  }
  check("1200 random four-drag sequences were compared with the bytecode", cases > 1100, `${cases} usable, ${skipped} degenerate`);
  check("the core's centres and radius match UpgradePoints", maxPos < 1e-8, `max ${maxPos}`);
  check("the core's tangents, B corners and outer circle match GetTangents and DrawOuterCircle",
    maxGeo < 1e-6, `max ${maxGeo}`);
}

/* ------------------------------------------- 5. the page's claim, checked */

{
  let cases = 0, skipped = 0, maxCyclic = 0, maxAngleSum = 0, maxParallel = 0;
  /* Four explicit pictures: the start, a square, an uneven convex one and a
   * configuration whose labels go around the circle in a different order. */
  const explicit = [
    [30, 150, 215.729578, 300],
    [0, 90, 180, 270],
    [10, 100, 230, 310],
    [0, 200, 80, 290],
  ];
  const configs = explicit.slice();
  for (let t = 0; t < 4000; t++) {
    configs.push(Array.from({ length: 4 }, () => random() * 360));
  }
  for (const deg of configs) {
    const common = A_PT(280, 250);
    const centers = deg.map((d) => {
      const a = d * Math.PI / 180;
      return A_PT(common.x + 83 * Math.cos(a), common.y + 83 * Math.sin(a));
    });
    const a = aPicture(centers, 83, common);
    if (!a.outer || a.B.length !== 4) { skipped++; continue; }
    /* The applet's own Intersect returns NaN when two tangents are parallel. */
    if (!a.B.every(A_OK)) { skipped++; continue; }
    cases++;
    const err = a.B.map((b) => Math.abs(A_DIST(a.outer.c, b) - a.outer.r));
    maxCyclic = Math.max(maxCyclic, ...err);
    maxAngleSum = Math.max(maxAngleSum, Math.abs(cyclicAngleSum(a.B, a.outer.c) - Math.PI));
    for (let i = 0; i < 4; i++) {
      const side = A_SUB(centers[(i + 1) % 4], centers[i]);
      const along = A_SUB(a.T[i][1], a.T[i][0]);
      const den = Math.hypot(side.x, side.y) * Math.hypot(along.x, along.y);
      if (den) maxParallel = Math.max(maxParallel,
        Math.abs(side.x * along.y - side.y * along.x) / den);
    }
  }
  check("the claim was tested on thousands of non-degenerate configurations", cases > 3900, `${cases} tested, ${skipped} degenerate`);
  check("all four corners are concyclic in every tested configuration: the page's claim holds",
    maxCyclic < 1e-5, `worst radius error ${maxCyclic}`);
  check("opposite angles add to 180 degrees when corners are taken in circular order",
    maxAngleSum < 1e-7, `worst ${maxAngleSum * 180 / Math.PI} degrees`);
  check("every tangent is parallel to its chord of centres", maxParallel < 1e-9, `worst ${maxParallel}`);
  check("the core agrees with the claim on a configuration with crossed labels",
    (() => {
      const deg = explicit[3];
      const s = C.start({});
      const moved = deg.reduce((state, angle, i) => C.move(state, i, {
        x: 280 + 83 * Math.cos(angle * Math.PI / 180),
        y: 250 + 83 * Math.sin(angle * Math.PI / 180),
      }), s);
      const g = C.geometry(moved);
      return !g.degenerate && g.cyclicError < 1e-5;
    })());
}

/* ----------------------------------------------- 6. degenerate pictures */

{
  const s = C.start({});
  /* Put centre A next to C's starting angle 215.729578 degrees. */
  const almost = C.move(s, 1, { x: 280 + 83 * Math.cos(215.731 * Math.PI / 180),
                                y: 250 + 83 * Math.sin(215.731 * Math.PI / 180) });
  const g = C.geometry(almost);
  check("a tangent disappears when two centres come within one unit", g.degenerate && !g.tangents[1]);
  check("the status explains the degenerate picture", /too close/.test(C.describe(almost)));
  check("a normal picture has a claim in its status", /one circle/.test(C.describe(s)));
  const hinted = C.setOption(s, "hint", true);
  check("the hint reports the common radius", /83\.0 units/.test(C.describe(hinted)));
}

done("four-incident-circles");
