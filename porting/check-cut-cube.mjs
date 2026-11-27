#!/usr/bin/env node
"use strict";

/*
 * Logic test for cut-cube/cut-cube-core.js.
 *
 *   node porting/check-cut-cube.mjs
 *
 * Three independent readings meet here:
 *  1. the applet's constants, initial transforms and AttachCone matrix algebra
 *     are transcribed again straight from the javap output and compared with
 *     the core over many random transforms;
 *  2. every section is recomputed by a different algorithm — clip a large
 *     polygon in the plane against the cube's six half-spaces — and compared
 *     with the core's edge-crossing algorithm over hundreds of random cuts;
 *  3. the page's claim (square, quadrilateral, pentagon, hexagon, a pyramid
 *     cut off a corner) is searched over all integer normals in [-3,3]^3 and
 *     many offsets, not just a handful of examples.
 */

import { loadCore, check, equal, done, rng } from "./lib/load-core.mjs";

const C = loadCore("cut-cube/cut-cube-core.js", "CutCubeCore");
const EPS = 1e-6;

/* ------------------------------------------- a separate matrix transcription */

const vsub = (a, b) => a.map((x, i) => x - b[i]);
const vadd = (a, b) => a.map((x, i) => x + b[i]);
const vscale = (a, k) => a.map((x) => x * k);
const vdot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const vcross = (a, b) => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
const vlen = (a) => Math.hypot(...a);
const vunit = (a) => vscale(a, 1 / (vlen(a) || 1));

/** Row-major product, written independently of the core. */
function mm(A, B) {
  const M = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1]];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    M[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j] + A[i][3] * B[3][j];
  }
  return M;
}
const mt = (v) => [[1, 0, 0, v[0]], [0, 1, 0, v[1]], [0, 0, 1, v[2]], [0, 0, 0, 1]];
const ms = (k) => [[k, 0, 0, 0], [0, k, 0, 0], [0, 0, k, 0], [0, 0, 0, 1]];
function mr(axis, a) {
  const [x, y, z] = vunit(axis), c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y, 0],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x, 0],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c, 0],
    [0, 0, 0, 1],
  ];
}
function minv(A) {
  const [a, b, c] = A[0], [d, e, f] = A[1], [g, h, i] = A[2];
  const A1 = e * i - f * h, B1 = f * g - d * i, C1 = d * h - e * g;
  const det = a * A1 + b * B1 + c * C1;
  if (Math.abs(det) < 1e-12) return null;
  const R = [
    [A1 / det, (c * h - b * i) / det, (b * f - c * e) / det, 0],
    [B1 / det, (a * i - c * g) / det, (c * d - a * f) / det, 0],
    [C1 / det, (b * g - a * h) / det, (a * e - b * d) / det, 0],
    [0, 0, 0, 1],
  ];
  for (let row = 0; row < 3; row++) {
    R[row][3] = -(R[row][0] * A[0][3] + R[row][1] * A[1][3] + R[row][2] * A[2][3]);
  }
  return R;
}
function mv(A, p) {
  return [0, 1, 2].map((i) => A[i][0] * p[0] + A[i][1] * p[1] + A[i][2] * p[2] + A[i][3]);
}
function mlinear(A, v) {
  return [0, 1, 2].map((i) => A[i][0] * v[0] + A[i][1] * v[1] + A[i][2] * v[2]);
}
function near(A, B, tol = 1e-9) {
  return A.every((row, i) => row.every((x, j) => Math.abs(x - B[i][j]) <= tol));
}
function nearPoints(P, Q, tol = 1e-5) {
  if (P.length !== Q.length) return false;
  // Match by position, not by sorted index: two corners at the same x can
  // swap order when the two algorithms round differently.
  const used = new Set();
  for (const p of P) {
    let found = -1;
    for (let i = 0; i < Q.length; i++) {
      if (used.has(i) || vlen(vsub(p, Q[i])) > tol) continue;
      found = i;
      break;
    }
    if (found < 0) return false;
    used.add(found);
  }
  return true;
}
function randomTransform(rand) {
  let M = mt([(rand() - 0.5) * 16, (rand() - 0.5) * 16, (rand() - 0.5) * 16]);
  for (let k = 0; k < 3; k++) {
    const axis = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
    M = mm(M, mr(axis, (rand() - 0.5) * 5));
  }
  return mm(M, ms(0.5 + rand() * 1.6));
}

