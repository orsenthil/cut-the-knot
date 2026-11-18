/*
 * run_game_logic actions and saved-position reader for Monotone Number Sequences.
 *
 * The core (up-and-down-game/ in the site, copied into src/generated/cores/ at
 * build time) answers whether a board contains four numbers going up or down
 * and which boxes show it. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Boxes = (number | null)[];

const core = () => cores["up-and-down-game"].UpAndDownGameCore;

/** Reads n and a board of box values, with null for a box still empty. */
function readBoard(args: Json): { n: number; boxes: Boxes } {
  const n = num(args, "n");
  if (!Number.isInteger(n) || (n !== 9 && n !== 10)) throw new Error("n must be 9 or 10");
  const raw = args.boxes;
  if (!Array.isArray(raw) || raw.length !== n) throw new Error(`boxes must have exactly ${n} entries`);
  const boxes = raw.map((value, index) => {
    if (value === null) return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > n) {
      throw new Error(`boxes[${index}] must be null or a number from 1 to ${n}`);
    }
    return number;
  });
  const used = boxes.filter((v) => v !== null) as number[];
  if (new Set(used).size !== used.length) throw new Error("each number may appear in only one box");
  return { n, boxes };
}

/** Completes a board (or proves none exists), pruning as soon as a run appears. */
function complete(n: number, fixed: Boxes, limit: number) {
  const C = core();
  const boxes = fixed.slice();
  // A run already on the board cannot be undone by filling the other boxes.
  if (C.faulty({ n, boxes, moves: 0 })) return { arrangement: null, nodes: 0, truncated: false };
  const empties: number[] = [];
  for (let box = 0; box < n; box++) if (boxes[box] === null) empties.push(box);
  let nodes = 0;
  const search = (k: number): Boxes | null => {
    if (k === empties.length) return boxes.slice();
    const box = empties[k];
    for (let value = 1; value <= n; value++) {
      if (boxes.includes(value)) continue;
      boxes[box] = value;
      nodes++;
      if (!C.faulty({ n, boxes, moves: 0 })) {
        const found = search(k + 1);
        if (found) return found;
      }
      boxes[box] = null;
      if (nodes >= limit) return null;
    }
    return null;
  };
  const arrangement = search(0);
  return { arrangement, nodes, truncated: nodes >= limit && arrangement === null };
}

export function actions(): GameActions {
  return {
    check_board: {
      describe:
        "Check a partly or fully filled board for four numbers going up or down. Names the boxes that show the run and says whether the board is a win, a loss or still being played.",
      args: '{ "n": 9, "boxes": [3, 2, 1, 6, 5, null, null, null, null] }',
      run: (args) => {
        const { n, boxes } = readBoard(args);
        const C = core();
        const state = { n, boxes, moves: 0 };
        const fault = C.faulty(state);
        const result = C.result(state);
        return {
          n,
          boxes: boxes.map((v) => v ?? "_"),
          filled: boxes.filter((v) => v !== null).length,
          loose: C.looseNumbers(state),
          fault: fault && {
            direction: fault.direction,
            boxes: fault.indices.map((i: number) => i + 1),
            values: fault.indices.map((i: number) => boxes[i]),
          },
          result,
          note: result === "win"
            ? "Every box is full and no four numbers make a run."
            : result === "lose"
              ? n === 10
                ? "With ten numbers a run of four cannot be avoided."
                : "The highlighted boxes show a run of four; move one number to break it."
              : fault
                ? "These four boxes already make a run, but the board is not full yet, so it can still be fixed."
                : "No run of four yet. Keep going.",
        };
      },
    },
    find_arrangement: {
      describe:
        "Search for a full arrangement with no run of four. Returns an example for nine numbers, and no example for ten (where the pigeonhole principle rules it out).",
      args: '{ "n": 9 }',
      run: (args) => {
        const n = num(args, "n");
        if (!Number.isInteger(n) || (n !== 9 && n !== 10)) throw new Error("n must be 9 or 10");
        const found = complete(n, Array(n).fill(null), 200000);
        return {
          n,
          possible: found.arrangement !== null,
          arrangement: found.arrangement,
          nodesSearched: found.nodes,
          truncated: found.truncated,
          why:
            n === 10
              ? "Each number has an increasing-run length and a decreasing-run length from 1 to 3, only nine pairs for ten numbers, so two share a pair and a run of four is forced."
              : "Three decreasing groups of three work: 3 2 1 6 5 4 9 8 7.",
        };
      },
    },
    complete_board: {
      describe:
        "Given a partially filled board, find one way to finish it without a run of four, or report that no completion exists. Only tries up to 200,000 positions.",
      args: '{ "n": 9, "boxes": [3, 2, 1, null, null, null, null, null, null] }',
      run: (args) => {
        const { n, boxes } = readBoard(args);
        const found = complete(n, boxes, 200000);
        return {
          n,
          canBeCompleted: found.arrangement !== null,
          arrangement: found.arrangement,
          nodesSearched: found.nodes,
          truncated: found.truncated,
        };
      },
    },
  };
}

/**
 * What the core says about a position saved by the page: the boxes and loose
 * numbers, any run to highlight, the result so far, and whether the board can
 * still be completed without one.
 */
export function position(state: Json): unknown {
  const C = core();
  const { n, boxes } = readBoard(state);
  const game = { n, boxes, moves: num(state, "moves", 0) };
  const fault = C.faulty(game);
  const result = C.result(game);
  const completion = complete(n, boxes, 200000);
  return {
    n,
    boxes: boxes.map((v) => v ?? "_"),
    filled: boxes.filter((v) => v !== null).length,
    loose: C.looseNumbers(game),
    movesSoFar: game.moves,
    finished: result !== null,
    result,
    fault: fault && {
      direction: fault.direction,
      boxes: fault.indices.map((i: number) => i + 1),
      values: fault.indices.map((i: number) => boxes[i]),
    },
    canStillBeCompleted: completion.arrangement !== null,
    exampleCompletion: completion.arrangement,
    note:
      result === "win"
        ? "Solved: all boxes are full with no run of four."
        : result === "lose"
          ? n === 10
            ? "Ten numbers always force a run of four, so this board cannot be won."
            : "A run of four is showing; move one of those numbers to break it."
          : completion.arrangement === null
            ? "No way to finish this board without a run of four was found."
            : "The board can still be finished without a run of four.",
  };
}
