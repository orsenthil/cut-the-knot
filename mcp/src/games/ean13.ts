/*
 * run_game_logic actions and saved-position reader for EAN-13 Encoding.
 *
 * d1 + 3 d2 + d3 + ... + 3 d12 + d13 = 0 (mod 10) fixes the thirteenth digit;
 * the first digit chooses the parity pattern of the six left digits' bars.
 * Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["ean13"].Ean13Core;

/** The first twelve digits from a string or array. */
function twelve(args: Json, key: string, fallback: string): number[] {
  const raw = args[key];
  const digits = (Array.isArray(raw) ? raw.map(String).join("") : String(raw ?? fallback)).replace(/[^0-9]/g, "").slice(0, 12).split("").map(Number);
  if (digits.length < 12) throw new Error(`"${key}" needs at least twelve digits`);
  return digits;
}

export function actions(): GameActions {
  return {
    check_digit: {
      describe: "The EAN-13 check digit for the first twelve digits (weights 3, 1, 3, ... from the twelfth leftwards), the weighted sum, the whole 13-digit code, and its bars: the parity pattern the first digit chooses and the 95 modules.",
      args: '{ "digits": "978014200057" }',
      run: (args) => {
        const C = core();
        const first = twelve(args, "digits", "978014200057");
        const s = C.start({ digits: first });
        const sum = s.digits.slice(0, 12).reduce((t: number, d: number, i: number) => t + (i % 2 === 0 ? d : 3 * d), 0);
        const parts = C.parts(s);
        return {
          code: s.digits.join(""),
          checkDigit: s.digits[12],
          weightedSumOfFirstTwelve: sum,
          why: `${sum} + ${s.digits[12]} = ${sum + s.digits[12]}, a multiple of 10`,
          valid: C.valid(s.digits),
          leftParity: parts.filter((p) => p.kind === "left").map((p) => ((p as { odd?: boolean }).odd ? "L" : "G")).join(""),
          modules: C.modules(s).join(""),
        };
      },
    },
    validate: {
      describe: "Whether a 13-digit EAN code is valid, and, if one digit is wrong, which single digit change would repair it.",
      args: '{ "code": "9780142000571" }',
      run: (args) => {
        const C = core();
        const digits = String(args.code ?? "").replace(/[^0-9]/g, "").split("").map(Number);
        if (digits.length !== 13) throw new Error("a code has 13 digits");
        const valid = C.valid(digits);
        return { valid, expectedCheckDigit: C.checkDigit(digits.slice(0, 12)), note: valid ? "The weighted sum is a multiple of 10." : "The weighted sum is not a multiple of 10: a digit is wrong (any single wrong digit is always caught)." };
      },
    },
    from_isbn10: {
      describe: "The EAN-13 for an ISBN-10: 978, then its first nine digits, then a newly computed check digit.",
      args: '{ "isbn": "0-14-200057-4" }',
      run: (args) => {
        const C = core();
        const code = C.fromIsbn10(String(args.isbn ?? "0-14-200057-4"));
        return { ean13: code.join(""), checkDigit: code[12], valid: C.valid(code) };
      },
    },
  };
}

/** What the core says about the code as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const digits = Array.isArray(state.digits) ? (state.digits as number[]) : null;
  const s = C.start({ digits });
  const parts = C.parts(s);
  return {
    code: s.digits.join(""),
    checkDigit: s.digits[12],
    valid: C.valid(s.digits),
    firstDigit: s.digits[0],
    leftParity: parts.filter((p) => p.kind === "left").map((p) => ((p as { odd?: boolean }).odd ? "L" : "G")).join(""),
    isUpcA: s.digits[0] === 0,
    isBookland: s.digits[0] === 9 && s.digits[1] === 7 && (s.digits[2] === 8 || s.digits[2] === 9),
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
