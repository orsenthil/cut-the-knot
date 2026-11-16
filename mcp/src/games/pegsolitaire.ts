/*
 * run_game_logic actions and saved-position reader for Peg Solitaire.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

function boardOf(state: Json) {
  const P = cores.pegsolitaire.PegsolitaireCore;
  if (!Array.isArray(state.board)) throw new Error("position needs a board");
  return {
    gameNo: num(state, "gameNo", 6),
    name: String(state.name ?? ""),
    centerGoal: Boolean(state.centerGoal),
    board: state.board as number[][],
    starting: (Array.isArray(state.starting) ? state.starting : state.board) as number[][],
    selected: Array.isArray(state.selected) ? (state.selected as number[]) : null,
    history: [],
    designing: Boolean(state.designing),
    won: Boolean(state.won),
  };
}

export function actions(): GameActions {
  const P = cores.pegsolitaire.PegsolitaireCore;
  return {
    legal_jumps: {
      describe:
        "List every legal jump from a Peg Solitaire position. Pass gameNo (0–9) for a fresh puzzle, or a full board.",
      args: '{ "gameNo": 0 }',
      run: (args) => {
        const state = args.board ? boardOf(args) : P.start({ gameNo: num(args, "gameNo", 6) });
        return {
          puzzle: state.name || P.NAMES[state.gameNo],
          pegs: P.pegCount(state),
          jumps: P.legalMoves(state).map((m: { from: number[]; to: number[] }) => ({
            from: m.from,
            to: m.to,
          })),
          won: P.isWon(state),
        };
      },
    },
    apply_jump: {
      describe: "Apply one jump (from → to) on a fresh puzzle or a given board.",
      args: '{ "gameNo": 0, "from": [3, 2], "to": [1, 2] }',
      run: (args) => {
        let state = args.board ? boardOf(args) : P.start({ gameNo: num(args, "gameNo", 6) });
        const from = args.from as number[];
        const to = args.to as number[];
        if (!Array.isArray(from) || !Array.isArray(to)) throw new Error("from and to must be [row, col]");
        state = P.click(state, from[0], from[1]);
        state = P.click(state, to[0], to[1]);
        return {
          pegs: P.pegCount(state),
          won: state.won || P.isWon(state),
          board: state.board,
          movesSoFar: state.history.length,
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const P = cores.pegsolitaire.PegsolitaireCore;
  const game = boardOf(state);
  const jumps = P.legalMoves(game);
  return {
    puzzle: game.name || P.NAMES[game.gameNo],
    centerGoal: game.centerGoal,
    pegs: P.pegCount(game),
    movesSoFar: num(state, "historyLength", 0),
    selected: game.selected,
    designing: game.designing,
    won: game.won || P.isWon(game),
    legalJumps: jumps.length,
    note: game.won || P.isWon(game)
      ? "Solved."
      : jumps.length
        ? `${jumps.length} jump${jumps.length === 1 ? "" : "s"} available.`
        : "No jumps left — take back or reset.",
  };
}
