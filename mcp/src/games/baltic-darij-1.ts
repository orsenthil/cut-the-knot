/*
 * run_game_logic actions and saved-position reader for Baltic Darij 1.
 *
 * The core lives in baltic-darij-1/ and is copied into src/generated/cores/
 * at build time. It computes every point of the illustration from three
 * corners: Ha is the altitude foot from A, La the internal bisector foot on
 * BC, P and Q the feet from B and C onto the bisector at A, A' the midpoint
 * of BC, and R the reflection of B in the bisector (on AC). The page's claims
 * are that P, Q, A' and Ha are concyclic, that A'P || AC, A'Q || AB and
 * A'P = A'Q, that P is the midpoint of BR, that Ha and Q lie on the circle
 * with diameter AC, and that QPHa is inversely similar to ABC. See _shared.ts
 * for the shape of a game module.
 *
 * Coordinates are the page's 400 x 300 viewBox units, with y downward.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["baltic-darij-1"].BalticDarij1Core;

type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };
type Figure = NonNullable<ReturnType<Core["construct"]>>;
type Measurement = NonNullable<ReturnType<Core["measurements"]>>;
type ClaimSet = NonNullable<ReturnType<Core["claims"]>>;

const CLAIM_NAMES = [
  "concyclic", "apParallelAc", "aqParallelAb", "equalLegs",
  "midpointBR", "circleAC", "similarQPH",
] as const;

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;

/** Accept both the page's saved {x, y} points and [x, y] argument arrays. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(v)}`);
}

function readTriangle(C: Core, args: Json): Triangle {
  const fresh = C.start();
  return {
    A: readPoint(args, "A", fresh.A),
    B: readPoint(args, "B", fresh.B),
    C: readPoint(args, "C", fresh.C),
  };
}

/** The core returns null when two corners are too close or the three are collinear. */
function geometry(C: Core, s: Triangle): { figure: Figure; measurement: Measurement } {
  const figure = C.construct(s);
  const measurement = C.measurements(s);
  if (!figure || !measurement) {
    throw new Error(
      "these three points do not make a drawable triangle: two corners are closer than " +
      `${C.MIN_SEP} units or all three lie on one line`,
    );
  }
  return { figure, measurement };
}

function claimsSummary(cl: ClaimSet | null) {
  const failed = CLAIM_NAMES.filter((k) => cl?.[k] !== true);
  return {
    concyclic: cl?.concyclic === true,
    apParallelAc: cl?.apParallelAc === true,
    aqParallelAb: cl?.aqParallelAb === true,
    equalLegs: cl?.equalLegs === true,
    midpointBR: cl?.midpointBR === true,
    circleAC: cl?.circleAC === true,
    similarQPH: cl?.similarQPH === true,
    allHold: failed.length === 0,
    failed,
  };
}

