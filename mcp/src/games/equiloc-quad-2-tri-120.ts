/*
 * run_game_logic actions and saved-position reader for Equiloc Quad 2Tri 120
 * (Alexander Bogomolny's EquilocQuad2Tri120 applet).
 *
 * A, B and the draggable S lie on one circle. C slides on the line B–S and D
 * on the line A–S, both at the same signed distance `length` from B and A, so
 * AD = BC. Rotate C about A by +60° to get P and D about B by -60° to get R.
 * On the arc opposite the chord AB, angle ASB is 120° and the two turns land
 * on the same point of the bisector S–T (the line from S to the point T of
 * the circle below its centre); on the other arc angle ASB is 60° and the
 * tips sit 2·|BC| apart instead. The page calls AD and BC the "opposite
 * diagonals"; in the quadrilateral ABCD they are opposite sides meeting at S.
 *
 * Every number below is measured by the real core in
 * equiloc-quad-2-tri-120/equiloc-quad-2-tri-120-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * 400 x 300 viewBox with y down. This is a demo: no win or loss, only an
 * explored picture. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type Measures = {
  prError: number; bisError: number; bisProjection: number;
  acpError: number; dbrError: number; admError: number; bcnError: number;
  abtError: number; adbcError: number; asbAngle: number; diagAngle: number;
};
type Claims = {
  apexesCoincide: boolean; onBisector: boolean; equilateralACP: boolean;
  equilateralDBR: boolean; equilateralADM: boolean; equilateralBCN: boolean;
  equilateralABT: boolean; adEqualsBC: boolean; asbIs120: boolean;
  towardsAB: boolean;
};
type Geometry = {
  A: Point; B: Point; C: Point; D: Point; S: Point; T: Point;
  P: Point; R: Point; M: Point; N: Point; K: Point;
  circle: Circle; measures: Measures; claims: Claims; showR: boolean;
};
type Options = { names: boolean; construction: boolean; hint: boolean };
type State = {
  A: Point; B: Point; C: Point; D: Point; S: Point; T: Point;
  length: number; circle: Circle; options: Options; explored: boolean;
};
type Core = {
  point(x: number, y: number): Point;
  dist(p: Point, q: Point): number;
  dot(a: Point, b: Point): number;
  sub(a: Point, b: Point): Point;
  side(a: Point, b: Point, p: Point): number;
  start(options?: Json): State;
  move(state: State, name: string, p: Point): State;
  geometry(state: State): Geometry | null;
  result(): null;
  describe(state: State): string;
};

const core = (): Core =>
  cores["equiloc-quad-2-tri-120"].EquilocQuad2Tri120Core as unknown as Core;

/* The core is exact up to floating point; its residuals are ~1e-13 units. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const round = (v: number, digits = 6): number =>
  (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const err = (v: number): number | null => (Number.isFinite(v) ? v : null);
const errText = (v: number | null): string =>
  v === null ? "undefined"
    : v !== 0 && Math.abs(v) < 1e-4 ? v.toExponential(2)
      : String(r6(v));

/** Accept both the page's saved { x, y } dots and the tutor's [x, y] arguments. */
function readPoint(value: unknown, label: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required point "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`"${label}" must hold finite numeric x and y, got ${JSON.stringify(value)}`);
    }
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" must hold finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

function readCircle(value: unknown, label: string): Circle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${label}" must be a circle { c, r }`);
  }
  const o = value as Json;
  const r = num(o, "r");
  if (!(r > 0)) throw new Error(`"${label}.r" must be positive`);
  return { c: readPoint(o.c, `${label}.c`), r };
}

/** Cosmetic switches may be top-level keys or a nested `options` object. */
function readOptions(args: Json): Options {
  const raw: Json = args.options && typeof args.options === "object" && !Array.isArray(args.options)
    ? args.options as Json : args;
  const flag = (key: keyof Options, fallback: boolean): boolean => {
    const v = raw[key];
    if (v === undefined || v === null) return fallback;
    if (typeof v !== "boolean") {
      throw new Error(`"${key}" must be a boolean, got ${JSON.stringify(v)}`);
    }
    return v;
  };
  /* The core defaults names to true and the other two to false. */
  return { names: flag("names", true), construction: flag("construction", false), hint: flag("hint", false) };
}

