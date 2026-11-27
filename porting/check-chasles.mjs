#!/usr/bin/env node
"use strict";

/*
 * Logic test for chasles/chasles-core.js.
 *
 *   node porting/check-chasles.mjs
 *
 * Checked: the starting ellipse and its six points against ChaslesCanvas.init;
 * the corner drag (CTKEllipse.MaintainRect) and point drag (KeepOnEllipse);
 * then, over 500 configurations obtained by dragging corners and points,
 * R = S (Pascal) and the exact cross-ratio chain printed on the applet's page:
 *
 *   (LQRM) = F(LAEM) = D(LAEM) = (LTPM) = A(LDBM) = C(LDBM) = (LQSM).
 *
 * The last group is a second, literal transcription of the applet's own
 * GeoSDoub.Intersect and CTKEllipse.Intersect (scale by 1000 to a circle,
 * cut the circle by GeoSDoub.IntersectX/IntersectY, scale back) followed by
 * ChaslesCanvas.Compute itself. It is compared with the core's closed-form
 * cut and construction over every configuration, not just a few samples.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("chasles/chasles-core.js", "ChaslesCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => finite(p) && finite(q) &&
  Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const wrap = (t) => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

/* ---------------------- the applet's own methods, transcribed from bytecode */

/* GeoSDoub.Intersect(DoubLine, DoubLine), i.e. lines P1P2 and P3P4. */
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.IntersectY(DoubLine, DoubCircle), with the circle at the origin. */
function circleCutByY(p1, p2, r) {
  const m = (p1.y - p2.y) / (p1.x - p2.x);
  const b = p2.y - m * p2.x;
  const A = m * m + 1;
  const B = m * b;
  const Cc = b * b - r * r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const x1 = (-B + s) / A, x2 = (-B - s) / A;
  return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
}

/* GeoSDoub.IntersectX(DoubLine, DoubCircle), with the circle at the origin. */
function circleCutByX(p1, p2, r) {
  const m = (p1.x - p2.x) / (p1.y - p2.y);
  const b = p2.x - m * p2.y;
  const A = m * m + 1;
  const B = m * b;
  const Cc = b * b - r * r;
  const disc = B * B - A * Cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const y1 = (-B + s) / A, y2 = (-B - s) / A;
  return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
}

/* CTKEllipse.Intersect(a, b, c): intercepts in a circle of radius 1000. */
function appletConicIntersect(el, a, b, c) {
  const k = a * el.cx + b * el.cy + c;
  const aa = a * el.a, bb = b * el.b;
  const R = 1000;
  const p1 = { x: 0, y: (-k / bb) * R };
  const p2 = { x: (-k / aa) * R, y: 0 };
  let sol = null;
  if (Math.abs(p1.y - p2.y) > 1) sol = circleCutByX(p1, p2, R);
  else if (Math.abs(p1.x - p2.x) > 1) sol = circleCutByY(p1, p2, R);
  if (!sol) return null;
  return sol.map((q) => ({ x: (q.x * el.a) / R + el.cx, y: (q.y * el.b) / R + el.cy }));
}

/* ChaslesCanvas.Compute. */
function appletCompute(s) {
  const p = s.points;
  const P = appletIntersect(p.A, p.B, p.D, p.E);
  const Q = appletIntersect(p.F, p.A, p.C, p.D);
  const out = { P, Q, R: null, S: null, T: null, L: null, M: null };
  if (!finite(P) || !finite(Q) || dist(P, Q) <= 0.1) return out;
  const a = Q.y - P.y;
  const dx = Q.x - P.x;
  const b = -dx;
  const c = P.y * dx - P.x * a;
  out.R = appletIntersect(p.E, p.F, P, Q);
  out.S = appletIntersect(p.B, p.C, P, Q);
  out.T = appletIntersect(p.A, p.D, P, Q);
  const roots = appletConicIntersect(s.ellipse, a, b, c);
  if (roots && roots.length) {
    const t = finite(out.T) ? out.T : P;
    if (roots.length === 1 || dist(roots[0], t) < dist(roots[1], t)) {
      out.L = roots[0];
      out.M = roots[1] || null;
    } else {
      out.L = roots[1];
      out.M = roots[0];
    }
  }
  return out;
}

/* ------------------------------------------------ 1. the starting diagram */

