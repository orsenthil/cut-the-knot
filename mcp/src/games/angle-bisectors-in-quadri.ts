/*
 * run_game_logic actions and saved-position reader for Angle Bisectors in a
 * Quadrilateral. All geometry comes from the real core,
 * angle-bisectors-in-quadri/angle-bisectors-in-quadri-core.js, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 *
 * The construction: with G = AC ∩ BD, U = AX ∩ DY is the incenter of triangle
 * ADG and V = BX ∩ CY the incenter of triangle BCG, where X is the meeting of
 * the bisectors of angles CAD and CBD and Y that of ACB and ADB. Thus GU and
 * GV split a pair of vertical angles at G, so U, G, V lie on one line. When
 * ABCD is cyclic, X and Y also lie on its circumcircle, at the midpoints of
 * arcs CD and AB (X is equidistant from C and D, Y from A and B).
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angle-bisectors-in-quadri"].AngleBisectorsInQuadriCore;
type Core = ReturnType<typeof core>;
type Geometry = NonNullable<ReturnType<Core["compute"]>>;
type Point = { x: number; y: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;
const circleView = (c: { c: Point; r: number } | null | undefined) =>
  c ? { center: pt(c.c), radius: round(c.r) } : null;

/** Accept [x, y] or { "x": ..., "y": ... }, falling back to the applet's reset corner. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  if (fallback && (v === undefined || v === null)) return fallback;
  if (v === undefined || v === null) {
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(v)}`);
}

function readQuad(C: Core, args: Json) {
  const fresh = C.start();
  return {
    A: readPoint(args, "A", fresh.A),
    B: readPoint(args, "B", fresh.B),
    C: readPoint(args, "C", fresh.C),
    D: readPoint(args, "D", fresh.D),
  };
}

function computeQuad(C: Core, args: Json): Geometry {
  const q = readQuad(C, args);
  const g = C.compute(q.A, q.B, q.C, q.D);
  if (!g) {
    throw new Error(
      "those four points make a degenerate quadrilateral: two corners coincide, a diagonal is flat, or the bisectors are parallel. Move a corner.",
    );
  }
  return g;
}

/** Tutor-friendly reading of one construction, in the board's 400 x 300 units. */
function reading(C: Core, g: Geometry) {
  const m = g.measures;
  const cl = g.claims;
  const dx = (p: Point, q: Point) => round(C.dist(p, q));
  return {
    vertices: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    intersections: { X: pt(g.X), Y: pt(g.Y), U: pt(g.U), G: pt(g.G), V: pt(g.V) },
    collinear: {
      UGV: cl.collinear,
      error: round(m.collinearError),
      verticalAnglesAtG: cl.verticalAngles,
      uIncenterOfADG: cl.uIncenter,
      vIncenterOfBCG: cl.vIncenter,
    },
    circumcircleOfABC: circleView(g.circle),
    cyclic: cl.cyclic,
    cyclicError: round(m.cyclicError),
    arcMidpoints: {
      // Conditional: the equalities below are what make X and Y the
      // midpoints of arcs CD and AB once ABCD is cyclic.
      xToC: dx(g.X, g.C),
      xToD: dx(g.X, g.D),
      yToA: dx(g.Y, g.A),
      yToB: dx(g.Y, g.B),
      holdsWhenCyclic: cl.cyclicImpliesArcMidpoints,
    },
    circleBCD: circleView(g.circleBCD),
    circleBCDClaim: {
      // X is on the circle through B, C, D exactly when A is, and then Y is too.
      holds: cl.generalized,
      aError: round(m.aCircleBCD),
      xError: round(m.xCircleBCD),
      yError: round(m.yCircleBCD),
    },
    note:
      "U is the incenter of triangle ADG and V of BCG, so GU and GV bisect vertical angles at G and U, G, V are collinear. " +
      (cl.cyclic
        ? "ABCD is cyclic: X and Y lie on its circumcircle, with X equidistant from C and D (midpoint of arc CD) and Y equidistant from A and B (midpoint of arc AB)."
        : "ABCD is not cyclic, so the circumcircle claims about X and Y are not in force; the collinearity still holds."),
  };
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For quadrilateral corners A, B, C, D as [x, y] points in the page's 400 x 300 board (y down), report the bisector intersections X (bisectors of CAD and CBD) and Y (of ACB and ADB), the points U = AX ∩ DY, V = BX ∩ CY and G = AC ∩ BD, whether U, G, V are collinear (with the perpendicular error), the circumcircle of ABC and whether ABCD is cyclic. When it is cyclic, also report the arc-midpoint relation: X is equidistant from C and D, Y from A and B. Also reports the version without cyclicity using the circle through B, C, D.",
      args: '{ "A": [120, 160], "B": [280, 240], "C": [320, 80], "D": [180, 130] }',
      run: (args) => {
        const C = core();
        return reading(C, computeQuad(C, args));
      },
    },
    check_claims: {
      describe:
        "Test every claim on the illustration's page for corners A, B, C, D: the four angles are bisected at X and Y, U and V are incenters, the vertical angles at G are split so U, G, V are collinear, and — when ABCD is cyclic — X and Y lie on its circumcircle at the arc midpoints. Also tests the general version: X is on the circle through B, C, D exactly when A is, and then Y is too. Returns a boolean per claim, the failed names and a note saying which conditional claims are actually in force.",
      args: '{ "A": [100, 150], "B": [200, 50], "C": [300, 150], "D": [200, 250] }',
      run: (args) => {
        const C = core();
        const g = computeQuad(C, args);
        const cl = g.claims;
        const failed = [
          "bisectedAtA", "bisectedAtB", "bisectedAtC", "bisectedAtD",
          "uIncenter", "vIncenter", "verticalAngles", "collinear", "generalized",
        ].filter((k) => cl[k as keyof typeof cl] !== true);
        return {
          bisectedAtA: cl.bisectedAtA,
          bisectedAtB: cl.bisectedAtB,
          bisectedAtC: cl.bisectedAtC,
          bisectedAtD: cl.bisectedAtD,
          uIncenter: cl.uIncenter,
          vIncenter: cl.vIncenter,
          verticalAngles: cl.verticalAngles,
          UGVCollinear: cl.collinear,
          cyclic: cl.cyclic,
          whenCyclic: {
            applicable: cl.cyclic,
            xOnCircumcircle: cl.cyclicImpliesXOnCircle,
            yOnCircumcircle: cl.cyclicImpliesYOnCircle,
            arcMidpoints: cl.cyclicImpliesArcMidpoints,
          },
          circleBCDClaim: cl.generalized,
          failed,
          allHold: failed.length === 0,
          note: cl.cyclic
            ? "ABCD is cyclic, so the conditional circle claims apply: X and Y are on the circumcircle and at the arc midpoints. The implications are only assertions when their hypothesis holds; they are marked true otherwise by the core."
            : "ABCD is not cyclic: the 'cyclic implies ...' claims are vacuous here. The collinearity and circle-through-BCD claims do apply.",
        };
      },
    },
  };
}

/** The page's saved construction and options, plus a fresh reading of the corners. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const fresh = C.start();
  const A = readPoint(state, "A", fresh.A);
  const B = readPoint(state, "B", fresh.B);
  const Cc = readPoint(state, "C", fresh.C);
  const D = readPoint(state, "D", fresh.D);
  const g = C.compute(A, B, Cc, D);
  const savedPoint = (key: string) => {
    const v = state[key];
    return v && typeof v === "object" && !Array.isArray(v)
      ? pt({ x: num(v as Json, "x"), y: num(v as Json, "y") })
      : null;
  };
  return {
    stateVersion,
    A: pt(A), B: pt(B), C: pt(Cc), D: pt(D),
    X: savedPoint("X"), Y: savedPoint("Y"), U: savedPoint("U"), V: savedPoint("V"), G: savedPoint("G"),
    circle: circleView(state.circle as { c: Point; r: number } | undefined),
    options: state.options === undefined || state.options === null ? fresh.options : state.options,
    savedClaims: state.claims === undefined || state.claims === null ? null : state.claims,
    reading: g
      ? reading(C, g)
      : { note: "Those saved corners do not make a drawable quadrilateral; move a corner to see the construction." },
  };
}
