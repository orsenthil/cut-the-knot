/*
 * run_game_logic actions and saved-position reader for Carpets In Quadri.
 * All geometry comes from the real core,
 * carpets-in-quadri/carpets-in-quadri-core.js, copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 *
 * The construction: ABCD is a convex quadrilateral. P lies on AB and Q on CD
 * with AP/AB = CQ/CD = r, so P = rB + (1-r)A and Q = rD + (1-r)C (the applet
 * keeps t = BP/AB = 1 - r). R = AQ ∩ DP and S = BQ ∩ CP. Since Q divides CD
 * in the same ratio as P divides AB, its height over the base AB is the same
 * mixture of the heights of D and C: h(Q) = r·h(D) + (1-r)·h(C). Triangles on
 * the same base then give area(AQB) = area(ADP) + area(BCP). Cutting the two
 * corner triangles APR and BPS off both sides leaves
 *     area(PSQR) = area(ARD) + area(BSC),
 * the carpet equality the illustration shows. The theorem assumes ABCD is
 * convex, and the applet hides the carpets (core's noDraw) when the crossing
 * lines are nearly parallel; both conditions are reported below.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["carpets-in-quadri"].CarpetsInQuadriCore;
type Core = ReturnType<typeof core>;
type Geometry = NonNullable<ReturnType<Core["compute"]>>;
type Point = { x: number; y: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;

/** A finite number from a nested point, with a helpful error message. */
function numField(o: Json, field: string, outer: string): number {
  const v = o[field];
  const n = Number(v);
  if (v === undefined || v === null || !Number.isFinite(n)) {
    throw new Error(`argument "${outer}.${field}" must be a number, got ${JSON.stringify(v)}`);
  }
  return n;
}

/** Accept [x, y] or { "x": ..., "y": ... }, falling back to a reset corner. */
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

/** The page's common ratio AP/AB = CQ/CD, in [0, 1]. */
function readRatio(C: Core, args: Json): number {
  const r = num(args, "r", 1 - C.START_RATIO);
  if (r < C.MIN_RATIO || r > C.MAX_RATIO) {
    throw new Error(`argument "r" must be between ${C.MIN_RATIO} and ${C.MAX_RATIO}, got ${r}`);
  }
  return r;
}

/** Build the core's state from validated arguments and compute the drawing. */
function computeFrom(C: Core, args: Json): Geometry {
  const fresh = C.start();
  const state = {
    A: readPoint(args, "A", fresh.A),
    B: readPoint(args, "B", fresh.B),
    C: readPoint(args, "C", fresh.C),
    D: readPoint(args, "D", fresh.D),
    t: 1 - readRatio(C, args),
  };
  const g = C.compute(state);
  if (!g) {
    throw new Error("those four points are not finite: give four corners as finite [x, y] points.");
  }
  return g;
}

/** Tutor-friendly reading of one drawing, in the page's 400 x 300 board units. */
function reading(C: Core, g: Geometry) {
  const m = g.measures;
  // The core's measures give the totals; the separate pieces use its area().
  const redARD = C.area([g.A, g.R || g.A, g.D]);
  const redBSC = C.area([g.B, g.S || g.B, g.C]);
  const triAQB = C.area([g.A, g.Q, g.B]);
  const triADP = C.area([g.A, g.D, g.P]);
  const triBCP = C.area([g.B, g.C, g.P]);
  return {
    ratio: {
      r: round(g.r), t: round(g.t),
      meaning: "AP/AB = CQ/CD = r; BP/AB = t = 1 - r",
    },
    points: {
      A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D),
      P: pt(g.P), Q: pt(g.Q), R: pt(g.R), S: pt(g.S),
    },
    convex: g.convex,
    noDraw: g.noDraw,
    areas: {
      bluePSQR: round(m.blue),
      redARD: round(redARD), redBSC: round(redBSC), redTogether: round(m.red),
      difference: round(m.difference), tolerance: g.tol,
    },
    carpetIdentity: {
      holds: g.claims.blueEqualsRed,
      statement: `area(PSQR) = area(ARD) + area(BSC): ${round(m.blue)} = ${round(redARD)} + ${round(redBSC)} = ${round(m.red)}`,
    },
    heightProof: {
      heightQ: round(m.heightQ), heightC: round(C.height(g.C, g.A, g.B)),
      heightD: round(C.height(g.D, g.A, g.B)), expected: round(m.heightTotal),
      holds: g.claims.heightsMatch,
      statement: `signed h(Q) = r·h(D) + (1-r)·h(C): ${round(m.heightQ)} = ${round(m.heightTotal)}`,
    },
    cutAndPaste: {
      areaAQB: round(triAQB), areaADP: round(triADP), areaBCP: round(triBCP),
      holds: g.claims.carpetEqualsHalves,
      statement: `area(AQB) = area(ADP) + area(BCP): ${round(triAQB)} = ${round(triADP)} + ${round(triBCP)}`,
    },
    note: g.noDraw
      ? "The crossing lines are nearly parallel, so the applet hides the carpets (noDraw); move a corner to bring R and S back."
      : g.convex
        ? "ABCD is convex, the hypothesis of the theorem: take area(AQB) = area(ADP) + area(BCP) and cut off the same triangles APR and BPS on both sides to leave the blue carpet equal to the two red triangles."
        : "ABCD is not convex, so the theorem's hypothesis fails. The equality of the blue and red areas can fail here; drag the corners into a convex quadrilateral to see the match.",
  };
}

