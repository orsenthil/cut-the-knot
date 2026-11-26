#!/usr/bin/env node
"use strict";

/*
 * Logic test for asia-pacific-kite/asia-pacific-kite-core.js.
 *
 *   node porting/check-asia-pacific-kite.mjs
 *
 * Checked:
 *  1. The start position is AsiaPacificKiteCanvas.init transcribed from its
 *     bytecode (including the one ComputeF call), for several canvas sizes.
 *  2. The kite stays a rhombus with a 60-degree angle at B when any of its four
 *     corners is dragged, over a grid of targets; nothing mutates its input.
 *  3. Every claim in the discussion: all four sides equal, angle ABC = 60,
 *     M on the circumcircle of ABC, the whole circle is swept (and the lower
 *     arc in the page's exterior configuration), angle AMC = 120 outside ABC
 *     and 60 above AC, N on EF, and CA^2 = CM*CE = AM*AF, checked densely over
 *     the full continuous range of the line through D, for many kite sizes.
 *     A second, independent analytic parametrisation of M checks the core's
 *     line intersections rather than just its own claims function.
 *  4. A second literal transcription of the applet's GeoSDoub.Intersect,
 *     FindCircumcenter, GetCircle, IntersectCirclesX/Y, Other,
 *     DoubLine.CreateMidPoint and UpdateMidPoint, compared with the core on
 *     the whole grid of sizes and line positions.
 *  5. Edge cases: a flat kite, an unknown handle, bad input, the near-parallel
 *     line and the null result of an illustration.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("asia-pacific-kite/asia-pacific-kite-core.js", "AsiaPacificKiteCore");

const SQRT3 = Math.sqrt(3);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => Boolean(p) && Boolean(q) && close(p.x, q.x, tol) && close(p.y, q.y, tol);
/* check() records a result but returns nothing; require() also lets a loop
 * stop after the first broken case without hiding that it failed. */
function require(label, cond, detail) {
  check(label, cond, detail);
  return Boolean(cond);
}

/* exteriorArc is a property of one configuration, not a universal claim. */
const allClaims = (s) =>
  Object.entries(C.claims(s)).filter(([k]) => k !== "exteriorArc").every(([, v]) => v);

/* ------------------- 4 (part 1): the applet's own methods, from the bytecode */

