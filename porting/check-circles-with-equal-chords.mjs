#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-with-equal-chords/circles-with-equal-chords-core.js.
 *
 *   node porting/check-circles-with-equal-chords.mjs
 *
 * 1. The start picture, each drag and each display option, and the fact that
 *    an illustration has no win or loss.
 * 2. The applet's own Compute(), transcribed a second time from the bytecode of
 *    CirclesWithEqualChordsCanvas plus GeoSDoub's axis-branch intersection
 *    helpers (javap -c -p), compared with the core over thousands of layouts:
 *    different directions and offsets of L, both circles on either side of L,
 *    equal and unequal radii and every degenerate guard.
 * 3. The page's theorem and its "1, none, infinitely many" claim, checked by an
 *    independent signed-distance calculation over a grid of configurations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circles-with-equal-chords/circles-with-equal-chords-core.js", "CirclesWithEqualChordsCore");

const D = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const pointClose = (p, q, tol = 1e-6) => !!p && !!q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
/* With equal radii the applet's strict `<` may name the two ends the other
   way round; the pair is what carries the geometry. */
const samePair = (a, b, c, d, tol = 1e-5) =>
  (pointClose(a, c, tol) && pointClose(b, d, tol)) ||
  (pointClose(a, d, tol) && pointClose(b, c, tol));

/** A state with a line through L1,L2 and two circles of the given radii. */
function layout(L1, L2, O, r1, O2, r2) {
  return {
    L1, L2, O, R: { x: O.x + r1, y: O.y },
    O2, R2: { x: O2.x + r2, y: O2.y },
    options: { names: false, hint: false }, moves: 0,
  };
}

/* ---------------------------------------------------------------- 1. rules */

{
  const s = C.start();
  equal("start picture", [s.L1, s.L2, s.O, s.R, s.O2, s.R2], [
    { x: 210, y: 35 }, { x: 360, y: 35 }, { x: 126, y: 140 },
    { x: 226, y: 140 }, { x: 294, y: 210 }, { x: 354, y: 210 },
  ]);
  equal("no options are on at the start", s.options, { names: false, hint: false });
  check("an illustration has no win or loss", C.result(s) === null);
  check("the opening layout has a construction", C.geometry(s).solved);
  check("the opening chord lengths are equal, as the theorem says",
    close(C.geometry(s).chord1, C.geometry(s).chord2));
  check("a start is not mutated by a drag", s.O.x === 126 && s.R.x === 226);

  const moved = C.movePoint(s, "L1", { x: 220, y: 35 });
  check("dragging L1 slides L parallel to itself",
    moved.L1.x === 220 && close(moved.L2.x - moved.L1.x, 150));
  check("a drag leaves the old state alone", s.L1.x === 210);
  const turned = C.movePoint(s, "L2", { x: 210, y: 185 });
  check("dragging L2 turns L", close(turned.L2.x - turned.L1.x, 0, 1e-9), JSON.stringify(turned.L2));
  const resized = C.movePoint(s, "R", { x: 126, y: 40 });
  check("R changes the first radius", close(D(resized.O, resized.R), 100));
  check("an unknown point is refused", C.movePoint(s, "other", { x: 1, y: 1 }) === s);
  const shown = C.setOption(s, "hint", true);
  check("the hint switch is independent", shown.options.hint && !shown.options.names && !s.options.hint);
  check("an unknown option is refused", C.setOption(s, "other", true) === s);
  const tiny = C.movePoint(s, "R", { x: 127, y: 140 });
  check("a radius below two is pushed back out", D(tiny.O, tiny.R) >= C.MIN_RADIUS);
}

/* ---------------------------------------- 2. a second, literal transcription */

