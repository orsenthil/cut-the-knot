/*
 * run_game_logic actions and saved-position reader for Archimedes Triangle.
 *
 * The core lives in archimedes-triangle/ and is copied into src/generated/cores/
 * at build time. It works in the applet's screen coordinates: the parabola is
 * y = VY - t^2/(4a) with t measured sideways from the axis. Pick two parameters
 * t1, t2: their tangents meet at S, and S, M (the chord's midpoint), O (on the
 * curve) and the two half-side points A1, B1 carry Archimedes' midpoint lemma.
 * Splitting the tangent triangle again and again gives the parabolic segment
 * an area of exactly 2/3 of the triangle. Everything reported below is
 * recomputed by the real core. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["archimedes-triangle"].ArchimedesTriangleCore;

type Point = { x: number; y: number };
type SavedState = {
  t1: number; t2: number;
  showNames: boolean; showLemma: boolean; showTheorem: boolean; showFill: boolean;
  moves: number; explored: boolean;
};

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const pt = (p: Point) => ({ x: round(p.x, 4), y: round(p.y, 4) });
const close = (v: number, target: number, tolerance = 1e-6): boolean => Math.abs(v - target) <= tolerance;
// The core can return null from a line intersection; with distinct parameters
// it never does, but make that guarantee explicit for the type checker.
const found = (p: Point | null, name: string): Point => {
  if (!p) throw new Error(`the core found no ${name} for these parameters`);
  return p;
};

/**
 * Turn two parameters into the core's state. Actions are strict: t1 and t2
 * must be finite, inside the applet's handle range and at least MIN_GAP apart,
 * and the four switches must be booleans. A saved position is tolerant: the
 * core clamps and separates whatever it is given.
 */
function readState(args: Json, strict: boolean) {
  const C = core();
  const t1 = num(args, "t1", strict ? undefined : C.START.t1);
  const t2 = num(args, "t2", strict ? undefined : C.START.t2);
  if (strict) {
    if (!(t1 >= C.T_MIN && t1 <= C.T_MAX)) {
      throw new Error(`"t1" must be between ${C.T_MIN} and ${C.T_MAX}, got ${t1}`);
    }
    if (!(t2 >= C.T_MIN && t2 <= C.T_MAX)) {
      throw new Error(`"t2" must be between ${C.T_MIN} and ${C.T_MAX}, got ${t2}`);
    }
    if (Math.abs(t2 - t1) < C.MIN_GAP) {
      throw new Error(`"t1" and "t2" must differ by at least ${C.MIN_GAP}, got ${t1} and ${t2}`);
    }
  }
  const options: Json = {};
  for (const key of C.OPTION_KEYS as string[]) {
    const value = args[key];
    if (value === undefined) continue;
    if (strict && typeof value !== "boolean") throw new Error(`"${key}" must be true or false`);
    options[key] = value === true;
  }
  return C.start({ t1, t2, ...options }) as SavedState;
}

/** The areas: the tangent triangle, the curved segment and the 2/3 ratio. */
function areaReading(s: { t1: number; t2: number }) {
  const C = core();
  const g = C.compute(s);
  const S = found(g.S, "tangent intersection S");
  const ratio = g.areaSegment / g.areaABS;
  const r = C.residuals(g);
  return {
    t1: s.t1,
    t2: s.t2,
    points: {
      A: pt(g.A), B: pt(g.B), S: pt(S), M: pt(g.M), O: pt(g.O),
    },
    areas: {
      tangentTriangleABS: round(g.areaABS),
      parabolicSegment: round(g.areaSegment),
      segmentOverTriangle: round(ratio, 10),
    },
    isTwoThirds: close(ratio, 2 / 3, 1e-9),
    // Fractions of ABS: ABO is half, S-A1-B1 a quarter, the other two a quarter.
    split: {
      innerTriangleABO: round(g.areaABO / g.areaABS, 8),
      topTriangleA1B1S: round(g.areaA1B1S / g.areaABS, 8),
      sideTrianglesAA1OAndBB1O: round((g.areaAA1O + g.areaBB1O) / g.areaABS, 8),
      partitionResidual: round(r.partition, 10),
    },
  };
}

