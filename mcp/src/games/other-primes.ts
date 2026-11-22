/*
 * run_game_logic actions and saved-position reader for Other Primes.
 * The core lives in other-primes/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["other-primes"].OtherPrimesCore;

export function actions(): GameActions {
  return {
    table: {
      describe: "The table of n values (or x = 2n + 1 with showX) for a dim x dim table, dim 2 to 30. The odd composites are exactly the x values.",
      args: '{ "dim": 5, "showX": false }',
      run: (args) => {
        const state = core().start({ dim: num(args, "dim", 10), showX: args.showX === true });
        return { dim: state.dim, showX: state.showX, rows: core().table(state), note: "Row i starts at 4 + 3i and steps by 3 + 2i; x = 2n + 1 = (2i+3)(2j+3)." };
      },
    },
    is_prime_by_table: {
      describe: "Decide whether an odd x > 2 is prime only from whether n = (x-1)/2 is missing from the table. Sure for x up to reliableLimit; a small table may miss a big composite.",
      args: '{ "x": 91, "dim": 10 }',
      run: (args) => {
        const dim = core().clampDim(num(args, "dim", 10));
        const x = num(args, "x");
        return { x, dim, prime: core().primeByTable(x, dim), n: (x - 1) / 2, reliableLimit: core().reliableLimit(dim) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = core().start({ dim: state.dim, showX: state.showX === true });
  const missing: number[] = [];
  const present = core().members(s.dim);
  for (let n = 1; n <= core().reliableLimit(s.dim) / 2; n++) if (!present.has(n)) missing.push(2 * n + 1);
  return {
    dim: s.dim, view: s.showX ? "x (odd composites)" : "n (x = 2n + 1)",
    primesFoundByMissingNumbers: missing,
    note: `The ${s.dim} x ${s.dim} table decides every odd x up to ${core().reliableLimit(s.dim)}; the numbers missing from it are the odd primes.`,
  };
}
