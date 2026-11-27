/*
 * run_game_logic actions and saved-position reader for Cross Circle.
 *
 * The core is cross-circle/cross-circle-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 *
 * Drop perpendiculars from a point P to the three side lines of triangle ABC.
 * Their feet determine the pedal circle. In general it meets each side line a
 * second time; the perpendiculars raised there meet at one point, S = 2O − P,
 * the half-turn image of P about the circle's centre O. Orthogonal projection
 * onto a line is affine, so the projection of S onto a side is the reflection
 * of the projection of P in the projection of O — the far end of the chord the
 * circle cuts on that side. If P lies on the circumcircle of ABC the three feet
 * are collinear (a Simson line) and there is no pedal circle at all.
 *
 * Coordinates are board units of the illustration's 400 x 300 view, y down.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cross-circle"].CrossCircleCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number };
type State = ReturnType<Core["start"]>;
type Drawing = ReturnType<Core["compute"]>;

const EPS = 1e-9;
const TOL = 1e-6; // residuals are distances in board units (pixels)
const DEFAULT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Keep ordinary coordinates readable, but keep residuals' size and sign. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(3));
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const circleOf = (c: Circle) => ({ center: pt(c), radius: r6(c.r) });
const cross = (a: Point, b: Point, c: Point): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Accept both the page's saved { x, y } and the short [x, y] form of JSON args. */
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

/** The applet's rule for P: on the circumcircle of ABC, shrunk by 20 units. */
function atAngle(C: Core, A: Point, B: Point, Cc: Point, degrees: number): Point {
  const tri = C.circumcircle(A, B, Cc);
  if (![tri.x, tri.y, tri.r].every(Number.isFinite) || tri.r < EPS) {
    throw new Error("A, B and C do not define a usable circumcircle");
  }
  const gap = Math.max(1, tri.r - 20);
  const t = (degrees * Math.PI) / 180;
  return { x: tri.x + gap * Math.cos(t), y: tri.y + gap * Math.sin(t) };
}

/** Build the core state from JSON args; P may be a point or an angle in degrees. */
function build(C: Core, args: Json): State {
  const seed = C.start();
  const A = readPoint(args, "A", seed.A as Point);
  const B = readPoint(args, "B", seed.B as Point);
  const Cc = readPoint(args, "C", seed.C as Point);
  if (C.dist(A, B) < EPS || C.dist(B, Cc) < EPS || C.dist(Cc, A) < EPS || Math.abs(cross(A, B, Cc)) < EPS) {
    throw new Error("A, B and C must be three distinct, non-collinear points on the 400 x 300 board");
  }
  const givenP = args.P === undefined || args.P === null ? null : readPoint(args, "P", seed.P as Point);
  const angle = args.angle === undefined || args.angle === null ? null : num(args, "angle");
  if (givenP && angle !== null) throw new Error("give either P or angle, not both");
  const defaultDegrees = (C.START_ANGLE * 180) / Math.PI;
  const P = givenP ? givenP : atAngle(C, A, B, Cc, angle === null ? defaultDegrees : angle);
  return {
    ...seed, A, B, C: Cc, P,
    hint: args.hint === undefined ? false : Boolean(args.hint),
  } as State;
}

function readAngles(args: Json): number[] {
  const raw = args.angles;
  if (raw === undefined || raw === null) return [...DEFAULT_ANGLES];
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 72) {
    throw new Error('argument "angles" must be an array of 1 to 72 angles in degrees');
  }
  return raw.map((v, i) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`angles[${i}] must be a finite angle in degrees`);
    return n;
  });
}

/** Everything the page draws, plus the two residuals behind its claim. */
function reading(C: Core, s: State) {
  const d: Drawing = C.compute(s);
  const ok = C.drawn(d);
  const concErr = C.concurrenceError(d);
  const reflErr = C.reflectionError(d);
  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    triangleCircumcircle: circleOf(C.circumcircle(s.A, s.B, s.C)),
    P: pt(s.P),
    hint: s.hint === true,
    feet: { onBC: pt(d.feet[0]), onCA: pt(d.feet[1]), onAB: pt(d.feet[2]) },
    pedalCircle: ok ? circleOf(d.circle) : null,
    center: pt(d.circle),
    chordMidpoints: { onBC: pt(d.projections[0]), onCA: pt(d.projections[1]), onAB: pt(d.projections[2]) },
    secondCrossings: { onBC: pt(d.others[0]), onCA: pt(d.others[1]), onAB: pt(d.others[2]) },
    newPerpendicularEnds: { onBC: pt(d.ends[0]), onCA: pt(d.ends[1]), onAB: pt(d.ends[2]) },
    concurrence: {
      halfTurnImageOfP: pt(d.reflected), // S = 2·O − P, the point the page marks
      firstTwoLinesMeet: pt(d.meet),     // intersection the core checks
      concurrenceError: sig(concErr),    // largest distance from that meet to the three lines
      reflectionError: sig(reflErr),     // distance from that meet to S
      concurrent: ok && concErr < TOL,
      meetsAtHalfTurnImage: ok && reflErr < TOL,
    },
    drawn: ok,
    note: ok
      ? `The three feet lie on a circle of radius ${r6(d.circle.r)} centred at O; the perpendiculars raised at its second crossings on the sides all meet at S = 2O − P. Both errors are in board units. The hint adds O, the chord midpoints and the line from P to S.`
      : "The three feet are collinear (P is on the circumcircle of ABC), so there is no pedal circle, no second crossings and no concurrence here; move P off that circle.",
  };
}

