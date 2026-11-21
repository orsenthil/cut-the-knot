/*
 * run_game_logic actions and saved-position reader for GCD x LCM = M x N.
 * The core lives in gcd-lcm-rectangles/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["gcd-lcm-rectangles"].GcdLcmRectanglesCore;

function readPair(args: Json) {
  const m = num(args, "m", 6);
  const n = num(args, "n", 4);
  if (!Number.isInteger(m) || !Number.isInteger(n) || m < 1 || n < 1) throw new Error("m and n must be positive integers");
  return { m, n };
}

export function actions(): GameActions {
  return {
    analyze: {
      describe: "For M and N, report the gcd, the number of gcd-square tiles, the lcm and the product identity.",
      args: '{ "m": 12, "n": 10 }',
      run: (args) => {
        const r = core().analyze(readPair(args).m, readPair(args).n);
        return { m: r.m, n: r.n, gcd: r.g, squares: r.squares, lcm: r.lcm, product: r.product, holds: r.holds, note: `${r.m}×${r.n} = ${r.g}×${r.lcm}` };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(readPair(state).m, readPair(state).n);
  return { m: r.m, n: r.n, gcd: r.g, lcm: r.lcm, squares: r.squares, holds: r.holds, note: `${r.m}×${r.n} = ${r.g}×${r.lcm}` };
}
