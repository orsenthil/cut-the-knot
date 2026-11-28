/*
 * run_game_logic actions and saved-position reader for Incircles and Circumcircles.
 *
 * The real core is incircles-circumcircles/incircles-circumcircles-core.js,
 * copied into src/generated/cores/ at build time; every number below is measured
 * by it. Coordinates are board units in the page's 400 x 300 viewBox, y down.
 * For a triangle ABC with incenter I, the circumcenters of (IBC), (ICA) and
 * (IAB) lie on the circumcircle of ABC, on the bisectors from A, B and C, and
 * on one circle (in fact that same circumcircle). The page's angle argument
 * uses M_a, M_b, M_c, the midpoints of BC, CI and IB:
 *   angle M_a O_A M_c = angle IBC = B/2,  angle M_a O_A M_b = angle ICB = C/2,
 *   so angle B O_A C = B + C and angle B O_A C + A = 180 degrees.
 * This is a demonstration: there is no win or loss. See _shared.ts for the
 * module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { center: Pt; radius: number };
type State = { A: Pt; B: Pt; C: Pt };
type Measure = {
  A: Pt; B: Pt; C: Pt; I: Pt; baryI: Pt;
  sides: { a: number; b: number; c: number };
  doubleArea: number;
  degenerate: boolean;
  incircle: Circle | null;
  bigCircle: Circle | null;
  small: { A: Circle | null; B: Circle | null; C: Circle | null };
  mid: { a: Pt; b: Pt; c: Pt } | null;
};
type Claims = {
  incenterFormula: boolean; incircleTouchesSides: boolean; radiiAreTrue: boolean;
  centersOnCircumcircle: boolean; centersOnBisectors: boolean;
  arcMidpoints: boolean; johnsonCircle: boolean; angleHalves: boolean;
  angleBDC: boolean; concentric: boolean; all: boolean;
};
type Core = {
  STEP: number;
  start(options?: Json): State;
  withPoint(s: State, name: string, p: Pt): State;
  isDegenerate(s: State): boolean;
  distance(p: Pt, q: Pt): number;
  cross(a: Pt, b: Pt, c: Pt): number;
  angleAt(p: Pt, q: Pt, r: Pt): number;
  midpoint(p: Pt, q: Pt): Pt;
  findCircumcenter(p: Pt, q: Pt, r: Pt): Pt;
  secondCircleCross(center: Pt, radius: number, p: Pt, q: Pt, ref: Pt): Pt | null;
  measure(s: State): Measure;
  claims(s: State): Claims;
  result(s: State): unknown;
};

const core = (): Core =>
  cores["incircles-circumcircles"].IncirclesCircumcirclesCore as unknown as Core;

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
/** Keep a near-zero residual's sign and size instead of printing 0. */
const sig = (v: number): number => (Number.isFinite(v) ? Number(v.toPrecision(6)) : NaN);
const deg = (v: number): number => (Number.isFinite(v) ? round((v * 180) / Math.PI, 3) : NaN);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** Tool args may use [x, y]; a saved position from the page uses { x, y }. */
function readPoint(v: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (v && typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(v)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** A real core state: corners are applied as page drags from the opening triangle. */
function readTriangle(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C points in board coordinates");
  }
  let s = C.start();
  for (const name of ["A", "B", "C"] as const) {
    const v = args[name];
    if (v !== undefined && v !== null) s = C.withPoint(s, name, readPoint(v, name));
  }
  if (C.isDegenerate(s)) {
    throw new Error('"A", "B" and "C" are collinear or too close: there is no incircle or circumcircle');
  }
  return s;
}

/** Distance from p to the infinite line xy, using the core's own cross product. */
const lineDist = (C: Core, p: Pt, x: Pt, y: Pt): number =>
  Math.abs(C.cross(x, y, p)) / (C.distance(x, y) || 1);

/** Everything the core measures at one non-degenerate triangle, in plain JSON. */
function reading(C: Core, s: State) {
  const m = C.measure(s);
  const cl = C.claims(s);
  const O = m.bigCircle!.center;
  const R = m.bigCircle!.radius;
  const OA = m.small.A!.center, OB = m.small.B!.center, OC = m.small.C!.center;

  /* DrawAddOns labels (I,B,C) as "A", (I,C,A) as "B" and (I,A,B) as "C". */
  const pairs = {
    A: { circle: "(I,B,C)", vertex: s.A, other: [s.B, s.C] as [Pt, Pt] },
    B: { circle: "(I,C,A)", vertex: s.B, other: [s.C, s.A] as [Pt, Pt] },
    C: { circle: "(I,A,B)", vertex: s.C, other: [s.A, s.B] as [Pt, Pt] },
  };
  const centers = (["A", "B", "C"] as const).map((key) => {
    const { circle, vertex, other } = pairs[key];
    const c = m.small[key]!.center;
    const radius = m.small[key]!.radius;
    const crossPoint = C.secondCircleCross(O, R, vertex, m.I, vertex);
    return {
      name: `O_${key}`, circle,
      center: pt(c),
      radius: round(radius),
      onCircumcircleResidual: sig(C.distance(c, O) - R),
      onBisectorResidual: sig(lineDist(C, c, vertex, m.I)),
      bisectorSecondCrossResidual: crossPoint ? sig(C.distance(c, crossPoint)) : NaN,
      distancesToIAndCorners: [m.I, ...other].map((p) => round(C.distance(c, p))),
      circlePassesThroughAllThree: [m.I, ...other].every(
        (p) => Math.abs(C.distance(c, p) - radius) <= 1e-6 * Math.max(1, R),
      ),
    };
  });

  const centerOfCenters = C.findCircumcenter(OA, OB, OC);
  const radiusOfCenters = C.distance(centerOfCenters, OA);

  const mid = m.mid!;
  const angleA = C.angleAt(s.A, s.B, s.C);
  const angleB = C.angleAt(s.B, s.A, s.C);
  const angleC = C.angleAt(s.C, s.A, s.B);
  const ibc = C.angleAt(s.B, m.I, s.C);
  const icb = C.angleAt(s.C, m.I, s.B);
  const maOaMc = C.angleAt(OA, mid.a, mid.c);
  const maOaMb = C.angleAt(OA, mid.a, mid.b);
  const boac = C.angleAt(OA, s.B, s.C);
  const toDeg = (r: number): number => ((r * 180) / Math.PI);
  const angleEquations = {
    at: "O_A, the center of (IBC); M_a on BC, M_b on CI, M_c on IB",
    midpoints: { M_a: pt(mid.a), M_b: pt(mid.b), M_c: pt(mid.c) },
    anglesDegrees: {
      MaOaMc: deg(maOaMc), IBC: deg(ibc), halfB: deg(angleB / 2),
      MaOaMb: deg(maOaMb), ICB: deg(icb), halfC: deg(angleC / 2),
      BOaC: deg(boac), BplusC: deg(angleB + angleC), A: deg(angleA),
      BOaCplusA: deg(boac + angleA),
    },
    residualsDegrees: {
      MaOaMcMinusIBC: sig(toDeg(maOaMc - ibc)),
      MaOaMbMinusICB: sig(toDeg(maOaMb - icb)),
      IBCminusHalfB: sig(toDeg(ibc - angleB / 2)),
      ICBminusHalfC: sig(toDeg(icb - angleC / 2)),
      BOaCminusBplusC: sig(toDeg(boac - (angleB + angleC))),
      BOaCplusAMinus180: sig(toDeg(boac + angleA - Math.PI)),
    },
    identities: [
      "angle M_a O_A M_c = angle IBC = B/2",
      "angle M_a O_A M_b = angle ICB = C/2",
      "angle B O_A C = B + C",
      "angle B O_A C + A = 180 degrees",
    ],
  };

  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    incenter: {
      fromBisectors: pt(m.I), fromSideLengths: pt(m.baryI),
      formulaResidual: sig(C.distance(m.I, m.baryI)),
    },
    sides: { a: round(m.sides.a), b: round(m.sides.b), c: round(m.sides.c) },
    doubleArea: round(m.doubleArea),
    incircle: m.incircle ? { center: pt(m.incircle.center), radius: round(m.incircle.radius) } : null,
    circumcircle: { center: pt(O), radius: round(R) },
    smallCircles: {
      A: { through: "(I,B,C)", center: pt(OA), radius: round(m.small.A!.radius) },
      B: { through: "(I,C,A)", center: pt(OB), radius: round(m.small.B!.radius) },
      C: { through: "(I,A,B)", center: pt(OC), radius: round(m.small.C!.radius) },
    },
    centers,
    centerOfCenters: {
      center: pt(centerOfCenters), radius: round(radiusOfCenters),
      concentricResidual: sig(C.distance(centerOfCenters, O)),
      sameCircleResidual: sig(radiusOfCenters - R),
    },
    angleEquations,
    claims: cl,
    result: C.result(s),
  };
}

