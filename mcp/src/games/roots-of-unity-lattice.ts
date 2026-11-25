/*
 * run_game_logic actions and saved-position reader for the Roots of Unity Lattice.
 * The core lives in roots-of-unity-lattice/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["roots-of-unity-lattice"].RootsCore;

export function actions(): GameActions {
  return {
    compare: {
      describe: "Points a0 + a1 z + ... with z = exp(2 pi i / m) and coefficients 0..r: their unit pairs against the best square grid of at most as many points. m is 5, 7, 8, 9 or 12. For m = 12: r = 2 gives 288 v 224, r = 3 gives 1056 v 976, r = 4 gives 2800 v 3144.",
      args: '{ "m": 12, "r": 3 }',
      run: (args) => {
        const m = core().clampM(num(args, "m", 12)), r = Math.min(Math.max(1, Math.floor(num(args, "r", 2))), core().maxR(m));
        const pts = core().build(m, r), pairs = core().countByRoots(m, pts), g = core().bestSquareGrid(pts.length);
        return { m, r, points: pts.length, independentArrows: core().phi(m), unitPairs: pairs, squareGrid: g, ahead: pairs > g.count };
      },
    },
  };
}

export function position(state: Json): unknown {
  const m = core().clampM(state.m), r = Number(state.r);
  const pts = core().build(m, Math.min(Math.max(1, r), core().maxR(m)));
  const pairs = core().countByRoots(m, pts), g = core().bestSquareGrid(pts.length);
  return {
    m, r, points: pts.length, unitPairs: pairs, bestSquareGrid: g, aheadOfTheGrid: pairs > g.count,
    note: "A toy of the lift-and-project idea; not the construction behind the 2026 disproof.",
  };
}
