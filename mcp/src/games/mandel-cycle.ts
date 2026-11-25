/*
 * run_game_logic actions and saved-position reader for Colour Cycling on the Mandelbrot Set.
 * The core lives in mandel-cycle/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["mandel-cycle"].MandelCycleCore;

export function actions(): GameActions {
  return {
    escape_count: {
      describe: "For c = x + iy: the rounds before |z|^2 > 4 under z -> z^2 + c from z = c (85 means it stays: in the set). 0, -1 and -2 stay, 1 escapes after 2 rounds, 3 at once.",
      args: '{ "x": 0.3, "y": 0 }',
      run: (args) => { const n = core().iterate(num(args, "x"), num(args, "y")); return { rounds: n, inTheSet: n === core().MAX_ITER }; },
    },
    area_estimate: {
      describe: "The area of the set estimated from the 256 by 256 picture: a little over the true 1.5066, since later escapers count as inside.",
      args: "{}",
      run: () => {
        const img = core().image(), inside = img.filter((v: number) => v === core().MAX_ITER).length;
        return { insidePixels: inside, estimate: (inside / img.length) * 3.0 * 2.8, trueArea: 1.5066 };
      },
    },
  };
}

export function position(state: Json): unknown {
  return {
    turnsOfThePalette: state.turns, direction: state.direction, speed: state.fast ? "fast" : "slow", cycling: state.running,
    note: "Cycling only turns the 85-colour palette round: the picture's escape counts never change.",
  };
}
