/*
 * run_game_logic actions and saved-position reader for Broken Chord.
 *
 * ABC is a triangle on its circumcircle. P is the midpoint of the arc ACB:
 * the point where the perpendicular bisector of AB meets the circle on the
 * same side of AB as C. The perpendicular from P to the longer of AC and BC
 * lands at M, and the broken line A-C-B is cut in half there: if AC is the
 * longer side then AM = MC + BC, otherwise BM = MC + AC.
 *
 * The core (broken-chord/broken-chord-core.js, copied into src/generated/cores/
 * at build time) proves it by extending the long side past C to F with
 * CF equal to the short side. P is then the circumcentre of ABF, so the
 * perpendicular from P to the chord KF (K is A or B) bisects it and
 * KM = MF = MC + CF. Every number below comes from that real core.
 * See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["broken-chord"].BrokenChordCore;

type Point = { x: number; y: number };
type State = ReturnType<ReturnType<typeof core>["start"]>;
type Geometry = NonNullable<ReturnType<ReturnType<typeof core>["measurements"]>>;

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const close = (a: number, b: number, tolerance = 1e-9): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

/** Tool args may give [x, y]; a saved position from the page uses {x, y}. */
function readPoint(value: unknown, name: string): Point {
  if (Array.isArray(value)) {
    const a = numArray({ [name]: value }, name);
    if (a.length !== 2) throw new Error(`"${name}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (value && typeof value === "object") {
    const o = value as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`"${name}" must be a point [x, y] or {x, y}`);
}

/**
 * Build a core state from explicit A, B and C (defaults to the applet's
 * starting triangle). Only those three corners can be dragged; everything
 * else is computed. A degenerate or near-collinear triangle has no drawing.
 */
function readState(args: Json): State {
  const C = core();
  const defaults = C.start();
  let A: Point, B: Point, Cc: Point;
  if (args.A !== undefined || args.B !== undefined || args.C !== undefined) {
    if (args.A === undefined || args.B === undefined || args.C === undefined) {
      throw new Error("A, B and C must all be given when using explicit points");
    }
    A = readPoint(args.A, "A");
    B = readPoint(args.B, "B");
    Cc = readPoint(args.C, "C");
  } else {
    A = defaults.A;
    B = defaults.B;
    Cc = defaults.C;
  }
  return C.start({
    points: { A, B, C: Cc },
    showNames: args.showNames !== false,
    showHint: args.showHint === true,
  });
}

function measure(args: Json): { state: State; m: Geometry } {
  const C = core();
  const state = readState(args);
  const m = C.measurements(state);
  if (!m) {
    throw new Error("A, B and C must be distinct and not nearly collinear: the core needs a circumcircle");
  }
  return { state, m };
}

/** The core's geometry, its claim checks and the theorem at this position. */
function reading(state: State, m: Geometry) {
  const C = core();
  const claims = C.claims(state);
  const longName = m.AC > m.BC ? "A" : "B";
  const shortName = m.AC > m.BC ? "BC" : "AC";
  const sum = m.MC + m.shortSide;
  return {
    triangle: { A: pt(m.A), B: pt(m.B), C: pt(m.C) },
    sides: {
      AB: round(m.AB), AC: round(m.AC), BC: round(m.BC),
      longSide: round(m.longSide), shortSide: round(m.shortSide),
      longerFrom: longName, shorterSide: shortName,
    },
    arcMidpointP: pt(m.P),
    footM: pt(m.M),
    longSideEndK: pt(m.K),
    shortSideEndL: pt(m.L),
    circumcircle: { centre: pt(m.circle.c), radius: round(m.circle.r) },
    lengths: {
      longPart: round(m.AM), MC: round(m.MC), MF: round(m.MF),
      CF: round(m.CF), shortSide: round(m.shortSide),
    },
    identity: {
      equation: `${longName}M = MC + ${shortName}`,
      longPart: round(m.AM),
      remainder: round(sum),
      holds: close(m.AM, sum),
    },
    auxiliaryCircle: {
      F: pt(m.F),
      centre: pt(m.circleF.c),
      radius: round(m.circleF.r),
      centreIsP: pt(m.circleF.c) !== null && pt(m.P) !== null &&
        close(m.circleF.c.x, m.P.x) && close(m.circleF.c.y, m.P.y),
      CF_equals_shortSide: close(m.CF, m.shortSide),
      M_bisects_chordKF: close(m.AM, m.MF),
    },
    checks: { ...claims, allHold: Object.values(claims).every((v) => v === true) },
  };
}

function theoremNote(r: ReturnType<typeof reading>): string {
  return `P = (${r.arcMidpointP?.x}, ${r.arcMidpointP?.y}) is the midpoint of arc ACB and is equidistant from A and B. Dropping the perpendicular from P to the longer side ${r.sides.longerFrom}C lands at M = (${r.footM?.x}, ${r.footM?.y}); the core gives ${r.identity.equation} with ${r.identity.longPart} = ${r.lengths.MC} + ${r.sides.shortSide} = ${r.identity.remainder}, so the bent path A-C-B is cut in half. The mirrored branch swaps the roles of A and B when BC is the longer side.`;
}

function proofNote(r: ReturnType<typeof reading>): string {
  return `Extend ${r.sides.longerFrom}C past C to F = (${r.auxiliaryCircle.F?.x}, ${r.auxiliaryCircle.F?.y}) so that CF equals the short side ${r.sides.shorterSide} = ${r.sides.shortSide}. The auxiliary circle through A, B and F has centre (${r.auxiliaryCircle.centre?.x}, ${r.auxiliaryCircle.centre?.y}) = P and radius ${r.auxiliaryCircle.radius}; M is the midpoint of its chord ${r.sides.longerFrom}F, so ${r.identity.equation} follows from ${r.sides.longerFrom}M = MF = MC + CF. The page's angle check, angle APB = 2 x angle AFB, is ${r.checks.angleDouble}.`;
}

export function actions(): GameActions {
  return {
    broken_chord: {
      describe:
        "For a triangle A, B and C on its circumcircle (SVG coordinates in the page's 360 x 250 picture, y down), give the three corners as [x, y] or {x, y}; omit them for the applet's starting triangle. Run the real core and report the arc midpoint P, the perpendicular foot M on the longer side, and the equality AM = MC + BC (or BM = MC + AC when BC is longer), with the core's claim checks. The points must be distinct and not nearly collinear.",
      args: '{ "A": [98, 125], "B": [260.36, 108.71], "C": [231.13, 60.89] }',
      run: (args) => {
        const { state, m } = measure(args);
        const r = reading(state, m);
        return { ...r, note: theoremNote(r) };
      },
    },
    auxiliary_circle: {
      describe:
        "For the same triangle, report the auxiliary circle that proves the Broken Chord Theorem: extend the longer side past C to F with CF equal to the shorter side, then check that P is the centre of the circle through A, B and F and that M bisects the chord from F. Also report the inscribed-angle check angle APB = 2 x angle AFB. Takes the same A, B, C arguments as broken_chord.",
      args: '{ "A": [100, 125], "B": [260, 109], "C": [231, 61] }',
      run: (args) => {
        const { state, m } = measure(args);
        const r = reading(state, m);
        return {
          ...r,
          note: theoremNote(r) + " " + proofNote(r),
        };
      },
    },
  };
}

/** The page's saved triangle, plus the core's reading of the same position. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) {
    throw new Error(`unsupported Broken Chord state version ${stateVersion}`);
  }
  const A = readPoint(state.A, "A");
  const B = readPoint(state.B, "B");
  const Cc = readPoint(state.C, "C");
  const here = C.start({
    points: { A, B, C: Cc },
    showNames: state.showNames !== false,
    showHint: state.showHint === true,
  });
  const m = C.measurements(here);
  if (!m) {
    return {
      ...state,
      stateVersion,
      valid: false,
      note: "The saved A, B and C are too close together or nearly collinear, so the core draws no circumcircle. Spread the three corners out.",
    };
  }
  const r = reading(here, m);
  return {
    // The fields the page saved with Track.state, with the same names.
    ...state,
    stateVersion,
    valid: true,
    // What the same core adds about this position.
    core: r,
    savedMatchesCore: {
      A: Boolean(r.triangle.A) && close(A.x, r.triangle.A!.x) && close(A.y, r.triangle.A!.y),
      B: Boolean(r.triangle.B) && close(B.x, r.triangle.B!.x) && close(B.y, r.triangle.B!.y),
      C: Boolean(r.triangle.C) && close(Cc.x, r.triangle.C!.x) && close(Cc.y, r.triangle.C!.y),
      showNames: here.showNames === true,
      showHint: here.showHint === true,
    },
    note: theoremNote(r) + " " + proofNote(r),
  };
}
