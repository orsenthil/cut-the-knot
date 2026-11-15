/*
 * run_game_logic actions for four-by-four.
 *
 * Each action calls the game's real core (four-by-four/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

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

/**
 * What the core's table of winning lines says about a position saved by the
 * page: lines either side can complete at once, and lines still open.
 */
export function position(state: Json): unknown {
  const F = cores["four-by-four"].FourByFourCore;
  const human = new Set(numArray(state, "human"));
  const machine = new Set(numArray(state, "machine"));

  const youCanWinAt: number[] = [];
  const computerThreatensAt: number[] = [];
  let openForYou = 0;
  let openForComputer = 0;
  for (const line of F.COMB as number[][]) {
    const yours = line.filter((c) => human.has(c)).length;
    const theirs = line.filter((c) => machine.has(c)).length;
    const empty = line.filter((c) => !human.has(c) && !machine.has(c));
    if (theirs === 0) openForYou++;
    if (yours === 0) openForComputer++;
    if (yours === 3 && theirs === 0) youCanWinAt.push(empty[0]);
    if (theirs === 3 && yours === 0) computerThreatensAt.push(empty[0]);
  }
  const unique = (cells: number[]) => [...new Set(cells)].map((cell) => ({ cell, ...F.xyz(cell) }));

  return {
    over: state.over === true,
    movesSoFar: Number(state.moves) || 0,
    skill: Number(state.skill),
    yourCells: [...human],
    computerCells: [...machine],
    youCanWinAt: unique(youCanWinAt),
    computerThreatensAt: unique(computerThreatensAt),
    linesStillOpenForYou: openForYou,
    linesStillOpenForComputer: openForComputer,
    note: "cell = 16z + 4y + x. Two threats at once cannot both be blocked; that is how this game is won.",
  };
}
