/*
 * run_game_logic actions and saved-position reader for Hermann's grid illusion.
 *
 * The drawing is an illustration, not a game: there is no win, loss or finish.
 * Both the actions and position() call the game's real core
 * (hermann/hermann-core.js in the site, copied into src/generated/cores/ at
 * build time). The core reproduces HermannCanvas.Draw's arithmetic: it lays
 * out the N-by-N dark figures and finds the (N-1)^2 crossings of the white
 * corridors. It paints no grey blob anywhere, and moving the gaze dot changes
 * only which crossing is "looked at", never a drawn pixel. See _shared.ts for
 * the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Shape = "rect" | "oval";

interface Point {
  x: number;
  y: number;
}

interface HermannState {
  n: number;
  part: number;
  shape: Shape;
  flipped: boolean;
  gaze: Point;
}

interface Figure extends Point {
  side: number;
  row: number;
  col: number;
}

interface Gap extends Point {
  row: number;
  col: number;
}

interface Geometry {
  width: number;
  height: number;
  canvas: number;
  x0: number;
  y0: number;
  step: number;
  side: number;
  gapX: number;
  gapY: number;
  n: number;
  part: number;
  shape: Shape;
  figures: Figure[];
}

interface NearGap {
  index: number;
  distance: number;
  point: Gap;
}

interface Hermann {
  N_RANGE: { min: number; max: number; initial: number };
  PART_RANGE: { min: number; max: number; initial: number };
  SHAPES: string[];
  start(options?: Json): HermannState;
  setOption(state: HermannState, key: string, value: unknown): HermannState;
  setGaze(state: HermannState, point: Point): HermannState;
  layout(width: number, height: number, state: HermannState): Geometry;
  gapCenters(geometry: Geometry): Gap[];
  covered(geometry: Geometry, shape: Shape, point: Point): boolean;
  openGaps(geometry: Geometry, shape: Shape): Gap[];
  nearestOpenGap(geometry: Geometry, state: HermannState, radius: number): NearGap | null;
  lookedAt(geometry: Geometry, state: HermannState): number;
  describe(geometry: Geometry, state: HermannState): string;
}

/** The core is plain JS; widen its literal-typed members for the tutor's inputs. */
const core = (): Hermann => cores["hermann"].HermannCore as unknown as Hermann;

/** The SVG viewBox the page draws into, in user units. */
const BOARD = { width: 360, height: 440 };
const round = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Board size in the core's SVG user units; the page uses 360 x 440. */
function boardSize(src: Json): { width: number; height: number } {
  const pick = (key: string, fallback: number): number => {
    const v = Math.trunc(num(src, key, fallback));
    if (!Number.isInteger(v) || v < 30 || v > 10000) {
      throw new Error(`"${key}" must be an integer from 30 to 10000`);
    }
    return v;
  };
  return {
    width: pick("boardWidth", BOARD.width),
    height: pick("boardHeight", BOARD.height),
  };
}

/**
 * Read the page's two scrollbars and two toggles with the applet's own clamps,
 * rejecting out-of-range values, plus a finite gaze point. Values the caller
 * leaves out fall back to the core's starting position.
 */
function readState(src: Json, C: Hermann): HermannState {
  let state = C.start({});
  const integer = (key: string, lo: number, hi: number): number => {
    const v = num(src, key, key === "n" ? C.N_RANGE.initial : C.PART_RANGE.initial);
    if (!Number.isInteger(v) || v < lo || v > hi) {
      throw new Error(`"${key}" must be an integer from ${lo} to ${hi}`);
    }
    return v;
  };

  if (src.n !== undefined && src.n !== null) {
    state = C.setOption(state, "n", integer("n", C.N_RANGE.min, C.N_RANGE.max));
  }
  if (src.part !== undefined && src.part !== null) {
    state = C.setOption(state, "part", integer("part", C.PART_RANGE.min, C.PART_RANGE.max));
  }
  if (src.shape !== undefined && src.shape !== null) {
    if (typeof src.shape !== "string" || C.SHAPES.indexOf(src.shape) < 0) {
      throw new Error(`"shape" must be one of ${C.SHAPES.join(", ")}`);
    }
    state = C.setOption(state, "shape", src.shape);
  }
  if (src.flipped !== undefined && src.flipped !== null) {
    if (typeof src.flipped !== "boolean") throw new Error('"flipped" must be true or false');
    state = C.setOption(state, "flipped", src.flipped);
  }
  if (src.gaze !== undefined && src.gaze !== null) {
    const g = src.gaze;
    if (typeof g !== "object" || Array.isArray(g)) {
      throw new Error('"gaze" must be an object with numeric x and y');
    }
    const point = g as Json;
    state = C.setGaze(state, {
      x: num(point, "x", state.gaze.x),
      y: num(point, "y", state.gaze.y),
    });
  }
  return state;
}

/**
 * A stable fingerprint of everything the applet actually paints: the figures
 * and the open crossings. The gaze dot is deliberately left out, so two states
 * that differ only in gaze have the same fingerprint.
 */
function drawingSignature(g: Geometry, open: Gap[]): string {
  return JSON.stringify({
    figures: g.figures.map((f) => [f.x, f.y, f.side, f.row, f.col]),
    open: open.map((p) => [p.x, p.y, p.row, p.col]),
  });
}

