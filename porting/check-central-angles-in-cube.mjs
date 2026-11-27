#!/usr/bin/env node
"use strict";

/*
 * Logic test for central-angles-in-cube/central-angles-in-cube-core.js.
 *
 *   node porting/check-central-angles-in-cube.mjs
 *
 * What is checked:
 *  - Reset()'s four Point3f values and five CTKLineSegment pairs, transcribed
 *    a second time from the bytecode with Java float rounding, plus the two
 *    branch groups (0,1,3) and (2,4), compared over 1,000 cube sizes, views
 *    and translations;
 *  - every ordered pair of cube corners at five cube sizes: the central
 *    angle's cosine is 1, 1/3, -1/3 or -1 according to how many coordinates
 *    differ, and the obtuse/acute labels agree;
 *  - s + t = 180 for every opposite-corner pair and every third corner; the
 *    tetrahedron's six angles are all arccos(-1/3); triangle A C C' has the
 *    page's legs, hypotenuse, right angle and median;
 *  - 2,000 free point triples against an independent dot-product formula;
 *  - the orthographic projection (round trip, midpoints), every control in
 *    both directions, snapping and degenerate input.
 */

import { loadCore, check, done, rng } from "./lib/load-core.mjs";

const C = loadCore("central-angles-in-cube/central-angles-in-cube-core.js", "CentralAnglesInCubeCore");

const V = (x, y, z) => ({ x: x, y: y, z: z });
const near = (a, b, tol = 1e-7) => Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const nearV = (p, q, tol = 1e-7) => !!p && !!q &&
  near(p.x, q.x, tol) && near(p.y, q.y, tol) && near(p.z, q.z, tol);
