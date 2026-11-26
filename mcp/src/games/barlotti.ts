/*
 * run_game_logic actions and saved-position reader for Barlotti.
 * The core lives in barlotti/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 *
 * The applet stretches a regular N-gon Q by M = [[a, b], [c, d]] to get the
 * thick polygon P, then erects a regular N-gon on every side of P. Writing
 * points as complex numbers gives P_j - O = u eta^j + v eta^(-j); the v term
 * cancels in the centroid of each erected polygon, leaving centres
 * C_j = O + u (1 + eta) eta^j. So the centres are always a regular N-gon of
 * radius r |a + d + i(c - b)| cos(pi/N) — and when a + d = 0 and c - b = 0,
 * u = 0 and all of them pile up at O.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["barlotti"].BarlottiCore;

type Pt = { x: number; y: number };
type State = {
  n: number; a: number; b: number; c: number; d: number;
  rotation: number; center: Pt; radius: number;
};
const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const xy = (p: Pt) => [r2(p.x), r2(p.y)];
const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);

/** Read and validate the controls the page exposes; the core holds the ranges. */
function readState(args: Json): State {
  const C = core();
  const n = num(args, "n", C.DEFAULTS.n);
  if (!Number.isInteger(n) || n < C.LIMITS.n[0] || n > C.LIMITS.n[1]) {
    throw new Error(`"n" must be a whole number from ${C.LIMITS.n[0]} to ${C.LIMITS.n[1]}`);
  }
  const coeff = {} as Record<"a" | "b" | "c" | "d", number>;
  for (const key of ["a", "b", "c", "d"] as const) {
    const v = num(args, key, C.DEFAULTS[key]);
    if (v < C.LIMITS[key][0] || v > C.LIMITS[key][1]) {
      throw new Error(`"${key}" must be between ${C.LIMITS[key][0]} and ${C.LIMITS[key][1]} (the applet's slider range, value / 100)`);
    }
    coeff[key] = v;
  }
  const centerArg = args.center;
  let center: Pt | undefined;
  if (centerArg !== undefined && centerArg !== null) {
    if (typeof centerArg !== "object" || Array.isArray(centerArg)) {
      throw new Error('"center" must be an object with numeric x and y');
    }
    center = {
      x: num(centerArg as Json, "x", C.CENTER.x),
      y: num(centerArg as Json, "y", C.CENTER.y),
    };
  }
  const radius = num(args, "radius", C.RADIUS);
  if (!(radius > 0)) throw new Error('"radius" must be positive');
  return C.start({
    ...coeff, n, center, radius,
    rotation: num(args, "rotation", C.DEFAULTS.rotation),
  }) as State;
}

/** What the core says about the erected polygons and their centres. */
function readFigure(C: ReturnType<typeof core>, state: State) {
  const centres = C.centers(state, false) as Pt[];
  const closedForm = C.centerPolygon(state) as Pt[];
  const claims = C.claims(state) as Record<string, boolean>;
  const tol = 1e-7 * Math.max(state.radius, 1);
  const radius = C.centerRadius(state) as number;
  const measured = centres.length ? dist(centres[0], state.center) : 0;
  const collapsed = centres.length > 0 && centres.every((p) => dist(p, state.center) <= tol);
  const trace = state.a + state.d;
  const skew = state.c - state.b;
  const formulaGap = centres.length === closedForm.length
    ? Math.max(...centres.map((p, i) => dist(p, closedForm[i]))) : Infinity;
  return {
    n: state.n,
    matrix: [[state.a, state.b], [state.c, state.d]],
    trace: r4(trace),
    skew: r4(skew),
    affinePolygonIsRegularAfterReflection: Boolean(claims.affineRegular),
    everyErectedPolygonRegular: Boolean(claims.erectedRegular),
    centers: centres.map(xy),
    centersAreRegular: Boolean(claims.centersRegular),
    centerRadius: r4(radius),
    measuredRadius: r4(measured),
    closedFormMatchesConstruction: formulaGap <= tol,
    radiusFormulaHolds: Boolean(claims.radiusFormula),
    collapsed,
    collapseMatchesCondition: Boolean(claims.collapseRule),
  };
}

