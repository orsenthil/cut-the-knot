/*
 * run_game_logic actions and saved-position reader for Cantor Point.
 *
 * The core is cantor-point/cantor-point-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * See _shared.ts for the shape of a game module.
 *
 * Coordinates are board units from the illustration's 400 x 300 viewBox,
 * with y down. Drag A, B or C and the three Cantor lines still concur at the
 * nine-point centre N: put the origin at the circumcenter O, then
 * N - m_A = z_A/2 is parallel to OA, so the line through the midpoint m_A is
 * perpendicular to the tangent at A. In ordinary coordinates
 * N = (A + B + C - O)/2, and its nine-point circle has radius R/2.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cantor-point"].CantorPointCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };
/** The full result of core.construct(); the core returns only {degenerate} early. */
type Constructed = {
  degenerate: boolean;
  A: Point; B: Point; C: Point;
  O: Point; R: number;
  tanA: Point; tanB: Point; tanC: Point;
  tAB: Point; tBC: Point; tCA: Point;
  mA: Point; mB: Point; mC: Point;
  rA: Point; rB: Point; rC: Point;
  lineA: Point; lineB: Point; lineC: Point;
  footA: Point; footB: Point; footC: Point;
  P: Point; N: Point; r9: number;
};
type Claims = {
  circumcircle: boolean;
  tangentsPerpendicular: boolean;
  tangentialTriangle: boolean;
  feetOnTangents: boolean;
  linesPerpendicularToTangents: boolean;
  concurrent: boolean;
  atNinePointCenter: boolean;
  ninePointRadius: boolean;
  all: boolean;
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** Residuals are tiny; keep their size and sign instead of rounding to zero. */
const sig = (v: number): number => Number(Number(v).toExponential(2));
const pt = (p: Point | null | undefined) =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** Accept a corner as {x, y} or [x, y]; a missing one means the opening triangle. */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return { ...fallback };
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or {"x": ..., "y": ...}`);
    return { x: num({ x: raw[0] }, "x"), y: num({ y: raw[1] }, "y") };
  }
  if (typeof raw !== "object") throw new Error(`argument "${key}" must be [x, y] or {"x": ..., "y": ...}`);
  return { x: num(raw as Json, "x"), y: num(raw as Json, "y") };
}

function triangle(C: Core, args: Json): Triangle {
  const seed = C.start() as Triangle;
  return {
    A: readPoint(args, "A", seed.A),
    B: readPoint(args, "B", seed.B),
    C: readPoint(args, "C", seed.C),
  };
}

/** Refuse collinear corners and coincident or near-coincident vertices. */
function constructed(C: Core, s: Triangle): Constructed {
  const c = C.construct(s) as unknown as Constructed;
  if (c.degenerate) {
    throw new Error("A, B and C must be three separate, non-collinear corners on the 400 x 300 board");
  }
  return c;
}

function live(args: Json): { C: Core; s: Triangle; c: Constructed } {
  const C = core();
  const s = triangle(C, args);
  return { C, s, c: constructed(C, s) };
}

/** Every object the illustration draws, named as on the page. */
function construction({ C, s, c }: { C: Core; s: Triangle; c: Constructed }) {
  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    circumcircle: { center: pt(c.O), radius: round(c.R) },
    tangentPoints: { A: pt(c.tanA), B: pt(c.tanB), C: pt(c.tanC) },
    // tAB is the intersection of the tangents at A and B, so it is opposite C.
    tangentialTriangle: { oppositeA: pt(c.tBC), oppositeB: pt(c.tCA), oppositeC: pt(c.tAB) },
    sideMidpoints: { mA: pt(c.mA), mB: pt(c.mB), mC: pt(c.mC) },
    cantorLines: {
      fromA: { from: pt(c.mA), to: pt(c.footA), direction: pt(c.rA) },
      fromB: { from: pt(c.mB), to: pt(c.footB), direction: pt(c.rB) },
      fromC: { from: pt(c.mC), to: pt(c.footC), direction: pt(c.rC) },
    },
    perpendicularFeet: { onTangentA: pt(c.footA), onTangentB: pt(c.footB), onTangentC: pt(c.footC) },
    cantorPoint: pt(c.P),
    ninePointCenter: pt(c.N),
    ninePointCircle: { center: pt(c.N), radius: round(c.r9) },
    distances: {
      P_minus_N: sig(C.dist(c.P, c.N)),
      r9_minus_half_R: sig(c.r9 - c.R / 2),
    },
    note:
      "The tangents at A, B and C form the tangential triangle. From each side midpoint m_A, m_B, m_C a line runs parallel to the radius of the opposite vertex, hence perpendicular to that vertex's tangent. The three feet lie on the tangents and all three lines pass through Cantor's point P, which is the centre N of the circle through the three side midpoints. A right angle at a corner makes two tangents parallel, so that vertex of the tangential triangle is at infinity (null here), but the three Cantor lines still meet at N.",
  };
}

/** The illustration's claims, checked by the core, with independent residuals. */
function checks({ C, s, c }: { C: Core; s: Triangle; c: Constructed }) {
  const cl = C.claims(s) as unknown as Claims;
  const Q = C.intersect(c.mA, c.lineA, c.mB, c.lineB) as Point;
  const perp = (mid: Point, line: Point, vertex: Point, tangent: Point) =>
    (line.x - mid.x) * (tangent.x - vertex.x) + (line.y - mid.y) * (tangent.y - vertex.y);
  const lineDistance = (p: Point, x: Point, y: Point) =>
    Number.isFinite(C.cross(x, y, p)) ? Math.abs(C.cross(x, y, p)) / C.dist(x, y) : NaN;
  return {
    circumcircle: cl.circumcircle,
    tangentsPerpendicular: cl.tangentsPerpendicular,
    tangentialTriangle: cl.tangentialTriangle,
    feetOnTangents: cl.feetOnTangents,
    linesPerpendicularToTangents: cl.linesPerpendicularToTangents,
    concurrent: cl.concurrent,
    atNinePointCenter: cl.atNinePointCenter,
    ninePointRadius: cl.ninePointRadius,
    allHold: cl.all,
    failed: (["circumcircle", "tangentsPerpendicular", "tangentialTriangle", "feetOnTangents",
      "linesPerpendicularToTangents", "concurrent", "atNinePointCenter", "ninePointRadius"] as const)
      .filter((k) => cl[k] !== true),
    residuals: {
      intersection_minus_N: sig(C.dist(Q, c.N)),
      linesA_dot_tangentA: sig(perp(c.mA, c.lineA, c.A, c.tanA)),
      linesB_dot_tangentB: sig(perp(c.mB, c.lineB, c.B, c.tanB)),
      linesC_dot_tangentC: sig(perp(c.mC, c.lineC, c.C, c.tanC)),
      Q_off_lineA: sig(lineDistance(Q, c.mA, c.lineA)),
      Q_off_lineB: sig(lineDistance(Q, c.mB, c.lineB)),
      Q_off_lineC: sig(lineDistance(Q, c.mC, c.lineC)),
      P_minus_N: sig(C.dist(c.P, c.N)),
      r9_minus_half_R: sig(c.r9 - c.R / 2),
    },
    note:
      "With O as the origin, m_A = (z_B + z_C)/2 and N = (z_A + z_B + z_C)/2, so N - m_A = z_A/2 is parallel to OA and perpendicular to the tangent at A; the same at B and C. Hence N = (A + B + C - O)/2 and the nine-point radius is R/2. For an inscribed n-gon the same argument gives a common point (sum of the vertices - O)/(n - 1), which is N when n = 3.",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a triangle with corners A, B, C (each {x, y} or [x, y] on the illustration's 400 x 300 board, y down), report its circumcircle, the tangents and tangential triangle, the three side midpoints, the Cantor lines from them with their feet on the tangents, Cantor's point P and the nine-point centre N with its circle. Omit a corner to use the starting triangle. Refuses collinear or coincident corners.",
      args: '{ "A": { "x": 200.81, "y": 75.03 }, "B": { "x": 150.98, "y": 206.76 }, "C": { "x": 273.5, "y": 135.1 } }',
      run: (args) => construction(live(args)),
    },
    check_claims: {
      describe:
        "Check Cantor's theorem for a triangle A, B, C (each {x, y} or [x, y]): the tangents are perpendicular to the circumradii and form the tangential triangle, the feet lie on those tangents, the three lines from the side midpoints are perpendicular to the tangents and concur, and their common point is the nine-point centre N with nine-point radius R/2. Returns a boolean for each claim, the failed ones and the underlying residuals, plus the complex-number reason.",
      args: '{ "A": [200.81, 75.03], "B": [150.98, 206.76], "C": [273.5, 135.1] }',
      run: (args) => checks(live(args)),
    },
  };
}

/** The page saves just its three draggable corners; the core restores the diagram. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = triangle(C, state);
  const result: (state: Json) => unknown = C.result;
  const saved = {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    result: result(state),
  };
  if (C.isDegenerate(s)) {
    return {
      ...saved,
      degenerate: true,
      note: "The saved corners are collinear or too close together, so there is no circumcircle, tangential triangle or Cantor point to measure.",
    };
  }
  const c = constructed(C, s);
  return {
    ...saved,
    degenerate: false,
    reading: {
      ...construction({ C, s, c }),
      // Nested so the booleans cannot overwrite the geometry of the same name.
      claims: checks({ C, s, c }),
    },
    note:
      "Track.state saved the three draggable corners. The core rebuilds the circumcircle, tangential triangle, Cantor lines and nine-point circle from them, then checks every claim at exactly this position.",
  };
}
