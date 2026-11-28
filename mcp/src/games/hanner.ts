/*
 * run_game_logic actions and saved-position reader for Hanner (Olof Hanner's
 * jigsaw puzzle, an uncentered Perigal dissection). The core lives in
 * hanner/ and is copied into src/generated/cores/ at build time. See
 * _shared.ts for the module shape.
 *
 * A right triangle ABC carries a square on each side. Five pieces cut out of
 * the two leg squares slide, by translation alone, into the square on the
 * hypotenuse: the very same five pieces, so a² + b² = c². Every reading below
 * is made with the core's own geometry()/polyArea() in the page's screen
 * coordinates (y grows down); only the comparisons are done here.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores.hanner.HannerCore;

type Point = { x: number; y: number };
type Poly = Point[];
type Region = Point[];

/** Core state fields needed by geometry() and describe(). */
interface CoreState {
  A: Point;
  B: Point;
  C: Point;
  angleA: number;
  options: { hint: boolean };
  circle: { c: Point; r: number } | null;
}

const TOL = 1e-6;
const near = (x: number, y: number) =>
  Math.abs(x - y) <= TOL * Math.max(1, Math.abs(x), Math.abs(y));

function readPoint(value: unknown, name: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${name}"`);
  }
  const p = value as Json;
  if (typeof p !== "object" || Array.isArray(p)) throw new Error(`"${name}" must be a {x, y} point`);
  return { x: num(p, "x"), y: num(p, "y") };
}

/** Rebuild the core state the page saved with Track.state (A, B, C, angleA, options, circle). */
function savedState(state: Json): CoreState {
  const C = core();
  const A = readPoint(state.A, "A");
  const B = readPoint(state.B, "B");
  const cornerC = readPoint(state.C, "C");
  const angleA = num(state, "angleA", C.computeAngle(A, B, cornerC));
  const options = state.options && typeof state.options === "object" ? (state.options as Json) : {};
  const raw = state.circle;
  const circle = raw && typeof raw === "object"
    ? { c: readPoint((raw as Json).c, "circle.c"), r: num(raw as Json, "r") }
    : null;
  return { A, B, C: cornerC, angleA, options: { hint: options.hint === true }, circle };
}

/** Build a core state from triangle corners; when C is omitted the core computes it from angleA. */
function triangleState(args: Json): CoreState {
  const C = core();
  const A = readPoint(args.A, "A");
  const B = readPoint(args.B, "B");
  const angleA = num(args, "angleA", Math.PI / 6);
  if (!(angleA > 0 && angleA < Math.PI / 2)) {
    throw new Error(`"angleA" must be between 0 and PI/2, got ${angleA}`);
  }
  const cornerC = args.C === undefined || args.C === null
    ? C.computeC(A, B, angleA)
    : readPoint(args.C, "C");
  return { A, B, C: cornerC, angleA, options: { hint: args.hint === true }, circle: null };
}

/** The (dx, dy) taking every vertex of `from` to `to`, or null if it is not a pure translation. */
function translationOf(from: Poly, to: Poly): { dx: number; dy: number } | null {
  if (!to || from.length !== to.length || from.length === 0) return null;
  const dx = to[0].x - from[0].x;
  const dy = to[0].y - from[0].y;
  for (let i = 0; i < from.length; i++) {
    if (!near(to[i].x, from[i].x + dx) || !near(to[i].y, from[i].y + dy)) return null;
  }
  return { dx, dy };
}

