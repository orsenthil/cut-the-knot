/*
 * run_game_logic actions and saved-position reader for Two Colors in Two Rows
 * II. The core lives in item-parity-generalized/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["item-parity-generalized"].ItemParityGeneralizedCore;
function read(args: Json) {
  if (!Array.isArray(args.rows) || args.rows.length !== 2) throw new Error("rows must be two arrays");
  const rows = args.rows.map((r) => {
    if (!Array.isArray(r)) throw new Error("each row must be an array");
    return r.map((c) => (String(c).toUpperCase() === "R" ? "R" : "B"));
  });
  return { cols: rows[0].length, rows, moves: Number.isFinite(args.moves) ? Number(args.moves) : 0 };
}

export function actions(): GameActions {
  return {
    joints: {
      describe: "Check the generalized setup and count red and blue joints between the two rows.",
      args: '{ "rows": [["R","R","R","B"],["B","B","B","R"]] }',
      run: (args) => {
        const r = core().analyze(read(args));
        return {
          setupValid: r.setupValid, cols: r.cols,
          redTop: r.redTop, blueTop: r.blueTop, redBottom: r.redBottom, blueBottom: r.blueBottom,
          red: r.red, blue: r.blue, equal: r.equal,
          unmatchedRedTop: r.unmatchedRedTop, unmatchedBlueBottom: r.unmatchedBlueBottom,
          note: "Red above equals blue below and blue above equals red below; that forces the joints to match.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const input = read(state);
  const r = core().analyze(input);
  return {
    cols: r.cols, rows: input.rows, setupValid: r.setupValid,
    red: r.red, blue: r.blue, equal: r.equal,
    redTop: r.redTop, moves: input.moves,
    note: `${r.red} red joints and ${r.blue} blue joints.`,
  };
}
