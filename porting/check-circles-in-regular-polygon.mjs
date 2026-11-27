#!/usr/bin/env node
"use strict";

/*
 * Logic test for circles-in-regular-polygon/circles-in-regular-polygon-core.js.
 *
 *   node porting/check-circles-in-regular-polygon.mjs
 *
 * The applet's page makes five claims for a regular N-gon (N >= 5) with all
 * diagonals drawn from one vertex A:
 *
 *   1. the incenters of the N-2 triangles are concyclic (iCircle);
 *   2. their centroids are concyclic (cCircle);
 *   3. one circle touches every incircle and the circumcircle (tCircle);
 *   4. cCircle touches the two sides through A;
 *   5. the feet of the bisectors from A are concyclic (aCircle).
 *
 * Claims 2, 3 and 4 hold for every N the panel offers (5..30).  Claims 1 and
 * 5 hold for N = 5 and N = 6 only; on N >= 7 the circles the applet draws
 * through three of the points miss the others by a noticeable number of
 * drawing units.  This test says so instead of papering over it: it measures
 * the residuals with an independent construction and asserts both facts.
 *
 * Section 5 writes Reset() a second time straight from the bytecode, using
 * the applet's own rotate/intersect construction of the incenter, the
 * circumcenter and the angle-bisector foot, plus its ApolloniusCircle code,
 * and compares every object with the core for all N and several rotations.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("circles-in-regular-polygon/circles-in-regular-polygon-core.js",
  "CirclesInRegularPolygonCore");

const P = (x, y) => ({ x: x, y: y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const mid = (p, q) => P((p.x + q.x) / 2, (p.y + q.y) / 2);
const close = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;
const closeP = (p, q, t) => !!p && !!q && close(p.x, q.x, t) && close(p.y, q.y, t);
const TOL = 1e-7 * C.RADIUS;

/* --------------------------------------------------------------- 1. basics */

{
  const s = C.start({});
  equal("the applet starts with N = 5", s.n, 5);
  close("A starts at the top of the circumcircle", s.angle, C.START_ANGLE, 1e-12);
  check("all eight Show boxes start unchecked", C.OPTION_KEYS.every((k) => !s.options[k]));
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a fresh picture is not yet explored", !s.explored);
  check("the start picture has a construction", !!C.geometry(s));
  check("the start picture draws N-2 triangles", C.geometry(s).triangles.length === s.n - 2);
  check("the core keeps the applet's circumcircle radius min(W,H)/2.1",
    close(C.RADIUS, Math.min(C.VIEW.width, C.VIEW.height) / 2.1, 1e-12));
  check("the core has no DOM", typeof globalThis.document === "undefined");
  check("there are exactly eight options, as in the panel", C.OPTION_KEYS.length === 8);
}

/* ------------------------------------------- 2. options, ranges and purity */

{
  const clampN = (v) => Number.isFinite(v)
    ? Math.max(5, Math.min(30, Math.round(Number(v)))) : 5;
  for (const v of [-99, 0, 4, 4.6, 5, 5.4, 17, 29.6, 30, 31, 100, NaN, Infinity, -Infinity]) {
    equal(`N ${v} is clamped to the spinner range`, C.setN(C.start(), v).n, clampN(v));
  }
  const fresh = C.start();
  check("setting the same N changes nothing", C.setN(fresh, 5) === fresh);
  const wide = C.setOption(C.setN(fresh, 30), "iCircle", true);
  check("changing N keeps the options and marks the picture explored",
    wide.n === 30 && wide.options.iCircle && wide.explored);
  check("changing N back rebuilds the triangles", C.setN(wide, 7).triangles === undefined
    && C.geometry(C.setN(wide, 7)).triangles.length === 5);
  check("Reset keeps N and the options but returns A to the top",
    C.reset(wide).n === 30 && C.reset(wide).options.iCircle && C.reset(wide).angle === C.START_ANGLE);
  check("a fresh state is not mutated by a change", !fresh.explored && fresh.n === 5
    && fresh.options.iCircle === false);
  check("an unknown option is ignored", C.setOption(fresh, "nope", true) === fresh);
  check("setting an option to its current value is ignored",
    C.setOption(wide, "iCircle", true) === wide);
  check("turning an option off works", !C.setOption(wide, "iCircle", false).options.iCircle);
  const turned = C.setAngle(fresh, 0.9);
  check("dragging A changes the angle and marks the picture explored",
    close(turned.angle, 0.9, 1e-12) && turned.explored && fresh.angle === C.START_ANGLE);
  check("a non-finite angle is ignored", C.setAngle(fresh, NaN) === fresh);
  check("angles wrap into one turn", close(C.setAngle(fresh, 2 * Math.PI + 0.25).angle, 0.25, 1e-12));
  check("an illustration never ends, however much you explore it",
    C.result(turned) === null && C.result(C.reset(turned)) === null);
  check("the status invites a tick when nothing is shown", /Tick a box/.test(C.describe(fresh)));
  check("the status names what is shown once boxes are ticked",
    /incenters on one circle/.test(C.describe(C.setOption(fresh, "incenters", true))));
}

