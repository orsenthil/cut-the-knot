/*
 * run_game_logic actions and saved-position reader for Deco Symmetry 4.
 *
 * The real core is deco-symmetry-4/deco-symmetry-4-core.js, copied into
 * src/generated/cores/ at build time. It transcribes the applet's Compute,
 * SetRotatingPoly and GeoSDoub helpers: reflect triangle ABC in the horizontal
 * line halfway between A and the base, cut from A' to the midpoints D of AB
 * and E of AC, and turn the two outer pieces half a turn about D and E to
 * rebuild the mirror triangle without flipping a piece. See _shared.ts for
 * the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["deco-symmetry-4"].DecoSymmetry4Core;

type Point = { x: number; y: number };
type Piece = { name: string; points: Point[]; final: Point[] | null; pivot: Point | null };
type Moving = { index: number; centre: Point; angle: number };
type Figure = {
  A: Point; B: Point; C: Point;
  Ap: Point; Bp: Point; Cp: Point;
  D: Point; E: Point;
  valid: boolean;
  pieces: Piece[];
  moving: Moving[];
};
type State = { A: Point; B: Point; C: Point; showNames: boolean; showHint: boolean };

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const deg = (radians: number): number => round((radians * 180) / Math.PI);
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;
const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

function finite(value: unknown, name: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`argument "${name}" must be a finite number, got ${JSON.stringify(value)}`);
  }
  return n;
}

/** Accept {x, y} (the saved state) or [x, y] (a convenient caller form). */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const v = args[key];
  if (v === undefined || v === null) return { ...fallback };
  if (Array.isArray(v)) {
    if (v.length < 2) throw new Error(`argument "${key}" needs two coordinates [x, y]`);
    return { x: finite(v[0], `${key}[0]`), y: finite(v[1], `${key}[1]`) };
  }
  if (typeof v === "object") {
    const o = v as Json;
    if (o.x === undefined || o.x === null || o.y === undefined || o.y === null) {
      throw new Error(`argument "${key}" must have finite x and y`);
    }
    return { x: finite(o.x, `${key}.x`), y: finite(o.y, `${key}.y`) };
  }
  throw new Error(`argument "${key}" must be a point {x, y} or [x, y]`);
}

/** The three draggable corners, with the applet's start position as fallback. */
function readState(args: Json): State {
  const base = core().start() as State;
  return {
    A: readPoint(args, "A", base.A),
    B: readPoint(args, "B", base.B),
    C: readPoint(args, "C", base.C),
    showNames: args.showNames === true,
    showHint: args.showHint === true,
  };
}

/** The geometric reading shared by both actions and by position(). */
function reading(figure: Figure, C: any) {
  const { A, B, C: corner, Ap, Bp, Cp, D, E, valid, pieces, moving } = figure;
  const midlineY = (A.y + B.y) / 2; // halfway between A and the base y = B.y
  return {
    triangle: { A: pt(A), B: pt(B), C: pt(corner) },
    mirrorLine: {
      description: "the horizontal line halfway between A and the base",
      y: round(midlineY),
    },
    reflectedTriangle: { Aprime: pt(Ap), Bprime: pt(Bp), Cprime: pt(Cp) },
    cuts: {
      fromAprime: pt(Ap),
      toMidpoints: { D: pt(D), E: pt(E) },
      DIsMidpointOfAB: near(D.x, mid(A, B).x) && near(D.y, mid(A, B).y),
      EIsMidpointOfAC: near(E.x, mid(A, corner).x) && near(E.y, mid(A, corner).y),
      lieOnMirrorLine: near(D.y, midlineY) && near(E.y, midlineY),
    },
    valid,
    domain: {
      test: "min(B.x, C.x) < A.x < max(B.x, C.x)",
      AOverSegmentBC: valid,
      status: C.describe(figure, false),
    },
    pieces: pieces.map((p, i) => ({
      index: i + 1,
      name: p.name,
      points: p.points.map(pt),
      final: p.final ? p.final.map(pt) : null,
      pivot: p.pivot ? pt(p.pivot) : null,
    })),
    halfTurns: moving.map((m) => {
      const source = pieces[m.index];
      return {
        piece: m.index + 1,
        pivot: source && source.pivot ? pt(source.pivot as Point) : null,
        angleDeg: deg(m.angle),
        finalCentre: pt(m.centre),
      };
    }),
  };
}

