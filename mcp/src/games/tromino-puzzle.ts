/*
 * Tutor actions and position reader for Tromino Puzzle.
 *
 * The page saves the exponent, the gap and the pieces placed so far. The core
 * rebuilds exactly that position, so the tutor can say how far the tiling has
 * got, whether a pocket has made it stuck, and what Golomb's construction
 * would place next.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Cell = { row: number; col: number };
type Piece = [number, number][];
type Game = {
  exp: number;
  n: number;
  blank: Cell;
  pending: Cell[];
  pieces: { cells: Cell[]; type: number }[];
};

/** Turn a saved piece list into core cells. */
const toCells = (piece: Piece): Cell[] =>
  (piece || []).map(([row, col]) => ({ row: Number(row), col: Number(col) }));

function restore(state: Json) {
  const C = cores["tromino-puzzle"].TrominoPuzzleCore as any;
  const exp = Number(state.exp) > 0 ? C.clampExp(Number(state.exp)) : C.DEFAULT_EXP;
  const n = 2 ** exp;
  const blank = (state.blank as Cell | undefined) ?? { row: 0, col: 0 };
  const row = Number(blank.row) || 0;
  const col = Number(blank.col) || 0;
  if (row < 0 || row >= n || col < 0 || col >= n) {
    throw new Error(`the gap must be inside a ${n} by ${n} board`);
  }
  let game = C.start({ exp, blank: { row, col } }) as Game;
  const saved = Array.isArray(state.pieces) ? (state.pieces as Piece[]) : [];
  for (const piece of saved) {
    const next = C.place(game, toCells(piece));
    if (!next) throw new Error(`the saved piece ${JSON.stringify(piece)} does not fit the board`);
    game = next;
  }
  return { C, game };
}

/**
 * Golomb's construction, independently of the page: split into quarters, put
 * one L round the centre covering the three quarters without the gap, repeat.
 * Returned in click order (arm, corner, arm) so the pieces can be played.
 */
function golombTiling(C: any, n: number, blank: Cell): { cells: Cell[]; type: number }[] {
  if (n === 1) return [];
  const h = n / 2;
  const quadrant = (r: number, c: number) => (r < h ? (c < h ? 0 : 1) : (c < h ? 3 : 2));
  const holeQ = quadrant(blank.row, blank.col);
  const centre = [
    { q: 0, row: h - 1, col: h - 1 },
    { q: 1, row: h - 1, col: h },
    { q: 2, row: h, col: h },
    { q: 3, row: h, col: h - 1 },
  ];
  const around = centre.filter((c) => c.q !== holeQ).map(({ row, col }) => ({ row, col }));
  const pieces: { cells: Cell[]; type: number }[] = [{ cells: C.pathOrder(around), type: C.orientation(around) }];
  const quarters = [
    { r: 0, c: 0, q: 0 },
    { r: 0, c: h, q: 1 },
    { r: h, c: h, q: 2 },
    { r: h, c: 0, q: 3 },
  ];
  for (const Q of quarters) {
    const localBlank = Q.q === holeQ
      ? { row: blank.row - Q.r, col: blank.col - Q.c }
      : (() => {
          const used = centre.find((c) => c.q === Q.q)!;
          return { row: used.row - Q.r, col: used.col - Q.c };
        })();
    for (const p of golombTiling(C, h, localBlank)) {
      pieces.push({
        cells: p.cells.map((c) => ({ row: c.row + Q.r, col: c.col + Q.c })),
        type: p.type,
      });
    }
  }
  return pieces;
}

const QUADRANT = ["upper-left", "upper-right", "lower-right", "lower-left"];

