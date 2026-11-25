/*
 * run_game_logic actions and saved-position reader for Northcott's Game. The
 * core lives in northcotts-game/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["northcotts-game"].NorthcottCore;

export function actions(): GameActions {
  return {
    analyse: {
      describe: "A Northcott board as the columns of each row's white and black checker: the gaps (the Nim heaps), their nim-sum, who is winning, and a winning move for white when there is one. The player to move loses exactly when the nim-sum is 0.",
      args: '{ "nx": 11, "white": [2, 8], "black": [6, 1], "turn": "white" }',
      run: (args) => {
        const white = numArray(args, "white"), black = numArray(args, "black");
        const state = { nx: Math.floor(num(args, "nx", 11)), ny: white.length, white, black, turn: args.turn === "black" ? "black" : "white" };
        const x = core().nimSum(state) as number;
        return { gaps: core().gaps(state), nimSum: x, sideToMoveIsWinning: x !== 0, winningMoveForWhite: state.turn === "white" ? core().hint(state) : null, computersReply: state.turn === "black" ? core().computerMove(state) : null };
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = { nx: state.nx, ny: state.ny, white: state.white, black: state.black, turn: state.turn };
  const result = core().result(s);
  const x = core().nimSum(s) as number;
  return {
    turn: state.turn, gaps: core().gaps(s), nimSum: x, result,
    playerToMoveIsWinning: !result ? x !== 0 : null,
    winningMove: state.turn === "white" && !result ? core().hint(s) : null,
    note: "Each row's gap is a Nim heap; moving a checker away adds beans but the opponent can take them off again. The player to move loses exactly when the XOR of the gaps is 0.",
  };
}
