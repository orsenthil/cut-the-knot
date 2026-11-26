/*
 * run_game_logic actions and saved-position reader for Geometric Series in a Square. The core
 * lives in geometric-series-square/ and is copied into src/generated/cores/ at build time. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["geometric-series-square"].GeometricSeriesSquareCore;

function read(kind: number, n: number) {
  const C = core();
  if (!C.KINDS.includes(kind)) throw new Error("kind must be 2, 3 or 4");
  const s = C.start({ kind, n });
  const k = C.steps(s);
  const [p, q] = C.shaded(kind, k);
  return {
    kind, ratio: `1/${kind}`, n: s.n, steps: k, shaded: `${p}/${q}`, shadedValue: Number(p) / Number(q),
    limit: (C.LIMIT as Record<number, string>)[kind], shortOfLimitBy: `1/${(BigInt(kind - 1) * BigInt(kind) ** BigInt(k)).toString()}`,
    sum: C.sumText(s),
  };
}

export function actions(): GameActions {
  return {
    partialSum: {
      describe: "The shaded part of the square after N - 1 cuts for the picture 2, 3 or 4 (ratio 1/2, 1/3, 1/4), as an exact fraction, with the limit 1, 1/2 or 1/3 and how far short of it the sum still is.",
      args: '{ "kind": 3, "n": 4 }',
      run: (args) => read(Math.round(num(args, "kind", 2)), Math.round(num(args, "n", 5))),
    },
  };
}

export function position(state: Json): unknown {
  return read(Math.round(num(state, "kind", 2)), Math.round(num(state, "n", 1)));
}
