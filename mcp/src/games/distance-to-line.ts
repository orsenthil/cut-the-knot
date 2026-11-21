/*
 * run_game_logic actions and saved-position reader for Distance from a Point to a Line.
 *
 * dist(P, L) = |Au + Bv + C| / ||n|| for the line Ax + By + C = 0 with normal
 * n = (A, B). Every answer comes from the game's real core. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["distance-to-line"].DistanceToLineCore;
const round = (v: number) => Math.round(v * 1e8) / 1e8;
const pair = (v: unknown, fallback: number[]): number[] => (Array.isArray(v) && v.length === 2 && v.every((x) => Number.isFinite(Number(x))) ? v.map(Number) : fallback);

export function actions(): GameActions {
  return {
    distance: {
      describe:
        "Distance from the point p = [u, v] to the line through p1 = [x1, y1] and p2 = [x2, y2]: the line's equation Ax + By + C = 0, its normal length, f(P), the distance |f|/||n||, which side of the line P is on, and the foot of the perpendicular.",
      args: '{ "p1": [0, 0], "p2": [4, 3], "p": [0, 5] }',
      run: (args) => {
        const C = core();
        const p1 = pair(args.p1, [0, 0]), p2 = pair(args.p2, [4, 3]), p = pair(args.p, [0, 5]);
        if (p1[0] === p2[0] && p1[1] === p2[1]) throw new Error("p1 and p2 must be different points");
        const s = { ...C.start({}), p1, p2, p };
        const m = C.measure(s);
        const n = C.measure({ ...s, normalize: true });
        return {
          equation: { A: round(m.A), B: round(m.B), C: round(m.C) },
          normalLength: round(m.norm),
          fOfP: round(m.f),
          distance: round(m.dist),
          side: m.side,
          foot: m.foot.map(round),
          normalized: { A: round(n.A), B: round(n.B), C: round(n.C), fOfP: round(n.f), distance: round(n.dist) },
          note: "The distance is |f(P)| / ||n||; with the equation normalized (||n|| = 1) it is just |f(P)|, and f(P) is then the signed distance.",
        };
      },
    },
    level_lines: {
      describe: "How far apart the level lines f = c are for the line through p1 and p2: a unit step in f is 1/||n|| of distance, so c apart in f is c/||n|| apart.",
      args: '{ "p1": [0, 0], "p2": [4, 3], "c": 1 }',
      run: (args) => {
        const C = core();
        const s = { ...C.start({}), p1: pair(args.p1, [0, 0]), p2: pair(args.p2, [4, 3]) };
        const m = C.measure(s);
        const c = num(args, "c", 1);
        return { normalLength: round(m.norm), c, distanceApart: round(Math.abs(c) / m.norm), unitStepChangesFBy: round(m.norm) };
      },
    },
  };
}

/** What the core says about the drawing as the page saved it. */
export function position(state: Json): unknown {
  const C = core();
  const s = { ...C.start({}), p1: pair(state.p1, [-4, -2]), p2: pair(state.p2, [3, 3]), p: pair(state.p, [-1, 3]), normalize: state.normalize === true };
  const m = C.measure(s);
  return {
    equation: C.equationText({ ...s, digits: num(state, "digits", 2) }),
    equationNormalized: s.normalize,
    normNormal: round(m.norm),
    fOfP: round(m.f),
    distance: round(m.dist),
    side: m.side,
    foot: m.foot.map(round),
    levelLinesShown: state.levels === true,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
  };
}
