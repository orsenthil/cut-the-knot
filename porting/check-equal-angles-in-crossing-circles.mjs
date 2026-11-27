#!/usr/bin/env node
"use strict";

/*
 * Logic test for equal-angles-in-crossing-circles/equal-angles-in-crossing-circles-core.js.
 *
 *   node porting/check-equal-angles-in-crossing-circles.mjs
 *
 * 1. The start picture, the four drags, both modes, the three display
 *    switches, and the fact that this is an illustration with no win or loss.
 * 2. A second transcription of the applet's own methods straight from the
 *    bytecode of EqualAnglesInCrossingCirclesCanvas and GeoSDoub (FindCircumcenter,
 *    GetCircle, Intersect, IntersectX/Y, Other, ReflectPointInLine, AMoved,
 *    DMoved, TranslateCD, Compute), compared over hundreds of configurations.
 * 3. The page's claims, checked independently on every valid configuration:
 *    AB = CD, the equal angles with PQ, C'D' = CD, the symmetry in the line
 *    of centres, and Shutrick's "twice the projection of EF" observation.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore(
  "equal-angles-in-crossing-circles/equal-angles-in-crossing-circles-core.js",
  "EqualAnglesInCrossingCirclesCore");

const D = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const near = (p, q, tol = 1e-5) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const samePair = (p, q, r, s, tol = 1e-5) =>
  (near(p, r, tol) && near(q, s, tol)) || (near(p, s, tol) && near(q, r, tol));

/* When a constructed line is tangent at P, the "second" intersection is P
   itself: no proper chord, so the page's claim does not apply. The applet's
   Other() uses the same three-unit cut-off, so mirror it here. */
const degenerate = (g, s) =>
  !!g && !!g.A && !!g.B && !!g.C && !!g.D &&
  [g.A, g.B, g.C, g.D].some((p) => D(p, s.P) < 3);

/* ----------------------------------------------------------------- 1. rules */

{
  const s = C.start();
  equal("opening points from init()", [s.P, s.Q, s.A], [
    { x: 210, y: 112 }, { x: 210, y: 168 }, { x: 126, y: 140 },
  ]);
  equal("all four switches start as in the applet", s.options,
    { mode: "chord", names: false, hint: false, statement: false });
  check("an illustration has no win or loss", C.result(s) === null);
  check("the opening picture is drawn", C.geometry(s).valid);
  check("the opening chords are equal, as the page says",
    close(C.geometry(s).ab, C.geometry(s).cd));
  check("start does not mutate when dragged", s.A.x === 126 && s.D.x === 264.6,
    JSON.stringify(s.D));

  const draggedP = C.movePoint(s, "P", { x: 190, y: 100 });
  check("dragging P moves P and re-derives the other end", draggedP.P.x === 190 && draggedP.last === "A");
  check("the old state is untouched by a drag", s.P.x === 210 && s.moves === 0);
  const draggedD = C.movePoint(C.setOption(s, "mode", "circles"), "D", { x: 300, y: 180 });
  check("dragging D re-derives from D", draggedD.D.x === 300 && draggedD.last === "D");
  const snapped = C.movePoint(s, "A", { x: 126, y: 100 });
  check("in chord mode A is snapped back onto circle E",
    close(D(C.geometry(s).E.center, snapped.A), C.geometry(s).E.radius, 1e-6));
  const circleMode = C.setOption(s, "mode", "circles");
  const free = C.movePoint(circleMode, "A", { x: 100, y: 60 });
  check("in circles mode A is not snapped", free.A.x === 100 && free.A.y === 60);
  check("an unknown point is refused", C.movePoint(s, "other", { x: 1, y: 1 }) === s);
  const shown = C.setOption(s, "hint", true);
  check("one switch does not change the others",
    shown.options.hint && !shown.options.names && !s.options.hint);
  check("an unknown option is refused", C.setOption(s, "other", true) === s);
  check("an unknown mode is refused", C.setOption(s, "mode", "other") === s);
  const far = C.movePoint(s, "A", { x: -5000, y: 5000 });
  check("a dragged point stays on the board", far.A.x >= 8 && far.A.x <= 412 && far.A.y <= 272);
}

/* ------------------------------------------ 2. a literal second transcription */

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint), bytecode order. */
function javaCross(a, b, c, d) {
  const r4 = a.y - b.y, r6 = b.x - a.x;
  const c1 = a.x * b.y - a.y * b.x;
  const r10 = c.y - d.y, r12 = d.x - c.x;
  const c2 = c.x * d.y - c.y * d.x;
  const det = r4 * r12 - r10 * r6;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (r6 * c2 - r12 * c1) / det, y: (c1 * r10 - c2 * r4) / det };
}

