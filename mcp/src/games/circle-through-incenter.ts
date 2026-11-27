/*
 * run_game_logic actions and saved-position reader for Circle Through Incenter.
 *
 * The real core is circle-through-incenter/circle-through-incenter-core.js,
 * copied into src/generated/cores/ at build time. Everything reported below is
 * measured by it: the incenter I as the side-length-weighted average of the
 * corners, the circle through A, B and I (the circumcircle of those three
 * points), its second crossings X on AC and Y on BC, and the claims made on
 * the applet's page and its summary article. See _shared.ts for the module
 * shape. Coordinates are board units (y downward), as the page saves them.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circle-through-incenter"].CircleThroughIncenterCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };
type Triangle = { A: Point; B: Point; C: Point };
type Claims = {
  equalChords: boolean;
  centerOnBisector: boolean;
  centerOnCircumcircle: boolean;
  symmetric: boolean;
  incenterEqualSides: boolean;
  JOnCircle: boolean;
  chordEqual: boolean;
  angleEqual: boolean;
  chordPerpendicular: boolean;
  redHerring: boolean;
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : round(v);
/** Residuals are tiny; keep their size and sign instead of rounding to zero. */
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(2));
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;
const circle = (c: Circle | null | undefined) =>
  c ? { center: pt(c.center), radius: maybe(c.radius) } : null;
const degrees = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : round((v * 180) / Math.PI);

