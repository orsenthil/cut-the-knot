/*
 * run_game_logic actions and saved-position reader for Light House.
 *
 * The real core is light-house/light-house-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the applet's 640 x 460 canvas, y down.
 *
 * N equally spaced beams leave each lighthouse. The page's Lighthouse Theorem
 * says their crossings form a regular N-gon for any two angular rates; the
 * ported picture uses the intended half-step offset (PI/N), so its row-0
 * crossings do. The applet's own array, transcribed in the core as
 * appletPolygon, signs ComputeSignedAngle opposite to GetNext's (cos, -sin)
 * direction; Shift then repeats beams and every row collapses to two points.
 * The page's geometry wins where the two disagree. This is a demonstration
 * with no win or loss. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = {
  N: number; rate1: number; rate2: number; width: number; height: number;
  P1: Point; P2: Point; P: Point; step: number;
};
interface Core {
  DEFAULTS: { N: number; rate1: number; rate2: number; width: number; height: number };
  RAY_LENGTH: number;
  start(options?: Partial<State>): State;
  ngon(state: State): number;
  polygon(state: State, i: number, step: number): Point[];
  polygons(state: State, step: number): Point[][];
  appletPolygon(state: State, i: number, step: number): Point[];
  ordered(points: Point[]): Point[];
  sideLengths(points: Point[]): number[];
  exteriorAngles(points: Point[]): number[];
  regularity(points: Point[]): number;
  describe(state: State): string;
}

const core = (): Core => cores["light-house"].LightHouseCore as unknown as Core;

/* The core is exact up to floating point; only what we print is rounded. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0);
const rp = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const numeric = (v: unknown): boolean =>
  (typeof v === "number" || typeof v === "string") && Number.isFinite(Number(v));
const REG_TOL = 1e-6;

/** An action's integer argument inside one of the applet's own ranges. */
function intArg(args: Json, key: string, lo: number, hi: number, fallback: number): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`argument "${key}" must be an integer from ${lo} to ${hi}, got ${JSON.stringify(raw)}`);
  }
  return n;
}

/** An action's argument: a finite point, as in the page's three draggable handles. */
function point(v: unknown, label: string): Point {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`${label} must be a point {x, y}`);
  }
  const p = v as Json;
  if (!numeric(p.x) || !numeric(p.y)) throw new Error(`${label} must have numeric x and y`);
  return { x: Number(p.x), y: Number(p.y) };
}

/** Apply action arguments to the real core's opening state, as the UI does on drag. */
function buildState(C: Core, args: Json, base?: State): State {
  const from = base || C.start({});
  const s = C.start({
    N: intArg(args, "N", 1, 12, from.N),
    rate1: intArg(args, "rate1", -12, 12, from.rate1),
    rate2: intArg(args, "rate2", -12, 12, from.rate2),
    width: from.width,
    height: from.height,
  });
  const handle = (key: "P1" | "P2" | "P"): Point => {
    const raw = args[key];
    if (raw !== undefined && raw !== null) return point(raw, key);
    return base && base[key] ? { ...base[key] } : s[key];
  };
  return {
    ...s,
    P1: handle("P1"), P2: handle("P2"), P: handle("P"),
    step: intArg(args, "step", 0, 100000, from.step),
  };
}

