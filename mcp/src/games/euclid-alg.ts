/*
 * run_game_logic actions and saved-position reader for Euclid's Game with typed numbers.
 *
 * Two numbers N > M start on the board; players take turns writing a new difference of
 * two numbers on it. Everything that can appear is a multiple of g = gcd(N, M) up to N,
 * and all of it does: N/g numbers in the end, N/g - 2 moves, so the first player wins
 * exactly when N/g - 2 is odd. Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["euclid-alg"].EuclidAlgCore;

export function actions(): GameActions {
  return {
    who_wins: {
      describe: "Who wins Euclid's game from two starting numbers (5 to 99): the gcd, how many numbers end up on the board (N/g), how many moves the game lasts (N/g - 2) and whether the first or second player wins.",
      args: '{ "a": 85, "b": 18 }',
      run: (args) => {
        const C = core();
        const a = Math.trunc(num(args, "a", 85)), b = Math.trunc(num(args, "b", 18));
        if (a === b || a < 5 || b < 5 || a > 99 || b > 99) throw new Error("two different numbers from 5 to 99");
        const hi = Math.max(a, b), lo = Math.min(a, b), g = C.gcd(hi, lo), moves = hi / g - 2;
        return { larger: hi, smaller: lo, gcd: g, numbersOnTheBoardAtTheEnd: hi / g, moves, winner: moves % 2 === 1 ? "the first player" : "the second player", reason: "every multiple of the gcd up to the larger number appears, however the game is played" };
      },
    },
    next_numbers: {
      describe: "The numbers that may be written next, from a board (list of numbers on it): the new multiples of the gcd that are a difference of two numbers there, and the computer's own pick (the smallest).",
      args: '{ "board": [12, 18] }',
      run: (args) => {
        const C = core();
        const raw = Array.isArray(args.board) ? (args.board as unknown[]).map(Number) : [12, 18];
        if (raw.length < 2 || raw.some((x) => !Number.isInteger(x) || x < 1 || x > 99)) throw new Error("board must list integers from 1 to 99, at least two");
        const sorted = Array.from(new Set(raw)).sort((x, y) => x - y);
        const s0 = C.start({ a: Math.max(5, sorted[sorted.length - 1]), b: Math.max(5, sorted[0]) === sorted[sorted.length - 1] ? undefined : Math.max(5, sorted[0]) });
        const s = { ...s0, board: sorted, n1: sorted[sorted.length - 1], n2: sorted[0] };
        const g = sorted.reduce((x: number, y: number) => C.gcd(x, y), 0);
        const options: number[] = [];
        for (let k = g; k < s.n1; k += g) if (!sorted.includes(k) && C.isDifference(s, k)) options.push(k);
        return { gcd: g, allowed: options, computerWouldPlay: options.length ? options[0] : null };
      },
    },
  };
}

/** What the core says about the game as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const board = Array.isArray(state.board) ? (state.board as number[]) : [];
  const n1 = num(state, "n1", 0), n2 = num(state, "n2", 0);
  const g = n1 && n2 ? C.gcd(n1, n2) : 1;
  const total = n1 && n2 ? n1 / g : 0;
  const moves = num(state, "moves", 0);
  return {
    given: [n2, n1],
    gcd: g,
    onBoard: board.length,
    willEndWith: total,
    movesInTheWholeGame: total - 2,
    movesMade: moves,
    movesLeft: Math.max(0, total - board.length),
    firstPlayerWins: (total - 2) % 2 === 1,
    whoseTurn: state.turn === "computer" ? "computer" : "you",
    over: total > 0 && board.length === total,
    lastMessage: typeof state.message === "string" ? state.message : "",
  };
}
