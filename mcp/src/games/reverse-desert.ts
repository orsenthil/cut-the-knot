/*
 * run_game_logic actions and saved-position reader for Scout out of Desert.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const R = cores["reverse-desert"].ReverseDesertCore;
  return {
    opening_moves: {
      describe:
        "Legal reverse-jumps from the default start (or a restored board), and whether the desert is already clear.",
      args: '{ "cols": 4, "habitable": 3, "level": 2 }',
      run: (args) => {
        const game = R.start(args);
        return {
          cols: game.cols,
          rows: game.rows,
          level: game.level,
          scouts: R.scoutCount(game),
          desertClear: R.desertClear(game),
          legalMoves: R.legalMoves(game).map((m: { from: { x: number; y: number }; to: { x: number; y: number } }) => ({
            from: [m.from.x, m.from.y],
            to: [m.to.x, m.to.y],
          })),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const R = cores["reverse-desert"].ReverseDesertCore;
  const game = R.restore(state);
  return {
    finished: game.won,
    cols: game.cols,
    rows: game.rows,
    level: game.level,
    scouts: R.scoutCount(game),
    desertClear: R.desertClear(game),
    movesSoFar: Number(state.historyLength) || 0,
    legalMoves: game.won ? 0 : R.legalMoves(game).length,
    note: game.won
      ? "The desert strip is empty — congratulations."
      : "Clear every scout from the top Level rows by reverse-jumping.",
  };
}
