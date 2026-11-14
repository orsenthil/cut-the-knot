/*
 * run_game_logic actions for hourglass.
 *
 * Each action calls the game's real core (hourglass/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const H = cores.hourglass.HourglassCore;
  return {
    solve: {
      describe:
        "Fewest-flips recipe for boiling the egg for `target` minutes with glasses of `a` and `b` minutes. Returns null when it cannot be done.",
      args: '{ "a": 7, "b": 11, "target": 15 }',
      run: (args) => {
        const a = num(args, "a");
        const b = num(args, "b");
        const target = num(args, "target");
        const result = H.solve({ a, b }, target);
        if (!result) {
          return {
            solvable: false,
            why: `${target} is not reachable with ${a} and ${b} minute glasses; only multiples of gcd(${a}, ${b}) are.`,
          };
        }
        return {
          solvable: true,
          flips: result.flips,
          totalMinutes: result.elapsed,
          steps: result.steps.map((s: Json & { act: string }) => ({
            action: s.act,
            say: H.describe(s, { a, b }),
            minutesElapsed: (s as unknown as { after: { elapsed: number } }).after.elapsed,
            minutesCooked: (s as unknown as { after: { cooked: number } }).after.cooked,
          })),
        };
      },
    },
    next_state: {
      describe: "Applies one action (flipA, flipB, eggIn, eggOut, wait) to a state.",
      args: '{ "a": 7, "b": 11, "action": "flipA", "state": { "ta": 0, "tb": 0, "egg": 0, "cooked": 0, "flips": 0, "elapsed": 0, "dt": 0 } }',
      run: (args) => {
        const caps = { a: num(args, "a"), b: num(args, "b") };
        const state = (args.state as Json) ?? H.start();
        const next = H.apply(state, String(args.action), caps);
        return next ? { legal: true, state: next } : { legal: false };
      },
    },
  };
}
