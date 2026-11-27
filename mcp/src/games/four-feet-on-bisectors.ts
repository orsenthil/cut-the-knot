/*
 * run_game_logic actions and saved-position reader for Four Feet On Bisectors.
 *
 * The real core is four-feet-on-bisectors/four-feet-on-bisectors-core.js,
 * copied into src/generated/cores/ at build time. It follows the applet's
 * Compute(): at each base vertex it finds the internal bisector (a rotation
 * through half the angle) and the perpendicular to it (the external
 * bisector), then projects A onto all four lines. The feet are M and N on the
 * internal bisectors and P and Q on the external ones. The rectangle AMBP
 * gives angle AMP = angle ABP = (180 - B)/2 = (A + C)/2, and A, N, I, M are
 * cyclic, so angle AMN = angle AIN. The article prints angle AIN = A/2 + B/2,
 * which is false except when B = C; the core measures both values.
 *
 * Coordinates are page units in the board's 500 x 450 viewBox, y downward.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["four-feet-on-bisectors"].FourFeetOnBisectorsCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Line = { p: Point; q: Point };
type Triangle = { A: Point; B: Point; C: Point };
type Construction = {
  ok: boolean;
  degenerate: boolean;
  footB: Point | null;
  footC: Point | null;
  Bi: Line | null;
  Be: Line | null;
  Ci: Line | null;
  Ce: Line | null;
  M: Point | null;
  N: Point | null;
  P: Point | null;
  Q: Point | null;
  I: Point | null;
  line: Line | null;
};
type Measurements = {
  ok: boolean;
  angleA: number;
  angleB: number;
  angleC: number;
  amp: number;
  abp: number;
  amn: number;
  ain: number;
  pageAIN: number;
  rectangle: number[];
  cyclicGap: number;
  collinearGap: number;
  simsonGap: number;
  incenterGap: number;
  maxGap: number;
};
type Claims = {
  valid: boolean;
  rectangle: boolean;
  feetOnBisectors: boolean;
  pageAngles: boolean;
  colEqualAngles: boolean;
  cyclic: boolean;
  collinear: boolean;
  simson: boolean;
  pageAINValue: boolean;
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** Keep the size of tiny residuals: rounding them to six places would say 0. */
const fine = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toPrecision(6));
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const okPoint = (p: Point | null | undefined): p is Point =>
  p !== null && p !== undefined && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Accept the saved {x, y} form and the shorter [x, y] form, with a default. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    const a = numArray(args, key);
    return { x: a[0], y: a[1] };
  }
  if (typeof raw !== "object") {
    throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  return { x: num(raw as Json, "x"), y: num(raw as Json, "y") };
}

/**
 * Rebuild the three corners. With no fallback every corner is required, as it
 * is in Track.state; the actions fall back to the illustration's opening
 * triangle when a corner is omitted.
 */
function readTriangle(C: Core, args: Json, seed?: Triangle): Triangle {
  return {
    A: readPoint(args, "A", seed?.A),
    B: readPoint(args, "B", seed?.B),
    C: readPoint(args, "C", seed?.C),
  };
}

/** Refuse triangles the applet cannot draw (coincident or collinear corners). */
function live(args: Json) {
  const C = core();
  const s = readTriangle(C, args, C.start() as Triangle);
  const c = C.construction(s) as unknown as Construction;
  const m = C.measurements(s) as unknown as Measurements;
  const cl = C.claims(s) as unknown as Claims;
  if (!c.ok || c.degenerate || !okPoint(c.I) ||
      ![c.M, c.N, c.P, c.Q].every(okPoint) ||
      ![c.Bi, c.Be, c.Ci, c.Ce, c.line].every(
        (l) => l !== null && okPoint(l.p) && okPoint(l.q),
      )) {
    throw new Error(
      "A, B and C must be three distinct, non-collinear corners ([x, y] or {x, y}) for the four bisectors and their feet to exist",
    );
  }
  return { C, s, c, m, cl };
}

/** All the core's numbers for one drawable triangle, in tutor-friendly units. */
function reading(C: Core, s: Triangle, c: Construction, m: Measurements, cl: Claims) {
  const foot = (p: Point, l: Line, bisector: string) => ({
    at: pt(p),
    bisector,
    distanceToThatBisector: fine(C.distToLine(p, l)),
  });
  const failedClaims = ([
    "rectangle", "feetOnBisectors", "pageAngles", "colEqualAngles", "cyclic",
    "collinear", "simson", "pageAINValue",
  ] as const).filter((k) => cl[k] !== true);
  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    feet: {
      M: foot(c.M!, c.Bi!, "internal at B"),
      N: foot(c.N!, c.Ci!, "internal at C"),
      P: foot(c.P!, c.Be!, "external at B"),
      Q: foot(c.Q!, c.Ce!, "external at C"),
    },
    incenter: pt(c.I),
    commonLine: c.line ? { through: [pt(c.line.p), pt(c.line.q)] } : null,
    anglesDegrees: {
      A: fine(m.angleA), B: fine(m.angleB), C: fine(m.angleC),
      AMP: fine(m.amp), ABP: fine(m.abp), AMN: fine(m.amn), AIN: fine(m.ain),
      trueAIN_A_over_2_plus_C_over_2: fine((m.angleA + m.angleC) / 2),
      printedAIN_A_over_2_plus_B_over_2: fine(m.pageAIN),
    },
    gaps: {
      collinear: fine(m.collinearGap),
      cyclicANIM: fine(m.cyclicGap),
      simson: fine(m.simsonGap),
      rectangleRightAngles: m.rectangle.map(fine),
      incenterEquidistant: fine(m.incenterGap),
      maxScaled: fine(m.maxGap),
    },
    claims: cl,
    failedClaims,
  };
}

