/*
 * run_game_logic actions and saved-position reader for Fuss.
 *
 * An outer circle O(R) and an inner circle I(r), whose centres are d apart,
 * can carry a bicentric quadrilateral: four tangents from a corner A on the
 * outer circle touch the inner one and meet the outer circle again, closing
 * after four steps. Fuss' relation
 *
 *     1/(R - d)^2 + 1/(R + d)^2 = 1/r^2
 *
 * fixes r for the pair of circles, and Poncelet's porism says the path closes
 * wherever A starts. The crossing P of the contact diagonals KM and LN stays
 * on the line of centres, 2dR^2/(R^2+d^2) from O.
 *
 * Every number below is measured by the real core, fuss/fuss-core.js, copied
 * into src/generated/cores/ at build time. Coordinates are board units of the
 * page's viewBox with y down; angle is in radians unless named angleDegrees.
 * This is a demo: it records exploration, not a win or a loss. See _shared.ts
 * for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type CircleData = { c: Pt; r: number };
type State = {
  center: Pt;
  radius: number;
  d: number;
  angle: number;
  names: boolean;
  diagonals: boolean;
  explored: boolean;
};
type Geometry = {
  outer: CircleData;
  inner: CircleData;
  vertices: Pt[];
  touch: Pt[];
  tangents: Pt[];
  P: Pt;
  closing: Pt;
  closureError: number;
  formulaSum: number;
  inverseRSquared: number;
};
type Core = {
  CENTER: Pt;
  DEFAULT_RADIUS: number;
  DEFAULT_DISTANCE: number;
  DEFAULT_ANGLE: number;
  maxDistance(radius: number): number;
  inradius(radius: number, d: number): number;
  onCircle(state: State, p: Pt): Pt;
  start(options?: {
    radius?: number; d?: number; angle?: number;
    names?: boolean; diagonals?: boolean;
  }): State;
  move(state: State, m: Json): State | null;
  setDistance(state: State, value: number): State | null;
  setOption(state: State, name: string, value: boolean): State | null;
  reset(state: State): State | null;
  geometry(state: State): Geometry | null;
  describe(state: State): string;
  result(state: State): string | null;
  dist(a: Pt, b: Pt): number;
};

const core = (): Core => cores["fuss"].FussCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const r6 = (v: number): number | null => (Number.isFinite(v) ? Number(v.toFixed(6)) : null);
const sig = (v: number): number | null =>
  Number.isFinite(v) ? (v !== 0 && Math.abs(v) < 1e-4 ? Number(v.toExponential(2)) : r6(v)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x)!, y: r6(p.y)! } : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

const FUSS_NOTE =
  "Fuss' relation 1/(R−d)² + 1/(R+d)² = 1/r² fixes the inner radius of a bicentric quadrilateral: " +
  "with outer radius R and centre gap d the core solves r² = (R²−d²)²/(2(R²+d²)).";
const PONCELET_NOTE =
  "Four tangents from corner A to the inner circle meet the outer circle again and return to A " +
  "(Poncelet's porism for quadrilaterals); the crossing P of the contact diagonals KM and LN " +
  "stays on the line of centres, 2dR²/(R²+d²) from O.";

function asArgs(args: unknown): Json {
  if (args === undefined || args === null) return {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with radius, d, angle and optional names/diagonals");
  }
  return args as Json;
}

function numberArg(args: Json, key: string, fallback: number): number {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`argument "${key}" must be a finite number, got ${JSON.stringify(raw)}`);
  }
  return n;
}

function boolArg(args: Json, key: string, fallback: boolean): boolean {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") {
    throw new Error(`argument "${key}" must be a boolean, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

/** angle is radians; angleDegrees, when given, takes precedence. */
function angleArg(args: Json, fallback: number): number {
  if (args.angleDegrees !== undefined && args.angleDegrees !== null) {
    return (numberArg(args, "angleDegrees", NaN) * Math.PI) / 180;
  }
  return numberArg(args, "angle", fallback);
}

