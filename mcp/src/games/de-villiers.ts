/*
 * run_game_logic actions and saved-position reader for de Villiers (the
 * "Similar Triangles on Sides of a Quadrilateral" illustration).
 *
 * All geometry comes from the real core,
 * de-villiers/de-villiers-core.js, copied into src/generated/cores/ at build
 * time. See _shared.ts for the module shape.
 *
 * The construction: on each side X -> Y of a quadrilateral the applet erects
 * a triangle with apex X + coef * Rotate(X, Y, alpha), using one common turn
 * alpha and one common scale coef. Writing k = coef * exp(i*alpha), the four
 * apexes are P = (1-k)A + kB, Q = (1-k)C + kB, R = (1-k)C + kD,
 * S = (1-k)A + kD, so P + R = Q + S: PQRS is a parallelogram for every
 * quadrilateral and every k. The page's printed product (1)/(3) uses RD/DC
 * where its own line (2) uses RD/RC; the RD/RC reading is always 1, while the
 * printed RD/DC reading equals the scale coef (so it is 1 only when coef = 1).
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["de-villiers"].DeVilliersCore;
type Core = ReturnType<typeof core>;
type Geometry = NonNullable<ReturnType<Core["geometry"]>>;
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

/**
 * Build a full core state from four corners plus the common turn and scale,
 * reproducing the applet's AdjustApexes(): apex = X + coef * Rotate(X, Y, alpha).
 */
function buildState(C: Core, args: Json) {
  const fresh = C.start();
  const corners = {
    A: readPoint(args, "A", fresh.A),
    B: readPoint(args, "B", fresh.B),
    Cc: readPoint(args, "C", fresh.C),
    D: readPoint(args, "D", fresh.D),
  };
  const alpha = num(args, "alpha", C.ALPHA0);
  const coef = num(args, "coef", C.COEF0);
  const s: Json = {
    A: corners.A, B: corners.B, C: corners.Cc, D: corners.D,
    alpha, coef,
    options: { names: false, para: false, angles: false },
    explored: true,
  };
  for (const key of C.APEX as string[]) {
    const side = (C.SIDES as Record<string, string[]>)[key];
    s[key] = C.spiral(s[side[0]], s[side[1]], alpha, coef);
  }
  return s;
}

function computeGeometry(C: Core, args: Json): Geometry {
  const g = C.geometry(buildState(C, args));
  if (!g) {
    throw new Error(
      "those points do not make a drawable configuration: two corners may coincide. Move a corner and try again.",
    );
  }
  return g;
}

