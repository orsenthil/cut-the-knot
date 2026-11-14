/*
 * run_game_logic actions for torque.
 *
 * Each action calls the game's real core (torque/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions } from "./_shared.js";

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