/** The applet's opening state with the caller's radius, gap, angle and options. */
function buildState(C: Core, args: Json): State {
  const seed = C.start();
  const radius = numberArg(args, "radius", seed.radius);
  if (!(radius > 0) || radius > 1e4) {
    throw new Error(`argument "radius" must be positive and at most 10000, got ${radius}`);
  }
  const d = numberArg(args, "d", seed.d);
  if (d < 0) throw new Error(`argument "d" must be non-negative, got ${d}`);
  return C.start({
    radius,
    d, // the core clamps d to floor(0.8R); the returned state reports the value used
    angle: angleArg(args, seed.angle),
    names: boolArg(args, "names", seed.names),
    diagonals: boolArg(args, "diagonals", seed.diagonals),
  });
}

function requireGeometry(C: Core, s: State): Geometry {
  const g = C.geometry(s);
  if (!g) {
    throw new Error(
      `the core cannot draw four tangents for radius ${s.radius} and centre gap ${s.d}; ` +
      "choose a gap smaller than the radius",
    );
  }
  return g;
}

/** Everything the core measures for one picture, in tutor-friendly units. */
function reading(C: Core, s: State, g: Geometry) {
  const R = s.radius, d = s.d;
  const r2Formula = ((R * R - d * d) ** 2) / (2 * (R * R + d * d));
  const predictedP = (2 * d * R * R) / (R * R + d * d);
  const pDistance = C.dist(s.center, g.P);
  return {
    circles: {
      outer: { center: pt(s.center), radius: r6(g.outer.r) },
      inner: { center: pt(g.inner.c), radius: r6(g.inner.r) },
    },
    fuss: {
      R: r6(R), d: r6(d), r: r6(g.inner.r),
      leftSide: r6(g.formulaSum),
      rightSide: r6(g.inverseRSquared),
      residual: sig(g.formulaSum - g.inverseRSquared),
      holds: near(g.formulaSum, g.inverseRSquared, 1e-9 * Math.max(1, g.inverseRSquared)),
      rSquared: r6(g.inner.r * g.inner.r),
      rSquaredFromFormula: r6(r2Formula),
      rSquaredResidual: sig(g.inner.r * g.inner.r - r2Formula),
    },
    bicentric: {
      A: pt(g.vertices[0]), B: pt(g.vertices[1]),
      C: pt(g.vertices[2]), D: pt(g.vertices[3]),
      contact: {
        K: pt(g.touch[0]), L: pt(g.touch[1]),
        M: pt(g.touch[2]), N: pt(g.touch[3]),
      },
      tangentPoints: g.tangents.map(pt),
    },
    poncelet: {
      closingCorner: pt(g.closing),
      closureError: sig(g.closureError),
      closes: g.closureError < 1e-6,
      crossingP: pt(g.P),
      distanceFromO: r6(pDistance),
      predictedDistance: r6(predictedP),
      crossingResidual: sig(pDistance - predictedP),
      onCentreLine: near(g.P.y, s.center.y, 1e-6),
    },
    status: C.describe(s),
  };
}

