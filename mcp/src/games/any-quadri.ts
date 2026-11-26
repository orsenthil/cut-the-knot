/*
 * run_game_logic actions and saved-position reader for Any Quadri.
 * All geometry comes from the real core,
 * any-quadri/any-quadri-core.js, copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 *
 * The construction: K, L, M, N are the midpoints of the sides AB, BC, CD, DA
 * and E, F the midpoints of the diagonals BD, AC. The three segments KM, LN
 * (the bimedians) and EF (Newton's line) all have the same midpoint,
 * G = (A + B + C + D) / 4, the barycentre of four equal weights at the corners.
 * In triangle ABD, EN is parallel to AB and half as long, and so is FL in
 * triangle ABC; hence ENFL is a parallelogram and EF and NL bisect each other.
 * The same argument with triangles ADC and BCD makes EKFM a parallelogram, so
 * EF and KM bisect each other too. EF has only one middle, so all three lines
 * share it. This holds for every quadrilateral, even a crossed one.
 */

import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["any-quadri"].AnyQuadriCore;
type Core = ReturnType<typeof core>;
type Geometry = NonNullable<ReturnType<Core["compute"]>>;
type Point = { x: number; y: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;

/** Accept [x, y] or { "x": ..., "y": ... }, falling back to the applet's reset corner. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: numField(o, "x", key), y: numField(o, "y", key) };
  }
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(v)}`);
}

/** A finite number from a nested point object, with a helpful error message. */
function numField(o: Json, field: string, outer: string): number {
  const v = o[field];
  const n = Number(v);
  if (v === undefined || v === null || !Number.isFinite(n)) {
    throw new Error(`argument "${outer}.${field}" must be a number, got ${JSON.stringify(v)}`);
  }
  return n;
}

function readQuad(C: Core, args: Json) {
  const fresh = C.start();
  return {
    A: readPoint(args, "A", fresh.A),
    B: readPoint(args, "B", fresh.B),
    C: readPoint(args, "C", fresh.C),
    D: readPoint(args, "D", fresh.D),
  };
}

function computeQuad(C: Core, args: Json): Geometry {
  const q = readQuad(C, args);
  const g = C.compute(q.A, q.B, q.C, q.D);
  if (!g) {
    throw new Error(
      "those four points do not make a quadrilateral: two corners coincide. Move a corner and try again.",
    );
  }
  return g;
}

/** Tutor-friendly reading of one drawing, in the page's 400 x 300 board units. */
function reading(g: Geometry) {
  const m = g.measures;
  return {
    vertices: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    sideMidpoints: {
      K_AB: pt(g.K), L_BC: pt(g.L), M_CD: pt(g.M), N_DA: pt(g.N),
    },
    diagonalMidpoints: { E_BD: pt(g.E), F_AC: pt(g.F) },
    barycentreG: pt(g.G),
    segments: {
      KM: { from: pt(g.K), to: pt(g.M), midpoint: pt(g.kmMid) },
      LN: { from: pt(g.L), to: pt(g.N), midpoint: pt(g.lnMid) },
      EF: { from: pt(g.E), to: pt(g.F), midpoint: pt(g.efMid) },
    },
    errors: {
      concurrency: round(m.concurrencyError),
      kmBisect: round(m.kmBisectError),
      lnBisect: round(m.lnBisectError),
      efBisect: round(m.efBisectError),
    },
    tolerance: g.tol,
    note:
      "G = (A + B + C + D) / 4 is the midpoint of all three segments KM, LN and EF. " +
      "ENFL and EKFM are parallelograms, so EF and NL bisect each other and EF and KM bisect each other; " +
      "EF has only one middle, so all three lines meet there. This is true of any quadrilateral.",
  };
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For quadrilateral corners A, B, C, D as [x, y] points in the page's 400 x 300 board (y down), report the six midpoints: K, L, M, N of sides AB, BC, CD, DA and E, F of diagonals BD, AC. Also report the common point G = (A + B + C + D)/4, the endpoints and midpoint of each of the three segments KM, LN and EF (Newton's line), and the errors showing they share one middle. Corners may be omitted, in which case the applet's reset corners are used.",
      args: '{ "A": [70, 120], "B": [230, 40], "C": [310, 200], "D": [255, 210] }',
      run: (args) => reading(computeQuad(core(), args)),
    },
    check_claims: {
      describe:
        "Test every claim on the illustration's page for corners A, B, C, D: the three segments KM, LN and EF are concurrent, each is bisected at G, ENFL and EKFM are parallelograms, and G is the barycentre (mean of the corners and of each pair of midpoints). Returns a boolean and the measured error for each claim, the failed names, and whether all claims hold. The comparison uses a tolerance of 1e-9 times the drawing's size, so ordinary rounding never counts as a failure.",
      args: '{ "A": [75, 120], "B": [230, 40], "C": [310, 200], "D": [255, 210] }',
      run: (args) => {
        const g = computeQuad(core(), args);
        const cl = g.claims;
        const m = g.measures;
        const errors: Record<string, number> = {
          concurrent: round(m.concurrencyError),
          kmBisected: round(m.kmBisectError),
          lnBisected: round(m.lnBisectError),
          efBisected: round(m.efBisectError),
          parallelogramENFL: round(m.enflError),
          parallelogramEKFM: round(m.ekfmError),
          barycenter: round(m.barycenterError),
        };
        const failed = Object.keys(errors).filter((k) => cl[k as keyof typeof cl] !== true);
        return {
          claims: { ...cl },
          errors,
          tolerance: g.tol,
          failed,
          allHold: failed.length === 0,
          note: failed.length === 0
            ? "All claims hold: the three bimedians are concurrent at the barycentre and each is bisected there. This is an identity, so it holds for every quadrilateral, including crossed ones."
            : "Some claims failed: check that the four corners are distinct and see the errors for how far the drawing is from the identity.",
        };
      },
    },
  };
}

/** The page's saved drawing and options, plus a fresh reading of its corners. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const fresh = C.start();
  const A = readPoint(state, "A", fresh.A);
  const B = readPoint(state, "B", fresh.B);
  const Cc = readPoint(state, "C", fresh.C);
  const D = readPoint(state, "D", fresh.D);
  const savedPoint = (key: string) => {
    const v = state[key];
    return v && typeof v === "object" && !Array.isArray(v)
      ? pt({ x: numField(v as Json, "x", key), y: numField(v as Json, "y", key) })
      : null;
  };
  const g = C.compute(A, B, Cc, D);
  const here = { A, B, C: Cc, D, options: { hint: state.hint === true }, explored: true };
  return {
    stateVersion,
    A: pt(A), B: pt(B), C: pt(Cc), D: pt(D),
    K: savedPoint("K"), L: savedPoint("L"), M: savedPoint("M"),
    N: savedPoint("N"), E: savedPoint("E"), F: savedPoint("F"), G: savedPoint("G"),
    hint: state.hint === true,
    savedClaims: state.claims === undefined || state.claims === null ? null : state.claims,
    savedMeasures: state.measures === undefined || state.measures === null ? null : state.measures,
    reading: g
      ? reading(g)
      : { note: "Those saved corners do not make a quadrilateral; move a corner to see the drawing." },
    note: C.describe(here),
  };
}
