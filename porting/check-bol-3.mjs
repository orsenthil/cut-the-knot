#!/usr/bin/env node
"use strict";

/*
 * Logic test for bol-3/bol-3-core.js.
 *
 *   node porting/check-bol-3.mjs
 *
 * Checked: the starting diagram against the applet's init(); its projection,
 * reflection and GetQ against a second, literal transcription of
 * GeoSDoub.NearestPoint / BOL3Canvas.Extend / GeoSDoub.IntersectCircles
 * (both the X and the Y branch, exactly as the bytecode chooses them) on every
 * half-degree position of P; and the proposition's four equalities plus the
 * two construction equalities on all of those positions and on rotated,
 * resized and translated copies of the figure.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bol-3/bol-3-core.js", "Bol3Core");

const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol));
const copy = (p) => ({ x: p.x, y: p.y });

/* ---------------------- the applet's own computation, transcribed from bytecode */

/* GeoSDoub.SqDist / Dist. */
function appletSqDist(p, q) {
  return (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
}
const appletDist = (p, q) => Math.sqrt(appletSqDist(p, q));

/* GeoSDoub.NearestPoint(P, A, B): foot on the infinite line, applet guard 0.1. */
function appletFoot(P, A, B) {
  const dx = B.x - A.x, dy = B.y - A.y;
  if (appletSqDist(A, B) < 0.1) return copy(P);
  const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / (dx * dx + dy * dy);
  return { x: A.x + dx * t, y: A.y + dy * t };
}

/* BOL3Canvas.Extend(A, N) = 2N - A. */
function appletExtend(A, N) {
  return { x: 2 * N.x - A.x, y: 2 * N.y - A.y };
}

/* GeoSDoub.IntersectCirclesX: x = s2*y + s4, then the quadratic in y. */
function appletIntersectX(c1, c2) {
  const s2 = -(c1.y - c2.y) / (c1.x - c2.x);
  const s4 = (
    c1.x * c1.x - c2.x * c2.x + c1.y * c1.y - c2.y * c2.y -
    c1.r * c1.r + c2.r * c2.r
  ) / (2 * (c1.x - c2.x));
  const s6 = s4 - c1.x;
  const s8 = s2 * s2 + 1;
  const s10 = s2 * s6 - c1.y;
  const s12 = s6 * s6 + c1.y * c1.y - c1.r * c1.r;
  const disc = s10 * s10 - s8 * s12;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y1 = (-s10 + root) / s8, y2 = (-s10 - root) / s8;
  return [{ x: s2 * y1 + s4, y: y1 }, { x: s2 * y2 + s4, y: y2 }];
}

/* GeoSDoub.IntersectCirclesY is the same with x and y exchanged. */
function appletIntersectY(c1, c2) {
  const swap = (c) => ({ x: c.y, y: c.x, r: c.r });
  const pts = appletIntersectX(swap(c1), swap(c2));
  return pts && pts.map((p) => ({ x: p.y, y: p.x }));
}

/* GeoSDoub.Intersect(circle, circle): X unless dx <= 1, then Y. */
function appletIntersectCircles(c1, c2) {
  if (Math.abs(c1.x - c2.x) > 1) return appletIntersectX(c1, c2);
  if (Math.abs(c1.y - c2.y) > 1) return appletIntersectY(c1, c2);
  return [null, null]; // the applet's own fallback for two null points
}

/* BOL3Canvas.Other(points, A): take the point that is not A. */
function appletOther(points, A) {
  if (!points) return null;
  return appletDist(points[0], A) < 0.1 ? points[1] : points[0];
}

/* BOL3Canvas.GetQ(): circle(P, PA) meets the big circle; keep the other point. */
function appletGetQ(P, A, O, R) {
  return appletOther(appletIntersectCircles({ x: P.x, y: P.y, r: appletDist(P, A) },
    { x: O.x, y: O.y, r: R }), A);
}

/* ---------------------------------------------- 1. the start and the rules */

{
  const s = C.start();
  equal("start A matches init() on a 400x300 canvas", s.A, { x: 50, y: 225 });
  equal("start B matches init() on a 400x300 canvas", s.B, { x: 350, y: 225 });
  check("P starts at O - R*(cos45, sin45)", closePoint(s.P,
    { x: 200 - 150 * Math.cos(Math.PI / 4), y: 225 - 150 * Math.sin(Math.PI / 4) }, 1e-9));
  equal("start O is the midpoint of AB", C.circle(s).c, { x: 200, y: 225 });
  check("start R is half of AB", C.circle(s).r === 150);
  check("an illustration cannot be won or lost", C.result(s) === null);
  check("the starting P lies on the circle",
    close(C.dist(s.P, C.circle(s).c), C.circle(s).r, 1e-9));
  const other = C.start({ width: 600, height: 400 });
  equal("a 600x400 canvas places A as init() does", other.A, { x: 75, y: 300 });
  equal("a 600x400 canvas places B as init() does", other.B, { x: 525, y: 300 });
  check("withP leaves the old position alone", (() => {
    const next = C.withP(s, { x: 200, y: 75 });
    return s.P.x === C.start().P.x && closePoint(next.P, { x: 200, y: 75 }, 1e-9);
  })());
}

/* ------------------------ 2. every half-degree position: applet vs the core */

{
  const base = C.start();
  let compared = 0, skipped = 0;
  for (let deg = 0; deg < 720; deg++) {
    const a = (deg * Math.PI) / 360; // half-degree steps all the way round
    // At A and B the two circles are tangent; the applet's own intersection
    // degenerates there, so those two positions are exercised below instead.
    if (Math.abs(Math.sin(a)) < 0.02) { skipped++; continue; }
    const s = C.withP(base, {
      x: base.A.x + 150 + 150 * Math.cos(a),
      y: base.A.y + 150 * Math.sin(a),
    });
    const m = C.measure(s);
    const tol = 2e-5 * m.AB;
    const appletN = appletFoot(s.P, s.A, s.B);
    const appletD = appletExtend(s.A, appletN);
    const { c, r } = C.circle(s);
    const appletQ = appletGetQ(s.P, s.A, c, r);
    if (!closePoint(appletN, m.N, tol)) {
      check(`deg ${deg / 2}: foot matches the applet`, false,
        `applet ${JSON.stringify(appletN)}, core ${JSON.stringify(m.N)}`);
    }
    if (!closePoint(appletD, m.D, tol)) {
      check(`deg ${deg / 2}: D matches the applet's Extend`, false,
        `applet ${JSON.stringify(appletD)}, core ${JSON.stringify(m.D)}`);
    }
    if (!closePoint(appletQ, m.Q, tol)) {
      check(`deg ${deg / 2}: Q matches the applet's GetQ`, false,
        `applet ${JSON.stringify(appletQ)}, core ${JSON.stringify(m.Q)}`);
    }
    compared++;
  }
  check(`foot, D and Q agree with the applet at ${compared} positions`, compared >= 690);
  check(`the tangent endpoints were set aside as the applet degenerates there`, skipped >= 4);
}

/* ------------------------------- 3. the proposition on all those positions */

{
  const base = C.start();
  let tested = 0;
  for (let deg = 0; deg < 720; deg++) {
    const a = (deg * Math.PI) / 360;
    const s = C.withP(base, {
      x: base.A.x + 150 + 150 * Math.cos(a),
      y: base.A.y + 150 * Math.sin(a),
    });
    const cl = C.claims(s);
    if (!Object.values(cl).every(Boolean)) {
      check(`deg ${deg / 2}: every claim holds`, false, JSON.stringify(cl));
    }
    tested++;
  }
  const m = C.measure(base);
  check(`BQ = BD at the start (${m.BQ.toFixed(6)})`, close(m.BQ, m.BD, 1e-9));
  check(`PA = PQ at the start (${m.PA.toFixed(6)})`, close(m.PA, m.PQ, 1e-9));
  check("all six claims hold at all 720 positions", tested === 720);
}

/* ----------------- 4. translated, resized and rotated copies of the figure */

{
  const rand = rng(2702);
  let tested = 0;
  for (let trial = 0; trial < 400; trial++) {
    const cx = -500 + rand() * 1000, cy = -500 + rand() * 1000;
    const r = 10 + rand() * 490;
    const tilt = (rand() - 0.5) * 6;
    const u = { x: Math.cos(tilt), y: Math.sin(tilt) };
    const v = { x: -Math.sin(tilt), y: Math.cos(tilt) };
    const along = (t, h) => ({ x: cx + t * u.x + h * v.x, y: cy + t * u.y + h * v.y });
    const angle = rand() * 2 * Math.PI;
    const s = {
      A: along(-r, 0),
      B: along(r, 0),
      P: along(r * Math.cos(angle), r * Math.sin(angle)),
    };
    const cl = C.claims(s);
    if (!Object.values(cl).every(Boolean)) {
      check(`random figure ${trial}: every claim holds`, false, JSON.stringify(cl));
    }
    tested++;
  }
  check(`all claims hold on ${tested} tilted and translated circles`, tested === 400);
}

/* ------------------------------------------------ 5. edge cases and guards */

{
  const s = C.start();
  const atA = C.withP(s, s.A);
  const mA = C.measure(atA);
  check("P at A: Q is A", closePoint(mA.Q, s.A, 1e-9));
  check("P at A: BQ = BD still holds", close(mA.BQ, mA.BD, 1e-8));
  const atB = C.withP(s, s.B);
  const mB = C.measure(atB);
  check("P at B: BQ = BD still holds", close(mB.BQ, mB.BD, 1e-8));
  const tiny = { A: { x: 10, y: 10 }, B: { x: 10.05, y: 10 }, P: { x: 12, y: 14 } };
  check("the applet's tiny-AB guard returns P itself", closePoint(C.foot(tiny), tiny.P, 1e-12),
    `foot ${JSON.stringify(C.foot(tiny))}`);
  check("snapping the centre chooses the top of the circle", closePoint(
    C.onCircle(s, C.circle(s).c), { x: 200, y: 75 }, 1e-9));
  check("reflecting Q back in OP returns A", closePoint(
    C.reflectInOP(s, C.measure(s).Q), s.A, 1e-9));
}

done("bol-3");
