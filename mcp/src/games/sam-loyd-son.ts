/*
 * run_game_logic actions and saved-position reader for Sam Loyd's Son's Dissection. The core
 * lives in sam-loyd-son/ and is copied into src/generated/cores/ at build time. See _shared.ts
 * for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["sam-loyd-son"].SamLoydSonCore;

function sizes(n: number) {
  const C = core();
  if (!Number.isInteger(n) || n < C.MIN_N || n > C.MAX_N) throw new Error(`n must be ${C.MIN_N}..${C.MAX_N}`);
  const S = C.sizes(n), k = C.counts(n);
  return {
    n, square: `${S.c} x ${S.c}`, fibonacci: [S.a, S.b, S.c, S.d],
    squareCells: k.square, figureCells: k.figure, difference: k.figure - k.square,
    honestPieces: k.figure < k.square ? "overlap by one cell along the long slanted cut" : "leave a one-cell gap along the long slanted cut",
    cheatNudges: { x: S.cheatX, y: S.cheatY },
    degenerate: n === C.MIN_N,
  };
}

export function actions(): GameActions {
  return {
    sizes: {
      describe: "For the size index n (3..10; 5 is the 8 x 8 square), the Fibonacci numbers used, the square's cells, the cells the figure (block, row, block) seems to have, and whether the honest pieces overlap or leave a gap.",
      args: '{ "n": 5 }',
      run: (args) => sizes(Math.round(num(args, "n", 5))),
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const n = Math.max(C.MIN_N, Math.min(C.MAX_N, Math.round(num(state, "n", 5))));
  const placed = Array.isArray(state.placed) ? (state.placed as unknown[]).map(Boolean) : [false, false, false, false];
  const names = C.pieces(n, false).map((p: { name: string }) => p.name);
  return {
    ...sizes(n), cheat: state.cheat === true,
    piecesInFigure: names.filter((_: string, i: number) => placed[i]),
    piecesInSquare: names.filter((_: string, i: number) => !placed[i]),
    allPlaced: placed.every(Boolean),
  };
}