function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  return Math.abs(det) < 1
    ? { x: NaN, y: NaN }
    : { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

function appletCircumcenter(P, Q, R) {
  const m1 = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  const m2 = { x: (Q.x + R.x) / 2, y: (Q.y + R.y) / 2 };
  const p1 = { x: m1.x + (Q.y - P.y), y: m1.y - (Q.x - P.x) };
  const p2 = { x: m2.x + (R.y - Q.y), y: m2.y - (R.x - Q.x) };
  return appletIntersect(m1, p1, m2, p2);
}

function appletGetCircle(P, Q, R) {
  const center = appletCircumcenter(P, Q, R);
  const r = (dist(center, P) + dist(center, Q) + dist(center, R)) / 3;
  return { x: center.x, y: center.y, r };
}

function appletIntersectCirclesX(A, B) {
  const m = -(A.y - B.y) / (A.x - B.x);
  const b = (A.x ** 2 - B.x ** 2 + A.y ** 2 - B.y ** 2 - A.r ** 2 + B.r ** 2) / 2 / (A.x - B.x);
  const h = b - A.x, a = m * m + 1;
  const k = m * h - A.y, c = h * h + A.y ** 2 - A.r ** 2;
  const disc = k * k - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const y1 = (-k + root) / a, y2 = (-k - root) / a;
  return [{ x: m * y1 + b, y: y1 }, { x: m * y2 + b, y: y2 }];
}

function appletIntersectCirclesY(A, B) {
  const m = -(A.x - B.x) / (A.y - B.y);
  const b = (A.y ** 2 - B.y ** 2 + A.x ** 2 - B.x ** 2 - A.r ** 2 + B.r ** 2) / 2 / (A.y - B.y);
  const h = b - A.y, a = m * m + 1;
  const k = m * h - A.x, c = h * h + A.x ** 2 - A.r ** 2;
  const disc = k * k - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const x1 = (-k + root) / a, x2 = (-k - root) / a;
  return [{ x: x1, y: m * x1 + b }, { x: x2, y: m * x2 + b }];
}

function appletCircleIntersections(A, B) {
  if (Math.abs(A.x - B.x) > 1) return appletIntersectCirclesX(A, B);
  if (Math.abs(A.y - B.y) > 1) return appletIntersectCirclesY(A, B);
  return [A];
}

function appletOther(points, M) {
  return dist(points[0], M) >= 1 ? points[0] : (points[1] || points[0]);
}

/* DoubLine.CreateMidPoint(t) = t*m1 + (1-t)*m2. */
const appletCreateMidPoint = (p, q, t) => C.pointOnLine(p, q, t);

/* DoubLine.UpdateMidPoint(m), with the line's m1 first and m2 second. */
function appletUpdateMidPoint(p, q, m) {
  const ux = p.x - q.x, uy = p.y - q.y;
  const den = ux * ux + uy * uy;
  return -(ux * (q.x - m.x) + uy * (q.y - m.y)) / den;
}

/* ------------------------------------------------ 1. the start, and the rules */

{
  const sizes = [[400, 300], [200, 150], [640, 480], [320, 180]];
  for (const [width, height] of sizes) {
    const s = C.start({ width, height });
    const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
    const half = Math.max(cx / 4, cy / 3) * SQRT3;
    const tol = 1e-9 * Math.max(width, height);
    check(`${width}x${height}: A is init's MoveablePoint`, closePoint(s.A, { x: cx - cx / 4, y: cy }, tol));
    check(`${width}x${height}: B is init's MoveablePoint`, closePoint(s.B, { x: cx, y: cy - half }, tol));
    check(`${width}x${height}: C is init's MoveablePoint`, closePoint(s.C, { x: cx + cx / 4, y: cy }, tol));
    check(`${width}x${height}: D is init's MoveablePoint`, closePoint(s.D, { x: cx, y: cy + half }, tol));
    check(`${width}x${height}: E is CreateMidPoint(AB, 1.8)`,
      closePoint(s.E, appletCreateMidPoint(s.A, s.B, 1.8), tol));
    check(`${width}x${height}: F is ComputeF's line intersection`,
      closePoint(s.F, appletIntersect(s.E, s.D, s.B, s.C), tol));
    check(`${width}x${height}: coefF comes from UpdateMidPoint`,
      close(s.coefF, appletUpdateMidPoint(s.B, s.C, s.F), tol));
    check(`${width}x${height}: the start is exterior and all claims hold`, C.isExterior(s) && allClaims(s));
    check(`${width}x${height}: an illustration has no result`, C.result(s) === null);
  }
  equal("default canvas is 400 by 300", [C.start().width, C.start().height], [400, 300]);
  const s = C.start();
  const before = JSON.stringify(s);
  C.withPoint(s, "A", { x: 20, y: 20 });
  C.withPoint(s, "E", { x: 20, y: 20 });
  check("withPoint never mutates the position", JSON.stringify(s) === before);
  check("an unknown handle changes nothing", C.withPoint(s, "Z", { x: 1, y: 2 }) === s);
  check("bad coordinates change nothing", C.withPoint(s, "A", { x: NaN, y: 3 }) === s);
}

/* ------------------------- 2. the kite under all four vertex drags */

{
  const rand = rng(2462);
  let drags = 0;
  for (const [width, height] of [[400, 300], [640, 480], [320, 180]]) {
    const base = C.start({ width, height });
    for (const name of ["A", "B", "C", "D"]) {
      for (let i = 0; i < 30; i++) {
        const p = { x: rand() * width, y: rand() * height };
        const s = C.withPoint(base, name, p);
        const sides = [dist(s.A, s.B), dist(s.B, s.C), dist(s.C, s.D), dist(s.D, s.A)];
        const tol = 1e-6 * Math.max(width, height);
        if (Math.min(...sides) < 1 || dist(s.A, s.C) < 0.05 * width ||
          dist(s.B, s.D) < 0.05 * height) continue;
        drags++;
        if (!require(`${name} drag ${i} on ${width}x${height} keeps a rhombus`,
          sides.every((d) => Math.abs(d - sides[0]) <= tol))) break;
        if (!require(`${name} drag ${i} keeps angle ABC = 60`,
          Math.abs(C.angleAt(s.B, s.A, s.C) - 60) <= 1e-8)) break;
        if (!require(`${name} drag ${i} keeps the diagonals perpendicular`,
          Math.abs(s.A.y - s.C.y) <= tol && Math.abs(s.B.x - s.D.x) <= tol)) break;
        if (!require(`${name} drag ${i} keeps the applet's claim set`, allClaims(s))) break;
      }
    }
  }
  check(`every kite drag was tested (${drags} positions)`, drags > 300);
}

/* ---- 3. the page's claims over the whole continuous range of the line l */

/* E = CreateMidPoint(AB, 1-s); s=0 at A, s=1 at B, s<0 past A. */
function withS(base, s) {
  const t = 1 - s;
  return C.computeF({ ...base, coefE: t, E: C.pointOnLine(base.A, base.B, t) });
}

/* Analytic M for a rhombus of half diagonal x, centred at (cx,cy), B above. */
function analyticM(s, cx, cy, halfAc, halfBd) {
  const d = s * s - s + 1;
  return { x: cx + (halfAc * (s * s - 1)) / d, y: cy - (halfBd * s) / d };
}

{
  /* 4:3 canvases, for which the applet's own start really has angle ABC=60.
   * On a square canvas its max(width/4, height/3) makes BD too long; that is a
   * faithful quirk of the applet, not the puzzle the page describes. */
  const sizes = [[400, 300], [640, 480], [320, 180], [800, 600]];
  const ss = [];
  /* The applet's own circumcircle code loses precision when E nears A or
   * recedes to infinity: outside 0.05 <= |s| <= 40 its Intersect returns NaN.
   * The whole usable option range is sampled densely here. */
  for (let i = 0; i <= 60; i++) {
    const v = i / 60;
    ss.push(-40 + 39.95 * v);         // -40 .. -0.05  (past A)
    ss.push(0.05 + 39.95 * v);        //  0.05 .. 40   (past B)
  }
  let tested = 0, exterior = 0, interior = 0;
  for (const [width, height] of sizes) {
    const base = C.start({ width, height });
    const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
    const halfAc = cx / 4, halfBd = Math.max(cx / 4, cy / 3) * SQRT3;
    for (const s of ss) {
      const st = withS(base, s);
      const g = C.geometry(st);
      const scale = Math.max(width, height);
      const tol = 1e-7 * scale * Math.max(1, Math.abs(s));
      if (!finitePoint(g.M) || !g.circleABC || !finitePoint(g.N)) {
        check(`s=${s.toFixed(3)} on ${width}x${height}: all objects exist`, false);
        break;
      }
      tested++;
      if (s < 0) exterior++; else interior++;
      if (!require(`s=${s.toFixed(3)}: rhombus, 60 degrees and all page claims`, allClaims(st))) break;
      if (!require(`s=${s.toFixed(3)}: exterior arc only in the exterior configuration`,
        C.claims(st).exteriorArc === (s < 0))) break;
      /* An independent formula, derived from the two line equations, not from
       * the core's intersection code. */
      if (!require(`s=${s.toFixed(3)}: M matches the analytic parametrisation`,
        closePoint(g.M, analyticM(s, cx, cy, halfAc, halfBd), tol))) break;
      const analyticCenter = { x: cx, y: cy - halfBd / 3 };
      const analyticRadius = (2 * halfAc) / SQRT3;
      if (!require(`s=${s.toFixed(3)}: circumcircle of ABC matches the equilateral formula`,
        closePoint(g.circleABC, analyticCenter, tol) &&
        close(g.circleABC.r, analyticRadius, tol))) break;
      const expectedAngle = s < 0 ? 120 : 60;
      if (!require(`s=${s.toFixed(3)}: angle AMC is ${expectedAngle} degrees`,
        Math.abs(C.angleAt(g.M, st.A, st.C) - expectedAngle) <= 1e-6)) break;
      /* The collinearity the applet's ComputeE/ComputeF impose. */
      if (!require(`s=${s.toFixed(3)}: (1-coefE)*coefF = 1`,
        close((1 - st.coefE) * st.coefF, 1, 1e-9))) break;
    }
  }
  check(`all claims hold at ${tested} line positions`, tested > 450);
  check(`both configurations were sampled (${exterior} exterior, ${interior} other)`,
    exterior > 200 && interior > 200);
}

function finitePoint(p) {
  return Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
}

/* ------------------------- the locus: the whole circle, and the lower arc */

{
  const base = C.start({ width: 400, height: 300 });
  const center = C.geometry(base).circleABC;
  const sector = new Set(), exteriorSector = new Set();
  const sectorOf = (p) => {
    let deg = (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return Math.floor(deg / 10) % 36;
  };
  const samples = [];
  for (let i = 0; i <= 400; i++) {
    const v = 10 ** (-4 + (8 * i) / 400);
    samples.push(-v, v);
  }
  for (const s of samples) {
    if (Math.abs(s) < 1e-4 || Math.abs(s) > 1e4) continue;
    const g = C.geometry(withS(base, s));
    if (!finitePoint(g.M)) continue;
    sector.add(sectorOf(g.M));
    if (s < 0) exteriorSector.add(sectorOf(g.M));
  }
  check(`M reaches every sector of the circumcircle (${sector.size}/36)`, sector.size === 36);
  check(`the exterior configuration covers the whole arc AC away from B (${exteriorSector.size}/12)`,
    exteriorSector.size === 12 && [...exteriorSector].every((k) => k >= 3 && k <= 14));
}

/* ----------- 4 (part 2): core versus the literal applet transcription */

{
  const rand = rng(913);
  const sizes = [[400, 300], [200, 150], [640, 480], [320, 180], [800, 600], [360, 240]];
  let compared = 0;
  for (const [width, height] of sizes) {
    const base = C.start({ width, height });
    const controls = [];
    for (let i = 0; i <= 40; i++) {
      const v = i / 40;
      controls.push(-40 + 39.95 * v, 0.05 + 39.95 * v);
    }
    for (let i = 0; i < 40; i++) {
      const v = 0.05 + rand() * 39.95;
      controls.push(-v, v);
    }
    for (const s of controls) {
      if (Math.abs(s) < 0.05 || Math.abs(s) > 40) continue;
      const st = withS(base, s);
      const M = appletIntersect(st.A, st.F, st.C, st.E);
      const cABC = appletGetCircle(st.A, st.B, st.C);
      const cAEM = appletGetCircle(st.A, st.E, M);
      const cCFM = appletGetCircle(st.C, st.F, M);
      const pts = appletCircleIntersections(cAEM, cCFM);
      if (!pts) continue;
      const N = appletOther(pts, M);
      const g = C.geometry(st);
      const tol = 1e-7 * Math.max(width, height) * Math.max(1, Math.abs(s));
      compared++;
      if (!require(`applet M matches core at s=${s.toFixed(2)}`, closePoint(M, g.M, tol))) break;
      if (!require(`applet circle ABC matches core at s=${s.toFixed(2)}`,
        closePoint(cABC, g.circleABC, tol) && close(cABC.r, g.circleABC.r, tol))) break;
      if (!require(`applet N matches core at s=${s.toFixed(2)}`, closePoint(N, g.N, tol))) break;
    }
  }
  check(`the applet's own construction agrees with the core on ${compared} positions`, compared > 600);

  /* Same comparison after dragging E and F with the mouse-like path. */
  let mouseCases = 0;
  for (const [width, height] of sizes) {
    const base = C.start({ width, height });
    for (let i = 0; i < 40; i++) {
      const target = { x: rand() * width, y: rand() * height };
      for (const name of ["E", "F"]) {
        const st = C.withPoint(base, name, target);
        const g = C.geometry(st);
        const M = appletIntersect(st.A, st.F, st.C, st.E);
        if (!finitePoint(M)) continue;
        const cAEM = appletGetCircle(st.A, st.E, M);
        const cCFM = appletGetCircle(st.C, st.F, M);
        const pts = appletCircleIntersections(cAEM, cCFM);
        /* A mouse drag can put A, E, M (or C, F, M) nearly on one line. Then
         * the applet's circumcenter has a zero determinant and draws nothing;
         * comparing a NaN circle with our null would test nothing. */
        if (!pts || !g.N) continue;
        const tol = 1e-6 * Math.max(width, height);
        mouseCases++;
        if (!require(`mouse ${name} ${i}: M matches the applet`, closePoint(M, g.M, tol))) break;
        if (!require(`mouse ${name} ${i}: N matches the applet`,
          closePoint(appletOther(pts, M), g.N, tol),
          `applet ${JSON.stringify(appletOther(pts, M))}, core ${JSON.stringify(g.N)}`)) break;
      }
    }
  }
  check(`dragged E and F agree with the applet on ${mouseCases} positions`, mouseCases > 200);
}

/* ------------------------------------------------------- 5. edge cases */

{
  const s = C.start();
  const flat = C.withPoint(s, "A", { x: 200, y: 150 });
  check("A dragged onto the vertical diagonal collapses the kite",
    dist(flat.A, flat.C) < 1e-9 || Math.min(...[dist(flat.A, flat.B), dist(flat.B, flat.C)]) < 1);
  check("no claim is made for the collapsed kite", !allClaims(flat));
  check("Other picks the second intersection when the first is M",
    C.other([{ x: 1, y: 2 }, { x: 9, y: 9 }], { x: 1, y: 2 }).x === 9);
  check("Other uses the first point when it is not M",
    C.other([{ x: 9, y: 9 }, { x: 1, y: 2 }], { x: 1, y: 2 }).x === 9);
  check("line parameters: CreateMidPoint(1) is the first point",
    closePoint(C.pointOnLine(s.A, s.B, 1), s.A, 1e-12));
  check("line parameters: UpdateMidPoint gets that 1 back",
    close(C.lineParam(s.A, s.B, s.A), 1, 1e-12));
  check("intersection of parallel lines is not finite",
    !finitePoint(C.intersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })));
  check("a near-parallel line through D leaves F non-finite",
    !finitePoint(withS(s, 1e-6).F));
  check("projectOnLine keeps E on AB after a wild drag", (() => {
    const q = C.withPoint(s, "E", { x: 1e6, y: -1e6 });
    return C.distToLine(q.E, q.A, q.B) < 1e-6;
  })());
}

done("asia-pacific-kite");
