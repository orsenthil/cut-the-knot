/*
 * run_game_logic actions and saved-position reader for Magic in a Square.
 * The core lives in magic-in-square/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["magic-in-square"].MagicInSquareCore;

export function actions(): GameActions {
  return {
    trick: {
      describe: "Play the trick for a random deal of an n by n square (n 3 to 6): the player thinks of a number, says its column twice (the rows are turned into columns between), and the computer names it. Returns the number and the two columns.",
      args: '{ "n": 5, "number": 7 }',
      run: (args) => {
        const n = core().clampN(num(args, "n", 5)), s0 = core().start({ n });
        const number = Math.floor(num(args, "number", 1));
        if (number < 1 || number > n * n) throw new Error(`number must be 1..${n * n}`);
        const first = core().columnOf(s0, number), s1 = core().pick(s0, first), second = core().columnOf(s1, number);
        const s2 = core().pick(s1, second);
        return { n, thought: number, firstColumn: first + 1, secondColumn: second + 1, namedByTheComputer: core().answer(s2) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const answer = core().answer(state);
  return {
    n: state.n, stage: state.stage, firstColumn: Number(state.stage) >= 1 ? Number(state.col) + 1 : null, secondColumn: Number(state.stage) >= 2 ? Number(state.row) + 1 : null,
    numberNamed: answer,
    note: "The first answer gives the column; the rows are turned into columns, so the second answer gives the row. Row and column name the number.",
  };
}
