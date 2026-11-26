/*
 * run_game_logic actions and saved-position reader for Stick Broken Into Three Pieces
 * (Cartesian). The core lives in stick-in-square/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["stick-in-square"].StickInSquareCore;
const exact = (mode: string) => (core().EXACT as Record<string, number>)[mode];

function point(x: number, y: number) {
  const C = core();
  const s = C.moveTo(C.start(), x, y);
  const p = C.pieces(s.x, s.y) as number[];
  return {
    breaks: [s.x, s.y], pieces: p.map((v) => Math.round(v * 1e4) / 1e4),
    makesTriangle: C.forms(p), region: C.region(s.x, s.y),
    note: "pink: a triangle; green: the shorter piece was broken second (impossible in the two-step experiment).",
  };
}

export function actions(): GameActions {
  return {
    point: {
      describe: "Break points x and y in [0, 1] (measured from the stick's lower end): the three pieces, whether they make a triangle, and the region of the square (pink, green or white).",
      args: '{ "x": 0.35, "y": 0.7 }',
      run: (args) => point(num(args, "x", 0.5), num(args, "y", 0.5)),
    },
    chance: {
      describe: "The exact chance of a triangle and a seeded simulation of n sticks (up to 100000): mode one (both break points uniform) or two (break once, then the longer piece).",
      args: '{ "mode": "two", "n": 10000, "seed": 1 }',
      run: (args) => {
        const C = core();
        const mode = String(args.mode ?? "one");
        if (!C.MODES.includes(mode)) throw new Error("mode must be one or two");
        const s = C.run(C.start({ mode, seed: Math.round(num(args, "seed", 1)) }), num(args, "n", 10000)).state;
        return { mode, exact: exact(mode), sticks: s.tries, triangles: s.hits, fraction: s.hits / s.tries };
      },
    },
  };
}

export function position(state: Json): unknown {
  const C = core();
  const mode = C.MODES.includes(String(state.mode)) ? String(state.mode) : "one";
  const tries = num(state, "tries", 0), hits = num(state, "hits", 0);
  return {
    P: point(num(state, "x", 1 / 3), num(state, "y", 2 / 9)),
    experiment: mode === "one" ? "one step: both break points uniform" : "two steps: break once, then the longer piece",
    exact: exact(mode), sticksBroken: tries, triangles: hits, fraction: tries ? hits / tries : null,
  };
}
