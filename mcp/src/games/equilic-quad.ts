/*
 * run_game_logic actions and saved-position reader for Equilic Quad
 * (Alexander Bogomolny's EquilicQuad applet).
 *
 * A, B and S lie on one circle; C and D sit the same distance from B and A
 * along the secants to S. Since both secants meet at S the quadrilateral ABCD
 * is "equilic": AD = BC and the two lines incline at 60 degrees (the opening
 * arc gives the angle ASB = 60 degrees). Rotating C about A, C about D and B
 * about D by 60 degrees in the same handedness builds the equilateral
 * triangles ACP, DCQ and DBR; their apexes P, Q, R and S are collinear. The
 * page's proof also draws triangle AQB, which is equilateral only while S is
 * on the arc opposite the chord AB (the arc containing the opening S) -- on
 * the other arc ASB is 120 degrees and AQB is not equilateral, but the line
 * P-Q-R-S still holds.
 *
 * Every number below is measured by the real core in
 * equilic-quad/equilic-quad-core.js, copied into src/generated/cores/ at build
 * time. Coordinates are board units of the illustration's 400 x 300 viewBox,
 * with y down. This is a demo: there is no win or loss, only an explored
 * picture. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type Measures = {
  pqrError: number; sError: number; aqbError: number; acpError: number;
  dcqError: number; dbrError: number; pqError: number; qrError: number;
  adbcError: number;
};
type Claims = {
  collinearPQR: boolean; collinearS: boolean; equilateralAQB: boolean;
  equilateralACP: boolean; equilateralDCQ: boolean; equilateralDBR: boolean;
  pqEqualsBC: boolean; qrEqualsAD: boolean; adEqualsBC: boolean;
  awayFromAB: boolean;
};
type Geometry = {
  A: Point; B: Point; C: Point; D: Point; S: Point;
  P: Point; Q: Point; R: Point; circle: Circle;
  measures: Measures; claims: Claims; extended: [Point, Point] | null;
};
type Options = { names: boolean; construction: boolean; hint: boolean };
type State = {
  A: Point; B: Point; C: Point; D: Point; S: Point; length: number;
  circle: Circle; options: Options; explored: boolean;
};
type Core = {
  CIRCLE: Circle;
  S_ANGLE: number;
  point(x: number, y: number): Point;
  dist(p: Point, q: Point): number;
  dot(a: Point, b: Point): number;
  sub(a: Point, b: Point): Point;
  side(a: Point, b: Point, p: Point): number;
  start(options?: Json): State;
  move(state: State, name: string, p: Point): State;
  compute(state: State): Geometry | null;
  geometry(state: State): Geometry | null;
  describe(state: State): string;
  result(state: State): null;
};

const core = () => cores["equilic-quad"].EquilicQuadCore as unknown as Core;

/* The core is exact up to floating point; its residuals are ~1e-13 units. */
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
      "the core cannot draw this arrangement: move S away from A and B, or C and D away from S, so the three apexes stay apart",
    );
  }
  return { K, s, g };
}

/** Angle at v between the rays to p and q, in degrees. */
function angleDeg(K: Core, v: Point, p: Point, q: Point): number {
  const a = K.sub(p, v), b = K.sub(q, v);
  const denom = K.dist(v, p) * K.dist(v, q);
  if (!(denom > 0)) return NaN;
  const cosine = Math.max(-1, Math.min(1, K.dot(a, b) / denom));
  return deg(Math.acos(cosine));
}

function measuresView(m: Measures) {
  return {
    pqrError: err(m.pqrError), sError: err(m.sError), aqbError: err(m.aqbError),
    acpError: err(m.acpError), dcqError: err(m.dcqError), dbrError: err(m.dbrError),
    pqError: err(m.pqError), qrError: err(m.qrError), adbcError: err(m.adbcError),
  };
}

