/*
 * run_game_logic actions and saved-position reader for Bimedians In Tetrahedron.
 * The real core, bimedians-in-tetrahedron/bimedians-in-tetrahedron-core.js, is
 * copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 *
 * The six edges of a tetrahedron split into three pairs of opposite (non
 * touching) edges: AB-CD, AC-BD and AD-BC. A bimedian joins the midpoints of
 * one such pair. Equal weights at the four corners balance at
 * G = (A + B + C + D)/4, and G is the midpoint of all three bimedians, so they
 * always meet there. Measured from G, the bimedian directions are a+b, a+c and
 * a+d (with a+b+c+d = 0); they are pairwise perpendicular exactly when the
 * four corners are equally far from G, which is what makes a regular
 * tetrahedron's bimedians meet at right angles. A regular tetrahedron sits at
 * alternate corners of a cube, where the three bimedians join the centres of
 * opposite faces and follow the cube's three edge directions.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bimedians-in-tetrahedron"].BimediansInTetrahedronCore;
type Core = ReturnType<typeof core>;
type Vec = { x: number; y: number; z: number };
type State = ReturnType<Core["start"]>;
type Geometry = NonNullable<ReturnType<Core["geometry"]>>;

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const vec = (p: Vec | null | undefined): { x: number; y: number; z: number } | null =>
  p ? { x: round(p.x), y: round(p.y), z: round(p.z) } : null;

/** A point may be written [x, y, z] or {x, y, z}; nothing else is accepted. */
function readVec(raw: unknown, label: string): Vec {
  if (Array.isArray(raw)) {
    if (raw.length !== 3) throw new Error(`argument "${label}" must be [x, y, z] or {x, y, z}`);
    const x = Number(raw[0]), y = Number(raw[1]), z = Number(raw[2]);
    if (![x, y, z].every(Number.isFinite)) throw new Error(`argument "${label}" has a non-finite coordinate`);
    return { x, y, z };
  }
  if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    return { x: num(o, "x"), y: num(o, "y"), z: num(o, "z") };
  }
  throw new Error(`argument "${label}" must be [x, y, z] or {x, y, z}, got ${JSON.stringify(raw)}`);
}

/** Accept a "vertices" array or A/B/C/D; fall back to the page's two presets. */
function readVertices(C: Core, args: Json): Vec[] {
  const raw = args.vertices !== undefined && args.vertices !== null
    ? args.vertices
    : [args.A, args.B, args.C, args.D];
  if (Array.isArray(raw) && raw.every((v) => v === undefined || v === null)) {
    const shape = args.shape === undefined || args.shape === null ? "regular" : String(args.shape);
    if (shape === "regular") return C.regularCorners();
    if (shape === "skew") return C.skewedCorners();
    throw new Error(`shape must be "regular" or "skew", got ${JSON.stringify(args.shape)}`);
  }
  if (!Array.isArray(raw) || raw.length !== 4) {
    throw new Error('argument "vertices" must be an array of four [x, y, z] points (or give A, B, C and D)');
  }
  return raw.map((v, i) => readVec(v, Array.isArray(args.vertices) ? `vertices[${i}]` : "ABCD"[i]));
}

/** A view option is passed through only when present and finite. */
function viewOption(args: Json, key: string): number | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`argument "${key}" must be a finite number`);
  return n;
}

function makeState(C: Core, args: Json): State {
  return C.start({
    vertices: readVertices(C, args),
    yaw: viewOption(args, "yaw"),
    pitch: viewOption(args, "pitch"),
    zoom: viewOption(args, "zoom"),
    showCube: args.showCube === true,
  });
}

function makeGeometry(C: Core, args: Json): { s: State; g: Geometry } {
  const s = makeState(C, args);
  const g = C.geometry(s);
  if (!g) {
    throw new Error("those four corners do not make a tetrahedron: two of them coincide. Move a corner and try again.");
  }
  return { s, g };
}

