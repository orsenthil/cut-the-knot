#!/usr/bin/env node
"use strict";

/*
 * Logic test for de-villiers-3/de-villiers-3-core.js.
 *
 *   node porting/check-de-villiers-3.mjs
 *
 * Checks the applet's start configuration and its eight Show checkboxes, the
 * whole construction on the start shape and on thousands of generated ones,
 * and every claim the cut-the-knot article makes:
 *   - the tangents of a cyclic quadrilateral make an inscriptible one;
 *   - XZ and YW meet at its incenter M, and A'B'C'D' is inscriptible;
 *   - the homothety with centre M and ratio 1/2 maps A'B'C'D' onto
 *     A1B1C1D1, so PB(inscriptible) is inscriptible;
 *   - a cyclic quadrilateral's perpendicular bisectors meet at its centre;
 *   - if PB(Q) is inscriptible and Q is not cyclic, Q is inscriptible;
 *   - Q and PB(PB(Q)) are homothetic for any convex quadrilateral.
 * Finally the whole construction is transcribed a second time from the
 * applet's own bytecode (GeoSDoub.ComputeAngle / FindOrientation / Rotate /
 * Intersect / NearestPoint / FindCircumcenter, GetTangent, Perp and
 * DoubPoly.FormBisector / GetIterate) and compared on every configuration.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("de-villiers-3/de-villiers-3-core.js", "DeVilliers3Core");
const P = (x, y) => ({ x, y });
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const close = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const closePoint = (p, q, tol) => p && q && close(p.x, q.x, tol) && close(p.y, q.y, tol);
const tolOf = (pts) => 1e-6 * Math.max(1, ...pts.map((p) => Math.hypot(p.x, p.y)));
const onCircle = (c, r, t) => P(c.x + r * Math.cos(t), c.y + r * Math.sin(t));

/* ---------------------------------------------- 1. the applet's own settings */

{
  const s = C.start();
  equal("the applet's canvas is 400x250", C.VIEW, { x: 0, y: 0, width: 400, height: 250 });
  equal("the circle is centred at (200,125) with radius min(w,h)/5", C.CIRCLE,
    { c: { x: 200, y: 125 }, r: 50 });
  equal("A starts at angle 0 on the circle", s.points.A, P(250, 125));
  check("B starts at angle 1.2", closePoint(s.points.B, onCircle(C.CIRCLE.c, 50, 1.2), 1e-12));
  check("C starts at angle 2.9", closePoint(s.points.C, onCircle(C.CIRCLE.c, 50, 2.9), 1e-12));
  check("D starts at angle 4.5 (the applet randomises this one)",
    closePoint(s.points.D, onCircle(C.CIRCLE.c, 50, 4.5), 1e-12));
  check("all eight Show checkboxes start unchecked",
    C.OPTION_KEYS.every((k) => s.options[k] === false));
  check("a new diagram is not marked explored", !s.explored);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("every corner starts on the circle", ["A", "B", "C", "D"].every((k) =>
    close(dist(s.points[k], C.CIRCLE.c), C.CIRCLE.r, 1e-9)));
}

{
  const s = C.start();
  const moved = C.move(s, "A", P(20, 20));
  check("a dragged corner stays on the fixed circle",
    close(dist(moved.points.A, C.CIRCLE.c), C.CIRCLE.r, 1e-9));
  check("dragging marks the diagram explored", moved.explored && !s.explored);
  check("a move leaves the old position alone", s.points.A.x === 250);
  check("an unknown corner is ignored", C.move(s, "Z", P(5, 5)) === s);
  check("a non-finite corner is ignored", C.move(s, "A", P(NaN, 4)) === s);
  const withOptions = C.setOption(C.setOption(s, "bisectors", true), "circles", true);
  check("checkboxes change independently",
    withOptions.options.bisectors && withOptions.options.circles && !withOptions.options.names);
  check("an unknown checkbox is ignored", C.setOption(s, "nope", true) === s);
  const r = C.reset(withOptions);
  check("Reset restores the four corners", r.points.A.x === 250 && close(r.points.C.x, 151.45209174252048, 1e-9));
  check("Reset keeps the checkbox states", r.options.bisectors && r.options.circles);
  check("status describes the drawing", /halving from M/.test(C.describe(s)));
  check("a missing diagram has a helpful status", typeof C.describe(null) === "string");
  check("the core exposes no DOM", typeof globalThis.document === "undefined");
}

