/*
 * run_game_logic actions and saved-position reader for Contrast II.
 *
 * Bogomolny's applet ContrastII paints one flat background, then an N by N
 * grid of small squares interleaved with an (N-1) by (N-1) grid of larger
 * squares, every square in the same foreground colour. The illusion is that
 * the small squares look brighter or darker even though nothing differs but
 * their size; when the two sizes are nearly equal the edges appear to wave
 * (Kitaoka's illusion). The geometry lives in the real core, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["contrast-ii"].ContrastIiCore;

/** The five fields the page saves with Track.state (exactly Core.start's state). */
type Saved = { n: number; part: number; swapped: boolean; width: number; height: number };

const round = (v: number) => Math.round(v * 1e6) / 1e6;

function readN(v: unknown): number {
  const C = core();
  const n = Number(v);
  if (!Number.isInteger(n) || n < C.MIN_N || n > C.MAX_N) {
    throw new Error(`n must be an integer from ${C.MIN_N} to ${C.MAX_N}`);
  }
  return n;
}

function readPart(v: unknown, fallback: number): number {
  const C = core();
  const part = v === undefined || v === null ? fallback : Number(v);
  if (!Number.isInteger(part) || part < C.MIN_PART || part > C.MAX_PART) {
    throw new Error(`part must be an integer from ${C.MIN_PART} to ${C.MAX_PART}`);
  }
  return part;
}

function readSize(args: Json, key: string, fallback: number): number {
  const size = num(args, key, fallback);
  if (!Number.isInteger(size) || size < 30) {
    throw new Error(`${key} must be an integer of at least 30 (the core's minimum board side)`);
  }
  return size;
}

/** Validate action arguments and normalise them through the core's start(). */
function actionState(args: Json): Saved {
  const C = core();
  return C.start({
    n: readN(args.n === undefined ? C.START_N : args.n),
    part: readPart(args.part, C.START_PART),
    swapped: args.swapped === true,
    width: readSize(args, "width", C.WIDTH),
    height: readSize(args, "height", C.HEIGHT),
  });
}

/** Validate the position the page saved with Track.state (fixture state). */
function saved(state: Json): Saved {
  const C = core();
  const n = num(state, "n", C.START_N);
  const part = num(state, "part", C.START_PART);
  const width = num(state, "width", C.WIDTH);
  const height = num(state, "height", C.HEIGHT);
  const s: Saved = {
    n: readN(n),
    part: readPart(part, C.START_PART),
    swapped: state.swapped === true,
    width: readSize({ width }, "width", C.WIDTH),
    height: readSize({ height }, "height", C.HEIGHT),
  };
  return s;
}

/** The core's drawing and claims for one position, phrased for a tutor. */
function reading(s: Saved) {
  const C = core();
  const picture = C.squares(s);
  const g = picture.layout;
  const cl = C.claims(s);
  const allSameColour = picture.small
    .concat(picture.big)
    .every((r: { colour: string }) => r.colour === picture.ink);
  const diff = Math.abs(g.small - g.bigSide);
  return {
    n: s.n,
    part: s.part,
    swapped: s.swapped,
    grids: {
      small: { across: g.n, down: g.n, count: picture.small.length, side: g.small, sample: picture.small.slice(0, 3) },
      big: {
        across: g.n - 1,
        down: g.n - 1,
        count: picture.big.length,
        side: g.bigSide,
        sample: picture.big.slice(0, 3),
      },
    },
    geometry: {
      side: g.side, x0: g.x0, y0: g.y0, step: round(g.step),
      spanX: round(g.spanX), spanY: round(g.spanY),
      gapX: g.gapX, gapY: g.gapY, big: g.big, bigSide: g.bigSide,
    },
    colour: {
      ink: picture.ink,
      paper: picture.paper,
      allSquaresSame: allSameColour,
      note: "Every one of the squares carries the same foreground token; only their side lengths differ.",
    },
    coverage: round(C.coverage(s)),
    sideDifference: diff,
    claims: cl,
    note:
      `${s.n} by ${s.n} small squares of ${g.small} units interleaved with ` +
      `${s.n - 1} by ${s.n - 1} big squares of ${g.bigSide} units, all painted the same colour. ` +
      (cl.nearlyEqualSize
        ? "The two sizes are nearly equal, so the edges seem to wave: this is Kitaoka's illusion."
        : g.small > g.bigSide
          ? "The small squares are the larger ones; do they look brighter despite being the same colour?"
          : "The big squares are the larger ones; do the small ones look darker despite being the same colour?"),
  };
}

export function actions(): GameActions {
  return {
    picture: {
      describe:
        "Report the interleaved grids the applet draws: an N by N grid of small squares (side from `part` percent of each cell) and an (N-1) by (N-1) grid of larger squares between them. Returns counts, side lengths, sample rectangles, the shared foreground colour, the drawn-area coverage and the core's claims (including the nearly-equal case). Optional width, height and swapped reproduce the page controls; N is 2..10 and part is 0..100 as on the applet's scrollbars.",
      args: '{ "n": 8, "part": 75 }',
      run: (args) => reading(actionState(args)),
    },
    nearly_equal: {
      describe:
        "Find the settings where the two interleaved grids have nearly equal side lengths, the case where the edges appear to wave (Kitaoka's illusion). Runs the real core for every `part` from 0 to 100 at the given N (2..10) and reports all near-equal settings plus the one with the smallest difference. This is Bogomolny's Contrast II illusion; the two grids are always painted the same foreground colour.",
      args: '{ "n": 8 }',
      run: (args) => {
        const C = core();
        const n = readN(args.n === undefined ? C.START_N : args.n);
        const base = C.start({ n });
        const hits: { part: number; small: number; bigSide: number; difference: number; coverage: number }[] = [];
        let best: { part: number; small: number; bigSide: number; difference: number } | null = null;
        for (let part = C.MIN_PART; part <= C.MAX_PART; part++) {
          const state = C.withOption(base, "part", part);
          const g = C.layout(state);
          const difference = Math.abs(g.small - g.bigSide);
          if (best === null || difference < best.difference) {
            best = { part, small: g.small, bigSide: g.bigSide, difference };
          }
          if (C.claims(state).nearlyEqualSize) {
            hits.push({ part, small: g.small, bigSide: g.bigSide, difference, coverage: round(C.coverage(state)) });
          }
        }
        return {
          n,
          nearEqualParts: hits,
          closest: best,
          found: hits.length > 0,
          note:
            "The small squares have side round(step) with step = side * part / (100 * n), while the big " +
            "squares sit in the gaps and have side 2*round(gap/2) - 1, using Java's integer arithmetic. " +
            "When those two sides are within one unit the eye cannot settle on a size and the edges seem to wave.",
        };
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of that same position. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Contrast II state version ${stateVersion}`);
  }
  const s = saved(state);
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged.
    n: s.n,
    part: s.part,
    swapped: s.swapped,
    width: s.width,
    height: s.height,
    reading: reading(s),
  };
}
