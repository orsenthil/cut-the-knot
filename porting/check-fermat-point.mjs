#!/usr/bin/env node
"use strict";

/*
 * Logic test for fermat-point/fermat-point-core.js.
 *
 *   node porting/check-fermat-point.mjs
 *
 * 1. The state API: the applet's starting triangle, four draggable handles,
 *    three checkboxes and the absence of a win/loss.
 * 2. A second, literal transcription of FermatPointCanvas.Compute() (the Java
 *    FindOrientation, Rotate, Intersect, Average and AngleMoreThan120),
 *    compared with the core on ~700 exact and generated triangles, including
 *    reflected ones and ones whose angle passes 120°.
 * 3. The claims on the linked "Fermat Point and Generalizations" page:
 *    FA+FB+FC is minimal (gradient and numerical search), the three angles at
 *    F are 120°, AA'=BB'=CC'=FA+FB+FC, the Napoleon lines concur at 120°, and
 *    a corner with an angle ≥120° is itself the minimum.  The equal-length
 *    groups behind the applet's Hint checkbox are checked too.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("fermat-point/fermat-point-core.js", "FermatPointCore");

/* ---------------------------------- a second transcription of the bytecode */

const P = (x, y) => ({ x: x, y: y });
const jSqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const jDist = (p, q) => Math.sqrt(jSqDist(p, q));
// GeoSDoub.FindOrientation
const jOrientation = (a, b, c) =>
  (c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y > 0 ? 1 : -1);
// GeoSDoub.ComputeAngle (valid triangles only, so no acos clamping needed)
const jAngle = (v, p, q) =>
  Math.acos((jSqDist(v, p) + jSqDist(v, q) - jSqDist(p, q)) / (2 * jDist(v, p) * jDist(v, q)));
// GeoSDoub.Rotate(DoubPoint centre, DoubPoint point, double, int)
const jRotate = (o, p, t, sgn) => {
  const c = Math.cos(t), s = Math.sin(t);
  return P(o.x + c * (p.x - o.x) - sgn * s * (p.y - o.y),
           o.y + sgn * s * (p.x - o.x) + c * (p.y - o.y));
};
// GeoSDoub.Intersect(DoubPoint, DoubPoint, DoubPoint, DoubPoint)
const jIntersect = (a, b, c, d) => {
  const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
  const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN); // the applet's own guard
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
};
const jAverage = (p, q, r) => P((p.x + q.x + r.x) / 3, (p.y + q.y + r.y) / 3);
// FermatPointCanvas.AngleMoreThan120
const jBigAngle = (a, b, c) => {
  if (jAngle(a, b, c) > 2.0943951023931953) return a;
  if (jAngle(b, c, a) > 2.0943951023931953) return b;
  if (jAngle(c, a, b) > 2.0943951023931953) return c;
  return null;
};
// FermatPointCanvas.Compute, statement for statement
function appletCompute(A, B, C, D) {
  const o = jOrientation(A, B, C);
  const Ap = jRotate(C, B, 1.0471975511965976, o);
  const Da = jRotate(C, D, 1.0471975511965976, o);
  const Bp = jRotate(A, C, 1.0471975511965976, o);
  const Db = jRotate(A, D, 1.0471975511965976, o);
  const Cp = jRotate(B, A, 1.0471975511965976, o);
  const Dc = jRotate(B, D, 1.0471975511965976, o);
  const big = jBigAngle(A, B, C);
  let F = big;
  if (!F) {
    F = jAverage(jIntersect(A, Ap, B, Bp),
                 jIntersect(B, Bp, C, Cp),
                 jIntersect(C, Cp, A, Ap));
  }
  return { Ap, Da, Bp, Db, Cp, Dc, F,
           more: big !== null, nearD: jDist(F, D) < 1 };
}

/* -------------------------------------------------------------- test cases */

const s0 = C.start({});
const exact = [
  ["applet start", s0.A, s0.B, s0.C, s0.D],
  ["equilateral", P(200, 40), P(200 - 50 * Math.sqrt(3), 190),
    P(200 + 50 * Math.sqrt(3), 190), P(200, 140)],
  ["right", P(240, 45), P(90, 230), P(340, 230), P(223.33, 168.33)],
  ["scalene", P(50, 240), P(350, 120), P(170, 40), P(190, 133.33)],
  ["reflected", P(200, 250), P(90, 60), P(300, 80), P(196.67, 130)],
  ["translated", P(40, 40), P(180, 60), P(120, 190), P(113.33, 96.67)],
  ["almost flat", P(80, 120), P(320, 122), P(200, 126), P(200, 122.67)],
  ["just under 120°", P(120, 200), P(280, 200), P(200, 200 + 80 / Math.tan(Math.PI / 3) + 1), P(200, 215.4)],
  ["just over 120°", P(120, 200), P(280, 200), P(200, 200 + 80 / Math.tan(Math.PI / 3) - 1), P(200, 215.4)],
];