/* --------------------------- 2. the bytecode, transcribed a second time */

/*
 * GeoSDoub.ComputeAngle(P,Q,R): acos of the law-of-cosines expression, with
 * no clamping (Math.acos gives NaN if rounding pushes it outside [-1,1]).
 */
function apAngle(p, q, r) {
  const sq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  return Math.acos((sq(p, q) + sq(p, r) - sq(q, r))
    / (2 * Math.sqrt(sq(p, q)) * Math.sqrt(sq(p, r))));
}

/* GeoSDoub.FindOrientation and Rotate. */
function apOrientation(p, q, r) {
  const s = r.x * (p.y - q.y) + r.y * (q.x - p.x) + p.x * q.y - q.x * p.y;
  return s > 0 ? 1 : -1;
}
function apRotate(p, q, a, o) {
  const cs = Math.cos(a), sn = Math.sin(a);
  return P(p.x + cs * (q.x - p.x) - o * sn * (q.y - p.y),
    p.y + o * sn * (q.x - p.x) + cs * (q.y - p.y));
}

/* GeoSDoub.Intersect: |det| < 1 gives (NaN,NaN), like the Java applet. */
function apIntersect(p, q, r, s) {
  const a1 = p.y - q.y, b1 = q.x - p.x, c1 = p.x * q.y - p.y * q.x;
  const a2 = r.y - s.y, b2 = s.x - r.x, c2 = r.x * s.y - r.y * s.x;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1) return P(NaN, NaN);
  return P((b1 * c2 - b2 * c1) / det, (c1 * a2 - c2 * a1) / det);
}

/* GeoSDoub.FindCircumcenter and the canvas's GetCircle (mean of 3 radii). */
function apCircle(p, q, r) {
  const m1 = P((p.x + q.x) / 2, (p.y + q.y) / 2);
  const m2 = P((q.x + r.x) / 2, (q.y + r.y) / 2);
  const o = apIntersect(
    m1, P(m1.x + q.y - p.y, m1.y + p.x - q.x),
    m2, P(m2.x + r.y - q.y, m2.y + q.x - r.x),
  );
  return { c: o, r: (dist(o, p) + dist(o, q) + dist(o, r)) / 3 };
}

/* GetTangent, FindAngleBisector, Perp and NearestPoint, from the bytecode. */
function apTangent(p, o) {
  return { p, q: P(p.x - (p.y - o.y), p.y + (p.x - o.x)) };
}
function apBisector(p, q, r) {
  return apRotate(p, q, apAngle(p, q, r) / 2, apOrientation(p, q, r));
}
function apPerp(p, q) {
  return P(p.x + q.y - p.y, p.y - (q.x - p.x));
}
function apNearest(p, a, b) {
  if ((a.x - p.x) ** 2 + (a.y - p.y) ** 2 < 0.1) return a;
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  return P(a.x + dx * t, a.y + dy * t);
}
function apFormBisector(a, b) {
  const m = P((a.x + b.x) / 2, (a.y + b.y) / 2);
  return { p: m, q: P(m.x + a.y - b.y, m.y + b.x - a.x) };
}

/* The canvas's DrawConfiguration, Compute, ComputePerps and DoubPoly. */
function apCompute(a, b, c, d) {
  const circle = apCircle(a, b, c);
  const tangents = [apTangent(a, circle.c), apTangent(b, circle.c),
    apTangent(c, circle.c), apTangent(d, circle.c)];
  const verts = [0, 1, 2, 3].map((i) =>
    apIntersect(tangents[i].p, tangents[i].q,
      tangents[(i + 1) % 4].p, tangents[(i + 1) % 4].q));
  const external = verts.map((v, i) =>
    apPerp(v, apBisector(v, verts[(i + 3) % 4], verts[(i + 1) % 4])));
  const xyz = [0, 1, 2, 3].map((i) =>
    apIntersect(verts[i], external[i], verts[(i + 1) % 4], external[(i + 1) % 4]));
  const [X, Y, Z, W] = xyz;
  const center = apCircle(X, Y, Z).c;
  const radius = (dist(center, X) + dist(center, Y) + dist(center, Z)) / 3;
  const lines = [0, 1, 2, 3].map((i) => {
    const v = xyz[i];
    return { p: v, q: apNearest(v, verts[i], verts[(i + 1) % 4]) };
  });
  const prime = [0, 1, 2, 3].map((i) =>
    apIntersect(lines[(i + 3) % 4].p, lines[(i + 3) % 4].q, lines[i].p, lines[i].q));
  const bis = [0, 1, 2, 3].map((i) => apFormBisector(verts[(i + 3) % 4], verts[i]));
  const pb = [];
  let prev = bis[3];
  for (let i = 0; i < 4; i++) {
    pb.push(apIntersect(prev.p, prev.q, bis[i].p, bis[i].q));
    prev = bis[i];
  }
  return { circle, verts, external, X, Y, Z, W, center, radius, prime, pb };
}

