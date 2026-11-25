/*
 * run_game_logic actions and saved-position reader for Modular Arithmetic Tables.
 * The core lives in modular-tables/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["modular-tables"].ModularCore;

export function actions(): GameActions {
  return {
    table: {
      describe: "The table of an operation mod n (2..30). op 0 plus, 1 times, 2 minus, 3 divide (n prime only). Times and divide leave out 0.",
      args: '{ "n": 7, "op": 3 }',
      run: (args) => {
        const n = core().clampN(num(args, "n", 10)), op = Math.floor(num(args, "op", 0));
        const t = core().table(n, op);
        if (!t) throw new Error("division is only for a prime modulus, and op must be 0..3");
        return { n, op: core().OPS[op].sign, headers: t.headers, rows: t.cells };
      },
    },
    divide: {
      describe: "a / b mod a prime n: the number x with x b = a mod n (6 / 5 = 4 mod 7).",
      args: '{ "n": 7, "a": 6, "b": 5 }',
      run: (args) => {
        const n = core().clampN(num(args, "n", 7)), a = Math.floor(num(args, "a")), b = Math.floor(num(args, "b"));
        if (!core().isPrime(n)) throw new Error("n must be prime");
        if (b % n === 0) throw new Error("cannot divide by 0");
        for (let x = 0; x < n; x++) if ((x * b) % n === ((a % n) + n) % n) return { n, a, b, quotient: x };
        throw new Error("no quotient");
      },
    },
  };
}

export function position(state: Json): unknown {
  const n = core().clampN(state.n), op = Number(state.op);
  return { modulus: n, operation: core().OPS[op]?.sign, modulusIsPrime: core().isPrime(n), markedRemainder: state.mark ?? null, note: "For a prime modulus every row and column of the multiplication table is a rearrangement of the first, so division works." };
}