/** Start from the core's opening picture and apply any supplied handle moves. */
function buildState(args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with optional S, C, D points and options");
  }
  const K = core();
  let s = K.start(readOptions(args));
  for (const name of ["S", "C", "D"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      /* S is snapped onto the circle, C and D onto their secants, by the core. */
      s = K.move(s, name, readPoint(args[name], name));
    }
  }
  return s;
}

function geometryFrom(args: Json) {
  const K = core();
  const s = buildState(args);
  const g = K.geometry(s);
  if (!g) {
    throw new Error(
      "the core cannot draw this arrangement: move S away from A and B, or C and D away from S, so the two sloping lines stay apart",
    );
  }
  return { K, s, g };
}

function measuresView(m: Measures) {
  return {
    prError: err(m.prError), bisError: err(m.bisError), bisProjection: err(m.bisProjection),
    acpError: err(m.acpError), dbrError: err(m.dbrError), admError: err(m.admError),
    bcnError: err(m.bcnError), abtError: err(m.abtError), adbcError: err(m.adbcError),
    asbAngle: round(m.asbAngle, 4), diagAngle: round(m.diagAngle, 4),
  };
}

/** Everything the core can say about one picture, in tutor-friendly units. */
function reading(K: Core, s: State, g: Geometry) {
  const m = g.measures, claims = g.claims;
  const side = K.side(g.A, g.B, g.S);
  const triangle = (name: string, base: string, apex: string, a: Point, b: Point, c: Point,
    error: number, equilateral: boolean) => ({
    name, base, apex,
    vertices: { [base[0]]: pt(a), [base[1]]: pt(b), [apex]: pt(c) },
    sides: { [base]: r6(K.dist(a, b)), [`${base[1]}${apex}`]: r6(K.dist(b, c)),
      [`${apex}${base[0]}`]: r6(K.dist(c, a)) },
    error: err(error), equilateral,
  });
  return {
    points: {
      A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D), S: pt(g.S), T: pt(g.T),
      P: pt(g.P), R: pt(g.R), M: pt(g.M), N: pt(g.N), K: pt(g.K),
    },
    circle: { center: pt(g.circle.c), radius: r6(g.circle.r) },
    commonDistance: r6(s.length),
    tips: {
      P: pt(g.P), R: pt(g.R),
      separation: err(m.prError),
      coincide: claims.apexesCoincide,
      commonPoint: claims.apexesCoincide ? pt(g.P) : null,
      showR: g.showR,
    },
    bisector: {
      onBisector: claims.onBisector,
      error: err(m.bisError),
      projectionAlongBisector: err(m.bisProjection),
      note: "S–T is the internal bisector of angle ASB (T is the circle point below its centre). The core measures how far P is off that line and how far along it from S it lies.",
    },
    angleASB: round(m.asbAngle, 4),
    arc: {
      sideOfChordAB: side,
      description: side < 0
        ? "S is on the arc opposite the chord AB -- the starting arc, where angle ASB is 120° and the two tips meet on the bisector"
        : side > 0
          ? "S is on the other arc of chord AB, where angle ASB is 60° and the two tips are 2·|BC| apart"
          : "S lies on the chord AB, where the secants are degenerate",
    },
    triangles: [
      triangle("ACP", "AC", "P", g.A, g.C, g.P, m.acpError, claims.equilateralACP),
      triangle("DBR", "DB", "R", g.D, g.B, g.R, m.dbrError, claims.equilateralDBR),
      triangle("ADM", "AD", "M", g.A, g.D, g.M, m.admError, claims.equilateralADM),
      triangle("BCN", "BC", "N", g.B, g.C, g.N, m.bcnError, claims.equilateralBCN),
      triangle("ABT", "AB", "T", g.A, g.B, g.T, m.abtError, claims.equilateralABT),
    ],
    equalSides: {
      AD: r6(K.dist(g.A, g.D)), BC: r6(K.dist(g.B, g.C)),
      error: err(m.adbcError), holds: claims.adEqualsBC,
    },
    diagonalAngleDegrees: round(m.diagAngle, 4),
    claims,
    measures: measuresView(m),
    result: K.result(),
    status: K.describe(s),
  };
}

