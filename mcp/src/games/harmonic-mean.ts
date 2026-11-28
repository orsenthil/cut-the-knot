/*
 * run_game_logic actions and saved-position reader for Harmonic Mean.
 *
 * The real core is harmonic-mean/harmonic-mean-core.js, copied into
 * src/generated/cores/ at build time; every number below comes from it. It
 * transcribes the applet's DistanceGraph.Evaluate: one unit of distance per
 * leg, total time the sum of the reciprocals of the leg speeds, and the twins'
 * tying steady speed mean = N / (1/v1 + ... + 1/vN), the harmonic mean. The
 * arithmetic mean is never smaller, and they agree only when all speeds do.
 *
 * This is the equal-distance speed applet. The harmonic-mean length
 * CP = H(a,b)/2 of HarmonicMeanSangaku and the angle-bisector construction
 * AE = H(b,c) of HarmonicRatio are separate applets; this reader does not
 * compute those geometric lengths. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Evaluation = {
  n: number;
  legTimes: number[];
  totalTime: number;
  mean: number;
  arithmetic: number;
  harmonic: number;
  allEqual: boolean;
};
type HMState = {
  n: number;
  min: number;
  max: number;
  speeds: number[];
  mode: "time" | "distance";
  selected: number;
  race: { running: boolean; time: number };
};
type Teams = { bug: number; twin: number; leg: number; finished: boolean };
type Core = {
  MIN_N: number;
  MAX_N: number;
  MIN_SPEED: number;
  MAX_SPEED: number;
  start(o?: Json): HMState;
  evaluate(s: HMState): Evaluation;
  barWidths(s: HMState): number[];
  teamsAt(s: HMState, t: number): Teams;
  result(s: HMState): "done" | null;
};

const core = (): Core =>
  cores["harmonic-mean"].HarmonicMeanCore as unknown as Core;

/** The core's own upper clamp on a slider maximum (start(): max <= 101). */
const MAX_SLIDER = 101;
/** Floating slack for comparing means that agree in exact arithmetic. */
const EPS = 1e-9;

const SCOPE =
  "This is the HarmonicMean equal-distance speed applet: the twins tie the relay when their steady speed is the harmonic mean of the leg speeds. " +
  "The sangaku length CP = H(a,b)/2 (HarmonicMeanSangaku) and the angle-bisector length AE = H(b,c) (HarmonicRatio) belong to separate applets and are not computed here; this is an illustration, so there is no win or loss.";

const cnt = (v: number): number | null =>
  Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null;

/** Whole-number speeds, as the applet's released sliders snap to integers. */
function readSpeeds(C: Core, raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    throw new Error('argument "speeds" must be an array of whole-number speeds');
  }
  if (raw.length < C.MIN_N || raw.length > C.MAX_N) {
    throw new Error(`argument "speeds" needs between ${C.MIN_N} and ${C.MAX_N} values, got ${raw.length}`);
  }
  return raw.map((value, i) => {
    const v = Number(value);
    if (!Number.isInteger(v) || v < C.MIN_SPEED || v > MAX_SLIDER) {
      throw new Error(`speeds[${i}] must be a whole number from ${C.MIN_SPEED} to ${MAX_SLIDER}, got ${JSON.stringify(value)}`);
    }
    return v;
  });
}

/** Widen the applet's default 1..10 slider range when given faster speeds. */
function readRange(args: Json, speeds: number[]): { min: number; max: number } {
  const min = num(args, "min", 1);
  if (!Number.isInteger(min) || min < 1 || min > 100) {
    throw new Error('argument "min" must be a whole number from 1 to 100');
  }
  const max = num(args, "max", Math.max(10, ...speeds));
  if (!Number.isInteger(max) || max <= min || max > MAX_SLIDER) {
    throw new Error(`argument "max" must be a whole number from ${min + 1} to ${MAX_SLIDER}`);
  }
  for (let i = 0; i < speeds.length; i++) {
    if (speeds[i] < min || speeds[i] > max) {
      throw new Error(`speeds[${i}] = ${speeds[i]} lies outside the slider range ${min}..${max}`);
    }
  }
  return { min, max };
}

function readMode(raw: unknown): "time" | "distance" {
  if (raw === undefined || raw === null) return "time";
  if (raw !== "time" && raw !== "distance") {
    throw new Error('argument "mode" must be "time" or "distance"');
  }
  return raw;
}

/** Build a core state exactly as the page does: start() with the slider values. */
function buildState(args: Json): { C: Core; s: HMState } {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with a speeds array");
  }
  const C = core();
  const speeds = readSpeeds(C, args.speeds);
  const { min, max } = readRange(args, speeds);
  const n = num(args, "n", speeds.length);
  if (n !== speeds.length) {
    throw new Error(`argument "n" (${n}) must match the number of speeds (${speeds.length})`);
  }
  const selected = num(args, "selected", 0);
  if (!Number.isInteger(selected) || selected < 0 || selected >= n) {
    throw new Error(`argument "selected" must be a whole number from 0 to ${n - 1}`);
  }
  return {
    C,
    s: C.start({ n, min, max, speeds, mode: readMode(args.mode), selected }),
  };
}

