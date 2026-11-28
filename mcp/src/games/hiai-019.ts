/*
 * run_game_logic actions and saved-position reader for HIAI019 (Circle Chains
 * on Napoleon Triangles), a problem of Hirotaka Ebisui from Bogomolny's page.
 *
 * The real core is hiai-019/hiai-019-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the applet's 400 x 250 view, y down. On each
 * side of ABC an equilateral (Napoleon) triangle and its circumcircle are
 * drawn; D on the first circle is joined to B and extended to E on the next,
 * E to C gives F, and F to A lands back at D. The chain draws an equilateral
 * DEF, and the three circles share a point (a Fermat point for an acute
 * triangle, seen under 120/120/120 or 60/60/120 degrees). The inscribed
 * angles at D, E and F are 60 or 120 degrees.
 *
 * One applet quirk survives in the core: a cut whose line is at most one pixel
 * in both directions is swallowed, leaving that chain point unmoved. Such a
 * degenerate picture simply reports a large closure here. This is an
 * illustration, so there is no win or loss. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { center: Point; r: number };
type State = {
  width: number; height: number; center: Point; radius: number;
  vertices: Point[]; napoleons: Point[]; circles: Circle[]; points: Point[];
  signedAngles: number[]; selected: number;
  showNames: boolean; showPremises: boolean; showStatement: boolean;
};
type Measures = {
  napoleons: Point[]; circles: Circle[]; sides: number[]; triangleAngles: number[];
  inscribed: number[]; closure: number; equilateral: number; onCircleError: number;
};
type Common = { point: Point; error: number } | null;
interface Core {
  WIDTH: number; HEIGHT: number; PAD: number;
  dist(p: Point, q: Point): number;
  getNapoleons(v: Point[]): Point[];
  getCircles(v: Point[], n: Point[]): Circle[];
  computeAngles(c: Circle[], p: Point[]): number[];
  start(options?: Json): State;
  compute(s: State): Measures;
  commonPoint(s: State, tolerance?: number): Common;
  turnPoint(s: State, index: number, delta: number): State;
  describe(s: State): string;
  result(s: State): null;
}

const core = (): Core => cores["hiai-019"].Hiai019Core as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number): number => Number.isFinite(v) ? Number(v.toFixed(6)) : NaN;
const fine = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toPrecision(6)) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const deg = (v: number): number | null => fine(v * 180 / Math.PI);
const near = (a: number, b: number, tol = 1e-4): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A board point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string): Point {
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

/** Optional positive board dimension, defaulting to the applet's size. */
function readDim(args: Json, key: string, fallback: number): number {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`argument "${key}" must be a positive number, got ${JSON.stringify(v)}`);
  }
  return n;
}

/**
 * A real core state: three corners (or the opening triangle), a deterministic
 * replacement for Reset's random starting angle, optional display flags and an
 * optional slide of D along its circle. Supplied corners are never clamped.
 */
function readState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with A, B, C points and optional turn/width/height");
  }
  const width = readDim(args, "width", C.WIDTH);
  const height = readDim(args, "height", C.HEIGHT);
  const raw = ["A", "B", "C"].map((name) =>
    args[name] === undefined || args[name] === null ? null : readPoint(args[name], name));
  let s: State;
  if (raw.every((p) => p === null)) {
    s = C.start({ width, height, random: () => 0.5 });
  } else {
    if (raw.some((p) => p === null)) {
      throw new Error("supply all three of A, B and C, or omit all three for the opening triangle");
    }
    const v = raw as Point[];
    const side = Math.min(C.dist(v[0], v[1]), C.dist(v[1], v[2]), C.dist(v[2], v[0]));
    if (!(side > 1e-9)) {
      throw new Error("A, B and C must be three distinct corners; the circles need a proper triangle");
    }
    s = C.start({ width, height, vertices: v, random: () => 0.5 });
  }
  for (const key of ["showNames", "showPremises", "showStatement"] as const) {
    const v = args[key];
    if (v !== undefined && v !== null) {
      if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
      s = { ...s, [key]: v };
    }
  }
  if (args.turn !== undefined && args.turn !== null) {
    const turn = Number(args.turn);
    if (!Number.isFinite(turn)) throw new Error('argument "turn" must be a finite number of radians');
    if (Math.abs(turn) > 4 * Math.PI) {
      throw new Error('argument "turn" must be between -4π and 4π radians');
    }
    s = C.turnPoint(s, 0, turn);
  }
  return s;
}

