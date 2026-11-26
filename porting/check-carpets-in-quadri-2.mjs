#!/usr/bin/env node
"use strict";

/*
 * Logic test for carpets-in-quadri-2/carpets-in-quadri-2-core.js.
 *
 *   node porting/check-carpets-in-quadri-2.mjs
 *
 * Checks the applet's Reset() corners and its three checkboxes, then the page's
 * claim over fixed quadrilaterals and thousands of generated convex ones:
 *
 *   [AEP] + [BFQ] + [CGR] + [DHS] = [PQRS],
 *   [AFCH] = [BGDE] = [ABCD]/2 (and the two complements are halves too).
 *
 * The page also remarks that every convex quadrilateral is an affine image of
 * a square and so [PQRS] = [ABCD]/5.  That is false for a general quadrilateral
 * (an affine image of a square is a parallelogram); the test checks the true
 * statement: the fifth holds exactly for parallelograms and can fail for other
 * convex quadrilaterals, while the carpet equality still holds.
 *
 * The whole picture is then transcribed a second time straight from the
 * bytecode (Midpoint, GeoSDoub.Intersect's Cramer solve and Draw's filled and
 * stroked arrays) and compared with the core on every fixed case and on
 * thousands of generated quadrilaterals, including degenerate ones.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("carpets-in-quadri-2/carpets-in-quadri-2-core.js", "CarpetsInQuadri2Core");

const P = (x, y) => ({ x, y });
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closePoint = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);
const scaleOf = (a, b, c, d) => Math.max(1,
  dist(a, b), dist(b, c), dist(c, d), dist(d, a), dist(a, c), dist(b, d));

/* ----------------------------------------- the applet's arithmetic, bytecode */

/* Midpoint(): new DoubPoint((p.x+q.x)/2.0, (p.y+q.y)/2.0). */
function appletMidPoint(p, q) {
  return P((p.x + q.x) / 2.0, (p.y + q.y) / 2.0);
}

/* GeoSDoub.Intersect(p1,p2,p3,p4): three lines a*x + b*y = c, Cramer's rule,
 * and a NaN point when |det| < 1.0. */
function appletIntersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1.0) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* CarpetsInQuadri2Canvas.init() with the archived embedding's W=450 H=400. */
function appletReset(W = 450, H = 400) {
  const u = Math.floor(W / 5), v = Math.floor(H / 5);
  return [
    P(u, H / 2 - v), P(4 * u, H - v), P(W - u, v), P(2 * u, v),
  ];
}

/* Compute()'s four midpoints and four intersections, in bytecode order. */
function appletCompute(a, b, c, d) {
  const E = appletMidPoint(a, b);
  const F = appletMidPoint(b, c);
  const G = appletMidPoint(c, d);
  const H = appletMidPoint(d, a);
  return {
    E, F, G, H,
    P: appletIntersect(a, F, d, E),
    Q: appletIntersect(b, G, a, F),
    R: appletIntersect(c, H, b, G),
    S: appletIntersect(d, E, c, H),
  };
}

/* Draw(): the red triangles, blue quadrilaterals and the strokes it lays over
 * them, down to the order of the points in each polygon. */
function appletDraw(a, b, c, d) {
  const p = appletCompute(a, b, c, d);
  return {
    points: p,
    p1Triangles: [[a, b, p.F], [c, d, p.H]],
    p1Quads: [[a, p.F, c, p.H]],
    p1Lines: [[a, p.F], [c, p.H]],
    diagAC: [a, c],
    p2Triangles: [[a, p.E, d], [c, p.G, b]],
    p2Quads: [[b, p.G, d, p.E]],
    p2Lines: [[b, p.G], [d, p.E]],
    diagBD: [b, d],
    outline: [[a, b], [b, c], [c, d], [d, a]],
  };
}

/* ------------------------------- the page's claim, transcribed independently */

/* Line intersection from direction vectors, not GeoSDoub's general form. */
function intersectVectors(p, p2, q, q2) {
  const r = sub(p2, p), s = sub(q2, q);
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / den;
  return P(p.x + t * r.x, p.y + t * r.y);
}
function polyArea(poly) {
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    twice += p.x * q.y - q.x * p.y;
  }
  return Math.abs(twice) / 2;
}
function triArea(p, q, r) { return polyArea([p, q, r]); }
function isConvexTurn(a, b, c, d) {
  const ps = [a, b, c, d];
  const turns = ps.map((p, i) => {
    const q = ps[(i + 1) % 4], r = ps[(i + 2) % 4];
    return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
  });
  return turns.every((t) => t > 0) || turns.every((t) => t < 0);
}