/* --------------------------- 3. the page's claims, for every N and angles */

{
  const angles = [C.START_ANGLE, 0, 0.37, 2.13, 5.9];
  let cases = 0, bad2 = 0, bad3 = 0, bad4 = 0, badDiag = 0;
  let bad1Small = 0, bad1Large = 0, bad5Small = 0, bad5Large = 0;
  let max1Small = 0, min1Large = Infinity, max5Small = 0, min5Large = Infinity;
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (const angle of angles) {
      const s = C.setAngle(C.start({ n: n }), angle);
      const g = C.geometry(s);
      const m = g.measures;
      cases++;
      /* #2: the centroids are on cCircle. */
      if (!g.claims.centroidsConcyclic || !(m.cSpread <= TOL)) bad2++;
      /* #3: tCircle encloses every incircle and touches the circumcircle. */
      if (!g.claims.tangentToIncircles || !g.claims.tangentToCircumcircle
          || !(m.tIncircleError <= TOL) || !(m.tOuterError <= TOL)) bad3++;
      /* #4: cCircle touches both sides through A. */
      if (!g.claims.centroidCircleTangentToSides || !(Math.abs(m.cSideError) <= TOL)) bad4++;
      /* The page's diagonal formula 2|cos(pi k/n)| is the chord from the
       * point opposite A; the diagonals from A are 2|sin(pi k/n)|. */
      let pageFormulaError = 0, fanError = 0;
      for (let k = 1; k < n; k++) {
        pageFormulaError = Math.max(pageFormulaError, Math.abs(
          dist(g.vertices[0], g.vertices[k]) - 2 * C.RADIUS * Math.abs(Math.sin(Math.PI * k / n))));
        const antipode = P(g.center.x * 2 - g.vertices[0].x, g.center.y * 2 - g.vertices[0].y);
        fanError = Math.max(fanError, Math.abs(
          dist(antipode, g.vertices[k]) - 2 * C.RADIUS * Math.abs(Math.cos(Math.PI * k / n))));
      }
      if (pageFormulaError > TOL || fanError > TOL) badDiag++;
      /* #1 and #5: true only for the two small polygons. */
      if (n <= 6) {
        if (!g.claims.incentersConcyclic) bad1Small++;
        if (!g.claims.bisectorFeetConcyclic) bad5Small++;
        max1Small = Math.max(max1Small, m.iSpread);
        max5Small = Math.max(max5Small, m.aSpread);
      } else {
        if (g.claims.incentersConcyclic || m.iSpread < TOL * 100) bad1Large++;
        if (g.claims.bisectorFeetConcyclic || m.aSpread < TOL * 100) bad5Large++;
        min1Large = Math.min(min1Large, m.iSpread);
        min5Large = Math.min(min5Large, m.aSpread);
      }
    }
  }
  check(`claim 2 (centroids concyclic) holds on all ${cases} configurations`, bad2 === 0);
  check(`claim 3 (tangent circle) holds on all ${cases} configurations`, bad3 === 0);
  check(`claim 4 (centroid circle tangent to the two sides) holds on all ${cases} configurations`, bad4 === 0);
  check(`both diagonal length formulas hold on all ${cases} configurations`, badDiag === 0);
  check("claim 1 (incenters concyclic) holds for N = 5 and 6", bad1Small === 0 && max1Small <= TOL,
    `worst spread ${max1Small}`);
  check("claim 5 (bisector feet concyclic) holds for N = 5 and 6", bad5Small === 0 && max5Small <= TOL,
    `worst spread ${max5Small}`);
  check("claim 1 fails honestly for every N >= 7", bad1Large === 0, `smallest spread ${min1Large}`);
  check("claim 5 fails honestly for every N >= 7", bad5Large === 0, `smallest spread ${min5Large}`);
}

/* -------------------------- 4. rotation invariance and plain-data snapshot */

