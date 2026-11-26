/*
 * run_game_logic actions and saved-position reader for Fill the Hex Grid. The core lives in
 * play-hex-design/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["play-hex-design"].PlayHexDesignCore;

const node = (args: Json, key: string): [number, number] => {
  const v = numArray(args, key);
  if (v.length !== 2) throw new Error(`"${key}" must be [i, j]`);
  return [Math.floor(v[0]), Math.floor(v[1])];
};

export function actions(): GameActions {
  return {
    product: {
      describe: "The dot a click on P makes from the last dot L on the N x N torus: L turned 60 degrees clockwise about P, (L.i + L.j - P.j, P.i + P.j - L.i) mod N.",
      args: '{ "n": 3, "click": [2, 1], "last": [1, 1] }',
      run: (args) => {
        const n = Math.floor(num(args, "n", 3));
        return { product: core().product(n, node(args, "click"), node(args, "last")) };
      },
    },
    click_for: {
      describe: "Which dot to click so the last dot L turns onto a chosen target: the inverse of the product, always one answer (the product table is a quasigroup).",
      args: '{ "n": 3, "last": [1, 1], "target": [0, 2] }',
      run: (args) => {
        const n = Math.floor(num(args, "n", 3));
        return { click: core().solveFor(n, node(args, "last"), node(args, "target")) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 3) });
  const moves = Array.isArray(state.moves) ? (state.moves as number[][]) : [];
  const here = { ...s, moves, missed: num(state, "missed", 0), alert: state.alert ?? null };
  const last = C.last(here);
  let empty: number[] | null = null;
  for (let t = 0; t < here.n * here.n && !empty; t++) { const d = [t % here.n, Math.floor(t / here.n)]; if (!C.isSelected(here, d)) empty = d; }
  return {
    n: here.n, filled: moves.length, of: here.n * here.n, missteps: here.missed, lastDot: last,
    done: C.result(here) === "win",
    aClickThatFillsANewDot: last && empty ? { click: C.solveFor(here.n, last, empty), fills: empty } : null,
    note: "Every empty dot can be reached from the last one by exactly one click, so the board can always be filled with no missteps.",
  };
}
