/*
 * run_game_logic actions and saved-position reader for Areas In Square.
 *
 * The page is an illustration, not a win/lose game: E sits on side AD of a
 * square ABCD with AE = AD/N (N >= 2), the diagonal AC and the segment BE meet
 * at M, and the four coloured pieces I, II, III, IV are claimed to have areas
 * in the ratio 1 : N : N² : N² + N - 1. Every number below comes from the
 * game's real core, copied into src/generated/cores/ at build time. See
 * _shared.ts for the shape of a game module.
 *
 * The unit area is side² / (2N(N+1)); the four ratios add to 2N(N+1), so the
 * pieces fill the square exactly. Dragging E changes N = side / AE (clamped to
 * 2..20 by the core); dragging C changes the side. The grid drawn by
 * ShowDissection (whole N only) tiles each piece with that many small right
 * triangles, which is the picture proof of the ratio.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["areas-in-square"].AreasInSquareCore;

type Point = { x: number; y: number };
type State = {
  width: number; height: number; n: number; span: number;
  showColors: boolean; showDissection: boolean; explored: boolean;
};

/* The core does no rounding; clean up floating-point shoelace noise only. */
const tidy = (v: number) => Math.round(v * 1e6) / 1e6;
const pt = (p: Point) => ({ x: tidy(p.x), y: tidy(p.y) });
const fmt = (v: number) => String(tidy(v));

function readPoint(v: unknown, key: string): Point {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`"${key}" must be a point { "x": number, "y": number }`);
  }
  const o = v as Json;
  const x = num(o, "x"), y = num(o, "y");
  return { x, y };
}

/** Whole N, as the page's number box requires. */
function readN(args: Json): number {
  const C = core();
  const n = num(args, "n");
  if (!Number.isInteger(n) || n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`n must be a whole number from ${C.N_MIN} to ${C.N_MAX}`);
  }
  return n;
}

/** A complete core state; width/height/span are optional board settings. */
function readState(args: Json): State {
  const C = core();
  const width = num(args, "width", C.WIDTH);
  const height = num(args, "height", C.HEIGHT);
  if (!(width > 2 * C.MARGIN) || !(height > 2 * C.MARGIN)) {
    throw new Error(`width and height must exceed twice the ${C.MARGIN}-unit margin`);
  }
  const n = readN(args);
  const span = num(args, "span", C.snapSide(width, height, n));
  const maxSide = C.maxSide(width, height);
  if (!(span > 0) || span > maxSide + 1e-9) {
    throw new Error(`span must be positive and at most ${maxSide} on this board`);
  }
  return {
    width, height, n, span,
    showColors: args.showColors === true,
    showDissection: args.showDissection === true,
    explored: true,
  };
}

/** The core's dissection of one state, phrased for a tutor. */
function reading(s: State) {
  const C = core();
  const g = C.compute(s);
  const checks = C.claims(g);
  const ratioText = `1 : ${fmt(g.n)} : ${fmt(g.n * g.n)} : ${fmt(g.n * g.n + g.n - 1)}`;
  return {
    n: g.n,
    squareSide: tidy(g.side),
    squareArea: tidy(g.squareArea),
    corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D), E: pt(g.E) },
    crossing: { M: pt(g.M), P: pt(g.P) },
    EAtFraction: g.fraction,
    areas: {
      I: tidy(g.areas[0]), II: tidy(g.areas[1]),
      III: tidy(g.areas[2]), IV: tidy(g.areas[3]),
    },
    ratio: { I: g.ratios[0], II: g.ratios[1], III: g.ratios[2], IV: g.ratios[3] },
    ratioText,
    unitArea: tidy(g.unit),
    totalArea: tidy(g.total),
    ratioSum: tidy(g.ratios.reduce((a: number, b: number) => a + b, 0)),
    checks,
    status: C.describe(s),
    note:
      `AE = AD / ${fmt(g.n)}, and AC meets BE at M. The four pieces take ` +
      `${ratioText} units of area side² / (2N(N+1)) = ${tidy(g.unit)} each; ` +
      `they add to the whole square, ${tidy(g.total)} = ${tidy(g.squareArea)}.`,
  };
}

export function actions(): GameActions {
  return {
    dissection_areas: {
      describe:
        "For a whole N from 2 to 20, report the four pieces' actual areas in the page's square and the claimed ratio 1 : N : N² : N²+N−1, with the unit area, the sum, the crossing point M and the core's checks. Optional width and height (default 400 by 400) and span (default the centred square snapped to a multiple of N) set the board; showColors and showDissection reproduce the page's switches.",
      args: '{ "n": 3 }',
      run: (args) => reading(readState(args)),
    },
    point_e: {
      describe:
        "Drag the point E along side AD and read the resulting picture. Give E as {x, y} in the page's board (default 400 by 400, with optional width and height); the core sets N = side / AE, clamped to 2..20, and reports that N, E's position, the four actual areas and the ratio. E must lie above A on the board, or the move is rejected.",
      args: '{ "E": { "x": 20, "y": 260 } }',
      run: (args) => {
        const C = core();
        const width = num(args, "width", C.WIDTH);
        const height = num(args, "height", C.HEIGHT);
        if (!(width > 2 * C.MARGIN) || !(height > 2 * C.MARGIN)) {
          throw new Error(`width and height must exceed twice the ${C.MARGIN}-unit margin`);
        }
        const point = readPoint(args.E, "E");
        if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) {
          throw new Error(`E is outside the ${width} by ${height} board`);
        }
        const start = C.start({ width, height });
        const next = C.move(start, { type: "point", name: "E", point });
        if (!next) throw new Error("E must lie above A on side AD so that AE is positive");
        const s: State = {
          width, height, n: next.n, span: next.span,
          showColors: next.showColors, showDissection: next.showDissection,
          explored: true,
        };
        const g = C.compute(s);
        return {
          E: pt(point),
          AE: tidy(g.A.y - g.E.y),
          AD: tidy(g.side),
          fractionOfAD: tidy((g.A.y - g.E.y) / g.side),
          nFromPointE: g.n,
          wholeN: Number.isInteger(g.n),
          reading: reading(s),
        };
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of that same position. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Areas In Square state version ${stateVersion}`);
  }
  const C = core();
  const width = num(state, "width", C.WIDTH);
  const height = num(state, "height", C.HEIGHT);
  if (!(width > 2 * C.MARGIN) || !(height > 2 * C.MARGIN)) {
    throw new Error(`width and height must exceed twice the ${C.MARGIN}-unit margin`);
  }
  const n = num(state, "n", 2);
  if (n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`saved n must be between ${C.N_MIN} and ${C.N_MAX}`);
  }
  const span = num(state, "span", C.snapSide(width, height, n));
  if (!(span > 0) || span > C.maxSide(width, height) + 1e-9) {
    throw new Error(`saved span must be positive and at most ${C.maxSide(width, height)}`);
  }
  const s: State = {
    width, height, n, span,
    showColors: state.showColors === true,
    showDissection: state.showDissection === true,
    explored: state.explored === true,
  };
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged.
    width, height, n, span,
    showColors: s.showColors,
    showDissection: s.showDissection,
    explored: s.explored,
    reading: reading(s),
  };
}
