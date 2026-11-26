/*
 * run_game_logic actions and saved-position reader for Distance Between Strings. The core lives
 * in string-distance/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["string-distance"].StringDistanceCore;

function both(s: string, t: string, caseSensitive: boolean) {
  const C = core();
  if (s.length > 200 || t.length > 200) throw new Error("strings of at most 200 characters");
  return {
    hamming: C.hamming(s, t, caseSensitive) ?? "not defined: the strings have different lengths",
    levenshtein: C.levenshtein(s, t, caseSensitive),
    oneShortestEdit: C.edits(s, t, caseSensitive),
    caseSensitive,
  };
}

export function actions(): GameActions {
  return {
    distance: {
      describe: "The Hamming distance (for equal lengths) and the Levenshtein edit distance between two strings, the page's way (case ignored unless caseSensitive), with one shortest list of edits.",
      args: '{ "s": "kitten", "t": "sitting", "caseSensitive": false }',
      run: (args) => both(String(args.s ?? ""), String(args.t ?? ""), args.caseSensitive === true),
    },
  };
}

export function position(state: Json): unknown {
  const s = String(state.s ?? ""), t = String(state.t ?? "");
  return { first: s, second: t, methodChosen: state.method === "levenshtein" ? "Levenshtein" : "Hamming", lastReports: Array.isArray(state.lines) ? state.lines : [], ...both(s, t, state.caseSensitive === true) };
}
