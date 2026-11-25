/*
 * run_game_logic actions and saved-position reader for Two Circles, Two Points.
 * The core lives in two-circles-two-points/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["two-circles-two-points"].TwoCirclesCore;

export function actions(): GameActions {
  return {
    common_neighbours: {
      describe: "The points exactly 1 from both A and B (where two unit circles cross): never more than two.",
      args: '{ "ax": 0, "ay": 0, "bx": 1, "by": 0 }',
      run: (args) => {
        const m = core().commonNeighbours({ x: num(args, "ax"), y: num(args, "ay") }, { x: num(args, "bx"), y: num(args, "by") });
        return { count: m.length, points: m };
      },
    },
    pair_bound: {
      describe: "The ceiling on unit pairs among n points from counting cherries: n(1 + sqrt(8n - 7))/4, about n^1.5 / sqrt 2.",
      args: '{ "n": 9 }',
      run: (args) => { const n = core().clampN(num(args, "n", 9)); return { n, bound: core().edgeBound(n), wholeNumber: core().edgeLimit(n) }; },
    },
  };
}

export function position(state: Json): unknown {
  const a = state.a as Json, b = state.b as Json;
  const m = core().commonNeighbours({ x: Number(a.x), y: Number(a.y) }, { x: Number(b.x), y: Number(b.y) });
  const n = core().clampN(state.n);
  return {
    crossings: m.length, pairBoundForN: { n, atMost: core().edgeLimit(n) },
    note: "Two different unit circles cross in at most two places, which bounds the unit pairs by about n^1.5 / sqrt 2.",
  };
}
