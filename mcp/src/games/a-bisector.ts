/*
 * run_game_logic actions and saved-position reader for ABisector.
 *
 * The real core is a-bisector/a-bisector-core.js, copied into
 * src/generated/cores/ at build time. It puts side lengths to work as weights:
 * with a = |BC|, b = |CA|, c = |AB|, the bisector from A meets BC at
 * (b*B + c*C)/(b+c), and all three bisectors meet at the incenter
 * (a*A + b*B + c*C)/(a+b+c). See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["a-bisector"].ABisectorCore;
type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Triangle = { A: Point; B: Point; C: Point };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : round(v);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;

/** Accept the page's saved {x, y} as well as [x, y] argument arrays. */
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
  if (fallback) return fallback;
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

function readTriangle(C: Core, args: Json): Triangle {
  const fresh = C.start();
  return {
    A: readPoint(args, "A", fresh.A),
    B: readPoint(args, "B", fresh.B),
    C: readPoint(args, "C", fresh.C),
  };
}

/** Everything the core measures about one triangle, in tutor-friendly units. */
function reading(C: Core, s: Triangle) {
  const m = C.measurements(s);
  const ratio = (v: number | null) => maybe(v);
  return {
    vertices: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sides: { a: maybe(m.sides.a), b: maybe(m.sides.b), c: maybe(m.sides.c) },
    degenerate: m.degenerate === true,
    feet: { D: pt(m.feet.D), E: pt(m.feet.E), F: pt(m.feet.F) },
    incenter: pt(m.incenter),
    inradius: maybe(m.inradius),
    halfAnglesDegrees: {
      A: maybe((m.halfAngles.A * 180) / Math.PI),
      B: maybe((m.halfAngles.B * 180) / Math.PI),
      C: maybe((m.halfAngles.C * 180) / Math.PI),
    },
    bisectorRatios: {
      AB_over_AC: ratio(m.ratios.AB_AC),
      BD_over_DC: ratio(m.ratios.BD_DC),
      CE_over_EA: ratio(m.ratios.CE_EA),
      AF_over_FB: ratio(m.ratios.AF_FB),
    },
    cevaProduct: ratio(C.ceva(s)),
    note:
      "Each foot is a weighted average of the two vertices on its side, with weights the opposite side lengths; the incenter uses all three side lengths as weights. The foot ratios match the adjacent side ratios, and Ceva's product is 1.",
  };
}

export function actions(): GameActions {
  return {
    bisectors: {
      describe:
        "For a triangle with corners A, B, C (each [x, y] in page coordinates, y downward): report side lengths a=|BC|, b=|CA|, c=|AB|, the three bisector feet D on BC, E on CA, F on AB, the incenter, the inradius, the half-angles and the ratio checks AB/AC = BD/DC, BC/AB = CE/EA, CA/BC = AF/FB together with Ceva's product.",
      args: '{ "A": [0, 0], "B": [10, 0], "C": [4, 6] }',
      run: (args) => {
        const C = core();
        const s = readTriangle(C, args);
        return reading(C, s);
      },
    },
    check_claims: {
      describe:
        "Test every claim on the illustration's page for a triangle A, B, C: the bisectors split the angles in half, the bisector-theorem ratios hold, the feet lie on the sides, the bisectors are concurrent at the incenter, its distances to the three sides equal the inradius, r = area/semiperimeter, and Ceva's product is 1. Returns a boolean for each and their names when any fail.",
      args: '{ "A": [0, 0], "B": [10, 0], "C": [4, 6] }',
      run: (args) => {
        const C = core();
        const claims = C.claims(readTriangle(C, args));
        const names = [
          "anglesSplit", "bisectorRatio", "feetOnSides", "concurrent",
          "equidistant", "inradiusFormula", "ceva",
        ] as const;
        const failed = names.filter((k) => claims[k] !== true);
        return {
          anglesSplit: claims.anglesSplit === true,
          bisectorRatio: claims.bisectorRatio === true,
          feetOnSides: claims.feetOnSides === true,
          concurrent: claims.concurrent === true,
          equidistant: claims.equidistant === true,
          inradiusFormula: claims.inradiusFormula === true,
          ceva: claims.ceva === true,
          allHold: failed.length === 0,
          failed,
          note: failed.length
            ? "A degenerate triangle (corners in a line or two corners together) has no angle bisectors to check; move the corners apart."
            : "All the page's claims hold at this triangle: the three bisectors meet at the incenter and its circle touches every side.",
        };
      },
    },
  };
}

/** The page's saved triangle and auxiliary points, read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = readTriangle(C, state);
  const m = C.measurements(s);
  const midpoint = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const Ca = readPoint(state, "Ca", m.feet.D ? midpoint(s.A, m.feet.D) : s.A);
  const Cb = readPoint(state, "Cb", m.feet.E ? midpoint(s.B, m.feet.E) : s.B);
  const I = m.incenter;
  const fromI = (p: Point, center: Point) => Math.hypot(p.x - center.x, p.y - center.y);

  return {
    stateVersion,
    A: pt(s.A), B: pt(s.B), C: pt(s.C), Ca: pt(Ca), Cb: pt(Cb),
    reading: {
      ...reading(C, s),
      tangentPoints: {
        distanceCaToIncenter: I ? round(fromI(Ca, I)) : null,
        distanceCbToIncenter: I ? round(fromI(Cb, I)) : null,
        nearIncenter: I ? Math.min(fromI(Ca, I), fromI(Cb, I)) < 0.6 : false,
      },
      note:
        "Ca and Cb ride along the A and B bisectors. When either reaches the incenter, the circle centred there touches all three sides; the saved triangle alone already determines the incenter and its radius.",
    },
  };
}