export function actions(): GameActions {
  return {
    fuss_relation: {
      describe:
        "For an outer circle of radius R (default 50) whose centre is d board units from the inner circle's centre (default 40, clamped by the core to floor(0.8R)), report the inner radius r the real core solves from Fuss' relation 1/(R−d)²+1/(R+d)²=1/r², both sides of the equation and their residual. It also gives the four tangent vertices, the contact points K,L,M,N, the crossing P and the gap left after four tangents return to corner A; set A with angle (radians) or angleDegrees.",
      args: '{"radius":50,"d":40,"angle":0.6265439042012243}',
      run: (args) => {
        const C = core();
        const s = buildState(C, asArgs(args));
        const g = requireGeometry(C, s);
        const r = reading(C, s, g);
        return {
          ...r,
          note:
            `${FUSS_NOTE} Here the core finds r = ${r.fuss.r} board units: ` +
            `1/(R−d)² + 1/(R+d)² = ${r.fuss.leftSide} and 1/r² = ${r.fuss.rightSide}, ` +
            `${r.fuss.holds ? "agreeing" : "differing"} by ${r.fuss.residual}. ` +
            `${PONCELET_NOTE} The four sides ${r.poncelet.closes ? "close" : "do not close"} back on A ` +
            `(gap ${r.poncelet.closureError}). This is a demo: there is no win or loss.`,
        };
      },
    },

    poncelet_closure: {
      describe:
        "Sweep the first corner A around the outer circle at several angles (anglesDegrees, or angles in radians) for a fixed R (default 50) and d (default 40), and confirm with the real core that four tangents always return to A while the inner radius r and the contact-diagonal crossing P stay fixed. Each sample reports its closure gap, r, P and its distance from O against the predicted 2dR²/(R²+d²).",
      args: '{"radius":50,"d":40,"anglesDegrees":[0,45,90,135,180,225,270,315]}',
      run: (args) => {
        const C = core();
        const a = asArgs(args);
        const base = buildState(C, a);
        const raw = a.anglesDegrees !== undefined && a.anglesDegrees !== null
          ? a.anglesDegrees : a.angles;
        const degrees = a.anglesDegrees !== undefined && a.anglesDegrees !== null;
        let angles: number[];
        if (raw === undefined || raw === null) {
          angles = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
        } else {
          if (!Array.isArray(raw) || raw.length < 1 || raw.length > 36) {
            throw new Error(`argument "${degrees ? "anglesDegrees" : "angles"}" must be an array of 1 to 36 numbers`);
          }
          angles = raw.map((v, i) => {
            const n = Number(v);
            if (!Number.isFinite(n)) {
              throw new Error(`${degrees ? "anglesDegrees" : "angles"}[${i}] is not a finite number`);
            }
            return degrees ? (n * Math.PI) / 180 : n;
          });
        }

        const predictedP = (2 * base.d * base.radius * base.radius) /
          (base.radius * base.radius + base.d * base.d);
        let r0: number | null = null;
        let p0: Pt | null = null;
        let rSpread = 0, pSpread = 0, maxClosure = 0, maxRelation = 0, maxPResidual = 0;
        let allClose = true, allOnLine = true;
        const samples: Json[] = [];
        for (const angle of angles) {
          const s = C.start({
            radius: base.radius, d: base.d, angle,
            names: base.names, diagonals: base.diagonals,
          });
          const g = requireGeometry(C, s);
          const pDistance = C.dist(s.center, g.P);
          if (r0 === null || p0 === null) {
            r0 = g.inner.r;
            p0 = { ...g.P };
          } else {
            rSpread = Math.max(rSpread, Math.abs(g.inner.r - r0));
            pSpread = Math.max(pSpread, C.dist(g.P, p0));
          }
          maxClosure = Math.max(maxClosure, g.closureError);
          maxRelation = Math.max(maxRelation, Math.abs(g.formulaSum - g.inverseRSquared));
          maxPResidual = Math.max(maxPResidual, Math.abs(pDistance - predictedP));
          if (!(g.closureError < 1e-6)) allClose = false;
          if (!near(g.P.y, s.center.y, 1e-6)) allOnLine = false;
          samples.push({
            angleDegrees: r6((angle * 180) / Math.PI),
            angleRadians: r6(angle),
            A: pt(g.vertices[0]),
            innerRadius: r6(g.inner.r),
            closureError: sig(g.closureError),
            closes: g.closureError < 1e-6,
            P: pt(g.P),
            distanceFromO: r6(pDistance),
            relationResidual: sig(g.formulaSum - g.inverseRSquared),
          });
        }
        return {
          radius: r6(base.radius), d: r6(base.d),
          maxDistance: C.maxDistance(base.radius),
          samples,
          summary: {
            positions: samples.length,
            innerRadius: r6(r0!),
            innerRadiusSpread: sig(rSpread),
            innerRadiusFixed: rSpread < 1e-9,
            allClose,
            largestClosureError: sig(maxClosure),
            crossingP: pt(p0),
            crossingSpread: sig(pSpread),
            crossingFixed: pSpread < 1e-6,
            crossingOnCentreLine: allOnLine,
            predictedDistanceFromO: r6(predictedP),
            largestCrossingResidual: sig(maxPResidual),
            largestRelationResidual: sig(maxRelation),
          },
          note:
            `With R = ${base.radius} and d = ${base.d}, all ${samples.length} positions of A ` +
            `${allClose ? "close back on A" : "fail to close"}, and r stays ${r6(r0!)} ` +
            `(spread ${sig(rSpread)}). P stays ${sig(pSpread)} board units from its first place, ` +
            `${r6(predictedP)} from O against the predicted 2dR²/(R²+d²). ` +
            `${FUSS_NOTE} ${PONCELET_NOTE} This is a demo: there is no win or loss.`,
        };
      },
    },
  };
}