{
  const s = C.start();
  equal("start centre is width/2, height/2", [s.ellipse.cx, s.ellipse.cy], [200, 150]);
  check("start semi-axes are width/3, height/3",
    close(s.ellipse.a, 400 / 3, 1e-12) && close(s.ellipse.b, 100, 1e-12));
  check("start corners match ChaslesCanvas.init's V0..V3",
    closePoint(s.corners[0], { x: 200 - 400 / 3, y: 250 }, 1e-9) &&
    closePoint(s.corners[1], { x: 200 + 400 / 3, y: 250 }, 1e-9) &&
    closePoint(s.corners[2], { x: 200 + 400 / 3, y: 50 }, 1e-9) &&
    closePoint(s.corners[3], { x: 200 - 400 / 3, y: 50 }, 1e-9));
  check("start points match EllipseAt(-3pi/4, pi/2, -pi/6, 3pi/4, -pi/2, pi/3)",
    ["A", "B", "C", "D", "E", "F"].every((nm, i) =>
      closePoint(s.points[nm], C.ellipseAt(s.ellipse, [
        -2.356194490192345, 1.5707963267948966, -0.5235987755982988,
        2.356194490192345, -1.5707963267948966, 1.0471975511965976][i]), 1e-9)));
  check("every start point lies on the start ellipse",
    ["A", "B", "C", "D", "E", "F"].every((nm) => {
      const q = s.points[nm];
      return close(Math.hypot((q.x - s.ellipse.cx) / s.ellipse.a,
        (q.y - s.ellipse.cy) / s.ellipse.b), 1, 1e-12);
    }));
  check("Show names is off by default, as in the applet", s.showNames === false);
  check("an illustration has no result", C.result(s) === null);
  check("an unknown corner is refused", C.withCorner(s, 9, { x: 50, y: 250 }) === s);
  check("a corner on the centre cross is refused",
    C.withCorner(s, 0, { x: 200, y: 250 }) === s &&
    C.withCorner(s, 0, { x: 90, y: 150 }) === s);
  check("Show names toggles without touching the geometry",
    C.withNames(s, true).showNames === true &&
    C.withNames(s, false).points.A.x === s.points.A.x);
  check("withPoint refuses an unknown name", C.withPoint(s, "Z", s.points.A) === s);
}

/* ------------------------------------- 2. the drag rules, on fixed examples */

{
  const s = C.start();
  const p = { x: 95, y: 260 };
  const moved = C.withCorner(s, 0, p);
  check("a corner drag keeps the selected corner at the pointer",
    closePoint(moved.corners[0], p, 1e-9));
  check("MaintainRect mirrors the other three corners and keeps the centre",
    closePoint(moved.corners[1], { x: 305, y: 260 }, 1e-9) &&
    closePoint(moved.corners[2], { x: 305, y: 40 }, 1e-9) &&
    closePoint(moved.corners[3], { x: 95, y: 40 }, 1e-9) &&
    moved.ellipse.cx === 200 && moved.ellipse.cy === 150);
  check("resizing keeps the six points on the new ellipse",
    ["A", "B", "C", "D", "E", "F"].every((nm) => {
      const q = moved.points[nm];
      return close(Math.hypot((q.x - moved.ellipse.cx) / moved.ellipse.a,
        (q.y - moved.ellipse.cy) / moved.ellipse.b), 1, 1e-12);
    }));
  check("a corner drag leaves the old position unchanged",
    closePoint(s.corners[0], { x: 400 / 6, y: 250 }, 1e-9));
  const along = C.withPoint(s, "B", { x: 300, y: 200 });
  check("KeepOnEllipse projects a dragged point back onto the ellipse",
    close(Math.hypot((along.points.B.x - 200) / s.ellipse.a,
      (along.points.B.y - 150) / s.ellipse.b), 1, 1e-12) &&
    along.points.B.x > 200 && along.points.B.y > 150);
  check("a point drag leaves the other points alone",
    closePoint(along.points.A, s.points.A, 0) && closePoint(along.points.D, s.points.D, 0));
  const cl = C.claims(s);
  check("the starting diagram satisfies every claim on the page", cl.all, JSON.stringify(cl));
}

/* ----------------------- 3. claims over many concrete configurations */

/** Corner thumbs stay in their quadrant and away from the central cross. */
function cornerMove(rand, i, s) {
  const cx = s.ellipse.cx, cy = s.ellipse.cy;
  const lowX = 15 + rand() * Math.max(1, cx - 30);
  const highX = cx + 15 + rand() * Math.max(1, 400 - cx - 30);
  const lowY = 15 + rand() * Math.max(1, cy - 30);
  const highY = cy + 15 + rand() * Math.max(1, 300 - cy - 30);
  const p = [
    { x: lowX, y: highY }, { x: highX, y: highY },
    { x: highX, y: lowY }, { x: lowX, y: lowY },
  ][i];
  return C.withCorner(s, i, p);
}

