/*
 * run_game_logic actions and saved-position reader for A Semi-regular
 * Tessellation on Hinges A (HingedTessellation1).
 *
 * The real core is hinged-tessellation-1/hinged-tessellation-1-core.js, copied
 * into src/generated/cores/ at build time; every number below is measured from
 * it. Coordinates are the board's 640 x 460 viewBox units, y downward.
 *
 * The opening cell is a square ABCD: around each corner the (4,3,3,4,3)
 * vertex figure fills the turn, 90 + 60 + 60 + 90 + 60 = 360 degrees. A and C
 * glide on the circle about B while B stays on the perpendicular bisector of
 * AC, so AB = BC and D = C + A - B: the square is free to hinge into a rhombus,
 * while five equilateral triangles per piece are kept rigid. At 60 degrees
 * (or 120) the rhombus splits into two equilateral triangles and six of them
 * meet at a corner, 6 x 60 = 360. HingedTessellation2 makes the opposite
 * choice: it keeps the squares and frees the triangles.
 *
 * This page is an illustration: there is no win or loss. See _shared.ts for
 * the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Options = { layers: number; mode: number };
type State = { A: Point; B: Point; C: Point; D: Point; options: Options; explored: boolean };
type Measures = {
  sides: number[];
  sideSpread: number;
  atB: number;
  adnAngles: number[];
  triangleSpread: number;
  squareError: number;
  tol: number;
  scale: number;
  triangular: boolean;
  halves: Point[][];
  claims: {
    rhombus: boolean;
    trianglesEquilateral: boolean;
    squareAtStart: boolean;
    vertexFigure: boolean;
    triangularAt60: boolean;
    sixTriangles: boolean;
  };
};
type Geometry = { base: unknown; v: Point; w: Point; tiles: unknown[]; total: number; drawn: unknown[] };
interface Core {
  VIEW: { x: number; y: number; width: number; height: number };
  LIMITS: {
    layers: { min: number; max: number; initial: number };
    mode: { min: number; max: number; initial: number };
  };
  MODE_NAMES: string[];
  COLORS: number;
  dist(p: Point, q: Point): number;
  fourthPoint(a: Point, b: Point, c: Point): Point;
  start(options?: Partial<Options>): State;
  move(s: State, name: "A" | "B" | "C", p: Point): State;
  setOption(s: State, name: keyof Options, value: number): State;
  geometry(s: State): Geometry;
  measures(s: State): Measures;
  describe(s: State): string;
  result(s: State): null;
}

const core = (): Core => cores["hinged-tessellation-1"].HingedTessellation1Core as unknown as Core;
const DIFFERENCE =
  "This is HingedTessellation1: the squares are freed into rhombi and the equilateral triangles stay rigid. " +
  "HingedTessellation2 makes the opposite choice, keeping the squares and freeing the triangles.";

/* Geometry is exact up to floating point; tidy only what is printed. */
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const cnt = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const samePt = (p: Point | null | undefined, q: Point | null | undefined, tol: number): boolean =>
  !!p && !!q && Math.hypot(p.x - q.x, p.y - q.y) <= tol;

