/*
 * run_game_logic actions and saved-position reader for Minkowski Addition.
 *
 * The real core is minkowski-addition/minkowski-addition-core.js (copied into
 * src/generated/cores/ at build time). Its compute()/geometry() transcribe the
 * applet's Draw(): four draggable points A, B, O and O' give the two sums
 * S = A + B - O and S' = A + B - O', and the pink quadrilateral O, S', S, O'.
 * The page's claim, checked here with the real core, is that the sum moves by
 * the opposite vector: S' - S = O - O' = -(O' - O), the two shifts have equal
 * length, and OS and O'S' are both bisected by the midpoint of AB.
 *
 * Every number below is measured by that core; coordinates are board units in
 * the page's 420 x 330 view, y down. This is an illustration, so there is no
 * win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Options = { showFirst: boolean; showSecond: boolean; showShift: boolean };
type State = {
  A: Point; B: Point; O: Point; Op: Point;
  options: Options; explored: boolean;
};
type Geometry = {
  A: Point; B: Point; O: Point; Op: Point; S: Point; Sp: Point; M: Point;
  shift: Point; sumShift: Point;
  red: Point[][]; blue: Point[][]; pink: Point[][];
  measures: {
    oppositeError: number; lengthError: number; bisectError: number; paraError: number;
    oneError: number; twoError: number; threeError: number;
  };
  claims: Record<string, boolean>;
  tol: number;
};
interface Core {
  VIEW: { x: number; y: number; width: number; height: number };
  PAD: number;
  point(x: number, y: number): Point;
  add(p: Point, q: Point): Point;
  sub(p: Point, q: Point): Point;
  mul(p: Point, k: number): Point;
  dist(p: Point, q: Point): number;
  midpoint(p: Point, q: Point): Point;
  finite(p: unknown): boolean;
  clamp(p: Point): Point;
  start(options?: Json): State;
  reset(state: State): State;
  move(state: State, name: string, p: Point): State;
  setOption(state: State, name: string, on: boolean): State;
  compute(a: Point, b: Point, o: Point, op: Point): Geometry | null;
  geometry(state: State): Geometry | null;
  result(state: State): null;
  describe(state: State): string;
}

const core = (): Core =>
  cores["minkowski-addition"].MinkowskiAdditionCore as unknown as Core;

/* The core is exact up to floating point; tidy only the numbers we print. */
const r6 = (n: number): number => (Number.isFinite(n) ? Number(n.toFixed(6)) : NaN);
const sig = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isFinite(n) ? Number(n.toExponential(3)) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;

/** A board point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Point): Point {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x = NaN;
  let y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function flag(raw: unknown, label: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") {
    throw new Error(`argument "${label}" must be true or false, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

function readOptions(raw: unknown, fallback: Options): Options {
  if (raw === undefined || raw === null) return { ...fallback };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error('argument "options" must be an object with showFirst/showSecond/showShift');
  }
  const o = raw as Json;
  return {
    showFirst: flag(o.showFirst, "options.showFirst", fallback.showFirst),
    showSecond: flag(o.showSecond, "options.showSecond", fallback.showSecond),
    showShift: flag(o.showShift, "options.showShift", fallback.showShift),
  };
}

/** The applet's Reset picture, with supplied points applied as core drags. */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with A, B, O and Op points");
  }
  const seed = C.start();
  let s = C.start(readOptions(args.options, seed.options));
  for (const name of ["A", "B", "O", "Op"] as const) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) s = C.move(s, name, readPoint(raw, name, seed[name]));
  }
  return s;
}

function requireGeometry(C: Core, s: State): Geometry {
  const g = C.geometry(s);
  if (!g) throw new Error("A, B, O and O' must be finite points");
  return g;
}