/** Every core measurement of one picture, shared by the actions and position(). */
function reading(C: Core, s: State): Json {
  const vertices = C.ordered(C.polygon(s, 0, s.step));
  const sides = C.sideLengths(vertices);
  const turns = C.exteriorAngles(vertices);
  const regularity = C.regularity(vertices);
  const expected = 360 / s.N;
  const anglesMatch = s.N >= 3 && turns.every((a) => Math.abs(a - expected) < 1e-6);
  const pageIsRegular = s.N >= 3 && regularity < REG_TOL && anglesMatch;

  /* The applet's transcription repeated beams, so its row has fewer corners. */
  const app = C.appletPolygon(s, 0, s.step);
  const appDistinct = new Set(app.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)).size;
  const appRegularity = C.regularity(app);

  return {
    n: s.N,
    rate1: s.rate1,
    rate2: s.rate2,
    step: s.step,
    description: C.describe(s),
    angleStepBucket: C.ngon(s),
    vertices: vertices.map(rp),
    sideLengths: sides.map(r6),
    exteriorDegrees: turns.map(r6),
    expectedExteriorDegrees: s.N >= 3 ? r6(expected) : null,
    exteriorAnglesMatch: anglesMatch,
    regularity,
    sidesEqual: s.N >= 3 && regularity < REG_TOL,
    isRegularNgon: pageIsRegular,
    appletVertices: app.map(rp),
    appletDistinctVertices: appDistinct,
    appletRegularity: appRegularity,
    appletIsRegularNgon: s.N >= 3 && appDistinct === s.N && appRegularity < REG_TOL,
    note: pageIsRegular
      ? `The ${s.N} crossings are a regular ${s.N}-gon: all sides agree to ${regularity.toExponential(1)} and every turn is ${r6(expected)} degrees, the same at this step and at these rates. The applet's own shifted-beam array has only ${appDistinct} distinct crossings because ComputeSignedAngle signs its angle opposite to GetNext's (cos, -sin) direction; the page's geometry is the one the port draws.`
      : s.N < 3
        ? "Fewer than three beams cannot close a polygon: at least N = 3 is needed for the Lighthouse Theorem's regular N-gon."
        : "The crossings do not come out regular; check the core's measurement above.",
  };
}

export function actions(): GameActions {
  return {
    regular_ngon: {
      describe:
        "For N equally spaced beams at each lighthouse (N from 3 to 12), measure the N crossings of one row with the real core and check the Lighthouse Theorem: every side is equal and each exterior angle is 360/N. Also reports the applet's own shifted-beam array, whose mirrored ComputeSignedAngle angle collapses the row to two repeated crossings. Accepts rate1, rate2, step and optionally the three draggable points P1, P2 and P.",
      args: '{ "N": 4, "rate1": 2, "rate2": 3, "step": 0 }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        if (s.N < 3) throw new Error("N must be at least 3 for a polygon");
        const r = reading(C, s);
        return {
          ...r,
          P1: rp(s.P1), P2: rp(s.P2), P: rp(s.P),
          rayLength: C.RAY_LENGTH,
          polygonsShown: C.polygons(s, s.step).length,
        };
      },
    },

    rate_pair_scan: {
      describe:
        "Scan several pairs of lighthouse rates through the real core at one animation step, reporting each pair's regularity, side length and exterior angle. The Lighthouse Theorem's crossings are a regular N-gon for every rate pair, not just opposite rates: the rates change the polygon's size and turn, not its regularity. Each pair is two integers from -12 to 12.",
      args: '{ "N": 5, "step": 5, "pairs": [[1, 1], [1, -1], [2, 3], [-4, 5], [0, 0]] }',
      run: (args) => {
        const C = core();
        const base = buildState(C, args);
        if (base.N < 3) throw new Error("N must be at least 3 for a polygon");
        let pairs: number[][];
        if (args.pairs === undefined || args.pairs === null) {
          pairs = [[1, 1], [1, -1], [2, 3], [-4, 5]];
        } else {
          if (!Array.isArray(args.pairs) || !args.pairs.length || args.pairs.length > 12) {
            throw new Error('argument "pairs" must be an array of 1 to 12 rate pairs');
          }
          pairs = args.pairs.map((v, i) => {
            if (!Array.isArray(v) || v.length !== 2) {
              throw new Error(`pairs[${i}] must be [rate1, rate2]`);
            }
            const rates = v.map((q, k) => {
              const n = Number(q);
              if (!Number.isInteger(n) || n < -12 || n > 12) {
                throw new Error(`pairs[${i}][${k}] must be an integer from -12 to 12`);
              }
              return n;
            });
            return rates;
          });
        }
        const scans = pairs.map(([r1, r2]) => {
          const s = buildState(C, { rate1: r1, rate2: r2 }, base);
          const v = C.ordered(C.polygon(s, 0, s.step));
          const regularity = C.regularity(v);
          const turns = C.exteriorAngles(v);
          return {
            rate1: r1,
            rate2: r2,
            regularity,
            firstSideLength: r6(C.sideLengths(v)[0]),
            firstExteriorDegree: r6(turns[0]),
            sidesEqual: regularity < REG_TOL,
          };
        });
        const expected = r6(360 / base.N);
        const allRegular = scans.every((x) => x.sidesEqual && Math.abs(x.firstExteriorDegree - expected) < 1e-6);
        return {
          n: base.N,
          step: base.step,
          expectedExteriorDegrees: expected,
          scans,
          allRegular,
          note: `All ${scans.length} rate pairs give a regular ${base.N}-gon: each exterior angle stays ${expected} degrees and the regularity stays near zero, while the side length changes with the rates. The theorem needs equal spacing of the beams, not opposite rates.`,
        };
      },
    },
  };
}

