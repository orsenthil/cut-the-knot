/*
 * run_game_logic actions and saved-position reader for BID (Consecutive
 * Isosceles Decomposition). The real core lives in bid/bid-core.js and is
 * copied into src/generated/cores/ at build time. It reproduces the applet's
 * chain of circle and perpendicular-bisector intersections: BC = BD,
 * BE = DE, EF = DE, AF = EF. Below 45° the four triangles BCD, BDE, DEF and
 * AEF tile ABC; at 45° D and F coincide (three triangles); in a tiny gap just
 * above 45° the circle at E misses the line and F is parked on D; above that
 * the equal sides still match but the lines cross; at 36° the two pairs are
 * similar (the golden triangle). See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["bid"].BidCore;
type Core = ReturnType<typeof core>;
type Analyze = ReturnType<Core["analyze"]>;
type Claims = ReturnType<Core["claims"]>;
type Point = { x: number; y: number };
type State = { width: number; height: number; A: Point; B: Point; C: Point; angle: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : round(v);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** The three angles of one chain triangle, named by their vertices. */
const namedAngles = (a: number[] | null, names: string[]): Record<string, number> | null => {
  if (!a) return null;
  const out: Record<string, number> = {};
  names.forEach((name, i) => { out[name] = round(a[i]); });
  return out;
};

function checkAngle(angle: number): void {
  if (!(angle > 0 && angle < 180)) {
    throw new Error(`angle must be strictly between 0 and 180 degrees, got ${angle}`);
  }
}

