#!/usr/bin/env node
"use strict";

/*
 * Logic test for inscribed-quadri/inscribed-quadri-core.js.
 *
 *   node porting/check-inscribed-quadri.mjs
 *
 * The applet has no win, loss or opponent — it draws a theorem — so the test
 * checks the page's claims and the drawing instead:
 *
 *   in every triangle HN:NO = 1:1 and HG:GO = 2:1;
 *   in a cyclic quadrilateral the four Euler lines concur at O;
 *   H_A...H_D, N_A...N_D, G_A...G_D are homothetic to ABCD with factors
 *      -1, -1/2 and -1/3, and to each other about O with factors 3 and 3/2;
 *   H, N, G, O lie on one line with HN:NO = 1:2 and HG:GO = 1:1;
 *   H is the circumcentre of N_A...N_D, the four nine-point circles have
 *      radius R/2 and pass through H, and the four Simson lines and four
 *      maltitudes (plus the diagonal perpendiculars) also pass through H.
 *
 * Section 3 transcribes GeoSDoub.FindAltitude/FindCircumcenter/Intersect/
 * NearestPoint, InsideTest.IsInside and the canvas' three family-centre
 * methods a second time and compares every drawn object with the core on the
 * start shape and 1,200 further quadrilaterals.  Sections 4 and 5 verify the
 * page's statements independently, from the unit-complex-number formulas
 * H=(a+b+c+d)/2, N=(a+b+c+d)/3, G=(a+b+c+d)/4 and from perpendicular feet.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("inscribed-quadri/inscribed-quadri-core.js", "InscribedQuadriCore");

const P = (x, y) => ({ x, y });
const OX = 200, OY = 150, R = 100;      // the applet's 400x300 canvas
const O = P(OX, OY);
const onCircle = (a) => P(OX + R * Math.cos(a), OY + R * Math.sin(a));
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const sub = (p, q) => P(p.x - q.x, p.y - q.y);
const add = (p, q) => P(p.x + q.x, p.y + q.y);
const mul = (p, k) => P(p.x * k, p.y * k);
const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
function distToLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const n = Math.hypot(dx, dy);
  return n ? Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / n : dist(p, a);
}
const same = (p, q, tol) => finite(p) && finite(q)
  && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;

/* ----------------------------------------- the applet's arithmetic, javap */

/* GeoSDoub.Intersect(P1,P2,P3,P4): NaN pair when |det| < 1. */
function apIntersect(a, b, c, d) {
  const a1 = a.y - b.y, a2 = b.x - a.x, a3 = a.x * b.y - a.y * b.x;
  const b1 = c.y - d.y, b2 = d.x - c.x, b3 = c.x * d.y - c.y * d.x;
  const det = a1 * b2 - b1 * a2;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((a2 * b3 - b2 * a3) / det, (a3 * b1 - b3 * a1) / det);
}

/* GeoSDoub.FindAltitude(P,A,B). */
function apAltitude(p, a, b) {
  return apIntersect(p, P(p.x + b.y - a.y, p.y - b.x + a.x), a, b);
}

/* GeoSDoub.FindCircumcenter(A,B,C), in the argument order given. */
function apCircumcenter(a, b, c) {
  const m1 = mid(a, b), m2 = mid(b, c);
  return apIntersect(m1,
    P(m1.x + b.y - a.y, m1.y - (b.x - a.x)),
    m2,
    P(m2.x + c.y - b.y, m2.y - (c.x - b.x)));
}

/* GeoSDoub.NearestPoint(P,A,B), with its SqDist < 0.1 early return. */
function apNearest(p, a, b) {
  if ((p.x - a.x) ** 2 + (p.y - a.y) ** 2 < 0.1) return P(p.x, p.y);
  const dx = b.x - a.x, dy = b.y - a.y;
  const den = dx * dx + dy * dy;
  if (den <= 1e-12) return P(a.x, a.y);
  const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / den;
  return P(a.x + dx * t, a.y + dy * t);
}

