/*
 * run_game_logic actions and saved-position reader for Recombining Permutations. The core lives in
 * perm-on-circle/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["perm-on-circle"].PermCircleCore;

function perm(args: Json): number[] {
  const f = numArray(args, "f");
  if (new Set(f).size !== f.length || f.some((v) => !Number.isInteger(v) || v < 1 || v > f.length)) throw new Error('"f" must be a permutation of 1..n');
  return f;
}

export function actions(): GameActions {
  return {
    swap: {
      describe: "Multiply the permutation by the transposition of a and b (the entries at a and b trade places) and say whether the cycle split in two or two cycles joined. The cycle count changes by exactly one.",
      args: '{ "f": [2, 3, 1, 5, 4], "a": 1, "b": 3 }',
      run: (args) => {
        const f = perm(args), n = f.length;
        const a = Math.floor(num(args, "a")), b = Math.floor(num(args, "b"));
        if (a < 1 || b < 1 || a > n || b > n || a === b) throw new Error("a and b must be different numbers from 1 to n");
        const g = core().swap(f, a, b);
        return { before: core().cycleText(f), after: core().cycleText(g), cyclesBefore: core().cycles(f).length, cyclesAfter: core().cycles(g).length, effect: core().effect(f, a, b), result: g, evenAfter: core().isEven(g) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const f = (state.f as number[]).map(Number);
  return { n: f.length, f, cycles: core().cycleText(f), numberOfCycles: core().cycles(f).length, parity: core().isEven(f) ? "even" : "odd", swapsSoFar: Number(state.moves), note: "Every swap changes the number of cycles by exactly one (split if both numbers are in one cycle, join otherwise), so it flips the parity." };
}
