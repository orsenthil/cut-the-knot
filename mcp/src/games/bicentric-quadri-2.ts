/*
 * run_game_logic actions and saved-position reader for Bicentric Quadri 2.
 * Every number below comes from the real core,
 * bicentric-quadri-2/bicentric-quadri-2-core.js, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 *
 * The construction: four points A, B, C, D (on a circle w in the page) have
 * diagonals AC and BD crossing at P. K, L, M, N are the feet of the
 * perpendiculars from P to AB, BC, CD, DA. Proposition 1 says KLMN always has
 * an incircle centred at P, for every cyclic ABCD. The *second* claim, the one
 * this illustration is about, is different: KLMN has a circumcircle exactly
 * when the diagonals are perpendicular (ABCD is orthodiagonal). Together these
 * make KLMN bicentric. The converse does not need ABCD to be cyclic, so the
 * inspect action accepts any four points via the core's compute().
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bicentric-quadri-2"].BicentricQuadri2Core;
type Core = ReturnType<typeof core>;
type Geometry = NonNullable<ReturnType<Core["compute"]>>;
type Point = { x: number; y: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const deg = (a: number): number => Math.round(a * 180 / Math.PI);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;

/** A point written as [x, y] or { "x": ..., "y": ... }, with a helpful fallback. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: numField(o, "x", key), y: numField(o, "y", key) };
  }
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(v)}`);
}

/** A finite number from a nested point object. */
function numField(o: Json, field: string, outer: string): number {
  const v = o[field];
  const n = Number(v);
  if (v === undefined || v === null || !Number.isFinite(n)) {
    throw new Error(`argument "${outer}.${field}" must be a number, got ${JSON.stringify(v)}`);
  }
  return n;
}

/** Four corners, falling back to the page's reset picture. */
function readQuad(C: Core, args: Json) {
  const h = C.handles(C.start());
  if (!h) throw new Error("the reset picture is degenerate; supply A, B, C and D explicitly");
  return {
    A: readPoint(args, "A", h.A),
    B: readPoint(args, "B", h.B),
    Cc: readPoint(args, "C", h.C),
    D: readPoint(args, "D", h.D),
  };
}

function computeQuad(C: Core, args: Json): Geometry {
  const q = readQuad(C, args);
  const g = C.compute(q.A, q.B, q.Cc, q.D);
  if (!g) {
    throw new Error(
      "those four points make a degenerate picture: the diagonals are parallel or a side has zero length. Move a corner and try again.",
    );
  }
  return g;
}

/** Tutor-friendly reading of one drawing, in the page's 400 x 250 board units. */
function reading(g: Geometry) {
  return {
    vertices: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    diagonalCrossingP: pt(g.P),
    feet: { K_AB: pt(g.K), L_BC: pt(g.L), M_CD: pt(g.M), N_DA: pt(g.N) },
    circumcenterO: pt(g.O),
    diagonalsKMLN_crossingE: pt(g.E),
    perpendicularRadiiPK_PL_PM_PN: [g.radii[0], g.radii[1], g.radii[2], g.radii[3]].map(round),
    inradiiToSidesOfKLMN: g.inradii.map(round),
    circumradius: round(g.circumradius),
    inradius: round(g.inradius),
    radiusSpread: round(g.radiusSpread),
    inradiusSpread: round(g.inradiusSpread),
    claims: {
      // Proposition 1: the incircle centred at P is already there for every
      // cyclic ABCD; the second claim needs perpendicular diagonals.
      incircle_inscriptible: g.inscriptible === true,
      circumcircle_cyclic: g.cyclic === true,
      diagonals_perpendicular_orthodiagonal: g.orthodiagonal === true,
      appletWouldDrawCircle_appletFinished: g.appletFinished === true,
      O_P_E_collinear: g.collinear === true,
    },
    diagonalDotProduct: round(g.diagonalProduct),
    note:
      "Proposition 1: for a cyclic ABCD, P is the incenter of KLMN (its four distances from the sides agree) whether or not the diagonals cross at right angles. " +
      "The second claim is different: KLMN has a circumcircle (the four distances from O to K, L, M, N agree) exactly when AC and BD are perpendicular. " +
      "The applet's loose dot-product test (< 200) only decides when to paint the circle; the true claim uses the tight orthodiagonal and cyclic checks above.",
  };
}

