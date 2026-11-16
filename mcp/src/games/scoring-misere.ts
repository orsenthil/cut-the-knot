/*
 * Tutor actions and position reader for Scoring Misère.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const S = cores["scoring-misere"].ScoringMisereCore;
  return {
    legal_moves: {
      describe: "List legal slides from a Scoring Misère position.",
      args: '{ "positions": [5, 1], "maxStep": 3, "length": 8 }',
      run: (args) => {
        const state = args.positions
          ? S.restore({
              positions: args.positions as number[],
              maxStep: num(args, "maxStep", 3),
              length: num(args, "length", 8),
              turn: "you",
              over: false,
            })
          : S.start({
              nRings: num(args, "nRings", 1),
              maxStep: num(args, "maxStep", 3),
              length: num(args, "length", 8),
              positions: args.positions as number[] | undefined,
            });
        return {
          positions: state.positions,
          maxStep: state.maxStep,
          moves: S.legalMoves(state),
          over: S.finished(state),
        };
      },
    },
    computer_reply: {
      describe: "Apply the applet's CreateItinerary computer move (seeded RNG optional).",
      args: '{ "positions": [5, 1], "maxStep": 3, "seed": 0.1 }',
      run: (args) => {
        let state = S.restore({
          positions: (args.positions as number[]) || [5],
          maxStep: num(args, "maxStep", 3),
          length: num(args, "length", 8),
          turn: "computer",
          over: false,
        });
        const seed = Number(args.seed);
        const rnd = Number.isFinite(seed) ? () => seed : Math.random;
        const choice = S.computerMove(state, rnd);
        state = S.playComputer(state, rnd);
        return { choice, positions: state.positions, over: state.over, winner: state.winner };
      },
    },
  };
}

export function position(state: Json): unknown {
  const S = cores["scoring-misere"].ScoringMisereCore;
  const game = S.restore(state);
  const moves = S.legalMoves(game);
  return {
    finished: game.over,
    turn: game.turn,
    positions: game.positions.slice(),
    maxStep: game.maxStep,
    length: game.length,
    movesSoFar: num(state, "historyLength", 0),
    legalMoves: moves.length,
    winner: game.winner,
    score: { wins: game.wins, losses: game.losses },
    note: game.over
      ? game.winner === "you"
        ? "You won — the computer took the last counter."
        : "Computer won — you took the last counter."
      : game.turn === "you"
        ? `${moves.length} legal slide${moves.length === 1 ? "" : "s"}.`
        : "Computer to move.",
  };
}
