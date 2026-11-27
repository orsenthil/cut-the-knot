/*
 * run_game_logic actions and saved-position reader for Cy Quadri (Bogomolny's
 * "Angle Bisectors in a Quadrilateral"). All geometry comes from the real core,
 * cy-quadri/cy-quadri-core.js, copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 *
 * The construction: bisect the angle at each corner A, B, C, D of a
 * quadrilateral (internally, or externally by taking the perpendicular ray),
 * then meet neighbouring bisectors to get four points AB, BC, CD, DA. Those
 * four points are concyclic in both modes — the page's first claim. The
 * quadrilateral they form therefore has opposite angles summing to 180° when
 * it is convex — the page's second claim. The core measures both residuals
 * with the applet's own line-intersection and circumcircle arithmetic, so a
 * drawing only has to be non-degenerate for the claims to show up.
 */

import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cy-quadri"].CyQuadriCore;
type Core = ReturnType<typeof core>;
type Geometry = NonNullable<ReturnType<Core["compute"]>>;
type Point = { x: number; y: number };
type Quad = { A: Point; B: Point; C: Point; D: Point };

const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: Point | null | undefined): Point | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;
const finite = (v: number): number | null => (Number.isFinite(v) ? v : null);

/** A finite number from a nested point/circle object, with a helpful message. */
function numField(o: Json, field: string, outer: string): number {
  const v = o[field];
  const n = Number(v);
  if (v === undefined || v === null || !Number.isFinite(n)) {
    throw new Error(`"${outer}.${field}" must be a number, got ${JSON.stringify(v)}`);
  }
  return n;
}

/** Accept [x, y] or { "x": ..., "y": ... }, falling back to a reset corner. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: numField(o, "x", key), y: numField(o, "y", key) };
  }
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(v)}`);
}

/** Missing corners become the applet's reset corners, never invented values. */
function readQuad(C: Core, args: Json): Quad {
  const fresh = C.start();
  return {
    A: readPoint(args, "A", fresh.A),
    B: readPoint(args, "B", fresh.B),
    C: readPoint(args, "C", fresh.C),
    D: readPoint(args, "D", fresh.D),
  };
}

/** One bisector mode. The core returns null when its arithmetic degenerates. */
function computeMode(C: Core, q: Quad, internal: boolean): Geometry | null {
  return C.compute(q.A, q.B, q.C, q.D, internal);
}

function bothModes(C: Core, q: Quad): { internal: Geometry | null; external: Geometry | null } {
  const internal = computeMode(C, q, true);
  const external = computeMode(C, q, false);
  if (!internal && !external) {
    throw new Error(
      "those four corners are degenerate in both bisector modes: two corners coincide, a side has zero length, or the bisectors are parallel. Move a corner and try again.",
    );
  }
  return { internal, external };
}

/** Tutor-friendly reading of one construction, in the page's 400 x 300 units. */
function modeReading(C: Core, g: Geometry) {
  const crossings = g.crossings as Record<string, Point>;
  return {
    crossings: {
      AB: pt(crossings.AB), BC: pt(crossings.BC),
      CD: pt(crossings.CD), DA: pt(crossings.DA),
    },
    circle: { center: pt(g.circle.c), radius: round(g.circle.r) },
    maxRadialError: finite(g.radialError),
    tolerance: g.tol,
    oppositeSumsDeg: g.oppositeSums.map((v: number) => round(v)),
    crossingsConvex: C.convexQuad(g.order),
    claims: { cyclic: g.claims.cyclic, opposite180: g.claims.opposite180 },
  };
}

export function actions(): GameActions {
  return {
    concyclic_crossings: {
      describe:
        "For quadrilateral corners A, B, C, D as [x, y] points (or {x, y} objects) in the page's 400 x 300 board, with y increasing downwards, rebuild the four internal and external angle bisectors with the real core and report the crossings of neighbouring bisectors (AB, BC, CD, DA) and the circle through them in both modes. It also reports the largest distance from a crossing to that circle and the core's tolerance, which shows the four crossings are concyclic whether the starting quadrilateral is convex, concave or crossed.",
      args: '{ "A": [125, 160], "B": [280, 240], "C": [320, 80], "D": [180, 80] }',
      run: (args) => {
        const C = core();
        const q = readQuad(C, args);
        const { internal, external } = bothModes(C, q);
        return {
          vertices: { A: pt(q.A), B: pt(q.B), C: pt(q.C), D: pt(q.D) },
          internal: internal ? modeReading(C, internal) : null,
          external: external ? modeReading(C, external) : null,
          note:
            "The internal bisectors of the four corners meet in four points that lie on one circle; replacing each by the perpendicular external bisector gives four different points, also concyclic. A null mode means a pair of bisectors is parallel for these corners, so the applet cannot draw that mode.",
        };
      },
    },
    check_claims: {
      describe:
        "Test the illustration's two claims with the real core for corners A, B, C, D: the four bisector crossings are concyclic, and the opposite angles of the quadrilateral they form sum to 180 degrees when that quadrilateral is convex. Runs both internal and external bisectors and returns a boolean per claim, the two measured angle sums, the convexity flag, the failed claim names and a note saying when the 180-degree claim applies.",
      args: '{ "A": [100, 100], "B": [300, 100], "C": [300, 200], "D": [100, 200] }',
      run: (args) => {
        const C = core();
        const q = readQuad(C, args);
        const { internal, external } = bothModes(C, q);
        const check = (g: Geometry | null) => {
          if (!g) return null;
          const failed = (["cyclic", "opposite180"] as const).filter(
            (name) => g.claims[name] !== true,
          );
          return {
            crossingsConcyclic: g.claims.cyclic,
            oppositeAnglesSumTo180: g.claims.opposite180,
            crossingQuadConvex: C.convexQuad(g.order),
            oppositeSumsDeg: g.oppositeSums.map((v: number) => round(v)),
            radialError: finite(g.radialError),
            tolerance: g.tol,
            failed,
            allHold: failed.length === 0,
          };
        };
        return {
          vertices: { A: pt(q.A), B: pt(q.B), C: pt(q.C), D: pt(q.D) },
          internal: check(internal),
          external: check(external),
          note:
            "Concyclicity is the direct claim and holds here for the drawn crossings. The 180-degree wording is about an ordinary convex quadrilateral: the core only asserts it when the quadrilateral formed by the crossings is convex (crossingQuadConvex); otherwise opposite180 is reported false even though the four points are still on one circle.",
        };
      },
    },
  };
}

