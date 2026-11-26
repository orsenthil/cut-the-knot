/*
 * run_game_logic actions and saved-position reader for Pascal's Triangle. The core lives in
 * pascal-triangle/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["pascal-triangle"].PascalTriangleCore;

export function actions(): GameActions {
  return {
    row: {
      describe: "Row n of Pascal's triangle (the number of itineraries from the top dot to each dot of row n), how it is built from the row above, and its sum 2^n.",
      args: '{ "n": 6 }',
      run: (args) => {
        const n = Math.min(core().MAX_ROWS - 1, Math.max(0, Math.floor(num(args, "n"))));
        const t = core().build(n + 1) as number[][];
        return { n, row: t[n], rowAbove: n > 0 ? t[n - 1] : null, sum: t[n].reduce((a, b) => a + b, 0), twoToTheN: 2 ** n, itinerariesCountedOneByOne: core().itineraries(n) };
      },
    },
    choose: {
      describe: "C(n, m): the number of itineraries to dot m of row n, equal to n choose m, with the two parents that add up to it.",
      args: '{ "n": 7, "m": 3 }',
      run: (args) => {
        const n = Math.min(15, Math.max(0, Math.floor(num(args, "n")))), m = Math.min(n, Math.max(0, Math.floor(num(args, "m"))));
        const t = core().build(n + 1) as number[][];
        const parents = (core().parents(n, m) as number[][]).map(([a, b]) => ({ row: a, place: b, value: t[a][b] }));
        return { n, m, value: t[n][m], choose: core().choose(n, m), parents, sumOfParents: parents.reduce((s, p) => s + p.value, 0) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const rows = Number(state.rows);
  const t = core().build(rows) as number[][];
  const pick = Array.isArray(state.pick) ? (state.pick as number[]) : null;
  const out: Json = { rows, shape: state.form, arrowsShown: state.arrows === true, lastRow: t[rows - 1], lastRowSum: 2 ** (rows - 1) };
  if (pick) {
    const [n, m] = pick;
    const parents = (core().parents(n, m) as number[][]).map(([a, b]) => ({ row: a, place: b, value: t[a][b] }));
    out.pressed = { row: n, place: m, value: t[n][m], parents, sumOfParents: parents.reduce((s, p) => s + p.value, 0) };
  }
  out.note = "Each dot is the sum of the two above it; row n adds up to 2^n; every row reads the same backwards.";
  return out;
}
