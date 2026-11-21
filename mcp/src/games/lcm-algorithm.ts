/*
 * run_game_logic actions and saved-position reader for the LCM algorithm.
 * The core lives in lcm-algorithm/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["lcm-algorithm"].LcmAlgorithmCore;
function read(args: Json) {
  const originals = Array.isArray(args.originals) ? args.originals.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  const values = Array.isArray(args.values) ? args.values.map(Number) : originals;
  if (originals.length < 2) throw new Error("at least two positive numbers are needed");
  return {
    originals, values,
    steps: Number.isFinite(args.steps) ? Number(args.steps) : 0,
    history: Array.isArray(args.history) ? args.history as Json[] : [],
  };
}

export function actions(): GameActions {
  return {
    lcm: {
      describe: "Compute the LCM directly from the numbers using the gcd formula.",
      args: '{ "numbers": [6,10,15] }',
      run: (args) => {
        const numbers = numArray(args, "numbers");
        if (numbers.length < 1) throw new Error("numbers must not be empty");
        return { numbers, lcm: core().directLcm(numbers), note: "lcm(a,b) = a/gcd(a,b)*b" };
      },
    },
    run: {
      describe: "Run the smallest-raising algorithm until all values match.",
      args: '{ "originals": [6,10,15] }',
      run: (args) => {
        const C = core();
        const result = C.run(C.start(read(args).originals));
        return {
          values: result.values, steps: result.steps,
          lcm: C.directLcm(result.originals),
          note: "Each step raises the smallest value by its original number.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const r = C.analyze(read(state));
  return {
    originals: r.originals, values: r.values, steps: r.steps,
    finished: r.finished, lcm: r.lcm,
    note: r.finished ? `All values reached ${r.current}.` : `Target ${r.lcm}.`,
  };
}
