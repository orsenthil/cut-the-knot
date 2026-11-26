/*
 * run_game_logic actions and saved-position reader for The Puzzlers' Pigeonhole. The core lives in
 * pigeonhole/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["pigeonhole"].PigeonholeCore;

function points(args: Json): { x: number; y: number }[] {
  const raw = args.points;
  if (!Array.isArray(raw)) throw new Error('"points" must be a list of {x, y} nodes');
  return raw.map((p, i) => {
    const q = p as Json;
    const x = Number(q.x), y = Number(q.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`points[${i}] needs whole-number x and y`);
    return { x, y };
  });
}

export function actions(): GameActions {
  return {
    check: {
      describe: "For dots on lattice nodes: each dot's parity box (odd/even in x and y), the first pair with a lattice midpoint, that midpoint and the lattice points strictly between them. Five dots always have such a pair (pigeonhole: only four boxes).",
      args: '{ "points": [{ "x": 2, "y": 2 }, { "x": 5, "y": 2 }, { "x": 2, "y": 5 }, { "x": 5, "y": 5 }] }',
      run: (args) => {
        const pts = points(args);
        const boxes = pts.map((p) => core().parityClass(p));
        const pair = core().findPair(pts) as number[] | null;
        return {
          boxes, distinctBoxes: new Set(boxes).size, pair: pair ? pair.map((i) => i + 1) : null,
          midpoint: pair ? core().midpoint(pts[pair[0]], pts[pair[1]]) : null,
          nodesBetween: pair ? core().between(pts[pair[0]], pts[pair[1]]) : [],
          fiveAlwaysHaveAPair: true, fourCanAvoidIt: true,
        };
      },
    },
  };
}

export function position(state: Json): unknown {
  const pts = ((state.points as Json[]) || []).map((p) => ({ x: Number(p.x), y: Number(p.y) }));
  const boxes = pts.map((p) => core().parityClass(p));
  const pair = core().findPair(pts) as number[] | null;
  return { dots: pts.length, boxes, distinctBoxes: new Set(boxes).size, pair: pair ? pair.map((i) => i + 1) : null, midpoint: pair ? core().midpoint(pts[pair[0]], pts[pair[1]]) : null, noPair: pair === null, note: "A lattice midpoint exists exactly when the two dots are in the same parity box; there are four boxes, so five dots always have a pair." };
}
