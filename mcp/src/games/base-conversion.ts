/*
 * run_game_logic actions and saved-position reader for Base Conversion.
 * Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["base-conversion"].BaseConversionCore;

function readState(args: Json) {
  const C = core();
  const bases = Array.isArray(args.bases) && args.bases.length === C.NROWS
    ? args.bases.map((b) => Math.trunc(Number(b)))
    : undefined;
  const texts = Array.isArray(args.texts) && args.texts.length === C.NROWS
    ? args.texts.map((t) => String(t))
    : undefined;
  return C.start({ bases, texts });
}

export function actions(): GameActions {
  return {
    convert: {
      describe:
        "Read a number written in one base and show it in all four bases at once, including negatives and fractions.",
      args: '{ "text": "255", "fromBase": 10, "bases": [10, 2, 8, 16] }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const fromBase = Math.trunc(num(args, "fromBase", state.bases[0]));
        const text = typeof args.text === "string" ? args.text : "0";
        const next = C.convert(state, 0, text);
        const parsed = C.parseRational(text, fromBase);
        return {
          text,
          fromBase,
          bad: parsed.bad,
          rows: next.texts.map((t: string, i: number) => ({ base: next.bases[i], value: t })),
          note: parsed.bad
            ? `That is not a number in base ${fromBase}; all four boxes say ${C.BAD}.`
            : `The same number reads ${next.texts.join(" | ")} in bases ${next.bases.join(", ")}.`,
        };
      },
    },
    change_base: {
      describe:
        "Change one of the four bases (2 to 36) and re-render that row's number in the new base.",
      args: '{ "row": 0, "newBase": 2, "texts": ["255","0","0","0"] }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const row = Math.trunc(num(args, "row", 0));
        const newBase = Math.trunc(num(args, "newBase", 2));
        const next = C.changeBase(state, row, newBase);
        return {
          row,
          oldBase: state.bases[((row % C.NROWS) + C.NROWS) % C.NROWS],
          newBase: next.bases[((row % C.NROWS) + C.NROWS) % C.NROWS],
          oldText: state.texts[((row % C.NROWS) + C.NROWS) % C.NROWS],
          newText: next.texts[((row % C.NROWS) + C.NROWS) % C.NROWS],
          note: next.message,
        };
      },
    },
  };
}

/** What the core says about the four boxes currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const here = readState(state);
  return {
    bases: here.bases,
    texts: here.texts,
    activeRow: Number(state.activeRow) || 0,
    explored: state.explored === true,
    note: `The four boxes show ${here.texts.join(" | ")} in bases ${here.bases.join(", ")}.`,
  };
}
