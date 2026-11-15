/*
 * run_game_logic actions and saved-position reader for One Pile.
 * Both use the same core as the browser page; see _shared.ts.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

/** A position from the numbers a learner would give: the pile, Min and Max. */
function build(args: Json, turn: "you" | "computer") {
  const N = cores["one-pile"].OnePileCore;
  return N.restore({ n: num(args, "n"), min: num(args, "min", 8), max: num(args, "max", 40), turn, over: false, winner: null, history: [] });
}

export function actions(): GameActions {
  const N = cores["one-pile"].OnePileCore;
  return {
    winning_takes: {
      describe:
        "For the player about to move in One Pile: the takes that leave the other player a losing pile. A pile is lost for the player to move when its size, divided by Min + Max, leaves a remainder below Min.",
      args: '{ "n": 100, "min": 3, "max": 5 }',
      run: (args) => {
        const game = build(args, "you");
        const takes: number[] = N.winningMoves(game);
        return {
          pile: game.n,
          min: game.min,
          max: game.max,
          period: game.min + game.max,
          remainder: N.remainder(game.n, game.min, game.max),
          lostForPlayerToMove: N.isPPosition(game.n, game.min, game.max),
          winningTakes: takes,
        };
      },
    },
    computer_reply: {
      describe:
        "The take the applet's computer makes in One Pile. From a losing pile it has no good move and takes at random (never Max itself, as in the applet), so that answer varies.",
      args: '{ "n": 100, "min": 3, "max": 5 }',
      run: (args) => {
        const game = build(args, "computer");
        if (game.over) return { finished: true };
        const next = N.computerMove(game);
        if (!next) return { finished: true };
        return {
          take: game.n - next.n,
          pileAfter: next.n,
          pileWasLost: N.isPPosition(game.n, game.min, game.max),
          leftALosingPile: N.isPPosition(next.n, game.min, game.max),
          finished: next.over,
        };
      },
    },
  };
}

/** What the core says about a position saved by OnePileCore.snapshot(). */
export function position(state: Json): unknown {
  const N = cores["one-pile"].OnePileCore;
  const game = N.restore(state);
  const base = {
    pile: game.n,
    min: game.min,
    max: game.max,
    period: game.min + game.max,
    remainder: N.remainder(game.n, game.min, game.max),
    takesSoFar: game.history,
  };
  if (game.over) return { finished: true, winner: game.winner, ...base };
  const yours = game.turn === "you";
  const lost: boolean = N.isPPosition(game.n, game.min, game.max);
  const takes: number[] = yours ? N.winningMoves(game) : [];
  return {
    finished: false,
    turn: game.turn,
    ...base,
    youCanWinFromHere: yours ? !lost : lost,
    winningTakes: takes,
    note: lost
      ? "The pile is a losing one for the player to move: the remainder on division by Min + Max is below Min."
      : "The player to move can win by taking enough to leave a remainder below Min.",
  };
}
