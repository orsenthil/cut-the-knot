/*
 * run_game_logic actions and saved-position reader for Two Colors in Two Rows.
 * The core lives in item-parity/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["item-parity"].ItemParityCore;
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
      describe: "Count the red and blue joins between two balanced rows and check they match.",
      args: '{ "rows": [["R","R","B","B"],["R","B","B","R"]] }',
      run: (args) => {
        const r = core().analyze(read(args));
        return {
          cols: r.cols, red: r.red, blue: r.blue, equal: r.equal,
          redJoints: r.redJoints, blueJoints: r.blueJoints,
          note: "Unmatched red cells in one row match unmatched blue cells in the other, so the counts agree.",
        };
      },
    },
    grid: {
      describe: "Count red and blue joins across every adjacent row and column of a balanced grid.",
      args: '{ "grid": [["R","R","B","B"],["B","B","R","R"],["R","R","B","B"],["B","B","R","R"]] }',
      run: (args) => {
        if (!Array.isArray(args.grid)) throw new Error("grid must be an array of rows");
        const grid = args.grid.map((r) => (r as unknown[]).map((c) => String(c).toUpperCase() === "R" ? "R" : "B"));
        return { ...core().gridEqual(grid), note: "Adding the equal counts over all adjacent pairs gives equal totals." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const input = read(state);
  const r = core().analyze(input);
  return {
    cols: r.cols, rows: input.rows, redJoints: r.redJoints, blueJoints: r.blueJoints,
    red: r.red, blue: r.blue, equal: r.equal, moves: input.moves,
    note: `${r.red} red joints and ${r.blue} blue joints.`,
  };
}
