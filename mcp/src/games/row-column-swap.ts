/*
 * Tutor actions and position reader for Row & Column Swaps.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const C = cores["row-column-swap"].RowColumnSwapCore;
  return {
    reachable: {
      describe:
        "Compare column-set invariants of the N=3 olympiad start and target (or a custom target), and report whether swaps can reach it.",
      args: '{ "n": 3 }',
      run: (args) => {
        const n = num(args, "n", 3);
        const start = C.initialGrid(n);
        const target = C.targetGrid(n);
        if (!target) {
          return {
            n: C.clampN(n),
            hasOlympiadTarget: false,
            note: "Only N=3 has the olympiad target on the page.",
          };
        }
        const bySets = C.reachableBySets(start, target);
        return {
          n: 3,
          startColumns: C.columnSets(start).map((s: number[]) => s.map((v) => v + 1)),
          targetColumns: C.columnSets(target).map((s: number[]) => s.map((v) => v + 1)),
          reachableByColumnSets: bySets,
          note: bySets
            ? "Column sets match — a search may still be needed."
            : "Column sets differ, so no sequence of row/column swaps reaches the target.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = cores["row-column-swap"].RowColumnSwapCore;
  const game = C.restore(state);
  const target = C.targetGrid(game.n);
  return {
    finished: !!game.explored,
    n: game.n,
    movesSoFar: Number(state.historyLength) || 0,
    explored: game.explored,
    matchesTarget: C.matchesTarget(game),
    hasOlympiadTarget: !!target,
    note: game.explored
      ? game.n === 3
        ? "You have swapped — watch the column bags; the olympiad target stays unreachable."
        : "You have swapped; column sets are preserved."
      : "Press two row arrows or two column arrows to swap.",
  };
}
