/*
 * run_game_logic actions and saved-position reader for the Johnson–Trotter
 * algorithm. The core lives in johnson-trotter/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["johnson-trotter"].JohnsonTrotterCore;
type Item = { value: number; dir: number };
function read(args: Json) {
  const n = Number.isFinite(args.n) ? num(args, "n") : 4;
  if (Array.isArray(args.items)) {
    const items = args.items.map((v) => {
      const x = v as Json;
      return { value: Number(x.value), dir: Number(x.dir) === 1 ? 1 : -1 };
    });
    return { n, items, steps: Number.isFinite(args.steps) ? num(args, "steps") : 0 };
  }
  const state = core().start(n);
  return { ...state, steps: Number.isFinite(args.steps) ? num(args, "steps") : state.steps };
}

export function actions(): GameActions {
  return {
    step: {
      describe: "Swap the largest mobile number with its neighbour and reverse all larger numbers' directions.",
      args: '{ "n": 4 }',
      run: (args) => {
        const C = core();
        const state = read(args);
        const index = C.largestMobile(state);
        const next = C.step(state);
        return {
          before: C.permutation(state), after: C.permutation(next),
          moved: index < 0 ? null : state.items[index].value,
          directions: next.items.map((i: Item) => i.dir),
          finished: C.analyze(next).finished,
          note: "One adjacent transposition per step; larger numbers turn around.",
        };
      },
    },
    generate: {
      describe: "List all n factorial permutations produced by the algorithm.",
      args: '{ "n": 4 }',
      run: (args) => {
        const C = core();
        const n = Number.isFinite(args.n) ? num(args, "n") : 4;
        const seq = C.generate(n);
        return {
          n, count: seq.length,
          permutations: seq.map((s: { permutation: number[] }) => s.permutation.join(" ")),
          note: "Successive permutations differ by one adjacent swap.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const input = read(state);
  const r = C.analyze(input);
  return {
    n: r.n, permutation: r.permutation, directions: r.directions,
    largestMobile: r.largestMobile, steps: r.steps, finished: r.finished,
    note: r.finished ? "No mobile number remains." : `${r.permutation[r.largestMobile]} is the largest mobile number.`,
  };
}
