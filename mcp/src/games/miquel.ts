/*
 * run_game_logic actions and saved-position reader for Miquel.
 *
 * A triangle has one marked point on each side line (the line extended if
 * needed). The circle through a corner and the two marked points on the sides
 * meeting there can be drawn for each corner; the three "pivot" circles always
 * have a second common point P, the Miquel point (the Pivot Theorem). When the
 * three marked points are collinear, P also lies on the triangle's
 * circumcircle: this is the Miquel point of a complete quadrilateral (four
 * lines), NOT the four-circle theorem of the separate "Miquel theorem for
 * circles" applet.
 *
 * Every number below is measured by the real core
 * (miquel/miquel-core.js, copied into src/generated/cores/ at build time).
 * Coordinates are board units of the page's 480 x 300 viewBox, y downward.
 * The example arguments are the position saved by the live page in
 * porting/live-fixtures/miquel.json, so they run through the same geometry
 * the player sees. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { c: Pt; r: number };
type Simson = { collinear: boolean; pair: number[] | null; distance: number };
type Geometry = {
  vertices: Pt[];
  side: Pt[];
  circles: Circle[];
  point: Pt;
  circum: Circle | null;
  circumGap: number | null;
  simson: Simson;
};
type State = { vertices: Pt[]; t: number[]; explored: boolean };

type Core = {
  HOME: Pt[];
  start(o?: { vertices?: Pt[]; t?: number[]; explored?: boolean }): State;
  geometry(s: State): Geometry | null;
  sidePoints(s: State): Pt[];
  makeCollinear(s: State): State;
  collinearity(m: Pt[]): Simson;
  describe(s: State): string;
  dist(p: Pt, q: Pt): number;
};

const core = (): Core => cores["miquel"].MiquelCore as unknown as Core;

/* The core keeps full precision; only what we print is rounded. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number | null | undefined): number | null =>
  v !== null && v !== undefined && Number.isFinite(v) ? Number(v.toExponential(2)) : null;
const rp = (p: Pt | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const rc = (c: Circle | null | undefined): { c: { x: number; y: number } | null; r: number } | null =>
  c ? { c: rp(c.c), r: r6(c.r) } : null;
const isPlain = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** The live page's saved triangle and side-point fractions. */
const FIXTURE = {
  vertices: [{ x: 165, y: 180 }, { x: 342, y: 180 }, { x: 240, y: 42 }],
  t: [0.08997847251996394, 0.7202235580004399, 0.014404174826423088],
};

/** A point argument, as { x, y } or [x, y], with finite coordinates. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    x = Number(raw[0]);
    y = Number(raw[1]);
  } else if (isPlain(raw)) {
    x = Number(raw.x);
    y = Number(raw.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** The three corners, defaulting to the live page's triangle. */
function readVertices(raw: unknown, fallback: Pt[]): Pt[] {
  if (raw === undefined || raw === null) return fallback.map((p) => ({ x: p.x, y: p.y }));
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new Error('argument "vertices" must be an array of three points');
  }
  return raw.map((p, i) => readPoint(p, `vertices[${i}]`));
}

/** The three side-point fractions along the side lines, defaulting to the live page's. */
function readTs(raw: unknown, fallback: number[]): number[] {
  if (raw === undefined || raw === null) return fallback.slice();
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new Error('argument "t" must be an array of three numbers');
  }
  return raw.map((v, i) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`t[${i}] must be a number, got ${JSON.stringify(v)}`);
    return n;
  });
}

/** Start the real core at the requested (or saved) picture. */
function buildState(C: Core, args: Json): State {
  if (!isPlain(args)) throw new Error("arguments must be an object with optional vertices and t");
  return C.start({
    vertices: readVertices(args.vertices, FIXTURE.vertices),
    t: readTs(args.t, FIXTURE.t),
  });
}

/** Signed distance of the Miquel point from each pivot circle, in core units. */
function pivotResiduals(C: Core, g: Geometry): number[] {
  return g.circles.map((c) => C.dist(g.point, c.c) - c.r);
}

