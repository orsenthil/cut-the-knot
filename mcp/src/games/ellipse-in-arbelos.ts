/*
 * run_game_logic actions and saved-position reader for Ellipse in Arbelos.
 *
 * The real core is ellipse-in-arbelos/ellipse-in-arbelos-core.js, copied into
 * src/generated/cores/ at build time. Its state is three numbers: f, the
 * fraction of AB where C fixes the small circle's diameter; n, the number of
 * chain circles; and t, the shift of the family C_t. Two circles touch at A,
 * and the centres of circles touching both lie on an ellipse with semiaxes
 * (a1+a2)/2 (arithmetic mean) and sqrt(a1*a2) (geometric mean). Every number
 * below is measured from that core's own circles; see _shared.ts for the
 * module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

interface Point { x: number; y: number; }
interface State { f: number; n: number; t: number; }
interface MathCircle { s: number; x: number; y: number; r: number; }
interface ScreenCircle { s: number; center: Point; radius: number; }
interface Geometry {
  state: State;
  A: Point;
  r: number;   // a1, radius of CircleFromDiameter(A, C)
  R: number;   // a2, radius of CircleFromDiameter(A, B)
  sum: number; // a1 + a2
  diff: number;// a2 - a1
  major: number;
  minor: number;
  circles: ScreenCircle[];
}
interface EllipseCore {
  A: Point;
  SIDE: number;
  R: number;
  START_FRACTION: number;
  START_N: number;
  START_T: number;
  MIN_N: number;
  MAX_N: number;
  MIN_T: number;
  MAX_T: number;
  clampFraction(f: number): number;
  start(options?: Partial<State>): State;
  geometry(state: State): Geometry;
  position(state: State): { f: number; n: number; t: number; a1: number; a2: number; major: number; minor: number; circles: MathCircle[] };
  chainIndex(i: number): number;
}

const core = (): EllipseCore =>
  cores["ellipse-in-arbelos"].EllipseInArbelosCore as unknown as EllipseCore;
const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const near = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** f in [0,1], n an integer 1..20 and t in [-15,15], all clamped by the real core. */
function readState(C: EllipseCore, args: Json): State {
  const fRaw = num(args, "f", C.START_FRACTION);
  if (fRaw < 0 || fRaw > 1) throw new Error('"f" must be a fraction between 0 and 1');
  const nRaw = num(args, "n", C.START_N);
  const n = Math.trunc(nRaw);
  if (n !== nRaw || n < C.MIN_N || n > C.MAX_N) {
    throw new Error(`"n" must be an integer between ${C.MIN_N} and ${C.MAX_N}`);
  }
  const t = num(args, "t", C.START_T);
  if (t < C.MIN_T || t > C.MAX_T) {
    throw new Error(`"t" must be between ${C.MIN_T} and ${C.MAX_T}`);
  }
  return C.start({ f: C.clampFraction(fRaw), n, t });
}

interface CircleReading {
  s: number; x: number; y: number; r: number;
  tau: number;
  radiusMatchesFormula: boolean;
  touchesSmallCircle: boolean;
  touchesBigCircle: boolean;
  smallGapResidual: number;
  bigGapResidual: number;
  focusDistanceSum: number;
  ellipseResidual: number;
  onEllipse: boolean;
}

/** Each circle in the article's frame: A at the origin, y upward. */
function circleReadings(g: Geometry): CircleReading[] {
  const a1 = g.r, a2 = g.R, diff = a2 - a1;
  return g.circles.map((c) => {
    const x = c.center.x - g.A.x;
    const y = g.A.y - c.center.y;
    const dSmall = Math.hypot(x - a1, y);
    const dBig = Math.hypot(x - a2, y);
    const tau = a1 * a2 + c.s * c.s * diff * diff;
    const radiusFormula = a1 * a2 * diff / tau;
    const ellipseResidual = ((x - g.major) ** 2) / (g.major ** 2) + (y ** 2) / (g.minor ** 2) - 1;
    const smallGap = dSmall - (a1 + c.radius);
    const bigGap = dBig - (a2 - c.radius);
    return {
      s: round(c.s), x: round(x), y: round(y), r: round(c.radius),
      tau: round(tau),
      radiusMatchesFormula: near(c.radius, radiusFormula),
      touchesSmallCircle: near(smallGap, 0),
      touchesBigCircle: near(bigGap, 0),
      smallGapResidual: round(smallGap),
      bigGapResidual: round(bigGap),
      focusDistanceSum: round(dSmall + dBig),
      ellipseResidual: round(ellipseResidual, 9),
      onEllipse: Math.abs(ellipseResidual) < 1e-8,
    };
  });
}

