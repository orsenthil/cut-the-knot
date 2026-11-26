/*
 * run_game_logic actions and saved-position reader for A Geometric Sieve of Eratosthenes. The
 * core lives in primes-from-triangle/ and is copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["primes-from-triangle"].PrimesFromTriangleCore;

function dot(C: ReturnType<typeof core>, r: number, k: number, step = 99) {
  if (!(r >= 0 && r < C.MAX && k >= 0 && k <= r)) throw new Error("need 0 <= k <= r <= 99");
  const marked = C.marks(step)[r][k];
  return {
    dot: [r, k], gcd: C.gcd(r, k), marked, edge: k === 0 || k === r,
    topProgenitors: r >= 2 && k > 0 && k < r ? C.progenitors(r, k) : null,
    ancestors: C.ancestors(r, k).length, descendants: C.descendants(r, k).length, siblings: C.siblings(r, k).map((p: number[]) => p[1]),
  };
}

export function actions(): GameActions {
  return {
    dot: {
      describe: "For dot (r, k) of the triangle (rows 0..99): its gcd, whether the finished process marks it (exactly when gcd > 1, edges always), its top progenitors, and how many ancestors and descendants the applet lights up.",
      args: '{ "r": 12, "k": 8 }',
      run: (args) => dot(core(), Math.floor(num(args, "r")), Math.floor(num(args, "k"))),
    },
    row: {
      describe: "Which inner dots of row r end up marked, and whether the row stays clear (a prime row).",
      args: '{ "r": 12 }',
      run: (args) => {
        const C = core();
        const r = Math.floor(num(args, "r"));
        if (!(r >= 0 && r < C.MAX)) throw new Error("rows are 0..99");
        const m = C.marks(99)[r];
        const marked = m.map((v: boolean, k: number) => (v && k > 0 && k < r ? k : -1)).filter((k: number) => k >= 0);
        return { row: r, markedInside: marked, staysClear: marked.length === 0, prime: C.isPrime(r) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const step = Math.max(1, Math.min(99, Math.floor(num(state, "step", 99))));
  const picked = Array.isArray(state.picked) ? (state.picked as number[]) : null;
  return {
    rowsVisible: num(state, "rows", 20), processedUpToRow: step, finished: step >= 99,
    picked: picked ? dot(C, picked[0], picked[1], step) : null,
    frameRow: state.frame ?? null,
    note: "Inside the triangle a dot ends up marked exactly when gcd(r, k) > 1, so the prime rows stay clear.",
  };
}
