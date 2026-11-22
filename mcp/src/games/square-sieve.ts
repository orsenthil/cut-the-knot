/*
 * run_game_logic actions and saved-position reader for Square Sieve.
 * The core lives in square-sieve/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["square-sieve"].SquareSieveCore;

export function actions(): GameActions {
  return {
    run: {
      describe: "Run the sieve on 1..n for a number of steps (all of them by default): step k flips every multiple of k. Returns the red numbers.",
      args: '{ "n": 50, "steps": 50 }',
      run: (args) => {
        let s = core().start({ n: num(args, "n", 50) });
        const steps = Math.min(s.n, Math.max(0, Math.floor(num(args, "steps", s.n))));
        for (let i = 0; i < steps; i++) s = core().step(s);
        return { n: s.n, stepsDone: s.next - 1, red: core().redNumbers(s), finished: core().result(s) === "done", note: "After all n steps exactly the perfect squares are red." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const n = core().clampN(state.n);
  const next = Math.min(n + 1, Math.max(1, Math.floor(Number(state.next)) || 1));
  let s = core().start({ n });
  while (s.next < next) s = core().step(s);
  return {
    n, stepsDone: s.next - 1, nextStep: core().canStep(s) ? s.next : null,
    red: core().redNumbers(s), finished: core().result(s) === "done",
    note: core().result(s) === "done" ? "All steps done: the red numbers are the perfect squares." : `Step ${s.next} is next.`,
  };
}
