/*
 * run_game_logic actions and saved-position reader for Ceva Cradle.
 *
 * The real core is ceva-cradle/ceva-cradle-core.js, copied into
 * src/generated/cores/ at build time. A is a triangle ABC with X on BC, Y on
 * CA and Z on AB. An arbitrary point O gives D = AO ∩ YZ, E = BO ∩ XZ and
 * F = CO ∩ XY in the small triangle XYZ. The illustration claims
 *
 *   (AZ/ZB)(BX/XC)(CY/YA) = (ZD/DY)(YF/FX)(XE/EZ)
 *
 * for every O: the left product depends only on X, Y, Z, while the right one
 * can be rewritten with the sine form of Ceva for the three lines through O,
 * whose sine products are reciprocal and cancel. Hence AX, BY, CZ concur
 * exactly when XD, YE, ZF of XYZ concur. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["ceva-cradle"].CevaCradleCore;
type C = ReturnType<typeof core>;
type Point = { x: number; y: number };
type Diagram = {
  valid: boolean;
  D: Point | null; E: Point | null; F: Point | null;
  G: Point | null; H: Point | null;
  left: number | null; right: number | null;
  finished: boolean;
  M: Point | null; N: Point | null;
};
type Claims = {
  constructed: boolean; identity: boolean;
  concurrentTogether: boolean; feetCorrect: boolean;
};
type Position = {
  A: Point; B: Point; C: Point; X: Point; Y: Point; Z: Point; O: Point;
  width?: number; height?: number;
  tx: number; ty: number; tz: number;
};

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined ? null : r6(v);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p ? { x: r6(p.x), y: r6(p.y) } : null;
const finite = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
const cross = (a: Point, b: Point, c: Point): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Both the page's saved {x, y} points and short [x, y] JSON arguments. */
function readPoint(v: unknown, label: string): Point {
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    return { x: num({ x: v[0] }, "x"), y: num({ y: v[1] }, "y") };
  }
  if (v && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`${label} must be [x, y] or { "x": ..., "y": ... }`);
}

/** A stored line parameter: weight of the first end in onLine(m1, m2, t). */
function readParameter(v: unknown, label: string, fallback: number): number {
  if (v === undefined || v === null) return fallback;
  const n = num({ [label]: v }, label);
  if (n < 0 || n > 1) throw new Error(`${label} must be between 0 and 1`);
  return n;
}

/**
 * Rebuild the page's position from the arguments. X, Y and Z may arrive as
 * points (projected onto their sides exactly as movePoint does) or as the
 * stored tx/ty/tz parameters; everything else falls back to start()'s seed.
 */
function buildPosition(K: C, args: Json, strict: boolean): Position {
  const seed = K.start({}) as Position;
  const A = args.A === undefined || args.A === null ? seed.A : readPoint(args.A, "A");
  const B = args.B === undefined || args.B === null ? seed.B : readPoint(args.B, "B");
  const Cc = args.C === undefined || args.C === null ? seed.C : readPoint(args.C, "C");
  const scale = Math.max(1, dist(A, B) ** 2, dist(B, Cc) ** 2, dist(Cc, A) ** 2);
  if (Math.abs(cross(A, B, Cc)) < 1e-9 * scale) {
    throw new Error("A, B and C must be three distinct, non-collinear points");
  }
  const tx = args.tx !== undefined && args.tx !== null
    ? readParameter(args.tx, "tx", seed.tx)
    : args.X === undefined || args.X === null
      ? seed.tx
      : K.parameterOn(B, Cc, readPoint(args.X, "X"));
  const ty = args.ty !== undefined && args.ty !== null
    ? readParameter(args.ty, "ty", seed.ty)
    : args.Y === undefined || args.Y === null
      ? seed.ty
      : K.parameterOn(Cc, A, readPoint(args.Y, "Y"));
  const tz = args.tz !== undefined && args.tz !== null
    ? readParameter(args.tz, "tz", seed.tz)
    : args.Z === undefined || args.Z === null
      ? seed.tz
      : K.parameterOn(A, B, readPoint(args.Z, "Z"));
  const O = args.O === undefined || args.O === null ? seed.O : readPoint(args.O, "O");
  if (strict) {
    if (tx <= 0 || tx >= 1 || ty <= 0 || ty >= 1 || tz <= 0 || tz >= 1) {
      throw new Error("X, Y and Z must lie strictly inside BC, CA and AB: a side corner makes a product divide by zero");
    }
    if (Math.min(dist(O, A), dist(O, B), dist(O, Cc)) < K.NEAR) {
      throw new Error(`O must be at least ${K.NEAR} board unit from A, B and C: the applet stops computing there`);
    }
  }
  return K.withSides({ ...seed, A, B, C: Cc, O, tx, ty, tz }) as Position;
}