const near2 = (p, q, tol = 1e-6) => !!p && !!q && near(p.x, q.x, tol) && near(p.y, q.y, tol);
const add = (p, q) => V(p.x + q.x, p.y + q.y, p.z + q.z);
const sub = (p, q) => V(p.x - q.x, p.y - q.y, p.z - q.z);
const mul = (p, k) => V(p.x * k, p.y * k, p.z * k);
const dot = (p, q) => p.x * q.x + p.y * q.y + p.z * q.z;
const len = (p) => Math.sqrt(dot(p, p));
const dist = (p, q) => len(sub(p, q));
const mid = (p, q) => V((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
const acosDeg = (c) => Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;

/* ------------------------------------------- the applet, straight from bytecode */

/* Reset(): new Point3f(0.5f,0.5f,0.5f), (0,0,0), (1,1,0), (1,1,1). */
function jPoints(side) {
  const f = Math.fround;
  const centre = V(f(0.5), f(0.5), f(0.5));
  const raw = [
    V(f(0.5), f(0.5), f(0.5)),
    V(f(0), f(0), f(0)),
    V(f(1), f(1), f(0)),
    V(f(1), f(1), f(1)),
  ];
  return raw.map((p) => mul(sub(p, centre), side));
}

/* Reset()'s CTKLineSegment[0..4] and branchSegments[0..1], in bytecode order. */
function jSegments(side) {
  const p = jPoints(side);
  const ends = [[0, 1], [0, 2], [0, 2], [1, 2], [0, 3]];
  return {
    segments: ends.map(([i, j]) => [p[i], p[j]]),
    groups: [[0, 1, 3], [2, 4]],
  };
}

/* An independent statement of the article's cosine claim, not using the core. */
function pageCos(p, q) {
  return dot(p, q) / (len(p) * len(q));
}

const rand = rng(3052);
const randomV = (lo = -2, hi = 2) => V(rand() * (hi - lo) + lo,
  rand() * (hi - lo) + lo, rand() * (hi - lo) + lo);
const randomSide = () => C.SIDE_MIN + rand() * (C.SIDE_MAX - C.SIDE_MIN);
const randomState = (extra) => C.start(Object.assign({
  yaw: rand() * 6.28 - 3.14,
  pitch: (rand() - 0.5) * 2.4,
  zoom: 0.6 + rand() * 1.2,
}, extra));
const corner = (i, side) => mul(C.VERTICES[i], side);
const pairState = (side, i, j, k, extra) => C.start(Object.assign({
  side: side,
  points: { P: corner(i, side), Q: corner(j, side), R: corner(k, side) },
  mode: "both",
}, extra));

/* ------------------------------------------------ 1. the applet's opening */

{
  const s = C.start();
  const jp = jPoints(1);
  check("the view keeps the applet's rotX(pi/8)", C.TILT === 0.39269908169872414);
  check("the view keeps the applet's rotZ(-pi/6)", C.TURN === -0.5235987755982988);
  check("the four Reset() points match the bytecode (centred)",
    C.appletPoints(1).every((p, i) => nearV(p, jp[i])),
    JSON.stringify(C.appletPoints(1)));
  const js = jSegments(1), cs = C.appletSegments(1);
  check("the five CTKLineSegments match the bytecode order",
    js.segments.every((pair, i) => nearV(cs.segments[i].a, pair[0]) && nearV(cs.segments[i].b, pair[1])));
  check("the obtuse group is segments 0, 1, 3",
    JSON.stringify(cs.groups.obtuse) === JSON.stringify(js.groups[0]));
  check("the acute group is segments 2, 4",
    JSON.stringify(cs.groups.acute) === JSON.stringify(js.groups[1]));
  check("S2 repeats S1 in the applet (harmless duplicate)",
    nearV(cs.segments[1].a, cs.segments[2].a) && nearV(cs.segments[1].b, cs.segments[2].b));
  check("both groups start hidden, as Reset() calls RemoveSegments(0) and (1)",
    s.mode === "none");
  check("the opening handles are the applet's P1, P2 and P3",
    nearV(s.points.P, jp[1]) && nearV(s.points.Q, jp[2]) && nearV(s.points.R, jp[3]));
  check("an illustration has no win, loss or finish", C.result(s) === null);
  check("a new diagram is not marked explored", !s.explored);
  check("the opening diagram is not degenerate", !C.geometry(s).claims.degenerate);
}

/* ------------------------ 2. the applet's computation over many configurations */

{
  let pointsSame = 0, segmentsSame = 0, liveSame = 0, views = 0;
  for (let i = 0; i < 1000; i++) {
    const side = randomSide();
    const shift = randomV(-3, 3);
    const p = C.appletPoints(side).map((v) => add(v, shift));
    const jp = jPoints(side).map((v) => add(v, shift));
    if (p.every((v, k) => nearV(v, jp[k], 1e-6))) pointsSame++;

    const js = jSegments(side).segments.map(([a, b]) => [add(a, shift), add(b, shift)]);
    const cs = C.appletSegments(side).segments.map((seg) => [add(seg.a, shift), add(seg.b, shift)]);
    if (js.every((pair, k) => nearV(cs[k][0], pair[0], 1e-6) && nearV(cs[k][1], pair[1], 1e-6))) segmentsSame++;

    /* The live geometry uses the player's points; at the start they are the
     * applet's, and the five segments must still be exactly the same. */
    const st = randomState({ side: side });
    const g = C.geometry(st);
    const live = g.segments.map((seg) => [seg.a, seg.b]);
    const fixed = C.appletSegments(side).segments.map((seg) => [seg.a, seg.b]);
    if (live.every((pair, k) => nearV(pair[0], fixed[k][0], 1e-6) && nearV(pair[1], fixed[k][1], 1e-6)) &&
        g.groups.obtuse.join() === "0,1,3" && g.groups.acute.join() === "2,4") liveSame++;
    views++;
  }
  check(`Reset()'s points match the bytecode on all ${views} sizes and translations`, pointsSame === views);
  check(`all five segments match the bytecode on all ${views} configurations`, segmentsSame === views);
  check(`live segments and branch groups match the applet on all ${views} views`, liveSame === views);

  /* Translation and rotation are view changes, so the relations cannot move. */
  let invariant = 0, n = 0;
  for (let i = 0; i < 500; i++) {
    const st = randomState({ side: randomSide() });
    const g = C.geometry(st);
    if (g.claims.obtuseFaceDiagonal && g.claims.acuteEdge &&
        g.claims.supplementary && g.claims.tetrahedron && g.claims.rightTriangle) invariant++;
    n++;
  }
  check(`all five page claims survive all ${n} random view/size changes`, invariant === n && n === 500);
}

/* ------------------- 3. every pair of cube corners, at five cube sizes */

{
  const sizes = [C.SIDE_MIN, 0.5, 1, 2, C.SIDE_MAX];
  let cosOk = 0, angleOk = 0, labelOk = 0, total = 0, obtuseOk = 0, acuteOk = 0;
  for (const side of sizes) {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const g = C.geometry(pairState(side, i, j, 0));
        const p = corner(i, side), q = corner(j, side);
        const h = C.hamming({ side: side }, i, j);
        const want = [1, 1 / 3, -1 / 3, -1][h];
        if (near(g.obtuseCos, want, 1e-8)) cosOk++;
        if (near(g.obtuseDeg, acosDeg(want), 1e-7)) angleOk++;
        if (g.pairKinds.obtuse === [
          "the same corner",
          "a cube edge — the acute central angle",
          "a face diagonal — the obtuse central angle",
          "a body diagonal — a straight angle",
        ][h]) labelOk++;
        if (g.claims.obtuseFaceDiagonal === (h === 2)) obtuseOk++;
        if (g.claims.acuteEdge === (C.hamming({ side: side }, j, 0) === 1)) acuteOk++;
        total++;
      }
    }
  }
  check(`cosine is 1, 1/3, -1/3 or -1 on all ${total} corner pairs`, cosOk === total);
  check(`the angles agree with arccos on all ${total} corner pairs`, angleOk === total);
  check(`the plain-English labels agree on all ${total} corner pairs`, labelOk === total);
  check(`the obtuse claim fires exactly for face diagonals (${total} pairs)`, obtuseOk === total);
  check(`the acute claim fires exactly for cube edges (${total} pairs)`, acuteOk === total);
  check("the article's numbers are 109.47122° and 70.52878°",
    near(C.OBTUSE_DEG, 109.47122, 1e-6) && near(C.ACUTE_DEG, 70.52878, 1e-6));
}

