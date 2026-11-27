/*
 * run_game_logic actions and saved-position reader for Equilateral Triangles
 * On Sides of a Parallelogram (Bogomolny's EquiTriOnPara applet).
 *
 * On the sides of a parallelogram ABCD, equilateral triangles ABX, BCY, CDZ
 * and DAW are built with one turn. Their free tips X,Y,Z,W form another
 * parallelogram (the midpoints of XZ and YW agree). Building equilateral
 * triangles XYP, YZQ, ZWR and WXS with the opposite turn gives P,Q,R,S, and
 * the page's surprise is that these land exactly back on D,A,B,C: the second
 * parallelogram is the original one. Rotations keep lengths and turn through
 * 60 degrees, so the return is shape-independent.
 *
 * Every number below is measured by the real core in
 * equi-tri-on-para/equi-tri-on-para-core.js, copied into src/generated/cores/
 * at build time. Coordinates are board units of the illustration's 480 x 480
 * viewBox, with y down. This is a demonstration: there is no win or loss. See
 * _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Options = { names: boolean; first: boolean; second: boolean };
type Claims = {
  middleParallelogram: boolean;
  lastParallelogram: boolean;
  coincide: boolean;
};
type State = {
  A: Point; B: Point; C: Point; D: Point;
  options: Options;
  explored: boolean;
};
type Geometry = {
  X: Point; Y: Point; Z: Point; W: Point;
  P: Point; Q: Point; R: Point; S: Point;
  middleParallelogram: boolean;
  lastParallelogram: boolean;
  coincide: boolean;
};
type Core = {
  ANGLE: number;
  BASE: string[];
  point(x: number, y: number): Point;
  add(p: Point, q: Point): Point;
  dist(p: Point, q: Point): number;
  start(options?: Json): State;
  move(state: State, name: string, p: Point): State;
  geometry(state: State): Geometry;
  describe(state: State): string;
  result(state: State): null;
};

const core = (): Core => cores["equi-tri-on-para"].EquiTriOnParaCore as unknown as Core;

/* The rotations are exact up to floating point; residuals are ~1e-13 units. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const tiny = (v: number): number => (Number.isFinite(v) ? Number(v.toExponential(3)) : NaN);
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const deg = (radians: number): number => r6((radians * 180) / Math.PI);

/** Accept both the page's { x, y } dots and the tutor's [x, y] arguments. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Cosmetic switches may be top-level keys or a nested `options` object. */
function readOptions(args: Json): Options {
  const raw: Json = args.options && typeof args.options === "object" && !Array.isArray(args.options)
    ? args.options as Json : args;
  const flag = (key: keyof Options, fallback: boolean): boolean => {
    const v = raw[key];
    if (v === undefined || v === null) return fallback;
    if (typeof v !== "boolean") {
      throw new Error(`"${key}" must be a boolean, got ${JSON.stringify(v)}`);
    }
    return v;
  };
  /* The core defaults all three checkboxes to false. */
  return { names: flag("names", false), first: flag("first", false), second: flag("second", false) };
}

function readClaims(value: unknown): Claims {
  const raw: Json = value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
  const flag = (key: keyof Claims): boolean => {
    const v = raw[key];
    if (v === undefined || v === null) return false;
    if (typeof v !== "boolean") throw new Error(`saved claims.${key} must be a boolean`);
    return v;
  };
  return {
    middleParallelogram: flag("middleParallelogram"),
    lastParallelogram: flag("lastParallelogram"),
    coincide: flag("coincide"),
  };
}

/** The opening picture, or the four corners supplied together as board points. */
function buildState(args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with optional A, B, C, D points and options");
  }
  const K = core();
  const base = K.start({});
  const names = ["A", "B", "C", "D"] as const;
  const supplied = names.filter((n) => args[n] !== undefined && args[n] !== null);
  if (supplied.length === 0) return { ...base, options: readOptions(args) };
  if (supplied.length !== 4) {
    throw new Error("supply all four corners A, B, C, D together, or none (the applet's opening picture is used)");
  }
  return {
    A: readPoint(args.A, "A"),
    B: readPoint(args.B, "B"),
    C: readPoint(args.C, "C"),
    D: readPoint(args.D, "D"),
    options: readOptions(args),
    explored: true,
  };
}

/** Everything the core can say about one picture, in tutor-friendly units. */
function reading(K: Core, s: State, g: Geometry = K.geometry(s)) {
  return {
    corners: { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D) },
    options: { ...s.options },
    first: {
      tips: { X: pt(g.X), Y: pt(g.Y), Z: pt(g.Z), W: pt(g.W) },
      parallelogram: g.middleParallelogram,
      /* A parallelogram has X + Z = Y + W, so this gap vanishes. */
      diagonalMidpointGap: tiny(K.dist(K.add(g.X, g.Z), K.add(g.Y, g.W)) / 2),
    },
    second: {
      tips: { P: pt(g.P), Q: pt(g.Q), R: pt(g.R), S: pt(g.S) },
      parallelogram: g.lastParallelogram,
      coincide: g.coincide,
      landingErrors: {
        P_to_D: tiny(K.dist(g.P, s.D)),
        Q_to_A: tiny(K.dist(g.Q, s.A)),
        R_to_B: tiny(K.dist(g.R, s.B)),
        S_to_C: tiny(K.dist(g.S, s.C)),
      },
    },
    status: K.describe(s),
    result: K.result(s),
  };
}

