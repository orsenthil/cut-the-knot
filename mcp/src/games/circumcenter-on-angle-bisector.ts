/*
 * run_game_logic actions and saved-position reader for Circumcenter on Angle
 * Bisector.
 *
 * The real core is circumcenter-on-angle-bisector/circumcenter-on-angle-bisector-core.js,
 * copied into src/generated/cores/ at build time. It follows the applet's own
 * construction: the bisectors from B and C meet at the incenter I, the circle
 * through I, B, C has centre O, and the outer bisectors at B and C meet at the
 * excenter E opposite A. Because the angles IBE and ICE are right angles, B and
 * C lie on the circle with diameter IE: O is the midpoint of IE, and since A, I,
 * E are collinear O lies on the bisector from A. The page adds that O also lies
 * on the circumcircle of ABC. Every number below is measured by the core.
 * See _shared.ts for the module shape.
 *
 * Coordinates are the illustration's 400 x 300 viewBox units, with y down.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circumcenter-on-angle-bisector"].CircumcenterOnAngleBisectorCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };
type Line = [Point, Point];
type Measurements = {
  A: Point; B: Point; C: Point;
  feet: { A: Point; B: Point; C: Point };
  lines: { Bi: Line; Be: Line; Ci: Line; Ce: Line; Ai: Line };
  I: Point; O: Point; r: number; E: Point; K: Point; L: Point;
  bigCenter: Point; bigRadius: number;
  sides: { a: number; b: number; c: number };
  doubleArea: number;
  degenerate: boolean;
};
type Claims = {
  bisectorsHalve: boolean; feetOnSides: boolean; iIsIncenter: boolean;
  oOnAI: boolean; eOnAI: boolean; externalPerpendicular: boolean;
  biciCyclic: boolean; ieDiameter: boolean; oOnABCCircle: boolean;
  chordMidpoints: boolean; all: boolean;
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** JSON cannot carry NaN: a missing measurement becomes null. */
const finite = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v);
/** Residuals are tiny; keep their size and sign rather than rounding to zero. */
const sig = (v: number | null | undefined): string | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : v.toExponential(2);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const okPoint = (p: Point | null | undefined): p is Point =>
  p !== null && p !== undefined && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Accept the page's saved {x, y} as well as a short [x, y] argument. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
    const x = Number(raw[0]);
    const y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`argument "${key}" must hold two finite numbers, got ${JSON.stringify(raw)}`);
    }
    return { x, y };
  }
  if (typeof raw !== "object") throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
  return { x: num(raw as Json, "x"), y: num(raw as Json, "y") };
}

/** Omit a corner to use the illustration's opening triangle. */
function triangle(C: Core, args: Json): Triangle {
  const seed = C.start() as Triangle;
  return {
    A: readPoint(args, "A", seed.A),
    B: readPoint(args, "B", seed.B),
    C: readPoint(args, "C", seed.C),
  };
}

/** Throw unless the three corners make a triangle the core can draw. */
function live(args: Json): { C: Core; s: Triangle; m: Measurements } {
  const C = core();
  const s = triangle(C, args);
  // The core's JS inferred return shape does not include its auxiliary fields;
  // the cast restores the full one.
  const m = C.measurements(s) as unknown as Measurements;
  if (m.degenerate || !okPoint(m.I) || !okPoint(m.O) || !okPoint(m.E) ||
      !okPoint(m.K) || !okPoint(m.L) || !okPoint(m.bigCenter) ||
      !Number.isFinite(m.r) || !Number.isFinite(m.bigRadius)) {
    throw new Error(
      "A, B and C must be three distinct, non-collinear corners (each [x, y] or {x, y}) on the page's 400 x 300 board",
    );
  }
  return { C, s, m };
}

/** The points the page draws, with the numbers behind the three named claims. */
function construction(C: Core, s: Triangle, m: Measurements) {
  return {
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: { a: finite(m.sides.a), b: finite(m.sides.b), c: finite(m.sides.c) },
    doubleArea: finite(m.doubleArea),
    bisectorFeet: { A: pt(m.feet.A), B: pt(m.feet.B), C: pt(m.feet.C) },
    incenter: pt(m.I),
    excenterOppositeA: pt(m.E),
    circumcenterOfBIC: pt(m.O),
    circleBIC: { center: pt(m.O), radius: finite(m.r) },
    chordMidpoints: { IB: pt(m.K), IC: pt(m.L) },
    circumcircleOfABC: { center: pt(m.bigCenter), radius: finite(m.bigRadius) },
    distances: {
      IO: finite(C.distance(m.I, m.O)),
      IE: finite(C.distance(m.I, m.E)),
      radius_r: finite(m.r),
      O_to_AI: sig(C.distToLine(m.O, s.A, m.I)),
      E_to_AI: sig(C.distToLine(m.E, s.A, m.I)),
      O_minus_midpointIE: sig(C.distance(C.midpoint(m.I, m.E), m.O)),
      O_to_ABC_circle: sig(C.distance(m.O, m.bigCenter) - m.bigRadius),
      IO_minus_r: sig(C.distance(m.I, m.O) - m.r),
      OB_minus_r: sig(C.distance(m.O, s.B) - m.r),
      OC_minus_r: sig(C.distance(m.O, s.C) - m.r),
      IE_minus_2r: sig(C.distance(m.I, m.E) - 2 * m.r),
    },
  };
}

