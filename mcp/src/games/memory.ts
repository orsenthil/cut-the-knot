/*
 * run_game_logic actions and saved-position reader for Memory.
 * The core lives in memory/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["memory"].MemoryCore;

export function actions(): GameActions {
  return {
    cards_match: {
      describe: "Do two cards match in a mode? Modes: 0 Count 1 (the same Id mod 5), 1 Count 2 (count and colour Id div 12), 2 Shape, 3 Number, 4 Count 3, 5 Addition, 6 Add/Sub, 7 All Ops (the same Id). Ids are 0..29.",
      args: '{ "which": 1, "a": 0, "b": 5 }',
      run: (args) => {
        const which = Math.floor(num(args, "which")), a = Math.floor(num(args, "a")), b = Math.floor(num(args, "b"));
        return { which, caption: core().MODES[core().clampWhich(which)].caption, a: { count: core().countOf(a), colour: core().colourOf(a), shape: core().shapeOf(a) }, b: { count: core().countOf(b), colour: core().colourOf(b), shape: core().shapeOf(b) }, match: core().equals(which, a, b) };
      },
    },
    make_expression: {
      describe: "A card's expression for a number (Id 0..29) in mode 5 (a sum, Id + 3), 6 (a sum or difference) or 7 (a sum, difference, product or quotient), all with the same value.",
      args: '{ "which": 7, "id": 12 }',
      run: (args) => {
        const which = Math.floor(num(args, "which")), id = Math.floor(num(args, "id"));
        if (which < 5 || which > 7 || id < 0 || id > 29) throw new Error("which must be 5..7 and id 0..29");
        const e = core().expression(which, id, Math.random);
        return { which, id, expression: e.text, value: e.value };
      },
    },
  };
}

export function position(state: Json): unknown {
  const matched = (state.matched as boolean[]).filter(Boolean).length;
  return {
    mode: core().MODES[core().clampWhich(Number(state.which))].caption, turns: state.turns, cardsMatched: matched, pairsLeft: (20 - matched) / 2, cardsUp: (state.showing as number[]).length,
    note: "Every pair was dealt the same hidden number; what counts as a match depends on the mode.",
  };
}
