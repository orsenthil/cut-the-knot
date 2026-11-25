/*
 * run_game_logic actions and saved-position reader for Math Telepathy.
 * The core lives in math-telepathy/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["math-telepathy"].MathTelepathyCore;

export function actions(): GameActions {
  return {
    read_digit: {
      describe: "The circled digit, given all the other digits of the difference of a number and a reshuffle of its digits: 9 minus their sum mod 9 (9, never 0, when the rest add to a multiple of 9).",
      args: '{ "digits": [3, 3, 6] }',
      run: (args) => {
        const d = args.digits;
        if (!Array.isArray(d)) throw new Error('"digits" must be an array of digits');
        const digits = d.map(Number);
        if (digits.some((v) => !Number.isInteger(v) || v < 0 || v > 9)) throw new Error("each digit must be 0..9");
        return { digits, sum: digits.reduce((t, v) => t + v, 0), circledDigit: core().read(digits) };
      },
    },
    difference_of_shuffle: {
      describe: "For a number and a different order of its digits: the difference (always a multiple of 9) and its digit sum.",
      args: '{ "a": 7263, "b": 3627 }',
      run: (args) => {
        const a = Math.floor(num(args, "a")), b = Math.floor(num(args, "b"));
        const same = [...String(a)].sort().join("") === [...String(b)].sort().join("");
        if (!same) throw new Error("b must use the same digits as a");
        const diff = Math.abs(a - b);
        return { difference: diff, multipleOfNine: diff % 9 === 0, digitSum: core().digitsOf(diff).reduce((t: number, v: number) => t + v, 0) };
      },
    },
  };
}

export function position(state: Json): unknown {
  const digits = (state.digits as number[]).map(Number);
  return {
    digitsGiven: digits, sum: digits.reduce((t, v) => t + v, 0), computersAnswer: core().read(digits), pressedGuess: state.guessed !== null && state.guessed !== undefined,
    note: "A number and any reshuffle differ by a multiple of 9, so the digits of the difference add to a multiple of 9: the missing digit is what completes the sum.",
  };
}
