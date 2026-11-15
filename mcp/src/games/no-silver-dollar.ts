/*
 * run_game_logic actions and saved-position reader for No Silver Dollar.
 * Both use the same core as the browser page; see _shared.ts.
 */
import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

function build(positions: number[], turn: "you" | "computer" = "you") {
  const N = cores["no-silver-dollar"].NoSilverDollarCore;
  const length = Math.max(5, positions.length + 3, ...positions.map((p) => p + 1));
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
        const before: number = N.nimSum(game);
        const move = N.computerChoice(game);
        if (!move) return { finished: true };
        const next = N.restore({ ...game, positions: game.positions.map((p: number, i: number) => (i === move.chip ? move.to : p)) });
        return {
          movedCounter: move.chip + 1,
          from: move.from,
          to: move.to,
          positionsAfter: next.positions,
          nimSumBefore: before,
          nimSumAfter: N.nimSum(next),
          why:
            before === 0
              ? "The Nim-sum was already 0, so every move loses against perfect play; the computer moved at random, so this answer varies."
              : "The computer made one gap smaller so that the Nim-sum became 0.",
          finished: N.legalMoves(next).length === 0,
        };
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
  const base = { boardLength: game.length, positions: game.positions, heaps, nimSum };
  if (game.over) return { finished: true, winner: game.winner, ...base };
  if (N.legalMoves(game).length === 0) {
    return { finished: false, turn: game.turn, ...base, youCanWinFromHere: false, winningMove: null,
      note: "No counter can move: this board was set up with nothing left to play." };
  }
  const yours = game.turn === "you";
  const move = yours ? N.winningMove(game) : null;
  return {
    finished: false,
    turn: game.turn,
    ...base,
    youCanWinFromHere: yours ? nimSum !== 0 : nimSum === 0,
    winningMove: move ? { counter: move.chip + 1, from: move.from, to: move.to } : null,
    note:
      nimSum === 0
        ? "The Nim-sum of the gaps is 0: whoever moves now loses if the other plays perfectly."
        : "The Nim-sum of the gaps is not 0: whoever moves now can win by making one gap smaller so that it becomes 0.",
  };
}
