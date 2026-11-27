"use strict";

/*
 * Cut Cube — Alexander Bogomolny's applet CutCube, geometry only.
 *
 * The applet shows a translucent plane and a coloured cube that can be turned,
 * slid and zoomed separately or together. Its Java3D scene keeps two affine
 * transforms: the cube's (created with rotations pi/4, pi/6, pi/6 and the
 * translation (6,0,0)) and the plane's (initially the identity), both under an
 * outer scale of 0.05. "combined" reparents the plane under the cube's branch
 * and replaces the cube's local transform by inverse(plane) * cube, as the
 * applet's AttachCone does; "separate" puts it back with plane * cube.
 *
 * The section is where the plane meets the cube. In cube-local coordinates the
 * cube is [-3,3]^3 (ColorCube(6)) and the plane is the quad made by
 * CTKPlane.createCoords(0, 0, 20). We cut the cube's twelve edges by that
 * plane and put the resulting points in order around their centre. That is all
 * this file does: no document, no window, no storage. It defines one global,
 * CutCubeCore, so a page loads it with a plain <script> and Node can load it
 * with porting/lib/load-core.mjs. Every value in a position is plain data.
 */
const CutCubeCore = (() => {
  // Values read straight from CutCube.java / CTKPlane.java.
  const CUBE_SIDE = 6;             // new ColorCube(6.0f) in CreateCube
  const HALF = CUBE_SIDE / 2;      // the cube is [-3,3] in its own coordinates
  const PLANE_SIZE = 20;          // new CTKPlane(alColor, 20) in CreatePlane
  const OUTER_SCALE = 0.05;       // Transform3D.setScale(0.05) in createSceneGraph
  const ROT_Z = Math.PI / 4;
  const ROT_X = Math.PI / 6;
  const ROT_Y = Math.PI / 6;
  const BASE_START = [CUBE_SIDE, 0, 0]; // setTranslation(1*6, 0, 0)

  // CTKPlane.createCoords(0, 0, 20), in the order it adds them to the QuadArray.
  const BASE_PLANE = [
    [0 - PLANE_SIZE, 20, 0 - PLANE_SIZE],
    [0 - PLANE_SIZE, 0, 0 + PLANE_SIZE],
    [0 + PLANE_SIZE, -20, 0 + PLANE_SIZE],
    [0 + PLANE_SIZE, 0, 0 - PLANE_SIZE],
  ];
  // (p1-p0) x (p2-p0) = (800, 1600, 800), so the quad lies in x + 2y + z = 0.
  const BASE_NORMAL = [1, 2, 1];

  const CUBE_VERTS = [];
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) {
    CUBE_VERTS[4 * x + 2 * y + z] = [
      x ? HALF : -HALF, y ? HALF : -HALF, z ? HALF : -HALF,
    ];
  }
  const CUBE_EDGES = [];
  for (let i = 0; i < 8; i++) {
    if (!(i & 1)) CUBE_EDGES.push([i, i + 1]);
    if (!(i & 2)) CUBE_EDGES.push([i, i + 2]);
    if (!(i & 4)) CUBE_EDGES.push([i, i + 4]);
  }

  /* ------------------------------------------------------- small vector sums */

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mulVec = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
  ];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a) => { const n = len(a) || 1; return mulVec(a, 1 / n); };

  /* -------------------------- 4x4 affine matrices, row major, column vectors */

  function identity() {
    return [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  }

  /** A * B, the same order as Transform3D.mul. */
  function multiply(A, B) {
    const M = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1]];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += A[i][k] * B[k][j];
      M[i][j] = s;
    }
    return M;
  }

  function translation(v) {
    const M = identity();
    M[0][3] = v[0]; M[1][3] = v[1]; M[2][3] = v[2];
    return M;
  }

  function withTranslation(M, v) {
    const N = M.map((r) => r.slice());
    N[0][3] = v[0]; N[1][3] = v[1]; N[2][3] = v[2];
    return N;
  }

  function scaling(k) {
    const M = identity();
    M[0][0] = M[1][1] = M[2][2] = k;
    return M;
  }

  function rotation(axis, angle) {
    const u = unit(axis), c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    const [x, y, z] = u;
    return [
      [t * x * x + c, t * x * y - s * z, t * x * z + s * y, 0],
      [t * x * y + s * z, t * y * y + c, t * y * z - s * x, 0],
      [t * x * z - s * y, t * y * z + s * x, t * z * z + c, 0],
      [0, 0, 0, 1],
    ];
  }

  const rotationX = (a) => rotation([1, 0, 0], a);
  const rotationY = (a) => rotation([0, 1, 0], a);
  const rotationZ = (a) => rotation([0, 0, 1], a);

  function applyPoint(M, p) {
    const w = M[3][0] * p[0] + M[3][1] * p[1] + M[3][2] * p[2] + M[3][3];
    return [
      (M[0][0] * p[0] + M[0][1] * p[1] + M[0][2] * p[2] + M[0][3]) / w,
      (M[1][0] * p[0] + M[1][1] * p[1] + M[1][2] * p[2] + M[1][3]) / w,
      (M[2][0] * p[0] + M[2][1] * p[1] + M[2][2] * p[2] + M[2][3]) / w,
    ];
  }

  function applyLinear(M, v) {
    return [
      M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
      M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
      M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
    ];
  }

  /** The inverse of an affine 4x4 matrix; null if it has no inverse. */
  function inverse(M) {
    const a = M[0][0], b = M[0][1], c = M[0][2];
    const d = M[1][0], e = M[1][1], f = M[1][2];
    const g = M[2][0], h = M[2][1], i = M[2][2];
    const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g;
    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-12) return null;
    const t = [M[0][3], M[1][3], M[2][3]];
    const inv = [
      [A / det, (c * h - b * i) / det, (b * f - c * e) / det, 0],
      [B / det, (a * i - c * g) / det, (c * d - a * f) / det, 0],
      [C / det, (b * g - a * h) / det, (a * e - b * d) / det, 0],
      [0, 0, 0, 1],
    ];
    // solve for the translation column so that inverse(M) * [t,1] = [0,0,0,1]
    inv[0][3] = -(inv[0][0] * t[0] + inv[0][1] * t[1] + inv[0][2] * t[2]);
    inv[1][3] = -(inv[1][0] * t[0] + inv[1][1] * t[1] + inv[1][2] * t[2]);
    inv[2][3] = -(inv[2][0] * t[0] + inv[2][1] * t[1] + inv[2][2] * t[2]);
    return inv;
  }

  /** A rotation carrying the applet's base normal onto the requested normal. */
  function align(normal) {
    const from = unit(BASE_NORMAL), to = unit(normal);
    const axis = cross(from, to);
    if (len(axis) < 1e-12) {
      // Parallel or antiparallel: spin about any perpendicular direction.
      const other = Math.abs(from[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const perp = cross(from, other);
      return dot(from, to) > 0 ? identity() : rotation(perp, Math.PI);
    }
    return rotation(axis, Math.acos(Math.max(-1, Math.min(1, dot(from, to)))));
  }

  /** A plane transform whose quad lies in n . x = d. */
  function planeFromNormal(normal, offset) {
    const n = unit(normal);
    return multiply(translation(mulVec(n, offset / len(normal))), align(normal));
  }

  /* ------------------------------------------------------ the section itself */

  /**
   * Where a plane n . x = d cuts the cube transformed by `cube`. Cuts are
   * computed in cube-local coordinates (the cube is [-3,3]^3 there) and the
   * points are returned in world coordinates, in order round their centre.
   */
  function sectionEquation(cube, n, d) {
    const inv = inverse(cube);
    if (!inv) return [];
    // The closest point of the plane to the world origin, then its local twin.
    const near = mulVec(n, d / dot(n, n));
    const localOrigin = applyPoint(inv, near);
    // n_local = cube^T * n_world (the inverse transpose of inverse(cube)).
    const nLocal = applyLinear([
      [cube[0][0], cube[1][0], cube[2][0]],
      [cube[0][1], cube[1][1], cube[2][1]],
      [cube[0][2], cube[1][2], cube[2][2]],
    ], n);
    const dLocal = dot(nLocal, localOrigin);

    const points = [];
    const put = (p) => {
      if (!points.some((q) => len(sub(p, q)) < 1e-6)) points.push(p);
    };
    for (const [a, b] of CUBE_EDGES) {
      const p = CUBE_VERTS[a], q = CUBE_VERTS[b];
      const fp = dot(nLocal, p) - dLocal, fq = dot(nLocal, q) - dLocal;
      if (Math.abs(fp) < 1e-9) put(p);
      if (Math.abs(fq) < 1e-9) put(q);
      if (fp * fq < -1e-18) {
        const t = fp / (fp - fq);
        put(add(p, mulVec(sub(q, p), t)));
      }
    }
    if (points.length < 3) return [];

    const centre = points.reduce((s, p) => add(s, p), [0, 0, 0]).map((v) => v / points.length);
    const normal = unit(nLocal);
    const seed = Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = unit(cross(seed, normal));
    const v = cross(normal, u);
    // Sort by angle in the plane, around the section's own centre.
    const angle = (p) => {
      const r = sub(p, centre);
      return Math.atan2(dot(r, v), dot(r, u));
    };
    points.sort((p, q) => angle(p) - angle(q));
    return points.map((p) => applyPoint(cube, p));
  }

  /** Normals transform by the inverse transpose of the affine linear part. */
  function normalOf(plane) {
    const inv = inverse(plane);
    return inv
      ? applyLinear([
        [inv[0][0], inv[1][0], inv[2][0]],
        [inv[0][1], inv[1][1], inv[2][1]],
        [inv[0][2], inv[1][2], inv[2][2]],
      ], BASE_NORMAL)
      : BASE_NORMAL.slice();
  }

  /** The section made by the applet's two world transforms. */
  function section(cube, plane) {
    const n = normalOf(plane);
    const d = dot(n, applyPoint(plane, [0, 0, 0]));
    return sectionEquation(cube, n, d);
  }

  const SECTION_NAMES = ["no cut", "no cut", "no cut", "a triangle", "a quadrilateral", "a pentagon", "a hexagon"];
  function classify(pts) {
    return SECTION_NAMES[Math.min(6, pts.length)] || "many sides";
  }

  /* ------------------------------------------------------------- the position */

  function start() {
    // rotZ, rotX, rotY in the order the bytecode calls them, then setTranslation.
    const R = multiply(multiply(rotationZ(ROT_Z), rotationX(ROT_X)), rotationY(ROT_Y));
    return {
      cube: withTranslation(R, BASE_START.slice()),
      plane: identity(),
      combined: false,
      style: "transparent",
    };
  }

  /** world transforms exactly as the Java3D graph has them. */
  function world(state) {
    return {
      cube: state.combined ? multiply(state.plane, state.cube) : state.cube,
      plane: state.plane.slice(),
    };
  }

  /** All the plain data a drawing (or the tutor) needs from a position. */
  function snapshot(state) {
    const W = world(state);
    const planeNormal = normalOf(W.plane);
    return {
      cube: W.cube,
      plane: W.plane,
      cubePoints: CUBE_VERTS.map((p) => applyPoint(W.cube, p)),
      cubeEdges: CUBE_EDGES.map((e) => e.slice()),
      planeCorners: BASE_PLANE.map((p) => applyPoint(W.plane, p)),
      section: section(W.cube, W.plane),
      normal: unit(planeNormal),
      scale: OUTER_SCALE,
      combined: state.combined,
      style: state.style,
    };
  }

  /** AttachCone(true) / AttachCone(false), with the same matrix arithmetic. */
  function setMode(state, mode) {
    const combined = mode === "combined";
    if (combined === state.combined) return state;
    let cube;
    if (combined) {
      // plane was a sibling: cubeWorld = inverse(P) * C, then plane is its parent.
      cube = multiply(inverse(state.plane), state.cube);
    } else {
      // plane was a child: restore C = P * cubeLocal, then make it a sibling.
      cube = multiply(state.plane, state.cube);
    }
    return { ...state, cube, combined };
  }

  function setStyle(state, style) {
    if (style !== "transparent" && style !== "opaque") return state;
    return { ...state, style };
  }

  /** Premultiply a move onto a transform group, as a picked Java3D node does. */
  function applyMove(state, target, delta) {
    if (target !== "cube" && target !== "plane") return state;
    return { ...state, [target]: multiply(delta, state[target]) };
  }

  const PRESETS = {
    pyramid: { n: [1, 1, 1], d: 7.5 },       // one corner isolated: a tetrahedron
    square: { n: [0, 0, 1], d: 0 },          // parallel to a face
    quadrilateral: { n: [1, 1, 0], d: 1 },   // a rectangle, not a square
    pentagon: { n: [1, 0.8, 0.35], d: 1.6 },
    hexagon: { n: [1, 1, 1], d: 0 },         // through the centre
  };

  /** Named cuts for the page's five questions; no win or loss is involved. */
  function preset(state, name) {
    const cfg = PRESETS[name];
    if (!cfg) return state;
    return {
      cube: identity(),
      plane: planeFromNormal(cfg.n, cfg.d),
      combined: false,
      style: state.style,
    };
  }

  // There is no game to finish: the applet is an illustration.
  const result = () => null;

  return {
    CONST: {
      CUBE_SIDE, HALF, PLANE_SIZE, OUTER_SCALE, ROT_Z, ROT_X, ROT_Y, BASE_START,
      BASE_PLANE: BASE_PLANE.map((p) => p.slice()), BASE_NORMAL: BASE_NORMAL.slice(),
      CUBE_VERTS: CUBE_VERTS.map((p) => p.slice()), CUBE_EDGES: CUBE_EDGES.map((e) => e.slice()),
      PRESETS,
    },
    identity, multiply, translation, scaling, rotation, rotationX, rotationY, rotationZ,
    applyPoint, applyLinear, inverse, align, planeFromNormal,
    start, world, snapshot, section, sectionEquation, classify,
    setMode, setStyle, apply: applyMove, preset, result,
  };
})();
