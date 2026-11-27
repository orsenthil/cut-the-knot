/*
 * run_game_logic actions and saved-position reader for DeTemple.
 *
 * Drag the four corners A, B, C, D of a convex quadrilateral. The exterior
 * angle bisectors at the corners meet in E, F, G, H, which lie on one circle;
 * dropping perpendiculars from E, F, G, H to AB, BC, CD, DA gives four lines
 * that meet in P, Q, R, S. PQRS is tangential, and its incircle has the same
 * centre O as the circle through EFGH, because O lies on the perpendicular
 * bisector of every side of EFGH.
 *
 * The applet draws two guide circles from averages, not exact radii: the big
 * radius is the mean of three O-to-point distances, and the blue small radius
 * is the mean of four distances from O to the projections of P, Q, R, S onto
 * the rays OQ, OR, OS, OP. Neither is the true inradius of PQRS (the common
 * distance from O to its sides), even though both agree with the exact value
 * up to floating point when the claims hold.
 *
 * Every number below comes from the game's real core
 * (detemple/detemple-core.js, copied into src/generated/cores/ at build time).
 * Coordinates are board units of the page's 400 x 250 viewBox, y down.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Corners = { A: Point; B: Point; C: Point; D: Point };
type Circle = { c: Point; r: number };
type Claims = {
  cyclic: boolean;
  inscriptible: boolean;
  concentric: boolean;
  parallelogramIsRectangle: boolean;
  rectangleIsSquare: boolean;
  degenerateAtCentre: boolean;
};
type Measures = {
  circleError: number;
  oppositeAngles: number;
  squareAngleE: number;
  squareAngleF: number;
  sideEF: number;
  sideFG: number;
  inradiusSpread: number;
  tangentialError: number;
  bisectorSpread: number;
  sideDistances: number[];
  smallRadius: number;
};
type Geometry = {
  A: Point; B: Point; C: Point; D: Point;
  E: Point; F: Point; G: Point; H: Point;
  P: Point; Q: Point; R: Point; S: Point;
  big: Circle; small: Circle; centre: Point;
  scale: number; tol: number;
  measures: Measures;
  claims: Claims;
};
type Core = {
  VIEW: { x: number; y: number; width: number; height: number };
  start(options?: Json): Json;
  clamp(p: Point): Point;
  orientation(a: Point, b: Point, c: Point): number;
  compute(a: Point, b: Point, c: Point, d: Point): Geometry | null;
  describe(state: Json): string;
};

const core = () => cores["detemple"].DetempleCore as unknown as Core;

/* Tidy what we print, but keep tiny residuals visible as exponentials. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: Point): Point => ({ x: round(p.x, 4), y: round(p.y, 4) });
const err = (v: number): number | null => (Number.isFinite(v) ? v : null);
const errText = (v: number | null): string =>
  v === null ? "undefined" : v !== 0 && Math.abs(v) < 1e-4
    ? v.toExponential(2) : String(round(v, 6));

/** Points may be {x, y} (saved by the page) or [x, y] (tool arguments). */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(value[0]);
    y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be a point {x, y}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Four corners as {A, B, C, D} or [A, B, C, D]. */
function readCorners(value: unknown, label: string): Corners {
  if (Array.isArray(value)) {
    if (value.length !== 4) {
      throw new Error(`"${label}" must contain exactly four points A, B, C, D`);
    }
    return {
      A: readPoint(value[0], `${label}[0]`), B: readPoint(value[1], `${label}[1]`),
      C: readPoint(value[2], `${label}[2]`), D: readPoint(value[3], `${label}[3]`),
    };
  }
  if (!value || typeof value !== "object") {
    throw new Error(`"${label}" must be {A, B, C, D} or [A, B, C, D] of points`);
  }
  const o = value as Json;
  return {
    A: readPoint(o.A, `${label}.A`), B: readPoint(o.B, `${label}.B`),
    C: readPoint(o.C, `${label}.C`), D: readPoint(o.D, `${label}.D`),
  };
}

/** Saved point groups are optional; absent groups are reported as null. */
function optionalPoints(value: unknown, keys: readonly string[], label: string): Record<string, Point> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Json;
  const found: Record<string, Point> = {};
  for (const key of keys) {
    if (o[key] !== undefined && o[key] !== null) found[key] = readPoint(o[key], `${label}.${key}`);
  }
  return Object.keys(found).length > 0 ? found : null;
}

function optionalCircle(value: unknown, label: string): Circle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Json;
  if (o.c === undefined && o.r === undefined) return null;
  const r = num(o, "r");
  if (!(r > 0)) throw new Error(`"${label}.r" must be positive`);
  return { c: readPoint(o.c, `${label}.c`), r };
}

/**
 * Corners for an action: `corners` (or `points`) as four points, each clamped
 * onto the applet's board the way a drag is; omit both for the opening figure.
 */