/** The core's whole reading of one diagram. */
function reading(C: Core, s: State) {
  const g = C.compute(s);
  const meet = C.commonPoint(s, 1e-4);
  const sides = ["AB", "BC", "CA"];
  const circles = g.circles.map((c, i) => ({
    side: sides[i],
    center: pt(c.center), radius: fine(c.r),
    through: [pt(s.vertices[i]), pt(s.vertices[(i + 1) % 3]), pt(g.napoleons[i])],
  }));
  const inscribedErrors = g.inscribed.map((a) =>
    Math.min(Math.abs(a - Math.PI / 3), Math.abs(a - 2 * Math.PI / 3)));
  return {
    board: { width: s.width, height: s.height },
    triangle: { A: pt(s.vertices[0]), B: pt(s.vertices[1]), C: pt(s.vertices[2]) },
    napoleons: g.napoleons.map(pt),
    circles,
    chain: {
      D: pt(s.points[0]), E: pt(s.points[1]), F: pt(s.points[2]),
      signedAngles: s.signedAngles.map((a) => fine(a)),
    },
    closure: fine(g.closure), closesBackAtD: g.closure <= 1e-4,
    onCircleError: fine(g.onCircleError),
    def: {
      sides: g.sides.map((v) => fine(v)),
      spread: fine(g.equilateral),
      anglesDegrees: g.triangleAngles.map(deg),
      equilateral: g.equilateral <= 1e-4 && g.triangleAngles.every((a) => near(a, Math.PI / 3)),
    },
    inscribed: {
      anglesDegrees: g.inscribed.map(deg),
      errorTo60Or120: inscribedErrors.map((v) => fine(v)),
      all60Or120: inscribedErrors.every((e) => e <= 1e-4),
    },
    common: meet
      ? { point: pt(meet.point), error: fine(meet.error), tolerance: 1e-4 }
      : null,
    sentence: C.describe(s),
    result: C.result(s),
  };
}

/** Angle at p between rays p->a and p->b, in radians (NaN for a zero ray). */
function angleAt(p: Point, a: Point, b: Point): number {
  const ux = a.x - p.x, uy = a.y - p.y;
  const wx = b.x - p.x, wy = b.y - p.y;
  const denom = Math.hypot(ux, uy) * Math.hypot(wx, wy);
  if (!(denom > 0)) return NaN;
  return Math.acos(clamp((ux * wx + uy * wy) / denom, -1, 1));
}

/** The common point's Fermat angle pattern, as checked in porting/check-hiai-019.mjs. */
function fermatReading(C: Core, s: State) {
  const common = C.commonPoint(s, 1e-4);
  const v = s.vertices;
  const inner = v.map((a, j) => angleAt(a, v[(j + 1) % 3], v[(j + 2) % 3]));
  const acute = inner.every((a) => Number.isFinite(a) && a < Math.PI / 2);
  let viewing: number[] | null = null;
  let sorted: number[] | null = null;
  let pattern = "no common point found";
  let inside = false, outside = false;
  if (common) {
    viewing = v.map((a, j) => angleAt(common.point, a, v[(j + 1) % 3]));
    sorted = viewing.slice().sort((a, b) => a - b);
    inside = sorted.every((a) => near(a, 2 * Math.PI / 3));
    outside = near(sorted[0], Math.PI / 3) && near(sorted[1], Math.PI / 3) &&
      near(sorted[2], 2 * Math.PI / 3);
    pattern = inside ? "120,120,120 (first Fermat point)"
      : outside ? "60,60,120 (second Fermat point)" : "other angle pattern";
  }
  return {
    innerAnglesDegrees: inner.map(deg),
    acute,
    commonPoint: common ? pt(common.point) : null,
    commonError: common ? fine(common.error) : null,
    tolerance: 1e-4,
    viewingAnglesDegrees: viewing ? viewing.map(deg) : null,
    sortedViewingAnglesDegrees: sorted ? sorted.map(deg) : null,
    pattern,
    inside, outside,
    fermatPatternMatches: acute && (inside || outside),
  };
}

/* The fixture's corners, with D slid a little way along its circle. */
const EXAMPLE_ARGS = '{"A":[254,125],"B":[175,168],"C":[174,81],"turn":0.9}';

