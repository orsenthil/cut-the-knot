#!/usr/bin/env node
"use strict";

/*
 * Logic test for besteman/besteman-core.js.
 *
 *   node porting/check-besteman.mjs
 *
 * What the cut-the-knot page claims, quoted exactly: with C on the ray AB,
 * "AP/AQ = AD/AC", hence "AP = AB²/(2AC)", hence, "if C was chosen so that
 * AC = N(AB/2)", "AP = AB/N" — where D and E are the intersections of the
 * circles centred at A and C with radii AB and AC, P = DE ∩ AB, Q the midpoint
 * of DA, and M the midpoint of AB (so AC = N·AM).
 *
 * This test checks all nine pieces of that claim for every N the applet allows
 * (2..20, from PVNumeric.setMinValue/setMaxValue) over many point placements,
 * and compares the whole construction with a second, literal transcription of
 * BestmanCanvas.DrawConstruction and GeoSDoub.Intersect from the bytecode,
 * including the order of D and E and the +/−sqrt branch of the circle pair.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("besteman/besteman-core.js", "BestemanCore");

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const same = (p, q, tol = 1e-6) =>
  Number.isFinite(p?.x) && Number.isFinite(p?.y) && Number.isFinite(q?.x) && Number.isFinite(q?.y) &&
  Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;

/* --------------------------------------------------- the applet, transcribed */

// GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), javap offsets
// 0..177: ax+by+c=0 for each line, det, then NaN when |det| < 1.
function appletLineIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

// GeoSDoub.IntersectCirclesX, javap offsets 0..255. Solving x = m*y + b.
function appletCirclesX(c0, c1) {
  const m = -(c0.y - c1.y) / (c0.x - c1.x);              // 0..19
  const b = (c0.x * c0.x - c1.x * c1.x + c0.y * c0.y - c1.y * c1.y
    - c0.r * c0.r + c1.r * c1.r) / (2 * (c0.x - c1.x));  // 21..94
  const k = b - c0.x;                                    // 96..103
  const a = m * m + 1;                                   // 105..110
  const p = m * k - c0.y;                                // 112..122
  const q = k * k + c0.y * c0.y - c0.r * c0.r;           // 123..148
  const disc = p * p - a * q;                            // 150..161
  if (disc < 0) return null;                             // 163..171
  const s = Math.sqrt(disc);                             // 172..177
  const y0 = (-p + s) / a, y1 = (-p - s) / a;            // 179..199
  return [{ x: m * y0 + b, y: y0 }, { x: m * y1 + b, y: y1 }]; // 201..255
}

// GeoSDoub.IntersectCirclesY, javap offsets 0..255. Solving y = m*x + b.
function appletCirclesY(c0, c1) {
  const m = -(c0.x - c1.x) / (c0.y - c1.y);
  const b = (c0.y * c0.y - c1.y * c1.y + c0.x * c0.x - c1.x * c1.x
    - c0.r * c0.r + c1.r * c1.r) / (2 * (c0.y - c1.y));
  const k = b - c0.y;
  const a = m * m + 1;
  const p = m * k - c0.x;
  const q = k * k + c0.x * c0.x - c0.r * c0.r;
  const disc = p * p - a * q;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const x0 = (-p + s) / a, x1 = (-p - s) / a;
  return [{ x: x0, y: m * x0 + b }, { x: x1, y: m * x1 + b }];
}

// GeoSDoub.Intersect(DoubCircle,DoubCircle), javap offsets 0..66.
function appletCircleIntersect(c0, c1) {
  if (Math.abs(c0.x - c1.x) > 1) return appletCirclesX(c0, c1);
  if (Math.abs(c0.y - c1.y) > 1) return appletCirclesY(c0, c1);
  return [{ x: c0.x, y: c0.y }, { x: c0.x, y: c0.y }];
}

