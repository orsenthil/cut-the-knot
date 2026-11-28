/*
 * run_game_logic actions and saved-position reader for the Poggendorff
 * illusion (Illusion). The core (illusion/ in the site), copied into
 * src/generated/cores/ at build time, draws the two families of straight
 * lines — slanted transversals and upright occluding bars — and checks the
 * pixel-level facts behind the page's claim. The apparent break, and the
 * claim that it grows as the two inclinations come closer, are statements
 * about perception: the core reports them as not measurable from pixels.
 * This is a demo with no win or loss; the saved state is four scrollbar
 * values plus a "lift the bars" toggle. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["illusion"].IllusionCore;

const KEYS = ["dist", "angle", "space", "width"] as const;
type Key = (typeof KEYS)[number];
/** The core builds its state dynamically in JS, so TS cannot infer the keys. */
type Setting = Record<Key, number>;

const round = (v: number): number => Math.round(v * 1e6) / 1e6;

/** The four scrollbar values, checked against the core's own applet ranges. */
function readSetting(args: Json): Setting {
  const C = core();
  const setting: Setting = { dist: 0, angle: 0, space: 0, width: 0 };
  for (const key of KEYS) {
    const range = C.LIMITS[key];
    const value = num(args, key, C.START[key]);
    if (!Number.isInteger(value) || value < range[0] || value > range[1]) {
      throw new Error(`"${key}" must be an integer between ${range[0]} and ${range[1]}, got ${value}`);
    }
    setting[key] = value;
  }
  return C.start(setting) as Setting;
}

/** The geometry and the pixel facts at one setting, all straight from the core. */
function summary(C: ReturnType<typeof core>, setting: Setting) {
  const g = C.geometry(setting);
  const cl = C.claims(setting);
  return {
    dist: setting.dist,
    angle: setting.angle,
    space: setting.space,
    width: setting.width,
    transversalCount: g.lines.length,
    barCount: g.bars.length,
    transversalSlope: round(g.slope),
    transversalSpacingX: round(g.stepX),
    barWidth: 2 * Math.trunc(setting.width / 2),
    inclinationGap: cl.inclinationGap,
    allTransversalsParallel: cl.parallel,
    clippedEndsStraight: cl.clippedStraight,
    barsVertical: cl.verticalBars,
    hiddenPiecesCollinear: cl.onOneLine,
    hiddenSampleCount: cl.hiddenCount,
    visibleSampleCount: cl.visibleCount,
  };
}

export function actions(): GameActions {
  return {
    geometry_report: {
      describe:
        "For Bogomolny's Poggendorff illusion with slant `angle`, line gap `dist`, bar spacing `space` and bar width `width`, report the picture the core actually draws: two families of perfectly straight lines — parallel transversals of slope -tan(angle), repeated every dist/sin(angle), and upright bars space apart and 2*trunc(width/2) wide. The core checks that every drawn and hidden segment stays on one straight line; whether the eye sees a break, and sees it more strongly as the two inclinations come closer, is perception and is reported as not measurable from pixels.",
      args: '{ "dist": 20, "angle": 60, "space": 50, "width": 30 }',
      run: (args) => {
        const C = core();
        const setting = readSetting(args);
        const g = C.geometry(setting);
        const cl = C.claims(setting);
        return {
          setting,
          families: {
            transversals: {
              count: g.lines.length,
              slope: round(g.slope),
              spacingX: round(g.stepX),
              halfLength: round(g.halfLength),
              parallel: cl.parallel,
            },
            bars: {
              count: g.bars.length,
              width: 2 * Math.trunc(setting.width / 2),
              spacing: setting.space,
              vertical: cl.verticalBars,
            },
            inclinationGapDegrees: cl.inclinationGap,
          },
          pixelFacts: {
            everyTransversalStraight: cl.parallel && cl.clippedStraight,
            hiddenPiecesCollinear: cl.onOneLine,
            hiddenSampleCount: cl.hiddenCount,
            visibleSampleCount: cl.visibleCount,
          },
          perception: {
            perceivedStrength: cl.perceivedStrength,
            measurableFromPixels: false,
            note:
              "The bars only cover part of each transversal: the hidden pieces continue the same straight line. That the line looks broken, and that the break looks worse as the slant approaches the bars' vertical inclination, is an effect in the eye — no coordinate or pixel changes to measure it.",
          },
          pageClaim: cl.pageClaim,
          note:
            `The core draws ${g.lines.length} straight transversals crossing ${g.bars.length} upright bars. ` +
            `All are straight and the two families differ in inclination by ${cl.inclinationGap} degrees; ` +
            "the perceived break is not a fact about the drawing.",
        };
      },
    },
    move_slider: {
      describe:
        "Move one Illusion scrollbar (`dist`, `angle`, `space` or `width`) to `value` from a starting setting and report how the two families, the counts and the inclination gap change. `key` and `value` are checked against the applet's own ranges before the real core applies the change; all lines stay straight and the apparent strength of the break is still not measurable from pixels.",
      args: '{ "dist": 20, "angle": 60, "space": 50, "width": 30, "key": "angle", "value": 75 }',
      run: (args) => {
        const C = core();
        const before = readSetting(args);
        const key = String(args.key);
        if (!(KEYS as readonly string[]).includes(key)) {
          throw new Error(`"key" must be one of ${KEYS.join(", ")}, got ${JSON.stringify(args.key)}`);
        }
        const range = C.LIMITS[key as Key];
        const value = num(args, "value");
        if (!Number.isInteger(value) || value < range[0] || value > range[1]) {
          throw new Error(`"value" must be an integer between ${range[0]} and ${range[1]}, got ${value}`);
        }
        const after = C.setParam(before, key as Key, value) as Setting;
        return {
          key,
          requested: value,
          applied: after[key as Key],
          before: summary(C, before),
          after: summary(C, after),
          note: key === "angle"
            ? "Only the slant of the transversals changes; the upright bars and their spacing stay the same, and the inclination gap to them changes."
            : key === "dist"
              ? "Only the gap between neighbouring transversals changes; their slant and the upright bars stay the same."
              : key === "space"
                ? "Only the spacing of the upright bars changes; the slanted transversals stay the same."
                : "Only the width of the upright bars changes; more or less of each transversal is hidden, but the line underneath is unchanged.",
        };
      },
    },
  };
}

/** What the core says about the four scrollbar values the page saved. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Illusion state version ${stateVersion}`);
  }
  const C = core();
  try {
    const here = readSetting(state);
    const cl = C.claims(here);
    return {
      ...state,
      stateVersion,
      valid: true,
      ...summary(C, here),
      reveal: state.reveal === true,
      touches: num(state, "touches", 0),
      perceivedStrength: cl.perceivedStrength,
      pageClaim: cl.pageClaim,
      note:
        `Track.state saved dist ${here.dist}, angle ${here.angle}, space ${here.space} and width ${here.width}` +
        `${state.reveal === true ? " with the bars lifted" : ""}. ` +
        "The core rebuilds that picture: two families of straight lines, all drawn and hidden pieces collinear. " +
        "Whether the break looks real is perception, not a measurable pixel fact.",
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note:
        "A saved Illusion position needs integer dist 5-50, angle 15-90, space 20-100 and width 5-90, plus optional reveal and touches.",
    };
  }
}
