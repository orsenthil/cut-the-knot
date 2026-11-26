/*
 * run_game_logic actions and saved-position reader for Permutations as a Product of Transpositions. The core lives in
 * perm-by-trans/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["perm-by-trans"].PermTransCore;

function make(n: number, bars: { h: number; a: number; b: number }[]) {
  let s = core().start({ n });
  for (const x of bars) {
    const r = core().add(s, x.h, x.a, x.b);
    if (!r.state) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

export function actions(): GameActions {
  return {
    trace: {
      describe: "The permutation made by shuttles (h = height from the top, a and b = the two poles) on n poles: where every number ends up, the cycles, the parity of the shuttle count and the fewest shuttles that could make the same permutation.",
      args: '{ "n": 5, "bars": [{ "h": 2, "a": 1, "b": 3 }, { "h": 4, "a": 3, "b": 5 }] }',
      run: (args) => {
        const n = Math.min(20, Math.max(2, Math.floor(num(args, "n"))));
        const bars = Array.isArray(args.bars) ? (args.bars as Json[]).map((x) => ({ h: Number(x.h), a: Number(x.a), b: Number(x.b) })) : [];
        const s = make(n, bars);
        const f = core().permutation(s) as number[];
        return { permutation: f, cycles: core().cycleText(f), shuttles: bars.length, shuttleParity: bars.length % 2 === 0 ? "even" : "odd", permutationIsEven: core().isEven(f), fewestShuttles: core().fewest(f), transpositions: core().transpositions(s) };
      },
    },
    build: {
      describe: "A fewest-shuttles layout (one shuttle per height from the top) that makes a given permutation f of 1..n: n minus the number of cycles of them.",
      args: '{ "f": [3, 1, 2, 5, 4] }',
      run: (args) => {
        const f = numArray(args, "f");
        if (new Set(f).size !== f.length || f.some((v) => !Number.isInteger(v) || v < 1 || v > f.length)) throw new Error('"f" must be a permutation of 1..n');
        const bars = core().build(f) as { h: number; a: number; b: number }[];
        return { f, shuttles: bars, count: bars.length, cycles: core().cycleText(f) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const n = Number(state.n);
  const bars = ((state.bars as Json[]) || []).map((x) => ({ h: Number(x.h), a: Number(x.a), b: Number(x.b) }));
  const s = make(n, bars);
  const f = core().permutation(s) as number[];
  return { poles: n, shuttles: bars.length, transpositions: core().transpositions(s), permutation: f, cycles: core().cycleText(f), parity: bars.length % 2 === 0 ? "even" : "odd", fewestShuttlesForThisPermutation: core().fewest(f), note: "A permutation with c cycles needs n - c shuttles, and the parity of the number of shuttles is always the permutation's parity." };
}
