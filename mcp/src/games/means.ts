/*
 * run_game_logic actions and saved-position reader for The Means.
 * The core lives in means/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["means"].MeansCore;

const values = (args: Json): number[] => {
  const v = args.values;
  if (!Array.isArray(v) || v.length < 1) throw new Error('"values" must be a list of positive numbers');
  return v.map((x, i) => { const n = Number(x); if (!(n > 0)) throw new Error(`values[${i}] must be positive`); return n; });
};

export function actions(): GameActions {
  return {
    mean: {
      describe: "The power mean M_r of positive numbers: ((sum of a^r) / n)^(1/r), the geometric mean at r = 0. r = 1 arithmetic, -1 harmonic, 2 quadratic. Never decreases as r grows.",
      args: '{ "values": [20, 30], "r": -1 }',
      run: (args) => { const v = values(args), r = Math.round(num(args, "r", 1)); return { r, name: core().nameOf(r), mean: core().mean(v, r) }; },
    },
    all_means: {
      describe: "The harmonic, geometric, arithmetic and quadratic means of positive numbers, with the smallest and largest, showing H <= G <= A <= Q.",
      args: '{ "values": [20, 30] }',
      run: (args) => {
        const v = values(args);
        return { harmonic: core().mean(v, -1), geometric: core().mean(v, 0), arithmetic: core().mean(v, 1), quadratic: core().mean(v, 2), smallest: Math.min(...v), largest: Math.max(...v) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const v = (state.values as number[]).map(Number), r = Math.round(Number(state.r));
  return {
    n: v.length, r, nameOfThisMean: core().nameOf(r), mean: core().mean(v, r),
    harmonic: core().mean(v, -1), geometric: core().mean(v, 0), arithmetic: core().mean(v, 1), smallest: Math.min(...v), largest: Math.max(...v),
    note: "M_r rises with r from the smallest number (r very negative) to the largest; all are equal only when all numbers are equal.",
  };
}
