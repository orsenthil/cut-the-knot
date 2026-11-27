/*
 * run_game_logic actions and saved-position reader for Centroids In Polygon.
 *
 * The real core is centroids-in-polygon/centroids-in-polygon-core.js, copied
 * into src/generated/cores/ at build time. See _shared.ts for the module shape.
 *
 * The construction: P1 ... PN are the polygon's vertices with a unit weight
 * each, G = (P1 + ... + PN)/N is their barycentre, and Q[i] is the centroid of
 * the (N-1)-gon left by deleting P[i]. Writing S for the sum of the vertices,
 *
 *     Q[i] = (S - P[i])/(N - 1) = G - (P[i] - G)/(N - 1)
 *          = G + (1/(1-N)) * (P[i] - G).
 *
 * So each line P[i]Q[i] passes through G, split in the ratio (N-1):1
 * (P[i]G : GQ[i]), and Q is the image of P under the homothety centred at G
 * with coefficient 1/(1-N) = -1/(N-1). For N = 3 this is the familiar 2:1
 * split of a triangle's medians. All of it is read from the core's geometry(),
 * never recomputed here.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["centroids-in-polygon"].CentroidsInPolygonCore;

type Point = { x: number; y: number };
type CoreState = {
  n: number;
  points: Point[];
  cycle: number;
  hint: boolean;
  explored: boolean;
};
type Geometry = {
  n: number;
  P: Point[];
  Q: Point[];
  G: Point;
  cycle: number;
  hint: boolean;
  highlighted: {
    index: number;
    vertex: Point;
    centroid: Point;
    polygon: Point[];
    hintLines: [Point, Point][];
  } | null;
  measures: {
    lineError: number;
    homothetyError: number;
    ratioError: number;
    scale: number;
  };
  claims: { concurrent: boolean; ratio: boolean; homothety: boolean };
  degenerate: boolean;
  tol: number;
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Point | null | undefined): Point | null =>
  p ? { x: round(p.x), y: round(p.y) } : null;

/** A point arrives as the page saves it ({x, y}) or as a short [x, y]. */
function readPoint(v: unknown, key: string): Point {
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${key}" must be [x, y] or { x, y }`);
    const x = Number(v[0]), y = Number(v[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${key}" must be two finite numbers`);
    return { x, y };
  }
  if (v && typeof v === "object") {
    const p = v as Json;
    return { x: num(p, "x"), y: num(p, "y") };
  }
  throw new Error(`"${key}" must be [x, y] or { x, y }, got ${JSON.stringify(v)}`);
}

/** N (3 to 20), the vertices and the panel's Cycle / Hint settings. */
function readState(args: Json): CoreState {
  const C = core();
  const raw = args.points === undefined || args.points === null ? args.vertices : args.points;
  const n = num(args, "n", raw === undefined || raw === null ? C.start({}).n : (raw as unknown[]).length);
  if (!Number.isInteger(n) || n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`"n" must be a whole number from ${C.N_MIN} to ${C.N_MAX}, got ${JSON.stringify(args.n)}`);
  }
  let points: Point[];
  if (raw === undefined || raw === null) {
    points = C.start({ n }).points as Point[];
  } else {
    if (!Array.isArray(raw) || raw.length !== n) {
      throw new Error(`"points" must be an array of exactly n = ${n} points, got ${JSON.stringify(raw)}`);
    }
    points = raw.map((p, i) => readPoint(p, `points[${i}]`));
  }
  const cycle = Math.round(num(args, "cycle", 0));
  if (cycle < 0 || cycle > n) {
    throw new Error(`"cycle" must be from 0 to n = ${n} (Cycle = (Cycle + 1) % (N + 1)), got ${JSON.stringify(args.cycle)}`);
  }
  return { n, points, cycle, hint: args.hint === true, explored: true };
}