/* Reading a saved position must never throw on a damaged or older record. */

const isSavedPoint = (v: unknown): boolean =>
  !!v && typeof v === "object" && !Array.isArray(v) &&
  numeric((v as Json).x) && numeric((v as Json).y);

const savedPoint = (v: unknown, fallback: Point): Point =>
  isSavedPoint(v) ? { x: Number((v as Json).x), y: Number((v as Json).y) } : fallback;

const savedInt = (v: unknown, fallback: number, lo: number, hi: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
};

const savedBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

function savedState(C: Core, state: Json): { s: State; readable: boolean } {
  const base = C.start({});
  const N = savedInt(state.N, base.N, 1, 12);
  const rate1 = savedInt(state.rate1, base.rate1, -12, 12);
  const rate2 = savedInt(state.rate2, base.rate2, -12, 12);
  const width = savedInt(state.width, base.width, 1, 100000);
  const height = savedInt(state.height, base.height, 1, 100000);
  const fresh = C.start({ N, rate1, rate2, width, height });
  const P1 = savedPoint(state.P1, fresh.P1);
  const P2 = savedPoint(state.P2, fresh.P2);
  const P = savedPoint(state.P, fresh.P);
  const step = savedInt(state.step, 0, 0, 100000);
  const s: State = { ...fresh, P1, P2, P, step };
  const readable = N === Number(state.N) && rate1 === Number(state.rate1) &&
    rate2 === Number(state.rate2) && width === Number(state.width) &&
    height === Number(state.height) && step === Number(state.step) &&
    isSavedPoint(state.P1) && isSavedPoint(state.P2) && isSavedPoint(state.P);
  return { s, readable };
}

/** Echo the fields Track.state saved, plus the core's reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Light House state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Light House position must be an object");
  }
  const C = core();
  const { s, readable } = savedState(C, state);
  const r = reading(C, s);
  return {
    ...state,
    stateVersion,
    savedReadable: readable,
    N: s.N,
    rate1: s.rate1,
    rate2: s.rate2,
    width: s.width,
    height: s.height,
    P1: rp(s.P1),
    P2: rp(s.P2),
    P: rp(s.P),
    step: s.step,
    showBeams: savedBool(state.showBeams, true),
    showPolygons: savedBool(state.showPolygons, true),
    fill: savedBool(state.fill, false),
    extend: savedBool(state.extend, false),
    removeAsymptotes: savedBool(state.removeAsymptotes, false),
    removeAsymptotesAllowed: savedBool(state.removeAsymptotesAllowed, false),
    reading: r,
    note: !readable
      ? "Some saved fields could not be read, so the applet's opening picture was reconstructed and the core reading below comes from it."
      : `Track.state saved N, the two rates, the canvas size, the three draggable points and the animation step, plus the display checkboxes. The core rebuilds row 0's ${s.N} crossings: ${r.isRegularNgon ? `a regular ${s.N}-gon at any rates, while the applet's own mirrored-angle array collapses to ${r.appletDistinctVertices} points` : "not a closed regular polygon"}. This is a demonstration with no win or loss, so the tracker just records exploration.`,
  };
}
