#!/usr/bin/env node
"use strict";

/*
 * Logic test for bimedians-in-tetrahedron/bimedians-in-tetrahedron-core.js.
 *
 *   node porting/check-bimedians-in-tetrahedron.mjs
 *
 * What is checked:
 *  - the opening four corners and the three segments against a second,
 *    literal transcription of the applet's Reset() / Midpoint() bytecode;
 *  - the article's claims over thousands of tetrahedra: three pairs of
 *    opposite edges, the three bimedians concurrent at the barycenter and
 *    bisected there; orthogonality exactly when the four corners are equally
 *    far from the barycenter, which is also exactly when each bimedian is
 *    square to the two edges it joins; the cube's opposite-face centres;
 *  - the orthographic projection (round trip, linearity, screen midpoints);
 *  - every control, both directions, and degenerate input.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("bimedians-in-tetrahedron/bimedians-in-tetrahedron-core.js", "BimediansInTetrahedronCore");

const V = (x, y, z) => ({ x: x, y: y, z: z });
const near = (a, b, tol = 1e-7) => Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearV = (p, q, tol = 1e-7) => !!p && !!q &&
  near(p.x, q.x, tol) && near(p.y, q.y, tol) && near(p.z, q.z, tol);
const near2 = (p, q, tol = 1e-6) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const dot = (p, q) => p.x * q.x + p.y * q.y + p.z * q.z;
const sub = (p, q) => V(p.x - q.x, p.y - q.y, p.z - q.z);
const len = (p) => Math.sqrt(dot(p, p));
const dist = (p, q) => len(sub(p, q));
const mid = (p, q) => V((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
const mean = (v) => V((v[0].x + v[1].x + v[2].x + v[3].x) / 4,
  (v[0].y + v[1].y + v[2].y + v[3].y) / 4,
  (v[0].z + v[1].z + v[2].z + v[3].z) / 4);

/* ------------------------------------------- the applet, straight from bytecode */

/* float 0.005f, then the four Point3f constructions in Reset() (locals 1..5). */
function jReset() {
  const e = Math.fround(0.005);
  const f = (x) => Math.fround(x);
  return [
    V(f(-e), f(-e), f(-e)),
    V(f(f(1) + e), f(f(1) + e), f(-e)),
    V(f(f(1) + e), f(-e), f(f(1) + e)),
    V(f(-e), f(f(1) + e), f(f(1) + e)),
  ];
}

/* javax.vecmath.Point3f Midpoint(Point3f, Point3f), op for op. */
function jMidpoint(p, q) {
  return V(
    Math.fround(Math.fround(p.x) + Math.fround(q.x)) / 2,
    Math.fround(Math.fround(p.y) + Math.fround(q.y)) / 2,
    Math.fround(Math.fround(p.z) + Math.fround(q.z)) / 2,
  );
}

/* Reset() locals 6..11 and the three CTKLineSegments, in bytecode order. */
function jSegments(v) {
  const m6 = jMidpoint(v[0], v[1]);
  const m7 = jMidpoint(v[2], v[3]);
  const m8 = jMidpoint(v[0], v[2]);
  const m9 = jMidpoint(v[1], v[3]);
  const m10 = jMidpoint(v[0], v[3]);
  const m11 = jMidpoint(v[1], v[2]);
  return [[m6, m7], [m8, m9], [m10, m11]];
}

/* An independent statement of the article, not using the core at all. */
function pageClaim(v) {
  const g = mean(v);
  const edges = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  const pairs = [[0, 5], [1, 4], [2, 3]];
  const ms = edges.map(([i, j]) => mid(v[i], v[j]));
  const bm = pairs.map(([i, j]) => [ms[i], ms[j]]);
  const scale = Math.max(1, ...edges.map(([i, j]) => dist(v[i], v[j])));
  const tol = 1e-9 * scale;
  const dirs = bm.map(([a, b]) => sub(b, a));
  const sq = (p, q) => Math.abs(dot(p, q)) <= tol * len(p) * len(q);
  const angles = [];
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      angles.push(Math.acos(Math.max(-1, Math.min(1,
        dot(dirs[i], dirs[j]) / (len(dirs[i]) * len(dirs[j]))))) * 180 / Math.PI);
    }
  }
  const perpendicular = pairs.every((pair, i) =>
    sq(dirs[i], sub(v[edges[pair[0]][1]], v[edges[pair[0]][0]])) &&
    sq(dirs[i], sub(v[edges[pair[1]][1]], v[edges[pair[1]][0]])));
  return {
    threePairs: pairs.length === 3 && new Set(pairs.flat()).size === 6,
    concurrent: bm.every(([a, b]) => dist(mid(a, b), g) <= tol),
    bisected: bm.every(([a, b]) => dist(mid(a, b), g) <= tol &&
      Math.abs(dist(a, g) - dist(b, g)) <= tol),
    barycenter: bm.every(([a, b]) => nearV(mid(a, b), g, tol)),
    orthogonal: angles.every((a) => Math.abs(a - 90) <= 1e-7),
    perpendicular: perpendicular,
    equidistant: v.every((p) => Math.abs(dist(p, g) - dist(v[0], g)) <= tol),
    angles: angles,
  };
}