export function actions(): GameActions {
  return {
    dissection: {
      describe:
        "Reflect triangle ABC in the horizontal line halfway between A and the base to get A'B'C' (A' falls on the base). Two cuts from A' to D, the midpoint of AB, and E, the midpoint of AC, split ABC into three pieces that reassemble into the mirror triangle. Reports the reflection line, A', B', C', D, E, the three pieces with their final positions, and whether A lies above segment BC.",
      args: '{ "A": [135.333333, 41.666667], "B": [100, 208.333333], "C": [300, 208.333333] }',
      run: (args) => {
        const C = core();
        const figure = C.compute(readState(args)) as Figure;
        return {
          ...reading(figure, C),
          note:
            "D and E are the midpoints of AB and AC and lie on the mirror line, so the two cuts from A' split ABC into three pieces. " +
            "Turning the end pieces half a turn about D and E places them above the unchanged middle piece, tiling A'B'C'. " +
            "No piece is flipped, so this is a direct equidecomposition of a triangle and its mirror image.",
        };
      },
    },
    half_turns: {
      describe:
        "The two outer pieces rotate by half a turn (180 degrees), one about D (midpoint of AB) and one about E (midpoint of AC), while the middle piece stays fixed. Reports each pivot, the core's signed turn in degrees, the centre of the destination, the vertices at four stages of the turn, and the domain test min(B.x, C.x) < A.x < max(B.x, C.x) that decides whether A lies over BC.",
      args: '{ "A": [135.333333, 41.666667], "B": [100, 208.333333], "C": [300, 208.333333] }',
      run: (args) => {
        const C = core();
        const figure = C.compute(readState(args)) as Figure;
        const r = reading(figure, C);
        const stages = [0, 0.25, 0.5, 1].map((t) => ({
          t,
          firstPiece: (C.movingPoints(figure, 0, t) as Point[]).map(pt),
          lastPiece: (C.movingPoints(figure, 2, t) as Point[]).map(pt),
        }));
        return {
          triangle: r.triangle,
          valid: r.valid,
          domain: r.domain,
          halfTurns: r.halfTurns,
          stages,
          note:
            "Each end piece turns about its midpoint pivot through pi radians; the sign of the core's angle is the orientation of that piece, but both are 180 degrees. " +
            "At t = 1 the first piece sits at [B', A, D] and the last at [C', E, A], completing the mirror triangle. " +
            "The construction is only switched on when A.x is strictly between B.x and C.x, i.e. A stands above the segment BC.",
        };
      },
    },
  };
}

/** What the core says about the three corners and two checkboxes the page saved. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Deco Symmetry 4 state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Deco Symmetry 4 position must be an object");
  }
  const C = core();
  const base = C.start() as State;
  const savedState: State = {
    A: readPoint(state, "A", base.A),
    B: readPoint(state, "B", base.B),
    C: readPoint(state, "C", base.C),
    showNames: state.showNames === true,
    showHint: state.showHint === true,
  };
  const figure = C.compute(savedState) as Figure;
  return {
    stateVersion,
    saved: {
      A: pt(savedState.A),
      B: pt(savedState.B),
      C: pt(savedState.C),
      showNames: savedState.showNames,
      showHint: savedState.showHint,
    },
    ...reading(figure, C),
    note:
      "Track.state saved the three draggable corners and the two checkboxes. " +
      "The core reflects ABC in the horizontal midline, finds the midpoint cuts D and E and rebuilds the three pieces; " +
      "valid is true exactly when A.x is strictly between B.x and C.x, the domain where the reflected A' sits on the base.",
  };
}
