/*
 * run_game_logic actions and saved-position reader for Plainim.
 * Both use the same core as the browser page; see _shared.ts.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

function binary(n: number) {
  return n.toString(2);
}

function build(args: Json, turn: "you" | "computer") {
  const P = cores.plainim.PlainimCore;
  const heaps = numArray(args, "heaps");
  const cols = num(args, "cols", 5);
  const misere = !!(args as { misere?: boolean }).misere;
  return P.restore({
    cols,
    rows: heaps.length,
    heaps,
    misere,
    turn,
    over: false,
    winner: null,
    wins: 0,
    losses: 0,
  });
}

export function actions(): GameActions {
  const P = cores.plainim.PlainimCore;
  return {
    nim_sum: {
      describe:
        "The Nim-sum (XOR) of the row heaps in Plainim, each heap in binary, and every legal move that leaves a Nim-sum of 0. A Nim-sum of 0 means the player to move loses against perfect play (normal play).",
      args: '{ "heaps": [6, 4], "cols": 4 }',
      run: (args) => {
        const game = build(args, "you");
        const sum: number = P.nimSum(game);
        return {
          heaps: game.heaps.map((h: number) => ({ value: h, binary: binary(h) })),
          nimSum: sum,
          nimSumBinary: binary(sum),
          playerToMoveCanWin: sum !== 0,
          movesThatLeaveZero: P.winningMoves(game).map((m: { row: number; mask: number }) => ({
            row: m.row + 1,
            mask: m.mask,
            maskBinary: binary(m.mask),
            heapAfter: game.heaps[m.row] ^ m.mask,
          })),
        };
      },
    },
    computer_reply: {
      describe:
        "The move the applet's computer makes on these heaps. With a Nim-sum of 0 it has no good move and picks a random legal mask, so that answer varies.",
      args: '{ "heaps": [6, 4], "cols": 4 }',
      run: (args) => {
        const game = build(args, "computer");
        if (game.over) return { finished: true };
        const before: number = P.nimSum(game);
        const pick = P.chooseComputerMove(game, () => 0);
        const next = P.computerMove(game, () => 0);
        if (!pick || !next) return { finished: true };
        return {
          row: pick.row + 1,
          mask: pick.mask,
          maskBinary: binary(pick.mask),
          heapsAfter: next.heaps,
          nimSumBefore: before,
          nimSumAfter: P.nimSum(next),
          why:
            before === 0
              ? "The Nim-sum was already 0, so every move loses against perfect play; the computer moved at random."
              : "The computer XORed the Nim-sum onto the row whose (heap AND Nim-sum) was largest, leaving a Nim-sum of 0.",
          finished: next.over,
        };
      },
    },
  };
}

/** What the core says about a position saved by PlainimCore.snapshot(). */
export function position(state: Json): unknown {
  const P = cores.plainim.PlainimCore;
  const game = P.restore(state);
  const base = {
    cols: game.cols,
    rows: game.rows,
    misere: game.misere,
    heaps: game.heaps.slice(),
    heapsBinary: game.heaps.map((h: number) => binary(h)),
  };
  if (game.over) {
    return { finished: true, winner: game.winner, ...base };
  }
  const sum: number = P.nimSum(game);
  const yours = game.turn === "you";
  const wins = game.misere ? [] : P.winningMoves(game);
  return {
    finished: false,
    turn: game.turn,
    ...base,
    nimSum: sum,
    nimSumBinary: binary(sum),
    youCanWinFromHere: game.misere ? null : yours ? sum !== 0 : sum === 0,
    winningMoves: wins.map((m: { row: number; mask: number }) => ({
      row: m.row + 1,
      mask: m.mask,
    })),
    note: game.misere
      ? "Misère play: the Nim-sum plan holds until the endgame with at most one heap bigger than 1."
      : sum === 0
        ? "The Nim-sum is 0: the player to move loses against perfect play."
        : "The player to move can win by leaving a Nim-sum of 0.",
  };
}