const rand = rng(2612);
const randomVertex = () => V(rand() * 4 - 1.5, rand() * 4 - 1.5, rand() * 4 - 1.5);
const randomState = (v) => C.start({
  vertices: v,
  yaw: rand() * 6.28 - 3.14,
  pitch: (rand() - 0.5) * 2.4,
  zoom: 0.7 + rand() * 1.0,
});

/* A tetrahedron cut from a parallelepiped with edge vectors u,w,t. */
function boxTetra(u, w, t) {
  const c = V(0.5, 0.5, 0.5);
  const add = (p, q) => V(p.x + q.x, p.y + q.y, p.z + q.z);
  return [c,
    add(add(c, u), w), add(add(c, u), t), add(add(c, w), t)];
}

/* ---------------------------------------------------- 1. the applet's start */

{
  const s = C.start();
  const reset = jReset();
  for (let i = 0; i < 4; i++) {
    check(`Reset corner ${"ABCD"[i]} matches the applet's Point3f`,
      nearV(s.vertices[i], reset[i], 1e-7),
      `applet ${JSON.stringify(reset[i])}, core ${JSON.stringify(s.vertices[i])}`);
  }
  check("the offset e is the applet's 0.005f", C.E === 0.005);
  check("the view keeps the applet's rotX(pi/8)", C.TILT === 0.39269908169872414);
  check("the view keeps the applet's rotZ(-pi/6)", C.TURN === -0.5235987755982988);
  check("three bimedians, as in CTKLineSegment[3]", C.geometry(s).bimedians.length === 3);
  check("the cube starts hidden, as the applet's RemoveCube() leaves it", !s.showCube);
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a new diagram is not marked explored", !s.explored);
  const g = C.geometry(s);
  check("the opening tetrahedron satisfies the article's claim",
    pageClaim(s.vertices).concurrent && pageClaim(s.vertices).orthogonal &&
    g.claims.cubeEmbedding);
  check("the opening bimedians are 90, 90, 90 degrees",
    g.angles.every((a) => Math.abs(a - 90) < 1e-9), g.angles.join(", "));
}

/* ------------------------------ 2. Midpoint()/Segments() against the bytecode */

{
  let same = 0, tried = 0;
  for (let i = 0; i < 2000; i++) {
    const p = randomVertex(), q = randomVertex();
    if (nearV(C.midpoint(p, q), jMidpoint(p, q), 1e-6)) same++;
    tried++;
  }
  check(`Midpoint() agrees with the applet on all ${tried} point pairs`, same === tried);

  let segments = 0, bad = 0;
  const compare = (v, label) => {
    const expected = jSegments(v);
    const actual = C.geometry(randomState(v)).bimedians;
    for (let i = 0; i < 3; i++) {
      if (!(nearV(actual[i].a, expected[i][0], 1e-6) &&
            nearV(actual[i].b, expected[i][1], 1e-6))) {
        bad++;
        check(`${label}: segment ${i} matches the applet's Midpoint calls`, false,
          `applet ${JSON.stringify(expected[i])}, core ${JSON.stringify([actual[i].a, actual[i].b])}`);
      }
    }
    segments++;
  };
  compare(C.start().vertices, "Reset");
  for (let i = 0; i < 1000; i++) compare([0, 1, 2, 3].map(randomVertex), `random ${i}`);
  check(`all ${segments} sets of three segments match the applet's bytecode order`,
    segments > 1000 && bad === 0);
}

/* -------------------------- 3. concurrency and the cube, over many tetrahedra */