/** Everything the picture draws, in the core's world coordinates. */
function reading(C: Core, s: State, g: Geometry) {
  return {
    corners: g.vertices.map((v, i) => ({ name: C.NAMES[i], at: vec(v) })),
    edges: g.edges.map((e) => ({ name: e.name, midpoint: vec(e.mid), length: round(e.length) })),
    bimedians: g.bimedians.map((m, i) => ({
      name: m.name, pair: m.pair, from: vec(m.a), to: vec(m.b),
      midpoint: vec(m.mid), direction: vec(m.dir), length: round(m.length),
      angleToNext: i < 2 ? round(g.angles[i]) : null,
    })),
    barycenter: vec(g.barycenter),
    anglesBetweenBimedians: {
      m1_m2: round(g.angles[0]), m1_m3: round(g.angles[1]), m2_m3: round(g.angles[2]),
    },
    claims: { ...g.claims },
    measures: {
      concurrencyError: round(g.measures.concurrencyError),
      regularSpread: round(g.measures.regularSpread),
      tolerance: g.measures.tolerance,
    },
    view: {
      yaw: round(s.yaw), pitch: round(s.pitch), zoom: s.zoom, showCube: s.showCube,
    },
    note: C.describe(s),
  };
}

/** Label the six face centres of the box through the four corners. */
function faceCentres(C: Core, g: Geometry) {
  return C.CUBE_FACES.map((ids, k) => {
    const pts = ids.map((id) => g.box.corners[id]);
    const at = C.midpoint(pts[0], pts[2]);
    const axis = k >> 1, side = k & 1;
    if (axis === 0) at.x = side ? g.box.hi.x : g.box.lo.x;
    else if (axis === 1) at.y = side ? g.box.hi.y : g.box.lo.y;
    else at.z = side ? g.box.hi.z : g.box.lo.z;
    const name = ["x", "y", "z"][axis];
    return {
      label: `${name}=${side ? "max" : "min"}`,
      axis, side, raw: at, centre: vec(at),
    };
  });
}

/** The single axis a segment follows, if it is parallel to a box edge. */
function parallelAxis(C: Core, dir: Vec, tol: number): string | null {
  const len = C.length(dir);
  if (!(len > tol)) return null;
  if (Math.abs(dir.y) <= tol * len && Math.abs(dir.z) <= tol * len) return "x";
  if (Math.abs(dir.x) <= tol * len && Math.abs(dir.z) <= tol * len) return "y";
  if (Math.abs(dir.x) <= tol * len && Math.abs(dir.y) <= tol * len) return "z";
  return null;
}

/** The orthogonality condition and the cube-face-centre property, measured. */
function conditions(C: Core, s: State, g: Geometry) {
  const tol = g.measures.tolerance;
  const distances = g.vertices.map((v) => C.dist(v, g.barycenter));
  const spread = Math.max(...distances) - Math.min(...distances);
  const equidistant = spread <= tol;
  const faces = faceCentres(C, g);
  const faceAt = (p: Vec): string | null => {
    const hit = faces.find((f) => C.dist(p, f.raw) <= tol);
    return hit ? hit.label : null;
  };
  const bimedians = g.bimedians.map((m) => {
    const a = faceAt(m.a), b = faceAt(m.b);
    const fa = faces.find((f) => f.label === a), fb = faces.find((f) => f.label === b);
    return {
      pair: m.pair,
      faceCentres: [a, b],
      oppositeFaces: Boolean(fa && fb && fa.axis === fb.axis && fa.side !== fb.side),
      parallelToBoxAxis: parallelAxis(C, m.dir, tol),
    };
  });
  const orthogonal = g.claims.orthogonal;
  return {
    corners: g.vertices.map((v, i) => ({ name: C.NAMES[i], at: vec(v) })),
    barycenter: vec(g.barycenter),
    cornerDistancesFromG: distances.map(round),
    distanceSpread: round(spread),
    equidistantFromG: equidistant,
    anglesBetweenBimedians: g.angles.map(round),
    rightAngles: orthogonal,
    squareToJoinedEdges: g.claims.perpendicularToEdges,
    conditionsAgree: equidistant === orthogonal && orthogonal === g.claims.perpendicularToEdges,
    cube: {
      box: { lo: vec(g.box.lo), hi: vec(g.box.hi) },
      faceCentres: faces.map(({ label, axis, side, centre }) => ({ label, axis, side, centre })),
      bimedians,
      everyBimedianJoinsOppositeFaces: g.claims.cubeEmbedding,
      everyBimedianFollowsABoxAxis: g.claims.cubeParallel,
      shownOnPage: s.showCube,
    },
    note: equidistant
      ? "All four corners are equally far from G. With a+b+c+d=0 the bimedian directions are a+b, a+c and a+d, and their pairwise dot products vanish, so the three bimedians meet at right angles; each is also square to the two edges it joins."
      : "The four corners are not equally far from G, so the bimedians still meet at G but their angles leave 90°. The concurrency and bisection claims remain true for every tetrahedron.",
  };
}

