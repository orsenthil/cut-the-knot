/*
 * run_game_logic actions for nimble.
 *
 * Each action calls the game's real core (nimble/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const binary = (n: number) => n.toString(2);

/** A game on the given chip positions, long enough to hold them all. */
function build(chips: number[], turn: "you" | "computer") {
  const N = cores.nimble.NimbleCore;
  return N.restore({ length: Math.max(...chips, 0) + 1, chips, turn });
}

export function actions(): GameActions {
  const N = cores.nimble.NimbleCore;
  return {
    nim_sum: {
      describe:
        "The Nim-sum (XOR) of the chip positions, with each position in binary, and every move that leaves a Nim-sum of 0. A Nim-sum of 0 means the player to move loses against perfect play.",
      args: '{ "chips": [3, 5, 6] }',
      run: (args) => {
        const chips = numArray(args, "chips");
        const game = build(chips, "you");
        const sum: number = N.nimSum(game);
        return {
          chips: chips.map((position) => ({ position, binary: binary(position) })),
          nimSum: sum,
          nimSumBinary: binary(sum),
          playerToMoveCanWin: sum !== 0,
          movesThatLeaveZero: N.winningMoves(game).map((m: { chipId: number; from: number; dest: number }) => ({
            chip: m.chipId + 1,
            from: m.from,
            to: m.dest,
          })),
        };
      },
    },
    computer_reply: {
      describe:
        "The move the computer makes on these chip positions. With a Nim-sum of 0 it has no good move and moves at random, so the answer then varies.",
      args: '{ "chips": [3, 5, 6] }',
      run: (args) => {
        const chips = numArray(args, "chips");
        const game = build(chips, "computer");
        if (game.over) return { finished: true };
        const before: number = N.nimSum(game);
        const move = N.computerMove(game);
        if (!move) return { finished: true };
        return {
          movedChip: move.chipId + 1,
          from: move.from,
          to: move.dest,
          chipsAfter: game.chips.map((c: { pos: number }) => c.pos),
          nimSumBefore: before,
          nimSumAfter: N.nimSum(game),
          why:
            before === 0
              ? "The Nim-sum was already 0, so every move loses against perfect play; the computer moved at random."
              : "The computer moved the chip whose position shares the Nim-sum's highest bit to (position XOR Nim-sum), which leaves a Nim-sum of 0.",
          finished: game.over,
        };
      },
    },
  };
}

/**
 * What the core says about a position saved by the page (NimbleCore.snapshot):
 * where the chips are, the Nim-sum, and the moves that win from here.
 */
export function position(state: Json): unknown {
  const N = cores.nimble.NimbleCore;
  const game = N.restore(state);
  const sum: number = N.nimSum(game);
  const chips = game.chips.map((c: { id: number; pos: number }) => ({
    chip: c.id + 1,
    position: c.pos,
    binary: binary(c.pos),
    home: c.pos === 0,
  }));
  if (game.over) return { finished: true, boardLength: game.length, chips };
  const yours = game.turn === "you";
  return {
    finished: false,
    boardLength: game.length,
    turn: game.turn,
    chips,
    nimSum: sum,
    nimSumBinary: binary(sum),
    youCanWinFromHere: yours ? sum !== 0 : sum === 0,
    winningMoves: yours
      ? N.winningMoves(game).map((m: { chipId: number; from: number; dest: number }) => ({
          chip: m.chipId + 1,
          from: m.from,
          to: m.dest,
        }))
      : [],
    note:
      sum === 0
        ? "The Nim-sum is 0: whoever moves now loses if the other plays perfectly."
        : "The Nim-sum is not 0: whoever moves now can win by moving a chip so that the Nim-sum becomes 0.",
  };
}
