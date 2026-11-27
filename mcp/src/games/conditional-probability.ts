/*
 * run_game_logic actions and saved-position reader for Conditional Probability.
 *
 * The real core is conditional-probability/conditional-probability-core.js,
 * copied into src/generated/cores/ at build time. It follows the applet's
 * Compute(): a grid of Nx by Ny equally likely dots is the sample space, and
 * two axis-aligned rectangles A and B are events whose corners sit on grid
 * lines. Their probabilities are integer cell counts over Nx*Ny, so
 * P(A|B) = P(A∩B)/P(B), P(B|A) = P(A∩B)/P(A), independence is the exact
 * identity P(A∩B) = P(A)P(B), and the law of total probability cuts B into
 * the parts inside and outside A. Every number below comes from the core.
 * See _shared.ts for the module shape.
 *
 * Grid coordinates are integer cells, with (0, 0) at the top left.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["conditional-probability"].ConditionalProbabilityCore;
type Core = ReturnType<typeof core>;
type Rect = { x: number; y: number; w: number; h: number };
type GridState = { nx: number; ny: number; a: Rect; b: Rect };
type Computed = {
  nx: number; ny: number; total: number;
  a: Rect; b: Rect; i: Rect;
  cells: { a: number; b: number; i: number };
  pa: number; pb: number; pi: number;
  pab: number; pba: number;
};

/** Keep six decimal places; undefined conditionals (NaN) become null. */
const r6 = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toFixed(6));

/** A rectangle is {x, y, w, h} or [x, y, w, h] in grid cells. */
function readRect(value: unknown, key: string, fallback: Rect): Rect {
  if (value === undefined || value === null) return { ...fallback };
  let obj: Json;
  if (Array.isArray(value)) {
    if (value.length !== 4) {
      throw new Error(`argument "${key}" must be [x, y, w, h] or { x, y, w, h }`);
    }
    obj = { x: value[0], y: value[1], w: value[2], h: value[3] };
  } else if (typeof value === "object") {
    obj = value as Json;
  } else {
    throw new Error(`argument "${key}" must be [x, y, w, h] or { x, y, w, h }`);
  }
  return { x: num(obj, "x"), y: num(obj, "y"), w: num(obj, "w"), h: num(obj, "h") };
}

/** Build a board from optional arguments, letting the real core clamp it. */
function readState(C: Core, args: Json): GridState {
  const seed = C.start() as GridState;
  const nx = num(args, "nx", seed.nx);
  const ny = num(args, "ny", seed.ny);
  let s = C.withGrid(seed, nx, ny) as GridState;
  s = C.withRect(s, "a", readRect(args.a, "a", seed.a)) as GridState;
  s = C.withRect(s, "b", readRect(args.b, "b", seed.b)) as GridState;
  return s;
}

