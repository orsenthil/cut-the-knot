/*
 * run_game_logic actions and saved-position reader for the five apportionment
 * methods. The core (apportionment-methods/ in the site, copied into
 * src/generated/cores/ at build time) knows all five methods. See _shared.ts
 * for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["apportionment-methods"].ApportionmentMethodsCore;

function readCountry(args: Json) {
  const C = core();
  const seats = num(args, "seats");
  const populations = numArray(args, "populations");
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
    compare_methods: {
      describe:
        "For a country, show the seat allocation of all five apportionment methods side by side, with each column's total.",
      args: '{ "seats": 23, "populations": [100, 200, 300] }',
      run: (args) => {
        const C = core();
        const country = readCountry(args);
        const rows = C.METHODS.map((method) => {
          const r = C.apportion(country, method);
          return {
            method,
            divisor: r.divisor,
            seats: r.final,
            total: r.final.reduce((a: number, b: number) => a + b, 0),
            surplus: r.surplus,
          };
        });
        return {
          seats: country.seats,
          states: country.states,
          standardDivisor: C.standardDivisor(country),
          rows,
          note: "Every method allocates exactly the number of seats; the allocations can differ.",
        };
      },
    },
    method_detail: {
      describe:
        "For one method, show each state's standard quota and final allocation, with the priority rule that decides each seat.",
      args: '{ "seats": 23, "populations": [100, 200, 300], "method": "hamilton" }',
      run: (args) => {
        const C = core();
        const country = readCountry(args);
        const method = typeof args.method === "string" ? args.method : "hamilton";
        if (!C.METHODS.includes(method)) throw new Error(`method must be one of ${C.METHODS.join(", ")}`);
        const r = C.apportion(country, method);
        return {
          method,
          divisor: r.divisor,
          rows: country.populations.map((pop: number, i: number) => ({
            state: C.LETTERS[i],
            population: pop,
            quota: r.quotas[i],
            final: r.final[i],
          })),
          note: method === "hamilton"
            ? "Largest fractional parts receive the surplus seats."
            : "Seats go one at a time to the state with the largest priority.",
        };
      },
    },
  };
}

/** What the core says about a saved country. */
export function position(state: Json): unknown {
  const C = core();
  const country = readCountry(state);
  const method = typeof state.method === "string" && C.METHODS.includes(state.method) ? state.method : "hamilton";
  const allocations: Record<string, number[]> = {};
  for (const m of C.METHODS) allocations[m] = C.apportion(country, m).final;
  return {
    seats: country.seats,
    states: country.states,
    populations: country.populations,
    method,
    standardDivisor: C.standardDivisor(country),
    allocations,
    note: `Five ways to share ${country.seats} seats among ${country.states} states.`,
  };
}
