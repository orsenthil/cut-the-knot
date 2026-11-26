/*
 * run_game_logic actions and saved-position reader for Bevan Point.
 *
 * The core is bevan-point/bevan-point-core.js, copied into
 * src/generated/cores/ at build time. Everything below is measured by it.
 *
 * The one fact behind the picture: ABC is the orthic triangle of the
 * excentral triangle IaIbIc, whose orthocentre is the incenter I. So the
 * nine-point circle of IaIbIc is the circumcircle of ABC: its centre V (the
 * Bevan point) is the reflection of I in O, so O is the midpoint of IV and
 * IO = OV, and its radius is twice R. That is why the Bevan circle is also
 * the circle through the three excentres. See _shared.ts for the module shape.
 *
 * Coordinates are board units from the illustration's 400 x 300 viewBox,
 * with y down.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bevan-point"].BevanPointCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };
type Measurements = {
  sides: { a: number; b: number; c: number };
  doubleArea: number;
  degenerate: boolean;
  I: Point | null;
  ex: { Ia: Point; Ib: Point; Ic: Point } | null;
  incircle: Circle | null;
  excircles: { Ia: Circle; Ib: Circle; Ic: Circle } | null;
  circumcircle: Circle | null;
  O: Point | null;
  R: number | null;
  bevanCircle: Circle | null;
  V: Point | null;
  Re: number | null;
  feet: { Ea: Point | null; Eb: Point | null; Ec: Point | null } | null;
  euler: { O: Point; G: Point } | null;
};
type Claims = {
  midpoint: boolean;
  collinear: boolean;
  doubleRadius: boolean;
  perpendicular: boolean;
  eulerEquidistant: boolean;
  ninePoint: boolean;
};
/** A measured triangle whose core values are all present and drawable. */
type Live = {
  C: Core;
  s: { A: Point; B: Point; C: Point };
  sides: { a: number; b: number; c: number };
  I: Point;
  ex: { Ia: Point; Ib: Point; Ic: Point };
  incircle: Circle;
  excircles: { Ia: Circle; Ib: Circle; Ic: Circle };
  circumcircle: Circle;
  bevanCircle: Circle;
  O: Point;
  R: number;
  V: Point;
  Re: number;
  feet: { Ea: Point | null; Eb: Point | null; Ec: Point | null };
  euler: { O: Point; G: Point };
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null => (v === null || v === undefined ? null : round(v));
/** Residuals are tiny; keep their size and sign instead of rounding to zero. */
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(2));
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;
const circle = (c: Circle | null | undefined) =>
  c ? { center: pt(c.center), radius: maybe(c.radius) } : null;

/** A corner may arrive as the page saves it ({x,y}) or as a short [x,y] pair. */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return { ...fallback };
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or {"x": ..., "y": ...}`);
    const x = Number(raw[0]);
    const y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${key}" must hold two finite numbers`);
    return { x, y };
  }
  if (typeof raw !== "object") throw new Error(`argument "${key}" must be [x, y] or {"x": ..., "y": ...}`);
  return { x: num(raw as Json, "x"), y: num(raw as Json, "y") };
}

/** Omit a corner to use the illustration's opening triangle. */
function triangle(C: Core, args: Json) {
  const seed = C.start();
  return {
    A: readPoint(args, "A", seed.A as Point),
    B: readPoint(args, "B", seed.B as Point),
    C: readPoint(args, "C", seed.C as Point),
  };
}

/** The core draws nothing when a side is under 2 units or the area is zero. */
function live(args: Json): Live {
  const C = core();
  const s = triangle(C, args);
  // The core adds its auxiliary fields after an early degenerate return, so
  // JS inference only sees the first shape; the cast restores the full one.
  const m = C.measurements(s) as unknown as Measurements;
  if (m.degenerate || !m.I || !m.ex || !m.incircle || !m.excircles || !m.circumcircle ||
      !m.O || m.R === null || !m.bevanCircle || !m.V || m.Re === null || !m.feet || !m.euler) {
    throw new Error(
      "A, B and C must be three distinct, non-collinear corners (each side at least 2 units) on the page's 400 x 300 board",
    );
  }
  return {
    C, s, sides: m.sides, I: m.I, ex: m.ex, incircle: m.incircle,
    excircles: m.excircles, circumcircle: m.circumcircle, bevanCircle: m.bevanCircle,
    O: m.O, R: m.R, V: m.V, Re: m.Re, feet: m.feet, euler: m.euler,
  };
}

