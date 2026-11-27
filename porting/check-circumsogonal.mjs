#!/usr/bin/env node
"use strict";

/*
 * Logic test for circumsogonal/circumsogonal-core.js.
 *
 *   node porting/check-circumsogonal.mjs
 *
 * The illustration has no finite set of positions, so the test sweeps: 400
 * random triangles with 20 points P each, P on a 72-step tour of the circle,
 * and the applet's opening picture. It checks that each drawn line really is
 * the reflection of VP in the bisector (against an independent reflection),
 * that the three lines are concurrent off the circle and the meeting point is
 * the isogonal conjugate from its barycentric formula, that conjugating twice
 * gives P back, and that on the circle the three lines are parallel. A second
 * transcription of DrawMatchingArcs and DrawArcs is compared with the core.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circumsogonal/circumsogonal-core.js", "CircumsogonalCore");
const rand = rng(7);

/* An independent reflection of line VP in the bisector at V. */
function reflectedDir(V, P, X, Y) {
  const unit = (p) => { const d = Math.hypot(p.x - V.x, p.y - V.y); return { x: (p.x - V.x) / d, y: (p.y - V.y) / d }; };
  const u = unit(X), w = unit(Y), b = { x: u.x + w.x, y: u.y + w.y };
  const bl = Math.hypot(b.x, b.y); b.x /= bl; b.y /= bl;
  const p = unit(P), k = 2 * (p.x * b.x + p.y * b.y);
  return { x: k * b.x - p.x, y: k * b.y - p.y };
}
const parallelTo = (V, R, d) => {
  const ux = R.x - V.x, uy = R.y - V.y;
  return Math.abs(ux * d.y - uy * d.x) / Math.hypot(ux, uy) < 1e-7;
};

function randomTriangle() {
  for (;;) {
    const pt = () => ({ x: 60 + rand() * 280, y: 30 + rand() * 190 });
    const s = { A: pt(), B: pt(), C: pt(), P: pt() };
    const area = Math.abs(C.cross(s.A, s.B, s.C)) / 2;
    const sides = [C.distance(s.A, s.B), C.distance(s.B, s.C), C.distance(s.C, s.A)];
    if (area > 2000 && Math.min(...sides) > 40) return s;
  }
}

/* ------------------------------------------------------------ 1. the rules */

{
  const s = C.start({});
  check("an illustration is never over", C.result(s) === null);
  const m = C.measurements(s);
  equal("opening radius is floor(min(400, 250) / 3)", Math.round(m.circle.r * 1e6) / 1e6, 83);
  check("the applet opens with P on the circumcircle", m.onCircle && m.gap < 1e-9);
  check("so it draws no Q", m.Q === null);
  check("and marks two angles at C instead", m.parallelArcs.length === 2);
  check("the opening lines are parallel", C.claims(s).parallel);
  const moved = C.withPoint(s, "P", { x: s.P.x + 30, y: s.P.y });
  check("withPoint leaves the old position alone", s.P.x !== moved.P.x);
  check("moving P off the circle gives a Q", C.measurements(moved).Q !== null);
  const shifted = C.shiftTriangle(s, 10, -5);
  check("shifting the triangle keeps P", shifted.P.x === s.P.x && shifted.A.x === s.A.x + 10);
  check("a flat triangle is degenerate", C.isDegenerate({ A: { x: 0, y: 0 }, B: { x: 1, y: 1 }, C: { x: 2, y: 2 }, P: s.P }));
}

/* ------------------------------------------- 2. every case, where it is small */

{
  let reflections = 0, badReflect = 0, concurrent = 0, notConcurrent = 0;
  let conjOk = 0, conjBad = 0, involution = 0, involutionBad = 0;
  for (let t = 0; t < 400; t++) {
    const tri = randomTriangle();
    for (let k = 0; k < 20; k++) {
      const P = { x: 20 + rand() * 360, y: 10 + rand() * 230 };
      const s = { ...tri, P };
      const m = C.measurements(s);
      const L = m.lines;
      for (const [l, V, X, Y] of [[L.A, s.A, s.B, s.C], [L.B, s.B, s.A, s.C], [L.C, s.C, s.A, s.B]]) {
        reflections++;
        if (!parallelTo(V, l.R, reflectedDir(V, P, X, Y))) badReflect++;
      }
      if (m.onCircle || m.Q === null) continue;
      const cl = C.claims(s);
      if (cl.concurrent) concurrent++; else notConcurrent++;
      const exact = C.conjugate(s, P);
      const scale = C.distance(s.A, s.B) + C.distance(s.B, s.C);
      if (exact && C.distance(exact, m.Q) <= 1e-6 * Math.max(scale, C.distance(m.Q, s.A))) conjOk++; else conjBad++;
      if (exact && Math.hypot(exact.x, exact.y) < 1e5) {
        const back = C.conjugate(s, exact);
        if (back && C.distance(back, P) < 1e-6 * scale) involution++; else involutionBad++;
      }
    }
  }
  check(`each of ${reflections} drawn lines is the reflection of VP in the bisector`, badReflect === 0, `${badReflect} wrong`);
  check(`off the circle the three lines meet (${concurrent} cases)`, notConcurrent === 0 && concurrent > 7000, `${notConcurrent} not concurrent`);
  check(`Q is the barycentric isogonal conjugate (${conjOk} cases)`, conjBad === 0, `${conjBad} differ`);
  check(`conjugating Q gives P back (${involution} cases)`, involutionBad === 0 && involution > 7000, `${involutionBad} differ`);
}

