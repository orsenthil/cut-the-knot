/*
 * run_game_logic actions and saved-position reader for Circum Simson.
 *
 * The core is circum-simson/circum-simson-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 *
 * A, B, C and P are draggable points on one circle and Q = 2O − P is P's
 * antipode. Dropping perpendiculars from P and onto the three sides gives
 * three collinear feet whose line is P's Simson line; Q gives a second one.
 * The two lines meet at right angles at M, and as P slides round the circle M
 * traces the nine-point circle of ABC (the circle through the side midpoints,
 * centre (O+H)/2 and radius R/2). The core keeps the applet's own constructions:
 * GeoSDoub.NearestPoint for the feet, GetLine/InsideTest to pick two of them,
 * Intersect for M, and the average-radius circumcircle through three points.
 * Coordinates are board units of the illustration's 400 x 250 viewBox, y down.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circum-simson"].CircumSimsonCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number };
type State = ReturnType<Core["start"]>;
type Drawing = ReturnType<Core["compute"]>;

const EPS = 1e-6;
const TOL = 1e-6; // residuals are divided by R, so this is a fraction of R
const ANGLE_TOL = 1e-3; // degrees

/** Keep ordinary coordinates readable, but keep residuals' size and sign. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(3));
const pt = (p: Point | Circle): Point => ({ x: r6(p.x), y: r6(p.y) });
const circleOf = (c: Circle) => ({ center: pt(c), radius: r6(c.r) });
const cross = (a: Point, b: Point, c: Point): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const deg = (radians: number): number => (Number.isFinite(radians) ? (radians * 180) / Math.PI : NaN);

/** Accept both the page's saved {x, y} and the short [x, y] form of JSON args. */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return { ...fallback };
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or { x, y }`);
    const x = Number(raw[0]), y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${key}" must hold two finite numbers`);
    return { x, y };
  }
  if (typeof raw !== "object") throw new Error(`argument "${key}" must be [x, y] or { x, y }`);
  return { x: num(raw as Json, "x"), y: num(raw as Json, "y") };
}

/** A point on the circle at an angle in degrees, as the page's glider gives. */
function atAngle(circle: Circle, degrees: number): Point {
  const t = (degrees * Math.PI) / 180;
  return { x: circle.x + circle.r * Math.cos(t), y: circle.y + circle.r * Math.sin(t) };
}

/**
 * Build a core state from JSON args. As on the page, the circle is fixed by
 * A, B, C (or by a saved circle) and every named point is glided onto it. P may
 * be given as a point or as an angle in degrees; omit both for the opening
 * illustration. An illustration has no result to win.
 */
function build(C: Core, args: Json) {
  const seed = C.start();
  const A = readPoint(args, "A", seed.A as Point);
  const B = readPoint(args, "B", seed.B as Point);
  const Cc = readPoint(args, "C", seed.C as Point);
  if (C.dist(A, B) < EPS || C.dist(B, Cc) < EPS || C.dist(Cc, A) < EPS || Math.abs(cross(A, B, Cc)) < EPS) {
    throw new Error("A, B and C must be three distinct, non-collinear points on the 400 x 250 board");
  }
  let circle: Circle;
  if (args.circle && typeof args.circle === "object") {
    const o = args.circle as Json;
    circle = { x: num(o, "x"), y: num(o, "y"), r: num(o, "r") };
  } else {
    const found = C.circumcircle(A, B, Cc);
    circle = { x: found.x, y: found.y, r: found.r };
  }
  if (![circle.x, circle.y, circle.r].every(Number.isFinite) || circle.r < EPS) {
    throw new Error("A, B and C do not define a usable circumcircle");
  }
  const givenP = args.P === undefined || args.P === null ? null : readPoint(args, "P", seed.P as Point);
  const angle = args.angle === undefined || args.angle === null ? null : num(args, "angle");
  if (givenP && angle !== null) throw new Error("give either P or angle, not both");
  const P = givenP ? C.projectOnCircle(givenP, circle)
    : angle !== null ? atAngle(circle, angle)
    : C.projectOnCircle(seed.P as Point, circle);
  const s = {
    ...seed, A, B, C: Cc, P, circle, trace: [] as Point[],
  } as State;
  return { state: s, angle };
}

