/*
 * run_game_logic actions and saved-position reader for Circles In Regular Polygon.
 *
 * The real core is circles-in-regular-polygon/circles-in-regular-polygon-core.js,
 * copied into src/generated/cores/ at build time. See _shared.ts for the shape
 * of a game module. Every point, circle and claim below is read from that core,
 * never recomputed here.
 *
 * The picture: a regular N-gon (5 to 30 sides) on its circumcircle, with one
 * vertex A joined to all the others, cutting it into N-2 triangles. Jeremy
 * Dunn's five claims, as printed on the applet's page, are:
 *
 *   1. the incentres of those triangles lie on one circle (iCircle);
 *   2. their centroids lie on one circle (cCircle);
 *   3. a circle touches every incircle on the inside and also touches the
 *      circumcircle at A (tCircle);
 *   4. cCircle touches the two sides of the polygon that meet at A;
 *   5. the feet of the angle bisectors from A lie on one circle (aCircle).
 *
 * The core measures all five honestly. Claims 2, 3 and 4 hold at every size;
 * claims 1 and 5 hold only at N = 5 and N = 6 (the page says "definitely
 * N = 6" for claim 5, and the logic test extends it to N = 5). The core's
 * `diagonalFormula` flag is not one of Dunn's claims: it checks the page's
 * chord formula 2|cos(pi k/N)| against the diagonals drawn from A, which have
 * length 2|sin(pi k/N)|, so it is false throughout; that is reported separately.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-in-regular-polygon"].CirclesInRegularPolygonCore;

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };

type CoreState = {
  n: number;
  angle: number;
  options: Record<string, boolean>;
  explored: boolean;
};

type Geometry = {
  n: number;
  angle: number;
  center: Point;
  radius: number;
  vertices: Point[];
  triangles: {
    index: number;
    vertices: Point[];
    incircle: Circle;
    centroid: Point;
    bisectorFoot: Point;
  }[];
  incircles: Circle[];
  centroids: Point[];
  feet: Point[];
  iCircle: Circle;
  cCircle: Circle;
  tCircle: Circle | null;
  aCircle: Circle;
  measures: {
    iSpread: number;
    cSpread: number;
    aSpread: number;
    tIncircleError: number;
    tOuterError: number;
    cSideError: number;
    diagonalError: number;
    tol: number;
  };
  claims: {
    incentersConcyclic: boolean;
    centroidsConcyclic: boolean;
    bisectorFeetConcyclic: boolean;
    tangentToIncircles: boolean;
    tangentToCircumcircle: boolean;
    centroidCircleTangentToSides: boolean;
    diagonalFormula: boolean;
  };
  valid: boolean;
};

const r4 = (v: number): number => Number(v.toFixed(4));
/** Six significant figures, so errors near the core's 1.4e-5 tolerance stay legible. */
const sig = (v: number): number => (Number.isFinite(v) ? Number(v.toPrecision(6)) : NaN);
const pt = (p: Point) => ({ x: r4(p.x), y: r4(p.y) });
const circleView = (c: Circle | null) => (c ? { center: pt(c.center), radius: r4(c.radius) } : null);

const CLAIM_KEYS = ["claim1", "claim2", "claim3", "claim4", "claim5"] as const;
type ClaimKey = typeof CLAIM_KEYS[number];
const CLAIM_NAMES: Record<ClaimKey, string> = {
  claim1: "the incentres of the N−2 triangles are concyclic (iCircle)",
  claim2: "the centroids of the N−2 triangles are concyclic (cCircle)",
  claim3: "one circle touches every incircle and the circumcircle at A (tCircle)",
  claim4: "cCircle touches the two sides of the polygon that meet at A",
  claim5: "the feet of the angle bisectors from A are concyclic (aCircle)",
};

/** Dunn's five claims, judged only from the core's own residuals. */
function fiveClaims(g: Geometry): Record<ClaimKey, { name: string; holds: boolean; measure: unknown }> {
  return {
    claim1: {
      name: CLAIM_NAMES.claim1,
      holds: g.claims.incentersConcyclic,
      measure: { largestGapFromCircle: sig(g.measures.iSpread) },
    },
    claim2: {
      name: CLAIM_NAMES.claim2,
      holds: g.claims.centroidsConcyclic,
      measure: { largestGapFromCircle: sig(g.measures.cSpread) },
    },
    claim3: {
      name: CLAIM_NAMES.claim3,
      holds: g.claims.tangentToIncircles && g.claims.tangentToCircumcircle,
      measure: {
        largestIncircleTangencyError: sig(g.measures.tIncircleError),
        circumcircleTangencyError: sig(g.measures.tOuterError),
      },
    },
    claim4: {
      name: CLAIM_NAMES.claim4,
      holds: g.claims.centroidCircleTangentToSides,
      measure: { largestGapFromSides: sig(Math.abs(g.measures.cSideError)) },
    },
    claim5: {
      name: CLAIM_NAMES.claim5,
      holds: g.claims.bisectorFeetConcyclic,
      measure: { largestGapFromCircle: sig(g.measures.aSpread) },
    },
  };
}

