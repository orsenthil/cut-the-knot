/*
 * run_game_logic actions and saved-position reader for the game of Y.
 *
 * The core (y-theory/ in the site, copied into src/generated/cores/ at build
 * time) models the triangular board and the majority reduction. See _shared.ts
 * for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["y-theory"].YTheoryCore;

function readBoard(args: Json): { n: number; cells: (string | null)[] } {
  const C = core();
  const n = num(args, "n");
  if (!Number.isInteger(n) || n < C.MIN_N || n > C.MAX_N) throw new Error(`n must be from ${C.MIN_N} to ${C.MAX_N}`);
  const raw = args.cells;
  if (!Array.isArray(raw) || raw.length !== n * n) throw new Error(`cells must have ${n * n} entries`);
  const cells = raw.map((value, id) => {
    const i = Math.floor(id / n);
    const j = id % n;
    if (i + j >= n) {
      if (value !== null) throw new Error(`cell ${id} is outside the triangle`);
      return null;
    }
    if (value !== C.BLUE && value !== C.RED) throw new Error(`cell ${id} must be "${C.BLUE}" or "${C.RED}"`);
    return value as string;
  });
  return { n, cells };
}

export function actions(): GameActions {
  return {
    check_winner: {
      describe:
        "For a full colouring of Y_n, name the winner, list the cells of the chain reaching all three sides, and check Meyers's two-of-three-subgames rule.",
      args: '{ "n": 3, "cells": ["blue","red","blue",null,"red","red",null,null,"blue"] }',
      run: (args) => {
        const C = core();
        const board = readBoard(args);
        const blue = C.winningChain(board, C.BLUE);
        const red = C.winningChain(board, C.RED);
        return {
          n: board.n,
          winner: blue && !red ? C.BLUE : red && !blue ? C.RED : null,
          blueChain: blue,
          redChain: red,
          meyersBlue: C.meyersWins(board, C.BLUE),
          meyersRed: C.meyersWins(board, C.RED),
          note: "Exactly one colour reaches all three sides on a full board of Y.",
        };
      },
    },
    reduce_board: {
      describe:
        "Apply the applet's reduction: each upward triangle of three cells becomes one cell of a board one size smaller, coloured by the majority.",
      args: '{ "n": 3, "cells": ["blue","red","blue",null,"red","red",null,null,"blue"] }',
      run: (args) => {
        const C = core();
        const board = readBoard(args);
        const smaller = C.reduce(board);
        if (!smaller) return { finished: true, note: "A board of size 1 has no smaller board." };
        const before = C.winner(board, C.BLUE) ? C.BLUE : C.winner(board, C.RED) ? C.RED : null;
        const after = C.winner(smaller, C.BLUE) ? C.BLUE : C.winner(smaller, C.RED) ? C.RED : null;
        return {
          n: smaller.n,
          cells: smaller.cells,
          dots: C.triples(board.n).map((triple) => C.majority(...triple)),
          winnerBefore: before,
          winnerAfter: after,
          winnerPreserved: before === after,
        };
      },
    },
    subgames: {
      describe:
        "The three boards of size n-1 obtained by deleting one side of Y_n, with the winner of each.",
      args: '{ "n": 4, "cells": ["blue","red","blue","red",null,"red","red","blue",null,null,"blue","red",null,null,null,"blue"] }',
      run: (args) => {
        const C = core();
        const board = readBoard(args);
        const sides = [0, 1, 2].map((side) => {
          const sub = C.subgame(board, side);
          return {
            side,
            n: sub?.n ?? 0,
            blueWins: sub ? C.winner(sub, C.BLUE) : false,
            redWins: sub ? C.winner(sub, C.RED) : false,
          };
        });
        const count = (color: string) => sides.filter((s) => (color === C.BLUE ? s.blueWins : s.redWins)).length;
        return {
          sides,
          blueSubgameWins: count(C.BLUE),
          redSubgameWins: count(C.RED),
          blueWinsHere: C.winner(board, C.BLUE),
          redWinsHere: C.winner(board, C.RED),
          note: "A board is a win for a colour exactly when at least two of these three subboards are.",
        };
      },
    },
  };
}

/** What the core says about a saved board: the winner and its shrinking history. */
export function position(state: Json): unknown {
  const C = core();
  const board = readBoard(state);
  const blue = C.winningChain(board, C.BLUE);
  const red = C.winningChain(board, C.RED);
  const smaller = C.reduce(board);
  const cellCount = board.cells.filter((c) => c !== null).length;
  return {
    n: board.n,
    cellCount,
    blueCells: board.cells.filter((c) => c === C.BLUE).length,
    redCells: board.cells.filter((c) => c === C.RED).length,
    winner: blue && !red ? C.BLUE : red && !blue ? C.RED : null,
    chainLength: Math.max(blue?.length ?? 0, red?.length ?? 0),
    chain: blue ?? red,
    reducedWinner: smaller
      ? C.winner(smaller, C.BLUE)
        ? C.BLUE
        : C.winner(smaller, C.RED)
          ? C.RED
          : null
      : null,
    note: smaller
      ? "Shrinking by majority makes a smaller board with the same winner."
      : "A single cell already reaches all three sides.",
  };
}