/* InsideTest.IsInside(P,A,B) and the canvas' Simson(P,A,B,C). */
function apInside(p, a, b) {
  return (p.x - a.x) * (p.x - b.x) + (p.y - a.y) * (p.y - b.y) <= 0;
}
function apSimson(p, a, b, c) {
  const f1 = apNearest(p, b, c), f2 = apNearest(p, a, c), f3 = apNearest(p, a, b);
  let ends = null;
  if (apInside(f1, f2, f3)) ends = [f2, f3];
  else if (apInside(f2, f3, f1)) ends = [f3, f1];
  else if (apInside(f3, f1, f2)) ends = [f1, f2];
  return ends ? { feet: [f1, f2, f3], ends } : null;
}

/* The canvas' FindOrthocenter / FindNinepointscenter (circumcenter B,A,C). */
function apOrtho(a, b, c) {
  return apIntersect(a, apAltitude(a, b, c), b, apAltitude(b, a, c));
}
function apNine(a, b, c) {
  return mid(apOrtho(a, b, c), apCircumcenter(b, a, c));
}
function apCentroid(a, b, c) {
  return P((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
}

/* DrawOrthocenters / DrawNinepointscenters / DrawCentroids, tail: intersect
 * A-family[0] with C-family[2], B-family[1] with D-family[3], and the fallback
 * family[2]-A[2] with family[3]-A[3] when either result is NaN. */
function apFamilyCenter(family, corners) {
  let p = apIntersect(family[0], corners[0], family[2], corners[2]);
  let q = apIntersect(family[1], corners[1], family[3], corners[3]);
  if (!finite(p)) p = apIntersect(family[2], corners[2], family[3], corners[3]);
  if (!finite(q)) q = apIntersect(family[2], corners[2], family[3], corners[3]);
  return finite(p) && finite(q) ? mid(p, q) : null;
}

const INDEX = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]];

/** Rebuild the complete picture from four corners, without using the core. */
function appletPicture(q) {
  const tris = INDEX.map((row) => row.map((i) => q[i]));
  const orthos = tris.map((t) => apOrtho(t[0], t[1], t[2]));
  const centers = tris.map((t) => apNine(t[0], t[1], t[2]));
  const cents = tris.map((t) => apCentroid(t[0], t[1], t[2]));
  const maltitudes = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, k = (i + 2) % 4, l = (i + 3) % 4;
    const m = mid(q[i], q[j]);
    maltitudes.push([m, apNearest(m, q[k], q[l])]);
  }
  const simsons = [];
  for (let i = 0; i < 4; i++) {
    simsons.push(apSimson(q[i], q[(i + 1) % 4], q[(i + 2) % 4], q[(i + 3) % 4]));
  }
  return {
    points: q, triangles: tris, orthos, centers, cents,
    H: apFamilyCenter(orthos, q), N: apFamilyCenter(centers, q), G: apFamilyCenter(cents, q),
    eulerLines: tris.map((t) => [apOrtho(t[0], t[1], t[2]), apCircumcenter(t[0], t[1], t[2])]),
    maltitudes, simsons,
    nineCircles: centers.map((n) => [n, R / 2]),
    homotheties: {
      H: q.map((p, i) => [p, orthos[i]]),
      N: q.map((p, i) => [p, centers[i]]),
      G: q.map((p, i) => [p, cents[i]]),
    },
  };
}

function configs() {
  const fixed = [
    C.START_ANGLES,
    [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2],
    [0, 1.2, 3.4, 5.0],
    [0, 0.9, 1.8, 2.7],
    [5.235987755982989, 3.765191430678208, 2.6179938779914944, 0.5235987755982988],
  ];
  const rand = rng(20261127);
  const out = fixed.slice();
  for (let i = 0; i < 1200; i++) {
    let a = rand() * 0.4;
    const angles = [a];
    for (let k = 0; k < 3; k++) { a += 0.5 + rand() * 1.3; angles.push(a); }
    out.push(angles);
  }
  return out;
}

/* ---------------------------------------------------- 1. start and rules */

