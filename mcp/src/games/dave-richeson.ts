/*
 * run_game_logic actions and saved-position reader for Dave Richeson's Japanese
 * Theorem.
 *
 * The real core is dave-richeson/dave-richeson-core.js, copied into
 * src/generated/cores/ at build time. N corners lie on one circle of radius
 * R = 220 centred at (300, 275) in the board's 600 x 550 viewBox (y down).
 * The applet clips ears at random to triangulate the polygon; a triangle whose
 * corner order is reversed has its incircle radius counted negative. The
 * signed sum of all the inradii is the same for every triangulation. For a
 * convex polygon with successive central gaps t_i it equals
 * R(Σ cos(t_i/2) − (n−2)). Every number returned here is measured by that
 * core; see _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["dave-richeson"].DaveRichesonCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Incircle = { x: number; y: number; r: number; sign: number };
type StateShape = {
  n: number;
  points: Point[];
  triangles: number[][];
  diagonals: number[][];
  seed: number;
  explored: boolean;
};

const TAU = 2 * Math.PI;
const TOL = 1e-6;

const round = (v: number, digits = 6): number => {
  if (!Number.isFinite(v)) return NaN;
  const r = Number(v.toFixed(digits));
  return r === 0 ? 0 : r;
};
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
const sig = (v: number): number | null =>
  Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const near = (a: number, b: number, tol = TOL): boolean =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function readPoint(value: unknown, label: string): Point {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${label}" must be { "x": number, "y": number }`);
  }
  const p = value as Json;
  return { x: num(p, "x", NaN), y: num(p, "y", NaN) };
}

/** The core silently clamps N; here an out-of-range N is a mistake to report. */
function readN(args: Json, fromPoints?: number): number {
  const raw = args.n;
  if (raw === undefined || raw === null) {
    return fromPoints ?? 6;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 3 || n > 30) {
    throw new Error('"n" must be an integer from 3 to 30 (the applet\'s range)');
  }
  if (fromPoints !== undefined && fromPoints !== n) {
    throw new Error(`"n" is ${n} but "points" has ${fromPoints} corners`);
  }
  return n;
}

/** Optional corners in board units; the core projects them onto the circle. */
function readPoints(args: Json, K: Core, n: number): Point[] {
  if (args.points === undefined || args.points === null) {
    return Array.from({ length: n }, (_, i) => K.pointAt((TAU * i) / n) as Point);
  }
  if (!Array.isArray(args.points) || args.points.length !== n) {
    throw new Error(`"points" must be an array of ${n} { x, y } corners on the board`);
  }
  const points = args.points.map((p, i) => K.project(readPoint(p, `points[${i}]`)) as Point);
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (dist(points[i], points[j]) < 1e-6) {
        throw new Error(`points[${i}] and points[${j}] coincide after projection onto the circle`);
      }
    }
  }
  return points;
}

/**
 * A list of PRNG seeds, one triangulation per seed. The default five give five
 * different cuts of the same polygon, as pressing Triangulate again does.
 */
function readSeeds(args: Json): number[] {
  const raw = args.seeds;
  if (raw === undefined || raw === null) return [1, 2, 3, 4, 5];
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) {
    throw new Error('"seeds" must be an array of 1 to 20 non-negative integers');
  }
  return raw.map((v, i) => {
    const s = Number(v);
    if (!Number.isInteger(s) || s < 0 || s > 4294967295) {
      throw new Error(`seeds[${i}] must be a 32-bit non-negative integer`);
    }
    return s >>> 0 || 1;
  });
}

function readSeed(args: Json): number {
  const raw = args.seed;
  if (raw === undefined || raw === null) return 1;
  const s = Number(raw);
  if (!Number.isInteger(s) || s < 0 || s > 4294967295) {
    throw new Error('"seed" must be a 32-bit non-negative integer');
  }
  return s >>> 0 || 1;
}

/** Cut the polygon once with this seed, keeping the given corners. */
function cut(K: Core, n: number, points: Point[], seed: number): StateShape {
  return K.triangulate({
    n, points, seed, explored: true, triangles: [], diagonals: [],
  }) as StateShape;
}

/** The incircles the core drew for one triangulation, with their signed radii. */
function circlesOf(K: Core, s: StateShape) {
  const g = K.geometry(s);
  const circles = (g.circles as Incircle[]).map((c, i) => ({
    triangle: s.triangles[i],
    center: pt(c),
    radius: round(c.r),
    sign: c.sign,
    signedRadius: round(c.sign * c.r),
  }));
  return {
    g,
    circles,
    signedSum: g.sum as number,
    blue: g.blue as number,
    red: g.red as number,
  };
}

