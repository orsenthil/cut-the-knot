#!/usr/bin/env node
"use strict";

/*
 * Logic test for ceva-cradle/ceva-cradle-core.js.
 *
 *   node porting/check-ceva-cradle.mjs
 *
 * Checked: the starting diagram against a second transcription of
 * CevaCradleCanvas.init; the page's exact identity (the two Ceva products are
 * equal for every O), the "iff" of concurrence, and the perpendicular feet of
 * the proof, over ~1,500 random triangles and side points plus a fixed set.
 * The last group is a literal second transcription of the applet's own
 * GeoSDoub.Intersect / Dist / NearestPoint and CheckCeva (tolerance 0.01),
 * compared with the core over the whole random range. The move rules are
 * checked too: X, Y and Z stay on their sides with their line parameters, and
 * moving a vertex carries the two side points that depend on it.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("ceva-cradle/ceva-cradle-core.js", "CevaCradleCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && Number.isFinite(p.x) && Number.isFinite(q.x) &&
  close(p.x, q.x, tol) && close(p.y, q.y, tol);
const onLine = (p, a, b, tol) =>
  Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) <= tol;

/* ------------------------------ the applet's own methods, transcribed again */

/* GeoSDoub.Intersect: ax+by+c=0 form, determinant below 1 gives a NaN point. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* GeoSDoub.NearestPoint(p,a,b), including its 0.1 squared-distance shortcut. */
function appletNearest(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const sq = (a.x - p.x) ** 2 + (a.y - p.y) ** 2;
  if (sq < 0.1) return { x: a.x, y: a.y };
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / (dx * dx + dy * dy);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/* CevaCradleCanvas.CheckCeva, straight from the bytecode. */
function appletCheckCeva(s, D, E, F) {
  try {
    const left = (dist(s.A, s.Z) / dist(s.Z, s.B)) *
      (dist(s.B, s.X) / dist(s.X, s.C)) *
      (dist(s.C, s.Y) / dist(s.Y, s.A));
    const right = (dist(s.Z, D) / dist(D, s.Y)) *
      (dist(s.Y, F) / dist(F, s.X)) *
      (dist(s.X, E) / dist(E, s.Z));
    return Math.abs(left - 1) < 0.01 && Math.abs(right - 1) < 0.01;
  } catch (e) {
    return false;
  }
}

/* CevaCradleCanvas.Compute's guard and its three intersection points. */
function appletCompute(s) {
  if (dist(s.O, s.A) < 1 || dist(s.O, s.B) < 1 || dist(s.O, s.C) < 1) return null;
  return {
    D: appletIntersect(s.A, s.O, s.Y, s.Z),
    E: appletIntersect(s.B, s.O, s.Z, s.X),
    F: appletIntersect(s.C, s.O, s.X, s.Y),
    G: appletNearest(s.Y, s.A, s.O),
    H: appletNearest(s.Z, s.A, s.O),
  };
}

/* --------------------------------------------- 1. the start and the moves */

{
  const w = 400, h = 300;
  const cx = w / 2, cy = (h * 11) / 20, r = Math.min(w, h) / 2;
  const circle = (a) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  const s = C.start({ width: w, height: h });
  const T = 1e-12;
  check("start A matches FromCircle(pi/8)", closePoint(s.A, circle(Math.PI / 8), T));
  check("start B matches FromCircle(4pi/5)", closePoint(s.B, circle((4 * Math.PI) / 5), T));
  check("start C matches FromCircle(11pi/9)", closePoint(s.C, circle((11 * Math.PI) / 9), T));
  check("start X is 0.6 along BC", closePoint(s.X, C.onLine(s.B, s.C, 0.6), T));
  check("start Y and Z are the midpoints of CA and AB",
    closePoint(s.Y, C.onLine(s.C, s.A, 0.5), T) && closePoint(s.Z, C.onLine(s.A, s.B, 0.5), T));
  const centroid = { x: (s.A.x + s.B.x + s.C.x) / 3, y: (s.A.y + s.B.y + s.C.y) / 3 };
  check("start O is the centroid shifted by (-30,-10)",
    closePoint(s.O, { x: centroid.x - 30, y: centroid.y - 10 }, T));
  check("the fresh diagram is not marked finished", C.result(s) === null);
  check("the fresh diagram still satisfies the identity", C.claims(s).identity);
  check("withPoint does not change the position it was given", (() => {
    const before = JSON.stringify(s);
    const next = C.movePoint(s, "A", { x: 12, y: 34 });
    return JSON.stringify(s) === before && next.A.x === 12 && next.B.x === s.B.x;
  })());
  check("an unknown handle name leaves the diagram alone", (() => {
    const q = C.movePoint(s, "Q", { x: 1, y: 2 });
    return ["A", "B", "C", "X", "Y", "Z", "O"].every((k) => closePoint(q[k], s[k], 0)) &&
      q.tx === s.tx && q.ty === s.ty && q.tz === s.tz;
  })());
  check("illegal moves are refused", C.move(s, { name: "Q", point: { x: 1, y: 2 } }) === null &&
    C.move(s, null) === null && C.move(s, { name: "A" }) === null);
  equal("the seven draggable points are the legal moves",
    C.legalMoves(s), ["A", "B", "C", "X", "Y", "Z", "O"]);
}

/* --------------------------------- 2. fixed diagrams, one of them concurrent */

const fixed = [];
{
  const s = C.start({});
  fixed.push(["the applet's own start", s]);
  fixed.push(["a wide triangle", C.withSides({
    A: { x: 40, y: 60 }, B: { x: 360, y: 100 }, C: { x: 120, y: 270 },
    O: { x: 200, y: 150 }, tx: 0.25, ty: 0.8, tz: 0.7,
  })]);
  // Cevians through the centroid: the classic concurrent case.
  const p = { x: (s.A.x + s.B.x + s.C.x) / 3, y: (s.A.y + s.B.y + s.C.y) / 3 };
  const X = C.intersect(s.A, p, s.B, s.C);
  const Y = C.intersect(s.B, p, s.C, s.A);
  const Z = C.intersect(s.C, p, s.A, s.B);
  fixed.push(["medians through the centroid", C.withSides({
    A: s.A, B: s.B, C: s.C, O: s.O,
    tx: C.parameterOn(s.B, s.C, X), ty: C.parameterOn(s.C, s.A, Y), tz: C.parameterOn(s.A, s.B, Z),
  })]);
}

for (const [name, s] of fixed) {
  const cl = C.claims(s), m = C.compute(s);
  check(`${name}: D,E,F lie on AO/BO/CO and on the sides of XYZ`, cl.constructed);
  check(`${name}: the identity (*) holds`, cl.identity,
    `left ${m.left}, right ${m.right}`);
  check(`${name}: G,H are perpendicular feet on AO`, cl.feetCorrect);
  check(`${name}: concurrence in ABC agrees with concurrence in XYZ`, cl.concurrentTogether);
}
{
  const s = fixed[2][1], m = C.compute(s), p = fixed[2][1];
  check("medians: both products are 1 within the applet's 0.01 tolerance",
    close(m.left, 1, C.TOL) && close(m.right, 1, C.TOL));
  check("medians: the diagram is marked finished", m.finished && C.result(s) === "done");
  check("medians: M is the concurrence point of AX,BY,CZ",
    closePoint(m.M, { x: (p.A.x + p.B.x + p.C.x) / 3, y: (p.A.y + p.B.y + p.C.y) / 3 }, 1e-6));
  check("medians: N is finite and lies on XD, YE and ZF", m.N &&
    onLine(m.N, p.X, m.D, 1e-6) && onLine(m.N, p.Y, m.E, 1e-6) && onLine(m.N, p.Z, m.F, 1e-6));
  const not = fixed[0][1], nm = C.compute(not);
  check("a non-concurrent start is not marked finished", !nm.finished && C.result(not) === null);
}

/* ---------------- 3. every claim over many triangles, sides points and O's */

{
  const rand = rng(1961);
  let tested = 0, bad = 0;
  for (let trial = 0; trial < 1600; trial++) {
    const A = { x: 10 + rand() * 380, y: 10 + rand() * 280 };
    const B = { x: 10 + rand() * 380, y: 10 + rand() * 280 };
    const Cc = { x: 10 + rand() * 380, y: 10 + rand() * 280 };
    const area = Math.abs((B.x - A.x) * (Cc.y - A.y) - (B.y - A.y) * (Cc.x - A.x));
    if (area < 2500) continue;
    const s = C.withSides({
      A, B, C: Cc,
      O: { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      tx: 0.03 + rand() * 0.94, ty: 0.03 + rand() * 0.94, tz: 0.03 + rand() * 0.94,
    });
    const cl = C.claims(s);
    if (!cl.constructed) continue; // a parallel pair has no intersection
    tested++;
    if (!(cl.identity && cl.feetCorrect && cl.concurrentTogether)) {
      bad++;
      if (bad <= 3) check(`random ${trial}: all four claims hold`, false, JSON.stringify(cl));
    }
  }
  check(`${tested} random diagrams: every claim holds`, bad === 0 && tested > 1200,
    `${bad} failures out of ${tested}`);
}

/* O never enters the identity: move it around a fixed cradle. */
{
  const rand = rng(1122);
  let tested = 0, bad = 0;
  for (let base = 0; base < 120; base++) {
    const A = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
    const B = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
    const Cc = { x: 20 + rand() * 360, y: 20 + rand() * 260 };
    const s = C.withSides({
      A, B, C: Cc, O: { x: 200, y: 150 },
      tx: 0.1 + rand() * 0.8, ty: 0.1 + rand() * 0.8, tz: 0.1 + rand() * 0.8,
    });
    const seen = [];
    for (const O of [
      { x: 60, y: 60 }, { x: 200, y: 60 }, { x: 340, y: 60 },
      { x: 60, y: 240 }, { x: 200, y: 240 }, { x: 340, y: 240 },
    ]) {
      const m = C.compute(C.withSides({ ...s, O }));
      if (!m.valid || !m.D || !m.E || !m.F || !Number.isFinite(m.right)) continue;
      seen.push(m);
      tested++;
      for (const q of seen) {
        if (!close(q.left, m.left, 1e-9 * Math.max(1, Math.abs(m.left)))) bad++;
        if (!close(q.right, m.right, 1e-7 * Math.max(1, Math.abs(m.right)))) bad++;
      }
    }
    if (seen.length < 4) continue;
  }
  check(`${tested} placements of O: the right product does not depend on O`, bad === 0 && tested > 400,
    `${bad} failures out of ${tested}`);
}

/* ------------------------ 4. the applet's own method vs the core's results */

{
  const rand = rng(1961);
  let compared = 0, badFlag = 0, badPoint = 0;
  for (const [, s] of fixed) {
    const view = C.compute(s);
    const ap = appletCompute(s);
    check("fixed: core and applet agree on the early-return guard", Boolean(ap) === view.valid);
    if (!ap || !view.valid) continue;
    for (const key of ["D", "E", "F", "G", "H"]) {
      if (!closePoint(ap[key], view[key], 1e-9)) {
        badPoint++;
        check(`fixed ${key} matches the applet's own construction`, false,
          `applet ${JSON.stringify(ap[key])}, core ${JSON.stringify(view[key])}`);
      }
    }
    check("fixed: applet CheckCeva matches core finished", appletCheckCeva(s, ap.D, ap.E, ap.F) === view.finished);
    compared++;
  }
  for (let trial = 0; trial < 1400; trial++) {
    const A = { x: 10 + rand() * 380, y: 10 + rand() * 280 };
    const B = { x: 10 + rand() * 380, y: 10 + rand() * 280 };
    const Cc = { x: 10 + rand() * 380, y: 10 + rand() * 280 };
    const s = C.withSides({
      A, B, C: Cc,
      O: { x: 10 + rand() * 380, y: 10 + rand() * 280 },
      tx: 0.02 + rand() * 0.96, ty: 0.02 + rand() * 0.96, tz: 0.02 + rand() * 0.96,
    });
    const view = C.compute(s), ap = appletCompute(s);
    if (!ap || !view.valid) continue;
    for (const key of ["D", "E", "F", "G", "H"]) {
      if (Number.isFinite(ap[key].x) && !closePoint(ap[key], view[key], 1e-7)) badPoint++;
    }
    if (appletCheckCeva(s, ap.D, ap.E, ap.F) !== view.finished) {
      badFlag++;
      if (badFlag <= 3) check(`random ${trial}: CheckCeva agrees with the core`, false,
        `left ${view.left}, right ${view.right}`);
    }
    compared++;
  }
  check(`${compared} diagrams: applet CheckCeva and core finished agree`, badFlag === 0 && compared > 900,
    `${badFlag} failures out of ${compared}`);
  check(`${compared} diagrams: applet intersections and feet agree with the core`, badPoint === 0,
    `${badPoint} point mismatches`);
}

/* ------------------------------- 5. dragging and the applet's guard */

{
  const s = C.start({});
  const beyond = C.movePoint(s, "X", { x: 800, y: 800 });
  check("a dragged X is projected back onto BC", onLine(beyond.X, beyond.B, beyond.C, 1e-9));
  check("its line parameter stays between 0 and 1", beyond.tx >= 0 && beyond.tx <= 1 && beyond.tx === 1);
  check("a side point dragged past the other end clamps to the other vertex",
    closePoint(beyond.X, beyond.B, 1e-9));
  const mid = C.movePoint(s, "Y", { x: (s.C.x + s.A.x) / 2, y: (s.C.y + s.A.y) / 2 });
  check("dragging Y to the midpoint sets ty = 0.5", close(mid.ty, 0.5, 1e-9));
  const moved = C.movePoint(s, "A", { x: 300, y: 80 });
  check("moving A carries Z and Y but leaves X on BC",
    closePoint(moved.Z, C.onLine(moved.A, moved.B, moved.tz), 1e-9) &&
    closePoint(moved.Y, C.onLine(moved.C, moved.A, moved.ty), 1e-9) &&
    closePoint(moved.X, s.X, 1e-9));
  const movedB = C.movePoint(s, "B", { x: 40, y: 40 });
  check("moving B carries Z and X but leaves Y on CA",
    closePoint(movedB.Z, C.onLine(movedB.A, movedB.B, movedB.tz), 1e-9) &&
    closePoint(movedB.X, C.onLine(movedB.B, movedB.C, movedB.tx), 1e-9) &&
    closePoint(movedB.Y, s.Y, 1e-9));
  const movedO = C.movePoint(s, "O", { x: 250, y: 90 });
  check("O is free and does not move the side points", closePoint(movedO.O, { x: 250, y: 90 }, 1e-9) &&
    closePoint(movedO.X, s.X, 1e-9) && closePoint(movedO.Y, s.Y, 1e-9));

  /* Compute returns early when O comes within one unit of a corner. */
  for (const corner of ["A", "B", "C"]) {
    const near = C.withSides({ ...s, O: { x: s[corner].x + 0.5, y: s[corner].y } });
    const view = C.compute(near);
    check(`O within one unit of ${corner}: the applet stops recomputing`,
      !view.valid && view.finished === false && C.result(near) === null && appletCompute(near) === null);
  }
  check("a different start size keeps the same relative layout", (() => {
    const t = C.start({ width: 600, height: 450 });
    return closePoint(t.A, { x: 300 + 225 * Math.cos(Math.PI / 8), y: 247.5 + 225 * Math.sin(Math.PI / 8) }, 1e-9);
  })());
}

done("ceva-cradle");
