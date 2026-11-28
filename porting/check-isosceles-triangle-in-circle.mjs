#!/usr/bin/env node
"use strict";

/*
 * Logic test for isosceles-triangle-in-circle/isosceles-triangle-in-circle-core.js.
 *
 *   node porting/check-isosceles-triangle-in-circle.mjs
 *
 * Checked: the starting corners and every derived point against a second,
 * literal transcription of IsoscelesTriangleInCircleCanvas.Compute, Midpoint,
 * Average, GetCircumcircle, NearestPoint and CheckFinished; the page's exact
 * claim (EO ⟂ CD iff AB = AC) on a 4×4×4×4×4×4 lattice, 1200 random triangles
 * and a family of true isosceles triangles; the identity
 * (E−O)·(D−C) = (AC²−AB²)/6; the page's "both are equivalent to AO ⟂ BC";
 * the altitude/median claim; the strict one-pixel CheckFinished boundary;
 * option changes, immutability and degenerate input.
 *
 * The claim is true for every nondegenerate triangle, including obtuse ones.
 * If A, B and C are collinear the applet has no circumcenter, so the claim is
 * undefined and the port says so rather than pretending to prove it.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("isosceles-triangle-in-circle/isosceles-triangle-in-circle-core.js", "IsoscelesTriangleInCircleCore");

const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (p, q) => p.x * q.x + p.y * q.y;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => !!p && !!q && close(p.x, q.x, tol) && close(q.y, p.y, tol);
const cross = (p, q) => p.x * q.y - p.y * q.x;
const state = (A, B, Cc, opts = {}) => C.start({ A, B, C: Cc, ...opts });
const area2 = (A, B, Cc) => cross(sub(B, A), sub(Cc, A));

/* ---------------------- a second, literal transcription of the applet's code */

/* IsoscelesTriangleInCircleCanvas.Midpoint */
const aMid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/* IsoscelesTriangleInCircleCanvas.Average */
const aAvg = (p, q, r) => ({ x: (p.x + q.x + r.x) / 3, y: (p.y + q.y + r.y) / 3 });

/* GeoSDoub.FindCircumcenter, solved from the two perpendicular bisectors:
   (B-A)·X = (B-A)·mid(A,B) and (C-B)·X = (C-B)·mid(B,C). The applet's
   GeoSDoub.Intersect treats |det| < 1 as parallel. */
function aCircumcenter(A, B, Cc) {
  const r = sub(B, A), s = sub(Cc, B);
  const m1 = aMid(A, B), m2 = aMid(B, Cc);
  const b1 = dot(r, m1), b2 = dot(s, m2);
  const det = r.x * s.y - r.y * s.x;
  if (!Number.isFinite(det) || Math.abs(det) < 1) return { x: NaN, y: NaN };
  return { x: (b1 * s.y - b2 * r.y) / det, y: (r.x * b2 - s.x * b1) / det };
}

/* GeoSDoub.NearestPoint(p,a,b) — the foot H in Compute() */
function aNearestPoint(p, a, b) {
  const d = sub(b, a);
  const len2 = dot(d, d);
  if (len2 === 0) return { x: a.x, y: a.y };
  return { x: a.x + d.x * dot(sub(p, a), d) / len2,
    y: a.y + d.y * dot(sub(p, a), d) / len2 };
}

/* IsoscelesTriangleInCircleCanvas.Compute, in the bytecode's own order */
function aCompute(A, B, Cc) {
  const D = aMid(A, B);
  const E = aAvg(A, D, Cc);
  const P = aAvg(A, B, Cc);
  const O = aCircumcenter(A, B, Cc);
  const finiteO = Number.isFinite(O.x) && Number.isFinite(O.y);
  const radius = finiteO
    ? (dist(O, A) + dist(O, B) + dist(O, Cc)) / 3 : NaN;
  const M = aMid(B, Cc);
  const Am = aMid(Cc, D);
  const S = aMid(D, A);
  const F = aMid(A, Cc);
  const H = aNearestPoint(A, B, Cc);
  return { D, E, P, O, radius, M, Am, S, F, H };
}