/** Several triangulations of the same corners, measured by the real core. */
function trials(K: Core, args: Json) {
  const n = readN(args);
  const points = readPoints(args, K, n);
  const seeds = readSeeds(args);
  const cuts = seeds.map((seed) => {
    const s = cut(K, n, points, seed);
    const r = circlesOf(K, s);
    return {
      seed,
      triangles: s.triangles,
      diagonals: s.diagonals,
      signedSum: round(r.signedSum, 9),
      blue: r.blue,
      red: r.red,
      incircles: r.circles,
      rawSum: r.signedSum,
    };
  });
  return { n, points, cuts };
}

/** Successive arcs between corners, or an error if they are not in order. */
function convexGaps(K: Core, points: Point[]): number[] | null {
  const c = K.CENTER as Point;
  if (!points.every((p) => near(dist(p, c), K.RADIUS as number, 1e-6))) return null;
  const angles = points.map((p) => {
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    return a < 0 ? a + TAU : a;
  });
  const gaps: number[] = [];
  for (let i = 0; i < angles.length; i++) {
    const gap = (angles[(i + 1) % angles.length] - angles[i] + TAU) % TAU;
    if (gap <= 1e-9) return null;
    gaps.push(gap);
  }
  return gaps;
}

export function actions(): GameActions {
  return {
    signed_inradius_sum: {
      describe:
        "For n corners on the circumcircle (3 to 30; default 6), use the real core's ear-clipping triangulation and report each incircle's centre, radius and sign plus the signed sum, with blue (positive) and red (negative) counts. Repeat for several PRNG seeds — or supply explicit corners as 'points' in the 600x550 board — to show that the signed sum does not depend on the triangulation. 'seeds' takes 1 to 20 non-negative integers.",
      args: '{ "n": 6, "seeds": [1, 2, 3, 4, 5] }',
      run: (args) => {
        const K = core();
        const { n, points, cuts } = trials(K, args);
        const sums = cuts.map((c) => c.rawSum);
        const spread = Math.max(...sums) - Math.min(...sums);
        return {
          n,
          circle: { center: pt(K.CENTER as Point), radius: K.RADIUS },
          points: points.map(pt),
          triangulations: cuts.map(({ rawSum, ...rest }) => rest),
          signedSum: round(sums[0], 9),
          spreadAcrossTriangulations: round(spread, 9),
          independentOfTriangulation: spread < 1e-6,
          note:
            `Each triangulation has ${n - 2} triangles and ${n - 3} diagonals; a reversed triangle contributes a negative radius. ` +
            `The core's signed sums are ${cuts.map((c) => round(c.rawSum, 6)).join(", ")}, a spread of ${sig(spread)} units. ` +
            "Interior cuts cancel in pairs, so the total depends only on the polygon's corners, not on how it was cut up.",
        };
      },
    },
    convex_gap_formula: {
      describe:
        "For a convex cyclic polygon, check the core's signed sum against R(Σ cos(gap/2) − (n−2)), where the gaps are the successive central arcs in radians. Give 'n' (3 to 30) for a regular polygon, or an explicit array of n positive 'gaps' in radians adding to 2π; an optional 'seed' chooses the triangulation. Returns the gaps, their half-angle cosines, both sums and their residual.",
      args: '{ "n": 6 }',
      run: (args) => {
        const K = core();
        const rawGaps = args.gaps === undefined || args.gaps === null ? null : numArray(args, "gaps");
        const n = readN(args, rawGaps === null ? undefined : rawGaps.length);
        const gaps = rawGaps ?? Array.from({ length: n }, () => TAU / n);
        if (gaps.some((g) => !Number.isFinite(g) || g <= 0 || g >= TAU)) {
          throw new Error('"gaps" must hold positive central angles in radians, each less than 2π');
        }
        if (!near(gaps.reduce((a, g) => a + g, 0), TAU, 1e-9)) {
          throw new Error('the "gaps" must add up to 2π radians');
        }
        let angle = 0;
        const points = gaps.map((g) => {
          const p = K.pointAt(angle) as Point;
          angle += g;
          return p;
        });
        const s = cut(K, n, points, readSeed(args));
        const measured = circlesOf(K, s).signedSum;
        const cosTerms = gaps.map((g) => Math.cos(g / 2));
        const predicted = (K.RADIUS as number) * (cosTerms.reduce((a, c) => a + c, 0) - (n - 2));
        const error = measured - predicted;
        return {
          n,
          gapsRadians: gaps.map((g) => round(g, 9)),
          gapsDegrees: gaps.map((g) => round((g * 180) / Math.PI, 6)),
          cosHalfGap: cosTerms.map((c) => round(c, 9)),
          measuredSignedSum: round(measured, 9),
          formulaSignedSum: round(predicted, 9),
          residual: sig(error),
          holds: Math.abs(error) < 1e-6 * Math.max(1, Math.abs(predicted)),
          triangles: s.triangles,
          status: K.describe(s),
          note:
            "In a convex polygon every triangle winds the same way, so all the inradii are positive. " +
            `The core's signed sum is ${round(measured, 6)}, and R(Σ cos(gap/2) − (n−2)) with R = ${K.RADIUS} is ${round(predicted, 6)}; ` +
            `the residual is ${sig(error)} units. Each inradius is R(cos A + cos B + cos C − 1), and the arcs of the cuts cancel, leaving only the polygon's own gaps.`,
        };
      },
    },
  };
}