/** The page's claims, with residuals and an optional trace of P round its circle. */
function checks(C: Core, s: State, angles: number[]) {
  const d: Drawing = C.compute(s);
  const ok = C.drawn(d);
  const concErr = C.concurrenceError(d);
  const reflErr = C.reflectionError(d);
  const claims = {
    hasPedalCircle: ok,
    threeNewPerpendicularsConcurrent: ok && concErr < TOL,
    meetingPointIsHalfTurnImageOfP: ok && reflErr < TOL,
  };
  const samples = angles.map((a) => {
    const moved = C.withPoint(s, "P", atAngle(C, s.A, s.B, s.C, a)) as State;
    const pic = C.compute(moved);
    return {
      angleDegrees: a,
      P: pt(moved.P),
      S: pt(pic.reflected),
      drawn: C.drawn(pic),
      concurrenceError: sig(C.concurrenceError(pic)),
      reflectionError: sig(C.reflectionError(pic)),
    };
  });
  const finite = (v: number | null): v is number => v !== null;
  const worst = (key: "concurrenceError" | "reflectionError"): number | null => {
    const vals = samples.map((x) => x[key]).filter(finite);
    return vals.length ? Math.max(...vals) : null;
  };
  const maxConc = worst("concurrenceError");
  const maxRefl = worst("reflectionError");
  return {
    claims,
    allHold: Object.values(claims).every(Boolean),
    residuals: { concurrenceError: sig(concErr), reflectionError: sig(reflErr) },
    trace: {
      rule: "P moves on the triangle's circumcircle shrunk by 20 units, the applet's own placement",
      sampleCount: samples.length,
      drawnCount: samples.filter((x) => x.drawn).length,
      maxConcurrenceError: sig(maxConc),
      maxReflectionError: sig(maxRefl),
      allConcurrent: samples.every((x) => x.drawn && x.concurrenceError !== null && x.concurrenceError < TOL),
      allMeetAtHalfTurnImage: samples.every((x) => x.drawn && x.reflectionError !== null && x.reflectionError < TOL),
      samples,
    },
    note:
      "Dropping perpendiculars from P to the three side lines gives three feet on one circle. That circle cuts each side again, and the perpendiculars raised at those three points meet at S = 2O − P. Tracing P round the applet's circle keeps both errors at zero, up to rounding; P exactly on the triangle's circumcircle makes the feet collinear and removes the circle.",
  };
}

export function actions(): GameActions {
  return {
    pedal_circle: {
      describe:
        "For triangle A, B, C and a point P (each [x, y] or { x, y } in the illustration's 400 x 300 board, y down), report the three perpendicular feet from P, the pedal circle through them, the second crossing on every side line, the new perpendiculars and the point S = 2O − P where they meet, with the concurrence and reflection errors. Give P as a point or as an 'angle' in degrees on the applet's circle; omit both for the opening placement. Refuses a degenerate triangle; if P lies on the circumcircle the feet are collinear and there is no circle.",
      args: '{ "A": [200.81, 75.03], "B": [150.98, 206.76], "C": [273.50, 135.10], "P": [161.11, 188.89] }',
      run: (args) => {
        const C = core();
        return reading(C, build(C, args));
      },
    },
    check_concurrence: {
      describe:
        "Check the Cross Circle claim for triangle A, B, C and P (as a point or an angle in degrees): the three new perpendiculars are concurrent and meet at the half-turn image of P about the pedal circle's centre, with each residual in board units. Optional 'angles' (1 to 72 degrees) traces P around the applet's circle and reports the largest errors along the way. Accepts the same point formats as pedal_circle.",
      args: '{ "A": [200.81, 75.03], "B": [150.98, 206.76], "C": [273.50, 135.10], "P": [161.11, 188.89], "angles": [0, 45, 90, 135, 180, 225, 270, 315] }',
      run: (args) => {
        const C = core();
        return checks(C, build(C, args), readAngles(args));
      },
    },
  };
}

/** The fields the page saved with Track.state, read again through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const seed = C.start();
  const get = (key: "A" | "B" | "C" | "P"): Point => readPoint(state, key, seed[key] as Point);
  const A = get("A"), B = get("B"), Cc = get("C"), P = get("P");
  const hint = state.hint === true;
  const saved = { stateVersion, A: pt(A), B: pt(B), C: pt(Cc), P: pt(P), hint };
  try {
    if (C.dist(A, B) < EPS || C.dist(B, Cc) < EPS || C.dist(Cc, A) < EPS || Math.abs(cross(A, B, Cc)) < EPS) {
      throw new Error("the saved triangle is degenerate");
    }
    const s = { ...seed, A, B, C: Cc, P, hint } as State;
    const d: Drawing = C.compute(s);
    const ok = C.drawn(d);
    return {
      ...saved,
      drawn: ok,
      pedalCircle: ok ? circleOf(d.circle) : null,
      secondCrossings: { onBC: pt(d.others[0]), onCA: pt(d.others[1]), onAB: pt(d.others[2]) },
      halfTurnImageOfP: pt(d.reflected),
      concurrenceError: sig(C.concurrenceError(d)),
      reflectionError: sig(C.reflectionError(d)),
      concurrent: ok && C.concurrenceError(d) < TOL,
      reading: reading(C, s),
      note:
        "Track.state saved the four draggable points and the hint flag. The core rebuilds the feet, the pedal circle, its second crossings on the sides and the concurrence S = 2O − P from that position; the hint only adds guide lines to the drawing.",
    };
  } catch (e) {
    return {
      ...saved,
      drawn: false,
      reading: null,
      note: `The saved position cannot be measured: ${(e as Error).message}`,
    };
  }
}