/* The six conic points need to stay distinct for the pencils to be defined. */
function spacedAngles(rand, old) {
  const out = old.slice();
  for (let i = 0; i < out.length; i++) {
    for (let tries = 0; tries < 200; tries++) {
      const t = rand() * 2 * Math.PI;
      if (out.every((u, j) => j === i ||
        Math.min(wrap(u - t), wrap(t - u)) > 0.12)) { out[i] = t; break; }
    }
  }
  return out;
}

function makeConfigs(seed, count) {
  const rand = rng(seed);
  const configs = [];
  for (let k = 0; k < count; k++) {
    let s = C.start();
    const corners = 1 + Math.floor(rand() * 3);
    for (let j = 0; j < corners; j++) s = cornerMove(rand, Math.floor(rand() * 4), s);
    const angles = spacedAngles(rand, [-2.356194490192345, 1.5707963267948966,
      -0.5235987755982988, 2.356194490192345, -1.5707963267948966, 1.0471975511965976]);
    for (const [i, nm] of C.NAMES.entries()) {
      s = C.withPoint(s, nm, C.ellipseAt(s.ellipse, angles[i]));
    }
    if (C.claims(s).regular) configs.push(s);
  }
  return configs;
}

const configs = makeConfigs(3122, 500);
check(`500 random drags give ${configs.length} non-degenerate configurations`, configs.length > 350);

{
  let pascal = 0, chaslesF = 0, chaslesA = 0, chain = 0;
  let worstPoint = 0, worstRatio = 0;
  for (const s of configs) {
    const g = C.compute(s);
    const cl = C.claims(s);
    if (cl.pascal) pascal++;
    if (cl.chaslesF) chaslesF++;
    if (cl.chaslesA) chaslesA++;
    if (cl.chain) chain++;
    worstPoint = Math.max(worstPoint, dist(g.R, g.S));
    const f = C.crossRatioPencil(s.points.F, g.L, s.points.A, s.points.E, g.M);
    const d = C.crossRatioPencil(s.points.D, g.L, s.points.A, s.points.E, g.M);
    worstRatio = Math.max(worstRatio, Math.abs(f - d) /
      Math.max(1, Math.abs(f), Math.abs(d)));
  }
  check("R = S at every configuration", pascal === configs.length,
    `${pascal}/${configs.length}, worst gap ${worstPoint}`);
  check("F(LAEM) = D(LAEM) at every configuration (Chasles)", chaslesF === configs.length,
    `${chaslesF}/${configs.length}, worst relative gap ${worstRatio}`);
  check("A(LDBM) = C(LDBM) at every configuration (Chasles)", chaslesA === configs.length,
    `${chaslesA}/${configs.length}`);
  check("the whole cross-ratio chain holds at every configuration", chain === configs.length,
    `${chain}/${configs.length}`);
  check("all claims pass together at every configuration",
    configs.every((s) => C.claims(s).all));
}

/* ----------------- 4. the core against the applet's own computation */

{
  let compared = 0, badPoint = 0, badCut = 0;
  let worst = 0;
  for (const s of configs) {
    const core = C.compute(s);
    const applet = appletCompute(s);
    const scale = Math.max(s.ellipse.a, s.ellipse.b);
    const tol = 1e-7 * scale;
    for (const nm of ["P", "Q", "R", "S", "T"]) {
      if (!closePoint(core[nm], applet[nm], tol)) badPoint++;
      if (finite(applet[nm])) {
        worst = Math.max(worst, dist(core[nm], applet[nm]) /
          Math.max(1, Math.abs(applet[nm].x), Math.abs(applet[nm].y)));
      }
    }
    for (const nm of ["L", "M"]) {
      if (!closePoint(core[nm], applet[nm], tol)) badCut++;
    }
    compared++;
  }
  check(`the core matches ChaslesCanvas.Compute on all ${compared} configurations`,
    badPoint === 0, `${badPoint} point mismatches, worst relative ${worst}`);
  check("the core's closed-form conic cut matches CTKEllipse.Intersect",
    badCut === 0, `${badCut} cut mismatches`);
  const first = appletCompute(C.start());
  check("the applet transcription itself sees R = S at the start",
    dist(first.R, first.S) < 1e-6);
  check("the applet transcription itself sees L and M on the ellipse",
    [first.L, first.M].every((q) => close(
      Math.hypot((q.x - 200) / (400 / 3), (q.y - 150) / 100), 1, 1e-8)));
}

done("chasles");
