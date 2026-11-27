/*
 * run_game_logic actions and saved-position reader for Equal Areas in
 * Equilateral Triangle (Bogomolny's EqualAreasInEquilateralTriangle applet).
 *
 * M is a point inside equilateral triangle ABC; its perpendicular feet on BC,
 * CA and AB are A′, B′ and C′. The six segments from M split ABC into six
 * small triangles. Twice each piece's area is (distance from M to its side)
 * times (its base on that side). The three alternating green pieces
 * (AMB′, BMC′, CMA′ — core W[5], W[1], W[3]) and the three purple pieces
 * (A′MB, B′MC, C′MA — W[2], W[4], W[0]) each add to half of the whole
 * triangle's doubled area, i.e. to the triangle's own area, for every M.
 *
 * The real core is
 * equal-areas-in-equilateral-triangle/equal-areas-in-equilateral-triangle-core.js,
 * copied into src/generated/cores/ at build time. Coordinates are board
 * units of the page's 420 x 360 viewBox, y down. See _shared.ts for the
 * game-module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = {
  A: Point; B: Point; C: Point; side: number; M: Point;
  showNames: boolean; hint: boolean; width: number; height: number;
};
type Geometry = {
  Ap: Point; Bp: Point; Cp: Point;
  Ab: Point; Ac: Point; Ba: Point; Bc: Point; Ca: Point; Cb: Point;
  W: number[]; triangles: Point[][];
};
type Sums = { left: number; right: number; all: number; whole: number };
interface EqualAreasCore {
  WIDTH: number;
  HEIGHT: number;
  start(options?: Partial<Pick<State, "width" | "height" | "showNames" | "hint">>): State;
  inside(state: State, p: Point): boolean;
  moveM(state: State, p: Point): State;
  geometry(state: State): Geometry;
  sums(state: State): Sums;
  distance(p: Point, q: Point): number;
  toggle(state: State, option: "showNames" | "hint"): State;
  reset(state: State): State;
  status(state: State): string;
}

const core = (): EqualAreasCore =>
  cores["equal-areas-in-equilateral-triangle"].EqualAreasInEquilateralTriangleCore as unknown as EqualAreasCore;

/** Core numbers as plain JSON numbers, rounded or null when not finite. */
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const num6 = (v: number): number | null => (Number.isFinite(v) ? r6(v) : null);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(3)) : null);
const pt = (p: Point): { x: number; y: number } => ({ x: r6(p.x), y: r6(p.y) });
const near = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** Accept the page's { x, y } dots and the tutor's [x, y] arguments alike. */
function readPoint(value: unknown, label: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

function readBoard(C: EqualAreasCore, args: Json): { width: number; height: number } {
  const width = num(args, "width", C.WIDTH);
  const height = num(args, "height", C.HEIGHT);
  if (!(width >= 80 && width <= 4000) || !(height >= 80 && height <= 4000)) {
    throw new Error('"width" and "height" must be board sizes between 80 and 4000');
  }
  return { width, height };
}

/** Build the core's opening picture, applying an optional interior move of M. */
function buildState(args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points and options");
  }
  const C = core();
  const board = readBoard(C, args);
  let s = C.start({
    ...board,
    showNames: args.showNames === true,
    hint: args.hint === true,
  });
  if (args.M !== undefined && args.M !== null) {
    const M = readPoint(args.M, "M");
    if (!C.inside(s, M)) {
      throw new Error("M must lie inside triangle ABC: the applet clamps the handle to the triangle and draws nothing outside");
    }
    s = C.moveM(s, M);
  }
  return s;
}

