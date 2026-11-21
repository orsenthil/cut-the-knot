/*
 * run_game_logic actions and saved-position reader for Sums and Products
 * Invariant. The core lives in sums-products-invariant/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { numArray, num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["sums-products-invariant"].SumsProductsInvariantCore;
function read(args: Json) {
  const values = numArray(args, "values");
  if (values.length < 2) throw new Error("at least two values are needed");
  return {
    values,
    count: Number.isFinite(args.count) ? num(args, "count") : values.length,
    max: Number.isFinite(args.max) ? num(args, "max") : 8,
    original: Array.isArray(args.original) ? args.original.map(Number) : values.slice(),
    steps: Array.isArray(args.steps) ? args.steps as Json[] : [],
  };
}

export function actions(): GameActions {
  return {
    invariant: {
      describe: "Compute the invariant product of (each value plus one), minus one.",
      args: '{ "values": [1,2,3,4,5,6] }',
      run: (args) => {
        const C = core();
        const values = numArray(args, "values");
        if (!values.length) throw new Error("values must not be empty");
        return { values, invariant: C.invariant(values), note: "P = product(A_i + 1) - 1 never changes." };
      },
    },
    combine: {
      describe: "Replace two values by A*B + A + B and check that the invariant is unchanged.",
      args: '{ "values": [2,3,4], "i": 0, "j": 1 }',
      run: (args) => {
        const C = core();
        const values = numArray(args, "values");
        const i = num(args, "i", 0);
        const j = num(args, "j", 1);
        const before = C.invariant(values);
        const next = C.combine({ values, original: values.slice(), steps: [] }, i, j);
        return {
          before, after: C.invariant(next.values),
          values: next.values, step: next.steps[next.steps.length - 1] || null,
          unchanged: before === C.invariant(next.values),
          note: "A*B + A + B = (A+1)(B+1) - 1, so the product is preserved.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const r = C.analyze(read(state));
  return {
    values: r.values, remaining: r.remaining, invariant: r.invariant,
    initialInvariant: r.initialInvariant, finished: r.finished,
    note: `The final number will be ${r.initialInvariant}.`,
  };
}
