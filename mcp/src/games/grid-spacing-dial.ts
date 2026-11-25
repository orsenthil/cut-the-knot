/*
 * run_game_logic actions and saved-position reader for the Grid Spacing Dial.
 * The core lives in grid-spacing-dial/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["grid-spacing-dial"].GridDialCore;

export function actions(): GameActions {
  return {
    count: {
      describe: "Unit pairs in a k by k grid at spacing 1/sqrt(c2) (k 3..24): sum of (k-|a|)(k-|b|) over a^2 + b^2 = c2, halved. 16 by 16: c2 = 25 gives 976, c2 = 65 gives 912.",
      args: '{ "k": 16, "c2": 25 }',
      run: (args) => {
        const k = core().clampK(num(args, "k", 16)), c2 = core().clampC2(k, num(args, "c2", 25));
        return { k, c2, pairs: core().count(k, c2), offsets: core().vectors(k, c2).length };
      },
    },
    best: {
      describe: "The c2 that gives a k by k grid the most unit pairs, and that count.",
      args: '{ "k": 16 }',
      run: (args) => { const k = core().clampK(num(args, "k", 16)); return { k, ...core().best(k) }; },
    },
  };
}

export function position(state: Json): unknown {
  const k = core().clampK(state.k), c2 = core().clampC2(k, state.c2), b = core().best(k);
  const n = core().count(k, c2);
  return {
    k, c2, spacing: 1 / Math.sqrt(c2), pairs: n, best: b, atTheBest: n === b.count,
    note: "More ways to write c2 as a sum of two squares give more neighbours, but offsets that are too long fall off the edge.",
  };
}
