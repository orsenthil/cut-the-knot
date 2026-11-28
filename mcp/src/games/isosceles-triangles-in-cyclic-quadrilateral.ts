/*
 * run_game_logic actions and saved-position reader for Parallel Lines in a
 * Cyclic Quadrilateral (Bogomolny's IsoscelesTrianglesInCyclicQuadrilateral
 * "Mathematical Droodle").
 *
 * Four points A, B, C, D lie on one circle; the chords AC and BD meet at G.
 * M is placed on line AC with AM = AD and N on line BD with BN = BC. When the
 * chords cross, triangles AGD and BGC are similar (angles CAD and CBD subtend
 * arc CD, and the angles at G are vertical), so AG/AD = BG/BC. Hence M and N
 * are the same enlargement of A and B about G and MN is parallel to AB.
 *
 * The page also claims the crossing requirement is redundant. That remark is
 * false: with circular order A, C, B, D (e.g. A=30°, B=210°, C=150°, D=300°)
 * the chords do not cross, the similar-triangle step fails and MN is not
 * parallel to AB (the cross product is about 2.83 times the radius squared).
 * Every number below is measured by the game's real core, copied into
 * src/generated/cores/ at build time. Coordinates are the page's 400 x 300
 * viewBox units, with y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };
type Corners = { A: Point; B: Point; C: Point; D: Point };
type Measures = {
  amError: number; bnError: number; parallelError: number; parallelCross: number;
  inscribedError: number; ratioAGAD: number; ratioBGBC: number; proportionError: number;
  mAlongAC: number; nAlongBD: number; mn: number; mg: number; ng: number;
  ag: number; bg: number; similarityError: number;
  angleCAD: number; angleCBD: number; tAC: number; tBD: number;
};
type Claims = {
  amEqualsAd: boolean; bnEqualsBc: boolean; inscribedAnglesEqual: boolean;
  proportion: boolean; mnParallelAb: boolean; mnDefined: boolean;
  mOnAc: boolean; nOnBd: boolean; similarTriangles: boolean; crossing: boolean;
};
type Geometry = {
  A: Point; B: Point; C: Point; D: Point; M: Point; N: Point; G: Point; nameCenter: Point;
  edges: [Point, Point][]; chords: [Point, Point][];
  statementLines: [Point, Point][]; hintLines: [Point, Point][];
  arcs: { vertex: Point; p: Point; q: Point; r: number; kind: string }[];
  premiseTicks: { p: Point; q: Point; count: number }[];
  measures: Measures; claims: Claims; tol: number;
};
type Options = { premise: boolean; statement: boolean; hint: boolean; names: boolean };
type State = Corners & { options: Options; explored: boolean };
type Core = {
  VIEW: { x: number; y: number; width: number; height: number };
  CIRCLE: Circle;
  START_ANGLES: number[];
  NAMES: string[];
  OPTIONS: string[];
  dist(p: Point, q: Point): number;
  onCircle(theta: number): Point;
  clampPoint(p: Point, fallback?: Point): Point;
  start(options?: Partial<Options>): State;
  compute(A: Point, B: Point, C: Point, D: Point): Geometry | null;
  describe(state: State): string;
};

const core = () =>
  cores["isosceles-triangles-in-cyclic-quadrilateral"]
    .IsoscelesTrianglesInCyclicQuadrilateralCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const pt = (p: Point): Point => ({ x: round(p.x, 4), y: round(p.y, 4) });
/* Non-finite measurements (G off the board, coincident points) become null. */
const err = (v: number): number | null => (Number.isFinite(v) ? round(v) : null);
const degrees = (radians: number): number => (Number.isFinite(radians) ? round(radians * 180 / Math.PI, 3) : NaN);

/** Accept [x, y] or {x, y}, as the other geometry readers do. */
function readPoint(value: unknown, label: string): Point {
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or {x, y}`);
    const x = Number(value[0]), y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${label}" must hold finite numbers`);
    return { x, y };
  }
  if (value && typeof value === "object") {
    const o = value as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`"${label}" must be [x, y] or {x, y}`);
}

/**
 * Four corners on the applet's circle. Angles may be degrees (`anglesDegrees`)
 * or radians (`angles`); explicit A, B, C, D are snapped onto the circle by
 * the core's own clampPoint, as a drag does. With none of these, the opening
 * figure from start() is used.
 */