/* CheckFinished(): dcmpg with 1 means the finishing test is strict < 1. */
const aFinished = (A, B, Cc) => Math.abs(dist(A, B) - dist(A, Cc)) < 1;

/* ------------------------------------------- 1. the opening configuration */

{
  const s = C.start();
  check("start A is width/1.5, height/3.5", closePoint(s.A, { x: 400 / 1.5, y: 250 / 3.5 }, 1e-9));
  check("start B is width/6, 5*height/6", closePoint(s.B, { x: 400 / 6, y: 250 * 5 / 6 }, 1e-9));
  check("start C is 5*width/6 at B's height", closePoint(s.C, { x: 400 * 5 / 6, y: 250 * 5 / 6 }, 1e-9));
  const a = aCompute(s.A, s.B, s.C);
  const m = C.measure(s);
  check("start D matches Midpoint(A,B)", closePoint(m.D, a.D, 1e-9));
  check("start E matches Average(A,D,C)", closePoint(m.E, a.E, 1e-9));
  check("start P matches Average(A,B,C)", closePoint(m.P, a.P, 1e-9));
  check("start O matches FindCircumcenter", closePoint(m.O, a.O, 1e-9));
  check("start circumcircle radius is the mean radius", close(m.circle.radius, a.radius, 1e-9));
  for (const name of ["M", "Am", "S", "F", "H"]) {
    check(`start ${name} matches Compute`, closePoint(m[name], a[name], 1e-9));
  }
  equal("the three checkboxes start unticked (page's first applet)",
    [s.showNames, s.showPremise, s.showHint], [false, false, false]);
  check("an illustration has no win or loss", C.result(s) === null);
  check("the start triangle is not isosceles to within a pixel", !C.finished(s));
  check("the page's claim holds at the start", C.claims(s).all);
  check("the dot-product identity holds at the start", close(m.dot, m.predicted, 1e-9));
  const dotIsosceles = aFinished(s.A, s.B, s.C);
  check("CheckFinished agrees with the core at the start", dotIsosceles === C.finished(s));
}

/* ---------------------------------------- 2. a full lattice of configurations */

{
  const xs = [20, 120, 220, 320];
  const ys = [20, 90, 160, 230];
  let total = 0, degenerate = 0, nondegenerate = 0, isosceles = 0;
  let worstDerived = 0, worstIdentity = 0, wrongEquivalence = 0;
  let wrongClaim = 0, wrongFinished = 0, wrongTranscription = 0;

  for (const ax of xs) for (const ay of ys)
    for (const bx of xs) for (const by of ys)
      for (const cx of xs) for (const cy of ys) {
        const A = { x: ax, y: ay }, B = { x: bx, y: by }, Cc = { x: cx, y: cy };
        const s = state(A, B, Cc);
        const m = C.measure(s);
        const cl = C.claims(s);
        const a = aCompute(A, B, Cc);
        const scale = Math.max(dist(A, B), dist(B, Cc), dist(Cc, A), 1);
        total++;
        if (Math.abs(area2(A, B, Cc)) < 1 || !Number.isFinite(a.O.x)) {
          degenerate++;
          if (cl.nondegenerate || cl.all) wrongClaim++;
          continue;
        }
        nondegenerate++;
        for (const name of ["D", "E", "P", "O", "M", "Am", "S", "F", "H"]) {
          worstDerived = Math.max(worstDerived, dist(m[name], a[name]) / scale);
        }
        worstDerived = Math.max(worstDerived, Math.abs(m.circle.radius - a.radius) / scale);

        /* Page claim, checked from the second transcription, not the core. */
        const eDotD = dot(sub(a.E, a.O), sub(a.D, Cc));
        const predicted = (dist(A, Cc) ** 2 - dist(A, B) ** 2) / 6;
        worstIdentity = Math.max(worstIdentity, Math.abs(eDotD - predicted) / scale ** 2);
        const aPerp = Math.abs(eDotD) <= 1e-8 * scale ** 2;
        const aEqual = Math.abs(dist(A, B) - dist(A, Cc)) <= 1e-8 * scale;
        if (aPerp !== aEqual) wrongEquivalence++;
        if (aEqual) isosceles++;
        if (cl.perpendicular !== aPerp || cl.equalLegs !== aEqual ||
            !cl.equivalent || !cl.all || !cl.nondegenerate || cl.collinear) wrongClaim++;
        if (m.diff < 1 !== aFinished(A, B, Cc)) wrongFinished++;
        if (!close(m.dot, eDotD, 1e-8 * scale ** 2) ||
            !close(m.predicted, predicted, 1e-9 * scale ** 2) ||
            !close(m.aoDotBC, dot(sub(A, a.O), sub(B, Cc)), 1e-8 * scale ** 2)) wrongTranscription++;
      }

  check(`the lattice has ${total} triangles (${nondegenerate} usable, ${degenerate} flat)`, total === 4096);
  check("every core point matches the bytecode transcription", worstDerived < 1e-9,
    `worst scaled error ${worstDerived}`);
  check("the dot-product identity holds on every triangle", worstIdentity < 1e-9,
    `worst scaled error ${worstIdentity}`);
  check("EO ⟂ CD iff AB = AC on all usable lattice triangles", wrongEquivalence === 0,
    `${wrongEquivalence} disagreements`);
  check("the core's claim flags agree with the transcription", wrongClaim === 0,
    `${wrongClaim} disagreements`);
  check("CheckFinished agrees with the applet on every triangle", wrongFinished === 0,
    `${wrongFinished} disagreements`);
  check("dot products match the transcription on every triangle", wrongTranscription === 0,
    `${wrongTranscription} disagreements`);
  check("the lattice includes isosceles and flat cases", isosceles > 0 && degenerate > 0,
    `isosceles ${isosceles}, flat ${degenerate}`);
}

