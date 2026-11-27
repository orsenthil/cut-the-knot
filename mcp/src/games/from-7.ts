/*
 * run_game_logic actions and saved-position reader for From 7.
 *
 * Each side of triangle ABC is continued past its end by N copies of its own
 * length, going round in one direction. The three new corners form a larger
 * triangle with exactly 3N^2 + 3N + 1 times the area of ABC: 7, 19, 37, ...
 * for N = 1, 2, 3, ... . Every construction step is affine, so the ratio does
 * not depend on the shape of ABC, only on N.
 *
 * Every number below comes from the game's real core (from-7/ on the site),
 * copied into src/generated/cores/ at build time. Coordinates are board units
 * with y down. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  A: Pt; B: Pt; C: Pt; N: number;
  width: number; height: number; showGrid: boolean; addColor: boolean;
};
type Geometry = {
  A: Pt; B: Pt; C: Pt; N: number; X: Pt[]; XX: Pt[];
  grid: { a: Pt; b: Pt }[];
  parallelograms: Pt[][];
  small: number; big: number;
  smallArea: number; bigArea: number;
  ratio: number | null; expectedRatio: number; degenerate: boolean;
};
type Core = {
  WIDTH: number; HEIGHT: number; MIN_N: number;
  start(options?: { width?: number; height?: number; N?: number }): State;
  compute(state: State): Geometry;
  areaClaim(g: Geometry): boolean;
  extend(a: Pt, b: Pt, n: number): Pt;
};
const core = (): Core => cores["from-7"].From7Core as unknown as Core;

/** The core builds 6N+9 grid lines; keep a tutor call from allocating forever. */
const MAX_N = 500;
/** Tidy only what we print; all decisions use the core's full-precision values. */
const r6 = (v: number): number => Number(v.toFixed(6));

function checkN(n: number, label: string): number {
  const min = core().MIN_N;
  if (!Number.isInteger(n) || n < min || n > MAX_N) {
    throw new Error(`${label} must be an integer from ${min} to ${MAX_N}`);
  }
  return n;
}

function readN(args: Json, key = "N", fallback?: number): number {
  return checkN(num(args, key, fallback), key);
}

/** A saved N outside the allowed range falls back to the applet's opening N. */
function maybeN(raw: unknown, fallback: number): number {
  try {
    return checkN(Number(raw), "saved N");
  } catch {
    return fallback;
  }
}

/** A corner, as { x, y } or [x, y], with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
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

/** A missing or malformed saved corner falls back to the applet's opening corner. */
function maybePoint(raw: unknown, fallback: Pt): Pt {
  try {
    return readPoint(raw, "saved corner", fallback);
  } catch {
    return { ...fallback };
  }
}

/** The opening triangle unless the caller supplies its own three corners. */
function makeState(C: Core, args: Json): State {
  const base = C.start();
  return {
    ...base,
    A: readPoint(args.A, "A", base.A),
    B: readPoint(args.B, "B", base.B),
    C: readPoint(args.C, "C", base.C),
    N: readN(args, "N", base.N),
  };
}

/** The core's reading of a constructed picture, without the heavy grid lines. */
function reading(C: Core, g: Geometry) {
  return {
    N: g.N,
    corners: { A: g.A, B: g.B, C: g.C },
    outerCorners: g.X,
    oppositeCorners: g.XX,
    originalArea: r6(g.smallArea),
    outerArea: r6(g.bigArea),
    measuredRatio: g.ratio === null ? null : r6(g.ratio),
    formula: "3*N*N + 3*N + 1",
    expectedRatio: g.expectedRatio,
    matchesFormula: C.areaClaim(g),
    degenerate: g.degenerate,
    gridLines: g.grid.length,
    parallelograms: g.parallelograms.length,
  };
}

export function actions(): GameActions {
  return {
    area_ratio: {
      describe:
        "Continue each side of a triangle by N of its own lengths and report the original area, the outer triangle's area, the measured ratio and the exact formula 3N^2+3N+1 (7 at N=1, 19 at N=2). You may give the three corners A, B, C; by default the applet's opening triangle is used.",
      args: '{ "N": 2 }',
      run: (args) => {
        const C = core();
        const g = C.compute(makeState(C, args));
        const r = reading(C, g);
        return {
          ...r,
          note: g.degenerate
            ? "The three corners lie on one line, so there is no triangle and no area ratio to measure. Move one corner off the line."
            : `Extending each side by ${g.N} length(s) makes the outer triangle ${g.expectedRatio} times the area of ABC (measured ${r.measuredRatio}). The ratio depends only on N, never on the shape of ABC.`,
        };
      },
    },
    ratio_sequence: {
      describe:
        "The outer-to-inner area ratio for a list of extension counts N: 7, 19, 37, 61, ... as 3N^2+3N+1. Every row is measured by the core from its own construction, not just evaluated from the formula.",
      args: '{ "Ns": [1, 2, 3, 4] }',
      run: (args) => {
        const C = core();
        const values = args.Ns === undefined ? [1, 2, 3, 4] : args.Ns;
        if (!Array.isArray(values) || values.length === 0 || values.length > 40) {
          throw new Error("Ns must be an array of 1 to 40 extension counts");
        }
        const rows = values.map((value, i) => {
          const N = checkN(Number(value), `Ns[${i}]`);
          const g = C.compute(makeState(C, { N }));
          return {
            N,
            expectedRatio: g.expectedRatio,
            measuredRatio: g.ratio === null ? null : r6(g.ratio),
            matchesFormula: C.areaClaim(g),
          };
        });
        return {
          formula: "3*N*N + 3*N + 1",
          rows,
          note: "The first extension (N=1) gives seven copies of the original triangle; adding one more length to every side adds 6N+6 more copies, so the sequence is 7, 19, 37, 61, ... .",
        };
      },
    },
  };
}

/** Echo the saved fields from Track.state, then re-measure the picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported From 7 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved From 7 position must be an object");
  }
  const C = core();
  const base = C.start();
  const saved = {
    A: maybePoint(state.A, base.A),
    B: maybePoint(state.B, base.B),
    C: maybePoint(state.C, base.C),
    N: maybeN(state.N, base.N),
    showGrid: state.showGrid === true,
    addColor: state.addColor === true,
  };
  const g = C.compute({ ...base, ...saved });
  return {
    ...state,
    stateVersion,
    saved,
    valid: true,
    core: reading(C, g),
    note:
      "Track.state saved the three draggable corners A, B, C in board units, the extension count N and the two tick boxes (showGrid, addColor); the page saves no width, height or outcome because this is a demo. The core rebuilds the two sets of extension points, the outer triangle and the grid from those corners: its area is 3N^2+3N+1 times ABC (seven at N=1), whatever shape ABC has.",
  };
}