/** C_s touches C_{s+1}: among the drawn circles, check each pair one apart. */
function neighbourTangencies(g: Geometry): Array<{ sA: number; sB: number; gap: number; tangent: boolean }> {
  const out: Array<{ sA: number; sB: number; gap: number; tangent: boolean }> = [];
  for (let i = 0; i < g.circles.length; i++) {
    for (let j = i + 1; j < g.circles.length; j++) {
      const a = g.circles[i], b = g.circles[j];
      if (!near(Math.abs(a.s - b.s), 1)) continue;
      const d = Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y);
      const gap = d - (a.radius + b.radius);
      out.push({ sA: round(a.s), sB: round(b.s), gap: round(gap), tangent: near(gap, 0) });
    }
  }
  return out;
}

export function actions(): GameActions {
  return {
    center_locus: {
      describe:
        "Run the real core with C at fraction `f` along AB (0–1, default 0.5), drawing `n` chain circles (1–20) at shift `t` (−15..15). The two touching circles have radii a1=(SIDE·f)/2 and a2=95, and their tangent circles' centres lie on an ellipse with semiaxes (a1+a2)/2 (arithmetic mean) and sqrt(a1·a2) (geometric mean). Reports both semiaxes, the focus separation and, for each circle, its distances to the two foci (summing to a1+a2) and its ellipse-identity residual.",
      args: '{ "f": 0.5 }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const g = C.geometry(s);
        const readings = circleReadings(g);
        const focusHalf = g.diff / 2;
        return {
          state: s,
          smallRadius: round(g.r),
          bigRadius: round(g.R),
          semiaxes: {
            majorArithmeticMean: round(g.major),
            minorGeometricMean: round(g.minor),
          },
          arithmeticMinusGeometric: round(g.major - g.minor),
          arithmeticAtLeastGeometric: g.major >= g.minor - 1e-9,
          radiiSum: round(g.sum),
          focusSeparation: round(g.diff),
          focusHalfSeparation: round(focusHalf),
          majorSquaredMinusMinorSquared: round(g.major ** 2 - g.minor ** 2),
          halfSeparationSquared: round(focusHalf ** 2),
          fociMatchSemiaxes: near(g.major ** 2 - g.minor ** 2, focusHalf ** 2),
          ellipseCentreFromA: { x: round(g.major), y: 0 },
          circles: readings.map(({ s: sc, x, y, r, focusDistanceSum, ellipseResidual, onEllipse }) =>
            ({ s: sc, x, y, r, focusDistanceSum, ellipseResidual, onEllipse })),
          allCentresOnEllipse: readings.every((c) => c.onEllipse),
          note:
            "A circle in the arbelos touching both given circles has its centre P at distances a1+r from the small centre and a2−r from the big centre, so PA1+PA2=a1+a2 is constant: an ellipse with foci at those two centres. Its semimajor axis is the arithmetic mean (a1+a2)/2 and its semiminor axis the geometric mean sqrt(a1a2); the foci are major±(a2−a1)/2 because major²−minor²=(a2−a1)²/4. Equality of the means happens only when C is the midpoint of AB.",
        };
      },
    },

    tangent_chain: {
      describe:
        "Run the real core's family C_t for `n` circles (1–20) at shift `t` (−15..15) with C at fraction `f` of AB: circle k uses s=t+chainIndex(k), k=0,1,−1,2,−2,…, radius a1·a2·(a2−a1)/τ with τ=a1·a2+s²(a2−a1)², and centre (a1·a2·(a1+a2)/τ, ±2s·radius) from A with y upward. Reports each centre, radius and τ, checks that each circle touches the small circle externally and the big circle internally, and checks that circles whose parameters differ by 1 touch one another.",
      args: '{ "f": 0.521053, "n": 3, "t": 1 }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const g = C.geometry(s);
        const readings = circleReadings(g);
        const neighbours = neighbourTangencies(g);
        return {
          state: s,
          a1: round(g.r),
          a2: round(g.R),
          product: round(g.r * g.R),
          difference: round(g.diff),
          parameters: g.circles.map((c) => round(c.s)),
          chainOrder: Array.from({ length: g.circles.length }, (_, i) => C.chainIndex(i)),
          circles: readings,
          neighbourTangencies: neighbours,
          allTouchBothCircles: readings.every((c) => c.touchesSmallCircle && c.touchesBigCircle),
          allRadiiMatchFormula: readings.every((c) => c.radiusMatchesFormula),
          allNeighboursTouch: neighbours.every((p) => p.tangent),
          note:
            "The family C_t is built so that the distance from its centre to the small centre is a1+r (external touch) and to the big centre is a2−r (internal touch); adding the two gives the ellipse's constant sum. As s runs through integers, consecutive members differ by 1 in s and touch externally, which is the tangent circle chain. Residuals near zero above are measured from the core's own centres and radii, not assumed.",
        };
      },
    },
  };
}

