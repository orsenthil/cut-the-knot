/*
 * run_game_logic actions and saved-position reader for Half Plane Test.
 *
 * A directed line P1 -> P2 keeps the side for which the applet's
 * GeoSDoub.FindOrientation determinant is positive. Sutherland-Hodgman
 * clipping keeps the part of the current region inside one more half plane:
 * an intersection of convex sets stays convex (or becomes empty), which is
 * the induction behind the page's proof. The core reports that region clipped
 * to the 400 x 300 board, NOT the whole unbounded intersection of the half
 * planes; every number below comes from the real core, copied from
 * half-plane-test/ into src/generated/cores/ at build time. See _shared.ts.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Line = { p1: Pt; p2: Pt };
type Bounds = { x: number; y: number; width: number; height: number };
type Poly = Pt[];
type SavedState = {
  n: number;
  lines: Line[];
  showIntersection: boolean;
  selected: number;
  slide: boolean;
  moves: number;
  explored: { lines: boolean; options: boolean };
};
type Core = {
  WIDTH: number; HEIGHT: number; BAND: number;
  MIN_LINES: number; MAX_LINES: number; HIT_RADIUS: number;
  BOUNDS: Bounds;
  copy(p: Pt): Pt;
  clamp(v: number, lo: number, hi: number): number;
  clampPoint(p: Pt, bounds?: Bounds): Pt;
  orientation(a: Pt, b: Pt, p: Pt): number;
  contains(line: Line, p: Pt): boolean;
  intersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt;
  squeeze(line: Line, bounds?: Bounds): Line;
  randomLine(rng?: () => number, bounds?: Bounds): Line;
  start(o?: { n?: number; rng?: () => number }): SavedState;
  setCount(s: SavedState, n: number, rng?: () => number): SavedState;
  hitMotion(line: Line, p: Pt): string | null;
  moveEnd(s: SavedState, index: number, which: string, p: Pt, bounds?: Bounds): SavedState;
  translate(s: SavedState, index: number, dx: number, dy: number, bounds?: Bounds): SavedState;
  dragAt(s: SavedState, index: number, p: Pt): SavedState | null;
  clipHalfPlane(poly: Poly, line: Line): Poly;
  intersection(lines: Line[], bounds?: Bounds): Poly;
  area(poly: Poly): number;
  isConvex(poly: Poly): boolean;
  inPolygon(poly: Poly, p: Pt): boolean;
  containsAll(lines: Line[], p: Pt): boolean;
  result(s: SavedState | null): "done" | null;
  move(s: SavedState, m: Json): SavedState;
};

const core = (): Core => cores["half-plane-test"].HalfPlaneTestCore as unknown as Core;

/** Coordinates are rounded for the tutor; non-finite core values print as null. */
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const cnt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;

/** Tutors may write [x, y]; the page saves { x, y }. Accept both. */
function readPoint(value: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

function readLine(value: unknown, label: string): Line {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`argument "${label}" must be { p1, p2 }`);
  }
  const o = value as Json;
  const p1 = readPoint(o.p1, `${label}.p1`);
  const p2 = readPoint(o.p2, `${label}.p2`);
  if (p1.x === p2.x && p1.y === p2.y) {
    throw new Error(`argument "${label}" needs two different points for a directed line`);
  }
  return { p1, p2 };
}

function readLines(value: unknown, label: string): Line[] {
  if (!Array.isArray(value)) throw new Error(`argument "${label}" must be an array of { p1, p2 } lines`);
  if (value.length > 20) {
    throw new Error(`argument "${label}" has ${value.length} lines; the core supports at most 20`);
  }
  return value.map((line, i) => readLine(line, `${label}[${i}]`));
}

function readBounds(value: unknown): Bounds {
  if (value === undefined || value === null) return { ...core().BOUNDS };
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error('argument "bounds" must be { x, y, width, height }');
  }
  const o = value as Json;
  const bounds = {
    x: num(o, "x", 0), y: num(o, "y", 0),
    width: num(o, "width", 400), height: num(o, "height", 300),
  };
  if (bounds.width <= 0 || bounds.height <= 0) {
    throw new Error('argument "bounds" needs positive width and height');
  }
  return bounds;
}