/** All the labelled points and numerical claim checks, straight from the core. */
function reading(C: Core, s: Triangle, figure: Figure, measurement: Measurement) {
  const r = measurement.residuals;
  return {
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: {
      a: maybe(measurement.sides.a),
      b: maybe(measurement.sides.b),
      c: maybe(measurement.sides.c),
    },
    points: {
      Ha: pt(figure.Ha),
      La: pt(figure.La),
      P: pt(figure.P),
      Q: pt(figure.Q),
      Ap: pt(figure.Ap),
      R: pt(figure.R),
    },
    circle: { center: pt(figure.circle.center), radius: maybe(figure.circle.radius) },
    circleWithDiameterAC: {
      center: pt(figure.circleAC.center),
      radius: maybe(figure.circleAC.radius),
    },
    residuals: {
      concyclic: maybe(r.concyclic),
      apParallelAc: maybe(r.apParallelAc),
      aqParallelAb: maybe(r.aqParallelAb),
      equalLegs: maybe(r.equalLegs),
      midpointBR: maybe(r.midpointBR),
      onAC: maybe(r.onAC),
      diameterAC_atHa: maybe(r.diameterAC_P),
      diameterAC_atQ: maybe(r.diameterAC_Q),
      similarQPH: maybe(r.similarQPH),
      ratioQPH: maybe(r.ratioQPH),
      reverseOrientationOk: r.reverseOrientation === 0,
    },
    claims: claimsSummary(C.claims(s)),
    note:
      "Ha is the foot of the altitude from A, La the bisector foot on BC, P and Q the " +
      "feet from B and C onto the bisector, A' the midpoint of BC and R the reflection " +
      "of B in the bisector on AC. Residuals near zero mean the claims hold: distance " +
      "errors are divided by the longest side, parallel errors are sines, angle errors " +
      "are in radians. The circle listed is the one through P, Q and Ha; A' lies on it too.",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a triangle A, B, C in page coordinates (400 x 300 viewBox, y down), report " +
        "the side lengths, the altitude foot Ha, bisector foot La, the two perpendicular " +
        "feet P and Q, the side midpoint A', the reflected point R on AC, the circle " +
        "through P, Q, Ha, the circle with diameter AC, and the numerical residuals of " +
        "every claim. Omit a corner to use the illustration's opening triangle.",
      args: '{ "A": [163, 100], "B": [133.333, 200], "C": [300, 200] }',
      run: (args) => {
        const C = core();
        const s = readTriangle(C, args);
        const { figure, measurement } = geometry(C, s);
        return reading(C, s, figure, measurement);
      },
    },
    check_claims: {
      describe:
        "Test every claim on the illustration for a triangle A, B, C: P, Q, A' and Ha " +
        "are concyclic; A'P || AC, A'Q || AB and A'P = A'Q; P is the midpoint of BR with " +
        "R on AC; Ha and Q lie on the circle with diameter AC; and QPHa is inversely " +
        "similar to ABC. Returns a boolean for each claim plus the names of any that fail.",
      args: '{ "A": [163, 100], "B": [133.333, 200], "C": [300, 200] }',
      run: (args) => {
        const C = core();
        const s = readTriangle(C, args);
        geometry(C, s); // reject the degenerate cases the page cannot draw
        return {
          ...claimsSummary(C.claims(s)),
          note:
            "concyclic: P, Q, A' and Ha share a circle; apParallelAc and aqParallelAb: " +
            "A'P || AC and A'Q || AB; equalLegs: A'P = A'Q; midpointBR: P bisects BR; " +
            "circleAC: Ha and Q lie on the circle with diameter AC; similarQPH: QPHa " +
            "is inversely similar to ABC (matching angles, side ratios and reversed orientation).",
        };
      },
    },
  };
}

/** The saved triangle, checkboxes and a core-derived reading of that position. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const defaults = C.start().options as Json;
  const raw = state.options && typeof state.options === "object" ? state.options as Json : {};
  const options = Object.fromEntries(
    Object.keys(defaults).map((k) => [k, raw[k] === undefined ? defaults[k] : Boolean(raw[k])]),
  );
  const s: Triangle & { options: Json } = { ...readTriangle(C, state), options };
  const vertices = { A: pt(s.A), B: pt(s.B), C: pt(s.C) };
  const effectiveOptions = C.effectiveOptions(options) as Json;
  if (!C.isComputable(s)) {
    return {
      stateVersion,
      vertices,
      options,
      effectiveOptions,
      computable: false,
      note:
        "The saved corners are too close together or lie on one line, so the applet " +
        "cannot construct the bisector, altitude or circle. Move the corners apart.",
    };
  }
  const figure = C.construct(s)!;
  const measurement = C.measurements(s)!;
  const { vertices: _readingVertices, ...derived } = reading(C, s, figure, measurement);
  return {
    stateVersion,
    vertices,
    options,
    effectiveOptions,
    computable: true,
    ...derived,
    optionNote:
      "The saved checkboxes only change what is drawn, not the geometry: equal angles " +
      "has no effect unless lines or the big circle is shown.",
  };
}
