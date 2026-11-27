/*
 * run_game_logic actions and saved-position reader for Close To Hilbert.
 *
 * The core is close-to-hilbert/close-to-hilbert-core.js, copied into
 * src/generated/cores/ at build time; every number below comes from it.
 * It builds the word over directions 0 down, 1 right, 2 up, 3 left:
 * word(n) = reverse3(word(n-1)) + word(n-1) + word(n-1) + complement(word(n-1)).
 * One letter is one half-circle or tent, so the word has 4^(n-1) pieces while
 * the walking step halves. The turtle spans side by side - step and stays in
 * one fixed square; from level 3 it revisits grid points, so "fills the square"
 * is a limit statement, not a property of any finite picture. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Piece = {
  ch: string;
  from: Point;
  to: Point;
  center: Point;
  radius: number;
  a0: number;
  a1: number;
  apex: Point;
};
type CurveState = {
  width: number;
  height: number;
  side: number;
  origin: Point;
  absMax: number;
  level: number;
  step: number;
  variant: string;
};
type Core = {
  VARIANTS: string[];
  MIN_STEP: number;
  char: (d: number) => string;
  val: (c: string) => number;
  word: (level: number) => string;
  start: (options: Json) => CurveState;
  advance: (state: CurveState) => CurveState;
  pieces: (state: CurveState) => Piece[];
  describe: (state: CurveState) => string;
};

const core = (): Core => cores["close-to-hilbert"].CloseToHilbertCore as unknown as Core;
/** 4^9 letters is already a quarter of a million pieces; keep tool replies finite. */
const MAX_LEVEL = 10;
const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const point = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });

function levelArg(args: Json, key: string, fallback: number): number {
  const level = num(args, key, fallback);
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new Error(`argument "${key}" must be a whole level from 1 to ${MAX_LEVEL}`);
  }
  return level;
}

function sideArg(args: Json, key: string, fallback: number): number {
  const side = num(args, key, fallback);
  if (!Number.isInteger(side) || side < 8 || side > 4096) {
    throw new Error(`argument "${key}" must be a whole side from 8 to 4096`);
  }
  return side;
}

function variantArg(C: Core, value: unknown): string {
  if (value === undefined || value === null) return C.VARIANTS[0];
  const variant = String(value);
  if (!C.VARIANTS.includes(variant)) {
    throw new Error(`argument "variant" must be one of ${C.VARIANTS.join(", ")}`);
  }
  return variant;
}

/** The core's own reverse-with-turn and complement, used to verify the four quarters. */
function reverseTurn(C: Core, s: string): string {
  let out = "";
  for (let i = s.length - 1; i >= 0; i--) out += C.char(C.val(s[i]) + 3);
  return out;
}
function complement(C: Core, s: string): string {
  let out = "";
  for (const ch of s) out += C.char(3 - C.val(ch));
  return out;
}

/** Check the word really is four transformed copies, not just the right length. */
function fourCopy(C: Core, level: number) {
  const word = C.word(level);
  const quarters = 4 ** (level - 1);
  const result: Json = {
    wordLength: word.length,
    expectedLength: quarters,
    lengthMatches: word.length === quarters,
  };
  if (level === 1) {
    result.note = "Step 1 is the single letter 1; the four-copy rule starts at step 2.";
    return result;
  }
  const previous = C.word(level - 1);
  const q = previous.length;
  const parts = [word.slice(0, q), word.slice(q, 2 * q), word.slice(2 * q, 3 * q), word.slice(3 * q)];
  result.firstIsReverseTurnedPrevious = parts[0] === reverseTurn(C, previous);
  result.middleCopiesIdentical = parts[1] === previous && parts[2] === previous;
  result.lastIsComplementPrevious = parts[3] === complement(C, previous);
  result.allHold = result.lengthMatches === true && result.firstIsReverseTurnedPrevious === true &&
    result.middleCopiesIdentical === true && result.lastIsComplementPrevious === true;
  if (q <= 64) result.quarters = parts;
  else result.quarterStarts = parts.map((part) => part.slice(0, 32));
  return result;
}

/** Geometry every answer can report, measured from the core's own pieces. */
function route(state: CurveState, pieces: Piece[]) {
  let down = 0, right = 0, up = 0, left = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let continuous = pieces.length === 4 ** (state.level - 1);
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.ch === "0") down++;
    else if (p.ch === "1") right++;
    else if (p.ch === "2") up++;
    else left++;
    for (const v of [p.from, p.to]) {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    if (i && (p.from.x !== pieces[i - 1].to.x || p.from.y !== pieces[i - 1].to.y)) {
      continuous = false;
    }
  }
  return {
    pieces: pieces.length,
    directionCounts: { down, right, up, left },
    continuous,
    end: pieces.length ? point(pieces[pieces.length - 1].to) : point(state.origin),
    turtleSpan: pieces.length
      ? { width: round(maxX - minX), height: round(maxY - minY) }
      : { width: 0, height: 0 },
  };
}

function firstPiece(p: Piece, variant: string): Json {
  if (variant === "tents") {
    return { letter: p.ch, from: point(p.from), apex: point(p.apex), to: point(p.to),
      drawing: "two straight lines through the apex" };
  }
  return { letter: p.ch, from: point(p.from), to: point(p.to), drawing: "a half-circle",
    arc: { center: point(p.center), radius: round(p.radius),
      startDegrees: round(p.a0 * 180 / Math.PI), sweepDegrees: round((p.a1 - p.a0) * 180 / Math.PI) } };
}

