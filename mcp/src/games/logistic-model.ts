/*
 * run_game_logic actions and saved-position reader for the Logistic Model.
 * The core lives in logistic-model/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["logistic-model"].LogisticModelCore;
function read(args: Json) {
  return {
    r: Number.isFinite(args.r) ? num(args, "r") : 3.2,
    p0: Number.isFinite(args.p0) ? num(args, "p0") : 0.25,
    iterations: Number.isFinite(args.iterations) ? num(args, "iterations") : 120,
  };
}

export function actions(): GameActions {
  return {
    orbit: {
      describe: "Compute the orbit of the logistic map and detect its eventual period.",
      args: '{ "r": 3.2, "p0": 0.25, "iterations": 120 }',
      run: (args) => {
        const r = core().analyze(read(args));
        return {
          r: r.r, p0: r.p0, values: r.values.slice(0, 20),
          last: r.last, period: r.period, inInterval: r.inInterval,
          lyapunov: r.lyapunov,
          note: "p(n+1) = r p(n)(1-p(n)); the interval [0,1] maps into itself for r in [0,4].",
        };
      },
    },
    next: {
      describe: "Apply one logistic step.",
      args: '{ "r": 2, "p": 0.25 }',
      run: (args) => {
        const r = Number.isFinite(args.r) ? num(args, "r") : 2;
        const p = Number.isFinite(args.p) ? num(args, "p") : 0.25;
        return { r, p, next: core().next(r, p), note: "r times p times (1 minus p)." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(read(state));
  return {
    r: r.r, p0: r.p0, iterations: r.iterations,
    last: r.last, period: r.period, lyapunov: r.lyapunov,
    inInterval: r.inInterval,
    note: r.period ? `The orbit repeats with period ${r.period}.` : "No short cycle detected.",
  };
}
