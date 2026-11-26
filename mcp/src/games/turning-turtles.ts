/*
 * run_game_logic actions and saved-position reader for Turning Turtles. The core lives in
 * turning-turtles/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["turning-turtles"].TurningTurtlesCore;

/** A row from a string of 11 O/X letters, or an array of booleans (true = X). */
function row(v: unknown): boolean[] {
  if (typeof v === "string") {
    const t = v.replace(/\s+/g, "").toUpperCase();
    if (!/^[OX]{11}$/.test(t)) throw new Error("row must be 11 letters O or X, square 1 first");
    return [...t].map((c) => c === "X");
  }
  if (Array.isArray(v) && v.length === 11) return v.map(Boolean);
  throw new Error("row must be 11 letters O or X, square 1 first");
}

function analyse(x: boolean[]) {
  const C = core();
  const sum = C.nimSum(x) as number;
  const oSquares = x.map((isX, i) => (isX ? 0 : i + 1)).filter((k) => k);
  let best: { turn: number; flip: number | null } | null = null;
  if (sum) {
    const c = C.choose({ ...C.start({ x }), turn: "me" });
    best = { turn: c.i + 1, flip: c.j === null ? null : c.j + 1 };
  }
  return {
    row: x.map((v) => (v ? "X" : "O")).join(""), oSquares,
    nimSum: sum, nimSumBinary: sum.toString(2),
    toMove: x.every(Boolean) ? "no move: the game is over" : sum ? "winning: there is a move to Nim-sum 0" : "losing: every move leaves a nonzero Nim-sum",
    winningMove: best,
  };
}

export function actions(): GameActions {
  return {
    analyse: {
      describe: "For a row of 11 squares (O or X, square 1 first): the O squares as Nim heaps, their Nim-sum, whether the player to move wins, and a winning move (square to turn to X, square to flip).",
      args: '{ "row": "OXOOXXOXOOO" }',
      run: (args) => analyse(row(args.row)),
    },
  };
}

export function position(state: Json): unknown {
  const x = row(state.x);
  const score = (state.score ?? {}) as Json;
  return { ...analyse(x), turn: state.turn === "me" ? "computer" : "player", score: { computer: Number(score.me) || 0, player: Number(score.you) || 0 } };
}
