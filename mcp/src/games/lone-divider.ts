/*
 * run_game_logic actions and saved-position reader for the Lone Divider
 * method. The core lives in lone-divider/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["lone-divider"].LoneDividerCore;
function read(args: Json) {
  if (Array.isArray(args.table)) {
    const table = args.table.map((r) => (r as unknown[]).map(Boolean));
    return { n: Number.isFinite(args.n) ? num(args, "n") : table[0].length, table, divider: 0 };
  }
  return core().start({ n: Number.isFinite(args.n) ? num(args, "n") : 4 });
}

export function actions(): GameActions {
  return {
    divide: {
      describe: "Match acceptable pieces to choosers and give the rest to the divider.",
      args: '{ "table": [[true,false,true,false],[false,true,false,true],[false,false,true,true]] }',
      run: (args) => {
        const r = core().solve(read(args));
        return {
          solved: r.solved, assignments: r.assignments, dividerPieces: r.dividerPieces,
          matched: r.matched, choosers: r.choosers, note: r.note,
        };
      },
    },
    default_table: {
      describe: "Return the default preference table for a number of players.",
      args: '{ "n": 4 }',
      run: (args) => {
        const n = Number.isFinite(args.n) ? num(args, "n") : 4;
        const state = core().start({ n });
        return { n, table: state.table, note: "Each chooser accepts two overlapping pieces." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const input = read(state);
  const r = core().analyze(input);
  return {
    n: r.n, table: r.table,
    solved: r.solved, assignments: r.assignments, dividerPieces: r.dividerPieces,
    note: r.note,
  };
}
