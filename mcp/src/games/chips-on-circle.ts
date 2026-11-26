/*
 * run_game_logic actions and saved-position reader for Counting Chips On a Circle. The core lives
 * in chips-on-circle/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["chips-on-circle"].ChipsOnCircleCore;

function chips(v: unknown): boolean[] {
  if (typeof v === "string") {
    const t = v.replace(/\s+/g, "").toUpperCase();
    if (!/^[RG]+$/.test(t)) throw new Error("chips must be a string of R and G, chip 1 first");
    return [...t].map((c) => c === "R");
  }
  if (Array.isArray(v)) return v.map(Boolean);
  throw new Error("chips must be a string of R and G, chip 1 first");
}

function read(red: boolean[]) {
  const C = core();
  const n = red.length;
  const s = { n, red };
  const c = C.counts(s);
  const m = C.diameter(s);
  return {
    chips: red.map((r) => (r ? "R" : "G")).join(""),
    reds: c.red, greens: c.green,
    balancedHalf: m === null ? null : { from: m + 1, to: ((m + n / 2 - 1) % n) + 1 },
    allBalancedStarts: (C.balancedStarts(s) as number[]).map((k) => k + 1),
    redsMinusGreensByStart: C.walk(s),
    note: c.red === c.green ? "Equal reds and greens: some half circle always has half of each." : "The reds and greens are not equal, so the theorem does not apply.",
  };
}

export function actions(): GameActions {
  return {
    halves: {
      describe: "For chips round a circle (a string of R and G, a multiple of 4 long, 4..40): the counts, the first half circle with equal reds and greens (as the page draws it), every balanced start, and reds minus greens for the half starting at each chip.",
      args: '{ "chips": "RRRRGGGG" }',
      run: (args) => {
        const red = chips(args.chips);
        if (red.length < 4 || red.length > 40 || red.length % 4) throw new Error("the number of chips must be a multiple of 4 from 4 to 40");
        return read(red);
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const s = C.start({ n: num(state, "n", 16), red: state.red });
  return read(s.red);
}