/** Keep generated triangles away from the degenerate cases the applet cannot draw. */
function usable(a, b, c) {
  const area = Math.abs(C.cross(C.sub(b, a), C.sub(c, a))) / 2;
  if (area < 1400) return false;
  const ang = [C.computeAngle(a, b, c), C.computeAngle(b, c, a), C.computeAngle(c, a, b)];
  return ang.every((x) => Number.isFinite(x) && x > 0.12 && x < 3.05)
    && [C.dist(b, c), C.dist(a, c), C.dist(a, b)].every((x) => x > 40);
}

const rand = rng(20261127);
const cases = exact.map(([name, a, b, c, d]) => ({ name, a, b, c, d }));
let attempts = 0;
while (cases.length < 700 && attempts < 30000) {
  attempts++;
  const a = P(30 + rand() * 340, 30 + rand() * 240);
  const b = P(30 + rand() * 340, 30 + rand() * 240);
  const c = P(30 + rand() * 340, 30 + rand() * 240);
  if (!usable(a, b, c)) continue;
  // The applet's D starts at the centroid but can be dragged independently.
  const d = P((a.x + b.x + c.x) / 3 + (rand() - 0.5) * 20,
              (a.y + b.y + c.y) / 3 + (rand() - 0.5) * 20);
  cases.push({ name: `random-${cases.length}`, a, b, c, d });
}

/* ------------------------------------------------------------- 1. the state */

{
  const s = C.start({});
  check("the start has four draggable handles", [s.A, s.B, s.C, s.D].every((p) => p && Number.isFinite(p.x)));
  check("D starts at the triangle's centroid",
    C.dist(s.D, C.average(s.A, s.B, s.C)) < 1e-12);
  check("the three checkboxes start unchecked",
    !s.options.names && !s.options.hint && !s.options.fermat);
  check("an illustration has no win or loss", C.result(s) === null);
  const moved = C.move(s, "D", P(1000, -1000));
  check("D can be dragged away from the centroid on its own",
    moved.D.x <= C.VIEW.width - C.PAD && moved.D.y >= C.PAD
      && C.dist(moved.A, s.A) === 0);
  check("dragging marks the picture explored", moved.explored && !s.explored);
  check("an unknown handle is refused", C.move(s, "Z", P(1, 1)) === s);
  check("a non-finite drag is refused", C.move(s, "A", P(NaN, 3)) === s);
  const ticked = C.setOption(s, "hint", true);
  check("ticking a box keeps the old state", ticked.options.hint && !s.options.hint);
  const reset = C.reset(ticked);
  check("Reset restores the picture and keeps the options",
    reset.options.hint && C.dist(reset.A, s.A) === 0 && C.dist(reset.D, s.D) === 0);
  check("an unknown option is refused", C.setOption(s, "size", true) === s);
}

/* -------------------------- 2. the applet's own method, case for case */

let compared = 0, maxAppletErr = 0, mismatch = "";
for (const { name, a, b, c, d } of cases) {
  const g = C.compute(a, b, c, d);
  const x = appletCompute(a, b, c, d);
  if (g.moreThan120 !== x.more || g.nearD !== x.nearD) {
    mismatch ||= `${name}: flags differ`;
  }
  const pairs = [
    [g.Ap, x.Ap], [g.Bp, x.Bp], [g.Cp, x.Cp],
    [g.Da, x.Da], [g.Db, x.Db], [g.Dc, x.Dc], [g.F, x.F],
  ];
  for (const [u, v] of pairs) {
    if (!Number.isFinite(u.x) || !Number.isFinite(v.x)) {
      if (Number.isFinite(u.x) !== Number.isFinite(v.x)) mismatch ||= `${name}: NaN point differs`;
      continue;
    }
    maxAppletErr = Math.max(maxAppletErr, C.dist(u, v));
  }
  compared++;
}
check(`the second transcription agrees on all ${compared} triangles`, !mismatch, mismatch);
check(`the largest point difference is ${maxAppletErr.toExponential(1)}`, maxAppletErr < 1e-7);

/* ------------------------------------------- 3. the page's claims, all cases */

const near = (u, v, tol = 1e-6) => Math.abs(u - v) <= tol;
let finiteF = 0, sumMin = 0, at120 = 0, concur = 0, cross120 = 0, equalLong = 0;
let equilateralNapoleon = 0, hintGroups = 0, gradient = 0, sampled = 0, searched = 0;
let obtuseF = 0, obtuseGradient = 0, obtuseSampled = 0, casesObuse = 0;
let maxClaimErr = 0;