/** A corner may arrive as the page saves it ({x,y}) or as a short [x,y] pair. */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (Array.isArray(raw)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (raw !== undefined && raw !== null && typeof raw === "object") {
    const o = raw as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  return { ...fallback };
}

/** Omit a corner to use the illustration's opening triangle. */
function triangle(C: Core, args: Json): Triangle {
  const seed = C.start();
  return {
    A: readPoint(args, "A", seed.A),
    B: readPoint(args, "B", seed.B),
    C: readPoint(args, "C", seed.C),
  };
}

/** The whole construction at one triangle, in tutor-friendly units. */
function reading(C: Core, s: Triangle) {
  const m = C.measure(s);
  const cl = C.claims(s) as unknown as Claims;
  const I = m.I;
  const Oc = m.circle ? m.circle.center : null;
  const AX = m.AX;
  const BY = m.BY;
  return {
    triangle: { A: pt(m.A), B: pt(m.B), C: pt(m.C) },
    sides: { a: maybe(m.sides.a), b: maybe(m.sides.b), c: maybe(m.sides.c) },
    degenerate: m.degenerate,
    incenter: pt(I),
    circle: circle(m.circle),
    circumcircle: { center: pt(m.O), radius: maybe(m.circumradius) },
    crossings: { X: pt(m.X), Y: pt(m.Y) },
    hintPoint: pt(m.J),
    lengths: {
      AX: maybe(AX),
      BY: maybe(BY),
      AX_minus_BY: sig(AX !== null && BY !== null ? AX - BY : null),
    },
    angles: { AIB_degrees: degrees(m.angleAIB), ACB_degrees: degrees(m.angleACB) },
    checks: {
      AX_equals_BY: cl.equalChords === true,
      center_on_bisector_CI: cl.centerOnBisector === true,
      center_on_circumcircle: cl.centerOnCircumcircle === true,
    },
    residuals: {
      center_distance_to_CI: I && Oc ? sig(C.distToLine(Oc, m.C, I)) : null,
      center_distance_to_O_minus_R:
        Oc && m.O && m.circumradius !== null
          ? sig(Math.hypot(Oc.x - m.O.x, Oc.y - m.O.y) - m.circumradius)
          : null,
    },
    note: m.degenerate
      ? "The corners are collinear or too close together, so there is no triangle, no incenter and no circle to measure. Drag the corners apart."
      : "With a = |BC|, b = |CA|, c = |AB|, the incenter is I = (aA + bB + cC)/(a + b + c). The circle through A, B and I is their circumcircle, so its centre is the ordinary circumcentre of those three points. X and Y are its second meetings with AC and BC; equal arcs (from angle AIB = 90 degrees + half of angle C) give AX = BY. That centre also lies on the bisector from C and on the circumcircle of ABC.",
  };
}

export function actions(): GameActions {
  return {
    circle_and_cuts: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] or {x, y} on the illustration's board, y downward), report the incenter I, the circle through A, B and I (centre and radius), its second crossings X on line AC and Y on line BC, the lengths AX and BY, the angles AIB and ACB, and check that AX = BY and that the centre lies on the bisector CI. Omit a corner to use the illustration's opening triangle; a collinear or too-small triangle is reported as degenerate.",
      args: '{ "A": [300, 110], "B": [220, 310], "C": [410, 200] }',
      run: (args) => {
        const C = core();
        return reading(C, triangle(C, args));
      },
    },
    check_claims: {
      describe:
        "Check every claim on the Circle Through Incenter page and its summary article for a triangle A, B, C (each [x, y] or {x, y}): AX = BY; the circle's centre lies on the bisector CI and on the circumcircle of ABC; I is equidistant from the three sides; the point J is on CI and on the circle; there is a point E on the circle with BE = AB, angle ABE = angle ACB and BE perpendicular to the line from B to the circumcentre; and the AC != BC condition is a red herring (when AC = BC, X = A and Y = B, so both cuts are zero). Returns a boolean per claim, the failed names and the key residuals.",
      args: '{ "A": [300, 110], "B": [220, 310], "C": [410, 200] }',
      run: (args) => {
        const C = core();
        const s = triangle(C, args);
        const cl = C.claims(s) as unknown as Claims;
        const r = reading(C, s);
        const names = [
          "equalChords", "centerOnBisector", "centerOnCircumcircle", "symmetric",
          "incenterEqualSides", "JOnCircle", "chordEqual", "angleEqual",
          "chordPerpendicular", "redHerring",
        ] as const;
        const failed = names.filter((k) => cl[k] !== true);
        return {
          AX_equals_BY: cl.equalChords === true,
          center_on_bisector_CI: cl.centerOnBisector === true,
          center_on_circumcircle_of_ABC: cl.centerOnCircumcircle === true,
          circle_symmetric_about_CI: cl.symmetric === true,
          incenter_equidistant_from_sides: cl.incenterEqualSides === true,
          J_on_CI_and_circle: cl.JOnCircle === true,
          chord_BE_equals_AB: cl.chordEqual === true,
          angle_ABE_equals_ACB: cl.angleEqual === true,
          BE_perpendicular_to_B_circumcenter: cl.chordPerpendicular === true,
          AC_not_equal_BC_is_red_herring: cl.redHerring === true,
          allHold: failed.length === 0,
          failed,
          numbers: r.lengths,
          residuals: r.residuals,
          note: failed.length
            ? "These claims did not all hold here; move the corners apart into a proper triangle and try again. A degenerate triangle has no circle or angle bisectors to check."
            : "All ten claims hold at this triangle. The circle (ABI) is the circumcircle of A, B and I: its centre is on the bisector from C and on the circumcircle of ABC, and the second cuts X on AC and Y on BC satisfy AX = BY. The extra point E gives a chord BE = AB that subtends the angle at C and is perpendicular to the line from B to the circumcentre.",
        };
      },
    },
  };
}

/** Track.state saved only the three draggable corners; the core rebuilds the rest. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = triangle(C, state);
  // result() ignores its argument: this illustration has nothing to win or lose.
  const result: (state: Json) => unknown = C.result;
  return {
    stateVersion,
    A: pt(s.A),
    B: pt(s.B),
    C: pt(s.C),
    result: result(state),
    reading: reading(C, s),
    note:
      "Track.state saved the three draggable corners in board units. The core recovers the incenter, the circle through A, B and I, its second cuts X on AC and Y on BC, and checks AX = BY and the centre on CI at exactly this position. An illustration cannot be won or lost, so result is null.",
  };
}