function readCorners(args: Json, K: Core): Corners {
  const hasDeg = args.anglesDegrees !== undefined && args.anglesDegrees !== null;
  const hasRad = args.angles !== undefined && args.angles !== null;
  const keys = ["A", "B", "C", "D"] as const;
  const given = keys.filter((k) => args[k] !== undefined && args[k] !== null);
  if ([hasDeg, hasRad, given.length > 0].filter(Boolean).length > 1) {
    throw new Error('give only one of "anglesDegrees", "angles" or the four corners A, B, C, D');
  }
  if (hasDeg || hasRad) {
    let angles = numArray(args, hasDeg ? "anglesDegrees" : "angles");
    if (angles.length !== 4) throw new Error("four angles are needed for A, B, C, D; got " + angles.length);
    if (hasDeg) angles = angles.map((d) => d * Math.PI / 180);
    return {
      A: K.onCircle(angles[0]), B: K.onCircle(angles[1]),
      C: K.onCircle(angles[2]), D: K.onCircle(angles[3]),
    };
  }
  if (given.length > 0) {
    if (given.length !== 4) throw new Error("give all four corners A, B, C, D, or none");
    return {
      A: K.clampPoint(readPoint(args.A, "A")), B: K.clampPoint(readPoint(args.B, "B")),
      C: K.clampPoint(readPoint(args.C, "C")), D: K.clampPoint(readPoint(args.D, "D")),
    };
  }
  const s = K.start();
  return { A: s.A, B: s.B, C: s.C, D: s.D };
}

function geometryFrom(args: Json): { K: Core; corners: Corners; g: Geometry } {
  const K = core();
  const corners = readCorners(args, K);
  const g = K.compute(corners.A, corners.B, corners.C, corners.D);
  if (!g) throw new Error("the four corners must be finite points; the core cannot draw this arrangement");
  return { K, corners, g };
}

function noteFor(g: Geometry): string {
  if (!Number.isFinite(g.G.x)) {
    return "AC and BD are parallel, so G is off the board. M and N are still marked on the chords, but there is no intersection around which to build the similar triangles.";
  }
  if (!g.claims.mnDefined) {
    return "M and N have fallen together, so there is no line MN to compare with AB — the page's 'provided M and N are distinct' case.";
  }
  if (!g.claims.crossing) {
    return "The chords do not cross inside the circle, so angles CAD and CBD fail to give the similar triangles AGD and BGC in the needed orientation. MN is not parallel to AB: the page's remark that crossing is redundant is false.";
  }
  return "The chords cross at G, angles CAD and CBD subtend arc CD and the angles at G are vertical, so triangles AGD and BGC are similar. M and N are then the same enlargement of A and B about G, and MN is parallel to AB.";
}

/** Everything the core measures at one arrangement, phrased for a tutor. */
function reading(K: Core, g: Geometry) {
  const m = g.measures, cl = g.claims;
  const radius = K.CIRCLE.radius;
  const gFinite = Number.isFinite(g.G.x) && Number.isFinite(g.G.y);
  return {
    corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    points: {
      G: gFinite ? pt(g.G) : null,
      M: pt(g.M), N: pt(g.N), nameCenter: pt(g.nameCenter),
    },
    circle: { center: pt(K.CIRCLE.center), radius: round(radius) },
    equalLengths: {
      statement: "AM = AD and BN = BC",
      AM: round(K.dist(g.A, g.M)), AD: round(K.dist(g.A, g.D)),
      BN: round(K.dist(g.B, g.N)), BC: round(K.dist(g.B, g.C)),
      errors: { am: err(m.amError), bn: err(m.bnError) },
      holds: cl.amEqualsAd && cl.bnEqualsBc,
    },
    inscribedAngles: {
      statement: "angle CAD = angle CBD (both subtend arc CD)",
      CADDegrees: degrees(m.angleCAD), CBDDegrees: degrees(m.angleCBD),
      error: err(m.inscribedError),
      holds: cl.inscribedAnglesEqual,
    },
    similarTriangles: {
      statement: "triangles AGD and BGC are similar, so AG/AD = BG/BC",
      AGOverAD: err(m.ratioAGAD), BGOverBC: err(m.ratioBGBC),
      proportionError: err(m.proportionError),
      proportionHolds: cl.proportion,
      similarTrianglesHold: cl.similarTriangles,
      similarityError: err(m.similarityError),
    },
    parallel: {
      statement: "MN || AB",
      MN: round(m.mn),
      crossOverRadiusSquared: err(m.parallelCross / (radius * radius)),
      normalizedError: err(m.parallelError),
      defined: cl.mnDefined,
      holds: cl.mnParallelAb,
    },
    crossing: {
      statement: "the chords AC and BD cross at G inside the circle",
      holds: cl.crossing,
      tAlongAC: err(m.tAC), tAlongBD: err(m.tBD),
    },
    claims: cl,
    note: noteFor(g),
  };
}

