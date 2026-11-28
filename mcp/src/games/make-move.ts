/*
 * run_game_logic actions and saved-position reader for Make Your Move, Kid!
 *
 * The 4x4 board holds the letters of MAKE / YOUR / MOVE, / KID! read down the
 * four columns (values[column][row]), plus one empty square. Pressing a square
 * in the gap's row or column slides the whole run between them into the gap.
 * Reset swaps the last two counters, R and E, and the puzzle is to slide them
 * back. Everything below is computed by cores["make-move"].MakeMoveCore — the
 * same DOM-free file the page runs, copied into src/generated/cores at build
 * time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const C = cores["make-move"].MakeMoveCore;

type Cell = { x: number; y: number };
type Board = { n: number; values: number[][] };

/** The 16-slide route from the Reset board to the message (porting logic test). */
const ROUTE: Cell[] = [
  { x: 3, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 3 }, { x: 1, y: 3 },
  { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 2, y: 3 },
  { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 3, y: 3 },
];

const keyOf = (board: Board): string => board.values.map((row) => row.join(",")).join(";");

/** The counters as letters, with the gap shown as a dot. */
const letters = (values: number[][], n: number): string[][] =>
  values.map((row) => row.map((v) => (v === n * n ? "·" : C.label(v))));

/** Accept {x,y} or [x,y]; check that it is a cell of an n by n board. */
const cellAt = (raw: unknown, n: number, what: string): Cell => {
  let x: unknown;
  let y: unknown;
  if (Array.isArray(raw)) {
    x = raw[0];
    y = raw[1];
  } else if (raw !== null && typeof raw === "object") {
    x = (raw as Json).x;
    y = (raw as Json).y;
  } else {
    throw new Error(`${what} must be a cell { x, y } or [x, y]`);
  }
  const cx = num({ x }, "x");
  const cy = num({ y }, "y");
  if (!Number.isInteger(cx) || !Number.isInteger(cy) || cx < 0 || cx >= n || cy < 0 || cy >= n) {
    throw new Error(`${what} must be a cell with 0 <= x,y < ${n}`);
  }
  return { x: cx, y: cy };
};

/** The page saves values as columns of counter numbers (1..n^2, n^2 = gap). */
const boardFrom = (raw: unknown): Board => {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error('"values" must be an array of columns, each an array of numbers');
  }
  const n = raw.length;
  const values: number[][] = raw.map((column: unknown, i: number) => {
    if (!Array.isArray(column) || column.length !== n) {
      throw new Error(`values[${i}] must have ${n} entries, one for each row`);
    }
    return column.map((v: unknown, j: number) => {
      const value = num({ v }, "v");
      if (!Number.isInteger(value) || value < 1 || value > n * n) {
        throw new Error(`values[${i}][${j}] must be a whole number from 1 to ${n * n}`);
      }
      return value;
    });
  });
  if (new Set(values.flat()).size !== n * n) {
    throw new Error(`"values" must contain each number from 1 to ${n * n} exactly once`);
  }
  return { n, values };
};

