/*
 * run_game_logic actions and saved-position reader for Bui Quang Tuan 2.
 *
 * The illustration fits six circles into a triangle: P is the centre of C1 and
 * slides along the bisector at A1; each next circle is centred where the
 * perpendicular at the previous touch point meets the next corner's bisector.
 * The chain closes (C7 = C1), the six touch points lie on one circle centred at
 * the incenter I, and the cevians from the corners to the incircle's touch
 * points meet at the Gergonne point Ge. The two alternating triples concur *if*
 * P is put at one of two special positions; their radical centre is Ge even
 * when they do not. The Java applet's highlight buttons are labelled for those
 * alternating triples, but its own colour test actually highlights the pairs
 * of circles in one corner (C1 with C4, or C2 with C5). This reader follows the
 * labels and the theorem, as the page does.
 *
 * Every number below is measured by the illustration's real core
 * (bui-quang-tuan-2/bui-quang-tuan-2-core.js), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type State = { V: Point[]; t: number; width: number; height: number; P: Point };
type TripleFlag = { concurrent: boolean; atGe: boolean; centre: Point | null };
type Figure = {
  V: Point[]; bis: Point[]; L0: Point; P: Point;
  circles: Circle[]; T: Point[]; seventh: Circle | null;
  big: Circle | null; M: Point[] | null; incircle: Circle | null;
  crossings: Point[]; Ge: Point | null; I: Point;
};
type Claims = {
  closes: boolean; concyclic: boolean; touch: boolean; cevians: boolean;
  radicalAxes: boolean; radicalCenter: boolean;
  triple: { odd: TripleFlag; even: TripleFlag };
  tol: number;
} | null;
type Core = {
  start(options?: Partial<State>): State;
  figure(V: Point[], t: number): Figure;
  measurements(s: State): Figure & { scale: number; valid: boolean };
  claims(s: State): Claims;
  tripleCentres(f: Figure): { odd: Point | null; even: Point | null };
  power(circle: Circle, p: Point): number;
  dist(p: Point, q: Point): number;
  cross(p: Point, q: Point): number;
  sub(p: Point, q: Point): Point;
  result(s?: State): null;
};

const core = () => cores["bui-quang-tuan-2"].BuiQuangTuan2Core as unknown as Core;

const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const pt = (p: Point): Point => ({ x: round(p.x, 4), y: round(p.y, 4) });
const maybePt = (p: Point | null | undefined): Point | null => p ? pt(p) : null;
const maybe = (v: number | null | undefined): number | null =>
  v === undefined || v === null ? null : round(v);

/** Tool args may give [x, y] or {x, y}; a saved position from the page uses {x, y}. */
function readPoint(value: unknown, name: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${name}" must be [x, y] or {x, y}`);
    x = Number(value[0]);
    y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const p = value as Json;
    x = Number(p.x);
    y = Number(p.y);
  } else {
    throw new Error(`"${name}" must be [x, y] or {x, y}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${name}" needs finite coordinates, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** The default triangle comes from the core; any of the three corners may be overridden. */
function readTriangle(C: Core, args: Json): Point[] {
  const seed = C.start({});
  return (["A1", "A2", "A3"] as const).map((name, i) =>
    args[name] === undefined || args[name] === null ? seed.V[i] : readPoint(args[name], name));
}

function checkTriangle(C: Core, V: Point[]): void {
  const twiceArea = C.cross(C.sub(V[1], V[0]), C.sub(V[2], V[0]));
  if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) < 1e-6) {
    throw new Error("A1, A2 and A3 must be three different, non-collinear points");
  }
}

/** t is a fraction along the bisector at A1: 0 at its far end, 1 at A1. */
function readT(args: Json): number {
  const t = num(args, "t", 0.7);
  if (!Number.isFinite(t) || t < 0 || t > 1) {
    throw new Error('"t" must be a finite fraction between 0 and 1 along the bisector at A1');
  }
  return t;
}

function stateFromArgs(C: Core, args: Json): State {
  const V = readTriangle(C, args);
  checkTriangle(C, V);
  const t = readT(args);
  const width = num(args, "width", 400);
  const height = num(args, "height", 300);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('"width" and "height" must be positive numbers');
  }
  return C.start({ V, t, width, height });
}

function tripleView(C: Core, flag: TripleFlag, Ge: Point | null, tol: number) {
  const d = flag.centre && Ge ? C.dist(flag.centre, Ge) : null;
  return {
    concurrent: flag.concurrent,
    atGe: flag.atGe,
    radicalCentre: maybePt(flag.centre),
    distanceFromGe: d === null ? null : round(d),
    withinTolerance: d !== null && d <= tol,
  };
}

/** Everything the core measures at one configuration, in tutor-friendly units. */
function reading(C: Core, s: State) {
  const m = C.measurements(s);
  const cl = C.claims(s);
  if (!m.valid || !cl || !m.Ge || !m.big || !m.incircle || !m.M) {
    return {
      valid: false,
      t: round(s.t),
      P: pt(s.P),
      note: "This configuration degenerates: a centre or radius is not finite, so there is no six-circle ring to measure. Move P away from the very ends of the bisector and keep the triangle's corners apart.",
    };
  }
  const first = m.circles[0], seventh = m.seventh;
  return {
    valid: true,
    t: round(s.t),
    P: pt(m.P),
    incenter: pt(m.I),
    vertices: { A1: pt(s.V[0]), A2: pt(s.V[1]), A3: pt(s.V[2]) },
    chain: {
      centres: m.circles.map((c) => pt(c.c)),
      radii: m.circles.map((c) => round(c.r)),
      firstRadius: round(first.r),
      seventhCentre: maybePt(seventh?.c),
      seventhRadius: maybe(seventh?.r),
      C7equalsC1: cl.closes,
    },
    tangentPoints: {
      points: m.T.map(pt),
      concyclicAboutIncenter: cl.concyclic,
      circleCentre: pt(m.big.c),
      circleRadius: round(m.big.r),
      incircleCentre: pt(m.incircle.c),
      incircleRadius: round(m.incircle.r),
      circleCentreIsIncenter: C.dist(m.big.c, m.I) <= cl.tol,
    },
    gergonne: {
      Ge: pt(m.Ge),
      incircleTouchPoints: m.M.map(pt),
      touchPointsOnIncircle: cl.touch,
      ceviansConcurrentAtGe: cl.cevians,
      radicalAxes: cl.radicalAxes,
      radicalCentreOfC2C4C6: cl.radicalCenter,
    },
    alternatingTriples: {
      C1C3C5: tripleView(C, cl.triple.odd, m.Ge, cl.tol),
      C2C4C6: tripleView(C, cl.triple.even, m.Ge, cl.tol),
    },
    tolerance: cl.tol,
    note:
      "C7 lands back on C1, and all six tangent points are the same distance from I. " +
      "The cevians A1M1, A2M2, A3M3 meet at Ge. The two alternating triples have Ge as " +
      "their radical centre, but they pass through Ge only at two special positions of P. " +
      "The applet's colour swaps are labelled for C1,C3,C5 and C2,C4,C6, although its own " +
      "colour test highlights the pairs C1 with C4 and C2 with C5; the labels and the " +
      "theorem are followed here.",
  };
}

/** Power of Ge with respect to one circle of the chain, as P moves along the bisector. */
function powerAtGe(C: Core, V: Point[], t: number, index: number): number {
  const f = C.figure(V, t);
  if (!f.Ge || f.circles.length <= index) return NaN;
  return C.power(f.circles[index], f.Ge);
}

/**
 * Bisect a sign change of that power over 0.02 <= t <= 0.98, the range the
 * page's P handle allows. Returns the t where the triple passes through Ge.
 */
function findTripleT(C: Core, V: Point[], index: number): number | null {
  const STEP = 0.004;
  let a = 0.02, fa = powerAtGe(C, V, a, index);
  for (let b = a + STEP; b <= 0.98 + 1e-12; b += STEP) {
    const fb = powerAtGe(C, V, b, index);
    if (Number.isFinite(fa) && Number.isFinite(fb) && fa * fb < 0) {
      for (let i = 0; i < 80; i++) {
        const mid = (a + b) / 2, fm = powerAtGe(C, V, mid, index);
        if (!Number.isFinite(fm)) break;
        if (fa * fm <= 0) { b = mid; } else { a = mid; fa = fm; }
      }
      return (a + b) / 2;
    }
    a = b;
    fa = fb;
  }
  return null;
}

function tripleAt(C: Core, V: Point[], t: number | null, index: number, names: string) {
  if (t === null) {
    return { circles: names, tFound: null, reason: "no sign change of Ge's power along the page's P range" };
  }
  const s = C.start({ V, t });
  const cl = C.claims(s);
  const m = C.measurements(s);
  const flag = cl ? (index === 0 ? cl.triple.odd : cl.triple.even) : null;
  const ids = index === 0 ? [0, 2, 4] : [1, 3, 5];
  return {
    circles: names,
    tFound: round(t, 9),
    concurrent: flag?.concurrent ?? false,
    passesThroughGe: flag?.atGe ?? false,
    Ge: m.Ge ? pt(m.Ge) : null,
    radicalCentre: flag ? maybePt(flag.centre) : null,
    powersOfGe: m.Ge && m.circles.length === 6
      ? ids.map((i) => round(C.power(m.circles[i], m.Ge!)))
      : null,
  };
}

export function actions(): GameActions {
  const C = core();
  return {
    six_circle_diagram: {
      describe:
        "For a triangle with corners A1, A2, A3 (each [x, y] or {x, y} on the page's 400 by 300 board; omitted corners use the applet's starting triangle) and P at a fraction t along the bisector at A1 (0 at the bisector's far end, 1 at A1; the applet's Reset uses 0.7), rebuild the whole six-circle chain with the real core. Reports P, all six circle centres and radii, the seventh circle against the first (C7 = C1), the six tangent points and whether they lie on one circle centred at the incenter I, the incircle's touch points and the Gergonne point Ge, the cevian and radical-axis checks, and whether the alternating triples actually pass through Ge. Note: the Java applet's highlight buttons are labelled C1,C3,C5 and C2,C4,C6, but its own colour test highlights the corner pairs C1 with C4 and C2 with C5; the labels and the theorem are followed here.",
      args: '{"A1":[200,150],"A2":[133.33333333333334,214.28571428571428],"A3":[333.33333333333333,171.42857142857142],"t":0.7}',
      run: (args) => reading(C, stateFromArgs(C, args)),
    },
    concurrent_triples: {
      describe:
        "For a triangle (same A1, A2, A3 arguments as six_circle_diagram; omitted corners use the starting triangle), sweep P along the bisector with the real core and bisect to find the two positions where an alternating triple really passes through the Gergonne point Ge: C1,C3,C5 near the far end of the bisector and C2,C4,C6 near the corner. For each, report the t found, Ge, the triple's radical centre and the three powers of Ge (zero when it lies on all three circles). Also reports the flags at t = 0.7, where neither triple concurs although Ge is still their radical centre. The word 'if' is the point of this theorem.",
      args: '{"A1":[200,150],"A2":[133.33333333333334,214.28571428571428],"A3":[333.33333333333333,171.42857142857142]}',
      run: (args) => {
        const V = readTriangle(C, args);
        checkTriangle(C, V);
        const start = C.start({ V, t: 0.7 });
        const startClaims = C.claims(start);
        const startFigure = C.measurements(start);
        return {
          vertices: { A1: pt(V[0]), A2: pt(V[1]), A3: pt(V[2]) },
          atDefaultT: {
            t: 0.7,
            odd: startClaims && startFigure.Ge
              ? tripleView(C, startClaims.triple.odd, startFigure.Ge, startClaims.tol)
              : null,
            even: startClaims && startFigure.Ge
              ? tripleView(C, startClaims.triple.even, startFigure.Ge, startClaims.tol)
              : null,
          },
          odd: tripleAt(C, V, findTripleT(C, V, 0), 0, "C1,C3,C5"),
          even: tripleAt(C, V, findTripleT(C, V, 1), 1, "C2,C4,C6"),
          note:
            "Ge is always the radical centre of C1,C3,C5 and of C2,C4,C6. The circles " +
            "themselves pass through Ge only at the two t values above; at the default " +
            "t = 0.7 neither triple does. The applet's mislabelled colour pairs (C1 with " +
            "C4 and C2 with C5) are not these triples.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus the core's reading of that same diagram. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Bui Quang Tuan 2 state version ${stateVersion}`);
  }
  const C = core();
  const saved = state ?? ({} as Json);
  const V = readPointList(saved.V, "V");
  checkTriangle(C, V);
  const t = readT(saved);
  const width = num(saved, "width", 400);
  const height = num(saved, "height", 300);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('"width" and "height" must be positive numbers');
  }
  const here = C.start({ V, t, width, height });
  const savedP = saved.P === undefined || saved.P === null ? null : readPoint(saved.P, "P");
  const measured = reading(C, here);
  const atHere = C.claims(here);
  const scale = Math.max(
    C.dist(V[0], V[1]), C.dist(V[1], V[2]), C.dist(V[2], V[0]), 1);
  const drift = savedP ? C.dist(savedP, here.P) : null;
  return {
    // The fields Track.state saved, with the same names.
    stateVersion,
    V: V.map(pt),
    t,
    width,
    height,
    P: maybePt(savedP),
    coreP: pt(here.P),
    savedPMatchesCore: drift === null ? null : drift <= 1e-6 * scale,
    savedPDrift: drift === null ? null : round(drift),
    result: C.result(here), // an illustration: nothing can be won or lost
    // What the core adds at exactly this position.
    core: measured,
    note:
      `Track.state saved three corners, t = ${round(t)} and P. The core rebuilds the ` +
      "bisectors, all six circles and the Gergonne construction from those fields: " +
      (atHere
        ? `C7 = C1 is ${atHere.closes}, the touch points are concyclic about I is ` +
          `${atHere.concyclic}, and the odd/even triples concur at Ge is ` +
          `${atHere.triple.odd.atGe}/${atHere.triple.even.atGe}.`
        : measured.note),
  };
}

function readPointList(value: unknown, name: string): Point[] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`"${name}" must list exactly three corners A1, A2, A3`);
  }
  return value.map((p, i) => readPoint(p, `${name}[${i}]`));
}