export function actions(): GameActions {
  return {
    centers: {
      describe:
        "Erect a regular N-gon on every side of the affine image of a regular N-gon under M = [[a, b], [c, d]] (the applet's four sliders, each value / 100). Return the centres of those N polygons, whether they form a regular N-gon, and their radius r*|a+d + i(c-b)|*cos(pi/N). The centres equal O + u(1+eta)eta^j with u = (r/2)((a+d) + i(c-b))e^(i*rotation): when a+d = 0 and c-b = 0 they all coincide at O, even though the affine map need not be singular.",
      args: '{ "n": 6, "a": 0.4, "b": 0.6, "c": -0.5, "d": 0.5 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const out = readFigure(C, state);
        return {
          ...out,
          note:
            "The v eta^(-j) part of the stretched polygon cancels when the N erected-polygon vertices are averaged, so only u = (r/2)((a+d) + i(c-b))e^(i*rotation) survives. The centres therefore form a genuine regular N-gon for every matrix, with radius proportional to hypot(a+d, c-b) and independent of the determinant of M.",
        };
      },
    },
    coincident_centres: {
      describe:
        "Set the affine map to a reflection composed with a scaling (a+d = 0 and c-b = 0, e.g. a = 1, b = c = 0, d = -1) and show the degenerate case of Barlotti's theorem: u = 0, so all N centres land on O and the centre polygon has radius 0. Nudging one coefficient by 0.05 makes hypot(a+d, c-b) and the radius positive again; the centres are regular in both cases. This is a check of the formula, not an exception to it.",
      args: '{ "n": 6, "a": 1, "b": 0, "c": 0, "d": -1 }',
      run: (args) => {
        const C = core();
        const state = readState(args); // defaults give the reflection a = 1, d = -1
        if (Math.hypot(state.a + state.d, state.c - state.b) > 1e-12) {
          throw new Error('choose coefficients with a + d = 0 and c - b = 0 (e.g. a = 1, b = 0, c = 0, d = -1)');
        }
        const step = state.a + 0.05 <= C.LIMITS.a[1] ? 0.05 : -0.05;
        const nudged = C.withOption(state, "a", state.a + step) as State;
        const here = readFigure(C, state);
        const nearby = readFigure(C, nudged);
        return {
          n: state.n,
          matrix: here.matrix,
          trace: here.trace,
          skew: here.skew,
          allCentresAtCenter: here.collapsed,
          centerRadius: here.centerRadius,
          centersAreRegular: here.centersAreRegular,
          firstCenter: here.centers[0] ?? null,
          nudgedA: r4(nudged.a),
          nudgedCenterRadius: nearby.centerRadius,
          nudgedCentersAreRegular: nearby.centersAreRegular,
          note:
            "With a+d = 0 and c-b = 0 the complex coefficient u vanishes, so the erected-polygon centres cancel to O and the 'polygon' of centres has radius 0. The theorem still holds: a single point is a regular N-gon of radius 0. Move any coefficient so that a+d or c-b is nonzero and the centres spread out into a regular N-gon whose radius is r*hypot(a+d, c-b)*cos(pi/N).",
        };
      },
    },
  };
}

/** The position the page saved with Track.state, plus the core's reading of it. */
export function position(state: Json, stateVersion?: number): unknown {
  const C = core();
  const centerArg = state.center;
  const center: Pt = centerArg && typeof centerArg === "object" && !Array.isArray(centerArg)
    ? {
        x: num(centerArg as Json, "x", C.CENTER.x),
        y: num(centerArg as Json, "y", C.CENTER.y),
      }
    : C.CENTER;
  const here = C.start({
    n: num(state, "n", C.DEFAULTS.n),
    a: num(state, "a", C.DEFAULTS.a),
    b: num(state, "b", C.DEFAULTS.b),
    c: num(state, "c", C.DEFAULTS.c),
    d: num(state, "d", C.DEFAULTS.d),
    rotation: num(state, "rotation", C.DEFAULTS.rotation),
    center,
    radius: num(state, "radius", C.RADIUS),
  }) as State;
  return {
    stateVersion: stateVersion ?? 1,
    a: here.a,
    b: here.b,
    c: here.c,
    d: here.d,
    rotation: r4(here.rotation),
    center: here.center,
    radius: here.radius,
    ...readFigure(C, here),
    note:
      "On the screen the dashed regular N-gon is stretched by [[a, b], [c, d]] to make the thick polygon, and a regular N-gon is built on each of its sides. Their centres, rounded to whole pixels by the original applet, form a regular N-gon of radius r*hypot(a+d, c-b)*cos(pi/N); when a+d = c-b = 0 they all coincide at the centre.",
  };
}
