#!/usr/bin/env node
"use strict";

/*
 * Logic test for anonymous-visitor/anonymous-visitor-core.js.
 *
 *   node porting/check-anonymous-visitor.mjs
 *
 * Checks the rules (the three draggable vertices, the locked proof overlays,
 * the reset), then the page's claim for a grid of bases and heights: the two
 * small triangles are equilateral, FE is parallel to AB, DFCE is a rhombus,
 * C lies on the bisector and ABC is equilateral, and C is the same point for
 * every height of D - on both sides of AB, so for external and internal
 * triangles alike. Finally a second, literal transcription of FormTriangle,
 * Rotate, Intersect and ReflectPointInLine from the Java bytecode is compared
 * with the core over the same range.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("anonymous-visitor/anonymous-visitor-core.js", "AnonymousVisitorCore");

const EPS = 1e-6;
const near = (a, b, eps = EPS) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
const same = (p, q, eps = EPS) => near(p.x, q.x, eps) && near(p.y, q.y, eps);
const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const cross = (p, q) => p.x * q.y - p.y * q.x;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

/* -------------------------------------- 1. the applet's own second transcription */

// GeoSDoub.Rotate(P, Q, angle, orientation): rotate Q about P.
function appletRotate(P, Q, angle, orientation) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return {
    x: P.x + cs * (Q.x - P.x) - orientation * sn * (Q.y - P.y),
    y: P.y + orientation * sn * (Q.x - P.x) + cs * (Q.y - P.y),
  };
}

// GeoSDoub.Intersect(P1,P2,P3,P4): line/line intersection in ax+by+c=0 form.
function appletIntersect(P1, P2, P3, P4) {
  const a1 = P1.y - P2.y, b1 = P2.x - P1.x, c1 = P1.x * P2.y - P1.y * P2.x;
  const a2 = P3.y - P4.y, b2 = P4.x - P3.x, c2 = P3.x * P4.y - P3.y * P4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN }; // the applet returns NaN here
  return { x: (b1 * c2 - b2 * c1) / det, y: (a2 * c1 - a1 * c2) / det };
}

// GeoSDoub.ComputeAngle(P0,P1,P2): the angle at P0, from the law of cosines.
function appletAngle(P0, P1, P2) {
  const a = dot(sub(P0, P1), sub(P0, P1));
  const b = dot(sub(P0, P2), sub(P0, P2));
  const c = dot(sub(P1, P2), sub(P1, P2));
  const q = (a + b - c) / (2 * Math.sqrt(a) * Math.sqrt(b));
  return Math.acos(Math.max(-1, Math.min(1, q)));
}

// GeoSDoub.FindOrientation(P0,P1,P2): sign of cross(P1-P0, P2-P0).
function appletOrientation(P0, P1, P2) {
  const s = cross(sub(P1, P0), sub(P2, P0));
  return s > 0 ? 1 : -1;
}

// GeoSDoub.ReflectPointInLine(P, line m1->m2): Rotate(m2, P, 2*angle, orientation).
function appletReflect(P, m1, m2) {
  const angle = appletAngle(m2, P, m1);
  const orientation = appletOrientation(m2, P, m1);
  return appletRotate(m2, P, 2 * angle, orientation);
}

// AnonymousVisitorCanvas.FormTriangle(p1,p2,p3), straight from the bytecode:
// S4 = Rotate(p2, p1, PI/3, -1); S5 = Rotate(p1, p2, PI/3, +1);
// S6 = Intersect(p1, S5, p2, S4); p3 = S6.
function appletFormTriangle(p1, p2, out) {
  const S4 = appletRotate(p2, p1, Math.PI / 3, -1);
  const S5 = appletRotate(p1, p2, Math.PI / 3, 1);
  const S6 = appletIntersect(p1, S5, p2, S4);
  out.x = S6.x;
  out.y = S6.y;
  return out;
}

// AnonymousVisitorCanvas.Compute(): FormTriangle(D,A,F), FormTriangle(B,D,E),
// then C = ReflectPointInLine(D, line(F,E)) - the rhombus's fourth corner.
function appletCompute(A, B, D) {
  const F = appletFormTriangle(D, A, { x: 0, y: 0 });
  const E = appletFormTriangle(B, D, { x: 0, y: 0 });
  const C = appletReflect(D, F, E);
  return { F, E, C };
}

/* ------------------------------------------------------------ 2. the rules */

