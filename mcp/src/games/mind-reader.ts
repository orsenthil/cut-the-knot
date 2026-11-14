/*
 * run_game_logic actions for mind-reader.
 *
 * Each action calls the game's real core (mind-reader/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions } from "./_shared.js";

export function actions(): GameActions {
  const M = cores["mind-reader"].MindReader;
  return {
    predict: {
      describe: "Runs the trick on a number: subtract its digit sum and land on a multiple of 9.",
      args: '{ "number": 47 }',
      run: (args) => {
        const n = num(args, "number");
        if (n < 0 || n >= M.CELLS) throw new Error(`number must be between 0 and ${M.CELLS - 1}`);
        const a = Math.floor(n / 10);
        const b = n % 10;
        return {
          number: n,
          digitSum: a + b,
          result: M.digitSumResult(n),
          isMarkedCell: M.magicCells().includes(M.digitSumResult(n)),
          why: `10a + b - (a + b) = 9a, so ${n} gives 9 x ${a} = ${9 * a}. Every result is a multiple of 9, and the table shows the same shape on all of them.`,
        };
      },
    },
    marked_cells: {
      describe: "The cells that always carry the special shape.",
      args: "{}",
      run: () => ({ cells: M.magicCells(), count: M.magicCells().length }),
    },
  };
}