/** The eight page checkboxes; absent means unchecked, as in the applet. */
function readOptions(raw: unknown): Record<string, boolean> {
  const src = raw && typeof raw === "object" ? raw as Json : {};
  const options: Record<string, boolean> = {};
  for (const key of core().OPTION_KEYS as string[]) {
    const v = src[key];
    if (v !== undefined && typeof v !== "boolean") {
      throw new Error(`"options.${key}" must be true or false`);
    }
    options[key] = v === true;
  }
  return options;
}

/** A core state from a page-shaped object: { n, angle, options }. */
function readState(args: Json): CoreState {
  const C = core();
  const n = num(args, "n", C.N_MIN);
  if (!Number.isInteger(n) || n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`"n" must be a whole number from ${C.N_MIN} to ${C.N_MAX}, got ${JSON.stringify(args.n)}`);
  }
  const angle = num(args, "angle", C.START_ANGLE);
  const state = C.start({ n, angle, options: readOptions(args.options) }) as CoreState;
  return { ...state, explored: args.explored === true };
}

/** Everything the core builds for one polygon, in tutor-friendly units. */
function reading(state: CoreState) {
  const C = core();
  const g = C.geometry(state) as Geometry | null;
  if (!g) {
    throw new Error(`the core cannot draw a ${state.n}-gon; give a whole number of sides from ${C.N_MIN} to ${C.N_MAX}.`);
  }
  const dunn = fiveClaims(g);
  const holding = CLAIM_KEYS.filter((k) => dunn[k].holds);
  const failing = CLAIM_KEYS.filter((k) => !dunn[k].holds);
  return {
    n: g.n,
    angle: r4(g.angle),
    board: {
      viewBox: C.VIEW,
      center: pt(g.center),
      circumradius: r4(g.radius),
    },
    vertices: g.vertices.map(pt),
    triangles: g.triangles.map((t) => ({
      number: t.index + 1,
      vertices: t.vertices.map(pt),
      incentre: pt(t.incircle.center),
      incircleRadius: r4(t.incircle.radius),
      centroid: pt(t.centroid),
      bisectorFoot: pt(t.bisectorFoot),
    })),
    circles: {
      iCircle: circleView(g.iCircle),
      cCircle: circleView(g.cCircle),
      tCircle: circleView(g.tCircle),
      aCircle: circleView(g.aCircle),
    },
    howTheCirclesAreDrawn: {
      iCircle: "circumcircle through the first, last and middle incentre",
      cCircle: "circumcircle through the first, last and middle centroid",
      tCircle: g.n % 2 === 0
        ? "Apollonius circle for the first, last and middle incircle, internally tangent to all of them"
        : "circle with diameter from A to the midpoint of the far side",
      aCircle: "circumcircle through the first, last and middle bisector foot (the second foot for N = 5)",
    },
    dunn,
    holding,
    failing,
    measures: {
      incentreSpread: sig(g.measures.iSpread),
      centroidSpread: sig(g.measures.cSpread),
      bisectorFootSpread: sig(g.measures.aSpread),
      tCircleToIncircles: sig(g.measures.tIncircleError),
      tCircleToCircumcircle: sig(g.measures.tOuterError),
      cCircleToSides: sig(g.measures.cSideError),
    },
    tolerance: sig(g.measures.tol),
    valid: g.valid,
    coreDescription: C.describe(state),
    pageChordFormula: {
      coreFlag: g.claims.diagonalFormula,
      note: "Not one of Dunn's five claims. The core tests the page's chord formula 2|cos(pi k/N)| against the diagonals drawn from A, whose length is 2|sin(pi k/N)|, so this flag reads false at every size; the two formulas are for different chords.",
    },
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a regular N-gon (5 to 30 sides) on its circumcircle, with vertex A joined to every other vertex, report all N-2 triangles and the four circles the applet draws: iCircle through the incentres, cCircle through the centroids, tCircle tangent to every incircle and to the circumcircle at A, and aCircle through the feet of the angle bisectors from A. Also report which of Jeremy Dunn's five claims the core's residuals confirm: claims 2, 3 and 4 hold at every size, while claims 1 and 5 hold only for N = 5 and 6. The optional angle (radians) rotates the whole rigid picture; omit it to start with A at the top. Coordinates are in the page's 400 by 300 viewBox with y downward.",
      args: '{ "n": 6 }',
      run: (args) => reading(readState(args)),
    },

    claims_by_n: {
      describe:
        "Test Dunn's five claims with the real core across a range of polygon sizes. Accepts from and to (whole numbers from 5 to 30, from <= to) or an explicit ns array; omit both to scan every size from 5 to 30. For each N report the five boolean claims and the ones that fail, then group the sizes where each claim holds. Expect claims 2 (centroids concyclic), 3 (tangent circle) and 4 (cCircle tangent to the sides at A) at every N, but claims 1 (incentres concyclic) and 5 (bisector feet concyclic) only at N = 5 and 6: from seven sides the circle drawn through three of the points misses the rest.",
      args: '{ "from": 5, "to": 10 }',
      run: (args) => {
        const C = core();
        let ns: number[];
        if (Array.isArray(args.ns)) {
          ns = [...new Set(args.ns.map((v, i) => {
            const n = Number(v);
            if (!Number.isInteger(n) || n < C.N_MIN || n > C.N_MAX) {
              throw new Error(`ns[${i}] must be a whole number from ${C.N_MIN} to ${C.N_MAX}, got ${JSON.stringify(v)}`);
            }
            return n;
          }))];
        } else {
          const from = num(args, "from", C.N_MIN);
          const to = num(args, "to", C.N_MAX);
          for (const [key, value] of [["from", from], ["to", to]] as const) {
            if (!Number.isInteger(value) || value < C.N_MIN || value > C.N_MAX) {
              throw new Error(`"${key}" must be a whole number from ${C.N_MIN} to ${C.N_MAX}, got ${value}`);
            }
          }
          if (from > to) throw new Error(`"from" (${from}) must not exceed "to" (${to})`);
          ns = Array.from({ length: to - from + 1 }, (_, i) => from + i);
        }
        const rows = ns.map((n) => {
          const g = C.geometry(C.start({ n })) as Geometry | null;
          if (!g) throw new Error(`the core cannot draw a ${n}-gon`);
          const dunn = fiveClaims(g);
          return {
            n,
            claims: dunn,
            holding: CLAIM_KEYS.filter((k) => dunn[k].holds),
            failing: CLAIM_KEYS.filter((k) => !dunn[k].holds),
          };
        });
        const byClaim = Object.fromEntries(CLAIM_KEYS.map((k) => [k, {
          name: CLAIM_NAMES[k],
          holdsFor: rows.filter((r) => r.claims[k].holds).map((r) => r.n),
          failsFor: rows.filter((r) => !r.claims[k].holds).map((r) => r.n),
        }]));
        const always = CLAIM_KEYS.filter((k) => byClaim[k].failsFor.length === 0);
        const partial = CLAIM_KEYS.filter((k) => byClaim[k].failsFor.length > 0);
        const parts = [
          `Across N = ${ns[0]} to ${ns[ns.length - 1]}, claims ${always.map((k) => k.slice(-1)).join(", ")} hold at every size.`,
          ...partial.map((k) => `Claim ${k.slice(-1)} holds only for N = ${byClaim[k].holdsFor.join(", ") || "none"} in this range.`),
        ];
        return {
          sizes: ns,
          rows,
          byClaim,
          alwaysHold: always,
          sizeDependent: partial,
          note: parts.join(" ") +
            " The core draws iCircle, cCircle and aCircle through three chosen points, so a failing claim means the remaining dots miss that circle; tCircle and the side tangency are measured directly.",
        };
      },
    },
  };
}