// BestmanCanvas.DrawConstruction, javap offsets 0..443 (the hint lines last).
function appletDrawConstruction(A, B, N) {
  const AB = dist(A, B);                                  // 0..11
  const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };   // 12..25
  const C = { x: A.x + (N * AB) / 2, y: A.y };            // 28..62
  const halfMarks = [];                                   // 77..130
  for (let i = 0; i < N; i++) halfMarks.push({ x: A.x + ((i + 1) * AB) / 2, y: A.y });
  const circleA = { x: A.x, y: A.y, r: AB };               // 133..145
  const circleC = { x: C.x, y: C.y, r: (N * AB) / 2 };     // 147..169
  const hits = appletCircleIntersect(circleA, circleC);    // 209..215
  if (!hits) return null;
  const D = hits[0], E = hits[1];                          // 248..261
  const P = appletLineIntersect(D, E, A, C);               // 264..284
  const divisions = [];                                    // 299..367
  for (let i = 0; i < N; i++) {
    divisions.push({ x: A.x + (P.x - A.x) * (i + 1), y: A.y });
  }
  const Q = { x: (A.x + D.x) / 2, y: (A.y + D.y) / 2 };    // 370..383
  return { AB, M, C, circleA, circleC, D, E, P, halfMarks, divisions, Q };
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  equal("opening A is the applet's GetPoint for a 400x250 canvas", s.A, C.START_A);
  equal("opening B is A plus min(w,h)/5", s.B, C.START_B);
  check("opening N is the applet's 3", s.n === 3);
  check("names and hint start off", !s.names && !s.hint);
  check("a fresh picture has no result", C.result(s) === null);
  const types = new Set(C.legalMoves().map((m) => m.type));
  check("legal moves cover drag, N, both ticks and reset",
    ["point", "n", "names", "hint", "reset"].every((t) => types.has(t)));
  check("AB starts at the applet's 50", C.construct(s).AB === 50);
}

/* ------------------------------------------------------------ 2. the moves */

{
  const s = C.start();
  const a = C.move(s, { type: "point", name: "A", x: 210, y: 40 });
  check("dragging A levels B at the new y",
    same(a.A, { x: 210, y: 40 }) && a.B.y === 40 && a.B.x === s.B.x);
  const b = C.move(s, { type: "point", name: "B", x: 170, y: 200 });
  check("dragging B levels A at the new y",
    same(b.B, { x: 170, y: 200 }) && b.A.y === 200 && b.A.x === s.A.x);
  check("dragging does not change N", a.n === 3 && b.n === 3);
  check("a move counts and explores", a.moves === 1 && a.explored && C.result(a) === "done");
  check("the original position is untouched", s.moves === 0 && !s.explored);
  check("N is clamped to the applet's 2..20",
    C.move(s, { type: "n", value: 0 }).n === 2 && C.move(s, { type: "n", value: 99 }).n === 20);
  check("N accepts every whole value in the applet's range",
    Array.from({ length: 19 }, (_, i) => C.move(s, { type: "n", value: i + 2 }).n)
      .every((n, i) => n === i + 2));
  check("bad moves are refused",
    C.move(s, { type: "n", value: NaN }) === null &&
    C.move(s, { type: "point", name: "X", x: 1, y: 1 }) === null &&
    C.move(s, { type: "point", name: "A", x: "x", y: 1 }) === null &&
    C.move(s, { type: "names", value: "yes" }) === null &&
    C.move(s, { type: "nonsense" }) === null &&
    C.move(null, { type: "reset" }) === null);
  check("ticks and reset behave", C.move(s, { type: "names", value: true }).names === true &&
    C.move(s, { type: "hint", value: true }).hint === true &&
    C.move(a, { type: "reset" }).explored === false &&
    C.move(a, { type: "reset" }).names === false);
  check("a point is kept on the board",
    C.move(s, { type: "point", name: "A", x: -10, y: 999 }).A.x === 0 &&
    C.move(s, { type: "point", name: "A", x: -10, y: 999 }).A.y === C.HEIGHT);
}

/* --------------------------- 3. every N, every claim, many point placements */

const fixed = [
  { A: { x: 100, y: 115 }, B: { x: 150, y: 115 } }, // the opening picture
  { A: { x: 20, y: 125 }, B: { x: 380, y: 125 } },  // a very long segment
  { A: { x: 40, y: 210 }, B: { x: 90, y: 210 } },   // short segment, low on the board
  { A: { x: 200, y: 30 }, B: { x: 240, y: 30 } },   // short segment, high on the board
  { A: { x: 120, y: 100 }, B: { x: 127, y: 100 } }, // AB = 7, near the applet's x-branch cut-off
  { A: { x: 120, y: 100 }, B: { x: 128, y: 100 } }, // AB = 8, just above it for N = 2
];

const rand = rng(2552);
const positions = fixed.map((p, i) => ({ ...p, label: `fixed ${i + 1}` }));
for (let i = 0; i < 120; i++) {
  const A = { x: 8 + 384 * rand(), y: 8 + 234 * rand() };
  const len = 5 + 300 * rand();
  const dir = rand() < 0.5 ? 1 : -1;
  const B = { x: Math.max(0, Math.min(C.WIDTH, A.x + dir * len)), y: A.y };
  if (dist(A, B) > 1) positions.push({ A, B, label: `random ${i}` });
}