/** The core's five applet numbers plus the exact identities behind them. */
function reading(C: Core, s: GridState) {
  const p = C.compute(s) as unknown as Computed;
  const independent = C.independent(p);
  const shown = (v: number): string => C.format(v).trim();
  const { a: ca, b: cb, i: ci } = p.cells;
  const outsideA = p.total - ca;

  // P(B|Aᶜ) = |B outside A| / |Aᶜ|; the two pieces of B add back to P(B).
  const pBGivenNotA = outsideA > 0 ? (cb - ci) / outsideA : null;
  const pNotA = outsideA / p.total;
  const totalSum = ca > 0 && outsideA > 0
    ? p.pba * (ca / p.total) + pBGivenNotA! * pNotA
    : null;

  return {
    grid: { nx: p.nx, ny: p.ny, total: p.total },
    rectangles: { A: p.a, B: p.b, overlap: p.i },
    cells: { A: ca, B: cb, overlap: ci, outsideA },
    probabilities: {
      P_A: r6(p.pa),
      P_B: r6(p.pb),
      P_A_and_B: r6(p.pi),
      P_A_given_B: r6(p.pab),
      P_B_given_A: r6(p.pba),
      P_A_union_B: r6((ca + cb - ci) / p.total),
    },
    /** The five labels exactly as the applet displays them. */
    appletDisplay: {
      P_A: shown(p.pa),
      P_B: shown(p.pb),
      P_A_and_B: shown(p.pi),
      P_A_given_B: shown(p.pab),
      P_B_given_A: shown(p.pba),
    },
    independence: {
      holds: independent,
      pA_times_pB: r6(p.pa * p.pb),
      equalityFromCells: ci * p.total === ca * cb,
      note: independent === null
        ? "A or B covers no cells, so a conditional with it as the condition is undefined (the applet shows NaN)."
        : independent
          ? "Independent: P(A and B) equals P(A) × P(B), so each conditional equals the event's own probability."
          : "Dependent: P(A and B) is not P(A) × P(B), so knowing one event changes the chance of the other.",
    },
    lawOfTotalProbability: {
      P_B: r6(p.pb),
      givenA: { P_B_given_A: r6(p.pba), P_A: r6(p.pa) },
      givenNotA: { P_B_given_not_A: r6(pBGivenNotA), P_not_A: r6(pNotA) },
      sum: r6(totalSum),
      equalsP_B: totalSum === null ? null : Math.abs(totalSum - p.pb) < 1e-12,
      note: totalSum === null
        ? "The identity needs both A and its complement to have positive cells; one of the two conditionals is undefined here."
        : "B is split into the cells inside A and the cells outside A: P(B) = P(B|A)P(A) + P(B|Aᶜ)P(Aᶜ).",
    },
  };
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For an Nx by Ny grid of equally likely dots (10 to 30 each, default 25 by 20) and two axis-aligned events A and B given as {x, y, w, h} in grid cells, report the cell counts, the five applet probabilities P(A), P(B), P(A and B), P(A|B) and P(B|A) both as decimals and as the applet displays them, whether A and B are independent, and the law of total probability P(B) = P(B|A)P(A) + P(B|Aᶜ)P(Aᶜ). Omit either rectangle to use the applet's starting one; out-of-range values are clamped by the real core.",
      args: '{ "nx": 25, "ny": 20, "a": { "x": 3, "y": 3, "w": 3, "h": 6 }, "b": { "x": 5, "y": 8, "w": 6, "h": 5 } }',
      run: (args) => {
        const C = core();
        return reading(C, readState(C, args));
      },
    },
    independent_rectangles: {
      describe:
        "For an Nx by Ny grid and a rectangle A (same format as inspect), find up to maxResults non-trivial rectangles B that are independent of A, i.e. with P(A and B) = P(A)P(B) and 0 < P(B) < 1. The whole grid is excluded because every event is trivially independent of a certain event. Each candidate is tested with the core's intersection and independence check.",
      args: '{ "nx": 25, "ny": 20, "a": { "x": 3, "y": 3, "w": 3, "h": 6 }, "maxResults": 5 }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const maxResults = args.maxResults === undefined ? 5 : num(args, "maxResults");
        if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 20) {
          throw new Error("maxResults must be a whole number between 1 and 20");
        }
        const total = s.nx * s.ny;
        const ca = s.a.w * s.a.h;
        const examples: Json[] = [];
        if (ca > 0) {
          search: for (let x = 0; x < s.nx; x++) {
            for (let y = 0; y < s.ny; y++) {
              for (let w = 1; w <= s.nx - x; w++) {
                for (let h = 1; h <= s.ny - y; h++) {
                  const b: Rect = { x, y, w, h };
                  const cb = w * h;
                  if (cb === total) continue; // the certain event is a trivial answer
                  const overlap = C.intersection(s.a, b);
                  if (overlap.w * overlap.h * total !== ca * cb) continue;
                  const p = C.compute(C.withRect(s, "b", b)) as unknown as Computed;
                  if (C.independent(p) !== true) continue;
                  examples.push({
                    B: b,
                    cells: { B: cb, overlap: overlap.w * overlap.h },
                    P_B: C.format(p.pb).trim(),
                    P_A_and_B: C.format(p.pi).trim(),
                    P_A_given_B: C.format(p.pab).trim(),
                  });
                  if (examples.length >= maxResults) break search;
                }
              }
            }
          }
        }
        return {
          grid: { nx: s.nx, ny: s.ny, total },
          A: s.a,
          cellsA: ca,
          independentExamples: examples,
          note: examples.length
            ? "These B rectangles satisfy the core's exact integer identity cells(overlap) × total = cells(A) × cells(B), so their conditionals match the event probabilities."
            : "No non-trivial grid rectangle B is independent of this A; only the whole grid (P(B) = 1) would be, and that is excluded.",
        };
      },
    },
  };
}

/** Track.state saves the grid sizes and the two rectangles; the core reads them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Conditional Probability state version ${stateVersion}`);
  }
  const C = core();
  const seed = C.start() as GridState;
  const saved = {
    nx: num(state, "nx", seed.nx),
    ny: num(state, "ny", seed.ny),
    a: readRect(state.a, "a", seed.a),
    b: readRect(state.b, "b", seed.b),
  };
  const here = readState(C, state);
  return {
    stateVersion,
    saved,
    ...reading(C, here),
    note: "Track.state saved the grid sizes and the two rectangles. The core rebuilds the five displayed probabilities, the independence test and the total-probability split from them.",
  };
}