export function actions(): GameActions {
  return {
    pivot_circles: {
      describe:
        "Given three triangle corners vertices (a point on each side line is set by the three fractions t along the side lines; the live page's saved values are used when omitted), draw the three pivot circles, each through a corner and the two marked points on the sides meeting there, and find their common Miquel point P. P is constructed as the second meeting of the circles at the first two corners, so its signed distance from the third circle tests the Pivot Theorem; the action reports the side points, the three circles, P and that concurrency check.",
      args: JSON.stringify(FIXTURE),
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = C.geometry(s);
        if (!g) {
          throw new Error("the three pivot circles cannot be drawn here: move the corners or side points apart");
        }
        const res = pivotResiduals(C, g);
        const largest = Math.max.apply(null, res.map(Math.abs));
        const concurrent = largest < 1e-6;
        const nearestSide = Math.min.apply(null, g.side.map((m) => C.dist(g.point, m)));
        return {
          vertices: g.vertices.map(rp),
          sidePoints: g.side.map(rp),
          pivotCircles: g.circles.map(rc),
          miquelPoint: rp(g.point),
          distanceFromPToCircleAtV0: sig(res[0]),
          distanceFromPToCircleAtV1: sig(res[1]),
          distanceFromPToCircleAtV2: sig(res[2]),
          largestConcurrencyError: sig(largest),
          concurrent,
          distanceFromNearestSidePoint: r6(nearestSide),
          describe: C.describe(s),
          note:
            `P = ${JSON.stringify(rp(g.point))} is the second meeting of the V0 and V1 pivot circles; `
            + `its signed distances from the V0, V1 and V2 circles are ${sig(res[0])}, ${sig(res[1])} and ${sig(res[2])} board units. `
            + (concurrent
              ? "All three circles therefore pass through the same Miquel point, as the Pivot Theorem promises."
              : "The large residual means the circles do not meet at one point here (a degenerate picture).")
            + ` P is ${r6(nearestSide)} units from the nearest marked side point, so it is the second meeting rather than a shared one.`,
        };
      },
    },

    collinear_circumcircle: {
      describe:
        "Starting from the same optional vertices (and t), slide the three marked side points onto one transversal through the triangle's centroid with the core's makeCollinear, then compare the Miquel point before and after. Once the three points line up, the point lies on the triangle's circumcircle — the Miquel point of four lines; the action reports the collinearity test, the circumcircle, P's signed distance from it before and after, and confirms the three pivot circles still concur. This is the pivot/four-line theorem, not the four-circle theorem of the separate 'miquel-theorem-for-circles' applet.",
      args: JSON.stringify({ vertices: FIXTURE.vertices }),
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const before = C.geometry(s);
        if (!before) throw new Error("the three pivot circles cannot be drawn at the starting position");
        const aligned = C.makeCollinear(s);
        const after = C.geometry(aligned);
        if (!after) throw new Error("the three pivot circles cannot be drawn after lining up the side points");
        const beforeGap = before.circumGap;
        const afterGap = after.circumGap;
        const onCircumcircle = afterGap !== null && Math.abs(afterGap) < 1e-6;
        const res = pivotResiduals(C, after);
        const stillConcurrent = Math.max.apply(null, res.map(Math.abs)) < 1e-6;
        return {
          vertices: after.vertices.map(rp),
          before: {
            sidePoints: before.side.map(rp),
            miquelPoint: rp(before.point),
            circumGap: sig(beforeGap),
            onCircumcircle: beforeGap !== null && Math.abs(beforeGap) < 1e-6,
          },
          sidePoints: after.side.map(rp),
          collinear: after.simson.collinear,
          collinearPair: after.simson.pair,
          largestCollinearityError: sig(after.simson.distance),
          miquelPoint: rp(after.point),
          circumcircle: rc(after.circum),
          circumGap: sig(afterGap),
          onCircumcircle,
          pivotCirclesStillConcurrent: stillConcurrent,
          describe: C.describe(aligned),
          note:
            `The core's makeCollinear puts the three side points on one line (largest distance from that line ${sig(after.simson.distance)} board units). `
            + `Before, P was ${sig(beforeGap)} units off the triangle's circumcircle; after, it is ${sig(afterGap)} units off, so `
            + (onCircumcircle ? "P now lies on the circumcircle." : "P is still off the circumcircle.")
            + (stillConcurrent ? " The three pivot circles still share P." : " The pivot circles no longer share one point.")
            + " This four-line Miquel point is different from the common point of four circles in the 'miquel-theorem-for-circles' applet.",
        };
      },
    },
  };
}

/** Echo the saved fields, then re-measure that picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Miquel state version ${stateVersion}`);
  const C = core();
  const src: Json = isPlain(state) ? state : {};
  let s: State;
  let valid = true;
  try {
    s = C.start({
      vertices: readVertices(src.vertices, FIXTURE.vertices),
      t: readTs(src.t, FIXTURE.t),
    });
  } catch {
    s = C.start({ vertices: FIXTURE.vertices, t: FIXTURE.t });
    valid = false;
  }
  const g = C.geometry(s);
  const res = g ? pivotResiduals(C, g) : null;
  const largest = res ? Math.max.apply(null, res.map(Math.abs)) : null;
  const savedP = g && isPlain(src.point) ? readPoint(src.point, "point") : null;
  const savedMatches = g && savedP ? C.dist(savedP, g.point) < 1e-6 : null;
  const gap = g ? g.circumGap : null;

  return {
    ...src,
    stateVersion,
    valid,
    // The core's reading of the saved vertices and t.
    sidePoints: g ? g.side.map(rp) : null,
    miquelPoint: g ? rp(g.point) : null,
    pivotCircles: g ? g.circles.map(rc) : null,
    residualsFromPToCircles: res ? res.map(sig) : null,
    largestConcurrencyError: sig(largest),
    concurrent: largest !== null && largest < 1e-6,
    circumcircle: g ? rc(g.circum) : null,
    circumGap: sig(gap),
    collinear: g ? g.simson.collinear : null,
    collinearPair: g ? g.simson.pair : null,
    largestCollinearityError: g ? sig(g.simson.distance) : null,
    onCircumcircle: gap !== null && Math.abs(gap) < 1e-6,
    savedMiquelPointMatches: savedMatches,
    describe: C.describe(s),
    note: !valid
      ? "Some saved fields could not be read, so the core was started from the live page's position and the reading below comes from that. "
        + (g && g.simson.collinear
          ? "There the side points line up and the Miquel point falls on the circumcircle."
          : "There the three pivot circles share a Miquel point but the side points are not collinear.")
      : !g
        ? "The saved corners and fractions make a degenerate picture: the core cannot draw the three pivot circles."
        : `Track.state saved the three corners, the three side-point fractions and the derived drawing. `
          + `The three pivot circles meet at P = ${JSON.stringify(rp(g.point))} `
          + (largest !== null && largest < 1e-6 ? "exactly." : `with largest residual ${sig(largest)} units.`)
          + (g.simson.collinear
            ? " The side points are collinear, so P also lies on the triangle's circumcircle — the Miquel point of four lines."
            : ` The side points are not collinear, so P is ${sig(gap)} units off the circumcircle; lining them up would put P on it.`),
  };
}