/** Everything the core can measure about one picture, in tutor-friendly form. */
function reading(C: EqualAreasCore, s: State) {
  const g = C.geometry(s);
  const sums = C.sums(s);
  const half = sums.whole / 2;
  const sides = ["AB (from C′)", "AB (from C′)", "BC (from A′)",
    "BC (from A′)", "CA (from B′)", "CA (from B′)"];
  const pieces = g.W.map((w, i) => ({
    index: i,
    side: sides[i],
    vertices: g.triangles[i].map(pt),
    doubledArea: num6(w),
    area: num6(w / 2),
  }));
  const green = [5, 1, 3];  // AMB′, BMC′, CMA′ — the page's left bar
  const purple = [2, 4, 0]; // A′MB, B′MC, C′MA — the page's right bar
  const triple = (indices: number[], total: number) => ({
    indices,
    doubledArea: num6(total),
    area: num6(total / 2),
    fractionOfTriangle: num6(total / half),
    pieceDoubledAreas: indices.map((i) => num6(g.W[i])),
  });
  return {
    M: pt(s.M),
    MInside: C.inside(s, s.M),
    feet: { AprimeOnBC: pt(g.Ap), BprimeOnCA: pt(g.Bp), CprimeOnAB: pt(g.Cp) },
    pieces,
    green: triple(green, sums.left),
    purple: triple(purple, sums.right),
    triangle: {
      A: pt(s.A), B: pt(s.B), C: pt(s.C),
      side: num6(s.side),
      doubledArea: num6(sums.whole),
      area: num6(half),
    },
    equality: {
      greenMinusPurple: sig(sums.left - sums.right),
      greenMinusTriangleArea: sig(sums.left - half),
      purpleMinusTriangleArea: sig(sums.right - half),
      allDoubledPieces: num6(sums.all),
      greenEqualsPurple: near(sums.left, sums.right),
      greenEqualsTriangleArea: near(sums.left, half),
      purpleEqualsTriangleArea: near(sums.right, half),
    },
    hint: { showNames: s.showNames === true, showHint: s.hint === true },
    status: C.status(s),
    note:
      "Each small triangle's doubled area is its base segment on a side times the distance from M to that side. " +
      "Writing M's barycentric weights as a + b + c = 1, the distances are a·h, b·h and c·h (Viviani's theorem), " +
      "and expanding the six products makes each alternating triple whole·(ab + bc + ca + (a² + b² + c²)/2) = whole/2. " +
      "The totals in doubledArea units are therefore the triangle's own (ordinary) area, which is why they equal triangle.area here; " +
      "an individual triple's ordinary area (field `area`) is half of that. Both bars stay equal whatever M does. " +
      "The original applet used six colours; this page groups the same six pieces into green and purple.",
  };
}

/** Interior sample points spread around the centroid by barycentric weights. */
function sweepPoints(C: EqualAreasCore, s: State, args: Json): Point[] {
  if (args.positions !== undefined && args.positions !== null) {
    if (!Array.isArray(args.positions)) throw new Error('"positions" must be an array of [x, y] or { x, y } points');
    if (args.positions.length < 2 || args.positions.length > 12) {
      throw new Error('"positions" must contain between 2 and 12 points');
    }
    return args.positions.map((value, i) => {
      const p = readPoint(value, `positions[${i}]`);
      if (!C.inside(s, p)) throw new Error(`positions[${i}] must be inside triangle ABC`);
      return p;
    });
  }
  const raw = num(args, "samples", 6);
  if (!Number.isInteger(raw) || raw < 2 || raw > 12) {
    throw new Error('"samples" must be a whole number from 2 to 12');
  }
  return Array.from({ length: raw }, (_, k) => {
    const t = (2 * Math.PI * k) / raw;
    const wa = 1 + 0.8 * Math.cos(t);
    const wb = 1 + 0.8 * Math.cos(t - 2 * Math.PI / 3);
    const wc = 1 + 0.8 * Math.cos(t + 2 * Math.PI / 3);
    return {
      x: (wa * s.A.x + wb * s.B.x + wc * s.C.x) / 3,
      y: (wa * s.A.y + wb * s.B.y + wc * s.C.y) / 3,
    };
  });
}