/** A finite saved number, or the applet's opening value when absent or broken. */
function finiteOr(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** A saved board point as { x, y } or [x, y], with a safe fallback. */
function savedPoint(raw: unknown, fallback: Pt): Pt {
  if (Array.isArray(raw) && raw.length === 2) {
    const x = Number(raw[0]), y = Number(raw[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  } else if (raw && typeof raw === "object") {
    const o = raw as Json;
    const x = Number(o.x), y = Number(o.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  return { ...fallback };
}

/** Track.state saved the core's own state; rebuild it with the same core. */
function savedState(C: Core, state: Json): State {
  const seed = C.start();
  const radius = finiteOr(state.radius, seed.radius);
  const s = C.start({
    radius: radius > 0 ? radius : seed.radius,
    d: finiteOr(state.d, seed.d),
    angle: finiteOr(state.angle, seed.angle),
    names: typeof state.names === "boolean" ? state.names : seed.names,
    diagonals: typeof state.diagonals === "boolean" ? state.diagonals : seed.diagonals,
  });
  return { ...s, center: savedPoint(state.center, seed.center), explored: state.explored === true };
}

/** Echo the saved fields, plus a fresh core reading of that same figure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Fuss state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Fuss position must be an object");
  }
  const C = core();
  const s = savedState(C, state);
  const g = C.geometry(s);
  const saved = {
    center: pt(s.center),
    radius: r6(s.radius),
    d: r6(s.d),
    angle: r6(s.angle),
    angleDegrees: r6((s.angle * 180) / Math.PI),
    names: s.names,
    diagonals: s.diagonals,
    explored: s.explored,
  };
  const common = { ...state, stateVersion, saved, result: C.result(s) };
  if (!g) {
    return {
      ...common,
      valid: false,
      reason: `the core cannot draw four tangents for radius ${s.radius} and centre gap ${s.d}`,
      note:
        "Track.state saved the core's own state: the two circles' centres and radii through " +
        "center, radius and d, the first corner's angle, the two display boxes and whether " +
        "the picture was explored. " + FUSS_NOTE + " This is a demo with no win or loss.",
    };
  }
  const r = reading(C, s, g);
  return {
    ...common,
    valid: true,
    innerRadius: r6(g.inner.r),
    fussRelationHolds: r.fuss.holds,
    closureError: r.poncelet.closureError,
    ponceletCloses: r.poncelet.closes,
    crossingP: r.poncelet.crossingP,
    derived: r,
    note:
      "Track.state saved the core's own state: center, radius, d (clamped by the core to " +
      `floor(0.8R) = ${C.maxDistance(s.radius)}), angle (the first corner A), names, diagonals ` +
      "and explored. The real core rebuilds the bicentric quadrilateral from those fields: " +
      `${FUSS_NOTE} ${PONCELET_NOTE} Here r = ${r.fuss.r} and the four sides ` +
      `${r.poncelet.closes ? "close back on A" : "do not close"} (gap ${r.poncelet.closureError}); ` +
      `P is ${r.poncelet.distanceFromO} from O against the predicted ${r.poncelet.predictedDistance}. ` +
      "This is a demo, so the tracker records exploration rather than a win or a loss.",
  };
}
