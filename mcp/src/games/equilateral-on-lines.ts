/*
 * run_game_logic actions and saved-position reader for Equilateral Triangle on
 * Parallel Lines (Bogomolny's EquilateralOnLines applet).
 *
 * Three horizontal lines carry one draggable point each: C on line 0, A (C1)
 * on line 1, B (C2) on line 2. The applet's construction rotates line 1 about
 * C through 60 degrees; where the rotated line meets line 2 is B, and rotating
 * B back 60 degrees gives A. Because a rotation keeps lengths and turns by
 * 60 degrees, CA = CB and angle ACB = 60 degrees, so ABC is equilateral. There
 * are two such triangles, one for each rotation direction.
 *
 * Every number below is measured from the real core in src/generated/cores/.
 * See _shared.ts for the game module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["equilateral-on-lines"].EquilateralOnLinesCore;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Geometry = ReturnType<Core["geometry"]>;
type Point = { x: number; y: number };

const r6 = (v: number): number =>
  Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN;
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });

/* Accept the page's { x, y } dots and the tutor's [x, y] arguments alike. */
function readPoint(value: unknown, label: string, fallback?: Point): Point {
  if (value === undefined || value === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Three y coordinates for the lines; falling back to the applet's opening rows. */
function readLines(args: Json, fallback: number[]): number[] {
  const lines = args.lines === undefined || args.lines === null
    ? fallback.slice()
    : numArray(args, "lines");
  if (lines.length !== 3) throw new Error('"lines" must contain exactly three y coordinates');
  return lines;
}

/** The Rotation scrollbar is an integer 0..65. */
function readAngle(args: Json): number {
  const angle = num(args, "angle", 0);
  if (!Number.isInteger(angle) || angle < 0 || angle > 65) {
    throw new Error('"angle" must be a whole number from 0 to 65 (the applet Rotation scrollbar)');
  }
  return angle;
}

/** Start from the core's opening picture and apply any supplied point moves. */
function buildState(args: Json, C: Core): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of points and options");
  }
  const lines = readLines(args, C.DEFAULT_Y);
  let s = C.start({
    lines,
    angle: readAngle(args),
    hint: args.hint === true,
    names: args.names === undefined ? true : !!args.names,
  });
  for (const [i, label] of [[0, "C"], [1, "A"], [2, "B"]] as const) {
    if (args[label] !== undefined && args[label] !== null) {
      s = C.movePoint(s, i, readPoint(args[label], label));
    }
  }
  return s;
}

/** Rebuild exactly the saved position: lines, coefficient and three points. */
function savedState(state: Json, C: Core): State {
  const lines = readLines(state, C.DEFAULT_Y);
  const coef = state.coef === undefined || state.coef === null
    ? C.DEFAULT_COEF.slice()
    : numArray(state, "coef");
  if (coef.length !== 3) throw new Error('saved "coef" must contain exactly three numbers');
  if (coef.some((t) => t < 0 || t > 1)) {
    throw new Error('saved "coef" entries must lie between 0 and 1');
  }
  const seed = C.start({ lines });
  const points = [0, 1, 2].map((i) => {
    const raw = Array.isArray(state.points) ? state.points[i] : undefined;
    return raw === undefined ? { ...seed.points[i] } : readPoint(raw, `saved points[${i}]`);
  });
  return C.settle(C.make({
    lines, coef, points,
    angle: readAngle(state),
    hint: state.hint === true,
    names: state.names === undefined ? true : !!state.names,
  }));
}

/**
 * The angle at C of a triangle with two equal arms, from the law of cosines;
 * the core's rotation construction should make it exactly 60 degrees.
 */
function angleAt(Cpt: Point, A: Point, B: Point, C: Core): number {
  const ca = C.dist(Cpt, A), cb = C.dist(Cpt, B), ab = C.dist(A, B);
  if (!ca || !cb) return NaN;
  const cosC = (ca * ca + cb * cb - ab * ab) / (2 * ca * cb);
  return (Math.acos(Math.min(1, Math.max(-1, cosC))) * 180) / Math.PI;
}

/** Measure both rotation candidates the core's geometry() produces. */
function solutionReading(C: Core, s: State): Json[] {
  const g: Geometry = C.geometry(s);
  const Cpt = s.points[0];
  return g.solutions.map((sol, i) => {
    const A = sol.A, B = sol.B;
    if (![A.x, A.y, B.x, B.y].every(Number.isFinite)) {
      return {
        index: i,
        orientation: sol.sign === 1 ? "+60°" : "−60°",
        valid: false,
        note: "The rotated line missed line 2 (the core's intersection guard), so no triangle exists for this direction.",
      };
    }
    const ca = C.dist(Cpt, A), cb = C.dist(Cpt, B), ab = C.dist(A, B);
    const angle = angleAt(Cpt, A, B, C);
    const landing = C.rotate(Cpt, A, C.SIXTY, sol.sign);
    return {
      index: i,
      orientation: sol.sign === 1 ? "+60°" : "−60°",
      sign: sol.sign,
      valid: true,
      A: pt(A), B: pt(B),
      sideLengths: { CA: r6(ca), CB: r6(cb), AB: r6(ab) },
      angleACB: r6(angle),
      equilateral: Math.abs(ca - cb) < 1e-6 && Math.abs(ca - ab) < 1e-6 &&
        Math.abs(angle - 60) < 1e-6,
      rotatingABy60: { landing: pt(landing), distanceToB: r6(C.dist(landing, B)) },
      onLines: {
        A: Math.abs(A.y - s.lines[1]) < 1e-6,
        B: Math.abs(B.y - s.lines[2]) < 1e-6,
      },
      foot: pt(sol.foot),
      image: pt(sol.image),
    };
  });
}

