/*
 * run_game_logic actions and saved-position reader for Euler's Product.
 * The core lives in euler-product/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["euler-product"].EulerProductCore;
const view = (r: Json) => ({
  s: r.s, n: r.n, primesUsed: r.primeCount,
  sumOverAllNumbers: r.sum, productOverPrimes: r.product, zeta: r.limit,
});

export function actions(): GameActions {
  return {
    compare: {
      describe: "The sum of 1/k^s over k <= n, the product of 1/(1 - p^-s) over primes p <= n, and zeta(s) (null at s = 1, where both diverge). s from 1 to 4, n up to 2000.",
      args: '{ "s": 2, "n": 30 }',
      run: (args) => view(core().analyze({ s: num(args, "s", 2), n: num(args, "n", 30) })),
    },
    zeta_real: {
      describe: "zeta(s) for real s > 1 by Euler-Maclaurin summation.",
      args: '{ "s": 2 }',
      run: (args) => ({ s: num(args, "s"), zeta: core().zeta(num(args, "s")) }),
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze({ s: state.s, n: state.n });
  return {
    ...view(r),
    gapSum: r.limit === null ? null : r.limit - r.sum,
    gapProduct: r.limit === null ? null : r.limit - r.product,
    note: r.limit === null ? "At s = 1 neither the sum (harmonic series) nor the product over primes has a limit." : "Both the sum over all numbers and the product over primes rise towards zeta(s).",
  };
}
