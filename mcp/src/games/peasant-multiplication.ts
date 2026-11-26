/*
 * run_game_logic actions and saved-position reader for Peasant Multiplication. The core lives in
 * peasant-multiplication/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["peasant-multiplication"].PeasantCore;

export function actions(): GameActions {
  return {
    multiply: {
      describe: "Peasant (halving and doubling) multiplication of a by b: the table of halves and doubles, the doubles beside odd halves and their sum, the binary digits of a, and how many rows the other order would need.",
      args: '{ "a": 85, "b": 18 }',
      run: (args) => {
        const a = core().clampNumber(num(args, "a"), 6), b = core().clampNumber(num(args, "b"), 6);
        const r = core().multiply(a, b);
        const swapped = core().multiply(b, a);
        return { a, b, rows: r.rows, added: r.parts, product: r.product, binaryOfA: core().binary(a), rowsNeeded: r.rows.length, rowsIfSwapped: swapped.rows.length, saferFirst: r.rows.length <= swapped.rows.length ? "a" : "b" };
      },
    },
  };
}

export function position(state: Json): unknown {
  const a = Number(state.a), b = Number(state.b);
  const r = core().multiply(a, b), swapped = core().multiply(b, a);
  return { a, b, product: r.product, added: r.parts, binaryOfA: core().binary(a), rows: r.rows.length, rowsIfSwapped: swapped.rows.length, binaryShown: state.binary === true, autonomousDigits: state.autonomous === true, note: "The odd halves are the binary digits of the first number, so the doubles beside them add up to the product. Putting the smaller number first needs no more rows." };
}