/** The sums, the two shifts, the parallelogram and the core's claim checks. */
function reading(C: Core, g: Geometry) {
  const zero = C.point(0, 0);
  const opposite = C.add(g.sumShift, g.shift); // S' - S + (O' - O): zero when the claim holds
  const firstMid = C.midpoint(g.O, g.S);
  const secondMid = C.midpoint(g.Op, g.Sp);
  return {
    points: { A: pt(g.A), B: pt(g.B), O: pt(g.O), Op: pt(g.Op) },
    sums: { S: pt(g.S), Sp: pt(g.Sp) },
    midpointOfAB: pt(g.M),
    originShift: pt(g.shift),     // O' - O, the way the origin moved
    sumShift: pt(g.sumShift),     // S' - S, the way the sum moved
    oppositeSum: pt(opposite),    // (0, 0) exactly when S' - S = O - O'
    shiftLengths: {
      origin: r6(C.dist(g.O, g.Op)),
      sum: r6(C.dist(g.S, g.Sp)),
      difference: sig(Math.abs(C.dist(g.O, g.Op) - C.dist(g.S, g.Sp))),
    },
    parallelogram: {
      verticesInPinkOrder: [pt(g.O), pt(g.Sp), pt(g.S), pt(g.Op)],
      diagonalOSMidpoint: pt(firstMid),
      diagonalOpSpMidpoint: pt(secondMid),
      bothBisectedAtMidAB: g.claims.bisectedAtMidAB && g.claims.OSpSOpParallelogram,
      error: sig(g.measures.paraError),
    },
    measures: {
      oppositeError: sig(g.measures.oppositeError),
      lengthError: sig(g.measures.lengthError),
      bisectError: sig(g.measures.bisectError),
      paraError: sig(g.measures.paraError),
      oneError: sig(g.measures.oneError),
      twoError: sig(g.measures.twoError),
      threeError: sig(g.measures.threeError),
    },
    claims: g.claims,
    claimsPassed: Object.values(g.claims).filter(Boolean).length,
    claimCount: Object.keys(g.claims).length,
    tolerance: sig(g.tol),
    allClaimsHold: Object.values(g.claims).every(Boolean),
    zero: pt(zero),
  };
}

/** How far a derived field the page saved is from the core's fresh value. */
function compareSaved(C: Core, raw: unknown, fresh: Point, tol: number) {
  if (raw === undefined || raw === null) return null;
  let saved: Point;
  try {
    saved = readPoint(raw, "saved field");
  } catch {
    return null;
  }
  const difference = C.dist(saved, fresh);
  return { saved: pt(saved), difference: sig(difference), agrees: difference <= tol };
}

/* Four Reset points from the live page, so the examples are reproducible. */
const EXAMPLE_POINTS = '{"A":[157,194],"B":[264,140],"O":[142,300],"Op":[386,238]}';