/* ------------------------------------------ 3. random triangles and drags */

{
  const rand = rng(91827364);
  let tested = 0, wrongClaim = 0, wrongPoint = 0, wrongIdentity = 0;
  let worst = 0;
  for (let i = 0; i < 1200; i++) {
    const A = { x: 5 + rand() * 390, y: 5 + rand() * 240 };
    const B = { x: 5 + rand() * 390, y: 5 + rand() * 240 };
    const Cc = { x: 5 + rand() * 390, y: 5 + rand() * 240 };
    if (Math.abs(area2(A, B, Cc)) < 50) continue;
    const s = state(A, B, Cc);
    const m = C.measure(s), cl = C.claims(s), a = aCompute(A, B, Cc);
    const scale = Math.max(dist(A, B), dist(B, Cc), dist(Cc, A), 1);
    tested++;
    worst = Math.max(worst, dist(m.O, a.O) / scale, dist(m.E, a.E) / scale,
      dist(m.D, a.D) / scale, dist(m.H, a.H) / scale);
    const eDotD = dot(sub(a.E, a.O), sub(a.D, Cc));
    const predicted = (dist(A, Cc) ** 2 - dist(A, B) ** 2) / 6;
    if (Math.abs(eDotD - predicted) > 1e-9 * scale ** 2) wrongIdentity++;
    if ((Math.abs(eDotD) <= 1e-8 * scale ** 2) !==
        (Math.abs(dist(A, B) - dist(A, Cc)) <= 1e-8 * scale)) wrongClaim++;
    if (!cl.all || !cl.equivalent) wrongClaim++;
    if (!close(m.dot, eDotD, 1e-8 * scale ** 2) ||
        !close(m.aoDotBC, dot(sub(A, a.O), sub(B, Cc)), 1e-8 * scale ** 2)) wrongPoint++;
    if (C.finished(s) !== aFinished(A, B, Cc)) wrongPoint++;
  }
  check(`${tested} random triangles were exercised`, tested > 1100);
  check("random triangles agree with the transcription", wrongPoint === 0, `${wrongPoint} errors`);
  check("random triangles satisfy the identity", wrongIdentity === 0, `${wrongIdentity} errors`);
  check("random triangles satisfy the page's iff claim", wrongClaim === 0, `${wrongClaim} errors`);
  check("worst scaled difference in derived points is small", worst < 1e-9, `worst ${worst}`);
}

/* --------------------- 4. genuine isosceles triangles: the altitude claim */

