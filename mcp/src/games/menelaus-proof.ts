/*
 * run_game_logic actions and saved-position reader for Menelaus Proof.
 *
 * The real core is menelaus-proof/menelaus-proof-core.js (global
 * MenelausProofCore), copied into src/generated/cores/ at build time. The page
 * saves the whole drawing with Track.state: corners A, B, C, the three marked
 * side points F on AB, D on BC, E on CA, the proof mode and the board size.
 * The core keeps those three points collinear by projecting a dragged point
 * onto its side and re-intersecting the transversal, so the unsigned product
 * AF/BF · BD/CD · CE/AE stays 1 (the directed product is -1) in all four
 * views: Plain, Proof #1 (a parallel through A), Proof #2 (perpendiculars from
 * the vertices) and Proof #3 (a perpendicular through K). See _shared.ts for
 * the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = (): any => cores["menelaus-proof"].MenelausProofCore;

type Point = { x: number; y: number };
const MODE_NAMES = ["Plain", "Proof #1", "Proof #2", "Proof #3"] as const;
const POINTS = ["A", "B", "C", "D", "E", "F"] as const;

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number): number | null => (Number.isFinite(v) ? r6(v) : null);
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const pointOrNull = (p: any): Point | null => (p && Number.isFinite(p.x) && Number.isFinite(p.y) ? pt(p) : null);

/** Accept both the page's { x, y } and a tutor's short [x, y]. */
function readPoint(raw: unknown, label: string): Point {
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    const x = Number(raw[0]), y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} is not a finite point`);
    return { x, y };
  }
  if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`${label} must be [x, y] or { "x": ..., "y": ... }`);
}

/** The applet's four views are numbered 0..3. */
function readMode(raw: unknown, label: string, fallback = 0): number {
  if (raw === undefined || raw === null) return fallback;
  const k = num({ [label]: raw }, label);
  if (!Number.isInteger(k) || k < 0 || k > 3) {
    throw new Error(`argument "${label}" must be a proof mode from 0 to 3, got ${JSON.stringify(raw)}`);
  }
  return k;
}

/**
 * Build the exact state the page saves. Corners default to the applet's seed;
 * given corners go through start(), which puts E on AC, D on BC and F = DE ∩
 * AB as the applet's Init does. Explicit D, E or F replace those constructed
 * points, so a tutor can also measure an arbitrary transversal and see the
 * product fail. Degenerate pictures are rejected as the page rejects a drag.
 */
function stateFromArgs(C: any, args: Json): any {
  const seed = C.start({});
  const corners = POINTS.slice(0, 3).map((name) =>
    args[name] === undefined || args[name] === null ? seed[name] : readPoint(args[name], name),
  );
  const width = num(args, "width", seed.width);
  const height = num(args, "height", seed.height);
  if (!(width > 0) || !(height > 0)) throw new Error('arguments "width" and "height" must be positive');
  let s = C.start({
    width, height,
    proof: readMode(args.proof, "proof"),
    showNames: args.showNames === undefined || args.showNames === null ? false : Boolean(args.showNames),
    points: { A: corners[0], B: corners[1], C: corners[2] },
  });
  for (const name of ["D", "E", "F"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.withPoint(s, name, readPoint(args[name], name));
    }
  }
  if (!C.valid(s)) {
    throw new Error("the triangle is collapsed or the transversal points are not finite; choose three non-collinear corners");
  }
  return s;
}

/** The extra lines the selected view draws on top of the same diagram. */
function readAux(aux: any): Json {
  const out: Json = {
    proof: aux.proof,
    line: { name: aux.line.name, p: pointOrNull(aux.line.p), q: pointOrNull(aux.line.q) },
  };
  for (const key of ["helper", "P", "Ha", "Hb", "Hc", "K", "perpQ", "Ka", "Kb", "Kc"]) {
    if (aux[key] !== undefined) out[key] = pointOrNull(aux[key]);
  }
  return out;
}

/** The ratios and invariants named on the page, measured by the core. */
function productReading(C: any, s: any) {
  const m = C.measurements(s);
  const cl = C.claims(s);
  const ratios = {
    AF_BF: r6(m.ratios.AF_BF),
    BD_CD: r6(m.ratios.BD_CD),
    CE_AE: r6(m.ratios.CE_AE),
  };
  return { m, cl, ratios };
}

export function actions(): GameActions {
  return {
    product_in_all_modes: {
      describe:
        "Measure Menelaus's product AF/BF · BD/CD · CE/AE on the diagram in all four views (0 Plain, 1 parallel through A, 2 perpendiculars from the vertices, 3 perpendicular through K). Optional A, B, C are three corners ([x,y] or {x,y}); D, E, F may replace the constructed side points; width and height default to the page's 500 by 380. Reports the three ratios, the unsigned product (always 1), the directed product (always -1), the collinearity residual and each of the page's claims; changing the view only changes the auxiliary lines, never the product.",
      args: '{ "A": [216, 125], "B": [426, 190], "C": [103, 340] }',
      run: (args) => {
        const C = core();
        const s = stateFromArgs(C, args);
        const { m, cl, ratios } = productReading(C, s);
        const modes = [0, 1, 2, 3].map((k) => {
          const mk = C.withOption(s, "proof", k);
          const mkReading = productReading(C, mk);
          return {
            proof: k,
            view: MODE_NAMES[k],
            ratios: mkReading.ratios,
            product: r6(mkReading.m.product),
            directedProduct: r6(mkReading.m.directedProduct),
            collinear: mkReading.m.collinear,
          };
        });
        const checks = {
          fOnAB: cl.fOnAB, dOnBC: cl.dOnBC, eOnAC: cl.eOnAC,
          collinear: cl.collinear, productOne: cl.productOne,
          directedProductMinusOne: cl.directedProductMinusOne,
        };
        return {
          triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
          sidePoints: { F: pt(s.F), D: pt(s.D), E: pt(s.E) },
          sides: { a: r6(m.sides.a), b: r6(m.sides.b), c: r6(m.sides.c) },
          ratios,
          product: r6(m.product),
          directedProduct: r6(m.directedProduct),
          collinear: m.collinear,
          collinearOffset: maybe(m.collinearOffset),
          triangleArea: r6(Math.abs(C.cross(s.A, s.B, s.C)) / 2),
          sideParameters: {
            F_on_AB: r6(cl.params.fParam),
            D_on_BC: r6(cl.params.dParam),
            E_on_AC: r6(cl.params.eParamA),
          },
          checks,
          modes,
          invariantHoldsInEveryMode: modes.every(
            (x) => x.collinear && Math.abs(x.product - 1) <= 1e-6 && Math.abs(x.directedProduct + 1) <= 1e-6,
          ),
          proofChecks: {
            proof1: { parallel: cl.proof1Parallel, pOnBC: cl.proof1OnBC, ratios: cl.proof1Ratios },
            proof2: { perpendicular: cl.proof2Perpendicular, feetOnLine: cl.proof2OnLine, ratios: cl.proof2Ratios },
            proof3: { throughK: cl.proof3ThroughK, perpendicular: cl.proof3Perpendicular, feet: cl.proof3Feet },
          },
          note:
            `The three side points stay on one line, so AF/BF · BD/CD · CE/AE = ${r6(m.product)} ` +
            `(${r6(ratios.AF_BF)} × ${r6(ratios.BD_CD)} × ${r6(ratios.CE_AE)}) and the directed product is ${r6(m.directedProduct)}. ` +
            "The four views share this invariant: switching proof mode only draws different auxiliary lines, and the core tests them all here.",
        };
      },
    },
    proof_constructions: {
      describe:
        "Show the auxiliary lines of one proof view on the same Menelaus diagram: in Proof #1 the parallel through A meets BC at P; in Proof #2 the perpendiculars from A, B, C land on the transversal at Ha, Hb, Hc; in Proof #3 the perpendicular through K (0.6 along the drawn transversal) has nearest points Ka, Kb, Kc. Give proof 0..3 (default 1) and optional A, B, C, D, E, F, width, height as in product_in_all_modes. Returns the constructed points and the page's checks for that view together with the ratios they explain.",
      args: '{ "A": [216, 125], "B": [426, 190], "C": [103, 340], "proof": 1 }',
      run: (args) => {
        const C = core();
        const s = stateFromArgs(C, args);
        const mode = readMode(args.proof, "proof");
        const shown = C.withOption(s, "proof", mode);
        const m = C.measurements(shown);
        const cl = C.claims(shown);
        const checks = mode === 1
          ? { parallelThroughA: cl.proof1Parallel, pOnBC: cl.proof1OnBC, similarRatios: cl.proof1Ratios }
          : mode === 2
            ? { perpendiculars: cl.proof2Perpendicular, feetOnTransversal: cl.proof2OnLine, equalRatios: cl.proof2Ratios }
            : mode === 3
              ? { kOnTransversal: cl.proof3ThroughK, perpendicularAtK: cl.proof3Perpendicular, nearestPoints: cl.proof3Feet }
              : null;
        return {
          proof: mode,
          view: MODE_NAMES[mode],
          auxiliary: readAux(m.auxiliary),
          checks,
          ratios: {
            AF_BF: r6(m.ratios.AF_BF),
            BD_CD: r6(m.ratios.BD_CD),
            CE_AE: r6(m.ratios.CE_AE),
          },
          product: r6(m.product),
          note: mode === 1
            ? "The line through A parallel to DE meets BC at P. Similar triangles give AF/BF = PD/BD and AE/CE = PD/CD, so CE/AE = CD/PD; hence (PD/BD) · (BD/CD) · (CD/PD) = 1."
            : mode === 2
              ? "The perpendiculars from A, B and C to the transversal are parallel, so their lengths are in the same ratios as AF/BF, BD/CD and CE/AE; multiplying the three height ratios gives 1, hence the side product is 1."
              : mode === 3
                ? "The line through K perpendicular to the transversal gives parallel projections of the vertices; the ratios of those projected segments match the side ratios, so their product is again 1."
                : "The Plain view draws no auxiliary lines: the three side points are simply constrained to one straight line, which is the whole content of Menelaus's theorem here.",
        };
      },
    },
  };
}

/** The page's saved fields, read again through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const savedPoint = (key: string): Point | null => {
    const v = state[key];
    if (v === null || typeof v !== "object") return null;
    try { return pt(readPoint(v, key)); } catch { return null; }
  };
  const saved = {
    stateVersion,
    A: savedPoint("A"), B: savedPoint("B"), C: savedPoint("C"),
    D: savedPoint("D"), E: savedPoint("E"), F: savedPoint("F"),
    proof: state.proof === undefined || state.proof === null ? null : Number(state.proof),
    showNames: state.showNames === undefined || state.showNames === null ? null : Boolean(state.showNames),
    width: state.width === undefined ? null : Number(state.width),
    height: state.height === undefined ? null : Number(state.height),
  };
  try {
    const s = stateFromArgs(C, state);
    const m = C.measurements(s);
    const cl = C.claims(s);
    const constructed = C.start({
      width: s.width, height: s.height,
      points: { A: s.A, B: s.B, C: s.C },
    });
    // After a drag the side points need not be at the Init fractions any more,
    // so a gap from a fresh Init is expected; the real test is that each point
    // is still on its side and all three still lie on one line.
    const distanceFromFreshInit = Object.fromEntries(
      ["D", "E", "F"].map((name) => [name, maybe(C.distance(s[name], constructed[name]))]),
    );
    const savedIsConsistent = [
      cl.fOnAB, cl.dOnBC, cl.eOnAC, cl.collinear, cl.productOne, cl.directedProductMinusOne,
    ].every(Boolean);
    return {
      ...saved,
      result: C.result(s),
      reading: {
        triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
        sidePoints: { F: pt(s.F), D: pt(s.D), E: pt(s.E) },
        proof: { mode: s.proof, view: MODE_NAMES[s.proof] },
        sides: { a: r6(m.sides.a), b: r6(m.sides.b), c: r6(m.sides.c) },
        ratios: {
          AF_BF: r6(m.ratios.AF_BF),
          BD_CD: r6(m.ratios.BD_CD),
          CE_AE: r6(m.ratios.CE_AE),
        },
        product: r6(m.product),
        directedProduct: r6(m.directedProduct),
        collinear: m.collinear,
        collinearOffset: maybe(m.collinearOffset),
        degenerate: m.degenerate,
        orientation: m.orientation,
        drawnLine: { name: m.line.name, p: pointOrNull(m.line.p), q: pointOrNull(m.line.q) },
        auxiliary: readAux(m.auxiliary),
        sideParameters: {
          F_on_AB: r6(cl.params.fParam),
          D_on_BC: r6(cl.params.dParam),
          E_on_AC: r6(cl.params.eParamA),
        },
        claims: cl,
      },
      savedIsConsistent,
      distanceFromFreshInit,
      note:
        `Track.state saves the six points, the view (${MODE_NAMES[s.proof]}) and the board size, not the ratios. ` +
        `The core measures the same drawing: AF/BF · BD/CD · CE/AE = ${r6(m.product)} with directed product ${r6(m.directedProduct)}, ` +
        `and the cross product of D, E, F is ${maybe(m.collinearOffset)} (zero to drawing tolerance), so the three points are ${m.collinear ? "collinear" : "not collinear"}. ` +
        "distanceFromFreshInit only locates the points relative to a newly constructed diagram; dragging moves E and F along their sides, so a non-zero gap is normal. " +
        "This is an illustration: there is no win or loss.",
    };
  } catch (e) {
    return {
      ...saved,
      reading: null,
      note: `The saved position cannot be measured: ${(e as Error).message}`,
    };
  }
}
