/*
 * run_game_logic actions and saved-position reader for Barcode Magic.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["barcode-magic"].BarcodeMagicCore;

function readDigits(args: Json): number[] {
  const C = core();
  const raw = Array.isArray(args.digits) ? args.digits : [];
  return Array.from({ length: C.LENGTH }, (_, i) => {
    const n = Number(raw[i]);
    if (n === -1 || n === C.BLANK) return C.BLANK;
    return Number.isInteger(n) && n >= 0 && n <= 9 ? n : C.BLANK;
  });
}

export function actions(): GameActions {
  return {
    check_code: {
      describe:
        "Check a UPC-A code written with 12 digits (use -1 for a hidden digit): validate it, refuse several blanks, or name the single hidden digit.",
      args: '{ "digits": [0,3,6,0,0,0,2,9,1,4,5,-1] }',
      run: (args) => {
        const C = core();
        const digits = readDigits(args);
        const result = C.check(digits);
        return {
          digits: digits.map((d) => C.digitText(d)),
          blanks: C.blankCount(digits),
          outcome: result.outcome,
          message: result.message,
          missingDigit: result.digit,
          checksum: C.checksum(digits),
          modules: C.moduleString(digits),
        };
      },
    },
    hide_each_digit: {
      describe:
        "For a valid code, hide each digit in turn and confirm the check always recovers the hidden one.",
      args: '{ "digits": [0,3,6,0,0,0,2,9,1,4,5,2] }',
      run: (args) => {
        const C = core();
        const digits = readDigits(args);
        if (!C.isValid(digits)) throw new Error("provide a valid 12-digit code first");
        const found = digits.map((d, i) => {
          const hidden = digits.slice();
          hidden[i] = C.BLANK;
          return { position: i + 1, actual: d, recovered: C.missingDigit(hidden) };
        });
        return {
          code: digits.join(""),
          found,
          allRecovered: found.every((r) => r.actual === r.recovered),
          note: "Each digit is forced by the other eleven: that is what the check digit buys you.",
        };
      },
    },
  };
}

/** What the core says about the digits currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const digits = readDigits(state);
  const result = C.check(digits);
  return {
    digits: digits.map((d) => C.digitText(d)),
    blanks: C.blankCount(digits),
    outcome: result.outcome,
    message: typeof state.message === "string" ? state.message : result.message,
    missingDigit: result.digit,
    modules: C.moduleString(digits),
    note: `There ${C.blankCount(digits) === 1 ? "is one blank" : `are ${C.blankCount(digits)} blanks`} in the code; the check digit decides what goes there.`,
  };
}
