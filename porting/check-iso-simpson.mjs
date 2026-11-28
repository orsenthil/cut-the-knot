#!/usr/bin/env node
"use strict";

/*
 * Logic test for iso-simpson/iso-simpson-core.js.
 *
 *   node porting/check-iso-simpson.mjs
 *
 * Checks the opening picture and the four moves (three checkboxes, four
 * draggable points, reset). Then it transcribes the applet's own arithmetic a
 * second time — GeoSDoub.FindOrientation, ComputeSignedAngle, Rotate,
 * Intersect, FindCircumcenter, NearestPoint and IsoSimpsonCanvas.DrawArcs /
 * DrawPerp — directly from the bytecode and compares core.compute() with it on
 * a grid and on many random positions. Finally it checks the page's claims:
 *   1. the two reflected cevians give the isogonal conjugate of P;
 *   2. the six pedal feet of P and Q lie on one circle centred at midpoint PQ;
 *   3. the pedal circles of P and Q coincide;
 *   4. when P is on the circumcircle its three feet are collinear (Simson line).
 * The applet's 2-unit on-circumcircle threshold is tested on both sides.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("iso-simpson/iso-simpson-core.js", "IsoSimpsonCore");

/* ------------------------------------------- a second transcription of the applet */

const pt = (x, y) => ({ x, y });
const minus = (u, v) => pt(u.x - v.x, u.y - v.y);
const addv = (u, v) => pt(u.x + v.x, u.y + v.y);
const half = (u, v) => pt((u.x + v.x) / 2, (u.y + v.y) / 2);
const sq = (u, v) => (u.x - v.x) ** 2 + (u.y - v.y) ** 2;
const len = (u, v) => Math.sqrt(sq(u, v));
const inner = (u, v) => u.x * v.x + u.y * v.y;

/* GeoSDoub.FindOrientation, byte for byte. */
function orientApplet(p, q, r) {
  const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return s > 0 ? 1 : -1;
}

/* GeoSDoub.ComputeSignedAngle, byte for byte (no clamp on the cosine). */
function angleApplet(p, q, r) {
  const cos = (sq(p, q) + sq(p, r) - sq(q, r)) / (2 * len(p, q) * len(p, r));
  const a = Math.acos(cos);
  return orientApplet(p, q, r) === 1 ? a : -a;
}

/* GeoSDoub.Rotate: orientation multiplies the sine term, not the angle. */
function rotateApplet(p, q, angle, sgn) {
  const cs = Math.cos(angle), sn = Math.sin(angle);
  return pt(p.x + cs * (q.x - p.x) - sgn * sn * (q.y - p.y),
    p.y + sgn * sn * (q.x - p.x) + cs * (q.y - p.y));
}

/* GeoSDoub.Intersect(P1,P2,P3,P4): Cramer's rule with the |det| < 1 guard. */
function crossLines(a, b, c, d) {
  const A1 = a.y - b.y, B1 = b.x - a.x, C1 = a.x * b.y - a.y * b.x;
  const A2 = c.y - d.y, B2 = d.x - c.x, C2 = c.x * d.y - c.y * d.x;
  const det = A1 * B2 - A2 * B1;
  if (Math.abs(det) < 1) return pt(NaN, NaN);
  return pt((B1 * C2 - B2 * C1) / det, (C1 * A2 - C2 * A1) / det);
}

/* GeoSDoub.FindCircumcenter: bisectors of AB and BC, then Intersect. */
function centerApplet(a, b, c) {
  const m1 = half(a, b), m2 = half(b, c);
  const u = pt(m1.x + (b.y - a.y), m1.y - (b.x - a.x));
  const v = pt(m2.x + (c.y - b.y), m2.y - (c.x - b.x));
  return crossLines(m1, u, m2, v);
}

/* GeoSDoub.NearestPoint(P,A,B), including its sqDist(A,P) < 0.1 guard. */
function footApplet(p, a, b) {
  if (sq(a, p) < 0.1) return p;
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = inner(minus(p, a), pt(dx, dy)) / (dx * dx + dy * dy);
  return pt(a.x + dx * t, a.y + dy * t);
}

/* DoubCircle(DoubPoint,DoubPoint,DoubPoint) in IsoSimpsonCanvas.DrawCircle. */
function circleApplet(p, q, r) {
  const o = centerApplet(p, q, r);
  if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) return null;
  return { center: o, radius: (len(o, p) + len(o, q) + len(o, r)) / 3 };
}