/** The midpoint lemma: axis-parallel median, three midpoints and tangency. */
function lemmaReading(s: { t1: number; t2: number }) {
  const C = core();
  const g = C.compute(s);
  const S = found(g.S, "tangent intersection S");
  const A1 = found(g.A1, "midpoint A1");
  const B1 = found(g.B1, "midpoint B1");
  const r = C.residuals(g);
  const residuals = {
    axisParallel: round(r.axisParallel, 10),
    A1Mid: round(r.A1Mid, 10),
    B1Mid: round(r.B1Mid, 10),
    OMid: round(r.OMid, 10),
    tangentOParallel: round(r.tangentOParallel, 10),
    SOnTangentA: round(r.SOnTangentA, 10),
    SOnTangentB: round(r.SOnTangentB, 10),
    OOnParabola: round(r.OOnParabola, 10),
    focusProperty: round(r.focusProperty, 10),
  };
  return {
    t1: s.t1,
    t2: s.t2,
    points: {
      A: pt(g.A), B: pt(g.B), S: pt(S), M: pt(g.M), O: pt(g.O),
      A1: pt(A1), B1: pt(B1), focus: pt(g.F),
    },
    claimedMidpoints: {
      AS: pt(C.midpoint(g.A, S)),
      BS: pt(C.midpoint(g.B, S)),
      MS: pt(C.midpoint(g.M, S)),
    },
    projections: {
      SOnAxis: { x: C.CX, y: round(S.y, 4) },
      SOnDirectrix: pt({ x: S.x, y: g.directrixY }),
      AOnDirectrix: pt(g.AP),
      BOnDirectrix: pt(g.BP),
    },
    focusDistances: {
      A: { toFocus: round(C.dist(g.A, g.F)), toDirectrix: round(g.directrixY - g.A.y) },
      B: { toFocus: round(C.dist(g.B, g.F)), toDirectrix: round(g.directrixY - g.B.y) },
    },
    residuals,
    holds: Object.fromEntries(
      Object.entries(residuals).map(([key, value]) => [key, close(value, 0, 1e-6)]),
    ),
  };
}

export function actions(): GameActions {
  return {
    triangle_and_segment: {
      describe:
        "For two points on the parabola given by their sideways parameters t1 and t2 (both -180 to 180 in the applet's coordinates, at least 20 apart), report where the tangents meet (S), the area of the tangent triangle ABS, the area of the parabolic segment cut off by the chord AB, and their ratio. The ratio is 2/3 whichever points you pick: ABS splits into ABO (half), S-A1-B1 (a quarter) and AA1O + BB1O (a quarter), and repeating the split gives 1/2 (1 + 1/4 + 1/16 + ...) = 2/3.",
      args: '{ "t1": 180, "t2": -130 }',
      run: (args) => {
        const a = areaReading(readState(args, true));
        return {
          ...a,
          note: `With t1 = ${a.t1} and t2 = ${a.t2}, the tangents meet at S = (${a.points.S.x}, ${a.points.S.y}). Triangle ABS has area ${a.areas.tangentTriangleABS} and the curved segment has area ${a.areas.parabolicSegment}, a ratio of ${a.areas.segmentOverTriangle} = 2/3. Inside ABS the inner triangle takes ${a.split.innerTriangleABO}, the top triangle ${a.split.topTriangleA1B1S} and the two side triangles ${a.split.sideTrianglesAA1OAndBB1O} between them.`,
        };
      },
    },
    midpoint_lemma: {
      describe:
        "The midpoint lemma for the same two parameters: S and the chord's midpoint M lie on a line parallel to the parabola's axis; the tangent at O (where that line meets the curve) cuts the sides at A1 and B1, the midpoints of AS and BS; and O is the midpoint of MS. Reports the points, their projections on the axis and directrix, the focal property of A and B, and the residuals of every claim.",
      args: '{ "t1": 180, "t2": -130 }',
      run: (args) => {
        const s = readState(args, true);
        const l = lemmaReading(s);
        return {
          ...l,
          note: `S = (${l.points.S.x}, ${l.points.S.y}) and M = (${l.points.M.x}, ${l.points.M.y}) share an x, so MS is parallel to the axis. The tangent at O = (${l.points.O.x}, ${l.points.O.y}) meets the sides at A1 = (${l.points.A1.x}, ${l.points.A1.y}) and B1 = (${l.points.B1.x}, ${l.points.B1.y}), the midpoints of AS and BS, and O is the midpoint of MS. Every residual is essentially zero.`,
        };
      },
    },
  };
}

/** The page's saved fields, plus what the core says about that same picture. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported Archimedes Triangle state version ${stateVersion}`);

  const s = readState(state, false);
  const a = areaReading(s);
  const l = lemmaReading(s);
  const shown = [
    s.showNames && "names",
    s.showLemma && "the lemma",
    s.showTheorem && "the theorem",
    s.showFill && "filled triangles",
  ].filter(Boolean) as string[];

  return {
    stateVersion,
    // The fields archimedes-triangle.js saves with Track.state, with the same names.
    t1: s.t1,
    t2: s.t2,
    showNames: s.showNames,
    showLemma: s.showLemma,
    showTheorem: s.showTheorem,
    showFill: s.showFill,
    moves: num(state, "moves", 0),
    explored: state.explored === true,
    core: {
      points: a.points,
      areas: a.areas,
      isTwoThirds: a.isTwoThirds,
      split: a.split,
      midpointLemma: {
        A1: l.points.A1,
        B1: l.points.B1,
        claimedMidpoints: l.claimedMidpoints,
        residuals: l.residuals,
        holds: l.holds,
      },
    },
    note: `The saved picture has A at t = ${s.t1} and B at t = ${s.t2}, with ${shown.length ? shown.join(", ") : "no optional overlays"} shown. The core puts S at (${a.points.S.x}, ${a.points.S.y}) and gives the segment ${a.areas.segmentOverTriangle} of the tangent triangle's area (2/3); the midpoint lemma holds (${Object.values(l.holds).every(Boolean) ? "all residuals zero" : "check the residuals"}).`,
  };
}
