/*
 * run_game_logic actions and saved-position reader for In And Circumcenter C.
 *
 * The real core is in-and-circumcenter-c/in-and-circumcenter-c-core.js, copied
 * into src/generated/cores/ at build time. Every point and number below is
 * measured by it; nothing is asserted from memory.
 *
 * This is variant C of Bogomolny's four InAndCircumcenter applets. It lays the
 * side AB along BC and AC to make D and E (BD = AE = AB), then adds the three
 * excenters, the external-bisector feet K, L, M, and the radical-axis proof.
 * It is not variant A (which draws the intersection of IO and DE), B (which
 * draws the point F where AI meets the circumcircle) or D (which uses its own
 * line-circle intersection). The facts reported here are:
 *
 *   DE = 2 · IO · sin(C), and DE ⟂ IO for every triangle (so DE = IO at 30°);
 *   O' = 2O − I and R' = 2R for the excentral triangle, whose orthocenter is I;
 *   BK/KC = c/b, CL/LA = a/c, AM/MB = b/a (the article prints the reciprocals
 *     b/c, c/a, a/b), and CK/CL = CD/CE = (c−a)/(c−b) up to signed lengths;
 *
 * See _shared.ts for the module shape. Coordinates are the applet's 400 × 400
 * board units, with y down.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["in-and-circumcenter-c"].InAndCircumcenterCCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };
type Circle = { centre: Point; radius: number };
type Line = { a: Point; b: Point };
/** The full object the core's construct() returns for a drawable triangle. */
type Geometry = {
  A: Point; B: Point; C: Point;
  a: number; b: number; c: number;
  I: Point; O: Point; Op: Point; Ia: Point; Ib: Point; Ic: Point;
  D: Point; E: Point; K: Point; L: Point; M: Point;
  incircle: Circle; circumcircle: Circle; exCircle: Circle;
  circleA: Circle; circleB: Circle; circleC: Circle;
  sa: Line; sb: Line; sc: Line;
  de: Line; kl: Line; oo: Line;
};
type Numbers = {
  angle: number; a: number; b: number; c: number;
  de: number; io: number; predictedDE: number;
  R: number; Rp: number; predictedOp: Point;
  perp: number; opGap: number; radiusGap: number; klmCross: number;
  ratioK: number; ratioL: number; ratioM: number; product: number;
  cdOverCe: number; ckOverCl: number; signedRatio: number;
  ratioGaps: [number, number, number];
  tol: number;
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** JSON has no NaN: a missing measurement becomes null. */
const maybe = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? round(v) : null;
/** Residuals are tiny; keep their size and sign instead of rounding to zero. */
const sig = (v: number | null | undefined): string | null =>
  typeof v === "number" && Number.isFinite(v) ? v.toExponential(2) : null;
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const circle = (c: Circle | null | undefined) =>
  c ? { centre: pt(c.centre), radius: maybe(c.radius) } : null;
const line = (l: Line | null | undefined) =>
  l ? { a: pt(l.a), b: pt(l.b) } : null;

/** Accept the page's saved {x, y} as well as a short [x, y] argument. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [num(o, "x"), num(o, "y")];
  } else {
    throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${key}" must be a finite point`);
  return { x, y };
}

/** Omit a corner to use the applet's opening triangle. */
function triangle(C: Core, args: Json): Triangle {
  const seed = C.start() as Triangle;
  return {
    A: readPoint(args, "A", seed.A),
    B: readPoint(args, "B", seed.B),
    C: readPoint(args, "C", seed.C),
  };
}

/** Throw unless the three corners make a triangle the core agrees to draw. */
function live(args: Json): { C: Core; s: Triangle; g: Geometry } {
  const C = core();
  const s = triangle(C, args);
  // construct() adds its auxiliary fields after an early degenerate return,
  // so JS inference only sees the first shape; the cast restores the full one.
  const g = C.construct(s) as unknown as Geometry | null;
  if (!g) {
    throw new Error(
      "A, B and C must be three distinct, non-collinear corners (each side at least 2 units) on the page's 400 × 400 board",
    );
  }
  return { C, s, g };
}

/** The raw measurements behind every claim, all from the real core. */
function numbers(C: Core, s: Triangle, g: Geometry): Numbers {
  const angle = C.angleC(s);
  const de = C.dist(g.D, g.E);
  const io = C.dist(g.I, g.O);
  const R = g.circumcircle.radius;
  const Rp = g.exCircle.radius;
  const { a, b, c } = g;
  const scale = Math.max(a, b, c, 1);
  const predictedOp = C.add(C.mul(g.O, 2), C.mul(g.I, -1));
  const ratioK = C.dist(g.B, g.K) / C.dist(g.K, g.C);
  const ratioL = C.dist(g.C, g.L) / C.dist(g.L, g.A);
  const ratioM = C.dist(g.A, g.M) / C.dist(g.M, g.B);
  return {
    angle,
    a, b, c,
    de, io,
    predictedDE: 2 * io * Math.sin((angle * Math.PI) / 180),
    R, Rp, predictedOp,
    perp: C.dot(C.sub(g.E, g.D), C.sub(g.O, g.I)) / (de * io),
    opGap: C.dist(g.Op, predictedOp),
    radiusGap: Rp - 2 * R,
    // Divide by the board scale so the tolerance is dimensionless.
    klmCross: C.cross(C.sub(g.L, g.K), C.sub(g.M, g.K)) / (scale * scale),
    ratioK, ratioL, ratioM,
    product: ratioK * ratioL * ratioM,
    cdOverCe: C.dist(g.C, g.D) / C.dist(g.C, g.E),
    ckOverCl: C.dist(g.C, g.K) / C.dist(g.C, g.L),
    signedRatio: (c - a) / (c - b),
    ratioGaps: [ratioK - c / b, ratioL - a / c, ratioM - b / a],
    tol: 1e-6 * scale,
  };
}

/** The points and circles the page draws, with the core's own status line. */
function picture(C: Core, s: Triangle, g: Geometry, n: Numbers) {
  return {
    vertices: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    sides: { a: maybe(n.a), b: maybe(n.b), c: maybe(n.c) },
    angleC: maybe(n.angle),
    incenter: pt(g.I),
    circumcenter: pt(g.O),
    excenters: { Ia: pt(g.Ia), Ib: pt(g.Ib), Ic: pt(g.Ic) },
    excentralCircumcenter: pt(g.Op),
    equalLengthPoints: { D: pt(g.D), E: pt(g.E) },
    externalBisectorFeet: { K: pt(g.K), L: pt(g.L), M: pt(g.M) },
    incircle: circle(g.incircle),
    circumcircle: circle(g.circumcircle),
    excentralCircle: circle(g.exCircle),
    auxiliaryCircles: { throughBC_Ib: circle(g.circleA), throughCA_Ic: circle(g.circleB), throughAB_Ia: circle(g.circleC) },
    lines: {
      DE: line(g.de), KL: line(g.kl), IO: line(g.oo),
      externalBisectors: [line(g.sa), line(g.sb), line(g.sc)],
    },
    status: C.status(s),
  };
}

/** The measured numbers behind the three groups of claims. */
function facts(n: Numbers) {
  return {
    lengths: { DE: maybe(n.de), IO: maybe(n.io), two_IO_sinC: maybe(n.predictedDE) },
    excentral: {
      Oprime: pt(n.predictedOp), // the predicted 2O − I, printed beside the core's Op in picture()
      circumradius_R: maybe(n.R), excentralRadius_Rprime: maybe(n.Rp),
      Rprime_over_R: maybe(n.Rp / n.R),
    },
    residuals: {
      DE_minus_2IOsinC: sig(n.de - n.predictedDE),
      DE_dot_IO_over_lengths: sig(n.perp),
      Oprime_minus_2OminusI: sig(n.opGap),
      Rprime_minus_2R: sig(n.radiusGap),
      KLM_cross_over_scale2: sig(n.klmCross),
    },
    menelaus: {
      measuredExternalRatios: {
        BK_over_KC: maybe(n.ratioK), CL_over_LA: maybe(n.ratioL), AM_over_MB: maybe(n.ratioM),
      },
      correctedReciprocals: {
        c_over_b: maybe(n.c / n.b),
        a_over_c: maybe(n.a / n.c),
        b_over_a: maybe(n.b / n.a),
        product: maybe(n.product),
      },
      printedInTheArticle: {
        b_over_c: maybe(n.b / n.c),
        c_over_a: maybe(n.c / n.a),
        a_over_b: maybe(n.a / n.b),
      },
      CD_over_CE: maybe(n.cdOverCe), CK_over_CL: maybe(n.ckOverCl),
      signed_formula_CminusA_over_CminusB: maybe(n.signedRatio),
      note: "The article prints b/c, c/a, a/b; with ordinary lengths the external-bisector ratios are their reciprocals c/b, a/c, b/a. Both triples multiply to 1, so Menelaus is unchanged. CK and CL carry the opposite sign to their measured lengths; the ratios agree in absolute value.",
    },
    thirtyDegrees: {
      angleIs30: Math.abs(n.angle - 30) < 1e-6,
      DE_equals_IO: Math.abs(n.de - n.io) <= n.tol,
      note: "2 sin(C) = 1 only at C = 30°, so DE and IO are equal there; the right angle holds at every angle.",
    },
  };
}

/** Every page claim, with the residual that decides it. */
function checks(n: Numbers) {
  const small = (v: number) => Number.isFinite(v) && Math.abs(v) <= 1e-6;
  // In an isosceles triangle an external bisector can be parallel to the
  // opposite side, so the core returns NaN for that foot; those checks are
  // unevaluable rather than false.
  const feetFinite = [n.klmCross, n.ratioK, n.ratioL, n.ratioM].every(Number.isFinite);
  const flags: Record<string, boolean | null> = {
    DE_is_twice_IO_sinC: Math.abs(n.de - n.predictedDE) <= n.tol,
    DE_perpendicular_IO: small(n.perp),
    excentral_centre_is_2O_minus_I: n.opGap <= n.tol,
    excentral_radius_is_twice_R: Math.abs(n.radiusGap) <= n.tol,
    K_L_M_are_collinear: feetFinite ? small(n.klmCross) : null,
    BK_over_KC_is_c_over_b: Number.isFinite(n.ratioK) ? small(n.ratioGaps[0]) : null,
    CL_over_LA_is_a_over_c: Number.isFinite(n.ratioL) ? small(n.ratioGaps[1]) : null,
    AM_over_MB_is_b_over_a: Number.isFinite(n.ratioM) ? small(n.ratioGaps[2]) : null,
    menelaus_product_is_one: Number.isFinite(n.product) ? Math.abs(n.product - 1) <= 1e-6 : null,
    CK_over_CL_equals_CD_over_CE: Math.abs(n.ckOverCl - n.cdOverCe) <= 1e-6,
  };
  const failed = Object.keys(flags).filter((k) => flags[k] === false);
  const unevaluable = Object.keys(flags).filter((k) => flags[k] === null);
  const parallelFoot = !feetFinite
    ? " An external bisector is parallel to the opposite side here (the triangle is isosceles at that corner), so that foot is at infinity: the core reports NaN and the K/L/M checks are unevaluable. The DE/IO and excentral claims still hold."
    : "";
  return {
    ...flags,
    allHold: failed.length === 0,
    failed,
    unevaluable,
    tolerance: maybe(n.tol),
    note: failed.length
      ? "These core measurements did not confirm every claim; move the corners apart on the page and try a non-collinear triangle." + parallelFoot
      : "All claims hold here. DE = 2·IO·sin(C) and is perpendicular to IO; the excentral triangle has circumcentre O' = 2O − I (so O is its nine-point centre) and radius R' = 2R; K, L, M are collinear on the radical axis with the corrected reciprocal Menelaus ratios. At C = 30° the two lengths DE and IO coincide. The radii are the applet's average of three distances, so residuals are tiny, not exactly zero." + parallelFoot,
  };
}

const ARGUMENTS =
  "A, B and C are corners on the applet's 400 × 400 board, each {x, y} or [x, y] with y down; omit one to use the opening triangle";
const EXAMPLE = '{ "A": [204, 213.33333333333334], "B": [240, 163.33333333333334], "C": [166.66666666666666, 186.66666666666669] }';

export function actions(): GameActions {
  return {
    diagram: {
      describe:
        `For a triangle (${ARGUMENTS}), run applet C's own construction: lay AB along BC and AC to make D and E, then find the incenter I, circumcenter O, the three excenters, their circumcenter O', the external-bisector feet K, L, M, all the circles, and angle C. Report DE and IO with the identities DE = 2·IO·sin(C) and DE ⟂ IO, the excentral relations O' = 2O − I and R' = 2R, and the corrected reciprocal Menelaus ratios BK/KC = c/b, CL/LA = a/c, AM/MB = b/a (the article prints their reciprocals), with residuals. This is variant C — excenters and the radical axis — not A's IO∩DE point, B's point F on the circumcircle, or D's line-circle point. Refuses a triangle the core cannot draw.`,
      args: EXAMPLE,
      run: (args) => {
        const { C, s, g } = live(args);
        const n = numbers(C, s, g);
        return {
          ...picture(C, s, g, n),
          ...facts(n),
          note:
            "The core weights A, B, C by the side lengths to get I and the excenters, intersects perpendicular bisectors for O and O', turns the internal bisectors by a right angle for K, L, M, and places D and E one side-length from B and A. DE inherits its right angle from the radical axis of the circumcircle of ABC and the excentral circle; at C = 30° it is also as long as IO.",
        };
      },
    },
    check_claims: {
      describe:
        `Test applet C's claims for a triangle (${ARGUMENTS}): DE is twice IO times sin(C) and perpendicular to IO; the excentral triangle has centre O' = 2O − I and radius R' = 2R; K, L, M are collinear; BK/KC = c/b, CL/LA = a/c, AM/MB = b/a (not the article's reciprocals) with product 1; and CK/CL = CD/CE. Returns a boolean for each, the failed names, the tolerance and the residuals. Also reports whether this saved angle is the 30° case where DE = IO.`,
      args: EXAMPLE,
      run: (args) => {
        const { C, s, g } = live(args);
        const n = numbers(C, s, g);
        return {
          ...checks(n),
          at30Degrees: facts(n).thirtyDegrees,
        };
      },
    },
  };
}

/** The page saves A, B, C and every derived point; the core rebuilds them all. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported In And Circumcenter C state version ${stateVersion}`);
  }
  const C = core();
  const s = triangle(C, state);
  const g = C.construct(s) as unknown as Geometry | null;
  // The core's result() ignores a saved state without "explored": a picture
  // cannot be won or lost.
  const result: (state: Json) => unknown = C.result;
  const savedPoint = (key: string, fallback: Point) => pt(readPoint(state, key, fallback));
  const saved = {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    I: savedPoint("I", s.A), O: savedPoint("O", s.A), Op: savedPoint("Op", s.A),
    Ia: savedPoint("Ia", s.A), Ib: savedPoint("Ib", s.A), Ic: savedPoint("Ic", s.A),
    D: savedPoint("D", s.A), E: savedPoint("E", s.A),
    K: savedPoint("K", s.A), L: savedPoint("L", s.A), M: savedPoint("M", s.A),
    names: state.names === true,
    circleA: state.circleA === true, circleB: state.circleB === true, circleC: state.circleC === true,
    centerLine: state.centerLine === true,
    result: result(state),
  };
  if (!g) {
    return {
      ...saved,
      degenerate: true,
      note: "The saved corners are collinear, too close together, or not a drawable triangle, so there are no incenter, excenters or external-bisector feet to measure.",
    };
  }
  const n = numbers(C, s, g);
  const agreement = Object.fromEntries(
    (["I", "O", "Op", "Ia", "Ib", "Ic", "D", "E", "K", "L", "M"] as const).map((name) => [
      name,
      sig(C.dist(readPoint(state, name, g[name]), g[name])),
    ]),
  );
  return {
    ...saved,
    degenerate: false,
    reading: {
      ...picture(C, s, g, n),
      ...facts(n),
      ...checks(n),
      savedPoints_minus_rebuilt: agreement,
    },
    note:
      "Track.state saved the three dragged corners, every point the applet drew and the five switches. The core rebuilds the whole diagram from A, B and C, so the saved points can be compared with the rebuilt ones here, then checks DE = 2·IO·sin(C), O' = 2O − I, R' = 2R and the corrected Menelaus ratios at exactly this position. As an illustration it has no win or loss.",
  };
}
