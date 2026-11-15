/*
 * run_game_logic actions for eye-opener.
 *
 * Each action calls the game's real core (eye-opener/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

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

/**
 * What the core says about where the player has put the top piece: the
 * honest area, the hidden stretch at that height, and whether it has fitted.
 */
export function position(state: Json): unknown {
  const E = cores["eye-opener"].EyeOpener;
  const n = E.clampN(num(state, "n", 10));
  const dx = num(state, "dx", 0);
  const dy = num(state, "dy", 0);
  const stretch = E.cheat(n, dy);
  const lower = E.area(E.lowerPolygon(n));
  const upperHonest = E.area(E.upperPolygon(n, 0, 0, 0));
  const upperNow = E.area(E.upperPolygon(n, dx, dy, stretch));
  return {
    n,
    piece: { movedRight: dx, movedUp: -dy, fitted: state.fitted === true },
    fitsAt: E.target(n),
    honestArea: lower + upperHonest,
    areaOnScreenNow: lower + upperNow,
    hiddenStretchPerColumn: stretch,
    squareItClaimsToFill: n * n,
    explanationShownOnScreen: state.revealed === true,
    why: `The pieces really cover ${n * n - 1} squares. While the top piece is lifted its top edge is quietly stretched by up to 1/${n} over ${n} columns, which is the one extra square.`,
  };
}
