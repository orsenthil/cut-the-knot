/*
 * run_game_logic actions for four-by-four.
 *
 * Each action calls the game's real core (four-by-four/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions } from "./_shared.js";

export function actions(): GameActions {
  const F = cores["four-by-four"].FourByFourCore;
  return {
    winning_lines: {
      describe: "All 76 lines of four in the 4x4x4 cube, as cell indices (cell = 16z + 4y + x).",
      args: "{}",
      run: () => ({ count: F.COMB.length, lines: F.COMB }),
    },
    lines_through: {
      describe: "Every winning line that passes through a given cell, which is how the cube's geometry becomes visible.",
      args: '{ "cell": 21 }',
      run: (args) => {
        const cell = num(args, "cell");
        if (cell < 0 || cell > 63) throw new Error("cell must be 0..63");
        const lines = F.COMB.filter((l: number[]) => l.includes(cell));
        return { cell, coords: F.xyz(cell), lineCount: lines.length, lines };
      },
    },
    machine_reply: {
      describe:
        "The computer's answer to a human move on an empty board, played by the applet's own pattern-matching logic (which does not look ahead).",
      args: '{ "humanCells": [21] }',
      run: (args) => {
        const cells = numArray(args, "humanCells");
        const B = F.create();
        F.newGame(B);
        const played: unknown[] = [];
        for (const cell of cells) {
          if (cell < 0 || cell > 63) throw new Error("cells must be 0..63");
          const before = B.occupied.slice();
          F.selection(B, cell);
          const reply = [];
          for (let c = 0; c < 64; c++) {
            if (before[c] !== B.occupied[c] && c !== cell && B.occupied[c] === F.MACHINE) reply.push(c);
          }
          played.push({ human: cell, machine: reply[0] ?? null, machineCoords: reply[0] != null ? F.xyz(reply[0]) : null });
        }
        return { moves: played, gameOver: B.player === F.END };
      },
    },
  };
}
