/*
 * run_game_logic actions and saved-position reader for Iterated Function
 * Systems. The core lives in iterated-function-systems/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["iterated-function-systems"].IteratedFunctionSystemsCore;
type Affine = { a: number; b: number; c: number; d: number; e: number; f: number };
const systems = () => core().SYSTEMS as Record<string, Affine[]>;

export function actions(): GameActions {
  return {
    orbit: {
      describe: "Run one step of the chaos game for a predefined system, reporting the new point and its contraction factors.",
      args: '{ "system": "Sierpinski gasket", "index": 1 }',
      run: (args) => {
        const C = core();
        const system = typeof args.system === "string" ? args.system : "Sierpinski gasket";
        if (!systems()[system]) throw new Error("unknown system");
        const index = Number(args.index) || 0;
        const state = { system, point: { x: 0, y: 0 }, iterations: 0 };
        const next = C.step(state, index);
        return {
          system,
          map: systems()[system][index],
          point: next.point,
          scales: systems()[system].map((t) => C.scale(t)),
          note: "The orbit of the random iteration converges to the attractor.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const system = typeof state.system === "string" && systems()[state.system] ? state.system : "Sierpinski gasket";
  const maps = systems()[system];
  return { system, maps: maps.length, scales: maps.map((t) => C.scale(t)), note: `${system} uses ${maps.length} affine maps.` };
}