/** All the labelled points and measurements the illustration draws. */
function reading(C: Core, s: State) {
  const d = C.compute(s);
  const R = s.circle.r;
  const O = { x: s.circle.x, y: s.circle.y };
  const between = deg(C.simsonAngle(s));
  const feetAngle = deg(C.feetAngle(s));
  const errP = C.lineError(s, "P");
  const errQ = C.lineError(s, "Q");
  const nineErr = C.ninePointError(s);
  const expected = C.ninePointCenterAndRadius(s);
  const finite = [d.M, ...d.lineP, ...d.lineQ, d.Pa, d.Pb, d.Pc, d.Qa, d.Qb, d.Qc]
    .every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    P: pt(s.P),
    Q: pt(d.Q),
    circumcircle: circleOf(s.circle),
    antipode: {
      midpointOfPQ: pt(C.midpoint(s.P, d.Q)),
      center: pt(O),
      lengthPQ: r6(C.dist(s.P, d.Q)),
      twiceRadius: r6(2 * R),
      residual: sig(C.dist(s.P, d.Q) - 2 * R),
    },
    feet: {
      fromP: { onBC: pt(d.Pa), onCA: pt(d.Pb), onAB: pt(d.Pc) },
      fromQ: { onBC: pt(d.Qa), onCA: pt(d.Qb), onAB: pt(d.Qc) },
    },
    simsonLines: {
      fromP: { through: [pt(d.lineP[0]), pt(d.lineP[1])], collinearityErrorOverR: sig(errP) },
      fromQ: { through: [pt(d.lineQ[0]), pt(d.lineQ[1])], collinearityErrorOverR: sig(errQ) },
      intersectionM: pt(d.M),
      angleDegrees: r6(between),
      perpendicular: finite && Math.abs(between - 90) < ANGLE_TOL,
      feetChordsAngleDegrees: r6(feetAngle),
    },
    ninePointCircle: {
      throughSideMidpoints: circleOf(d.ninePoint),
      fromOrthocenter: { center: pt(expected.center), radius: r6(expected.r) },
      centerOffsetOverR: sig(C.dist(d.ninePoint, expected.center) / R),
      radiusDifferenceOverR: sig((d.ninePoint.r - expected.r) / R),
      MErrorOverR: sig(nineErr),
      MErrorUnits: sig(nineErr * R),
      MOnCircle: finite && nineErr < TOL,
    },
    midpointFeetErrorOverR: sig(C.midpointError(s)),
    menelausProductOfFeetOfP: r6(C.menelaus(s)),
    note: finite
      ? `Q is the point opposite P on the circumcircle. The feet of perpendiculars from P lie on one line and so do those from Q; the two lines cross at ${r6(between)} degrees at M, which is ${r6(nineErr * R)} units from the nine-point circle through A', B', C', the midpoints of the sides.`
      : "The two Simson lines could not be drawn here; move the points apart on the circle.",
  };
}

/** The page's claims, with the residuals behind each, plus a traced locus. */
function checks(C: Core, s: State, angles: number[]) {
  const d: Drawing = C.compute(s);
  const R = s.circle.r;
  const O = { x: s.circle.x, y: s.circle.y };
  const expected = C.ninePointCenterAndRadius(s);
  const between = deg(C.simsonAngle(s));
  const feetAngle = deg(C.feetAngle(s));
  const antipodal = C.dist(s.P, d.Q);
  const midpointResidual = C.dist(C.midpoint(s.P, d.Q), O);
  const centerResidual = C.dist(d.ninePoint, expected.center) / R;
  const radiusResidual = Math.abs(d.ninePoint.r - expected.r) / R;
  const errP = C.lineError(s, "P");
  const errQ = C.lineError(s, "Q");
  const nineErr = C.ninePointError(s);
  const midErr = C.midpointError(s);
  const men = C.menelaus(s);
  const lineChecks = {
    PAndQAntipodal: antipodal < 2 * R + TOL * R && antipodal > 2 * R - TOL * R && midpointResidual < TOL * R,
    feetOfPCollinear: Math.abs(errP) < TOL,
    feetOfQCollinear: Math.abs(errQ) < TOL,
    simsonLinesPerpendicular: Math.abs(between - 90) < ANGLE_TOL,
    feetChordsPerpendicular: Math.abs(feetAngle - 90) < ANGLE_TOL,
    MOnNinePointCircle: Number.isFinite(d.M.x) && nineErr < TOL,
    ninePointCircleIsThroughSideMidpoints: centerResidual < TOL && radiusResidual < TOL,
    midpointOfPaQaIsSideMidpoint: midErr < TOL,
    menelausProductIsMinusOne: Number.isFinite(men) && Math.abs(men + 1) < TOL,
  };
  // Drag P round the fixed circle: M should stay on the nine-point circle.
  const trace = angles.map((a) => {
    const moved = C.withPoint(s, "P", atAngle(s.circle, a));
    const pic = C.compute(moved);
    const err = C.ninePointError(moved);
    return {
      angleDegrees: a,
      P: pt(moved.P),
      Q: pt(pic.Q),
      M: pt(pic.M),
      lineAngleDegrees: r6(deg(C.simsonAngle(moved))),
      ninePointErrorOverR: sig(err),
    };
  });
  const finiteErrors = trace
    .map((t) => t.ninePointErrorOverR)
    .filter((v): v is number => v !== null);
  const traceMaxErrorOverR = finiteErrors.length ? Math.max(...finiteErrors) : NaN;
  return {
    checks: lineChecks,
    allHold: Object.values(lineChecks).every(Boolean),
    residuals: {
      PQ_minus_2R: sig(antipodal - 2 * R),
      midpointOfPQ_minus_O: sig(midpointResidual / R),
      feetP_signedAreaOverR: sig(errP),
      feetQ_signedAreaOverR: sig(errQ),
      lineAngle_minus_90: sig(between - 90),
      feetChords_minus_90: sig(feetAngle - 90),
      M_ninePointErrorOverR: sig(nineErr),
      ninePoint_centerOffsetOverR: sig(centerResidual),
      ninePoint_radiusOverR_minus_half: sig(radiusResidual),
      midpointFeet_maxErrorOverR: sig(midErr),
      menelaus_minus_minusOne: sig(men + 1),
    },
    tracedNinePointCircle: {
      sampleCount: trace.length,
      finiteCount: finiteErrors.length,
      maxErrorOverR: sig(traceMaxErrorOverR),
      staysOnCircle: finiteErrors.length === trace.length && finiteErrors.length > 0 && traceMaxErrorOverR < TOL,
      samples: trace,
    },
    note:
      "The feet from each of two opposite points on the circumcircle are collinear; the Simson lines are perpendicular and meet at M on the nine-point circle, centre (O+H)/2 and radius R/2. The auxiliary midpoints of PaQa, PbQb, PcQc are the side midpoints, and the Menelaus product of the feet of P is -1. The sampled trace moves P round the circle and measures where M lands each time.",
  };
}

