/*
 * Tutor actions and position reader for Squares, Circles, and Triangles.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const S = cores.sct.SctCore;
  return {
    invariants: {
      describe:
        "Report counts and whether a target finish is allowed by the elimination / no-elimination invariants.",
      args: '{ "shapes": [1, 2, 1, 2, 3], "eliminate": true, "target": 3 }',
      run: (args) => {
        const shapes = (args.shapes as number[]) || [1, 2, 3];
        const eliminate = Boolean(args.eliminate);
        const target = num(args, "target", 3);
        const counts = S.counts(shapes);
        return {
          counts,
          eliminate,
          target,
          targetName: (S.NAMES as Record<number, string>)[target],
          allowed: eliminate
            ? S.canReachEliminate(shapes, target)
            : S.canReachNoEliminate(shapes, target),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const S = cores.sct.SctCore;
  const names = S.NAMES as Record<number, string>;
  const game = S.restore(state);
  const counts = S.counts(game.shapes);
  const rem = Number(game.remaining) || 0;
  return {
    finished: game.over,
    eliminate: game.eliminate,
    counts,
    remaining: game.remaining,
    remainingName: rem ? names[rem] : null,
    movesSoFar: num(state, "historyLength", 0),
    note: game.over
      ? `Done — ${names[rem] || "shapes"} remain.`
      : `Counts (s,c,t)=(${counts.s},${counts.c},${counts.t}).`,
  };
}
