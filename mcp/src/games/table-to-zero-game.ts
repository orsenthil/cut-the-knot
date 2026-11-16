/*
 * Tutor actions and position reader for Make It All Zeros.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

export function actions(): GameActions {
  const S = cores["table-to-zero-game"].TableToZeroGameCore;
  return {
    apply_move: {
      describe: "Double a row or subtract from a column (respects speedUp).",
      args: '{ "grid": [[1,2],[3,4]], "type": "col", "index": 0, "speedUp": false }',
      run: (args) => {
        let state = S.start({
          grid: (args.grid as number[][]) || [[1]],
          speedUp: Boolean(args.speedUp),
        });
        const type = String(args.type || "row");
        const index = num(args, "index", 0);
        state = S.move(state, { type, index }) || state;
        return { grid: state.grid, over: state.over, historyLength: state.history.length };
      },
    },
  };
}

export function position(state: Json): unknown {
  const S = cores["table-to-zero-game"].TableToZeroGameCore;
  const grid = (state.grid as number[][]) || [[0]];
  const game = S.restore({ grid, speedUp: state.speedUp });
  const over = Boolean(state.over) || S.finished(game);
  return {
    finished: over,
    nx: num(state, "nx", grid[0]?.length || 0),
    ny: num(state, "ny", grid.length),
    grid: S.copyGrid(grid),
    historyLength: num(state, "historyLength", 0),
    note: over ? "All zeros." : `Table ${grid.length}×${grid[0]?.length || 0}.`,
  };
}