{
  let configurations = 0;
  let failures = 0;
  for (const pos of positions) {
    for (let n = C.MIN_N; n <= C.MAX_N; n++) {
      const state = { A: pos.A, B: pos.B, n, names: false, hint: true };
      const g = C.construct(state);
      const cl = C.claims(state);
      const allClaims = Object.values(cl).every(Boolean);
      configurations++;

      if (!allClaims) {
        check(`${pos.label}, N=${n}: every claim on the page holds`, false, JSON.stringify(cl));
        failures++;
      }
      // The page's final claim, spelled out: AP = AB/N when AC = N·AB/2.
      if (!(g.AP !== null && Math.abs(g.AP - g.AB / n) <= 1e-9 * g.AB)) {
        check(`${pos.label}, N=${n}: AP = AB/N`, false, `${g.AP} vs ${g.AB / n}`);
        failures++;
      }
      const applet = appletDrawConstruction(pos.A, pos.B, n);
      const agree = applet && g.D && g.P &&
        same(applet.M, g.M) && same(applet.C, g.C) &&
        same(applet.circleA, g.circleA) && same(applet.circleC, g.circleC) &&
        same(applet.D, g.D) && same(applet.E, g.E) &&
        same(applet.P, g.P, 1e-5) && same(applet.Q, g.Q) &&
        applet.halfMarks.every((p, i) => same(p, g.halfMarks[i])) &&
        applet.divisions.every((p, i) => same(p, g.divisions[i], 1e-5));
      if (!agree) {
        check(`${pos.label}, N=${n}: core matches the applet's own DrawConstruction`, false,
          `core ${JSON.stringify({ D: g.D, E: g.E, P: g.P, Q: g.Q })}, applet ${JSON.stringify(applet && { D: applet.D, E: applet.E, P: applet.P, Q: applet.Q })}`);
        failures++;
      }
    }
  }
  check(`every claim and the applet's own method agree on ${configurations} configurations`,
    configurations === positions.length * (C.MAX_N - C.MIN_N + 1) && failures === 0);
  check("the page's AP = AB/N held in every configuration", failures === 0);
  check("the option range was covered exhaustively",
    Array.from({ length: 19 }, (_, i) => i + 2).every((n) =>
      positions.every((p) => C.construct({ A: p.A, B: p.B, n }).n === n)));
}

/* --------------------------------- 4. the article's intermediate equations */

{
  const state = { A: { x: 100, y: 115 }, B: { x: 150, y: 115 }, n: 7 };
  const g = C.construct(state);
  check("AC = N·AM", Math.abs(g.AC - state.n * dist(g.A, g.M)) < 1e-9);
  check("(1) AP/AQ = AD/AC", Math.abs(g.AP / g.AQ - g.AD / g.AC) < 1e-9);
  check("(2) AP = AB²/(2AC)", Math.abs(g.AP - (g.AB * g.AB) / (2 * g.AC)) < 1e-9);
  check("(3) AP = AB/N", Math.abs(g.AP - g.AB / state.n) < 1e-9);
  check("DE is perpendicular to AC", Math.abs((g.E.x - g.D.x) * (g.C.x - g.A.x) +
    (g.E.y - g.D.y) * (g.C.y - g.A.y)) < 1e-8);
  check("DE crosses AB at P", Math.abs(g.P.x - g.A.x - g.AP) < 1e-9);
  check("the N dots are the N-th parts: k·AP", g.divisions.every((p, i) =>
    Math.abs(dist(g.A, p) - (i + 1) * g.AP) < 1e-8));
  check("Q is the midpoint of DA", Math.abs(g.Q.x - (g.A.x + g.D.x) / 2) < 1e-12 &&
    Math.abs(g.Q.y - (g.A.y + g.D.y) / 2) < 1e-12);
  check("the hint lines are Q-C, A-D and C-D", g.hintSegments.length === 3);
}

/* -------------------------------------------- 5. degenerate input is safe */

{
  const flat = { A: { x: 100, y: 100 }, B: { x: 100, y: 100 }, n: 3 };
  check("A = B is reported as degenerate", C.construct(flat).degenerate);
  check("no claims pass when AB has no length", !Object.values(C.claims(flat)).some(Boolean));
  check("an off-range N is clamped before drawing",
    C.construct({ ...flat, B: { x: 150, y: 100 }, n: 999 }).n === C.MAX_N &&
    C.construct({ ...flat, B: { x: 150, y: 100 }, n: 1 }).n === C.MIN_N);
  check("a translation moves the whole construction, not the divisions", (() => {
    const s = { A: { x: 100, y: 115 }, B: { x: 150, y: 115 }, n: 5 };
    const a = C.construct(s), b = C.construct({
      A: { x: s.A.x + 40, y: s.A.y - 30 }, B: { x: s.B.x + 40, y: s.B.y - 30 }, n: 5,
    });
    return same(a.P, { x: b.P.x - 40, y: b.P.y + 30 }) && same(a.C, { x: b.C.x - 40, y: b.C.y + 30 });
  })());
}

done("besteman");