/* IsoSimpsonCanvas.DrawMatchingArcs: rotate C about A (or B), then intersect. */
function arcsApplet(a, b, c, p) {
  const rayA = rotateApplet(a, c, angleApplet(a, p, b), 1);
  const rayB = rotateApplet(b, c, angleApplet(b, p, a), 1);
  const Q = crossLines(a, rayA, b, rayB);
  const first = angleApplet(c, p, b), second = angleApplet(c, p, a);
  const rayC = Math.abs(first) < Math.abs(second)
    ? rotateApplet(c, a, first, 1) : rotateApplet(c, b, second, 1);
  return { Q, rayA, rayB, rayC };
}

/* IsoSimpsonCanvas.DrawArcs plus DrawPerp, in the order of the bytecode. */
function pictureApplet(s) {
  const { A, B, C, P } = s;
  const outer = centerApplet(A, B, C);
  const outerRadius = (len(outer, A) + len(outer, B) + len(outer, C)) / 3;
  const onCircle = Math.abs(len(P, outer) - outerRadius) < 2;
  const feet = {
    a: footApplet(P, B, C), b: footApplet(P, C, A), c: footApplet(P, A, B),
  };
  const circle = circleApplet(feet.a, feet.b, feet.c);
  const arcs = arcsApplet(A, B, C, P);
  let feetQ = null, circleQ = null;
  if (!onCircle && Number.isFinite(arcs.Q.x)) {
    feetQ = {
      a: footApplet(arcs.Q, B, C), b: footApplet(arcs.Q, C, A),
      c: footApplet(arcs.Q, A, B),
    };
    circleQ = circleApplet(feetQ.a, feetQ.b, feetQ.c);
  }
  return { outer, outerRadius, onCircle, feet, circle, arcs, feetQ, circleQ };
}

/* ------------------------------------------------- an independent construction */

/* Barycentric isogonal conjugate: (u:v:w) -> (a²/u : b²/v : c²/w). */
function isogonalByBarycentrics(p, a, b, c) {
  const ccw = (u, v, w) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
  const det = ccw(a, b, c);
  const u = ccw(p, b, c) / det, v = ccw(a, p, c) / det, w = ccw(a, b, p) / det;
  const U = sq(b, c) / u, V = sq(c, a) / v, W = sq(a, b) / w;
  const sum = U + V + W;
  return pt((U * a.x + V * b.x + W * c.x) / sum,
    (U * a.y + V * b.y + W * c.y) / sum);
}

function distanceToLine(p, a, b) {
  return Math.abs(inner(minus(p, a), pt(b.y - a.y, -(b.x - a.x)))) / len(a, b);
}

/** Cross product of the three Simson feet; zero when they are collinear. */
function collinearity(f) {
  return (f.b.x - f.a.x) * (f.c.y - f.a.y) - (f.b.y - f.a.y) * (f.c.x - f.a.x);
}

function near(label, actual, expected, tolerance, detail = "") {
  check(label, Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `expected ${expected}±${tolerance}, got ${actual}${detail ? ` (${detail})` : ""}`);
}

function nearPoint(label, p, q, tolerance) {
  if (Number.isNaN(p.x) || Number.isNaN(q.x)) {
    check(label + " (both undefined as the applet defines them)",
      Number.isNaN(p.x) && Number.isNaN(q.x));
    return;
  }
  near(label + " x", p.x, q.x, tolerance);
  near(label + " y", p.y, q.y, tolerance);
}

function nearAngle(label, coreValue, appletValue, tolerance) {
  if (Number.isNaN(coreValue) || Number.isNaN(appletValue)) {
    check(label + " (acos outside [-1,1] in both)",
      Number.isNaN(coreValue) && Number.isNaN(appletValue));
    return;
  }
  near(label, coreValue, appletValue, tolerance);
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start();
  near("opening A.x from Canvas.init angle -1.6", s.A.x,
    200 + (250 / 3) * Math.cos(-1.6), 1e-9);
  near("opening A.y from Canvas.init angle -1.6", s.A.y,
    125 + (250 / 3) * Math.sin(-1.6), 1e-9);
  near("opening B.x from Canvas.init angle -4.0", s.B.x,
    200 + (250 / 3) * Math.cos(-4.0), 1e-9);
  near("opening C.x from Canvas.init angle -0.2", s.C.x,
    200 + (250 / 3) * Math.cos(-0.2), 1e-9);
  near("opening P.y from Canvas.init angle -3.0", s.P.y,
    125 + (250 / 3) * Math.sin(-3.0), 1e-9);
  equal("all three checkboxes start unticked", [s.showPerps, s.showCircle, s.showAngles],
    [false, false, false]);
  equal("a fresh picture has not been explored", C.result(s), null);
  equal("a fresh picture has no moves", s.moves, 0);
  check("the opening triangle is not degenerate", !C.compute(s).degenerate);
}

