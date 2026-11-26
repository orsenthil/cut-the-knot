/*
 * run_game_logic actions and saved-position reader for Angle Bisector In Rectangle.
 *
 * The real core is angle-bisector-in-rectangle/angle-bisector-in-rectangle-core.js,
 * copied into src/generated/cores/ at build time. It answers the archived page's
 * question with two straightedge constructions: Q = AC ∩ MP and K = NQ ∩ (the
 * line through O parallel to BC). Similar triangles give
 * MP/MQ = CO/OQ = KN/KQ, and K lies on the perpendicular bisector of MN, so
 * KM = KN; together those make MN an angle bisector at N while P is above the
 * centre O. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["angle-bisector-in-rectangle"].AngleBisectorInRectangleCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type State = { A: Point; B: Point; C: Point; D: Point; P: Point };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x), y: round(p.y) }
    : null;
const deg = (r: number): number | null => maybe((r * 180) / Math.PI);

/** Accept the page's saved {x, y} as well as [x, y] argument arrays. */
function readPoint(args: Json, key: string): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

/**
 * Build a page state from a compact rectangle spec or from explicit corners.
 * Supplied corners go through the core's own withPoint, the same operation the
 * page's drags use, so the rectangle stays axis-aligned and P stays on line CD.
 */
function readState(C: Core, args: Json): State {
  const width = num(args, "width", 400);
  const height = num(args, "height", 300);
  if (!(width > 0) || !(height > 0)) throw new Error("width and height must be positive numbers");

  let s: State = C.start({ width, height });
  for (const name of ["A", "B", "C", "D"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.withPoint(s, name, readPoint(args, name));
    }
  }
  if (args.P !== undefined && args.P !== null) {
    s = C.withPoint(s, "P", readPoint(args, "P"));
  } else if (args.pY !== undefined && args.pY !== null) {
    s = C.withPoint(s, "P", { x: s.C.x, y: num(args, "pY") });
  }

  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6;
  if (!(s.C.x - s.B.x > 1e-9) || !(s.B.y - s.A.y > 1e-9)) {
    throw new Error("the rectangle must have a positive width and height");
  }
  if (!close(s.A.x, s.B.x) || !close(s.A.y, s.D.y) ||
      !close(s.C.x, s.D.x) || !close(s.B.y, s.C.y)) {
    throw new Error("A, B, C, D must form a rectangle with sides parallel to the axes");
  }
  if (!close(s.P.x, s.C.x)) throw new Error("P must lie on the line CD (its x equals C's x)");
  return s;
}

/** Everything the core measures about one drawing, in tutor-friendly units. */
function reading(C: Core, s: State) {
  const g = C.construct(s);
  const m = C.claims(s);
  const relation = !m.valid
    ? "no meeting point Q: P is at the middle of CD, where MP is parallel to AC"
    : m.aboveO
      ? "equal: MN bisects angle PNQ"
      : "supplementary: the two angles add to 180°, so MN bisects the outside angle at N";

  return {
    rectangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D) },
    P: pt(s.P),
    points: { M: pt(g.M), N: pt(g.N), O: pt(g.O), Q: pt(g.Q), K: pt(g.K) },
    anglesDegrees: { QNM: deg(m.angleQNM), MNP: deg(m.angleMNP), relation },
    ratios: {
      MP_over_MQ: maybe(m.r_MP_MQ),
      CO_over_OQ: maybe(m.r_CO_OQ),
      KN_over_KQ: maybe(m.r_KN_KQ),
      printed_KN_over_NQ: maybe(m.r_KN_NQ),
      allThreeEqual: m.valid && m.firstProportion && m.secondProportion && m.correctedThird,
    },
    auxiliary: {
      KM_equals_KN: m.isosceles,
      KM_parallel_NP: m.KMparallelNP,
      KO_parallel_BC: m.KOparallelBC,
    },
    note:
      "M and N are the midpoints of AD and BC, Q is AC ∩ MP, and K is where NQ meets the line through O parallel to BC. Similar triangles give MP/MQ = CO/OQ = KN/KQ; the archived page prints KN/NQ, which is a typo for KN/KQ. With the corrected ratio, KM ∥ NP and KM = KN, so the isosceles triangle KMN gives angle QNM = angle MNP when P is above the centre O. Below O the ray NQ flips: the angles add to 180° and the outside angle is bisected instead.",
  };
}

export function actions(): GameActions {
  return {
    diagram: {
      describe:
        "For a rectangle ABCD (A top left, B bottom left, C bottom right, D top right) and a point P on line CD, report the constructed points M, N, O, Q and K, the two angles at N in degrees, and the ratios MP/MQ = CO/OQ = KN/KQ. Say whether MN bisects angle PNQ or its outside angle. Give width and height in canvas pixels (default 400 by 300) and pY, the y of P on the right side; or give A, B, C, D and P explicitly as [x, y] or {x, y} (P overrides pY).",
      args: '{ "width": 400, "height": 300, "pY": 38 }',
      run: (args) => {
        const C = core();
        return reading(C, readState(C, args));
      },
    },
    check_claims: {
      describe:
        "Test the archived page's claims for this rectangle and point P: the midpoints, Q on AC and MP, K on NQ with KO parallel to BC, KM = KN, KM parallel to NP, the three proportions MP/MQ = CO/OQ = KN/KQ, and the angle relation at N (equal above the centre, supplementary below). Returns a boolean per claim and the names that fail. The page's printed KN/NQ is checked separately and is expected to be false because NQ is a typo for KQ.",
      args: '{ "width": 400, "height": 300, "pY": 38 }',
      run: (args) => {
        const C = core();
        const m = C.claims(readState(C, args));
        const checks: Record<string, boolean> = {
          constructionValid: m.valid === true,
          midpoints: m.midpointM === true && m.midpointN === true && m.midpointO === true,
          Q_on_AC_and_MP: m.QonAC === true && m.QonMP === true,
          K_on_NQ: m.KonQN === true,
          KO_parallel_BC: m.KOparallelBC === true,
          KM_equals_KN: m.isosceles === true,
          KM_parallel_NP: m.KMparallelNP === true,
          reflected_P_on_NQ: m.reflectionCollinear === true,
          MP_over_MQ_equals_CO_over_OQ: m.firstProportion === true,
          CO_over_OQ_equals_KN_over_KQ: m.secondProportion === true,
          MP_over_MQ_equals_KN_over_KQ: m.correctedThird === true,
          angleRelationAtN: m.aboveO === true ? m.anglesEqual === true : m.exteriorEqual === true,
        };
        const failed = Object.keys(checks).filter((k) => checks[k] !== true);
        return {
          ...checks,
          printed_KN_over_NQ_equals_MP_over_MQ: m.printedThird === true,
          P_above_centre: m.aboveO === true,
          allHold: failed.length === 0,
          failed,
          note: failed.length
            ? "These claims need a non-degenerate drawing: the rectangle must have positive width and height and P must not sit at the middle of CD, where MP is parallel to AC and Q does not exist."
            : "Every claim holds here. The page's printed KN/NQ ratio is deliberately excluded: the construction makes KN/KQ, not KN/NQ, equal to MP/MQ.",
        };
      },
    },
  };
}

/** The page's saved rectangle and point, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readState(C, state);
  return {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D), P: pt(s.P),
    reading: reading(C, s),
  };
}
