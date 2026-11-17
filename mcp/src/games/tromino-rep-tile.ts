/*
 * Tutor actions and position reader for Tromino as a Rep-tile.
 *
 * The page saves the exponent, the missing square and how many split levels
 * have been shown. The core rebuilds the same picture from those numbers, so
 * every answer here comes from the code the page runs.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Hole = { col: number; row: number };

/** Rebuild the position the page saved, level by level. */
function restore(state: Json) {
  const T = cores["tromino-rep-tile"].TrominoRepTileCore;
  const exp = Number(state.exp) > 0 ? T.clampExp(Number(state.exp)) : T.DEFAULT_EXP;
  const n = 2 ** exp;
  const hole = state.hole as Hole | undefined;
  const col = hole && Number.isFinite(Number(hole.col)) ? Number(hole.col) : 0;
  const row = hole && Number.isFinite(Number(hole.row)) ? Number(hole.row) : 0;
  if (col < 0 || col >= n || row < 0 || row >= n) {
    throw new Error(`the missing square must be inside a ${n} by ${n} board`);
  }
  let game = T.start({ exp, col, row });
  const level = Math.max(0, Math.min(Number(state.level) || 0, exp - 1));
  for (let i = 0; i < level; i++) game = T.step(game);
  return { T, game };
}

/** How many pieces there are at each level, from the opening picture to the end. */
function countsByLevel(T: any, exp: number, col: number, row: number): number[] {
  const counts = [];
  let game = T.start({ exp, col, row });
  for (let level = 0; level < exp; level++) {
    counts.push(game.pieces.length);
    game = T.step(game);
  }
  return counts;
}

export function actions(): GameActions {
  return {
    piece_count: {
      describe:
        "How many L-trominoes a 2^exp by 2^exp board needs with one square missing, and how many are in the picture at each split level. Exp is between 1 and 7.",
      args: '{ "exp": 4 }',
      run: (args) => {
        const T = cores["tromino-rep-tile"].TrominoRepTileCore;
        const exp = T.clampExp(num(args, "exp", T.DEFAULT_EXP));
        const n = 2 ** exp;
        return {
          exp,
          board: `${n} x ${n}`,
          squares: n * n,
          pieces: (n * n - 1) / 3,
          openingPieces: exp,
          piecesByLevel: countsByLevel(T, exp, 0, 0),
        };
      },
    },
    next_step: {
      describe:
        "What the next press of One step does: how many L-trominoes split, how many half-size copies replace them, and the total afterwards. Exp 1-7, cells 0-based, level 0-based from the opening picture.",
      args: '{ "exp": 3, "col": 2, "row": 5, "level": 1 }',
      run: (args) => {
        const T = cores["tromino-rep-tile"].TrominoRepTileCore;
        const exp = T.clampExp(num(args, "exp", T.DEFAULT_EXP));
        const n = 2 ** exp;
        const col = num(args, "col", 0);
        const row = num(args, "row", 0);
        const level = num(args, "level", 0);
        if (col < 0 || col >= n || row < 0 || row >= n) {
          throw new Error(`the missing square must be inside a ${n} by ${n} board`);
        }
        if (level < 0 || level >= exp - 1) {
          return {
            restarting: true,
            message:
              exp === 1
                ? "A 2 by 2 board is already a single L-tromino. One step starts the picture again."
                : "Every piece is already a unit L. One step starts the picture again with the same hole.",
          };
        }
        let game = T.start({ exp, col, row });
        for (let i = 0; i < level; i++) game = T.step(game);
        const before = game.pieces.length;
        const next = game.step / 2;
        const splitting = game.pieces.filter((p: any) => p.side > next).length;
        game = T.step(game);
        return {
          step: level + 1,
          of: exp - 1,
          splitting,
          created: game.pieces.length - before,
          piecesBefore: before,
          piecesAfter: game.pieces.length,
          biggestAfter: Math.max(...game.pieces.map((p: any) => p.side)),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const { T, game } = restore(state);
  const done = T.result(game) === "done";
  const bySize: Record<number, number> = {};
  for (const p of game.pieces) bySize[p.side] = (bySize[p.side] ?? 0) + 1;

  return {
    finished: done,
    exp: game.exp,
    boardSize: game.n,
    step: game.level,
    totalSteps: Math.max(0, game.exp - 1),
    hole: {
      col: game.hole.col + 1, // 1-based for the tutor
      row: game.hole.row + 1,
    },
    piecesPlaced: game.pieces.length,
    piecesNeeded: (game.n * game.n - 1) / 3,
    biggestPiece: Math.max(...game.pieces.map((p: any) => p.side)),
    piecesBySize: bySize,
    note: done
      ? game.exp === 1
        ? "A 2 by 2 board with one square gone is exactly one L-tromino. One step starts the picture again."
        : `The ${game.n} by ${game.n} board is fully tiled with ${game.pieces.length} unit L-trominoes.`
      : `Step ${game.level} of ${game.exp - 1}: ${game.pieces.length} L-trominoes, largest ${Math.max(...game.pieces.map((p: any) => p.side))} squares a side.`,
  };
}
