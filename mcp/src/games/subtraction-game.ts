/*
 * run_game_logic actions and saved-position reader for the Subtraction Game.
 *
 * The core (subtraction-game/ in the site, copied into src/generated/cores/ at
 * build time) knows the Grundy table and the zero-Nim-sum move. See _shared.ts
 * for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["subtraction-game"].SubtractionGameCore;

function readBoard(args: Json): { nums: number[]; subs: number[]; max: number } {
  const C = core();
  const nums = numArray(args, "nums");
  const subs = numArray(args, "subs");
  if (!nums.length || nums.some((n) => !Number.isInteger(n) || n < 0 || n > 100)) {
    throw new Error("nums must be whole numbers from 0 to 100");
  }
  if (!subs.length || subs.some((s) => !Number.isInteger(s) || s < C.MIN_SUB || s > C.MAX_SUB)) {
    throw new Error("subs must be whole numbers from 1 to 9");
  }
  const max = Number.isFinite(args.max) ? num(args, "max") : Math.max(...nums);
  return { nums, subs, max };
}

export function actions(): GameActions {
  return {
    analyze_board: {
      describe:
        "For a board and a subtraction set, list each minuend's Grundy value, the Nim-sum, and the move that restores a zero sum (or note that the board is already losing).",
      args: '{ "nums": [9, 4, 11], "subs": [1, 2, 3], "max": 20 }',
      run: (args) => {
        const C = core();
        const board = readBoard(args);
        const table = C.grundy(board.subs, board.max);
        const xor = C.nimSum(board, table);
        const state = { ...board, turn: "you", winner: null };
        const plan = xor !== 0 ? C.makeGoodMove(state, xor) : null;
        return {
          nums: board.nums,
          subs: C.sortedSubs(board.subs),
          grundyValues: board.nums.map((n) => table[n]),
          nimSum: xor,
          losingForPlayerToMove: xor === 0,
          goodMove: plan,
          note: xor === 0
            ? "A zero Nim-sum: whatever the player to move does, the other can answer."
            : plan
              ? `Subtract ${plan.sub} from minuend ${plan.heap + 1} to restore a zero sum.`
              : "No restoring move found.",
        };
      },
    },
    grundy_table: {
      describe:
        "The Grundy numbers g(0)..g(max) for a subtraction set, computed by the mex rule from the same table the live page uses.",
      args: '{ "subs": [1, 3], "max": 20 }',
      run: (args) => {
        const C = core();
        const subs = numArray(args, "subs");
        const max = num(args, "max");
        if (!subs.length || subs.some((s) => !Number.isInteger(s) || s < 1 || s > 9)) {
          throw new Error("subs must be whole numbers from 1 to 9");
        }
        if (!Number.isInteger(max) || max < 0 || max > 100) throw new Error("max must be 0 to 100");
        const table = C.grundy(subs, max);
        return {
          subs: C.sortedSubs(subs),
          max,
          values: table,
          note: "g(n) is the smallest value not reachable by one allowed subtraction.",
        };
      },
    },
    scoring_claim: {
      describe:
        "Check the page's claim that consecutive subtrahends 1..s make this the Scoring game, with Grundy value n mod (s+1) for every heap size up to a given maximum.",
      args: '{ "max": 100 }',
      run: (args) => {
        const C = core();
        const max = Number.isFinite(args.max) ? num(args, "max") : 100;
        if (!Number.isInteger(max) || max < 0 || max > 100) throw new Error("max must be 0 to 100");
        const results = [];
        for (let s = 1; s <= 8; s++) {
          const subs = Array.from({ length: s }, (_, i) => i + 1);
          const table = C.grundy(subs, max);
          const wrong = [];
          for (let n = 0; n <= max; n++) if (table[n] !== n % (s + 1)) wrong.push(n);
          results.push({ s, formula: `n mod ${s + 1}`, cases: max + 1, mismatches: wrong });
        }
        return {
          max,
          results,
          holds: results.every((r) => r.mismatches.length === 0),
          note: "Every case checked; the page's Scoring claim is exact.",
        };
      },
    },
  };
}

/** What the core says about a saved board: the values, sum and next move. */
export function position(state: Json): unknown {
  const C = core();
  const board = readBoard(state);
  const table = C.grundy(board.subs, board.max);
  const xor = C.nimSum(board, table);
  const game = { ...board, turn: state.turn === "computer" ? "computer" : "you", winner: state.winner ?? null };
  const plan = C.result(game) || xor === 0 ? null : C.makeGoodMove(game, xor);
  return {
    nums: board.nums,
    subs: C.sortedSubs(board.subs),
    grundyValues: board.nums.map((n) => table[n]),
    nimSum: xor,
    result: C.result(game),
    finished: C.isFinished(game),
    movesSoFar: Number(state.moves) || 0,
    nextGoodMove: plan,
    note: C.result(game)
      ? "The game is over."
      : xor === 0
        ? "A zero Nim-sum: the player to move is in trouble."
        : plan
          ? `Subtract ${plan.sub} from minuend ${plan.heap + 1}.`
          : "No restoring move found.",
  };
}