/** The page's saved position (a core snapshot), plus a fresh reading of it. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circles In Regular Polygon state version ${stateVersion}`);
  }
  const C = core();
  const here = readState(state);
  const g = C.geometry(here) as Geometry | null;
  const savedVertices = Array.isArray(state.vertices)
    ? (state.vertices as unknown[]).map((p, i) => {
        const v = p as Json;
        if (!v || typeof v !== "object") throw new Error(`vertices[${i}] must be { x, y }`);
        return { x: num(v, "x"), y: num(v, "y") };
      })
    : null;
  const built = g ? g.vertices : (C.layout(here.n, here.angle) as Point[]);
  let maxVertexGap: number | null = null;
  if (savedVertices) {
    maxVertexGap = savedVertices.length === built.length
      ? Math.max(...savedVertices.map((p, i) => Math.hypot(p.x - built[i].x, p.y - built[i].y)))
      : Infinity;
  }
  return {
    stateVersion,
    n: here.n,
    angle: here.angle,
    options: { ...here.options },
    explored: here.explored,
    savedVertices: savedVertices ? savedVertices.map(pt) : null,
    savedVerticesAgree: maxVertexGap === null ? null : maxVertexGap < 1e-6,
    maxVertexGap: maxVertexGap === null ? null : sig(maxVertexGap),
    reading: g ? reading(here) : null,
    note: g
      ? `A regular ${here.n}-gon with A at angle ${r4(here.angle)}; the core confirms ${CLAIM_KEYS.filter((k) => fiveClaims(g)[k].holds).length} of Dunn's five claims here. ${C.describe(here)}`
      : "The saved position is not a polygon the core can draw; use 5 to 30 sides.",
  };
}