export function actions(): GameActions {
  return {
    carpet_areas: {
      describe:
        "For a quadrilateral with corners A, B, C, D (each [x, y] or {x, y} in the page's 400 x 300 board, y down) and a common ratio r = AP/AB = CQ/CD (default 0.3), report P on AB, Q on CD, the crossings R = AQ ∩ DP and S = BQ ∩ CP, the area of the blue quadrilateral PSQR, the areas of the red triangles ARD and BSC, and whether area(PSQR) = area(ARD) + area(BSC). Corners may be omitted to use the applet's reset shape. Convex ABCD is the theorem's hypothesis; a crossed or dented shape is reported as convex: false and the equality can fail.",
      args: '{ "A": [80, 180], "B": [320, 240], "C": [320, 60], "D": [160, 60], "r": 0.3 }',
      run: (args) => reading(core(), computeFrom(core(), args)),
    },
    check_claims: {
      describe:
        "Test the three claims behind the illustration for corners A, B, C, D and ratio r: the blue carpet equals the two red triangles (area(PSQR) = area(ARD) + area(BSC)); the orange triangle AQB equals ADP plus BCP, from cutting the same corner triangles off both sides; and the signed height of Q equals r·h(D) + (1-r)·h(C). Returns a boolean per claim, the measured differences and tolerance, and which claims failed. Convex ABCD is assumed by the theorem and flagged in the result.",
      args: '{ "A": [80, 180], "B": [320, 240], "C": [320, 60], "D": [160, 60], "r": 0.45 }',
      run: (args) => {
        const g = computeFrom(core(), args);
        const cl = g.claims;
        const m = g.measures;
        const failed = ["blueEqualsRed", "carpetEqualsHalves", "heightsMatch"]
          .filter((k) => cl[k as keyof typeof cl] !== true);
        const scale = Math.max(1, Math.hypot(g.A.x - g.B.x, g.A.y - g.B.y),
          Math.hypot(g.B.x - g.C.x, g.B.y - g.C.y),
          Math.hypot(g.C.x - g.D.x, g.C.y - g.D.y),
          Math.hypot(g.D.x - g.A.x, g.D.y - g.A.y));
        return {
          claims: { ...cl },
          differences: {
            blueMinusRed: round(m.blue - m.red), areaTolerance: g.tol,
            carpetMinusHalves: round(m.carpet - m.halves),
            heightMinusMixture: round(m.heightQ - m.heightTotal),
            heightTolerance: 1e-9 * scale,
          },
          convex: g.convex,
          noDraw: g.noDraw,
          failed,
          allHold: failed.length === 0,
          note: failed.length === 0
            ? "All three claims hold: Q's height is the same mixture of C's and D's heights, so the triangles on base AB balance; cutting off APR and BPS leaves the blue carpet equal to ARD plus BSC."
            : "Some claim failed. Check that ABCD is convex and that the crossing lines meet (noDraw false); a dented or crossed quadrilateral is outside the theorem.",
        };
      },
    },
  };
}

/** The page's saved drawing and options, plus a fresh core reading of it. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Carpets In Quadri state version ${stateVersion}`);
  }
  const C = core();
  const fresh = C.start();
  const A = readPoint(state, "A", fresh.A);
  const B = readPoint(state, "B", fresh.B);
  const Cc = readPoint(state, "C", fresh.C);
  const D = readPoint(state, "D", fresh.D);
  const r = num(state, "r", 1 - num(state, "t", C.START_RATIO));
  const t = num(state, "t", 1 - r);
  const savedPoint = (key: string) => {
    const v = state[key];
    return v && typeof v === "object" && !Array.isArray(v)
      ? pt({ x: numField(v as Json, "x", key), y: numField(v as Json, "y", key) })
      : null;
  };
  const g = C.compute({ A, B, C: Cc, D, t });
  const here = { A, B, C: Cc, D, t, options: { names: state.names === true, hint: state.hint === true } };
  return {
    stateVersion,
    A: pt(A), B: pt(B), C: pt(Cc), D: pt(D),
    P: savedPoint("P"), Q: savedPoint("Q"), R: savedPoint("R"), S: savedPoint("S"),
    r: round(r), t: round(t),
    names: state.names === true,
    hint: state.hint === true,
    savedClaims: state.claims === undefined || state.claims === null ? null : state.claims,
    savedMeasures: state.measures === undefined || state.measures === null ? null : state.measures,
    reading: g
      ? reading(C, g)
      : { note: "Those saved corners do not make a drawing; drag a corner to bring the picture back." },
    note: C.describe(here),
  };
}
