/*
 * run_game_logic actions and saved-position reader for Koch's Snowflake. The
 * core lives in kochs-snowflake/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["kochs-snowflake"].KochCore;

export function actions(): GameActions {
  return {
    measure: {
      describe: "Segments, segment length, total length and area (as multiples of the triangle's side, and of its area) after round N of the construction (N = 1 is the triangle). Length 3(4/3)^(N-1) grows without bound; area 8/5 - (3/5)(4/9)^(N-1) tends to 8/5.",
      args: '{ "n": 5 }',
      run: (args) => {
        const n = Math.min(200, Math.max(1, Math.floor(num(args, "n"))));
        return { n, segments: n > 12 ? null : core().segments(n), segmentLength: core().segmentLength(n), totalLength: core().perimeter(n), areaOverTriangle: core().areaRatio(n), areaLimit: core().AREA_LIMIT };
      },
    },
  };
}

export function position(state: Json): unknown {
  const n = Number(state.n);
  return { n, iteration: n - 1, segments: core().segments(n), segmentLength: core().segmentLength(n), totalLength: core().perimeter(n), areaOverTriangle: core().areaRatio(n), note: "The outline's length multiplies by 4/3 every round and has no bound, but the area stays below 8/5 of the triangle." };
}
