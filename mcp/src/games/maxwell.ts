/*
 * run_game_logic actions and saved-position reader for Maxwell.
 *
 * The real core is maxwell/maxwell-core.js, copied into
 * src/generated/cores/ at build time. Starting from a triangle ABC and a point
 * P, the applet builds A'B'C' whose sides follow the cevians through P (either
 * parallel to them or at right angles to them). Maxwell's theorem says the
 * matching cevians of A'B'C' -- the ones parallel, or perpendicular, to the
 * sides of ABC -- meet at one point P'. Read backwards, that is the symmetry
 * of orthologic triangles: the page's equation (3) and its swapped form (3')
 * are the same condition with the two triangles interchanged. The core also
 * keeps two applet quirks: each rebuilt triangle is scaled to the stored
 * perimeter Pe, and its centroid is pinned to the stored point G[i] rather
 * than following the triangle that was just dragged.
 *
 * Every number below is computed by that core on board coordinates (600 x 450,
 * y downward). See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores.maxwell.MaxwellCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Position = {
  width: number; height: number; parallel: boolean; target: number; Pe: number;
  A: Point[]; B: Point[]; C: Point[]; P: Point[]; G: Point[];
};

/** The core's residuals are 1e-15 or smaller; drags in a browser are pixel-rounded. */
const TOL = 1e-7;
const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
const pt = (p: unknown): Point | null => {
  if (!p || typeof p !== "object") return null;
  const q = p as Json;
  if (typeof q.x !== "number" || !Number.isFinite(q.x) ||
      typeof q.y !== "number" || !Number.isFinite(q.y)) return null;
  return { x: round(q.x), y: round(q.y) };
};
const small = (v: number | null, tol = TOL): boolean =>
  v !== null && Number.isFinite(v) && Math.abs(v) < tol;
const worst = (xs: (number | null)[]): number | null =>
  xs.some((x) => x === null || !Number.isFinite(x)) ? null : Math.max(...(xs as number[]));

/** A corner as the page saves it ({x, y}) or as a short [x, y]. */
function readPoint(v: unknown, where: string): Point {
  if (Array.isArray(v)) {
    if (v.length !== 2 || !Number.isFinite(Number(v[0])) || !Number.isFinite(Number(v[1]))) {
      throw new Error(`${where} must be [x, y] with finite numbers`);
    }
    return { x: Number(v[0]), y: Number(v[1]) };
  }
  if (v !== null && typeof v === "object") {
    const o = v as Json;
    const x = num(o, "x"), y = num(o, "y");
    return { x, y };
  }
  throw new Error(`${where} must be [x, y] or { "x": ..., "y": ... }`);
}

function readPointArg(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  return readPoint(v, `argument "${key}"`);
}

/** The eight-point position Track.state saves, validated before it reaches the core. */
function readSaved(v: unknown, where: string): Position {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`${where} must be the position object Track.state saves`);
  }
  const o = v as Json;
  const width = num(o, "width"), height = num(o, "height");
  if (!(width > 0) || !(height > 0)) throw new Error(`${where}.width and .height must be positive`);
  const parallel = o.parallel;
  if (typeof parallel !== "boolean") throw new Error(`${where}.parallel must be true or false`);
  const target = num(o, "target");
  if (target !== 0 && target !== 1) throw new Error(`${where}.target must be 0 or 1`);
  const Pe = num(o, "Pe");
  if (!(Pe > 0)) throw new Error(`${where}.Pe must be a positive perimeter`);
  const pair = (key: "A" | "B" | "C" | "P" | "G"): Point[] => {
    const raw = o[key];
    if (!Array.isArray(raw) || raw.length !== 2) {
      throw new Error(`${where}.${key} must be an array of two points`);
    }
    return [readPoint(raw[0], `${where}.${key}[0]`), readPoint(raw[1], `${where}.${key}[1]`)];
  };
  return { width, height, parallel, target, Pe,
    A: pair("A"), B: pair("B"), C: pair("C"), P: pair("P"), G: pair("G") };
}

/**
 * Either read a saved position verbatim, or build one with the real core from
 * the base corners A0, B0, C0 and P0. Missing corners keep the opening figure;
 * supplied corners go through movePoint, so Pe, G and the rebuilt triangle are
 * exactly what the page would have after those drags.
 */
function readPosition(C: Core, args: Json): Position {
  if (args.state !== undefined && args.state !== null) {
    return readSaved(args.state, 'argument "state"');
  }
  const width = args.width === undefined ? 600 : num(args, "width");
  const height = args.height === undefined ? 450 : num(args, "height");
  if (!(width > 0) || !(height > 0)) {
    throw new Error('arguments "width" and "height" must be positive');
  }
  const parallel = args.parallel === undefined ? true : args.parallel;
  if (typeof parallel !== "boolean") throw new Error('argument "parallel" must be true or false');
  let s = C.start({ width, height, parallel }) as Position;
  for (const name of ["A0", "B0", "C0", "P0"]) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.movePoint(s, name, readPoint(args[name], `argument "${name}"`)) as Position;
    }
  }
  return s;
}