export function actions(): GameActions {
  return {
    tips_and_bisector: {
      describe:
        "Build the diagram and report where the two tips land: turn C about A by +60° to get P, turn D about B by -60° to get R. When S is on the arc opposite the chord AB, angle ASB is 120° and P = R at one point on the bisector S–T; on the other arc angle ASB is 60° and the tips are 2·|BC| apart. Returns both tips, their separation, the bisector residuals, angle ASB, the equilateral triangles ACP, DBR, ADM, BCN and ABT, AD = BC, and the core's own status. Optional S, C, D accept [x, y] or { x, y } in the 400 x 300 board (y downward), plus optional names/construction/hint flags; S is snapped to the circle and C, D to their secants. Omit S for the opening figure, or pass S = [200, 250] to see the tips separate on the other arc.",
      args: '{ "S": [200, 54] }',
      run: (args) => {
        const { K, s, g } = geometryFrom(args);
        const view = reading(K, s, g);
        return {
          ...view,
          note: view.arc.sideOfChordAB < 0
            ? `Angle ASB is ${view.angleASB}° on the starting arc, so the two rotations give one tip at ${JSON.stringify(view.tips.commonPoint)} on the bisector (separation ${errText(view.tips.separation)} board units). Triangles ACP and DBR are equilateral and AD = BC = ${view.equalSides.BC}.`
            : `Angle ASB is ${view.angleASB}° on the other arc, so the tips P and R are ${errText(view.tips.separation)} board units apart instead of meeting; that is twice the common distance |BC| = ${view.equalSides.BC}. The equilateral triangles and AD = BC still hold.`,
        };
      },
    },
    arc_sweep: {
      describe:
        "Sweep S around the illustration's circle at `samples` equally spaced angles (a whole number from 1 to 48, default 24), using the real core to move S, C and D each time. Reports for each drawable position the arc of chord AB, angle ASB, the P–R separation, whether the tips coincide and lie on the bisector, and whether triangle ABT is equilateral; then summarises the starting arc (120°, tips meet) against the other arc (60°, tips 2·|BC| apart). Optional S, C, D and options set the base picture before the sweep (same argument formats as tips_and_bisector).",
      args: '{ "samples": 24 }',
      run: (args) => {
        const K = core();
        const raw = args.samples === undefined || args.samples === null ? 24 : Number(args.samples);
        if (!Number.isInteger(raw) || raw < 1 || raw > 48) {
          throw new Error('"samples" must be a whole number from 1 to 48');
        }
        const base = buildState(args);
        type SweepRow = {
          k: number; angleDegrees: number; S: Point; drawable: boolean;
          reason?: string; sideOfChordAB?: number; angleASB?: number;
          separation?: number | null; coincide?: boolean; onBisector?: boolean;
          equilateralABT?: boolean; P?: Point; R?: Point;
        };
        const rows: SweepRow[] = [];
        for (let k = 0; k < raw; k++) {
          const t = (2 * Math.PI * k) / raw;
          const p = K.point(
            base.circle.c.x + base.circle.r * Math.cos(t),
            base.circle.c.y + base.circle.r * Math.sin(t),
          );
          const s = K.move(base, "S", p);
          const g = K.geometry(s);
          if (!g) {
            rows.push({ k, angleDegrees: round((t * 180) / Math.PI, 4), S: pt(s.S),
              drawable: false, reason: "S too close to A or B for the core to draw" });
            continue;
          }
          rows.push({
            k, angleDegrees: round((t * 180) / Math.PI, 4), S: pt(s.S), drawable: true,
            sideOfChordAB: K.side(g.A, g.B, g.S),
            angleASB: round(g.measures.asbAngle, 4),
            separation: err(g.measures.prError),
            coincide: g.claims.apexesCoincide,
            onBisector: g.claims.onBisector,
            equilateralABT: g.claims.equilateralABT,
            P: pt(g.P), R: pt(g.R),
          });
        }
        const drawn = rows.filter((row): row is SweepRow & { drawable: true; sideOfChordAB: number } =>
          row.drawable === true);
        const starting = drawn.filter((row) => row.sideOfChordAB < 0);
        const other = drawn.filter((row) => row.sideOfChordAB > 0);
        const twiceDistance = round(2 * Math.abs(base.length), 4);
        const nearTwice = (v: number | null | undefined): boolean =>
          v !== null && v !== undefined && Math.abs(v - twiceDistance) <= 1e-4 * Math.max(1, twiceDistance);
        const startSummary = {
          count: starting.length,
          allASB120: starting.length > 0 && starting.every((row) => Math.abs((row.angleASB ?? 0) - 120) < 1e-4),
          allTipsCoincide: starting.length > 0 && starting.every((row) => row.coincide === true),
          allOnBisector: starting.length > 0 && starting.every((row) => row.onBisector === true),
        };
        const otherSummary = {
          count: other.length,
          allASB60: other.length > 0 && other.every((row) => Math.abs((row.angleASB ?? 0) - 60) < 1e-4),
          allTipsSeparated: other.length > 0 && other.every((row) => row.coincide === false),
          separationEqualsTwiceLength: other.length > 0 && other.every((row) => nearTwice(row.separation)),
        };
        return {
          samples: raw, drawn: drawn.length, skipped: raw - drawn.length,
          commonDistance: r6(base.length), twiceCommonDistance: twiceDistance,
          startingArc: startSummary, otherArc: otherSummary, rows,
          note:
            `The core drew ${drawn.length} of ${raw} positions. On the starting arc (opposite chord AB) angle ASB is 120° at ` +
            `${startSummary.count} positions and the tips coincide on the bisector at ${starting.filter((row) => row.coincide).length} of them; ` +
            `on the other arc angle ASB is 60° at ${otherSummary.count} positions and the tips separate by ${twiceDistance} board units ` +
            `at ${other.filter((row) => nearTwice(row.separation)).length} of them, exactly twice the common distance |BC| = |AD| = ${r6(base.length)}. ` +
            "Triangle ABT stays equilateral throughout, but the page's coincidence claim is true only on the 120° arc.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equiloc Quad 2Tri 120 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equiloc Quad 2Tri 120 position must be an object");
  }
  const saved = {
    A: readPoint(state.A, "A"), B: readPoint(state.B, "B"),
    C: readPoint(state.C, "C"), D: readPoint(state.D, "D"),
    S: readPoint(state.S, "S"), T: readPoint(state.T, "T"),
    P: readPoint(state.P, "P"), R: readPoint(state.R, "R"),
    M: readPoint(state.M, "M"), N: readPoint(state.N, "N"),
    length: num(state, "length"),
    circle: readCircle(state.circle, "circle"),
    options: readOptions(state.options && typeof state.options === "object"
      ? state.options as Json : {}),
  };
  const savedClaims: Json = state.claims && typeof state.claims === "object"
    && !Array.isArray(state.claims) ? state.claims as Json : {};
  const savedMeasures: Json = state.measures && typeof state.measures === "object"
    && !Array.isArray(state.measures) ? state.measures as Json : {};

  /* compute() re-locates C and D from `length`, exactly as the page repaints. */
  const coreState: State = {
    A: saved.A, B: saved.B, C: saved.C, D: saved.D, S: saved.S, T: saved.T,
    length: saved.length, circle: saved.circle, options: saved.options, explored: true,
  };
  const K = core();
  const g = K.geometry(coreState);
  if (!g) {
    return {
      ...state, stateVersion, valid: false,
      note: "The saved points are degenerate for the core (C or D is within a unit of S, or the circle is undefined), so there are no rotated tips to measure. Move a handle on the page and look again.",
    };
  }
  const coreReading = reading(K, coreState, g);
  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number, value: number): void => {
    differences.push({ field, page: r6(page), core: r6(value), diff: round(Math.abs(page - value), 9) });
  };
  for (const key of ["C", "D", "P", "R", "M", "N"] as const) {
    compare(`${key}.x`, saved[key].x, g[key].x);
    compare(`${key}.y`, saved[key].y, g[key].y);
  }
  for (const key of Object.keys(g.measures) as (keyof Measures)[]) {
    if (typeof savedMeasures[key] === "number") {
      compare(`measures.${key}`, Number(savedMeasures[key]), g.measures[key]);
    }
  }
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );
  const claimsAgree = Object.keys(savedClaims).every(
    (key) => savedClaims[key] === (g.claims as unknown as Json)[key],
  );

  return {
    ...state,
    stateVersion,
    saved: { ...saved, claims: savedClaims, measures: savedMeasures },
    valid: true,
    core: coreReading,
    coreDescription: K.describe(coreState),
    savedMatchesCore,
    claimsAgree,
    differences,
    note:
      "Track.state saved A, B, C, D, S, T, the rotated tips P and R, the helper points M and N, the common signed distance, the circle, the display options and the page's own claims and residuals, in board units. " +
      "The real core rebuilds C and D from that distance, makes the two 60-degree rotations, and checks whether P = R on the bisector of angle ASB (the blue S–T line). " +
      (savedMatchesCore && claimsAgree
        ? "The saved numbers and claims agree with a fresh core construction."
        : "Some saved numbers or claims differ from the core rebuild; see `differences`, and trust `core` for the true reading."),
  };
}
