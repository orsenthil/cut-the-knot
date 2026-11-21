/*
 * run_game_logic actions and saved-position reader for GCD and LCM by Plain Factorization.
 *
 * The gcd takes the smaller exponent of each prime, the lcm the larger, and since
 * min + max = a + b for every pair, gcd x lcm = M x N. Every answer comes from the
 * game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["factorization"].FactorizationCore;

/** A number, or a product typed with *, read the way the applet reads its text fields. */
function read(args: Json, key: string, fallback: string): number {
  const C = core();
  const v = C.parse(String(args[key] ?? fallback));
  if (v < 1) throw new Error(`"${key}" must be a whole number from 1 to 7,000,000,000, or a product such as 12*5*7`);
  return v;
}

export function actions(): GameActions {
  return {
    factor: {
      describe: "The prime factorization of a number up to 7,000,000,000 (or a product typed with *), in the applet's short (2^3 x 3) and long (2 x 2 x 2 x 3) forms.",
      args: '{ "n": "360" }',
      run: (args) => {
        const C = core();
        const n = read(args, "n", "360");
        return { n, primes: C.factor(n).map(([p, e]: number[]) => ({ prime: p, exponent: e })), short: C.show(n, true), long: C.show(n, false) };
      },
    },
    gcd_lcm: {
      describe: "The gcd and lcm of two numbers by factorization: both factorizations, the exponent of every prime in each number, which exponent the gcd (the smaller) and the lcm (the larger) takes, and the check gcd x lcm = M x N.",
      args: '{ "m": "360", "n": "84" }',
      run: (args) => {
        const C = core();
        const m = read(args, "m", "360"), n = read(args, "n", "84");
        const c = C.compare(m, n);
        return {
          m, n,
          factorizationOfM: C.show(m, true), factorizationOfN: C.show(n, true),
          exponents: c.rows,
          gcd: String(c.gcdBig), lcm: String(c.lcmBig),
          gcdFactorization: C.show(c.gcd, true), lcmFactorization: c.lcm !== null && c.lcm <= 7e9 ? C.show(c.lcm, true) : null,
          gcdTimesLcmEqualsProduct: c.gcdBig !== null && c.lcmBig !== null && c.gcdBig * c.lcmBig === BigInt(m) * BigInt(n),
        };
      },
    },
  };
}

/** What the core says about the two numbers as the page saved them. */
export function position(state: Json): unknown {
  const C = core();
  const n1 = num(state, "n1", 0), n2 = num(state, "n2", 0);
  const c = C.compare(n1, n2);
  return {
    numbers: [n1, n2],
    computed: state.computed === true,
    gcd: c.gcdBig === null ? null : String(c.gcdBig),
    lcm: c.lcmBig === null ? null : String(c.lcmBig),
    coprime: c.gcd === 1,
    sharedPrimes: c.rows.filter((r: { min: number }) => r.min > 0).map((r: { prime: number }) => r.prime),
    format: state.brief === false ? "long" : "short",
    moves: num(state, "moves", 0),
  };
}
