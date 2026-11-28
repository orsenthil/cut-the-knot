/*
 * run_game_logic actions and saved-position reader for Incircle and Midpoints.
 *
 * The real core is incircle-and-midpoints/incircle-and-midpoints-core.js,
 * copied into src/generated/cores/ at build time. It transcribes the applet's
 * Compute(): the incenter I, the three incircle touch points M (on AB),
 * N (on BC) and K (on AC), the lines through A parallel to KN and MN meeting
 * them at D and E, the line DE cutting AB at F and AC at G, and U, V where
 * the parallel to BC through A meets MN and KN.
 *
 * The page's claim is that F and G are the midpoints of AB and AC. Its proof
 * runs in three steps, all measured here: equal tangents give AM = AK,
 * BM = BN and CN = CK; the isosceles/similar triangles give AM = AU and
 * AK = AV, hence AU = AV and A is the midpoint of UV; then in triangle NUV
 * the parallels make D and E the midpoints of NU and NV, so DE is parallel
 * to BC and bisects every transversal, including AB and AC.
 *
 * Every number below comes from the real core. Coordinates are board units
 * in the page's 360 x 260 SVG view, y down. This is a demonstration, so there
 * is no win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Line = [Point, Point];
type Options = { names: boolean; hint1: boolean; hint2: boolean };
type State = { A: Point; B: Point; C: Point; options: Options; touches: number };
type Geometry = {
  valid: boolean;
  A: Point; B: Point; C: Point; I: Point; center: Point;
  radius: number;
  K: Point; M: Point; N: Point;
  D: Point; E: Point; F: Point; G: Point; U: Point; V: Point;
  lines: {
    MN: Line; KN: Line; AKN: Line; AMN: Line;
    DE: Line; UV: Line; throughA: Line;
  };
  spans: { MDN: Line; KEN: Line };
  labels: Record<string, Point>;
};
type Claims = {
  FmidAB: number; GmidAC: number; AmidUV: number; DmidNU: number; EmidNV: number;
  AUeqAV: number; AMeqAU: number; AKeqAV: number; AMeqAK: number;
  BNeqBM: number; CNeqCK: number; DEparBC: number; UVparBC: number;
  radii: number; radius: number;
};
interface Core {
  VIEW: { width: number; height: number };
  START: { A: Point; B: Point; C: Point };
  start(options?: Json): State;
  moveVertex(state: State, name: string, p: Point): State;
  setOption(state: State, name: string, on: boolean): State;
  geometry(state: State): Geometry;
  claimErrors(g: Geometry): Claims | null;
  result(): null;
  dist(p: Point, q: Point): number;
  mid(p: Point, q: Point): Point;
}

const core = (): Core =>
  cores["incircle-and-midpoints"].IncircleAndMidpointsCore as unknown as Core;

/* The port's logic test accepts every claim below 1e-5 drawing units. */
const TOL = 1e-5;
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const sig = (v: number): number => (Number.isFinite(v) ? Number(v.toExponential(3)) : NaN);
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const line = (l: Line): Line => [pt(l[0]), pt(l[1])];
const holds = (v: number): boolean => Number.isFinite(v) && v <= TOL;

/** Tool arguments may use [x, y]; a saved position from the page uses { x, y }. */
function readPoint(value: unknown, name: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${name}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x = NaN, y = NaN;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${name}" must be [x, y]`);
    [x, y] = [Number(value[0]), Number(value[1])];
  } else if (typeof value === "object") {
    const o = value as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${name}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${name}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** The applet's three checkboxes; "show": 1 turns on names and hint 2. */
function readOptions(value: unknown): Options {
  const options: Options = { names: false, hint1: false, hint2: false };
  if (value === undefined || value === null) return options;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error('argument "options" must be an object of booleans');
  }
  const o = value as Json;
  if (o.show !== undefined && o.show !== null) {
    if (o.show !== 0 && o.show !== 1 && o.show !== "0" && o.show !== "1") {
      throw new Error('argument "options.show" must be 0 or 1');
    }
    options.names = o.show === 1 || o.show === "1";
    options.hint2 = options.names;
  }
  for (const key of Object.keys(options) as Array<keyof Options>) {
    const v = o[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "boolean") throw new Error(`argument "options.${key}" must be true or false`);
    options[key] = v;
  }
  return options;
}

