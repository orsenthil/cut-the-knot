/*
 * run_game_logic actions and saved-position reader for Huntington-Hill.
 * The core lives in huntington-hill-method/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["huntington-hill-method"].HuntingtonHillMethodCore;
function read(args: Json) {
  const seats = num(args, "seats", 23);
  const populations = numArray(args, "populations");
  if (!Number.isInteger(seats) || seats < 1 || !populations.length) throw new Error("invalid country");
  return { seats, states: populations.length, populations };
}

export function actions(): GameActions {
  return {
    apportion: {
      describe: "Allocate seats by the method of equal proportions, reporting each quota, geometric-mean cutoff and final count.",
      args: '{ "seats": 23, "populations": [100, 200, 300] }',
      run: (args) => {
        const C = core();
        const country = read(args);
        const r = C.analyze(country);
        return {
          seats: country.seats,
          divisor: r.divisor,
          rows: r.letters.map((letter: string, i: number) => ({ state: letter, population: country.populations[i], quota: r.quotas[i], cutoff: r.cutoffs[i], final: r.final[i] })),
          total: r.total,
          note: "A quota rounds up only past the geometric mean of its whole-number neighbours.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const country = read(state);
  const r = C.analyze(country);
  return { seats: country.seats, states: country.states, populations: country.populations, total: r.total, final: r.final, note: `${r.total} seats allocated.` };
}
