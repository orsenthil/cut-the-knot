/*
 * run_game_logic actions and saved-position reader for David Radcliffe.
 * The core lives in david-radcliffe/ and is copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["david-radcliffe"].DavidRadcliffeCore;

type Point = { x: number; y: number };
type Claim = { N: number; ratio: number; smaller: boolean; collapses: boolean; sameSize: boolean };

/** The verdict the construction gives, straight from the core's claims. */
function verdict(cl: Claim): string {
  if (cl.collapses) {
    return `For N = ${cl.N} all the tips meet at the centre, so no smaller copy is made; the lattice does contain regular hexagons.`;
  }
  if (cl.sameSize) {
    return `For N = ${cl.N} the new polygon is the same size, turned halfway round, so there is no smaller copy; the lattice does contain equilateral triangles.`;
  }
  if (cl.smaller) {
    return `The new polygon is ${cl.ratio.toFixed(3)} times as wide. A lattice ${cl.N}-gon would make a smaller lattice ${cl.N}-gon, then a smaller one, and so on for ever — impossible, so the lattice holds no such polygon.`;
  }
  return `The new polygon is ${cl.ratio.toFixed(3)} times as wide, so this case gives no smaller copy and no descent.`;
}

/** A lattice node is an integer pair (m, n) in the basis u=(1,0), v=(1/2,sqrt3/2). */
function node(value: unknown, key: string): { m: number; n: number } {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`argument "${key}" must be [m, n], two integers in the triangular lattice basis`);
  }
  const m = Number(value[0]), n = Number(value[1]);
  if (!Number.isInteger(m) || !Number.isInteger(n)) {
    throw new Error(`argument "${key}" must be two integers [m, n]`);
  }
  return { m, n };
}

/** Canvas size in the actions; the picture scales with min(width, height). */
function canvas(args: Json): { width: number; height: number } {
  const width = num(args, "width", core().DEFAULTS.width);
  const height = num(args, "height", core().DEFAULTS.height);
  if (width <= 0 || height <= 0) throw new Error('"width" and "height" must be positive');
  return { width, height };
}

export function actions(): GameActions {
  return {
    shrink: {
      describe:
        "Erect inward equilateral triangles on the sides of a regular N-gon (N 3..30); their third vertices form another regular N-gon. Returns the analytic scale ratio |cos(pi/N) - sqrt(3)sin(pi/N)|, the ratio measured from the drawn vertices, and the inner polygon itself.",
      args: '{ "N": 4 }',
      run: (args) => {
        const C = core();
        const N = C.clampOption("N", num(args, "N", C.DEFAULTS.N));
        const { width, height } = canvas(args);
        const s = C.start({ N, width, height });
        const cl = C.claims(N);
        const outerR = Math.hypot(s.V[0].x - s.center.x, s.V[0].y - s.center.y);
        const innerR = Math.hypot(s.U[0].x - s.center.x, s.U[0].y - s.center.y);
        return {
          N,
          ratio: cl.ratio,
          measuredRatio: outerR > 0 ? innerR / outerR : 0,
          outerRadius: outerR,
          innerRadius: innerR,
          smaller: cl.smaller,
          collapses: cl.collapses,
          sameSize: cl.sameSize,
          innerPolygon: s.U,
          verdict: verdict(cl),
        };
      },
    },
    lattice_descent: {
      describe:
        "Why a triangular lattice holds no regular N-gon except N = 3 or 6: a 60-degree turn about a lattice node keeps integer lattice coordinates, so the inward-triangle tips of a lattice polygon are lattice nodes too, and for every other N >= 4 the tips form a strictly smaller copy — an impossible infinite descent. Give two lattice nodes a and b as [m, n] to see the apex of that side under both 60-degree turns.",
      args: '{ "N": 4, "a": [0, 0], "b": [1, 0] }',
      run: (args) => {
        const C = core();
        const N = C.clampOption("N", num(args, "N", C.DEFAULTS.N));
        const a = node(args.a, "a"), b = node(args.b, "b");
        const inward = C.latticeApex(a, b, 1), outward = C.latticeApex(a, b, -1);
        const cl = C.claims(N);
        return {
          N,
          side: { a, b },
          inwardApex: inward,
          inwardApexCartesian: C.latticePoint(inward),
          outwardApex: outward,
          outwardApexCartesian: C.latticePoint(outward),
          apexIsALatticeNode: true,
          ratio: cl.ratio,
          smaller: cl.smaller,
          exception: cl.exception,
          verdict: verdict(cl),
        };
      },
    },
  };
}

/**
 * What the core says about the picture the page saved. The page saves the
 * whole core state, so the reading echoes it and checks it against a fresh
 * Reset() at the same N and canvas size.
 */
export function position(state: Json, _stateVersion: number): unknown {
  const C = core();
  const N = C.clampOption("N", num(state, "N", C.DEFAULTS.N));
  const { width, height } = canvas(state);
  const angle = num(state, "angle", C.DEFAULTS.angle);
  const center = (state.center ?? { x: width / 2, y: height / 2 }) as Point;
  const radius = num(state, "radius", Math.min(width, height) / 2.5);
  const V = state.V as Point[] | undefined;
  const U = state.U as Point[] | undefined;

  const cl = C.claims(N);
  const rebuilt = C.start({ N, width, height, angle });
  const near = (p: Point, q: Point) =>
    Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6;
  const same = (p: Point[] | undefined, q: Point[]) =>
    Array.isArray(p) && p.length === q.length && p.every((v, i) => near(v, q[i]));

  const savedOuterR = Array.isArray(V) && V.length ? Math.hypot(V[0].x - center.x, V[0].y - center.y) : radius;
  const savedInnerR = Array.isArray(U) && U.length ? Math.hypot(U[0].x - center.x, U[0].y - center.y) : 0;

  return {
    N, width, height, angle, center, radius, V, U,
    vertices: Array.isArray(V) ? V.length : 0,
    apexes: Array.isArray(U) ? U.length : 0,
    matchesCore: same(V, rebuilt.V) && same(U, rebuilt.U),
    ratio: cl.ratio,
    measuredRatio: savedOuterR > 0 ? savedInnerR / savedOuterR : 0,
    smaller: cl.smaller,
    collapses: cl.collapses,
    sameSize: cl.sameSize,
    exception: cl.exception,
    alternativeRatio: cl.alternative,
    alternativeSmaller: cl.alternativeSmaller,
    verdict: verdict(cl),
  };
}
