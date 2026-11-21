/*
 * run_game_logic actions and saved-position reader for Horner's Method.
 * The core lives in horner-method/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["horner-method"].HornerMethodCore;
function read(args: Json) {
  const coefficients = numArray(args, "coefficients");
  if (!coefficients.length) throw new Error("coefficients must not be empty");
  return { coefficients, t: num(args, "t", 2) };
}

export function actions(): GameActions {
  return {
    evaluate: {
      describe: "Evaluate a polynomial at x = t by Horner's scheme, returning the row, value, quotient, remainder and derivative.",
      args: '{ "coefficients": [2,-3,0,1,7], "t": 2 }',
      run: (args) => {
        const r = core().analyze(read(args));
        return {
          coefficients: r.coefficients, t: r.t,
          row: r.rows, value: r.value, quotient: r.quotient,
          remainder: r.remainder, derivative: r.derivative,
          note: "The last row entry is P(t); a second pass on the quotient gives P'(t).",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(read(state));
  return { coefficients: r.coefficients, t: r.t, value: r.value, derivative: r.derivative, note: `P(${r.t}) = ${r.value}` };
}
