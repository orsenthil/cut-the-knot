#!/usr/bin/env node
"use strict";

/*
 * Logic test for barygon/barygon-core.js.
 *
 *   node porting/check-barygon.mjs
 *
 * Checked: every N (3..20), NA (2..20) and NI (1..20) from the applet's number
 * canvases, on many seeded random polygons: the Reset placement, the telescoping
 * side identity, and the core against a second literal transcription of
 * BarygonCanvas.BaryCenter / ComputeBary / Draw / ShowHint. The article's claim
 * (averaging N/2 successive vertices gives a paragon) and the question on this
 * page are checked for every even N and NA: one step is a paragon exactly when
 * N/2 divides NA; NA = 3*(N/2) is a non-degenerate example with NA != N/2;
 * NA a multiple of N collapses the vertices to the centroid; other NA never
 * give an exact paragon after finitely many iterations, though the defect
 * decreases and the polygons converge.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("barygon/barygon-core.js", "BarygonCore");

const copy = (p) => ({ x: p.x, y: p.y });
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const samePoint = (p, q, tol = 1e-9) => close(p.x, q.x, tol) && close(p.y, q.y, tol);
const samePoly = (p, q, tol = 1e-9) => p.length === q.length && p.every((v, i) => samePoint(v, q[i], tol));
const scale = (poly) => Math.max(1, ...poly.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]));
const rel = (poly) => C.relativeDefect(poly);

const randomPolygon = (n, rand, radius = 160) =>
  Array.from({ length: n }, () => ({ x: (rand() - 0.5) * 2 * radius, y: (rand() - 0.5) * 2 * radius }));

/* ------------------- the applet's own methods, transcribed from the bytecode */

/* BaryCenter(int i, DoubPoint[] Q): j = i; j < i+NA; j++, index j%N. */
function appletBaryCenter(i, Q, NA) {
  let sx = 0, sy = 0;
  for (let j = i; j < i + NA; j++) {
    const p = Q[j % Q.length];
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / NA, y: sy / NA };
}

/* ComputeBary: a new array of N barycenters. */
function appletComputeBary(Q, NA) {
  const out = new Array(Q.length);
  for (let i = 0; i < Q.length; i++) out[i] = appletBaryCenter(i, Q, NA);
  return out;
}

/* Draw: Q = P; repeat ComputeBary NI times, keeping every stage. */
function appletDraw(points, NA, NI) {
  const stages = [points.map(copy)];
  let Q = stages[0];
  for (let t = 0; t < NI; t++) {
    Q = appletComputeBary(Q, NA);
    stages.push(Q.map(copy));
  }
  return stages;
}

/* ShowHint: the vector it draws from Q[i] (Q[j].x - Q[k].x is subtracted). */
function appletShowHint(Q) {
  const h = Math.floor(Q.length / 2);
  const acc = { x: 0, y: 0 };
  for (let i = 0; i < Q.length; i++) {
    const j = (i + h) % Q.length;
    const k = (i + h + 1) % Q.length;
    acc.x += Q[i].x + Q[j].x - Q[k].x;
    acc.y += Q[i].y + Q[j].y - Q[k].y;
  }
  return acc;
}

/* Reset: angle_i = PI/NA * i + PI/NA * Math.random(). */
function appletReset(N, NA, width, height, random) {
  const cx = width / 2, cy = height / 2;
  const radius = Math.min(width, height) / 4;
  const P = [];
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI / NA) * i + (Math.PI / NA) * random();
    P.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return P;
}

/* ---------------------------------------------- 1. options and start state */

