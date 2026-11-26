/*
 * run_game_logic actions and saved-position reader for Rooks and Matchings (VP vs VNP path).
 * The core lives in rook-placements/ and is copied into src/generated/cores/ at build time. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["rook-placements"].RookPlacementsCore;

function parse(v: unknown): boolean[][] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 8) throw new Error('board must be 1 to 8 rows like "1101" (1 open, 0 blocked)');
  const rows = v.map((r) => String(r).replace(/\s+/g, ""));
  if (rows.some((r) => r.length !== rows.length || !/^[01]+$/.test(r))) throw new Error("board must be square, made of 0 and 1");
  return rows.map((r) => [...r].map((c) => c === "1"));
}
const show = (open: boolean[][]) => open.map((r) => r.map((v) => (v ? "1" : "0")).join(""));

export function actions(): GameActions {
  return {
    count: {
      describe: 'For a square 0/1 board (rows like "1101", 1 = open, up to 8 x 8): whether a placement of non-attacking rooks on open squares exists (the quick test), how many there are (the permanent of the board), and up to 30 of them as the column of the rook in each row.',
      args: '{ "board": ["1101", "0111", "1011", "1110"] }',
      run: (args) => {
        const C = core();
        const open = parse(args.board);
        const all = C.placements(open) as number[][];
        return { exists: C.exists(open), count: all.length, placements: all.slice(0, 30).map((p) => p.map((j) => j + 1)) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 4), seed: num(state, "seed", 1), found: state.found });
  const rooks = (Array.isArray(state.rooks) ? state.rooks : []) as number[];
  return {
    board: show(s.open), rooksNow: rooks.map((j) => (j >= 0 ? j + 1 : null)),
    found: s.found.length, total: C.total(s), allFound: C.result(s) === "win",
    note: "The number of placements is the permanent of the 0/1 board; finding one is easy, counting them is #P-complete.",
  };
}
