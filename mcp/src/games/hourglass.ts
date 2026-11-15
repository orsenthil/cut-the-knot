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

/**
 * What the core says about a position saved by the page: the minutes still
 * to go, what each allowed action leads to, and the fewest flips this
 * puzzle can be solved in from a fresh start.
 */
export function position(state: Json): unknown {
  const H = cores.hourglass.HourglassCore;
  const caps = { a: num(state, "a"), b: num(state, "b") };
  const target = num(state, "target");
  const now = {
    ta: num(state, "ta"),
    tb: num(state, "tb"),
    egg: num(state, "egg"),
    cooked: num(state, "cooked"),
    flips: num(state, "flips"),
    elapsed: num(state, "elapsed"),
    dt: 0,
  };
  const eggWords = ["not in the pot yet", "cooking", "taken out"];
  const best = H.solve(caps, target);

  const actions: Record<string, unknown> = {};
  for (const act of ["flipA", "flipB", "eggIn", "eggOut", "wait"]) {
    const next = H.apply(now, act, caps);
    if (next) actions[act] = { sandLeftA: next.ta, sandLeftB: next.tb, eggCooked: next.cooked, minutesElapsed: next.elapsed };
  }

  return {
    glasses: { a: caps.a, b: caps.b },
    target,
    sandLeft: { a: now.ta, b: now.tb },
    egg: eggWords[now.egg] ?? String(now.egg),
    eggCookedMinutes: now.cooked,
    stillToCook: Math.max(0, target - now.cooked),
    overcooked: now.cooked > target,
    flipsSoFar: now.flips,
    minutesElapsed: now.elapsed,
    clockRunning: state.running === true,
    whatEachActionLeadsTo: actions,
    fewestFlipsFromAFreshStart: best ? best.flips : null,
    solvable: Boolean(best),
  };
}
