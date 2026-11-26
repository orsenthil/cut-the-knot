/*
 * run_game_logic actions and saved-position reader for Abul Wafa Pythagoras. The core lives in
 * abul-wafa-pythagoras/ and is copied into src/generated/cores/ at build time. See _shared.ts for
 * the module shape.
 *
 * The core's coordinates have y growing downwards and put the two squares' shared corner A at
 * (0, 0). The page draws the square on the hypotenuse with its Dp corner 330 right and 130 above
 * A, so that is the default placement used here.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["abul-wafa-pythagoras"].AbulWafaPythagorasCore;

interface Point {
  x: number;
  y: number;
}

interface Piece {
  name: string;
  color: number;
  start: Point[];
  end: Point[];
}

interface Dissection {
  a: number;
  b: number;
  c: number;
  points: Record<string, Point>;
  square: Point[];
  pieces: Piece[];
}

/** Where the page places the assembled square; only a translation, so areas do not depend on it. */
const AT: Point = { x: 330, y: -130 };
const TOL = 1e-6;

function readPoint(value: unknown, name: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${name}"`);
  }
  const p = value as Json;
  if (typeof p !== "object" || Array.isArray(p)) throw new Error(`"${name}" must be a {x, y} point`);
  return { x: num(p, "x"), y: num(p, "y") };
}

/** The page's own limits: a in [40, 150], b in [20, a - 10]. */
function readSides(args: Json): { a: number; b: number } {
  const C = core();
  const start = C.start();
  const a = num(args, "a", start.a);
  const b = num(args, "b", start.b);
  const { minA, maxA, minB, gap } = C.LIMITS;
  if (a < minA || a > maxA) throw new Error(`"a" must be ${minA}..${maxA}`);
  if (b < minB || b > a - gap) throw new Error(`"b" must be ${minB}..a-${gap} (here ${a - gap})`);
  return { a, b };
}

const cross = (o: Point, a: Point, b: Point) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

const signed2 = (poly: Point[]) =>
  poly.reduce((sum, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0);

/** Clip one convex polygon by another (Sutherland-Hodgman); either winding order is fine. */
function clip(subject: Point[], boundary: Point[]): Point[] {
  let out = subject;
  const sign = Math.sign(signed2(boundary));
  for (let i = 0; i < boundary.length && out.length; i++) {
    const p = boundary[i], q = boundary[(i + 1) % boundary.length];
    const inside = (v: Point) => cross(p, q, v) * sign >= 0;
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const u = input[j], v = input[(j + 1) % input.length];
      const iu = inside(u), iv = inside(v);
      if (iu) out.push(u);
      if (iu !== iv) {
        const cu = cross(p, q, u), cv = cross(p, q, v);
        const t = cu / (cu - cv);
        out.push({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t });
      }
    }
  }
  return out;
}

/**
 * The real test of a dissection: the pieces' areas add up to the region's, none spills outside it,
 * and no two pieces overlap. The core supplies every polygon; only the comparisons are done here.
 */
function coverage(pieces: Point[][], region: Point[]) {
  const C = core();
  const regionArea = C.area(region);
  const tolerance = TOL * Math.max(1, regionArea);
  let overlap = 0, outside = 0;
  for (let i = 0; i < pieces.length; i++) {
    outside = Math.max(outside, Math.abs(C.area(clip(pieces[i], region)) - C.area(pieces[i])));
    for (let j = i + 1; j < pieces.length; j++) {
      overlap = Math.max(overlap, C.area(clip(pieces[i], pieces[j])));
    }
  }
  const piecesArea = pieces.reduce((sum, poly) => sum + C.area(poly), 0);
  return {
    pieces: pieces.length,
    piecesArea,
    regionArea,
    maxOverlap: overlap,
    maxOutside: outside,
    tiles: Math.abs(piecesArea - regionArea) <= tolerance && overlap <= tolerance && outside <= tolerance,
  };
}

