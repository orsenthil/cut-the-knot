/*
 * run_game_logic actions for torque.
 *
 * Each action calls the game's real core (torque/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const T = cores.torque.TorqueCore;
  return {
    generate: {
      describe: "A fresh balance puzzle. Every round is built backwards from a balanced arrangement, so it is always solvable.",
      args: "{}",
      run: () => T.generate(),
    },
    evaluate: {
      describe: "Scores a placement: the beam balances when the torques sum to zero.",
      args: '{ "items": [{ "id": "a", "value": 2 }, { "id": "b", "value": -1 }], "placements": { "a": 3, "b": 6 } }',
      run: (args) => {
        const items = (args.items as { id: string; value: number }[]) ?? [];
        const placements = (args.placements as Record<string, number>) ?? {};
        const result = T.evaluate(items, placements);
        return {
          ...result,
          why: "sum(value x position) must be 0; positions run -6..-1 on the left and 1..6 on the right.",
        };
      },
    },
  };
}

/**
 * What the core says about a position saved by the page: the torque so far,
 * what is still in the tray, and which pegs are free.
 */
export function position(state: Json): unknown {
  const T = cores.torque.TorqueCore;
  const pegs = (state.pegs ?? []) as number[];
  const items = (state.items ?? []) as { id: string; value: number; isJoker?: boolean }[];
  const placements = (state.placements ?? {}) as Record<string, number>;
  const result = T.evaluate(items, placements);
  return {
    balanced: result.balanced,
    everythingHung: result.allPlaced,
    torqueSoFar: result.sum,
    tipping: result.sum === 0 ? "level" : result.sum > 0 ? "right" : "left",
    hung: items
      .filter((item) => placements[item.id] !== undefined && placements[item.id] !== null)
      .map((item) => ({ id: item.id, value: item.value, peg: placements[item.id], torque: item.value * placements[item.id] })),
    inTheTray: items
      .filter((item) => placements[item.id] === undefined || placements[item.id] === null)
      .map((item) => ({ id: item.id, value: item.value })),
    freePegs: pegs.filter((pos) => T.pegIsFree(placements, pos)),
    rule: "Each item pulls with value x peg position; pegs left of the middle are negative. The beam is level when the pulls add up to 0.",
  };
}
