/*
 * run_game_logic actions and saved-position reader for the Basel Problem.
 * The core lives in basel-problem/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["basel-problem"].BaselProblemCore;

export function actions(): GameActions {
  return {
    sum: {
      describe: "S(n) = 1 + 1/4 + ... + 1/n^2 (n up to 100,000), pi^2/6, the error, n times the error (tends to 1) and the sharper S(n) + 1/(n + 1/2).",
      args: '{ "n": 100 }',
      run: (args) => core().at(num(args, "n", 10)),
    },
    even_zeta: {
      describe: "zeta(2k) for k = 1..6 from Bernoulli numbers: a rational multiple of pi^(2k).",
      args: '{ "k": 2 }',
      run: (args) => ({ k: num(args, "k"), zeta: core().zetaEven(Math.floor(num(args, "k"))) }),
    },
  };
}

export function position(state: Json): unknown {
  const a = core().at(state.n);
  return {
    n: a.n, sum: a.sum, limit: a.target, error: a.error, nTimesError: a.errorTimesN,
    correctedSum: a.corrected, correctedError: a.correctedError,
    note: "The sum converges to pi^2/6; the tail after n terms is about 1/n.",
  };
}