const centre = (b: Bounds): Pt => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

const rectangle = (b: Bounds): Poly => [
  { x: b.x, y: b.y },
  { x: b.x + b.width, y: b.y },
  { x: b.x + b.width, y: b.y + b.height },
  { x: b.x, y: b.y + b.height },
];

/** The core's own near-duplicate filter, applied after each clip for the steps. */
const dedupe = (poly: Poly): Poly => poly.filter((p, i) => {
  const q = poly[(i + 1) % poly.length];
  return Math.hypot(p.x - q.x, p.y - q.y) > 1e-9;
});

function describe(C: Core, poly: Poly): string {
  if (poly.length === 0) return "The shared part is empty.";
  const a = C.area(poly);
  if (a < 1) return "The shared part has shrunk to a line or a point.";
  return `The shared part is a convex polygon with ${poly.length} corners and area ${Math.round(a)}.`;
}

/** The page's induction made visible: a convex board, clipped one line at a time. */
function convexityByStep(C: Core, lines: Line[], b: Bounds) {
  let poly = rectangle(b);
  const rows = [{
    halfPlanes: 0, corners: poly.length, area: cnt(C.area(poly)),
    convex: C.isConvex(poly), empty: poly.length === 0,
  }];
  for (let i = 0; i < lines.length; i++) {
    poly = dedupe(C.clipHalfPlane(poly, lines[i]));
    rows.push({
      halfPlanes: i + 1, corners: poly.length, area: cnt(C.area(poly)),
      convex: C.isConvex(poly), empty: poly.length === 0,
    });
  }
  return rows;
}

const INDUCTION =
  "The board rectangle is convex. Intersecting a convex region with one kept half plane clips it with a straight cut, so the result is convex again (or empty): after n lines the common part is convex for every n.";
const CAVEAT =
  "The core clips to the drawing rectangle, so a finite polygon on the board does not mean the true intersection of the unbounded half planes is bounded; with no lines that intersection is the whole plane.";

export function actions(): GameActions {
  return {
    intersection_polygon: {
      describe:
        "The convex region common to the kept sides of directed half planes P1 -> P2, clipped to the board: its corners, shoelace area, convexity and a step-by-step record of each clip. Arbitrary board bounds may be given as { x, y, width, height }.",
      args: '{ "lines": [ { "p1": [0, 0], "p2": [400, 0] }, { "p1": [400, 0], "p2": [400, 300] }, { "p1": [400, 300], "p2": [0, 300] }, { "p1": [0, 300], "p2": [0, 0] }, { "p1": [0, 150], "p2": [300, 0] } ] }',
      run: (args) => {
        const C = core();
        const lines = readLines(args.lines, "lines");
        const b = readBounds(args.bounds);
        const poly = C.intersection(lines, b);
        const c = centre(b);
        return {
          board: b,
          halfPlanes: lines.length,
          lines: lines.map((line, i) => ({
            number: i + 1,
            p1: pt(line.p1), p2: pt(line.p2),
            centreOrientation: C.orientation(line.p1, line.p2, c),
            centreKept: C.contains(line, c),
          })),
          clippedIntersection: {
            polygon: poly.map((p) => pt(p)),
            corners: poly.length,
            area: cnt(C.area(poly)),
            convex: C.isConvex(poly),
            empty: poly.length === 0,
            description: describe(C, poly),
          },
          convexityByStep: convexityByStep(C, lines, b),
          induction: INDUCTION,
          caveat: CAVEAT,
        };
      },
    },
    kept_side: {
      describe:
        "Tests a point p against the directed line P1 -> P2: the FindOrientation determinant and its sign, whether p lies on the kept side, what reversing the line does, and (with an optional extra lines array) whether p is in all the half planes and in the board-clipped picture. Points exactly on a line get -1: kept sides are strict.",
      args: '{ "p1": [0, 0], "p2": [400, 300], "p": [100, 100], "lines": [ { "p1": [0, 0], "p2": [400, 0] }, { "p1": [400, 0], "p2": [400, 300] }, { "p1": [0, 0], "p2": [400, 300] } ] }',
      run: (args) => {
        const C = core();
        const line = readLine({ p1: args.p1, p2: args.p2 }, "line");
        const p = readPoint(args.p, "p");
        const lines = args.lines === undefined || args.lines === null ? [line] : readLines(args.lines, "lines");
        const b = readBounds(args.bounds);
        const sign = C.orientation(line.p1, line.p2, p);
        const z = line.p1.x * (line.p2.y - p.y) +
          line.p2.x * (p.y - line.p1.y) + p.x * (line.p1.y - line.p2.y);
        const boardCentre = centre(b);
        const poly = C.intersection(lines, b);
        return {
          p: pt(p),
          line: { p1: pt(line.p1), p2: pt(line.p2) },
          determinant: cnt(z),
          orientation: sign,
          kept: C.contains(line, p),
          orientationIfReversed: C.orientation(line.p2, line.p1, p),
          keptByEveryLine: C.containsAll(lines, p),
          inBoardClippedRegion: C.inPolygon(poly, p),
          region: { corners: poly.length, area: cnt(C.area(poly)), convex: C.isConvex(poly) },
          boardCentre: { point: pt(boardCentre), orientation: C.orientation(line.p1, line.p2, boardCentre) },
          note:
            "The core only uses the sign of the determinant: +1 is the kept side, which on this y-down board is the right-hand side of the arrow P1 -> P2; reversing the arrow swaps the sides, but a point on the line gives -1 either way.",
          induction: INDUCTION,
          caveat: CAVEAT,
        };
      },
    },
  };
}