/** Everything the core measures at one position, in tutor-friendly units. */
function reading(K: C, s: Position) {
  const d = K.compute(s) as Diagram;
  const cl = K.claims(s) as Claims;
  const productScale = Math.max(1, Math.abs(d.left ?? 0), Math.abs(d.right ?? 0));
  const leftConcurrent = finite(d.left) && Math.abs(d.left - 1) < K.TOL;
  const rightConcurrent = finite(d.right) && Math.abs(d.right - 1) < K.TOL;
  const productsEqual = finite(d.left) && finite(d.right) &&
    Math.abs(d.left - d.right) < 1e-7 * productScale;
  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    sidePoints: {
      X: { on: "BC", point: pt(s.X) },
      Y: { on: "CA", point: pt(s.Y) },
      Z: { on: "AB", point: pt(s.Z) },
    },
    sideParameters: { tx: r6(s.tx), ty: r6(s.ty), tz: r6(s.tz) },
    O: pt(s.O),
    intersections: {
      D: { lines: "AO ∩ YZ", point: pt(d.D) },
      E: { lines: "BO ∩ XZ", point: pt(d.E) },
      F: { lines: "CO ∩ XY", point: pt(d.F) },
    },
    products: {
      ABC: maybe(d.left),
      XYZ: maybe(d.right),
      equal: productsEqual,
    },
    concurrence: {
      ABC: leftConcurrent,
      XYZ: rightConcurrent,
      agree: cl.concurrentTogether,
      both: d.finished,
    },
    meetingPoints: d.finished && d.M && d.N
      ? { M: { of: "AX, BY, CZ", point: pt(d.M) }, N: { of: "XD, YE, ZF", point: pt(d.N) } }
      : null,
    hintFeet: d.valid ? { G: pt(d.G), H: pt(d.H) } : null,
    claims: cl,
    note: !d.valid
      ? "O is within 1 unit of a corner, so the applet stops computing: move O away to build the cradle."
      : `(AZ/ZB)(BX/XC)(CY/YA) = ${maybe(d.left)} depends only on X, Y, Z and equals 1 exactly when AX, BY, CZ meet. (ZD/DY)(YF/FX)(XE/EZ) = ${maybe(d.right)} tests XD, YE, ZF in the small triangle. The two products are equal for every O, because the sine products of the three lines through O are reciprocal and cancel; so the two concurrences happen together. G and H are the perpendicular feet from Y and Z to AO used in the hint.`,
  };
}

export function actions(): GameActions {
  return {
    cradle: {
      describe:
        "For a triangle A, B, C (each [x, y] or { x, y } in page coordinates, y downward), X on BC, Y on CA, Z on AB and any point O, report D = AO ∩ YZ, E = BO ∩ XZ, F = CO ∩ XY, the products (AZ/ZB)(BX/XC)(CY/YA) and (ZD/DY)(YF/FX)(XE/EZ), whether they are equal, whether AX, BY, CZ and XD, YE, ZF concur (tolerance 0.01), and the two meeting points M, N when both do. X, Y, Z may be given as points on their sides or by the stored parameters tx (weight of B on BC), ty (weight of C on CA), tz (weight of A on AB) between 0 and 1; omitted points keep the start values. O must stay at least 1 unit from every corner. Try tx = 0.6 with X = [7.6, 3.6], Y = [2, 4.5], Z = [5, 0] on a triangle A = [0, 0], B = [10, 0], C = [4, 9] with O = [4, 4]: the products are about 0.667, so neither triple of cevians meets.",
      args: '{ "A": [0, 0], "B": [10, 0], "C": [4, 9], "X": [7.6, 3.6], "Y": [2, 4.5], "Z": [5, 0], "O": [4, 4] }',
      run: (args) => {
        const K = core();
        return reading(K, buildPosition(K, args, true));
      },
    },
    check_claims: {
      describe:
        "Check the illustration's claims at the same configuration: D, E and F really lie on both their lines, the two triple products are equal for this O, the two concurrences agree (both products within 0.01 of 1 or neither), and the hint feet G, H from Y and Z are perpendicular to AO. Each claim is returned as a boolean with the names of any that fail. With X, Y, Z at the side midpoints the products are both 1 and all claims hold; with X at tx = 0.6 neither concurrence happens but the identity still does.",
      args: '{ "A": [0, 0], "B": [10, 0], "C": [4, 9], "tx": 0.5, "ty": 0.5, "tz": 0.5, "O": [4, 4] }',
      run: (args) => {
        const K = core();
        const r = reading(K, buildPosition(K, args, true));
        const cl = r.claims;
        const names = ["constructed", "identity", "concurrentTogether", "feetCorrect"] as const;
        const failed = names.filter((name) => cl[name] !== true);
        return {
          constructed: cl.constructed,
          identity: cl.identity,
          concurrentTogether: cl.concurrentTogether,
          feetCorrect: cl.feetCorrect,
          allHold: failed.length === 0,
          failed,
          products: r.products,
          concurrence: r.concurrence,
          note: failed.length
            ? "One or more of the page's claims fail at this position; move the points apart and away from the corners."
            : "All four claims hold: the intersections are correctly built, the two products agree even for this arbitrary O, the concurrences occur together, and the hint feet are perpendicular to AO.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, read again through the core. */
export function position(state: Json, stateVersion: number): unknown {
  const K = core();
  const savedPoint = (key: string) =>
    state[key] && typeof state[key] === "object" ? pt(state[key] as Point) : null;
  const saved = {
    stateVersion,
    A: savedPoint("A"), B: savedPoint("B"), C: savedPoint("C"),
    X: savedPoint("X"), Y: savedPoint("Y"), Z: savedPoint("Z"), O: savedPoint("O"),
    tx: state.tx === undefined ? null : maybe(num(state, "tx")),
    ty: state.ty === undefined ? null : maybe(num(state, "ty")),
    tz: state.tz === undefined ? null : maybe(num(state, "tz")),
    width: state.width === undefined ? null : r6(num(state, "width")),
    height: state.height === undefined ? null : r6(num(state, "height")),
  };
  try {
    const s = buildPosition(K, state, false);
    const r = reading(K, s);
    return {
      ...saved,
      result: K.result(s),
      reading: r,
      note:
        "Track.state saves the seven draggable points and their side parameters, not the derived intersections. The reading recomputes D, E, F, both products and the two meeting points with the same construction the page uses, so the saved picture can be checked against the claim that the products are equal for every O.",
    };
  } catch (e) {
    return {
      ...saved,
      reading: null,
      note: `The saved position cannot be measured: ${(e as Error).message}`,
    };
  }
}
