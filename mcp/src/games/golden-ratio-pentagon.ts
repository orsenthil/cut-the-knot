/*
 * run_game_logic actions and saved-position reader for Golden Ratio in an
 * Irregular Pentagon. The core lives in golden-ratio-pentagon/ and is copied
 * into src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["golden-ratio-pentagon"].PentagonCore;
type P = { x: number; y: number };

export function actions(): GameActions {
  return {
    measure: {
      describe: "Build the pentagon from three free points X, Z, D (Bui Quang Tuan's construction) and measure it: the five triangles cut off by the diagonals (all equal), the pentagon's area as a multiple of one of them ((5 + sqrt 5)/2 = 3.618...), and how far each diagonal is from being parallel to a side.",
      args: '{ "X": {"x": 120, "y": 80}, "Z": {"x": 300, "y": 250}, "D": {"x": 210, "y": 300} }',
      run: (args) => {
        const build = core().build({ X: args.X, Z: args.Z, D: args.D }) as Record<string, P> | null;
        if (!build) return { error: "These three points do not give a pentagon." };
        const m = core().measure(core().corners(build)) as { ears: number[]; area: number; ratio: number; parallel: number[] };
        return { corners: core().corners(build), cornerTriangleAreas: m.ears, pentagonArea: m.area, areaOverOneTriangle: m.ratio, goldenValue: core().AREA_RATIO, parallelDeviation: m.parallel };
      },
    },
    regular_free_points: {
      describe: "The three free points X, Z, D that build a regular pentagon with the given centre and radius.",
      args: '{ "cx": 250, "cy": 170, "r": 120 }',
      run: (args) => core().freePoints(core().regular(num(args, "cx", 250), num(args, "cy", 170), num(args, "r", 120))),
    },
  };
}

export function position(state: Json): unknown {
  const b = core().build({ X: state.X, Z: state.Z, D: state.D }) as Record<string, P> | null;
  if (!b) return { note: "The saved points do not give a pentagon." };
  const m = core().measure(core().corners(b)) as { ears: number[]; area: number; ratio: number };
  const equal = Math.max(...m.ears) - Math.min(...m.ears) < 1e-6 * m.ears[0];
  return { cornerTriangleAreas: m.ears, allEqual: equal, pentagonArea: m.area, areaOverOneTriangle: m.ratio, expected: core().AREA_RATIO, note: "Whatever X, Z and D are, the five triangles are equal and the pentagon is (5 + sqrt 5)/2 of one of them." };
}
