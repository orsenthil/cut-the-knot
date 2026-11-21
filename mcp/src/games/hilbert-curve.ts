/*
 * run_game_logic actions and saved-position reader for the Hilbert curve.
 * The core lives in hilbert-curve/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["hilbert-curve"].HilbertCurveCore;

export function actions(): GameActions {
  return {
    curve: {
      describe: "Generate the Hilbert or Moore curve of an order, reporting its grid size and first points.",
      args: '{ "order": 3, "kind": "hilbert" }',
      run: (args) => {
        const C = core();
        const order = num(args, "order", 3);
        const kind = args.kind === "moore" ? "moore" : "hilbert";
        const pts = C.points(order, kind);
        return {
          order, kind, grid: 2 ** order, count: 4 ** order,
          firstPoints: pts.slice(0, 8),
          lastPoint: pts[pts.length - 1],
          note: "Every cell of the grid is visited exactly once by consecutive steps.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const order = num(state, "order", 3);
  const kind = state.kind === "moore" ? "moore" : "hilbert";
  return { order, kind, grid: 2 ** order, count: 4 ** order, note: `${kind} curve of order ${order}.` };
}
