/*
 * run_game_logic actions and saved-position reader for the Broken Calculator.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["calculator"].CalculatorCore;

function readState(args: Json) {
  const C = core();
  return C.start({ seed: num(args, "seed", 1), useMemory: args.useMemory === true });
}

export function actions(): GameActions {
  return {
    broken_keys: {
      describe:
        "For a given random seed, list exactly which calculator keys work in that round and which digit 1 is never enabled.",
      args: '{ "seed": 1 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        return {
          seed: state.seed,
          digits: state.digits,
          operations: state.mulDiv === 0 ? ["*", "."] : ["/"],
          signs: state.plusMinus === 0 ? ["+"] : ["-", "+/-"],
          memory: state.useMemory,
          enabled: C.enabledButtons(state),
          oneEnabled: C.enabledButtons(state).includes("1"),
          note: "Four digits from 2 to 9, one pair of operation keys, and the 1 key is always broken.",
        };
      },
    },
    press_keys: {
      describe:
        "Press a sequence of calculator keys and report the display, which numbers 1 to 15 have been found and the progress line.",
      args: '{ "seed": 1, "keys": ["8", "8", "-", "1", "="] }',
      run: (args) => {
        const C = core();
        let state = readState(args);
        const keys = Array.isArray(args.keys) ? args.keys.map(String) : [];
        const log: { key: string; display: string; found: string }[] = [];
        for (const key of keys) {
          state = C.press(state, key);
          log.push({ key, display: state.display, found: C.achievementString(state.found) });
        }
        return {
          seed: state.seed,
          keys,
          display: state.display,
          progress: C.achievementString(state.found),
          countFound: C.countFound(state.found),
          log,
          note: `After ${keys.length} presses the display reads ${state.display} and ${C.countFound(state.found)} of 15 numbers are found.`,
        };
      },
    },
  };
}

/** What the core says about the calculator currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const seed = num(state, "seed", 1);
  let here = C.start({ seed, useMemory: state.useMemory === true });
  here = { ...here, display: typeof state.display === "string" ? state.display : "", found: Array.isArray(state.found) ? state.found.map(Boolean) : here.found };
  return {
    seed: here.seed,
    display: here.display,
    enabled: C.enabledButtons(here),
    oneEnabled: C.enabledButtons(here).includes("1"),
    digits: here.digits,
    progress: C.achievementString(here.found),
    countFound: C.countFound(here.found),
    note: `This round has ${C.enabledButtons(here).length} working keys; ${C.countFound(here.found)} of the numbers 1 to 15 are found.`,
  };
}