export function actions(): GameActions {
  return {
    circle_chain: {
      describe:
        "For a triangle ABC (corners as [x, y] or { x, y } on the applet's 400 x 250 board, y down; omit all three for the opening triangle), run the real core and report the three equilateral Napoleon triangles on the sides, their circumcircles with centres and radii, and the chain points D, E, F. It measures whether a lap D-B-E-C-F-A-D returns to D (closure), the three sides and angles of DEF (equilateral?), the inscribed angles at D, E, F, and the page's status sentence. Optional width/height resize the board; optional turn (radians, -4π to 4π) and the three display flags change only the picture. The example uses the fixture's triangle and turn=0.9.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const r = reading(C, s);
        return {
          ...r,
          flags: {
            showNames: s.showNames, showPremises: s.showPremises, showStatement: s.showStatement,
          },
          note:
            `Starting from D=(${r.chain.D!.x}, ${r.chain.D!.y}) the lap misses D by ${r.closure} board units, ` +
            `so it ${r.closesBackAtD ? "closes back at D" : "does not close (a swallowed one-pixel cut is the likely cause)"}. ` +
            `DEF's sides are ${r.def.sides.join(", ")} (spread ${r.def.spread}), and its angles are ` +
            `${r.def.anglesDegrees.join("°, ")}°, ${r.def.equilateral ? "equilateral" : "not equilateral here"}. ` +
            `This is an illustration, so there is no win or loss.`,
        };
      },
    },
    fermat_and_angles: {
      describe:
        "For the same triangle and chain (arguments as in circle_chain), use the real core to find the common point of the three circumcircles and check the page's angle claims. It reports the three viewing angles at that point (120°,120°,120° for the first Fermat point or 60°,60°,120° for the second when ABC is acute), the three inner angles of ABC, the inscribed angles at D, E, F against 60°/120°, and the three 60° angles of DEF. A large closure means a degenerate one-pixel cut, so the porism and its angle claims are only checked on clean pictures.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const r = reading(C, s);
        const f = fermatReading(C, s);
        return {
          board: r.board,
          triangle: r.triangle,
          closure: r.closure,
          common: r.common,
          fermat: f,
          inscribed: r.inscribed,
          def: r.def,
          result: r.result,
          note:
            (f.commonPoint
              ? `The three Napoleon circumcircles share a point at (${f.commonPoint.x}, ${f.commonPoint.y}), ${f.commonError} units off each circle. `
              : "The core could not locate a common point here; move the corners apart and try again. ") +
            (f.acute
              ? `ABC is acute, and its viewing angles ${f.viewingAnglesDegrees ? f.viewingAnglesDegrees.join("°, ") + "°" : ""} match the ${f.pattern} Fermat pattern=${f.fermatPatternMatches}. `
              : `ABC is not acute (inner angles ${f.innerAnglesDegrees.join("°, ")}°), so the Fermat-point claim is not expected. `) +
            `The inscribed angles at D, E, F are ${r.inscribed.anglesDegrees.join("°, ")}°, all 60 or 120=${r.inscribed.all60Or120}; ` +
            `DEF's angles are ${r.def.anglesDegrees.join("°, ")}°, equilateral=${r.def.equilateral}. ` +
            "This is an illustration, so there is no win or loss.",
        };
      },
    },
  };
}