/* A repeatable source of angles, all four gaps below pi so the tangents form
 * a convex quadrilateral — the case the article's theorem is about. */
function circleAngles(rand) {
  const gaps = [0.3 + rand() * 2.7, 0.3 + rand() * 2.7, 0.3 + rand() * 2.7];
  gaps.push(2 * Math.PI - gaps.reduce((s, g) => s + g, 0));
  if (gaps.some((g) => g <= 0.3 || g >= Math.PI - 0.05)) return null;
  return [0, gaps[0], gaps[0] + gaps[1], gaps[0] + gaps[1] + gaps[2]];
}
function circleQuad(angles) {
  return angles.map((t) => onCircle(C.CIRCLE.c, C.CIRCLE.r, t));
}

/* ------------------------------------- 3. fixed configurations and claims */

const fixed = [
  ["the applet's start", [0, 1.2, 2.9, 4.5].map((t) => onCircle(C.CIRCLE.c, C.CIRCLE.r, t))],
  ["a shallow circle quadrilateral", [0.1, 1.0, 2.6, 4.1].map((t) => onCircle(C.CIRCLE.c, C.CIRCLE.r, t))],
  ["a lop-sided circle quadrilateral", [0.2, 1.5, 3.1, 5.4].map((t) => onCircle(C.CIRCLE.c, C.CIRCLE.r, t))],
];
const startState = C.start();

for (const [name, pts] of fixed) {
  const q = { A: pts[0], B: pts[1], C: pts[2], D: pts[3] };
  const g = C.compute(q.A, q.B, q.C, q.D);
  check(`${name}: the construction exists`, !!g);
  if (!g) continue;
  const tol = tolOf(pts);
  check(`${name}: the tangent quadrilateral has the original circle as incircle`,
    g.claims.tangentInscriptible, `spread ${g.measures.tangentSpread}`);
  check(`${name}: XZ and YW meet at the incenter M`, g.claims.xyzDiagonalsAtIncenter,
    `error ${g.measures.diagError}`);
  check(`${name}: X,Y,Z,W lie on the applet's circle`, g.claims.xyzCyclic);
  check(`${name}: A'B'C'D' is inscriptible`, g.claims.primeInscriptible);
  check(`${name}: midpoint(M,X) is equidistant from the two sides at X`, g.claims.quarterPoints);
  check(`${name}: halving from M maps A'B'C'D' onto A1B1C1D1`, g.claims.homothety,
    `error ${g.measures.homothetyError}`);
  check(`${name}: PB of this inscriptible quadrilateral is inscriptible`, g.claims.pbInscriptible);
  check(`${name}: PB of the cyclic dots collapses to their circle centre`,
    g.claims.cyclicPBDegenerate);
  check(`${name}: every claim holds`, Object.values(g.claims).every(Boolean));
}

/* ------------------------- 4. thousands of generated circle configurations */

{
  const rand = rng(4142);
  let tested = 0, failures = 0, nonConvex = 0;
  for (let trial = 0; trial < 5000; trial++) {
    const angles = circleAngles(rand);
    if (!angles) continue;
    const pts = circleQuad(angles);
    const g = C.compute(pts[0], pts[1], pts[2], pts[3]);
    if (!g) continue;
    tested++;
    if (!C.convex(g.tangentVertices)) nonConvex++;
    const bad = Object.entries(g.claims).filter(([, ok]) => !ok);
    if (bad.length) {
      failures++;
      if (failures < 4) check(`circle case ${trial}: every claim holds`, false,
        `${bad.map(([k]) => k).join(",")} ${JSON.stringify(g.measures)}`);
    }
  }
  check(`${tested} generated circle configurations satisfy every page claim`,
    tested > 1500 && failures === 0, `${failures} failures`);
  check("the generated configurations really are convex", nonConvex === 0);
}

