/*
 * Tutor actions and position reader for Deficient Squares.
 *
 * The page saves the side, the gap and the pieces placed so far. The core
 * rebuilds exactly that position, so the tutor can say how far the tiling has
 * got, whether the board could be tiled at all, and whether a pocket has made
 * it stuck.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Cell = { row: number; col: number };
type Piece = [number, number][];
type Game = {
  n: number;
  blank: Cell;
  pending: Cell[];
  pieces: { cells: Cell[]; type: number }[];
};

/** Turn a saved piece list into core cells. */
const toCells = (piece: Piece): Cell[] =>
  (piece || []).map(([row, col]) => ({ row: Number(row), col: Number(col) }));

function restore(state: Json) {
  const C = cores["deficient-squares"].DeficientSquaresCore as any;
  const n = C.clampN(Number(state.n) || C.DEFAULT_N);
  const blank = (state.blank as Cell | undefined) ?? { row: 0, col: 0 };
  const row = Number(blank.row) || 0;
  const col = Number(blank.col) || 0;
  if (row < 0 || row >= n || col < 0 || col >= n) {
    throw new Error(`the gap must be inside a ${n} by ${n} board`);
  }
  let game = C.start({ n, blank: { row, col } }) as Game;
  const saved = Array.isArray(state.pieces) ? (state.pieces as Piece[]) : [];
  for (const piece of saved) {
    const next = C.place(game, toCells(piece));
    if (!next) throw new Error(`the saved piece ${JSON.stringify(piece)} does not fit the board`);
    game = next;
  }
  return { C, game };
}

/** Why a board cannot be tiled, or null when it can. */
function reason(C: any, n: number, gap: Cell): string | null {
  if (C.tileable(n, gap)) return null;
  if (n % 3 === 0) {
    return `A ${n} by ${n} board has ${n * n - 1} squares left, which is not a multiple of 3, so no L-tromino tiling exists.`;
  }
  return "On a 5 by 5 board only the four corners and the centre can be the gap.";
}

export function actions(): GameActions {
  return {
    tileable: {
      describe:
        "Say whether a deficient n by n board with a given gap can be tiled by L-trominoes, and why not. Side 2-24, cells 0-based.",
      args: '{ "n": 5, "row": 0, "col": 1 }',
      run: (args) => {
        const C = cores["deficient-squares"].DeficientSquaresCore as any;
        const n = C.clampN(num(args, "n", C.DEFAULT_N));
        const row = num(args, "row", 0);
        const col = num(args, "col", 0);
        if (row < 0 || row >= n || col < 0 || col >= n) {
          throw new Error(`the gap must be inside a ${n} by ${n} board`);
        }
        return {
          n,
          gap: { row: row + 1, col: col + 1 },
          tileable: C.tileable(n, { row, col }),
          reason: reason(C, n, { row, col }),
        };
      },
    },
    piece_count: {
      describe:
        "How many L-trominoes a deficient n by n board needs, or that no whole number works. Side 2-24.",
      args: '{ "n": 5 }',
      run: (args) => {
        const C = cores["deficient-squares"].DeficientSquaresCore as any;
        const n = C.clampN(num(args, "n", C.DEFAULT_N));
        const pieces = C.piecesNeeded(n);
        return {
          n,
          squares: n * n,
          squaresLeft: n * n - 1,
          pieces,
          reason: pieces === null
            ? `${n * n - 1} is not a multiple of 3, so no tiling exists for any gap.`
            : null,
        };
      },
    },
    working_gaps: {
      describe:
        "List the gaps from which an n by n deficient board can be tiled. Every gap works unless the side is a multiple of 3 (none work) or the side is 5 (only corners and centre). Gaps are 1-based.",
      args: '{ "n": 5 }',
      run: (args) => {
        const C = cores["deficient-squares"].DeficientSquaresCore as any;
        const n = C.clampN(num(args, "n", C.DEFAULT_N));
        const gaps: { row: number; col: number }[] = [];
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (C.tileable(n, { row: r, col: c })) gaps.push({ row: r + 1, col: c + 1 });
          }
        }
        return {
          n,
          count: gaps.length,
          gaps: gaps.length <= 49 ? gaps : `${gaps.length} gaps; every square on a ${n} by ${n} board works`,
          note: n % 3 === 0
            ? `No gap works on a ${n} by ${n} board.`
            : n === 5
              ? "On a 5 by 5 board only these gaps work."
              : `Every gap works on a ${n} by ${n} board.`,
        };
      },
    },
    check_pieces: {
      describe:
        "Check a proposed set of pieces on a deficient board: place them all, then report coverage, whether it wins, and whether it is stuck. Each piece is three [row, col] cells in any order; cells 0-based.",
      args: '{ "n": 5, "row": 0, "col": 0, "pieces": [[[0,1],[0,2],[1,2]]] }',
      run: (args) => {
        const C = cores["deficient-squares"].DeficientSquaresCore as any;
        const n = C.clampN(num(args, "n", C.DEFAULT_N));
        const row = num(args, "row", 0);
        const col = num(args, "col", 0);
        const pieces = Array.isArray(args.pieces) ? (args.pieces as Piece[]) : [];
        let game = C.start({ n, blank: { row, col } }) as Game;
        for (let i = 0; i < pieces.length; i++) {
          const next = C.place(game, toCells(pieces[i]));
          if (!next) {
            return {
              ok: false,
              badPiece: i,
              reason: "that piece overlaps, leaves the board, or is not an L",
            };
          }
          game = next;
        }
        const needed = C.piecesNeeded(n);
        return {
          ok: true,
          tileable: C.tileable(n, { row, col }),
          finished: C.result(game) === "win",
          placed: game.pieces.length,
          piecesNeeded: needed,
          squaresLeft: n * n - 1 - C.coveredCount(game),
          canPlace: C.canPlace(game),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const { C, game } = restore(state);
  const n = game.n;
  const done = C.result(game) === "win";
  const needed = C.piecesNeeded(n);
  const left = n * n - 1 - C.coveredCount(game);
  const byOrientation = [0, 0, 0, 0] as number[];
  for (const p of game.pieces) byOrientation[p.type]++;

  return {
    finished: done,
    boardSize: n,
    gap: {
      row: game.blank.row + 1, // 1-based for the tutor
      col: game.blank.col + 1,
    },
    tileable: C.tileable(n, game.blank),
    piecesPlaced: game.pieces.length,
    piecesNeeded: needed,
    squaresLeft: left,
    canPlaceAnother: C.canPlace(game),
    piecesByOrientation: byOrientation,
    note: done
      ? `The ${n} by ${n} board is fully covered by ${game.pieces.length} L-trominoes.`
      : reason(C, n, game.blank)
        ? reason(C, n, game.blank)
        : C.canPlace(game)
          ? `${game.pieces.length} of ${needed} L-trominoes placed, ${left} squares left to cover.`
          : `Stuck: ${game.pieces.length} L-trominoes placed and no L fits in the ${left} free squares. Remove a piece.`,
  };
}