function readAngles(args: Json): number[] {
  const raw = args.angles;
  if (raw === undefined || raw === null) return [0, 45, 90, 135, 180, 225, 270, 315];
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 72) {
    throw new Error('argument "angles" must be an array of 1 to 72 angles in degrees');
  }
  const angles = raw.map((v, i) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`angles[${i}] is not a finite angle in degrees`);
    return n;
  });
  return angles;
}

export function actions(): GameActions {
  return {
    simson_lines: {
      describe:
        "For triangle A, B, C and a point P on the circumcircle (each [x, y] or { x, y } in the illustration's 400 x 250 board, y down), report Q = 2O − P, the six perpendicular feet, both Simson lines with their angle and crossing M, and the nine-point circle through the side midpoints. Give P as a point or as an 'angle' in degrees, not both; omit corners to use the opening illustration. Refuses a degenerate triangle.",
      args: '{ "A": [200.577, 42.002], "B": [145.748, 187.815], "C": [281.346, 108.51], "P": [241.5, 196.88] }',
      run: (args) => {
        const C = core();
        const { state } = build(C, args);
        return reading(C, state);
      },
    },
    check_claims: {
      describe:
        "Check the illustration's claims for triangle A, B, C and P (or an angle in degrees): P and Q are antipodal, the feet of perpendiculars from each are collinear, the two Simson lines are perpendicular, they meet on the nine-point circle of ABC, the midpoints of PaQa, PbQb, PcQc are the side midpoints, and the Menelaus product is -1. Optional 'angles' (1 to 72 degrees) traces M as P moves round the circle and reports the largest error. Returns a boolean for each claim and every residual.",
      args: '{ "A": [200.577, 42.002], "B": [145.748, 187.815], "C": [281.346, 108.51], "P": [241.5, 196.88], "angles": [0, 45, 90, 135, 180, 225, 270, 315] }',
      run: (args) => {
        const C = core();
        const { state } = build(C, args);
        return checks(C, state, readAngles(args));
      },
    },
  };
}

/** The fields the page saved with Track.state, read again through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const seed = C.start();
  const read = (key: string): Point => pt(readPoint(state, key, seed[key as "A" | "B" | "C" | "P"] as Point));
  const savedCircle = state.circle && typeof state.circle === "object"
    ? circleOf(state.circle as Circle) : null;
  // An illustration has no win or loss; result() ignores its argument.
  const result: (s: Json) => unknown = C.result;
  const saved = {
    stateVersion,
    A: read("A"), B: read("B"), C: read("C"), P: read("P"),
    circle: savedCircle,
    showNames: state.showNames === true,
    showPerps: state.showPerps === true,
    showLines: state.showLines === true,
    showMidpoints: state.showMidpoints === true,
    showAngles: state.showAngles === true,
    showCircle: state.showCircle === true,
    traceCount: Array.isArray(state.trace) ? state.trace.length : 0,
    result: result(state),
  };
  try {
    const { state: here } = build(C, state);
    return {
      ...saved,
      reading: reading(C, here),
      check_claims: checks(C, here, [0, 45, 90, 135, 180, 225, 270, 315]),
      note:
        "Track.state saved the four draggable points, the fixed circle, six display flags and a short trace of M. The core rebuilds Q, the six feet, the two Simson lines, their crossing M and the nine-point circle from that position; the flags and the recorded trail do not change the geometry.",
    };
  } catch (e) {
    return {
      ...saved,
      reading: null,
      note: `The saved position cannot be measured: ${(e as Error).message}`,
    };
  }
}