export function actions(): GameActions {
  return {
    opposite_shift: {
      describe:
        "For four draggable points A, B, O and O' (each [x, y] or { x, y } in the page's 420 x 330 board units, y down; omit any to keep the applet's Reset position), use the real core to draw both sums S = A + B - O and S' = A + B - O'. Reports that S' - S = O - O' = -(O' - O), that the two shifts have equal length, and that O, S', S, O' is a parallelogram whose diagonals OS and O'S' are both bisected by the midpoint of AB. Supplied points are clamped to the board just as a drag clamps them; showFirst/showSecond/showShift are optional switches.",
      args: EXAMPLE_POINTS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = requireGeometry(C, s);
        const r = reading(C, g);
        return {
          ...r,
          options: { ...s.options },
          note:
            `S = A + B - O = (${r.sums.S!.x}, ${r.sums.S!.y}) and S' = A + B - O' = ` +
            `(${r.sums.Sp!.x}, ${r.sums.Sp!.y}). Moving the origin by O' - O = ` +
            `(${r.originShift!.x}, ${r.originShift!.y}) moves the sum by ` +
            `(${r.sumShift!.x}, ${r.sumShift!.y}), the opposite vector of the same length; ` +
            "their vector sum is the origin. Both parallelograms share the diagonal AB, so their fourth vertices S and S' satisfy O + S = O' + S' = A + B, which makes OS'SO' a parallelogram cut in half at the midpoint of AB. " +
            `${r.claimsPassed} of ${r.claimCount} core claims hold here. This is an illustration with no win or loss.`,
        };
      },
    },

    translation_experiment: {
      describe:
        "With the same four points, translate some of them by a vector v ([x, y] or { x, y }; default O' - O, the origin's own move) and recompute the sum with the real core: moving A alone adds v to S, moving A and B adds 2v, moving A, B and O adds v, and moving the origin O alone subtracts v. With the default v the last row is exactly the page's S' - S = -(O' - O); the applet's own fixed v = (7, -11) can be requested explicitly.",
      args: EXAMPLE_POINTS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const base = requireGeometry(C, s);
        const v = readPoint(args.v, "v", C.sub(s.Op, s.O));
        const shift = (p: Point) => C.add(p, v);
        const sumOf = (a: Point, b: Point, o: Point, op: Point): Point => {
          const g = C.compute(a, b, o, op);
          if (!g) throw new Error("the translated points must stay finite");
          return g.S;
        };
        const rows = [
          { changed: "A", expected: v, got: C.sub(sumOf(shift(s.A), s.B, s.O, s.Op), base.S) },
          { changed: "A and B", expected: C.mul(v, 2), got: C.sub(sumOf(shift(s.A), shift(s.B), s.O, s.Op), base.S) },
          {
            changed: "A, B and O",
            expected: v,
            got: C.sub(sumOf(shift(s.A), shift(s.B), shift(s.O), s.Op), base.S),
          },
          {
            changed: "O (the origin)",
            expected: C.mul(v, -1),
            got: C.sub(sumOf(s.A, s.B, shift(s.O), s.Op), base.S),
          },
        ].map((row) => ({
          changed: row.changed,
          expected: pt(row.expected),
          observed: pt(row.got),
          error: sig(C.dist(row.expected, row.got)),
          holds: C.dist(row.expected, row.got) <= base.tol,
        }));
        return {
          points: { A: pt(s.A), B: pt(s.B), O: pt(s.O), Op: pt(s.Op) },
          baseSum: pt(base.S),
          v: pt(v),
          experiments: rows,
          originMove: {
            fromO: pt(base.O),
            toOp: pt(base.Op),
            shift: pt(base.shift),
            sumShift: pt(base.sumShift),
            oppositeError: sig(base.measures.oppositeError),
          },
          allHold: rows.every((r) => r.holds),
          note:
            "S = (A - O) + B, so adding v to A adds v to the sum; adding it to both A and B adds 2v; " +
            "adding it to A, B and O cancels one v; and moving only the origin subtracts v. That last " +
            "row is why swapping O for O' sends S to S' by the opposite shift, with the same length. " +
            "This is an illustration with no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of the picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Minkowski Addition state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Minkowski Addition position must be an object");
  }
  const C = core();
  let s: State;
  let savedReadable = true;
  try {
    s = buildState(C, state);
  } catch {
    savedReadable = false;
    s = C.start({});
  }
  const g = requireGeometry(C, s);
  const r = reading(C, g);
  const saved = {
    A: pt(s.A), B: pt(s.B), O: pt(s.O), Op: pt(s.Op),
    S: ptOrNull(state.S), Sp: ptOrNull(state.Sp), M: ptOrNull(state.M),
    shift: ptOrNull(state.shift), sumShift: ptOrNull(state.sumShift),
    options: { ...s.options },
  };
  return {
    ...state,
    stateVersion,
    savedReadable,
    saved,
    core: r,
    savedVsCore: {
      S: compareSaved(C, state.S, g.S, g.tol),
      Sp: compareSaved(C, state.Sp, g.Sp, g.tol),
      M: compareSaved(C, state.M, g.M, g.tol),
      shift: compareSaved(C, state.shift, g.shift, g.tol),
      sumShift: compareSaved(C, state.sumShift, g.sumShift, g.tol),
    },
    description: C.describe(s),
    isIllustration: true,
    note: !savedReadable
      ? "The saved fields could not be read as four board points, so the core's opening picture was reconstructed; the reading below is of that picture."
      : "Track.state saved the four draggable points A, B, O and O', the derived sums S and S', their midpoint and shifts, and the three line switches. The core recomputes every derived field from A, B, O and O' and checks that S' - S = O - O', that the shifts have equal length, and that OS and O'S' share the midpoint of AB. This is an illustration with no win or loss.",
  };
}

function ptOrNull(raw: unknown): Point | null {
  if (raw === undefined || raw === null) return null;
  try {
    return pt(readPoint(raw, "saved field"));
  } catch {
    return null;
  }
}