{
  const s = C.start({});
  equal("Reset uses the four class-file angles", s.angles, C.START_ANGLES);
  check("the circle is 100 units round (200,150)", C.CENTER.x === 200 && C.CENTER.y === 150 && C.RADIUS === 100);
  check("all nine checkboxes start unticked",
    C.OPTION_KEYS.every((k) => s.options[k] === false) && C.OPTION_KEYS.length === 9);
  check("the nine labels are the applet's own", C.OPTION_LABELS.maltitudes === "Maltitudes"
    && C.OPTION_LABELS.ninePointCircles === "Nine point circles"
    && C.OPTION_LABELS.homothety === "Homotheties");
  check("a fresh diagram has not been explored", !s.explored);
  check("a demonstration has no result", C.result(s) === null);
  check("the core has no DOM", typeof globalThis.document === "undefined");
  check("the four start corners lie on the circle",
    s.angles.every((a) => Math.abs(dist(onCircle(a), O) - R) < 1e-9));
  const g = C.geometry(s);
  check("the start diagram has a construction", !!g);
  check("every page claim holds on the start shape", !!g && Object.keys(g.claims).every((k) => g.claims[k]));
  check("a missing state has no construction", C.geometry(null) === null);
}

/* ------------------------------------------- 2. moves, options, messages */

{
  const s = C.start();
  const m = C.move(s, "B", P(20, 20));
  check("a move leaves the old state alone", s.angles[1] !== m.angles[1]);
  check("a move marks the diagram explored", m.explored && !s.explored);
  check("a dragged corner is put back on the circle",
    Math.abs(dist(C.onCircle(m.angles[1]), O) - R) < 1e-9);
  check("an unknown corner is ignored", C.move(s, "Z", P(1, 1)) === s);
  check("a non-finite point is ignored", C.move(s, "A", NaN) === s);
  check("the centre of the circle has a valid angle", finite(C.onCircle(C.angleOf(O))));
  check("the angle wraps into [0,2*pi)", C.angleOf(P(OX, OY - 1)) > 4 && C.angleOf(P(OX, OY - 1)) < 5);

  let t = s;
  for (const key of C.OPTION_KEYS) t = C.setOption(t, key, true);
  check("each checkbox toggles independently", C.OPTION_KEYS.every((k) => t.options[k]));
  check("an unknown checkbox is ignored", C.setOption(s, "nope", true) === s);
  check("a checkbox can be turned off again", !C.setOption(t, "simsons", false).options.simsons);
  check("ticking a box marks the diagram explored", t.explored && !s.explored);

  const r = C.reset(t);
  equal("Reset restores the four angles", r.angles, C.START_ANGLES);
  check("Reset keeps the checkboxes and explored flag",
    C.OPTION_KEYS.every((k) => r.options[k]) && r.explored);
  check("the status names H and O when lines are shown", /H is the pink dot/.test(C.describe(t)));
  check("the status invites a drag at the start", /Drag A, B, C or D/.test(C.describe(s)));
  check("a missing state still has a status", typeof C.describe({}) === "string");
  check("the result stays null after moves and options", C.result(m) === null && C.result(t) === null);
}

/* ----------------------------------- 3. the core against the applet bytecode */