{
  // P on the circumcircle: the three lines are parallel, all the way round.
  let parallel = 0, notParallel = 0, flagged = 0;
  for (let t = 0; t < 100; t++) {
    const tri = randomTriangle();
    const circ = C.circle(tri);
    for (let i = 0; i < 72; i++) {
      const a = (2 * Math.PI * i) / 72;
      const P = { x: circ.center.x + circ.r * Math.cos(a), y: circ.center.y + circ.r * Math.sin(a) };
      if (Math.min(C.distance(P, tri.A), C.distance(P, tri.B), C.distance(P, tri.C)) < 3) continue;
      const s = { ...tri, P };
      const m = C.measurements(s);
      if (m.onCircle) flagged++;
      const L = m.lines;
      const worst = Math.max(C.lineAngle(s.A, L.A.R, s.B, L.B.R), C.lineAngle(s.A, L.A.R, s.C, L.C.R));
      if (worst < 1e-6) parallel++; else notParallel++;
    }
  }
  check(`P on the circle makes the three lines parallel (${parallel} cases)`, notParallel === 0 && parallel > 6000, `${notParallel} not parallel`);
  check("and the applet's 2-pixel test sees every one of them on the circle", flagged === parallel);
}

{
  // Just off the circle the lines still meet, far away: the conjugate runs to infinity.
  const s0 = C.start({});
  const circ = C.circle(s0);
  const far = [];
  for (const d of [40, 20, 10, 5, 2.5]) {
    const dir = { x: (s0.P.x - circ.center.x) / circ.r, y: (s0.P.y - circ.center.y) / circ.r };
    const P = { x: s0.P.x + dir.x * d, y: s0.P.y + dir.y * d };
    const Q = C.measurements({ ...s0, P }).Q;
    far.push(Q ? C.distance(Q, circ.center) : Infinity);
  }
  check("Q runs off further as P nears the circle", far.every((v, i) => i === 0 || v > far[i - 1]), far.map((v) => v.toFixed(0)).join(" < "));
}

{
  // The math section's examples: I is its own conjugate; O and H swap.
  let ok = 0;
  for (let t = 0; t < 200; t++) {
    const s = randomTriangle();
    const a = C.distance(s.B, s.C), b = C.distance(s.C, s.A), c = C.distance(s.A, s.B);
    const I = { x: (a * s.A.x + b * s.B.x + c * s.C.x) / (a + b + c), y: (a * s.A.y + b * s.B.y + c * s.C.y) / (a + b + c) };
    const O = C.circumcenter(s.A, s.B, s.C);
    const H = { x: s.A.x + s.B.x + s.C.x - 2 * O.x, y: s.A.y + s.B.y + s.C.y - 2 * O.y };
    const tol = 1e-6 * (a + b + c);
    const qi = C.conjugate(s, I), qo = C.conjugate(s, O);
    if (qi && qo && C.distance(qi, I) < tol && C.distance(qo, H) < tol) ok++;
  }
  check("the incenter is its own conjugate and O, H are conjugates (200 triangles)", ok === 200, `${ok}`);
}

/* ----------------------------- 3. the same answers as the applet's own method */

{
  // DrawArcs, transcribed again: DrawArc(V, P, X) is ComputeSignedAngle(V, P, X),
  // then GeoSDoub.Rotate(V, Y, angle, 1); Intersect(A, R_A, B, R_B) for Q.
  const orient = (p, q, r) => (r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y > 0 ? 1 : -1);
  const sAngle = (o, p, q) => {
    const a = Math.hypot(p.x - o.x, p.y - o.y), b = Math.hypot(q.x - o.x, q.y - o.y), c = Math.hypot(p.x - q.x, p.y - q.y);
    return orient(o, p, q) * Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b))));
  };
  const rot = (p, q, ang) => ({
    x: p.x + Math.cos(ang) * (q.x - p.x) - Math.sin(ang) * (q.y - p.y),
    y: p.y + Math.sin(ang) * (q.x - p.x) + Math.cos(ang) * (q.y - p.y),
  });
  let same = 0, differ = 0;
  for (let t = 0; t < 2000; t++) {
    const s = randomTriangle();
    const m = C.measurements(s);
    const RA = rot(s.A, s.C, sAngle(s.A, s.P, s.B));
    const RB = rot(s.B, s.C, sAngle(s.B, s.P, s.A));
    const useB = Math.abs(sAngle(s.C, s.P, s.B)) < Math.abs(sAngle(s.C, s.P, s.A));
    const RC = useB ? rot(s.C, s.A, sAngle(s.C, s.P, s.B)) : rot(s.C, s.B, sAngle(s.C, s.P, s.A));
    const ok = C.distance(RA, m.lines.A.R) < 1e-9 && C.distance(RB, m.lines.B.R) < 1e-9 &&
      C.distance(RC, m.lines.C.R) < 1e-9;
    if (ok) same++; else differ++;
  }
  check(`the second transcription agrees on ${same} positions`, differ === 0, `${differ} differ`);
}

done("circumsogonal");
