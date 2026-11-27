#!/usr/bin/env node
"use strict";

/*
 * Logic test for circum-quadri/circum-quadri-core.js.
 *
 *   node porting/check-circum-quadri.mjs
 *
 * Checked: CircumQuadriCanvas.init's starting circle and four touch points;
 * the applet's own FindCircumcenter / GetTangent / GeoSDoub.Intersect
 * transcribed a second time from the bytecode and compared with the core on
 * fixed and 800 random arrangements; the trig formula for a tangent corner as
 * a third, independent computation; every claim on the applet's page
 * (sides tangent, diagonals and touch-point chords concurrent, EG cuts AC in
 * the ratio AE/CG and FH cuts BD in AH/CF) over 800 random arrangements;
 * moves, Reset, and the degenerate |det| < 1 cases the applet refuses to
 * draw. An illustration has no result.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circum-quadri/circum-quadri-core.js", "CircumQuadriCore");
const NAMES = C.NAMES;

const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => C.isFinitePoint(p) && C.isFinitePoint(q) &&
  close(p.x, q.x, tol) && close(p.y, q.y, tol);
/* GeoSDoub.Intersect writes (NaN, NaN) for |det| < 1: both answers may be
   unusable, and the applet simply draws nothing in that case. */
const samePoint = (p, q, tol) => C.isFinitePoint(p) && C.isFinitePoint(q)
  ? closePoint(p, q, tol) : !C.isFinitePoint(p) && !C.isFinitePoint(q);

/** Put the four touch points at chosen angles on the starting circle. */
function angleState(angles, options) {
  const base = C.start(options);
  const points = {};
  angles.forEach((a, i) => { points[NAMES[i]] = C.pointOnCircle(base.circle, a); });
  return C.start({ ...(options || {}), points, circle: base.circle });
}

/* -------------------------------- the applet's own math, transcribed again */

/* GeoSDoub.Intersect(DoubPoint x4): a1,b1,c1 / a2,b2,c2, |det| < 1 -> NaN. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * c2 - b2 * c1) / det, y: (c1 * a2 - c2 * a1) / det };
}

/* CircumQuadriCanvas.GetCircle(A,B,C), from GeoSDoub.FindCircumcenter. */
function appletCircle(A, B, Cc) {
  const m1 = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const m2 = { x: (B.x + Cc.x) / 2, y: (B.y + Cc.y) / 2 };
  const perp1 = { x: m1.x + (B.y - A.y), y: m1.y - (B.x - A.x) };
  const perp2 = { x: m2.x + (Cc.y - B.y), y: m2.y - (Cc.x - B.x) };
  const center = appletIntersect(m1, perp1, m2, perp2);
  const radius = (dist(center, A) + dist(center, B) + dist(center, Cc)) / 3;
  return { center, radius };
}

/* CircumQuadriCanvas.GetTangent(P): line through P and P + rotated radius. */
function appletTangentPoint(P, circle) {
  return { x: P.x - (P.y - circle.center.y), y: P.y + (P.x - circle.center.x) };
}

/* DrawConfiguration: tA&cap;tB, tB&cap;tC, tC&cap;tD, tD&cap;tA. */
function appletVertices(points, circle) {
  const along = NAMES.map((n) => appletTangentPoint(points[n], circle));
  return NAMES.map((n, i) => {
    const j = (i + 1) % 4;
    return appletIntersect(points[n], along[i], points[NAMES[j]], along[j]);
  });
}

/* DrawConfiguration's red diagonals and blue chords. */
function appletLines(points, circle) {
  const v = appletVertices(points, circle);
  return {
    vertices: v,
    diagonals: [[v[0], v[2]], [v[1], v[3]]],
    chords: [[points.A, points.C], [points.B, points.D]],
    halfSides: [
      [points.A, v[3]], [points.A, v[0]], [points.B, v[0]], [points.B, v[1]],
      [points.C, v[1]], [points.C, v[2]], [points.D, v[2]], [points.D, v[3]],
    ],
  };
}

/* Three independent computations agree: applet Intersect, core Intersect and
   the trigonometric intersection of tangents P(mid-angle) at r/cos(half-gap). */
function trigVertex(angles, circle, i) {
  const j = (i + 1) % 4;
  const gap = angles[j] - angles[i];
  if (Math.abs(Math.cos(gap / 2)) < 1e-3) return { x: NaN, y: NaN };
  const mid = (angles[i] + angles[j]) / 2;
  const length = circle.radius / Math.cos(gap / 2);
  return {
    x: circle.center.x + length * Math.cos(mid),
    y: circle.center.y + length * Math.sin(mid),
  };
}