export function actions(): GameActions {
  return {
    open_crossings: {
      describe:
        "Report every crossing of the white corridors and which of them are open, for the current grid and figure shape. The applet paints only the dark figures: an open crossing is empty background, so any grey blob seen there is supplied by the eye, not drawn by the core.",
      args: '{ "n": 4, "part": 50, "shape": "rect" }',
      run: (args) => {
        const C = core();
        const here = readState(args, C);
        const { width, height } = boardSize(args);
        const g = C.layout(width, height, here);
        const crossings = C.gapCenters(g);
        const open = C.openGaps(g, here.shape);
        return {
          settings: { n: here.n, part: here.part, shape: here.shape, flipped: here.flipped },
          board: { width, height },
          figureCount: g.figures.length,
          figureSide: g.side,
          gapX: g.gapX,
          gapY: g.gapY,
          crossingCount: crossings.length,
          openCount: open.length,
          coveredCount: crossings.length - open.length,
          openCrossings: open.map((p) => ({ row: p.row, col: p.col, x: p.x, y: p.y })),
          greyBlobPainted: false,
          status: C.describe(g, here),
          note:
            `The core draws ${g.figures.length} ${here.shape === "oval" ? "circles" : "squares"} and nothing else. ` +
            `Its ${crossings.length} corridor crossings are either empty background (${open.length} open) or lie under a figure (${crossings.length - open.length}); none is a grey blob. ` +
            "The fuzzy spots people see at the open crossings are made by the visual system, not by any pixel the applet draws.",
        };
      },
    },
    gaze_at_crossing: {
      describe:
        "Move the gaze dot onto the nearest open crossing and check that it now registers as looked at, then compare the drawing with the gaze far away. Moving the dot never changes a figure or a crossing: it only makes the perceived blob vanish, so the change is perceptual rather than a change in pixels.",
      args: '{ "n": 4, "part": 50, "shape": "rect", "gaze": { "x": 59.5, "y": 99.5 } }',
      run: (args) => {
        const C = core();
        const here = readState(args, C);
        const { width, height } = boardSize(args);
        const g = C.layout(width, height, here);
        const open = C.openGaps(g, here.shape);
        const crossings = C.gapCenters(g);
        const near = C.nearestOpenGap(g, here, 90);
        const looked = C.lookedAt(g, here);

        // Same grid, gaze far from every crossing: the blob is no longer
        // "looked at", yet the figures and open crossings are unchanged.
        const away = C.setGaze(here, { x: -1000, y: -1000 });
        const gAway = C.layout(width, height, away);
        const openAway = C.openGaps(gAway, away.shape);
        const lookedAway = C.lookedAt(gAway, away);

        return {
          settings: { n: here.n, part: here.part, shape: here.shape, flipped: here.flipped },
          board: { width, height },
          gaze: here.gaze,
          figureCount: g.figures.length,
          openCount: open.length,
          nearestOpenGap: near
            ? { index: near.index, distance: round(near.distance), point: near.point }
            : null,
          lookedAt: looked,
          lookedAtPoint: looked >= 0 ? crossings[looked] : null,
          farGaze: away.gaze,
          lookedAtFromFar: lookedAway,
          drawingIdenticalWithGazeMoved:
            drawingSignature(g, open) === drawingSignature(gAway, openAway),
          blobVanishesOnlyPerceptually: true,
          note:
            "A crossing counts as looked at only when the gaze is within 14 units of an open crossing. " +
            "Here the gaze makes that happen, while from far away no crossing is looked at. " +
            "The two drawings have identical figures and open crossings: the dot adds no paint, it only changes what the viewer perceives.",
        };
      },
    },
  };
}

/** What the core says about the illustration whose position the page saved. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Hermann state version ${stateVersion}`);
  const C = core();
  try {
    const here = readState(state, C);
    const g = C.layout(BOARD.width, BOARD.height, here);
    const crossings = C.gapCenters(g);
    const open = C.openGaps(g, here.shape);
    const near = C.nearestOpenGap(g, here, 90);
    const looked = C.lookedAt(g, here);
    return {
      ...state,
      stateVersion,
      valid: true,
      n: here.n,
      part: here.part,
      shape: here.shape,
      flipped: here.flipped,
      gaze: here.gaze,
      board: { width: BOARD.width, height: BOARD.height },
      figureCount: g.figures.length,
      figureSide: g.side,
      crossingCount: crossings.length,
      openCrossings: open.length,
      nearestOpenGap: near
        ? { index: near.index, distance: round(near.distance), point: near.point }
        : null,
      lookedAt: looked,
      lookedAtPoint: looked >= 0 ? crossings[looked] : null,
      greyBlobPainted: false,
      status: C.describe(g, here),
      note:
        "Track.state saved the grid size, figure size, shape, the flip toggle and the gaze dot. " +
        "The core rebuilds the exact drawing: only the dark figures are painted, every corridor crossing is empty background or under a figure, and no grey blob is drawn. " +
        "A dot near an open crossing makes the blob vanish perceptually without changing a single figure.",
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note:
        "A saved Hermann position needs an integer n from 2 to 12, an integer part from 0 to 105, a shape of rect or oval, a flipped boolean and a gaze point with numeric x and y.",
    };
  }
}
