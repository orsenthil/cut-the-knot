/*
 * run_game_logic actions and saved-position reader for Counting Primes.
 * The core lives in prime-counting/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["prime-counting"].PrimeCountingCore;
const view = (a: Json) => ({
  x: a.x, primesUpToX: a.pi, gaussXOverLnX: a.xOverLn, li: a.li, Li: a.Li,
  errorOfLi: (a.pi as number) - (a.li as number), errorOfGauss: a.errorGauss,
  hypothesisAllowance: a.guaranteed ? a.allowance : null,
});

export function actions(): GameActions {
  return {
    count: {
      describe: "pi(x), Gauss's x / ln x, li(x) and the sqrt(x) ln(x) / (8 pi) error allowance the Riemann Hypothesis gives from x = 2657, for x up to 1,000,000.",
      args: '{ "x": 1000 }',
      run: (args) => view(core().at(num(args, "x", 1000))),
    },
  };
}

export function position(state: Json): unknown {
  const a = core().at(state.x);
  const within = a.guaranteed ? Math.abs((a.pi as number) - (a.li as number)) < (a.allowance as number) : null;
  return { ...view(a), view: state.view === "error" ? "error" : "count", errorWithinHypothesisBand: within };
}
