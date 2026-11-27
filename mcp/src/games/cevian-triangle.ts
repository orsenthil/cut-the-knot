/*
 * run_game_logic actions and saved-position reader for Cevian Triangle.
 *
 * The core lives in cevian-triangle/ and is copied into
 * src/generated/cores/ at build time. Given a triangle ABC and a point P, the
 * cevians AP, BP, CP cut the opposite sides at Pa, Pb, Pc; those three feet
 * form the cevian triangle of P. The matching sides of ABC and PaPbPc meet at
 * L = AB ∩ PaPb, M = BC ∩ PbPc and N = CA ∩ PcPa. Desargues' theorem makes
 * L, M, N collinear because the two triangles are perspective from P. With P
 * at the orthocenter the cevian triangle is the orthic triangle, and its axis
 * is the orthic axis. The old page calls the side lines external bisectors of
 * the orthic triangle: that wording is literally right only for an acute
 * triangle; in an obtuse one two of them bisect internal angles instead.
 *
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cevian-triangle"].CevianTriangleCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Figure = { A: Point; B: Point; C: Point; P: Point };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : round(v);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;

/** Accept both the page's saved {x, y} and [x, y] argument arrays. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  if (v !== undefined && v !== null) {
    throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (fallback) return fallback;
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

/** Missing points fall back to the applet's starting figure. */
function readFigure(C: Core, args: Json): Figure {
  const fresh = C.start();
  const s: Figure = {
    A: readPoint(args, "A", fresh.A),
    B: readPoint(args, "B", fresh.B),
    C: readPoint(args, "C", fresh.C),
    P: readPoint(args, "P", fresh.P),
  };
  if (Math.abs(C.cross(s.A, s.B, s.C)) < 1e-9) {
    throw new Error("A, B and C are collinear; give three corners that form a triangle");
  }
  return s;
}

/** Everything the real core measures about one figure, in tutor-friendly units. */
function reading(C: Core, s: Figure) {
  const d = C.diagram(s);
  const cl = C.claims(s);
  const H = C.orthocenter(s);
  const axis = C.axisLine(d.axis);
  return {
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    P: pt(s.P),
    cevianFeet: { Pa: pt(d.feet.Pa), Pb: pt(d.feet.Pb), Pc: pt(d.feet.Pc) },
    sideIntersections: { L: pt(d.axis.L), M: pt(d.axis.M), N: pt(d.axis.N) },
    axisSegment: axis ? axis.map((p: Point) => pt(p)) : null,
    feetOnSides: d.feetOnSides === true,
    perspectiveFromP: d.perspectiveFromP === true,
    desarguesAxis: d.desarguesAxis === true,
    orthocenter: pt(H),
    acute: C.isAcute(s) === true,
    orthicClaims: {
      orthicIsCevian: cl.orthicIsCevian === true,
      orthicAxis: cl.orthicAxis === true,
      sideLinesBisectOrthicAngles: cl.sideLinesBisectOrthicAngles === true,
      externalBisectors: cl.externalBisectors === true,
    },
  };
}

export function actions(): GameActions {
  return {
    cevian_axis: {
      describe:
        "For a triangle with corners A, B, C and a point P (each [x, y] in the 400 x 250 board, y downward), report the cevian feet Pa on BC, Pb on CA, Pc on AB, the intersections L = AB ∩ PaPb, M = BC ∩ PbPc, N = CA ∩ PcPa, a segment drawing the axis, and tests of the three claims: the feet lie on the sides, the cevians meet at P, and L, M, N are collinear by Desargues' theorem. A null point means that intersection ran off the board because two matching sides are parallel.",
      args: '{ "A": [269, 175], "B": [228, 100], "C": [66, 187], "P": [239.18, 159.05] }',
      run: (args) => {
        const C = core();
        const s = readFigure(C, args);
        const r = reading(C, s);
        const missing = Object.entries(r.cevianFeet)
          .filter(([, p]) => p === null).map(([name]) => name);
        return {
          ...r,
          note: missing.length
            ? `Move P off the sides and corners so all three cevians have feet; missing ${missing.join(", ")}.`
            : "Desargues' theorem: because AP, BP and CP meet at P, the corresponding sides of ABC and PaPbPc meet at L, M, N on one straight line — the perspective axis.",
        };
      },
    },
    orthic_case: {
      describe:
        "For a triangle A, B, C, put P at the orthocenter (ignoring any P argument) and report the orthic triangle, the orthic axis through L, M, N, whether the triangle is acute, and whether the side lines bisect the orthic angles and are external bisectors. For an obtuse triangle the side lines bisect two internal angles instead, so the page's word 'external' is too narrow, although the collinearity still holds.",
      args: '{ "A": [200, 200], "B": [300, 40], "C": [60, 60] }',
      run: (args) => {
        const C = core();
        const given = readFigure(C, args);
        const H = C.orthocenter(given);
        if (!H) throw new Error("these corners make a degenerate triangle with no altitudes to meet");
        const s = C.withPoint(given, "P", H) as Figure;
        const r = reading(C, s);
        const orthic = C.orthicTriangle(s);
        if (!orthic.Pa || !orthic.Pb || !orthic.Pc) {
          throw new Error("these corners make a degenerate triangle with no altitude feet");
        }
        const acute = C.isAcute(s) === true;
        return {
          ...r,
          orthicFeet: { Pa: pt(orthic.Pa), Pb: pt(orthic.Pb), Pc: pt(orthic.Pc) },
          note: acute
            ? "With P at the orthocenter the cevian triangle is the orthic triangle and L, M, N lie on the orthic axis; for this acute triangle each side of ABC is an external bisector of an orthic angle."
            : "With P at the orthocenter the cevian triangle is the orthic triangle and L, M, N are still collinear on the orthic axis. This triangle is obtuse: at two feet the same side line bisects the internal angle, so the old page's 'external bisectors' wording does not apply here.",
        };
      },
    },
  };
}

/** The four saved points, with what the core says about the current diagram. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Cevian Triangle state version ${stateVersion}`);
  }
  const C = core();
  const s = readFigure(C, state);
  return {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C), P: pt(s.P),
    reading: {
      ...reading(C, s),
      note:
        "The saved triangle and P determine the cevian feet and the axis. Set P at the orthocenter to get the orthic triangle and orthic axis; the side lines are external bisectors of the orthic angles only for an acute triangle, not for an obtuse one.",
    },
  };
}
