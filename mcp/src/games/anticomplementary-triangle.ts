/*
 * run_game_logic actions and saved-position reader for An Anticomplementary
 * Triangle Surprise.
 *
 * The real core is anticomplementary-triangle/anticomplementary-triangle-core.js,
 * copied into src/generated/cores/ at build time. It performs the applet's two
 * Napoleon steps with 60-degree rotations: first equilateral triangles ABZ,
 * BCX, CAY on the sides of ABC (all one turn), then XYR, YZP, ZXQ on the sides
 * of XYZ (the opposite turn). The result is always the anticomplementary
 * triangle: P = B + C - A, Q = C + A - B, R = A + B - C, so A, B, C are the
 * midpoints of QR, RP, PQ and the green triangle has four times the area.
 * Coordinates are board units in the page's 420 x 300 SVG, with y downward.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["anticomplementary-triangle"].AnticomplementaryTriangleCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };
type Geometry = Triangle & {
  X: Point; Y: Point; Z: Point; P: Point; Q: Point; R: Point;
  firstStep: Point[][];
  secondStep: Point[][];
};

const EPS = 1e-6;
const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const finite = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const close = (a: number, b: number, scale = 1): boolean =>
  Math.abs(a - b) <= EPS * Math.max(1, scale, Math.abs(a), Math.abs(b));

/** Accept the page's saved {x, y} as well as [x, y] argument arrays. */
function readPoint(args: Json, key: string): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
}

/** Omitted corners fall back to the illustration's opening triangle. */
function readTriangle(C: Core, args: Json): Triangle {
  const fresh = C.start({}) as Triangle;
  const corner = (key: "A" | "B" | "C"): Point =>
    args[key] === undefined || args[key] === null
      ? fresh[key]
      // A supplied corner must be a real point; do not silently fall back.
      : readPoint(args, key);
  return { A: corner("A"), B: corner("B"), C: corner("C") };
}

function geometry(C: Core, args: Json): Geometry {
  const tri = readTriangle(C, args);
  const g = C.geometry(tri) as { valid: boolean } & Partial<Geometry>;
  if (!g.valid) {
    throw new Error("A, B and C must each have finite numeric x and y (board units, y down)");
  }
  return g as Geometry;
}

/** The three side lengths of a constructed triangle, for the equilateral check. */
function sides(C: Core, t: Point[]): number[] {
  return [C.dist(t[0], t[1]), C.dist(t[1], t[2]), C.dist(t[2], t[0])] as number[];
}

const areaRatio = (C: Core, g: Geometry): number =>
  Math.abs(C.twiceArea(g.P, g.Q, g.R) / C.twiceArea(g.A, g.B, g.C)) as number;

/** The whole construction, measured by the same core the page draws with. */
function reading(C: Core, g: Geometry) {
  const closed = C.anticomplementary(g.A, g.B, g.C) as { P: Point; Q: Point; R: Point };
  const mids = C.midpoints(g) as Triangle;
  const doubleArea = C.twiceArea(g.A, g.B, g.C) as number;
  return {
    startingTriangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    firstStep: {
      equilateralTriangles: { ABZ: pt(g.Z), BCX: pt(g.X), CAY: pt(g.Y) },
      sideLengths: (g.firstStep as Point[][]).map((t) => sides(C, t).map(finite)),
    },
    secondStep: {
      equilateralTriangles: { XYR: pt(g.R), YZP: pt(g.P), ZXQ: pt(g.Q) },
      sideLengths: (g.secondStep as Point[][]).map((t) => sides(C, t).map(finite)),
    },
    outerTriangle: { P: pt(g.P), Q: pt(g.Q), R: pt(g.R) },
    closedForm: { P: pt(closed.P), Q: pt(closed.Q), R: pt(closed.R) },
    midpointsOfPQR: { A: pt(mids.A), B: pt(mids.B), C: pt(mids.C) },
    areaRatio: finite(areaRatio(C, g)),
    twiceAreaABC: finite(doubleArea),
    status: C.label(g) as string,
    note:
      "Build equilateral triangles ABZ, BCX, CAY with one turn, then XYR, YZP, ZXQ on XYZ with the opposite turn. PQR is the anticomplementary triangle of ABC: Q - P = 2(A - B), and (P + Q)/2 = C, so A, B, C are the midpoints of QR, RP, PQ and PQR has four times the area of ABC." +
      (doubleArea === 0
        ? " Here A, B, C are on one line, so there is no starting area: the page's status line prints an infinite ratio."
        : ""),
  };
}

