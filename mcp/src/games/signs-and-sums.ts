/*
 * run_game_logic actions and saved-position reader for Signs and Sums in a
 * Sequence. The core lives in signs-and-sums/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["signs-and-sums"].SignsAndSumsCore;

export function actions(): GameActions {
  return {
    construct: {
      describe: "A row of n numbers in which every three neighbours add up to more than 0 but the total is negative, or null when n is a multiple of 3 (then none exists). Built with the period-three argument: a + b + c = 1, total -1.",
      args: '{ "n": 8 }',
      run: (args) => {
        const n = Math.floor(num(args, "n"));
        const row = core().construct(n) as { values: number[] } | null;
        if (!row) return { n, possible: false, why: n % 3 === 0 ? "The row splits into triples, each positive, so the total is positive." : "n must be at least 4." };
        return { n, possible: true, values: row.values, tripleSums: core().tripleSums(row.values), total: core().total(row.values) };
      },
    },
    check_row: {
      describe: "The sums of every three neighbours and the total for a row of numbers, and whether it is the puzzle's goal (all triples positive, total negative).",
      args: '{ "values": [-4, 3, 3, -4] }',
      run: (args) => {
        const values = (args.values as unknown[]).map(Number);
        const state = { n: values.length, values };
        return { tripleSums: core().tripleSums(values), total: core().total(values), allTriplesPositive: core().allTriplesPositive(values), solved: core().solved(state) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const values = (state.values as number[]) ?? [];
  const n = Number(state.n);
  return {
    n, values, tripleSums: core().tripleSums(values), total: core().total(values),
    solved: core().solved({ n, values }),
    canBeSolvedAtThisLength: n % 3 !== 0,
    note: n % 3 === 0 ? "With a length that is a multiple of 3 the row splits into triples, so a negative total is impossible." : "This length allows a negative total: try a period-three row.",
  };
}