{
  for (const n of [5, 6, 7, 12, 30]) {
    const base = C.geometry(C.start({ n: n })).measures;
    const spun = C.geometry(C.setAngle(C.start({ n: n }), 1.234)).measures;
    for (const key of ["iSpread", "cSpread", "aSpread", "tIncircleError", "tOuterError",
      "cSideError", "diagonalError"]) {
      check(`${key} is unchanged when A is dragged (N=${n})`, close(base[key], spun[key], TOL));
    }
  }
  const snap = C.snapshot(C.setOption(C.start(), "aCircle", true));
  check("a snapshot is plain data for Track.state()",
    snap.n === 5 && snap.vertices.length === 5 && snap.options.aCircle
    && typeof snap.angle === "number" && Number.isFinite(snap.angle));
  check("a snapshot has no methods", Object.values(snap).every((v) =>
    typeof v !== "function"));
  check("a bad N gives no geometry",
    C.geometry(Object.assign({}, C.start(), { n: 4 })) === null
    && C.geometry(Object.assign({}, C.start(), { n: 31 })) === null);
  check("describe survives a missing state", typeof C.describe({}) === "string");
}

/* ---------------- 5. second transcription of the applet's own computation */

/* GeoSDoub.FindOrientation, Rotate, ComputeAngle and Intersect, transcribed
 * from the bytecode rather than using the core's analytic formulas. */
const orient = (a, b, c) =>
  c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y > 0 ? 1 : -1;
const angleAt = (a, b, c) => {
  const num = dist(a, b) ** 2 + dist(a, c) ** 2 - dist(b, c) ** 2;
  return Math.acos(num / (2 * dist(a, b) * dist(a, c)));
};
function rotate(p, q, theta, dir) {
  const co = Math.cos(theta), si = Math.sin(theta);
  return P(p.x + co * (q.x - p.x) - dir * si * (q.y - p.y),
           p.y + dir * si * (q.x - p.x) + co * (q.y - p.y));
}
function intersect(p1, p2, p3, p4) {
  const a1 = p1.y - p2.y, b1 = p2.x - p1.x, c1 = p1.x * p2.y - p1.y * p2.x;
  const a2 = p3.y - p4.y, b2 = p4.x - p3.x, c2 = p3.x * p4.y - p3.y * p4.x;
  const det = b1 * a2 - b2 * a1;
  return P((c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det);
}
function appletIncenter(a, b, c) {
  const h1 = angleAt(a, b, c) / 2, h2 = angleAt(b, c, a) / 2;
  const o = orient(a, b, c);
  return intersect(a, rotate(a, b, h1, o), b, rotate(b, c, h2, o));
}
function appletBisectorFoot(a, b, c) {
  const h = angleAt(a, b, c) / 2;
  return intersect(a, rotate(a, b, h, orient(a, b, c)), b, c);
}
function appletCircumcenter(a, b, c) {
  /* FindCircumcenter(): intersect the two perpendicular bisectors. */
  const m1 = mid(a, b), m2 = mid(b, c);
  const q1 = P(m1.x + b.y - a.y, m1.y - (b.x - a.x));
  const q2 = P(m2.x + c.y - b.y, m2.y - (c.x - b.x));
  return intersect(m1, q1, m2, q2);
}
function appletNearest(p, a, b) {
  /* GeoSDoub.NearestPoint(P,A,B), without clamping the parameter. */
  const vx = b.x - a.x, vy = b.y - a.y;
  if (vx === 0 && vy === 0) return P(a.x, a.y);
  const t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy);
  return P(a.x + t * vx, a.y + t * vy);
}
function appletCircleFrom3(a, b, c) {
  const o = appletCircumcenter(a, b, c);
  return { center: o, radius: (dist(o, a) + dist(o, b) + dist(o, c)) / 3 };
}
function appletIncircle(a, b, c) {
  const o = appletIncenter(a, b, c);
  return { center: o, radius: (dist(o, appletNearest(o, a, b))
    + dist(o, appletNearest(o, b, c)) + dist(o, appletNearest(o, c, a))) / 3 };
}
/* ApolloniusCircle.SetCircles/Compute(-1,-1,-1), including the detail that
 * the centre uses the signed root while the radius uses its absolute value. */