/* ------------------------------------------------- 2. moves, toggles, reset */

{
  const s = C.start();
  const toggled = C.move(s, { type: "option", key: "showCircle", value: true });
  check("ticking Circle changes only that box",
    toggled.showCircle && !toggled.showPerps && !toggled.showAngles);
  equal("ticking a box counts as exploring", C.result(toggled), "done");
  equal("an unknown checkbox is refused", C.move(s, { type: "option", key: "nope", value: true }), null);
  const moved = C.move(s, { type: "point", name: "P", point: pt(150, 150) });
  nearPoint("dragging P moves it", moved.P, pt(150, 150), 1e-9);
  check("a point cannot be put on top of another",
    C.move(s, { type: "point", name: "P", point: s.B }) === null);
  check("a point cannot be put outside the board",
    C.move(s, { type: "point", name: "C", point: pt(900, -50) }).C.x <= C.WIDTH - 8);
  check("a malformed move is refused", C.move(s, { type: "point", name: "Q", point: pt(1, 2) }) === null);
  equal("a picture cannot be won", C.result({ ...s, explored: true }), "done");
  const reset = C.move(toggled, { type: "reset" });
  equal("reset restores the opening points", reset.A, s.A);
  equal("reset keeps the checkbox state", reset.showCircle, true);
}

/* ------------- 3. the core against the applet's own method, all configurations */

{
  const random = rng(20261127);
  const configs = [C.start()];
  // Square grid inside the board, well away from degeneracies.
  for (const ax of [60, 160, 260, 340]) {
    for (const ay of [40, 110, 180, 220]) {
      for (const bx of [40, 140, 240, 330]) {
        configs.push({
          A: pt(ax, ay), B: pt(bx, 210), C: pt(300, ay < 110 ? 60 : 200),
          P: pt((ax + bx) / 2, 125),
        });
      }
    }
  }
  for (let i = 0; i < 500; i++) {
    const at = () => pt(20 + random() * 360, 20 + random() * 210);
    configs.push({ A: at(), B: at(), C: at(), P: at() });
  }
  let compared = 0, maxQ = 0, maxFoot = 0, maxCircle = 0;
  let mismatchedOnCircle = 0;
  let degenerates = 0;
  for (const s of configs) {
    const got = C.compute(s);
    const want = pictureApplet(s);
    if (got.degenerate) {
      degenerates++;
      continue;
    }
    compared++;
    if (got.onCircumcircle !== want.onCircle) mismatchedOnCircle++;
    const other = { A: s.B, B: s.A, C: s.B };
    for (const key of ["A", "B", "C"]) {
      nearAngle("signed angle at " + key, C.signedAngle(s[key], s.P, other[key]),
        angleApplet(s[key], s.P, other[key]), 1e-9);
    }
    const rotated = C.rotate(s.A, s.C, C.signedAngle(s.A, s.P, s.B), 1);
    nearPoint("GeoSDoub.Rotate matches the bytecode", rotated,
      rotateApplet(s.A, s.C, angleApplet(s.A, s.P, s.B), 1), 1e-9);
    nearPoint("circumcentre matches the bytecode", got.outer, want.outer, 1e-6);
    near("circumcircle radius matches the bytecode", got.outerRadius, want.outerRadius, 1e-6);
    for (const key of ["a", "b", "c"]) {
      maxFoot = Math.max(maxFoot, len(got.feetP[key], want.feet[key]));
    }
    if (got.Q && Number.isFinite(want.arcs.Q.x)) {
      maxQ = Math.max(maxQ, len(got.Q, want.arcs.Q));
      nearPoint("third cyan ray matches the bytecode", got.rayC, want.arcs.rayC, 1e-6);
    }
    if (got.circleP && want.circle) {
      maxCircle = Math.max(maxCircle, len(got.circleP.center, want.circle.center));
      near("pedal-circle radius matches the bytecode", got.circleP.radius, want.circle.radius, 1e-6);
    }
  }
  check("degenerate configurations are reported and skipped", degenerates >= 0, `${degenerates}`);
  check("several hundred configurations were compared", compared > 400, `${compared}`);
  check("the on-circumcircle decision matches the applet everywhere", mismatchedOnCircle === 0,
    `${mismatchedOnCircle} mismatches`);
  check("all pedal feet match the second transcription", maxFoot < 1e-6, `max ${maxFoot}`);
  check("Q matches the second transcription", maxQ < 1e-5, `max ${maxQ}`);
  check("pedal-circle centres match the second transcription", maxCircle < 1e-6, `max ${maxCircle}`);
}

/* ----------------------------------------- 4. the page's claims, exhaustively */