/** The fields Track.state saved, read again through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Dave Richeson state version ${stateVersion}`);
  }
  const K = core();
  const savedN = Number(state.n);
  if (!Number.isInteger(savedN) || savedN < 3 || savedN > 30) {
    throw new Error('saved "n" must be an integer from 3 to 30');
  }
  if (!Array.isArray(state.points) || state.points.length !== savedN) {
    throw new Error(`saved "points" must hold ${savedN} corners`);
  }
  const points = state.points.map((p, i) => K.project(readPoint(p, `points[${i}]`)) as Point);
  const readIndices = (value: unknown, label: string, rows: number, width: number): number[][] => {
    if (!Array.isArray(value) || value.length !== rows) {
      throw new Error(`saved "${label}" must hold ${rows} index rows`);
    }
    return value.map((row, i) => {
      if (!Array.isArray(row) || row.length !== width) {
        throw new Error(`saved ${label}[${i}] must hold ${width} corner indices`);
      }
      return row.map((v, j) => {
        const k = Number(v);
        if (!Number.isInteger(k) || k < 0 || k >= savedN) {
          throw new Error(`saved ${label}[${i}][${j}] is not a corner index`);
        }
        return k;
      });
    });
  };
  const triangles = readIndices(state.triangles, "triangles", savedN - 2, 3);
  const diagonals = readIndices(state.diagonals, "diagonals", savedN - 3, 2);
  const savedSum = num(state, "sum");
  const savedBlue = num(state, "blue");
  const savedRed = num(state, "red");

  const savedShape = {
    n: savedN, points, triangles, diagonals, seed: 1, explored: true,
  } as StateShape;
  const drawn = circlesOf(K, savedShape);
  const seeds = [1, 2, 3, 4, 5];
  const sums = seeds.map((seed) => circlesOf(K, cut(K, savedN, points, seed)).signedSum);
  const spread = Math.max(...sums) - Math.min(...sums);
  const gaps = convexGaps(K, points);
  const predicted = gaps === null
    ? null
    : (K.RADIUS as number) *
      (gaps.reduce((a, g) => a + Math.cos(g / 2), 0) - (savedN - 2));
  const formulaError = predicted === null ? null : drawn.signedSum - predicted;
  const sumMatches = near(drawn.signedSum, savedSum, 1e-6);

  return {
    stateVersion,
    n: savedN,
    points: points.map(pt),
    triangles,
    diagonals,
    sum: savedSum,
    blue: savedBlue,
    red: savedRed,
    kind: "demo",
    status: K.describe(savedShape),
    core: {
      signedSum: round(drawn.signedSum, 9),
      signedSumMatchesSaved: sumMatches,
      blue: drawn.blue,
      red: drawn.red,
      incircles: drawn.circles,
    },
    triangulation: {
      seeds,
      sumsAcrossSeeds: sums.map((s) => round(s, 9)),
      spread: round(spread, 9),
      independentOfTriangulation: spread < 1e-6,
      trianglesExpected: savedN - 2,
      diagonalsExpected: savedN - 3,
    },
    convexFormula: predicted === null || gaps === null
      ? null
      : {
        applies: true,
        gapsRadians: gaps.map((g) => round(g, 9)),
        formulaSignedSum: round(predicted, 9),
        residual: sig(formulaError as number),
        holds: Math.abs(formulaError as number) < 1e-6 * Math.max(1, Math.abs(predicted)),
      },
    note:
      `Track.state saved ${savedN} corners, their triangulation and the signed inradius sum. ` +
      `The core rebuilds the ${drawn.blue} blue and ${drawn.red} red incircles and gets ${round(drawn.signedSum, 6)} ` +
      `${sumMatches ? "against" : "rather than"} the saved ${round(savedSum, 6)}. ` +
      `Five fresh triangulations of the same corners vary by ${sig(spread)} units. ` +
      (predicted === null
        ? "The corners are not in convex circular order, so the convex gap formula does not apply."
        : `In circular order the gap formula gives ${round(predicted, 6)}, a residual of ${sig(formulaError as number)} units.`),
  };
}
