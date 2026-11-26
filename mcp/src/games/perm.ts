/*
 * run_game_logic actions and saved-position reader for Various Ways to Define a Permutation. The core lives in
 * perm/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["perm"].PermCore;

function perm(args: Json): number[] {
  const f = numArray(args, "f");
  if (!core().isPermutation(f)) throw new Error('"f" must be a permutation of 1..n');
  return f;
}

export function actions(): GameActions {
  return {
    describe: {
      describe: "A permutation f of 1..n in every notation the page shows: the inverse (the upside-down row), the cycles, and Marshall Hall's list of inversions.",
      args: '{ "f": [5, 9, 1, 8, 2, 6, 4, 7, 3] }',
      run: (args) => {
        const f = perm(args);
        return { f, inverse: core().inverse(f), cycles: core().cycleText(f), inversions: core().inversions(f) };
      },
    },
    fromInversions: {
      describe: "Rebuild the permutation from its list of inversions a_i (the number of larger elements to the left of i): the list determines it uniquely.",
      args: '{ "a": [2, 3, 6, 4, 0, 2, 2, 1, 0] }',
      run: (args) => {
        const a = numArray(args, "a");
        if (!core().validInversions(a)) throw new Error("a_i must be an integer from 0 to n - i");
        return { a, f: core().fromInversions(a) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const f = (state.f as number[]).map(Number);
  return { n: f.length, f, view: state.view, inverse: core().inverse(f), cycles: core().cycleText(f), inversions: core().inversions(f), note: "The list of inversions determines the permutation, so there are n! of them." };
}
