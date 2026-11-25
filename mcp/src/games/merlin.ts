/*
 * run_game_logic actions and saved-position reader for Merlin's Magic Squares.
 * The core lives in merlin/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["merlin"].MerlinCore;

const board = (args: Json, key: string): number[] => {
  const v = args[key];
  if (!Array.isArray(v) || v.length !== 9) throw new Error(`"${key}" must be 9 numbers`);
  return v.map(Number);
};

export function actions(): GameActions {
  return {
    solve: {
      describe: "The presses that bring a board to a target: s with target = board + A s (mod N), by the applet's integer inverse. Boards and targets are 9 numbers (row by row) 0..N-1. geometry 0 Plane, 1 Torus (N = 3 only), 2 the hidden rules.",
      args: '{ "n": 3, "geometry": 0, "values": [1,2,1,1,2,1,1,2,0], "target": [1,1,1,1,0,1,1,1,1] }',
      run: (args) => {
        const n = Math.floor(num(args, "n", 3)), geometry = Math.floor(num(args, "geometry", 0));
        if (![2, 3, 4].includes(n)) throw new Error("n must be 2, 3 or 4");
        if (![0, 1, 2].includes(geometry)) throw new Error("geometry must be 0, 1 or 2");
        if (geometry === 1 && n !== 3) throw new Error("the torus is played with 3 states");
        const state = { n, geometry, values: board(args, "values").map((v) => ((v % n) + n) % n), target: board(args, "target").map((v) => ((v % n) + n) % n) };
        const presses = core().solve(state);
        return { n, geometry: core().NAMES[geometry], presses, totalPresses: presses.reduce((t: number, v: number) => t + v, 0) };
      },
    },
    press_effect: {
      describe: "Which buttons (0..8, row by row) advance when a button is pressed, in a geometry.",
      args: '{ "geometry": 0, "button": 0 }',
      run: (args) => {
        const g = Math.floor(num(args, "geometry", 0)), k = Math.floor(num(args, "button"));
        if (![0, 1, 2].includes(g) || k < 0 || k > 8) throw new Error("geometry 0..2, button 0..8");
        const v = core().pressVector(g, k);
        return { geometry: core().NAMES[g], button: k, advances: v.map((x: number, i: number) => (x ? i : -1)).filter((i: number) => i >= 0) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const n = Number(state.n), geometry = Number(state.geometry);
  const s = { n, geometry, values: (state.values as number[]).map(Number), target: (state.target as number[]).map(Number) };
  const presses = core().solve(s);
  return {
    states: n, geometry: core().NAMES[geometry], solved: core().solved(s), pressesThatSolveIt: presses, totalPresses: presses.reduce((t: number, v: number) => t + v, 0), hintShown: state.hintOn === true,
    note: "target = board + A s (mod N); A is invertible mod N for the plane with N = 2, 3, 4 and for the torus only with N = 3.",
  };
}
