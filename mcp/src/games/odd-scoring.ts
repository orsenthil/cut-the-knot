/*
 * run_game_logic actions and saved-position reader for Odd Scoring.
 * Both use the same core as the browser page; see _shared.ts.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

/** A position from the numbers a learner would give: steps left and each player's steps so far. */
function build(args: Json, turn: "you" | "computer") {
  const N = cores["odd-scoring"].OddScoringCore;
  const left = num(args, "left");
  const you = num(args, "you", 0);
  const computer = num(args, "computer", 0);
  return N.restore({ steps: left + you + computer, left, you, computer, turn });
}

const parity = (n: number) => (n % 2 === 0 ? "even" : "odd");

export function actions(): GameActions {
  const N = cores["odd-scoring"].OddScoringCore;
  return {
    winning_moves: {
      describe:
        "For the player about to move in Odd Scoring: the step counts (1 to 3) that win against perfect play. Give the steps left and the steps each player has made; the three must add up to an odd number.",
      args: '{ "left": 11, "you": 0, "computer": 0 }',
      run: (args) => {
        const game = build(args, "you");
        const moves: number[] = N.winningMoves(game);
        return {
          stepsLeft: game.left,
          yourTotal: `${game.you} (${parity(game.you)})`,
          youCanWinFromHere: moves.length > 0,
          winningMoves: moves,
          rule: "The player to move is lost when the steps left, divided by 8, leave 1 or 4 with an even total of their own, or 0 or 5 with an odd total.",
        };
      },
    },
    computer_reply: {
      describe:
        "The move the applet's computer makes in Odd Scoring. Beyond 8 steps it plays plain Scoring (leave a multiple of 4), which is not always the best move; when it sees nothing good it moves at random, so that answer varies.",
      args: '{ "left": 9, "you": 2, "computer": 0 }',
      run: (args) => {
        const game = build(args, "computer");
        if (game.over) return { finished: true };
        const planned: number = N.evaluation(game.left, game.computer);
        const best: number[] = N.winningMoves(game);
        const next = N.computerMove(game);
        return {
          steps: game.left - next.left,
          stepsLeftAfter: next.left,
          random: planned === 0,
          aWinningMoveExisted: best.length > 0,
          itWasAWinningMove: best.includes(game.left - next.left),
          finished: next.over,
          winner: next.winner,
        };
      },
    },
  };
}

/** What the core says about a position saved by OddScoringCore.snapshot(). */
export function position(state: Json): unknown {
  const N = cores["odd-scoring"].OddScoringCore;
  const game = N.restore(state);
  const base = { bandSteps: game.steps, stepsLeft: game.left, yourSteps: game.you, computerSteps: game.computer };
  if (game.over) return { finished: true, winner: game.winner, ...base };
  const yours = game.turn === "you";
  const moves: number[] = N.winningMoves(game);
  return {
    finished: false,
    turn: game.turn,
    ...base,
    yourTotalIs: parity(game.you),
    youCanWinFromHere: yours ? moves.length > 0 : moves.length === 0,
    winningMoves: yours ? moves : [],
    note: yours
      ? moves.length > 0
        ? "There is a move that leaves the computer lost against perfect play."
        : "Every move here loses against perfect play, but the applet's computer makes mistakes when more than 7 steps are left."
      : "It is the computer's turn.",
  };
}