function pageClaim(a, b, c, d) {
  const E = P((a.x + b.x) / 2, (a.y + b.y) / 2);
  const F = P((b.x + c.x) / 2, (b.y + c.y) / 2);
  const G = P((c.x + d.x) / 2, (c.y + d.y) / 2);
  const H = P((d.x + a.x) / 2, (d.y + a.y) / 2);
  const Pn = intersectVectors(a, F, d, E);
  const Q = intersectVectors(b, G, a, F);
  const R = intersectVectors(c, H, b, G);
  const S = intersectVectors(d, E, c, H);
  if (!Pn || !Q || !R || !S) return null;
  const abcd = polyArea([a, b, c, d]);
  const corner = triArea(a, E, Pn) + triArea(b, F, Q)
    + triArea(c, G, R) + triArea(d, H, S);
  const inner = polyArea([Pn, Q, R, S]);
  const tol = 1e-8 * Math.max(1, abcd);
  return {
    abcd, corner, inner, tol,
    carpet: Math.abs(corner - inner) <= tol,
    halves: Math.abs(polyArea([a, F, c, H]) - abcd / 2) <= tol
      && Math.abs(triArea(a, b, F) + triArea(c, d, H) - abcd / 2) <= tol
      && Math.abs(polyArea([b, G, d, E]) - abcd / 2) <= tol
      && Math.abs(triArea(a, E, d) + triArea(c, G, b) - abcd / 2) <= tol,
    convex: isConvexTurn(a, b, c, d),
    parallelogram: dist(sub(b, a), sub(c, d)) <= tol
      && dist(sub(c, b), sub(d, a)) <= tol,
    fifth: abcd > 0 && Math.abs(inner / abcd - 1 / 5) <= 1e-6,
  };
}

/* ------------------------------------------------------------ 1. start, rules */

{
  const s = C.start({});
  const reset = appletReset();
  equal("Reset puts corner A at the applet's (90,120)", s.A, reset[0]);
  equal("Reset puts corner B at the applet's (360,320)", s.B, reset[1]);
  equal("Reset puts corner C at the applet's (360,80)", s.C, reset[2]);
  equal("Reset puts corner D at the applet's (180,80)", s.D, reset[3]);
  check("Partition 1 starts checked", s.options.partition1);
  check("Partition 2 starts checked", s.options.partition2);
  check("names start unchecked (no ShowNames=1 parameter on the page)", !s.options.names);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh diagram is not marked explored", !s.explored);
  check("the start shape is convex", C.geometry(s).claims.convex);
  check("the start shape satisfies the page's claim", C.geometry(s).claims.carpet);
  check("the status explains the equality", /same total area/.test(C.describe(s)));
}