/** Accept the page's saved {x, y} as well as [x, y] argument arrays. */
function readPoint(args: Json, key: string): Point {
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
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

/**
 * Either the angle the page's scrollbar sets (20..80, default 45), or an
 * explicit isosceles triangle A, B, C whose angle must match its geometry.
 */
function readState(args: Json): State {
  const C = core();
  const width = num(args, "width", 400);
  const height = num(args, "height", 300);
  if (!(width > 0) || !(height > 0)) throw new Error('"width" and "height" must be positive');
  if (args.A !== undefined || args.B !== undefined || args.C !== undefined) {
    const s: State = {
      width, height,
      A: readPoint(args, "A"), B: readPoint(args, "B"), C: readPoint(args, "C"),
      angle: 45,
    };
    s.angle = C.angleOf(s);
    const given = args.angle === undefined || args.angle === null ? null : num(args, "angle");
    if (given !== null && Math.abs(given - s.angle) > 1e-4) {
      throw new Error(`angle ${given} does not match the triangle's apex angle ${round(s.angle)}`);
    }
    checkAngle(s.angle);
    return s;
  }
  const angle = num(args, "angle", 45);
  checkAngle(angle);
  return C.start({ angle, width, height });
}

/** Name the regime the applet's construction falls into at this angle. */
function classify(C: Core, s: State, m: Analyze, cl: Claims) {
  const a = m.measuredAngle;
  const FD = m.F && m.D ? C.distance(m.F, m.D) : null;
  const tol = 1e-6 * Math.max(1, m.lengths.BC);
  const tinyGap = Boolean(a > 45 && a < 60 && m.F && m.D && FD !== null &&
    C.close(FD, 0, tol) && !cl.equalSides);
  let regime: string;
  let description: string;
  if (cl.noChainAbove60) {
    regime = "stops_above_60";
    description = "Above 60° the circle misses the sides, so the chain stops at the base: no D, E or F is built.";
  } else if (cl.golden) {
    regime = "golden_36";
    description = "At 36° the chain tiles ABC and the two pairs are similar: BDE ~ AEF and BCD ~ DEF, the golden triangle.";
  } else if (cl.threeAt45) {
    regime = "three_at_45";
    description = "At 45° D and F coincide, so the equal sides still match but only three triangles remain.";
  } else if (C.close(a, 60, 1e-6)) {
    regime = "collapses_at_60";
    description = "At 60° the chain lands on the apex A: D and F collapse onto A and the four equalities fail.";
  } else if (tinyGap) {
    regime = "tiny_gap_above_45";
    description = "Just above 45° the circle at E misses the line to A, so the applet puts F on top of D; AF no longer equals EF and the four triangles do not fit.";
  } else if (cl.crossesAbove45) {
    regime = "crosses_above_45";
    description = "Above 45° the four equalities hold, but F lies past D, the lines cross and the four areas no longer add up to ABC.";
  } else if (cl.tiles) {
    regime = "tiles";
    description = "Below 45° the four isosceles triangles BCD, BDE, DEF and AEF fill ABC exactly.";
  } else {
    regime = "other";
    description = "The chain does not give the clean four-triangle decomposition at this angle.";
  }
  return {
    regime,
    description,
    tinyGap,
    equalSides: cl.equalSides,
    angleFormulas: cl.angleFormulas,
    tiles: cl.tiles,
    golden: cl.golden,
    threeAt45: cl.threeAt45,
    crossesAbove45: cl.crossesAbove45,
    noChainAbove60: cl.noChainAbove60,
    partsRatio: round(cl.partsRatio),
    DF: maybe(FD),
  };
}

/** The core's full reading of one position, in degrees and page coordinates. */
function reading(s: State) {
  const C = core();
  const m = C.analyze(s);
  const cl = C.claims(s);
  const tol = 1e-6 * Math.max(1, m.lengths.BC);
  const eq = (u: number | null, v: number | null): boolean =>
    u !== null && v !== null && Number.isFinite(u) && Number.isFinite(v) && C.close(u, v, tol);
  const L = m.lengths;
  return {
    measuredAngle: round(m.measuredAngle),
    chain: (m.points as Point[])
      .map((p: Point, i: number) => ({ label: m.labels[i] ?? null, point: pt(p) }))
      .filter((entry: { point: { x: number; y: number } | null }) => entry.point !== null),
    D: pt(m.D),
    E: pt(m.E),
    F: pt(m.F),
    G: pt(m.G),
    lengths: {
      BC: maybe(L.BC), BD: maybe(L.BD), BE: maybe(L.BE), DE: maybe(L.DE),
      EF: maybe(L.EF), AF: maybe(L.AF), AD: maybe(L.AD),
    },
    equalSideChecks: {
      BC_eq_BD: eq(L.BC, L.BD),
      BE_eq_DE: eq(L.BE, L.DE),
      EF_eq_DE: eq(L.EF, L.DE),
      AF_eq_EF: eq(L.AF, L.EF),
      allHold: cl.equalSides,
    },
    triangleAnglesDegrees: {
      BCD: namedAngles(m.triangles.BCD, ["B", "C", "D"]),
      BDE: namedAngles(m.triangles.BDE, ["B", "D", "E"]),
      DEF: namedAngles(m.triangles.DEF, ["D", "E", "F"]),
      AEF: namedAngles(m.triangles.AEF, ["A", "E", "F"]),
    },
    areaABC: round(m.areaABC),
    ...classify(C, s, m, cl),
    note:
      "D is found by the circle of radius BC about B; E sits on the perpendicular bisector of BD; the same radius gives EF; the last circle lands at F with AF = EF except in the tiny gap just above 45°. partsRatio is (area BCD + BDE + DEF + AEF) / area ABC: 1 means the four pieces tile the big triangle.",
  };
}

export function actions(): GameActions {
  return {
    chain: {
      describe:
        "Build the isosceles triangle the page draws for an apex angle in degrees (0 < angle < 180; the page's slider runs 20..80) and report the chain of points C, B, D, E, F, G..., the four equal-side tests BC=BD, BE=DE, EF=DE, AF=EF, the angles of BCD, BDE, DEF and AEF, and which of the page's claims hold: tiling below 45°, three triangles at 45°, the tiny gap above 45°, crossing beyond it, the golden similarity at 36°, and no chain above 60°. Instead of angle, you may give an explicit triangle as A, B, C (each [x, y] or { x, y }); its angle must match the given angle if one is supplied.",
      args: '{ "angle": 36 }',
      run: (args) => {
        const s = readState(args);
        return {
          state: {
            width: s.width, height: s.height,
            A: pt(s.A), B: pt(s.B), C: pt(s.C), angle: round(s.angle),
          },
          ...reading(s),
        };
      },
    },
    angle_regimes: {
      describe:
        "Classify 1 to 60 apex angles (degrees, each strictly between 0 and 180) in one call: tiles, three_at_45, tiny_gap_above_45, crosses_above_45, golden_36, collapses_at_60 or stops_above_60, with the core's equalSides check, partsRatio (sum of the four pieces over the area of ABC) and the distance DF. Useful for seeing that the equalities hold for almost every angle below 60° except a very narrow gap just above 45°.",
      args: '{ "angles": [30, 36, 44, 45, 45.1, 45.2, 46, 55, 60, 65] }',
      run: (args) => {
        const list = numArray(args, "angles");
        if (list.length < 1 || list.length > 60) {
          throw new Error('"angles" must be an array of 1 to 60 numbers');
        }
        list.forEach(checkAngle);
        const C = core();
        const rows = list.map((angle) => {
          const s = C.start({ angle });
          return { angle: round(angle), ...classify(C, s, C.analyze(s), C.claims(s)) };
        });
        return {
          rows,
          note: "Below 45° the four pieces tile ABC; at 45° D = F; the tiny gap just above 45° has F parked on D so AF ≠ EF; after that F passes D and the lines cross; 36° is golden; above 60° the chain stops.",
        };
      },
    },
  };
}

/** The page saves { width, height, A, B, C, angle } with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported BID state version ${stateVersion}`);
  const s = readState(state);
  return {
    stateVersion,
    width: s.width,
    height: s.height,
    A: pt(s.A),
    B: pt(s.B),
    C: pt(s.C),
    angle: round(s.angle),
    reading: reading(s),
  };
}
