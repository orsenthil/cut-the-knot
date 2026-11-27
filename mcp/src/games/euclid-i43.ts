/*
 * run_game_logic actions and saved-position reader for Euclid I.43.
 *
 * ABCD is a parallelogram whose top side AD and bottom side BC stay
 * horizontal; K is a point on the diagonal AC with K = A*z + C*(1-z). The
 * lines through K parallel to AB and AD cut the parallelogram into four
 * pieces, in the applet's own order: red at A (A G K E), green below
 * (G B F K), green above (H D E K) and blue at C (F C H K). Proposition I.43
 * says the two green complements are equal: subtracting congruent triangles
 * from equal larger triangles leaves equal leftovers. With several K's the
 * parallels make a grid; each cell is finally coloured by the last K whose
 * square covers it, and the cell mirrored across AC is covered by the same K,
 * so mirror cells share colour and area.
 *
 * The real core is euclid-i43/euclid-i43-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * page's 400 x 300 SVG, y down. This is the original applet: every divisor
 * stays on AC, unlike Euclid I.43 Extended, which lets X sit off the
 * diagonal and builds XBYD. See _shared.ts for the game-module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = {
  A: Point; B: Point; C: Point; D: Point;
  N: number; z: number[]; explored: boolean;
};
type Quad = { i: number; kind: "a" | "m" | "c"; points: Point[]; area: number };
type Cell = {
  ui: number; vi: number; color: "a" | "m" | "c" | null;
  last: number; area: number; tU: number; tV: number;
};
type Computed = {
  A: Point; B: Point; C: Point; D: Point;
  N: number; z: number[];
  dividers: (Point | null)[];
  quads: Quad[];
  cells: Cell[];
  greenAreas: number[];
  parallelogramArea: number;
  pairs: number; matching: number; allPairsMatch: boolean;
};
interface EuclidCore {
  WIDTH: number; HEIGHT: number; MAX: number; EDGE: number; MIN_SIDE: number;
  INITIAL_Z: number[];
  start(options?: { N?: number }): State;
  compute(s: State): Computed;
  describe(s: State): string;
  result(s: State): null;
}

const core = (): EuclidCore =>
  cores["euclid-i43"].EuclidI43Core as unknown as EuclidCore;

/** Board numbers as plain JSON numbers, rounded or null when not finite. */
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const num6 = (v: number): number | null => (Number.isFinite(v) ? r6(v) : null);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(3)) : null);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const near = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** Accept the page's { x, y } corners and the tutor's [x, y] arguments alike. */
function readPoint(raw: unknown, label: string, fallback: Point): Point {
  if (raw === undefined || raw === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readN(C: EuclidCore, args: Json): number {
  const n = num(args, "N", 1);
  if (!Number.isInteger(n) || n < 0 || n > C.MAX) {
    throw new Error(`argument "N" must be a whole number from 0 to ${C.MAX}`);
  }
  return n;
}

/** K = A*z + C*(1-z); z[i] is the applet's own coefficient Z[i]. */
function readZ(C: EuclidCore, args: Json): number[] {
  const raw = args.z;
  if (raw === undefined || raw === null) return C.INITIAL_Z.slice();
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > C.MAX) {
    throw new Error(`argument "z" must be an array of 1 to ${C.MAX} coefficients in [0, 1]`);
  }
  const z = raw.map((v, i) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      throw new Error(`z[${i}] must be a number in [0, 1], got ${JSON.stringify(v)}`);
    }
    return n;
  });
  return z.concat(C.INITIAL_Z.slice(z.length));
}

/** The applet fixes y for all four corners and keeps horizontal, equal sides. */
function readCorners(args: Json, seed: State): Pick<State, "A" | "B" | "C" | "D"> {
  const A = readPoint(args.A, "A", seed.A);
  const B = readPoint(args.B, "B", seed.B);
  const Cc = readPoint(args.C, "C", seed.C);
  const D = readPoint(args.D, "D", seed.D);
  const sideA = D.x - A.x;
  const sideB = Cc.x - B.x;
  if (!near(A.y, D.y, 0) || !near(B.y, Cc.y, 0) || !(sideA > 0) || !near(sideA, sideB)) {
    throw new Error(
      "A, B, C and D must keep the applet's shape: AD and BC horizontal, with equal positive horizontal sides (D.x - A.x = C.x - B.x > 0)",
    );
  }
  return { A, B, C: Cc, D };
}