function reading(a: number, b: number) {
  const C = core();
  const id = C.identity(a, b);
  const t = C.triangle({ a, b, gap: { x: 0, y: 0 }, assembled: false });
  return {
    a, b,
    c: id.c,
    areas: {
      aSquared: id.a2,
      bSquared: id.b2,
      hypotenuseSquared: id.c2,
      twoSquaresTotal: id.a2 + id.b2,
    },
    holds: id.holds,
    triangle: { A: t.A, B: t.B, E: t.E, rightAngleAt: "B", hypotenuse: "A-E" },
  };
}

function dissect(a: number, b: number, at: Point) {
  const C = core();
  const d = C.dissection(a, b, at) as Dissection;
  const q = d.points;
  const fromBig = d.pieces.filter((p) => p.color === 0);
  const fromSmall = d.pieces.filter((p) => p.color === 1);
  const id = C.identity(a, b);
  return {
    a, b, c: d.c, at,
    square: d.square,
    areas: { aSquare: id.a2, bSquare: id.b2, hypotenuseSquare: id.c2 },
    pieces: d.pieces.map((p) => ({
      name: p.name,
      from: p.color === 0 ? "a-square (big)" : "b-square (small)",
      shape: p.start.length === 3 ? "triangle" : "quadrilateral",
      area: C.area(p.start),
      start: p.start,
      destination: p.end,
    })),
    source: {
      aSquare: coverage(fromBig.map((p) => p.start), [q.A, q.B, q.C, q.D]),
      bSquare: coverage(fromSmall.map((p) => p.start), [q.A, q.B1, q.C1, q.D1]),
    },
    destination: coverage(d.pieces.map((p) => p.end), d.square),
    note: "Start points are relative to the shared corner A; destination points are relative to at.",
  };
}

export function actions(): GameActions {
  return {
    pythagoras: {
      describe:
        "For a right triangle with legs a (40..150) and b (20..a-10): the hypotenuse c, the exact areas of the squares on all three sides, whether a² + b² = c², and the triangle's corners A = (0,0), B = (a,0), E = (a,-b) with the right angle at B.",
      args: '{ "a": 93.75, "b": 62.5 }',
      run: (args) => {
        const { a, b } = readSides(args);
        return reading(a, b);
      },
    },
    dissection: {
      describe:
        "Abul Wafa's seven-piece dissection for legs a and b: for each piece its colour group, shape, area, starting vertices and destination vertices, plus checks that five pieces tile the a-square, two tile the b-square, and all seven tile the square on the hypotenuse with no gaps or overlaps. Optional 'at' moves the assembled square; default {x:330,y:-130} as on the page.",
      args: '{ "a": 90, "b": 60, "at": { "x": 330, "y": -130 } }',
      run: (args) => {
        const { a, b } = readSides(args);
        return dissect(a, b, readPoint(args.at, "at", AT));
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of that position. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Abul Wafa Pythagoras state version ${stateVersion}`);
  const C = core();
  const { a, b } = readSides(state);
  const gap = readPoint(state.gap, "gap", { x: 0, y: 0 });
  const assembled = state.assembled === true;
  const aligned = C.aligned({ a, b, gap, assembled });
  const d = dissect(a, b, AT);

  return {
    // The page's saved fields, with the same names.
    a, b, gap, assembled,
    // What the core adds.
    c: d.c,
    areas: d.areas,
    aligned,
    distanceToAlignment: Math.hypot(gap.x, gap.y),
    piecesVisible: aligned,
    assemblyComplete: aligned && assembled,
    piecesTileStartingSquares: d.source.aSquare.tiles && d.source.bSquare.tiles,
    piecesTileSquare: d.destination.tiles,
    squareArea: d.areas.hypotenuseSquare,
    readout: `${a.toFixed(1)}² + ${b.toFixed(1)}² = ${d.c.toFixed(1)}²  ·  both areas ${d.areas.hypotenuseSquare.toFixed(1)}`,
  };
}
