/*
 * Tutor actions and position reader for Reverse Solitaire.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

function boardOf(state: Json) {
  const R = cores.rsolitaire.RsolitaireCore;
  if (!Array.isArray(state.board)) throw new Error("position needs a board");
  const gameNo = num(state, "gameNo", 6);
  return {
    gameNo,
    name: String(state.name ?? R.NAMES[gameNo] ?? ""),
    board: state.board as number[][],
    goal: R.GOALS[Math.max(0, Math.min(R.GOALS.length - 1, gameNo))],
    selected: Array.isArray(state.selected) ? (state.selected as number[]) : null,
    history: [],
    won: Boolean(state.won),
  };
}

export function actions(): GameActions {
  const R = cores.rsolitaire.RsolitaireCore;
  return {
    legal_jumps: {
      describe:
        "List every legal reverse jump from a Reverse Solitaire position. Pass gameNo (0–8) for a fresh puzzle, or a full board.",
      args: '{ "gameNo": 0 }',
      run: (args) => {
        const state = args.board ? boardOf(args) : R.start({ gameNo: num(args, "gameNo", 6) });
        return {
          puzzle: state.name || R.NAMES[state.gameNo],
          pegs: R.pegCount(state),
          jumps: R.legalMoves(state).map((m: { from: number[]; to: number[] }) => ({
            from: m.from,
            to: m.to,
          })),
          won: R.isWon(state),
        };
      },
    },
    apply_jump: {
      describe: "Apply one reverse jump (from → to) on a fresh puzzle or a given board.",
      args: '{ "gameNo": 0, "from": [3, 3], "to": [3, 1] }',
      run: (args) => {
        let state = args.board ? boardOf(args) : R.start({ gameNo: num(args, "gameNo", 6) });
        const from = args.from as number[];
        const to = args.to as number[];
        if (!Array.isArray(from) || !Array.isArray(to)) throw new Error("from and to must be [row, col]");
        state = R.click(state, from[0], from[1]);
        state = R.click(state, to[0], to[1]);
        return {
          pegs: R.pegCount(state),
          won: state.won || R.isWon(state),
          board: state.board,
          movesSoFar: state.history.length,
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const R = cores.rsolitaire.RsolitaireCore;
  const game = boardOf(state);
  const jumps = R.legalMoves(game);
  return {
    puzzle: game.name || R.NAMES[game.gameNo],
    pegs: R.pegCount(game),
    movesSoFar: num(state, "historyLength", 0),
    selected: game.selected,
    won: game.won || R.isWon(game),
    legalJumps: jumps.length,
    note: game.won || R.isWon(game)
      ? "Solved — the goal pattern is rebuilt."
      : jumps.length
        ? `${jumps.length} reverse jump${jumps.length === 1 ? "" : "s"} available.`
        : "No jumps left — take back or reset.",
  };
}