/* -------------------------------------- 1. the applet's constants and defaults */

{
  const K = C.CONST;
  equal("ColorCube side is 6", K.CUBE_SIDE, 6);
  equal("cube half-side is 3", K.HALF, 3);
  equal("CTKPlane size is 20", K.PLANE_SIZE, 20);
  equal("outer scale is 0.05", K.OUTER_SCALE, 0.05);
  check("cube has eight vertices", K.CUBE_VERTS.length === 8);
  check("cube has twelve edges", K.CUBE_EDGES.length === 12);
  check("every edge joins vertices one coordinate apart", K.CUBE_EDGES.every(([a, b]) => {
    const d = Math.abs(a - b);
    return d === 1 || d === 2 || d === 4;
  }));

  // javap: createCoords(0,0,20) pushes (x-size,20,y-size), (x-size,0,y+size),
  // (x+size,-20,y+size), (x+size,0,y-size) in that order.
  const size = 20, x = 0, y = 0;
  const bytecodeQuad = [
    [x - size, 20, y - size], [x - size, 0, y + size],
    [x + size, -20, y + size], [x + size, 0, y - size],
  ];
  equal("plane quad is the bytecode quad", K.BASE_PLANE, bytecodeQuad);
  const n = vcross(vsub(bytecodeQuad[1], bytecodeQuad[0]), vsub(bytecodeQuad[2], bytecodeQuad[0]));
  check("the quad's normal is proportional to (1,2,1)",
    vlen(vsub(vunit(n), vunit([1, 2, 1]))) < EPS);
  check("all four quad corners lie in one plane", bytecodeQuad.every((p) => Math.abs(vdot(n, p)) < EPS));

  const s = C.start({});
  check("the illustration never ends", C.result(s) === null);
  equal("transparent is the default plane style", s.style, "transparent");
  equal("separate is the default object mode", s.combined, false);

  // javap: rotZ(pi/4), rotX(pi/6), rotY(pi/6), setTranslation(1*6,0,0).
  const bytecodeCube = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1]];
  const R = mm(mm(mr([0, 0, 1], Math.PI / 4), mr([1, 0, 0], Math.PI / 6)), mr([0, 1, 0], Math.PI / 6));
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) bytecodeCube[row][col] = R[row][col];
    bytecodeCube[row][3] = row === 0 ? 6 : 0;
  }
  check("initial cube transform matches the bytecode", near(s.cube, bytecodeCube));
  check("initial plane transform is the identity", near(s.plane, C.identity()));
  check("initial cube centre is at x=6 before outer scaling",
    Math.abs(mv(s.cube, [0, 0, 0])[0] - 6) < EPS);
}

/* --------------------- 2. AttachCone and the radio buttons, over random poses */