{
  const s = C.start();
  const moved = C.move(s, "A", P(10, 10));
  check("moving a corner leaves the old position alone", s.A.x === 90 && moved.A.x === C.PAD);
  check("moving a corner marks it explored", moved.explored && !s.explored);
  check("an unknown corner is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("a non-finite corner is ignored", C.move(s, "B", P(NaN, 4)) === s);
  const far = C.move(s, "B", P(9999, -9999));
  check("corners are clamped inside the board",
    far.B.x === C.VIEW.width - C.PAD && far.B.y === C.PAD);
  check("all three checkboxes toggle and mark it explored",
    ["names", "partition1", "partition2"].every((k) => {
      const off = C.setOption(s, k, false);
      const on = C.setOption(off, k, true);
      return !off.options[k] && on.options[k] && on.explored && !s.explored;
    }));
  check("an unknown option is ignored", C.setOption(s, "nope", true) === s);
  check("partition boxes can be switched off",
    !C.setOption(C.setOption(s, "partition1", false), "partition2", false).options.partition1);
  const r = C.reset(C.setOption(moved, "names", true));
  check("Reset restores the four corners", r.A.x === 90 && r.D.y === 80);
  check("Reset keeps the options and the explored mark", r.explored && r.options.names);
  check("a non-convex status warns the player",
    /dent/.test(C.describe(C.move(s, "C", P(130, 110)))));
}

/* --------------------------------------- 2. fixed quadrilaterals and the claim */

const square = [P(70, 70), P(370, 70), P(370, 370), P(70, 370)];
const rectangle = [P(60, 110), P(390, 110), P(390, 290), P(60, 290)];
const tilted = [P(90, 180), P(300, 330), P(390, 90), P(160, 60)];
const parallelogram = [P(60, 100), P(320, 100), P(410, 300), P(150, 300)];
const startQ = appletReset();
const dart = [P(60, 60), P(300, 80), P(180, 120), P(80, 300)];
const fixed = [
  ["the applet's start", startQ],
  ["a square", square],
  ["a rectangle", rectangle],
  ["a tilted quadrilateral", tilted],
  ["a parallelogram", parallelogram],
];

for (const [name, q] of fixed) {
  const g = C.compute(...q);
  const claim = pageClaim(...q);
  const tol = 1e-8 * scaleOf(...q);
  check(`${name}: the core builds a construction`, !!g);
  check(`${name}: core and independent area agree`, close(g.areas.corner, claim.corner, tol)
    && close(g.areas.inner, claim.inner, tol));
  check(`${name}: the page's carpet equality holds`, claim.carpet && g.claims.carpet,
    `corner ${claim.corner}, inner ${claim.inner}`);
  check(`${name}: each carpet and its complement is half the shape`,
    claim.halves && g.claims.halves);
  check(`${name}: the core marks it convex`, g.claims.convex === claim.convex);
}
{
  const g = C.compute(...parallelogram);
  const claim = pageClaim(...parallelogram);
  check("a parallelogram is detected by both transcriptions",
    g.claims.parallelogram && claim.parallelogram);
  check("a parallelogram has one fifth of its area in PQRS",
    g.claims.fifth && claim.fifth,
    `ratio ${g.areas.inner / g.areas.abcd}`);
  const sq = C.compute(...square);
  check("a square also gives the one-fifth ratio", sq.claims.fifth);
}
{
  const g = C.compute(...dart);
  const claim = pageClaim(...dart);
  check("a dart is not convex", !g.claims.convex && !claim.convex);
  check("the carpet equality is not claimed for a non-convex shape",
    !claim.carpet && !g.claims.carpet);
  check("a non-convex status mentions dents", /dent/.test(C.describe(C.move(C.start(), "C", P(180, 120)))));
}

/* ------------------------- 3. thousands of generated convex quadrilaterals */

{
  const rand = rng(4821);
  let tested = 0, carpetFails = 0, halfFails = 0, coreFails = 0;
  for (let trial = 0; trial < 6000; trial++) {
    const q = [0, 1, 2, 3].map(() => P(20 + rand() * 410, 20 + rand() * 360));
    if (scaleOf(...q) < 100) continue;
    const claim = pageClaim(...q);
    if (!claim || !claim.convex) continue;
    const g = C.compute(...q);
    if (!g) { coreFails++; continue; }
    tested++;
    if (!claim.carpet) carpetFails++;
    if (!claim.halves) halfFails++;
    if (!(g.claims.carpet && g.claims.halves
      && close(g.areas.corner, claim.corner, claim.tol)
      && close(g.areas.inner, claim.inner, claim.tol))) coreFails++;
  }
  check(`${tested} random convex quadrilaterals satisfy the page's equality`,
    tested > 500 && carpetFails === 0, `${carpetFails} failures`);
  check(`all ${tested} have four half-area regions`, halfFails === 0, `${halfFails} failures`);
  check(`the core agrees on all ${tested} random cases`, coreFails === 0, `${coreFails} failures`);

  // The fifth is an affine fact about parallelograms, not about every shape.
  const pr = rng(991);
  let par = 0, fifthFails = 0;
  for (let trial = 0; trial < 600; trial++) {
    const a = P(40 + pr() * 160, 40 + pr() * 200);
    const d = P(pr() * 80 - 40, 40 + pr() * 180);
    const b = P(a.x + 60 + pr() * 120, a.y + pr() * 40 - 20);
    const c = P(b.x + d.x - a.x, b.y + d.y - a.y);
    if (c.x < 5 || c.x > 445 || c.y < 5 || c.y > 395) continue;
    const claim = pageClaim(a, b, c, d);
    if (!claim || !claim.parallelogram) continue;
    par++;
    if (!claim.fifth || !C.compute(a, b, c, d).claims.fifth) fifthFails++;
  }
  check(`${par} random parallelograms all have [PQRS] = [ABCD]/5`,
    par > 200 && fifthFails === 0, `${fifthFails} failures`);
  const skewed = pageClaim(P(0, 0), P(100, 0), P(80, 20), P(0, 60));
  check("the one-fifth add-on fails for a non-parallelogram convex shape",
    skewed.convex && skewed.carpet && !skewed.fifth,
    `ratio ${skewed.inner / skewed.abcd}`);
}

/* ---------------------- 4. the same drawing as a second bytecode transcription */

{
  const rand = rng(1994);
  let compared = 0, pointMismatches = 0, shapeMismatches = 0;
  const compare = (label, q) => {
    const [a, b, c, d] = q;
    const g = C.compute(a, b, c, d);
    const ap = appletDraw(a, b, c, d);
    const nan = Object.values(ap.points).some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y));
    if (!g) {
      if (!nan) {
        pointMismatches++;
        check(`${label}: the applet also refuses this shape`, false);
      }
      return;
    }
    const tol = 1e-9 * scaleOf(a, b, c, d);
    for (const key of ["E", "F", "G", "H", "P", "Q", "R", "S"]) {
      if (!closePoint(g[key], ap.points[key], tol)) {
        pointMismatches++;
        check(`${label}: core ${key} matches the applet's ${key}`, false,
          `applet ${JSON.stringify(ap.points[key])}, core ${JSON.stringify(g[key])}`);
      }
    }
    const sh = C.shapes(g);
    const polys = [
      [sh.partition1.triangles, ap.p1Triangles],
      [sh.partition1.quads, ap.p1Quads],
      [sh.partition2.triangles, ap.p2Triangles],
      [sh.partition2.quads, ap.p2Quads],
    ];
    const lines = [
      [[sh.partition1.lines[0]], [ap.p1Lines[0]]],
      [[sh.partition1.lines[1]], [ap.p1Lines[1]]],
      [[sh.partition1.dashed], [ap.diagAC]],
      [[sh.partition2.lines[0]], [ap.p2Lines[0]]],
      [[sh.partition2.lines[1]], [ap.p2Lines[1]]],
      [[sh.partition2.dashed], [ap.diagBD]],
      [sh.outline, ap.outline],
    ];
    const sameSet = (mine, theirs) => mine.length === theirs.length && mine.every((poly, i) =>
      poly.length === theirs[i].length
      && poly.every((p, j) => closePoint(p, theirs[i][j], tol)));
    for (const [mine, theirs] of polys.concat(lines)) {
      if (!sameSet(mine, theirs)) {
        shapeMismatches++;
        check(`${label}: the core draws the same shapes as Draw()`, false);
      }
    }
    compared++;
  };
  for (const [name, q] of fixed) compare(name, q);
  compare("a dart", dart);
  compare("near-parallel corners", [P(351, 156), P(268, 266), P(412, 33), P(284, 196)]);
  for (let trial = 0; trial < 1500; trial++) {
    const q = [0, 1, 2, 3].map(() => P(20 + rand() * 410, 20 + rand() * 360));
    compare(`random ${trial}`, q);
  }
  check(`core and applet points agree on ${compared} configurations`,
    compared > 1000 && pointMismatches === 0, `${pointMismatches} mismatches`);
  check(`core and applet fill/stroke arrays agree on ${compared} configurations`,
    shapeMismatches === 0, `${shapeMismatches} mismatches`);

  const parallelQ = [P(351, 156), P(268, 266), P(412, 33), P(284, 196)];
  check("GeoSDoub's |det|<1 rule makes the core refuse a near-parallel shape",
    C.compute(...parallelQ) === null
      && Number.isNaN(appletIntersect(parallelQ[0],
        appletMidPoint(parallelQ[1], parallelQ[2]), parallelQ[3],
        appletMidPoint(parallelQ[0], parallelQ[1])).x));
}

/* ----------------------------------------------- 5. degenerate input is safe */

{
  check("two coincident corners give no construction",
    C.compute(P(10, 10), P(10, 10), P(90, 20), P(40, 80)) === null);
  check("a non-finite corner gives no construction",
    C.compute(P(NaN, 10), P(50, 10), P(90, 20), P(40, 80)) === null);
  const degenerateState = C.move(C.start(), "A", C.start().B);
  check("a degenerate position has a helpful status", /four-sided shape/.test(C.describe(degenerateState)));
  check("a degenerate position still has no result", C.result(degenerateState) === null);
  check("describe works without a geometry", typeof C.describe({}) === "string");
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

done("carpets-in-quadri-2");