{
  equal("option ranges match BarygonPanel.SetRange", C.RANGES, { N: [3, 20], NA: [2, 20], NI: [1, 20] });
  equal("initial values are 6 vertices, average over 3, 1 iteration",
    (({ N, NA, NI, width, height }) => ({ N, NA, NI, width, height }))(C.start({ points: randomPolygon(6, rng(1)) })),
    { N: 6, NA: 3, NI: 1, width: 600, height: 420 });
  check("no outcome is possible in an illustration", C.result(C.start({})) === null);
  check("options clamp below their range", C.clampOption("N", 1) === 3 && C.clampOption("NA", 1) === 2 && C.clampOption("NI", 0) === 1);
  check("options clamp above their range", C.clampOption("N", 99) === 20 && C.clampOption("NA", 99) === 20 && C.clampOption("NI", 99) === 20);

  const a = C.start({ N: 8, NA: 5, NI: 7, random: rng(4242) });
  const b = C.start({ N: 8, NA: 5, NI: 7, random: rng(4242) });
  const applet = appletReset(8, 5, 600, 420, rng(4242));
  check("Reset placement matches the applet exactly", samePoly(a.points, applet, 0));
  check("a fresh start with the same seed is reproducible", samePoly(a.points, b.points, 0));
  check("Reset keeps all vertices on the same radius circle", a.points.every((p) =>
    close(Math.hypot(p.x - 300, p.y - 210), Math.min(600, 420) / 4, 1e-9)));
  check("start does not mutate the supplied points", (() => {
    const pts = randomPolygon(6, rng(3));
    const snapshot = pts.map(copy);
    C.start({ points: pts });
    return samePoly(pts, snapshot, 0);
  })());
  check("withPoint changes only one vertex, without touching the old state", (() => {
    const s = C.start({ points: randomPolygon(6, rng(5)) });
    const t = C.withPoint(s, 2, { x: 10, y: 20 });
    return samePoint(t.points[2], { x: 10, y: 20 }, 0) && samePoint(s.points[2], t.points[2], 0) === false &&
      samePoint(s.points[1], t.points[1], 0);
  })());
  check("an out-of-range vertex index leaves the state alone", (() => {
    const s = C.start({ points: randomPolygon(6, rng(6)) });
    return C.withPoint(s, 9, { x: 0, y: 0 }) === s;
  })());
  check("changing NA or NI keeps the vertices; changing N resets them", (() => {
    const s = C.start({ N: 6, points: randomPolygon(6, rng(7)) });
    const t = C.withOptions(s, { NA: 5, NI: 2 });
    const u = C.withOptions(s, { N: 8 });
    return samePoly(t.points, s.points, 0) && t.NA === 5 && t.NI === 2 && u.points.length === 8;
  })());
}

/* --------------------- 2. the core against the applet's own computation     */

{
  const rand = rng(2522);
  let compared = 0;
  for (let N = 3; N <= 20; N++) {
    for (let NA = 2; NA <= 20; NA++) {
      for (let trial = 0; trial < 4; trial++) {
        const points = randomPolygon(N, rand);
        const state = C.start({ N, NA, NI: 20, points });
        const core = C.sequence(state);
        const applet = appletDraw(points, NA, 20);
        if (!samePoly(core[0], applet[0], 0)) {
          check(`N=${N} NA=${NA} trial=${trial}: starting polygon`, false);
          continue;
        }
        for (let i = 0; i < N; i++) {
          if (!samePoint(C.baryCenter(i, points, NA), appletBaryCenter(i, points, NA), 0)) {
            check(`N=${N} NA=${NA} i=${i}: BaryCenter matches bytecode`, false);
          }
        }
        if (!samePoly(C.average(points, NA), appletComputeBary(points, NA), 0)) {
          check(`N=${N} NA=${NA}: ComputeBary matches bytecode`, false);
        }
        if (!core.every((poly, t) => samePoly(poly, applet[t], 0))) {
          check(`N=${N} NA=${NA}: all 20 iterations match Draw`, false);
        }
        // ShowHint always aims at N times the centroid, since the side vectors
        // telescope away; the clue is faithful even when its endpoint is offscreen.
        const hint = appletShowHint(core[20]);
        const sum = core[20].reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
        if (!samePoint(hint, sum, 1e-8 * scale(core[20]))) {
          check(`N=${N} NA=${NA}: ShowHint vector equals the vertex sum`, false);
        }
        compared++;
      }
    }
  }
  check(`core equals the applet for all ${compared} N/NA/configurations`, compared === 18 * 19 * 4);
}

/* ---------------------- 3. the telescoping identity from the Paragon page   */

