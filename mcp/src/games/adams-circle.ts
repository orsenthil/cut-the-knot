/*
 * run_game_logic actions and saved-position reader for Adams' Circle.
 *
 * The core lives in adams-circle/ in the site and is copied into
 * src/generated/cores/ at build time. All the numbers below come from it.
 * See _shared.ts for the shape of a game module.
 *
 * Coordinates are board units from the page's 360 x 260 viewBox, with y down.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["adams-circle"].AdamsCircleCore;

type Point = { x: number; y: number };

/** The successful result of core.geometry(): all six intersections exist. */
type Geometry = {
  valid: true;
  A: Point; B: Point; C: Point;
  I: Point; radius: number;
  D: Point; E: Point; F: Point; G: Point;
  P: Point; Q: Point; R: Point; S: Point; T: Point; U: Point;
  circle: { center: Point; radius: number };
  sixPoints: Point[];
};

/** Accept a point from the model as {x, y}, with plain numeric coordinates. */
function readPoint(value: unknown, label: string): Point {
  const p = value as Json;
  if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
    throw new Error(`${label} must have numeric x and y (board units, y down)`);
  }
  return { x: Number(p.x), y: Number(p.y) };
}

/** Rebuild a triangle from args, falling back to the illustration's opening one. */
function readTriangle(args: Json) {
  const s = core().start();
  return {
    A: args.A !== undefined ? readPoint(args.A, "A") : (s.A as Point),
    B: args.B !== undefined ? readPoint(args.B, "B") : (s.B as Point),
    C: args.C !== undefined ? readPoint(args.C, "C") : (s.C as Point),
  };
}

/** Build the geometry, refusing the collinear cases the page cannot draw. */
function geometry(args: Json): Geometry {
  const C = core();
  const g = C.geometry(readTriangle(args));
  if (!g.valid) throw new Error("those three points do not make a drawable triangle (they may be on one line)");
  return g as Geometry;
}

const round = (v: number, digits = 4): number => Number(v.toFixed(digits));
const pt = (p: Point | null | undefined) =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x, 2), y: round(p.y, 2) } : null;

/** The labelled construction, named as on the page. */
function construction(g: ReturnType<typeof geometry>) {
  const C = core();
  const [P, Q, R, S, T, U] = g.sixPoints;
  return {
    incenter: pt(g.I),
    incircleRadius: round(g.radius),
    contactPoints: { D: pt(g.D), E: pt(g.E), F: pt(g.F) },
    gergonnePoint: pt(g.G),
    sixAdamsPoints: { P: pt(P), Q: pt(Q), R: pt(R), S: pt(S), T: pt(T), U: pt(U) },
    circle: { center: pt(g.circle.center), radius: round(g.circle.radius) },
    distancesFromIncenter: C.radii(g).map((r: number) => round(r)),
    spread: C.circleError(g),
    centerError: C.centerError(g),
    note: "The incircle touches the sides at D, E, F; AD, BE, CF meet at G. Parallels to EF, FD and DE through G cut the sides at P, Q, R, S, T, U. Their circle is centred at the incenter I, and its radius is only a hair more than the incircle radius.",
  };
}

/** The numbers behind the proof that all six points sit on one circle. */
function concyclicity(g: ReturnType<typeof geometry>) {
  const C = core();
  const lengths = C.tangentLengths(g) as number[];
  const radii = C.radii(g) as number[];
  const spread = C.circleError(g) as number;
  const centerError = C.centerError(g) as number;
  const circumcenter = C.circumcenter(g.A, g.B, g.C) as Point | null;
  return {
    tangentLengths: {
      DP: round(lengths[0]), DQ: round(lengths[1]),
      ER: round(lengths[2]), ES: round(lengths[3]),
      FT: round(lengths[4]), FU: round(lengths[5]),
    },
    equalTangentLengths: Math.max(...lengths) - Math.min(...lengths) < 1e-6,
    distancesFromIncenter: radii.map((r) => round(r)),
    largestSpread: spread,
    concyclic: spread < 1e-6,
    circleCenter: pt(g.circle.center),
    incenter: pt(g.I),
    centerError,
    centerIsIncenter: centerError < 1e-6,
    circumcenterOfABC: pt(circumcenter),
    note: "DP = DQ, ER = ES and FT = FU, while ID, IE and IF are all the incircle radius and perpendicular to their sides. Pythagoras then gives the same distance from I to all six points. So the circle through S, U and Q passes through all six and has centre I — unlike an ordinary six-point circle, whose centre is the circumcenter of ABC.",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a triangle A, B, C in board units (360 x 260, y down), report the incenter and incircle, the three contact points D, E, F, the Gergonne point G, the six Adams points P, Q, R, S, T, U, the circle through them, and how far their distances from I differ. Omit a vertex to use the illustration's opening triangle.",
      args: '{ "A": {"x": 280, "y": 95}, "B": {"x": 90, "y": 200}, "C": {"x": 100, "y": 60} }',
      run: (args) => construction(geometry(args)),
    },
    concyclicity: {
      describe:
        "For a triangle A, B, C, check Adams' concyclicity: the six tangent lengths from the contact points, the six distances from the incenter, their spread, whether the circle's centre is the incenter rather than the circumcenter of ABC, and the proof in words.",
      args: '{ "A": {"x": 280, "y": 95}, "B": {"x": 90, "y": 200}, "C": {"x": 100, "y": 60} }',
      run: (args) => concyclicity(geometry(args)),
    },
  };
}

/** What the core says about the triangle and options the page saved. */
export function position(state: Json, _stateVersion: number): unknown {
  const C = core();
  const tri = readTriangle(state);
  const defaults = C.start().options as Json;
  const options = Object.fromEntries(
    Object.keys(defaults).map((key) => [key, state.options && (state.options as Json)[key] === undefined
      ? defaults[key]
      : Boolean((state.options as Json)[key])]),
  );
  const raw = C.geometry(tri);
  const g = raw as Geometry;
  return {
    A: tri.A,
    B: tri.B,
    C: tri.C,
    options,
    valid: raw.valid,
    ...(raw.valid ? { ...construction(g), ...concyclicity(g) } : {
      note: "The saved points do not form a drawable triangle, so the incircle and Adams circle cannot be drawn.",
    }),
  };
}