/* ----- 5. the forward and converse statements for general inscriptible quads */

{
  const rand = rng(1234);
  let made = 0, failures = 0;
  for (let trial = 0; trial < 1200; trial++) {
    const gaps = [0.4 + rand() * 2.2, 0.4 + rand() * 2.2, 0.4 + rand() * 2.2];
    gaps.push(2 * Math.PI - gaps.reduce((s, g) => s + g, 0));
    if (gaps.some((g) => g <= 0.4 || g >= Math.PI - 0.05)) continue;
    const ts = [0, gaps[0], gaps[0] + gaps[1], gaps[0] + gaps[1] + gaps[2]];
    // Four tangents to one circle make a quadrilateral with that incircle.
    const lines = ts.map((t) => {
      const n = P(Math.cos(t), Math.sin(t));
      return { p: P(80 * n.x, 80 * n.y), q: P(80 * n.x - 80 * n.y, 80 * n.y + 80 * n.x) };
    });
    const q = [0, 1, 2, 3].map((i) =>
      C.intersect(lines[i].p, lines[i].q, lines[(i + 1) % 4].p, lines[(i + 1) % 4].q));
    if (!C.valid(q) || !C.convex(q)) continue;
    const pb = C.pb(q);
    if (!pb || !C.convex(pb.vertices)) continue;
    made++;
    if (C.pitot(pb.vertices).error > 1e-6 * 200) {
      failures++;
      check(`inscriptible ${trial}: PB is inscriptible`, false, `${C.pitot(pb.vertices).error}`);
    }
  }
  check(`${made} inscriptible quadrilaterals have inscriptible PB images`,
    made > 300 && failures === 0);
}

{
  const rand = rng(5678);
  let tested = 0, violations = 0;
  for (let trial = 0; trial < 3000; trial++) {
    const q = [0, 1, 2, 3].map(() => P(10 + rand() * 380, 10 + rand() * 230));
    if (!C.convex(q)) continue;
    const pb = C.pb(q);
    if (!pb || !C.convex(pb.vertices)) continue;
    const o1 = C.circumcenter(q[0], q[1], q[2]);
    const o2 = C.circumcenter(q[1], q[2], q[3]);
    if (o1 && o2 && dist(o1, o2) < 1e-7) continue; // the degenerate cyclic case
    tested++;
    const tol = 1e-6 * 400;
    if (C.pitot(pb.vertices).error < tol && C.pitot(q).error > tol) {
      violations++;
      check(`converse ${trial}: PB inscriptible implies Q inscriptible`, false);
    }
  }
  check("the partial converse holds on non-cyclic quadrilaterals",
    tested > 150 && violations === 0, `${tested} cases, ${violations} violations`);
}

/* ------------------------------ 6. PB(PB(Q)) is homothetic with Q */

{
  const rand = rng(9012);
  let tested = 0, failures = 0;
  const parallel = (u, v) => Math.abs(C.cross(u, v))
    / Math.max(1e-9, Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)) < 1e-9;
  for (let trial = 0; trial < 3000; trial++) {
    const q = [0, 1, 2, 3].map(() => P(10 + rand() * 380, 10 + rand() * 230));
    if (!C.convex(q)) continue;
    const one = C.pb(q);
    if (!one || !C.convex(one.vertices)) continue;
    const two = C.pb(one.vertices);
    if (!two || !C.convex(two.vertices)) continue;
    tested++;
    // Each PB step rotates the names by one; after two steps the shift is two.
    const pairs = [];
    for (let k = 0; k < 4; k++) pairs.push([k, (k + 2) % 4]);
    pairs.push([0, 2], [1, 3]); // the two diagonals too
    const ratios = [];
    for (const [i, j] of pairs) {
      const u = C.sub(q[(i + 1) % 4], q[i]);
      const v = C.sub(two.vertices[(j + 1) % 4], two.vertices[j]);
      if (!parallel(u, v)) {
        failures++;
        check(`PB squared ${trial}: part ${i}->${j} is parallel`, false);
      } else if (i < 4) ratios.push(Math.hypot(v.x, v.y) / Math.hypot(u.x, u.y));
    }
    if (Math.max(...ratios) - Math.min(...ratios) > 1e-7) {
      failures++;
      check(`PB squared ${trial}: the homothety ratio is constant`, false);
    }
  }
  check(`PB(PB(Q)) is homothetic with Q on ${tested} quadrilaterals`,
    tested > 100 && failures === 0, `${failures} failures`);
}