/** Reconstruct a playable core position from saved page fields. */
function readState(state: Json) {
  const C = core();
  const center = state.center && typeof state.center === "object"
    ? { x: numField(state.center as Json, "x", "center"), y: numField(state.center as Json, "y", "center") }
    : undefined;
  const o = state.options && typeof state.options === "object" ? state.options as Json : {};
  return C.start({
    center,
    radius: num(state, "radius", C.DEFAULT_RADIUS),
    angles: Array.isArray(state.angles) && state.angles.length === 4
      ? state.angles.map((a) => Number(a))
      : undefined,
    options: {
      names: o.names === true, incircle: o.incircle === true,
      diagonals: o.diagonals === true, extend: o.extend === true,
    },
    selected: Number.isInteger(state.selected) ? state.selected : 0,
  });
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For four corners A, B, C, D as [x, y] points in the page's 400 x 250 board (y down), report the crossing P of diagonals AC and BD and the feet K, L, M, N of the perpendiculars from P to the four sides. Report the circumcentre O of KLMN, the four distances from O to K, L, M, N and their spread, the four distances from P to the sides of KLMN and their spread, and whether KLMN is cyclic (has a circumcircle) versus inscriptible (has the incircle centred at P). Also report whether the diagonals are perpendicular, whether the applet would draw its circle, and whether O, P and E are collinear. This distinguishes Proposition 1's incircle claim (true for every cyclic ABCD) from the second claim (a circumcircle exactly when the diagonals are perpendicular). The converse needs no circle through ABCD, so any four points are accepted. Corners may be omitted to use the reset picture.",
      args: '{ "A": [283.3333333333333, 145.83333333333334], "B": [241.66666666666674, 73.66454968463017], "C": [158.33333333333323, 73.66454968463019], "D": [186.96379457998083, 228.14069504959483] }',
      run: (args) => reading(computeQuad(core(), args)),
    },
    make_bicentric: {
      describe:
        "Start with four angles (in radians) on the page's circle w and press the applet's 'Make diagonals perpendicular' move. Report the angles and the diagonals' dot product before and after, whether KLMN is cyclic and inscriptible at each stage, and the angle identity a + c - b - d. The incircle is present in both pictures; the circumcircle appears only once the diagonals are at right angles, making KLMN bicentric.",
      args: '{ "angles": [0, 5.236, 4.189, 1.728], "radius": 83.33 }',
      run: (args) => {
        const C = core();
        const v = args.angles;
        if (!Array.isArray(v) || v.length !== 4) {
          throw new Error('argument "angles" must be an array of four numbers (radians)');
        }
        const angles = v.map((a, i) => {
          const n = Number(a);
          if (!Number.isFinite(n)) throw new Error(`angles[${i}] must be a number, got ${JSON.stringify(a)}`);
          return n;
        });
        const before = C.start({ radius: num(args, "radius", C.DEFAULT_RADIUS), angles });
        const after = C.move(before, { type: "bicentric" });
        const gb = C.geometry(before);
        const ga = C.geometry(after);
        const identity = (s: { angles: number[] }) =>
          round((s.angles[0] + s.angles[2] - s.angles[1] - s.angles[3]) * 180 / Math.PI);
        const brief = (g: Geometry | null) => g ? {
          orthodiagonal: g.orthodiagonal === true,
          cyclic: g.cyclic === true,
          inscriptible: g.inscriptible === true,
          diagonalDotProduct: round(g.diagonalProduct),
          radiusSpread: round(g.radiusSpread),
        } : null;
        return {
          anglesDegreesBefore: before.angles.map(deg),
          anglesDegreesAfter: after.angles.map(deg),
          angleIdentityDegrees: { before: identity(before), after: identity(after) },
          before: brief(gb),
          after: brief(ga),
          bicentric: Boolean(ga && ga.cyclic && ga.inscriptible),
          note:
            "For points at angles a, b, c, d on one circle, AC is perpendicular to BD exactly when a + c - b - d is a straight angle (180 degrees, mod 360), i.e. 0 mod 180 degrees. " +
            "The move changes C by the smallest amount that makes this true; KLMN then has both its incircle at P and a circumcircle through K, L, M, N.",
        };
      },
    },
  };
}

/** Saved fields from the page plus a fresh reading of the saved picture. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const here = readState(state);
  const g = C.geometry(here);
  const savedPt = (key: string) => {
    const v = state[key];
    return v && typeof v === "object" && !Array.isArray(v)
      ? pt({ x: numField(v as Json, "x", key), y: numField(v as Json, "y", key) })
      : null;
  };
  return {
    stateVersion,
    center: pt(here.center),
    radius: round(here.radius),
    anglesDegrees: here.angles.map(deg),
    options: here.options,
    selected: here.selected,
    savedPoints: {
      A: savedPt("A"), B: savedPt("B"), C: savedPt("C"), D: savedPt("D"),
      P: savedPt("P"), K: savedPt("K"), L: savedPt("L"), M: savedPt("M"), N: savedPt("N"),
      O: savedPt("O"), E: savedPt("E"),
    },
    savedFlags: {
      orthodiagonal: state.orthodiagonal === true,
      cyclic: state.cyclic === true,
      inscriptible: state.inscriptible === true,
    },
    reading: g ? reading(g) : {
      note: "Those saved angles make a degenerate picture (parallel lines); move a vertex to see the drawing.",
    },
    statusSentence: C.describe(here),
  };
}
