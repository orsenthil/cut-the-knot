/*
 * run_game_logic actions and saved-position reader for Bad Limit.
 *
 * Each answer comes from the game's real core (bad-limit/ in the site), copied
 * into src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bad-limit"].BadLimitCore;

function readState(args: Json) {
  const C = core();
  const d = C.start({});
  return C.start({ n: num(args, "n", C.DEFAULT_N), width: num(args, "width", d.width), height: num(args, "height", d.height) });
}

export function actions(): GameActions {
  return {
    perimeters: {
      describe:
        "For a number of break points, give the big square's perimeter S, the midpoint square's perimeter s, the staircase length s_n, and whether the page's claim s = S/2 is true.",
      args: '{ "n": 5 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const sum = C.summary(state);
        return {
          n: sum.n,
          bigSquarePerimeter: sum.S,
          midpointSquarePerimeter: sum.s,
          staircaseLength: sum.sn,
          ratio: sum.ratio,
          maxDeviationFromDiamond: C.deviation(state),
          pageClaimSHalfS: sum.ratio === 0.5,
          trueRatioIs: "S/sqrt(2)",
          note: `The staircase stays exactly S = ${sum.S} long for every n, while the diamond it hugs is only ${sum.s} long. The page's s = S/2 is false: the real factor is 1/sqrt(2).`,
        };
      },
    },
    converge: {
      describe:
        "Show that as break points are added the staircase hugs the diamond more closely while its length never changes.",
      args: '{ "n": [1, 5, 20, 105] }',
      run: (args) => {
        const C = core();
        const counts = Array.isArray(args.n) ? args.n : [1, 5, 20, 105];
        const steps = counts.map((value) => {
          const state = readState({ n: value });
          const sum = C.summary(state);
          return { n: sum.n, staircaseLength: sum.sn, maxDeviation: C.deviation(state) };
        });
        return {
          steps,
          note: "The deviation tends to 0 but the length stays at S: curves can converge without their lengths converging.",
        };
      },
    },
  };
}

/** What the core says about the staircase currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readState(state);
  const sum = C.summary(here);
  return {
    n: sum.n,
    bigSquarePerimeter: sum.S,
    midpointSquarePerimeter: sum.s,
    staircaseLength: sum.sn,
    ratio: sum.ratio,
    maxDeviation: C.deviation(here),
    note: `With ${sum.n} break points the staircase is ${sum.sn} long — the same as the big square's perimeter — while the diamond is ${sum.s} long. The picture converges but the length does not.`,
  };
}
