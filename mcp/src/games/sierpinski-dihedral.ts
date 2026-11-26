/*
 * run_game_logic actions and saved-position reader for Sierpinski's Gasket and Dihedral Symmetry.
 * The core lives in sierpinski-dihedral/ and is copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["sierpinski-dihedral"].SierpinskiDihedralCore;

function opts(args: Json) {
  return {
    n: Math.round(num(args, "n", 32)), m: Math.round(num(args, "m", 2)),
    add: args.add !== false, prongs: num(args, "prongs", 2) === 3 ? 3 : 2,
  };
}

export function actions(): GameActions {
  return {
    grid: {
      describe: "Runs the automaton (Add or Replace, 2 or 3 prongs, modulo m) on an n x n grid (n <= 32 here) for the given steps and returns the rows, with the count of non-zero cells. Add with 2 prongs gives C(N-m, n) C(N, m) mod m in cell (n, m) after N steps.",
      args: '{ "n": 8, "m": 2, "add": true, "prongs": 2, "steps": 7 }',
      run: (args) => {
        const C = core();
        const o = opts(args);
        if (o.n > 32) throw new Error("n must be at most 32 here");
        const steps = Math.max(0, Math.min(200, Math.round(num(args, "steps", 1))));
        let s = C.start(o);
        for (let i = 0; i < steps; i++) s = C.step(s);
        return { steps, nonZero: C.lit(s), rows: s.S.map((r: number[]) => r.join(" ")) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const o = opts(state);
  const steps = Math.max(0, Math.round(num(state, "steps", 0)));
  let s = C.start(o);
  for (let i = 0; i < Math.min(steps, 400); i++) s = C.step(s);
  return {
    gridSize: s.n, modulus: s.m, rule: `${s.add ? "Add" : "Replace"}, ${s.prongs} prongs`, steps, nonZeroCells: C.lit(s),
    formula: s.add ? (s.prongs === 2 ? "cell (n, m) = C(N-m, n) C(N, m) = N!/(n! m! (N-n-m)!) mod M" : "cell (n, m) = C(N, n) C(N, m) mod M") : (s.prongs === 2 ? "Pascal's triangle C(n+m, n) mod M" : "Delannoy numbers mod M once n + m <= N"),
  };
}
