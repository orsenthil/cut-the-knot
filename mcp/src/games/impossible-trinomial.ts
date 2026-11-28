/*
 * run_game_logic actions and saved-position reader for Impossible Trinomial
 * (Bogomolny's "An Impossible Fork", the blivet). The core lives in
 * impossible-trinomial/ on the site and is copied into src/generated/cores/ at
 * build time. It keeps the drawing as plain data: six rails, five oblique
 * strokes that close two prongs at the left, three oval cylinder ends at the
 * right, and a cover band set by two scrollbars. See _shared.ts for the shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Band = { x: number; y: number; width: number; height: number };

interface ITState {
  width: number;
  height: number;
  W: number;
  D: number;
}

interface Geometry {
  width: number;
  height: number;
  t: number;
  X0: number;
  Y0: number;
  X: number;
  Y: number;
  Z: number;
  points: Record<string, Point>;
  strokes: { name: string; a: Point; b: Point }[];
  rails: { name: string; dx: number; from: Point; to: Point }[];
  ovals: { name: string; x: number; y: number; w: number; h: number }[];
}

interface Core {
  W_MIN: number;
  W_MAX: number;
  D_MIN: number;
  D_MAX: number;
  DEFAULT_WIDTH: number;
  DEFAULT_HEIGHT: number;
  DEFAULT_W: number;
  DEFAULT_D: number;
  start(options: Json): ITState;
  withW(state: ITState, value: number): ITState;
  withD(state: ITState, value: number): ITState;
  geometry(state: ITState): Geometry;
  cover(state: ITState): Band;
  describe(state: ITState): string;
}

const core = (): Core =>
  (cores["impossible-trinomial"] as unknown as { ImpossibleTrinomialCore: Core })
    .ImpossibleTrinomialCore;

const round = (v: number): number => Math.round(v * 1e6) / 1e6;

/** A whole number in a closed range, with the core's own default when absent. */
function intIn(args: Json, key: string, lo: number, hi: number, fallback: number): number {
  const value = num(args, key, fallback);
  if (!Number.isInteger(value) || value < lo || value > hi) {
    throw new Error(`"${key}" must be a whole number from ${lo} to ${hi}, got ${JSON.stringify(args[key])}`);
  }
  return value;
}

/** Validate the page's four saved fields and let the core build its own state. */
function readState(C: Core, args: Json): ITState {
  const width = intIn(args, "width", 1, 10000, C.DEFAULT_WIDTH);
  const height = intIn(args, "height", 1, 10000, C.DEFAULT_HEIGHT);
  const W = intIn(args, "W", C.W_MIN, C.W_MAX, C.DEFAULT_W);
  const D = intIn(args, "D", C.D_MIN, C.D_MAX, C.DEFAULT_D);
  return C.start({ width, height, W, D });
}

/** The cover band and the plain-language reading at one slider setting. */
function coverReading(C: Core, state: ITState) {
  const band = C.cover(state);
  return {
    coverWidthPercent: state.W,
    coverPosition: state.D,
    cover: { x: band.x, y: band.y, width: band.width, height: band.height },
    columnsHidden: band.width,
    coverSlidOff: band.x >= state.width,
    reading: C.describe(state),
  };
}

/** Everything the core draws is fixed by width and height, never by the sliders. */
function drawingSignature(g: Geometry): string {
  return JSON.stringify({ rails: g.rails, strokes: g.strokes, ovals: g.ovals });
}

