/*
 * run_game_logic actions and saved-position reader for Counting Triangles. The
 * core lives in counting-triangles/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["counting-triangles"].TrianglesCore;

export function actions(): GameActions {
  return {
    counts: {
      describe: "How many triangles there are for N parts on a side: those that always stay, those that fade, those that come in, the total in the triangle picture and in the square picture (both N^2), and the strips of 1, 3, 5, ..., 2N - 1.",
      args: '{ "n": 5 }',
      run: (args) => {
        const n = Math.min(60, Math.max(1, Math.floor(num(args, "n"))));
        return { n, ...(core().counts(n) as Json), totals: core().totals(n), stripSizes: core().stripSizes(n), sumOfOddNumbers: core().oddSum(n) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const n = Number(state.n), alpha = Number(state.alpha);
  return {
    n, slider: alpha === 256 ? "triangle" : alpha === 0 ? "square" : "in between",
    counts: core().counts(n), totals: core().totals(n),
    note: "At both ends there are N^2 green triangles: N(N+1)/2 + N(N-1)/2 for the triangle, one in each small square for the square.",
  };
}
