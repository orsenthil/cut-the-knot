/*
 * run_game_logic actions and saved-position reader for BOL5, Proposition 5 of
 * Archimedes' Book of Lemmas.
 *
 * The core lives in bol-5/ and is copied into src/generated/cores/ at build
 * time. AB is a diameter of a big semicircle, C lies on AB, and CD is the
 * perpendicular up to the arc. The two small semicircles have diameters AC and
 * CB; one circle is drawn on each side of CD, touching CD, a small semicircle
 * and the big one. With AC = 2*r1 and CB = 2*r2 their common radius is
 * r = r1*r2/(r1+r2), the harmonic mean halved, so 1/r = 1/r1 + 1/r2, and the
 * far end H of the left circle's diameter EH gives AC*CB = AB*HE.
 *
 * The Java original found the circles with a general Apollonius solver: a
 * dummy circle of radius 1e6 stood for the line CD, and cancellation in that
 * computation costs about five digits. Its radii matched the exact closed form
 * only to 1e-3 and its centres to 0.3 board units. This port keeps the closed
 * form and says so rather than hiding the difference.
 *
 * Every number below comes from the real core. See _shared.ts for the module
 * shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bol-5"].Bol5Core;

type Point = { x: number; y: number };
type MaybePoint = Point | null | undefined;
type State = ReturnType<ReturnType<typeof core>["start"]>;
type Geometry = NonNullable<ReturnType<ReturnType<typeof core>["measurements"]>>;

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: MaybePoint): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const close = (a: number, b: number, tolerance = 1e-9): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

const APPLET_NOTE =
  "The Java applet looked these circles up with a general Apollonius solver " +
  "(a 1e6-radius dummy circle standing for CD); cancellation loses about five " +
  "digits there, so its radii matched the exact formula only to 1e-3 and its " +
  "centres to 0.3 board units. The port uses the closed form r = r1*r2/(r1+r2).";

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
 * A diagram from either the two small radii, a fraction t along the core's
 * default AB, or explicit A, B and C points. Only C may be dragged, so it is
 * clamped to AB and at least 10 board units from either end, as on the page.
 */
function fromArgs(args: Json): { state: State; m: Geometry; clamped: boolean } {
  const C = core();
  const fresh = C.start();
  let A: Point, B: Point, Cc: Point;
  if (args.A !== undefined || args.B !== undefined || args.C !== undefined) {
    if (args.A === undefined || args.B === undefined || args.C === undefined) {
      throw new Error("A, B and C must all be given when using explicit points");
    }
    A = readPoint(args.A, "A");
    B = readPoint(args.B, "B");
    Cc = readPoint(args.C, "C");
  } else if (args.r1 !== undefined || args.r2 !== undefined) {
    const r1 = num(args, "r1");
    const r2 = num(args, "r2");
    if (!(r1 >= 5) || !(r2 >= 5)) {
      throw new Error('"r1" and "r2" must be at least 5: AC and CB must span at least the applet\'s 10-unit drag limit');
    }
    A = fresh.A;
    B = { x: A.x + 2 * (r1 + r2), y: A.y };
    Cc = { x: A.x + 2 * r1, y: A.y };
  } else {
    const t = num(args, "t", (fresh.C.x - fresh.A.x) / (fresh.B.x - fresh.A.x));
    if (!(t >= 0 && t <= 1)) throw new Error('"t" must be a fraction of AB between 0 and 1');
    A = fresh.A;
    B = fresh.B;
    Cc = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
  }
  if (Math.hypot(B.x - A.x, B.y - A.y) < 1e-6) {
    throw new Error("A and B must be different points: AB is the diameter");
  }
  const state = C.start({
    points: { A, B, C: Cc },
    showNames: args.showNames !== false,
    showHint: args.showHint === true,
  });
  state.C = C.clampC(Cc, state);
  const clamped = Math.hypot(state.C.x - Cc.x, state.C.y - Cc.y) > 1e-9;
  const m = C.measurements(state);
  if (!m) throw new Error("the core could not measure this diagram; keep A and B apart");
  return { state, m, clamped };
}

/** The core's geometry and its own claim checks, as plain JSON. */
function reading(state: State, m: Geometry) {
  const C = core();
  const claims = C.claims(state);
  const formulaRadius = (m.r1 * m.r2) / (m.r1 + m.r2);
  const reciprocal = 1 / m.r1 + 1 / m.r2;
  return {
    points: { A: pt(m.A), B: pt(m.B), C: pt(m.C) },
    lengths: { AB: round(m.AB), AC: round(m.AC), CB: round(m.CB) },
    radii: {
      r1: round(m.r1), r2: round(m.r2), bigR: round(m.R),
      leftTwin: round(m.left.r), rightTwin: round(m.right.r), common: round(m.r),
      formula: round(formulaRadius), matchesFormula: close(m.r, formulaRadius),
    },
    twinCentres: { left: pt(m.left.c), right: pt(m.right.c) },
    diameter: {
      E: pt(m.E), H: pt(m.H), HE: round(m.HE), twiceR: round(2 * m.r),
      HE_is_twice_r: close(m.HE, 2 * m.r),
    },
    identities: {
      AC_times_CB: round(m.AC * m.CB), AB_times_HE: round(m.AB * m.HE),
      productHolds: close(m.AC * m.CB, m.AB * m.HE),
      reciprocalSum: round(reciprocal), reciprocalOfTwin: round(1 / m.r),
      reciprocalHolds: close(reciprocal, 1 / m.r),
    },
    checks: { ...claims, allHold: Object.values(claims).every((v) => v === true) },
  };
}

