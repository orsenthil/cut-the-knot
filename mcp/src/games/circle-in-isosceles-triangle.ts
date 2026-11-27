/*
 * run_game_logic actions and saved-position reader for Circle In Isosceles Triangle.
 *
 * ABC is isosceles with AB = AC. P lies on side AB and Q on side CA so that
 * AP = CQ. The surprise is that A, P, Q and O, the circumcenter of ABC, always
 * lie on one circle. The real core (circle-in-isosceles-triangle/, copied into
 * src/generated/cores/ at build time) keeps one parameter t:
 *
 *   P = t·A + (1−t)·B,  Q = t·C + (1−t)·A,
 *   AP = (1−t)·AB, CQ = (1−t)·AC, PB = t·AB, QA = t·AC.
 *
 * So PA·PB = QC·QA, which says P and Q have the same power with respect to the
 * circumcircle of ABC; writing that power as R² − OP² gives OP = OQ. An angle
 * chase then puts O on the circle through A, P and Q. Every number below comes
 * from the core; see _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-in-isosceles-triangle"].CircleInIsoscelesTriangleCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };

const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
const round = (v: number): number | null => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null);
/** Tiny residuals are kept in scientific notation instead of rounding to 0. */
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: Math.round(p.x * 1e6) / 1e6, y: Math.round(p.y * 1e6) / 1e6 }
    : null;
const deg = (radians: number): number | null => round((radians * 180) / Math.PI);
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/** The smaller angle at v between the rays to p and q, in radians. */
function angleAt(v: Point, p: Point, q: Point): number {
  const a = { x: p.x - v.x, y: p.y - v.y };
  const b = { x: q.x - v.x, y: q.y - v.y };
  const denom = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  if (!denom) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / denom)));
}

/** Saved points are objects; short [x, y] pairs are also accepted as arguments. */
function pointArg(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
    x = Number(raw[0]);
    y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = num(o, "x");
    y = num(o, "y");
  } else {
    throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${key}" needs finite x and y`);
  }
  return { x, y };
}

/** The page's position, rebuilt with the core's start() and validated. */
function readState(C: Core, args: Json) {
  const home = C.start();
  const width = num(args, "width", home.width);
  const height = num(args, "height", home.height);
  if (width <= 0 || height <= 0) throw new Error('"width" and "height" must be positive');
  const t = num(args, "t", home.t);
  if (t < 0 || t > 1) throw new Error('argument "t" must lie between 0 and 1');
  const base = C.start({ width, height, t });
  return C.start({
    width,
    height,
    t,
    axis: num(args, "axis", base.axis),
    points: {
      A: pointArg(args, "A", base.A),
      B: pointArg(args, "B", base.B),
      C: pointArg(args, "C", base.C),
    },
  });
}

/** Unrounded geometry, shared by the two actions and the position reader. */
type Measured = ReturnType<typeof measure>;

function measure(C: Core, s: ReturnType<Core["start"]>) {
  const p = C.points(s);
  const m = C.measurements(s);
  const claims = C.claims(s);
  const { A, B, C: Cc, P, Q } = p;
  const O = m.O;
  const scale = Math.max(m.lengths.AB, m.lengths.AC, m.lengths.BC);
  const tol = 1e-6 * scale;
  const PB = s.t * m.lengths.AB;
  const QA = s.t * m.lengths.AC;
  const powerP = m.lengths.AP * PB;
  const powerQ = m.lengths.CQ * QA;
  const anglePOQ = O ? angleAt(O, P, Q) : NaN;
  const angleACB = angleAt(Cc, A, B);
  const angleBAC = angleAt(A, B, Cc);
  const R = O ? dist(O, A) : NaN;
  return {
    s, p, O, circle: m.circle, claims,
    degenerate: m.degenerate === true || !O || !m.circle,
    lengths: {
      AB: m.lengths.AB, AC: m.lengths.AC, BC: m.lengths.BC,
      AP: m.lengths.AP, CQ: m.lengths.CQ, PB, QA,
    },
    powers: { PA_times_PB: powerP, QC_times_QA: powerQ, R_squared_minus_OP_squared: R * R - (O ? dist(O, P) ** 2 : NaN) },
    distances: {
      OP: O ? dist(O, P) : NaN,
      OQ: O ? dist(O, Q) : NaN,
      O_from_APQ_circle: m.circle && O ? dist(O, m.circle.center) - m.circle.radius : NaN,
    },
    angles: { POQ: anglePOQ, ACB: angleACB, twiceACB: 2 * angleACB, BAC: angleBAC },
    determinant: O ? Math.abs(C.cyclicDeterminant(A, P, Q, O)) : NaN,
    tol,
  };
}

/** Tutor-friendly view of one configuration. */
function reading(g: Measured) {
  const { p, O } = g;
  const c = g.circle;
  return {
    t: g.s.t,
    degenerate: g.degenerate,
    points: { A: pt(p.A), B: pt(p.B), C: pt(p.C), P: pt(p.P), Q: pt(p.Q), O: pt(O) },
    circleAPQ: c
      ? {
          center: pt(c.center),
          radius: round(c.radius),
          distanceOfOFromCircle: sig(g.distances.O_from_APQ_circle),
          passesThroughO: g.claims.OOnCircle === true,
        }
      : null,
    lengths: {
      AB: round(g.lengths.AB), AC: round(g.lengths.AC), BC: round(g.lengths.BC),
      AP: round(g.lengths.AP), CQ: round(g.lengths.CQ),
      PB: round(g.lengths.PB), QA: round(g.lengths.QA),
    },
    powers: {
      PA_times_PB: round(g.powers.PA_times_PB),
      QC_times_QA: round(g.powers.QC_times_QA),
      R_squared_minus_OP_squared: round(g.powers.R_squared_minus_OP_squared),
      equal: near(g.powers.PA_times_PB, g.powers.QC_times_QA, g.tol),
    },
    distances: {
      OP: round(g.distances.OP), OQ: round(g.distances.OQ),
      equal: near(g.distances.OP, g.distances.OQ, g.tol),
    },
    anglesDegrees: {
      POQ: deg(g.angles.POQ), ACB: deg(g.angles.ACB),
      twiceACB: deg(g.angles.twiceACB), BAC: deg(g.angles.BAC),
      BAC_plus_POQ: deg(g.angles.BAC + g.angles.POQ),
    },
    concyclic: g.claims.concyclic === true,
    cyclicDeterminant: sig(g.determinant),
  };
}

