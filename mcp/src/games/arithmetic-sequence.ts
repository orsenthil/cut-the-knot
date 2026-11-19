/*
 * run_game_logic actions and saved-position reader for 3-Term Arithmetic
 * Progression. Answers come from the real core, copied at build time.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["arithmetic-sequence"].ArithmeticSequenceCore;

function readBoard(args: Json) {
  const C = core();
  const n = C.start({ n: num(args, "n", C.DEFAULT_N) }).n;
  const raw = Array.isArray(args.colors) ? args.colors : [];
  const colors = Array.from({ length: C.MAX }, (_, i) => (Number(raw[i]) === 1 ? 1 : 0));
  return { ...C.start({ n }), colors };
}

export function actions(): GameActions {
  return {
    find_triple: {
      describe:
        "For a two-colouring of the numbers 1 to 9, find the first evenly spaced triple in the same group, and list every such triple.",
      args: '{ "n": 9, "colors": [1,0,1,0,0,1,1,0,0] }',
      run: (args) => {
        const C = core();
        const board = readBoard(args);
        const first = C.findSpecial(board);
        const all = C.allSpecials(board);
        return {
          n: board.n,
          colors: board.colors.slice(0, board.n),
          firstTriple: first ? C.numbers(first) : null,
          allTriples: all.map((t) => C.numbers(t)),
          count: all.length,
          note: first
            ? `The numbers ${C.numbers(first).join(", ")} are evenly spaced and share a group.`
            : board.n === 8
              ? "With only eight numbers a split can avoid every evenly spaced triple."
              : "Impossible with nine: any split must contain one.",
        };
      },
    },
    ap_free_splits: {
      describe:
        "Count the two-colourings of 1..8 or 1..9 that contain no evenly spaced triple, verifying W(2,3) = 9.",
      args: '{ "n": 8 }',
      run: (args) => {
        const C = core();
        const n = C.start({ n: num(args, "n", 8) }).n;
        let free = 0;
        let example: number[] | null = null;
        for (let mask = 0; mask < 1 << n; mask++) {
          const colors = Array.from({ length: C.MAX }, (_, i) => (i < n ? (mask >> i) & 1 : 0));
          if (!C.findSpecial({ ...C.start({ n }), colors })) {
            free++;
            if (!example) example = colors.slice(0, n);
          }
        }
        return {
          n,
          splits: 1 << n,
          apFree: free,
          example,
          note: n === 9
            ? "All 512 splits of nine numbers contain a one-coloured triple: W(2,3) = 9."
            : `Only ${free} of the 256 splits of eight numbers avoid every triple.`,
        };
      },
    },
  };
}

/** What the core says about the boxes currently on screen. */
export function position(state: Json): unknown {
  const C = core();
  const board = readBoard(state);
  const first = C.findSpecial(board);
  return {
    n: board.n,
    colors: board.colors.slice(0, board.n),
    toggles: Number(state.toggles) || 0,
    firstTriple: first ? C.numbers(first) : null,
    allTriples: C.allSpecials(board).map((t) => C.numbers(t)),
    note: first
      ? `The evenly spaced numbers ${C.numbers(first).join(", ")} are in the same group.`
      : "No evenly spaced triple is one-coloured on this board yet.",
  };
}