/** The three points actually placed on the lines, and their side lengths. */
function placementReading(C: Core, s: State): Json {
  const [Cpt, A, B] = s.points;
  const ca = C.dist(Cpt, A), cb = C.dist(Cpt, B), ab = C.dist(A, B);
  const angle = angleAt(Cpt, A, B, C);
  const g: Geometry = C.geometry(s);
  const distances = g.solutions.map((sol, i) => ({
    orientation: sol.sign === 1 ? "+60°" : "−60°",
    distanceA: r6(C.dist(s.points[1], sol.A)),
    distanceB: r6(C.dist(s.points[2], sol.B)),
    withinSnap: C.dist(s.points[1], sol.A) < 3 && C.dist(s.points[2], sol.B) < 3,
    withinWin: C.dist(s.points[1], sol.A) < 1 && C.dist(s.points[2], sol.B) < 1,
    finite: Number.isFinite(sol.A.x) && Number.isFinite(sol.B.x),
  }));
  return {
    points: { C: pt(Cpt), A: pt(A), B: pt(B) },
    sideLengths: { CA: r6(ca), CB: r6(cb), AB: r6(ab) },
    angleACB: r6(angle),
    nearEquilateral: Math.abs(ca - cb) < 1e-4 && Math.abs(ca - ab) < 1e-4,
    finished: s.finished,
    solvedIndex: s.solvedIndex,
    distancesToSolutions: distances,
  };
}

export function actions(): GameActions {
  return {
    rotation_solution: {
      describe:
        "Run the real core's 60-degree rotation construction and report the two equilateral triangles (one per rotation direction) for the given line heights and point C on line 0. For each, check CA = CB = AB, angle ACB = 60 degrees, that rotating A about C by 60 degrees lands on B, and that A and B lie on lines 1 and 2; the applet's blue guide (image and foot) at the optional Rotation slider angle is included too. 'lines' is three y coordinates (default [120, 170, 225]), 'C' a [x, y] or { x, y } point placed on line 0, and 'angle' an integer 0..65 (default 0).",
      args: '{ "lines": [120, 170, 225], "C": [205, 120], "angle": 0 }',
      run: (args) => {
        const C = core();
        const s = buildState(args, C);
        return {
          state: {
            lines: s.lines.slice(),
            C: pt(s.points[0]),
            angle: s.angle,
            coefficientOnLine1: r6(s.coef[1]),
          },
          solutions: solutionReading(C, s),
          fromCore: C.describe(s),
          note:
            "Rotating line 1 about C by 60 degrees (either direction) meets line 2 at B; turning B back by 60 degrees gives A on line 1. A rotation keeps CA = CB and turns through 60 degrees, so angle ACB = 60 and the third side AB matches — the triangle is equilateral. The two orientations give a mirror pair of solutions with the same side length.",
        };
      },
    },

    placement_check: {
      describe:
        "Place C, A and B on their three lines (each [x, y] or { x, y }; only x matters as the core projects each point onto its own line) and report the triangle's side lengths, angle at C and how near it is to equilateral, plus the distance from the placed A and B to each rotation solution. Uses the core's own snap (within 3 units) and win (within 1 unit) thresholds, so it also says which solution, if any, the picture settles onto. 'lines' is three y coordinates and 'angle' an integer 0..65.",
      args: '{ "lines": [120, 170, 225], "C": [205, 120], "A": [200, 170], "B": [202.1132486540518, 225] }',
      run: (args) => {
        const C = core();
        const s = buildState(args, C);
        return {
          state: {
            lines: s.lines.slice(),
            angle: s.angle,
            hint: s.hint,
            explored: s.explored,
          },
          placement: placementReading(C, s),
          solutions: solutionReading(C, s),
          fromCore: C.describe(s),
          note:
            "The core snaps a point to a candidate within 3 board units and declares success when both points are within 1 unit of the same candidate; the two orientations are tried in order, so the second can overwrite a snap made by the first. A near-equilateral placement that is not within these thresholds will show finished = false.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equilateral Triangle on Parallel Lines state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equilateral Triangle on Parallel Lines position must be an object");
  }
  try {
    const C = core();
    const s = savedState(state, C);
    return {
      stateVersion,
      saved: { ...state },
      lines: s.lines.slice(),
      coef: s.coef.slice(),
      points: s.points.map(pt),
      angle: s.angle,
      hint: s.hint,
      names: s.names,
      finishedFromSave: state.finished === true,
      reading: {
        placement: placementReading(C, s),
        solutions: solutionReading(C, s),
        fromCore: C.describe(s),
      },
      note:
        "Track.state saved the three line heights, the points' coefficients, the three points, the Rotation slider, the hint/name flags and the finished flag, in board units with y down. The core rebuilds the two 60-degree rotation solutions from that position, measures CA, CB and angle ACB and checks whether the placed points fall inside its snap and win thresholds. finishedFromSave echoes the page's flag; reading.placement.finished is the core's recomputation.",
    };
  } catch (err) {
    return {
      stateVersion,
      valid: false,
      saved: { ...state },
      error: err instanceof Error ? err.message : String(err),
      note:
        "The saved position needs three finite line heights, three coefficients between 0 and 1, three finite points, and a whole-number Rotation slider from 0 to 65.",
    };
  }
}