/** One call to evaluate(), plus the team positions that the page draws. */
function reading(C: Core, s: HMState) {
  const e = C.evaluate(s);
  const half = C.teamsAt(s, e.totalTime / 2);
  const finish = C.teamsAt(s, e.totalTime);
  return {
    n: e.n,
    speeds: s.speeds.slice(),
    mode: s.mode,
    selected: s.selected,
    sliderRange: { min: s.min, max: s.max },
    averageSpeed: cnt(e.mean),
    arithmeticMean: cnt(e.arithmetic),
    harmonicMean: cnt(e.harmonic),
    meanDifferenceAMminusHM: cnt(e.arithmetic - e.harmonic),
    totalTime: cnt(e.totalTime),
    legTimes: e.legTimes.map(cnt),
    barWidths: C.barWidths(s).map(cnt),
    allSpeedsEqual: e.allEqual,
    teams: {
      halfway: {
        relayDistance: cnt(half.bug),
        twinsDistance: cnt(half.twin),
        leg: half.leg + 1,
      },
      finish: {
        relayDistance: cnt(finish.bug),
        twinsDistance: cnt(finish.twin),
        finished: finish.finished,
      },
    },
    result: C.result(s),
  };
}

export function actions(): GameActions {
  return {
    average_speed: {
      describe:
        "For equal-distance leg speeds (whole numbers, 2 to 40 of them), run the real core and report the twins' tying steady speed — the harmonic mean N/(1/v1+...+1/vN) — together with the arithmetic mean, total time, each leg's time, the bar widths and where the relay and twins are halfway and at the finish. Use min/max to widen the slider range for speeds above 10 (the example is the page's 20 mph and 30 mph halves); AM >= HM with equality only when every speed matches, and the sangaku and angle-bisector lengths belong to other applets.",
      args: '{"speeds":[20,30],"min":1,"max":30}',
      run: (args) => {
        const { C, s } = buildState(args);
        const r = reading(C, s);
        return {
          ...r,
          note:
            `Each leg covers one unit of distance, so leg k takes 1/v_k hours and the ${r.n} legs take ${r.totalTime} hours in all. ` +
            `The twins cover ${r.n} units in that time, at ${r.averageSpeed} mph: ${r.allSpeedsEqual ? "all speeds match, so the arithmetic mean agrees" : "the speeds differ, so the arithmetic mean is larger than the harmonic mean"}. ` +
            SCOPE,
        };
      },
    },

    mean_inequality: {
      describe:
        "Sweep every ordered tuple of count whole-number leg speeds from min to max through the core's evaluate() and check the page's claim that the arithmetic mean is never below the harmonic mean, with equality exactly when all the speeds in a tuple are equal. Reports the number of cases, the equality cases, any violations, the smallest and largest AM-HM gaps and one equal and one unequal example; the same result holds for the equal-distance speeds used by average_speed.",
      args: '{"min":1,"max":6,"count":2}',
      run: (args) => {
        if (!args || typeof args !== "object" || Array.isArray(args)) {
          throw new Error("arguments must be an object with min, max and count");
        }
        const C = core();
        const min = num(args, "min", 1);
        const max = num(args, "max", 6);
        const count = num(args, "count", 2);
        if (!Number.isInteger(min) || min < 1 || min > 100) {
          throw new Error('argument "min" must be a whole number from 1 to 100');
        }
        if (!Number.isInteger(max) || max <= min || max > MAX_SLIDER) {
          throw new Error(`argument "max" must be a whole number from ${min + 1} to ${MAX_SLIDER}`);
        }
        if (!Number.isInteger(count) || count < C.MIN_N || count > C.MAX_N) {
          throw new Error(`argument "count" must be a whole number from ${C.MIN_N} to ${C.MAX_N}`);
        }
        const span = max - min + 1;
        const tuples = Math.pow(span, count);
        if (tuples > 20000) {
          throw new Error(`min/max/count give ${tuples} tuples; use at most 20000`);
        }

        let cases = 0;
        let equalCases = 0;
        let above = 0;
        let equalButDifferent = 0;
        let sameButUnequal = 0;
        let allEqualMismatch = 0;
        let minGap = Infinity;
        let maxGap = -Infinity;
        let unequalExample: Json | null = null;
        let equalExample: Json | null = null;

        const speeds = new Array<number>(count).fill(min);
        for (;;) {
          const s = C.start({ n: count, min, max, speeds: speeds.slice(), mode: "time" });
          const e = C.evaluate(s);
          const gap = e.arithmetic - e.harmonic;
          const same = new Set(speeds).size === 1;
          const equalMeans = Math.abs(gap) <= EPS;
          cases++;
          if (same) equalCases++;
          if (gap < -EPS) above++;
          if (equalMeans && !same) equalButDifferent++;
          if (same && !equalMeans) sameButUnequal++;
          if (e.allEqual !== same) allEqualMismatch++;
          minGap = Math.min(minGap, gap);
          maxGap = Math.max(maxGap, gap);
          const row: Json = {
            speeds: speeds.slice(),
            arithmetic: cnt(e.arithmetic),
            harmonic: cnt(e.harmonic),
            difference: cnt(gap),
          };
          if (same && equalExample === null) equalExample = row;
          if (!same && unequalExample === null) unequalExample = row;

          let i = count - 1;
          while (i >= 0 && speeds[i] === max) { speeds[i] = min; i--; }
          if (i < 0) break;
          speeds[i]++;
        }

        return {
          range: { min, max, count, tuples },
          cases,
          equalCases,
          checks: {
            harmonicNeverAboveArithmetic: above === 0,
            equalityExactlyWhenSpeedsMatch: equalButDifferent === 0 && sameButUnequal === 0,
            coreAllEqualAgreesWithTuple: allEqualMismatch === 0,
          },
          violations: {
            harmonicAboveArithmetic: above,
            equalMeansWithDifferentSpeeds: equalButDifferent,
            differentMeansWithEqualSpeeds: sameButUnequal,
          },
          gaps: { smallestAMminusHM: cnt(minGap), largestAMminusHM: cnt(maxGap) },
          examples: { equal: equalExample, unequal: unequalExample },
          note:
            "Every tuple spends the same distance at each of its speeds, so it takes 1/v hours per leg and its average speed is the harmonic mean; averaging the speeds themselves gives the arithmetic mean, which can only be larger. " +
            SCOPE,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure them with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Harmonic Mean state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Harmonic Mean position must be an object");
  }
  const C = core();
  const rawSpeeds = Array.isArray(state.speeds)
    ? state.speeds.map((v) => Number(v)).filter((v) => Number.isFinite(v))
    : [];
  const n = num(state, "n", rawSpeeds.length);
  const selected = num(state, "selected", 0);
  const raceTime = num(state, "raceTime", 0);
  const savedMean = state.mean === undefined || state.mean === null
    ? null : num(state, "mean");
  const mode = state.mode === "distance" ? "distance" : "time";
  const saved = {
    n,
    speeds: rawSpeeds.slice(),
    mode,
    selected,
    raceTime,
    mean: savedMean,
  };

  try {
    if (rawSpeeds.length !== n) {
      throw new Error(`saved n = ${n} but there are ${rawSpeeds.length} saved speeds`);
    }
    const speeds = readSpeeds(C, rawSpeeds);
    const max = Math.max(C.MAX_SPEED, ...speeds);
    if (max > MAX_SLIDER) throw new Error(`saved speed ${max} is outside the slider range`);
    const s = C.start({ n, min: C.MIN_SPEED, max, speeds, mode, selected });
    s.race = { running: false, time: Math.max(0, raceTime) };
    const e = C.evaluate(s);
    const at = C.teamsAt(s, s.race.time);
    return {
      ...state,
      stateVersion,
      saved,
      reading: {
        n: e.n,
        speeds: s.speeds.slice(),
        mode: s.mode,
        selected: s.selected,
        raceTime: cnt(s.race.time),
        mean: cnt(e.mean),
        arithmeticMean: cnt(e.arithmetic),
        harmonicMean: cnt(e.harmonic),
        meanDifferenceAMminusHM: cnt(e.arithmetic - e.harmonic),
        totalTime: cnt(e.totalTime),
        legTimes: e.legTimes.map(cnt),
        barWidths: C.barWidths(s).map(cnt),
        allSpeedsEqual: e.allEqual,
        teamsAtSavedTime: {
          relayDistance: cnt(at.bug),
          twinsDistance: cnt(at.twin),
          leg: at.leg + 1,
          finished: at.finished,
        },
        finished: C.result(s) === "done",
      },
      savedMeanMatchesCore: savedMean !== null && Math.abs(savedMean - e.mean) <= EPS,
      savedMeanMinusCore: savedMean === null ? null : cnt(savedMean - e.mean),
      note:
        "Track.state saved the leg count, the snapped speed of each leg, the bar view, the selected leg, the race clock and the average speed shown on the page. The core rebuilds those legs and re-measures the same mean, the AM-HM gap, the leg times and both teams' distances at the saved clock time; savedMeanMinusCore should be 0. " +
        SCOPE,
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      saved,
      reading: null,
      note: `The saved position cannot be measured by the core: ${(err as Error).message}. ${SCOPE}`,
    };
  }
}
