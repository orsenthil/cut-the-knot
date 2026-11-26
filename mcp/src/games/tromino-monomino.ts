/*
 * run_game_logic actions and saved-position reader for Straight Tromino on a Chessboard. The
 * core lives in tromino-monomino/ and is copied into src/generated/cores/ at build time. See
 * _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["tromino-monomino"].TrominoMonominoCore;
type Piece = [number, number, number, number];

/** A square from its chess name (a1 bottom left) on an n-row board. */
function parse(n: number, name: string): [number, number] {
  const m = /^([a-t])(\d{1,2})$/.exec(String(name).trim().toLowerCase());
  if (!m) throw new Error(`"${name}" is not a square name like c3`);
  return [n - Number(m[2]), m[1].charCodeAt(0) - 97];
}

export function actions(): GameActions {
  return {
    places: {
      describe: "For an N x M board (3..10 each) with NM leaving remainder 1 mod 3: every square where the single monomino can go, found by trying to cover the rest with straight trominoes (squares named like chess, a1 bottom left).",
      args: '{ "n": 8, "m": 8 }',
      run: (args) => {
        const C = core();
        const n = Math.round(num(args, "n", 8)), m = Math.round(num(args, "m", n));
        if (n < 3 || m < 3 || n > 10 || m > 10) throw new Error("n and m must be 3..10");
        if ((n * m) % 3 !== 1) throw new Error("NM must leave remainder 1 when divided by 3 (one monomino)");
        const s = C.start({ n, m });
        const out: string[] = [];
        for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if (C.cover(n, m, [[i, j]])) out.push(C.name(s, i, j));
        return { n, m, places: out, count: out.length };
      },
    },
    cover: {
      describe: "Try to cover an N x M board (3..10) with straight trominoes leaving the given squares free (one or two, by chess name). Returns the trominoes (end squares) or says it cannot be done, with whether Golomb's colourings balance.",
      args: '{ "n": 8, "m": 8, "free": ["c3"] }',
      run: (args) => {
        const C = core();
        const n = Math.round(num(args, "n", 8)), m = Math.round(num(args, "m", n));
        if (n < 3 || m < 3 || n > 10 || m > 10) throw new Error("n and m must be 3..10");
        const free = (Array.isArray(args.free) ? args.free : []).map((x) => parse(n, String(x)));
        if ((n * m - free.length) % 3 !== 0) throw new Error("the squares left to cover must be a multiple of 3");
        const s = C.start({ n, m });
        const t = (C.balanced(n, m, free) ? C.cover(n, m, free) : null) as Piece[] | null; // unbalanced colours already rule it out
        return {
          n, m, free: free.map(([i, j]) => C.name(s, i, j)), coloursBalance: C.balanced(n, m, free), possible: !!t,
          trominoes: t ? t.map(([a, b, c, d]) => `${C.name(s, a, b)}-${C.name(s, c, d)}`) : null,
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 8), m: num(state, "m", num(state, "n", 8)) });
  let t = s;
  for (const p of (Array.isArray(state.pieces) ? state.pieces : []) as Piece[]) t = C.place(t, ...p) ?? t;
  const free = C.free(t) as [number, number][];
  return {
    board: `${t.n} x ${t.m}`, placed: t.pieces.length, needed: C.target(t), finished: C.finished(t),
    trominoes: (t.pieces as Piece[]).map(([a, b, c, d]) => `${C.name(t, a, b)}-${C.name(t, c, d)}`),
    freeSquares: free.length <= 12 ? free.map(([i, j]) => C.name(t, i, j)) : free.length,
    note: "On 8 x 8 the monomino can only be c3, c6, f3 or f6 (Golomb's three colourings).",
  };
}
