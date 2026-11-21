/*
 * run_game_logic actions and saved-position reader for Figurate Numbers in the Multiplication Table.
 *
 * Sums along shapes of the multiplication table: the n by n corner is [n(n+1)/2]^2, the gnomon of
 * the nth row and column is n^3, the diagonal is 1^2 + ... + n^2 = n(n+1)(2n+1)/6, the anti-diagonal
 * is the tetrahedral number n(n+1)(n+2)/6. Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["figurate"].FigurateCore;

export function actions(): GameActions {
  return {
    identity: {
      describe: "Sum the cells of the multiplication table that one shape lights up for n (up to 60): mode is triangular-squares (the n by n corner), cubes (row n and column n), squares (the diagonal) or tetrahedral (the anti-diagonal i + j = n + 1). Gives the cells, their sum, the formula and whether they agree.",
      args: '{ "mode": "cubes", "n": 5 }',
      run: (args) => {
        const C = core();
        const mode = String(args.mode ?? "triangular-squares");
        if (!C.MODES.includes(mode)) throw new Error(`mode is one of ${C.MODES.join(", ")}`);
        const n = Math.trunc(num(args, "n", 5));
        if (n < 1 || n > 60) throw new Error("n runs from 1 to 60");
        const id = C.identity(mode, n);
        return { mode, n, cellCount: id.cells.length, cells: n <= 8 ? id.cells.map(([c, r]: number[]) => `${c}x${r}=${c * r}`) : undefined, sum: id.sum, formula: id.formula, agree: id.holds, text: id.text };
      },
    },
    which_n: {
      describe: "Which n the applet picks for a cell (column, row) of the 14 by 14 table in a mode (max(column, row), or column + row - 1 for tetrahedral), and the sum of the lit cells for it.",
      args: '{ "mode": "cubes", "column": 7, "row": 3 }',
      run: (args) => {
        const C = core();
        const mode = String(args.mode ?? "triangular-squares");
        if (!C.MODES.includes(mode)) throw new Error(`mode is one of ${C.MODES.join(", ")}`);
        const col = Math.trunc(num(args, "column", 1)), row = Math.trunc(num(args, "row", 1));
        const n = C.hoverIndex(mode, col, row);
        return n === 0 ? { n: 0, note: "that cell is outside the table or has no shape for this mode" } : { n, sum: C.identity(mode, n).sum, text: C.identity(mode, n).text };
      },
    },
  };
}

/** What the core says about the table as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ mode: String(state.mode ?? "triangular-squares") });
  const n = Math.max(0, Math.min(C.SIZE, Math.trunc(num(state, "n", 0))));
  const id = n > 0 ? C.identity(s.mode, n) : null;
  return {
    shape: s.mode,
    n,
    litCells: id ? id.cells.length : 0,
    sum: id ? id.sum : null,
    formula: id ? id.text : null,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
