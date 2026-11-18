/*
 * run_game_logic actions and saved-position reader for Hamilton's method.
 * The core (hamilton-apportionment/ in the site, copied into
 * src/generated/cores/ at build time) knows the quotas, the surplus and the
 * paradoxes. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["hamilton-apportionment"].HamiltonApportionmentCore;

type Apportionment = {
  divisor: number; quotas: number[]; lower: number[]; leftover: number[];
  surplus: number; order: number[]; winners: number[]; final: number[];
};

function readState(args: Json): { seats: number; states: number; populations: number[] } {
  const C = core();
  const populations = numArray(args, "populations");
  const seats = num(args, "seats");
  if (!Number.isInteger(seats) || seats < C.MIN_SEATS || seats > C.MAX_SEATS) {
    throw new Error(`seats must be ${C.MIN_SEATS} to ${C.MAX_SEATS}`);
  }
  if (!populations.length || populations.length > C.MAX_STATES ||
      populations.some((p) => !Number.isInteger(p) || p < 0 || p > C.MAX_POP)) {
    throw new Error(`populations must be 1 to ${C.MAX_STATES} whole numbers from 0 to ${C.MAX_POP}`);
  }
  return { seats, states: populations.length, populations };
}

export function actions(): GameActions {
  return {
    apportion: {
      describe:
        "For a country, list the standard quota, lower quota, leftover, surplus seat and final allocation for each state, with the column totals.",
      args: '{ "seats": 23, "populations": [100, 200, 300] }',
      run: (args) => {
        const C = core();
        const country = readState(args);
        const a: Apportionment = C.apportion(country) as Apportionment;
        return {
          divisor: a.divisor,
          rows: a.final.map((final, i) => ({
            state: C.LETTERS[i],
            population: country.populations[i],
            quota: a.quotas[i],
            lower: a.lower[i],
            leftover: a.leftover[i],
            surplusSeat: a.winners.includes(i),
            final,
          })),
          surplus: a.surplus,
          totals: {
            lower: a.lower.reduce((x, y) => x + y, 0),
            final: a.final.reduce((x, y) => x + y, 0),
          },
          seats: country.seats,
          note: "Surplus seats go to the largest leftovers; ties go to the earliest state.",
        };
      },
    },
    check_paradox: {
      describe:
        "Compare two apportionments (more seats, changed populations, or an added state) and report whether a state's final count fell.",
      args: '{ "old": {"seats": 23, "populations": [100, 200, 300]}, "new": {"seats": 24, "populations": [100, 200, 300]} }',
      run: (args) => {
        const C = core();
        const before = readState(args.old as Json);
        const after = readState(args.new as Json);
        const a: number[] = (C.apportion(before) as Apportionment).final;
        const b: number[] = (C.apportion(after) as Apportionment).final;
        const losers = a.map((n, i) => (b[i] !== undefined && b[i] < n ? C.LETTERS[i] : null)).filter(Boolean);
        return {
          before: a,
          after: b,
          losers,
          paradox: losers.length > 0,
          note: losers.length
            ? "A state lost a seat — one of Hamilton's paradoxes."
            : "No state lost a seat in this comparison.",
        };
      },
    },
  };
}

/** What the core says about a saved country. */
export function position(state: Json): unknown {
  const C = core();
  const country = readState(state);
  const a: Apportionment = C.apportion(country) as Apportionment;
  return {
    seats: country.seats,
    states: country.states,
    populations: country.populations,
    divisor: a.divisor,
    surplus: a.surplus,
    surplusWinners: a.winners.map((i) => C.LETTERS[i]),
    final: a.final,
    finalTotal: a.final.reduce((x, y) => x + y, 0),
    note: `${a.surplus} surplus seat${a.surplus === 1 ? "" : "s"} to the largest leftovers.`,
  };
}