/** The points and circles the page draws, with the two length comparisons. */
function construction(g: Live) {
  const { C, s, O, I, V, R, Re } = g;
  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: { a: maybe(g.sides.a), b: maybe(g.sides.b), c: maybe(g.sides.c) },
    incenter: pt(I),
    excenters: { Ia: pt(g.ex.Ia), Ib: pt(g.ex.Ib), Ic: pt(g.ex.Ic) },
    circumcenter: pt(O),
    bevanPoint: pt(V),
    incircle: circle(g.incircle),
    excircles: { Ia: circle(g.excircles.Ia), Ib: circle(g.excircles.Ib), Ic: circle(g.excircles.Ic) },
    circumcircle: circle(g.circumcircle),
    bevanCircle: circle(g.bevanCircle),
    perpendicularFeet: { Ea: pt(g.feet.Ea), Eb: pt(g.feet.Eb), Ec: pt(g.feet.Ec) },
    eulerLine: { O: pt(g.euler.O), G: pt(g.euler.G) },
    distances: {
      IO: round(C.distance(I, O)),
      OV: round(C.distance(O, V)),
      IO_minus_OV: sig(C.distance(I, O) - C.distance(O, V)),
      R: round(R),
      Re: round(Re),
      Re_minus_2R: sig(Re - 2 * R),
      Re_over_R: round(Re / R),
    },
  };
}

/** The five claims on the article, with the numbers behind each one. */
function checks(g: Live) {
  const { C, s, I, O, V, R, Re, euler, ex } = g;
  const cl = C.claims(s) as Claims;
  const names = ["midpoint", "collinear", "doubleRadius", "perpendicular", "eulerEquidistant", "ninePoint"] as const;
  const failed = names.filter((k) => cl[k] !== true);
  return {
    O_is_midpoint_of_I_and_V: cl.midpoint === true,
    I_O_V_collinear: cl.collinear === true,
    excentral_radius_is_twice_R: cl.doubleRadius === true,
    VIa_VIb_VIc_perpendicular_to_BC_CA_AB: cl.perpendicular === true,
    I_and_V_equally_far_from_Euler_line: cl.eulerEquidistant === true,
    circumcircle_is_excentral_nine_point_circle: cl.ninePoint === true,
    allHold: failed.length === 0,
    failed,
    checks: {
      IO_minus_OV: sig(C.distance(I, O) - C.distance(O, V)),
      midpoint_residual: sig(C.distance(C.scale(C.add(I, V), 0.5), O)),
      Re_minus_2R: sig(Re - 2 * R),
      VIa_dot_BC: sig(C.dot(C.sub(V, ex.Ia), C.sub(s.C, s.B))),
      VIb_dot_CA: sig(C.dot(C.sub(V, ex.Ib), C.sub(s.A, s.C))),
      VIc_dot_AB: sig(C.dot(C.sub(V, ex.Ic), C.sub(s.B, s.A))),
      I_to_Euler: sig(C.distToLine(I, euler.O, euler.G)),
      V_to_Euler: sig(C.distToLine(V, euler.O, euler.G)),
      Euler_distance_difference: sig(C.distToLine(I, euler.O, euler.G) - C.distToLine(V, euler.O, euler.G)),
      OA_minus_R: sig(C.distance(O, s.A) - R),
      OB_minus_R: sig(C.distance(O, s.B) - R),
      OC_minus_R: sig(C.distance(O, s.C) - R),
    },
    note: failed.length
      ? "These core checks failed; move the corners apart on the page and try a non-collinear triangle."
      : "All five claims hold here. ABC is the orthic triangle of IaIbIc, so I is its orthocentre and its nine-point circle is the circumcircle of ABC: O is the midpoint of IV, Re = 2R, the spokes VIa, VIb, VIc are altitudes perpendicular to the sides, and I and V are symmetric in the Euler line. The core's radii are the applet's average of three distances, so the residuals are tiny but not exactly zero.",
  };
}