export function actions(): GameActions {
  return {
    inspect_construction: {
      describe:
        "Place the four corners A, B, C, D on the page's circle (degrees via `anglesDegrees`, radians via `angles`, or explicit points the core snaps onto the circle; omit all three for the opening figure) and rebuild the real construction. Report G = AC ∩ BD, M with AM = AD and N with BN = BC, the equal-length and inscribed-angle residuals, the AG/AD = BG/BC proportion from the similar triangles AGD ~ BGC, and whether MN is parallel to AB with its normalized cross-product error. Also says whether the chords cross, which is the hypothesis the proof really needs.",
      args: '{ "anglesDegrees": [30, 150, 216, 300] }',
      run: (args) => {
        const { K, corners, g } = geometryFrom(args);
        return {
          ...reading(K, g),
          narration: K.describe({ ...corners, options: K.start().options, explored: true }),
        };
      },
    },
    check_crossing: {
      describe:
        "Test the page's false remark that the chords crossing is redundant. Accepts the same corner arguments as inspect_construction and defaults to the counterexample with circular order A, C, B, D (A=30°, B=210°, C=150°, D=300°). Reports whether the chords cross, whether angles CAD and CBD are equal, whether triangles AGD and BGC are similar, whether MN is parallel to AB, and the raw cross product of MN with AB in units of the circle radius squared (about 2.83 in the counterexample).",
      args: '{ "anglesDegrees": [30, 210, 150, 300] }',
      run: (args) => {
        const { K, g } = geometryFrom(args);
        const r = reading(K, g);
        const falseRemark = !r.crossing.holds && !r.parallel.holds;
        return {
          corners: r.corners,
          points: r.points,
          chordsCross: r.crossing.holds,
          inscribedAnglesEqual: r.inscribedAngles.holds,
          similarTriangles: r.similarTriangles.similarTrianglesHold,
          mnParallelAb: r.parallel.holds,
          crossOverRadiusSquared: r.parallel.crossOverRadiusSquared,
          normalizedError: r.parallel.normalizedError,
          pageRemarkIsFalse: falseRemark,
          note: falseRemark
            ? "For the chords to cross, A and C must separate B and D around the circle. Here they do not, so the similar-triangle step fails and MN is not parallel to AB — the page's claim that the crossing requirement is redundant is wrong."
            : r.note,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of those corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Parallel Lines in a Cyclic Quadrilateral state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object") {
    throw new Error("missing saved Parallel Lines in a Cyclic Quadrilateral state");
  }
  const corners: Corners = {
    A: readPoint(state.A, "A"), B: readPoint(state.B, "B"),
    C: readPoint(state.C, "C"), D: readPoint(state.D, "D"),
  };
  const savedPoint = (key: string): Point | null => {
    const v = state[key];
    return v === undefined || v === null ? null : readPoint(v, key);
  };
  const savedM = savedPoint("M"), savedN = savedPoint("N"), savedG = savedPoint("G");
  const options = state.options && typeof state.options === "object"
    ? (state.options as Json) : {};
  const savedClaims = state.claims && typeof state.claims === "object"
    ? state.claims as Json : null;
  const savedMeasures = state.measures && typeof state.measures === "object"
    ? state.measures as Json : null;

  const K = core();
  const g = K.compute(corners.A, corners.B, corners.C, corners.D);
  if (!g) {
    return {
      ...state,
      stateVersion,
      valid: false,
      note: "The saved corners are not finite points; the core cannot rebuild this drawing.",
    };
  }
  const coreReading = reading(K, g);
  const here = { ...corners, options: K.start(options).options, explored: true } as State;

  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number, value: number): void => {
    differences.push({ field, page: round(page), core: round(value), diff: round(Math.abs(page - value), 9) });
  };
  if (savedM) { compare("M.x", savedM.x, g.M.x); compare("M.y", savedM.y, g.M.y); }
  if (savedN) { compare("N.x", savedN.x, g.N.x); compare("N.y", savedN.y, g.N.y); }
  if (savedG && Number.isFinite(g.G.x)) {
    compare("G.x", savedG.x, g.G.x); compare("G.y", savedG.y, g.G.y);
  }
  if (savedMeasures) {
    if (savedMeasures.parallelError !== undefined) {
      compare("measures.parallelError", Number(savedMeasures.parallelError), g.measures.parallelError);
    }
    if (savedMeasures.mn !== undefined) compare("measures.mn", Number(savedMeasures.mn), g.measures.mn);
  }
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );
  const claimsAgree = savedClaims === null ? null : Object.keys(savedClaims).every(
    (key) => savedClaims[key] === g.claims[key as keyof Claims],
  );

  return {
    ...state,
    stateVersion,
    valid: true,
    corners: coreReading.corners,
    savedPoints: { M: savedM ? pt(savedM) : null, N: savedN ? pt(savedN) : null, G: savedG ? pt(savedG) : null },
    core: coreReading,
    coreDescription: K.describe(here),
    savedMatchesCore,
    claimsAgree,
    differences,
    note: savedMatchesCore && claimsAgree !== false
      ? `The saved corners rebuild the same picture: AM = AD and BN = BC, and MN is ${coreReading.parallel.holds ? "parallel" : "not parallel"} to AB (chords cross: ${coreReading.crossing.holds}). The core's fresh reading is in \`core\`.`
      : "Some saved numbers or claims differ from a fresh core construction of the saved corners; see `differences`. The `core` field gives the true reading of that picture.",
  };
}