/** Swap the two triangles: equation (3') is equation (3) with the rôles reversed. */
const swapped = (s: Position): Position => ({
  ...s,
  A: [s.A[1], s.A[0]], B: [s.B[1], s.B[0]], C: [s.C[1], s.C[0]],
  P: [s.P[1], s.P[0]], G: [s.G[1], s.G[0]],
  target: 1 - s.target,
});

/** Everything the real core measures at one position, in tutor-friendly units. */
function reading(C: Core, s: Position) {
  const target = s.target === 0 ? 0 : 1;
  const other = 1 - target;
  const conc = (i: number) => (C.concurrency(s, i) as number[]).map(maybe);
  const sides = (i: number) => (C.sideErrors(s, i) as number[]).map(maybe);
  const concMax = worst(conc(target));
  const sideMax = worst(sides(target));

  // The page's equation (3): in Parallel mode the prime triangle is rotated a
  // quarter turn so its parallel sides become perpendicular to the matching
  // cevians; in Perpendicular mode it is used as it is.
  const rotate = s.parallel === true;
  const scale = Math.max(1, (C.perimeter(s, 0) as number) ** 2);
  const eq3 = C.orthologicSum(s, rotate) as number;
  const eq3prime = C.orthologicSum(swapped(s), rotate) as number;

  const perBase = C.perimeter(s, 0) as number;
  const perPrime = C.perimeter(s, 1) as number;
  const cBase = C.centroid(s, 0) as Point;
  const cPrime = C.centroid(s, 1) as Point;
  const perMatch = Math.abs(perBase - perPrime) / Math.max(1, perBase) < TOL;
  const swapNegates = Math.abs(eq3 + eq3prime) / scale < 1e-9;
  const holds = small(concMax) && small(sideMax) &&
    small(maybe(eq3 / scale)) && small(maybe(eq3prime / scale)) && perMatch;

  return {
    mode: s.parallel ? "parallel" : "perpendicular",
    rebuiltTriangle: target === 1 ? "A'B'C'" : "ABC",
    vertices: {
      base: { A: pt(s.A[0]), B: pt(s.B[0]), C: pt(s.C[0]), P: pt(s.P[0]) },
      prime: { A: pt(s.A[1]), B: pt(s.B[1]), C: pt(s.C[1]), P: pt(s.P[1]) },
    },
    concurrence: {
      atRebuiltTriangle: conc(target),
      atOtherTriangle: conc(other),
      largestGap: maybe(concMax),
      concurrent: small(concMax),
    },
    sidesFollowCevians: {
      errorsAtRebuiltTriangle: sides(target),
      largestError: maybe(sideMax),
      holds: small(sideMax),
    },
    orthologic: {
      equation3: maybe(eq3 / scale),
      swappedEquation3Prime: maybe(eq3prime / scale),
      swapNegatesEquation3: swapNegates,
      bothVanish: small(maybe(eq3 / scale)) && small(maybe(eq3prime / scale)),
      identity: "a·(c'-b') + b·(a'-c') + c·(b'-a') = 0  <=>  a'·(c-b) + b'·(a-c) + c'·(b-a) = 0",
    },
    perimeter: {
      storedPe: maybe(s.Pe),
      base: maybe(perBase),
      prime: maybe(perPrime),
      ratio: maybe(perPrime / perBase),
      match: perMatch,
    },
    storedCentres: {
      G: { base: pt(s.G[0]), prime: pt(s.G[1]) },
      centroid: { base: pt(cBase), prime: pt(cPrime) },
      note:
        "The applet scales each rebuilt triangle about its own centroid toward the stored G[i], so that centroid is pinned to G[i]; G[1] starts as the mirror of the opening base centroid and does not follow later drags of ABC.",
    },
    status: C.describe(s) as string,
    theoremHolds: holds,
  };
}

const THEOREM_NOTE =
  "Maxwell's theorem: the three matching cevians of the rebuilt triangle -- the ones parallel (or perpendicular) to the sides of the other triangle -- pass through one point P'. The sides of the rebuilt triangle follow the three cevians through P. Both readings are residuals, normalised by the other triangle's perimeter, so zero means the lines meet exactly. Equation (3) and its swapped form (3') differ only by a sign, which is why orthology is symmetric.";
