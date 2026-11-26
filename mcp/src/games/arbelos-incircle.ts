/*
 * run_game_logic actions and saved-position reader for Arbelos Incircle.
 *
 * An arbelos is the shape left inside the half-circle on AB after the two
 * half-circles on AC and CB are cut away. With r1 = AC/2, r2 = CB/2 and
 * R = r1 + r2, the circle tucked into the gap has radius
 *
 *     rho = r1*r2*(r1+r2)/(r1*r1 + r1*r2 + r2*r2)
 *
 * and centre P, 2*rho above the baseline. The lines from the arc centres to P
 * meet the arcs at the tangencies D (big), E (left) and F (right). If M and N
 * are the tops of the small arcs, the page claims AN, BM and CD all pass
 * through one point S, and that S lies on the incircle: S = AN ∩ BM and
 * |PS| = rho. All numbers below come from the real core
 * (arbelos-incircle/arbelos-incircle-core.js), copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["arbelos-incircle"].ArbelosIncircleCore;

type Point = { x: number; y: number };
type Geometry = NonNullable<ReturnType<ReturnType<typeof core>["geometry"]>>;

const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const close = (a: number, b: number, tol = 1e-6): boolean =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
/** C, S, D are collinear exactly when the cross product of CS and CD is 0. */
const collinear = (p: Point, q: Point, r: Point): boolean =>
  Math.abs((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)) <=
  1e-6 * Math.max(1, dist(p, q) * dist(p, r));

/** Tool args may use [x, y]; a saved position from the page uses {x, y}. */
function readPoint(value: unknown, name: string): Point {
  if (Array.isArray(value) && value.length === 2) {
    const x = Number(value[0]), y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const p = value as Json;
    return { x: num(p, "x"), y: num(p, "y") };
  }
  throw new Error(`"${name}" must be a point [x, y] or {x, y}`);
}

function maybePoint(value: unknown): Point | null {
  try {
    return readPoint(value, "point");
  } catch {
    return null;
  }
}

const pointMatches = (value: unknown, expected: Point): boolean => {
  const p = maybePoint(value);
  return p !== null && close(p.x, expected.x) && close(p.y, expected.y);
};

/**
 * Build a real core state for a split point C. Give `t` (a fraction of AB,
 * strictly between 0 and 1) or an absolute board `x`; with neither, the
 * applet's starting C is used. The core's own `move` clamps C to 10 units
 * from A and B, as PointIsEligible does in the applet.
 */
function fromArgs(args: Json) {
  const C = core();
  const seed = C.start();
  let x: number;
  if (args.t !== undefined && args.t !== null) {
    const t = num(args, "t");
    if (!(t > 0 && t < 1)) throw new Error('"t" must be strictly between 0 and 1');
    x = C.A.x + t * (C.B.x - C.A.x);
  } else if (args.x !== undefined && args.x !== null) {
    x = num(args, "x");
  } else {
    x = C.START_X;
  }
  const state = C.move(seed, { x, y: C.BASE_Y });
  const g = C.geometry(state);
  if (!g) throw new Error("the core could not draw an arbelos for this C");
  return { C, g };
}

/** Incircle radius, centre and the three tangency points, read off the core. */
function incircleReading(C: ReturnType<typeof core>, g: Geometry) {
  const r1: number = g.r1, r2: number = g.r2, R: number = g.R, rho: number = g.rho;
  const formula = r1 * r2 * (r1 + r2) / (r1 * r1 + r1 * r2 + r2 * r2);
  const centreHeight = C.BASE_Y - g.P.y;
  return {
    radii: { r1: round(r1), r2: round(r2), bigR: round(R) },
    incircle: {
      radius: round(rho),
      formulaRadius: round(formula),
      matchesFormula: close(rho, formula),
      centre: pt(g.P),
      centreHeightAboveBaseline: round(centreHeight),
      centreIsTwoRhoAboveBaseline: close(centreHeight, 2 * rho),
      maxRadiusAtMidpoint: round((C.B.x - C.A.x) / 6),
    },
    tangency: {
      D: pt(g.D), E: pt(g.E), F: pt(g.F),
      distancesFromCentreToArcCentres: {
        PO: round(C.distance(g.P, g.O)),
        PO1: round(C.distance(g.P, g.O1)),
        PO2: round(C.distance(g.P, g.O2)),
      },
      expectedDistances: {
        R_minus_rho: round(R - rho),
        r1_plus_rho: round(r1 + rho),
        r2_plus_rho: round(r2 + rho),
      },
      tangenciesAgree: close(C.distance(g.P, g.O), R - rho) &&
        close(C.distance(g.P, g.O1), r1 + rho) &&
        close(C.distance(g.P, g.O2), r2 + rho),
      D_on_big_arc: close(C.distance(g.O, g.D), R),
      E_on_left_arc: close(C.distance(g.O1, g.E), r1),
      F_on_right_arc: close(C.distance(g.O2, g.F), r2),
    },
  };
}

/** The concurrency S = AN ∩ BM ∩ CD and whether it sits on the incircle. */
function concurrencyReading(C: ReturnType<typeof core>, g: Geometry) {
  const sp = C.distance(g.P, g.S);
  return {
    M: pt(g.M),
    N: pt(g.N),
    S: pt(g.S),
    concurrency: {
      S_on_AN: collinear(g.A, g.N, g.S),
      S_on_BM: collinear(g.B, g.M, g.S),
      S_on_CD: collinear(g.C, g.S, g.D),
      allThreeMeet: collinear(g.A, g.N, g.S) && collinear(g.B, g.M, g.S) &&
        collinear(g.C, g.S, g.D),
    },
    onIncircle: {
      distancePS: round(sp),
      radius: round(g.rho),
      S_lies_on_incircle: close(sp, g.rho),
    },
  };
}

