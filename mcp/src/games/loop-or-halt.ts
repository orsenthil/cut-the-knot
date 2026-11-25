/*
 * run_game_logic actions and saved-position reader for Loop Or Halt.
 * The core lives in loop-or-halt/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["loop-or-halt"].LoopOrHaltCore;

const perm = (args: Json): number[] => {
  const v = args.perm;
  if (!Array.isArray(v)) throw new Error('argument "perm" must be an array of the numbers 1..N');
  const p = v.map(Number);
  if (!core().isPermutation(p, p.length)) throw new Error('"perm" must be a permutation of 1..N');
  return p;
};

export function actions(): GameActions {
  return {
    run: {
      describe: "Flip the first k numbers, k being the first number, until 1 is first: every row, the leaders (first numbers) and the number of flips. 362154 gives leaders 3, 2, 6, 4, 3, 5, 2, 4, 1.",
      args: '{ "perm": [3, 6, 2, 1, 5, 4] }',
      run: (args) => { const rows = core().run(perm(args)); return { rows, leaders: core().leaders(rows), flips: rows.length - 1 }; },
    },
    longest: {
      describe: "The most flips any starting row of length n needs, over every permutation (n = 3 to 9: 2, 4, 7, 10, 16, 22, 30).",
      args: '{ "n": 6 }',
      run: (args) => {
        const n = Math.floor(num(args, "n", 6));
        if (n < 1 || n > 9) throw new Error("n must be 1..9");
        let best = 0;
        const a = Array.from({ length: n }, (_, i) => i + 1);
        const go = (k: number): void => {
          if (k === n) { best = Math.max(best, core().steps(a.slice())); return; }
          for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; go(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
        };
        go(0);
        return { n, longestRun: best };
      },
    },
  };
}

export function position(state: Json): unknown {
  const start = (state.start as number[]).map(Number);
  const rows = core().run(start);
  return {
    n: start.length, start, flips: rows.length - 1, leaders: core().leaders(rows), largestLeader: Math.max(...core().leaders(rows)),
    note: "The largest number that ever comes first comes first only once, so the process always stops with 1 first.",
  };
}
