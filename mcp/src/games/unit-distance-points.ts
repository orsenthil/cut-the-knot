/*
 * run_game_logic actions and saved-position reader for Unit Distance Points.
 * The core lives in unit-distance-points/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["unit-distance-points"].UnitDistanceCore;

const target = (n: number): number => (core().TARGETS as Record<number, number>)[n];

type Pt = { x: number; y: number };
const points = (args: Json): Pt[] => {
  const v = args.points;
  if (!Array.isArray(v)) throw new Error('argument "points" must be an array of {x, y}');
  return v.map((p, i) => {
    const x = Number((p as Json)?.x), y = Number((p as Json)?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`points[${i}] needs numeric x and y`);
    return { x, y };
  });
};

export function actions(): GameActions {
  return {
    count_pairs: {
      describe: "The pairs of the given points that are exactly 1 apart (within 1e-6), and how many.",
      args: '{ "points": [{"x":0,"y":0},{"x":1,"y":0},{"x":0.5,"y":0.8660254037844386}] }',
      run: (args) => { const p = points(args); const pairs = core().pairs(p); return { n: p.length, count: pairs.length, pairs }; },
    },
    best_known: {
      describe: "The most unit pairs possible for n = 3..9 points (3, 5, 7, 9, 12, 14, 18) and an arrangement that reaches it.",
      args: '{ "n": 7 }',
      run: (args) => {
        const n = core().clampN(num(args, "n", 5));
        const w = core().witness(n);
        return { n, mostPairs: target(n), arrangement: w, pairsInArrangement: core().count(w) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const p = points({ points: state.points });
  const n = p.length, c = core().count(p), most = target(n);
  return {
    points: n, pairsAtUnitDistance: c, mostPossible: most ?? null, reachedTheBest: c === most,
    note: "Pairs are exactly 1 apart. The best arrangements for 3..9 points are pieces of the triangular lattice, with a turned-triangle sum for 9.",
  };
}
