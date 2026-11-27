/*
 * run_game_logic actions and saved-position reader for Equilic Quadrilateral I,
 * A Variation (Alexander Bogomolny's EquilocQuad1Tri applet).
 *
 * A and B are fixed on the board's circle; S is a free handle, while C and D
 * slide along the lines B-S and A-S at the same (signed) distance from B and A,
 * so AD = BC at every angle. Q is the apex of the isosceles triangle on CD
 * whose angle equals angle BSA. The real core puts Q exactly at the midpoint
 * of the circumcircle arc AB through S (and QA = QB) while S is on the same
 * side of AB as the opening S; move S to the other side and the reflected
 * apex `otherQ` is the midpoint instead — the applet never switches handedness.
 * The cut-the-knot page's literal sentence, "S is the midpoint of that arc",
 * is false except in the symmetric case where S is equidistant from A and B.
 *
 * Every number below is measured by the real core in
 * equiloc-quad-1-tri/equiloc-quad-1-tri-core.js, copied into src/generated/cores/
 * at build time. Coordinates are board units of the 400 x 300 viewBox, with y
 * down. This is a demo: there is no win or loss, only an explored picture.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type Measures = {
  adbcError: number; apexAngleError: number; arcError: number;
  otherArcError: number; qaError: number; sArcError: number;
};
type Claims = {
  adEqualsBC: boolean; apexAngleMatches: boolean; qIsArcMidpoint: boolean;
  otherIsArcMidpoint: boolean; pageClaimLiteral: boolean; qSameSideAsS: boolean;
};
type Geometry = {
  A: Point; B: Point; S: Point; C: Point; D: Point;
  Q: Point | null; otherQ: Point | null; arc: Point; circle: Circle;
  angle: number; length: number; measures: Measures; claims: Claims; tol: number;
};
type Options = { names: boolean; construction: boolean; hint: boolean };
type State = {
  A: Point; B: Point; S: Point; C: Point; D: Point;
  length: number; options: Options; explored: boolean;
};
type Core = {
  CIRCLE: Circle;
  point(x: number, y: number): Point;
  dist(p: Point, q: Point): number;
  sub(a: Point, b: Point): Point;
  cross(a: Point, b: Point): number;
  side(a: Point, b: Point, p: Point): number;
  computeAngle(p: Point, q: Point, r: Point): number;
  start(options?: Json): State;
  move(state: State, name: string, p: Point): State;
  compute(state: State): Geometry | null;
  geometry(state: State): Geometry | null;
  describe(state: State): string;
  result(state: State): null;
};

const core = () => cores["equiloc-quad-1-tri"].EquilocQuad1TriCore as unknown as Core;

/* The core is exact up to floating point; residuals are around 1e-13 units. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const round = (v: number, digits = 6): number =>
  (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const deg = (radians: number): number => r6((radians * 180) / Math.PI);
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
  /* The core defaults names to true, the other two to false. */
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
      /* The core snaps C and D onto their secants; S itself stays free. */
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
      "the core cannot draw this arrangement: move S away from A and B, and keep C and D away from S, so the circumcircle and the isosceles apex stay well defined",
    );
  }
  return { K, s, g };
}

function measuresView(m: Measures) {
  return {
    adbcError: err(m.adbcError), apexAngleError: err(m.apexAngleError),
    arcError: err(m.arcError), otherArcError: err(m.otherArcError),
    qaError: err(m.qaError), sArcError: err(m.sArcError),
  };
}

/** Everything the core can say about one picture, in tutor-friendly units. */
function reading(K: Core, s: State, g: Geometry) {
  const m = g.measures, claims = g.claims;
  return {
    points: {
      A: pt(g.A), B: pt(g.B), S: pt(g.S), C: pt(g.C), D: pt(g.D),
      Q: g.Q ? pt(g.Q) : null, otherQ: g.otherQ ? pt(g.otherQ) : null,
      arcMidpoint: pt(g.arc),
    },
    circle: { center: pt(g.circle.c), radius: r6(g.circle.r) },
    commonLength: r6(g.length),
    angleBSA: deg(g.angle),
    equilic: {
      sides: { AD: r6(K.dist(g.A, g.D)), BC: r6(K.dist(g.B, g.C)) },
      adMinusBcError: err(m.adbcError),
      adEqualsBC: claims.adEqualsBC,
    },
    apex: {
      angleCQD: g.Q ? round((K.computeAngle(g.Q, g.C, g.D) * 180) / Math.PI, 6) : null,
      angleError: err(m.apexAngleError),
      angleMatchesBSA: claims.apexAngleMatches,
    },
    arc: {
      qIsArcMidpoint: claims.qIsArcMidpoint,
      otherIsArcMidpoint: claims.otherIsArcMidpoint,
      qToArcError: err(m.arcError),
      otherToArcError: err(m.otherArcError),
      qaMinusQbError: err(m.qaError),
      sToArcError: err(m.sArcError),
      qSameSideAsS: claims.qSameSideAsS,
      sideOfChordAB: r6(K.side(g.A, g.B, g.S)),
      /* The page's sentence read literally: is S itself the arc's midpoint? */
      pageClaimLiteral: claims.pageClaimLiteral,
    },
    measures: measuresView(m),
    claims,
    result: K.result(s),
    status: K.describe(s),
  };
}

