/*
 * run_game_logic actions and saved-position reader for Max Common Chord 2.
 *
 * The real core is max-common-chord-2/max-common-chord-2-core.js, copied into
 * src/generated/cores/ at build time; every number reported here is measured
 * by it. Two circles meet at P and Q, and a chord through P ends at A on the
 * first circle and B on the second. With E and F the circle centres and O the
 * circumcentre of E, F, Q, the third circle C(O) meets the two circles again
 * at L and M, and S = AL ∩ BM. Hubert Shutrick's invariant is that S is the
 * *centre* of the circle through A, B, Q and always lies on C(O): hence
 * SA = SB = SQ, L, S, M, Q are concyclic, and QP bisects angle LQM. Moving A
 * opposite Q on the first circle makes AQ and BQ diameters, and that is the
 * longest chord through P. This is the second applet in the family: sibling 1
 * reaches the product AP×PB through a radical axis and equal tangents, and
 * sibling 3 maximises the same product with the tangent at S; this page uses
 * equal angles in isosceles triangles and the longest-segment claim instead.
 * Coordinates are the applet's 640 by 460 viewBox units, y downward. See
 * _shared.ts for the module shape. This is a demonstration, with no win or loss.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { x: number; y: number; radius: number };
type Options = { names: boolean; hint: boolean };
type Adjust = "circles" | "chord";
type State = {
  P: Pt; Q: Pt; A: Pt; B: Pt;
  options: Options; adjust: Adjust; explored: boolean;
};
type Measures = {
  sa: number; sb: number; sq: number; ap: number; pb: number; ab: number; apPb: number;
  saSb: number; saSq: number; sbSq: number; sOnO: number; centerOnO: number;
  sIsCenter: number; cyclic: number; bisect: number; crossErr: number;
  diameterErr: number; bDiameterErr: number;
};
type Claims = {
  valid: boolean; throughP: boolean; sOnO: boolean; centerOnO: boolean;
  sIsCenter: boolean; lsmqCyclic: boolean; equalRadii: boolean;
  bisector: boolean; finished: boolean; bothDiameters: boolean;
};
type Geometry = {
  E: Circle; F: Circle; O: Circle; ABQ: Circle; LSQ: Circle | null;
  P: Pt; Q: Pt; A: Pt; B: Pt; R: Pt | null; L: Pt | null; M: Pt | null; S: Pt | null;
  measures: Measures; claims: Claims; tol: number; finishTol: number;
};
interface Core {
  VIEW: { width: number; height: number };
  RAW_START: Record<string, Pt>;
  HANDLES: string[];
  OPTIONS: string[];
  FINISH_TOL: number;
  point(x: number, y: number): Pt;
  dist(p: Pt, q: Pt): number;
  start(): State;
  move(s: State, name: string, p: Pt): State;
  setOption(s: State, name: string, on: boolean): State;
  setAdjust(s: State, mode: Adjust): State;
  optimal(s: State): State;
  compute(s: State): Geometry | null;
  geometry(s: State): Geometry | null;
  result(s: State): null;
  describe(s: State): string;
  position(s: State): Json;
}

const core = (): Core => cores["max-common-chord-2"].MaxCommonChord2Core as unknown as Core;

/* Only what we print is rounded; the core keeps full precision. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const cn = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const rp = (p: Pt | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const rc = (c: Circle | null | undefined): { x: number; y: number; radius: number } | null =>
  c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.radius)
    ? { x: r6(c.x), y: r6(c.y), radius: r6(c.radius) }
    : null;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const same = (a: number, b: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Accept the page's { x, y } points and a tutor's [x, y] points alike. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (isObj(raw)) {
    [x, y] = [Number(raw.x), Number(raw.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** The page has two display boxes, names and hint, directly or under options. */
function readOptions(src: Json, strict: boolean): { options: Options; readable: boolean } {
  const bag: Json = isObj(src.options) ? src.options : src;
  const options: Options = { names: false, hint: false };
  let readable = true;
  for (const key of ["names", "hint"] as const) {
    const v = bag[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") {
      if (strict) throw new Error(`option "${key}" must be true or false`);
      readable = false;
      continue;
    }
    options[key] = v;
  }
  return { options, readable };
}

function readAdjust(src: Json, fallback: Adjust, strict: boolean): { adjust: Adjust; readable: boolean } {
  const v = src.adjust;
  if (v === undefined || v === null) return { adjust: fallback, readable: true };
  if (v === "circles" || v === "chord") return { adjust: v, readable: true };
  if (strict) throw new Error('argument "adjust" must be "circles" or "chord"');
  return { adjust: fallback, readable: false };
}

/**
 * A real core state. An explicit B is used as saved; otherwise the core's
 * move("A") pulls B onto the chord through P, exactly as dragging A does.
 */
