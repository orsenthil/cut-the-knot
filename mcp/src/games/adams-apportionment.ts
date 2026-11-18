/*
 * run_game_logic actions and saved-position reader for Adams' method.
 *
 * The core (adams-apportionment/ in the site, copied into src/generated/cores/
 * at build time) knows the quotas and the divisor search. See _shared.ts for
 * the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["adams-apportionment"].AdamsApportionmentCore;

type Quota = { population: number; standard: number; lower: number; modified: number; upward: number };

function readState(args: Json): { seats: number; states: number; populations: number[]; divisor: number | null } {
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
  const states = Number.isFinite(args.states) ? num(args, "states") : populations.length;
  if (states !== populations.length) throw new Error("states must match the population count");
  const divisor = Number.isFinite(args.divisor) ? num(args, "divisor") : null;
  return { seats, states, populations, divisor };
}

export function actions(): GameActions {
  return {
    find_divisor: {
      describe:
        "Search for the smallest divisor at which Adams' upward quotas add to exactly the number of seats, or report that no divisor fits.",
      args: '{ "seats": 23, "populations": [100, 200, 300] }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const divisor = C.findDivisor(state);
        return {
          seats: state.seats,
          populations: state.populations,
          standardDivisor: C.standardDivisor(state),
          divisor,
          upwardTotal: divisor === null ? null : C.sumOf(state, divisor),
          fits: divisor !== null,
          note: divisor === null
            ? "The upward total jumps over the seat count; Adams' method fails for these numbers."
            : "Upward quotas add to exactly the number of seats.",
        };
      },
    },
    quota_columns: {
      describe:
        "For a country and a divisor, list each state's standard, lower, modified and upward quotas, with the column totals.",
      args: '{ "seats": 23, "populations": [100, 200, 300], "divisor": 26.09 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const divisor = state.divisor ?? C.findDivisor(state) ?? C.standardDivisor(state);
        const rows: Quota[] = C.quotas(state, divisor) as Quota[];
        return {
          divisor,
          standardDivisor: C.standardDivisor(state),
          rows: rows.map((q, i) => ({ state: C.LETTERS[i], ...q })),
          totals: {
            population: C.total(state),
            lower: rows.reduce((a, q) => a + q.lower, 0),
            upward: rows.reduce((a, q) => a + q.upward, 0),
          },
          seats: state.seats,
          fits: rows.reduce((a, q) => a + q.upward, 0) === state.seats,
          note: "Lower Q uses the standard divisor; Upward Q uses the modified one.",
        };
      },
    },
  };
}

/** What the core says about a saved board. */
export function position(state: Json): unknown {
  const C = core();
  const board = readState(state);
  const divisor = board.divisor ?? C.findDivisor(board) ?? C.standardDivisor(board);
  const rows: Quota[] = C.quotas(board, divisor) as Quota[];
  return {
    seats: board.seats,
    states: board.states,
    populations: board.populations,
    totalPopulation: C.total(board),
    standardDivisor: C.standardDivisor(board),
    divisor,
    upwardTotal: rows.reduce((a, q) => a + q.upward, 0),
    lowerTotal: rows.reduce((a, q) => a + q.lower, 0),
    fits: rows.reduce((a, q) => a + q.upward, 0) === board.seats,
    note: rows.reduce((a, q) => a + q.upward, 0) === board.seats
      ? "This divisor apportions exactly the number of seats."
      : "Adjust the divisor until the upward quotas fit.",
  };
}