/* --------------------------------- 4. supplementary angles and collinearity */

{
  let supplementary = 0, collinear = 0, total = 0;
  const opposite = [[0, 6], [1, 7], [2, 4], [3, 5]];
  for (const side of [0.25, 0.5, 1, 2, 4]) {
    for (const [i, k] of opposite) {
      for (let j = 0; j < 8; j++) {
        const g = C.geometry(pairState(side, i, j, k));
        if (g.claims.supplementary && near(g.obtuseDeg + g.acuteDeg, 180, 1e-7)) supplementary++;
        if (g.claims.oppositeEnds && g.claims.collinearThroughO) collinear++;
        total++;
      }
    }
  }
  check(`s + t = 180° on all ${total} opposite-corner configurations`, supplementary === total);
  check(`the two outer points are a body diagonal with O at its middle on all ${total}`, collinear === total);

  /* Not every pair is supplementary: the applet's two angles can be moved. */
  const notOpposite = C.geometry(pairState(1, 0, 2, 5));
  check("moving R off the opposite corner breaks the supplementary claim",
    !notOpposite.claims.supplementary && !notOpposite.claims.collinearThroughO);
}

/* --------------------------------- 5. the tetrahedron and the right triangle */

{
  let tetra = 0, triangle = 0, pageTriangle = 0, n = 0;
  for (const side of [0.25, 0.5, 1, 2, 4]) {
    for (let i = 0; i < 40; i++) {
      const g = C.geometry(randomState({ side: side, showTetra: true }));
      const corners = C.TETRA.map((k) => corner(k, side));
      const angles = [];
      for (let a = 0; a < 4; a++) {
        for (let b = a + 1; b < 4; b++) angles.push(acosDeg(pageCos(corners[a], corners[b])));
      }
      if (g.claims.tetrahedron && angles.every((x) => near(x, C.OBTUSE_DEG, 1e-7)) &&
          g.tetrahedron.angles.every((x) => near(x, C.OBTUSE_DEG, 1e-7))) tetra++;
      const t = g.triangle;
      if (g.claims.rightTriangle && t.rightAtC && t.midpointIsO &&
          near(t.AC, side * Math.SQRT2, 1e-7) && near(t.CCp, side, 1e-7) &&
          near(t.ACp, side * Math.sqrt(3), 1e-7)) triangle++;
      n++;
    }
  }
  check(`the inscribed tetrahedron's six angles are all arccos(-1/3) on ${n} cases`, tetra === n);
  check(`triangle A C C' keeps the page's lengths and median on ${n} cases`, triangle === n);

  /* The page uses a cube of side 2: legs 2 and 2*sqrt(2), hypotenuse 2*sqrt(3). */
  const A = mul(C.VERTICES[0], 2), Cc = mul(C.VERTICES[2], 2), Cp = mul(C.VERTICES[6], 2);
  const legs = [dist(A, Cc), dist(Cc, Cp)], hyp = dist(A, Cp);
  check("for side 2 the page's legs really are 2 and 2*sqrt(2)",
    near(legs[0], 2 * Math.SQRT2, 1e-7) && near(legs[1], 2, 1e-7));
  check("for side 2 the hypotenuse is 2*sqrt(3) and the median is sqrt(3)",
    near(hyp, 2 * Math.sqrt(3), 1e-7) && near(dist(Cc, V(0, 0, 0)), Math.sqrt(3), 1e-7));
  check("the page's A, C, B', D' are alternate corners (no two joined by an edge)",
    (() => {
      const box = { side: 1 };
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          if (C.hamming(box, C.TETRA[i], C.TETRA[j]) !== 2) return false;
        }
      }
      return true;
    })());
}