/* ---- helpers for the saved state (Track.state in cy-quadri/cy-quadri.js) ---- */

function safePoint(value: unknown): Point | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Json;
  const x = Number(o.x), y = Number(o.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function safePointMap(value: unknown): Record<string, Point> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, Point> = {};
  for (const [key, v] of Object.entries(value as Json)) {
    const p = safePoint(v);
    if (p) out[key] = pt(p)!;
  }
  return Object.keys(out).length ? out : null;
}

function safeCircle(value: unknown): { c: Point; r: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Json;
  const c = safePoint(o.c);
  const r = Number(o.r);
  return c && Number.isFinite(r) ? { c: pt(c)!, r: round(r) } : null;
}

/** The page's saved drawing and options, plus a fresh reading from the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Cy Quadri state version ${stateVersion}`);
  }
  const C = core();
  const fresh = C.start();
  const A = readPoint(state, "A", fresh.A);
  const B = readPoint(state, "B", fresh.B);
  const Cc = readPoint(state, "C", fresh.C);
  const D = readPoint(state, "D", fresh.D);
  const savedOptions = state.options && typeof state.options === "object"
    ? state.options as Json
    : null;
  const internal = savedOptions ? savedOptions.internal !== false : !!fresh.options.internal;
  const options = {
    internal,
    angles: savedOptions ? savedOptions.angles === true : !!fresh.options.angles,
  };

  const savedRays = safePointMap(state.rays);
  const savedCrossings = safePointMap(state.crossings);
  const savedCircle = safeCircle(state.circle);
  const savedClaims = state.claims && typeof state.claims === "object"
    ? state.claims as Json
    : null;

  const q: Quad = { A, B, C: Cc, D };
  const g = computeMode(C, q, internal);
  const other = computeMode(C, q, !internal);

  const diffs: Array<{ field: string; saved: number; core: number; diff: number }> = [];
  const compare = (field: string, saved: number, value: number): void => {
    diffs.push({ field, saved: round(saved), core: round(value), diff: round(Math.abs(saved - value), 9) });
  };
  if (g) {
    const crossings = g.crossings as Record<string, Point>;
    if (savedCrossings) {
      for (const key of Object.keys(savedCrossings)) {
        const s = savedCrossings[key], c = crossings[key];
        if (c) {
          compare(`crossings.${key}.x`, s.x, c.x);
          compare(`crossings.${key}.y`, s.y, c.y);
        }
      }
    }
    if (savedCircle) {
      compare("circle.c.x", savedCircle.c.x, g.circle.c.x);
      compare("circle.c.y", savedCircle.c.y, g.circle.c.y);
      compare("circle.r", savedCircle.r, g.circle.r);
    }
  }
  const savedMatchesCore = diffs.length > 0
    && diffs.every((d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)));

  return {
    ...state,
    stateVersion,
    A: pt(A), B: pt(B), C: pt(Cc), D: pt(D),
    rays: savedRays,
    crossings: savedCrossings,
    circle: savedCircle,
    options,
    claims: savedClaims,
    core: {
      mode: internal ? "internal" : "external",
      reading: g ? modeReading(C, g) : null,
      otherMode: other ? modeReading(C, other) : null,
    },
    savedMatchesCore,
    differences: diffs,
    note: g
      ? `With ${internal ? "internal" : "external"} bisectors the saved corners give four crossings on one circle (largest radial error ${g.radialError.toExponential(1)} against a tolerance of ${g.tol.toExponential(1)}); their opposite angle sums are ${g.oppositeSums.map((v: number) => round(v)).join(" and ")} degrees.`
      : "Those saved corners do not make a drawable construction in the saved bisector mode; move a corner to see the crossings.",
  };
}