function buildState(C: Core, args: Json): State {
  if (!isObj(args)) throw new Error("arguments must be an object with optional P, Q, A, B points");
  const home = C.start();
  const P = readPoint(args.P, "P", home.P);
  const Q = readPoint(args.Q, "Q", home.Q);
  const A = readPoint(args.A, "A", home.A);
  const options = readOptions(args, true).options;
  const adjust = readAdjust(args, home.adjust, true).adjust;
  const hasB = args.B !== undefined && args.B !== null;
  const B = hasB ? readPoint(args.B, "B") : home.B;
  let s: State = { P, Q, A, B, options, adjust, explored: true };
  if (!hasB) s = C.move(s, "A", A);
  return s;
}

function requireGeometry(C: Core, s: State): Geometry {
  const g = C.compute(s);
  if (!g || !g.claims.valid) {
    throw new Error("these points make a circle or intersection impossible; move P, Q, A or B and try again");
  }
  if (!g.claims.throughP) {
    throw new Error("A, P and B must lie on one line: pass B too, or omit B so the core fixes it on the chord through P");
  }
  return g;
}

function geometryShape(g: Geometry): Json {
  return {
    circleE: rc(g.E), circleF: rc(g.F), circleEFQ: rc(g.O),
    circleABQ: rc(g.ABQ), circleLSQ: rc(g.LSQ),
    L: rp(g.L), M: rp(g.M), S: rp(g.S), R: rp(g.R),
  };
}

function lengths(m: Measures): Json {
  return {
    SA: cn(m.sa), SB: cn(m.sb), SQ: cn(m.sq),
    AP: cn(m.ap), PB: cn(m.pb), AB: cn(m.ab), APxPB: cn(m.apPb),
  };
}

function errors(m: Measures): Json {
  return {
    SA_minus_SB: cn(m.saSb), SA_minus_SQ: cn(m.saSq), SB_minus_SQ: cn(m.sbSq),
    S_minus_circleEFQ: cn(m.sOnO), centreABQ_minus_circleEFQ: cn(m.centerOnO),
    S_minus_centreABQ: cn(m.sIsCenter), M_minus_circleLSQ: cn(m.cyclic),
    angleLQP_minus_PQM: cn(m.bisect), chordCollinearity: cn(m.crossErr),
    AQDiameterTest: cn(m.diameterErr), BQDiameterTest: cn(m.bDiameterErr),
  };
}

const SIBLINGS =
  "This is Max Common Chord 2, not sibling 1 (the radical-axis and equal-tangent route to AP×PB) " +
  "or sibling 3 (Shutrick's product-maximising tangent at S): this applet checks the equal-angle " +
  "invariants of S and the longest-chord claim.";

/** The core's opening chord on the applet's 640 x 460 board, with A, P, B collinear. */
const OPENING_ARGS =
  '{"P":[320,276],"Q":[320,368],"A":[192,322],"B":[489.0983783783786,215.2302702702702]}';
const OPTIMUM_ARGS =
  '{"P":[320,276],"Q":[320,368],"A":[192,322],"B":[489.0983783783786,215.2302702702702],"samples":72}';

/** Sweep chord directions through the core's "adjust chord" mode, circles fixed. */
function sweep(C: Core, s: State, samples: number): Json {
  const g = requireGeometry(C, s);
  const E = g.E, r = E.radius, Q = s.Q;
  const opposite = C.point(2 * E.x - Q.x, 2 * E.y - Q.y); // AQ a diameter of C(E)
  const theta0 = Math.atan2(opposite.y - E.y, opposite.x - E.x);
  const chordState = C.setAdjust(s, "chord");
  const rows: Json[] = [];
  const raw: { turn: number; ab: number; product: number }[] = [];
  let atDiameter: Json | null = null;
  let diameterIndex = -1;
  for (let i = 0; i < samples; i++) {
    const theta = theta0 + (i - Math.floor(samples / 2)) * 2 * Math.PI / samples;
    const a = C.point(E.x + r * Math.cos(theta), E.y + r * Math.sin(theta));
    const si = C.move(chordState, "A", a);
    const gi = C.compute(si);
    if (!gi || !gi.claims.valid || !gi.claims.throughP) continue;
    const turn = (theta - theta0) * 180 / Math.PI;
    const row: Json = {
      turnDeg: cn(turn), A: rp(si.A), B: rp(si.B),
      AB: cn(gi.measures.ab), APxPB: cn(gi.measures.apPb),
      finished: gi.claims.finished, bothDiameters: gi.claims.bothDiameters,
    };
    rows.push(row);
    raw.push({ turn, ab: gi.measures.ab, product: gi.measures.apPb });
    if (i === Math.floor(samples / 2)) {
      diameterIndex = raw.length - 1;
      atDiameter = {
        ...row,
        diameterTest: cn(gi.measures.diameterErr),
        bDiameterTest: cn(gi.measures.bDiameterErr),
      };
    }
  }
  if (!rows.length || !atDiameter || diameterIndex < 0) {
    throw new Error("the core could not draw enough chords through P; move the four points and try again");
  }
  let iLong = 0, iProd = 0;
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].ab > raw[iLong].ab) iLong = i;
    if (raw[i].product > raw[iProd].product) iProd = i;
  }
  const longestIsDiameter = Math.abs(raw[iLong].ab - raw[diameterIndex].ab) <= 1e-6;
  const productPeaksElsewhere = Math.abs(raw[iProd].turn) > 1e-6;
  return {
    samples,
    drawnChords: rows.length,
    stepDeg: cn(360 / samples),
    oppositeQOnCircleE: rp(opposite),
    diameterChord: atDiameter,
    longestChord: { ...rows[iLong], turnDeg: cn(raw[iLong].turn) },
    largestProduct: { ...rows[iProd], turnDeg: cn(raw[iProd].turn) },
    longestIsDiameter,
    productPeaksElsewhere,
    productGain: cn(raw[iProd].product - raw[diameterIndex].product),
  };
}

