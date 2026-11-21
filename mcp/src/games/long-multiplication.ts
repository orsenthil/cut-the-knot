/*
 * run_game_logic actions and saved-position reader for Long Multiplication.
 * The core lives in long-multiplication/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["long-multiplication"].LongMultiplicationCore;
function read(args: Json) {
  return {
    a: Number.isFinite(args.a) ? num(args, "a") : 23,
    b: Number.isFinite(args.b) ? num(args, "b") : 761,
    compact: args.compact !== false,
  };
}

export function actions(): GameActions {
  return {
    multiply: {
      describe: "Lay out the partial products of long multiplication and add them.",
      args: '{ "a": 23, "b": 761, "compact": true }',
      run: (args) => {
        const r = core().analyze(read(args));
        return {
          a: r.a, b: r.b, compact: r.compact,
          rows: r.rows.map((row: { digit: number; place: number; value: number }) => ({
            digit: row.digit, place: row.place, value: row.value,
          })),
          sum: r.sum, product: r.product, correct: r.correct,
          note: "Each row is the first factor times one digit, shifted by its place value.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(read(state));
  return {
    a: r.a, b: r.b, compact: r.compact,
    partials: r.rows.map((row: { value: number }) => row.value),
    sum: r.sum, correct: r.correct,
    note: `${r.a} times ${r.b} is ${r.sum}.`,
  };
}
