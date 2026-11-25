/*
 * run_game_logic actions and saved-position reader for Orthogonal Latin Squares.
 * The core lives in orthogonal-latin-squares/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["orthogonal-latin-squares"].LatinCore;

export function actions(): GameActions {
  return {
    solution: {
      describe: "A pair of orthogonal Latin squares of order n (as two arrays of letter numbers 0..n-1) for the orders with a construction here: odd n, 4, 8, 16 and their products such as 12 and 20. None exists for 2 and 6; 10, 14 and 18 exist but are not built here.",
      args: '{ "n": 5 }',
      run: (args) => {
        const n = Math.floor(num(args, "n"));
        const s = core().solution(n) as number[][][] | null;
        if (!s) return { n, built: false, note: n === 2 || n === 6 ? "No orthogonal pair of this order exists (Euler's 36 officers for 6, Tarry 1900)." : "This page has no construction for this order." };
        return { n, built: true, left: s[0], right: s[1], status: core().status({ n, left: s[0], right: s[1], apply: "left" }) };
      },
    },
    check: {
      describe: "Whether two squares (arrays of letter numbers) are Latin and orthogonal, and the cells that repeat a pair of letters.",
      args: '{ "left": [[0,1,2],[1,2,0],[2,0,1]], "right": [[0,1,2],[2,0,1],[1,2,0]] }',
      run: (args) => {
        const left = args.left as number[][], right = args.right as number[][];
        const state = { n: left.length, left, right, apply: "left" };
        return { status: core().status(state), repeatedPairs: core().repeatedPairs(state) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = { n: state.n, left: state.left, right: state.right, apply: state.apply };
  const st = core().status(s) as Json;
  const n = Number(state.n);
  return { size: n, ...st, movesApplyTo: state.apply === "right" ? "capitals" : "small letters", solutionExistsForThisSize: n !== 2 && n !== 6, note: n === 6 ? "Euler's 36 officers: no orthogonal pair of order 6 exists (Tarry, 1900)." : "Both squares must be Latin and every pair of letters must occur once." };
}
