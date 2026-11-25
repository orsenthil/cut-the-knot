/*
 * run_game_logic actions and saved-position reader for How Fast Do Unit Distances Grow?.
 * The core lives in unit-distance-growth/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["unit-distance-growth"].UnitGrowthCore;

export function actions(): GameActions {
  return {
    best_grid: {
      describe: "The best k by k grid (k 2..64): its spacing c2, unit pairs, and the exponent log(pairs)/log(n). 36 by 36 gives 7,632 pairs.",
      args: '{ "k": 36 }',
      run: (args) => { const r = core().bestFor(core().clampK(num(args, "k", 36))); return { ...r, exponent: core().exponent(r.count, r.n), ceiling: core().ceiling(r.n) }; },
    },
    ceiling: {
      describe: "A proved ceiling on unit pairs among n points: n(1 + sqrt(8n - 7))/4 (the best known one is about n^(4/3)).",
      args: '{ "n": 1296 }',
      run: (args) => ({ n: num(args, "n"), ceiling: core().ceiling(num(args, "n")) }),
    },
  };
}

export function position(state: Json): unknown {
  const r = core().bestFor(core().clampK(state.k));
  return {
    ...r, exponent: core().exponent(r.count, r.n), provedCeiling: core().ceiling(r.n),
    note: "The grid exponent stays near 1.25 at these sizes; the 2026 construction has exponent at least 1.014, which only shows for huge n.",
  };
}