/* GeoSDoub.FindCircumcenter(a,b,c) and the applet's GetCircle(). */
function javaCircle(a, b, c) {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
  const p1 = { x: m1.x + a.y - b.y, y: m1.y + b.x - a.x };
  const p2 = { x: m2.x + c.y - b.y, y: m2.y + b.x - c.x };
  const center = javaCross(m1, p1, m2, p2);
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) return null;
  return { center, radius: (D(center, a) + D(center, b) + D(center, c)) / 3 };
}

/* GeoSDoub.IntersectX and IntersectY, the applet's two axis branches. */
function javaLineCircleX(a, b, c, r) {
  const m = (a.x - b.x) / (a.y - b.y);
  const k = b.x - m * b.y;
  const px = k - c.x;
  const q = m * px - c.y;
  const A = m * m + 1;
  const B = c.y * c.y + px * px - r * r;
  const disc = q * q - A * B;
  if (disc < 0 || !Number.isFinite(disc)) return null;
  const root = Math.sqrt(disc);
  const u1 = (-q + root) / A, u2 = (-q - root) / A;
  return [{ x: m * u1 + k, y: u1 }, { x: m * u2 + k, y: u2 }];
}
function javaLineCircleY(a, b, c, r) {
  const m = (a.y - b.y) / (a.x - b.x);
  const k = b.y - m * b.x;
  const py = k - c.y;
  const q = m * py - c.x;
  const A = m * m + 1;
  const B = c.x * c.x + py * py - r * r;
  const disc = q * q - A * B;
  if (disc < 0 || !Number.isFinite(disc)) return null;
  const root = Math.sqrt(disc);
  const u1 = (-q + root) / A, u2 = (-q - root) / A;
  return [{ x: u1, y: m * u1 + k }, { x: u2, y: m * u2 + k }];
}
function javaLineCircle(a, b, circle) {
  if (!circle) return null;
  const { center, radius } = circle;
  if (Math.abs(a.y - b.y) > 1) return javaLineCircleX(a, b, center, radius);
  if (Math.abs(a.x - b.x) > 1) return javaLineCircleY(a, b, center, radius);
  return null;
}

/* GeoSDoub.ComputeAngle, FindOrientation, Rotate and ReflectPointInLine. */
function javaSqDist(p, q) { return (p.x - q.x) ** 2 + (p.y - q.y) ** 2; }
function javaAngle(v, p, q) {
  const len = (javaSqDist(v, p) + javaSqDist(v, q) - javaSqDist(p, q)) / 2;
  return Math.acos(len / Math.sqrt(javaSqDist(v, p) * javaSqDist(v, q)));
}
function javaOrientation(a, b, c) {
  const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
  return s > 0 ? 1 : -1;
}
function javaRotate(center, point, theta, turn) {
  const co = Math.cos(theta), si = Math.sin(theta);
  return {
    x: center.x + co * (point.x - center.x) - turn * si * (point.y - center.y),
    y: center.y + turn * si * (point.x - center.x) + co * (point.y - center.y),
  };
}
function javaReflect(p, a, b) {
  const theta = javaAngle(b, p, a);
  const turn = javaOrientation(b, p, a);
  return javaRotate(b, p, 2 * theta, turn);
}

/* The applet's Other(): array[1] only when array[0] is less than 3 from ref. */
function javaOther(points, ref) {
  if (!points) throw new Error("no crossings");
  return D(points[0], ref) < 3 ? points[1] : points[0];
}

/** FixOtherPoint(line through a,b, circle, output); exceptions leave it alone. */
function javaFix(a, b, circle, oldPoint) {
  if (D(a, b) < 1) return oldPoint;
  try {
    return { ...javaOther(javaLineCircle(a, b, circle), b) };
  } catch (e) {
    return oldPoint;
  }
}

/** AMoved() or DMoved() in the exact order of the bytecode. */
function javaDerive(state, from, E, F) {
  const out = { ...state };
  if (from === "D" || from === "Q") {
    out.C = javaFix(state.D, state.P, E, out.C);
    const reflC = javaReflect(out.C, state.P, state.Q);
    out.B = javaFix(reflC, state.P, F, out.B);
    const reflD = javaReflect(state.D, state.P, state.Q);
    out.A = javaFix(reflD, state.P, E, out.A);
  } else {
    out.B = javaFix(state.A, state.P, F, out.B);
    const reflB = javaReflect(out.B, state.P, state.Q);
    out.D = javaFix(reflB, state.P, F, out.D);
    const reflA = javaReflect(state.A, state.P, state.Q);
    out.C = javaFix(reflA, state.P, E, out.C);
  }
  return out;
}

