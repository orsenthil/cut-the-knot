/*
 * run_game_logic actions and saved-position reader for Wythoff's Nim.
 *
 * The core (wythoff-nim/ in the site, copied into src/generated/cores/ at build
 * time) knows the applet's pair table and the computer's move. See _shared.ts
 * for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Heaps = [number, number];

const core = () => cores["wythoff-nim"].WythoffNimCore;

function readHeaps(args: Json): Heaps {
  const raw = args.heaps;
  if (!Array.isArray(raw) || raw.length !== 2) throw new Error("heaps must have exactly two entries");
  const a = Number(raw[0]);
  const b = Number(raw[1]);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 40 || b > 40) {
    throw new Error("each heap must be a whole number from 0 to 40");
  }
  return [a, b];
}

export function actions(): GameActions {
  return {
    pair_for_difference: {
      describe:
        "The safe Wythoff pair for a difference of k counters, from the golden ratio, next to the entry in the applet's own table. They differ for k = 20 to 23.",
      args: '{ "k": 3 }',
      run: (args) => {
        const C = core();
        const k = num(args, "k");
        if (!Number.isInteger(k) || k < 0 || k >= C.PAIRS.length) {
          throw new Error(`k must be a whole number from 0 to ${C.PAIRS.length - 1}`);
        }
        const truth = C.truePair(k);
        const listed = C.PAIRS[k];
        return {
          k,
          truePair: truth,
          appletPair: listed,
          appletIsCorrect: JSON.stringify(truth) === JSON.stringify(listed),
        };
      },
    },
    check_board: {
      describe:
        "For two heap sizes, say whether the position is a cold Wythoff pair, name the true pair for its difference, and list the human moves allowed in the chosen remove mode.",
      args: '{ "heaps": [3, 5], "mode": "one" }',
      run: (args) => {
        const C = core();
        const heaps = readHeaps(args);
        const mode = args.mode === "two" ? "two" : "one";
        const state = { max: 40, heaps, mode, turn: "you", moves: 0 };
        const small = Math.min(...heaps);
        const big = Math.max(...heaps);
        const k = big - small;
        return {
          heaps,
          mode,
          finished: C.isOver(state),
          cold: C.cold(heaps),
          difference: k,
          truePairForThisDifference: C.truePair(k),
          appletPairForThisDifference: k < C.PAIRS.length ? C.PAIRS[k] : null,
          legalMoves: C.legalMoves(state).length,
          note: C.cold(heaps)
            ? "A cold position: whatever the player to move does, the other can answer with a pair."
            : "There is a move to a cold pair; the computer will look for it.",
        };
      },
    },
    computer_plan: {
      describe:
        "The move the applet's computer makes from these heaps. From a cold pair it moves at random, so only the other cases have a fixed plan.",
      args: '{ "heaps": [7, 4] }',
      run: (args) => {
        const C = core();
        const heaps = readHeaps(args);
        if (heaps[0] === 0 && heaps[1] === 0) return { finished: true };
        if (heaps[0] === heaps[1]) {
          return { finished: false, move: { type: "both", remaining: 0 }, why: "Equal heaps: it removes both." };
        }
        if (heaps[0] === 0 || heaps[1] === 0) {
          const heap = heaps[0] === 0 ? 1 : 0;
          return { finished: false, move: { type: "one", heap, remaining: 0 }, why: "Only one heap is left: it empties it." };
        }
        const small = Math.min(...heaps);
        const big = Math.max(...heaps);
        const plan = C.makeMove(big, small);
        if (!plan) {
          return {
            finished: false,
            move: null,
            why: C.cold(heaps)
              ? "A cold pair: the computer has no move to a pair and acts at random."
              : "The difference is larger than its table: the applet would throw, so the port moves at random.",
          };
        }
        return {
          finished: false,
          move: plan[1] === small ? { type: "one", remaining: plan[0] } : { type: "both", remaining: plan[1] },
          heapsAfter: [Math.min(...plan), Math.max(...plan)],
          why: "It moves to one of its listed pairs.",
        };
      },
    },
  };
}

/**
 * What the core says about a position saved by the page: the two heaps, whose
 * turn it is, whether it is a cold pair, and how many moves are available.
 */
export function position(state: Json): unknown {
  const C = core();
  const heaps = readHeaps(state);
  const mode = state.mode === "two" ? "two" : "one";
  const game = { max: num(state, "max", 15), heaps, mode, turn: state.turn === "computer" ? "computer" : "you", moves: num(state, "moves", 0) };
  const over = C.isOver(game);
  const small = Math.min(...heaps);
  const big = Math.max(...heaps);
  const k = big - small;
  return {
    heaps,
    max: game.max,
    mode,
    turn: game.turn,
    movesSoFar: game.moves,
    finished: over,
    result: C.result(game),
    cold: C.cold(heaps),
    difference: k,
    truePairForThisDifference: C.truePair(k),
    legalMoves: over ? 0 : C.legalMoves(game).length,
    note: over
      ? "The last counter has gone; the game is over."
      : C.cold(heaps)
        ? "A cold pair: the player to move has no good answer."
        : game.turn === "computer"
          ? "The computer is thinking about a move to a cold pair."
          : "Your turn: pick a square to remove it and those to its right.",
  };
}