export function actions(): GameActions {
  return {
    bevan_point: {
      describe:
        "For a triangle with corners A, B, C (each {x, y} or [x, y] on the page's 400 x 300 board, y down), report the excentres Ia, Ib, Ic and their excentral triangle, the incenter I, circumcentre O and Bevan point V, the incircle, three excircles, circumcircle and Bevan circle, the feet where VIa, VIb, VIc meet the sides, and the differences IO - OV and Re - 2R. Omit a corner to use the illustration's opening triangle. Refuses a degenerate triangle.",
      args: '{ "A": [163, 200], "B": [240, 200], "C": [180, 150] }',
      run: (args) => {
        const g = live(args);
        return {
          ...construction(g),
          note:
            "The excentres are weighted averages of A, B, C with signed side lengths: Ia uses (-a, b, c), Ib uses (a, -b, c) and Ic uses (a, b, -c). V is the circumcentre of the excentral triangle. Since ABC is that triangle's orthic triangle, V is the reflection of I in O and the excentral radius is twice R. The feet Ea, Eb, Ec are where the altitudes from V meet the sides.",
        };
      },
    },
    check_claims: {
      describe:
        "Check the five claims on the Bevan Point page for a triangle A, B, C (each {x, y} or [x, y]): O is the midpoint of I and V so IO = OV; the excentral circumradius is 2R; VIa, VIb, VIc are perpendicular to BC, CA, AB; I and V are equally far from the Euler line; and the circumcircle of ABC is the nine-point circle of the excentral triangle. Returns a boolean for each, the failed names, and the underlying distances and residuals.",
      args: '{ "A": [163, 200], "B": [240, 200], "C": [180, 150] }',
      run: (args) => checks(live(args)),
    },
  };
}

/** The page saves only its triangle; the core recovers the whole diagram from it. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = triangle(C, state);
  // The core adds its auxiliary fields after an early degenerate return, so
  // JS inference only sees the first shape; the cast restores the full one.
  const m = C.measurements(s) as unknown as Measurements;
  // The core's result() ignores its argument: an illustration cannot be won.
  const result: (state: Json) => unknown = C.result;
  const saved = {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    result: result(state),
  };
  const broken = m.degenerate || !m.I || !m.ex || !m.incircle || !m.excircles || !m.circumcircle ||
    !m.O || m.R === null || !m.bevanCircle || !m.V || m.Re === null || !m.feet || !m.euler;
  if (broken) {
    return {
      ...saved,
      degenerate: true,
      note: "The saved corners are collinear, too close together, or not a drawable triangle, so there is no excentral triangle or Bevan point to measure.",
    };
  }
  const g: Live = {
    C, s, sides: m.sides, I: m.I as Point, ex: m.ex as Live["ex"],
    incircle: m.incircle as Circle, excircles: m.excircles as Live["excircles"],
    circumcircle: m.circumcircle as Circle, bevanCircle: m.bevanCircle as Circle,
    O: m.O as Point, R: m.R as number, V: m.V as Point, Re: m.Re as number,
    feet: m.feet as Live["feet"], euler: m.euler as Live["euler"],
  };
  return {
    ...saved,
    degenerate: false,
    reading: {
      ...construction(g),
      ...checks(g),
    },
    note:
      "Track.state saved the three draggable corners. The core rebuilds the excentral triangle and its circle, the incenter, circumcentre and Bevan point from them, then checks the page's five claims at exactly this position.",
  };
}