/** Every claim of the illustration, checked numerically on this triangle. */
function claims(C: Core, g: Geometry) {
  const closed = C.anticomplementary(g.A, g.B, g.C) as { P: Point; Q: Point; R: Point };
  const mids = C.midpoints(g) as Triangle;
  const dist = (p: Point, q: Point) => C.dist(p, q) as number;
  const midpointErrors = {
    A: dist(mids.A, g.A), // midpoint of QR vs the starting A
    B: dist(mids.B, g.B),
    C: dist(mids.C, g.C),
  };
  const closedFormErrors = {
    P: dist(closed.P, g.P),
    Q: dist(closed.Q, g.Q),
    R: dist(closed.R, g.R),
  };
  const equilateral = (tri: Point[][]): boolean => tri.every((t) => {
    const [a, b, c] = sides(C, t);
    return Math.max(a, b, c) - Math.min(a, b, c) <= EPS * Math.max(1, a);
  });
  const firstStepEquilateral = equilateral(g.firstStep as Point[][]);
  const secondStepEquilateral = equilateral(g.secondStep as Point[][]);
  const firstSigns = (g.firstStep as Point[][]).map((t) => Math.sign(C.twiceArea(t[0], t[1], t[2]) as number));
  const secondSigns = (g.secondStep as Point[][]).map((t) => Math.sign(C.twiceArea(t[0], t[1], t[2]) as number));
  const turnsOpposite =
    firstSigns.every((s) => s === firstSigns[0]) &&
    secondSigns.every((s) => s === secondSigns[0]) &&
    firstSigns[0] !== 0 && firstSigns[0] === -secondSigns[0];
  const cross = (u: Point, v: Point) => u.x * v.y - u.y * v.x;
  const vec = (p: Point, q: Point): Point => ({ x: q.x - p.x, y: q.y - p.y });
  const sideChecks = [
    { side: "PQ_vs_AB", a: vec(g.P, g.Q), b: vec(g.A, g.B) },
    { side: "QR_vs_BC", a: vec(g.Q, g.R), b: vec(g.B, g.C) },
    { side: "RP_vs_CA", a: vec(g.R, g.P), b: vec(g.C, g.A) },
  ];
  const sideLengthRatios: Record<string, number | null> = {};
  const parallelAndDouble = sideChecks.every(({ side, a, b }) => {
    const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
    sideLengthRatios[side] = finite(la / lb);
    return close(cross(a, b), 0, la * lb) && close(la / lb, 2);
  });
  const baseArea = Math.abs(C.twiceArea(g.A, g.B, g.C) as number);
  const degenerate = baseArea <= EPS;
  const ratio = finite(areaRatio(C, g));
  const allHold = !degenerate &&
    firstStepEquilateral && secondStepEquilateral && turnsOpposite &&
    Object.values(midpointErrors).every((e) => e <= EPS) &&
    Object.values(closedFormErrors).every((e) => e <= EPS) &&
    parallelAndDouble && ratio !== null && close(ratio, 4);
  return {
    allHold,
    degenerate,
    firstStepEquilateral,
    secondStepEquilateral,
    turnsOpposite,
    midpointsAreABC: Object.values(midpointErrors).every((e) => e <= EPS),
    closedFormMatches: Object.values(closedFormErrors).every((e) => e <= EPS),
    outerSidesParallelAndDouble: parallelAndDouble,
    areaRatioFour: degenerate ? null : ratio !== null && close(ratio, 4),
    midpointErrors: {
      A: finite(midpointErrors.A), B: finite(midpointErrors.B), C: finite(midpointErrors.C),
    },
    closedFormErrors: {
      P: finite(closedFormErrors.P), Q: finite(closedFormErrors.Q), R: finite(closedFormErrors.R),
    },
    sideLengthRatios,
    areaRatio: ratio,
    note: degenerate
      ? "A, B and C lie on one line (or two coincide), so there is no starting area to compare with the outer triangle; move a corner apart to see the 4:1 ratio."
      : "The two rounds of equilateral triangles turn opposite ways. The midpoints of QR, RP and PQ are A, B, C; the outer sides are parallel to AB, BC, CA and twice as long, so the area ratio is 4.",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a triangle A, B, C in board units (420 x 300 SVG, y down; each point [x, y] or {x, y}), perform the applet's two Napoleon steps and report the first equilateral triangles ABZ, BCX, CAY (points X, Y, Z), the second round XYR, YZP, ZXQ (points P, Q, R), the closed-form anticomplementary points, the midpoints of QR, RP, PQ, the area ratio and the page's status line. Omit a corner to use the illustration's opening triangle.",
      args: '{ "A": { "x": 255, "y": 115 }, "B": { "x": 175, "y": 185 }, "C": { "x": 275, "y": 180 } }',
      run: (args) => {
        const C = core();
        return reading(C, geometry(C, args));
      },
    },
    check_claims: {
      describe:
        "For a triangle A, B, C in board units, check every claim on the illustration's page: each round forms three equilateral triangles, the second round turns opposite to the first, the rotated points equal P = B + C - A (and cyclically), A, B, C are the midpoints of QR, RP, PQ, the outer sides are parallel to the starting sides and twice as long, and the area ratio is 4. Returns a boolean per claim, the errors in board units, and a note. Omit a corner to use the opening triangle.",
      args: '{ "A": { "x": 255, "y": 115 }, "B": { "x": 175, "y": 185 }, "C": { "x": 275, "y": 180 } }',
      run: (args) => {
        const C = core();
        return claims(C, geometry(C, args));
      },
    },
  };
}

/** The page's saved triangle and checkboxes, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const tri = readTriangle(C, state);
  const defaults = C.start({}).options as Json;
  const savedOptions = state.options && typeof state.options === "object"
    ? state.options as Json
    : {};
  const options = Object.fromEntries(
    Object.keys(defaults).map((key) => [key,
      savedOptions[key] === undefined ? defaults[key] : savedOptions[key] === true]),
  );
  const raw = C.geometry({ ...tri, options }) as { valid: boolean } & Partial<Geometry>;
  if (!raw.valid) {
    return {
      stateVersion,
      A: pt(tri.A), B: pt(tri.B), C: pt(tri.C), options,
      valid: false,
      note: "The saved points are not a drawable triangle; the two rounds of equilateral triangles cannot be built.",
    };
  }
  const g = raw as Geometry;
  return {
    stateVersion,
    A: pt(g.A), B: pt(g.B), C: pt(g.C), options,
    valid: true,
    reading: reading(C, g),
    claims: claims(C, g),
  };
}