/** Tutor-friendly reading of one drawing, in the page's 460 x 300 board units. */
function reading(g: Geometry) {
  const m = g.measures;
  const cl = g.claims;
  const shared = g.sharedAngles as Record<string, number[]>;
  return {
    vertices: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    apexes: { P: pt(g.P), Q: pt(g.Q), R: pt(g.R), S: pt(g.S) },
    turnAngleRadians: round(g.alpha),
    commonScale: round(g.coef),
    similarTriangles: (g.triangles as { name: string; X: Point; Y: Point; apex: Point }[]).map((t) => ({
      name: t.name,
      side: [pt(t.X), pt(t.Y)],
      apex: pt(t.apex),
    })),
    apexAngles: (g.apexAngles as number[]).map(round),
    sharedAngles: {
      A: shared.A.map(round), B: shared.B.map(round),
      C: shared.C.map(round), D: shared.D.map(round),
    },
    sideRatios: (g.ratios as number[]).map(round),
    parallelogram: {
      holds: cl.parallelogram,
      oppositeSideError: round(m.sideError),
      diagonalMidpointError: round(m.diagonalError),
    },
    productOfRatios: {
      // The page's line (2): PB/PA * QC/QB * RD/RC * SA/SD = 1.
      viaRDoverRC: round(g.correctedProduct),
      viaRDoverRC_isOne: cl.correctedProductIsOne,
      // Lines (1)/(3) as printed use RD/DC instead, giving the scale coef.
      asPrintedViaRDoverDC: round(g.printedProduct),
      asPrinted_isOne: cl.printedProductIsOne,
    },
    tolerance: g.tol,
    note:
      "With k = coef * exp(i*alpha) the apexes are P = (1-k)A + kB, Q = (1-k)C + kB, " +
      "R = (1-k)C + kD and S = (1-k)A + kD, so P + R = Q + S and PQRS is a parallelogram " +
      "for every quadrilateral. The four triangles share the turn angle, the shared angles " +
      "at each corner and the side ratio. " +
      (cl.correctedProductIsOne && !cl.printedProductIsOne
        ? "The product is 1 with RD/RC (line 2); as printed with RD/DC in lines 1 and 3 it equals the scale coef, not 1."
        : "With this scale both product readings are 1; the RD/DC versus RD/RC typo only shows when coef differs from 1."),
  };
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For quadrilateral corners A, B, C, D as [x, y] points in the page's 460 x 300 board (y down), with optional `alpha` (the common turn angle in radians, default pi/3) and `coef` (the common scale, default 1), report the four apexes P, Q, R, S and the four similar triangles ABP, CBQ, CDR, ADS erected on the sides. Also reports the equal apex and shared angles, the common side ratio, that PQRS is a parallelogram (matching opposite sides and bisecting diagonals), and the two readings of the ratio product: using RD/RC (the page's line 2) it is 1, while using RD/DC as printed in lines 1 and 3 it equals the scale coef.",
      args: '{ "A": [321.6, 200], "B": [180, 236.6], "C": [131.5, 167.4], "D": [280, 63.4] }',
      run: (args) => reading(computeGeometry(core(), args)),
    },
    check_claims: {
      describe:
        "Test every claim on the illustration's page for corners A, B, C, D with optional `alpha` and `coef`: the four triangles are similar (equal apex angles, equal shared angles at each corner, equal side ratios), PQRS is a parallelogram, and the two product identities. Returns a boolean per claim, the failed names and whether all hold. The corrected product with RD/RC is always 1; the printed product with RD/DC is 1 only when coef = 1, which is the page's small typo.",
      args: '{ "A": [321.6, 200], "B": [180, 236.6], "C": [131.5, 167.4], "D": [280, 63.4], "coef": 1 }',
      run: (args) => {
        const g = computeGeometry(core(), args);
        const cl = g.claims;
        const names = [
          "parallelogram", "apexAnglesEqual", "sharedAnglesEqual", "ratiosEqual",
          "correctedProductIsOne", "printedProductIsOne",
        ];
        const failed = names.filter((k) => cl[k as keyof typeof cl] !== true);
        return {
          claims: { ...cl },
          failed,
          allHold: failed.length === 0,
          productNote: {
            viaRDoverRC: round(g.correctedProduct),
            viaRDoverRC_isOne: cl.correctedProductIsOne,
            viaRDoverDC_asPrinted: round(g.printedProduct),
            viaRDoverDC_isOne: cl.printedProductIsOne,
            commonScale: round(g.coef),
            note: cl.correctedProductIsOne && !cl.printedProductIsOne
              ? "The page's printed product uses RD/DC where line (2) uses RD/RC. With this scale the printed version equals coef, not 1; RD/RC is the correct reading."
              : "Both products are 1 here; the RD/DC typo in lines 1 and 3 only matters when the common scale coef is not 1.",
          },
        };
      },
    },
  };
}

/** The page's saved drawing and options, plus a fresh core reading of its corners. */
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
  // Feed the saved corners, angle and scale back through the real core.
  const built = buildState(C, state);
  const g = C.geometry(built);
  return {
    stateVersion,
    vertices: { A: pt(A), B: pt(B), C: pt(Cc), D: pt(D) },
    apexes: {
      P: savedPoint("P"), Q: savedPoint("Q"), R: savedPoint("R"), S: savedPoint("S"),
    },
    turnAngleRadians: num(state, "alpha", C.ALPHA0),
    commonScale: num(state, "coef", C.COEF0),
    options: state.options === undefined || state.options === null ? fresh.options : state.options,
    savedClaims: state.claims === undefined || state.claims === null ? null : state.claims,
    reading: g
      ? reading(g)
      : { note: "Those saved points do not make a drawable configuration; move a corner to see the drawing." },
    note: C.describe(built),
  };
}