/* ------------------------------- 6. free points, projection and controls */

{
  let freeCos = 0, freeAngle = 0, freeLabel = 0, count = 0;
  for (let i = 0; i < 2000; i++) {
    const p = randomV(-3, 3), q = randomV(-3, 3), r = randomV(-3, 3);
    const g = C.geometry(C.start({ points: { P: p, Q: q, R: r }, snap: false }));
    const want = pageCos(p, q);
    if (near(g.obtuseCos, want, 1e-9)) freeCos++;
    if (near(g.obtuseDeg, acosDeg(want), 1e-7)) freeAngle++;
    if (g.pairKinds.obtuse === "a free point") freeLabel++;
    count++;
  }
  check(`free dragged points match the dot-product formula on all ${count} triples`, freeCos === count);
  check(`free angles match arccos on all ${count} triples`, freeAngle === count);
  check(`free points are not mislabelled as cube central angles (${count} cases)`, freeLabel === count);
}

{
  const s = randomState({});
  let roundTrip = 0, linear = 0, n = 0;
  for (let i = 0; i < 600; i++) {
    const p = randomV(-2, 2), q = randomV(-2, 2);
    const sp = C.project(s, p), sq = C.project(s, q);
    if (nearV(C.unproject(s, sp, sp.depth), p, 1e-9)) roundTrip++;
    if (near2(C.project(s, mid(p, q)), {
      x: (sp.x + sq.x) / 2, y: (sp.y + sq.y) / 2,
    }, 1e-9)) linear++;
    n++;
  }
  check(`unproject(project(p)) returns p on all ${n} points`, roundTrip === n);
  check(`the projection preserves midpoints on all ${n} pairs`, linear === n);

  const turned = C.rotate(s, 0.5, -0.3);
  check("turning changes only the view, not the points or the angles",
    HANDLES_OK(turned, s) && turned.yaw > s.yaw && turned.pitch < s.pitch);
  function HANDLES_OK(a, b) {
    const ga = C.geometry(a), gb = C.geometry(b);
    return C.HANDLES.every((k) => nearV(a.points[k], b.points[k])) &&
      near(ga.obtuseDeg, gb.obtuseDeg, 1e-12) && near(ga.acuteDeg, gb.acuteDeg, 1e-12);
  }
  check("zoom is clamped in both directions",
    C.zoomBy(s, 100).zoom === C.ZOOM_MAX && C.zoomBy(s, 0.0001).zoom === C.ZOOM_MIN);
  check("pitch is clamped before the view turns over",
    Math.abs(C.rotate(s, 0, 99).pitch) < Math.PI / 2);
}

