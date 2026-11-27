/*
 * run_game_logic actions and saved-position reader for Central Angles In Cube.
 *
 * The real core is central-angles-in-cube/central-angles-in-cube-core.js,
 * copied into src/generated/cores/ at build time. See _shared.ts for the module
 * shape. The page is an illustration: the three draggable points P, Q, R (the
 * applet's P1, P2, P3) sit at cube corners, and O is the cube's centre.
 *
 * Two answers occur for the angle AOC at O. If the two corners are the ends of
 * a face diagonal (two coordinates differ), their vectors have dot product
 * -s^2/4 and lengths s*sqrt(3)/2, so cos = -1/3 and the angle is
 * arccos(-1/3) ~ 109.47 degrees. If they are the ends of a cube edge (one
 * coordinate differs), the dot product is +s^2/4, so cos = +1/3 and the angle
 * is arccos(1/3) ~ 70.53 degrees. The cosines are negatives, so the two angles
 * are supplementary. Four alternate corners are pairwise face-diagonal apart,
 * so they form a regular tetrahedron whose six central angles are all obtuse.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["central-angles-in-cube"].CentralAnglesInCubeCore;
type Core = ReturnType<typeof core>;
type Vec = { x: number; y: number; z: number };
type State = ReturnType<Core["start"]>;
type Geometry = NonNullable<ReturnType<Core["geometry"]>>;

const MODES = ["none", "obtuse", "acute", "both"] as const;
const TETRA_NAMES = ["A", "C", "B'", "D'"];

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** Non-finite measurements (a handle at the centre) are reported as null. */
const maybe = (v: number): number | null => (Number.isFinite(v) ? round(v) : null);
const vec = (p: Vec | null | undefined): { x: number; y: number; z: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)
    ? { x: round(p.x), y: round(p.y), z: round(p.z) }
    : null;

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

/** Build the core's state from P/Q/R plus the view and checkbox options. */
function readState(C: Core, args: Json): State {
  const seed = C.start();
  const rawPoints = args.points;
  let points: { P: Vec; Q: Vec; R: Vec };
  if (rawPoints === undefined || rawPoints === null) {
    points = {
      P: { ...seed.points.P }, Q: { ...seed.points.Q }, R: { ...seed.points.R },
    };
  } else if (typeof rawPoints === "object" && !Array.isArray(rawPoints)) {
    const o = rawPoints as Json;
    const point = (key: string): Vec =>
      o[key] === undefined || o[key] === null
        ? { ...seed.points[key as "P" | "Q" | "R"] }
        : readVec(o[key], `points.${key}`);
    points = { P: point("P"), Q: point("Q"), R: point("R") };
  } else {
    throw new Error('argument "points" must be {P, Q, R}, each [x, y, z] or {x, y, z}');
  }

  const mode = args.mode === undefined || args.mode === null ? seed.mode : String(args.mode);
  if (!(MODES as readonly string[]).includes(mode)) {
    throw new Error(`argument "mode" must be one of ${MODES.join(", ")}, got ${JSON.stringify(args.mode)}`);
  }
  const side = num(args, "side", seed.side);
  if (side < C.SIDE_MIN || side > C.SIDE_MAX) {
    throw new Error(`argument "side" must be between ${C.SIDE_MIN} and ${C.SIDE_MAX}, got ${side}`);
  }
  return C.start({
    side, points, mode,
    yaw: num(args, "yaw", seed.yaw),
    pitch: num(args, "pitch", seed.pitch),
    zoom: num(args, "zoom", seed.zoom),
    snap: args.snap === undefined || args.snap === null ? seed.snap : args.snap === true,
    showTetra: args.showTetra === undefined || args.showTetra === null
      ? seed.showTetra : args.showTetra === true,
  });
}

function readGeometry(C: Core, args: Json): { s: State; g: Geometry } {
  const s = readState(C, args);
  const g = C.geometry(s);
  if (!g) throw new Error("The three points and side do not give a usable picture of the cube.");
  return { s, g };
}

/** The two angles at O and what makes each of them obtuse or acute. */
function angleReading(C: Core, s: State, g: Geometry) {
  return {
    cubeSide: s.side,
    points: { P: vec(g.P), Q: vec(g.Q), R: vec(g.R) },
    cornerNames: { P: g.vertexNames.P, Q: g.vertexNames.Q, R: g.vertexNames.R },
    cornerSeparations: {
      PQ: { differingCoordinates: g.hamming.PQ, kind: g.pairKinds.obtuse },
      QR: { differingCoordinates: g.hamming.QR, kind: g.pairKinds.acute },
      PR: { differingCoordinates: g.hamming.PR },
    },
    obtuseAnglePOQ: {
      degrees: maybe(g.obtuseDeg), cosine: maybe(g.obtuseCos), kind: g.pairKinds.obtuse,
    },
    acuteAngleQOR: {
      degrees: maybe(g.acuteDeg), cosine: maybe(g.acuteCos), kind: g.pairKinds.acute,
    },
    articleValues: {
      faceDiagonal: { cosine: -1 / 3, degrees: round(C.OBTUSE_DEG) },
      cubeEdge: { cosine: 1 / 3, degrees: round(C.ACUTE_DEG) },
      sumDegrees: 180,
    },
    supplementary: g.claims.supplementary,
    oppositeEnds: { differingCoordinates: g.hamming.PR, collinearThroughO: g.claims.collinearThroughO },
    degenerate: g.claims.degenerate,
    claims: { ...g.claims },
    mode: s.mode,
    note:
      "Corners of a face diagonal differ in two coordinates, so OP·OQ = -s^2/4 and the cosine is -1/3: angle POQ is obtuse, arccos(-1/3). Ends of a cube edge differ in one coordinate, so OQ·OR = +s^2/4 and the cosine is +1/3: angle QOR is acute, arccos(1/3). The cosines are negatives, so the two angles add to 180 degrees. Three differing coordinates are opposite ends of a body diagonal, a straight angle through O.",
  };
}