{
  let concurrent = 0, bisected = 0, baryOk = 0, pairsOk = 0, agreed = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const v = [0, 1, 2, 3].map(randomVertex);
    const g = C.geometry(randomState(v));
    if (!g || Math.min(...g.edges.map((e) => e.length)) < 1e-3) continue;
    const claim = pageClaim(v);
    const tol = g.measures.tolerance;
    if (g.claims.concurrent && claim.concurrent) concurrent++;
    if (g.claims.bisected && claim.bisected) bisected++;
    if (g.claims.barycenter && nearV(g.barycenter, mean(v), tol)) baryOk++;
    if (g.claims.threeOppositePairs && claim.threePairs) pairsOk++;
    if (g.claims.orthogonal === claim.orthogonal &&
        g.claims.perpendicularToEdges === claim.perpendicular &&
        g.claims.orthogonal === claim.equidistant) agreed++;
    n++;
  }
  check(`the three bimedians meet at the barycenter on all ${n} tetrahedra`,
    n > 2500 && concurrent === n);
  check(`each bimedian is bisected at that point on all ${n} tetrahedra`, bisected === n);
  check(`the point is the mean of the four corners on all ${n} tetrahedra`, baryOk === n);
  check(`six edges always form exactly three opposite pairs (${n} cases)`, pairsOk === n);
  check(`the core and the article agree about right angles on all ${n} cases`, agreed === n);

  const g = C.geometry(C.start());
  check("the start tetrahedron is regular", g.claims.regular &&
    g.measures.regularSpread < 1e-12);
  check("its bimedians join centres of opposite cube faces", g.claims.cubeEmbedding &&
    g.claims.cubeParallel);
  const skew = C.geometry(C.start({ shape: "skew" }));
  check("the skewed tetrahedron loses the right angles but keeps the meeting point",
    !skew.claims.orthogonal && !skew.claims.perpendicularToEdges &&
    !skew.claims.cubeEmbedding && skew.claims.concurrent);
}

/* ------------------------- 4. when are the three bimedians at right angles? */

{
  /* Four corners equally far from their barycenter: the article's converse. */
  let orthogonal = 0, n = 0;
  for (let i = 0; i < 600; i++) {
    const u = V(rand() * 2 - 1, 0, 0); u.x = u.x || 1;
    const w = V(0, rand() * 2 - 1, 0); w.y = w.y || 1;
    const t = V(0, 0, rand() * 2 - 1); t.z = t.z || 1;
    const v = boxTetra(u, w, t);
    const g = C.geometry(randomState(v));
    const claim = pageClaim(v);
    if (g.claims.orthogonal && g.claims.perpendicularToEdges &&
        g.claims.cubeEmbedding && claim.orthogonal && claim.equidistant) orthogonal++;
    n++;
  }
  check(`all ${n} cube-embedded tetrahedra have orthogonal bimedians`, orthogonal === n);

  /* A sheared box is not a cube: the right angles go away. */
  const sheared = boxTetra(V(1, 0, 0), V(0.4, 1, 0), V(0.2, 0.1, 1));
  const gs = C.geometry(randomState(sheared));
  check("a sheared parallelepiped does not give right angles",
    !gs.claims.orthogonal && !gs.claims.perpendicularToEdges &&
    pageClaim(sheared).orthogonal === false);

  /* Equivalence over every generated tetrahedron: right angles <=> each
   * bimedian is square to the edges it joins. */
  let equivalent = 0, total = 0;
  for (let i = 0; i < 2500; i++) {
    const v = [0, 1, 2, 3].map(randomVertex);
    const claim = pageClaim(v);
    if (claim.orthogonal === claim.perpendicular && claim.orthogonal === claim.equidistant) equivalent++;
    total++;
  }
  check(`orthogonal <=> perpendicular-to-edges <=> equidistant (${total} cases)`,
    equivalent === total);
  check("the article's implication is not empty: it has true and false cases",
    pageClaim(C.start().vertices).orthogonal && !pageClaim(C.start({ shape: "skew" }).vertices).orthogonal);
}

/* ------------------------------------------------ 5. the projection in the core */