/** Compute() plus TranslateCD() from EqualAnglesInCrossingCirclesCanvas. */
function javaCompute(state) {
  const { P, Q } = state;
  if (D(state.A, P) < 2 || D(state.A, Q) < 2 || D(state.D, P) < 2 ||
      D(state.D, Q) < 2 || D(P, Q) < 2) return null;
  const E = javaCircle(state.A, P, Q);
  const F = javaCircle(state.D, P, Q);
  if (!E || !F) return null;
  const s = javaDerive(state, state.last, E, F);
  let Cp, Dp;
  try {
    const parallel = {
      x: Q.x + 100 * (s.C.x - s.D.x),
      y: Q.y + 100 * (s.C.y - s.D.y),
    };
    Cp = javaOther(javaLineCircle(parallel, Q, E), Q);
    Dp = javaOther(javaLineCircle(parallel, Q, F), Q);
  } catch (e) {
    return null;
  }
  if (![s.A, s.B, s.C, s.D, Cp, Dp].every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) {
    return null;
  }
  return { E, F, A: s.A, B: s.B, C: s.C, D: s.D, Cp, Dp };
}

/* The same set of layouts drives both the transcription and the page claims. */
const configs = [];
function add(P, Q, A, Dpt, last) {
  // Make a reachable position: the applet's last stroke has already synced
  // the other end, so Compare() and Compute() see the same A and D.
  const raw = {
    P, Q, A, D: Dpt,
    options: { mode: "circles", names: false, hint: false, statement: false },
    last, moves: 0,
  };
  configs.push(C.derive(raw, last));
}
{
  const P = { x: 210, y: 112 }, Q = { x: 210, y: 168 };
  add(P, Q, { x: 126, y: 140 }, { x: 250, y: 130 }, "A");
  add(P, Q, { x: 140, y: 80 }, { x: 280, y: 200 }, "D");
  add(P, Q, { x: 150, y: 220 }, { x: 270, y: 70 }, "A");
  add(P, Q, { x: 300, y: 110 }, { x: 120, y: 200 }, "D");
  // Horizontal, vertical and tilted common chords.
  add({ x: 120, y: 140 }, { x: 300, y: 140 }, { x: 180, y: 80 }, { x: 240, y: 200 }, "A");
  add({ x: 210, y: 70 }, { x: 210, y: 210 }, { x: 130, y: 110 }, { x: 290, y: 170 }, "D");
  for (let k = 0; k < 8; k++) {
    const t = k * Math.PI / 8;
    const m = { x: 210, y: 140 }, v = { x: Math.cos(t) * 45, y: Math.sin(t) * 45 };
    add({ x: m.x - v.x, y: m.y - v.y }, { x: m.x + v.x, y: m.y + v.y },
      { x: 120 + k * 8, y: 60 + (k % 3) * 30 },
      { x: 300 - k * 6, y: 200 - (k % 4) * 25 }, k % 2 ? "A" : "D");
  }
}
const rand = rng(20261127);
for (let i = 0; i < 700; i++) {
  const cx = 110 + rand() * 200, cy = 100 + rand() * 90;
  const t = rand() * 2 * Math.PI, r = 20 + rand() * 45;
  add(
    { x: cx - Math.cos(t) * r, y: cy - Math.sin(t) * r },
    { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r },
    { x: 40 + rand() * 340, y: 20 + rand() * 240 },
    { x: 40 + rand() * 340, y: 20 + rand() * 240 },
    rand() < 0.5 ? "A" : "D");
}
// The guards: a short chord and a point nearer than two units to P.
add({ x: 200, y: 130 }, { x: 201, y: 131 }, { x: 120, y: 80 }, { x: 300, y: 200 }, "A");
add({ x: 210, y: 112 }, { x: 210, y: 168 }, { x: 210, y: 113 }, { x: 260, y: 130 }, "A");

{
  let valid = 0, guarded = 0, degenerates = 0, pointMismatch = null, guardMismatch = null;
  for (const s of configs) {
    const expected = javaCompute(s);
    const got = C.geometry(s);
    if (Boolean(expected) !== got.valid) {
      guardMismatch = guardMismatch || `validity at ${JSON.stringify(s)}: java=${!!expected} core=${got.valid}/${got.reason}`;
      continue;
    }
    guarded++;
    if (!expected) continue;
    valid++;
    if (degenerate(got, s)) {
      degenerates++;
      if (![expected.A, expected.B, expected.C, expected.D]
        .some((p) => D(p, s.P) < 3)) {
        pointMismatch = pointMismatch || `tangency missed at ${JSON.stringify(s)}`;
      }
      continue;
    }
    const pairs = [
      ["E", got.E.center, expected.E.center], ["F", got.F.center, expected.F.center],
      ["A", got.A, expected.A], ["B", got.B, expected.B],
      ["C", got.C, expected.C], ["D", got.D, expected.D],
      ["C'", got.translation && got.translation.Cprime, expected.Cp],
      ["D'", got.translation && got.translation.Dprime, expected.Dp],
    ];
    for (const [name, a, b] of pairs) {
      if (!near(a, b, 1e-4)) {
        pointMismatch = pointMismatch || `${name} at ${JSON.stringify(s)}: core=${JSON.stringify(a)} java=${JSON.stringify(b)}`;
      }
    }
    if (!close(got.E.radius, expected.E.radius, 1e-5) ||
        !close(got.F.radius, expected.F.radius, 1e-5)) {
      pointMismatch = pointMismatch || `radii at ${JSON.stringify(s)}`;
    }
  }
  check("the transcription and the core agree on every guard", guarded === configs.length,
    `${guarded}/${configs.length}; ${guardMismatch || ""}`);
  check("the transcription and the core agree point by point", !pointMismatch, pointMismatch || "");
  check("the comparison covered real and invalid layouts", valid > 500 && valid < configs.length - 2,
    `${valid} valid of ${configs.length}`);
  check("tangent degenerate chords are recognised by both", degenerates > 0 && degenerates < valid / 4,
    `${degenerates} tangencies`);
}

