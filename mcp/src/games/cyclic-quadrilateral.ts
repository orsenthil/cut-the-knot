/*
 * run_game_logic actions and saved-position reader for Incenters in a Cyclic
 * Quadrilateral (Alexander Bogomolny's CyclicQuadrilateral applet).
 *
 * Four corners A, B, C, D on one circle give four triangles. Their incenters
 * IABC, IACD, IABD, IBCD are the corners of a rectangle, and the Japanese
 * theorem says the two inradius sums of a triangulation agree:
 *   rABC + rACD = rABD + rBCD.
 * The bisectors of the four arcs meet the circle again at P, Q, R, S; the page
 * claims PQ is perpendicular to RS and both pass through midpoints of the
 * rectangle's sides. Lines through the incenters parallel to the diagonals
 * enclose a rhombus.
 *
 * Every number returned here is measured by the game's real core
 * (cyclic-quadrilateral/cyclic-quadrilateral-core.js), copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * page's 560 x 400 viewBox, with y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type Segment = [Point, Point];
type Radii = { ABC: number; ACD: number; ABD: number; BCD: number };
type Measures = {
  rightError: number;
  parallelError: number;
  oppositeLengthError: number;
  radiusSumError: number;
  rhombusSpread: number;
  sideArcCross: number;
  drawnArcCross: number;
  pqMidError: number;
  rsMidError: number;
  drawnPqMidError: number;
  drawnRsMidError: number;
};
type Claims = Record<string, boolean>;
type Geometry = {
  A: Point; B: Point; C: Point; D: Point; circle: Circle;
  IABC: Point; IACD: Point; IABD: Point; IBCD: Point;
  rectangle: Segment[];
  P: Point; Q: Point; R: Point; S: Point;
  sideP: Point; sideQ: Point; sideR: Point; sideS: Point;
  rhombus: { lines: { p: Point; q: Point }[]; vertices: Point[] };
  radii: Radii;
  measures: Measures;
  claims: Claims;
};
type Core = {
  CENTER: Point;
  RADIUS: number;
  START_ANGLES: number[];
  circlePoint(t: number): Point;
  clampToCircle(p: Point): Point;
  dist(p: Point, q: Point): number;
  compute(a: Point, b: Point, c: Point, d: Point, circle?: Circle): Geometry | null;
  start(options?: Json): Json;
  describe(state: Json): string;
};

const core = () => cores["cyclic-quadrilateral"].CyclicQuadrilateralCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: Point): Point => ({ x: round(p.x, 4), y: round(p.y, 4) });
/* Keep tiny residuals visible: a 1e-14 error is the interesting result here. */
const errText = (v: number): string =>
  !Number.isFinite(v) ? "undefined (parallel lines)"
    : v !== 0 && Math.abs(v) < 1e-4 ? v.toExponential(2)
      : String(round(v, 6));
const err = (v: number): number | null => (Number.isFinite(v) ? v : null);

