/*
 * run_game_logic actions and saved-position reader for Group Multiplication of Permutations. The core lives in
 * perm-group/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["perm-group"].PermGroupCore;

function perm(args: Json, key: string): number[] {
  const f = numArray(args, key);
  if (new Set(f).size !== f.length || f.some((v) => !Number.isInteger(v) || v < 1 || v > f.length)) throw new Error(`"${key}" must be a permutation of 1..n`);
  return f;
}

export function actions(): GameActions {
  return {
    conjugate: {
      describe: "fg, gf, f^-1 g f and g^-1 f g for two permutations (left one first), with the cycles of each and Lemma 1: the cycles of f^-1 g f are g's cycles with every element a replaced by f(a).",
      args: '{ "f": [2, 3, 1, 4], "g": [2, 1, 3, 4] }',
      run: (args) => {
        const f = perm(args, "f"), g = perm(args, "g");
        if (f.length !== g.length) throw new Error("f and g must have the same length");
        const e = core().everything(f, g);
        return { fg: e.fg, gf: e.gf, fgf: e.fgf, gfg: e.gfg, cyclesFgf: core().cycleText(e.fgf), cyclesG: core().cycleText(g), gCyclesRelabelledByF: core().relabelled(f, g), shapeG: core().shape(g), shapeFgf: core().shape(e.fgf) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const f = (state.f as number[]).map(Number), g = (state.g as number[]).map(Number);
  const e = core().everything(f, g);
  return { n: f.length, f, g, fg: e.fg, gf: e.gf, conjugateOfGByF: e.fgf, conjugateOfFByG: e.gfg, shapeG: core().shape(g), shapeOfConjugate: core().shape(e.fgf), showingCycles: state.cycles === true, note: "Conjugating g by f only renames the elements of g's cycles (each a becomes f(a)), so the cycle shape never changes." };
}
