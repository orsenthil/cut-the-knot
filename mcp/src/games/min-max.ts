/*
 * run_game_logic actions and saved-position reader for The Minimax Principle.
 * The core lives in min-max/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["min-max"].MinMaxCore;

const table = (args: Json) => {
  const v = args.values;
  if (!Array.isArray(v) || v.length < 1 || !v.every((r) => Array.isArray(r) && r.length === (v[0] as unknown[]).length)) throw new Error('"values" must be a table: a list of equal rows of numbers');
  const values = v.map((r) => (r as unknown[]).map(Number));
  return { rows: values.length, cols: values[0].length, max: 20, values };
};

export function actions(): GameActions {
  return {
    analyse: {
      describe: "For a table of numbers: the row minimums, the column maximums, MaxMin (largest row minimum), MinMax (smallest column maximum), and the saddle points (entries largest in their column and smallest in their row) when the two are equal. MaxMin <= MinMax always.",
      args: '{ "values": [[1, 2], [3, 4]] }',
      run: (args) => core().analyse(table(args)),
    },
  };
}

export function position(state: Json): unknown {
  const s = { rows: Number(state.rows), cols: Number(state.cols), max: Number(state.max), values: state.values as number[][] };
  const a = core().analyse(s);
  return { ...a, note: "MaxMin never exceeds MinMax; they are equal exactly when some entry is the largest in its column and the smallest in its row." };
}
