/*
 * run_game_logic actions and saved-position reader for Polygonal Numbers. The core lives in
 * polygonal-numbers/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["polygonal-numbers"].PolygonalNumbersCore;

export function actions(): GameActions {
  return {
    number: {
      describe: "The n-th N-gonal number P(N, n) = (N - 2) n(n - 1)/2 + n, the dots in N-gons of side 1..n-1 sharing a corner, and the first ten of the sequence.",
      args: '{ "sides": 5, "n": 3 }',
      run: (args) => {
        const N = Math.floor(num(args, "sides", 5)), n = Math.floor(num(args, "n", 3));
        if (N < 3 || n < 1) throw new Error("sides >= 3 and n >= 1");
        return { value: core().polygonal(N, n), gnomon: n > 1 ? core().gnomon(N, n - 1) : 1, sequence: Array.from({ length: 10 }, (_, k) => core().polygonal(N, k + 1)) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ sides: num(state, "sides", 5), size: num(state, "size", 2) });
  const d = C.describe(s);
  return { sides: d.sides, size: s.size, dots: d.dots, n: d.n, newDotsInLargest: d.newDots, distinctDotsDrawn: C.dots(s).length, note: `${d.dots} = (N - 2) n(n - 1)/2 + n with N = ${d.sides}, n = ${d.n}.` };
}
