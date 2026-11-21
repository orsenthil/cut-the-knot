/*
 * run_game_logic actions and saved-position reader for Latin Squares.
 * The core lives in latin-squares/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["latin-squares"].LatinSquaresCore;
function read(args: Json) {
  const size = Number.isFinite(args.size) ? num(args, "size") : 5;
  if (Array.isArray(args.grid)) {
    const grid = args.grid.map((r) => (r as unknown[]).map(Number));
    return { size, symmetric: args.symmetric === true, grid, moves: Number.isFinite(args.moves) ? num(args, "moves") : 0 };
  }
  return core().start({ size, symmetric: args.symmetric !== false });
}

export function actions(): GameActions {
  return {
    check_grid: {
      describe: "Check whether a grid is Latin and symmetric about its main diagonal.",
      args: '{ "grid": [[1,2],[2,1]], "symmetric": true }',
      run: (args) => {
        const C = core();
        const state = read(args);
        const r = C.check(state);
        return { ...r, note: "Every row and column must contain each symbol once; symmetry is optional." };
      },
    },
    construct: {
      describe: "Build the cyclic Latin square, which is also symmetric, for a size.",
      args: '{ "size": 5 }',
      run: (args) => {
        const C = core();
        const size = Number.isFinite(args.size) ? num(args, "size") : 5;
        const grid = C.cyclic(size);
        return { size, grid, latin: C.isLatin(grid), symmetric: C.isSymmetric(grid), note: "Entry (i,j) is (i+j) mod n + 1." };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const input = read(state);
  const r = C.analyze(input);
  return {
    size: r.size, grid: r.grid, symmetric: input.symmetric,
    latin: r.latin, symmetricGrid: r.symmetric, solved: r.solved, moves: r.moves,
    note: r.solved ? "The grid solves the chosen problem." : "The grid still needs repair.",
  };
}