export function actions(): GameActions {
  return {
    bimedians: {
      describe:
        "For four corners of a tetrahedron, each as [x, y, z] or {x, y, z} in world units, report the six edge midpoints and the three bimedians joining midpoints of opposite edges AB-CD, AC-BD and AD-BC: their endpoints, midpoints, directions, lengths and the angles between them. Also report the common barycentre G = (A+B+C+D)/4, the midpoint of every bimedian, the concurrency error, and the page's claims. Pass shape 'regular' or 'skew' instead of vertices to use the page's presets; the regular corners are (-0.005,-0.005,-0.005), (1.005,1.005,-0.005), (1.005,-0.005,1.005), (-0.005,1.005,1.005). Omit yaw, pitch, zoom and showCube for the starting view.",
      args: '{ "vertices": [[-0.005, -0.005, -0.005], [1.005, 1.005, -0.005], [1.005, -0.005, 1.005], [-0.005, 1.005, 1.005]], "showCube": true }',
      run: (args) => {
        const C = core();
        const { s, g } = makeGeometry(C, args);
        return reading(C, s, g);
      },
    },
    conditions: {
      describe:
        "Test the two facts highlighted on the page for a tetrahedron given by vertices (or shape 'regular'/'skew'): the bimedians are pairwise orthogonal exactly when the four corners are equally far from their barycentre G, equivalently when each bimedian is square to the two edges it joins; and a regular tetrahedron's bimedians join the centres of opposite faces of the box through its corners and run along the box's three edge directions. Reports the four distances from G and their spread, the three angles, the six face centres, which two face centres each bimedian joins and whether they are opposite faces, and whether the conditions agree. The comparison uses the core's tolerance of 1e-9 times the largest edge, so rounding never counts as a failure.",
      args: '{ "shape": "regular", "showCube": true }',
      run: (args) => {
        const C = core();
        const { s, g } = makeGeometry(C, args);
        return conditions(C, s, g);
      },
    },
  };
}

/** The drawing saved by Track.state, re-read with the same core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Bimedians In Tetrahedron state version ${stateVersion}`);
  }
  const C = core();
  const vertices = readVertices(C, state);
  const s = C.start({
    vertices,
    yaw: viewOption(state, "yaw"),
    pitch: viewOption(state, "pitch"),
    zoom: viewOption(state, "zoom"),
    showCube: state.showCube === true,
  });
  const g = C.geometry(s);
  const rawVertices = Array.isArray(state.vertices) ? state.vertices : [];
  const rawBimedians = Array.isArray(state.bimedians) ? state.bimedians : [];
  return {
    stateVersion,
    saved: {
      corners: rawVertices.map((v, i) => ({ name: C.NAMES[i], at: vec(v as Vec) })),
      barycenter: state.barycenter === undefined || state.barycenter === null
        ? null : vec(state.barycenter as Vec),
      bimedians: rawBimedians.map((m, i) => {
        const b = (m && typeof m === "object" ? m : {}) as Json;
        return {
          name: `m${i + 1}`,
          pair: b.pair ?? null,
          from: b.a === undefined || b.a === null ? null : vec(b.a as Vec),
          to: b.b === undefined || b.b === null ? null : vec(b.b as Vec),
        };
      }),
      angles: state.angles ?? null,
      claims: state.claims ?? null,
      view: {
        yaw: viewOption(state, "yaw") ?? null,
        pitch: viewOption(state, "pitch") ?? null,
        zoom: viewOption(state, "zoom") ?? null,
        showCube: state.showCube === true,
      },
    },
    reading: g
      ? reading(C, s, g)
      : { note: "The saved corners no longer make a tetrahedron: two of them coincide." },
    conditions: g ? conditions(C, s, g) : null,
    note:
      "Track.state saves the four corners, the view angles and zoom, the cube checkbox, and the barycentre, bimedian ends, angles and claims the page drew. The reading recomputes all of them with the same core, so the saved values can be compared with the geometry of the corners now.",
  };
}
