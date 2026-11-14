/*
 * run_game_logic actions for four-knights.
 *
 * Each action calls the game's real core (four-knights/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions } from "./_shared.js";

export function actions(): GameActions {
  const K = cores["four-knights"].KnightsCore;
  return {
    shortest_solution: {
      describe: "The fewest knight moves that swap the two colours. Searched, not looked up.",
      args: "{}",
      run: () => ({
        moves: K.shortestSolution(),
        why: "The centre square is unreachable by a knight, so the eight outer squares form one 8-cycle. Knights cannot pass each other on a cycle, so swapping the colours means rotating all four knights four places.",
      }),
    },
    cycle: {
      describe: "The 3x3 board redrawn as the cycle that knight moves actually form.",
      args: "{}",
      run: () => {
        const ring = [];
        for (let r = 1; r <= 8; r++) {
          ring.push({ position: r, square: K.cellOf(r), neighbours: K.neighbors(r), startsAs: (K.HOME as Record<number, string>)[r] ?? null });
        }
        return { ring, centre: "unreachable by a knight, so it is not on the cycle" };
      },
    },
    legal_moves: {
      describe: "Legal destinations for the knight at a ring position, given who sits where.",
      args: '{ "occupied": { "1": "red", "3": "red", "5": "blue", "7": "blue" }, "ring": 1 }',
      run: (args) => {
        const occupied = (args.occupied as Record<string, string>) ?? K.start().occupied;
        return { moves: K.legalMoves({ occupied, moves: 0 }, num(args, "ring")) };
      },
    },
  };
}
