/*
 * Tutor actions and position reader for Scoring Misère: Two Heaps.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const S = cores["scoring-misere-2"].ScoringMisere2Core;
  return {
    second_player_wins: {
      describe: "Apply the Kalman–Keynes / page formula: does second player win from (a,b) with max move M?",
      args: '{ "a": 4, "b": 1, "maxMove": 3 }',
      run: (args) => {
        const a = num(args, "a", 0);
        const b = num(args, "b", 0);
        const M = num(args, "maxMove", 3);
        const win = S.secondPlayerWins(a, b, M);
        return {
          a,
          b,
          maxMove: M,
          residues: [S.rem(a, M), S.rem(b, M)],
          secondPlayerWins: win,
          note: win
            ? "Second player wins with best play."
            : "First player can force a win.",
        };
      },
    },
    computer_reply: {
      describe: "One CreateItinerary-style computer move from two heaps.",
      args: '{ "heaps": [6, 6], "maxMove": 3 }',
      run: (args) => {
        const heaps = (args.heaps as number[]) || [6, 6];
        let state = S.start({
          heaps,
          maxMove: num(args, "maxMove", 3),
          maxHeap: num(args, "maxHeap", 15),
        });
        state = { ...state, turn: "computer" };
        const choice = S.computerMove(state, () => 0.25);
        state = S.playComputer(state, () => 0.25);
        return { choice, heaps: state.heaps, over: state.over, winner: state.winner };
      },
    },
  };
}

export function position(state: Json): unknown {
  const S = cores["scoring-misere-2"].ScoringMisere2Core;
  const game = S.restore(state);
  const moves = S.legalMoves(game);
  const spw = S.secondPlayerWins(game.heaps[0], game.heaps[1], game.maxMove);
  return {
    finished: game.over,
    turn: game.turn,
    heaps: game.heaps.slice(),
    maxMove: game.maxMove,
    movesSoFar: num(state, "historyLength", 0),
    legalMoves: moves.length,
    secondPlayerWinsFromHere: game.turn === "you" ? spw : !spw && !game.over ? spw : spw,
    winner: game.winner,
    note: game.over
      ? game.winner === "you"
        ? "You won — the computer took the last chip."
        : "Computer won — you took the last chip."
      : `Heaps ${game.heaps[0]} and ${game.heaps[1]}; ${moves.length} legal takes.`,
  };
}