{
  const s = C.start();
  const moved = C.movePoint(s, "P", V(100, 100, 100));
  check("snapping puts a dragged handle on the nearest cube corner",
    nearV(moved.points.P, corner(0, 1)) && moved.explored && !s.explored);
  const free = C.movePoint(C.setSnap(s, false), "P", V(0.21, -0.13, 0.07));
  check("with snapping off the handle stays exactly where it was dragged",
    nearV(free.points.P, V(0.21, -0.13, 0.07)));
  check("an unknown handle or a non-finite point is ignored",
    C.movePoint(s, "Z", V(1, 2, 3)) === s && C.movePoint(s, "Q", V(NaN, 2, 3)) === s);
  check("all four applet modes can be selected and an unknown mode is ignored",
    ["none", "obtuse", "acute", "both"].every((m) => C.setMode(s, m).mode === m) &&
    C.setMode(s, "other") === s);
  check("the tetrahedron and snap toggles flip and mark the diagram explored",
    C.setTetra(s, true).showTetra && !s.showTetra &&
    C.setSnap(s, false).snap === false && s.snap);
  check("Reset restores the applet's points and hides both ray groups",
    (() => {
      const dirty = C.setMode(C.movePoint(s, "R", V(9, 9, 9)), "both");
      const r = C.reset(dirty);
      return r.mode === "none" && nearV(r.points.R, C.appletPoints(1)[3]) &&
        dirty.explored && r.explored && r.snap === dirty.snap;
    })());
  check("a handle at the middle dot has no angle and a helpful status",
    (() => {
      const broken = C.start({ points: { P: V(0, 0, 0), Q: s.points.Q, R: s.points.R }, mode: "both" });
      const g = C.geometry(broken);
      return g.claims.degenerate && !Number.isFinite(g.obtuseDeg) && /middle dot/.test(C.describe(broken));
    })());
  check("a non-finite handle leaves no drawing",
    C.geometry({ side: 1, points: { P: V(0, 0, Infinity), Q: s.points.Q, R: s.points.R },
      yaw: 0, pitch: 0, zoom: 1 }) === null);
  check("the descriptions name the two angles in the two modes",
    /109/.test(C.describe(C.setMode(s, "obtuse"))) &&
    /70/.test(C.describe(C.setMode(s, "acute"))) &&
    /180/.test(C.describe(C.setMode(s, "both"))) &&
    /Obtuse/.test(C.describe(s)));
  check("the saved position is plain data for the tutor", (() => {
    const g = C.geometry(C.setMode(s, "both"));
    const position = {
      points: s.points, mode: s.mode, side: s.side,
      obtuseCos: g.obtuseCos, acuteCos: g.acuteCos,
      angles: [g.obtuseDeg, g.acuteDeg], claims: g.claims,
    };
    return JSON.stringify(position).length > 100 && !/undefined/.test(JSON.stringify(position));
  })());
  check("the core touches no DOM", typeof globalThis.document === "undefined");
}

done("central-angles-in-cube");
