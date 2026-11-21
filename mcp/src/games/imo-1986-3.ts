/*
 * run_game_logic actions and saved-position reader for IMO 1986 problem 3.
 * The core lives in imo-1986-3/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["imo-1986-3"].Imo1986_3Core;
function read(args: Json) {
  const values = numArray(args, "values");
  if (!core().isValid(values)) throw new Error("five integers with positive total are required");
  return values;
}

export function actions(): GameActions {
  return {
    step: {
      describe: "Apply the pentagon operation at a negative vertex and report the new numbers, steps and potential.",
      args: '{ "values": [4,-3,2,-1,5], "index": 1 }',
      run: (args) => {
        const C = core();
        const values = read(args);
        const index = Number(args.index) || 0;
        const before = C.potential(values);
        const next = C.step({ values, steps: 0, history: [] }, index);
        if (!next) return { legal: false, note: "That vertex is not negative." };
        return {
          legal: true, values: next.values, steps: next.steps,
          potentialBefore: before, potentialAfter: C.potential(next.values),
          total: next.values.reduce((a: number, b: number) => a + b, 0),
          note: "The potential falls by 2 times the negative value times the positive total.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const values = read(state);
  return { values, steps: Number(state.steps) || 0, potential: C.potential(values), negatives: C.negativeIndices(values), finished: C.finished(values), note: `Sum stays positive; f = ${C.potential(values)}.` };
}
