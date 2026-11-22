/*
 * run_game_logic actions and saved-position reader for the Harmonic Series.
 * The core lives in harmonic-series/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["harmonic-series"].HarmonicSeriesCore;

export function actions(): GameActions {
  return {
    sum: {
      describe: "H(n) = 1 + 1/2 + ... + 1/n for n up to 1,000,000, with ln n + gamma and Oresme's lower bound 1 + floor(log2 n)/2.",
      args: '{ "n": 1000 }',
      run: (args) => {
        const a = core().at(num(args, "n", 100));
        return { n: a.n, sum: a.sum, lnNPlusGamma: a.approx, gap: a.gap, oresmeBound: a.oresmeBound };
      },
    },
    terms_to_pass: {
      describe: "The fewest terms n with H(n) greater than a target (null if a million terms are not enough).",
      args: '{ "target": 10 }',
      run: (args) => ({ target: num(args, "target"), terms: core().termsToPass(num(args, "target")) }),
    },
  };
}

export function position(state: Json): unknown {
  const a = core().at(state.n);
  return {
    n: a.n, sum: a.sum, lnNPlusGamma: a.approx, oresmeBound: a.oresmeBound,
    note: "The sum grows like ln n, so it never stops growing, but a million terms only reach 14.39.",
  };
}
