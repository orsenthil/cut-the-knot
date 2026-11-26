"use strict";

/*
 * Bimedians in a Tetrahedron — Alexander Bogomolny's applet
 * BimediansInTetrahedron (cut-the-knot.org, "Bimedians in a Regular
 * Tetrahedron").
 *
 * The six edges of a tetrahedron come in three pairs of opposite (non
 * touching) edges. Joining the midpoints of each pair gives three segments,
 * the bimedians. They all pass through the barycenter of the four corners,
 * and when the corners are equally far from that point they are pairwise at
 * right angles. The applet shows a regular tetrahedron inside a cube, where
 * the three bimedians join the centres of opposite faces.
 *
 * Reset() in the applet's bytecode sets e = 0.005f and the four corners
 *   (-e,-e,-e), (1+e,1+e,-e), (1+e,-e,1+e), (-e,1+e,1+e),
 * i.e. alternate corners of a cube of side 1 + 2e, with a tiny offset so the
 * corners stand just outside the drawn unit cube. It builds exactly three
 * CTKLineSegments, in the order (AB,CD), (AC,BD), (AD,BC), and leaves the
 * "Show cube" checkbox unchecked. The view is turned by rotX(pi/8) followed
 * by rotZ(-pi/6); the same two angles are used here.
 *
 * This file holds the geometry and the orthographic projection, and nothing
 * else: no document, no window, no storage. It defines one global,
 * BimediansInTetrahedronCore, so the page loads it with a plain <script> and
 * porting/check-bimedians-in-tetrahedron.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const BimediansInTetrahedronCore = (() => {
  const E = 0.005;                       // applet Reset(): float 0.005f
  const TILT = 0.39269908169872414;      // applet rotX(pi/8)
  const TURN = -0.5235987755982988;      // applet rotZ(-pi/6)
  const VIEW = { x: 0, y: 0, width: 420, height: 320 };
  const CX = VIEW.width / 2, CY = VIEW.height / 2;
  const SCALE = 116;                     // viewBox units per world unit at zoom 1
  const ZOOM_MIN = 0.6, ZOOM_MAX = 1.8;
  const PITCH_LIMIT = Math.PI / 2 - 0.05;
  const EPS = 1e-9;

  const V = (x, y, z) => ({ x: x, y: y, z: z });
  const copy = (p) => V(p.x, p.y, p.z);
  const add = (p, q) => V(p.x + q.x, p.y + q.y, p.z + q.z);
  const sub = (p, q) => V(p.x - q.x, p.y - q.y, p.z - q.z);
  const mul = (p, k) => V(p.x * k, p.y * k, p.z * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y + p.z * q.z;
  const length = (p) => Math.sqrt(dot(p, p));
  const dist = (p, q) => length(sub(p, q));
  /* javax.vecmath.Point3f midpoint: component-wise (a+b)/2. */
  const midpoint = (p, q) => V((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);

  const NAMES = ["A", "B", "C", "D"];
  const EDGES = [
    { name: "AB", a: 0, b: 1 }, { name: "AC", a: 0, b: 2 },
    { name: "AD", a: 0, b: 3 }, { name: "BC", a: 1, b: 2 },
    { name: "BD", a: 1, b: 3 }, { name: "CD", a: 2, b: 3 },
  ];
  /* Opposite edges, in the exact order of the applet's Segments[0..2]. */
  const PAIRS = [[0, 5], [1, 4], [2, 3]]; // AB-CD, AC-BD, AD-BC
  const CUBE_FACES = [
    [0, 1, 3, 2], [4, 5, 7, 6],   // x = min, x = max
    [0, 1, 5, 4], [2, 3, 7, 6],   // y = min, y = max
    [0, 2, 6, 4], [1, 3, 7, 5],   // z = min, z = max
  ];

  /** The four corners of the applet's Reset(), as plain data. */
  function regularCorners() {
    return [
      V(-E, -E, -E),
      V(1 + E, 1 + E, -E),
      V(1 + E, -E, 1 + E),
      V(-E, 1 + E, 1 + E),
    ];
  }

  /* A second shape, so the player can see the right angles disappear. */
  function skewedCorners() {
    const v = regularCorners();
    v[3] = V(-0.35, 1.45, 0.85);
    return v;
  }

  /** Copy simple options, clamping the applet-style view controls. */
  function options(o) {
    const src = o || {};
    const yaw = Number.isFinite(src.yaw) ? src.yaw : TURN;
    const pitch = Number.isFinite(src.pitch)
      ? clamp(src.pitch, -PITCH_LIMIT, PITCH_LIMIT) : TILT;
    const zoom = Number.isFinite(src.zoom) ? clamp(src.zoom, ZOOM_MIN, ZOOM_MAX) : 1;
    const shape = src.shape === "skew" ? "skew" : "regular";
    return {
      shape: shape,
      yaw: yaw,
      pitch: pitch,
      zoom: zoom,
      showCube: Boolean(src.showCube),
    };
  }

  /** The opening position: the applet's regular tetrahedron, cube hidden. */
  function start(o) {
    const opts = options(o);
    const vertices = o && o.vertices && o.vertices.length === 4 && o.vertices.every(finite)
      ? o.vertices.map(copy)
      : (opts.shape === "skew" ? skewedCorners() : regularCorners());
    return {
      vertices: vertices,
      yaw: opts.yaw, pitch: opts.pitch, zoom: opts.zoom,
      showCube: opts.showCube,
      explored: false,
    };
  }

  /** Reset restores the applet's regular tetrahedron but keeps the view. */
  function reset(state) {
    const s = start({
      yaw: state.yaw, pitch: state.pitch, zoom: state.zoom,
      showCube: state.showCube,
    });
    s.explored = Boolean(state.explored);
    return s;
  }

  /** Switch between the regular and the skewed tetrahedron. */
  function preset(state, shape) {
    const s = start({
      shape: shape,
      yaw: state.yaw, pitch: state.pitch, zoom: state.zoom,
      showCube: state.showCube,
    });
    s.explored = true;
    return s;
  }

  /**
   * Orthographic projection, with the same turn and tilt the applet applies.
   * The projection is about the cube's middle (0.5,0.5,0.5), so the tetrahedron
   * spins in place. `depth` grows towards the viewer and is used for painting
   * the faces back to front.
   */
  function project(state, p) {
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    const ct = Math.cos(state.pitch), st = Math.sin(state.pitch);
    const x0 = p.x - 0.5, y0 = p.y - 0.5, z0 = p.z - 0.5;
    const x1 = x0 * cy - y0 * sy;
    const y1 = x0 * sy + y0 * cy;
    const y2 = y1 * ct - z0 * st;
    const depth = y1 * st + z0 * ct;
    const s = SCALE * state.zoom;
    return { x: CX + s * x1, y: CY - s * y2, depth: depth };
  }

  /** Inverse of project(): move a corner in the plane through it facing us. */
  function unproject(state, screen, depth) {
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    const ct = Math.cos(state.pitch), st = Math.sin(state.pitch);
    const s = SCALE * state.zoom;
    const x1 = (screen.x - CX) / s;
    const y2 = -(screen.y - CY) / s;
    const y1 = y2 * ct + depth * st;
    const z0 = -y2 * st + depth * ct;
    const x0 = x1 * cy + y1 * sy;
    const y0 = -x1 * sy + y1 * cy;
    return V(x0 + 0.5, y0 + 0.5, z0 + 0.5);
  }

  /** The screen point a handle for corner `name` should sit at. */
  function handlePoint(state, name) {
    const i = NAMES.indexOf(name);
    return i < 0 ? null : project(state, state.vertices[i]);
  }

  function moveVertex(state, name, p) {
    const i = NAMES.indexOf(name);
    if (i < 0 || !finite(p)) return state;
    const vertices = state.vertices.map(copy);
    vertices[i] = copy(p);
    return Object.assign({}, state, { vertices: vertices, shape: "custom", explored: true });
  }

  function setCube(state, on) {
    return Object.assign({}, state, { showCube: Boolean(on), explored: true });
  }

  function rotate(state, dYaw, dPitch) {
    return Object.assign({}, state, {
      yaw: state.yaw + (Number.isFinite(dYaw) ? dYaw : 0),
      pitch: clamp(state.pitch + (Number.isFinite(dPitch) ? dPitch : 0), -PITCH_LIMIT, PITCH_LIMIT),
      explored: true,
    });
  }

  function zoomBy(state, factor) {
    const f = Number.isFinite(factor) ? factor : 1;
    return Object.assign({}, state, { zoom: clamp(state.zoom * f, ZOOM_MIN, ZOOM_MAX), explored: true });
  }

  function angleBetween(u, v) {
    const nu = length(u), nv = length(v);
    if (nu < EPS || nv < EPS) return NaN;
    return Math.acos(clamp(dot(u, v) / (nu * nv), -1, 1)) * 180 / Math.PI;
  }

  /** A box through the extreme coordinates of the four corners. */
  function box(v) {
    const lo = V(Math.min(v[0].x, v[1].x, v[2].x, v[3].x),
      Math.min(v[0].y, v[1].y, v[2].y, v[3].y),
      Math.min(v[0].z, v[1].z, v[2].z, v[3].z));
    const hi = V(Math.max(v[0].x, v[1].x, v[2].x, v[3].x),
      Math.max(v[0].y, v[1].y, v[2].y, v[3].y),
      Math.max(v[0].z, v[1].z, v[2].z, v[3].z));
    const corners = [];
    for (let ix = 0; ix < 2; ix++) {
      for (let iy = 0; iy < 2; iy++) {
        for (let iz = 0; iz < 2; iz++) {
          corners.push(V(ix ? hi.x : lo.x, iy ? hi.y : lo.y, iz ? hi.z : lo.z));
        }
      }
    }
    return { lo: lo, hi: hi, corners: corners };
  }

  /**
   * Everything the picture needs: the four corners, the six edges, the three
   * bimedians with their screen ends, the barycenter, and the truth of each
   * claim the article makes. Returns null for a broken position.
   */
  function geometry(state) {
    const v = state && state.vertices;
    if (!Array.isArray(v) || v.length !== 4 || !v.every(finite)) return null;
    if (EDGES.some((e) => dist(v[e.a], v[e.b]) < EPS)) return null; // a real tetrahedron
    const tol = EPS * Math.max(1, ...EDGES.map((e) => dist(v[e.a], v[e.b])));
    const bary = V((v[0].x + v[1].x + v[2].x + v[3].x) / 4,
      (v[0].y + v[1].y + v[2].y + v[3].y) / 4,
      (v[0].z + v[1].z + v[2].z + v[3].z) / 4);

    const edges = EDGES.map((e) => ({
      name: e.name, a: copy(v[e.a]), b: copy(v[e.b]),
      mid: midpoint(v[e.a], v[e.b]),
      dir: sub(v[e.b], v[e.a]),
      length: dist(v[e.a], v[e.b]),
      screenA: project(state, v[e.a]), screenB: project(state, v[e.b]),
    }));

    const bimedians = PAIRS.map((pair, i) => {
      const first = edges[pair[0]], second = edges[pair[1]];
      const dir = sub(second.mid, first.mid);
      return {
        name: "m" + (i + 1), pair: [first.name, second.name],
        a: copy(first.mid), b: copy(second.mid),
        mid: midpoint(first.mid, second.mid),
        dir: dir, length: length(dir),
        screenA: project(state, first.mid), screenB: project(state, second.mid),
      };
    });

    const angles = [
      angleBetween(bimedians[0].dir, bimedians[1].dir),
      angleBetween(bimedians[0].dir, bimedians[2].dir),
      angleBetween(bimedians[1].dir, bimedians[2].dir),
    ];
    const squareDot = (u, w) => Math.abs(dot(u, w)) <= tol * length(u) * length(w);
    const orthAt = (m, e) => squareDot(m.dir, e.dir);
    const perpToEdges = bimedians.every((m, i) =>
      orthAt(m, edges[PAIRS[i][0]]) && orthAt(m, edges[PAIRS[i][1]]));
    const orthogonal = angles.every((a) => Number.isFinite(a) && Math.abs(a - 90) <= 1e-7);

    /* The box's six face centres, in CUBE_FACES order. */
    const bx = box(v);
    const faces = CUBE_FACES.map((ids, k) => {
      const pts = ids.map((id) => bx.corners[id]);
      const at = midpoint(pts[0], pts[2]); // opposite corners of the quad
      const axis = k >> 1;
      const side = k & 1;
      const axisName = ["x", "y", "z"][axis];
      at[axisName] = side ? bx.hi[axisName] : bx.lo[axisName];
      return { axis: axis, side: side, at: at, indices: ids };
    });
    /* The page's cube picture: each bimedian ends at the centre of a face,
     * and the two faces are opposite ones (same axis, opposite sides). */
    const faceAt = (p) => faces.findIndex((f) => dist(p, f.at) <= tol);
    const cubeEmbedding = bimedians.every((m) => {
      const i = faceAt(m.a), j = faceAt(m.b);
      return i >= 0 && j >= 0 &&
        faces[i].axis === faces[j].axis && faces[i].side !== faces[j].side;
    });
    /* A segment between opposite face centres runs along a cube edge. */
    const cubeParallel = bimedians.every((m) => length(m.dir) > tol &&
      [0, 1, 2].some((axis) => {
        const unit = [0, 0, 0];
        unit[axis] = 1;
        return squareDot(m.dir, V(unit[0], unit[1], unit[2]));
      }));

    const concurrencyError = Math.max(...bimedians.map((m) => dist(m.mid, bary)));
    const bisected = bimedians.every((m) => dist(m.mid, bary) <= tol &&
      Math.abs(dist(m.a, bary) - dist(m.b, bary)) <= tol);
    const regular = edges.every((e) => Math.abs(e.length - edges[0].length) <= tol);
    const scale = Math.max(1, ...edges.map((e) => e.length));
    const tolDeg = 1e-7;

    const cubeEdges = [];
    for (let bit = 0; bit < 3; bit++) {
      for (let mask = 0; mask < 8; mask++) {
        if (mask & (1 << bit)) continue;
        cubeEdges.push([mask, mask | (1 << bit)]);
      }
    }
    const screen = (pts) => pts.map((p) => project(state, p));
    const faceDraw = (pts) => {
      const q = screen(pts);
      return { points: q, depth: q.reduce((sum, p) => sum + p.depth, 0) / q.length };
    };
    const cubeFaces = CUBE_FACES.map((ids) =>
      faceDraw(ids.map((id) => bx.corners[id])));
    const tetraFaces = [
      [0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3],
    ].map((ids) => faceDraw(ids.map((i) => v[i])));

    const claims = {
      threeOppositePairs: PAIRS.length === 3 &&
        new Set(PAIRS.reduce((all, p) => all.concat(p), [])).size === 6,
      concurrent: concurrencyError <= tol,
      bisected: bisected,
      barycenter: dist(bary, V((v[0].x + v[1].x + v[2].x + v[3].x) / 4,
        (v[0].y + v[1].y + v[2].y + v[3].y) / 4,
        (v[0].z + v[1].z + v[2].z + v[3].z) / 4)) <= EPS,
      regular: regular,
      orthogonal: orthogonal,
      perpendicularToEdges: perpToEdges,
      cubeEmbedding: cubeEmbedding,
      cubeParallel: cubeParallel,
      anglesRight: angles.every((a) => Math.abs(a - 90) <= tolDeg),
    };

    return {
      vertices: v.map(copy), barycenter: bary,
      edges: edges, bimedians: bimedians, angles: angles,
      box: bx, cubeFaces: cubeFaces, cubeEdges: cubeEdges, tetraFaces: tetraFaces,
      claims: claims,
      measures: {
        concurrencyError: concurrencyError,
        regularSpread: Math.max(...edges.map((e) => e.length)) - Math.min(...edges.map((e) => e.length)),
        scale: scale, tolerance: tol,
      },
    };
  }

  /** The line under the picture, in plain words. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move the four corners so the tetrahedron has four different points.";
    const a = g.angles.map((x) => Math.round(x));
    let text;
    if (g.claims.orthogonal) {
      text = `The three bimedians meet at one dot, at right angles: ${a.join(", ")} degrees.`;
    } else {
      text = `The three bimedians still meet at one dot, but their angles are ${a.join(", ")} degrees, not all 90.`;
    }
    if (g.claims.perpendicularToEdges) text += " Each is square to the two edges it joins.";
    if (state.showCube && g.claims.cubeEmbedding) {
      text += " Each one joins the middles of two opposite cube faces.";
    }
    return text;
  }

  /** An illustration has no winner, no loser and no finishing move. */
  function result(/* state */) {
    return null;
  }

  return {
    E, TILT, TURN, VIEW, SCALE, ZOOM_MIN, ZOOM_MAX, NAMES, EDGES, PAIRS,
    CUBE_FACES, V, add, sub, mul, dot, length, dist, midpoint, copy, finite,
    options, start, reset, preset, regularCorners, skewedCorners,
    project, unproject, handlePoint, moveVertex, setCube, rotate, zoomBy,
    angleBetween, box, geometry, describe, result,
  };
})();