for (const { a, b, c, d } of cases) {
  const g = C.compute(a, b, c, d);
  if (![g.F.x, g.F.y, g.total].every(Number.isFinite)) continue;
  finiteF++;

  // The hint's three equal-length chains (also true in the obtuse case).
  const groups = [
    [C.dist(a, g.D), C.dist(a, g.Db), C.dist(g.Cp, g.Dc)],
    [C.dist(b, g.D), C.dist(b, g.Dc), C.dist(g.Ap, g.Da)],
    [C.dist(c, g.D), C.dist(c, g.Da), C.dist(g.Bp, g.Db)],
  ];
  const hintErr = Math.max(...groups.map((v) => Math.max(...v) - Math.min(...v)));
  maxClaimErr = Math.max(maxClaimErr, hintErr);
  if (hintErr < 1e-7) hintGroups++;

  // The three outward triangles really are equilateral.
  const nap = [
    [C.dist(b, c), C.dist(c, g.Ap), C.dist(g.Ap, b)],
    [C.dist(c, a), C.dist(a, g.Bp), C.dist(g.Bp, c)],
    [C.dist(a, b), C.dist(b, g.Cp), C.dist(g.Cp, a)],
  ];
  const napErr = Math.max(...nap.map((v) => Math.max(...v) - Math.min(...v)));
  maxClaimErr = Math.max(maxClaimErr, napErr);
  if (napErr < 1e-7) equilateralNapoleon++;

  // A convex sum of distances is minimised iff the unit-vector sum is 0
  // (inside the triangle) or has length at most 1 (at a corner).
  const unitSum = (p) => [a, b, c].reduce((acc, v) => {
    const dx = p.x - v.x, dy = p.y - v.y, n = Math.hypot(dx, dy) || 1;
    return { x: acc.x + dx / n, y: acc.y + dy / n };
  }, { x: 0, y: 0 });
  const grad = Math.hypot(unitSum(g.F).x, unitSum(g.F).y);

  // Compare with sampled points and with a descent from a random start.
  const minX = Math.min(a.x, b.x, c.x) - 20, maxX = Math.max(a.x, b.x, c.x) + 20;
  const minY = Math.min(a.y, b.y, c.y) - 20, maxY = Math.max(a.y, b.y, c.y) + 20;
  let best = Infinity, bestP = g.F;
  for (let i = 0; i < 60; i++) {
    const p = P(minX + rand() * (maxX - minX), minY + rand() * (maxY - minY));
    const t = C.sumDistances(p, a, b, c);
    if (t < best) { best = t; bestP = p; }
  }
  // Weiszfeld's iteration for the geometric median, an independent way to
  // find the minimiser without using any of the applet's construction.
  let q = bestP;
  for (let k = 0; k < 5000; k++) {
    let w = 0, sx = 0, sy = 0;
    for (const v of [a, b, c]) {
      const d = jDist(q, v);
      if (d < 1e-9) { q = P(q.x + 1e-6, q.y + 1e-6); break; }
      w += 1 / d; sx += v.x / d; sy += v.y / d;
    }
    const next = P(sx / w, sy / w);
    const change = jDist(next, q);
    q = next;
    if (change < 1e-10) break;
  }

  if (g.moreThan120) {
    casesObuse++;
    const idx = [a, b, c].indexOf(g.F);
    if (idx >= 0 && g.outer === ["A", "B", "C"][idx]) obtuseF++;
    if (grad <= 1 + 1e-9) obtuseGradient++;
    if (C.sumDistances(g.F, a, b, c) <= best + 1e-7) obtuseSampled++;
  } else {
    const angles = [
      C.computeAngle(g.F, a, b), C.computeAngle(g.F, b, c), C.computeAngle(g.F, c, a),
    ];
    const angleErr = Math.max(...angles.map((v) => Math.abs(v - C.TWO_THIRDS)));
    maxClaimErr = Math.max(maxClaimErr, angleErr);
    if (angleErr < 1e-6) at120++;

    const on = g.lines.map((l) => C.distanceToLine(g.F, l.from, l.to));
    if (on.every((v) => v < 1e-6)) concur++;

    const lineAngle = (l, m) => {
      const u = C.sub(l.to, l.from), v = C.sub(m.to, m.from);
      const c = Math.abs(C.dot(u, v)) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
      return Math.acos(Math.max(-1, Math.min(1, c))); // 60° undirected = 120° directed
    };
    const crossErr = Math.max(
      Math.abs(lineAngle(g.lines[0], g.lines[1]) - C.SIXTY),
      Math.abs(lineAngle(g.lines[1], g.lines[2]) - C.SIXTY),
      Math.abs(lineAngle(g.lines[2], g.lines[0]) - C.SIXTY),
    );
    maxClaimErr = Math.max(maxClaimErr, crossErr);
    if (crossErr < 1e-6) cross120++;

    const long = g.lines.map((l) => C.dist(l.from, l.to));
    const longErr = Math.max(...long.map((v) => Math.abs(v - g.total)));
    maxClaimErr = Math.max(maxClaimErr, longErr);
    if (longErr < 1e-6) equalLong++;

    if (grad < 1e-7) gradient++;
    if (C.sumDistances(g.F, a, b, c) <= best + 1e-7) sampled++;
    if (C.dist(q, g.F) < 1e-2) searched++;
  }
}