export function actions(): GameActions {
  return {
    four_feet: {
      describe:
        "For triangle ABC (corners as [x, y] or {x, y} on the page's 500 x 450 board, y down; omit a corner for the opening triangle), use the real core to find the internal and external bisectors at B and C and the four perpendicular feet from A: M and N on the internal bisectors, P and Q on the external ones. Report the feet, the incenter I, the line through all four feet, the angles AMP, ABP, AMN and AIN in degrees, and the core's collinearity, cyclic ANIM, rectangle and Simson gaps with its claim checks. Refuses a degenerate triangle.",
      args: '{ "A": [203, 150], "B": [166.66666666666666, 360], "C": [333.3333333333333, 360] }',
      run: (args) => {
        const { C, s, c, m, cl } = live(args);
        return {
          ...reading(C, s, c, m, cl),
          note:
            "M and N are the feet from A on the internal bisectors at B and C; P and Q are the feet on the external ones. Because the two bisectors at a vertex are perpendicular, AMBP is a rectangle, so angle AMP = angle ABP = (A + C)/2 = 90 - B/2. A, N, I, M are cyclic, so angle AMN = angle AIN; these equal angles put M, N and P on one line, and Q joins it by the same argument at C.",
        };
      },
    },
    angle_check: {
      describe:
        "For the same triangle ABC, check the article's angle claim against the real core: ANIM is cyclic, so angle AMN = angle AIN = A/2 + C/2 = 90 - B/2, while the printed A/2 + B/2 is generally wrong. Report both values in degrees with their difference (B - C)/2, the rectangle's four right-angle residuals and the cyclic ANIM gap, and say whether the printed value happens to agree here (only when B = C). Arguments as in four_feet.",
      args: '{ "A": [203, 150], "B": [166.66666666666666, 360], "C": [333.3333333333333, 360] }',
      run: (args) => {
        const { s, m, cl } = live(args);
        const angleAin = fine(m.ain);
        const printed = fine(m.pageAIN);
        const agrees = cl.pageAINValue === true;
        return {
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          anglesDegrees: {
            A: fine(m.angleA), B: fine(m.angleB), C: fine(m.angleC),
            AMP: fine(m.amp), ABP: fine(m.abp), AMN: fine(m.amn), AIN: angleAin,
            printed_A_over_2_plus_B_over_2: printed,
            true_A_over_2_plus_C_over_2: fine((m.angleA + m.angleC) / 2),
            printedMinusTrue: fine(m.pageAIN - m.ain),
            expected_B_minus_C_over_2: fine((m.angleB - m.angleC) / 2),
          },
          claims: {
            cyclicANIM: cl.cyclic,
            rectangleAllRightAngles: cl.rectangle,
            pageAngles: cl.pageAngles,
            equalAnglesAMN_AIN: cl.colEqualAngles,
            printedAngleIsCorrect: cl.pageAINValue,
          },
          residuals: {
            cyclicANIM: fine(m.cyclicGap),
            rectangleRightAngles: m.rectangle.map(fine),
          },
          note: agrees
            ? `Here B and C are equal to within the core's tolerance, so the printed A/2 + B/2 = ${printed}° happens to equal the true A/2 + C/2 = ${angleAin}°. In general the printed value is off by (B - C)/2; ANIM is cyclic, so the true value is angle AMN = A/2 + C/2 = 90 - B/2.`
            : `The printed A/2 + B/2 = ${printed}° is not angle AIN here: the core gives ${angleAin}° from A/2 + C/2 = 90 - B/2, a difference of ${fine(m.pageAIN - m.ain)}° = (B - C)/2. ANIM is cyclic, making angle AMN = angle AIN, and the rectangle at B gives angle AMN = (180 - B)/2. The printed value only agrees when B = C.`,
        };
      },
    },
  };
}

/** The page saves only the three draggable corners; Track.state has version 1. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Feet On Bisectors state version ${stateVersion}`);
  }
  const C = core();
  const s = readTriangle(C, state);
  // A pure picture has no win, loss or finish: the core's result() is null.
  const result = C.result as (saved: Json) => unknown;
  const saved = {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    result: result(state),
  };
  const c = C.construction(s) as unknown as Construction;
  if (!c.ok || c.degenerate || !okPoint(c.I)) {
    return {
      ...state,
      ...saved,
      drawingPossible: false,
      note: "The saved corners are coincident, nearly so, or collinear, so the four bisectors and their feet cannot be drawn.",
    };
  }
  const m = C.measurements(s) as unknown as Measurements;
  const cl = C.claims(s) as unknown as Claims;
  return {
    ...state,
    ...saved,
    drawingPossible: true,
    reading: reading(C, s, c, m, cl),
    note:
      "Track.state saved the three corners the player can drag. The core rebuilds the four bisectors at B and C, projects A onto them to locate M, N, P and Q, and checks that the feet are collinear and that A, N, I, M are cyclic. It also reports the true angle A/2 + C/2 beside the page's incorrect A/2 + B/2.",
  };
}