const cross = (o: Point, a: Point, b: Point) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const signed2 = (poly: Poly) =>
  poly.reduce((sum, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0);

/** Clip one convex polygon by another (Sutherland-Hodgman); either winding order is fine. */
function clip(subject: Poly, boundary: Poly): Poly {
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
 * Do the pieces exactly cover the region(s)? Areas must add up, no piece may
 * spill outside every region, and no two pieces may overlap.
 */
function tiling(pieces: Poly[], regions: Region[]) {
  const C = core();
  const piecesArea = pieces.reduce((sum, p) => sum + C.polyArea(p), 0);
  const regionArea = regions.reduce((sum, r) => sum + C.polyArea(r), 0);
  const tolerance = TOL * Math.max(1, regionArea);
  let maxOutside = 0, maxOverlap = 0;
  for (let i = 0; i < pieces.length; i++) {
    const outside = regions.reduce(
      (least, r) => Math.min(least, Math.abs(C.polyArea(clip(pieces[i], r)) - C.polyArea(pieces[i]))),
      Infinity,
    );
    if (Number.isFinite(outside)) maxOutside = Math.max(maxOutside, outside);
    for (let j = i + 1; j < pieces.length; j++) {
      maxOverlap = Math.max(maxOverlap, C.polyArea(clip(pieces[i], pieces[j])));
    }
  }
  return {
    pieces: pieces.length,
    piecesArea,
    regionArea,
    maxOverlap,
    maxOutside,
    tiles:
      pieces.length > 0 &&
      near(piecesArea, regionArea) &&
      maxOverlap <= tolerance &&
      maxOutside <= tolerance,
  };
}

/** The core's dissection of one triangle, measured on the polygons it draws. */
function reading(state: CoreState) {
  const C = core();
  const g = C.geometry(state);
  const pieces = g.poly as Poly[];
  const slid = g.trans as Poly[];
  const squares = g.squares as { hypotenuse: Region; onAC: Region; onBC: Region };
  const area = (p: Poly) => C.polyArea(p);
  const a = num(g as unknown as Json, "a");
  const b = num(g as unknown as Json, "b");
  const a2 = a * a, b2 = b * b;
  const c2 = C.sqDist(g.A, g.B);
  const onAC = area(squares.onAC), onBC = area(squares.onBC), hyp = area(squares.hypotenuse);
  const dot =
    (g.A.x - g.C.x) * (g.B.x - g.C.x) + (g.A.y - g.C.y) * (g.B.y - g.C.y);
  const translations = pieces.map((p, i) => translationOf(p, slid[i]));

  return {
    branch: g.branch,
    legs: { a: g.a, b: g.b },
    hypotenuse: Math.sqrt(c2),
    squares: { onACArea: onAC, onBCArea: onBC, legTotal: onAC + onBC, hypotenuseArea: hyp },
    identity: { aSquaredPlusBSquared: a2 + b2, cSquared: c2, holds: near(a2 + b2, c2) },
    rightAngle: Math.abs(dot) <= TOL * Math.max(1, a2 + b2),
    pieceCount: pieces.length,
    pieces: pieces.map((p, i) => ({
      index: i,
      shape: p.length === 3 ? "triangle" : "quadrilateral",
      area: area(p),
      vertices: p,
      translation: translations[i],
      slidVertices: slid[i],
    })),
    piecesTotalArea: pieces.reduce((sum, p) => sum + area(p), 0),
    slidTotalArea: slid.reduce((sum, p) => sum + area(p), 0),
    pureTranslations: pieces.length > 0 && translations.every((t) => t !== null),
    sourceTiling: tiling(pieces, [squares.onAC, squares.onBC]),
    destinationTiling: tiling(slid, [squares.hypotenuse]),
    description: C.describe(state),
    note:
      "The five pieces fill the two leg squares; five copies shifted by one (dx, dy) each fill the square on the hypotenuse. " +
      "A translation keeps area, so the two totals agree: a² + b² = c². If the legs are equal the old applet draws no fresh pieces.",
  };
}

export function actions(): GameActions {
  const C = core();
  return {
    dissection: {
      describe:
        "The five-piece Perigal/Hanner dissection of a right triangle with corners A, B and C (screen coordinates, y down; A--B is the hypotenuse). C may be omitted, in which case the core places it from angleA (default 30 degrees). Reports each piece's vertices, area and the single translation that slides it into the hypotenuse square, checks that all five slid copies tile that square with no gaps or overlaps, and gives a² + b², c² and the core's own description.",
      args: '{ "A": { "x": 100, "y": 100 }, "B": { "x": 300, "y": 100 }, "angleA": 0.5235987755982988 }',
      run: (args) => reading(triangleState(args)),
    },
    drag: {
      describe:
        "Drag handle A, B or C to a point as the page does. Dragging C first starts a glide on the triangle's circumcircle (set free: true to release it as Free C does); moving A or B makes the core recompute C from angleA. Reports the new corners, whether C is still on the circle, and the full five-piece dissection reading of the resulting triangle.",
      args: '{ "name": "C", "point": { "x": 300, "y": 120 } }',
      run: (args) => {
        const name = String(args.name ?? "");
        if (!C.NAMES.includes(name)) {
          throw new Error(`"name" must be one of A, B, C; got ${JSON.stringify(args.name)}`);
        }
        let state = (args.state ? savedState(args.state as Json) : C.start({})) as CoreState;
        if (name === "C") {
          state = (args.free === true ? C.freeC(state) : C.beginDrag(state, "C")) as CoreState;
        }
        const point = readPoint(args.point, "point");
        const next = C.move(state, name, point) as CoreState;
        const r = reading(next);
        return {
          name,
          point,
          A: next.A,
          B: next.B,
          C: next.C,
          angleA: next.angleA,
          glidingOnCircle: Boolean(next.circle),
          branch: r.branch,
          rightAngle: r.rightAngle,
          pieceCount: r.pieceCount,
          identity: r.identity,
          sourceTiles: r.sourceTiling.tiles,
          destinationTiles: r.destinationTiling.tiles,
          description: r.description,
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of that same drawing. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Hanner state version ${stateVersion}`);
  const saved = savedState(state);
  const r = reading(saved);
  return {
    stateVersion,
    // The page's saved fields, with the same names.
    A: saved.A,
    B: saved.B,
    C: saved.C,
    angleA: saved.angleA,
    squares: state.squares,
    branch: state.branch,
    pieces: state.pieces,
    slid: state.slid,
    options: saved.options,
    circle: state.circle ?? null,
    // What the core adds.
    legs: r.legs,
    hypotenuse: r.hypotenuse,
    squareAreas: r.squares,
    identity: r.identity,
    rightAngle: r.rightAngle,
    pieceCount: r.pieceCount,
    piecesTotalArea: r.piecesTotalArea,
    slidTotalArea: r.slidTotalArea,
    pureTranslations: r.pureTranslations,
    sourceTiling: r.sourceTiling,
    destinationTiling: r.destinationTiling,
    description: r.description,
  };
}