/** Everything the core can say about one picture, in tutor-friendly units. */
function reading(K: Core, s: State, g: Geometry) {
  const m = g.measures, claims = g.claims;
  const triangles = [
    { name: "ACP", base: "AC", apex: "P",
      vertices: { A: pt(g.A), C: pt(g.C), P: pt(g.P) },
      sides: { AC: r6(K.dist(g.A, g.C)), CP: r6(K.dist(g.C, g.P)), PA: r6(K.dist(g.P, g.A)) },
      error: err(m.acpError), equilateral: claims.equilateralACP },
    { name: "DCQ", base: "DC", apex: "Q",
      vertices: { D: pt(g.D), C: pt(g.C), Q: pt(g.Q) },
      sides: { DC: r6(K.dist(g.D, g.C)), CQ: r6(K.dist(g.C, g.Q)), QD: r6(K.dist(g.Q, g.D)) },
      error: err(m.dcqError), equilateral: claims.equilateralDCQ },
    { name: "DBR", base: "DB", apex: "R",
      vertices: { D: pt(g.D), B: pt(g.B), R: pt(g.R) },
      sides: { DB: r6(K.dist(g.D, g.B)), BR: r6(K.dist(g.B, g.R)), RD: r6(K.dist(g.R, g.D)) },
      error: err(m.dbrError), equilateral: claims.equilateralDBR },
  ];
  const aqb = {
    vertices: { A: pt(g.A), Q: pt(g.Q), B: pt(g.B) },
    sides: { QA: r6(K.dist(g.Q, g.A)), QB: r6(K.dist(g.Q, g.B)), AB: r6(K.dist(g.A, g.B)) },
    error: err(m.aqbError), equilateral: claims.equilateralAQB,
  };
  const line = {
    points: { P: pt(g.P), Q: pt(g.Q), R: pt(g.R), S: pt(g.S) },
    pqrError: err(m.pqrError), sError: err(m.sError),
    collinearPQR: claims.collinearPQR, collinearS: claims.collinearS,
    holds: claims.collinearPQR && claims.collinearS,
    extendedLine: g.extended ? { from: pt(g.extended[0]), to: pt(g.extended[1]) } : null,
  };
  const atS = angleDeg(K, g.S, g.A, g.B);
  const equilic = {
    sides: { AD: r6(K.dist(g.A, g.D)), BC: r6(K.dist(g.B, g.C)),
      PQ: r6(K.dist(g.P, g.Q)), QR: r6(K.dist(g.Q, g.R)) },
    gaps: { ADminusBC: err(m.adbcError), PQminusBC: err(m.pqError), QRminusAD: err(m.qrError) },
    equalities: { adEqualsBC: claims.adEqualsBC, pqEqualsBC: claims.pqEqualsBC,
      qrEqualsAD: claims.qrEqualsAD },
    angleASB: round(atS, 4),
    acuteAngleBetweenLinesADandBC: round(Math.min(atS, 180 - atS), 4),
    holds: claims.adEqualsBC && claims.pqEqualsBC && claims.qrEqualsAD,
    note: "AD and BC are equal and the two lines cross at 60 degrees on the opening arc (the acute angle is 60 degrees even when S is on the far arc, where ASB itself is 120 degrees).",
  };
  const side = K.side(g.A, g.B, g.S);
  const arc = {
    sideOfChordAB: side,
    description: side < 0
      ? "S is on the arc opposite the chord AB -- the opening arc, where triangle AQB is equilateral"
      : "S is on the other (small) arc of chord AB, where ASB is 120 degrees and AQB is not equilateral",
    awayFromAB: claims.awayFromAB,
  };
  return {
    points: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D), S: pt(g.S),
      P: pt(g.P), Q: pt(g.Q), R: pt(g.R) },
    circle: { center: pt(g.circle.c), radius: r6(g.circle.r) },
    triangles, aqb, line, equilic, arc,
    measures: measuresView(m),
    claims,
    result: K.result(s),
    status: K.describe(s),
  };
}

