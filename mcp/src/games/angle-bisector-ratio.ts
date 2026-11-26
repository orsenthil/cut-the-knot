/*
 * run_game_logic actions and saved-position reader for Angle Bisector Ratio.
 *
 * The real core is angle-bisector-ratio/angle-bisector-ratio-core.js, copied
 * into src/generated/cores/ at build time. It places the internal bisector
 * foot with side lengths as weights: with a = |BC|, b = |CA|, c = |AB|,
 *
 *   D = (b*B + c*C)/(b+c),   X = (c*C - b*B)/(c-b) for the external foot,
 *
 * so AB/AC = DB/DC = XB/XC. When b = c the external bisector is parallel to
 * BC (no foot) and AD is perpendicular to BC. The proof construction draws
 * the line through C parallel to AD, meeting line AB at E: AEC is isosceles
 * (AE = AC) and triangles BEC and BAD are similar (BE/BA = BC/BD).
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angle-bisector-ratio"].AngleBisectorRatioCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };

const r = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : r(v);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: r(p.x), y: r(p.y) } : null;
const deg = (rad: number | null | undefined): number | null =>
  rad === null || rad === undefined ? null : r((rad * 180) / Math.PI);

/** Accept [x, y] and the page's saved { x, y } for a corner. */
function readPoint(args: Json, key: string, fallback: Point): Point {
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
  if (v !== undefined && v !== null) {
    throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  return fallback;
}

function readTriangle(C: Core, args: Json): Triangle {
  const fresh = C.start();
  return {
    A: readPoint(args, "A", fresh.A),
    B: readPoint(args, "B", fresh.B),
    C: readPoint(args, "C", fresh.C),
  };
}

type ClaimFlags = {
  footOnSide: boolean; bisectsAngle: boolean; bisectorRatio: boolean;
  isosceles: boolean; parallel: boolean; similarTriangles: boolean;
  converseUnique: boolean; externalRatio: boolean;
};

const CLAIM_NAMES: (keyof ClaimFlags)[] = [
  "footOnSide", "bisectsAngle", "bisectorRatio", "isosceles",
  "parallel", "similarTriangles", "converseUnique", "externalRatio",
];

function claimFlags(C: Core, s: Triangle): ClaimFlags {
  const cl = C.claims(s);
  return {
    footOnSide: cl.footOnSide === true,
    bisectsAngle: cl.bisectsAngle === true,
    bisectorRatio: cl.bisectorRatio === true,
    isosceles: cl.isosceles === true,
    parallel: cl.parallel === true,
    similarTriangles: cl.similarTriangles === true,
    converseUnique: cl.converseUnique === true,
    externalRatio: cl.externalRatio === true,
  };
}

/** Everything the core measures about one triangle, in tutor-friendly units. */
function reading(C: Core, s: Triangle) {
  const m = C.measurements(s);
  const flags = claimFlags(C, s);
  const failed = CLAIM_NAMES.filter((k) => !flags[k]);
  const isoscelesAtA = Math.abs(m.sides.c - m.sides.b) < 1e-7;
  return {
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: { a: maybe(m.sides.a), b: maybe(m.sides.b), c: maybe(m.sides.c) },
    degenerate: m.degenerate === true,
    isoscelesAtA,
    bisectorFoot: pt(m.D),
    halfAnglesDegrees: { BAD: deg(m.angles.BAD), DAC: deg(m.angles.DAC) },
    ratios: {
      AB_over_AC: maybe(m.ratios.AB_AC),
      DB_over_DC: maybe(m.ratios.DB_DC),
      externalDB_over_DC: maybe(m.ratios.externalDB_DC),
    },
    proof: {
      E: pt(m.E),
      AE_over_AC: maybe(m.ratios.AE_AC),
      BE_over_BA: maybe(m.ratios.BE_BA),
      BC_over_BD: maybe(m.ratios.BC_BD),
      CE_over_AD: maybe(m.ratios.CE_AD),
      note:
        "Through C draw a line parallel to AD; it meets line AB at E. Angle ACE equals the half angle CAD, which equals BAD, which equals AEC, so AEC is isosceles and AE = AC. Triangles BEC and BAD are similar, giving BE/BA = BC/BD; with AE = AC this rearranges to DB/DC = AB/AC.",
    },
    external: {
      foot: pt(m.externalFoot),
      ratioMatchesInternal: flags.externalRatio,
      note: isoscelesAtA
        ? "AB = AC: the external bisector is parallel to BC and has no foot; AD is perpendicular to BC, D is the midpoint, and both ratios are 1."
        : "The external bisector of angle A meets line BC outside the segment. Its distances to B and C still compare as AB to AC, and it is perpendicular to the internal bisector AD.",
    },
    claims: flags,
    note: m.degenerate
      ? "The corners are in a line or two corners coincide: there is no triangle and no bisector to measure. Move the corners apart."
      : `Side lengths are weights: D = (b*B + c*C)/(b+c), so AB/AC = ${maybe(m.ratios.AB_AC) ?? "—"} equals DB/DC = ${maybe(m.ratios.DB_DC) ?? "—"}. The converse is unique: only one point of BC splits it in that ratio.`,
  };
}

export function actions(): GameActions {
  return {
    bisector: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] in page coordinates, y downward; omit a corner to use the page's starting triangle): report side lengths a=|BC|, b=|CA|, c=|AB|, the internal bisector foot D on BC and the two equal half-angles at A, the ratios AB/AC and DB/DC, the external bisector foot (null when AB = AC because it is parallel to BC), the proof's point E with AE/AC = 1 and the similar-triangle ratios BE/BA = BC/BD, plus claims for each page statement. Set A=[0,0], B=[10,0], C=[6,8] (so AB = AC = 10) to see the isosceles parallel case.",
      args: '{ "A": [0, 0], "B": [10, 0], "C": [4, 6] }',
      run: (args) => {
        const C = core();
        return reading(C, readTriangle(C, args));
      },
    },
    check_claims: {
      describe:
        "Check every statement on the illustration's page at a triangle A, B, C: D lies on BC, AD bisects angle A, AB/AC = DB/DC, the auxiliary triangle AEC is isosceles with CE parallel to AD, triangles BEC and BAD are similar, the converse point on BC is unique, and the external bisector gives the same ratio (for AB = AC it is parallel to BC and AD is perpendicular to BC). Returns a boolean for each, the failed names and a short explanation.",
      args: '{ "A": [0, 0], "B": [10, 0], "C": [6, 8] }',
      run: (args) => {
        const C = core();
        const s = readTriangle(C, args);
        const flags = claimFlags(C, s);
        const failed = CLAIM_NAMES.filter((k) => !flags[k]);
        return {
          ...flags,
          allHold: failed.length === 0,
          failed,
          note: failed.length
            ? "One or more claims fail: the corners may be in a line or too close together; move them apart to make a triangle."
            : "Every page claim holds here. D divides BC in the ratio AB/AC, the parallel through C makes AEC isosceles, and the external bisector gives the same ratio (with AB = AC it is parallel to BC).",
        };
      },
    },
  };
}

/** The page's saved triangle and options, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readTriangle(C, state);
  return {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    showNames: state.showNames !== false,
    hint: state.hint === true,
    extra: state.extra === true,
    reading: reading(C, s),
  };
}
