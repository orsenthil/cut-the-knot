/*
 * run_game_logic actions and saved-position reader for Product of Permutations. The core lives in
 * perm-product/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["perm-product"].PermProductCore;

function perm(args: Json, key: string): number[] {
  const f = numArray(args, key);
  if (new Set(f).size !== f.length || f.some((v) => !Number.isInteger(v) || v < 1 || v > f.length)) throw new Error(`"${key}" must be a permutation of 1..n`);
  return f;
}

export function actions(): GameActions {
  return {
    product: {
      describe: "The product fg of two permutations, with the page's order (f first, then g, so (fg)(k) = g(f(k))), and gf, the inverse of fg and whether they commute.",
      args: '{ "f": [2, 3, 1], "g": [1, 3, 2] }',
      run: (args) => {
        const f = perm(args, "f"), g = perm(args, "g");
        if (f.length !== g.length) throw new Error("f and g must have the same length");
        const fg = core().product(f, g), gf = core().product(g, f);
        return { fg, gf, commute: fg.join() === gf.join(), cyclesFg: core().cycleText(fg), inverseOfFg: core().inverse(fg), parityFg: core().isEven(fg) ? "even" : "odd" };
      },
    },
  };
}

export function position(state: Json): unknown {
  const f = (state.f as number[]).map(Number), g = (state.g as number[]).map(Number);
  const fg = core().product(f, g), gf = core().product(g, f);
  return { n: f.length, f, g, fg, gf, commute: fg.join() === gf.join(), cyclesF: core().cycleText(f), cyclesG: core().cycleText(g), cyclesFg: core().cycleText(fg), note: "fg means f first, then g. Order matters from three numbers up; the parity of fg is the parities of f and g combined." };
}