export function actions(): GameActions {
  const C = core();
  return {
    fork_report: {
      describe:
        "Reports the one flat drawing behind Bogomolny's impossible fork: six parallel rails, five oblique strokes that close two prongs at the left (one lower flat cap and one three-stroke diamond cap), and three oval cylinder ends at the right, along with the cover band set by width W percent and position D. Sliding the cover changes only which parts of these lines you can see; the rails, strokes and ovals themselves never move, which is why two different objects seem to be drawn.",
      args: '{ "width": 600, "height": 300, "W": 1, "D": 2 }',
      run: (args) => {
        const state = readState(C, args);
        const g = C.geometry(state);
        const lowerCap = g.strokes.filter((s) => s.name === "lower-end");
        const diamondCap = g.strokes.filter((s) =>
          s.name === "upper-left" || s.name === "notch-lower" || s.name === "notch-upper",
        );
        return {
          canvas: { width: g.width, height: g.height },
          geometry: { t: g.t, X0: g.X0, Y0: g.Y0, X: g.X, Y: round(g.Y), Z: g.Z },
          rails: g.rails,
          railCount: g.rails.length,
          prongs: {
            count: 2,
            lowerFlat: lowerCap,
            upperDiamond: diamondCap,
          },
          ovals: g.ovals,
          ovalCount: g.ovals.length,
          strokes: g.strokes,
          strokeCount: g.strokes.length,
          ...coverReading(C, state),
          note:
            "Six rails, four strokes closing two left prongs, one shared long edge and three oval right ends make a single flat line drawing. The cover band hides columns of that same picture; it never redraws it, so the two readings are a trick of the eye.",
        };
      },
    },
    slide_cover: {
      describe:
        "Moves one of the applet's two cover scrollbars: key W sets the band width from 1 to 60 percent of the canvas, and key D sets its position from 1 to 110. Reports the band and reading before and after, and checks that all six rails, five strokes and three ovals are exactly the same drawing — only a different stretch of it is hidden.",
      args: '{ "width": 600, "height": 300, "W": 1, "D": 2, "key": "D", "value": 110 }',
      run: (args) => {
        const beforeState = readState(C, args);
        const key = String(args.key);
        if (key !== "W" && key !== "D") {
          throw new Error(`"key" must be "W" (cover width) or "D" (cover position), got ${JSON.stringify(args.key)}`);
        }
        const lo = key === "W" ? C.W_MIN : C.D_MIN;
        const hi = key === "W" ? C.W_MAX : C.D_MAX;
        const value = intIn(args, "value", lo, hi, key === "W" ? beforeState.W : beforeState.D);
        const afterState = key === "W" ? C.withW(beforeState, value) : C.withD(beforeState, value);

        const beforeGeom = C.geometry(beforeState);
        const afterGeom = C.geometry(afterState);
        return {
          key,
          requested: value,
          applied: afterState[key],
          before: coverReading(C, beforeState),
          after: coverReading(C, afterState),
          drawingUnchanged: drawingSignature(beforeGeom) === drawingSignature(afterGeom),
          railCount: afterGeom.rails.length,
          ovalCount: afterGeom.ovals.length,
          note:
            key === "W"
              ? "Only the width of the cover changes: the six rails, five strokes and three ovals below it stay exactly where they were."
              : "Only the cover's position changes: a different slice of the same six rails, five strokes and three ovals is hidden, so the eye can read a different object.",
        };
      },
    },
  };
}

/** The page saved only the canvas size and two scrollbars (Track.state(state)). */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Impossible Trinomial state version ${stateVersion}`);
  }
  const C = core();
  try {
    const here = readState(C, state);
    const g = C.geometry(here);
    return {
      ...state,
      stateVersion,
      valid: true,
      width: here.width,
      height: here.height,
      W: here.W,
      D: here.D,
      geometry: { t: g.t, X0: g.X0, Y0: g.Y0, X: g.X, Y: round(g.Y), Z: g.Z },
      railCount: g.rails.length,
      strokeCount: g.strokes.length,
      prongCount: 2,
      ovalCount: g.ovals.length,
      ...coverReading(C, here),
      note:
        `Track.state saved a ${here.width} by ${here.height} canvas with cover width ${here.W} percent at position ${here.D}. ` +
        "The core rebuilds the same six rails, two left prongs and three oval ends underneath a band that hides some of them; moving the band changes the reading, not the drawing.",
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note:
        "A saved Impossible Trinomial position needs integer width and height from 1 to 10000, W (cover width) from 1 to 60 and D (cover position) from 1 to 110.",
    };
  }
}