export function actions(): GameActions {
  return {
    shutrick_invariants: {
      describe:
        "Run the real core's construction for two circles through P and Q and a chord through P ending at A and B (points as [x, y] or { x, y } on the 640 x 460 board; give B or let the core fix it on the chord). It reports E, F, O, L, M, S and tests Shutrick's invariants: S = AL ∩ BM lies on C(O), LSMQ is cyclic, QP bisects angle LQM, S is the circumcentre of ABQ with SA = SB = SQ, and AQ/BQ diameter and finish tests. This is Max Common Chord 2, not sibling 1's radical-axis product argument or sibling 3's product-maximising tangent at S; the example uses the core's opening chord.",
      args: OPENING_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = requireGeometry(C, s);
        const m = g.measures;
        return {
          P: rp(s.P), Q: rp(s.Q), A: rp(s.A), B: rp(s.B),
          options: { ...s.options }, adjust: s.adjust,
          constructed: geometryShape(g),
          lengths: lengths(m),
          errors: errors(m),
          tolerance: cn(g.tol),
          finishTolerance: cn(g.finishTol),
          claims: g.claims,
          checks: {
            chordThroughP: g.claims.throughP,
            SOnCircleEFQ: g.claims.sOnO,
            centreOfABQOnCircleEFQ: g.claims.centerOnO,
            SIsCentreOfABQ: g.claims.sIsCenter,
            LSMQCyclic: g.claims.lsmqCyclic,
            QPBisectsAngleLQM: g.claims.bisector,
            SA_equals_SB_equals_SQ: g.claims.equalRadii,
            AQDiameterAndFinished: g.claims.finished,
            bothAQandBQDiameters: g.claims.bothDiameters,
          },
          description: C.describe(s),
          note:
            "S is the centre of the circle through A, B, Q, so SA, SB and SQ agree to the core's " +
            `tolerance ${cn(g.tol)}; L, S, M, Q are concyclic and QP bisects angle LQM. ` + SIBLINGS,
        };
      },
    },

    diameter_optimum: {
      describe:
        "Put A opposite Q on the first circle with the core's Place diameter chord button: BQ is then a diameter too and AB, the segment this page talks about, is the longest chord through P. Pass P, Q, A, B (same formats as shutrick_invariants) and optionally samples (12-180, default 72); the core sweeps chords in 'adjust chord' mode and compares the longest AB with the largest product AP×PB, which peaks at a different chord (the problem of siblings 1 and 3). It also checks the applet's 0.01 finish test and the invariant claims at the diameter chord.",
      args: OPTIMUM_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const samples = num(args, "samples", 72);
        if (!Number.isInteger(samples) || samples < 12 || samples > 180) {
          throw new Error('argument "samples" must be a whole number from 12 to 180');
        }
        const before = requireGeometry(C, s);
        const opt = C.optimal(s);
        const after = C.compute(opt);
        if (!after || !after.claims.valid || !after.claims.throughP) {
          throw new Error("the core could not place the diameter chord for these points");
        }
        return {
          P: rp(s.P), Q: rp(s.Q),
          before: { A: rp(s.A), B: rp(s.B), ...lengths(before.measures) },
          diameterChord: {
            A: rp(opt.A), B: rp(opt.B),
            ...lengths(after.measures),
            errors: errors(after.measures),
            claims: after.claims,
            constructed: geometryShape(after),
            description: C.describe(opt),
          },
          sweep: sweep(C, s, samples),
          note:
            "With AQ a diameter of C(E) the core's finish test passes, BQ is a diameter of C(F), " +
            "and AB is largest in the sweep at turn 0; AP×PB has its own maximum at a different " +
            "turn, which is why this applet's longest-segment claim is not the olympiad's product " +
            "problem. " + SIBLINGS,
        };
      },
    },
  };
}

