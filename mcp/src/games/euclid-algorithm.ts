/*
 * run_game_logic actions and saved-position reader for Euclid's Algorithm.
 *
 * N = M s + R gives gcd(N, M) = gcd(M, R); the remainders decrease to 0 and the last
 * divisor is the gcd. Lame: never more than 5 steps per digit of the smaller number.
 * Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["euclid-algorithm"].EuclidAlgorithmCore;

export function actions(): GameActions {
  return {
    gcd: {
      describe: "Euclid's algorithm on two numbers (0 to 9999): every division step N = M x q + R, the number of steps, and the gcd (null when a number is 0). Also Lame's bound on the number of steps.",
      args: '{ "a": 85, "b": 18 }',
      run: (args) => {
        const C = core();
        const a = Math.trunc(num(args, "a", 85)), b = Math.trunc(num(args, "b", 18));
        if (a < 0 || b < 0 || a > 9999 || b > 9999) throw new Error("numbers run from 0 to 9999");
        const t = C.steps(a, b);
        return {
          larger: t.big, smaller: t.small,
          steps: t.steps.map((x: { n: number; m: number; q: number; r: number }) => ({ division: `${x.n} = ${x.m} x ${x.q}${x.r ? ` + ${x.r}` : ""}`, remainder: x.r })),
          stepCount: t.steps.length,
          gcd: t.gcd,
          lameBound: t.small > 0 ? 5 * String(t.small).length : null,
          lines: C.lines({ a, b }),
        };
      },
    },
    worst_case: {
      describe: "The pair of numbers up to a limit (at most 9999) that makes Euclid's algorithm take the most steps: consecutive Fibonacci numbers.",
      args: '{ "limit": 1000 }',
      run: (args) => {
        const C = core();
        const limit = Math.max(2, Math.min(9999, Math.trunc(num(args, "limit", 1000))));
        const F = [1, 2];
        while (F[F.length - 1] + F[F.length - 2] <= limit) F.push(F[F.length - 1] + F[F.length - 2]);
        const a = F[F.length - 1], b = F[F.length - 2];
        const t = C.steps(a, b);
        return { limit, pair: [a, b], steps: t.steps.length, gcd: t.gcd, allQuotients: t.steps.map((x: { q: number }) => x.q), why: "every quotient is 1, so the remainders shrink as slowly as they can" };
      },
    },
  };
}

/** What the core says about the two numbers as the page saved them. */
export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ digits: num(state, "digits", 2), a: num(state, "a", 1), b: num(state, "b", 1) });
  const t = C.steps(s.a, s.b);
  return {
    numbers: [s.a, s.b],
    gcd: t.gcd,
    steps: t.steps.length,
    coprime: t.gcd === 1,
    autonomousDigits: state.autonomous !== false,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
