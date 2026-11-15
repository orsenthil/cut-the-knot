/*
 * run_game_logic actions for mind-reader.
 *
 * Each action calls the game's real core (mind-reader/ in the site), copied into
 * src/generated/cores/ at build time. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

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

/**
 * What the core says about the table on the player's screen: the shape the
 * computer will name, and where it sits.
 */
export function position(state: Json): unknown {
  const M = cores["mind-reader"].MindReader;
  const figs = numArray(state, "figs");
  const special = Number(state.special);
  const magic = M.magicCells() as number[];
  return {
    shapeTheComputerWillName: M.SHAPES[special],
    itSitsOnEveryOneOf: magic,
    checksOut: magic.every((cell) => figs[cell] === special),
    secretShownOnScreen: state.secretShown === true,
    why: "A two-digit number minus the sum of its digits is always a multiple of 9, and every multiple of 9 in the table has the same shape.",
  };
}
