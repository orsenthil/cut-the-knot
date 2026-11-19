/*
 * run_game_logic actions and saved-position reader for Barcode Encoding.
 * Answers come from the real core's literal transcription of the applet's
 * lookup tables, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["barcode-encoding"].BarcodeEncodingCore;

function readCode(args: Json) {
  const C = core();
  const mode = args.mode === "EAN-13" ? "EAN-13" : "UPC-A";
  const digits = Array.isArray(args.digits) ? args.digits : undefined;
  return C.withDigits(C.start({ mode }), digits);
}

export function actions(): GameActions {
  return {
    encode: {
      describe:
        "Lay out a UPC-A or EAN-13 barcode from its digits: the 1/0 modules, the guard bars, the total module count and whether the check digit is valid.",
      args: '{ "mode": "UPC-A", "digits": [0,3,6,0,0,0,2,9,1,4,5,2] }',
      run: (args) => {
        const C = core();
        const state = readCode(args);
        const encoded = C.encode(state);
        const bits = encoded.bits.join("");
        return {
          mode: state.mode,
          digits: state.digits,
          modules: bits,
          moduleCount: bits.length,
          guards: encoded.segments.filter((s: { kind: string }) => s.kind === "guard").length,
          checkDigit: C.checkDigit(state.digits, state.mode),
          valid: C.validCode(state.digits, state.mode),
          note: "95 modules: guard, six left digits, middle guard, six right digits, guard. Every digit is four alternating runs.",
        };
      },
    },
    digit_bars: {
      describe:
        "Show the seven black/white bars for one digit, on either the left (odd or mirrored) or the right side, and the digit's run pattern.",
      args: '{ "digit": 6, "side": "left", "system": 0, "position": 1 }',
      run: (args) => {
        const C = core();
        const digit = Math.max(0, Math.min(9, Math.trunc(num(args, "digit", 0))));
        const side = args.side === "right" ? "right" : "left";
        const system = Math.max(0, Math.min(9, Math.trunc(num(args, "system", 0))));
        const position = Math.max(1, Math.min(6, Math.trunc(num(args, "position", 1))));
        const bars = side === "right" ? C.getEven(digit) : C.getBar(system, position, digit);
        return {
          digit, side, system, position,
          bars: bars.join(""),
          runs: C.runs(bars).map((r: { color: number; length: number }) => ({ black: r.color === 1, length: r.length })),
          note: side === "right"
            ? "The right side uses Odds with the colours exchanged."
            : C.getLeftParity(system, position)
              ? "The parity table selects the odd (plain) pattern."
              : "The parity table selects the mirrored pattern.",
        };
      },
    },
  };
}

/** What the core says about the barcode currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readCode(state);
  const bits = C.encode(here).bits.join("");
  const cursor = Math.max(0, Math.min(here.digits.length - 1, Number(state.cursor) || 0));
  return {
    mode: here.mode,
    digits: here.digits,
    cursor,
    currentDigit: here.digits[cursor],
    modules: bits.length,
    valid: C.validCode(here.digits, here.mode),
    note: `The ${here.mode} code has ${bits.length} modules; digit ${cursor + 1} is ${here.digits[cursor]}.`,
  };
}