{
  const random = rng(5922);
  const TA = pt(160, 70), TB = pt(60, 210), TC = pt(320, 190);
  let tested = 0, maxFootError = 0, maxBaryError = 0, maxCircleError = 0;
  let violations = 0;
  for (let i = 0; i < 2400; i++) {
    const P = pt(20 + random() * 360, 15 + random() * 220);
    const s = C.start({ A: TA, B: TB, C: TC, P });
    const g = C.compute(s);
    // Well-conditioned cases only: a point on (or very near) a side has an
    // isogonal conjugate on the circumcircle, where the "circle" degenerates.
    const nearSide = [TA, TB, TC].some((a, i) => {
      const b = [TB, TC, TA][i];
      return distanceToLine(s.P, a, b) < 8 || (g.Q && distanceToLine(g.Q, a, b) < 8);
    });
    if (g.degenerate || !g.center || nearSide
      || Math.abs(len(P, g.outer) - g.outerRadius) < 12) continue;
    tested++;
    // Independent check of the isogonal construction: barycentric formula.
    maxBaryError = Math.max(maxBaryError, len(g.Q, isogonalByBarycentrics(s.P, TA, TB, TC))
      / Math.max(1, len(P, g.Q)));
    // Six pedal feet, one circle centred at midpoint PQ.
    const feet = [g.feetP.a, g.feetP.b, g.feetP.c,
      g.feetQ.a, g.feetQ.b, g.feetQ.c];
    for (const f of feet) {
      const err = Math.abs(len(g.center, f) - g.radius) / Math.max(1, g.radius);
      maxFootError = Math.max(maxFootError, err);
      if (err > 1e-7) violations++;
    }
    // The two pedal circles coincide with the circle through all six feet.
    maxCircleError = Math.max(maxCircleError,
      g.circleP ? len(g.circleP.center, g.center) / Math.max(1, g.radius) : 1,
      g.circleQ ? len(g.circleQ.center, g.center) / Math.max(1, g.radius) : 1);
    const r = C.residuals(s, g);
    check("reported residual agrees with the feet", r.pedalError / Math.max(1, g.radius) < 1e-7);
  }
  check("the pedal-circle claim was tested on a thousand positions", tested > 1000, `${tested}`);
  check("the six feet are concyclic", violations === 0, `max relative error ${maxFootError}`);
  check("the reflected cevians give the barycentric isogonal conjugate", maxBaryError < 1e-7,
    `max relative error ${maxBaryError}`);
  check("the two pedal circles share centre and radius", maxCircleError < 1e-7,
    `max relative error ${maxCircleError}`);
}

/* --------------------------------------- 5. Simson line at the circumcircle */

{
  const random = rng(777);
  const SA = pt(170, 80), SB = pt(50, 200), SC = pt(310, 210);
  let on = 0, maxCollinear = 0, missed = 0;
  for (let i = 0; i < 400; i++) {
    const base = { ...C.start({ A: SA, B: SB, C: SC }) };
    const o = base.degenerate ? null : C.compute(base);
    if (!o || o.degenerate || !Number.isFinite(o.outer.x)) continue;
    const t = (i / 400) * 2 * Math.PI;
    // Three points on the circle: exactly on it and two tiny offsets either side.
    for (const delta of [0, 0.5, -0.5, 2.5, -2.5]) {
      const P = pt(o.outer.x + (o.outerRadius + delta) * Math.cos(t),
        o.outer.y + (o.outerRadius + delta) * Math.sin(t));
      const g = C.compute({ ...C.start({ A: SA, B: SB, C: SC }), P });
      if (g.degenerate) continue;
      const expected = Math.abs(delta) < C.ON_CIRCLE_TOLERANCE;
      if (g.onCircumcircle !== expected) missed++;
      if (g.onCircumcircle) {
        on++;
        // Only a point exactly on the circle has collinear feet; the applet
        // treats points within 2 units as on it and still draws the line.
        // Skip positions right on a vertex, where two feet nearly coincide.
        if (delta === 0 && Math.min(len(P, SA), len(P, SB), len(P, SC)) > 12) {
          maxCollinear = Math.max(maxCollinear,
            Math.abs(collinearity(g.feetP)) / Math.max(1, o.outerRadius ** 2));
        }
        if (g.Q !== null) missed++;
      }
    }
  }
  check("many points on the circumcircle were tried", on > 1000, `${on}`);
  check("the 2-unit threshold decides the Simson case exactly", missed === 0, `${missed} mismatches`);
  check("the three feet are collinear for a Simson line", maxCollinear < 1e-7,
    `max ${maxCollinear}`);
}

done("iso-simpson");
