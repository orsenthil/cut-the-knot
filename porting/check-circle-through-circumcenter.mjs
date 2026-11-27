#!/usr/bin/env node
"use strict";

/*
 * Logic test for circle-through-circumcenter/circle-through-circumcenter-core.js.
 *
 *   node porting/check-circle-through-circumcenter.mjs
 *
 * Checks the old page's claim (AO ⟂ PQ, even when ABC is not acute) on exact
 * triangles and hundreds of generated ones, and compares the core with a
 * second, literal transcription of the applet's Compute() from its bytecode:
 * GetCircle (find circumcentre, average the three radii), the B/O/C circle,
 * GeoSDoub.Intersect(circle, line), Other(), and X = PQ ∩ AO.  The two
 * implementations share no code.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circle-through-circumcenter/circle-through-circumcenter-core.js",
                   "CircleThroughCircumcenterCore");

/* ------------------------------------------- the applet's own construction */

const P = (x, y) => ({ x, y });
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const add = (a, b) => P(a.x + b.x, a.y + b.y);
const mul = (a, t) => P(a.x * t, a.y * t);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// GeoSDoub.Intersect(DoubPoint x4): cross-product intersection of two lines.
function intersectLines(a, b, c, d) {
  const r = sub(b, a), s = sub(d, c);
  return add(a, mul(r, cross(sub(c, a), s) / cross(r, s)));
}
// GeoSDoub.FindCircumcenter: two perpendicular bisectors, then Intersect.
function findCircumcenter(a, b, c) {
  const ab = P((a.x + b.x) / 2, (a.y + b.y) / 2);
  const bc = P((b.x + c.x) / 2, (b.y + c.y) / 2);
  const t1 = P(ab.x + (b.y - a.y), ab.y - (b.x - a.x));
  const t2 = P(bc.x + (c.y - b.y), bc.y - (c.x - b.x));
  return intersectLines(ab, t1, bc, t2);
}
// GetCircle: centre from FindCircumcenter, radius = mean of the three distances.
function getCircle(a, b, c) {
  const o = findCircumcenter(a, b, c);
  return { c: o, r: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
}
// GeoSDoub.Intersect(DoubLine, DoubCircle): solve the quadratic along the line.
function intersectLineCircle(v, towards, circle) {
  const d = sub(towards, v);
  const w = sub(v, circle.c);
  const A = dot(d, d);
  const B = 2 * dot(w, d);
  const D = Math.max(0, B * B - 4 * A * (dot(w, w) - circle.r * circle.r));
  const root = Math.sqrt(D);
  return [add(v, mul(d, (-B - root) / (2 * A))),
          add(v, mul(d, (-B + root) / (2 * A)))];
}
// CircleThroughCircumcenterCanvas.Other: the intersection that is not v.
function other(points, v) {
  return dist(points[0], v) >= 1 ? points[0] : points[1];
}
// CircleThroughCircumcenterCanvas.Compute(), method for method.
function appletCompute(a, b, c) {
  const circumcircle = getCircle(b, c, a);
  const O = findCircumcenter(b, c, a);
  const circle = getCircle(b, c, O);
  const Ppt = other(intersectLineCircle(b, a, circle), b);
  const Q = other(intersectLineCircle(c, a, circle), c);
  const J = other(intersectLineCircle(O, a, circle), O);
  const X = intersectLines(Ppt, Q, a, O);
  return { circumcircle, circle, O, P: Ppt, Q, J, X };
}

/* ------------------------------------------------------------- test cases */

const home = C.home();
const exact = [
  ["applet start", home.A, home.B, home.C],
  ["equilateral", P(200, 50), P(113.397, 225), P(286.603, 225)],
  ["scalene", P(60, 200), P(320, 100), P(180, 50)],
  ["isosceles", P(200, 60), P(120, 220), P(280, 220)],
  ["very obtuse at C", P(100, 200), P(300, 200), P(200, 210)],
  ["just obtuse at C", P(280, 40), P(60, 240), P(255, 260)],
  ["translated", P(30, 30), P(370, 30), P(200, 270)],
  ["nearly flat", P(100, 100), P(300, 100.5), P(200, 110)],
];
const cases = exact.map(([name, a, b, c]) => ({ name, a, b, c }));

const rand = rng(20261126);
function usable(a, b, c) {
  const area = Math.abs(cross(sub(b, a), sub(c, a))) / 2;
  if (area < 900) return false;
  const ang = [C.angle(a, b, c), C.angle(b, a, c), C.angle(c, a, b)];
  return ang.every((x) => x > 0.12 && x < 3.0)
      && [dist(b, c), dist(a, c), dist(a, b)].every((s) => s > 30);
}
for (let i = 0; i < 300; i++) {
  let a, b, c;
  do {
    a = P(24 + rand() * 352, 24 + rand() * 252);
    b = P(24 + rand() * 352, 24 + rand() * 252);
    c = P(24 + rand() * 352, 24 + rand() * 252);
  } while (!usable(a, b, c));
  cases.push({ name: `random-${i}`, a, b, c });
}
for (let i = 0; i < 200; i++) {
  const o = P(120 + rand() * 160, 100 + rand() * 100);
  const r = 65 + rand() * 45;
  const t = [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2];
  const on = (v) => P(o.x + r * Math.cos(v), o.y + r * Math.sin(v));
  const a = on(t[0]), b = on(t[1]), c = on(t[2]);
  if (usable(a, b, c)) cases.push({ name: `on-circle-${i}`, a, b, c });
}

/* ------------------------------------------------------------- 1. the core */

{
  const s = C.start({});
  check("start has the applet's three draggable vertices",
    [s.A, s.B, s.C].every((p) => p && Number.isFinite(p.x)));
  check("start reproduces the applet's 400x300 triangle",
    Math.abs(C.geometry(s).O.x - 200) < 1e-9
      && Math.abs(C.geometry(s).O.y - 150) < 1e-9);
  check("start has the applet's four show options",
    s.options.names === true && s.options.hint === true
      && s.options.premises === false && s.options.statement === false);
  check("this illustration has no result", C.result(s) === null);
  check("a valid starting geometry exists", !!C.geometry(s));
  const moved = C.move(s, "A", { x: 9999, y: -9999 });
  check("dragging clamps a vertex to the board",
    moved.A.x <= C.VIEW.width - C.PAD && moved.A.y >= C.PAD);
  check("dragging marks the picture explored",
    moved.explored === true && s.explored === false);
  check("an unknown handle is refused", C.move(s, "Z", { x: 1, y: 1 }) === s);
  const optioned = C.setOption(s, "premises", true);
  check("toggling an option keeps the old state",
    optioned.options.premises && !s.options.premises);
  check("reset keeps the chosen options and the original vertices",
    C.reset(optioned).options.premises === true
      && C.reset(optioned).A.x === s.A.x && C.reset(optioned).B.y === s.B.y);
}

/* --------------------------------- 2. the claims, on every exact/random case */

let live = 0, finite = 0, onCircle = 0, collinear = 0, xOn = 0;
let perp = 0, apq = 0, bao = 0, aob = 0, rightX = 0, angleSum = 0;
let inscribedBCQ = 0, inscribedBPQ = 0, inscribedAPQ = 0;
let acuteChain = 0, acuteCount = 0, obtusePerp = 0, obtuseCount = 0;
let wellSeparated = 0, tangentCases = 0, chainCases = 0, appletMatch = 0, degenerate = 0, unexpectedMismatch = 0;
let maxClaimErr = 0, maxAppletErr = 0, maxTangentErr = 0;
const near = (a, b, tol = 1e-7) => Math.abs(a - b) <= tol;
// Angles on the same two chords are equal or supplementary, according to
// which side of the chord the point lies on (the page uses directed angles).
const inscribed = (u, v) => Math.min(Math.abs(u - v), Math.abs(u - (Math.PI - v))) < 1e-6;

for (const { a, b, c } of cases) {
  const g = C.compute(a, b, c);
  const x = appletCompute(a, b, c);
  if (!g) { degenerate++; continue; }
  live++;

  const vals = [g.O.x, g.O.y, g.circle.c.x, g.circle.c.y, g.circle.r,
                g.P.x, g.P.y, g.Q.x, g.Q.y, g.J.x, g.J.y, g.X.x, g.X.y];
  if (vals.every(Number.isFinite)) finite++;

  // O is the circumcentre; B, C and O lie on the second circle.
  const R = dist(g.O, a);
  const radii = [dist(g.O, b), dist(g.O, c), dist(g.circumcircle.c, a), g.circumcircle.r];
  maxClaimErr = Math.max(maxClaimErr, ...radii.map((v) => Math.abs(v - R)));
  if (radii.every((v) => near(v, R, 1e-6))) onCircle++;
  if ([g.P, g.Q, g.J].every((p) => near(dist(g.circle.c, p), g.circle.r, 1e-6))) onCircle++;

  // The applet's Other() picks the far intersection, unless the line is so
  // close to tangent that both roots are within its one-unit threshold.
  let nearTangent = 0, wrongFar = 0;
  for (const [pt, roots, vertex] of [
    [g.P, intersectLineCircle(b, a, g.circle), b],
    [g.Q, intersectLineCircle(c, a, g.circle), c],
    [g.J, intersectLineCircle(g.O, a, g.circle), g.O],
  ]) {
    const d0 = dist(roots[0], vertex), d1 = dist(roots[1], vertex);
    if (Math.abs(d0 - d1) <= 2) nearTangent++;
    else if (dist(pt, d0 > d1 ? roots[0] : roots[1]) > 1e-5) wrongFar++;
  }
  if (nearTangent) tangentCases++;
  if (!nearTangent && !wrongFar) wellSeparated++;

  // The intersections really lie on the applet's AB, AC, AO and PQ lines.
  if (C.distanceToLine(g.P, a, b) < 1e-6 && C.distanceToLine(g.Q, a, c) < 1e-6
      && C.distanceToLine(g.J, a, g.O) < 1e-6) collinear++;
  if (C.distanceToLine(g.X, a, g.O) < 1e-6 && C.distanceToLine(g.X, g.P, g.Q) < 1e-6) xOn++;

  // The page's claim: AO ⟂ PQ.  Its angle-chase equivalent at X.
  const cos = dot(sub(g.O, g.A), sub(g.Q, g.P))
            / (dist(g.O, g.A) * dist(g.Q, g.P));
  maxClaimErr = Math.max(maxClaimErr, Math.abs(cos));
  if (Math.abs(cos) < 1e-9) perp++;
  if (Math.abs(C.angle(g.X, g.A, g.P) - Math.PI / 2) < 1e-6
      && Math.abs(C.angle(g.X, g.A, g.Q) - Math.PI / 2) < 1e-6) rightX++;

  // The angle identities used in the article's proof.
  const Cang = g.angles.C;
  const errAPQ = Math.abs(C.angle(g.P, g.A, g.Q) - Cang);
  const errBAO = Math.abs(C.angle(g.A, g.B, g.O) - Math.abs(Math.PI / 2 - Cang));
  const AOB = C.angle(g.O, g.A, g.B);
  const errCent = Math.min(Math.abs(AOB - 2 * Cang), Math.abs(AOB - (2 * Math.PI - 2 * Cang)));
  maxClaimErr = Math.max(maxClaimErr, errAPQ, errBAO, errCent);
  if (errAPQ < 1e-6) apq++;
  if (errBAO < 1e-6) bao++;
  if (errCent < 1e-6) aob++;
  if (Math.abs(g.angles.A + g.angles.B + Cang - Math.PI) < 1e-9) angleSum++;

  // The article's inscribed-angle chain, read as directed angles: equal or
  // supplementary depending on which ray the second point falls on.
  if (!nearTangent) {
    chainCases++;
    const residual = (u, v) => Math.min(Math.abs(u - v), Math.abs(u - (Math.PI - v)));
    const chain = [residual(C.angle(g.C, g.B, g.Q), Cang),
                   residual(C.angle(g.P, g.B, g.Q), C.angle(g.C, g.B, g.Q)),
                   residual(C.angle(g.P, g.A, g.Q), C.angle(g.P, g.B, g.Q))];
    maxClaimErr = Math.max(maxClaimErr, ...chain);
    if (inscribed(C.angle(g.C, g.B, g.Q), Cang)) inscribedBCQ++;
    if (inscribed(C.angle(g.P, g.B, g.Q), C.angle(g.C, g.B, g.Q))) inscribedBPQ++;
    if (inscribed(C.angle(g.P, g.A, g.Q), C.angle(g.P, g.B, g.Q))) inscribedAPQ++;
  }
  // Acute at C: the page's unsigned angle chase, ∠BCQ + ∠BAO = 90°.
  if (Cang < Math.PI / 2) {
    acuteCount++;
    const sumErr = Math.abs(C.angle(g.A, g.B, g.O) + Cang - Math.PI / 2);
    maxClaimErr = Math.max(maxClaimErr, sumErr);
    if (sumErr < 1e-6) acuteChain++;
  }
  // Obtuse at any vertex: acuteness really is irrelevant to the perpendicularity.
  if (Cang > Math.PI / 2 || g.angles.A > Math.PI / 2 || g.angles.B > Math.PI / 2) {
    obtuseCount++;
    if (Math.abs(cos) < 1e-9) obtusePerp++;
  }

  // Second transcription: same circles and same P, Q, J, X as the applet.
  const errs = [dist(g.circumcircle.c, x.circumcircle.c),
                Math.abs(g.circumcircle.r - x.circumcircle.r),
                dist(g.circle.c, x.circle.c), Math.abs(g.circle.r - x.circle.r),
                dist(g.O, x.O), dist(g.P, x.P), dist(g.Q, x.Q),
                dist(g.J, x.J), dist(g.X, x.X)];
  const worst = Math.max(...errs);
  if (worst < 1e-5) appletMatch++;
  else if (nearTangent) maxTangentErr = Math.max(maxTangentErr, worst);
  else unexpectedMismatch++;
  maxAppletErr = Math.max(maxAppletErr, worst);
}

{
  const n = cases.length;
  check(`every exact/generated triangle (${n}) has a construction or a known degeneracy`,
    live + degenerate === n, `${live}/${n}, ${degenerate} degenerate`);
  check("all computed coordinates are finite", finite === live, `${finite}/${live}`);
  check("O is the circumcentre and B, C, O lie on the second circle", onCircle === 2 * live, `${onCircle}/${2 * live}`);
  check(`P, Q and J are the far intersections where the secant is not tangent (${wellSeparated})`,
    wellSeparated + tangentCases === live && unexpectedMismatch === 0, `${wellSeparated}/${live - tangentCases}`);
  check("P, Q and J lie on AB, AC and AO", collinear === live, `${collinear}/${live}`);
  check("X lies on both AO and PQ", xOn === live, `${xOn}/${live}`);
  check("the page's claim AO ⟂ PQ holds", perp === live, `${perp}/${live}`);
  check("all four angles at X are right angles", rightX === live, `${rightX}/${live}`);
  check("∠APQ = ∠BCA on every triangle", apq === live, `${apq}/${live}`);
  check("∠BAO = |90° − ∠BCA| on every triangle", bao === live, `${bao}/${live}`);
  check("the central angle AOB is 2∠BCA or 360° − 2∠BCA", aob === live, `${aob}/${live}`);
  check("the three angles add to 180°", angleSum === live, `${angleSum}/${live}`);
  check(`∠BCQ equals or supplements ∠BCA (directed inscribed angles, ${chainCases} secants)`, inscribedBCQ === chainCases, `${inscribedBCQ}/${chainCases}`);
  check("∠BPQ equals or supplements ∠BCQ", inscribedBPQ === chainCases, `${inscribedBPQ}/${chainCases}`);
  check("∠APQ equals or supplements ∠BPQ", inscribedAPQ === chainCases, `${inscribedAPQ}/${chainCases}`);
  check(`the page's unsigned angle chase holds for acute C (${acuteCount})`, acuteChain === acuteCount, `${acuteChain}/${acuteCount}`);
  check(`AO ⟂ PQ also holds for obtuse triangles (${obtuseCount})`, obtusePerp === obtuseCount, `${obtusePerp}/${obtuseCount}`);
  check(`the core matches the applet's Compute() within ${maxAppletErr.toExponential(1)}`,
    appletMatch === live || (unexpectedMismatch === 0 && maxTangentErr < 1),
    `${appletMatch}/${live}, ${tangentCases} near-tangent, worst near-tangent error ${maxTangentErr.toExponential(1)}`);
  check(`the geometry claims hold to ${maxClaimErr.toExponential(1)}`, maxClaimErr < 1e-6);
}

/* ------------------------------------- 3. status text and the degenerate case */

{
  const s = C.start({});
  const g = C.geometry(s);
  check("the default hint quotes the two angles", /∠BCA/.test(C.describe(s)) && /∠BAO/.test(C.describe(s)));
  const withoutHint = C.setOption(s, "hint", false);
  check("statement mode announces the right angle at X",
    /right angles/.test(C.describe(C.setOption(withoutHint, "statement", true))));
  check("premises mode names O and the second circle",
    /centre/.test(C.describe(C.setOption(C.setOption(s, "hint", false), "premises", true))));
  const moved = C.move(s, "B", P(170, 210));
  check("moving a vertex changes O", dist(C.geometry(moved).O, g.O) > 1e-6);
  check("the moved triangle still satisfies the claim",
    Math.abs(dot(sub(C.geometry(moved).O, moved.A),
                 sub(C.geometry(moved).Q, C.geometry(moved).P))) < 1e-6);
  // A right angle at A makes B, O and C collinear: no circle through them.
  const rightAtA = C.compute(P(200, 60), P(100, 160), P(300, 160));
  check("a right angle at A has no circle through B, O, C", rightAtA === null);
  check("the status asks for a new triangle in that degenerate position",
    /triangle/.test(C.describe({ A: P(200, 60), B: P(100, 160), C: P(300, 160),
      options: s.options })));
}

done("circle-through-circumcenter");