function appletApollonius(c0, c1, c2) {
  const A1 = 2 * (c1.center.x - c0.center.x), A2 = 2 * (c2.center.x - c0.center.x);
  const B1 = 2 * (c1.center.y - c0.center.y), B2 = 2 * (c2.center.y - c0.center.y);
  const info = (c) => c.center.x ** 2 + c.center.y ** 2 - c.radius ** 2;
  const o = info(c0), D1 = o - info(c1), D2 = o - info(c2);
  const K = A1 * B2 - A2 * B1;
  const G = (B1 * D2 - B2 * D1) / K, I = -(A1 * D2 - A2 * D1) / K;
  const e1 = 2 * ((-1) * c0.radius - (-1) * c1.radius);
  const e2 = 2 * ((-1) * c0.radius - (-1) * c2.radius);
  const x = (B1 * e2 - B2 * e1) / K, y = -(A1 * e2 - A2 * e1) / K;
  const w = x * x + y * y - 1;
  const t = 2 * (x * G + y * I - x * c0.center.x - y * c0.center.y + (-1) * c0.radius);
  const q = G * G + I * I - 2 * G * c0.center.x - 2 * I * c0.center.y + o;
  const signed = (-t + Math.sqrt(t * t - 4 * w * q)) / 2 / w;
  return { center: P(x * signed + G, y * signed + I), radius: Math.abs(signed) };
}
/** CirclesInRegularPolygonCanvas.Reset(), line for line. */
function appletReset(n, angle) {
  const R = Math.min(C.VIEW.width, C.VIEW.height) / 2.1;
  const ctr = C.CENTER, step = 2 * Math.PI / n;
  const V = Array.from({ length: n }, (_, k) =>
    P(ctr.x + R * Math.cos(angle + k * step), ctr.y + R * Math.sin(angle + k * step)));
  const O = [], inc = [], AB = [];
  for (let i = 1; i < n - 1; i++) {
    O.push(P((V[0].x + V[i].x + V[i + 1].x) / 3,
             (V[0].y + V[i].y + V[i + 1].y) / 3));
    inc.push(appletIncircle(V[0], V[i], V[i + 1]));
    AB.push(appletBisectorFoot(V[0], V[i], V[i + 1]));
  }
  const half = Math.floor((n - 2) / 2);
  const iCircle = appletCircleFrom3(inc[0].center, inc[n - 3].center, inc[half].center);
  const cCircle = appletCircleFrom3(O[0], O[n - 3], O[half]);
  let tCircle;
  if (n % 2 === 0) {
    tCircle = appletApollonius(inc[0], inc[n - 3], inc[n / 2 - 1]);
  } else {
    const M = mid(V[(n - 1) / 2], V[(n + 1) / 2]);
    tCircle = { center: mid(V[0], M), radius: dist(V[0], M) / 2 };
  }
  const fi = n === 5 ? 1 : Math.floor((n - 1) / 2);
  const aCircle = appletCircleFrom3(AB[0], AB[n - 3], AB[fi]);
  return { V, O, inc, AB, iCircle, cCircle, tCircle, aCircle };
}

{
  const rand = rng(3282);
  let compared = 0, mismatches = 0;
  const compare = (label, s) => {
    const g = C.geometry(s), a = appletReset(s.n, s.angle);
    const tol = 1e-8 * C.RADIUS;
    const eqC = (name, p, q) => {
      if (!closeP(p, q, tol)) {
        mismatches++;
        check(`${label}: ${name} matches Reset()`, false,
          `applet ${JSON.stringify(q)}, core ${JSON.stringify(p)}`);
      }
    };
    const eqR = (name, p, q) => {
      if (!close(p.radius, q.radius, tol)) {
        mismatches++;
        check(`${label}: ${name} radius matches Reset()`, false,
          `applet ${q.radius}, core ${p.radius}`);
      }
      eqC(name, p.center, q.center);
    };
    for (let k = 0; k < s.n; k++) eqC(`V[${k}]`, g.vertices[k], a.V[k]);
    for (let k = 0; k < g.triangles.length; k++) {
      eqC(`centroid ${k}`, g.centroids[k], a.O[k]);
      eqC(`incenter ${k}`, g.triangles[k].incircle.center, a.inc[k].center);
      eqC(`bisector foot ${k}`, g.feet[k], a.AB[k]);
      eqR(`incircle ${k}`, g.incircles[k], a.inc[k]);
    }
    eqR("iCircle", g.iCircle, a.iCircle);
    eqR("cCircle", g.cCircle, a.cCircle);
    eqR("tCircle", g.tCircle, a.tCircle);
    eqR("aCircle", g.aCircle, a.aCircle);
    compared++;
  };
  for (let n = C.N_MIN; n <= C.N_MAX; n++) {
    for (const angle of [C.START_ANGLE, 0, 0.37, 2.13, 4.7]) {
      compare(`N=${n} angle=${angle.toFixed(2)}`, C.setAngle(C.start({ n: n }), angle));
    }
  }
  for (let trial = 0; trial < 120; trial++) {
    const n = 5 + Math.floor(rand() * 26);
    compare(`random ${trial}`, C.setAngle(C.start({ n: n }), rand() * 2 * Math.PI));
  }
  check(`core and applet bytecode agree on all ${compared} configurations`, mismatches === 0);
}

/* A value read back from the real ApolloniusCircle class run under Java on
 * the N=6 incircles (ApolloniusCircle.Compute(-1,-1,-1), result[0]). */
{
  const g = C.geometry(C.start({ n: 6 }));
  check("the even-N tangent circle matches the Java class exactly",
    closeP(g.tCircle.center, P(200, 140.430385984603), 1e-9)
    && close(g.tCircle.radius, 133.287528841746, 1e-9));
}

done("circles-in-regular-polygon");
