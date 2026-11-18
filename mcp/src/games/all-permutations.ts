/*
 * run_game_logic actions and saved-position reader for All Permutations.
 * The core (all-permutations/ in the site, copied into src/generated/cores/ at
 * build time) knows the three generators and cycle notation. See _shared.ts
 * for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["all-permutations"].AllPermutationsCore;

function readN(args: Json): number {
  const C = core();
  const n = num(args, "n", 3);
  if (!Number.isInteger(n) || n < C.MIN_N || n > C.MAX_N) throw new Error(`n must be ${C.MIN_N} to ${C.MAX_N}`);
  return n;
}

export function actions(): GameActions {
  return {
    list_permutations: {
      describe:
        "List the first few permutations of 1..n by one of the three algorithms (recursive, lexicographic, heap), with cycles and the factorial count.",
      args: '{ "n": 3, "algorithm": "recursive", "limit": 6 }',
      run: (args) => {
        const C = core();
        const n = readN(args);
        const algorithm = typeof args.algorithm === "string" ? args.algorithm : "recursive";
        if (!C.ALGORITHMS.includes(algorithm)) throw new Error("algorithm must be recursive, lexicographic or heap");
        const limit = Math.min(100, Number.isFinite(args.limit) ? num(args, "limit") : 6);
        const rows = C.generate(n, algorithm);
        return {
          n,
          algorithm,
          count: rows.length,
          factorial: C.factorial(n),
          rows: rows.slice(0, limit).map((p: number[]) => ({ permutation: p, cycles: C.cycles(p) })),
          note: "All three algorithms list the same n! rows in different orders.",
        };
      },
    },
    cycles: {
      describe:
        "Write a permutation as a product of cycles, and say how many of its elements are deranged (no fixed point).",
      args: '{ "permutation": [2, 3, 1] }',
      run: (args) => {
        const C = core();
        const permutation = numArray(args, "permutation");
        const n = permutation.length;
        if (!n || [...permutation].sort((a, b) => a - b).join(",") !== Array.from({ length: n }, (_, i) => i + 1).join(",")) {
          throw new Error("permutation must contain each of 1..n exactly once");
        }
        return {
          permutation,
          cycles: C.cycles(permutation),
          isDerangement: C.isDerangement(permutation),
          note: "Cycles include fixed points, as the applet prints them.",
        };
      },
    },
  };
}

/** What the core says about a saved board. */
export function position(state: Json): unknown {
  const C = core();
  const n = readN(state);
  const algorithm = typeof state.algorithm === "string" && C.ALGORITHMS.includes(state.algorithm)
    ? state.algorithm : "recursive";
  const rows = C.generate(n, algorithm);
  return {
    n,
    algorithm,
    count: rows.length,
    firstRow: rows[0] ? { permutation: rows[0], cycles: C.cycles(rows[0]) } : null,
    note: `${C.factorial(n)} permutations of ${n} in ${algorithm} order.`,
  };
}
