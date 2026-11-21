/*
 * run_game_logic actions and saved-position reader for Conway's Life.
 * The core lives in game-of-life/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["game-of-life"].GameOfLifeCore;
function read(args: Json) {
  const size = Number.isFinite(args.size) ? num(args, "size") : 20;
  if (typeof args.encoded === "string") {
    const rows = args.encoded.split("/").map((r) => r.split("").map((c) => c === "1"));
    if (rows.length && rows[0].length === rows.length) {
      return { size: rows.length, cells: rows, generation: Number.isFinite(args.generation) ? num(args, "generation") : 0, history: [] };
    }
  }
  return core().start({ size });
}

export function actions(): GameActions {
  return {
    step: {
      describe: "Apply one generation of Conway's birth and survival rules.",
      args: '{ "encoded": "00000/11100/00000/00000/00000" }',
      run: (args) => {
        const C = core();
        const before = read(args);
        const after = C.step(before);
        return {
          before: C.encode(before), after: C.encode(after),
          population: C.population(after), generation: after.generation,
          note: "Three neighbours give birth; two or three keep a cell alive.",
        };
      },
    },
    pattern: {
      describe: "Place a known pattern (block, blinker, toad, beacon or glider) on an empty board.",
      args: '{ "name": "glider", "x": 4, "y": 4, "size": 12 }',
      run: (args) => {
        const C = core();
        const size = Number.isFinite(args.size) ? num(args, "size") : 12;
        const state = C.place(C.start({ size }), String(args.name || "glider"), Number(args.x) || 0, Number(args.y) || 0);
        return {
          size, pattern: args.name || "glider", encoded: C.encode(state),
          population: C.population(state),
          note: "A glider moves one cell diagonally every four generations.",
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const input = read(state);
  return {
    size: input.size, generation: input.generation,
    population: C.population(input), encoded: C.encode(input),
    note: `Generation ${input.generation} with ${C.population(input)} live cells.`,
  };
}
