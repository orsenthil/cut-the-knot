/*
 * run_game_logic actions and saved-position reader for Areas In Reg Poly.
 *
 * Every number below comes from the game's real core (areas-in-reg-poly/ in
 * the site), copied into src/generated/cores/ at build time. See _shared.ts
 * for the module shape.
 *
 * The applet joins a draggable point P to every corner of a regular 2n-gon
 * and colours the triangles alternately. Each triangle has the same base s,
 * so its area is (s / 2) times the distance from P to that side line. Take
 * signed distances (positive on the interior side of a line) and the two
 * totals are both n*s*h/2 for *every* P, because the outward normals of the
 * even sides sum to zero and so do those of the odd sides. With ordinary
 * unsigned distances the page's claim needs P inside: then each distance
 * sum is Viviani's n*h and each area total is half the polygon.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["areas-in-reg-poly"].AreasInRegPolyCore;

type Point = { x: number; y: number };
type State = { width: number; height: number; N: number; P: Point; showHint: boolean };

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const pt = (p: Point): Point => ({ x: r3(p.x), y: r3(p.y) });

/** Accept [x, y] or { x, y }, as the other geometry readers do. */
function readPoint(v: unknown, key: string): Point {
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${key}" must have exactly two numbers, [x, y]`);
    const x = Number(v[0]), y = Number(v[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${key}" must be two finite numbers`);
    return { x, y };
  }
  if (v && typeof v === "object") {
    const p = v as Json;
    const x = num(p, "x"), y = num(p, "y");
    return { x, y };
  }
  throw new Error(`"${key}" must be [x, y] or { x, y }`);
}

/** N is the number of sides of the regular polygon: 4 to 30, stepping by 2. */
function readN(args: Json): number {
  const C = core();
  const N = num(args, "N", C.INITIAL_N);
  if (!Number.isInteger(N) || N % C.STEP_N !== 0 || N < C.MIN_N || N > C.MAX_N) {
    throw new Error(
      `"N" must be an even number of sides from ${C.MIN_N} to ${C.MAX_N}, got ${JSON.stringify(args.N)}`,
    );
  }
  return N;
}

/** The five fields the page keeps in a position; P defaults to the centre. */
function readState(args: Json): State {
  const C = core();
  const width = num(args, "width", C.WIDTH);
  const height = num(args, "height", C.HEIGHT);
  if (!(width > 0) || !(height > 0)) throw new Error('"width" and "height" must be positive');
  const N = readN(args);
  const P = args.P === undefined || args.P === null
    ? { x: Math.floor(width / 2), y: Math.floor(height / 2) }
    : readPoint(args.P, "P");
  return { width, height, N, P, showHint: args.showHint === true };
}

/** One consistent reading of a state, shared by both actions and position(). */
function reading(s: State) {
  const C = core();
  const g = C.compute(s);
  const claims = C.claims(g);
  const signedTarget = (g.n * g.side * g.apothem) / 2;
  return {
    N: g.N,
    n: g.n,
    board: { width: s.width, height: s.height },
    P: pt(s.P),
    showHint: s.showHint,
    inside: g.inside,
    vertices: g.V.map(pt),
    feetOnSideLines: g.H.map(pt),
    triangleAreas: g.triangles.map((a: number) => r3(a)),
    unsignedTotals: {
      evenTriangles: r3(g.evenArea),
      oddTriangles: r3(g.oddArea),
      triangleSum: r3(g.evenArea + g.oddArea),
      polygonArea: r3(g.polygonArea),
      halfPolygonArea: r3(g.polygonArea / 2),
      halfTriangleSum: r3(g.halfPolygon),
    },
    signedTotals: {
      evenTriangles: r3(g.evenSigned),
      oddTriangles: r3(g.oddSigned),
      eachEqualsNH: r3(signedTarget),
      signedDistanceSumEven: r3((2 * g.evenSigned) / g.side),
      signedDistanceSumOdd: r3((2 * g.oddSigned) / g.side),
      distanceSumNH: r3(g.n * g.apothem),
    },
    geometry: {
      circumradius: r3(g.R),
      apothem: r3(g.apothem),
      side: r3(g.side),
      evenExtendedNGonCorners: g.U.filter(Boolean).length,
      oddExtendedNGonCorners: g.W.filter(Boolean).length,
      allTriangleTurnsSameSign: g.allSameSide,
    },
    claims,
    note: claims.equalSums && claims.sumsAreHalf
      ? `P is ${g.inside ? "inside" : "outside"} the polygon. The two unsigned totals agree at ${r3(g.evenArea)}, each half of the polygon's area ${r3(g.polygonArea)}. The signed sums agree at ${r3(signedTarget)} too; with signs the equality holds wherever P is put.`
      : `P is outside the polygon, so the page's equal-areas claim does not apply: the unsigned totals are ${r3(g.evenArea)} and ${r3(g.oddArea)}, and their sum ${r3(g.evenArea + g.oddArea)} is not the polygon area ${r3(g.polygonArea)}. The signed sums still agree, each ${r3(signedTarget)} = n*s*h/2, for every position of P.`,
  };
}

export function actions(): GameActions {
  return {
    alternating_areas: {
      describe:
        "For a regular N-gon (N even, 4 to 30) and a point P as [x, y] or { x, y } on the page's 400 by 300 board (P defaults to the centre), report the core's two alternating triangle-area totals, the polygon's area and its half, and the signed-distance form: each signed total is n*s*h/2 where n = N/2, s is a side and h the apothem. Says whether P is inside, where each triangle's foot lands, and which of the page's claims hold.",
      args: '{ "N": 6, "P": [204, 150] }',
      run: (args) => reading(readState(args)),
    },
    outside_point: {
      describe:
        "Demonstrate the failure of the outside case: put P beyond the polygon (default N = 6, P = [380, 20]) and report the unequal unsigned triangle totals alongside the signed totals, which still agree at n*s*h/2. Requires P outside the polygon; use alternating_areas for an inside point.",
      args: '{ "N": 6, "P": [380, 20] }',
      run: (args) => {
        const s = readState(args);
        const C = core();
        const g = C.compute(s);
        if (g.inside) {
          throw new Error(
            `P (${s.P.x}, ${s.P.y}) is inside the ${g.N}-gon; this action shows the outside failure. Use alternating_areas instead, or move P outside the polygon.`,
          );
        }
        const r = reading(s);
        return {
          N: r.N,
          P: r.P,
          inside: false,
          unsignedTotals: {
            evenTriangles: r.unsignedTotals.evenTriangles,
            oddTriangles: r.unsignedTotals.oddTriangles,
            equal: r.claims.equalSums,
            bothHalfPolygon: r.claims.sumsAreHalf,
            triangleSumMatchesPolygon: r.claims.isHalfPolygon,
          },
          signedTotals: {
            evenTriangles: r.signedTotals.evenTriangles,
            oddTriangles: r.signedTotals.oddTriangles,
            equal: r.claims.signedSumsEqual,
            eachEqualsNH: r.signedTotals.eachEqualsNH,
            holdsEverywhere: r.claims.signedSumsAreNH,
          },
          polygonArea: r.unsignedTotals.polygonArea,
          note:
            "Outside, the triangles overlap the polygon and each other, so unsigned areas need not split it in half (a symmetric outside position can still make them coincide). Give each side line a sign — positive on the interior side — and the even and odd sums of (s/2)*signed-distance both stay n*s*h/2: the outward normals of each alternating set add to zero.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Areas In Reg Poly state version ${stateVersion}`);
  }
  const s = readState(state);
  const r = reading(s);
  return {
    stateVersion,
    width: s.width,
    height: s.height,
    N: s.N,
    n: s.N / 2,
    showHint: s.showHint,
    P: r.P,
    reading: r,
  };
}