{
  const s = C.start({ yaw: 0.83, pitch: -0.41, zoom: 1.2 });
  let roundTrip = 0, linear = 0, midpointScreen = 0, bimedMid = 0, n = 0;
  for (let i = 0; i < 600; i++) {
    const p = randomVertex(), q = randomVertex();
    const sp = C.project(s, p), sq = C.project(s, q);
    const back = C.unproject(s, sp, sp.depth);
    if (nearV(back, p, 1e-9)) roundTrip++;
    if (near2(C.project(s, C.midpoint(p, q)), {
      x: (sp.x + sq.x) / 2, y: (sp.y + sq.y) / 2,
    }, 1e-9)) linear++;
    // An affine combination (coefficients sum to 1) about the cube's middle.
    const combo = C.sub(C.add(C.mul(p, 2), C.mul(q, 3)), V(2, 2, 2));
    if (near2(C.project(s, combo), {
      x: 2 * sp.x + 3 * sq.x - 4 * C.VIEW.width / 2,
      y: 2 * sp.y + 3 * sq.y - 4 * C.VIEW.height / 2,
    }, 1e-8)) midpointScreen++;
    const g = C.geometry(C.start({ vertices: [p, q, randomVertex(), randomVertex()], yaw: s.yaw, pitch: s.pitch, zoom: s.zoom }));
    const baryScreen = C.project(s, g.barycenter);
    if (g.bimedians.every((m) => near2({
      x: (m.screenA.x + m.screenB.x) / 2, y: (m.screenA.y + m.screenB.y) / 2,
    }, baryScreen, 1e-8))) bimedMid++;
    n++;
  }
  check(`unproject(project(p)) returns p on all ${n} points`, roundTrip === n);
  check(`the projection preserves midpoints on all ${n} pairs`, linear === n);
  check(`the projection is affine on all ${n} combinations`, midpointScreen === n);
  check(`the three projected bimedians cross at the projected barycenter on all ${n} cases`,
    bimedMid === n);

  const s2 = C.rotate(s, 0.4, 0.2);
  check("rotation keeps the four corners fixed",
    s2.vertices.every((p, i) => nearV(p, s.vertices[i])) && s2.yaw > s.yaw && s2.pitch > s.pitch);
  check("setVertex keeps its old state untouched and marks the new one explored", (() => {
    const moved = C.moveVertex(s, "B", V(2, 3, 4));
    return !s.explored && moved.explored && nearV(moved.vertices[1], V(2, 3, 4)) &&
      nearV(s.vertices[1], C.start().vertices[1]);
  })());
}

/* ------------------------------------------------ 6. controls and edge cases */

{
  const s = C.start();
  check("an unknown corner is ignored", C.moveVertex(s, "Z", V(1, 2, 3)) === s);
  check("a non-finite corner is ignored", C.moveVertex(s, "A", V(NaN, 2, 3)) === s);
  check("Show cube toggles and marks the diagram explored",
    C.setCube(s, true).showCube && C.setCube(s, true).explored && !s.showCube);
  check("rotation clamps the tilt before the view flips over",
    Math.abs(C.rotate(s, 0, 99).pitch) < Math.PI / 2);
  check("zooming is clamped to the applet-like range",
    C.zoomBy(s, 100).zoom === C.ZOOM_MAX && C.zoomBy(s, 0.001).zoom === C.ZOOM_MIN);
  check("Reset restores the regular tetrahedron", (() => {
    const r = C.reset(C.setCube(C.moveVertex(s, "C", V(9, 9, 9)), true));
    return r.vertices.every((p, i) => nearV(p, jReset()[i], 1e-7)) &&
      r.showCube && r.explored && !r.vertices.some((p) => p.x === 9);
  })());
  check("the skew preset changes one corner and marks it explored", (() => {
    const k = C.preset(s, "skew");
    return !nearV(k.vertices[3], s.vertices[3]) && k.explored;
  })());
  check("a repeated corner leaves no drawing", C.geometry(C.start({
    vertices: [V(0, 0, 0), V(0, 0, 0), V(1, 0, 0), V(0, 1, 0)],
  })) === null);
  check("a non-finite corner leaves no drawing", C.geometry({
    vertices: [V(0, 0, 0), V(1, 0, 0), V(0, 1, 0), V(0, 0, Infinity)],
    yaw: 0, pitch: 0, zoom: 1,
  }) === null);
  check("a broken diagram still has a helpful status and no result", (() => {
    const broken = C.start({ vertices: [V(0, 0, 0), V(0, 0, 0), V(1, 0, 0), V(0, 1, 0)] });
    return /corners/.test(C.describe(broken)) && C.result(broken) === null &&
      C.geometry(broken) === null;
  })());
  check("describe mentions cube faces only when the cube is shown and the claim holds",
    !/cube/.test(C.describe(s)) &&
    /cube/.test(C.describe(C.setCube(s, true))) &&
    !/cube/.test(C.describe(C.setCube(C.preset(s, "skew"), true))));
  check("saving the position is plain data", (() => {
    const g = C.geometry(s);
    return JSON.stringify({
      vertices: s.vertices, bimedians: g.bimedians.map((m) => [m.a, m.b]),
      claims: g.claims, showCube: s.showCube,
    }).length > 100;
  })());
  check("the core touches no DOM", typeof globalThis.document === "undefined");
}

done("bimedians-in-tetrahedron");