export function actions(): GameActions {
  return {
    curve: {
      describe:
        "Build the four-copy curve at a step (level) from 1 to 10, with variant 'semicircles' or 'tents' and an optional side in viewBox units. Returns the direction word, a check that its four quarters are the reversed-and-turned, two identical and complemented copies of the previous level, the arc or tent drawing of the first piece, the turtle's endpoint, span and continuity. The square-filling claim is about the limit as the step tends to 0: finite levels revisit grid points from step 3 on.",
      args: '{ "level": 3, "variant": "semicircles", "side": 128 }',
      run: (args) => {
        const C = core();
        const level = levelArg(args, "level", 2);
        const variant = variantArg(C, args.variant);
        const side = sideArg(args, "side", 128);
        const state = C.start({ width: 320, height: 320, side, level, variant });
        const pieces = C.pieces(state);
        const word = C.word(level);
        return {
          level,
          variant,
          side,
          step: round(state.step),
          origin: point(state.origin),
          word: word.length <= 256 ? word : `${word.slice(0, 64)}...`,
          wordLength: word.length,
          fourCopy: fourCopy(C, level),
          ...route(state, pieces),
          firstPiece: pieces.length ? firstPiece(pieces[0], variant) : null,
          status: C.describe(state),
          note: `Each letter becomes four letters, so step ${level} has ${4 ** (level - 1)} pieces of width ${round(state.step)}. The route is continuous inside a fixed square, but it is a finite approximation: the drawing fills the square only in the limit, and from step 3 the turtle crosses some grid points twice. Both variants take exactly the same route, only the little bulges change.`,
        };
      },
    },
    next_steps: {
      describe:
        "Follow the applet's Next step from level 1 with the real core, for a given side in viewBox units: report the step, the number of arcs or tents and the status line at each level, and how many clicks it takes before the applet wraps back to level 1. Each click halves the step and quadruples the piece count until half the step would round to 1.",
      args: '{ "side": 128 }',
      run: (args) => {
        const C = core();
        const side = sideArg(args, "side", 128);
        let state = C.start({ width: 320, height: 320, side });
        const snapshot = (s: CurveState): Json => ({
          level: s.level, step: round(s.step), pieces: 4 ** (s.level - 1), status: C.describe(s),
        });
        const levels: Json[] = [snapshot(state)];
        for (let clicks = 1; clicks <= 20; clicks++) {
          const next = C.advance(state);
          if (next.level <= state.level) {
            return {
              side,
              levels,
              wrapsAfterClicks: clicks,
              wrapsTo: snapshot(next),
              note: `After ${clicks} clicks a halved step would be ${round(state.step / 2)}, below the applet's minimum of ${C.MIN_STEP}, so the next click starts again at level 1 with step ${round(next.step)}. Every level keeps the same square and quadruples the number of pieces.`,
            };
          }
          state = next;
          levels.push(snapshot(state));
        }
        throw new Error("the click cycle did not wrap back to level 1 within 20 clicks");
      },
    },
  };
}

/** Track.state saved the whole core position; rebuild the drawing from those fields. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const width = Math.max(16, Math.trunc(num(state, "width", 320)));
  const height = Math.max(16, Math.trunc(num(state, "height", 320)));
  const side = sideArg(state, "side", 128);
  const level = levelArg(state, "level", 1);
  const variant = variantArg(C, state.variant);
  const fresh = C.start({ width, height, side, level, variant });
  const rawOrigin = state.origin;
  const origin: Point = rawOrigin && typeof rawOrigin === "object" && !Array.isArray(rawOrigin)
    ? { x: num(rawOrigin as Json, "x", fresh.origin.x), y: num(rawOrigin as Json, "y", fresh.origin.y) }
    : { ...fresh.origin };
  const step = num(state, "step", fresh.step);
  if (!Number.isFinite(step) || step <= 0) {
    throw new Error('saved field "step" must be a positive number');
  }
  const absMax = num(state, "absMax", fresh.absMax);
  const here: CurveState = { width, height, side, origin, absMax, level, step, variant };
  const pieces = C.pieces(here);
  const word = C.word(level);
  const four = fourCopy(C, level);
  return {
    stateVersion,
    width,
    height,
    side,
    origin: point(origin),
    absMax,
    level,
    step: round(step),
    variant,
    reading: {
      status: C.describe(here),
      wordLength: word.length,
      fourCopyRuleHolds: four.allHold === true,
      ...route(here, pieces),
      firstPiece: pieces.length ? firstPiece(pieces[0], variant) : null,
      nextLevelOnAdvance: C.advance(here).level,
      matchesFreshStart: origin.x === fresh.origin.x && origin.y === fresh.origin.y &&
        step === fresh.step && absMax === fresh.absMax,
      note: `Track.state saved the core's position: step ${level} of ${variant}, ${word.length} letters and ${pieces.length} pieces of width ${round(step)}. The core rebuilds the arc or tent route from those fields. Each level is a finite approximation inside a fixed square; the square-filling claim is about the limit as the step shrinks, not about this picture.`,
    },
  };
}