export function actions(): GameActions {
  return {
    three_centers: {
      describe:
        "For triangle ABC (each corner [x, y] or { x, y } in the page's 400 x 300 board, y down; omit any corner to keep the core's opening triangle), run the real Incircles and Circumcircles core. Report the incenter I from the bisectors and from the side-length formula, the incircle, the circumcircle of ABC and the three small circles (IBC), (ICA), (IAB) with centers O_A, O_B, O_C; for each center give its distance to the big circle, to its angle bisector and to the second crossing of that bisector with the circle, plus all ten theorem checks. The three centers lie on the circumcircle, on their bisectors and on one circle (the same circumcircle), so the checks stay true as you drag.",
      args: '{"A":[44,150],"B":[280,230],"C":[200,70]}',
      run: (args) => {
        const C = core();
        const r = reading(C, readTriangle(C, args));
        return {
          ...r,
          note:
            `O_A, O_B and O_C are at ${JSON.stringify(r.centers.map((c) => c.center))}: their distances from the circumcircle are ` +
            `${r.centers.map((c) => c.onCircumcircleResidual).join(", ")} and from their bisectors ` +
            `${r.centers.map((c) => c.onBisectorResidual).join(", ")} board units. The center of the three centers is ` +
            `${r.centerOfCenters.concentricResidual} from ABC's center, and their circle's radius differs by ` +
            `${r.centerOfCenters.sameCircleResidual}: the three circles form one and the same circle. The core's theorem check is ` +
            `${r.claims.all ? "all true" : "not all true"}. This is an illustration, so there is no win or loss.`,
        };
      },
    },

    angle_equations: {
      describe:
        "For triangle ABC as in three_centers, measure at O_A (the center of (IBC)) the page's angle equations with M_a, M_b, M_c the midpoints of BC, CI, IB: angle M_a O_A M_c = angle IBC = B/2 and angle M_a O_A M_b = angle ICB = C/2, hence angle B O_A C = B + C and angle B O_A C + A = 180 degrees, the circumcircle test. Returns every angle in degrees with its residual and the core's angleHalves and angleBDC checks.",
      args: '{"A":[44,150],"B":[280,230],"C":[200,70]}',
      run: (args) => {
        const C = core();
        const r = reading(C, readTriangle(C, args));
        const e = r.angleEquations;
        return {
          triangle: r.triangle,
          incenter: r.incenter,
          circumcircle: r.circumcircle,
          OA: r.smallCircles.A,
          angleEquations: e,
          coreChecks: {
            angleHalves: r.claims.angleHalves,
            angleBDC: r.claims.angleBDC,
            centersOnCircumcircle: r.claims.centersOnCircumcircle,
          },
          note:
            `At O_A the core measures angle M_a O_A M_c = ${e.anglesDegrees.MaOaMc}° against angle IBC = ${e.anglesDegrees.IBC}° = B/2 = ${e.anglesDegrees.halfB}°, ` +
            `and angle M_a O_A M_b = ${e.anglesDegrees.MaOaMb}° against angle ICB = ${e.anglesDegrees.ICB}° = C/2 = ${e.anglesDegrees.halfC}°. ` +
            `Adding gives angle B O_A C = ${e.anglesDegrees.BOaC}° = B + C = ${e.anglesDegrees.BplusC}°, and with A = ${e.anglesDegrees.A}° ` +
            `the sum is ${e.anglesDegrees.BOaCplusA}°, so O_A satisfies the 180° test for lying on the circumcircle of ABC. ` +
            "This is an illustration, so there is no win or loss.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Incircles and Circumcircles state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" && !Array.isArray(state) ? state : ({} as Json);
  let savedReadable = true;
  let s: State;
  let saved: Json;
  try {
    const A = readPoint(src.A, "A");
    const B = readPoint(src.B, "B");
    const Cc = readPoint(src.C, "C");
    s = C.start({ points: { A, B, C: Cc } });
    saved = { A: pt(A), B: pt(B), C: pt(Cc) };
  } catch {
    savedReadable = false;
    s = C.start();
    saved = { A: pt(s.A), B: pt(s.B), C: pt(s.C) };
  }

  if (C.isDegenerate(s)) {
    return {
      ...src, stateVersion, savedReadable, saved, valid: false,
      note: "The saved corners are collinear or too close, so the core cannot draw an incircle or circumcircle. Move a corner apart.",
    };
  }

  const r = reading(C, s);
  const where = r.centers.map((c) => `${c.name} at (${c.center!.x}, ${c.center!.y})`).join(", ");
  return {
    ...src,
    stateVersion,
    savedReadable,
    saved,
    valid: true,
    reading: r,
    note:
      "Track.state saved only the three corners A, B and C in board units; the checkboxes and the Check button state are not saved. " +
      `The core rebuilds I at (${r.incenter.fromBisectors!.x}, ${r.incenter.fromBisectors!.y}), the incircle of radius ` +
      `${r.incircle!.radius} and the circumcircle of radius ${r.circumcircle.radius}. The three small circles have centers ` +
      `${where}; each lies on the circumcircle and on its angle bisector, and the core's theorem check is ` +
      `${r.claims.all ? "all true" : "not all true"}. This is an illustration: there is no win or loss.`,
  };
}