/**
 * A real core state: the applet's opening position with the requested
 * switches, and any supplied corner applied as a page drag (which clamps it
 * to the board). Omitted corners keep the opening triangle.
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of corners and options");
  }
  let s = C.start(readOptions(args.options));
  for (const name of ["A", "B", "C"] as const) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) s = C.moveVertex(s, name, readPoint(raw, name));
  }
  return s;
}

function geometryFor(C: Core, s: State): { g: Geometry; cl: Claims } {
  const g = C.geometry(s);
  const cl = C.claimErrors(g);
  if (!g.valid || !cl) {
    throw new Error(
      "A, B and C must be three distinct, non-collinear corners ([x, y] or { x, y }): " +
      "the applet draws nothing for a flat triangle",
    );
  }
  return { g, cl };
}

type Row = { claim: string; error: number; holds: boolean };
const row = (claim: string, error: number): Row => ({ claim, error: sig(error), holds: holds(error) });

/** A measured step of the page's proof, with the two lengths it compares. */
function step(C: Core, claim: string, p: Point, pair: readonly [Point, Point], error: number) {
  return {
    claim,
    lengths: [round(C.dist(p, pair[0])), round(C.dist(p, pair[1]))],
    error: sig(error),
    holds: holds(error),
  };
}

/** Everything the core measures about this one construction. */
function reading(C: Core, s: State, g: Geometry, cl: Claims) {
  const rows: Row[] = [
    row("AM = AK", cl.AMeqAK), row("BM = BN", cl.BNeqBM), row("CK = CN", cl.CNeqCK),
    row("AM = AU", cl.AMeqAU), row("AK = AV", cl.AKeqAV), row("AU = AV", cl.AUeqAV),
    row("A is the midpoint of UV", cl.AmidUV),
    row("D is the midpoint of NU", cl.DmidNU), row("E is the midpoint of NV", cl.EmidNV),
    row("DE parallel to BC", cl.DEparBC), row("UV parallel to BC", cl.UVparBC),
    row("F is the midpoint of AB (AF = FB)", cl.FmidAB),
    row("G is the midpoint of AC (AG = GC)", cl.GmidAC),
    row("IK, IM, IN have one length", cl.radii),
    row("incircle radius is the average distance", cl.radius),
  ];
  const midpointErrors = [cl.FmidAB, cl.GmidAC];
  return {
    board: C.VIEW,
    options: s.options,
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    incenter: pt(g.I),
    incircleRadius: round(g.radius),
    centroid: pt(g.center),
    construction: {
      touchPoints: { M: pt(g.M), N: pt(g.N), K: pt(g.K) },
      parallels: {
        "through A parallel to KN": line(g.lines.AKN),   // A--D
        "through A parallel to MN": line(g.lines.AMN),   // A--E
        "through A parallel to BC": line(g.lines.throughA), // A--U--V
      },
      D: pt(g.D), E: pt(g.E), U: pt(g.U), V: pt(g.V),
      DE: line(g.lines.DE),
      midpoints: { F: pt(g.F), G: pt(g.G) },
      midpointOfAB: pt(C.mid(g.A, g.B)),
      midpointOfAC: pt(C.mid(g.A, g.C)),
    },
    proof: {
      equalTangents: [
        step(C, "AM = AK", g.A, [g.M, g.K], cl.AMeqAK),
        step(C, "BM = BN", g.B, [g.M, g.N], cl.BNeqBM),
        step(C, "CK = CN", g.C, [g.K, g.N], cl.CNeqCK),
      ],
      isoscelesSimilar: [
        step(C, "AM = AU", g.A, [g.M, g.U], cl.AMeqAU),
        step(C, "AK = AV", g.A, [g.K, g.V], cl.AKeqAV),
        step(C, "AU = AV", g.A, [g.U, g.V], cl.AUeqAV),
      ],
      midpointSteps: [
        step(C, "A midpoint of UV", g.A, [g.U, g.V], cl.AmidUV),
        step(C, "D midpoint of NU", g.D, [g.N, g.U], cl.DmidNU),
        step(C, "E midpoint of NV", g.E, [g.N, g.V], cl.EmidNV),
      ],
      parallels: [
        row("DE parallel to BC", cl.DEparBC),
        row("UV parallel to BC", cl.UVparBC),
      ],
      conclusion: [
        step(C, "AF = FB", g.F, [g.A, g.B], cl.FmidAB),
        step(C, "AG = GC", g.G, [g.A, g.C], cl.GmidAC),
      ],
    },
    claims: rows,
    tolerance: TOL,
    largestMidpointError: sig(Math.max(...midpointErrors)),
    allClaimsHold: rows.every((r) => r.holds),
  };
}

/* The exact triangle saved by the live page in porting/live-fixtures/. */
const EXAMPLE_ARGS =
  '{"A":[245,173.33333333333334],"B":[180,43.333333333333336],"C":[90,104]}';

