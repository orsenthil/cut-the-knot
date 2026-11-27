/*
 * run_game_logic actions and saved-position reader for Carpets in a
 * Quadrilateral II. All geometry comes from the real core,
 * carpets-in-quadri-2/carpets-in-quadri-2-core.js, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 *
 * E, F, G, H are the midpoints of AB, BC, CD, DA. The lines AF, BG, CH, DE
 * meet at P = AF∩DE, Q = AF∩BG, R = BG∩CH, S = CH∩DE. The two carpets are
 * AFCH (with its complement ABF + CDH) and BGDE (with its complement
 * ADE + BCG); each half of each partition has half the area of ABCD. By the
 * Carpets Theorem the overlaps have equal area: the four corner triangles
 * AEP, BFQ, CGR, DHS total the same as the middle quadrilateral PQRS. This
 * is true for convex quadrilaterals; a dented one can fail.
 *
 * The original page adds that the middle piece is one fifth of the whole
 * because any convex quadrilateral is an affine image of a square. That
 * reasoning is wrong: an affine image of a square is a parallelogram. The
 * fifth holds exactly for parallelograms, not for every convex quadrilateral.
 */

import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["carpets-in-quadri-2"].CarpetsInQuadri2Core;
type Core = ReturnType<typeof core>;
type Geometry = NonNullable<ReturnType<Core["compute"]>>;
type Point = { x: number; y: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;

/** A finite number from a nested point object, with a helpful error message. */
function numField(o: Json, field: string, outer: string): number {
  const v = o[field];
  const n = Number(v);
  if (v === undefined || v === null || !Number.isFinite(n)) {
    throw new Error(`argument "${outer}.${field}" must be a number, got ${JSON.stringify(v)}`);
  }
  return n;
}

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

function computeQuad(C: Core, args: Json): Geometry {
  const fresh = C.start();
  const A = readPoint(args, "A", fresh.A);
  const B = readPoint(args, "B", fresh.B);
  const Cc = readPoint(args, "C", fresh.C);
  const D = readPoint(args, "D", fresh.D);
  const g = C.compute(A, B, Cc, D);
  if (!g) {
    throw new Error(
      "those four points do not make a drawable quadrilateral: two corners coincide, or two of the lines AF, BG, CH, DE are parallel. Move a corner and try again.",
    );
  }
  return g;
}

/** Tutor-friendly reading of the drawing, in the page's 450 x 400 board units. */
function reading(g: Geometry) {
  const a = g.areas;
  return {
    vertices: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    sideMidpoints: { E_AB: pt(g.E), F_BC: pt(g.F), G_CD: pt(g.G), H_DA: pt(g.H) },
    crossings: {
      P_AF_DE: pt(g.P), Q_AF_BG: pt(g.Q), R_BG_CH: pt(g.R), S_CH_DE: pt(g.S),
    },
    areas: {
      whole_ABCD: round(a.abcd),
      carpet1_AFCH: round(a.s1),
      complement1_ABF_plus_CDH: round(a.s2),
      carpet2_BGDE: round(a.t1),
      complement2_ADE_plus_BCG: round(a.t2),
      cornerTriangles_AEP_BFQ_CGR_DHS: round(a.corner),
      middle_PQRS: round(a.inner),
      middleFraction: round(a.inner / a.abcd),
    },
    claims: { ...g.claims },
    tolerance: g.tol,
    note:
      "Each carpet and its complement has half the area of ABCD, so the Carpets Theorem makes the two overlaps equal: " +
      "[AEP] + [BFQ] + [CGR] + [DHS] = [PQRS]. The middle is one fifth of the whole only for parallelograms; " +
      "the page's claim that every convex quadrilateral is an affine image of a square is false.",
  };
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For quadrilateral corners A, B, C, D as [x, y] points in the page's 450 x 400 board (y down), report the side midpoints E (AB), F (BC), G (CD), H (DA), the four crossings P = AF∩DE, Q = AF∩BG, R = BG∩CH, S = CH∩DE, and all seven areas: the whole quadrilateral, the two carpets and their complements, the four corner triangles and the middle quadrilateral PQRS. Also reports whether the shape is convex or a parallelogram and the middle's fraction of the whole. Corners may be omitted, in which case the applet's reset corners are used.",
      args: '{ "A": [95, 120], "B": [360, 320], "C": [360, 80], "D": [180, 80] }',
      run: (args) => reading(computeQuad(core(), args)),
    },
    check_claims: {
      describe:
        "Test the illustration's claims for corners A, B, C, D in the page's 450 x 400 board: the corner triangles and the middle PQRS have equal area; each of the two carpets and its complement has half the area of ABCD. Also reports convexity and the one-fifth claim about PQRS, with the measured middle fraction. The fifth is guaranteed only for parallelograms — the page's assertion that any convex quadrilateral is an affine image of a square is wrong — so it is reported but is not counted as a failed carpet claim. Comparisons use a tolerance of 1e-9 times the whole area.",
      args: '{ "A": [0, 0], "B": [100, 0], "C": [80, 20], "D": [0, 60] }',
      run: (args) => {
        const g = computeQuad(core(), args);
        const cl = g.claims;
        const a = g.areas;
        const failed = ["carpet", "halves"].filter((k) => cl[k as "carpet" | "halves"] !== true);
        return {
          claims: { ...cl },
          areas: {
            cornerTriangles: round(a.corner),
            middle_PQRS: round(a.inner),
            whole_ABCD: round(a.abcd),
            middleFraction: round(a.inner / a.abcd),
          },
          halves: {
            carpet1_AFCH: round(a.s1), complement1: round(a.s2),
            carpet2_BGDE: round(a.t1), complement2: round(a.t2),
            target: round(a.abcd / 2),
            holds: cl.halves,
          },
          tolerance: g.tol,
          failed,
          allHold: failed.length === 0,
          fifthRemark: {
            holds: cl.fifth,
            parallelogram: cl.parallelogram,
            note:
              "An affine image of a square is a parallelogram, not an arbitrary convex quadrilateral. " +
              "The one-fifth middle is exact for parallelograms; a skewed convex shape need not give 0.2.",
          },
          note: cl.carpet
            ? "The four corner pieces and the middle piece have equal area; this is an area identity, not an assumption."
            : "The carpet equality failed: a quadrilateral with a dent can break it, and nearly parallel lines can make the drawing degenerate.",
        };
      },
    },
  };
}

/** The page's saved drawing, options and claims, plus a fresh core reading. */
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
  const here = { ...fresh, A, B, C: Cc, D };

  return {
    stateVersion,
    A: pt(A), B: pt(B), C: pt(Cc), D: pt(D),
    midpoints: {
      E: savedPoint("E"), F: savedPoint("F"), G: savedPoint("G"), H: savedPoint("H"),
    },
    crossings: {
      P: savedPoint("P"), Q: savedPoint("Q"), R: savedPoint("R"), S: savedPoint("S"),
    },
    options: state.options === undefined || state.options === null ? fresh.options : state.options,
    savedClaims: state.claims === undefined || state.claims === null ? null : state.claims,
    savedAreas: state.areas === undefined || state.areas === null ? null : state.areas,
    reading: g
      ? reading(g)
      : { note: "Those saved corners do not make a drawable quadrilateral; move a corner to see the carpets." },
    note: C.describe(here),
  };
}
