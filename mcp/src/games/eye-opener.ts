/*
 * run_game_logic actions for eye-opener.
 *
 * Each action calls the game's real core (eye-opener/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions } from "./_shared.js";

export function actions(): GameActions {
  const E = cores["eye-opener"].EyeOpener;
  return {
    areas: {
      describe: "Where the extra square comes from: the honest area, and the area after the applet's hidden stretch.",
      args: '{ "n": 10 }',
      run: (args) => {
        const n = E.clampN(num(args, "n", 10));
        const lower = E.area(E.lowerPolygon(n));
        const upper = E.area(E.upperPolygon(n, 0, 0, 0));
        const t = E.target(n);
        const cheat = E.cheat(n, -1);
        const upperCheated = E.area(E.upperPolygon(n, t.dx, t.dy, cheat));
        return {
          n,
          rectangle: { width: n + 1, height: n - 1, area: (n + 1) * (n - 1) },
          square: { side: n, area: n * n },
          pieces: { lower, upperHonest: upper, honestTotal: lower + upper },
          cheat: { stretchPerColumn: cheat, upperAfterStretch: upperCheated, total: lower + upperCheated },
          why: `Each step is only (n-1)/n of a square tall, so after sliding, the top edge is 1/n short. The applet silently stretches it by 1/n across all ${n} columns, which is exactly the one square that "appears".`,
        };
      },
    },
  };
}