/** The inscribed regular tetrahedron and the right triangle A C C'. */
function tetraReading(C: Core, s: State, g: Geometry) {
  const corners = g.tetrahedron.corners;
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) pairs.push([i, j]);
  }
  const tri = g.triangle;
  return {
    cubeSide: s.side,
    shownOnPage: s.showTetra,
    corners: corners.map((p, i) => ({ name: TETRA_NAMES[i], at: vec(p) })),
    anglesAtCentre: pairs.map(([i, j], k) => ({
      between: `${TETRA_NAMES[i]} O ${TETRA_NAMES[j]}`,
      degrees: maybe(g.tetrahedron.angles[k]),
      cosine: maybe(C.cosBetween(corners[i], corners[j])),
    })),
    allSixAreObtuse: g.claims.tetrahedron,
    expected: { cosine: -1 / 3, degrees: round(C.OBTUSE_DEG), numberOfAngles: 6 },
    rightTriangle: {
      name: "A C C'",
      AC: maybe(tri.AC), CCp: maybe(tri.CCp), ACp: maybe(tri.ACp),
      medianCO: maybe(tri.median),
      rightAtC: tri.rightAtC,
      midpointOfACpIsO: tri.midpointIsO,
      holds: g.claims.rightTriangle,
    },
    note:
      "A, C, B' and D' are alternate cube corners: every pair is a face diagonal, so all six rays from O have cosine -1/3 and the four points are a regular tetrahedron. In the page's right triangle A C C' the legs are s*sqrt(2) and s, the hypotenuse AC' is s*sqrt(3), the right angle is at C and O is the midpoint of AC', so the median CO is s*sqrt(3)/2.",
  };
}

export function actions(): GameActions {
  return {
    central_angles: {
      describe:
        "For three points P, Q, R at cube corners, each as [x, y, z] or {x, y, z} in world units, report the two central angles at the cube's centre O: angle POQ (the obtuse one, a face diagonal) and angle QOR (the acute one, a cube edge), with their cosines and degrees, which corners are being used, how many coordinates differ for each pair, and the page's claims including supplementarity and the body-diagonal case. Omit points to use the applet's Reset positions P=(0,0,0), Q=(1,1,0), R=(1,1,1) recentred on O and scaled by side. side must be 0.25..4 and mode one of none, obtuse, acute, both; yaw, pitch and zoom default to the applet's view.",
      args: '{ "points": { "P": [-0.5, -0.5, -0.5], "Q": [0.5, 0.5, -0.5], "R": [0.5, 0.5, 0.5] }, "side": 1, "mode": "both" }',
      run: (args) => {
        const C = core();
        const { s, g } = readGeometry(C, args);
        return angleReading(C, s, g);
      },
    },
    tetrahedron: {
      describe:
        "For a cube of a given side (0.25..4, default 1), report the regular tetrahedron at the alternate corners A, C, B', D': its four corner coordinates, the six central angles at O with their cosines (all arccos(-1/3), about 109.47 degrees), and the measurements of the page's right triangle A C C'. This inscribed tetrahedron does not depend on the three draggable points; showTetra only decides whether its edges are drawn.",
      args: '{ "side": 1, "showTetra": true }',
      run: (args) => {
        const C = core();
        const { s, g } = readGeometry(C, args);
        return tetraReading(C, s, g);
      },
    },
  };
}

/** The drawing saved by Track.state, re-read with the same core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Central Angles In Cube state version ${stateVersion}`);
  }
  const C = core();
  const s = readState(C, state);
  const g = C.geometry(s);
  const rawPoints = (state.points !== null && typeof state.points === "object" ? state.points : {}) as Json;
  const segments = Array.isArray(state.segments) ? state.segments : [];
  return {
    stateVersion,
    saved: {
      side: s.side,
      points: {
        P: vec(rawPoints.P as Vec | undefined),
        Q: vec(rawPoints.Q as Vec | undefined),
        R: vec(rawPoints.R as Vec | undefined),
      },
      mode: s.mode, snap: s.snap, showTetra: s.showTetra,
      view: { yaw: round(s.yaw), pitch: round(s.pitch), zoom: s.zoom },
      vertexNames: state.vertexNames ?? null,
      segments: segments.map((seg, i) => {
        const o = (seg !== null && typeof seg === "object" ? seg : {}) as Json;
        return { name: o.name ?? `S${i}`, a: vec(o.a as Vec | undefined), b: vec(o.b as Vec | undefined) };
      }),
      angles: state.angles ?? null,
      cosines: state.cosines ?? null,
      claims: state.claims ?? null,
    },
    reading: g
      ? { ...angleReading(C, s, g), tetrahedron: tetraReading(C, s, g) }
      : { note: "The saved points do not make a usable picture: a handle is at the centre or the side is not positive." },
    isIllustration: C.result() === null,
    note:
      "Track.state saves the cube side, the three dragged points, the ray mode, the snap and tetrahedron checkboxes, the view angles and zoom, and the corner names, five applet segments, two angles, cosines and claims the page drew. The reading rebuilds the same position with the core and recomputes all of those, so a tutor can compare the saved picture with the geometry behind it. This is an illustration: there is no win or loss.",
  };
}
