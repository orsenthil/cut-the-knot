/*
 * run_game_logic actions and saved-position reader for Social Choice. The core lives in
 * social-choice/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["social-choice"].SocialChoiceCore;

function election(ballotsArg: unknown, countsArg: number[]) {
  const C = core();
  if (!Array.isArray(ballotsArg) || ballotsArg.length < 1 || ballotsArg.length > 10) throw new Error("ballots: 1 to 10 lists of letters");
  const ballots = (ballotsArg as unknown[]).map((b) => (typeof b === "string" ? b.split("") : (b as string[])).map((x) => String(x).toUpperCase()));
  const n = ballots[0].length;
  const letters = C.LETTERS.slice(0, n).join("");
  if (n < 2 || n > 10 || ballots.some((b) => b.slice().sort().join("") !== letters)) throw new Error(`every ballot must order the same letters A.. (2 to 10 of them), e.g. "ABC"`);
  if (countsArg.length !== ballots.length) throw new Error("counts: one number of voters per ballot");
  return C.start({ ballots, counts: countsArg.map((c) => Math.max(0, Math.min(1000, Math.round(c)))) });
}

function results(s: ReturnType<ReturnType<typeof core>["start"]>, methods: number[]) {
  const C = core();
  const out: Record<string, unknown> = {};
  for (const m of methods) out[C.METHODS[m as 1 | 2 | 3 | 4]] = { scores: Object.fromEntries((C.scores(s, m) as number[]).map((v: number, i: number) => [C.LETTERS[i], v])), winners: C.winners(s, m) };
  return out;
}

export function actions(): GameActions {
  return {
    count: {
      describe: "Counts preference ballots (each a string of letters from favourite down, with its number of voters) by plurality, Borda, plurality with elimination and pairwise comparison, giving each method's scores and winners, and the elimination order.",
      args: '{ "ballots": ["ABC", "BCA", "CBA", "ACB"], "counts": [7, 8, 10, 4] }',
      run: (args) => {
        const s = election(args.ballots, numArray(args, "counts"));
        return { voters: core().voters(s), results: results(s, [1, 2, 3, 4]), eliminationOrder: core().elimination(s).eliminated };
      },
    },
  };
}

export function position(state: Json): unknown {
  const s = election(state.ballots, numArray(state, "counts"));
  const shown = Array.isArray(state.methods) ? (state.methods as number[]).filter((m) => [1, 2, 3, 4].includes(m)) : [];
  return {
    ballots: s.ballots.map((b: string[], i: number) => `${s.counts[i]} x ${b.join("")}`),
    voters: core().voters(s),
    methodsTicked: shown.map((m) => core().METHODS[m as 1 | 2 | 3 | 4]),
    results: results(s, [1, 2, 3, 4]),
  };
}
