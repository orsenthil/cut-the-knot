/*
 * run_game_logic actions and saved-position reader for Droz Farny Circles.
 *
 * This is the *congruent circles* applet, not its sibling "droz-farny", which
 * puts two perpendicular lines through the orthocenter and asks about the
 * midpoints they cut on the sides. Here a triangle ABC and a point P determine
 * the isogonal conjugate Q. The feet Pa, Pb, Pc of the perpendiculars from P to
 * the three side lines carry circles through Q; their six intersections with
 * the side lines all lie at distance PY from P. The same construction from Q
 * gives six points at distance PY from Q, and the two reconstructed circles
 * have the same radius. If M is the midpoint of PQ, the pedal circle of the two
 * conjugates has centre M and radius PaM, and the median formula in triangle
 * PaPQ gives the page's formula PY² = 2·PaM² + PQ²/2. Swapping P and Q leaves
 * PaM and PQ unchanged, so R = √(2·PaM² + PQ²/2) is common to both circles.
 *
 * Every number below comes from the real core
 * droz-farny-circles/droz-farny-circles-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units in the
 * page's 400 x 250 viewBox, y down. The core keeps two applet tolerances:
 * within 2 px of the circumcircle Q disappears, and nearly parallel lines give
 * a non-finite intersection. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["droz-farny-circles"].DrozFarnyCirclesCore as any;
type Core = ReturnType<typeof core>;

type Pt = { x: number; y: number };
type State = { A: Pt; B: Pt; C: Pt; P: Pt };

const okPt = (p: unknown): p is Pt =>
  Boolean(p) && Number.isFinite((p as Pt).x) && Number.isFinite((p as Pt).y);
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const cnt = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v);
/** Residuals are tiny; keep their size and sign rather than rounding to zero. */
const sig = (v: number | null | undefined): string | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : v.toExponential(2);
const xy = (p: unknown, digits = 6): Pt | null =>
  okPt(p) ? { x: round(p.x, digits), y: round(p.y, digits) } : null;
const circleView = (c: any): Json | null =>
  c ? { center: xy(c.center), radius: cnt(c.r) } : null;