{
  const rand = rng(1001);
  let cases = 0;
  for (let N = 3; N <= 20; N++) {
    for (let NA = 2; NA <= 20; NA++) {
      const points = randomPolygon(N, rand);
      const Q = C.average(points, NA);
      const sides = C.sideVectors(Q);
      const tol = 1e-9 * scale(points);
      for (let i = 0; i < N; i++) {
        const p = points[i], next = points[(i + NA) % N];
        const expected = { x: (next.x - p.x) / NA, y: (next.y - p.y) / NA };
        if (!samePoint(sides[i], expected, tol)) {
          check(`N=${N} NA=${NA} i=${i}: Q[i+1]-Q[i] = (P[i+NA]-P[i])/NA`, false);
        }
      }
      cases++;
    }
  }
  check(`side identity holds on all ${cases} option pairs`, cases === 18 * 19);
  check("one step with NA=3 on a hexagon gives the theorem's example", (() => {
    const P = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
      { x: 0, y: 100 }, { x: 200, y: 200 }, { x: 300, y: 100 }];
    return C.isParagon(C.average(P, 3));
  })());
}

/* ------------------- 4. paragon: the article's theorem and the page's question */

{
  const rand = rng(777);
  let evenCases = 0, halfMultiple = 0, otherK = 0, collapsed = 0, nonDegenerate = 0;
  for (let N = 4; N <= 20; N += 2) {
    const half = N / 2;
    for (let NA = 2; NA <= 20; NA++) {
      for (let trial = 0; trial < 5; trial++) {
        const points = randomPolygon(N, rand);
        const state = C.start({ N, NA, NI: 20, points });
        const first = C.resultPolygon({ ...state, NI: 1 });
        const final = C.resultPolygon(state);
        const isParagonFirst = C.isParagon(first);
        const isCollapsed = C.isCoincident(first);
        check(`N=${N} NA=${NA}: step ${trial} has a finite defect`, Number.isFinite(C.paragonDefect(first)));
        if (NA % half === 0) {
          if (!isParagonFirst) check(`N=${N} NA=${NA}: N/2 | NA gives a paragon`, false);
          halfMultiple++;
          if (NA % N === 0) {
            if (!isCollapsed) check(`N=${N} NA=${NA}: N | NA collapses to the centroid`, false);
            collapsed++;
          } else if (!isCollapsed) nonDegenerate++;
        } else {
          if (isParagonFirst) check(`N=${N} NA=${NA}: non-multiple is not a paragon`, false);
          // λ_2 is nonzero, so the defect is nonzero until it underflows;
          // after 20 steps floating point may legitimately round it to zero.
          if (rel(first) <= 1e-8) check(`N=${N} NA=${NA}: one step is not exact`, false);
          if (C.paragonDefect(final) > C.paragonDefect(first)) {
            check(`N=${N} NA=${NA}: 20 steps do not make it worse`, false);
          }
          otherK++;
        }
        evenCases++;
      }
    }
  }
  check(`paragon condition checked on ${evenCases} even-N configurations`, evenCases === 9 * 19 * 5);
  check(`N/2 | NA gave a paragon in all ${halfMultiple} configurations`, halfMultiple === 36 * 5);
  check(`N | NA collapsed to one point in ${collapsed} configurations`, collapsed > 0);
  check(`odd multiples of N/2 stayed non-degenerate in ${nonDegenerate} configurations`, nonDegenerate > 0);

  // The question on the page: another K can work. 3*(N/2) is inside the range.
  for (const [N, NA] of [[4, 6], [6, 9], [8, 12], [10, 15], [12, 18]]) {
    const s = C.start({ N, NA, NI: 1, points: randomPolygon(N, rand) });
    const q = C.resultPolygon(s);
    check(`NA=${NA}=3*N/2 != N/2: non-degenerate paragon on ${N} vertices`,
      C.isParagon(q) && !C.isCoincident(q) && NA !== N / 2);
    check(`NA=${NA}: every vertex moved`, q.every((p, i) => !samePoint(p, s.points[i], 1e-9)));
  }
  // NA=N is a degenerate paragon, since every window covers the whole polygon.
  for (const N of [4, 6, 8, 10, 12]) {
    const s = C.start({ N, NA: N, NI: 1, points: randomPolygon(N, rand) });
    const centroid = s.points.reduce((a, p) => ({ x: a.x + p.x / N, y: a.y + p.y / N }), { x: 0, y: 0 });
    check(`NA=N=${N}: all vertices are the centroid`, C.resultPolygon(s).every((p) => samePoint(p, centroid, 1e-9)));
  }
}