{
  let worst = 0, compared = 0, mismatches = 0;
  for (const angles of configs()) {
    const q = angles.map(onCircle);
    const g = C.compute(...q);
    const ap = appletPicture(q);
    if (!g || !finite(ap.H) || !finite(ap.N) || !finite(ap.G)) { mismatches++; continue; }
    const pointPairs = [
      [g.H, ap.H], [g.N, ap.N], [g.G, ap.G],
      ...g.orthocenters.map((p, i) => [p, ap.orthos[i]]),
      ...g.nineCenters.map((p, i) => [p, ap.centers[i]]),
      ...g.centroids.map((p, i) => [p, ap.cents[i]]),
      ...g.eulerLines.flatMap((l, i) => [[l.from, ap.eulerLines[i][0]], [l.to, ap.eulerLines[i][1]]]),
      ...g.maltitudes.flatMap((l, i) => [[l.from, ap.maltitudes[i][0]], [l.to, ap.maltitudes[i][1]]]),
      ...g.nineCircles.map((c, i) => [c.center, ap.nineCircles[i][0]]),
      ...g.homothetyLines.H.flatMap((l, i) => [[l[0], ap.homotheties.H[i][0]], [l[1], ap.homotheties.H[i][1]]]),
      ...g.homothetyLines.N.flatMap((l, i) => [[l[0], ap.homotheties.N[i][0]], [l[1], ap.homotheties.N[i][1]]]),
      ...g.homothetyLines.G.flatMap((l, i) => [[l[0], ap.homotheties.G[i][0]], [l[1], ap.homotheties.G[i][1]]]),
    ];
    for (const [a, b] of pointPairs) {
      compared++;
      worst = Math.max(worst, finite(a) && finite(b) ? dist(a, b) : Infinity);
      if (!same(a, b, 1e-7)) mismatches++;
    }
    for (let i = 0; i < 4; i++) {
      const mine = g.simsons[i], theirs = ap.simsons[i];
      compared += 2;
      if (!mine !== !theirs) mismatches++;
      if (mine) for (const [a, b] of [[mine.feet[0], theirs.feet[0]],
        [mine.feet[1], theirs.feet[1]], [mine.feet[2], theirs.feet[2]],
        [mine.ends[0], theirs.ends[0]], [mine.ends[1], theirs.ends[1]]]) {
        compared++;
        worst = Math.max(worst, dist(a, b));
        if (!same(a, b, 1e-7)) mismatches++;
      }
      if (Math.abs(g.nineCircles[i].radius - ap.nineCircles[i][1]) > 1e-12) mismatches++;
    }
  }
  check("every drawn point matches the second bytecode transcription", mismatches === 0,
    `${mismatches} mismatches in ${compared} comparisons`);
  check("the worst pointwise difference stays below 1e-7", worst < 1e-7, `worst ${worst}`);
  check("all 1,205 configurations produced a construction", compared > 100000);
}

/* ----------------------- 4. the page's claims, independently of the core */

/* The page's own complex-number formulas, with O at the origin:
 * P(t) of the triangle omitting A is t(b+c+d), so Q(t)=t(a+b+c+d)/(1+t). */
function analytic(q) {
  const s = q.reduce((acc, p) => add(acc, sub(p, O)), P(0, 0));
  const centres = {
    H: add(O, mul(s, 1 / 2)),
    N: add(O, mul(s, 1 / 3)),
    G: add(O, mul(s, 1 / 4)),
  };
  const family = {
    H: q.map((_, i) => add(O, sub(s, sub(q[i], O)))),
    N: q.map((_, i) => add(O, mul(sub(s, sub(q[i], O)), 1 / 2))),
    G: q.map((_, i) => add(O, mul(sub(s, sub(q[i], O)), 1 / 3))),
  };
  return { s, centres, family };
}

