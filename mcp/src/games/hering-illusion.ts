/*
 * run_game_logic actions and saved-position reader for the Hering illusion.
 *
 * The core (hering-illusion/ in the site, copied into src/generated/cores/ at
 * build time) draws the fan of straight rays and the two bundles of parallel
 * straight bands, and checks the geometric facts about them. This page is a
 * demo with no win or loss; its saved state is just three scrollbar values.
 * Every number below comes from that core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["hering-illusion"].HeringIllusionCore;

/** The SVG viewBox of the live page; its coordinates are the core's canvas. */
const CANVAS = { width: 480, height: 300 };
const KEYS = ["n", "diff", "width"] as const;
type Key = (typeof KEYS)[number];
/** The core builds this object dynamically in JS, so TS cannot infer its keys. */
type Setting = Record<Key, number>;

/** Positive integer canvas dimensions, defaulting to the page's viewBox. */
function readCanvas(args: Json) {
  const width = num(args, "canvasWidth", CANVAS.width);
  const height = num(args, "canvasHeight", CANVAS.height);
  if (!Number.isInteger(width) || width < 1 ||
      !Number.isInteger(height) || height < 1) {
    throw new Error("canvasWidth and canvasHeight must be positive integers");
  }
  return { width, height };
}

/** The three scrollbar values, checked against the core's own ranges. */
function readSetting(args: Json) {
  const C = core();
  const setting: Setting = { n: 0, diff: 0, width: 0 };
  for (const key of KEYS) {
    const range = C.RANGES[key];
    const value = num(args, key, C.DEFAULTS[key]);
    if (!Number.isInteger(value) || value < range.min || value > range.max) {
      throw new Error(`"${key}" must be an integer between ${range.min} and ${range.max}, got ${value}`);
    }
    setting[key] = value;
  }
  return C.start(setting) as Setting;
}

function summary(C: ReturnType<typeof core>, setting: Setting, canvas: { width: number; height: number }) {
  const L = C.layout(setting, canvas);
  const claims = C.claims(setting, canvas);
  return {
    rays: L.counts.rays,
    bandLinesPerBundle: L.counts.top,
    bandGap: claims.bandGap,
    straightRays: claims.straightRays,
    straightBands: claims.straightBands,
    maxCenterError: claims.maxCenterError,
  };
}

export function actions(): GameActions {
  return {
    geometry_report: {
      describe:
        "For a Hering illusion with `n` fan rays, blue-band gap `diff` and band thickness `width`, report what the core actually draws: N+1 straight rays aimed at the middle and 2*width+1 straight horizontal lines in each band, one unit apart, with the two bands `diff` units apart. The straightness, spacing and gap are pixel facts; the apparent bowing of the bands is a fact about eyesight and is reported separately.",
      args: '{ "n": 25, "diff": 80, "width": 3 }',
      run: (args) => {
        const C = core();
        const setting = readSetting(args);
        const canvas = readCanvas(args);
        const L = C.layout(setting, canvas);
        const claims = C.claims(setting, canvas);
        return {
          setting,
          canvas: L.canvas,
          fan: {
            rayCount: L.counts.rays,
            firstRay: L.rays[0] || null,
            lastRay: L.rays[L.rays.length - 1] || null,
            allAimAtCenter: claims.maxCenterError <= 0.5,
            maxCenterError: claims.maxCenterError,
            straightRays: claims.straightRays,
            fanEndsOrdered: claims.fanEndsOrdered,
          },
          bands: {
            linesPerBundle: L.counts.top,
            topYs: L.top.map((b: { y1: number }) => b.y1),
            bottomYs: L.bottom.map((b: { y1: number }) => b.y1),
            straightParallelBands: claims.straightBands,
            equalSpacing: claims.equalSpacing,
            gap: claims.bandGap,
            expectedGap: claims.expectedGap,
          },
          pixelFacts: {
            everySegmentStraight: claims.noCurves,
            centerIsCanvasMiddle: claims.centerIsCanvasMiddle,
            bundlesOverlap: claims.bundlesOverlap,
          },
          perception:
            "Every line is a straight segment and the bands are horizontal parallels; the bend is in your eyes, not in the drawing.",
          note: setting.n === 0
            ? "With n = 0 the fan is skipped (no division by zero), so there are no rays to make the bands look bowed."
            : `The core draws ${L.counts.rays} straight rays and ${L.counts.top} + ${L.counts.bottom} straight band lines; the ${claims.bandGap}-unit gap is real, the curve is not.`,
        };
      },
    },
    move_slider: {
      describe:
        "Move one Hering scrollbar (`n`, `diff` or `width`) to `value` from a starting setting and report how the ray count, band-line count and gap change. `key` and `value` are checked against the core's own scrollbar ranges before the real core applies the change.",
      args: '{ "n": 25, "diff": 80, "width": 3, "key": "diff", "value": 120 }',
      run: (args) => {
        const C = core();
        const before = readSetting(args);
        const canvas = readCanvas(args);
        const key = String(args.key);
        if (!(KEYS as readonly string[]).includes(key)) {
          throw new Error(`"key" must be one of ${KEYS.join(", ")}, got ${JSON.stringify(args.key)}`);
        }
        const range = C.RANGES[key as Key];
        const value = num(args, "value");
        if (!Number.isInteger(value) || value < range.min || value > range.max) {
          throw new Error(`"value" must be an integer between ${range.min} and ${range.max}, got ${value}`);
        }
        const after = C.withSetting(before, key, value) as Setting;
        return {
          key,
          requested: value,
          before: summary(C, before, canvas),
          after: summary(C, after, canvas),
          handleBefore: C.handlePoint(before, canvas),
          handleAfter: C.handlePoint(after, canvas),
          note: key === "diff"
            ? "Only the gap between the parallel bands changes; the rays and their count stay the same."
            : key === "n"
              ? "Only the fan changes; the parallel bands and their spacing stay the same."
              : "Only the thickness of each band changes; the fan and the gap between the middle band lines stay the same.",
        };
      },
    },
  };
}

/** What the core says about the three scrollbar values the page saved. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hering Illusion state version ${stateVersion}`);
  }
  const C = core();
  const saved = {
    n: num(state, "n"),
    diff: num(state, "diff"),
    width: num(state, "width"),
  };
  const setting = readSetting(state);
  const L = C.layout(setting, CANVAS);
  const claims = C.claims(setting, CANVAS);
  return {
    stateVersion,
    n: saved.n,
    diff: saved.diff,
    width: saved.width,
    canvas: L.canvas,
    rayCount: L.counts.rays,
    bandLinesPerBundle: L.counts.top,
    bandGap: claims.bandGap,
    expectedGap: claims.expectedGap,
    straightRays: claims.straightRays,
    straightBands: claims.straightBands,
    equalSpacing: claims.equalSpacing,
    everySegmentStraight: claims.noCurves,
    maxCenterError: claims.maxCenterError,
    handlePoint: C.handlePoint(setting, CANVAS),
    note:
      `${L.counts.rays} straight rays cross the middle and the blue bands have ${L.counts.top} straight lines each, ${claims.bandGap} units apart. The bowing is perceptual: every line the core drew is straight.`,
  };
}