/** Saved fields echoed back, with a fresh core reading of the same picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported HIAI019 state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved HIAI019 position must be an object");
  }
  const numOrNull = (v: unknown): number | null => {
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? round(n) : null;
  };
  const optPoint = (raw: unknown, label: string): Point | null => {
    try { return pt(readPoint(raw, label)); } catch { return null; }
  };
  const savedPoints = (raw: unknown, label: string): (Point | null)[] | null =>
    Array.isArray(raw) && raw.length === 3
      ? raw.map((p, i) => optPoint(p, `${label}[${i}]`)) : null;
  const saved = {
    stateVersion,
    width: numOrNull(state.width), height: numOrNull(state.height),
    center: optPoint(state.center, "saved center"), radius: numOrNull(state.radius),
    vertices: savedPoints(state.vertices, "saved vertices"),
    napoleons: savedPoints(state.napoleons, "saved napoleons"),
    circles: Array.isArray(state.circles) && state.circles.length === 3
      ? state.circles.map((c, i) => ({
          center: optPoint((c as Json).center, `saved circles[${i}].center`),
          radius: numOrNull((c as Json).r),
        })) : null,
    points: savedPoints(state.points, "saved points"),
    signedAngles: Array.isArray(state.signedAngles) && state.signedAngles.length === 3
      ? state.signedAngles.map((a) => numOrNull(a)) : null,
    selected: numOrNull(state.selected),
    showNames: state.showNames === true,
    showPremises: state.showPremises === true,
    showStatement: state.showStatement === true,
  };

  try {
    const C = core();
    const w = saved.width !== null && saved.width > 0 ? saved.width : C.WIDTH;
    const h = saved.height !== null && saved.height > 0 ? saved.height : C.HEIGHT;
    let vertices: Point[] | null = null;
    let points: Point[] | null = null;
    try {
      if (!Array.isArray(state.vertices) || state.vertices.length !== 3) {
        throw new Error("saved vertices must have three corners");
      }
      vertices = state.vertices.map((p, i) => readPoint(p, `saved vertices[${i}]`));
      const side = Math.min(C.dist(vertices[0], vertices[1]), C.dist(vertices[1], vertices[2]),
        C.dist(vertices[2], vertices[0]));
      if (!(side > 1e-9)) throw new Error("saved corners are coincident");
      if (!Array.isArray(state.points) || state.points.length !== 3) {
        throw new Error("saved points must have three chain points");
      }
      points = state.points.map((p, i) => readPoint(p, `saved points[${i}]`));
    } catch {
      vertices = null;
      points = null;
    }
    const rebuilt = vertices !== null && points !== null;
    const s: State = rebuilt
      ? {
          width: w, height: h,
          center: saved.center ?? { x: w / 2, y: h / 2 },
          radius: saved.radius ?? Math.min(w, h) / 5,
          vertices: vertices as Point[], points: points as Point[],
          napoleons: C.getNapoleons(vertices as Point[]),
          circles: C.getCircles(vertices as Point[], C.getNapoleons(vertices as Point[])),
          signedAngles: C.computeAngles(
            C.getCircles(vertices as Point[], C.getNapoleons(vertices as Point[])),
            points as Point[]),
          selected: saved.selected !== null && Number.isInteger(saved.selected) ? saved.selected : 0,
          showNames: saved.showNames, showPremises: saved.showPremises, showStatement: saved.showStatement,
        }
      : C.start({});
    const r = reading(C, s);
    const f = fermatReading(C, s);
    let agreement: Json | null = null;
    if (rebuilt && Array.isArray(state.napoleons) && state.napoleons.length === 3 &&
        Array.isArray(state.circles) && state.circles.length === 3) {
      const napoleons = state.napoleons as unknown[];
      const circles = state.circles as Json[];
      /* Compare unrounded saved values: pt() rounds for display only. */
      const rawPoint = (raw: unknown, label: string): Point | null => {
        try { return readPoint(raw, label); } catch { return null; }
      };
      const napErr = Math.max(...napoleons.map((raw, i) => {
        const p = rawPoint(raw, `saved napoleons[${i}]`);
        return p ? C.dist(p, s.napoleons[i]) : NaN;
      }));
      const centreErr = Math.max(...circles.map((c, i) => {
        const p = rawPoint(c.center, `saved circles[${i}].center`);
        return p ? C.dist(p, s.circles[i].center) : NaN;
      }));
      const radiusErr = Math.max(...circles.map((c, i) => Math.abs(Number(c.r) - s.circles[i].r)));
      agreement = {
        napoleonsMaxPointError: fine(napErr),
        circlesMaxCentreError: fine(centreErr),
        circlesMaxRadiusError: fine(radiusErr),
        chainOnCircleMaxError: fine(C.compute(s).onCircleError),
      };
    }
    return {
      ...state,
      stateVersion,
      saved,
      rebuiltFromSavedGeometry: rebuilt,
      reading: r,
      fermat: f,
      savedAgreement: agreement,
      result: C.result(s),
      note: !rebuilt
        ? "The saved corners or chain points could not be read, so the core's opening picture was rebuilt; the reading below is of that figure. " +
          "Track.state normally saves the whole core state (board, centre, radius, three corners, Napoleon apexes and circles, chain points and their signed angles). "
        : "Track.state saves the whole core state: board size, centre and radius, the three corners, the three Napoleon apexes and circumcircles, the chain points D/E/F, their signed angles and the three display flags. " +
          "The reader rebuilds the three circles from the saved corners, then re-measures the lap's closure, DEF's sides and angles, the 60-or-120 inscribed angles and the common (Fermat) point from the saved chain; savedAgreement checks the stored apexes and circles against that recomputation. " +
          `The lap ${r.closesBackAtD ? "closes back at D" : "does not close (a degenerate one-pixel cut is likely)"} and the common point is ${f.commonPoint ? `at (${f.commonPoint.x}, ${f.commonPoint.y}) with pattern ${f.pattern}` : "not found"}. ` +
          "This is an illustration: there is no win or loss.",
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      saved,
      rebuiltFromSavedGeometry: false,
      reading: null,
      fermat: null,
      savedAgreement: null,
      note: `The saved position cannot be measured by the core: ${(err as Error).message}`,
    };
  }
}
