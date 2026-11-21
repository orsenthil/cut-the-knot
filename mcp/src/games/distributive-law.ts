/*
 * run_game_logic actions and saved-position reader for the Distributive Law.
 *
 * A block of NY rows by NX columns is cut into rectangles and the product
 * NY*NX is rewritten as a sum. Every answer comes from the game's real core.
 * See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["distributive-law"].DistributiveLawCore;
const size = (args: Json, key: string, fallback: number) => Math.max(1, Math.min(12, Math.trunc(num(args, key, fallback))));

export function actions(): GameActions {
  return {
    cut: {
      describe:
        "Cut a block of columns by rows once, at a gap after a given column (axis \"col\", c) or below a given row (axis \"row\", r), and give the product rewritten as a sum, in the applet's own notation (height*width). cuts may list several cuts to make in order.",
      args: '{ "columns": 5, "rows": 4, "cuts": [{ "axis": "col", "c": 1, "r": 0 }] }',
      run: (args) => {
        const C = core();
        let s = C.start({ nx: size(args, "columns", 5), ny: size(args, "rows", 4), parentheses: args.parentheses === true });
        const steps: unknown[] = [];
        for (const cut of Array.isArray(args.cuts) ? (args.cuts as Json[]) : []) {
          const next = C.move(s, { type: "cut", axis: cut.axis, c: Number(cut.c ?? 0), r: Number(cut.r ?? 0) });
          if (!next) { steps.push({ cut, refused: "that gap is not inside a piece" }); continue; }
          s = next;
          steps.push({ cut, written: C.expression(s) });
        }
        return { board: `${s.ny} rows of ${s.nx}`, written: C.expression(s), value: C.evaluate(C.expression(s)), product: s.nx * s.ny, cutsToSingleSquares: C.remaining(s), steps };
      },
    },
    count_cuts: {
      describe: "How many cuts it takes to cut a block of columns by rows into single squares (always columns*rows - 1, in any order), and the sum of ones it ends as.",
      args: '{ "columns": 5, "rows": 4 }',
      run: (args) => {
        const C = core();
        const s = C.start({ nx: size(args, "columns", 5), ny: size(args, "rows", 4) });
        return { product: s.nx * s.ny, cuts: C.remaining(s), cutsOpenNow: C.legalMoves(s).length, why: "each cut adds one piece and the block starts as one piece, so reaching N*M single squares takes N*M - 1 cuts, whatever the order" };
      },
    },
  };
}

/** What the core says about the block as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = { ...C.start({ nx: num(state, "nx", 5), ny: num(state, "ny", 4) }), ...(state.tree ? { tree: state.tree } : {}), parentheses: state.parentheses === true };
  const written = C.expression(s);
  return {
    board: `${s.ny} rows of ${s.nx}`,
    written,
    value: C.evaluate(written),
    product: s.nx * s.ny,
    pieces: C.pieces(s).length,
    cutsToGo: C.remaining(s),
    finished: C.remaining(s) === 0,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