const TRANSFORM_NOTE =
  "Every operation runs through the game's real core. Moving a point updates Pe only when it is a vertex (A, B or C), refreshes G for the triangle that was dragged and rebuilds the other one; switching the mode rebuilds that same triangle at right angles instead of parallel; rebuild repeats the construction from the current seed. The cevians still concur afterwards: the theorem holds in both modes.";
const STALE_NOTE =
  " If the verdict is false, the saved points are not a figure this core has rebuilt in this mode -- for instance the Parallel/Perpendicular flag was changed without running the construction -- or a drag collapsed a cevian. Use transform with switchParallel or rebuild, or move the dot back.";
const POSITION_NOTE =
  "Track.state saves the whole eight-point figure as plain data. The reading recomputes concurrence, side-following errors, both forms of the orthologic equation and the perimeter/centre quirks with the same core the page draws from; a null residual means that drag made two lines parallel so the intersection ran off the board.";

export function actions(): GameActions {
  return {
    theorem: {
      describe:
        "Build Maxwell's figure from a triangle A, B, C and a point P on the page's 600 x 450 board (y downward; each point [x, y] or {x, y}), in Parallel or Perpendicular mode, and check the page's claims with the real core: the matching cevians of A'B'C' parallel (or at right angles) to the sides of ABC concur at P', the sides of A'B'C' follow the cevians through P, the orthologic equation (3) and its swapped form (3') both vanish, and the two triangles keep the same perimeter. Reports normalised residuals, the vertices, the stored G anchors versus the true centroids and the page's status line. Omit a corner to keep the applet's opening figure, or pass the saved `state` object instead.",
      args: '{ "A0": [300, 150], "B0": [60, 330], "C0": [520, 300], "P0": [400, 180], "parallel": true }',
      run: (args) => {
        const C = core();
        const r = reading(C, readPosition(C, args));
        return { ...r, note: THEOREM_NOTE + (r.theoremHolds ? "" : STALE_NOTE) };
      },
    },
    transform: {
      describe:
        "Apply one real-core operation to a Maxwell figure and report the reading before and after it: `move` a named point (A0, B0, C0, P0, A1, B1, C1, P1) to a new location, `switchParallel` to flip between the two modes, or `rebuild` to run the construction again. Give exactly one operation, and either the saved `state` or the base corners as in `theorem`. The before/after residues show that the cevians still concur in both modes, and that a vertex drag rescales the rebuilt triangle to the stored perimeter while pinning its centroid to the stored G.",
      args: '{ "A0": [300, 150], "B0": [60, 330], "C0": [520, 300], "P0": [400, 180], "parallel": true, "move": { "name": "P0", "to": [260, 150] } }',
      run: (args) => {
        const C = core();
        const before = readPosition(C, args);
        let after: Position = before;
        const ops: string[] = [];
        if (args.move !== undefined && args.move !== null) {
          if (typeof args.move !== "object" || Array.isArray(args.move)) {
            throw new Error('argument "move" must be { "name": "P0", "to": [x, y] }');
          }
          const m = args.move as Json;
          if (typeof m.name !== "string" || !/^[ABCP][01]$/.test(m.name)) {
            throw new Error('argument "move.name" must be one of A0, B0, C0, P0, A1, B1, C1, P1');
          }
          after = C.movePoint(after, m.name, readPoint(m.to, 'argument "move.to"')) as Position;
          ops.push("move");
        }
        if (args.switchParallel !== undefined && args.switchParallel !== null) {
          if (typeof args.switchParallel !== "boolean") {
            throw new Error('argument "switchParallel" must be true or false');
          }
          after = C.setParallel(after, args.switchParallel) as Position;
          ops.push("switchParallel");
        }
        if (args.rebuild === true) {
          after = C.rebuild(after, after.target) as Position;
          ops.push("rebuild");
        } else if (args.rebuild !== undefined && args.rebuild !== null && args.rebuild !== false) {
          throw new Error('argument "rebuild" must be true or false');
        }
        if (ops.length !== 1) {
          throw new Error('give exactly one of "move", "switchParallel" or "rebuild"');
        }
        return {
          operation: ops[0],
          before: reading(C, before),
          after: reading(C, after),
          note: TRANSFORM_NOTE,
        };
      },
    },
  };
}

/** The eight saved fields, with the core's reading of the current figure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Maxwell state version ${stateVersion}`);
  const C = core();
  const s = readSaved(state, "saved state");
  const r = reading(C, s);
  return {
    stateVersion,
    width: s.width,
    height: s.height,
    parallel: s.parallel,
    target: s.target,
    Pe: maybe(s.Pe),
    A: s.A.map(pt),
    B: s.B.map(pt),
    C: s.C.map(pt),
    P: s.P.map(pt),
    G: s.G.map(pt),
    reading: { ...r, note: POSITION_NOTE + (r.theoremHolds ? "" : STALE_NOTE) },
  };
}
