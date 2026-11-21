/*
 * run_game_logic actions and saved-position reader for Jefferson's
 * apportionment method. The core lives in jefferson-apportionment/ and is
 * copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["jefferson-apportionment"].JeffersonApportionmentCore;
function read(args: Json) {
  const seats = num(args, "seats", 23);
  const populations = numArray(args, "populations");
  if (!Number.isInteger(seats) || seats < 1 || !populations.length) throw new Error("invalid country");
  return { seats, states: populations.length, populations };
}

export function actions(): GameActions {
  return {
    apportion: {
      describe: "Allocate seats by Jefferson's method: round every quota down after lowering the divisor.",
      args: '{ "seats": 23, "populations": [100, 200, 300] }',
      run: (args) => {
        const C = core();
        const country = read(args);
        const r = C.analyze(country);
        return {
          seats: country.seats,
          divisor: r.divisor,
          rows: r.letters.map((letter: string, i: number) => ({
            state: letter, population: country.populations[i],
            quota: r.quotas[i], floored: r.lower[i], final: r.final[i],
          })),
          total: r.total,
          note: "The D'Hondt priority pop/(seats+1) gives the same allocation.",
        };
      },
    },
    priority: {
      describe: "Report each state's D'Hondt priority for its next seat.",
      args: '{ "populations": [100, 200, 300] }',
      run: (args) => {
        const C = core();
        const populations = numArray(args, "populations");
        const country = read({ ...args, seats: 1, populations });
        const r = C.analyze(country);
        return { priorities: populations.map((p, i) => p / (r.final[i] + 1)), note: "The largest priority gets the next seat." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const country = read(state);
  const r = C.analyze(country);
  return {
    seats: country.seats, states: country.states, populations: country.populations,
    divisor: r.divisor, final: r.final, total: r.total,
    note: `${r.total} seats allocated.`,
  };
}