function cornersFromArgs(args: Json): Corners {
  const K = core();
  const hasCorners = args.corners !== undefined && args.corners !== null;
  const hasPoints = args.points !== undefined && args.points !== null;
  if (hasCorners && hasPoints) {
    throw new Error('give either "corners" or "points", not both');
  }
  const raw = hasCorners ? args.corners : hasPoints ? args.points : null;
  if (raw === null) {
    const s = K.start();
    return {
      A: readPoint(s.A, "start.A"), B: readPoint(s.B, "start.B"),
      C: readPoint(s.C, "start.C"), D: readPoint(s.D, "start.D"),
    };
  }
  const c = readCorners(raw, hasCorners ? "corners" : "points");
  return { A: K.clamp(c.A), B: K.clamp(c.B), C: K.clamp(c.C), D: K.clamp(c.D) };
}

/* The construction is the exterior-bisector figure of a CONVEX quadrilateral. */
function requireConvex(K: Core, c: Corners): void {
  const signs = [
    K.orientation(c.A, c.B, c.C), K.orientation(c.B, c.C, c.D),
    K.orientation(c.C, c.D, c.A), K.orientation(c.D, c.A, c.B),
  ];
  if (!signs.every((s) => s === signs[0])) {
    throw new Error("A, B, C, D must be the corners of a convex quadrilateral, listed in order around it");
  }
}

function geometryFrom(args: Json): { K: Core; c: Corners; g: Geometry } {
  const K = core();
  const c = cornersFromArgs(args);
  requireConvex(K, c);
  const g = K.compute(c.A, c.B, c.C, c.D);
  if (!g) {
    throw new Error("those corners are degenerate: two coincide or a bisector is parallel to its neighbour; move them apart");
  }
  return { K, c, g };
}

/** One reading of a computed construction: points, guide circles and residuals. */
function reading(K: Core, g: Geometry) {
  const m = g.measures;
  const sides = m.sideDistances;
  const inradius = sides.reduce((sum, v) => sum + v, 0) / sides.length;
  return {
    corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    outer: { E: pt(g.E), F: pt(g.F), G: pt(g.G), H: pt(g.H) },
    inner: { P: pt(g.P), Q: pt(g.Q), R: pt(g.R), S: pt(g.S) },
    big: {
      center: pt(g.big.c), radius: round(g.big.r),
      radiusKind: "mean of the three O-to-EFG distances, not an exact circumradius",
    },
    small: {
      center: pt(g.small.c), radius: round(g.small.r),
      radiusKind: "applet's blue guide: mean of four O-to-projection distances, not the inradius",
    },
    markedCentre: pt(g.centre),
    measures: {
      circleError: err(m.circleError),
      oppositeAngles: round(m.oppositeAngles, 9),
      oppositeAngleError: err(Math.abs(m.oppositeAngles - Math.PI)),
      inradiusSpread: err(m.inradiusSpread),
      tangentialError: err(m.tangentialError),
      bisectorSpread: err(m.bisectorSpread),
      sideDistances: sides.map((v) => round(v)),
      trueInradius: round(inradius),
      guideRadius: round(m.smallRadius),
      guideMinusInradius: round(m.smallRadius - inradius),
    },
    claims: { ...g.claims },
  };
}

