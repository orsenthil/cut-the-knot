"use strict";

/*
 * Central Angles In Cube — Alexander Bogomolny's applet CentralAnglesInCube,
 * with the discussion on the page by Scott E. Brodie
 * (cut-the-knot.org, "Angles in a Cube III").
 *
 * The question is angle AOC at the centre O of a cube. Two answers occur.
 * Between the ends of a face diagonal the cosine is -1/3, so the angle is
 * t = arccos(-1/3) ≈ 109.47122° (obtuse). Between the ends of a cube edge the
 * cosine is +1/3, so the angle is s = arccos(1/3) ≈ 70.52878° (acute), and
 * s + t = 180°. Four alternate corners form a regular tetrahedron whose six
 * central angles are all t.
 *
 * Reset() in the applet's bytecode makes a transparent cube and four points:
 *   P0 = (0.5, 0.5, 0.5)  (the centre O), P1 = (0, 0, 0),
 *   P2 = (1, 1, 0),       P3 = (1, 1, 1).
 * It makes five CTKLineSegments, in order P0P1, P0P2, P0P2 again, P1P2 and
 * P0P3. The duplicated P0P2 is harmless. The "obtuse" checkbox group holds
 * segments 0, 1, 3 (the triangle O P1 P2); the "acute" group holds 2, 4 (the
 * two rays O P2 and O P3). Both groups start hidden. The view is turned by
 * rotZ(-pi/6) followed by rotX(pi/8). Points and segments here are copied in
 * that order, recentred on O and scaled by the cube's side.
 *
 * This file holds the geometry and the orthographic projection, and nothing
 * else: no document, no window, no storage. It defines one global,
 * CentralAnglesInCubeCore, so the page loads it with a plain <script> and
 * porting/check-central-angles-in-cube.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const CentralAnglesInCubeCore = (() => {
  const TILT = 0.39269908169872414;      // applet rotX(pi/8)
  const TURN = -0.5235987755982988;      // applet rotZ(-pi/6)
  const VIEW = { x: 0, y: 0, width: 460, height: 380 };
  const CX = VIEW.width / 2, CY = VIEW.height / 2;
  const SCALE = 150;                     // viewBox units per world unit at zoom 1
  const ZOOM_MIN = 0.6, ZOOM_MAX = 1.8;
  const SIDE_MIN = 0.25, SIDE_MAX = 4;
  const PITCH_LIMIT = Math.PI / 2 - 0.05;
  const EPS = 1e-9;
  const OBTUSE_DEG = Math.acos(-1 / 3) * 180 / Math.PI;
  const ACUTE_DEG = Math.acos(1 / 3) * 180 / Math.PI;
  const MODES = ["none", "obtuse", "acute", "both"];
  const GROUP = {
    obtuse: [0, 1, 3],                   // applet branchSegments[0]
    acute: [2, 4],                       // applet branchSegments[1]
  };

  const V = (x, y, z) => ({ x: x, y: y, z: z });
  const O = () => V(0, 0, 0);
  const copy = (p) => V(p.x, p.y, p.z);
  const add = (p, q) => V(p.x + q.x, p.y + q.y, p.z + q.z);
  const sub = (p, q) => V(p.x - q.x, p.y - q.y, p.z - q.z);
  const mul = (p, k) => V(p.x * k, p.y * k, p.z * k);
  const dot = (p, q) => p.x * q.x + p.y * q.y + p.z * q.z;
  const length = (p) => Math.sqrt(dot(p, p));
  const dist = (p, q) => length(sub(p, q));
  const midpoint = (p, q) => V((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);

  /* A, B, C, D on the top face; A', B', C', D' directly below them. The page
   * uses a cube of side 2 centred at the origin; these are the same corners
   * for a cube of side 1, which is the applet's size. */
  const VERTICES = [
    V(0.5, 0.5, 0.5), V(-0.5, 0.5, 0.5), V(-0.5, -0.5, 0.5), V(0.5, -0.5, 0.5),
    V(0.5, 0.5, -0.5), V(-0.5, 0.5, -0.5), V(-0.5, -0.5, -0.5), V(0.5, -0.5, -0.5),
  ];
  const NAMES = ["A", "B", "C", "D", "A'", "B'", "C'", "D'"];
  const TETRA = [0, 2, 5, 7];            // A, C, B', D' on the page
  const CUBE_FACES = [
    [0, 1, 3, 2], [4, 5, 7, 6],          // top, bottom
    [0, 1, 5, 4], [2, 3, 7, 6],          // front, back
    [0, 2, 6, 4], [1, 3, 7, 5],          // left, right
  ];
  const APPLET_INDEX = { O: 0, P: 1, Q: 2, R: 3 };
  const HANDLES = ["P", "Q", "R"];

  /** The four Reset() points, recentred on the cube's middle and scaled. */
  function appletPoints(side) {
    const s = Number.isFinite(side) ? clamp(side, SIDE_MIN, SIDE_MAX) : 1;
    const centre = V(0.5, 0.5, 0.5);
    const from = [V(0.5, 0.5, 0.5), V(0, 0, 0), V(1, 1, 0), V(1, 1, 1)];
    return from.map((p) => mul(sub(p, centre), s));
  }

  /** Reset()'s five CTKLineSegments and the two checkbox groups, in order. */
  function appletSegments(side) {
    const p = appletPoints(side);
    const ends = [[0, 1], [0, 2], [0, 2], [1, 2], [0, 3]];
    return {
      segments: ends.map((pair, i) => ({ name: "S" + i, a: copy(p[pair[0]]), b: copy(p[pair[1]]) })),
      groups: { obtuse: GROUP.obtuse.slice(), acute: GROUP.acute.slice() },
      points: { O: copy(p[0]), P: copy(p[1]), Q: copy(p[2]), R: copy(p[3]) },
    };
  }

  /** Copy simple options, clamping the controls the applet's mouse behaves use. */
  function options(o) {
    const src = o || {};
    const side = Number.isFinite(src.side) ? clamp(src.side, SIDE_MIN, SIDE_MAX) : 1;
    const yaw = Number.isFinite(src.yaw) ? src.yaw : TURN;
    const pitch = Number.isFinite(src.pitch)
      ? clamp(src.pitch, -PITCH_LIMIT, PITCH_LIMIT) : TILT;
    const zoom = Number.isFinite(src.zoom) ? clamp(src.zoom, ZOOM_MIN, ZOOM_MAX) : 1;
    const mode = MODES.indexOf(src.mode) >= 0 ? src.mode : "none";
    return {
      side: side, yaw: yaw, pitch: pitch, zoom: zoom, mode: mode,
      snap: src.snap !== false,
      showTetra: Boolean(src.showTetra),
    };
  }

  /** The opening position: the applet's points, its view, no rays drawn yet. */
  function start(o) {
    const opts = options(o);
    const seeded = o && o.points && HANDLES.every((n) => finite(o.points[n]));
    const points = seeded
      ? { P: copy(o.points.P), Q: copy(o.points.Q), R: copy(o.points.R) }
      : (() => {
        const p = appletPoints(opts.side);
        return { P: copy(p[1]), Q: copy(p[2]), R: copy(p[3]) };
      })();
    return {
      side: opts.side, points: points,
      yaw: opts.yaw, pitch: opts.pitch, zoom: opts.zoom,
      mode: opts.mode, snap: opts.snap,
      showTetra: opts.showTetra,
      explored: false,
    };
  }

  /** Reset restores the applet's points and empties both ray groups. */
  function reset(state) {
    const s = start({
      side: state.side, yaw: state.yaw, pitch: state.pitch, zoom: state.zoom,
      snap: state.snap, showTetra: state.showTetra,
    });
    s.explored = Boolean(state.explored);
    return s;
  }

  /** The four checkboxes of the applet: none, obtuse, acute or both. */
  function setMode(state, mode) {
    if (MODES.indexOf(mode) < 0) return state;
    return Object.assign({}, state, { mode: mode, explored: true });
  }

  function setSnap(state, on) {
    return Object.assign({}, state, { snap: Boolean(on), explored: true });
  }

  function setTetra(state, on) {
    return Object.assign({}, state, { showTetra: Boolean(on), explored: true });
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
    return Object.assign({}, state, {
      zoom: clamp(state.zoom * f, ZOOM_MIN, ZOOM_MAX), explored: true,
    });
  }

  /**
   * Orthographic projection, with the applet's turn and tilt. `depth` grows
   * towards the viewer; the picture layer uses it to paint far faces first.
   */
  function project(state, p) {
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    const ct = Math.cos(state.pitch), st = Math.sin(state.pitch);
    const x1 = p.x * cy - p.y * sy;
    const y1 = p.x * sy + p.y * cy;
    const y2 = y1 * ct - p.z * st;
    const depth = y1 * st + p.z * ct;
    const s = SCALE * state.zoom;
    return { x: CX + s * x1, y: CY - s * y2, depth: depth };
  }

  /** Inverse of project(): move a point in the plane through it facing us. */
  function unproject(state, screen, depth) {
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    const ct = Math.cos(state.pitch), st = Math.sin(state.pitch);
    const s = SCALE * state.zoom;
    const x1 = (screen.x - CX) / s;
    const y2 = -(screen.y - CY) / s;
    const y1 = y2 * ct + depth * st;
    const z = -y2 * st + depth * ct;
    return V(x1 * cy + y1 * sy, -x1 * sy + y1 * cy, z);
  }

  function handlePoint(state, name) {
    return finite(state.points[name]) ? project(state, state.points[name]) : null;
  }

  /** Index of the cube corner at p, or -1; snap with the applet's float data. */
  function vertexOf(state, p) {
    if (!finite(p)) return -1;
    const tol = EPS * Math.max(1, Math.abs(state.side));
    for (let i = 0; i < VERTICES.length; i++) {
      if (dist(p, mul(VERTICES[i], state.side)) <= tol) return i;
    }
    return -1;
  }

  /** How many coordinates differ between two cube corners (0, 1, 2 or 3). */
  function hamming(state, i, j) {
    if (i < 0 || j < 0) return -1;
    const a = mul(VERTICES[i], state.side), b = mul(VERTICES[j], state.side);
    const tol = EPS * Math.max(1, Math.abs(state.side));
    return (Math.abs(a.x - b.x) > tol ? 1 : 0) +
      (Math.abs(a.y - b.y) > tol ? 1 : 0) +
      (Math.abs(a.z - b.z) > tol ? 1 : 0);
  }

  /** Drag one of P, Q, R; with snapping on it lands on the nearest corner. */
  function movePoint(state, name, p) {
    if (HANDLES.indexOf(name) < 0 || !finite(p)) return state;
    let at = copy(p);
    if (state.snap) {
      let best = -1, bestD = Infinity;
      for (let i = 0; i < VERTICES.length; i++) {
        const d = dist(p, mul(VERTICES[i], state.side));
        if (d < bestD) { bestD = d; best = i; }
      }
      at = mul(VERTICES[best], state.side);
    }
    const points = Object.assign({}, state.points);
    points[name] = at;
    return Object.assign({}, state, { points: points, explored: true });
  }

  function cosBetween(u, v) {
    const nu = length(u), nv = length(v);
    if (nu < EPS || nv < EPS) return NaN;
    return clamp(dot(u, v) / (nu * nv), -1, 1);
  }

  function angleBetween(u, v) {
    const c = cosBetween(u, v);
    return Number.isFinite(c) ? Math.acos(c) * 180 / Math.PI : NaN;
  }

  function pairName(state, p, q) {
    const i = vertexOf(state, p), j = vertexOf(state, q);
    if (i < 0 || j < 0) return "a free point";
    const h = hamming(state, i, j);
    return [
      "the same corner",
      "a cube edge — the acute central angle",
      "a face diagonal — the obtuse central angle",
      "a body diagonal — a straight angle",
    ][h];
  }

  /**
   * Everything the picture needs: the cube, the inscribed tetrahedron's
   * corners, the five applet segments, the two central angles, and the truth
   * of each claim the article makes. Returns null for a broken position.
   */
  function geometry(state) {
    const pts = state && state.points;
    if (!state || !pts || !HANDLES.every((n) => finite(pts[n]))) return null;
    if (!Number.isFinite(state.side) || state.side <= 0) return null;
    const s = state.side;
    const centre = O();
    const P = copy(pts.P), Q = copy(pts.Q), R = copy(pts.R);
    const degenerate = length(P) < EPS || length(Q) < EPS || length(R) < EPS;

    const segments = [
      { name: "S0", a: O(), b: copy(P) },
      { name: "S1", a: O(), b: copy(Q) },
      { name: "S2", a: O(), b: copy(Q) },
      { name: "S3", a: copy(P), b: copy(Q) },
      { name: "S4", a: O(), b: copy(R) },
    ];

    const obtuseCos = cosBetween(P, Q), acuteCos = cosBetween(Q, R);
    const obtuseDeg = angleBetween(P, Q), acuteDeg = angleBetween(Q, R);
    const iP = vertexOf(state, P), iQ = vertexOf(state, Q), iR = vertexOf(state, R);
    const hPQ = hamming(state, iP, iQ), hQR = hamming(state, iQ, iR);
    const hPR = hamming(state, iP, iR);

    const tol = EPS * Math.max(1, s);
    const angleTol = 1e-7;
    const nearCos = (c, want) => Number.isFinite(c) && Math.abs(c - want) <= angleTol;

    /* The page's A, C, B', D' tetrahedron, for any cube size. */
    const corners = mul(VERTICES[0], s);
    const tetra = TETRA.map((i) => mul(VERTICES[i], s));
    const tetraAngles = [];
    for (let i = 0; i < tetra.length; i++) {
      for (let j = i + 1; j < tetra.length; j++) {
        tetraAngles.push(angleBetween(tetra[i], tetra[j]));
      }
    }
    const tetraRegular = tetraAngles.every((a) => Number.isFinite(a) &&
      Math.abs(a - OBTUSE_DEG) <= angleTol);

    /* Triangle A C C' from the page: legs s*sqrt(2) and s, hypotenuse
     * s*sqrt(3); O is the midpoint of AC' and CO is the median. */
    const A = mul(VERTICES[0], s), C = mul(VERTICES[2], s), Cp = mul(VERTICES[6], s);
    const tri = {
      AC: dist(A, C), CCp: dist(C, Cp), ACp: dist(A, Cp),
      rightAtC: Math.abs(dot(sub(A, C), sub(Cp, C))) <= tol * s,
      midpointIsO: dist(midpoint(A, Cp), centre) <= tol,
      median: dist(C, centre),
    };

    const claims = {
      segmentsMatchApplet: segments.length === 5 &&
        GROUP.obtuse.length === 3 && GROUP.acute.length === 2 &&
        segments[1].b.x === segments[2].b.x && segments[1].b.y === segments[2].b.y &&
        segments[1].b.z === segments[2].b.z,
      obtuseFaceDiagonal: hPQ === 2 && nearCos(obtuseCos, -1 / 3),
      acuteEdge: hQR === 1 && nearCos(acuteCos, 1 / 3),
      supplementary: Number.isFinite(obtuseDeg) && Number.isFinite(acuteDeg) &&
        Math.abs(obtuseDeg + acuteDeg - 180) <= angleTol,
      oppositeEnds: hPR === 3,
      collinearThroughO: hPR === 3 &&
        dist(midpoint(P, R), centre) <= tol && Math.abs(dist(P, R) - s * Math.sqrt(3)) <= tol,
      tetrahedron: tetraRegular,
      rightTriangle: Math.abs(tri.AC - s * Math.SQRT2) <= tol &&
        Math.abs(tri.CCp - s) <= tol &&
        Math.abs(tri.ACp - s * Math.sqrt(3)) <= tol &&
        Math.abs(tri.median - s * Math.sqrt(3) / 2) <= tol &&
        tri.rightAtC && tri.midpointIsO,
      degenerate: degenerate,
    };

    const screen = (ptsToMap) => ptsToMap.map((p) => project(state, p));
    const faceDraw = (ids) => {
      const q = screen(ids.map((i) => mul(VERTICES[i], s)));
      return { points: q, depth: q.reduce((sum, p) => sum + p.depth, 0) / q.length };
    };
    const cubeFaces = CUBE_FACES.map(faceDraw);
    const tetraEdges = [];
    for (let bit = 0; bit < 3; bit++) {
      for (let mask = 0; mask < 8; mask++) {
        if ((mask & (1 << bit)) !== 0) continue;
        const e = [mask, mask | (1 << bit)];
        const q = screen(e.map((i) => mul(VERTICES[i], s)));
        tetraEdges.push({ indices: e, ends: q, depth: (q[0].depth + q[1].depth) / 2 });
      }
    }
    const vertexLabels = VERTICES.map((v, i) => ({
      name: NAMES[i], at: project(state, mul(v, s)), depth: project(state, mul(v, s)).depth,
    }));

    return {
      centre: centre, vertices: VERTICES.map((v) => mul(v, s)),
      P: P, Q: Q, R: R, tetra: tetra,
      segments: segments, groups: { obtuse: GROUP.obtuse.slice(), acute: GROUP.acute.slice() },
      obtuseCos: obtuseCos, acuteCos: acuteCos,
      obtuseDeg: obtuseDeg, acuteDeg: acuteDeg,
      vertexNames: { P: iP >= 0 ? NAMES[iP] : null, Q: iQ >= 0 ? NAMES[iQ] : null, R: iR >= 0 ? NAMES[iR] : null },
      hamming: { PQ: hPQ, QR: hQR, PR: hPR },
      pairKinds: { obtuse: pairName(state, P, Q), acute: pairName(state, Q, R) },
      tetrahedron: { corners: tetra, angles: tetraAngles },
      triangle: tri, claims: claims,
      cubeFaces: cubeFaces, cubeEdges: tetraEdges, vertexLabels: vertexLabels,
      screen: {
        O: project(state, centre), P: project(state, P),
        Q: project(state, Q), R: project(state, R),
      },
      measures: { side: s, tolerance: tol, obtuseExpected: OBTUSE_DEG, acuteExpected: ACUTE_DEG },
    };
  }

  const fixed = (x) => (Number.isFinite(x) ? x.toFixed(2) : "?");

  /** The line under the picture, in plain words. */
  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move the three points so they stay in the picture.";
    if (g.claims.degenerate) return "Move a point away from the middle dot to make an angle.";
    const mode = state.mode;
    const parts = [];
    if (mode === "obtuse" || mode === "both") {
      parts.push(`Angle P O Q is ${fixed(g.obtuseDeg)}° (cos ${fixed(g.obtuseCos)}), ${g.pairKinds.obtuse}.`);
    }
    if (mode === "acute" || mode === "both") {
      parts.push(`Angle Q O R is ${fixed(g.acuteDeg)}° (cos ${fixed(g.acuteCos)}), ${g.pairKinds.acute}.`);
    }
    if (mode === "both" && g.claims.supplementary) parts.push("Together they make 180°.");
    if (mode === "none") parts.push("Press Obtuse or Acute to draw the rays from O.");
    if (g.claims.tetrahedron && state.showTetra) {
      parts.push("The four tetrahedron corners are all the same distance apart through O.");
    }
    return parts.join(" ");
  }

  /** An illustration has no winner, no loser and no finishing move. */
  function result(/* state */) {
    return null;
  }

  return {
    TILT, TURN, VIEW, SCALE, ZOOM_MIN, ZOOM_MAX, SIDE_MIN, SIDE_MAX,
    NAMES, VERTICES, TETRA, HANDLES, GROUP,
    OBTUSE_DEG, ACUTE_DEG, V, O, add, sub, mul, dot, length, dist, midpoint,
    copy, finite, clamp, appletPoints, appletSegments, options, start, reset,
    setMode, setSnap, setTetra, rotate, zoomBy, project, unproject, handlePoint,
    vertexOf, hamming, movePoint, cosBetween, angleBetween, geometry, describe, result,
  };
})();