function readPoint(value: unknown, label: string): Point {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const p = value as Json;
    const x = Number(p.x), y = Number(p.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  throw new Error(`"${label}" must be a point {x, y}`);
}

function readCircle(value: unknown, label: string): Circle {
  if (!value || typeof value !== "object") throw new Error(`"${label}" must be a circle {c, r}`);
  const o = value as Json;
  const r = num(o, "r");
  if (!(r > 0)) throw new Error(`"${label}.r" must be positive`);
  return { c: readPoint(o.c, `${label}.c`), r };
}

/** Radii of the four triangles, read from a saved `radii` field. */
function readRadii(value: unknown): Radii {
  if (!value || typeof value !== "object") throw new Error('"radii" must be an object');
  const r = value as Json;
  return {
    ABC: num(r, "ABC"), ACD: num(r, "ACD"),
    ABD: num(r, "ABD"), BCD: num(r, "BCD"),
  };
}

/**
 * Four corners on the applet's circle. Angles may be radians (`angles`) or
 * degrees (`anglesDegrees`); explicit points are snapped onto the circle by
 * the core's own clampToCircle, as a drag does. With neither, the opening
 * arrangement from start() is used.
 */
function cornersFromArgs(args: Json) {
  const K = core();
  const hasRad = args.angles !== undefined && args.angles !== null;
  const hasDeg = args.anglesDegrees !== undefined && args.anglesDegrees !== null;
  const hasPts = args.points !== undefined && args.points !== null;
  if ([hasRad, hasDeg, hasPts].filter(Boolean).length > 1) {
    throw new Error('give only one of "angles", "anglesDegrees" or "points"');
  }
  if (hasRad || hasDeg) {
    let angles = numArray(args, hasRad ? "angles" : "anglesDegrees");
    if (angles.length !== 4) throw new Error("four corners are needed: got " + angles.length + " angles");
    if (hasDeg) angles = angles.map((d) => d * Math.PI / 180);
    return {
      A: K.circlePoint(angles[0]), B: K.circlePoint(angles[1]),
      C: K.circlePoint(angles[2]), D: K.circlePoint(angles[3]),
    };
  }
  if (hasPts) {
    if (!Array.isArray(args.points) || args.points.length !== 4) {
      throw new Error('"points" must contain exactly four {x, y} corners');
    }
    const p = args.points.map((v, i) => K.clampToCircle(readPoint(v, `points[${i}]`)));
    return { A: p[0], B: p[1], C: p[2], D: p[3] };
  }
  const s = K.start();
  return { A: readPoint(s.A, "A"), B: readPoint(s.B, "B"), C: readPoint(s.C, "C"), D: readPoint(s.D, "D") };
}

/** Rebuild the whole construction, refusing configurations the core cannot draw. */
function geometryFrom(args: Json): Geometry {
  const K = core();
  const c = cornersFromArgs(args);
  const g = K.compute(c.A, c.B, c.C, c.D);
  if (!g) {
    throw new Error("those four corners are degenerate: two coincide or the construction has parallel lines; move them apart");
  }
  return g;
}

/** The rectangle, radius sum and arc-line residuals, all measured by the core. */
function reading(K: Core, g: Geometry) {
  const m = g.measures;
  const r = g.radii;
  return {
    corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    circle: { center: pt(g.circle.c), radius: round(g.circle.r) },
    incenters: {
      IABC: pt(g.IABC), IACD: pt(g.IACD),
      IABD: pt(g.IABD), IBCD: pt(g.IBCD),
    },
    rectangle: g.rectangle.map(([p, q]) => ({
      from: pt(p), to: pt(q), length: round(K.dist(p, q)),
    })),
    rectangleErrors: {
      maxRightAngleCosine: err(m.rightError),
      maxParallelCross: err(m.parallelError),
      oppositeSideLengthGap: err(m.oppositeLengthError),
    },
    inradii: {
      ABC: round(r.ABC), ACD: round(r.ACD),
      ABD: round(r.ABD), BCD: round(r.BCD),
    },
    radiusSum: {
      statement: "rABC + rACD = rABD + rBCD",
      left: round(r.ABC + r.ACD),
      right: round(r.ABD + r.BCD),
      error: err(m.radiusSumError),
      holds: g.claims.radiusSum === true,
    },
    arcLines: {
      // HalveArc points (the applet's drawn P, Q, R, S) and the midpoints of
      // the arcs along each side. They coincide unless a side spans > 180°.
      drawn: { P: pt(g.P), Q: pt(g.Q), R: pt(g.R), S: pt(g.S) },
      sideArcs: { P: pt(g.sideP), Q: pt(g.sideQ), R: pt(g.sideR), S: pt(g.sideS) },
      perpendicularSin: { drawn: err(m.drawnArcCross), sideArcs: err(m.sideArcCross) },
      rectangleMidpointError: { drawn: err(m.drawnPqMidError), sideArcs: err(m.pqMidError) },
      perpendicular: g.claims.drawnArcsPerpendicular === true,
      throughMidpoints: g.claims.rectangleMidpoints === true,
    },
    rhombus: {
      vertices: g.rhombus.vertices.map(pt),
      sideLengths: g.rhombus.vertices.map(
        (v, i) => round(K.dist(v, g.rhombus.vertices[(i + 1) % 4])),
      ),
      spread: err(m.rhombusSpread),
      holds: g.claims.rhombus === true,
    },
    claims: g.claims,
  };
}

export function actions(): GameActions {
  return {
    rectangle_and_radii: {
      describe:
        "Place four corners on the page's circle (angles in radians via `angles`, degrees via `anglesDegrees`, or explicit `points` that the core snaps onto the circle; omit all three for the opening figure) and rebuild the real construction. Report the four triangle incenters IABC, IACD, IABD, IBCD, the rectangle they form with its side lengths and right-angle/parallel residuals, and the four inradii. Also check the Japanese theorem rABC + rACD = rABD + rBCD with the core's residual and verdict.",
      args: '{ "anglesDegrees": [30, 150, 216, 300] }',
      run: (args) => {
        const K = core();
        const g = geometryFrom(args);
        const r = reading(K, g);
        return {
          ...r,
          note: r.radiusSum.holds && g.claims.rectangle === true
            ? `The four incenters lie at the corners of a rectangle, and the two triangulations agree: rABC + rACD = ${r.radiusSum.left} equals rABD + rBCD = ${r.radiusSum.right}, off by only ${errText(r.radiusSum.error!)} units. This is the Japanese theorem for a cyclic quadrilateral.`
            : `The core did not confirm both claims here (rectangle: ${g.claims.rectangle === true}, radius sum: ${r.radiusSum.holds}); move the corners apart and try again.`,
        };
      },
    },
    arc_lines_and_rhombus: {
      describe:
        "For the same four corners, use the real core to find P, Q, R, S where the angle bisectors meet the circle, and the midpoints of the arcs along each side. Report the sine of the angle between PQ and RS (near 1 means perpendicular), the error with which those lines pass through the rectangle's side midpoints, and the rhombus enclosed by the four lines through the incenters parallel to the diagonals. Arguments are the same as rectangle_and_radii.",
      args: '{ "anglesDegrees": [30, 150, 216, 300] }',
      run: (args) => {
        const K = core();
        const g = geometryFrom(args);
        const r = reading(K, g);
        const a = r.arcLines;
        return {
          arcMidpoints: a,
          rhombus: r.rhombus,
          claims: {
            arcsPerpendicular: g.claims.arcsPerpendicular === true,
            drawnArcsPerpendicular: a.perpendicular,
            rectangleMidpoints: a.throughMidpoints,
            rhombus: r.rhombus.holds,
          },
          note: a.perpendicular && a.throughMidpoints
            ? `PQ and RS are perpendicular (|sin| = ${errText(a.perpendicularSin.drawn!)}), and each passes within ${errText(a.rectangleMidpointError.drawn!)} units of a rectangle side midpoint. The four parallels to the diagonals through the incenters bound a rhombus with equal sides (spread ${errText(r.rhombus.spread!)}).`
            : `The arc-line claims do not all hold at this arrangement; see the residual fields. Note that the applet draws P, Q, R, S on the minor arcs, which differ from the arcs along the sides only when a side spans more than 180°.`,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of those corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Cyclic Quadrilateral state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object") {
    throw new Error("missing saved Cyclic Quadrilateral state");
  }
  const corners = {
    A: readPoint(state.A, "A"), B: readPoint(state.B, "B"),
    C: readPoint(state.C, "C"), D: readPoint(state.D, "D"),
  };
  const savedIncenters = {
    IABC: readPoint(state.IABC, "IABC"), IACD: readPoint(state.IACD, "IACD"),
    IABD: readPoint(state.IABD, "IABD"), IBCD: readPoint(state.IBCD, "IBCD"),
  };
  const savedArcs = {
    P: readPoint(state.P, "P"), Q: readPoint(state.Q, "Q"),
    R: readPoint(state.R, "R"), S: readPoint(state.S, "S"),
  };
  const circle = readCircle(state.circle, "circle");
  const radii = readRadii(state.radii);
  const options = state.options && typeof state.options === "object" ? state.options : {};
  const savedClaims: Json = state.claims && typeof state.claims === "object"
    ? state.claims as Json : {};

  const K = core();
  const g = K.compute(corners.A, corners.B, corners.C, corners.D, circle);
  if (!g) {
    return {
      ...state,
      stateVersion,
      valid: false,
      note: "The saved four corners are degenerate; the core cannot rebuild this illustration.",
    };
  }
  const coreReading = reading(K, g);
  const here = { ...corners, options, explored: true } as Json;
  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number, value: number): void => {
    differences.push({ field, page: round(page), core: round(value), diff: round(Math.abs(page - value), 9) });
  };
  for (const key of ["A", "B", "C", "D"] as const) {
    compare(`${key}.x`, corners[key].x, g[key].x);
    compare(`${key}.y`, corners[key].y, g[key].y);
  }
  for (const key of ["IABC", "IACD", "IABD", "IBCD"] as const) {
    compare(`${key}.x`, savedIncenters[key].x, g[key].x);
    compare(`${key}.y`, savedIncenters[key].y, g[key].y);
  }
  for (const key of ["P", "Q", "R", "S"] as const) {
    compare(`${key}.x`, savedArcs[key].x, g[key].x);
    compare(`${key}.y`, savedArcs[key].y, g[key].y);
  }
  compare("radii.ABC", radii.ABC, g.radii.ABC);
  compare("radii.ACD", radii.ACD, g.radii.ACD);
  compare("radii.ABD", radii.ABD, g.radii.ABD);
  compare("radii.BCD", radii.BCD, g.radii.BCD);
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );
  const claimsAgree = Object.keys(savedClaims).every(
    (key) => savedClaims[key] === g.claims[key],
  );

  return {
    ...state,
    stateVersion,
    valid: true,
    circle: { c: pt(circle.c), r: round(circle.r) },
    options,
    claims: savedClaims,
    core: coreReading,
    coreDescription: K.describe(here),
    savedMatchesCore,
    claimsAgree,
    differences,
    note: savedMatchesCore && claimsAgree
      ? `The saved corners rebuild the same picture: the four incenters form a rectangle, rABC + rACD = ${coreReading.radiusSum.left} matches rABD + rBCD = ${coreReading.radiusSum.right} to ${errText(coreReading.radiusSum.error!)}, and the arc-bisector lines PQ and RS are perpendicular through the rectangle's midpoints.`
      : "Some saved numbers or claims differ from a fresh core construction of the saved corners; see `differences`. The `core` field gives the true reading of that picture.",
  };
}