export function actions(): GameActions {
  return {
    exterior_bisector_circle: {
      describe:
        "Take four corners of a convex quadrilateral ABCD (`corners` or `points` as {A,B,C,D} or [A,B,C,D]; omit them for the applet's opening figure) and use the real core to draw the exterior angle bisectors at the four corners. Report their intersections E, F, G, H, the circle through them with centre O, the core's off-radius and opposite-angle residuals, and its `cyclic` verdict. The circle's radius is the mean of three O-to-point distances, a guide radius rather than an exact circumradius, though the two agree when EFGH is cyclic.",
      args: '{ "corners": { "A": { "x": 267.1877603298766, "y": 111.23958854042677 }, "B": { "x": 234.375, "y": 45.460753489819844 }, "C": { "x": 168.74999999999997, "y": 50.8734122634726 }, "D": { "x": 138.2674151219827, "y": 179.07662554463533 } } }',
      run: (args) => {
        const { K, g } = geometryFrom(args);
        const r = reading(K, g);
        return {
          ...r,
          note: g.claims.cyclic
            ? `The exterior bisectors meet at E, F, G, H and the core puts all four on one circle about O = (${r.big.center.x}, ${r.big.center.y}): the largest off-radius error is ${errText(r.measures.circleError)} and the opposite angles at F sum to ${r.measures.oppositeAngles} (within ${errText(r.measures.oppositeAngleError)} of π). Its radius ${r.big.radius} is an average of three O-to-point distances, equal to the exact circumradius here because the four distances agree.`
            : `The core does not put E, F, G, H on one circle here (off-radius ${errText(r.measures.circleError)}, opposite angles ${r.measures.oppositeAngles}); see the measures field.`,
        };
      },
    },
    perpendiculars_incircle: {
      describe:
        "For the same convex ABCD, use the real core to drop perpendiculars from E, F, G, H to AB, BC, CD, DA; their intersections are P, Q, R, S. Report P, Q, R, S, the common centre O, the four distances from O to the sides of PQRS with their spread, the tangential-length residual, and the core's `inscriptible` and `concentric` verdicts. The applet's blue guide radius is the mean of four centre-to-projection distances and is not the true inradius, which is the common distance from O to the sides.",
      args: '{ "corners": { "A": { "x": 267.1877603298766, "y": 111.23958854042677 }, "B": { "x": 234.375, "y": 45.460753489819844 }, "C": { "x": 168.74999999999997, "y": 50.8734122634726 }, "D": { "x": 138.2674151219827, "y": 179.07662554463533 } } }',
      run: (args) => {
        const { K, g } = geometryFrom(args);
        const r = reading(K, g);
        const m = r.measures;
        return {
          ...r,
          note: g.claims.inscriptible && g.claims.concentric
            ? `The perpendiculars meet at P, Q, R, S, and O is the same distance ${m.trueInradius} from each side (spread ${errText(m.inradiusSpread)}), while O lies on the perpendicular bisectors of EFGH's sides (spread ${errText(m.bisectorSpread)}). So PQRS has an incircle concentric with the circle through EFGH. The applet's blue guide radius ${m.guideRadius} is ${round(Math.abs(m.guideMinusInradius!), 4)} units away from that true inradius: it averages distances to projections onto O-to-corner rays, not to the sides.`
            : `PQRS is not tangential about O here (side-distance spread ${errText(m.inradiusSpread)}, tangential residual ${errText(m.tangentialError)}); the core's guide radius ${m.guideRadius} is then only an average, not an incircle radius.`,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of those corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported DeTemple state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object") {
    throw new Error("missing saved DeTemple state");
  }
  const corners = readCorners(state.corners, "corners");
  const outer = optionalPoints(state.outer, ["E", "F", "G", "H"], "outer");
  const inner = optionalPoints(state.inner, ["P", "Q", "R", "S"], "inner");
  const big = optionalCircle(state.big, "big");
  const small = optionalCircle(state.small, "small");
  const options = state.options && typeof state.options === "object" ? state.options as Json : {};
  const savedClaims = state.claims && typeof state.claims === "object" ? state.claims as Json : {};

  const K = core();
  const g = K.compute(corners.A, corners.B, corners.C, corners.D);
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
    compare(`corners.${key}.x`, corners[key].x, g[key].x);
    compare(`corners.${key}.y`, corners[key].y, g[key].y);
  }
  for (const key of ["E", "F", "G", "H"] as const) {
    if (outer && outer[key]) {
      compare(`outer.${key}.x`, outer[key].x, g[key].x);
      compare(`outer.${key}.y`, outer[key].y, g[key].y);
    }
  }
  for (const key of ["P", "Q", "R", "S"] as const) {
    if (inner && inner[key]) {
      compare(`inner.${key}.x`, inner[key].x, g[key].x);
      compare(`inner.${key}.y`, inner[key].y, g[key].y);
    }
  }
  if (big) {
    compare("big.c.x", big.c.x, g.big.c.x);
    compare("big.c.y", big.c.y, g.big.c.y);
    compare("big.r", big.r, g.big.r);
  }
  if (small) {
    compare("small.c.x", small.c.x, g.small.c.x);
    compare("small.c.y", small.c.y, g.small.c.y);
    compare("small.r", small.r, g.small.r);
  }
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );
  const claimsAgree = Object.keys(savedClaims).every(
    (key) => savedClaims[key] === g.claims[key as keyof Claims],
  );
  const m = coreReading.measures;

  return {
    ...state,
    stateVersion,
    valid: true,
    corners: { A: pt(corners.A), B: pt(corners.B), C: pt(corners.C), D: pt(corners.D) },
    outer, inner, big, small, options, claims: savedClaims,
    core: coreReading,
    coreDescription: K.describe(here),
    savedMatchesCore,
    claimsAgree,
    differences,
    note: savedMatchesCore && claimsAgree
      ? `The saved corners rebuild the same picture: E, F, G, H are cyclic (off-radius ${errText(m.circleError)}), and O is equidistant from all four sides of PQRS (spread ${errText(m.inradiusSpread)}) and from E, F, G, H (spread ${errText(m.bisectorSpread)}), so the two circles are concentric. The true inradius is ${m.trueInradius}; the saved blue guide radius ${m.guideRadius} is an average of centre-to-projection distances, not that inradius.`
      : "Some saved numbers or claims differ from a fresh core construction of the saved corners; see `differences`. The `core` field gives the true reading of those corners.",
  };
}
