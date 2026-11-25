/*
 * run_game_logic actions and saved-position reader for Napier's Bones in Various Bases.
 * The core lives in napier-bones/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["napier-bones"].NapierCore;

export function actions(): GameActions {
  return {
    multiply_with_bones: {
      describe: "Multiply a number (given in base 10) by k (1..B-1) with Napier's bones in a base B from 3 to 20: the cells of row k, the diagonal sums with carries and the product written in base B.",
      args: '{ "number": 187, "base": 10, "k": 3 }',
      run: (args) => {
        const base = core().clampBase(num(args, "base", 10)), number = Math.floor(num(args, "number", 187)), k = Math.floor(num(args, "k", 3));
        if (number < 0 || core().toString(number, base).length > core().MAX_DIGITS) throw new Error(`the number must have at most ${core().MAX_DIGITS} digits in base ${base}`);
        const m = core().multiply({ base, number }, k);
        if (!m) throw new Error(`k must be 1..${base - 1}`);
        return { base, numberInBase: core().toString(number, base), k, diagonalSums: m.diagonals.map((d: { sum: number }) => d.sum), product: m.text, productInBase10: m.value };
      },
    },
  };
}

export function position(state: Json): unknown {
  const base = core().clampBase(state.base), number = Math.floor(Number(state.number)), k = Math.floor(Number(state.multiplier));
  const m = core().multiply({ base, number }, Math.min(Math.max(k, 1), base - 1));
  return { base, numberInBase: core().toString(number, base), multiplier: k, product: m ? m.text : null, note: "Each diagonal of the laid-out bones adds the units of one cell and the tens of the next: this is long multiplication with the carrying delayed to the end." };
}