/* Reading a saved position must not throw on a damaged or older record. */

const isPointLike = (v: unknown): boolean =>
  isObj(v) && (typeof v.x === "number" || typeof v.x === "string") &&
  (typeof v.y === "number" || typeof v.y === "string") &&
  Number.isFinite(Number(v.x)) && Number.isFinite(Number(v.y));

const maybePoint = (raw: unknown): { x: number; y: number } | null => {
  try { return rp(readPoint(raw, "point")); } catch { return null; }
};
const maybeCircle = (raw: unknown): { x: number; y: number; radius: number } | null => {
  if (!isObj(raw)) return null;
  const p = maybePoint(raw);
  const radius = Number(raw.radius);
  return p && Number.isFinite(radius) ? { ...p, radius: r6(radius) } : null;
};
const comparePoint = (raw: unknown, made: Pt | null, out: boolean[]): void => {
  if (!made || !isPointLike(raw)) return;
  const p = readPoint(raw, "point");
  out.push(same(p.x, made.x) && same(p.y, made.y));
};
const compareCircle = (raw: unknown, made: Circle | null, out: boolean[]): void => {
  if (!made || !isObj(raw)) return;
  comparePoint(raw, made, out);
  if (isPointLike(raw)) out.push(same(Number(raw.radius), made.radius));
};

/** Echo Track.state's fields, then re-measure the saved picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Max Common Chord 2 state version ${stateVersion}`);
  }
  if (!isObj(state)) throw new Error("saved Max Common Chord 2 position must be an object");
  const C = core();
  const home = C.start();
  let readable = true;
  const load = (key: string, fallback: Pt): Pt => {
    const raw: unknown = state[key];
    if (!isPointLike(raw)) {
      readable = false;
      return { x: fallback.x, y: fallback.y };
    }
    return readPoint(raw, `saved ${key}`);
  };
  const P = load("P", home.P);
  const Q = load("Q", home.Q);
  const A = load("A", home.A);
  const B = load("B", home.B);
  const opts = readOptions(state, false);
  const adj = readAdjust(state, home.adjust, false);
  readable = readable && opts.readable && adj.readable;
  const s: State = { P, Q, A, B, options: opts.options, adjust: adj.adjust, explored: true };
  const g = C.compute(s);

  const saved = {
    P: maybePoint(state.P), Q: maybePoint(state.Q), A: maybePoint(state.A), B: maybePoint(state.B),
    options: opts.options, adjust: adj.adjust,
    E: maybeCircle(state.E), F: maybeCircle(state.F), O: maybeCircle(state.O),
    S: maybePoint(state.S), L: maybePoint(state.L), M: maybePoint(state.M),
    finished: typeof state.finished === "boolean" ? state.finished : null,
  };
  const compared: boolean[] = [];
  if (g) {
    compareCircle(state.E, g.E, compared);
    compareCircle(state.F, g.F, compared);
    compareCircle(state.O, g.O, compared);
    comparePoint(state.S, g.S, compared);
    comparePoint(state.L, g.L, compared);
    comparePoint(state.M, g.M, compared);
    if (typeof state.finished === "boolean") compared.push(state.finished === g.claims.finished);
  }
  const savedMatchesCore = !readable ? false : compared.length === 0 ? null : compared.every(Boolean);

  return {
    ...state,
    stateVersion,
    savedReadable: readable,
    savedMatchesCore,
    fieldsCompared: compared.length,
    saved,
    state: {
      P: rp(s.P), Q: rp(s.Q), A: rp(s.A), B: rp(s.B),
      options: s.options, adjust: s.adjust,
    },
    geometry: g ? geometryShape(g) : null,
    lengths: g ? lengths(g.measures) : null,
    errors: g ? errors(g.measures) : null,
    claims: g ? g.claims : null,
    corePosition: g ? C.position(s) : null,
    description: C.describe(s),
    note:
      "Track.state saved the four handles, the two display boxes, the adjust mode and the drawn " +
      "circles and points; the core rebuilds E, F, O, L, M and S from the handles alone and " +
      (savedMatchesCore === null ? "finds no saved construction to compare. "
        : savedMatchesCore ? "the saved geometry agrees with that recomputation. "
          : "some saved geometry differs from that recomputation; check whether it came from these handles. ") +
      (g && !g.claims.throughP
        ? "The saved P is not on line AB, so the invariant checks below are false; refixing B on " +
          "the chord through P would restore them. "
        : "") +
      (g ? "The invariant here is S as the centre of circle ABQ on C(O), giving SA = SB = SQ; " +
        "the diameter chord is this page's longest segment. " : "These points make a degenerate drawing. ") +
      SIBLINGS + " This is a demonstration with no win or loss.",
  };
}