export function actions(): GameActions {
  return {
    inspect: {
      describe:
        "For an isosceles triangle with apex A on the symmetry axis and base corners B and C (each [x, y] or {x, y}), and a parameter t in [0, 1], report P on AB, Q on CA with AP = CQ, the circumcenter O of ABC, the circle through A, P and Q, the equal powers PA·PB = QC·QA, the equal distances OP = OQ, the angles POQ and 2·ACB, and whether A, P, Q, O are concyclic. The page's base corners mirror each other; the applet's own B drag overwrote C.y twice and broke the isosceles premise, which the port fixes.",
      args: '{ "A": [200, 75], "B": [100, 262.5], "C": [300, 262.5], "t": 0.3 }',
      run: (args) => {
        const C = core();
        const g = measure(C, readState(C, args));
        return {
          ...reading(g),
          note: g.degenerate
            ? "These points make a flat or collapsed triangle, so there is no circumcenter O and no circle to check. Move the corners apart on the page."
            : "P = t·A + (1−t)·B and Q = t·C + (1−t)·A, so AP and CQ are both (1−t) times an equal side. Their powers in the circumcircle agree because PA·PB = QC·QA, forcing OP = OQ; the angle chase then puts O on the circle through A, P and Q.",
        };
      },
    },
    check_claims: {
      describe:
        "Check every claim of the illustration at a chosen isosceles triangle and parameter t: AB = AC, AP = CQ, P and Q on the sides, O equidistant from A, B and C, PA·PB = QC·QA, OP = OQ, O on the circle through A, P and Q, A/P/Q/O concyclic, and the angle identity POQ = 2·ACB (equivalently BAC + POQ = 180°). Returns a boolean and a residual for each check, the failed names and the core's own validity flag. Try t near 0.5 (the symmetric case) and near an endpoint.",
      args: '{ "A": [200, 50], "B": [130, 250], "C": [270, 250], "t": 0.65 }',
      run: (args) => {
        const C = core();
        const g = measure(C, readState(C, args));
        const cl = g.claims;
        const { lengths, powers, distances, angles } = g;
        const checks = {
          isosceles: {
            holds: cl.isosceles === true,
            residual: sig(lengths.AB - lengths.AC),
          },
          equalLengths: {
            holds: cl.equalLengths === true,
            residual: sig(lengths.AP - lengths.CQ),
          },
          pointsOnSides: { holds: cl.pointsOnSides === true },
          circumcenter: {
            holds: cl.circumcenter === true,
            residual: g.O ? sig(Math.max(
              Math.abs(dist(g.O, g.p.A) - dist(g.O, g.p.C)),
              Math.abs(dist(g.O, g.p.B) - dist(g.O, g.p.C)),
            )) : null,
          },
          equalPowers: {
            holds: near(powers.PA_times_PB, powers.QC_times_QA, g.tol),
            residual: sig(powers.PA_times_PB - powers.QC_times_QA),
          },
          equalDistancesOPOQ: {
            holds: near(distances.OP, distances.OQ, g.tol),
            residual: sig(distances.OP - distances.OQ),
          },
          OOnCircle: {
            holds: cl.OOnCircle === true,
            residual: sig(distances.O_from_APQ_circle),
          },
          concyclic: {
            holds: cl.concyclic === true,
            residual: sig(g.determinant),
          },
          anglePOQEqualsTwiceACB: {
            holds: near(angles.POQ, angles.twiceACB, 1e-4),
            residual: sig(angles.POQ - angles.twiceACB),
          },
        };
        const failed = Object.entries(checks).filter(([, v]) => !v.holds).map(([k]) => k);
        return {
          t: g.s.t,
          validInstance: cl.valid === true,
          checks,
          allHold: failed.length === 0,
          failed,
          note: g.degenerate
            ? "A flat or collapsed triangle has no circumcenter and no claim to check."
            : failed.length
              ? "One or more checks failed. The page keeps the triangle isosceles by mirroring a dragged base corner about the axis; the applet's B drag broke that with a duplicated C.y assignment."
              : "Every check holds here. At the midpoint case the quadrilateral A-P-O-Q is an isosceles trapezoid; otherwise its opposite angles are supplementary, which is the same concyclicity.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readState(C, state);
  const g = measure(C, s);
  return {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    t: s.t, axis: s.axis, width: s.width, height: s.height,
    reading: reading(g),
    note: g.degenerate
      ? "The saved points do not make a triangle: move the corners apart on the page."
      : `With t = ${s.t}, P and Q keep AP = CQ, and the circle through A, P and Q passes through the saved triangle's circumcenter O. The port mirrors either dragged base corner about the axis, fixing the applet's B-drag bug that overwrote C.y twice and destroyed AB = AC.`,
  };
}