{
  const rand = rng(20261127);
  let formulaOk = true, worldOk = true, roundTripOk = true;
  for (let k = 0; k < 120; k++) {
    const plane = randomTransform(rand), cube = randomTransform(rand);
    const separate = { cube, plane, combined: false, style: "transparent" };

    // AttachCone(true): cube <- inverse(P) * C, plane becomes the parent.
    const joined = C.setMode(separate, "combined");
    const expectedJoined = mm(minv(plane), cube);
    if (!near(joined.cube, expectedJoined, 1e-8)) formulaOk = false;
    const w1 = C.world(separate), w2 = C.world(joined);
    if (!near(w1.cube, w2.cube, 1e-8) || !near(w1.plane, w2.plane, 1e-8)) worldOk = false;

    // AttachCone(false): cube <- P * cubeLocal, plane becomes a sibling again.
    const back = C.setMode(joined, "separate");
    if (!near(back.cube, cube, 1e-8) || !near(back.plane, plane, 1e-8)) roundTripOk = false;
  }
  check("AttachCone(true) uses inverse(P) * C on 120 random poses", formulaOk);
  check("toggling never moves either object on screen on 120 random poses", worldOk);
  check("AttachCone(false) restores the original cube transform on 120 random poses", roundTripOk);

  const s = C.start({});
  check("setMode ignores a repeated command", C.setMode(s, "separate") === s);
  check("setStyle ignores an unknown command", C.setStyle(s, "grey") === s);
  equal("transparent command changes the style", C.setStyle(s, "opaque").style, "opaque");
  equal("opaque command changes it back", C.setStyle(C.setStyle(s, "opaque"), "transparent").style, "transparent");
  const dragged = C.apply(s, "plane", C.scaling(2));
  check("a picked move only changes the picked transform", near(dragged.cube, s.cube));
  check("a zoom multiplies the picked transform", near(dragged.plane, mm(C.scaling(2), s.plane)));
  check("an unknown target is ignored", C.apply(s, "light", C.scaling(2)) === s);
}

/* ------------------------- 3. an independent clipping algorithm for the cut */

/** Clip a planar polygon against one half-space a.x <= limit. */
function clip(poly, axis, limit) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const fp = p[axis] - limit, fq = q[axis] - limit;
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      out.push(vadd(p, vscale(vsub(q, p), fp / (fp - fq))));
    }
  }
  return out;
}

/**
 * Independent section: span a big square in the plane, pull it into the cube's
 * local coordinates, clip against the six faces, then push the remainder back.
 * No edge intersection and no angular sort, unlike the core.
 */
function clippedSection(cube, plane) {
  const invP = minv(plane), invC = minv(cube);
  if (!invP || !invC) return [];
  // A normal of the transformed quad, from the inverse transpose of P.
  const n0 = [1, 2, 1];
  const n = vunit([0, 1, 2].map((i) =>
    invP[0][i] * n0[0] + invP[1][i] * n0[1] + invP[2][i] * n0[2]));
  const centre = mv(plane, [0, 0, 0]);
  const helper = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = vunit(vcross(helper, n)), v = vcross(n, u);
  const R = 80;
  let poly = [
    vadd(vadd(centre, vscale(u, -R)), vscale(v, -R)),
    vadd(vadd(centre, vscale(u, R)), vscale(v, -R)),
    vadd(vadd(centre, vscale(u, R)), vscale(v, R)),
    vadd(vadd(centre, vscale(u, -R)), vscale(v, R)),
  ].map((p) => mv(invC, p));
  for (let axis = 0; axis < 3 && poly.length; axis++) {
    poly = clip(poly, axis, 3);
    if (poly.length) poly = clip(poly.map((p) => p.map((x) => -x)), axis, 3).map((p) => p.map((x) => -x));
  }
  return poly.map((p) => mv(cube, p));
}

{
  const rand = rng(3942);
  let failures = 0, cuts = 0;
  for (let k = 0; k < 300; k++) {
    const cube = randomTransform(rand), plane = randomTransform(rand);
    const got = C.section(cube, plane), want = clippedSection(cube, plane);
    cuts += got.length ? 1 : 0;
    if (!nearPoints(got, want, 1e-4)) failures++;
  }
  check("300 random cuts agree with the clipping transcription", failures === 0, `${failures} differ`);
  check("the random cuts include real sections", cuts > 100, `${cuts} nonempty`);
}

/* ------------------------------------------------- 4. the page's exact claim */

