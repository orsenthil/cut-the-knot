/*
 * run_game_logic actions and saved-position reader for Filling an Array with
 * 0s and 1s, and Counting. The core lives in zeros-and-ones-array/ and is copied
 * into src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["zeros-and-ones-array"].ZeroOneCore;

export function actions(): GameActions {
  return {
    sums: {
      describe: "The number of 1s in each row and each column of a 0/1 array (rows of 0s and 1s), the set of different sums and how many there can be at most (max(N, M) + 1).",
      args: '{ "cells": [[1, 1, 0], [0, 1, 0], [0, 0, 0]] }',
      run: (args) => {
        const cells = (args.cells as unknown[][]).map((r) => r.map((v) => (Number(v) ? 1 : 0)));
        return core().sums({ n: cells.length, m: cells[0].length, cells });
      },
    },
    best: {
      describe: "An array with the most possible different sums (max(N, M) + 1), where the page's claim says it can be done (N = M; N = M + 1 with M > 2; N even and M >= N/2 + 1; N odd and M > (N+1)/2). Otherwise null.",
      args: '{ "n": 7, "m": 6 }',
      run: (args) => {
        const n = Math.floor(num(args, "n")), m = Math.floor(num(args, "m"));
        const b = core().optimal(n, m) as { cells: number[][] } | null;
        return { n, m, possibleByThePage: core().attainable(n, m), array: b ? b.cells : null, sums: b ? core().sums(b) : null };
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = { n: state.n, m: state.m, cells: state.cells };
  const sums = core().sums(s) as { rows: number[]; cols: number[]; distinct: number[]; count: number; most: number };
  return { size: `${state.n} by ${state.m}`, ...sums, reachedTheMost: sums.count === sums.most, mostIsReachableForThisSize: core().attainable(Number(state.n), Number(state.m)) };
}