{
  const s = C.start();
  equal("the opening A", s.A, { x: 124, y: 176 });
  equal("the opening B", s.B, { x: 276, y: 176 });
  equal("the opening D", s.D, { x: 200, y: 76 });
  check("a new picture has no result", C.result(s) === null);
  check("the proof overlays start locked", !s.names && !s.premise && !s.proof && !s.unlocked);
  const types = new Set(C.legalMoves().map((m) => m.type));
  check("legal moves cover both draggable ends, D, three toggles and reset",
    ["point", "names", "premise", "proof", "reset"].every((t) => types.has(t)));
  check("D starts on the perpendicular bisector",
    Math.abs(dot(sub(s.D, { x: 200, y: 176 }), sub(s.B, s.A))) < EPS);

  const d = C.move(s, { type: "point", name: "D", x: 200, y: 130 });
  check("dragging D unlocks premise and proof", d.unlocked && !d.premise && !d.proof);
  check("dragging D counts as exploring", d.moves === 1 && d.explored && C.result(d) === "done");
  const withOverlays = C.move(d, { type: "names", value: true });
  const withOverlays2 = C.move(withOverlays, { type: "premise", value: true });
  check("the premise and proof overlays can then be switched on",
    withOverlays2.premise &&
    C.move(d, { type: "proof", value: true }).proof &&
    withOverlays.names);
  check("the original position is untouched", s.moves === 0 && !s.explored && !s.unlocked);

  const movedA = C.move(withOverlays2, { type: "point", name: "A", x: 100, y: 190 });
  check("dragging A locks the proof overlays again",
    !movedA.unlocked && !movedA.premise && !movedA.proof && movedA.names);
  check("dragging A re-projects D onto the new bisector",
    Math.abs(dot(sub(movedA.D, { x: (movedA.A.x + movedA.B.x) / 2, y: (movedA.A.y + movedA.B.y) / 2 }),
      sub(movedA.B, movedA.A))) < EPS);
  const reset = C.move(movedA, { type: "reset" });
  check("reset restores the opening and locks the overlays",
    JSON.stringify(reset) === JSON.stringify(C.start()) && C.result(reset) === null);

  check("bad moves are refused",
    C.move(s, { type: "point", name: "X", x: 1, y: 1 }) === null &&
    C.move(s, { type: "point", name: "A", x: NaN, y: 1 }) === null &&
    C.move(s, { type: "point", name: "A", x: 275, y: 176 }) === null &&
    C.move(s, { type: "premise", value: true }) === null &&
    C.move(s, { type: "names", value: "yes" }) === null &&
    C.move(s, { type: "nonsense" }) === null &&
    C.move(null, { type: "reset" }) === null);
  check("all three handles stay on the board",
    ["A", "B", "D"].every((name) => {
      const p = C.limit(s, name, { x: -80, y: 999 });
      return p.x >= C.MARGIN && p.x <= C.WIDTH - C.MARGIN && p.y >= C.MARGIN && p.y <= C.HEIGHT - C.MARGIN;
    }));
  check("D's drag is snapped onto the bisector, even off the line",
    Math.abs(dot(sub(C.limit(s, "D", { x: 250, y: 200 }), { x: 200, y: 176 }), sub(s.B, s.A))) < EPS);
}

/* --------------------------------------- 3. the page's claim, all configurations */

// A spread of bases: level, upright, sloping, reversed (A to the right of B),
// short and long, plus seeded random ones. D is then tried at many signed
// heights along each perpendicular bisector, on both sides of the base.
const rand = rng(20261126);
const bases = [
  { A: { x: 124, y: 176 }, B: { x: 276, y: 176 } }, // the opening
  { A: { x: 60, y: 60 }, B: { x: 340, y: 60 } },    // long, high
  { A: { x: 200, y: 40 }, B: { x: 200, y: 220 } },  // upright
  { A: { x: 276, y: 176 }, B: { x: 124, y: 176 } }, // ends swapped
  { A: { x: 60, y: 220 }, B: { x: 300, y: 80 } },   // sloping
  { A: { x: 150, y: 200 }, B: { x: 230, y: 200 } }, // short
];
for (let i = 0; i < 10; i++) {
  const A = { x: 40 + 320 * rand(), y: 40 + 180 * rand() };
  const B = { x: 40 + 320 * rand(), y: 40 + 180 * rand() };
  if (dist(A, B) < C.MIN_BASE + 30) continue;
  bases.push({ A, B });
}
const heights = [-90, -70, -45, -25, -10, -3, 3, 10, 25, 45, 70, 90];