/* ------------------------- 7. the core against the applet's own bytecode */

{
  const rand = rng(1996);
  let compared = 0, mismatches = 0;
  const compare = (name, pts) => {
    const [a, b, c, d] = pts;
    const g = C.compute(a, b, c, d);
    const ap = apCompute(a, b, c, d);
    const apPoints = [ap.verts, [ap.X, ap.Y, ap.Z, ap.W], ap.prime, ap.pb].flat();
    if (!g || !apPoints.every((p) => C.finite(p))) return;
    const baseTol = 1e-5 * tolOf(pts);
    const pairs = [
      ["circle centre", g.circle.c, ap.circle.c],
      ["circle radius", { x: g.circle.r, y: 0 }, { x: ap.circle.r, y: 0 }],
      ...["X", "Y", "Z", "W"].map((k) => [k, g[k], ap[k]]),
      ["M'", g.center, ap.center],
      ["radius of XYZW", { x: g.radius, y: 0 }, { x: ap.radius, y: 0 }],
      ...g.tangentVertices.map((p, i) => [`tangent vertex ${i}`, p, ap.verts[i]]),
      ...g.external.map((p, i) => [`external bisector ${i}`, p, ap.external[i]]),
      ...g.prime.map((p, i) => [`A'B'C'D' point ${i}`, p, ap.prime[i]]),
      ...g.pbTangent.vertices.map((p, i) => [`PB vertex ${i}`, p, ap.pb[i]]),
    ];
    for (const [what, got, want] of pairs) {
      // Stretched configurations send some points far outside the board, so
      // the tolerance also has to allow for the size of the numbers involved.
      const tol = Math.max(baseTol, 1e-10 * Math.max(
        Math.abs(got.x), Math.abs(got.y), Math.abs(want.x), Math.abs(want.y)));
      if (!closePoint(got, want, tol)) {
        mismatches++;
        if (mismatches < 5) check(`${name}: ${what} matches the bytecode`, false,
          `core ${JSON.stringify(got)}, applet ${JSON.stringify(want)}`);
      }
    }
    compared++;
  };
  for (const [name, pts] of fixed) compare(name, pts);
  for (let trial = 0; trial < 2500; trial++) {
    const angles = circleAngles(rand);
    if (angles) compare(`circle ${trial}`, circleQuad(angles));
  }
  // Also compare stretched, non-convex cases: the applet still computes them.
  for (let trial = 0; trial < 500; trial++) {
    const t = [0, 0.3 + rand() * 5.0, 0, 0];
    t[2] = t[1] + 0.1 + rand() * 5.5;
    t[3] = t[2] + 0.1 + rand() * 5.5;
    compare(`stretched ${trial}`, circleQuad([t[0], t[1], t[2], t[3]]));
  }
  check(`core and bytecode agree on ${compared} configurations`, compared > 1500 && mismatches === 0,
    `${mismatches} mismatched points`);
}

/* ------------------------------------------ 8. degenerate input is safe */

{
  check("four collinear dots give no construction",
    C.compute(P(10, 10), P(50, 10), P(90, 10), P(130, 10)) === null);
  check("a repeated dot gives no construction",
    C.compute(P(250, 125), P(250, 125), P(150, 137), P(189, 76)) === null);
  check("non-finite input gives no construction",
    C.compute(P(NaN, 0), P(1, 0), P(0, 1), P(-1, 0)) === null);
  check("a diagram with no geometry has no result", C.result({}) === null);
  check("projecting the circle centre is finite", C.finite(C.project(C.CIRCLE.c)));
  const ap = apCompute(P(250, 125), P(218.1178877238337, 171.6019542983613),
    P(151.45209174252048, 136.96246646069912), P(189.460210028461, 76.12349411674515));
  check("the bytecode itself puts XZ and YW through the incenter",
    C.distanceToLine(ap.circle.c, ap.X, ap.Z) < 1e-9
      && C.distanceToLine(ap.circle.c, ap.Y, ap.W) < 1e-9);
  check("the bytecode's X lies on its circle about M'",
    close(dist(ap.X, ap.center), ap.radius, 1e-9));
}

done("de-villiers-3");
