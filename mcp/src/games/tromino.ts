/*
 * Tutor actions and position reader for Golomb's Tromino Theorem.
 *
 * The page saves a short summary of the induction: the exponent, the missing
 * square and how many levels have been shown. The core rebuilds the same
 * position from those numbers, so every answer here comes from the code the
 * page runs.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Hole = { col: number; row: number };
type Piece = { bx: number; by: number; type: number; color: number };

const QUADRANT = ["upper-left", "upper-right", "lower-right", "lower-left"];

/** Rebuild the position the page saved. */
function restore(state: Json) {
  const T = cores["tromino"].TrominoCore;
  const exp = Number(state.exp) > 0 ? Number(state.exp) : T.DEFAULT_EXP;
  const hole = state.hole as Hole | undefined;
  const col = hole && Number.isFinite(Number(hole.col)) ? Number(hole.col) : 0;
  const row = hole && Number.isFinite(Number(hole.row)) ? Number(hole.row) : 0;
  let game = T.start({ exp, col, row });
  const level = Number(state.level) || 0;
  for (let i = 0; i < level && i < game.exp; i++) game = T.step(game);
  return { T, game };
}

export function actions(): GameActions {
  return {
    piece_count: {
      describe:
        "How many L-trominoes tile a 2^exp by 2^exp board with one square missing, and how many each step of the proof places. Exp is between 1 and 7.",
      args: '{ "exp": 4 }',
      run: (args) => {
        const T = cores["tromino"].TrominoCore;
        const exp = T.clampExp(num(args, "exp", T.DEFAULT_EXP));
        const n = 2 ** exp;
        return {
          exp,
          board: `${n} x ${n}`,
          squares: n * n,
          pieces: (n * n - 1) / 3,
          byStep: Array.from({ length: exp }, (_, i) => 4 ** i),
        };
      },
    },
    next_cut: {
      describe:
        "Show the L-trominoes the next press of One step will place: each is the 2x2 block at its upper-left cell and the quadrant whose corner it leaves empty (the one holding that board's missing square). Exp 1-7, cells 0-based, level 0-based.",
      args: '{ "exp": 3, "col": 2, "row": 5, "level": 1 }',
      run: (args) => {
        const T = cores["tromino"].TrominoCore;
        const exp = T.clampExp(num(args, "exp", T.DEFAULT_EXP));
        const n = 2 ** exp;
        const col = num(args, "col", 0);
        const row = num(args, "row", 0);
        const level = num(args, "level", 0);
        if (col < 0 || col >= n || row < 0 || row >= n) {
          throw new Error(`the missing square must be inside a ${n} by ${n} board`);
        }
        if (level >= exp) return { finished: true, message: "The board is already fully tiled." };
        let game = T.start({ exp, col, row });
        for (let i = 0; i < level; i++) game = T.step(game);
        const before = game.trominoes.length;
        game = T.step(game);
        const placed: Piece[] = game.trominoes.slice(before) as Piece[];
        return {
          step: level + 1,
          count: placed.length,
          pieces: placed.map((p) => ({
            block: { col: p.bx, row: p.by },
            leavesEmpty: QUADRANT[p.type],
            colour: p.color + 1,
          })),
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const { T, game } = restore(state);
  const done = T.result(game) === "done";
  const placedByStep = new Array(game.exp).fill(0) as number[];
  for (const p of game.trominoes) placedByStep[(p as Piece).color]++;

  return {
    finished: done,
    exp: game.exp,
    boardSize: game.n,
    step: game.level,
    totalSteps: game.exp,
    hole: {
      col: game.hole.col + 1, // 1-based for the tutor
      row: game.hole.row + 1,
    },
    piecesPlaced: game.trominoes.length,
    piecesNeeded: (game.n * game.n - 1) / 3,
    placedByStep,
    boardsStillToSplit: game.boards.length,
    nextBoardSize: game.boards.length ? game.boards[0].n : null,
    note: done
      ? `The ${game.n} by ${game.n} board is fully tiled with ${game.trominoes.length} L-trominoes.`
      : `Step ${game.level} of ${game.exp}: ${game.trominoes.length} L-trominoes placed, ${game.boards.length} ${game.boards[0]?.n ?? ""}-square boards left to split.`,
  };
}