export function actions(): GameActions {
  return {
    piece_count: {
      describe:
        "How many L-trominoes tile a 2^exp by 2^exp board with one square missing. Exp is 1-5, giving boards 2x2 to 32x32.",
      args: '{ "exp": 3 }',
      run: (args) => {
        const C = cores["tromino-puzzle"].TrominoPuzzleCore;
        const exp = C.clampExp(num(args, "exp", C.DEFAULT_EXP));
        const n = 2 ** exp;
        return {
          exp,
          board: `${n} x ${n}`,
          squares: n * n,
          pieces: (n * n - 1) / 3,
        };
      },
    },
    golomb_tiling: {
      describe:
        "Show Golomb's tiling of the board: the Ls to place, each as three cells in click order, starting with the centre L. Exp 1-5, cells 0-based.",
      args: '{ "exp": 3, "col": 2, "row": 5 }',
      run: (args) => {
        const C = cores["tromino-puzzle"].TrominoPuzzleCore;
        const exp = C.clampExp(num(args, "exp", C.DEFAULT_EXP));
        const n = 2 ** exp;
        const col = num(args, "col", 0);
        const row = num(args, "row", 0);
        if (col < 0 || col >= n || row < 0 || row >= n) {
          throw new Error(`the gap must be inside a ${n} by ${n} board`);
        }
        const pieces = golombTiling(C, n, { row, col });
        // Prove the answer by playing it on the core.
        let game = C.start({ exp, blank: { row, col } });
        for (const p of pieces) game = C.place(game, p.cells);
        if (!game || C.result(game) !== "win") {
          throw new Error("the construction did not tile the board");
        }
        return {
          exp,
          board: `${n} x ${n}`,
          gap: { col: col + 1, row: row + 1 },
          count: pieces.length,
          pieces: pieces.map((p) => ({
            cells: p.cells.map((c) => [c.row, c.col]),
            leavesEmpty: QUADRANT[p.type],
          })),
        };
      },
    },
    check_pieces: {
      describe:
        "Check a proposed set of pieces on a board: place them all, then report coverage, whether it wins, and whether it is stuck. Cells 0-based; each piece is three [row, col] cells in any order.",
      args: '{ "exp": 3, "col": 2, "row": 5, "pieces": [[[3,4],[4,4],[4,3]]] }',
      run: (args) => {
        const C = cores["tromino-puzzle"].TrominoPuzzleCore;
        const exp = C.clampExp(num(args, "exp", C.DEFAULT_EXP));
        const n = 2 ** exp;
        const col = num(args, "col", 0);
        const row = num(args, "row", 0);
        const pieces = Array.isArray(args.pieces) ? (args.pieces as Piece[]) : [];
        let game = C.start({ exp, blank: { row, col } });
        for (let i = 0; i < pieces.length; i++) {
          const next = C.place(game, toCells(pieces[i]));
          if (!next) return { ok: false, badPiece: i, reason: "that piece overlaps, leaves the board, or is not an L" };
          game = next;
        }
        return {
          ok: true,
          finished: C.result(game) === "win",
          placed: game.pieces.length,
          piecesNeeded: (n * n - 1) / 3,
          squaresLeft: n * n - 1 - C.coveredCount(game),
          canPlace: C.canPlace(game),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const { C, game } = restore(state);
  const done = C.result(game) === "win";
  const byOrientation = [0, 0, 0, 0] as number[];
  for (const p of game.pieces) byOrientation[p.type]++;
  const n = game.n;
  const left = n * n - 1 - C.coveredCount(game);

  return {
    finished: done,
    exp: game.exp,
    boardSize: n,
    gap: {
      col: game.blank.col + 1, // 1-based for the tutor
      row: game.blank.row + 1,
    },
    piecesPlaced: game.pieces.length,
    piecesNeeded: (n * n - 1) / 3,
    squaresLeft: left,
    canPlaceAnother: C.canPlace(game),
    piecesByOrientation: byOrientation,
    note: done
      ? `The ${n} by ${n} board is fully covered by ${game.pieces.length} L-trominoes.`
      : C.canPlace(game)
        ? `${game.pieces.length} of ${(n * n - 1) / 3} L-trominoes placed, ${left} squares left to cover.`
        : `Stuck: ${game.pieces.length} L-trominoes placed and no L fits in the ${left} free squares. Remove a piece.`,
  };
}
