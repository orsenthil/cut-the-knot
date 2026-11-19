/*
 * run_game_logic actions and saved-position reader for the Factor Tree.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["btree-testing"].BTreeTestingCore;

function readPosition(args: Json) {
  const C = core();
  const n = Math.trunc(num(args, "n", 108));
  return { n, count: Math.trunc(num(args, "count", 2)), root: C.makeRoot(n) };
}

export function actions(): GameActions {
  return {
    factor: {
      describe:
        "Factor a composite number into primes and show the closing sentence the applet prints when every box is filled.",
      args: '{ "n": 108 }',
      run: (args) => {
        const C = core();
        const n = Math.trunc(num(args, "n", 108));
        if (n < 4 || n > 100000) throw new Error("n must be a composite number from 4 to 100000");
        const primes = C.factorize(n);
        const product = primes.reduce((a, b) => a * b, 1);
        return {
          n,
          primes,
          product,
          correct: product === n,
          closingSentence: C.GOOD + primes.join(" · ") + " = " + n + "!",
          note: C.isPrime(n)
            ? "That number is prime; it would end a branch rather than grow a tree."
            : `Every branch ends in a prime, and the primes multiply back to ${n}.`,
        };
      },
    },
    valid_factors: {
      describe:
        "List the proper divisors of a number that the applet accepts for a box, with the cofactor it would put in the sibling box.",
      args: '{ "n": 36 }',
      run: (args) => {
        const C = core();
        const n = Math.trunc(num(args, "n", 36));
        const rows = [];
        for (let d = 2; d < n; d++) {
          if (n % d === 0) rows.push({ factor: d, cofactor: n / d, prime: C.isPrime(d) });
        }
        return {
          n,
          rows,
          note: "Any proper divisor over 1 is accepted; the sibling is filled with the cofactor automatically.",
        };
      },
    },
  };
}

/** What the core says about the tree currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const n = num(state, "n", NaN);
  if (!Number.isFinite(n)) return { note: "No problem has been generated yet; press New problem." };
  const here = readPosition(state);
  const primes = C.factorize(here.n);
  return {
    n: here.n,
    count: here.count,
    primes,
    product: primes.reduce((a, b) => a * b, 1),
    note: `The root is ${here.n}; its prime factors are ${primes.join(" · ")}.`,
  };
}
