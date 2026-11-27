/*
 * run_game_logic actions and saved-position reader for Conic Sections
 * (Bogomolny's "Cut the Cone"), an illustration with no win and no loss.
 *
 * The applet fixes a double cone of radius 6 and height 12, so a generator
 * meets the base at alpha = atan(12/6) ≈ 63.4° and the cone's slope is
 * m = radius/height = cot(alpha) = 0.5. A plane x - y tan(beta) = d is tilted
 * beta from the base and sits d units along the axis from the vertex; in the
 * plane's own coordinates the section is A u² + B u + C + v² = 0 with
 * A = cos²beta - m² sin²beta and B²/4 - AC = p² m² (p = d cos beta). Because
 * that last quantity stays positive away from the vertex, the sign of A alone
 * decides the family: beta < alpha is an ellipse (a circle at beta = 0),
 * beta = alpha a parabola, beta > alpha a hyperbola; at d = 0 they collapse to
 * a point, a line and a pair of lines.
 *
 * Every number below comes from the real core
 * (conic-sections/conic-sections-core.js), copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape. Angles are degrees.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["conic-sections"].ConicSectionsCore as any;

const PRESETS = ["circle", "ellipse", "parabola", "hyperbola", "vertex"] as const;
const RELATION: Record<number, string> = { "-1": "less than", 0: "equal to", 1: "greater than" };

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));

/** Validate a tilt against the core's slider range. */
function readBeta(args: Json, key = "beta"): number {
  const C = core();
  const beta = num(args, key);
  if (beta < C.MIN_BETA || beta > C.MAX_BETA) {
    throw new Error(`"${key}" must be between ${C.MIN_BETA} and ${C.MAX_BETA} degrees`);
  }
  return beta;
}

/** Validate the plane's signed distance from the vertex against the core's range. */
function readOffset(args: Json, key = "offset"): number {
  const C = core();
  const offset = num(args, key);
  if (offset < C.MIN_OFFSET || offset > C.MAX_OFFSET) {
    throw new Error(`"${key}" must be between ${C.MIN_OFFSET} and ${C.MAX_OFFSET}`);
  }
  return offset;
}

/** Build a core state from an optional preset name plus optional beta/offset overrides. */
function stateFromArgs(args: Json): any {
  const C = core();
  let s = C.start({});
  if (args.preset !== undefined) {
    const name = String(args.preset);
    if (!PRESETS.includes(name as (typeof PRESETS)[number])) {
      throw new Error(`"preset" must be one of ${PRESETS.join(", ")}`);
    }
    s = C.preset(s, name);
  }
  if (args.beta !== undefined) s = C.setBeta(s, readBeta(args));
  if (args.offset !== undefined) s = C.setOffset(s, readOffset(args));
  if (args.transparent !== undefined) s = { ...s, transparent: args.transparent === true };
  if (args.linked !== undefined) s = { ...s, linked: args.linked === true };
  return s;
}

/** The core's own analysis of one picture, rounded and named for a tutor. */
function reading(state: any) {
  const C = core();
  const a = C.analyse(state);
  const status = C.describe(state) as { title: string; text: string };
  return {
    beta: round(a.beta, 4),
    offset: round(a.offset, 4),
    generatorAngle: round(a.alpha, 4),
    slope: round(C.SLOPE, 6),
    relation: a.relation,
    planeVsGenerator: RELATION[a.relation] ?? String(a.relation),
    family: a.family,
    detail: a.detail,
    degenerate: a.degenerate === true,
    signedDistance: round(a.p, 6),
    quadratic: { A: round(a.A, 6), B: round(a.B, 6), C: round(a.C, 6) },
    halfDiscriminant: round(a.disc, 6),
    centerU: round(a.centerU, 6),
    scaleU: round(a.scaleU, 6),
    scaleV: round(a.scaleV, 6),
    status,
  };
}

