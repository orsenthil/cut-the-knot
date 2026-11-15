/*
 * run_game_logic actions and saved-position reader for No Silver Dollar.
 * Both use the same core as the browser page; see _shared.ts.
 */
import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

function build(positions: number[], turn: "you" | "computer" = "you") {
  const N = cores["no-silver-dollar"].NoSilverDollarCore;
  const length = Math.max(5, positions.length + 4, ...positions.map((p) => p + 1));
  return N.restore({ length, positions: positions.slice().sort((a, b) => a - b), turn, over: false, winner: null, moves: 0 });
}

export function actions(): GameActions {
  const N = cores["no-silver-dollar"].NoSilverDollarCore;
  return {
    gap_nim: {
      describe: "Read alternate gaps between counters as Nim heaps, calculate their XOR, and show the computer's winning move when one exists.",
      args: '{ "positions": [3, 7, 10] }',
      run: (args) => {
        const positions = numArray(args, "positions");
        const game = build(positions);
        const move = N.winningMove(game);
        return {
          positions: game.positions,
          heaps: N.heaps(game),
          nimSum: N.nimSum(game),
          playerToMoveCanWin: N.nimSum(game) !== 0,
          winningMove: move ? { counter: move.chip + 1, from: move.from, to: move.to } : null,
        };
      },
    },
    computer_reply: {
      describe: "Show the computer's reply for a No Silver Dollar position. When the Nim-sum is zero, all moves lose against perfect play and the applet chooses randomly.",
      args: '{ "positions": [3, 7, 10] }',
      run: (args) => {
        const positions = numArray(args, "positions");
        const game = build(positions, "computer");
        const before = N.nimSum(game);
        const next = N.computerMove(game, () => 0);
        return next ? { positionsAfter: next.positions, nimSumBefore: before, nimSumAfter: N.nimSum(next), finished: next.over,
          note: before === 0 ? "The Nim-sum was zero, so this is a losing position against perfect play; the reply represents one possible random move." : "The computer reduced one gap to make the Nim-sum zero." } : { finished: true };
      },
    },
  };
}

/** Explain a position saved by NoSilverDollarCore.snapshot(). */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported No Silver Dollar state version ${stateVersion}`);
  const N = cores["no-silver-dollar"].NoSilverDollarCore;
  const game = N.restore(state);
  const heaps: number[] = N.heaps(game);
  const nimSum: number = N.nimSum(game);
  const move = game.turn === "you" ? N.winningMove(game) : null;
  return {
    finished: game.over,
    boardLength: game.length,
    turn: game.turn,
    positions: game.positions,
    heaps,
    nimSum,
    youCanWinFromHere: nimSum !== 0,
    winningMove: move ? { counter: move.chip + 1, from: move.from, to: move.to } : null,
    note: nimSum === 0 ? "The gap Nim-sum is zero: the player to move loses against perfect play." : "Reduce a gap so the Nim-sum becomes zero; the computer follows this strategy when it is its turn.",
  };
}
