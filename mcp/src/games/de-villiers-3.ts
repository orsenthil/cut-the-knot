/*
 * run_game_logic actions and saved-position reader for Perpendicular Bisectors
 * in an Inscriptible Quadrilateral II (deVilliers3 by Alexander Bogomolny,
 * proof by Darij Grinberg from an idea of Marcello Tarquini).
 *
 * Four dots A,B,C,D on one circle give a tangent quadrilateral with that circle
 * as incircle. The external angle bisectors at its corners give X,Y,Z,W, and
 * the perpendiculars through them give A'B'C'D'. The midpoint of M and each of
 * X,Y,Z,W lies on a side-perpendicular bisector, so the homothety about the
 * circle's centre M with ratio 1/2 takes A'B'C'D' to A1B1C1D1: replacing the
 * sides of an inscriptible quadrilateral by their perpendicular bisectors keeps
 * it inscriptible. The page's test also notes the partial converse (non-cyclic
 * Q) and that two perpendicular-bisector steps make a homothetic copy of Q.
 *
 * Every number below is measured by the game's real core
 * (de-villiers-3/de-villiers-3-core.js), copied into src/generated/cores/ at
 * build time. Coordinates are the page's 400 x 250 viewBox units, y down.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Line = { p: Point; q: Point };
type Circle = { c: Point; r: number };
type PBResult = { vertices: Point[]; bisectors: Line[] };
type Measures = {
  tangentSpread: number;
  diagError: number;
  xyzSpread: number;
  primeSpread: number;
  primeInradius: number;
  homothetyError: number;
  quarterError: number;
  pitotError: number;
  cyclicPBError: number;
};
type Geometry = {
  A: Point; B: Point; C: Point; D: Point;
  circle: Circle; tangentVertices: Point[];
  X: Point; Y: Point; Z: Point; W: Point;
  center: Point; radius: number;
  prime: Point[]; pbTangent: PBResult;
  measures: Measures; claims: Record<string, boolean>;
};
type Core = {
  CIRCLE: Circle;
  OPTION_KEYS: string[];
  pointOnCircle(c: Point, r: number, t: number): Point;
  project(p: Point): Point;
  start(options?: Json): Json;
  geometry(state: Json): Geometry | null;
  compute(a: Point, b: Point, c: Point, d: Point): Geometry | null;
  describe(state: Json): string;
  dist(p: Point, q: Point): number;
  sub(p: Point, q: Point): Point;
  cross(p: Point, q: Point): number;
  pb(vertices: Point[]): PBResult | null;
  pitot(q: Point[]): { sum1: number; sum2: number; error: number };
  convex(q: Point[]): boolean;
  valid(q: Point[]): boolean;
  circumcenter(a: Point, b: Point, c: Point): Point | null;
};

const core = () => cores["de-villiers-3"].DeVilliers3Core as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number => Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: Point): Point => ({ x: round(p.x, 4), y: round(p.y, 4) });
const err = (v: number): number | null => Number.isFinite(v) ? v : null;
const errText = (v: number | null): string =>
  v === null ? "undefined" : v !== 0 && Math.abs(v) < 1e-4 ? v.toExponential(2) : String(round(v));

/** Tool arguments accept [x, y] or {x, y}; the page's saved state uses {x, y}. */
function readPoint(value: unknown, label: string): Point {
  if (Array.isArray(value) && value.length === 2) {
    const x = Number(value[0]), y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    const x = Number(o.x), y = Number(o.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  throw new Error(`"${label}" must be a point [x, y] or {x, y}`);
}

/** Four corners in order: an array of four points or {A, B, C, D}. */
function readQuad(value: unknown, label: string): Point[] {
  if (Array.isArray(value) && value.length === 4) {
    return value.map((p, i) => readPoint(p, `${label}[${i}]`));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    if (["A", "B", "C", "D"].every((k) => o[k] !== undefined)) {
      return ["A", "B", "C", "D"].map((k) => readPoint(o[k], `${label}.${k}`));
    }
  }
  throw new Error(`"${label}" must be four points [p, p, p, p] or {A, B, C, D}`);
}

/**
 * The page's four draggable dots: radians via `angles`, degrees via
 * `anglesDegrees`, explicit `points` snapped onto the circle as a drag does,
 * or the opening figure when none is given.
 */
function cornersFromArgs(args: Json): Point[] {
  const C = core();
  const hasRad = args.angles !== undefined && args.angles !== null;
  const hasDeg = args.anglesDegrees !== undefined && args.anglesDegrees !== null;
  const hasPts = args.points !== undefined && args.points !== null;
  if ([hasRad, hasDeg, hasPts].filter(Boolean).length > 1) {
    throw new Error('give only one of "angles", "anglesDegrees" or "points"');
  }
  if (hasRad || hasDeg) {
    const angles = numArray(args, hasRad ? "angles" : "anglesDegrees");
    if (angles.length !== 4) throw new Error(`four dots are needed: got ${angles.length} angles`);
    return (hasDeg ? angles.map((d) => d * Math.PI / 180) : angles)
      .map((t) => C.pointOnCircle(C.CIRCLE.c, C.CIRCLE.r, t));
  }
  if (hasPts) return readQuad(args.points, "points").map((p) => C.project(p));
  const s = C.start();
  const p = s.points as Json;
  return ["A", "B", "C", "D"].map((k) => readPoint(p[k], k));
}

/** The core's construction, refusing configurations it cannot draw. */
function geometryFrom(args: Json): { C: Core; g: Geometry; state: Json } {
  const C = core();
  const p = cornersFromArgs(args);
  const state = {
    points: { A: p[0], B: p[1], C: p[2], D: p[3] },
    options: {},
    explored: true,
  } as Json;
  const g = C.geometry(state);
  if (!g) {
    throw new Error("those four dots are degenerate (two coincide or the tangents are parallel); move them apart");
  }
  return { C, g, state };
}

/** The page's proof, with each residual measured by the core. */
function proofReading(g: Geometry) {
  const m = g.measures;
  return {
    circle: { center: pt(g.circle.c), radius: round(g.circle.r) },
    tangentVertices: g.tangentVertices.map(pt),
    tangentInradius: round(g.circle.r),
    tangentSpread: err(m.tangentSpread),
    xyz: { X: pt(g.X), Y: pt(g.Y), Z: pt(g.Z), W: pt(g.W) },
    xyzCircle: { center: pt(g.center), radius: round(g.radius) },
    xyzCyclicSpread: err(m.xyzSpread),
    diagonalsAtIncenterError: err(m.diagError),
    prime: g.prime.map(pt),
    primeInradius: err(m.primeInradius),
    primeSpread: err(m.primeSpread),
    pbOfTangent: g.pbTangent.vertices.map(pt),
    pitotError: err(m.pitotError),
    quarterPointsError: err(m.quarterError),
    homothetyError: err(m.homothetyError),
    cyclicPBDegenerateError: err(m.cyclicPBError),
    claims: g.claims,
  };
}

function proofNote(g: Geometry): string {
  const m = g.measures;
  const ok = Object.values(g.claims).every(Boolean);
  return ok
    ? `Everything fits: the tangents have the original circle as incircle, X,Y,Z,W lie on one circle about M' with XZ and YW through M, and halving from M takes A'B'C'D' onto A1B1C1D1 (off by ${errText(m.homothetyError)} units). Pitot's opposite-side sums for PB of the tangent quadrilateral agree to ${errText(m.pitotError)}, and the perpendicular bisectors of the cyclic dots collapse to M (off by ${errText(m.cyclicPBError)}).`
    : `The drawing is stretched: halving from M is off by ${errText(m.homothetyError)} units and the circle claims are not all true; drag a dot to a calmer spot.`;
}

export function actions(): GameActions {
  return {
    halving_proof: {
      describe:
        "Place the four dots on the page's circle (angles in radians via `angles`, degrees via `anglesDegrees`, explicit `points` snapped onto the circle, or omit all three for the opening figure) and rebuild the real construction. Report the tangent quadrilateral's incircle, the circle through X,Y,Z,W with its diagonals through M, and the homothety about M with ratio 1/2 that maps A'B'C'D' to A1B1C1D1. Pitot's residual for PB of the tangent quadrilateral and the collapse of the cyclic dots' perpendicular bisectors to M are included, with every claim measured by the core.",
      args: '{ "anglesDegrees": [0, 69, 166, 258] }',
      run: (args) => {
        const { C, g, state } = geometryFrom(args);
        return {
          ...proofReading(g),
          note: proofNote(g),
          status: C.describe(state),
        };
      },
    },
    pb_iterates: {
      describe:
        "Take any convex quadrilateral (`points` as four [x, y] or {x, y} corners in order) and apply the core's perpendicular-bisector construction twice. Report Pitot's opposite-side sums for Q and PB(Q): an inscriptible Q has an inscriptible PB image, and if PB(Q) is inscriptible then a non-cyclic Q was inscriptible too. For a cyclic Q the four PB vertices collapse to the circumcentre. Otherwise compare Q with PB(PB(Q)): all six sides and diagonals are parallel with one common homothety ratio.",
      args: '{ "points": [[0, 0], [5, 0], [8, 4], [3, 4]] }',
      run: (args) => {
        const C = core();
        const q = readQuad(args.points, "points");
        if (!C.valid(q)) throw new Error('"points" must be four finite corners');
        if (!C.convex(q)) throw new Error('"points" must be a convex quadrilateral in order A, B, C, D');
        const one = C.pb(q);
        if (!one) throw new Error("the perpendicular bisectors of those corners do not meet; choose a less stretched quadrilateral");
        const tol = 1e-6 * Math.max(1, ...q.map((p) => Math.hypot(p.x, p.y)));
        const pitotQ = C.pitot(q);
        const pitotOne = C.pitot(one.vertices);
        const inscriptibleQ = pitotQ.error <= tol;
        const inscriptibleOne = pitotOne.error <= tol;
        const o1 = C.circumcenter(q[0], q[1], q[2]);
        const o2 = C.circumcenter(q[1], q[2], q[3]);
        const cyclic = Boolean(o1 && o2 && C.dist(o1, o2) < 1e-7);
        const cyclicCenter = cyclic ? o1 : null;
        const collapseError = cyclicCenter
          ? Math.max(...one.vertices.map((p) => C.dist(p, cyclicCenter)))
          : null;

        if (cyclic) {
          return {
            quadrilateral: q.map(pt),
            convex: true,
            cyclic: true,
            circumcenter: cyclicCenter ? pt(cyclicCenter) : null,
            pitotQ: { left: round(pitotQ.sum1), right: round(pitotQ.sum2), error: err(pitotQ.error) },
            pb: { vertices: one.vertices.map(pt), collapseError },
            inscriptibleQ,
            forwardConsistent: !inscriptibleQ || inscriptibleOne,
            note: `These corners are cyclic: the perpendicular bisectors of all four sides pass through the circumcentre, and PB(Q) collapses there (spread ${errText(collapseError)}). The page treats this as the degenerate case of its theorem.`,
          };
        }

        const two = C.pb(one.vertices);
        if (!two || !C.convex(one.vertices) || !C.convex(two.vertices)) {
          throw new Error("PB(Q) or PB(PB(Q)) is degenerate here; choose a rounder quadrilateral");
        }
        /* One PB step shifts the labels by one, so after two steps side i
         * corresponds to side (i + 2) mod 4, and so do the two diagonals. */
        const parallelSin = (u: Point, v: Point): number =>
          Math.abs(C.cross(u, v)) / Math.max(1e-9, Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y));
        const sides = [0, 1, 2, 3].map((i) => {
          const j = (i + 2) % 4;
          const u = C.sub(q[(i + 1) % 4], q[i]);
          const v = C.sub(two.vertices[(j + 1) % 4], two.vertices[j]);
          const sin = parallelSin(u, v);
          return { part: `side ${i}`, parallelSin: err(sin), parallel: sin < 1e-9 };
        });
        const diagonals = [0, 1].map((i) => {
          const u = C.sub(q[(i + 2) % 4], q[i]);
          const v = C.sub(two.vertices[(i + 2) % 4], two.vertices[i]);
          const sin = parallelSin(u, v);
          return { part: `diagonal ${i}-${i + 2}`, parallelSin: err(sin), parallel: sin < 1e-9 };
        });
        const parts = [...sides, ...diagonals];
        const ratios = [0, 1, 2, 3].map((i) => {
          const j = (i + 2) % 4;
          const u = C.sub(q[(i + 1) % 4], q[i]);
          const v = C.sub(two.vertices[(j + 1) % 4], two.vertices[j]);
          return Math.hypot(v.x, v.y) / Math.hypot(u.x, u.y);
        });
        const ratio = ratios.reduce((s, r) => s + r, 0) / ratios.length;
        const ratioSpread = Math.max(...ratios) - Math.min(...ratios);
        const homothetic = parts.every((p) => p.parallel) && ratioSpread <= 1e-7 * Math.max(1, ratio);
        return {
          quadrilateral: q.map(pt),
          convex: true,
          cyclic: false,
          pitotQ: { left: round(pitotQ.sum1), right: round(pitotQ.sum2), error: err(pitotQ.error) },
          pitotPB: { left: round(pitotOne.sum1), right: round(pitotOne.sum2), error: err(pitotOne.error) },
          inscriptibleQ,
          inscriptiblePB: inscriptibleOne,
          forwardConsistent: !inscriptibleQ || inscriptibleOne,
          partialConverseConsistent: !(inscriptibleOne && !inscriptibleQ),
          pbVertices: one.vertices.map(pt),
          pbTwiceVertices: two.vertices.map(pt),
          pbTwice: {
            parallelParts: parts,
            homothetyRatio: round(ratio, 9),
            ratioSpread: err(ratioSpread),
            homothetic,
          },
          note: `PB(Q) has opposite-side sums ${round(pitotOne.sum1)} and ${round(pitotOne.sum2)} (gap ${errText(pitotOne.error)}), while Q's gap is ${errText(pitotQ.error)}. Since Q is not cyclic, a matching PB(Q) and a mismatched Q would break the partial converse; here that does not happen. Two PB steps give all six sides and diagonals parallel with a common ratio ${round(ratio, 6)} (spread ${errText(ratioSpread)}), so PB(PB(Q)) is homothetic with Q.`,
        };
      },
    },
  };
}

/** The saved Track.state fields, plus the core's reading of those dots. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) {
    throw new Error(`unsupported deVilliers3 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || !state.points || typeof state.points !== "object") {
    throw new Error("missing deVilliers3 saved state (expected a points object)");
  }
  const saved = state.points as Json;
  const points = {
    A: readPoint(saved.A, "points.A"), B: readPoint(saved.B, "points.B"),
    C: readPoint(saved.C, "points.C"), D: readPoint(saved.D, "points.D"),
  };
  const savedOptions = state.options && typeof state.options === "object" ? state.options as Json : {};
  const options: Json = {};
  for (const k of C.OPTION_KEYS) options[k] = savedOptions[k] === true;
  const explored = state.explored === true;
  const here: Json = { points, options, explored };
  const g = C.geometry(here);

  /* The page's handles are clamped to the fixed circle; report any drift. */
  const radii = [points.A, points.B, points.C, points.D].map(
    (p) => C.dist(p, C.CIRCLE.c),
  );
  const circleDrift = Math.max(...radii.map((r) => Math.abs(r - C.CIRCLE.r)));

  if (!g) {
    return {
      stateVersion,
      points,
      options,
      explored,
      valid: false,
      circleDrift: err(circleDrift),
      note: "Those saved dots are degenerate; the core cannot rebuild the illustration.",
    };
  }
  return {
    stateVersion,
    points,
    options,
    explored,
    valid: true,
    circleDrift: err(circleDrift),
    core: proofReading(g),
    note: proofNote(g),
    status: C.describe(here),
  };
}
