/*
 * run_game_logic actions and saved-position reader for Contrast 3
 * (Bogomolny's Contrast3 applet), an illustration with no win and no loss.
 *
 * A single gray annulus straddles the common edge of two squares. The right
 * square, together with its half of the ring, is copied vertically by
 * dy = round(side * H / 100) pixels while the left square stays put, so the
 * same gray sits against two different surroundings. The real core
 * (contrast-3/contrast-3-core.js, copied into src/generated/cores/ at build
 * time) supplies every byte, radius and offset below: it transcribes the
 * applet's six scrollbars, its float-to-byte colour conversion and Draw()'s
 * geometry. See _shared.ts for the shape of a game module.
 *
 * The point to keep honest: the annulus is drawn in ONE gray byte, so its two
 * halves are numerically identical. If they look different, that is
 * simultaneous contrast against two different square shades — a fact about
 * perception, not a numeric claim the core could measure.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["contrast-3"].Contrast3Core as any;

const SLIDERS = ["max", "min", "h", "gray", "minColor", "maxColor"] as const;

const r6 = (v: number): number => Number(v.toFixed(6));

/** Validate the six scrollbar values the page saves, using the core's own ranges. */
function readOptions(args: Json, C: any): Json {
  const options: Json = {};
  for (const key of SLIDERS) {
    const v = args[key];
    if (v === undefined || v === null) continue;
    const n = num(args, key);
    if (!Number.isInteger(n)) throw new Error(`"${key}" must be a whole number scrollbar value`);
    const range = C.RANGES[key];
    if (n < range.min || n > range.max) {
      throw new Error(`"${key}" must be between ${range.min} and ${range.max}`);
    }
    options[key] = n;
  }
  return options;
}

/** The page draws a 500 x 300 board; allow a caller to change it, within reason. */
function readSize(args: Json, C: any): { width: number; height: number } {
  const width = args.width === undefined ? C.WIDTH : num(args, "width");
  const height = args.height === undefined ? C.HEIGHT : num(args, "height");
  if (!(width >= 100 && width <= 4000) || !(height >= 100 && height <= 4000)) {
    throw new Error('"width" and "height" must be between 100 and 4000');
  }
  return { width, height };
}

/** Accept the tutor's [x, y] or the page's { x, y } for a board point. */
function readPoint(value: unknown, label: string): { x: number; y: number } {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(value[0]);
    y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Everything the core can say about one picture, named for a tutor. */
function reading(C: any, state: Json, width: number, height: number) {
  const a = C.analyse(state, width, height);
  const tones = a.tones as { left: number; right: number; ring: number };
  const shift = a.dy > 0 ? "down" : a.dy < 0 ? "up" : "none";
  return {
    board: { width: a.width, height: a.height },
    options: { ...state },
    squares: {
      side: a.side,
      left: { x: a.x, y: a.y },
      right: { x: a.cx, y: a.y },
    },
    tones: { left: tones.left, right: tones.right, ring: tones.ring },
    ring: {
      centre: { x: a.cx, y: a.cy },
      outerRadius: a.rOuter,
      innerRadius: a.rInner,
      grayByte: tones.ring,
      leftHalfGrayByte: tones.ring,
      rightHalfGrayByte: tones.ring,
      oneUniformGray: true,
    },
    shift: { dy: a.dy, direction: shift, pixels: Math.abs(a.dy) },
    backgrounds: { leftGrayByte: tones.left, rightGrayByte: tones.right },
    contrasts: {
      ringMinusLeft: tones.ring - tones.left,
      ringMinusRight: tones.ring - tones.right,
      leftMinusRight: tones.left - tones.right,
    },
    slideHandle: { x: r6(a.handle.x), y: r6(a.handle.y) },
    repaintPatches: a.patches,
  };
}

const NOTE =
  "The core paints the whole annulus with one gray byte, so its left and right halves are the same shade; " +
  "the two squares are separate shades and, when H is not zero, the right one takes its half of the ring with it. " +
  "A difference you seem to see between the halves is simultaneous contrast against those two backgrounds, " +
  "not a claim about the numbers: the core measures only the gray bytes and the offsets, never what the eye perceives.";

export function actions(): GameActions {
  return {
    annulus: {
      describe:
        "Report the Contrast 3 illustration built from the page's six scrollbar values (max, min, h, gray, minColor, maxColor — each optional, defaulting to the applet's opening values): the two square shades, the single gray byte used for the whole annulus, its inner and outer radii, and how far the right half is shifted. The ring is drawn in one uniform gray on both sides of the common edge, so any difference you seem to see between its halves is simultaneous contrast against two different square backgrounds — a perceptual effect, not a claim about the numbers.",
      args: '{ "maxColor": 100, "minColor": 50, "gray": 50, "max": 50, "min": 50, "h": 0 }',
      run: (args) => {
        const C = core();
        const state = C.start(readOptions(args, C));
        const { width, height } = readSize(args, C);
        return { ...reading(C, state, width, height), note: NOTE };
      },
    },

    slide_to_point: {
      describe:
        "Drag the slide handle to a board point [x, y] (or {x, y}) on the canvas and report the H scrollbar value the core recovers from its y, with the shift and reading before and after. The core's slideFromPoint gives H = round((y - cy) * 100 / side); the ring's gray never changes, only how far the right half of the picture sits from the left.",
      args: '{ "point": [422, 190], "gray": 50, "minColor": 50, "maxColor": 100 }',
      run: (args) => {
        const C = core();
        const options = readOptions(args, C);
        const { width, height } = readSize(args, C);
        const point = readPoint(args.point, "point");
        const before = C.start(options);
        const h = C.slideFromPoint(before, point, width, height);
        const after = C.withOption(before, "h", h);
        return {
          point,
          hFromPoint: h,
          before: reading(C, before, width, height),
          after: reading(C, after, width, height),
          note:
            `The marker at y = ${r6(point.y)} is H = ${h} (cy = ${r6(C.geometry(before, width, height).cy)}, side = ${r6(C.geometry(before, width, height).side)}). ` +
            NOTE,
        };
      },
    },
  };
}

/** Track.state saves the six scrollbar values; the core rebuilds the picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Contrast 3 state version ${stateVersion}`);
  const C = core();
  const source = state && typeof state === "object" ? state : ({} as Json);
  try {
    const saved = Object.fromEntries(SLIDERS.map((key) => [key, source[key]])) as Json;
    const options = readOptions(source, C);
    const picture = reading(C, C.start(options), C.WIDTH, C.HEIGHT);
    return {
      stateVersion,
      saved,
      ...picture,
      note:
        "Track.state saved the six scrollbar values (max, min, h, gray, minColor, maxColor) as plain numbers. " +
        "The core rebuilds the two square bytes, the one gray byte of the ring and the vertical shift on the page's 500 x 300 board. " +
        NOTE,
    };
  } catch (err) {
    return {
      stateVersion,
      saved: source,
      error: err instanceof Error ? err.message : String(err),
      note:
        "This saved position cannot be read as a Contrast 3 picture: each of max, min, h, gray, minColor and maxColor must be a whole number inside the applet's scrollbar range.",
    };
  }
}
