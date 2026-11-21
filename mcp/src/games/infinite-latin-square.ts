/*
 * run_game_logic actions and saved-position reader for Infinite Latin Squares.
 * The core lives in infinite-latin-square/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["infinite-latin-square"].InfiniteLatinSquareCore;

export function actions(): GameActions {
  return {
    corner: {
      describe: "Generate the 2^n corner of the infinite Latin square (entry i XOR j), optionally coloured modulo m.",
      args: '{ "level": 3, "modulus": 0 }',
      run: (args) => {
        const C = core();
        const level = num(args, "level", 3);
        const modulus = Number.isFinite(args.modulus) ? num(args, "modulus") : 0;
        const rows = C.square(level, modulus);
        return {
          level, side: rows.length,
          latin: C.isLatin(rows),
          rows,
          note: "The entry at row i, column j is i XOR j; every finite corner is a Latin square.",
        };
      },
    },
    entry: {
      describe: "Look up one entry of the infinite Latin square at row i and column j.",
      args: '{ "i": 3, "j": 5 }',
      run: (args) => {
        const C = core();
        const i = num(args, "i", 0);
        const j = num(args, "j", 0);
        return { i, j, value: C.value(i, j), note: "The value is i XOR j (bitwise exclusive or)." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const level = num(state, "level", 3);
  const modulus = Number.isFinite(state.modulus) ? num(state, "modulus") : 0;
  const rows = C.square(level, modulus);
  return {
    level, modulus, side: rows.length, latin: C.isLatin(rows),
    note: `The ${rows.length} by ${rows.length} corner is Latin.`,
  };
}