function distToLine(p, a, b) {
  const n = dist(a, b);
  return n > 0 ? Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / n : Infinity;
}
function near(a, b, tol) {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

/* ------------------------------------------------------- 1. the starting diagram */

{
  const s = C.start();
  equal("the default canvas is 400 by 250", [s.width, s.height], [400, 250]);
  check("the applet's circle has centre (200,125) and radius 62.5",
    closePoint(s.circle.center, { x: 200, y: 125 }, 1e-9) && close(s.circle.radius, 62.5, 1e-9));
  const expected = C.start().circle;
  NAMES.forEach((n, i) => {
    const a = C.START_ANGLES[i];
    const p = { x: 200 + 62.5 * Math.cos(a), y: 125 + 62.5 * Math.sin(a) };
    check(`${n} starts at angle ${C.START_ANGLES[i]} from init()`, closePoint(s.points[n], p, 1e-9));
  });
  check("A starts right of centre at angle 0", close(s.points.A.x, 262.5, 1e-9) && close(s.points.A.y, 125, 1e-9));
  const fromApplet = appletCircle(s.points.A, s.points.B, s.points.C);
  check("GetCircle(A,B,C) gives the starting circle",
    closePoint(fromApplet.center, s.circle.center, 1e-7) && close(fromApplet.radius, s.circle.radius, 1e-7));
  check("the applet's unused Math.random() call does not change the start",
    NAMES.every((n) => closePoint(s.points[n], C.start().points[n], 0)));
  check("the check starts off", !s.checked);
  check("an illustration has no result", C.result(s) === null);
  check("the starting diagram is not finished", C.describe(s).indexOf("press Check") > 0);
  check("the starting diagram satisfies the page claims",
    Object.values(C.claims(s)).every(Boolean));
  equal("the applet draws two diagonals and two touch-point chords",
    [C.diagonals(s).length, C.chords(s).length], [2, 2]);
}

/* ---------------------------------- 2. moves, Reset and the Check button */

{
  const s = C.start();
  const moved = C.move(s, "B", { x: 0, y: 0 });
  check("move does not change the old position", s.points.B.x === C.start().points.B.x);
  check("move keeps the dot on the circle", close(dist(moved.points.B, moved.circle.center), 62.5, 1e-9));
  check("move preserves the angle of the new position",
    close(Math.atan2(moved.points.B.y - 125, moved.points.B.x - 200),
      Math.atan2(-125, -200), 1e-9));
  check("move with an unknown name leaves the position alone", C.move(s, "Z", { x: 1, y: 2 }) === s);
  check("move with a non-finite point leaves the position alone",
    C.move(s, "A", { x: NaN, y: 3 }) === s && C.move(s, "A", null) === s);
  check("move towards the centre picks a definite point on the circle",
    C.isFinitePoint(C.move(s, "A", { x: 200, y: 125 }).points.A));

  const checked = C.check(s);
  check("Check sets checked without changing the geometry",
    checked.checked && !s.checked && dist(checked.points.A, s.points.A) === 0);
  check("Check is idempotent", C.check(checked) === checked);
  check("checked status announces the theorem", /meet at one point/.test(C.describe(checked)));
  check("moving after a check clears it", !C.move(checked, "C", { x: 100, y: 20 }).checked);
  const r = C.reset(checked);
  check("Reset restores the four starting points", NAMES.every((n) => closePoint(r.points[n], s.points[n], 0)));
  check("Reset clears the check", !r.checked);
}

/* -------------- 3. the applet's computation against the core, over arrangements */

{
  const rand = rng(4821);
  const trials = [
    ["start", C.start()],
    ["square on the circle", angleState([0, Math.PI / 2, Math.PI, 3 * Math.PI / 2])],
    ["tight cluster", angleState([0.1, 0.2, 0.3, 0.4])],
    ["crossed order", angleState([0, 2.9, 1.2, 4.5])],
    ["near-parallel tangents", angleState([0, Math.PI - 1e-7, 1.7, 4.2])],
  ];
  for (let t = 0; t < 800; t++) {
    const angles = Array.from({ length: 4 }, () => rand() * 2 * Math.PI);
    trials.push([`random ${t}`, angleState(angles)]);
  }

  let compared = 0, mismatches = 0, trigMismatches = 0, trigCompared = 0;
  for (const [label, s] of trials) {
    const m = C.measurements(s);
    const ap = appletLines(s.points, s.circle);
    const tol = 1e-7 * Math.max(1, 4 * s.circle.radius);
    ap.vertices.forEach((p, i) => {
      if (!samePoint(m.vertices[i], p, tol)) {
        mismatches++;
        if (mismatches < 4) check(`${label}: vertex ${i} is the applet's Intersect`, false,
          `applet ${JSON.stringify(p)}, core ${JSON.stringify(m.vertices[i])}`);
      }
    });
    const linePairs = [
      ["diagonal V0V2", m.diagonals[0], ap.diagonals[0]],
      ["diagonal V1V3", m.diagonals[1], ap.diagonals[1]],
      ["chord AC", m.chords[0], ap.chords[0]],
      ["chord BD", m.chords[1], ap.chords[1]],
    ];
    m.halfSides.forEach((line, i) => linePairs.push([`half side ${i}`, line, ap.halfSides[i]]));
    for (const [what, mine, theirs] of linePairs) {
      if (!samePoint(mine[0], theirs[0], tol) || !samePoint(mine[1], theirs[1], tol)) {
        mismatches++;
        if (mismatches < 4) check(`${label}: core draws the applet's ${what}`, false);
      }
    }
    compared++;
  }
  check(`core and applet agree on ${compared} configurations`, compared === trials.length && mismatches === 0);

  // The same corners a third way, straight from the angles and the radius.
  for (const [label, s] of trials) {
    const angles = NAMES.map((n) => Math.atan2(s.points[n].y - s.circle.center.y,
      s.points[n].x - s.circle.center.x));
    for (let i = 0; i < 4; i++) {
      const t = trigVertex(angles, s.circle, i);
      const mine = C.measurements(s).vertices[i];
      if (!C.isFinitePoint(t)) continue;
      trigCompared++;
      if (!closePoint(t, mine, 1e-7 * Math.max(1, 4 * s.circle.radius))) {
        trigMismatches++;
        if (trigMismatches < 4) check(`${label}: vertex ${i} from the tangent formula`, false);
      }
    }
  }
  check(`the trig formula agrees on ${trigCompared} corners`, trigCompared > 3000 && trigMismatches === 0);
}

/* ------------------------------------------- 4. the claims on the applet's page */

{
  const rand = rng(1994);
  const trials = [C.start(), angleState([0, 1, 2, 3]), angleState([0, 2, 1, 3])];
  for (let t = 0; t < 800; t++) {
    trials.push(angleState(Array.from({ length: 4 }, () => rand() * 2 * Math.PI)));
  }
  let usable = 0, bad = 0, ratioBad = 0, worst = 0, ratiosTested = 0;
  for (const s of trials) {
    const m = C.measurements(s);
    const cl = C.claims(s);
    const tol = m.tolerance;
    if (!(cl.onCircle && cl.tangentsTouch)) {
      bad++;
      if (bad < 4) check("touch points lie on the circle and tangents touch", false);
    }
    if (!m.finite) continue; // near-parallel tangents: the applet draws nothing
    if (!(cl.sidesTouch && cl.concurrent)) {
      bad++;
      if (bad < 4) check("the four sides touch the circle and the four lines concur", false,
        JSON.stringify(cl));
    }
    if (!cl.concurrent) continue;
    usable++;
    worst = Math.max(worst, m.concurrent.error / (4 * s.circle.radius));
    // A null ratio means the chord and the diagonal are truly parallel, so
    // the page's ratio is not defined there; false means the claim failed.
    for (const key of ["splitsAC", "splitsBD"]) {
      if (cl[key] === null) continue;
      ratiosTested++;
      if (!cl[key]) {
        ratioBad++;
        if (ratioBad < 4) check(`${key} from the page's proof`, false, JSON.stringify(cl));
      }
    }
  }
  check(`the four lines concur on ${usable} configurations`, usable > 750 && bad === 0);
  check(`the page's ratio EG:AC = AE:CG and FH:BD = AH:CF hold in ${ratiosTested} measurable cases`,
    ratiosTested > 1500 && ratioBad === 0);
  check("the common point is exact to working precision", worst < 1e-7, `worst ${worst}`);

  // Independent concurrency: intersect the two chords, then measure the two
  // diagonals against that point without using the core's concurrency().
  let independent = 0, independentBad = 0;
  for (const s of trials) {
    const m = C.measurements(s);
    if (!m.finite) continue;
    const M = appletIntersect(m.chords[0][0], m.chords[0][1], m.chords[1][0], m.chords[1][1]);
    if (!C.isFinitePoint(M)) continue;
    independent++;
    const err = Math.max(distToLine(M, ...m.diagonals[0]), distToLine(M, ...m.diagonals[1]));
    if (err > 1e-7 * 4 * s.circle.radius) {
      independentBad++;
      if (independentBad < 4) check("the diagonals pass through the chords' crossing", false, `${err}`);
    }
    if (C.isFinitePoint(m.concurrent?.point)) {
      check("the independent crossing and the core's point agree",
        closePoint(M, m.concurrent.point, 1e-7 * 4 * s.circle.radius));
    }
  }
  check(`an independent computation finds the meeting point on ${independent} configurations`,
    independent > 750 && independentBad === 0);
}

/* ------------------------------------------ 5. degenerate diagrams are safe */

{
  const s = angleState([0, Math.PI - 1e-9, 1.4, 4.0]);
  const m = C.measurements(s);
  check("antipodal touch points make a near-parallel pair of tangents", !m.finite);
  check("the page's claims are simply false there, not crash",
    !C.claims(s).finiteVertices && !C.claims(s).concurrent);
  check("the status asks the player to move a dot away", /Move a dot away/.test(C.describe(s)));
  check("a degenerate diagram still has no result", C.result(s) === null);
  const repeated = C.start({ points: { A: { x: 1, y: 1 }, B: { x: 1, y: 1 },
    C: { x: 5, y: 1 }, D: { x: 1, y: 5 } } });
  check("a repeated point gives a degenerate circle but no crash",
    Number.isNaN(repeated.circle.radius) && typeof C.describe(repeated) === "string");
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("circum-quadri");
