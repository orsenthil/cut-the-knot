/*
 * run_game_logic actions and saved-position reader for the Futurama Theorem game.
 *
 * Minds are swapped between bodies, but no pair may swap twice. With two clean extras X and Y (every
 * swap must involve one of them), every permutation can be undone. Every answer comes from the game's
 * real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["futurama"].FuturamaCore;
const letter = (n: number, i: number) => (i === n ? "X" : i === n + 1 ? "Y" : String.fromCharCode(65 + i));

/** The cycles of perm (list of body -> mind), as lists of letters, ignoring fixed points. */
function cyclesOf(n: number, perm: number[]): string[][] {
  const seen = new Array(perm.length).fill(false), out: string[][] = [];
  for (let i = 0; i < perm.length; i++) {
    if (seen[i] || perm[i] === i) { seen[i] = true; continue; }
    const c: string[] = []; let j = i;
    while (!seen[j]) { seen[j] = true; c.push(letter(n, j)); j = perm[j]; }
    out.push(c);
  }
  return out;
}

export function actions(): GameActions {
  return {
    solve: {
      describe: "Undo a mix-up of 3 to 7 people with swaps that all involve X or Y and never repeat a pair (the Futurama theorem). minds lists which mind each body holds as letters, e.g. \"BCA\" means body A holds the mind of B, body B holds C's, body C holds A's. Gives the cycles, the swaps found (as letter pairs) and checks them.",
      args: '{ "minds": "BCA" }',
      run: (args) => {
        const C = core();
        const text = String(args.minds ?? "BCA").toUpperCase().replace(/[^A-G]/g, "");
        const n = text.length;
        if (n < 3 || n > 7) throw new Error("minds lists 3 to 7 letters from A to G");
        const perm = text.split("").map((ch) => ch.charCodeAt(0) - 65);
        if (perm.some((v) => v >= n) || new Set(perm).size !== n) throw new Error(`minds must use each of the first ${n} letters once`);
        const s = C.start({ n, perm: perm.concat([n, n + 1]) });
        const sol = C.solve(s, 3000000);
        if (!sol) return { cycles: cyclesOf(n, s.perm), found: false };
        let g = s; const used = new Set<string>(); let legal = true;
        for (const [i, j] of sol) { const key = [i, j].sort().join(); if (used.has(key)) legal = false; used.add(key); const r = C.swap(g, i, j); if (!r || r.message) legal = false; else g = r; }
        return { cycles: cyclesOf(n, s.perm), found: true, swaps: sol.map(([i, j]: number[]) => `${letter(n, i)}${letter(n, j)}`), count: sol.length, everySwapInvolvesXorY: sol.every(([i, j]: number[]) => i >= n || j >= n), noPairTwice: used.size === sol.length, endsStraight: C.straight(g) && legal };
      },
    },
  };
}

/** What the core says about the game as the page saved it. */
export function position(state: Json): unknown {
  const n = Math.max(3, Math.min(12, Math.trunc(num(state, "n", 7))));
  const perm = Array.isArray(state.perm) && state.perm.length === n + 2 ? (state.perm as number[]).map(Number) : Array.from({ length: n + 2 }, (_, i) => i);
  const stack = Array.isArray(state.stack) ? (state.stack as number[][]) : [];
  const atHome = perm.slice(0, n).filter((v, i) => v === i).length;
  return {
    people: n,
    cycles: cyclesOf(n, perm),
    mindsAtHome: atHome,
    solved: perm.every((v, i) => v === i),
    swapsMade: stack.map(([a, b]) => `${letter(n, a)}${letter(n, b)}`),
    usedWithX: ((state.usedX as number[]) || []).map((i) => letter(n, i)),
    usedWithY: ((state.usedY as number[]) || []).map((i) => letter(n, i)),
    lastMessage: typeof state.message === "string" ? state.message : "",
  };
}