/* ----------------- 5. convergence, eigenvalues, odd N and the limit shape    */

{
  const rand = rng(31337);
  let eigen = 0, convergent = 0;
  for (let N = 3; N <= 20; N++) {
    for (let NA = 2; NA <= 20; NA++) {
      for (let k = 1; k < N; k++) {
        const modulus = C.eigenModulus(k, N, NA);
        // z^NA = 1 exactly when N divides k*NA; z != 1 because k is not 0 mod N.
        const expectedZero = (k * NA) % N === 0;
        if (expectedZero !== (modulus < 1e-9)) check(`N=${N} NA=${NA} k=${k}: lambda_k zero iff N | k*NA`, false,
          `modulus ${modulus}, expectedZero ${expectedZero}`);
        if (modulus > 1 + 1e-9) check(`N=${N} NA=${NA} k=${k}: |lambda_k| <= 1`, false);
        eigen++;
      }
    }
  }
  check(`eigenvalue criterion holds for all ${eigen} modes`, eigen === 3591);

  for (const N of [4, 6, 8, 10, 12, 14]) {
    const half = N / 2;
    for (const NA of [2, 3, 4, 5, 7, 9, 11, 13, 17, 19]) {
      if (NA % half === 0) continue;
      const points = randomPolygon(N, rand);
      const state = C.start({ N, NA, NI: 20, points });
      const seq = C.sequence(state);
      const defects = seq.map((poly) => C.paragonDefect(poly));
      const monotone = defects.every((d, i) => i === 0 || d <= defects[i - 1] * (1 + 1e-7) + 1e-15);
      check(`N=${N} NA=${NA}: defect falls at every iteration`, monotone);
      check(`N=${N} NA=${NA}: 20 iterations are closer to a paragon`, defects[20] < defects[1]);
      check(`N=${N} NA=${NA}: the first step is not exact`, rel(seq[1]) > 1e-8);
      convergent++;
    }
    const s = C.start({ N, NA: half, NI: 20, points: randomPolygon(N, rand) });
    const after = C.sequence(s).slice(1);
    check(`N=${N} NA=N/2: paragon stays paragon through 20 iterations`, after.every((poly) => rel(poly) <= 1e-10));
    const centroid = s.points.reduce((a, p) => ({ x: a.x + p.x / N, y: a.y + p.y / N }), { x: 0, y: 0 });
    const final = C.resultPolygon(s);
    const spread = (poly) => Math.max(...poly.map((p) => C.distance(p, centroid)));
    check(`N=${N} NA=N/2: repeated averaging shrinks toward the centroid`, spread(final) < spread(s.points) / 5);
  }
  check(`convergence checked on ${convergent} non-multiple option pairs`, convergent > 40);

  for (let N = 4; N <= 20; N += 2) {
    const points = randomPolygon(N, rand);
    const L = C.limitPolygon(points);
    const centroid = points.reduce((a, p) => ({ x: a.x + p.x / N, y: a.y + p.y / N }), { x: 0, y: 0 });
    check(`N=${N}: the closed-form limit is a paragon`, C.isParagon(L));
    check(`N=${N}: opposite limit vertices are symmetric about the centroid`, L.every((p, i) =>
      samePoint({ x: p.x + L[(i + N / 2) % N].x, y: p.y + L[(i + N / 2) % N].y },
        { x: 2 * centroid.x, y: 2 * centroid.y }, 1e-9 * scale(points))));
  }
  for (let N = 3; N <= 19; N += 2) {
    const s = C.start({ N, points: randomPolygon(N, rand) });
    check(`N=${N} is odd: no opposite sides, so no paragon test`, C.paragonDefect(s.points) === null && !C.isParagon(s.points));
    check(`N=${N} is odd: averaging still produces N vertices`, C.resultPolygon({ ...s, NI: 5 }).length === N);
  }
}

done("barygon");