/** A real core state from the tutor's optional corners, N and coefficients. */
function buildState(C: EuclidCore, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of corners and options");
  }
  const seed = C.start({ N: readN(C, args) });
  return { ...seed, ...readCorners(args, seed), z: readZ(C, args) };
}

/** The four fills and the two equal green complements for one divisor K. */
function piecesReading(g: Computed, i: number) {
  const quads = g.quads.filter((q) => q.i === i);
  const where: Record<Quad["kind"], string> = {
    a: "red, at A",
    m: "green, across the diagonal",
    c: "blue, at C",
  };
  const green = quads.filter((q) => q.kind === "m").map((q) => q.area);
  const tileSum = quads.reduce((sum, q) => sum + q.area, 0);
  return {
    K: pt(g.dividers[i]),
    z: num6(g.z[i]),
    pieces: quads.map((q) => ({
      kind: q.kind,
      where: where[q.kind],
      vertices: q.points.map(pt),
      area: num6(q.area),
    })),
    greenPair: {
      areas: green.map(num6),
      difference: sig(green.length === 2 ? green[1] - green[0] : NaN),
      equal: green.length === 2 && near(green[0], green[1]),
    },
    fourPieceTiling: {
      pieceAreas: quads.map((q) => num6(q.area)),
      total: num6(tileSum),
      parallelogramArea: num6(g.parallelogramArea),
      residual: sig(tileSum - g.parallelogramArea),
      tiles: near(tileSum, g.parallelogramArea),
    },
  };
}

/** The coloured grid cells and their reflections across AC. */
function mirrorReading(g: Computed) {
  const key = new Map<string, Cell>();
  for (const c of g.cells) key.set(`${c.ui},${c.vi}`, c);
  const pairs = g.cells.filter((c) => c.ui <= c.vi).map((c) => {
    const mate = c.ui === c.vi ? c : key.get(`${c.vi},${c.ui}`);
    return {
      cell: [c.ui, c.vi],
      mirror: [c.vi, c.ui],
      color: c.color,
      mirrorColor: mate ? mate.color : null,
      area: num6(c.area),
      mirrorArea: mate ? num6(mate.area) : null,
      lastPoint: c.last,
      mirrorLastPoint: mate ? mate.last : null,
      sameColor: !!mate && c.color === mate.color,
      sameArea: !!mate && near(c.area, mate.area),
    };
  });
  return {
    cells: g.cells.map((c) => ({
      ui: c.ui, vi: c.vi, color: c.color, last: c.last,
      area: num6(c.area), tU: num6(c.tU), tV: num6(c.tV),
    })),
    pairs,
    corePairs: g.pairs,
    coreMatching: g.matching,
    allPairsMatch: g.allPairsMatch,
    allReportedPairsMatch: pairs.every((p) => p.sameColor && p.sameArea),
  };
}

const pointRows = (g: Computed) =>
  Array.from({ length: g.N }, (_, i) => ({ index: i + 1, ...piecesReading(g, i) }));