/** Echo the fields the page saved, then say what the core makes of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Half Plane Test state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Half Plane Test position must be an object");
  }
  const C = core();
  const b = C.BOUNDS;
  const lines = Array.isArray(state.lines) ? readLines(state.lines, "saved lines") : [];
  const n = num(state, "n", lines.length);
  const count = Math.max(1, lines.length);
  const selected = ((num(state, "selected", 0) % count) + count) % count;
  const showIntersection = state.showIntersection === true;
  const slide = state.slide === true;
  const moves = num(state, "moves", 0);
  const explored = state.explored && typeof state.explored === "object" && !Array.isArray(state.explored)
    ? state.explored as Json : {};
  const saved: SavedState = {
    n, lines, showIntersection, selected, slide, moves,
    explored: { lines: explored.lines === true, options: explored.options === true },
  };
  const poly = C.intersection(lines, b);
  const c = centre(b);
  const chosen = lines[selected] ?? null;
  return {
    ...state,
    stateVersion,
    halfPlanes: lines.length,
    regionCorners: poly.length,
    regionArea: cnt(C.area(poly)),
    regionConvex: C.isConvex(poly),
    keptAtBoardCentre: C.containsAll(lines, c),
    finished: C.result(saved) === "done",
    core: {
      board: { x: b.x, y: b.y, width: b.width, height: b.height },
      clippedIntersection: {
        polygon: poly.map((p) => pt(p)),
        corners: poly.length,
        area: cnt(C.area(poly)),
        convex: C.isConvex(poly),
        empty: poly.length === 0,
        description: describe(C, poly),
      },
      selectedLine: chosen ? {
        number: selected + 1,
        p1: pt(chosen.p1), p2: pt(chosen.p2),
        orientationAtBoardCentre: C.orientation(chosen.p1, chosen.p2, c),
        centreKept: C.contains(chosen, c),
      } : null,
      boardCentre: pt(c),
      centreInEveryKeptSide: C.containsAll(lines, c),
      centreInBoardClippedRegion: C.inPolygon(poly, c),
      convexityByStep: convexityByStep(C, lines, b),
      moves,
      showIntersection,
      slide,
      explored: saved.explored,
      result: C.result(saved),
    },
    induction: INDUCTION,
    caveat: CAVEAT,
  };
}
