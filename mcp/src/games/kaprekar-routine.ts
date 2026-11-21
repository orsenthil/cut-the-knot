/*
 * run_game_logic actions and saved-position reader for Kaprekar's routine.
 * The core lives in kaprekar-routine/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["kaprekar-routine"].KaprekarRoutineCore;
function read(args: Json) {
  return {
    start: Number.isFinite(args.start) ? num(args, "start") : 3524,
    base: Number.isFinite(args.base) ? num(args, "base") : 10,
    width: Number.isFinite(args.width) ? num(args, "width") : 4,
    padded: args.padded !== false,
  };
}

export function actions(): GameActions {
  return {
    iterate: {
      describe: "Run Kaprekar's digit-sorting subtraction until a fixed point or zero.",
      args: '{ "start": 3524, "base": 10, "width": 4, "padded": true }',
      run: (args) => {
        const C = core();
        const state = read(args);
        const r = C.iterate(state.start, state.base, state.width, state.padded);
        return {
          start: state.start, steps: r.steps, result: r.result,
          count: r.count, fixed: r.fixed, zero: r.zero,
          note: "Padding short differences with zeros makes the decimal four-digit constant 6174.",
        };
      },
    },
    constant: {
      describe: "Find the unique Kaprekar constant for a base and digit width, if one exists.",
      args: '{ "base": 10, "width": 4 }',
      run: (args) => {
        const C = core();
        const base = Number.isFinite(args.base) ? num(args, "base") : 10;
        const width = Number.isFinite(args.width) ? num(args, "width") : 4;
        return { base, width, constant: C.constant(base, width), note: "Null means the starts do not share one fixed point." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const input = read(state);
  const r = C.analyze(input);
  return {
    start: input.start, base: input.base, width: input.width, padded: input.padded,
    result: r.result.result, count: r.result.count,
    fixed: r.result.fixed, zero: r.result.zero,
    note: `Reached ${r.result.result} in ${r.result.count} steps.`,
  };
}