const maybeNum = (v: unknown): number | null => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const close = (a: number | null, b: number, tol = 1e-3): boolean =>
  a !== null && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function savedCircles(v: unknown): MathCircle[] | null {
  if (!Array.isArray(v)) return null;
  return v.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("each saved circle must be an object with s, x, y and r");
    }
    const o = item as Json;
    const r = num(o, "r");
    if (r < 0) throw new Error('saved circle "r" must be non-negative');
    return { s: num(o, "s"), x: num(o, "x"), y: num(o, "y"), r };
  });
}

/** Track.state saved f, n, t and the derived a1, a2, semiaxes and circles. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Ellipse in Arbelos state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Ellipse in Arbelos position must be an object");
  }
  try {
    const C = core();
    const s = readState(C, state);
    const g = C.geometry(s);
    const fromCore = C.position(s);
    const readings = circleReadings(g);
    const saved = {
      f: s.f, n: s.n, t: s.t,
      a1: maybeNum(state.a1), a2: maybeNum(state.a2),
      major: maybeNum(state.major), minor: maybeNum(state.minor),
      circles: savedCircles(state.circles),
    };
    const matches = {
      a1: close(saved.a1, fromCore.a1),
      a2: close(saved.a2, fromCore.a2),
      major: close(saved.major, fromCore.major),
      minor: close(saved.minor, fromCore.minor),
      circles: saved.circles !== null && saved.circles.length === fromCore.circles.length &&
        saved.circles.every((c, i) => {
          const coreCircle = fromCore.circles[i];
          return !!coreCircle && close(c.s, coreCircle.s) && close(c.x, coreCircle.x) &&
            close(c.y, coreCircle.y) && close(c.r, coreCircle.r);
        }),
    };
    return {
      stateVersion,
      valid: true,
      saved,
      corePosition: fromCore,
      derived: {
        a1: round(g.r), a2: round(g.R),
        semimajorArithmeticMean: round(g.major),
        semiminorGeometricMean: round(g.minor),
        arithmeticMinusGeometric: round(g.major - g.minor),
        radiiSum: round(g.sum),
        focusSeparation: round(g.diff),
        allCentresOnEllipse: readings.every((c) => c.onEllipse),
        allCirclesTouchBoth: readings.every((c) => c.touchesSmallCircle && c.touchesBigCircle),
        neighbourTangencies: neighbourTangencies(g),
      },
      savedMatchesCore: { ...matches, all: Object.values(matches).every(Boolean) },
      note:
        "Track.state saved f, n, t and the derived radii, semiaxes and chain circles in board units with y upward from A. The core rebuilds all of them from f, n and t; f is stored to six decimals, so recomputed figures can differ from the saved ones in their last digits. " +
        (matches.a1 && matches.major && matches.circles
          ? "The saved picture agrees with the core."
          : "Some saved fields differ noticeably from the core's recomputation; see the flags above."),
    };
  } catch (err) {
    return {
      stateVersion,
      valid: false,
      saved: { ...state },
      error: err instanceof Error ? err.message : String(err),
      note:
        "The saved position needs f between 0 and 1, an integer n from 1 to 20, t from −15 to 15 and, if present, finite derived numbers and circles with s, x, y and r.",
    };
  }
}
