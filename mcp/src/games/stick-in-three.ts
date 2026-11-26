/*
 * run_game_logic actions and saved-position reader for Stick Broken Into Three Pieces. The core
 * lives in stick-in-three/ and is copied into src/generated/cores/ at build time. See _shared.ts
 * for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["stick-in-three"].StickInThreeCore;
const WAYS = "uniform (two random break points), longer (break once, then the longer piece), coin (then either piece at a coin toss), proportional (then a piece chosen with chance its length)";

function pieces(p: number[]) {
  const C = core();
  const q = C.normal(p) as number[];
  const e = C.excess(q);
  return {
    pieces: q.map((x) => Math.round(x * 1e4) / 1e4),
    makesTriangle: C.forms(q),
    longestPiece: e.longest + 1,
    longestMinusOtherTwo: Math.round(e.by * 1e4) / 1e4,
    note: "Pieces make a triangle exactly when each is under half the stick: P inside the middle triangle.",
  };
}

export function actions(): GameActions {
  return {
    pieces: {
      describe: "Three piece lengths (any scale; they are taken as fractions of the stick): whether they make a triangle, and by how much the longest beats the other two.",
      args: '{ "pieces": [2, 4, 3] }',
      run: (args) => pieces(numArray(args, "pieces") ?? [2, 4, 3]),
    },
    chance: {
      describe: `The exact chance that a stick broken in a given way makes a triangle, and a seeded simulation of n sticks (up to 100000). Ways: ${WAYS}.`,
      args: '{ "method": "longer", "n": 10000, "seed": 1 }',
      run: (args) => {
        const C = core();
        const method = String(args.method ?? "uniform");
        if (!C.METHODS.includes(method)) throw new Error(`method must be one of ${C.METHODS.join(", ")}`);
        const s = C.breakSticks(C.start({ method, seed: Math.round(num(args, "seed", 1)) }), num(args, "n", 10000));
        return { method, exact: (C.EXACT as Record<string, number>)[method], sticks: s.tries, triangles: s.hits, fraction: s.hits / s.tries };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const method = C.METHODS.includes(String(state.method)) ? String(state.method) : "uniform";
  const tries = num(state, "tries", 0), hits = num(state, "hits", 0);
  return {
    point: pieces(numArray(state, "pieces") ?? C.START),
    breaking: method, exact: (C.EXACT as Record<string, number>)[method],
    sticksBroken: tries, triangles: hits, fraction: tries ? hits / tries : null,
  };
}