/* GeoSDoub.NearestPoint(DoubPoint, DoubPoint, DoubPoint), bytecode order. */
function javaFoot(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return p;
  const len2 = dx * dx + dy * dy;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/* GeoSDoub.GetParallelTo: p + 100*(q - r). */
function javaParallel(p, q, r) {
  return { x: p.x + 100 * (q.x - r.x), y: p.y + 100 * (q.y - r.y) };
}

/* GeoSDoub.Intersect(DoubPoint,DoubPoint,DoubPoint,DoubPoint): NaN if |det|<1. */
function javaLineCross(a, b, c, d) {
  const r1x = b.x - a.x, r1y = a.y - b.y;
  const c1 = a.x * b.y - a.y * b.x;
  const r2x = d.x - c.x, r2y = c.y - d.y;
  const c2 = c.x * d.y - c.y * d.x;
  const det = r1y * r2x - r2y * r1x;
  if (Math.abs(det) < 1) return null;
  return { x: (r1x * c2 - r2x * c1) / det, y: (c1 * r2y - c2 * r1y) / det };
}

/* GeoSDoub.IntersectCirclesX/Y, the two axis branches of the applet. */
function javaCircleX(a, ra, b, rb) {
  const m = -(a.y - b.y) / (a.x - b.x);
  const k = (a.x * a.x - b.x * b.x + a.y * a.y - b.y * b.y - ra * ra + rb * rb) / (2 * (a.x - b.x));
  const px = k - a.x;
  const q = m * px - a.y;
  const A = m * m + 1;
  const B = px * px + a.y * a.y - ra * ra;
  const disc = q * q - A * B;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const u1 = (-q + root) / A, u2 = (-q - root) / A;
  return [{ x: m * u1 + k, y: u1 }, { x: m * u2 + k, y: u2 }];
}
function javaCircleY(a, ra, b, rb) {
  const m = -(a.x - b.x) / (a.y - b.y);
  const k = (a.y * a.y - b.y * b.y + a.x * a.x - b.x * b.x - ra * ra + rb * rb) / (2 * (a.y - b.y));
  const py = k - a.y;
  const q = m * py - a.x;
  const A = m * m + 1;
  const B = py * py + a.x * a.x - ra * ra;
  const disc = q * q - A * B;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const u1 = (-q + root) / A, u2 = (-q - root) / A;
  return [{ x: u1, y: m * u1 + k }, { x: u2, y: m * u2 + k }];
}
function javaCircles(a, ra, b, rb) {
  if (Math.abs(a.x - b.x) > 1) return javaCircleX(a, ra, b, rb);
  if (Math.abs(a.y - b.y) > 1) return javaCircleY(a, ra, b, rb);
  // Coincident centres: the applet returns the same point twice.
  return [{ x: a.x, y: a.y }, { x: a.x, y: a.y }];
}

/* GeoSDoub.IntersectX/Y(DoubLine,DoubCircle), again copying the bytecode. */
function javaLineCircleX(a, b, c, r) {
  if (Math.abs(a.y - b.y) <= 1) return null;
  const m = (a.x - b.x) / (a.y - b.y);
  const k = b.x - m * b.y;
  const px = k - c.x;
  const q = m * px - c.y;
  const A = m * m + 1;
  const B = c.y * c.y + px * px - r * r;
  const disc = q * q - A * B;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const u1 = (-q + root) / A, u2 = (-q - root) / A;
  return [{ x: m * u1 + k, y: u1 }, { x: m * u2 + k, y: u2 }];
}
function javaLineCircleY(a, b, c, r) {
  if (Math.abs(a.x - b.x) <= 1) return null;
  const m = (a.y - b.y) / (a.x - b.x);
  const k = b.y - m * b.x;
  const py = k - c.y;
  const q = m * py - c.x;
  const A = m * m + 1;
  const B = c.x * c.x + py * py - r * r;
  const disc = q * q - A * B;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const u1 = (-q + root) / A, u2 = (-q - root) / A;
  return [{ x: u1, y: m * u1 + k }, { x: u2, y: m * u2 + k }];
}
function javaLineCircle(a, b, c, r) {
  if (Math.abs(a.y - b.y) > 1) return javaLineCircleX(a, b, c, r);
  if (Math.abs(a.x - b.x) > 1) return javaLineCircleY(a, b, c, r);
  return null;
}

/** Compute() from CirclesWithEqualChordsCanvas, statement by statement. */
function javaCompute(state) {
  const { L1, L2, O, R, O2, R2 } = state;
  const r1 = D(O, R), r2 = D(O2, R2);
  if (r1 < 2 || r2 < 2) return null;                    // radius guard
  const parallel = javaParallel(O, L1, L2);
  const foot2 = javaFoot(O2, L1, L2);
  if (!(D(O2, foot2) > 1)) return null;                 // O2 is not set
  const T = javaLineCross(O, parallel, O2, foot2);       // O1 ∩ O2
  if (!T || !Number.isFinite(T.x) || !Number.isFinite(T.y)) return null;
  const common = javaCircles(T, r1, O2, r2);             // C(T) ∩ C(O')
  if (!common || D(common[0], common[1]) <= 1) return null;
  const [Cp, Dp] = D(O, common[0]) < D(O, common[1])
    ? [common[0], common[1]] : [common[1], common[0]];
  const onFirst = javaLineCircle(Cp, Dp, O, r1);        // line CD ∩ C(O)
  if (!onFirst) return null;
  const [A, B] = D(O2, onFirst[0]) < D(O2, onFirst[1])
    ? [onFirst[1], onFirst[0]] : [onFirst[0], onFirst[1]];
  return { T, A, B, C: Cp, D: Dp, r1, r2 };
}

/* A spread of layouts: line direction and offset, both circle heights and
   sizes, plus deterministic random ones. The same set drives both sections. */
const configs = [];
for (let a = 0; a < 8; a++) {
  const angle = a * Math.PI / 8;
  const dir = { x: Math.cos(angle) * 150, y: Math.sin(angle) * 150 };
  const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
  for (const off of [-80, -25, 0, 40, 95]) {
    const L1 = { x: 210 + normal.x * off, y: 140 + normal.y * off };
    const L2 = { x: L1.x + dir.x, y: L1.y + dir.y };
    const cases = [
      [126, 95, 100, 294, 195, 60],
      [126, 205, 100, 294, 95, 60],
      [126, 140, 80, 294, 140, 80],
      [130, 70, 120, 280, 215, 45],
      [150, 230, 45, 250, 65, 120],
      [126, 95, 60, 294, 230, 35],
      [126, 95, 100, 126, 195, 100],
    ];
    for (const [ox, oy, rr1, o2x, o2y, rr2] of cases) {
      configs.push(layout(L1, L2, { x: ox, y: oy }, rr1, { x: o2x, y: o2y }, rr2));
    }
  }
}
const rand = rng(20261126);
for (let i = 0; i < 900; i++) {
  const angle = rand() * 2 * Math.PI;
  const L1 = { x: 60 + rand() * 300, y: 40 + rand() * 200 };
  const L2 = { x: L1.x + Math.cos(angle) * 150, y: L1.y + Math.sin(angle) * 150 };
  const r1 = 8 + rand() * 120, r2 = 8 + rand() * 120;
  configs.push(layout(L1, L2,
    { x: 40 + rand() * 340, y: 30 + rand() * 220 }, r1,
    { x: 40 + rand() * 340, y: 30 + rand() * 220 }, r2));
}
// The guards themselves: tiny radii and O' sitting on L.
configs.push(layout({ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 20, y: 80 }, 1,
  { x: 90, y: 150 }, 60));
configs.push(layout({ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 20, y: 80 }, 100,
  { x: 90, y: 0.4 }, 60));
configs.push(layout({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 20, y: 80 }, 1,
  { x: 90, y: 150 }, 1));

{
  let compared = 0, valid = 0, guard = 0, mismatch = null, invalidMismatch = null;
  for (const s of configs) {
    const expected = javaCompute(s);
    const got = C.geometry(s);
    if (Boolean(expected) !== got.valid) {
      invalidMismatch = invalidMismatch || `validity: ${JSON.stringify(s)} applet=${!!expected} core=${got.valid}/${got.reason}`;
      continue;
    }
    guard++;
    if (!expected) continue;
    valid++;
    if (!pointClose(got.T, expected.T, 1e-5)) {
      mismatch = mismatch || `T at ${JSON.stringify(s)}: ${JSON.stringify(got.T)} vs ${JSON.stringify(expected.T)}`;
    }
    if (!samePair(got.C, got.D, expected.C, expected.D)) {
      mismatch = mismatch || `CD at ${JSON.stringify(s)}: ${JSON.stringify([got.C, got.D])} vs ${JSON.stringify([expected.C, expected.D])}`;
    }
    if (!samePair(got.A, got.B, expected.A, expected.B)) {
      mismatch = mismatch || `AB at ${JSON.stringify(s)}: ${JSON.stringify([got.A, got.B])} vs ${JSON.stringify([expected.A, expected.B])}`;
    }
    compared++;
  }
  check("applet's Compute() agrees on every guard", guard === configs.length,
    `${guard}/${configs.length}; ${invalidMismatch || ""}`);
  check("applet's Compute() agrees point by point over all layouts", !mismatch, mismatch || "");
  check("the comparison covered both outcomes", valid > 500 && valid < configs.length - 2,
    `${valid} solved of ${configs.length}`);
}

/* ------------------------------------------------- 3. the page's own claims */

{
  let checked = 0, maxError = 0, collinearError = 0, formulaError = 0;
  for (const s of configs) {
    const g = C.geometry(s);
    if (!g.valid) continue;
    checked++;
    maxError = Math.max(maxError, Math.abs(g.chord1 - g.chord2));
    // A, B, C, D must lie on one line parallel to L.
    const u = { x: s.L2.x - s.L1.x, y: s.L2.y - s.L1.y };
    const ulen = Math.hypot(u.x, u.y);
    const cross = (p, q) => Math.abs((p.x - q.x) * u.y - (p.y - q.y) * u.x) / ulen;
    collinearError = Math.max(collinearError,
      cross(g.A, g.C), cross(g.B, g.C), cross(g.D, g.C),
      cross(g.A, g.B));
    // Signed distances to L: t = (h1+h2)/2 + (r1^2-r2^2)/(2*(h2-h1)).
    const n = { x: -u.y / ulen, y: u.x / ulen };
    const h = (p) => (p.x - s.L1.x) * n.x + (p.y - s.L1.y) * n.y;
    const h1 = h(s.O), h2 = h(s.O2);
    if (Math.abs(h2 - h1) > 1e-6) {
      const t = (h1 + h2) / 2 + (g.r1 * g.r1 - g.r2 * g.r2) / (2 * (h2 - h1));
      const actual = (h(g.C) + h(g.D)) / 2;
      formulaError = Math.max(formulaError, Math.abs(t - actual));
    }
  }
  check("every constructed pair of chords is equal", checked > 500 && maxError < 1e-6,
    `${checked} layouts, largest difference ${maxError.toExponential(2)}`);
  check("A, B, C and D are collinear on a line parallel to L", collinearError < 1e-6,
    collinearError.toExponential(2));
  check("the solution line matches the signed-distance formula", formulaError < 1e-6,
    formulaError.toExponential(2));
}

{
  /* The page: "It may have 1 or no solutions and, in case the two circles are
     equal and the line L is parallel to the line of the centers, infinitely
     many solutions." Count by an independent calculation on a horizontal L. */
  const radii = [12, 30, 60];
  const heights = [-90, -45, 0, 45, 90];
  let one = 0, none = 0, infinite = 0;
  let wrongFinite = 0, wrongInfinite = 0, infiniteHidden = 0, guardHidden = 0;
  for (const h1 of heights) for (const h2 of heights) {
    for (const r1 of radii) for (const r2 of radii) {
      const s = layout({ x: 0, y: 0 }, { x: 150, y: 0 },
        { x: 40, y: -h1 }, r1, { x: 100, y: -h2 }, r2);
      const g = C.geometry(s);
      let kind;
      if (h1 === h2 && r1 === r2) {
        kind = Math.abs(h1) < r1 ? "infinite" : "none";
      } else if (h1 === h2) {
        kind = "none";
      } else {
        const t = (h1 + h2) / 2 + (r1 * r1 - r2 * r2) / (2 * (h2 - h1));
        kind = Math.abs(t - h1) < r1 && Math.abs(t - h2) < r2 ? "one" : "none";
      }
      if (kind === "one") {
        one++;
        // The applet stops when O' is within one unit of L and leaves its
        // perpendicular line unset; that is a guard, not a false claim.
        if (!g.valid && h2 !== 0) wrongFinite++;
        if (!g.valid && h2 === 0) guardHidden++;
      } else if (kind === "infinite") {
        infinite++;
        if (g.valid) wrongInfinite++;
        else infiniteHidden++;
      } else {
        none++;
        if (g.valid) wrongFinite++;
      }
    }
  }
  check("the page is right: one, none or infinitely many", wrongFinite === 0 && wrongInfinite === 0,
    `finite mistakes ${wrongFinite}, infinite mistakes ${wrongInfinite}`);
  check("the finite grid includes all three kinds", one > 0 && none > 0 && infinite > 0,
    `one ${one}, none ${none}, infinite ${infinite}`);
  equal("counts over the signed-distance grid", { one, none, infinite },
    { one: 38, none: 182, infinite: 5 });
  check("the applet's crossing guard cannot draw the infinite case", infiniteHidden === infinite,
    `${infiniteHidden}/${infinite}`);
  check("the applet also skips layouts with O' on L", guardHidden > 0,
    `${guardHidden} finite layouts hidden by the one-unit guard`);
}

done("circles-with-equal-chords");
