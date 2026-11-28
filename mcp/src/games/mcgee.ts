/*
 * run_game_logic actions and saved-position reader for McGee, Bogomolny's
 * applet on Ian McGee's observation. The real core is
 * mcgee/mcgee-core.js (global McgeeCore), copied into src/generated/cores/
 * at build time; every number below is measured by it. Coordinates are the
 * applet's 400 x 400 board units with y down, centre (200, 200) and
 * radius 400/4.5.
 *
 * At A and B on the circle, equal tangents AP and BQ are drawn by walking the
 * same signed distance along the quarter-turn of each radius; AB then bisects
 * PQ at S. The hint adds a point R = the reflection of P in A (so AR = AP),
 * meets the tangents at T, and proves TA = TB, TR = TQ and QR || AB. The core
 * also preserves two applet quirks: Compute() pauses without replacing the
 * drawing when A and B are under two pixels apart or |length| < 2, and
 * GeoSDoub.Intersect returns NaN when |det| < 1 (so T is undrawable for
 * antipodal A and B). This is a demonstration: no win or loss. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  A: Pt; B: Pt; length: number;
  showNames: boolean; showStatement: boolean; showPremise: boolean; showHint: boolean;
  moves: number; explored: boolean;
};
type Geometry = {
  valid: boolean; reason: string | null; drawable?: boolean;
  O?: Pt; r?: number; A?: Pt; B?: Pt; L?: number;
  P?: Pt; Q?: Pt; R?: Pt; S?: Pt; T?: Pt;
  dirA?: Pt; dirB?: Pt; tangentA?: Pt; tangentB?: Pt; dAB?: number;
};
type Residuals = {
  bisect: number; equalHalves: number; onChord: number; equalTangents: number;
  radiusPerp: number; ARequalsAP: number; equalTA_TB: number; equalTR_TQ: number;
  AIsMidOfPR: number; QRparallelAB: number; dirSumParallel: number;
};
type Core = {
  WIDTH: number; HEIGHT: number; CENTER: Pt; RADIUS: number;
  LENGTH_MIN: number; LENGTH_MAX: number; LENGTH_DEFAULT: number;
  OPTION_KEYS: string[]; HANDLES: string[];
  dist(a: Pt, b: Pt): number;
  cross(a: Pt, b: Pt): number;
  finite(p: unknown): boolean;
  pointOnCircle(angle: number): Pt;
  intersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt;
  start(o?: Partial<State>): State;
  result(s: State): string | null;
  compute(s: State): Geometry;
  residuals(g: Geometry): Residuals | null;
};

const core = (): Core => cores["mcgee"].McgeeCore as unknown as Core;

/* The core keeps full precision; only what the tutor prints is rounded. */
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
/** Tiny geometric residuals are kept in scientific notation instead of 0. */
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const isPlain = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** Accept the page's {x, y} and the tutor's [x, y] alike, with finite numbers. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (isPlain(raw)) {
    x = Number(raw.x); y = Number(raw.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

const maybePoint = (raw: unknown): Pt | null => {
  try { return readPoint(raw, "point"); } catch { return null; }
};

/** The slider is the applet's -200..200 length scrollbar (the core rounds it). */
function readLength(C: Core, args: Json, key: string, fallback: number): number {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < C.LENGTH_MIN || n > C.LENGTH_MAX) {
    throw new Error(`argument "${key}" must be from ${C.LENGTH_MIN} to ${C.LENGTH_MAX}, got ${JSON.stringify(v)}`);
  }
  return n;
}

function readSwitch(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be a boolean, got ${JSON.stringify(v)}`);
  return v;
}

/** Build a real core state; A and B are projected onto the circle by start(). */
function buildState(C: Core, args: Json): State {
  if (!isPlain(args)) throw new Error("arguments must be an object with optional A, B, length and switches");
  const o: Partial<State> = {
    length: readLength(C, args, "length", C.LENGTH_DEFAULT),
    showNames: readSwitch(args, "showNames", true),
    showStatement: readSwitch(args, "showStatement", false),
    showPremise: readSwitch(args, "showPremise", false),
    showHint: readSwitch(args, "showHint", false),
  };
  if (args.A !== undefined && args.A !== null) o.A = readPoint(args.A, "A");
  if (args.B !== undefined && args.B !== null) o.B = readPoint(args.B, "B");
  return C.start(o);
}

/** Every core-derived reading used by both actions and the position reader. */
function reading(C: Core, s: State) {
  const g = C.compute(s);
  const r = C.residuals(g);
  const tol = 1e-6 * Math.max(1, C.RADIUS);
  const near = (v: number): boolean => Number.isFinite(v) && Math.abs(v) <= tol;
  return {
    valid: g.valid,
    reason: g.reason,
    drawable: g.drawable === true,
    circle: { center: pt(g.O ?? C.CENTER), radius: round(g.r ?? C.RADIUS) },
    A: pt(g.A ?? s.A), B: pt(g.B ?? s.B),
    P: pt(g.P), Q: pt(g.Q), R: pt(g.R), S: pt(g.S), T: pt(g.T),
    lengths: r ? {
      AP: round(C.dist(s.A, g.P!)), BQ: round(C.dist(s.B, g.Q!)),
      PS: round(C.dist(g.P!, g.S!)), QS: round(C.dist(g.Q!, g.S!)),
      AB: round(C.dist(s.A, s.B)), PR: round(C.dist(g.P!, g.R!)),
      tangentLength: s.length,
    } : null,
    residuals: r ? {
      bisect: sig(r.bisect), equalHalves: sig(r.equalHalves), onChord: sig(r.onChord),
      equalTangents: sig(r.equalTangents), radiusPerp: sig(r.radiusPerp),
      ARequalsAP: sig(r.ARequalsAP), equalTA_TB: sig(r.equalTA_TB),
      equalTR_TQ: sig(r.equalTR_TQ), AIsMidOfPR: sig(r.AIsMidOfPR),
      QRparallelAB: sig(r.QRparallelAB), dirSumParallel: sig(r.dirSumParallel),
    } : null,
    claims: r ? {
      AP_equals_BQ: near(r.equalTangents),
      S_is_midpoint_of_PQ: near(r.bisect) && near(r.equalHalves),
      S_on_AB: near(r.onChord),
      tangents_perp_radii: near(r.radiusPerp),
      AR_equals_AP: near(r.ARequalsAP),
      TA_equals_TB: near(r.equalTA_TB),
      TR_equals_TQ: near(r.equalTR_TQ),
      A_is_midpoint_PR: near(r.AIsMidOfPR),
      QR_parallel_AB: near(r.QRparallelAB),
      dirSum_parallel_AB: near(r.dirSumParallel),
    } : null,
    tolerance: tol,
  };
}

/* The live page's saved diagram (the fixture's A, B and length scrollbar). */
const fixtureArgs = {
  A: [175.28694388340318, 285.3844214437222],
  B: [276.98003589195014, 155.55555555555557],
  length: -100,
  showNames: true, showStatement: false, showPremise: false, showHint: false,
};

const NO_GAME =
  "This is a demonstration, so there is no win or loss; the tracker records exploration.";

export function actions(): GameActions {
  return {
    equal_tangents_bisect: {
      describe:
        "Draw the equal tangents AP and BQ from two points A and B on the circle (each of length |length| along the tangent at its point) and join P to Q: the chord AB always meets PQ at its midpoint S. Run the real McGee core and report P, Q, S, the lengths AP, BQ, PS, QS, AB and the residuals for AP = BQ, PS = QS, S on AB and each tangent perpendicular to its radius. Optional A and B are points as [x, y] or { x, y }, length is an integer scrollbar step from -200 to 200, and showNames, showStatement, showPremise, showHint are optional booleans; the example uses the live page's saved picture.",
      args: JSON.stringify(fixtureArgs),
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const rd = reading(C, s);
        return {
          state: { A: pt(s.A), B: pt(s.B), length: s.length, result: C.result(s) },
          ...rd,
          note:
            rd.residuals && rd.lengths
              ? `Both tangents have length ${Math.abs(rd.lengths.tangentLength)} (scrollbar step ${rd.lengths.tangentLength}, AP = BQ to ${rd.residuals.equalTangents} board units), and S is the midpoint of PQ: PS = QS = ${rd.lengths.PS}, with S ${rd.residuals.onChord} units off the chord AB. Each tangent meets its radius at a right angle. ${NO_GAME}`
              : `The core pauses its drawing here (reason "${rd.reason}"), so there are no points P, Q or S to measure. ${NO_GAME}`,
        };
      },
    },

    hint_and_quirks: {
      describe:
        "Follow the applet's hint: T is where the two tangents meet and R is P reflected back through A, and the core checks TA = TB, TR = TQ, A the midpoint of PR, AR = AP and QR parallel to AB, all because the two tangent directions add to a vector parallel to the chord. The same action reports two applet quirks from the real core: Compute() pauses with valid:false when A and B are under two pixels apart or |length| < 2, while GeoSDoub.Intersect returns NaN when |det| < 1 (so T is undrawable for antipodal A and B). Takes the same A, B, length and switch arguments as equal_tangents_bisect.",
      args: JSON.stringify(fixtureArgs),
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const rd = reading(C, s);
        const onCircle = C.pointOnCircle(0);
        const opposite = C.pointOnCircle(Math.PI);
        const close = C.compute(C.start({ A: onCircle, B: onCircle }));
        const short = C.compute(C.start({ length: 0 }));
        const antipodal = C.compute(C.start({ A: onCircle, B: opposite }));
        // Two lines that really meet at the origin, but with |det| = 0.1 < 1.
        const guarded = C.intersect({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0.001 });
        const unguarded = C.intersect({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0.2 });
        return {
          hint: {
            valid: rd.valid, drawable: rd.drawable,
            T: rd.T, R: rd.R, A: rd.A, B: rd.B, Q: rd.Q,
            residuals: rd.residuals && {
              TA_equals_TB: rd.residuals.equalTA_TB,
              TR_equals_TQ: rd.residuals.equalTR_TQ,
              AR_equals_AP: rd.residuals.ARequalsAP,
              A_is_midpoint_PR: rd.residuals.AIsMidOfPR,
              QR_parallel_AB: rd.residuals.QRparallelAB,
              dirSum_parallel_AB: rd.residuals.dirSumParallel,
            },
            checks: rd.claims && {
              TA_equals_TB: rd.claims.TA_equals_TB,
              TR_equals_TQ: rd.claims.TR_equals_TQ,
              AR_equals_AP: rd.claims.AR_equals_AP,
              A_is_midpoint_PR: rd.claims.A_is_midpoint_PR,
              QR_parallel_AB: rd.claims.QR_parallel_AB,
              dirSum_parallel_AB: rd.claims.dirSum_parallel_AB,
            },
          },
          quirks: {
            degeneratePause: {
              coincidentPoints: { dAB: round(close.dAB ?? 0), valid: close.valid, reason: close.reason },
              zeroLength: { length: 0, valid: short.valid, reason: short.reason },
            },
            detGuard: {
              linesMeetingAtOriginWithDetBelowOne: pt(guarded),
              sameDirectionWithDetTwenty: pt(unguarded),
              antipodalTangents: {
                dAB: round(antipodal.dAB ?? 0), valid: antipodal.valid,
                drawable: antipodal.drawable === true, T: pt(antipodal.T),
              },
            },
          },
          note:
            "The hint holds because A is the midpoint of PR and T is equidistant from A and B and from R and Q, making TR = TQ and QR parallel to AB, with the tangent directions summing along the chord. " +
            "The core keeps the applet's pauses (no drawing when the points coincide or the tangent is between -2 and 2 pixels) and its |det| < 1 guard (NaN crossings, even for lines that do meet; T is NaN when A and B are antipodal). " +
            NO_GAME,
        };
      },
    },
  };
}

/** Echo what Track.state saved (the core's plain state) and add a core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported McGee state version ${stateVersion}`);
  }
  const src: Json = isPlain(state) ? state : {};
  const C = core();
  let s: State;
  let savedReadable = true;
  try {
    s = buildState(C, src);
  } catch {
    s = C.start({});
    savedReadable = false;
  }
  const savedA = maybePoint(src.A);
  const savedB = maybePoint(src.B);
  const rd = reading(C, s);
  const pause = rd.valid
    ? "The picture is drawable."
    : `The core pauses its drawing here (reason "${rd.reason}"); the page would keep the last figure.`;
  return {
    ...src,
    stateVersion,
    savedReadable,
    coreState: {
      A: pt(s.A), B: pt(s.B), length: s.length,
      showNames: s.showNames, showStatement: s.showStatement,
      showPremise: s.showPremise, showHint: s.showHint,
    },
    agreesWithSaved: {
      A: savedA ? sig(C.dist(savedA, s.A)) : null,
      B: savedB ? sig(C.dist(savedB, s.B)) : null,
      length: src.length === undefined ? null : sig(Number(src.length) - s.length),
    },
    reading: rd,
    note:
      (!savedReadable
        ? "Some saved fields could not be read, so the core's opening picture is shown and the reading below comes from it. "
        : "Track.state saved the plain state (A, B, length and the four switches); the core projects A and B onto the circle and rebuilds the tangents and their crossings. ") +
      pause + " " + NO_GAME,
  };
}
