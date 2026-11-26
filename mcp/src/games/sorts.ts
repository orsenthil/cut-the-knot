/*
 * run_game_logic actions and saved-position reader for Sorting Algorithms. The core lives in
 * sorts/ and is copied into src/generated/cores/ at build time. See _shared.ts for the module
 * shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["sorts"].SortsCore;
const inversions = (a: number[]) => { let k = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) k++; return k; };

function methodIndex(v: unknown) {
  const C = core();
  const i = typeof v === "string" ? C.METHODS.findIndex((m: string) => m.toLowerCase().startsWith(v.toLowerCase().slice(0, 4))) : Number(v);
  if (!(i >= 0 && i < C.METHODS.length)) throw new Error(`method: one of ${C.METHODS.join(", ")} (or 0..4)`);
  return i;
}

export function actions(): GameActions {
  return {
    run: {
      describe: "Sorts an array (2..100 numbers) with one of the page's methods (insertion, selection, bubble, shell, heap) the page's way, and reports the steps (comparisons) and swaps it took, the array's inversions, and the sorted result. Leave out the array for 20 random numbers.",
      args: '{ "method": "Shellsort", "array": [5, 2, 9, 1, 7, 3] }',
      run: (args) => {
        const C = core();
        const m = methodIndex(args.method ?? 0);
        const array = Array.isArray(args.array) ? numArray(args, "array") : C.generate(20, 0, Math.random);
        if (array.length < 2 || array.length > 100) throw new Error("2..100 numbers");
        const t = C.run(C.start({ method: m, array, same: true }));
        return { method: C.METHODS[m], n: array.length, inversions: inversions(array), steps: t.alg.steps, swaps: t.alg.swaps, sorted: t.array };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const m = methodIndex(num(state, "method", 0)), order = Math.round(num(state, "order", 0)), n = Math.round(num(state, "n", 20));
  const steps = num(state, "steps", 0);
  const quadratic = m === 0 || m === 2 ? (n * (n - 1)) / 2 : m === 1 ? (n * (n + 1)) / 2 : null;
  return {
    method: C.METHODS[m], array: `${n} numbers, ${C.ORDERS[order] ?? "Random order"}`, sameArray: state.same === true,
    stepsSoFar: steps, swapsSoFar: num(state, "swaps", 0), finished: state.finished === true,
    totalSteps: quadratic ?? "depends on the data",
    note: m === 0 || m === 2 ? "Insertion sort and bubblesort make one swap per inversion." : m === 4 ? "A heapsort step is one whole sift down." : "",
  };
}
