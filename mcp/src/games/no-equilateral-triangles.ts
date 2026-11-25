/*
 * run_game_logic actions and saved-position reader for No Equilateral Triangles.
 * The core lives in no-equilateral-triangles/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["no-equilateral-triangles"].NoEquilateralTrianglesCore;

export function actions(): GameActions {
  return {
    all_colourings: {
      describe: "Tries all 1,024 two-colourings of the ten dots: how many avoid a monochromatic equilateral triangle (0), and the fewest and most such triangles.",
      args: "{}",
      run: () => core().allColourings(),
    },
    mono: {
      describe: "The monochromatic triangles (dot numbers 0..9) of a colouring given as ten 0/1 values.",
      args: '{ "colours": [0,1,0,1,0,1,0,1,0,1] }',
      run: (args) => {
        const c = args.colours;
        if (!Array.isArray(c) || c.length !== 10) throw new Error('"colours" must be ten 0/1 values');
        const idx = core().mono({ colours: c.map(Number) });
        return { count: idx.length, triangles: idx.map((k: number) => core().TRIANGLES[k]) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const c = (state.colours as number[]) ?? [];
  const idx = core().mono({ colours: c });
  return {
    monochromaticTriangles: idx.length, triangles: idx.map((k: number) => core().TRIANGLES[k]),
    note: "Every colouring of the ten dots has at least one (the fewest is 1), so the puzzle cannot be won.",
  };
}