{
  const rand = rng(5742);
  const angles = configs().slice(0, 5);
  for (let i = 0; i < 2000; i++) {
    let a = rand() * 0.5;
    const row = [a];
    for (let k = 0; k < 3; k++) { a += 0.6 + rand() * 1.2; row.push(a); }
    angles.push(row);
  }
  let checked = 0, failures = 0, degenerate = 0, worstRatio = 0, worstFoot = 0;
  for (const row of angles) {
    const q = row.map(onCircle);
    const g = C.compute(...q);
    const an = analytic(q);
    if (!g) { failures++; continue; }
    /* The square has a+b+c+d=0, so H=N=G=O and the ratios 1:2 and 1:1 are
     * statements about coincident points: skip it for the ratio check only. */
    if (dist(an.centres.H, O) < 1e-6) { degenerate++; continue; }
    checked++;
    const tol = 1e-6;
    const errs = {
      H: dist(g.H, an.centres.H), N: dist(g.N, an.centres.N), G: dist(g.G, an.centres.G),
      HN: Math.abs(dist(g.H, g.N) / dist(g.N, O) - 0.5),
      HG: Math.abs(dist(g.H, g.G) / dist(g.G, O) - 1),
      collinearH: distToLine(g.H, g.N, O), collinearG: distToLine(g.G, g.N, O),
    };
    worstRatio = Math.max(worstRatio, errs.HN, errs.HG);
    for (const k of ["H", "N", "G", "HN", "HG", "collinearH", "collinearG"]) {
      if (errs[k] > tol) failures++;
    }
    for (let i = 0; i < 4; i++) {
      const u = sub(q[i], O);
      const expectedH = add(O, sub(an.s, u));
      const expectedN = add(O, mul(sub(an.s, u), 1 / 2));
      const expectedG = add(O, mul(sub(an.s, u), 1 / 3));
      if (dist(g.orthocenters[i], expectedH) > tol) failures++;
      if (dist(g.nineCenters[i], expectedN) > tol) failures++;
      if (dist(g.centroids[i], expectedG) > tol) failures++;
      if (dist(g.orthocenters[i], add(g.H, mul(sub(q[i], g.H), -1))) > tol) failures++;
      if (dist(g.nineCenters[i], add(g.N, mul(sub(q[i], g.N), -0.5))) > tol) failures++;
      if (dist(g.centroids[i], add(g.G, mul(sub(q[i], g.G), -1 / 3))) > tol) failures++;
      if (dist(g.orthocenters[i], add(O, mul(sub(g.centroids[i], O), 3))) > tol) failures++;
      if (dist(g.nineCenters[i], add(O, mul(sub(g.centroids[i], O), 1.5))) > tol) failures++;
      if (Math.abs(dist(g.nineCenters[i], g.H) - 50) > tol) failures++;
      /* An independent Euler-line test in triangle i: H_i, N_i, G_i, O. */
      const t = g.triangles[i];
      if (Math.abs(dist(apOrtho(...t), apNine(...t)) - dist(apNine(...t), O)) > tol) failures++;
      if (Math.abs(dist(apOrtho(...t), apCentroid(...t))
        - 2 * dist(apCentroid(...t), O)) > tol) failures++;
      if (distToLine(O, g.eulerLines[i].from, g.eulerLines[i].to) > tol) failures++;

      /* The four Simson lines and maltitudes pass through the analytic H. */
      if (g.simsons[i]) {
        const sfeet = apSimson(q[i], q[(i + 1) % 4], q[(i + 2) % 4], q[(i + 3) % 4]);
        const d = distToLine(an.centres.H, sfeet.ends[0], sfeet.ends[1]);
        worstFoot = Math.max(worstFoot, d);
        if (d > tol) failures++;
      }
      const malt = g.maltitudes[i];
      if (distToLine(an.centres.H, malt.from, malt.to) > tol) failures++;
    }
    /* The perpendicular from a diagonal's midpoint to the other diagonal. */
    if (Math.abs((an.centres.H.x - mid(q[0], q[2]).x) * (q[3].x - q[1].x)
      + (an.centres.H.y - mid(q[0], q[2]).y) * (q[3].y - q[1].y)) > tol) failures++;
    if (Math.abs((an.centres.H.x - mid(q[1], q[3]).x) * (q[0].x - q[2].x)
      + (an.centres.H.y - mid(q[1], q[3]).y) * (q[0].y - q[2].y)) > tol) failures++;
  }
  check("2,004 non-degenerate cyclic quadrilaterals satisfy every page claim",
    failures === 0 && checked === 2004, `${failures} failures in ${checked} shapes`);
  check("the symmetric square is the only case with H=N=G=O", degenerate === 1);
  check("the two Euler-line ratios are exact to rounding", worstRatio < 1e-6, `worst ${worstRatio}`);
  check("Simson feet and maltitudes meet at the analytic H", worstFoot < 1e-6, `worst ${worstFoot}`);
}

/* --------------------------------------------- 5. an explicitly false case */

{
  /* Outside a circle the factor chain breaks: this is why the page says
   * "if the quadrilateral is cyclic".  The port nevertheless keeps every
   * corner on the circle, just as RestrictToCircle does in the applet. */
  const s = C.start();
  const moved = C.move(s, "A", C.onCircle(0.7));
  const g = C.geometry(moved);
  check("moving one corner keeps all four on the same circle",
    !!g && g.claims.cyclic && Object.keys(g.claims).every((k) => g.claims[k]));
  const pulled = C.move(s, "A", P(1, 2));
  check("a corner dragged towards the middle is projected back to the circle",
    Math.abs(dist(C.onCircle(pulled.angles[0]), O) - R) < 1e-9);
  const spread = C.move(s, "A", C.onCircle(0.2));
  check("the port has no way to drag a corner off the circle",
    !!C.geometry(spread) && C.geometry(spread).claims.cyclic);
}

done("inscribed-quadri");