/** Accept both the page's saved { x, y } dots and short [x, y] JSON. */
function readPoint(raw: unknown, label: string, fallback?: Point): Point {
  if (raw === undefined || raw === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

/** The applet's spinners: a wrong or missing value uses the applet's default. */
function option(raw: unknown, key: keyof Options, C: Core): number {
  const lim = C.LIMITS[key];
  if (raw === undefined || raw === null) return lim.initial;
  const n = Number(raw);
  return Number.isInteger(n) && n >= lim.min && n <= lim.max ? n : lim.initial;
}

/** Validated spinner arguments for the tutor's actions (bad values are errors). */
function requestedOptions(C: Core, args: Json): Options {
  const layers = args.layers === undefined || args.layers === null
    ? C.LIMITS.layers.initial : Number(args.layers);
  const mode = args.mode === undefined || args.mode === null
    ? C.LIMITS.mode.initial : Number(args.mode);
  if (!Number.isInteger(layers) || layers < C.LIMITS.layers.min || layers > C.LIMITS.layers.max) {
    throw new Error(`argument "layers" must be an integer from ${C.LIMITS.layers.min} to ${C.LIMITS.layers.max}`);
  }
  if (!Number.isInteger(mode) || mode < C.LIMITS.mode.min || mode > C.LIMITS.mode.max) {
    throw new Error(`argument "mode" must be an integer from ${C.LIMITS.mode.min} to ${C.LIMITS.mode.max}`);
  }
  return { layers, mode };
}

/** What the core measures about one particular hinged drawing. */
function reading(C: Core, s: State, m: Measures, g: Geometry) {
  const c = m.claims;
  return {
    atB: cnt(m.atB),
    cornerDegrees: Number.isFinite(m.atB) ? Math.round(m.atB) : null,
    sides: m.sides.map(cnt),
    sideSpread: sig(m.sideSpread),
    adnAngles: m.adnAngles.map(cnt),
    triangleSpread: sig(m.triangleSpread),
    squareError: cnt(m.squareError),
    tolerance: sig(m.tol),
    scale: cnt(m.scale),
    claims: { ...c },
    rhombus: c.rhombus,
    trianglesEquilateral: c.trianglesEquilateral,
    squareAtStart: c.squareAtStart,
    vertexFigure: c.vertexFigure,
    triangularAt60: c.triangularAt60,
    sixTriangles: c.sixTriangles,
    equilateralHalves: { count: m.halves.length, triangles: m.halves.map((t) => t.map(pt)) },
    steps: {
      step: pt(g.v), rowStep: pt(g.w),
      note: "The core repeats the cell by A - H along a row and L - C between rows.",
    },
    tiles: { drawn: g.drawn.length, total: g.total },
    note: C.describe(s),
  };
}

export function actions(): GameActions {
  return {
    vertex_figure: {
      describe:
        "At the opening square, report the semi-regular (4,3,3,4,3) vertex figure and check its angle sum 90 + 60 + 60 + 90 + 60 = 360 degrees, alongside the six-equilateral-sector derivative 6 x 60 = 360 that the same hinges reach at 60 degrees. Optional layers (0-15) and mode (0-2, one colour/two colours/colour bands) set the drawing; the example uses the page's 4 rings and one colour. " +
        DIFFERENCE,
      args: '{ "layers": 4, "mode": 0 }',
      run: (args) => {
        const C = core();
        const options = requestedOptions(C, args);
        const s = C.start(options);
        const m = C.measures(s);
        const g = C.geometry(s);
        const opening = C.measures(C.start());
        const sum = 90 + 60 + 60 + 90 + 60;
        return {
          view: C.VIEW,
          options,
          modeName: C.MODE_NAMES[s.options.mode],
          vertexFigure: {
            symbols: [4, 3, 3, 4, 3],
            anglesDegrees: [90, 60, 60, 90, 60],
            sumDegrees: sum,
            fillsTheTurn: sum === 360 && m.claims.vertexFigure,
            squareAtStart: opening.claims.squareAtStart,
            squareCornerErrorDegrees: cnt(opening.squareError),
          },
          triangularDerivative: {
            symbols: [3, 3, 3, 3, 3, 3],
            anglesDegrees: [60, 60, 60, 60, 60, 60],
            sumDegrees: 6 * 60,
            fillsTheTurn: 6 * 60 === 360 && m.claims.sixTriangles,
          },
          tiles: { drawn: g.drawn.length, total: g.total },
          result: C.result(s),
          note:
            `Around every corner of the starting square the sectors are ${[90, 60, 60, 90, 60].join(" + ")} = ${sum} degrees, ` +
            `and the core confirms squareAtStart = ${opening.claims.squareAtStart}. ` +
            `Six equilateral sectors give 6 x 60 = ${6 * 60} degrees after the squares are freed. ${DIFFERENCE}`,
        };
      },
    },

    free_the_squares: {
      describe:
        "Drag A around its circle about B until the hinge angle at B is `degrees` (1-179, default 60), through the real core's constrained move; 60 and 120 degrees split the rhombus into two equilateral triangles. Reports the four equal sides, the corner angle at B, the three angles of triangle ADN, whether the five triangles are still equilateral, and the two equilateral halves, plus the tile counts for optional layers (0-15) and mode (0-2). " +
        DIFFERENCE,
      args: '{ "degrees": 60, "layers": 4, "mode": 0 }',
      run: (args) => {
        const C = core();
        const options = requestedOptions(C, args);
        const degrees = args.degrees === undefined || args.degrees === null ? 60 : Number(args.degrees);
        if (!Number.isFinite(degrees) || degrees <= 0 || degrees >= 180) {
          throw new Error('argument "degrees" must be a number strictly between 0 and 180');
        }
        const s0 = C.start(options);
        /* The saved C sits at 135 degrees from B in screen coordinates; putting
         * A at 135 - degrees makes the (unsigned) angle ABC equal degrees,
         * because B is locked to the perpendicular bisector of AC. */
        const radius = C.dist(s0.B, s0.C);
        const bearingBtoC = Math.atan2(s0.C.y - s0.B.y, s0.C.x - s0.B.x);
        const a = {
          x: s0.B.x + radius * Math.cos(bearingBtoC - degrees * Math.PI / 180),
          y: s0.B.y + radius * Math.sin(bearingBtoC - degrees * Math.PI / 180),
        };
        const s = C.move(C.move(s0, "A", a), "B", s0.B);
        const m = C.measures(s);
        const g = C.geometry(s);
        return {
          requested: { degrees, options, modeName: C.MODE_NAMES[s.options.mode] },
          corners: { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D) },
          reading: reading(C, s, m, g),
          result: C.result(s),
          note:
            `At ${cnt(m.atB)} degrees at B the four sides are ${m.sides.map(cnt).join(", ")} (spread ${sig(m.sideSpread)}), ` +
            `so rhombus = ${m.claims.rhombus} while the five triangles stay equilateral (${m.claims.trianglesEquilateral}). ` +
            (m.claims.triangularAt60
              ? `The rhombus splits into ${m.halves.length} equilateral triangles, so six sectors of 60 degrees fill each corner. `
              : "The rhombus does not split into equilateral halves at this angle. ") +
            DIFFERENCE,
        };
      },
    },
  };
}

/** Echo what Track.state saved; a damaged field falls back to the opening picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hinged Tessellation 1 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Hinged Tessellation 1 position must be an object");
  }
  const C = core();
  const base = C.start();
  const g0 = C.geometry(base);
  const savedA = readPoint(state.A, "A", base.A);
  const savedB = readPoint(state.B, "B", base.B);
  const savedC = readPoint(state.C, "C", base.C);
  const savedOptions = state.options && typeof state.options === "object"
    ? state.options as Json : {};
  const options: Options = {
    layers: option(savedOptions.layers, "layers", C),
    mode: option(savedOptions.mode, "mode", C),
  };
  /* The lattice steps are presentation aids; a damaged one must not spoil the
   * reading of the hinge corners. */
  const savedStepPoint = (raw: unknown, fallback: Point): Point => {
    try { return readPoint(raw, "step", fallback); } catch { return fallback; }
  };
  const savedStep = savedStepPoint(state.step, g0.v);
  const savedRowStep = savedStepPoint(state.rowStep, g0.w);
  const s: State = {
    A: savedA, B: savedB, C: savedC,
    D: C.fourthPoint(savedA, savedB, savedC),
    options,
    explored: state.explored === true,
  };
  const m = C.measures(s);
  const g = C.geometry(s);
  const savedD = readPoint(state.D, "D", s.D);
  const scale = Math.max(1, m.scale);
  const r = reading(C, s, m, g);

  return {
    stateVersion,
    A: pt(savedA), B: pt(savedB), C: pt(savedC), D: pt(savedD),
    options,
    step: pt(savedStep), rowStep: pt(savedRowStep),
    tilesDrawn: Number.isFinite(Number(state.tilesDrawn)) ? Number(state.tilesDrawn) : null,
    tilesTotal: Number.isFinite(Number(state.tilesTotal)) ? Number(state.tilesTotal) : null,
    measures: state.measures ?? null,
    result: C.result(s),
    reading: {
      ...r,
      steps: {
        ...r.steps,
        stepMatchesSaved: samePt(g.v, savedStep, 1e-6 * scale),
        rowStepMatchesSaved: samePt(g.w, savedRowStep, 1e-6 * scale),
      },
      tiles: {
        ...r.tiles,
        drawnMatchesSaved: Number(state.tilesDrawn) === g.drawn.length,
        totalMatchesSaved: Number(state.tilesTotal) === g.total,
      },
    },
    hinge: {
      sideDifference: sig(C.dist(savedA, savedB) - C.dist(savedB, savedC)),
      rhombusConstraintHolds: Math.abs(C.dist(savedA, savedB) - C.dist(savedB, savedC)) <= m.tol,
      fourthPointError: sig(Math.hypot(savedD.x - s.D.x, savedD.y - s.D.y)),
      note: "B is locked to the perpendicular bisector of AC, so AB = BC and D = C + A - B keep the cell a rhombus.",
    },
    note:
      "Track.state saved the four hinge corners, the layers/mode spinners, the two lattice steps, the tile counts and the core's own measures. " +
      `Re-measuring those corners gives a ${cnt(m.atB)}-degree corner at B: rhombus = ${m.claims.rhombus}, ` +
      `triangles equilateral = ${m.claims.trianglesEquilateral}, square at start = ${m.claims.squareAtStart}, ` +
      `equilateral halves = ${m.claims.triangularAt60}. ${r.note} ${DIFFERENCE}`,
  };
}