/** All the geometry the core gives for one polygon, in tutor-friendly units. */
function reading(s: CoreState) {
  const C = core();
  const g = C.geometry(s) as Geometry | null;
  if (!g) {
    throw new Error("the saved vertices do not make a polygon the core can read: give n finite points, with n from 3 to 20.");
  }
  const n = g.n;
  const coefficient = 1 / (1 - n); // = -1/(n-1): the homothety about G taking P[i] to Q[i].
  const Cdist = C.dist as (p: Point, q: Point) => number;
  const lines = g.P.map((p, i) => {
    const pg = Cdist(p, g.G), gq = Cdist(g.G, g.Q[i]);
    return {
      vertex: i + 1,
      from: pt(p),
      throughG: pt(g.G),
      toQi: pt(g.Q[i]),
      PG: round(pg),
      GQ: round(gq),
      PG_over_GQ: gq > 0 ? round(pg / gq) : null,
    };
  });
  const m = g.measures;
  return {
    n,
    board: { width: C.VIEW.width, height: C.VIEW.height },
    vertices: g.P.map(pt),
    wholeCentroidG: pt(g.G),
    vertexDeletedCentroidsQi: g.Q.map(pt),
    lines,
    ratio: { text: `${n - 1}:1`, value: n - 1, meaning: "P[i]G : GQ[i]" },
    homothety: {
      coefficient: round(coefficient),
      centre: pt(g.G),
      formula: "Q[i] = G + (1/(1-N))*(P[i] - G) = (sum of all vertices except P[i])/(N-1)",
    },
    cycle: g.cycle,
    hintShown: g.hint,
    highlighted: g.highlighted
      ? {
          excludedVertex: g.highlighted.index + 1,
          vertex: pt(g.highlighted.vertex),
          centroid: pt(g.highlighted.centroid),
          otherVertices: g.highlighted.polygon.map(pt),
          hintLines: g.highlighted.hintLines.map(([a, b]) => ({ from: pt(a), to: pt(b) })),
        }
      : null,
    claims: { ...g.claims },
    errors: {
      line: round(m.lineError),
      homothety: round(m.homothetyError),
      ratio: round(m.ratioError),
      scale: round(m.scale),
    },
    tolerance: g.tol,
    degenerate: g.degenerate,
    note: C.describe(s),
  };
}

export function actions(): GameActions {
  return {
    centroids: {
      describe:
        "For a polygon with n vertices (3 to 20), report its whole centroid G = (P1+...+Pn)/n, every vertex-deleted centroid Q[i] = (sum of the other vertices)/(n-1), the ratio in which P[i]Q[i] is cut at G ((n-1):1, i.e. P[i]G : GQ[i] = n-1), the distances PG and GQ for each line, and the homothety centred at G with coefficient 1/(1-n) = -1/(n-1) that sends P[i] to Q[i]. Vertices may be [x, y] or { x, y } in the page's 400 by 300 board (y downward); omit points to use the page's starting n-gon. Cycle (0 to n) picks out the (n-1)-gon left by vertex Cycle; Hint draws its medians only for n = 4 with Cycle != 0. For n = 3 the ratio is the familiar 2:1 median split.",
      args: '{ "n": 4, "points": [[278.286, 165.942], [150.885, 206.681], [131.778, 118.844], [210.674, 75.763]] }',
      run: (args) => reading(readState(args)),
    },
    check_claims: {
      describe:
        "Test the illustration's three claims for a polygon of n vertices: all lines P[i]Q[i] are concurrent at G (and G lies between the two ends), P[i]G/GQ[i] = n-1, and Q[i] = G + (1/(1-n))*(P[i] - G). Reports each claim, the measured errors and the tolerance (1e-9 times the drawing's size, except 1e-7*(n-1) for the ratio), the failed claims and whether all hold. Omit points to check the page's starting polygon; a vertex on top of G makes the ratio undefined and that claim false.",
      args: '{ "n": 6 }',
      run: (args) => {
        const r = reading(readState(args));
        const failed = Object.keys(r.claims).filter((k) => r.claims[k as keyof typeof r.claims] !== true);
        return {
          n: r.n,
          claims: r.claims,
          errors: r.errors,
          tolerance: r.tolerance,
          degenerate: r.degenerate,
          failed,
          allHold: failed.length === 0,
          note: failed.length === 0
            ? `All three claims hold for every polygon: the ${r.n} lines meet at G = (P1+...+Pn)/n, each is split ${r.ratio.text}, and Q is the image of P under the homothety of coefficient ${r.homothety.coefficient} about G.`
            : "Some claims failed: check that the vertices are finite and distinct, and that no vertex sits on G (the ratio is then undefined).",
        };
      },
    },
  };
}

/** The page's saved position (a core snapshot), plus a fresh reading of it. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Centroids In Polygon state version ${stateVersion}`);
  }
  const s = readState(state);
  const C = core();
  const g = C.geometry(s) as Geometry | null;
  const savedPoints = (key: string): Point[] | null =>
    Array.isArray(state[key]) ? (state[key] as unknown[]).map((p, i) => readPoint(p, `${key}[${i}]`)) : null;
  return {
    stateVersion,
    n: s.n,
    points: s.points.map(pt),
    cycle: s.cycle,
    hint: s.hint,
    savedG: state.G === undefined || state.G === null ? null : pt(readPoint(state.G, "G")),
    savedQi: savedPoints("Q"),
    savedClaims: state.claims === undefined || state.claims === null ? null : state.claims,
    reading: g ? reading(s) : null,
    note: g
      ? C.describe(s)
      : "The saved vertices are not a polygon the core can read; drag a corner to see the construction again.",
  };
}