export function actions(): GameActions {
  return {
    parity_classes: {
      describe:
        "Inversion counts and parity classes of the four boards the puzzle turns on: the spelled start, the Reset board with R and E traded, the message with its two identical O counters traded, and the M-counter trap. With check3x3 true it also walks every board reachable on the 3x3 version to verify the parity rule.",
      args: '{ "check3x3": true }',
      run: (args) => {
        const want3x3 = args.check3x3 ?? false;
        if (typeof want3x3 !== "boolean") throw new Error('argument "check3x3" must be a boolean');

        const n = C.N as number;
        const solved = C.start({}).values;
        const cellsByLabel = new Map<string, Cell[]>();
        for (let x = 0; x < n; x++) {
          for (let y = 0; y < n; y++) {
            const value = solved[x][y];
            if (value === C.SQUARE) continue;
            const label = C.label(value);
            const cells = cellsByLabel.get(label) ?? [];
            cells.push({ x, y });
            cellsByLabel.set(label, cells);
          }
        }
        const oCells = cellsByLabel.get("O");
        const mCells = cellsByLabel.get("M");
        if (!oCells || oCells.length !== 2 || !mCells || mCells.length !== 2) {
          throw new Error("the board must have exactly two O counters and two M counters");
        }
        const trading = (a: Cell, b: Cell): number[][] => {
          const out: number[][] = (solved as number[][]).map((row: number[]) => row.slice());
          const tmp = out[a.x][a.y];
          out[a.x][a.y] = out[b.x][b.y];
          out[b.x][b.y] = tmp;
          return out;
        };

        const read = (name: string, values: number[][]) => {
          const gap = C.emptyCell({ n, values });
          const inversions = C.inversions(values, n);
          const gapColumn = gap ? gap.x + 1 : null;
          return {
            name,
            letters: letters(values, n),
            inversions,
            gapColumn,
            parityClass: gap ? (inversions + gapColumn!) % 2 : null,
            spellsMessage: C.isSolved(values, n),
          };
        };

        const boards = [
          read("spelled start", solved),
          read("after Reset: R and E traded", C.reset({}).values),
          read("message with the two O counters traded", trading(oCells[0], oCells[1])),
          read("message with the two M counters traded", trading(mCells[0], mCells[1])),
        ];

        let reachable3x3: unknown;
        if (want3x3) {
          const first = C.start({ n: 3 });
          const expectedParity = C.inversions(first.values, 3) % 2;
          const seen = new Set<string>([keyOf(first)]);
          const queue: Board[] = [first];
          let allSameParity = true;
          for (let head = 0; head < queue.length; head++) {
            const board = queue[head];
            if (C.inversions(board.values, 3) % 2 !== expectedParity) allSameParity = false;
            for (const cell of C.legalMoves(board)) {
              const next = C.move(board, cell);
              if (!next) continue;
              const key = keyOf(next);
              if (!seen.has(key)) {
                seen.add(key);
                queue.push(next);
              }
            }
          }
          reachable3x3 = {
            boardsVisited: seen.size,
            halfOfAllBoards: 362880 / 2,
            allSameInversionParity: allSameParity,
            note: "The slide rules reach exactly half of all 9! boards: those with the starting inversion parity.",
          };
        }

        return {
          boardSize: n,
          boards,
          invariant:
            "inversions + the gap's column number keeps its parity after every slide. Reset is odd (7 + 4), so slides alone cannot reach the ordered board (0 + 4); trading the two identical O counters makes the message odd too, while trading the two M counters satisfies the letters but not the finished test.",
          ...(reachable3x3 ? { reachable3x3 } : {}),
        };
      },
    },

    solution: {
      describe:
        "Replays the 16 slides that take the Reset board back to the spelled message, using the page's own slide rules. Each step names the square pressed, the letters that slid and where the gap ended; pass cells to try a different route from Reset.",
      args: "{}",
      run: (args) => {
        const route = args.cells === undefined
          ? ROUTE
          : (() => {
              if (!Array.isArray(args.cells)) throw new Error('argument "cells" must be an array of cells');
              if (args.cells.length === 0 || args.cells.length > 64) {
                throw new Error('argument "cells" must have between 1 and 64 cells');
              }
              return args.cells.map((cell: unknown, i: number) => cellAt(cell, C.N as number, `cells[${i}]`));
            })();

        const start = C.reset({});
        let board = start;
        const steps: unknown[] = [];
        for (const cell of route) {
          const next = C.move(board, cell);
          if (!next) {
            throw new Error(
              `slide to column ${cell.x + 1}, row ${cell.y + 1} is not in the gap's row or column at step ${steps.length + 1}`,
            );
          }
          steps.push({
            slide: steps.length + 1,
            chose: cell,
            lettersMoved: C.changed(board.values, next.values, board.n),
            gapAfter: C.emptyCell(next),
          });
          board = next;
        }
        return {
          startingLetters: letters(start.values, start.n),
          slides: steps.length,
          steps,
          finalLetters: letters(board.values, board.n),
          inversionCount: C.inversions(board.values, board.n),
          spellsMessage: C.isSolved(board.values, board.n),
          result: C.result(board),
          note: "The last board spells the message with the two O counters traded, which is the goal the page describes; there is no win or loss, so the record calls it done.",
        };
      },
    },
  };
}

/**
 * What the core says about the board the page saved with Track.state: the
 * letters and the gap, the inversion count and parity class that decide which
 * boards are reachable, and whether the chosen cursor can be slid.
 */
export function position(state: Json, stateVersion: number): unknown {
  const { n, values } = boardFrom(state.values);
  const moves = num(state, "moves", 0);
  if (!Number.isInteger(moves) || moves < 0) {
    throw new Error('argument "moves" must be a non-negative whole number');
  }
  const game: Board & { moves: number; last: null } = { n, values, moves, last: null };
  const gap = C.emptyCell(game);
  const cursor = state.cursor === undefined || state.cursor === null
    ? null
    : cellAt(state.cursor, n, "cursor");
  const inversions = C.inversions(values, n);
  const gapColumn = gap ? gap.x + 1 : null;
  const legalMoves = C.legalMoves(game);
  const cursorValue = cursor ? values[cursor.x][cursor.y] : null;
  const finished = C.result(game) === "done";

  return {
    stateVersion,
    n,
    values,
    cursor,
    movesSoFar: moves,
    letters: letters(values, n),
    emptyCell: gap,
    gapColumn,
    inversions,
    parityClass: gap ? (inversions + gapColumn!) % 2 : null,
    spellsMessage: C.isSolved(values, n),
    finished,
    result: C.result(game),
    legalMoves: legalMoves.length,
    legalCells: legalMoves,
    cursorLetter: cursorValue !== null && cursorValue !== n * n ? C.label(cursorValue) : null,
    cursorIsLegal: cursor ? legalMoves.some((cell: Cell) => cell.x === cursor.x && cell.y === cursor.y) : null,
    note: "inversions + the gap's column number has the same parity after every slide; only a message with the two O counters traded can be reached from the Reset board.",
  };
}
