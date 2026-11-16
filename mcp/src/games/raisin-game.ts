/*
 * run_game_logic actions and saved-position reader for Candy Squares.
 */
import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const R = cores["raisin-game"].RaisinGameCore;
  return {
    strategy: {
      describe:
        "Whether the two heap sizes are a winning position (at least one even) and the cuts that leave both heaps odd.",
      args: '{ "heaps": [6, 5] }',
      run: (args) => {
        const heaps = numArray(args, "heaps");
        if (heaps.length !== 2) throw new Error("heaps must be a pair");
        const game = R.restore({ heaps, turn: "you", over: false, winner: null, wins: 0, losses: 0, max: 30, random: false });
        const winning = R.isWinning(heaps);
        return {
          heaps,
          youCanWinFromHere: winning,
          winningCuts: R.winningMoves(game).map((m: { which: number; k: number }) => ({
            heap: m.which + 1,
            cutAfter: m.k,
            leaves: [m.k, heaps[m.which] - m.k],
          })),
          note: winning
            ? "At least one heap is even: cut an even heap into two odds."
            : "Both heaps are odd: every cut leaves an even for a careful opponent.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const R = cores["raisin-game"].RaisinGameCore;
  const game = R.restore(state);
  const base = {
    heaps: game.heaps.slice(),
    parities: game.heaps.map((h: number) => (h % 2 === 0 ? "even" : "odd")),
  };
  if (game.over) {
    return { finished: true, winner: game.winner, ...base };
  }
  const winning = R.isWinning(game.heaps);
  const yours = game.turn === "you";
  return {
    finished: false,
    turn: game.turn,
    ...base,
    youCanWinFromHere: yours ? winning : !winning,
    winningCuts: yours
      ? R.winningMoves(game).map((m: { which: number; k: number }) => ({
          heap: m.which + 1,
          cutAfter: m.k,
        }))
      : [],
    note: winning
      ? "At least one heap is even: the player to move can win."
      : "Both heaps are odd: the player to move loses against perfect play.",
  };
}