export function actions(): GameActions {
  return {
    twin_circles: {
      describe:
        "For the Book of Lemmas V arbelos, give the two small radii r1 and r2 (each at least 5 board units), or a fraction t along the default AB, or explicit A, B and C points. Run the real core and report both tangent circles' centres and their common radius r against r = r1*r2/(r1+r2), the reciprocal identity 1/r = 1/r1 + 1/r2, the product identity AC*CB = AB*HE, and the three tangencies. The original applet's Apollonius solver loses precision; the port uses the exact closed form.",
      args: '{ "r1": 30, "r2": 50 }',
      run: (args) => {
        const { state, m, clamped } = fromArgs(args);
        const r = reading(state, m);
        return {
          ...r,
          C_was_clamped: clamped,
          note: `With AC = ${r.lengths.AC} = 2*r1 and CB = ${r.lengths.CB} = 2*r2, the big radius is ${r.radii.bigR} = r1 + r2. Both circles have radius ${r.radii.common} = ${r.radii.formula} = r1*r2/(r1+r2), so 1/r = ${r.identities.reciprocalOfTwin} = 1/r1 + 1/r2 = ${r.identities.reciprocalSum}, and AC*CB = ${r.identities.AC_times_CB} = AB*HE = ${r.identities.AB_times_HE}. ${APPLET_NOTE}${clamped ? " The requested C was clamped to AB, at least 10 units from each end." : ""}`,
        };
      },
    },
    diameter_identity: {
      describe:
        "Check Archimedes' diameter identity on this illustration: give t along AB (or r1 and r2, or explicit A, B and C points). Report E where the left twin circle touches CD, H at the far end of its diameter, HE against 2r and AC*CB against AB*HE, plus the proof points F, G, I and Dp where the hint's straight lines meet the big semicircle and CD. The Java applet's Apollonius solver lost about five digits here, so these numbers come from the port's closed form.",
      args: '{ "A": [30, 185], "B": [220, 185], "C": [165, 185], "showHint": true }',
      run: (args) => {
        const { state, m } = fromArgs(args);
        const r = reading(state, m);
        return {
          ...r,
          proofPoints: {
            E: pt(m.E), F: pt(m.F), G: pt(m.G), H: pt(m.H), I: pt(m.I),
            Dp: pt(m.Dp),
          },
          note: `E = (${r.diameter.E?.x}, ${r.diameter.E?.y}) touches the upright CD; extending the radius through C gives H = (${r.diameter.H?.x}, ${r.diameter.H?.y}) with HE = ${r.diameter.HE} = 2r. Substituting r = r1*r2/(r1+r2) yields AC*CB = ${r.identities.AC_times_CB} = AB*HE = ${r.identities.AB_times_HE}. ${APPLET_NOTE} The hint labels the crossing Dp as "D" as well as the top of the upright, a quirk kept from the applet.`,
        };
      },
    },
  };
}

/** The page's saved diagram, plus the core's reading of the same position. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  if (stateVersion !== 1) throw new Error(`unsupported BOL5 state version ${stateVersion}`);
  const A = readPoint(state.A, "A");
  const B = readPoint(state.B, "B");
  const Cc = readPoint(state.C, "C");
  if (Math.hypot(B.x - A.x, B.y - A.y) < 1e-6) {
    throw new Error("A and B must be different points: AB is the diameter");
  }
  const here = C.start({
    points: { A, B, C: Cc },
    showNames: state.showNames !== false,
    showHint: state.showHint === true,
  });
  const clampedC = C.clampC(Cc, here);
  const withinDragLimits =
    Math.hypot(clampedC.x - Cc.x, clampedC.y - Cc.y) <= 1e-9;
  const m = C.measurements(here);
  if (!m) {
    return {
      ...state, stateVersion, valid: false, withinDragLimits,
      note: "The saved A and B do not make a usable diameter; keep them apart and put C on AB.",
    };
  }
  const r = reading(here, m);
  return {
    // The fields the page saved with Track.state, with the same names.
    ...state,
    stateVersion,
    valid: true,
    withinDragLimits,
    clampedC: pt(clampedC),
    // What the same core adds about this position.
    core: r,
    savedMatchesCore: {
      A: Boolean(r.points.A) && close(A.x, r.points.A!.x) && close(A.y, r.points.A!.y),
      B: Boolean(r.points.B) && close(B.x, r.points.B!.x) && close(B.y, r.points.B!.y),
      C: Boolean(r.points.C) && close(Cc.x, r.points.C!.x) && close(Cc.y, r.points.C!.y),
      showNames: here.showNames === true,
      showHint: here.showHint === true,
    },
    note: `C divides AB into AC = ${r.lengths.AC} = 2*r1 and CB = ${r.lengths.CB} = 2*r2. The two circles have centres (${r.twinCentres.left?.x}, ${r.twinCentres.left?.y}) and (${r.twinCentres.right?.x}, ${r.twinCentres.right?.y}), both with radius ${r.radii.common} = r1*r2/(r1+r2); HE = ${r.diameter.HE} = 2r and AC*CB = ${r.identities.AC_times_CB} = AB*HE. ${APPLET_NOTE}${withinDragLimits ? "" : " The saved C was outside the applet's drag limits and has been clamped for this reading."}`,
  };
}