/** The core's checks, with O on AI, O the midpoint of IE and O on (ABC) first. */
function checks(C: Core, s: Triangle, m: Measurements) {
  const cl = C.claims(s) as unknown as Claims;
  const names = [
    "bisectorsHalve", "feetOnSides", "iIsIncenter", "oOnAI", "eOnAI",
    "externalPerpendicular", "biciCyclic", "ieDiameter", "oOnABCCircle",
    "chordMidpoints", "all",
  ] as const;
  const failed = names.filter((k) => cl[k] !== true);
  // The core uses an absolute tolerance proportional to the longest side.
  const tol = 1e-6 * Math.max(m.sides.a, m.sides.b, m.sides.c);
  const midpointResidual = C.distance(C.midpoint(m.I, m.E), m.O);
  return {
    oOnAI: cl.oOnAI === true,
    oIsMidpointOfIE: midpointResidual <= tol,
    oOnCircumcircleOfABC: cl.oOnABCCircle === true,
    eOnAI: cl.eOnAI === true,
    incenterIsI: cl.iIsIncenter === true,
    bisectorsHalve: cl.bisectorsHalve === true,
    feetOnSides: cl.feetOnSides === true,
    externalBisectorsPerpendicular: cl.externalPerpendicular === true,
    bicCircleHasCentreO: cl.biciCyclic === true,
    ieIsDiameter: cl.ieDiameter === true,
    chordMidpoints: cl.chordMidpoints === true,
    allHold: failed.length === 0,
    failed,
    residuals: {
      O_to_AI: sig(C.distToLine(m.O, s.A, m.I)),
      O_minus_midpointIE: sig(midpointResidual),
      O_to_ABC_circle: sig(C.distance(m.O, m.bigCenter) - m.bigRadius),
      tolerance: finite(tol),
    },
    note: failed.length
      ? "Some core checks failed; move the corners apart to make a non-collinear triangle and try again."
      : "All checks hold. The outer bisectors make angles IBE and ICE right angles, so B and C lie on the circle with diameter IE; its centre O is the midpoint of IE. Since A, I and E are collinear, O lies on the bisector from A, and it also lies on the circumcircle of ABC. The core's radius is an average of three distances, so the residuals are tiny but not exactly zero.",
  };
}

export function actions(): GameActions {
  return {
    diagram: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or {x, y} in the illustration's 400 x 300 board, y down), report the angle-bisector feet, the incenter I, the excenter E opposite A, the circle through B, I and C with its centre O and radius, the chord midpoints K and L, and the circumcircle of ABC. Distances include O to the line AI, O minus the midpoint of IE, O to the circumcircle of ABC and the small radius residuals. Omit a corner to use the illustration's opening triangle. Refuses a degenerate triangle.",
      args: '{ "A": [183, 75], "B": [133.33333333333334, 180], "C": [266.6666666666667, 180] }',
      run: (args) => {
        const { C, s, m } = live(args);
        return {
          ...construction(C, s, m),
          note:
            "The core intersects the bisectors from B and C to get I, builds the circle through I, B, C to get O, and intersects the outer bisectors at B and C to get E. A, I, O and E are collinear; O is the midpoint of IE and lies on the circumcircle of ABC.",
        };
      },
    },
    check_claims: {
      describe:
        "Test the illustration's claims for a triangle A, B, C (each [x, y] or {x, y}): O lies on the bisector from A, O is the midpoint of IE (IE is a diameter of the circle through B, I and C), and O lies on the circumcircle of ABC; also the bisectors halve the angles, their feet are on the sides, I is the incenter, E is on AI, the outer bisectors are perpendicular, B, I, C are cyclic and O lies on the perpendicular bisectors of IB and IC. Returns a boolean for each, the failed names and the three key residuals. Arguments as in diagram.",
      args: '{ "A": [183, 75], "B": [133.33333333333334, 180], "C": [266.6666666666667, 180] }',
      run: (args) => {
        const { C, s, m } = live(args);
        return checks(C, s, m);
      },
    },
  };
}

/** Track.state saves only the three draggable corners; the core rebuilds the rest. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circumcenter on Angle Bisector state version ${stateVersion}`);
  }
  const C = core();
  const s = triangle(C, state);
  // The core's result() ignores its argument: an illustration cannot be won.
  const result: (state: Json) => unknown = C.result;
  const saved = {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    result: result(state),
  };
  const m = C.measurements(s) as unknown as Measurements;
  if (m.degenerate || !okPoint(m.I) || !okPoint(m.O) || !okPoint(m.E) ||
      !okPoint(m.K) || !okPoint(m.L) || !okPoint(m.bigCenter) ||
      !Number.isFinite(m.r) || !Number.isFinite(m.bigRadius)) {
    return {
      ...saved,
      degenerate: true,
      note: "The saved corners are collinear, too close together, or not a drawable triangle, so there is no incenter, excenter or circle through B, I and C to measure.",
    };
  }
  return {
    ...saved,
    degenerate: false,
    reading: {
      ...construction(C, s, m),
      ...checks(C, s, m),
    },
    note:
      "Track.state saved the three draggable corners. The core rebuilds the bisectors, the incenter I, the circle through B, I, C with centre O, the excenter E and the circumcircle of ABC from them, then checks O on AI, O as the midpoint of IE and O on (ABC) at exactly this position.",
  };
}
