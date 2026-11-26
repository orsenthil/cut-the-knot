/*
 * run_game_logic actions and saved-position reader for Anonymous Visitor.
 *
 * The real core is anonymous-visitor/anonymous-visitor-core.js, copied into
 * src/generated/cores/ at build time. It builds equilateral triangles ADF and
 * BDE on the equal sides of the isosceles triangle ABD, takes C as the fourth
 * corner of the rhombus DFCE, and finds that C never moves. See _shared.ts for
 * the shape of a game module.
 *
 * Coordinates are board units from the page's 400 x 260 viewBox, with y down.
 * D always sits on the perpendicular bisector of the fixed base AB.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["anonymous-visitor"].AnonymousVisitorCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };

type Geometry = {
  A: Point; B: Point; D: Point; M: Point; u: Point; n: Point;
  s: number; F: Point; E: Point; C: Point; h: number; external: boolean; radius: number;
};

const round = (v: number, digits = 4): number => Number(v.toFixed(digits));
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);

/** Angle at q in degrees, from the vectors q->p and q->r. */
function angleDeg(p: Point, q: Point, r: Point): number {
  const a = { x: p.x - q.x, y: p.y - q.y };
  const b = { x: r.x - q.x, y: r.y - q.y };
  const denom = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  if (!denom) return NaN;
  const cos = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / denom));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Accept a point as [x, y] or { "x": ..., "y": ... }, with an optional default. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
}

/** The three handles, falling back to the illustration's opening picture. */
function baseState(C: Core, args: Json) {
  const fresh = C.start();
  return {
    A: readPoint(args, "A", { ...fresh.A }),
    B: readPoint(args, "B", { ...fresh.B }),
    D: readPoint(args, "D", { ...fresh.D }),
  };
}

/** Run the real construct(), refusing only the degenerate zero-length base. */
function geometry(C: Core, state: { A: Point; B: Point; D: Point }): Geometry {
  const g = C.construct(state) as Geometry | null;
  if (!g) throw new Error("A and B must be apart: a base of zero length has no perpendicular bisector");
  return g;
}

/**
 * C is the reflection of D in the line FE. F and E are mirror images in the
 * perpendicular bisector of AB and lie at signed height h/2 - (sqrt(3)/4)|AB|
 * along n, so that reflection cancels h and leaves M - (sqrt(3)/2)|AB| * n:
 * the third vertex of an equilateral triangle on AB, independent of D.
 */
const fixedPoint = (g: Geometry): Point => ({
  x: g.M.x - (Math.sqrt(3) / 2) * g.s * g.n.x,
  y: g.M.y - (Math.sqrt(3) / 2) * g.s * g.n.y,
});

/** The three sides and angles of ABC, and whether it is equilateral. */
function shape(g: Geometry) {
  const sides = { AB: dist(g.A, g.B), BC: dist(g.B, g.C), CA: dist(g.C, g.A) };
  const angles = { A: angleDeg(g.B, g.A, g.C), B: angleDeg(g.A, g.B, g.C), C: angleDeg(g.A, g.C, g.B) };
  const sideSpread = Math.max(sides.AB, sides.BC, sides.CA) - Math.min(sides.AB, sides.BC, sides.CA);
  const angleSpread = Math.max(angles.A, angles.B, angles.C) - Math.min(angles.A, angles.B, angles.C);
  return {
    sides: { AB: round(sides.AB), BC: round(sides.BC), CA: round(sides.CA) },
    anglesDegrees: { A: round(angles.A, 2), B: round(angles.B, 2), C: round(angles.C, 2) },
    equilateral: sideSpread < 1e-6 && angleSpread < 1e-6,
  };
}

