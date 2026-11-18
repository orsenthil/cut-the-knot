/*
 * run_game_logic actions and saved-position reader for the Date Game.
 *
 * The core (date-game/ in the site, copied into src/generated/cores/ at build
 * time) knows the losing diagonal and the computer's move. See _shared.ts for
 * the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["date-game"].DateGameCore;

function readDate(args: Json): { month: number; day: number; leap: boolean } {
  const C = core();
  const month = num(args, "month");
  const day = num(args, "day");
  if (!Number.isInteger(month) || month < 0 || month > 11) throw new Error("month must be 0 to 11");
  if (!Number.isInteger(day) || day < 0 || day > 30) throw new Error("day must be 0 to 30");
  return { month, day, leap: args.leap === true };
}

export function actions(): GameActions {
  return {
    check_date: {
      describe:
        "For a date numbered from zero, say whether it is valid, whether it is a losing position, the next losing date on the diagonal, and the computer's good move from here.",
      args: '{ "month": 0, "day": 5, "leap": false }',
      run: (args) => {
        const C = core();
        const date = readDate(args);
        const state = { ...date, turn: "computer", winner: null, last: null };
        const delta = date.day - date.month - C.DIAGONAL;
        const target = delta === 0
          ? null
          : delta < 0
            ? { month: date.month, day: date.month + C.DIAGONAL }
            : { month: date.day - C.DIAGONAL, day: date.day };
        const plan = C.makeGoodMove(state, () => 0.75);
        return {
          date: `${C.LONG_MONTHS[date.month]} ${date.day + 1}`,
          month: date.month,
          day: date.day,
          valid: C.valid(state),
          finished: C.isFinished(state),
          losing: C.pPosition(state),
          difference: date.day - date.month,
          diagonal: C.DIAGONAL,
          nextLosingDate: target,
          computerGoesTo: { month: plan.month, day: plan.day },
          note: delta === 0
            ? "A losing date: the computer has no good move and picks one at random."
            : "The computer can step onto the diagonal from here.",
        };
      },
    },
    losing_dates: {
      describe:
        "The twelve losing dates of the game, found by searching the whole game tree rather than by naming the diagonal.",
      args: '{ "leap": false }',
      run: (args) => {
        const C = core();
        const leap = args.leap === true;
        const positions = C.pPositions(leap);
        return {
          leap,
          count: positions.length,
          dates: positions.map(({ month, day }) => ({
            month,
            day,
            name: `${C.MONTHS[month]} ${String(day + 1).padStart(2, "0")}`,
            difference: day - month,
          })),
          allOnDiagonal: positions.every((p) => p.day - p.month === C.DIAGONAL),
        };
      },
    },
  };
}

/** What the core says about a saved date: validity, the diagonal and the win. */
export function position(state: Json): unknown {
  const C = core();
  const date = readDate(state);
  const game = {
    ...date,
    turn: state.turn === "computer" ? "computer" : "you",
    winner: state.winner ?? null,
    last: state.last ?? null,
  };
  const delta = date.day - date.month - C.DIAGONAL;
  return {
    date: `${C.LONG_MONTHS[date.month]} ${date.day + 1}`,
    month: date.month,
    day: date.day,
    valid: C.valid(game),
    finished: C.isFinished(game),
    result: C.result(game),
    losing: C.pPosition(game),
    difference: date.day - date.month,
    diagonal: C.DIAGONAL,
    wordsYouMayStillMove: C.allowedWords(game),
    target: delta === 0
      ? null
      : delta < 0
        ? { month: date.month, day: date.month + C.DIAGONAL }
        : { month: date.day - C.DIAGONAL, day: date.day },
    note: C.result(game)
      ? "The game is over."
      : !C.valid(game)
        ? "That is not a real date; pressing Move will undo this turn."
        : delta === 0
          ? "A losing date for whoever must move next."
          : "There is a move onto the diagonal from here.",
  };
}