export function actions(): GameActions {
  return {
    incircle: {
      describe:
        "For a split point C of an arbelos, give its fraction t of AB (strictly between 0 and 1) or its absolute board x, and report the radii r1 = AC/2, r2 = CB/2, R = r1+r2, and the incircle radius rho = r1*r2*(r1+r2)/(r1*r1+r1*r2+r2*r2) checked against the formula, its centre 2*rho above the baseline, and the three tangency points D, E, F on the big, left and right arcs with their distances from the arc centres (R-rho, r1+rho, r2+rho). The largest circle comes at the midpoint, radius AB/6.",
      args: '{ "t": 0.74 }',
      run: (args) => {
        const { C, g } = fromArgs(args);
        const reading = incircleReading(C, g);
        return {
          C: pt(g.C),
          ...reading,
          note: `C at x = ${round(g.C.x)} gives r1 = ${reading.radii.r1}, r2 = ${reading.radii.r2} and R = ${reading.radii.bigR}. The incircle has radius ${reading.incircle.radius} = rho, its centre sits ${reading.incircle.centreHeightAboveBaseline} above the baseline (= 2*rho), and it touches the arcs at D, E and F. With C halfway along AB the radius would be ${reading.incircle.maxRadiusAtMidpoint} = AB/6.`,
        };
      },
    },
    concurrency: {
      describe:
        "For a split point C of an arbelos, give t (strictly between 0 and 1) or an absolute board x and check the page's claim. M and N are the highest points of the small arcs; S is where AN meets BM. Report S, test whether C, S and D are collinear (so CD passes through S too), and test whether S lies on the incircle by comparing |PS| with rho. The core returns S from the true intersection, so all three lines and the on-circle claim should hold at every position.",
      args: '{ "x": 282 }',
      run: (args) => {
        const { C, g } = fromArgs(args);
        const reading = concurrencyReading(C, g);
        return {
          C: pt(g.C),
          r1: round(g.r1), r2: round(g.r2),
          incircle: { centre: pt(g.P), radius: round(g.rho) },
          ...reading,
          note: `S = AN ∩ BM is at (${reading.S.x}, ${reading.S.y}). The line CD passes through it (${reading.concurrency.S_on_CD}), all three lines meet at one point (${reading.concurrency.allThreeMeet}), and |PS| = ${reading.onIncircle.distancePS} equals the incircle radius ${reading.onIncircle.radius}, so S lies on the circle (${reading.onIncircle.S_lies_on_incircle}).`,
        };
      },
    },
  };
}

/** The page's saved fields, plus the core's reading of the same position. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported Arbelos Incircle state version ${stateVersion}`);

  const A = readPoint(state.A, "A");
  const B = readPoint(state.B, "B");
  const Cc = readPoint(state.C, "C");
  const g = C.construct(A, B, Cc);
  if (!g) {
    return {
      ...state, stateVersion, valid: false,
      note: "The saved A, C, B do not make a usable arbelos: C must lie strictly between A and B.",
    };
  }

  const inc = incircleReading(C, g);
  const con = concurrencyReading(C, g);
  const savedNumber = (key: string): number | null => {
    const v = state[key];
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const matches = (key: string, expected: number): boolean | null => {
    const v = savedNumber(key);
    return v === null ? null : close(v, expected);
  };
  const savedCircle = state.circles;
  const savedIncircle = savedCircle && typeof savedCircle === "object"
    ? (savedCircle as Json).incircle
    : null;
  const savedIncircleRadius = savedIncircle && typeof savedIncircle === "object"
    ? (savedIncircle as Json).r
    : undefined;

  return {
    // The fields the page saved with Track.state, with the same names.
    ...state,
    stateVersion,
    valid: true,
    // What the core adds about this same drawing.
    core: {
      C: pt(g.C),
      radii: inc.radii,
      incircle: { ...inc.incircle, centre: pt(g.P) },
      tangency: inc.tangency,
      S: con.S,
      concurrency: con.concurrency,
      onIncircle: con.onIncircle,
    },
    savedMatchesCore: {
      r1: matches("r1", g.r1),
      r2: matches("r2", g.r2),
      R: matches("R", g.R),
      radius: matches("radius", g.rho),
      incircleRadius: savedIncircleRadius === undefined
        ? null
        : close(Number(savedIncircleRadius), g.rho),
      P: pointMatches(state.P, g.P),
      S: pointMatches(state.S, g.S),
      D: pointMatches(state.D, g.D),
      E: pointMatches(state.E, g.E),
      F: pointMatches(state.F, g.F),
    },
    note: `With C at x = ${round(g.C.x)}, the small radii are ${inc.radii.r1} and ${inc.radii.r2} and the incircle radius is ${inc.incircle.radius}, with centre ${pt(g.P).x}, ${pt(g.P).y} (2*rho above the baseline). It touches the arcs at D, E and F; AN, BM and CD meet at S = (${con.S.x}, ${con.S.y}), which is ${con.onIncircle.S_lies_on_incircle ? "on" : "not on"} the circle.`,
  };
}
