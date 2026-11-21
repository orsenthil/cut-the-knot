/*
 * run_game_logic actions and saved-position reader for Filling a Grid with Good Neighbors.
 *
 * A chip may be added on a free square with at least two occupied 4-neighbours (all possible squares
 * at each step). N chips on a diagonal fill the N by N board in N - 1 steps; fewer than N never do,
 * since the perimeter of the occupied squares never grows. Every answer comes from the game's
 * real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["fill-the-board"].FillTheBoardCore;

/** Starting chips from the arguments: a list of [row, column] pairs counted from 1. */
function chipsOf(args: Json, n: number): number[][] {
  const raw = Array.isArray(args.chips) ? (args.chips as unknown[]) : [];
  return raw.map((p) => {
    if (!Array.isArray(p) || p.length !== 2) throw new Error("chips is a list of [row, column] pairs, counted from 1");
    const r = Number(p[0]), c = Number(p[1]);
    if (!(r >= 1 && r <= n && c >= 1 && c <= n)) throw new Error(`row and column run from 1 to ${n}`);
    return [r - 1, c - 1];
  });
}

export function actions(): GameActions {
  return {
    fill: {
      describe: "Run the game from a starting set of chips on an N by N board (N 2 to 15): chips is a list of [row, column] pairs counted from 1. Gives the number of steps until nothing more can be added, how many squares end up filled, whether the board is full, and the board with the step each square was filled on (0 for a chip).",
      args: '{ "n": 4, "chips": [[1,1],[2,2],[3,3],[4,4]] }',
      run: (args) => {
        const C = core();
        const n = Math.max(2, Math.min(15, Math.trunc(num(args, "n", 4))));
        const chips = chipsOf(args, n);
        const r = C.run(n, chips);
        const filled = r.grid.flat().filter((v: number) => v !== -1).length;
        return { n, chips: new Set(chips.map((c) => c.join())).size, steps: r.steps, filled, of: n * n, full: r.full, board: r.grid.map((row: number[]) => row.map((v) => (v === -1 ? "." : String(v))).join(" ")), perimeterOfTheEnd: C.perimeter(r.grid, n), note: r.full ? "The board fills." : "The filling stops before the board is full." };
      },
    },
    diagonal: {
      describe: "The page's example: N chips on a diagonal fill the N by N board in N - 1 steps (N 2 to 15), and why fewer than N chips cannot (the perimeter of the filled squares never grows).",
      args: '{ "n": 6 }',
      run: (args) => {
        const C = core();
        const n = Math.max(2, Math.min(15, Math.trunc(num(args, "n", 6))));
        const r = C.run(n, Array.from({ length: n }, (_, i) => [i, i]));
        return { n, chips: n, steps: r.steps, full: r.full, perimeterNeeded: 4 * n, perimeterOfOneChip: 4, whyNotFewer: `the full board has perimeter ${4 * n}; each chip starts with perimeter at most 4 and a step never raises it, so at least ${n} chips are needed` };
      },
    },
  };
}

/** What the core says about the board as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const n = Math.max(2, Math.min(15, Math.trunc(num(state, "n", 4))));
  const grid = Array.isArray(state.grid) ? (state.grid as number[][]) : null;
  const ok = grid && grid.length === n && grid.every((r) => Array.isArray(r) && r.length === n);
  const s = { ...C.start({ n }), ...(ok ? { grid } : {}), step: num(state, "step", 0), playing: state.playing === true };
  const chips = C.chips(s);
  const filled = C.count(s);
  // what would the filling reach from the chips alone?
  const chipCells: number[][] = [];
  s.grid.forEach((col: number[], x: number) => col.forEach((v: number, y: number) => { if (v === 0) chipCells.push([x, y]); }));
  const end = C.run(n, chipCells);
  return {
    size: n,
    mode: s.playing ? "play" : "setup",
    chips,
    filled,
    step: s.step,
    full: filled === n * n,
    fewestChipsPossible: n,
    chipsFromTheseWouldFill: end.full,
    stepsFromTheChipsAlone: end.steps,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
