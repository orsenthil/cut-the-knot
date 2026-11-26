/*
 * run_game_logic actions and saved-position reader for Simpson's Paradox.
 * The core lives in simpson-paradox/ and is copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["simpson-paradox"].SimpsonParadoxCore;

type Point = { x: number; y: number };
type Points = Record<"a1" | "a2" | "b1" | "b2", Point>;

/** Read the four draggable points, checking the same ranges the core clamps to. */
function readPoints(source: unknown): Points {
  const C = core();
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error('points: an object with keys "a1", "a2", "b1", "b2"');
  }
  const out = {} as Points;
  for (const key of C.KEYS) {
    const raw = (source as Json)[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`points.${key} must be an object with numeric x and y`);
    }
    const p = raw as Json;
    const x = num(p, "x"), y = num(p, "y");
    if (!Number.isInteger(x) || x < C.MIN_X || x > C.MAX_X) {
      throw new Error(`points.${key}.x must be an integer ${C.MIN_X}..${C.MAX_X}`);
    }
    if (!Number.isInteger(y) || y < C.MIN_Y || y > C.MAX_Y) {
      throw new Error(`points.${key}.y must be an integer ${C.MIN_Y}..${C.MAX_Y}`);
    }
    out[key as keyof Points] = { x, y };
  }
  return out;
}

/** The maths of one arrangement: individual slopes, combined slopes, reversal. */
function analyse(points: Points) {
  const C = core();
  const s = C.start(points);
  const p = s.points as Points; // the JS core builds its points in a loop, so TS infers {}
  const sl = C.slopes(s);
  const a = { x: p.a1.x + p.a2.x, y: p.a1.y + p.a2.y, slope: sl.a };
  const b = { x: p.b1.x + p.b2.x, y: p.b1.y + p.b2.y, slope: sl.b };
  const pair = (n: 1 | 2) => ({
    a: { ...p[`a${n}` as "a1" | "a2"], slope: sl[`a${n}` as "a1" | "a2"] },
    b: { ...p[`b${n}` as "b1" | "b2"], slope: sl[`b${n}` as "b1" | "b2"] },
    bSteeper: sl[`b${n}` as "b1" | "b2"] > sl[`a${n}` as "a1" | "a2"],
  });
  // A combined slope is an x-weighted average: (x1*s1 + x2*s2)/(x1+x2).
  const weighted = (k1: "a1" | "a2" | "b1" | "b2", k2: "a1" | "a2" | "b1" | "b2") => ({
    weights: [p[k1].x / (p[k1].x + p[k2].x), p[k2].x / (p[k1].x + p[k2].x)],
    slope: C.slope({ x: p[k1].x + p[k2].x, y: p[k1].x * sl[k1] + p[k2].x * sl[k2] }),
  });
  const reversal = C.paradox(s);
  return {
    points: p,
    slopes: sl,
    pairs: { first: pair(1), second: pair(2) },
    combined: { a, b, bSteeper: b.slope > a.slope },
    weightedAverage: { a: weighted("a1", "a2"), b: weighted("b1", "b2") },
    reversal,
    verdict: reversal
      ? `B is steeper in both pairs (${sl.b1.toFixed(2)} > ${sl.a1.toFixed(2)} and ${sl.b2.toFixed(2)} > ${sl.a2.toFixed(2)}), yet together B ${sl.b.toFixed(2)} is shallower than A ${sl.a.toFixed(2)}: Simpson's paradox.`
      : `The combined slopes (A ${sl.a.toFixed(2)}, B ${sl.b.toFixed(2)}) do not reverse both individual comparisons here.`,
  };
}

export function actions(): GameActions {
  return {
    compare_slopes: {
      describe:
        "For four points A1, A2 (blue) and B1, B2 (green), compare the slopes y/x of each matched pair and of the two sums (y1+y2)/(x1+x2). Reports whether B is steeper in both pairs but shallower in total (Simpson's paradox), and shows each combined slope as an x-weighted average of its two slopes.",
      args: '{ "a1": { "x": 50, "y": 10 }, "a2": { "x": 60, "y": 80 }, "b1": { "x": 200, "y": 70 }, "b2": { "x": 50, "y": 100 } }',
      run: (args) => analyse(readPoints(args)),
    },
  };
}

/** The position the page saved with Track.state: same field names, recomputed. */
export function position(state: Json, _stateVersion: number): unknown {
  const C = core();
  const saved = state && state.points;
  const points = saved && typeof saved === "object" && !Array.isArray(saved)
    ? readPoints(saved)
    : readPoints(C.DEFAULTS);
  const s = C.start({ ...points, showNames: state?.showNames !== false });
  return {
    ...analyse(points),
    showNames: s.showNames,
    note: "The combined slope (y1+y2)/(x1+x2) is an x-weighted average of the two slopes, so a steep pair with a small x can count for little in the total.",
  };
}