{
  const acute = finiteF - casesObuse;
  check("every generated triangle has a usable construction", finiteF === cases.length, `${finiteF}/${cases.length}`);
  check(`the hint's equal lengths hold on all ${finiteF} triangles`, hintGroups === finiteF, `${hintGroups}/${finiteF}`);
  check(`all ${finiteF} outward triangles are equilateral`, equilateralNapoleon === finiteF, `${equilateralNapoleon}/${finiteF}`);
  check(`the three Fermat angles are 120° on all ${acute} interior cases`, at120 === acute, `${at120}/${acute}`);
  check(`AA', BB' and CC' all pass through F on ${acute} cases`, concur === acute, `${concur}/${acute}`);
  check(`the three construction lines cross at 120° on ${acute} cases`, cross120 === acute, `${cross120}/${acute}`);
  check(`AA' = BB' = CC' = FA + FB + FC on ${acute} cases`, equalLong === acute, `${equalLong}/${acute}`);
  check(`the gradient of FA+FB+FC vanishes at F on ${acute} cases`, gradient === acute, `${gradient}/${acute}`);
  check(`no sampled point beats F on ${acute} cases`, sampled === acute, `${sampled}/${acute}`);
  check(`a descent search finds F on ${acute} cases`, searched === acute, `${searched}/${acute}`);
  check(`all ${casesObuse} corners over 120° win by the applet's test`, obtuseF === casesObuse, `${obtuseF}/${casesObuse}`);
  check(`the corner is a true minimum (vector length ≤ 1) on ${casesObuse} cases`, obtuseGradient === casesObuse, `${obtuseGradient}/${casesObuse}`);
  check(`no sampled point beats the corner on ${casesObuse} cases`, obtuseSampled === casesObuse, `${obtuseSampled}/${casesObuse}`);
  check(`every claim holds within ${maxClaimErr.toExponential(1)}`, maxClaimErr < 1e-5);
}

/* ------------------------------------------- 4. the threshold and the words */

{
  const a = P(200, 40), b = P(200 - 50 * Math.sqrt(3), 190),
        c = P(200 + 50 * Math.sqrt(3), 190);
  const d = C.average(a, b, c);
  const g = C.compute(a, b, c, d);
  const F = g.F;
  check("near an equilateral triangle F is the centroid", C.dist(F, d) < 0.5);
  check("the applet calls a centroid-close F 'F', not 'D'", g.nearD === true);
  check("moving D two pixels away removes that label", C.compute(a, b, c, P(d.x + 2, d.y)).nearD === false);
  check("moving D half a pixel keeps that label", C.compute(a, b, c, P(d.x + 0.5, d.y)).nearD === true);
  check("a 120° corner makes the applet abandon the intersection construction",
    C.compute(P(120, 200), P(280, 200), P(200, 200 + 80 / Math.tan(Math.PI / 3) - 1), P(180, 160)).moreThan120);
  check("just under 120° still uses the intersection construction",
    !C.compute(P(120, 200), P(280, 200), P(200, 200 + 80 / Math.tan(Math.PI / 3) + 1), P(180, 160)).moreThan120);

  const start = C.start({});
  check("the default status gives the total distance", /FA \+ FB \+ FC/.test(C.describe(start)));
  check("the hint quotes the equal-long-lines claim", /AA' = BB' = CC'/.test(C.describe(C.setOption(start, "hint", true))));
  check("the Fermat-point checkbox explains the 120° angles", /120°/.test(C.describe(C.setOption(start, "fermat", true))));
  const obtuse = C.compute(P(100, 100), P(300, 100), P(150, 106), P(183, 102));
  check("the obtuse status names the winning corner", /angle at C/.test(C.describe(Object.assign({}, start, {
    A: P(100, 100), B: P(300, 100), C: P(150, 106), D: P(183, 102),
  }))) && obtuse.moreThan120);
  const flat = Object.assign({}, start, { A: P(100, 100), B: P(100, 100), C: P(100, 100) });
  check("a degenerate drag asks for a fresh triangle", /Drag A, B and C apart/.test(C.describe(flat)));
  check("an illustration stays unfinished-free after a move", C.result(C.move(start, "A", P(160, 170))) === null);
}

done("fermat-point");