/* ----------------------------------------------------- 3. the page's claims */

{
  let valid = 0, chordError = 0, angleA = 0, angleB = 0;
  let projectionError = 0, translatedError = 0, symmetryError = 0, parallelError = 0;
  for (const s of configs) {
    const g = C.geometry(s);
    if (!g.valid || !g.translation || degenerate(g, s)) continue;
    valid++;
    chordError = Math.max(chordError, Math.abs(g.ab - g.cd));
    // A "straight line" has no direction: an angle of π − θ is the same line.
    const undirected = (t) => Math.min(t, Math.PI - t);
    angleA = Math.max(angleA, Math.abs(undirected(g.angles.a) - undirected(g.angles.c)));
    angleB = Math.max(angleB, Math.abs(undirected(g.angles.b) - undirected(g.angles.d)));
    // Hubert Shutrick: each chord is twice the projection of EF onto it.
    projectionError = Math.max(projectionError,
      Math.abs(g.ab - Math.abs(g.projectionAB)), Math.abs(g.cd - Math.abs(g.projectionAB)));
    // The page's earlier problem: a parallel through Q cuts an equal chord.
    translatedError = Math.max(translatedError, Math.abs(g.cpDp - g.cd));
    const dir = { x: g.C.x - g.D.x, y: g.C.y - g.D.y };
    const dir2 = { x: g.translation.Cprime.x - g.translation.Dprime.x,
                   y: g.translation.Cprime.y - g.translation.Dprime.y };
    parallelError = Math.max(parallelError,
      Math.abs(dir.x * dir2.y - dir.y * dir2.x) / (D(g.C, g.D) * D(g.translation.Cprime, g.translation.Dprime)));
    // And C'D' is the mirror of AB in the line of centres, as the page says.
    const mA = C.reflect(g.A, g.lineEF.a, g.lineEF.b);
    const mB = C.reflect(g.B, g.lineEF.a, g.lineEF.b);
    symmetryError = Math.max(symmetryError,
      D(mA, g.translation.Cprime), D(mB, g.translation.Dprime));
  }
  check("AB = CD in every valid configuration", valid > 500 && chordError < 1e-6,
    `${valid} layouts, largest difference ${chordError.toExponential(2)}`);
  check("the two lines make equal angles with PQ, as the claim requires",
    angleA < 1e-6 && angleB < 1e-6,
    `${angleA.toExponential(2)}, ${angleB.toExponential(2)}`);
  check("Shutrick's twice-the-projection formula holds", projectionError < 1e-5,
    projectionError.toExponential(2));
  check("the parallel through Q cuts an equal chord C'D'", translatedError < 1e-5,
    translatedError.toExponential(2));
  check("C'D' is parallel to CD", parallelError < 1e-6, parallelError.toExponential(2));
  check("C'D' is the mirror of AB in the line of centres", symmetryError < 1e-5,
    symmetryError.toExponential(2));
}

/* Different strokes of A and D must give the theorem, not just the opening. */
{
  const s = C.start();
  let worst = 0, strokes = 0;
  for (const mode of ["chord", "circles"]) {
    for (let k = 0; k < 40; k++) {
      let t = C.setOption(s, "mode", mode);
      const name = k % 2 ? "A" : "D";
      t = C.movePoint(t, name, {
        x: 50 + (k * 37) % 320,
        y: 20 + (k * 53) % 240,
      });
      const g = C.geometry(t);
      if (!g.valid || degenerate(g, t)) continue;
      strokes++;
      worst = Math.max(worst, Math.abs(g.ab - g.cd));
    }
  }
  check("the claim survives both modes and many strokes of either end",
    strokes > 60 && worst < 1e-6, `${strokes} strokes, worst ${worst.toExponential(2)}`);
}

done("equal-angles-in-crossing-circles");
