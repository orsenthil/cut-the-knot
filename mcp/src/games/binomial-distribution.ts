/*
 * run_game_logic actions and saved-position reader for Binomial Distribution.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["binomial-distribution"].BinomialDistributionCore;

function options(args: Json) {
  const C = core();
  return C.clampOptions({ p: num(args, "p", C.DEFAULTS.p), n: num(args, "n", C.DEFAULTS.n) });
}

export function actions(): GameActions {
  return {
    probabilities: {
      describe:
        "For n trials and success probability p, give every binomial probability b(k), the most likely k and the average, and check the page's formula.",
      args: '{ "p": 0.5, "n": 10 }',
      run: (args) => {
        const C = core();
        const { p, n } = options(args);
        const d = C.distribution(p, n);
        return {
          p, n,
          probabilities: d,
          total: C.total(p, n),
          mode: C.mode(p, n),
          modes: C.modes(p, n),
          mean: C.expectedValue(p, n),
          selected: num(args, "k", C.mode(p, n)),
          note: `The bars add to ${C.total(p, n).toFixed(12)}; the average is np = ${C.expectedValue(p, n)}.`,
        };
      },
    },
    mode_versus_mean: {
      describe:
        "Compare the most likely number of successes with the average, and check the page's claim that they are never equal.",
      args: '{ "p": 0.5, "n": 10 }',
      run: (args) => {
        const C = core();
        const { p, n } = options(args);
        const m = C.mode(p, n);
        const mean = C.expectedValue(p, n);
        return {
          p, n,
          mostLikely: m,
          average: mean,
          equal: m === mean,
          claimAlwaysDifferent: false,
          note: m === mean
            ? `Here the most likely value equals the average (${m}). The page's claim that they always differ is false.`
            : `Here they differ (${m} versus ${mean}), but n=10, p=0.5 is a counterexample to the page's "always".`,
        };
      },
    },
  };
}

/** What the core says about the chart currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const { p, n } = options(state);
  const k = Math.max(0, Math.min(n, Math.trunc(num(state, "k", C.mode(p, n)))));
  return {
    p, n, k,
    probabilityAtK: C.pmf(p, n, k),
    mode: C.mode(p, n),
    modes: C.modes(p, n),
    mean: C.expectedValue(p, n),
    total: C.total(p, n),
    explored: state.explored === true,
    note: `With ${n} trials at p = ${p}, the most likely count is ${C.mode(p, n)}; bar ${k} has probability ${C.pmf(p, n, k).toFixed(6)}.`,
  };
}
