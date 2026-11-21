/*
 * run_game_logic actions and saved-position reader for ISBN Encoding.
 * The core lives in isbn-encoding/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["isbn-encoding"].IsbnEncodingCore;
function read(args: Json) {
  const symbols = Array.isArray(args.symbols) ? args.symbols.map(String) : core().start().symbols;
  if (symbols.length !== 13) throw new Error("an ISBN display has 13 cells");
  return { symbols, moves: Number.isFinite(args.moves) ? Number(args.moves) : 0 };
}

export function actions(): GameActions {
  return {
    check: {
      describe: "Validate an ISBN display: hyphen rules and the mod-11 check digit, plus its EAN-13 embedding.",
      args: '{ "symbols": ["0","-","3","0","6","-","4","0","6","1","5","-","2"] }',
      run: (args) => {
        const r = core().analyze(read(args));
        return {
          symbols: r.symbols, digits: r.digits, checkDigit: r.checkDigit,
          formatValid: r.formatValid, sumValid: r.sumValid, valid: r.valid,
          ean13: r.ean.join(""), barcodeModules: r.modules.length,
          note: "10*d1 + ... + d10 must be a multiple of 11; the EAN uses a separate mod-10 check.",
        };
      },
    },
    check_digit: {
      describe: "Compute the ISBN-10 check digit from nine digits (10 becomes X).",
      args: '{ "digits": [0,3,0,6,4,0,6,1,5] }',
      run: (args) => {
        if (!Array.isArray(args.digits)) throw new Error("digits must be an array");
        const digits = args.digits.map(Number);
        return { digits, checkDigit: core().checkDigit(digits), note: "(11 - sum((10-i)*d_i) mod 11) mod 11" };
      },
    },
  };
}

export function position(state: Json): unknown {
  const r = core().analyze(read(state));
  return {
    symbols: r.symbols, checkDigit: r.checkDigit,
    formatValid: r.formatValid, sumValid: r.sumValid, valid: r.valid,
    ean: r.ean,
    note: r.valid ? "A valid ISBN-10." : "The ISBN rules are not satisfied yet.",
  };
}