{
  let wrong = 0, cases = 0;
  for (const bx of [30, 100, 250]) for (const by of [30, 120, 210])
    for (const cx of [90, 200, 370]) for (const cy of [40, 150, 230]) {
      if (dist({ x: bx, y: by }, { x: cx, y: cy }) < 20) continue;
      const B = { x: bx, y: by }, Cc = { x: cx, y: cy };
      const M = aMid(B, Cc);
      const d = sub(Cc, B);
      const len = dist(B, Cc);
      for (const t of [0.3, 1, 2.5]) {
        const A = { x: M.x - t * d.y, y: M.y + t * d.x };
        const s = state(A, B, Cc);
        const m = C.measure(s);
        cases++;
        if (!C.claims(s).all || !C.claims(s).altitude || !C.claims(s).perpendicular ||
            dist(m.H, m.M) > 1e-7 ||
            Math.abs(cross(sub(m.O, M), sub(A, M))) > 1e-7 * len ||
            Math.abs(cross(sub(m.P, M), sub(A, M))) > 1e-7 * len) wrong++;
      }
    }
  check(`${cases} isosceles triangles were exercised`, cases >= 200);
  check("AB = AC always makes EO perpendicular to CD", wrong === 0, `${wrong} failures`);
}

/* ----------------------- 5. strict one-pixel finish, options and immutability */

{
  const B = { x: 0, y: 0 }, Cc = { x: 100, y: 0 };
  const f = (x) => Math.hypot(x, 80) - Math.hypot(x - 100, 80);
  let lo = 50, hi = 60;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 1) lo = mid; else hi = mid;
  }
  const below = state({ x: lo - 1e-7, y: 80 }, B, Cc);
  const above = state({ x: hi + 1e-7, y: 80 }, B, Cc);
  check("just inside the one-pixel tolerance is finished",
    C.finished(below) && aFinished(below.A, B, Cc));
  check("just outside the one-pixel tolerance is not finished",
    !C.finished(above) && !aFinished(above.A, B, Cc));
  check("finishing is not a win or a loss", C.result(below) === null);
  const s = C.start();
  check("moving a corner leaves the old state alone",
    C.withPoint(s, "A", { x: 12, y: 34 }).A.x === 12 && s.A.x === 400 / 1.5);
  check("an unknown corner or a non-finite point is refused",
    C.withPoint(s, "Z", { x: 1, y: 2 }) === s &&
    C.withPoint(s, "A", { x: NaN, y: 2 }) === s);
  const checked = C.withOption(s, "showNames", true);
  check("options flip without changing the triangle",
    checked.showNames && !s.showNames && checked.A.x === s.A.x);
  check("move({name,point}) moves a corner", C.move(s, { name: "B", point: { x: 77, y: 99 } }).B.x === 77);
  check("move({option,value}) flips a checkbox", C.move(s, { option: "showHint", value: true }).showHint);
  check("an illegal move is refused", C.move(s, null) === null && C.move(s, { name: "Z" }) === null);
}

/* ------------------------------------------------------- 6. degenerate input */

{
  const flat = state({ x: 10, y: 20 }, { x: 100, y: 20 }, { x: 200, y: 20 });
  const m = C.measure(flat);
  check("a flat triangle has no finite circumcenter", !Number.isFinite(m.O.x) && !Number.isFinite(aCompute(flat.A, flat.B, flat.C).O.x));
  check("a flat triangle reports the claim as undefined", C.claims(flat).collinear &&
    !C.claims(flat).nondegenerate && !C.claims(flat).all);
  check("a flat triangle still has no result", C.result(flat) === null);
  const same = state({ x: 40, y: 40 }, { x: 40, y: 40 }, { x: 90, y: 90 });
  check("coincident corners do not throw and stay a demo",
    typeof C.measure(same).twiceArea === "number" && C.result(same) === null);
  const huge = C.withPoint(C.start(), "C", { x: 1e7, y: -1e7 });
  check("a far drag keeps the claim coherent", C.claims(huge).equivalent && C.claims(huge).all ||
    Math.abs(area2(huge.A, huge.B, huge.C)) < 1);
}

done("isosceles-triangle-in-circle");
