/*
 * run_game_logic actions and saved-position reader for the Game of Fif.
 *
 * Fif is TicTacToe on the magic square 4 9 2 / 3 5 7 / 8 1 6: the eight triples of 1..9 that add up
 * to 15 are its eight lines. The computer looks one move ahead and, in the applet, errs 1 time in 20
 * per free square it looks at. Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["fif"].FifCore;

/** A list of numbers 1..9 from the arguments, as a bit mask over the applet's cells. */
function maskOf(args: Json, key: string): number {
  const C = core();
  const raw = Array.isArray(args[key]) ? (args[key] as unknown[]).map(Number) : [];
  let m = 0;
  for (const n of raw) {
    if (!Number.isInteger(n) || n < 1 || n > 9) throw new Error(`"${key}" lists numbers from 1 to 9`);
    m |= 1 << C.bitOf(n);
  }
  return m;
}

export function actions(): GameActions {
  return {
    lines: {
      describe: "The eight triples of 1..9 that add up to 15, and the magic square they are the lines of (the board of the TicTacToe game that Fif is).",
      args: "{}",
      run: () => {
        const C = core();
        const triples: number[][] = [];
        for (let a = 1; a <= 9; a++) for (let b = a + 1; b <= 9; b++) for (let c = b + 1; c <= 9; c++) if (a + b + c === 15) triples.push([a, b, c]);
        return { triples, magicSquare: [0, 1, 2].map((r) => [0, 1, 2].map((c) => C.numberAt(r * 3 + c))), note: "Every row, column and diagonal of the square adds up to 15, and every triple above is one of those lines." };
      },
    },
    best_move: {
      describe: "What the applet's computer would play (when it does not err): given the numbers it holds and the numbers you hold, the number it picks, and whether it wins, blocks you or just takes the first safe square in its order (5, 4, 2, 8, 6, 9, 3, 7, 1).",
      args: '{ "computer": [1, 7], "you": [2, 4] }',
      run: (args) => {
        const C = core();
        const white = maskOf(args, "computer"), black = maskOf(args, "you");
        if (white & black) throw new Error("a number cannot be held by both");
        const m = C.bestMove(white, black, () => 0.5);
        if (m < 0) return { move: null, note: "the board is full" };
        const n = C.numberAt(m);
        const after = white | (1 << m);
        const why = C.WON[after] ? "it wins with this number" : C.WON[black | (1 << m)] ? "it blocks your winning number" : "it takes the first square in its order that does not let you win at once";
        return { move: n, why, computerHoldsThen: C.numbers(after), errorChance: "each free square it looks at has a 1 in 20 chance of being taken straight away instead" };
      },
    },
    check: {
      describe: "Who, if anyone, holds three numbers that add up to 15, for the two sets of numbers (computer, you).",
      args: '{ "computer": [1, 5, 9], "you": [2, 4] }',
      run: (args) => {
        const C = core();
        const white = maskOf(args, "computer"), black = maskOf(args, "you");
        const winner = C.WON[white] ? "computer" : C.WON[black] ? "you" : null;
        return { winner, computerHolds: C.numbers(white), youHold: C.numbers(black), stalemate: !winner && (white | black) === 511 };
      },
    },
  };
}

/** What the core says about the game as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const white = Math.max(0, Math.min(511, Math.trunc(num(state, "white", 0)))), black = Math.max(0, Math.min(511, Math.trunc(num(state, "black", 0))));
  const s = { white, black };
  const free = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !((white | black) & (1 << C.bitOf(n))));
  const next = C.bestMove(white, black, () => 0.5);
  return {
    youHold: C.numbers(black),
    computerHolds: C.numbers(white),
    free,
    winner: C.WON[s.white] ? "computer" : C.WON[s.black] ? "you" : null,
    stalemate: !C.WON[white] && !C.WON[black] && (white | black) === 511,
    computerWouldPlay: next >= 0 && !C.WON[white] && !C.WON[black] ? C.numberAt(next) : null,
    score: { computer: num(state, "whiteWins", 0), you: num(state, "blackWins", 0) },
    computerMovesFirst: state.first === true,
    moves: num(state, "moves", 0),
  };
}