export function actions(): GameActions {
  return {
    equal_area_triples: {
      describe:
        "At a point M inside equilateral triangle ABC, report the three pedal feet A′, B′ and C′, the doubled (and ordinary) area of each of the six small triangles, and the two alternating triples: green AMB′ + BMC′ + CMA′ and purple A′MB + B′MC + C′MA. Check that the two totals match each other and the triangle's own area. M is optional as [x, y] or { x, y } on the 420 x 360 board (the applet's opening M is used if omitted) and must lie inside the triangle; width, height, showNames and hint are optional display settings.",
      args: '{ "M": [268, 206.9134295108992] }',
      run: (args) => {
        const C = core();
        return reading(C, buildState(args));
      },
    },

    slide_m: {
      describe:
        "Slide M to several interior positions and check the equal-area claim at each one: report M, the green and purple doubled-area totals, their fraction of the triangle's area and the residuals from equality and from half the whole doubled area. Give 2 to 12 explicit positions as 'positions' (each [x, y] or { x, y } inside the triangle), or give 'samples' from 2 to 12 to sample a deterministic ring of interior barycentric positions around the centroid (default 6). This shows the equality is independent of where M sits; width and height may also be supplied.",
      args: '{ "samples": 6 }',
      run: (args) => {
        const C = core();
        const s = buildState(args);
        const points = sweepPoints(C, s, args);
        const half = C.sums(s).whole / 2;
        const rows = points.map((M) => {
          const moved = C.moveM(s, M);
          const sums = C.sums(moved);
          return {
            M: pt(M),
            green: num6(sums.left),
            purple: num6(sums.right),
            triangleArea: num6(half),
            greenFraction: num6(sums.left / half),
            purpleFraction: num6(sums.right / half),
            greenMinusPurple: sig(sums.left - sums.right),
            greenMinusTriangleArea: sig(sums.left - half),
            equalBothWays: near(sums.left, sums.right) && near(sums.left, half),
          };
        });
        const abs = (v: number | null): number => (v === null ? Infinity : Math.abs(v));
        const maxPair = Math.max(...rows.map((r) => abs(r.greenMinusPurple)));
        const maxHalf = Math.max(...rows.map((r) => abs(r.greenMinusTriangleArea)));
        return {
          board: { width: s.width, height: s.height, side: num6(s.side) },
          triangleArea: num6(half),
          rows,
          invariants: {
            positionsChecked: rows.length,
            worstGreenMinusPurple: sig(maxPair),
            worstGreenMinusTriangleArea: sig(maxHalf),
            equalAtEveryPosition: rows.every((r) => r.equalBothWays),
          },
          note:
            "For every interior position the two alternating triples stay equal and each stays at half of the triangle's doubled area — that is, at the triangle's own area. " +
            "The residuals come from the core's own sums, so float noise of about 1e-9 board-area units is expected; a growing residual would contradict the applet's claim.",
        };
      },
    },
  };
}

/** Rebuild the picture the page saved with Track.state and measure it. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equal Areas in Equilateral Triangle state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equal Areas in Equilateral Triangle position must be an object");
  }
  const C = core();
  const home = C.start({});
  const A = readPoint(state.A, "saved A", home.A);
  const B = readPoint(state.B, "saved B", home.B);
  const Cc = readPoint(state.C, "saved C", home.C);
  const M = readPoint(state.M, "saved M", home.M);
  const board = readBoard(C, state);
  const s: State = {
    A, B, C: Cc, M,
    side: num(state, "side", C.distance(A, B)),
    showNames: state.showNames === true,
    hint: state.hint === true,
    ...board,
  };
  const readingHere = reading(C, s);
  const sideGap = Math.abs(s.side - C.distance(A, B));
  const sides = [C.distance(A, B), C.distance(B, Cc), C.distance(Cc, A)];
  const equilateral = sides.every((length) => near(length, s.side, 1e-6));
  return {
    stateVersion,
    // The whole plain-data state the page saved with Track.state, unchanged.
    saved: { ...state },
    reconstruction: {
      A: pt(A), B: pt(B), C: pt(Cc), M: pt(M),
      side: num6(s.side),
      showNames: s.showNames, hint: s.hint,
      width: s.width, height: s.height,
      sideMatchesDistanceAB: sideGap < 1e-6,
      sideResidual: sig(sideGap),
      equilateral,
    },
    reading: readingHere,
    note:
      "Track.state saved the core's whole state: the vertices A, B, C and side length, the draggable point M, the two display checkboxes and the board size. " +
      "The core rebuilds the three feet, all six piece areas, the two equal triples and the status line from those fields. " +
      "The green and purple groups each come to the triangle's own area at every position of M inside ABC.",
  };
}