export function actions(): GameActions {
  return {
    midpoint_construction: {
      describe:
        "For a triangle ABC (corners as [x, y] or { x, y } in the page's 360 x 260 board units, y down; omit a corner for the opening picture), use the real core to construct the incircle touch points M on AB, N on BC and K on AC, the lines through A parallel to KN and MN giving D and E, and the line DE cutting AB at F and AC at G. Reports all of those points, U and V on the parallel to BC, and the measured steps of the page's proof: equal tangents give AM = AK, so A is the midpoint of UV, D and E are the midpoints of NU and NV, DE is parallel to BC, and F and G are the midpoints of AB and AC. options may set names, hint1 and hint2; a flat triangle is refused.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const { g, cl } = geometryFor(C, s);
        const r = reading(C, s, g, cl);
        return {
          ...r,
          note:
            `F = (${r.construction.midpoints.F.x}, ${r.construction.midpoints.F.y}) and ` +
            `G = (${r.construction.midpoints.G.x}, ${r.construction.midpoints.G.y}); ` +
            `the core's own midpoints are (${r.construction.midpointOfAB.x}, ${r.construction.midpointOfAB.y}) ` +
            `and (${r.construction.midpointOfAC.x}, ${r.construction.midpointOfAC.y}), with largest ` +
            `difference ${r.largestMidpointError} drawing units (tolerance ${TOL}). ` +
            "Equal tangents give AM = AK, BM = BN and CN = CK; the isosceles/similar triangles give " +
            "AM = AU and AK = AV, hence AU = AV and A is the midpoint of UV. In triangle NUV the " +
            "parallels make D and E the midpoints of NU and NV, so DE is parallel to BC and cuts AB " +
            "and AC at their midpoints. This is an illustration, so there is no win or loss.",
        };
      },
    },

    check_claims: {
      describe:
        "For the same triangle ABC, tabulate every numeric claim the core checks, as an error in drawing units and a pass/fail at the port's 1e-5 tolerance: the equal tangents AM = AK, BM = BN, CK = CN, the midpoint steps AM = AU, AK = AV, AU = AV, D and E bisecting NU and NV, the parallels DE and UV against BC, and the final AF = FB and AG = GC, plus the incircle radius checks. Arguments and validation are as in midpoint_construction.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const { g, cl } = geometryFor(C, s);
        const r = reading(C, s, g, cl);
        return {
          triangle: r.triangle,
          incenter: r.incenter,
          incircleRadius: r.incircleRadius,
          claims: r.claims,
          tolerance: TOL,
          everyClaimHolds: r.allClaimsHold,
          note:
            `${r.claims.filter((c) => c.holds).length} of ${r.claims.length} core claims pass at ` +
            `${TOL} drawing units. The largest midpoint miss, for DE cutting AB and AC at F and G, ` +
            `is ${r.largestMidpointError}; the equal-tangent lengths from A are ` +
            `${r.proof.equalTangents[0].lengths.join(" and ")} units. This is a demonstration with no win or loss.`,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Incircle and Midpoints state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Incircle and Midpoints position must be an object");
  }
  const src = state as Json;
  const C = core();
  let s: State;
  let savedReadable = true;
  try {
    s = buildState(C, src);
  } catch {
    savedReadable = false;
    s = C.start({});
  }
  const saved = {
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    options: { ...s.options },
  };
  const g = C.geometry(s);
  const cl = C.claimErrors(g);
  if (!g.valid || !cl) {
    return {
      ...src,
      stateVersion,
      savedReadable,
      saved,
      valid: false,
      drawingPossible: false,
      isIllustration: true,
      note:
        "Track.state saved the three draggable corners and the names/hint switches, but those " +
        "corners are collinear or too close: the core draws nothing for a flat triangle. " +
        "This is a demonstration with no win or loss.",
    };
  }
  const r = reading(C, s, g, cl);
  return {
    ...src,
    stateVersion,
    savedReadable,
    saved,
    valid: true,
    drawingPossible: true,
    isIllustration: true,
    triangle: r.triangle,
    incenter: r.incenter,
    incircleRadius: r.incircleRadius,
    touchPoints: r.construction.touchPoints,
    constructed: r.construction,
    F: r.construction.midpoints.F,
    G: r.construction.midpoints.G,
    allClaimsHold: r.allClaimsHold,
    largestMidpointError: r.largestMidpointError,
    reading: r,
    note: !savedReadable
      ? "The saved fields could not be read as three board corners, so the core's opening triangle was reconstructed; the reading below is of that picture."
      : "Track.state saved the three corners the player drags and the names/hint switches. The core rebuilds the incircle's touch points, the parallels through A, the points D, E, U, V and the line DE, and checks that F and G are the midpoints of AB and AC along with every step of the page's proof. This is a demonstration: there is no win or loss.",
  };
}
