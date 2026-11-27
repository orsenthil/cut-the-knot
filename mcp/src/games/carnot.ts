/*
 * run_game_logic actions and saved-position reader for Carnot.
 *
 * The real core is carnot/carnot-core.js, copied into src/generated/cores/ at
 * build time. Four points ride on one circle: the triangle A, B, C and P.
 * Through P three lines are drawn, each at the same angle to one side; their
 * feet A' on BC, B' on CA and C' on AB always lie on one line. At 90 degrees
 * that line is the Simson (Wallace) line. The core constructs each foot by
 * rotating a side about one end and intersecting it with the parallel through
 * P (the applet's FindFoot), then tests collinearity with the signed area of
 * A'B'C' and checks Menelaus's directed product. See _shared.ts for the module
 * shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["carnot"].CarnotCore;
type C = ReturnType<typeof core>;
type State = ReturnType<C["start"]>;
type Point = { x: number; y: number };

const EPS = 1e-9;
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(3)) : null);
const pt = (p: Point) => ({ x: r6(p.x), y: r6(p.y) });
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a: Point, b: Point, c: Point): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const distToLine = (p: Point, x: Point, y: Point): number => {
  const d = dist(x, y);
  return d < EPS ? NaN : Math.abs(cross(x, y, p)) / d;
};
/** The smaller angle between the lines PF and XY, in degrees (0…90). */
const acuteAngle = (p: Point, f: Point, x: Point, y: Point): number => {
  const ux = f.x - p.x, uy = f.y - p.y, vx = y.x - x.x, vy = y.y - x.y;
  const den = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (!(den > EPS)) return NaN;
  const a = (Math.atan2(Math.abs(ux * vy - uy * vx), ux * vx + uy * vy) * 180) / Math.PI;
  return a > 90 ? 180 - a : a;
};

/** Accept the page's saved {x, y} and the short [x, y] form of JSON args. */
function readPoint(v: unknown, label: string): Point {
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    return { x: num({ x: v[0] }, "x"), y: num({ y: v[1] }, "y") };
  }
  if (v && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`${label} must be [x, y] or { x, y }`);
}

/**
 * The core's start() has no point options, so build a position from its seed,
 * replacing all four points and the circumcircle. As on the page, P is glided
 * onto that circle and the slider angle is clamped and rounded by withAngle.
 */
function build(C: C, args: Json) {
  const seed = C.start({});
  const A = args.A === undefined || args.A === null ? seed.A : readPoint(args.A, "A");
  const B = args.B === undefined || args.B === null ? seed.B : readPoint(args.B, "B");
  const Cc = args.C === undefined || args.C === null ? seed.C : readPoint(args.C, "C");
  if (dist(A, B) < EPS || dist(B, Cc) < EPS || dist(Cc, A) < EPS || Math.abs(cross(A, B, Cc)) < EPS) {
    throw new Error("A, B and C must be three distinct, non-collinear points");
  }
  const circle = C.circumcircle(A, B, Cc);
  if (![circle.x, circle.y, circle.r].every(Number.isFinite) || circle.r < EPS) {
    throw new Error("A, B and C do not define a circumcircle");
  }
  const requestedP = args.P === undefined || args.P === null ? seed.P : readPoint(args.P, "P");
  const requestedAngle = args.angle === undefined || args.angle === null ? seed.angle : num(args, "angle");
  const state = C.withAngle({
    ...seed,
    A: { x: A.x, y: A.y }, B: { x: B.x, y: B.y }, C: { x: Cc.x, y: Cc.y },
    P: C.projectOnCircle(requestedP, circle),
    circle,
  }, requestedAngle);
  return { state, requestedP, requestedAngle };
}