let externalSeen = 0, internalSeen = 0, configurations = 0;
for (const base of bases) {
  const f = C.frame(base.A, base.B);
  const fixed = [];
  const seen = {};
  for (const h of heights) {
    const D = add(f.M, mul(f.n, h));
    const state = { ...C.start(), A: base.A, B: base.B, D };
    const g = C.construct(state);
    if (!g || !finitePoint(g.C)) continue;
    // At h = -s√3/2 the reflected point coincides with D and the rhombus
    // collapses: not a configuration the puzzle draws.
    if (Math.abs(h + g.s * Math.sqrt(3) / 2) < 1e-3) continue;
    configurations++;
    fixed.push(g.C);
    if (h < 0) { externalSeen++; seen.neg = g.external; }
    else { internalSeen++; seen.pos = g.external; }
    const DE = dist(g.D, g.E), DF = dist(g.D, g.F);
    const FC = dist(g.F, g.C), CE = dist(g.C, g.E);

    check("ADF is equilateral", near(DF, dist(g.A, g.D)) && near(DF, dist(g.A, g.F)));
    check("BDE is equilateral", near(DE, dist(g.B, g.D)) && near(DE, dist(g.B, g.E)));
    check("the midpoint of FE lies on the perpendicular bisector of AB",
      Math.abs(dot(sub(mul(add(g.F, g.E), 0.5), g.M), sub(g.B, g.A))) < 1e-6);
    check("FE is parallel to AB", Math.abs(cross(sub(g.E, g.F), sub(g.B, g.A))) < 1e-5);
    // The applet obtains C by reflecting D in FE, i.e. DC ⟂ FE and the
    // midpoint of DC lies on FE.
    check("DC is perpendicular to FE", Math.abs(dot(sub(g.C, g.D), sub(g.E, g.F))) < 1e-6);
    check("the midpoint of DC lies on FE",
      Math.abs(cross(sub(mul(add(g.C, g.D), 0.5), g.F), sub(g.E, g.F))) < 1e-5);
    check("DFCE is a rhombus", near(DF, FC) && near(FC, CE) && near(CE, DE));
    check("C lies on the perpendicular bisector of AB",
      Math.abs(dot(sub(g.C, g.M), sub(g.B, g.A))) < 1e-5);
    check("ABC is equilateral",
      near(dist(g.A, g.C), dist(g.B, g.C)) && near(dist(g.A, g.C), g.s));
    check("the status line states the fixed-point claim", /ABC is equilateral/.test(C.status(state)));
  }
  check("C does not move as D changes height",
    fixed.length > 1 && fixed.every((p) => same(p, fixed[0], 1e-6)));
  check("the two small triangles flip between outside and inside",
    seen.neg !== undefined && seen.pos !== undefined && seen.neg !== seen.pos);
}
check("both external and internal positions were exercised", externalSeen > 0 && internalSeen > 0);
check("every configuration produced a construction", configurations >= bases.length * 8);

/* ----------------------------- 4. the same answers as the applet's own method */

for (const base of bases) {
  const f = C.frame(base.A, base.B);
  for (let i = 0; i <= 24; i++) {
    const h = -100 + i * (200 / 24); // a fine sweep across the bisector
    const D = add(f.M, mul(f.n, h));
    const g = C.construct({ ...C.start(), A: base.A, B: base.B, D });
    const ap = appletCompute(base.A, base.B, g.D);
    check("the applet's FormTriangle gives the same F and E",
      finitePoint(ap.F) && finitePoint(ap.E) && same(ap.F, g.F, 1e-6) && same(ap.E, g.E, 1e-6));
    check("the applet's ReflectPointInLine gives the same C",
      finitePoint(ap.C) && same(ap.C, g.C, 1e-6));
    check("the reflected C is the page's fixed equilateral apex",
      same(g.C, sub(g.M, mul(g.n, g.s * Math.sqrt(3) / 2)), 1e-6));
  }
}

// Rigid motions carry the whole picture, and the fixed point, with them.
{
  const base = bases[0];
  const f = C.frame(base.A, base.B);
  const D = add(f.M, mul(f.n, -80));
  const g0 = C.construct({ ...C.start(), A: base.A, B: base.B, D });
  const shifted = (p) => ({ x: p.x + 37, y: p.y - 51 });
  const g1 = C.construct({ ...C.start(), A: shifted(base.A), B: shifted(base.B), D: shifted(D) });
  check("a translation moves C by the same amount", same(g1.C, shifted(g0.C)));
  const t = 0.7, cs = Math.cos(t), sn = Math.sin(t);
  const turned = (p) => ({ x: cs * p.x - sn * p.y, y: sn * p.x + cs * p.y });
  const g2 = C.construct({ ...C.start(), A: turned(base.A), B: turned(base.B), D: turned(D) });
  check("a rotation turns C by the same angle", same(g2.C, turned(g0.C), 1e-6));
}

done("anonymous-visitor");
