/*
 * run_game_logic actions and saved-position reader for Moving Chips in Pairs Down a Checkerboard.
 * The core lives in moving-chips-in-pairs/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["moving-chips-in-pairs"].ChipsCore;

export function actions(): GameActions {
  return {
    solvable: {
      describe: "Whether the game can be won with N chips, one in every row and column (3..20): the starting height N(N-1)/2 must be even, i.e. N is 0 or 1 mod 4. Each move lowers the height by 2.",
      args: '{ "n": 8 }',
      run: (args) => { const n = core().clampN(num(args, "n", 10)); return { n, startingHeight: core().startHeight(n), solvable: core().startHeight(n) % 2 === 0 }; },
    },
    best_pair: {
      describe: "The strategy's next move for rows given as the row of the chip in each column (0 = top, n-1 = bottom): the two chips farthest from the bottom.",
      args: '{ "rows": [0, 3, 1, 2] }',
      run: (args) => {
        const r = args.rows;
        if (!Array.isArray(r)) throw new Error('"rows" must be an array');
        const rows = r.map(Number), n = rows.length;
        const s = { n, rows, selected: Array(n).fill(false), history: [] };
        const pair = core().bestPair(s);
        return { height: core().height(s), solvableFromHere: core().solvable(s), columns: pair };
      },
    },
  };
}

export function position(state: Json): unknown {
  const rows = (state.rows as number[]).map(Number), n = rows.length;
  const s = { n, rows, selected: state.selected as boolean[], history: [] };
  return { n, height: core().height(s), solvableFromHere: core().solvable(s), chipsOnBottom: core().atBottom(s), nextStrategyMove: core().bestPair(s), moves: state.moves, note: "Every move lowers the height by 2; an odd height can never reach 0. With an even height, moving the two highest chips always wins." };
}