/** Everything the real core measures about one drawing. */
function reading(C: C, s: State) {
  const f = C.feet(s);
  const finite = [f.Ap, f.Bp, f.Cp].every((p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const men = C.menelaus(s);
  const err = C.lineError(s);
  const sum = C.squaredIdentity(s);
  const angle = s.angle;
  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    P: pt(s.P),
    circle: { center: pt(s.circle), radius: r6(s.circle.r) },
    inclinationDegrees: angle,
    feet: finite ? {
      Ap: { onSide: "BC", point: pt(f.Ap) },
      Bp: { onSide: "CA", point: pt(f.Bp) },
      Cp: { onSide: "AB", point: pt(f.Cp) },
    } : null,
    collinearity: {
      signedAreaOverRadius: sig(err),
      collinear: finite && C.isCollinear(s),
    },
    menelaus: {
      directedProduct: r6(men),
      unsignedProduct: r6(Math.abs(men)),
      equalsMinusOne: Number.isFinite(men) && Math.abs(men + 1) < 1e-6,
    },
    squaredLengthSum: sig(sum),
    simsonLine: angle === 90,
    note: finite
      ? `A', B' and C' lie on one line: the signed area of A'B'C' is ${sig(err)} and the directed Menelaus product is ${r6(men)}. The lines through P are${angle === 90 ? " perpendicular to the sides, so this is the Simson line" : ` inclined at ${angle} degrees, which works just as well`}.`
      : "The three sloping lines do not all meet the sides; move the points apart.",
  };
}

/** The page's claims, each measured on this drawing with unrounded numbers. */
function claims(C: C, s: State) {
  const f = C.feet(s);
  const onSide = {
    Ap_BC: distToLine(f.Ap, s.B, s.C),
    Bp_CA: distToLine(f.Bp, s.C, s.A),
    Cp_AB: distToLine(f.Cp, s.A, s.B),
  };
  const inclination = {
    Ap_BC: acuteAngle(s.P, f.Ap, s.B, s.C),
    Bp_CA: acuteAngle(s.P, f.Bp, s.C, s.A),
    Cp_AB: acuteAngle(s.P, f.Cp, s.A, s.B),
  };
  const expectedSin = Math.sin((s.angle * Math.PI) / 180);
  const inclinationResidual = Object.values(inclination).map(
    (a) => (Number.isFinite(a) ? Math.abs(Math.sin((a * Math.PI) / 180) - expectedSin) : NaN),
  );
  const men = C.menelaus(s);
  const sum = C.squaredIdentity(s);
  const tol = 1e-6;
  const feetOnSides = Object.values(onSide).every((d) => Number.isFinite(d) && d < tol);
  const equalInclination = inclinationResidual.every((d) => Number.isFinite(d) && d < tol);
  const collinear = C.isCollinear(s);
  const menelausHolds = Number.isFinite(men) && Math.abs(men + 1) < tol;
  const squaredIdentityHolds = Number.isFinite(sum) && Math.abs(sum) < tol;
  const checks = {
    POnCircumcircle: Math.abs(dist(s.P, s.circle) - s.circle.r) < tol,
    feetOnSides,
    equalInclination,
    collinear,
    menelausHolds,
    squaredIdentityHolds,
  };
  const geometryChecks = {
    POnCircumcircle: checks.POnCircumcircle,
    feetOnSides: checks.feetOnSides,
    equalInclination: checks.equalInclination,
    collinear: checks.collinear,
    menelausHolds: checks.menelausHolds,
  };
  return {
    angleDegrees: s.angle,
    circleResidual: sig(dist(s.P, s.circle) - s.circle.r),
    distancesToSides: {
      Ap_BC: sig(onSide.Ap_BC), Bp_CA: sig(onSide.Bp_CA), Cp_AB: sig(onSide.Cp_AB),
    },
    measuredAcuteInclinationsDegrees: {
      Ap_BC: r6(inclination.Ap_BC), Bp_CA: r6(inclination.Bp_CA), Cp_AB: r6(inclination.Cp_AB),
      ofSlider: r6(s.angle > 90 ? 180 - s.angle : s.angle),
    },
    lineError: sig(C.lineError(s)),
    directedMenelausProduct: r6(men),
    squaredLengthSum: sig(sum),
    checks,
    allGeometryChecksHold: Object.values(geometryChecks).every(Boolean),
    squaredIdentityExpectedAtThisAngle: s.angle === 90,
    allHold: Object.values(checks).every(Boolean),
    note:
      "The feet are collinear exactly when the directed product AC'/C'B · BA'/A'C · CB'/B'A is -1 (1 in ordinary lengths). At 90 degrees the other Carnot squared-length sum is also 0; at other angles it is not, but the feet still line up, so a false squaredIdentityHolds away from 90 degrees is expected.",
  };
}

export function actions(): GameActions {
  return {
    feet_and_line: {
      describe:
        "For a triangle A, B, C (each [x, y] or { x, y } in the 500 x 500 board), a point P (glided onto the circumcircle as on the page) and an inclination angle in degrees (clamped to 5…160): report the three feet A' on BC, B' on CA, C' on AB, the signed-area collinearity error, the directed Menelaus product, and whether this is the 90-degree Simson line.",
      args: '{ "A": [250.08, 150], "B": [184.64, 325.68], "C": [348.01, 230.13], "P": [169.1, 191.22], "angle": 90 }',
      run: (args) => {
        const C = core();
        const { state } = build(C, args);
        return { ...reading(C, state), requestedAngleDegrees: args.angle === undefined ? state.angle : num(args, "angle") };
      },
    },
    check_claims: {
      describe:
        "For the same triangle, P and angle, verify the illustration's claims: P on the circumcircle, each foot on its side line, the three lines equally inclined to the sides, the feet collinear, Menelaus's directed product -1, and the other Carnot squared-length sum 0 at 90 degrees but not at other angles. Returns each check with measured residuals.",
      args: '{ "A": [250.08, 150], "B": [184.64, 325.68], "C": [348.01, 230.13], "P": [169.1, 191.22], "angle": 45 }',
      run: (args) => {
        const C = core();
        const { state } = build(C, args);
        return claims(C, state);
      },
    },
  };
}

/** The fields the page saved with Track.state, read again through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const saved = {
    stateVersion,
    A: state.A && typeof state.A === "object" ? pt(state.A as Point) : null,
    B: state.B && typeof state.B === "object" ? pt(state.B as Point) : null,
    C: state.C && typeof state.C === "object" ? pt(state.C as Point) : null,
    P: state.P && typeof state.P === "object" ? pt(state.P as Point) : null,
    angle: state.angle === undefined ? null : num(state, "angle"),
    showSimilar: state.showSimilar === true,
    showCirclePairs: state.showCirclePairs === true,
    showNames: state.showNames !== false,
    pair: state.pair === undefined ? 0 : ((Math.round(num(state, "pair")) % 3) + 3) % 3,
  };
  try {
    const { state: s } = build(C, state);
    const current = {
      ...s,
      showSimilar: saved.showSimilar,
      showCirclePairs: saved.showCirclePairs,
      showNames: saved.showNames,
      pair: saved.pair,
    };
    return {
      ...saved,
      circle: { center: pt(s.circle), radius: r6(s.circle.r) },
      reading: reading(C, current),
      check_claims: claims(C, current),
      note:
        "The saved triangle and P are measured with the applet's own construction: rotate a side, draw the parallel through P, intersect it with the side, then test the three feet with a signed area and Menelaus's product. The two overlay flags and the highlighted pair do not change the geometry.",
    };
  } catch (e) {
    return {
      ...saved,
      reading: null,
      note: `The saved position cannot be measured: ${(e as Error).message}`,
    };
  }
}
