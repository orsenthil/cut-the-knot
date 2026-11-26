/*
 * run_game_logic actions and saved-position reader for Bertrand's Paradox.
 * The four "random chord" experiments and the counting are the real core,
 * bertrand/bertrand-core.js, copied into src/generated/cores/ at build time.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bertrand"].BertrandCore;

type Point = { x: number; y: number };
type Chord = { p1: Point; p2: Point; midpoint: Point; length: number };

/** What each of the applet's four SHOULDFIX samples actually randomises. */
const MEANING: Record<string, string> = {
  ends: "Choose two independent points uniformly on the circumference and join them.",
  fixed: "Keep one end fixed at (1, 0) and choose the other uniformly on the circumference.",
  radius: "Choose the midpoint with a uniform radius and a uniform angle, so points near the centre are favoured.",
  area: "Choose the midpoint uniformly in the disc (uniform x and y in the square, rejecting points outside).",
};

/** A whole-number argument in a stated range: bad input is an error, not a silent default. */
function whole(args: Json, key: string, lo: number, hi: number, fallback: number): number {
  const n = Math.trunc(num(args, key, fallback));
  if (n < lo || n > hi) {
    throw new Error(`argument "${key}" must be a whole number from ${lo} to ${hi}, got ${JSON.stringify(args[key])}`);
  }
  return n;
}

/** The same xorshift generator the other simulation readers use, for repeatable trials. */
function seeded(seed: number) {
  let s = (Math.trunc(seed) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function point(value: unknown, fallback: Point): Point {
  const p = value as Partial<Point> | undefined;
  const x = Number(p?.x), y = Number(p?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : fallback;
}

export function actions(): GameActions {
  return {
    models: {
      describe:
        "Bertrand's paradox: for each of the four ways of picking a chord at random (two random ends, one fixed end, random radius for the midpoint, random spot for the midpoint) give the theoretical chance that the chord is longer than a side of the inscribed equilateral triangle. The core shows why: a chord is long exactly when its midpoint lies inside the circle of radius 1/2, and the four experiments distribute midpoints differently. Optional 'mode' (0..3) reports just that model.",
      args: '{ "mode": 2 }',
      run: (args) => {
        const C = core();
        const one = args.mode === undefined ? null : whole(args, "mode", 0, C.MODES.length - 1, 0);
        const modes = (one === null ? C.MODES : [C.MODES[one]]).map((m) => ({
          mode: m.id,
          key: m.key,
          label: m.label,
          probability: m.theory,
          probabilityText: m.text,
          randomChoice: MEANING[m.key],
        }));
        const inside = C.chordFromMidpoint({ x: 0.49, y: 0 });
        const outside = C.chordFromMidpoint({ x: 0.51, y: 0 });
        return {
          triangleSide: C.SIDE,
          criterion: "length = 2*sqrt(1 - |m|^2), so a chord beats sqrt(3) exactly when its midpoint m is less than 1/2 from the centre",
          midpointExamples: [
            { midpointRadius: 0.49, length: inside && inside.length, long: inside && C.isLong(inside) },
            { midpointRadius: 0.51, length: outside && outside.length, long: outside && C.isLong(outside) },
          ],
          models: modes,
          note: "The answers 1/3, 1/3, 1/2 and 1/4 are all correct: 'at random' has to say which experiment it means.",
        };
      },
    },
    simulate: {
      describe:
        "Draw chords with the real core under one of the four random models, count how many exceed the inscribed triangle's side sqrt(3), and compare the measured share with that model's theoretical probability. 'mode' is 0..3, 'trials' is 1..100000, and 'seed' makes the run repeatable.",
      args: '{ "mode": 2, "trials": 5000, "seed": 7 }',
      run: (args) => {
        const C = core();
        const mode = whole(args, "mode", 0, C.MODES.length - 1, 0);
        const trials = whole(args, "trials", 1, 100000, 5000);
        const seed = Math.trunc(num(args, "seed", 7));
        const info = C.modeInfo(mode);
        const state = C.runBatch(C.start({ mode }), trials, seeded(seed));
        const estimate = C.estimate(state);
        const graph = C.cdf(state);
        return {
          mode,
          key: info.key,
          model: info.label,
          trials: state.total,
          longChords: state.favorable,
          rejectedDraws: state.rejected,
          theoreticalProbability: info.theory,
          theoreticalText: info.text,
          simulatedProbability: estimate,
          error: estimate === null ? null : estimate - info.theory,
          shareShorterThanTriangleSide: graph.values[graph.cutoff],
          note: `${info.label} gave ${state.favorable} long chords in ${state.total} draws (${info.text} in theory). ${MEANING[info.key]}`,
        };
      },
    },
  };
}

/** What the core says about the experiment saved on screen by Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const mode = whole(state, "mode", 0, C.MODES.length - 1, 0);
  const info = C.modeInfo(mode);

  const saved = (state.chord ?? {}) as Json;
  const home = C.start({ mode }).chord as Chord;
  const chord = C.makeChord(point(saved.p1, home.p1), point(saved.p2, home.p2)) as Chord;
  const midpoint = point(saved.midpoint, chord.midpoint);
  const midpointRadius = Math.hypot(midpoint.x, midpoint.y);
  const long = C.isLong(chord);
  const rebuilt = C.chordFromMidpoint(chord.midpoint) as Chord | null;

  const total = Math.max(0, Math.trunc(num(state, "total", 0)));
  const favorable = Math.max(0, Math.trunc(num(state, "favorable", 0)));
  const rejected = Math.max(0, Math.trunc(num(state, "rejected", 0)));
  const bins = Array.isArray(state.bins)
    ? state.bins.map((v) => Math.max(0, Math.trunc(Number(v) || 0)))
    : new Array(C.BINS).fill(0);
  const trail = Array.isArray(state.trail) ? state.trail : [];
  const counts = { ...C.start({ mode }), chord, total, favorable, rejected, bins, trail };
  const estimate = C.estimate(counts);
  const graph = C.cdf(counts);
  const last = trail.length ? (trail[trail.length - 1] as Json) : null;

  return {
    stateVersion,
    mode,
    model: info.label,
    key: info.key,
    theoreticalProbability: info.theory,
    theoreticalText: info.text,
    chord: {
      p1: chord.p1,
      p2: chord.p2,
      midpoint: chord.midpoint,
      length: chord.length,
      savedLength: saved.length === undefined ? null : Number(saved.length),
      isLongerThanTriangleSide: long,
    },
    midpointRadius,
    insideHalfRadiusCircle: midpointRadius < 0.5,
    lengthFromMidpoint: rebuilt ? rebuilt.length : null,
    midpointAgreesWithChord: rebuilt ? Math.abs(rebuilt.length - chord.length) < 1e-9 : false,
    total,
    favorable,
    rejected,
    observedProbability: estimate,
    observedPercent: estimate === null ? null : estimate * 100,
    shareShorterThanTriangleSide: graph.values[graph.cutoff],
    cutoffBin: graph.cutoff,
    trailCount: trail.length,
    lastTrailChordLong: last ? last.long === true : null,
    note: estimate === null
      ? `${info.label} has no chords drawn yet; the current chord is ${chord.length.toFixed(3)}, ${long ? "longer" : "shorter"} than sqrt(3) = ${C.SIDE.toFixed(3)}.`
      : `${info.label}: ${favorable} of ${total} chords beat sqrt(3) (${(estimate * 100).toFixed(1)}%); the page says ${info.text}.`,
  };
}