export function actions(): GameActions {
  return {
    equal_complements: {
      describe:
        "At each of 0 to 10 points K on the diagonal AC of parallelogram ABCD, report the four pieces cut by the parallels through K (red at A, two green across the diagonal, blue at C), the two green areas and their difference, and a check that the four pieces tile the whole parallelogram. K = A*z + C*(1-z); 'N' (default 1) chooses how many points and 'z' may give up to ten weights in [0, 1], with the applet's own coefficients filling any gaps. Optional corners A, B, C, D are [x, y] or { x, y } on the 400 x 300 board and must keep AD and BC horizontal with equal sides; omit them for the opening shape. This is the original applet, with every point on AC: it has no off-diagonal X or XBYD construction.",
      args: '{ "N": 1 }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = C.compute(s);
        const points = pointRows(g);
        return {
          board: { width: C.WIDTH, height: C.HEIGHT, maxPoints: C.MAX },
          parallelogram: {
            A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D),
            area: num6(g.parallelogramArea),
          },
          N: g.N,
          coefficientsUsed: g.z.slice(0, g.N).map(num6),
          points,
          allGreenPairsMatch: points.every((p) => p.greenPair.equal),
          allPiecesTile: points.every((p) => p.fourPieceTiling.tiles),
          status: C.describe(s),
          note:
            "Euclid I.43 subtracts congruent triangles from equal larger triangles, so the two green complements across AC have equal area whatever K does; the four fills are the whole parallelogram. " +
            "With N = 0 there are no points and nothing to compare, which is why the equality checks are vacuously true. " +
            "Every K here stays on the diagonal; Euclid I.43 Extended is a different applet that also allows an off-diagonal point X.",
        };
      },
    },

    mirrored_grid: {
      describe:
        "With 0 to 10 points on AC, the parallels through them form a grid. Report each grid rectangle's colour (the last point whose square covers it) and its reflection across the diagonal, checking that mirrored cells have the same colour and area; also check that each point's four pieces tile the parallelogram. Arguments are as in equal_complements: 'N' from 0 to 10, optional 'z' weights and optional corners A, B, C, D. This is the original Euclid I.43 applet; the Extended applet instead lets a point sit off the diagonal and builds an extra parallelogram.",
      args: '{ "N": 3 }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = C.compute(s);
        const points = pointRows(g);
        const mirror = mirrorReading(g);
        return {
          board: { width: C.WIDTH, height: C.HEIGHT, maxPoints: C.MAX },
          parallelogram: {
            A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D),
            area: num6(g.parallelogramArea),
          },
          N: g.N,
          coefficientsUsed: g.z.slice(0, g.N).map(num6),
          ...mirror,
          tiling: {
            perPoint: points.map((p) => p.fourPieceTiling),
            allPiecesTile: points.every((p) => p.fourPieceTiling.tiles),
          },
          allGreenPairsMatch: points.every((p) => p.greenPair.equal),
          note:
            "A mirrored pair of cells is covered by exactly the same divisor point: reflecting (u, v) across AC swaps u and v without changing which square contains it, so the colour and area match. " +
            "The core counts both orientations in corePairs/coreMatching; pairs lists each mirror pair once (cells on the diagonal mirror to themselves). " +
            "The four fills for a single point always add to the parallelogram's area, even when the green pair is the only equal one. " +
            "All points stay on AC here: the Euclid I.43 Extended applet adds an off-diagonal X and is a separate page.",
        };
      },
    },
  };
}

/** Echo the picture saved with Track.state and re-measure it with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Euclid I.43 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Euclid I.43 position must be an object");
  }
  const C = core();
  const seed = C.start({});
  const A = readPoint(state.A, "saved A", seed.A);
  const B = readPoint(state.B, "saved B", seed.B);
  const Cc = readPoint(state.C, "saved C", seed.C);
  const D = readPoint(state.D, "saved D", seed.D);
  const rawN = Number(state.N);
  const N = Number.isInteger(rawN) && rawN >= 0 && rawN <= C.MAX ? rawN : seed.N;
  const usableZ =
    Array.isArray(state.z) && state.z.length === C.MAX &&
    state.z.every((v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1);
  const z = usableZ ? (state.z as unknown[]).map(Number) : seed.z.slice();
  const s: State = { A, B, C: Cc, D, N, z, explored: state.explored === true };
  const g = C.compute(s);
  const points = pointRows(g);
  const mirror = mirrorReading(g);
  const initial = C.start({ N });
  const movedCorners = (["A", "B", "C", "D"] as const).filter(
    (key) => !near(s[key].x, initial[key].x) || !near(s[key].y, initial[key].y),
  );
  const movedDividers = z.slice(0, N).filter((v, i) => !near(v, C.INITIAL_Z[i])).length;
  return {
    ...state,
    stateVersion,
    // The whole plain-data state the page saved with Track.state, unchanged.
    saved: { ...state },
    reconstruction: {
      A: pt(A), B: pt(B), C: pt(Cc), D: pt(D),
      N, z: z.map(num6), explored: s.explored,
      movedCorners,
      movedDividers,
    },
    reading: {
      parallelogram: {
        A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D),
        area: num6(g.parallelogramArea),
      },
      coefficientsUsed: g.z.slice(0, g.N).map(num6),
      points,
      allGreenPairsMatch: points.every((p) => p.greenPair.equal),
      allPiecesTile: points.every((p) => p.fourPieceTiling.tiles),
      ...mirror,
      status: C.describe(s),
      outcome: C.result(s),
    },
    coreDescription: C.describe(s),
    note:
      "Track.state saved the core's whole state: the four horizontal-drag corners A, B, C, D, the number of diagonal points N, all ten coefficients z and the explored flag. " +
      "The core rebuilds the divisor points, their four coloured fills, the green complement pairs and the mirrored grid cells from those fields. " +
      "This page is a demonstration rather than a game: there is no win or loss, and the tracker records exploration instead. " +
      "Every divisor stays on AC; the off-diagonal point X and the XBYD construction belong to the separate Euclid I.43 Extended page.",
  };
}
