/*
 * run_game_logic actions and saved-position reader for Sums of Two Squares.
 * The core lives in sums-of-two-squares/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["sums-of-two-squares"].TwoSquaresCore;

export function actions(): GameActions {
  return {
    r2: {
      describe: "r2(n): the integer points on the circle a^2 + b^2 = n (n up to 1200), counted by brute force and by Jacobi's 4(d1 - d3), with the ways and the factorisation.",
      args: '{ "n": 65 }',
      run: (args) => {
        const n = core().clampN(num(args, "n", 25));
        return { n, r2: core().r2Brute(n), jacobi: core().r2Formula(n), ways: core().ways(n), factorisation: core().factor(n) };
      },
    },
    records: {
      describe: "The n up to a limit (at most 1200) whose r2 is a new record, with r2: 1, 5, 25, 65, 325, 1105.",
      args: '{ "limit": 1200 }',
      run: (args) => ({ records: core().records(Math.min(1200, num(args, "limit", 1200))) }),
    },
  };
}

export function position(state: Json): unknown {
  const n = core().clampN(state.n);
  return {
    n, r2: core().r2Brute(n), ways: core().ways(n), factorisation: core().factor(n),
    note: "r2(n) is the number of unit neighbours each point has on a grid of spacing 1/sqrt(n): Erdos's construction.",
  };
}
