/*
 * run_game_logic actions and saved-position reader for Counting Triangles II. The core lives in
 * triangle-chain/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["triangle-chain"].TriangleChainCore;
type T = { k: number; p: number; x?: boolean };
const name = (t: T) => `row ${t.k + 1} triangle ${t.p + 1}${t.p % 2 === 0 ? " (up)" : " (down)"}`;

export function actions(): GameActions {
  return {
    best: {
      describe: "For n (2..16): the number of small triangles n^2, how many point up and down, the longest possible chain n^2 - n + 1, and one chain that reaches it (rows from the top, places from the left, both from 1).",
      args: '{ "n": 4 }',
      run: (args) => {
        const C = core();
        const n = Math.round(num(args, "n", 5));
        if (n < 2 || n > 16) throw new Error("n must be 2..16");
        return { n, triangles: n * n, up: (n * (n + 1)) / 2, down: (n * (n - 1)) / 2, longest: C.best(n), chain: C.longestChain(n).map(name) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const n = Math.round(num(state, "n", 5));
  const s = { n, stack: (Array.isArray(state.stack) ? state.stack : []) as T[] };
  const chain = C.chain(s) as T[], last = s.stack[s.stack.length - 1];
  const upCount = chain.filter((t) => t.p % 2 === 0).length;
  return {
    n, counted: chain.length, best: C.best(n), chain: chain.map(name),
    lastClickRefused: !!(last && last.x),
    upMinusDown: upCount - (chain.length - upCount),
    note: "Steps alternate up and down triangles, and there are n fewer down triangles than up ones.",
  };
}
