/*
 * run_game_logic actions and saved-position reader for Connes.
 *
 * The real core is connes/connes-core.js, copied into src/generated/cores/ at
 * build time. It reproduces the applet's complex-number criterion for an
 * equilateral triangle: with origin O and j a turn of 120 degrees, a
 * positively oriented triangle ABC is equilateral if and only if
 *
 *     A + jB + j^2 C = 0.
 *
 * The core turns B by +120 degrees and C by -120 degrees about O, multiplies
 * both turns by the triangle's orientation sign, and rounds the parallelogram
 * sum to pixels exactly as ConnesCanvas.DrawConnesSum does. Every number in
 * the answers below is measured by that core. See _shared.ts for the shape.
 *
 * Coordinates are the illustration's viewBox units with y down, so a positive
 * turn in screen coordinates is a turn of -120 degrees in mathematical axes.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["connes"].ConnesCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Position = { A: Point; B: Point; C: Point; O: Point; showVectors: boolean };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** Accept both the page's saved {x, y} and the tutor's [x, y] argument arrays. */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return { ...fallback };
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
    const x = Number(raw[0]), y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`argument "${key}" must be [x, y] with finite numbers`);
    }
    return { x, y };
  }
  if (typeof raw !== "object") {
    throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  const o = raw as Json;
  return { x: num(o, "x"), y: num(o, "y") };
}

/** Omitted points fall back to the illustration's opening figure. */
function readPosition(C: Core, args: Json): Position {
  const seed = C.start({}) as Position;
  return {
    A: readPoint(args, "A", seed.A),
    B: readPoint(args, "B", seed.B),
    C: readPoint(args, "C", seed.C),
    O: readPoint(args, "O", seed.O),
    showVectors: args.showVectors === undefined ? seed.showVectors : Boolean(args.showVectors),
  };
}

/** Everything the real core measures about one triangle, in tutor-friendly units. */
function reading(C: Core, s: Position) {
  const m = C.compute(s);
  const cl = C.claims(s);
  const sides = C.sideLengths(s);
  return {
    origin: pt(s.O),
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    orientationSign: m.sign,
    orientation: m.sign === -1 ? "positive (the page's assumption, screen y down)" : "negative",
    rotated: { B1: pt(m.B1), C1: pt(m.C1) },
    complexSum: {
      x: round(m.criterion.x),
      y: round(m.criterion.y),
      length: round(m.criterionLength),
    },
    sumDot: pt(m.sumDot),
    sideLengths: { AB: round(sides.AB), BC: round(sides.BC), CA: round(sides.CA) },
    equilateral: cl.equilateral === true,
    checks: {
      criterionIsZero: cl.criterion === true,
      equilateralIffCriterion: cl.equivalent === true,
      literalPositiveFormula: cl.literalPositive === true,
      onePairOfSidesEnough: cl.onePairOfSides === true,
      sumIsMinusA: cl.sumIsMinusA === true,
      sumDotOnO: cl.sumDotOnO === true,
      rotationsKeepLength: cl.rotationsKeepLength === true,
      parallelogram: cl.parallelogram === true,
      rootsOfUnity: cl.rootsOfUnity === true,
    },
  };
}

const ORIENTATION_CAVEAT =
  "The page's A + jB + j²C = 0 assumes a positively oriented triangle (core sign -1, because screen y grows down). For the opposite order the applet turns B and C the other way, testing the conjugate identity: the sum vanishes exactly when the triangle is equilateral either way, but the page's written formula applies only to the positive order.";

export function actions(): GameActions {
  return {
    connes_sum: {
      describe:
        "For a triangle A, B, C with origin O (each [x, y] or {x, y} in the illustration's board, y down; omit any point to use the opening picture), report the rotated points B1 (turn +120°) and C1 (turn -120°), the complex sum A + jB + j²C measured from O as a vector and a length, the red sum dot S, the three side lengths and whether the triangle is equilateral. The core follows the applet's orientation-aware turn and also checks the page's other claims, including the iff between a zero sum and an equilateral triangle.",
      args: '{ "A": [43, 150], "B": [280, 230], "C": [200, 70], "O": [200, 150] }',
      run: (args) => {
        const C = core();
        const s = readPosition(C, args);
        return {
          ...reading(C, s),
          note: ORIENTATION_CAVEAT,
        };
      },
    },
    equilateral_example: {
      describe:
        "Build the exact equilateral triangle the applet's 'New' button sets up (corners at radius 140 about O, O defaults to the board centre; any A, B, C arguments are ignored) and verify the complex-sum identity there: report the corners, B1, C1, A + jB + j²C (near zero), the sum dot on O and the page's claim checks. This order is positive, so the page's literal formula applies without the conjugate caveat.",
      args: '{ "O": [200, 150] }',
      run: (args) => {
        const C = core();
        const seed = readPosition(C, args);
        const s = C.equilateralPreset(seed) as Position;
        return {
          ...reading(C, s),
          note:
            "The preset makes AB = BC = CA, so the rotated vectors cancel A: A + jB + j²C ≈ 0 and the rounded sum dot lands on O. " +
            ORIENTATION_CAVEAT,
        };
      },
    },
  };
}

/**
 * Track.state saves the three corners, the origin O and the showVectors flag.
 * The core rebuilds B1, C1, the complex sum A + jB + j²C and the sum dot S.
 */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Connes state version ${stateVersion}`);
  }
  const C = core();
  const s = readPosition(C, state);
  const result = C.result();
  return {
    stateVersion,
    result,
    saved: {
      A: pt(s.A),
      B: pt(s.B),
      C: pt(s.C),
      O: pt(s.O),
      showVectors: s.showVectors,
    },
    reading: reading(C, s),
    note:
      "Track.state saved A, B, C, O and showVectors. The core rebuilds the rotated points B1 and C1 and the sum A + jB + j²C: S on O means that sum is zero, which is the equilateral criterion. " +
      ORIENTATION_CAVEAT,
  };
}