export function actions(): GameActions {
  return {
    classify_section: {
      describe:
        "Classify the section made by a cutting plane tilted beta degrees from the cone's base and sitting offset units along the axis from the vertex, using one of the page's presets or explicit beta/offset values. Reports the generator angle alpha, whether beta is below/equal/above alpha, the family (ellipse, parabola or hyperbola) and any vertex degeneracy (point, line or pair of lines), the quadratic's coefficients and discriminant, and the core's own one-line description. beta must be 0 to 80 and offset -12 to 12.",
      args: '{ "beta": 30, "offset": 7 }',
      run: (args) => {
        const state = stateFromArgs(args);
        const r = reading(state);
        const why = r.degenerate
          ? `The plane passes through the vertex (p = 0), so the ${r.family} collapses to ${r.detail === "lines" ? "a pair of lines" : `a ${r.detail}`}.`
          : `The plane misses the vertex (p = ${r.signedDistance}), so the section is a genuine ${r.family}${r.detail === "circle" ? " — a circle, since beta = 0 makes the cut parallel to the base" : ""}.`;
        return {
          ...r,
          note: `${r.status.text} ${why} Because B²/4 − AC = p²m² stays positive away from the vertex, the sign of A = cos²beta − m²sin²beta alone decides the family.`,
        };
      },
    },

    angle_cases: {
      describe:
        "Run the real core on the page's memorable placements and report each section: beta = 0 (circle), an angle below alpha (ellipse), beta = alpha (parabola), an angle above alpha (hyperbola), then the same tilts with the plane through the vertex giving a point, a line and a pair of lines. The generator angle alpha ≈ 63.4° is fixed by the applet's cone (radius 6, height 12); an optional offset sets the plane's distance for the four non-degenerate cases (default 7).",
      args: '{ "offset": 7 }',
      run: (args) => {
        const C = core();
        const offset = num(args, "offset", C.DEFAULT_OFFSET);
        if (offset < C.MIN_OFFSET || offset > C.MAX_OFFSET) {
          throw new Error(`"offset" must be between ${C.MIN_OFFSET} and ${C.MAX_OFFSET}`);
        }
        const families = [
          { name: "circle", beta: 0 },
          { name: "ellipse", beta: 30 },
          { name: "parabola", beta: C.ALPHA },
          { name: "hyperbola", beta: 75 },
        ].map(({ name, beta }) => ({
          case: name,
          ...reading(C.start({ beta, offset })),
        }));
        const vertexDegeneracies = [
          { name: "point", beta: 30 },
          { name: "line", beta: C.ALPHA },
          { name: "lines", beta: 75 },
        ].map(({ name, beta }) => ({
          case: name,
          ...reading(C.start({ beta, offset: 0 })),
        }));
        return {
          generatorAngle: round(C.ALPHA, 4),
          slope: round(C.SLOPE, 6),
          offsetUsed: offset,
          families,
          vertexDegeneracies,
          note:
            `The applet's cone fixes alpha = atan(12/6) ≈ ${round(C.ALPHA, 1)}° and m = cot(alpha) = ${round(C.SLOPE, 3)}. ` +
            "Below alpha the plane cuts one nappe in an ellipse (a circle at beta = 0), at alpha it runs parallel to a generator in a parabola, and above alpha it cuts both nappes in a hyperbola. " +
            "Slide the plane onto the vertex (offset = 0) and each closes down to a point, one line or two lines.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh reading by the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Conic Sections state version ${stateVersion}`);
  }
  const C = core();
  const s = state ?? ({} as Json);
  const saved = {
    beta: s.beta,
    offset: s.offset,
    transparent: s.transparent,
    linked: s.linked,
    stateVersion,
  };
  let here: any;
  let savedReadable = true;
  try {
    const beta = readBeta(s);
    const offset = readOffset(s);
    here = C.start({
      beta,
      offset,
      transparent: s.transparent === undefined ? true : s.transparent === true,
      linked: s.linked === true,
    });
  } catch {
    savedReadable = false;
    here = C.start({});
  }
  const r = reading(here);
  return {
    stateVersion,
    savedReadable,
    saved,
    ...r,
    note: !savedReadable
      ? "The saved numbers could not be read, so the opening picture is shown instead."
      : `The saved plane is tilted ${r.beta}° from the base (generator angle ${r.generatorAngle}°), ${r.planeVsGenerator} a generator: ${r.status.title}${r.degenerate ? " through the vertex" : ""}.`,
  };
}