{
  const seen = new Map();
  let overSix = false, offPlane = false, outsideCube = false, compared = 0, differing = 0;
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) for (let c = -3; c <= 3; c++) {
    if (!a && !b && !c) continue;
    const n = [a, b, c], support = 3 * (Math.abs(a) + Math.abs(b) + Math.abs(c));
    for (let j = 1; j <= 24; j++) {
      const d = -support + (2 * support * j) / 25;
      const plane = C.planeFromNormal(n, d);
      const pts = C.section(C.identity(), plane);
      seen.set(pts.length, (seen.get(pts.length) || 0) + 1);
      if (pts.length > 6) overSix = true;
      if (pts.some((p) => Math.abs(vdot(n, p) - d) > 1e-4)) offPlane = true;
      if (pts.some((p) => p.some((x) => Math.abs(x) > 3.0001))) outsideCube = true;
      if ((a * 7 + b * 11 + c * 13 + j) % 97 === 0) {
        compared++;
        if (!nearPoints(pts, clippedSection(C.identity(), plane), 1e-4)) differing++;
      }
    }
  }
  check("no cut of a cube has more than six sides", !overSix);
  check("every section point satisfies the plane equation", !offPlane);
  check("every section point lies on the cube", !outsideCube);
  for (const sides of [3, 4, 5, 6]) {
    check(`the exhaustive search finds a ${sides}-sided section`, (seen.get(sides) || 0) > 0,
      `counts: ${JSON.stringify([...seen])}`);
  }
  check(`the clipping algorithm agrees on all ${compared} sampled grid cuts`, differing === 0, `${differing} differ`);

  const at = (name) => C.snapshot(C.preset(C.start({}), name));
  const square = at("square").section;
  check("a square cut has four vertices", square.length === 4);
  check("the square cut is parallel to a face", square.every((p) => Math.abs(p[2]) < EPS));
  const squareSides = square.map((p, i) => vlen(vsub(square[(i + 1) % 4], p)));
  check("all four square sides are equal",
    Math.max(...squareSides) - Math.min(...squareSides) < 1e-6);
  check("the square has right angles",
    Math.abs(vdot(vsub(square[1], square[0]), vsub(square[2], square[1]))) < 1e-6);

  const quad = at("quadrilateral").section;
  check("a non-square quadrilateral cut has four vertices", quad.length === 4);
  const quadSides = quad.map((p, i) => vlen(vsub(quad[(i + 1) % 4], p)));
  check("the quadrilateral is not a square", Math.max(...quadSides) - Math.min(...quadSides) > 0.1);

  check("the pentagon preset has five sides", at("pentagon").section.length === 5);
  check("the hexagon preset has six sides", at("hexagon").section.length === 6);
  const hex = at("hexagon").section;
  const hexSides = hex.map((p, i) => vlen(vsub(hex[(i + 1) % 6], p)));
  check("a central cut gives a regular hexagon",
    Math.max(...hexSides) - Math.min(...hexSides) < 1e-6);

  // The page asks whether a pyramid can be cut off: one corner must be isolated.
  const pyramid = at("pyramid");
  check("a corner cut gives a triangle", pyramid.section.length === 3);
  const far = C.CONST.CUBE_VERTS.filter((v) => vdot([1, 1, 1], v) > 7.5 + EPS);
  check("the triangle isolates exactly one corner, making a tetrahedron", far.length === 1);
  check("the triangle's vertices are where the three edges at that corner are cut",
    pyramid.section.every((p) => p.filter((x) => Math.abs(x - 3) < 1e-6).length === 2));
  check("presets leave no win or loss", Object.keys(C.CONST.PRESETS).every((name) =>
    C.result(C.preset(C.start({}), name)) === null));
  const before = C.start({});
  check("an unknown preset leaves the position alone", C.preset(before, "seven") === before);
  equal("the six-sided cut is named a hexagon", C.classify(hex), "a hexagon");
  equal("an empty section is named no cut", C.classify([]), "no cut");
}

done("cut-cube");