/** Accept the page's saved {x, y} points and the tutor's [x, y] arguments alike. */
function readPoint(v: unknown, label: string, fallback?: Pt): Pt {
  if (v === undefined || v === null) {
    if (fallback) return { x: fallback.x, y: fallback.y };
    throw new Error(`missing argument "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** The core's real state, built by start() and the same withPoint() the page uses. */
function buildState(C: Core, args: Json): State {
  let s = C.start({}) as State;
  for (const name of ["A", "B", "C", "P"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.withPoint(s, name, readPoint(args[name], name)) as State;
    }
  }
  return s;
}

/** Refuse a picture the applet cannot draw; a missing Q is reported, not thrown. */
function living(C: Core, args: Json): { s: State; m: any } {
  const s = buildState(C, args);
  if (C.isDegenerate(s)) {
    throw new Error(
      '"A", "B" and "C" must be three distinct, non-collinear corners on the page\'s 400 x 250 board',
    );
  }
  return { s, m: C.measurements(s) };
}

/** What the applet draws, plus the two numbers behind the common radius. */
function reading(C: Core, s: State, m: any): Json {
  const conj = C.conjugate(s, s.P);
  const scale = Math.max(C.distance(s.A, s.B), C.distance(s.B, s.C), C.distance(s.C, s.A));
  const feet = {
    P: { Pa: xy(m.feet.P.a), Pb: xy(m.feet.P.b), Pc: xy(m.feet.P.c) },
    Q: m.feet.Q
      ? { Qa: xy(m.feet.Q.a), Qb: xy(m.feet.Q.b), Qc: xy(m.feet.Q.c) }
      : null,
  };
  return {
    triangle: { A: xy(s.A), B: xy(s.B), C: xy(s.C) },
    P: xy(s.P),
    Q: xy(m.Q),
    QByBarycentrics: xy(conj),
    QagreesWithBarycentrics: okPt(conj) && okPt(m.Q)
      ? C.distance(conj, m.Q) < 1e-6 * Math.max(1, scale)
      : null,
    midpointOfPQ: xy(m.M),
    perpendicularFeet: feet,
    cutPoints: {
      fromPFeet: m.allCuts.P.map((p: Pt) => xy(p)),
      fromQFeet: m.allCuts.Q.map((p: Pt) => xy(p)),
    },
    bigCircles: {
      centredAtP: circleView(m.big.P),
      centredAtQ: circleView(m.big.Q),
      sameRadius: Boolean(m.big.P && m.big.Q &&
        Math.abs(m.big.P.r - m.big.Q.r) < 1e-6 * Math.max(1, m.big.P.r)),
    },
    radiusFormula: {
      pedalRadiusPaM: cnt(m.pedalR),
      PQ: cnt(m.PQ),
      commonRadiusPY: cnt(m.formulaR),
      PYsquared: cnt(m.formulaR ** 2),
      twoPaMSquaredPlusHalfPQSquared: cnt(2 * m.pedalR ** 2 + m.PQ ** 2 / 2),
      residual: sig(m.formulaR ** 2 - (2 * m.pedalR ** 2 + m.PQ ** 2 / 2)),
    },
  };
}

/** The core's own checks, with residuals for the pedal circle and formula. */
function checks(C: Core, s: State, m: any): Json {
  const cl = C.claims(s);
  if (cl.applicable !== true) {
    return {
      applicable: false,
      note: "The core cannot test the claims here: the triangle is degenerate or P is on its circumcircle, so there is no isogonal conjugate Q to draw the circles through.",
    };
  }
  const names = ["onP", "onQ", "centerP", "centerQ", "equalR", "pedal", "formula"] as const;
  const failed = names.filter((k) => cl[k] !== true);
  const allFeet = [m.feet.P.a, m.feet.P.b, m.feet.P.c, m.feet.Q.a, m.feet.Q.b, m.feet.Q.c];
  const pedalDistances = allFeet.map((f: Pt) => C.distance(f, m.M));
  const scale = Math.max(C.distance(s.A, s.B), C.distance(s.B, s.C), C.distance(s.C, s.A));
  const tol = 1e-6 * Math.max(scale, m.PQ);
  const result: Json = {
    applicable: true,
    onP: cl.onP === true,
    onQ: cl.onQ === true,
    centerP: cl.centerP === true,
    centerQ: cl.centerQ === true,
    equalR: cl.equalR === true,
    pedal: cl.pedal === true,
    formula: cl.formula === true,
    cutPoints: {
      fromPFeet: cl.cutsP,
      fromQFeet: cl.cutsQ,
      allTwelve: cl.cutsP + cl.cutsQ,
    },
    allHold: failed.length === 0,
    failed,
    residuals: {
      reconstructedCentreP_minus_P: sig(m.big.P ? C.distance(m.big.P.center, s.P) : null),
      reconstructedCentreQ_minus_Q: sig(m.big.Q ? C.distance(m.big.Q.center, m.Q) : null),
      radiusP_minus_radiusQ: sig(m.big.P && m.big.Q ? m.big.P.r - m.big.Q.r : null),
      pedalRadiusSpread: sig(Math.max(...pedalDistances) - Math.min(...pedalDistances)),
      PYsquared_minus_formula: sig(m.formulaR ** 2 - (2 * m.pedalR ** 2 + m.PQ ** 2 / 2)),
      tolerance: cnt(tol),
    },
  };
  result.note = failed.length
    ? `Some core checks failed (${failed.join(", ")}). Move P away from the circumcircle and the vertices apart, then try again.`
    : "All checks hold: six cut points at radius PY from P, six at the same radius PY from Q, both reconstructed circles centred correctly, the six feet on one pedal circle of radius PaM about the midpoint of PQ, and PY² = 2·PaM² + PQ²/2. The core's circle is an average of three radii, so residuals are tiny but not exactly zero.";
  return result;
}

/** Shared answer for a valid triangle whose P lies too near the circumcircle. */
function noQ(C: Core, s: State, m: any): Json {
  return {
    triangle: { A: xy(s.A), B: xy(s.B), C: xy(s.C) },
    P: xy(s.P),
    Q: null,
    applicable: false,
    distanceFromCircumcircle: cnt(m.gap),
    nearCircumcircle: m.onCircle,
    note: "P is within the applet's 2 px tolerance of the circle through A, B and C, or the two reflected lines are nearly parallel. Its isogonal conjugate Q has gone to infinity, so the perpendicular circles and their cut points are not drawn; move P off the circumcircle and try again.",
  };
}

export function actions(): GameActions {
  const example = '{ "A": [199.576, 42.035], "B": [145.748, 187.815], "C": [272.839, 164.792], "P": [222.113, 158.827] }';
  const describeGeometry =
    "For a triangle with corners A, B, C and a point P (each [x, y] or {x, y} in the page's 400 x 250 board, y down; omit any to use the applet's opening picture), run the real core to find the isogonal conjugate Q, the perpendicular feet Pa, Pb, Pc and the six cut points on the side lines made by the circles through Q. Reports the two Droz-Farny circles reconstructed from those cut points (one centred at P, one at Q, with equal radii), the midpoint M of PQ, and the radius identity PY² = 2·PaM² + PQ²/2 with PY the common radius. Refuses a degenerate triangle; reports Q as null if P lies on the circumcircle.";
  const describeChecks =
    "Test the page's Droz-Farny circle claims at a triangle ABC and point P (arguments as in circles) with the real core: all six P-foot cut points lie at distance PY from P, all six Q-foot cut points at distance PY from Q, the reconstructed circles are centred at P and Q with equal radii, all six pedal feet are PaM from the midpoint M of PQ, and PY² = 2·PaM² + PQ²/2. Returns a boolean for each claim, the cut-point counts and the small residuals, including this applet's 2 px near-circumcircle tolerance.";

  return {
    circles: {
      describe: describeGeometry,
      args: example,
      run: (args) => {
        const C = core();
        const { s, m } = living(C, args);
        if (!m.Q || !m.feet.Q) return noQ(C, s, m);
        return {
          ...reading(C, s, m),
          claims: checks(C, s, m),
          note: "The applet copies the angle AP makes with AB onto AC (and likewise at B and C) to locate Q, the isogonal conjugate; the barycentric point a²/α : b²/β : c²/γ agrees with it. Each circle centred at a pedal foot through Q cuts its side line twice, and the six points fall on one circle centred at P. Swapping P and Q gives another circle of the same radius, because the pedal circles of isogonal conjugates coincide. This is the congruent-circles theorem, not the sibling Droz-Farny line illustration.",
        };
      },
    },

    verify_circles: {
      describe: describeChecks,
      args: example,
      run: (args) => {
        const C = core();
        const { s, m } = living(C, args);
        if (!m.Q) return noQ(C, s, m);
        return {
          triangle: { A: xy(s.A), B: xy(s.B), C: xy(s.C) },
          P: xy(s.P),
          Q: xy(m.Q),
          ...checks(C, s, m),
          radiusFormula: {
            pedalRadiusPaM: cnt(m.pedalR),
            PQ: cnt(m.PQ),
            commonRadiusPY: cnt(m.formulaR),
            PYsquared: cnt(m.formulaR ** 2),
            twoPaMSquaredPlusHalfPQSquared: cnt(2 * m.pedalR ** 2 + m.PQ ** 2 / 2),
          },
        };
      },
    },
  };
}

/** Track.state saves A, B, C, P and the derived Q; the core rebuilds the rest. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Droz Farny Circles state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" ? state : ({} as Json);
  let savedReadable = true;
  let s: State;
  try {
    s = buildState(C, src);
  } catch {
    s = C.start({}) as State;
    savedReadable = false;
  }
  const degenerate = C.isDegenerate(s);
  const m = C.measurements(s);
  const saved = {
    A: xy(src.A), B: xy(src.B), C: xy(src.C), P: xy(src.P), Q: xy(src.Q),
    result: C.result(src),
  };
  const qAgreement = okPt(src.Q) && okPt(m.Q) ? C.distance(src.Q, m.Q) : null;

  if (!savedReadable || degenerate || !m.Q || !m.feet.Q) {
    return {
      stateVersion,
      savedReadable,
      saved,
      Qagreement: qAgreement,
      applicable: false,
      note: !savedReadable
        ? "The saved position could not be read, so the applet's opening picture is shown instead."
        : degenerate
          ? "The saved corners are collinear, so there is no triangle and no isogonal conjugate to measure."
          : "The saved P lies within the applet's 2 px tolerance of the circumcircle, so Q and the Droz-Farny circles are not drawn at this position.",
    };
  }

  const r = reading(C, s, m) as Json;
  return {
    stateVersion,
    savedReadable,
    saved,
    reading: r,
    checks: checks(C, s, m),
    agreement: {
      Q: qAgreement,
      QwithinTolerance: qAgreement !== null &&
        qAgreement < 1e-6 * Math.max(1, C.distance(s.A, s.B), C.distance(s.B, s.C), C.distance(s.C, s.A)),
    },
    note: "Track.state saved the three corners, P and the derived Q; the core rebuilds the perpendicular feet, the six cut points from each family of circles, the two reconstructed circles and the radius formula PY² = 2·PaM² + PQ²/2 at exactly this position. The saved Q agrees with the angle-copy construction (and with the barycentric isogonal conjugate). This illustration, about two congruent circles, is different from its sibling Droz-Farny applet about perpendicular lines through the orthocenter; there is no win or loss here.",
  };
}