export function actions(): GameActions {
  return {
    arc_midpoint: {
      describe:
        "For the equilic quadrilateral variation, rebuild the isosceles triangle on CD whose apex angle equals angle BSA and check that Q is exactly the midpoint of the circumcircle arc AB through S, with QA = QB. Also checks the page's literal sentence that S is that midpoint (false here unless S is equidistant from A and B) and that AD = BC; S, C and D are optional [x, y] or { x, y } points on the 400 x 300 board, omitted for the opening figure.",
      args: '{ "S": [298.47261475902013, 104.92879806048919] }',
      run: (args) => {
        const { K, s, g } = geometryFrom(args);
        const view = reading(K, s, g);
        const arc = view.arc;
        return {
          ...view,
          note:
            `Q is ${arc.qIsArcMidpoint ? "exactly" : "not"} at the midpoint of the arc AB through S ` +
            `(off by ${errText(arc.qToArcError)} board units), and QA - QB is ${errText(arc.qaMinusQbError)}; ` +
            `its apex angle matches angle BSA to ${errText(view.apex.angleError)}. ` +
            `The page's literal claim that S is the midpoint is ${arc.pageClaimLiteral
              ? "true here only because S happens to be equidistant from A and B"
              : "false here"} (S is ${errText(arc.sToArcError)} units from that midpoint). ` +
            `The constructed apex is ${arc.qSameSideAsS ? "on" : "off"} the same side of AB as S — the applet keeps one handedness of apex, ` +
            `so on the far side the reflected apex would be the midpoint. AD and BC agree to ${errText(view.equilic.adMinusBcError)}.`,
        };
      },
    },
    handedness_sweep: {
      describe:
        "Sweep S around the board's base circle at `samples` equally spaced angles (integer 1 to 48, default 24) with the real core, and report for each drawable position which side of chord AB S is on and which apex — the constructed Q or its reflection otherQ — lands on the circumcircle arc midpoint. This exposes the fixed-handedness quirk: Q is the midpoint while S is on the starting side of AB, the reflected apex is on the other side, and the page's literal S-is-midpoint claim holds only in the symmetric positions where S is equidistant from A and B. Optional S, C, D and options set the base picture before the sweep (same formats as arc_midpoint).",
      args: '{ "samples": 24 }',
      run: (args) => {
        const K = core();
        const raw = args.samples === undefined || args.samples === null ? 24 : Number(args.samples);
        if (!Number.isInteger(raw) || raw < 1 || raw > 48) {
          throw new Error('"samples" must be a whole number from 1 to 48');
        }
        const base = buildState(args);
        type SweepRow = {
          k: number; angleDegrees: number; S: Point; drawable: boolean; reason?: string;
          sideOfChordAB?: number; qIsArcMidpoint?: boolean; otherIsArcMidpoint?: boolean;
          pageClaimLiteral?: boolean; arcError?: number | null;
          otherArcError?: number | null; sArcError?: number | null;
        };
        const rows: SweepRow[] = [];
        for (let k = 0; k < raw; k++) {
          const t = (2 * Math.PI * k) / raw;
          const p = K.point(
            K.CIRCLE.c.x + K.CIRCLE.r * Math.cos(t),
            K.CIRCLE.c.y + K.CIRCLE.r * Math.sin(t),
          );
          const s = K.move(base, "S", p);
          const g = K.geometry(s);
          if (!g) {
            rows.push({ k, angleDegrees: deg(t), S: pt(s.S), drawable: false,
              reason: "S too close to A or B for the core to draw" });
            continue;
          }
          rows.push({
            k, angleDegrees: deg(t), S: pt(s.S), drawable: true,
            sideOfChordAB: r6(K.side(g.A, g.B, g.S)),
            qIsArcMidpoint: g.claims.qIsArcMidpoint,
            otherIsArcMidpoint: g.claims.otherIsArcMidpoint,
            pageClaimLiteral: g.claims.pageClaimLiteral,
            arcError: err(g.measures.arcError),
            otherArcError: err(g.measures.otherArcError),
            sArcError: err(g.measures.sArcError),
          });
        }
        const drawn = rows.filter((row) => row.drawable);
        const qCount = drawn.filter((row) => row.qIsArcMidpoint).length;
        const otherCount = drawn.filter((row) => row.otherIsArcMidpoint).length;
        const pageCount = drawn.filter((row) => row.pageClaimLiteral).length;
        const qOnlyOnStartingSide = drawn.length > 0 && drawn.every(
          (row) => row.qIsArcMidpoint === ((row.sideOfChordAB ?? 0) < 0),
        );
        return {
          samples: raw, drawn: drawn.length, skipped: raw - drawn.length,
          qMidpointCount: qCount, otherMidpointCount: otherCount,
          pageLiteralCount: pageCount, qOnlyOnStartingSide,
          rows,
          note:
            `At all ${drawn.length} drawable positions the core's Q is the arc midpoint exactly when S lies on the starting side of AB ` +
            `(side of chord AB negative): ${qCount} of ${drawn.length} positions; on the remaining ${otherCount} the reflected apex from -angle is the midpoint. ` +
            `The page's literal claim that S itself is the midpoint holds only ${pageCount} times, where S is on the perpendicular bisector of AB. ` +
            `${qOnlyOnStartingSide ? "This confirms the fixed-handedness quirk." : "Some positions depart from the expected handedness pattern; inspect the rows."}`,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equilic Quadrilateral I, A Variation state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved position must be an object");
  }

  /* The page's degenerate save carries only these fields (no circle or Q). */
  if (state.degenerate === true) {
    return {
      ...state, stateVersion, valid: false,
      note: "The page saved a degenerate arrangement: S, C or D collapsed a secant, so there is no circumcircle, Q or arc midpoint to measure. Move a handle away from A, B and S and look again.",
    };
  }

  const saved = {
    A: readPoint(state.A, "A"), B: readPoint(state.B, "B"),
    S: readPoint(state.S, "S"), C: readPoint(state.C, "C"), D: readPoint(state.D, "D"),
    Q: state.Q === undefined || state.Q === null ? null : readPoint(state.Q, "Q"),
    arc: readPoint(state.arc, "arc"),
    angle: num(state, "angle"),
    length: num(state, "length"),
    options: readOptions(state.options && typeof state.options === "object" && !Array.isArray(state.options)
      ? state.options as Json : {}),
  };
  const savedClaims: Json = state.claims && typeof state.claims === "object"
    && !Array.isArray(state.claims) ? state.claims as Json : {};
  const savedMeasures: Json = state.measures && typeof state.measures === "object"
    && !Array.isArray(state.measures) ? state.measures as Json : {};

  /* compute() re-locates C and D from `length`, exactly as the page repaints. */
  const coreState: State = {
    A: saved.A, B: saved.B, S: saved.S, C: saved.C, D: saved.D,
    length: saved.length, options: saved.options, explored: true,
  };
  const K = core();
  const g = K.geometry(coreState);
  if (!g) {
    return {
      ...state, stateVersion, valid: false,
      note: "The saved points are degenerate for the core (S too close to A or B, or C and D cannot be relocated at that length), so there is no Q or arc midpoint to measure. Move a handle on the page and look again.",
    };
  }
  const coreReading = reading(K, coreState, g);
  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number, value: number): void => {
    differences.push({ field, page: r6(page), core: r6(value), diff: round(Math.abs(page - value), 9) });
  };
  compare("angle", saved.angle, g.angle);
  for (const key of ["C", "D", "arc"] as const) {
    compare(`${key}.x`, saved[key].x, g[key].x);
    compare(`${key}.y`, saved[key].y, g[key].y);
  }
  if (saved.Q && g.Q) {
    compare("Q.x", saved.Q.x, g.Q.x);
    compare("Q.y", saved.Q.y, g.Q.y);
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
      "Track.state saved A, B, S, C, D, the constructed Q and arc midpoint, angle BSA, the common signed length, the display options and the page's own claims and residuals, in board units. " +
      "The real core re-locates C and D from that length along B-S and A-S, rebuilds the circumcircle and the isosceles apex, and measures Q's distance to the arc midpoint, QA - QB and the page's literal S-is-midpoint claim. " +
      (savedMatchesCore && claimsAgree
        ? "The saved numbers and claims agree with a fresh core construction."
        : "Some saved numbers or claims differ from the core rebuild; see `differences`, and trust `core` for the true reading."),
  };
}