export function actions(): GameActions {
  return {
    parallelograms: {
      describe:
        "Build equilateral triangles ABX, BCY, CDZ and DAW on the sides of parallelogram ABCD with one turn, then XYP, YZQ, ZWR and WXS with the opposite turn. Reports the first tips X,Y,Z,W (which form a parallelogram), the second tips P,Q,R,S (which form another) and the surprise that P lands on D, Q on A, R on B and S on C, with the landing errors. Supply all four corners A,B,C,D as [x,y] or {x,y} points, or omit them for the applet's opening picture; optional names/first/second flags match the page's checkboxes.",
      args: '{ "A": [165, 320], "B": [220, 160], "C": [345, 216], "D": [290, 376] }',
      run: (args) => {
        const K = core();
        const view = reading(K, buildState(args));
        return {
          ...view,
          note:
            `Both rounds turn through ${deg(K.ANGLE)} degrees about each side. The first gives X,Y,Z,W, whose ` +
            `diagonal midpoints differ by ${view.first.diagonalMidpointGap} board units, so they make a parallelogram. ` +
            `Turning back gives P,Q,R,S; their distances to D,A,B,C are ` +
            `${view.second.landingErrors.P_to_D}, ${view.second.landingErrors.Q_to_A}, ` +
            `${view.second.landingErrors.R_to_B} and ${view.second.landingErrors.S_to_C} units — zero to rounding, ` +
            `so the second parallelogram is the original one again. This is a demonstration with no win or loss.`,
        };
      },
    },

    drag_return: {
      describe:
        "Drag one corner of the parallelogram to a new point: the core recomputes the corner opposite it exactly as the applet's mouseDragged did. Reports the new picture before and after and checks that X,Y,Z,W still form a parallelogram and P,Q,R,S still return to D,A,B,C, showing the surprise holds for every shape. 'corner' must be A, B, C or D and 'to' a finite [x,y] or {x,y} point; optional A,B,C,D set the starting parallelogram (all four or none).",
      args: '{ "corner": "B", "to": [180, 130] }',
      run: (args) => {
        const K = core();
        const start = buildState(args);
        const corner = args.corner;
        if (typeof corner !== "string" || K.BASE.indexOf(corner) < 0) {
          throw new Error('"corner" must be one of A, B, C, D');
        }
        const to = readPoint(args.to, "to");
        const before = reading(K, start);
        const after = reading(K, K.move(start, corner, to));
        return {
          corner,
          draggedTo: pt(to),
          corners: after.corners,
          before: {
            middleParallelogram: before.first.parallelogram,
            lastParallelogram: before.second.parallelogram,
            coincide: before.second.coincide,
          },
          after,
          note:
            `Dragging ${corner} to (${pt(to).x}, ${pt(to).y}) kept ABCD a parallelogram by moving the opposite corner. ` +
            `The two parallelogram claims and the return were ${before.first.parallelogram}, ` +
            `${before.second.parallelogram} and ${before.second.coincide}; afterwards they are ` +
            `${after.first.parallelogram}, ${after.second.parallelogram} and ${after.second.coincide}. ` +
            "Because a rotation preserves lengths and turns by 60 degrees, both constructions stay parallelograms and P,Q,R,S land back on D,A,B,C whatever the shape.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equi Tri on Parallelogram state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equi Tri on Parallelogram position must be an object");
  }
  const saved = {
    A: readPoint(state.A, "A"), B: readPoint(state.B, "B"),
    C: readPoint(state.C, "C"), D: readPoint(state.D, "D"),
    X: readPoint(state.X, "X"), Y: readPoint(state.Y, "Y"),
    Z: readPoint(state.Z, "Z"), W: readPoint(state.W, "W"),
    P: readPoint(state.P, "P"), Q: readPoint(state.Q, "Q"),
    R: readPoint(state.R, "R"), S: readPoint(state.S, "S"),
    options: readOptions(state.options && typeof state.options === "object"
      ? state.options as Json : {}),
    claims: readClaims(state.claims),
  };
  const K = core();
  /* The core's geometry needs only the four draggable corners. */
  const s: State = {
    A: saved.A, B: saved.B, C: saved.C, D: saved.D,
    options: saved.options,
    explored: true,
  };
  const g = K.geometry(s);
  const fresh = reading(K, s, g);
  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  for (const key of ["X", "Y", "Z", "W", "P", "Q", "R", "S"] as const) {
    for (const axis of ["x", "y"] as const) {
      differences.push({
        field: `${key}.${axis}`,
        page: r6(saved[key][axis]),
        core: r6(g[key][axis]),
        diff: Number(Math.abs(saved[key][axis] - g[key][axis]).toExponential(3)),
      });
    }
  }
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );
  const coreClaims: Claims = {
    middleParallelogram: g.middleParallelogram,
    lastParallelogram: g.lastParallelogram,
    coincide: g.coincide,
  };
  const claimsAgree = (Object.keys(coreClaims) as (keyof Claims)[]).every(
    (key) => saved.claims[key] === coreClaims[key],
  );

  return {
    ...state,
    stateVersion,
    saved,
    valid: true,
    core: fresh,
    savedMatchesCore,
    claimsAgree,
    differences,
    note:
      "Track.state saved the four corners A,B,C,D, all eight equilateral tips X,Y,Z,W and P,Q,R,S, " +
      "the three display flags and the page's three claims, in the illustration's 480 by 480 board units with y down. " +
      "The real core rebuilds both rounds of 60-degree tips from the four corners alone, checks that X,Y,Z,W make " +
      "a parallelogram (the midpoints of XZ and YW agree) and that P,Q,R,S land back on D,A,B,C, and compares those " +
      "with the saved tips and claims. " +
      (savedMatchesCore && claimsAgree
        ? "The saved numbers and claims agree with a fresh core construction."
        : "Some saved numbers or claims differ from the core rebuild; see `differences` and trust `core` for the true reading."),
  };
}