export function actions(): GameActions {
  return {
    collinearity_and_triangles: {
      describe:
        "For the equilic quadrilateral, rebuild the three equilateral triangles ACP, DCQ and DBR (60-degree rotations of the same handedness) and report their apexes P, Q, R with side lengths, whether P, Q, R and S are collinear with the remaining errors, and triangle AQB (equilateral only on the arc opposite chord AB). Also report AD = BC = PQ = QR and the 60-degree inclination of the two lines. S, C and D are optional [x, y] or { x, y } points on the 400 x 300 board (S is snapped onto the circle by the core, C and D onto their secants); omit them for the opening figure.",
      args: '{ "S": [294.8547117632492, 107.13582568932148] }',
      run: (args) => {
        const { K, s, g } = geometryFrom(args);
        const view = reading(K, s, g);
        const allEquilateral = view.triangles.every((t) => t.equilateral);
        return {
          ...view,
          note:
            `Rotating by 60 degrees gives three equilateral triangles ACP, DCQ and DBR (largest side error ` +
            `${errText(Math.max(...view.triangles.map((t) => t.error ?? Infinity)))} board units), and their tips line up with S ` +
            `(off by ${errText(view.line.sError)}). AD = BC = ${view.equilic.sides.AD} and the two lines cross at ` +
            `${view.equilic.acuteAngleBetweenLinesADandBC} degrees. ` +
            (view.aqb.equilateral
              ? "S is on the opening arc, so triangle AQB is equilateral as in the article's proof."
              : "S is on the far arc, so triangle AQB is not equilateral -- yet P, Q, R and S are still collinear.") +
            (allEquilateral ? "" : " Some triangle claim failed; move the handles apart and try again."),
        };
      },
    },
    arc_sweep: {
      describe:
        "Sweep S around the illustration's circle at `samples` equally spaced angles (integer 1 to 48, default 24) and, using the real core, report for each drawable position S the chord-AB side, the P-Q-R-S collinearity error and whether triangle AQB is equilateral. This shows the line holds for every S while AQB is equilateral only on the arc opposite chord AB; positions where S is too close to A or B (the core cannot draw) are listed as degenerate. Optional S, C, D and options set the base picture before the sweep (same formats as collinearity_and_triangles).",
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
          reason?: string; sideOfChordAB?: number; collinearS?: boolean;
          lineError?: number | null; equilateralAQB?: boolean;
          aqbError?: number | null; angleASB?: number;
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
            rows.push({ k, angleDegrees: deg(t), S: pt(s.S), drawable: false,
              reason: "S too close to A or B for the core to draw" });
            continue;
          }
          rows.push({
            k, angleDegrees: deg(t), S: pt(s.S), drawable: true,
            sideOfChordAB: K.side(g.A, g.B, g.S),
            collinearS: g.claims.collinearS,
            lineError: err(g.measures.sError),
            equilateralAQB: g.claims.equilateralAQB,
            aqbError: err(g.measures.aqbError),
            angleASB: round(angleDeg(K, g.S, g.A, g.B), 4),
          });
        }
        const drawn = rows.filter((row) => row.drawable);
        const lineErrors = drawn.map((row) => row.lineError).filter((v): v is number =>
          typeof v === "number" && Number.isFinite(v));
        const worstLine = lineErrors.length ? Math.max(...lineErrors) : null;
        const aqbOnOppositeArc = drawn.filter((row) => (row.sideOfChordAB ?? 0) < 0);
        const aqbOnSmallArc = drawn.filter((row) => (row.sideOfChordAB ?? 0) > 0);
        const oppositeAllEqual = aqbOnOppositeArc.length > 0 &&
          aqbOnOppositeArc.every((row) => row.equilateralAQB === true);
        const smallNoneEqual = aqbOnSmallArc.every((row) => row.equilateralAQB === false);
        return {
          samples: raw, drawn: drawn.length, skipped: raw - drawn.length,
          openingArc: "opposite the chord AB (S above AB in board coordinates), containing the opening S",
          worstLineError: worstLine === null ? null : r6(worstLine),
          collinearEverywhere: drawn.length > 0 && drawn.every((row) => row.collinearS === true),
          aqbOnOppositeArc: { count: aqbOnOppositeArc.length, allEquilateral: oppositeAllEqual },
          aqbOnSmallArc: { count: aqbOnSmallArc.length, noneEquilateral: smallNoneEqual },
          rows,
          note:
            `At all ${drawn.length} drawable positions the line P-Q-R-S holds (worst error ` +
            `${errText(worstLine === null ? null : r6(worstLine))} board units), while triangle AQB is equilateral ` +
            `only for S on the arc opposite chord AB (${aqbOnOppositeArc.length} of ${aqbOnOppositeArc.length} such samples; ` +
            `${aqbOnSmallArc.filter((row) => row.equilateralAQB).length} of ${aqbOnSmallArc.length} on the small arc). ` +
            "On the small arc ASB is 120 degrees, so the proof's equilateral AQB disappears but the collinearity does not.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equilic Quad state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equilic Quad position must be an object");
  }
  const saved = {
    A: readPoint(state.A, "A"), B: readPoint(state.B, "B"),
    C: readPoint(state.C, "C"), D: readPoint(state.D, "D"),
    S: readPoint(state.S, "S"),
    P: readPoint(state.P, "P"), Q: readPoint(state.Q, "Q"), R: readPoint(state.R, "R"),
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
    A: saved.A, B: saved.B, S: saved.S, C: saved.C, D: saved.D,
    length: saved.length, circle: saved.circle, options: saved.options, explored: true,
  };
  const K = core();
  const g = K.geometry(coreState);
  if (!g) {
    return {
      ...state, stateVersion, valid: false,
      note: "The saved points are degenerate for the core (C or D is within a unit of S, or the circle is undefined), so there is no P-Q-R-S line to measure. Move a handle on the page and look again.",
    };
  }
  const coreReading = reading(K, coreState, g);
  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number, value: number): void => {
    differences.push({ field, page: r6(page), core: r6(value), diff: round(Math.abs(page - value), 9) });
  };
  for (const key of ["C", "D", "P", "Q", "R"] as const) {
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
      "Track.state saved A, B, C, D, S, the three apexes P, Q, R, the common signed length, the circle, the display options and the page's own claims and residuals, in board units. " +
      "The real core rebuilds the three 60-degree triangles and the line through P, Q, R and S from A, B, S and that length, then checks collinearity, equilateral AQB (only on the opening arc) and AD = BC at this position. " +
      (savedMatchesCore && claimsAgree
        ? "The saved numbers and claims agree with a fresh core construction."
        : "Some saved numbers or claims differ from the core rebuild; see `differences`, and trust `core` for the true reading."),
  };
}
