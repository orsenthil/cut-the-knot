/*
 * run_game_logic actions and saved-position reader for Isosceles Triangle In Circle.
 *
 * The real core lives in isosceles-triangle-in-circle/ and is copied into
 * src/generated/cores/ at build time. Triangle ABC can be dragged; D is the
 * midpoint of AB, E is the centroid of ACD, and O is the circumcenter of ABC.
 * Put the origin at O: |A| = |B| = |C|, D = (A + B)/2 and E = (3A + 2C + B)/6,
 * so the one dot product the applet draws gives
 *
 *     (E − O)·(D − C) = (1/3) A·(B − C) = (AC² − AB²)/6.
 *
 * Hence EO ⟂ CD exactly when AB = AC (equivalently AO ⟂ BC), on every
 * nondegenerate triangle. The applet's CheckFinished is a separate, strictly
 * one-pixel test |AB − AC| < 1, while Check the claim uses a scaled numerical
 * tolerance; the reader reports both. Coordinates are the illustration's
 * 400 x 250 viewBox units, with y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["isosceles-triangle-in-circle"].IsoscelesTriangleInCircleCore;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Point = { x: number; y: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** JSON cannot carry NaN: a missing measurement becomes null. */
const finite = (v: number): number | null => (Number.isFinite(v) ? round(v) : null);
/** Residuals are tiny; keep their size and sign instead of rounding to zero. */
const sig = (v: number): string | null => (Number.isFinite(v) ? v.toExponential(2) : null);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/** Accept the page's saved {x, y} as well as a short [x, y] argument. */
function pointArg(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return { ...fallback };
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
  const o = raw as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

/** The page's state, rebuilt with the core's start() and its three checkboxes. */
function readState(C: Core, args: Json): State {
  const seed = C.start({});
  return C.start({
    A: pointArg(args, "A", seed.A),
    B: pointArg(args, "B", seed.B),
    C: pointArg(args, "C", seed.C),
    showNames: args.showNames === true,
    showPremise: args.showPremise === true,
    showHint: args.showHint === true,
  });
}

/** Refuse a flat triangle: the applet then has no circumcenter O and no claim. */
function live(args: Json) {
  const C = core();
  const s = readState(C, args);
  const m = C.measure(s);
  const cl = C.claims(s);
  if (!cl.nondegenerate) {
    throw new Error(
      "A, B and C must be three distinct, non-collinear points (each [x, y] or {x, y}) " +
      "on the page's 400 x 250 board; a flat triangle has no circumcenter O",
    );
  }
  return { C, s, m, cl };
}

/** Unrounded construction, identity, claims and finish test shared by both readers. */
function reading(C: Core, s: State) {
  const m = C.measure(s);
  const cl = C.claims(s);
  // The core checks |dot - predicted| against 1e-8 * scale twice.
  const tolerance = 1e-8 * m.scale * m.scale;
  const residual = Math.abs(m.dot - m.predicted);
  return {
    vertices: { A: pt(m.A), B: pt(m.B), C: pt(m.C) },
    constructed: {
      D: pt(m.D), E: pt(m.E), O: pt(m.O), P: pt(m.P), M: pt(m.M),
      S: pt(m.S), F: pt(m.F), Am: pt(m.Am), H: pt(m.H),
    },
    circumcircle: m.circle
      ? { center: pt(m.circle.center), radius: finite(m.circle.radius) }
      : null,
    lengths: {
      AB: finite(m.AB), AC: finite(m.AC), BC: finite(m.BC),
      difference: finite(m.diff),
    },
    dotProducts: {
      EO_dot_DC: sig(m.dot),
      AC_squared_minus_AB_squared_over_6: sig(m.predicted),
      identityResidual: sig(residual),
      identityTolerance: finite(tolerance),
      identityHolds: residual <= tolerance,
      AO_dot_BC: sig(m.aoDotBC),
    },
    finish: {
      onePixelLimit: 1,
      strictLessThan: true,
      withinOnePixel: m.diff < 1,
      finished: C.finished(s),
    },
    checks: {
      perpendicular: cl.perpendicular,
      equalLegs: cl.equalLegs,
      equivalent: cl.equivalent,
      altitudeIsMedian: cl.altitude,
      definitions: cl.definition,
      collinear: cl.collinear,
      nondegenerate: cl.nondegenerate,
      all: cl.all,
      perpendicularMatchesEquality: near(m.dot, 0, tolerance) === cl.equalLegs,
    },
  };
}

export function actions(): GameActions {
  return {
    dot_product_identity: {
      describe:
        "For a triangle with draggable corners A, B, C (each [x, y] or {x, y} on the page's 400 x 250 board; omit a corner for the opening triangle), report D the midpoint of AB, E the centroid of ACD, O the circumcenter and the other points the page draws. Then check (E−O)·(D−C) = (AC²−AB²)/6 with its residual, so EO is perpendicular to CD exactly when AB = AC, which is also AO perpendicular to BC. Refuses a flat triangle, which has no circumcenter.",
      args: '{ "A": [269.6666666666667, 71.42857142857143], "B": [66.66666666666667, 208.33333333333334], "C": [333.3333333333333, 208.33333333333334] }',
      run: (args) => {
        const { C, s } = live(args);
        return {
          ...reading(C, s),
          note:
            "With the origin at O, |A| = |B| = |C|, D = (A+B)/2 and E = (3A+2C+B)/6, so " +
            "(E−O)·(D−C) = (1/3)A·(B−C) = (AC²−AB²)/6. The dot product vanishes exactly " +
            "when AB = AC, and the same identity makes that equivalent to AO ⟂ BC. " +
            "The core's circumcircle radius is the mean of the three distances from O, " +
            "so small residuals are expected.",
        };
      },
    },
    check_claims: {
      describe:
        "Test the illustration's claims for a triangle A, B, C (arguments as in dot_product_identity): EO ⟂ CD iff AB = AC, both also equivalent to AO ⟂ BC, the altitude from A is the median, and E, D and O are the centroid, midpoint and circumcenter. Reports a boolean for each, the dot-product residual, and the page's separate Finish test |AB − AC| < 1, which is strict: a triangle within one pixel can be marked finished yet fail Check the claim.",
      args: '{ "A": [200.05, 70], "B": [100, 210], "C": [300, 210] }',
      run: (args) => {
        const { C, s } = live(args);
        const r = reading(C, s);
        return {
          vertices: r.vertices,
          lengths: r.lengths,
          dotProducts: r.dotProducts,
          finish: r.finish,
          checks: r.checks,
          failed: Object.entries(r.checks)
            .filter(([key, value]) => key !== "collinear" && value === false)
            .map(([key]) => key),
          note: r.finish.withinOnePixel && !r.checks.perpendicular
            ? "This triangle is within the applet's strict one-pixel Finish limit, so the page may call it finished, but the dot product is not zero at the numerical tolerance used by Check the claim. Only an exactly isosceles triangle makes EO perpendicular to CD."
            : "Perpendicularity and equal legs stand or fall together by the dot-product identity; Finish uses a different, strictly one-pixel rule. This illustration has no win or loss.",
        };
      },
    },
  };
}

/** Track.state saves the core state; echo those fields and read them afresh. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Isosceles Triangle In Circle state version ${stateVersion}`);
  }
  const C = core();
  const s = readState(C, state);
  const saved = {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    showNames: s.showNames,
    showPremise: s.showPremise,
    showHint: s.showHint,
    // The core's result() ignores its argument: an illustration cannot be won.
    result: (C.result as (state: Json) => unknown)(s),
  };
  if (!C.claims(s).nondegenerate) {
    return {
      ...saved,
      degenerate: true,
      note: "The saved corners are collinear or too close together, so the applet has no circumcenter O and no perpendicular claim to check.",
    };
  }
  return {
    ...saved,
    degenerate: false,
    reading: reading(C, s),
    note:
      "Track.state saved the three draggable corners and the three overlay flags. " +
      "The core rebuilds D, E, O and the line EO and evaluates (E−O)·(D−C) = (AC²−AB²)/6 " +
      "at this saved position; the strict one-pixel Finish test is reported separately " +
      "from Check the claim's numerical tolerance.",
  };
}
