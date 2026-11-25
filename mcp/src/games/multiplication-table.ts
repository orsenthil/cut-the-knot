/*
 * run_game_logic actions and saved-position reader for The Multiplication Table.
 * The core lives in multiplication-table/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["multiplication-table"].MultiplicationCore;

export function actions(): GameActions {
  return {
    where_is: {
      describe: "Every cell (row, column) of the 20 by 20 multiplication table that holds a product. 12 is in 6 cells; 60 in 8 (the most).",
      args: '{ "product": 12 }',
      run: (args) => { const p = Math.floor(num(args, "product")); const cells = core().cellsWith(p); return { product: p, count: cells.length, cells }; },
    },
  };
}

export function position(state: Json): unknown {
  const pk = state.picked as { a: number; b: number } | null;
  if (!pk) return { picked: null };
  const cells = core().cellsWith(pk.a * pk.b);
  return { picked: pk, product: pk.a * pk.b, timesInTheTable: cells.length, cells, note: "A product appears once for each way of writing it as a x b with a, b from 1 to 20; only squares appear an odd number of times." };
}