function readHeights(args: Json): number[] {
  const v = args.heights;
  if (v === undefined || v === null) return [-100, -50, 0, 40];
  if (!Array.isArray(v) || v.length === 0) throw new Error('argument "heights" must be a non-empty array of numbers');
  if (v.length > 12) throw new Error('argument "heights" may have at most 12 entries');
  return v.map((h, i) => {
    const n = Number(h);
    if (!Number.isFinite(n)) throw new Error(`heights[${i}] is not a finite number`);
    return n;
  });
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For the fixed base A, B and the moving point D (board units in a 400 x 260 picture, y down, with D on the perpendicular bisector of AB), report the corners F and E of the two equilateral triangles ADF and BDE, the rhombus's fourth corner C, the midpoint M, the base length, D's signed height, the construction radius and whether the small triangles lie outside ABD. Also give ABC's three sides and angles and the fixed point M - (sqrt(3)/2)|AB| times the unit normal to AB, which C always equals. Omit A, B or D to use the opening picture.",
      args: '{ "A": [124, 176], "B": [276, 176], "D": [200, 76] }',
      run: (args) => {
        const C = core();
        const g = geometry(C, baseState(C, args));
        const fixed = fixedPoint(g);
        return {
          A: pt(g.A), B: pt(g.B), D: pt(g.D),
          M: pt(g.M), F: pt(g.F), E: pt(g.E), C: pt(g.C),
          unitNormal: pt(g.n),
          base: round(g.s), signedHeight: round(g.h), radius: round(g.radius),
          external: g.external,
          ABC: shape(g),
          fixedPoint: pt(fixed),
          distanceToFixedPoint: round(dist(g.C, fixed), 8),
          note:
            "ADF and BDE are equilateral on the equal sides of ABD. F and E are mirror images in the perpendicular bisector of AB, so FE is parallel to AB at signed height h/2 - (sqrt(3)/4)|AB| along n. C is D reflected in FE, which cancels h and leaves M - (sqrt(3)/2)|AB| * n. That is the third vertex of an equilateral triangle on AB, so ABC is equilateral and C does not move as D slides.",
        };
      },
    },
    height_independence: {
      describe:
        "Check the page's claim that C does not depend on D's height. Given A and B and a list of signed heights for D along the perpendicular bisector, put D at each height, rebuild the construction with the real core and report C each time (with F and E), the largest gap between any two C's, the fixed point M - (sqrt(3)/2)|AB| * n they all equal, and whether ABC is equilateral at every sample. Heights default to [-100, -50, 0, 40] and may number at most 12.",
      args: '{ "A": [124, 176], "B": [276, 176], "heights": [-100, -50, 0, 40] }',
      run: (args) => {
        const C = core();
        const { A, B, D } = baseState(C, args);
        const seed = geometry(C, { A, B, D });
        const fixed = fixedPoint(seed);
        const heights = readHeights(args);
        const raw = heights.map((h) => {
          const d = { x: seed.M.x + h * seed.n.x, y: seed.M.y + h * seed.n.y };
          const g = geometry(C, { A, B, D: d });
          return { h, g, s: shape(g) };
        });
        const samples = raw.map(({ h, g, s }) => ({
          height: h,
          D: pt(g.D), F: pt(g.F), E: pt(g.E), C: pt(g.C),
          sides: s.sides, equilateral: s.equilateral,
          deviationFromFixedPoint: round(dist(g.C, fixed), 8),
        }));
        const Cs = raw.map(({ g }) => g.C);
        let maxSpread = 0;
        for (let i = 0; i < Cs.length; i++) {
          for (let j = i + 1; j < Cs.length; j++) maxSpread = Math.max(maxSpread, dist(Cs[i], Cs[j]));
        }
        return {
          A: pt(A), B: pt(B), M: pt(seed.M), unitNormal: pt(seed.n), base: round(seed.s),
          fixedPoint: pt(fixed),
          samples,
          maxSpread: round(maxSpread, 8),
          independent: maxSpread < 1e-6,
          allOnFixedPoint: Cs.every((c) => dist(c, fixed) < 1e-6),
          allEquilateral: raw.every(({ s }) => s.equilateral),
          note:
            "At each height h, the turn of 60 degrees about A and B puts F and E at signed height h/2 - (sqrt(3)/4)|AB|. Reflection of D in that line gives C at -(sqrt(3)/2)|AB| from M, with h cancelled. Every sample lands on the same fixed point, the apex of an equilateral triangle on AB, so ABC stays equilateral whatever D does.",
        };
      },
    },
  };
}

/** The page's saved fields, plus a core-derived reading of the same picture. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const fresh = C.start();
  const A = readPoint(state, "A", { ...fresh.A });
  const B = readPoint(state, "B", { ...fresh.B });
  const D = readPoint(state, "D", { ...fresh.D });
  const raw = C.construct({ A, B, D }) as Geometry | null;
  if (!raw) {
    return {
      stateVersion,
      A: pt(A), B: pt(B), D: pt(D),
      note: "A and B are on top of each other, so there is no perpendicular bisector and no construction to read.",
    };
  }
  const g = raw;
  const fixed = fixedPoint(g);
  const savedC = state.C !== undefined && state.C !== null ? readPoint(state, "C") : null;
  return {
    stateVersion,
    // The fields the page saved with Track.state.
    A: pt(state.A !== undefined ? readPoint(state, "A") : g.A),
    B: pt(state.B !== undefined ? readPoint(state, "B") : g.B),
    D: pt(state.D !== undefined ? readPoint(state, "D") : g.D),
    C: pt(state.C !== undefined ? savedC : g.C),
    F: pt(state.F !== undefined ? readPoint(state, "F") : g.F),
    E: pt(state.E !== undefined ? readPoint(state, "E") : g.E),
    M: pt(state.M !== undefined ? readPoint(state, "M") : g.M),
    h: state.h !== undefined ? num(state as Json, "h", g.h) : round(g.h),
    base: state.base !== undefined ? num(state as Json, "base", g.s) : round(g.s),
    external: state.external !== undefined ? Boolean(state.external) : g.external,
    names: Boolean(state.names),
    premise: Boolean(state.premise),
    proof: Boolean(state.proof),
    reading: {
      D: pt(g.D), F: pt(g.F), E: pt(g.E), C: pt(g.C), M: pt(g.M),
      signedHeight: round(g.h), base: round(g.s), radius: round(g.radius),
      external: g.external,
      ABC: shape(g),
      fixedPoint: pt(fixed),
      C_matchesSaved: savedC ? dist(savedC, g.C) < 1e-6 : null,
      C_onFixedPoint: dist(g.C, fixed) < 1e-6,
      note:
        "The saved picture is rebuilt with the real core from A, B and D. It confirms that C is the reflection of D in FE and sits at M - (sqrt(3)/2)|AB| * n, the apex of an equilateral triangle on AB, whatever height D has. The overlays names, premise and proof are the applet's reveal toggles; premise and proof unlock once D has been dragged.",
    },
  };
}
