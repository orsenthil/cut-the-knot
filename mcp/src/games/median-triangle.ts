/*
 * run_game_logic actions and saved-position reader for Median Triangle.
 *
 * Every number below comes from the site's own median-triangle-core.js (copied
 * into src/generated/cores/ at build time): construct() is the applet's
 * Compute() method and geometry()/label() wrap it. See _shared.ts for the
 * shape of a game module.
 *
 * The two facts a tutor can show here are (1) the blue triangle B M_b E has
 * the three medians as its sides and always takes exactly 3/4 of triangle
 * ABC's area, and (2) the applet's D (reflection of A in M_a) is not the
 * article's D (reflection of the centroid G in M_a); only the article's BDG
 * has sides 2/3 of the medians and 1/3 of ABC's area.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["median-triangle"].MedianTriangleCore;
type TriangleCore = ReturnType<typeof core>;
type Point = { x: number; y: number };

const round = (n: number): number => Math.round(n * 1e6) / 1e6;
const pt = (p: Point) => ({ x: round(p.x), y: round(p.y) });

function readPoint(value: unknown, label: string): Point {
  const p = value as Json;
  if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
    throw new Error(`${label} must have numeric x and y`);
  }
  return { x: Number(p.x), y: Number(p.y) };
}

/** Corners default to the applet's own initial triangle. */
function readTriangle(K: TriangleCore, args: Json): { A: Point; B: Point; C: Point } {
  const start = K.start();
  return {
    A: args.A !== undefined && args.A !== null ? readPoint(args.A, "A") : start.A,
    B: args.B !== undefined && args.B !== null ? readPoint(args.B, "B") : start.B,
    C: args.C !== undefined && args.C !== null ? readPoint(args.C, "C") : start.C,
  };
}

/** The real core construction for finite, non-degenerate corners. */
function construct(K: TriangleCore, A: Point, B: Point, C: Point) {
  if (!K.geometry({ A, B, C }).valid) throw new Error("A, B and C must be finite points");
  return K.construct(A, B, C);
}

/** The core-derived facts shared by the area action and the saved reader. */
function reading(K: TriangleCore, A: Point, B: Point, C: Point) {
  const g = construct(K, A, B, C);
  const blueArea = K.area(...g.medianTriangle);
  const ratio = g.area > 1e-12 ? blueArea / g.area : 0;
  const { ma, mb, mc } = g.medianLengths;
  const s = (ma + mb + mc) / 2;
  const heron = Math.sqrt(Math.max(0, s * (s - ma) * (s - mb) * (s - mc)));
  const blueSides = [
    K.dist(g.B, g.Bm), K.dist(g.Bm, g.E), K.dist(g.E, g.B),
  ];
  return {
    A: pt(A), B: pt(B), C: pt(C),
    centroidG: pt(g.G),
    midpoints: { Ma: pt(g.Am), Mb: pt(g.Bm), Mc: pt(g.Cm) },
    sides: { a: round(g.sides.a), b: round(g.sides.b), c: round(g.sides.c) },
    medians: { ma: round(ma), mb: round(mb), mc: round(mc) },
    blueTriangle: { vertices: g.medianTriangle.map(pt), sides: blueSides.map(round) },
    abcArea: round(g.area),
    blueArea: round(blueArea),
    blueShare: round(ratio),
    bluePercent: round(ratio * 100),
    heronOnMedians: round(heron),
    quarterPieces: [
      K.area(...g.cornerTriangles[0]),
      K.area(...g.cornerTriangles[1]),
      K.area(...g.cornerTriangles[2]),
      K.area(...g.centerTriangle),
    ].map(round),
    note: `${(ratio * 100).toFixed(1)}% of ABC, and Heron's formula on the three medians agrees to ${Math.abs(heron - blueArea).toExponential(1)} square units.`,
  };
}

export function actions(): GameActions {
  return {
    median_area: {
      describe:
        "For a triangle ABC (corners default to the applet's start), lay its three medians end to end into the blue triangle B Mb E and report both areas: the blue triangle always has exactly 3/4 of ABC's area, and Heron's formula on the medians confirms it.",
      args: '{ "A": {"x":65,"y":230}, "B": {"x":300,"y":230}, "C": {"x":220,"y":50} }',
      run: (args) => {
        const K = core();
        const { A, B, C } = readTriangle(K, args);
        const g = construct(K, A, B, C);
        const r = reading(K, A, B, C);
        return {
          ...r,
          blueSideToMedian: {
            B_Mb: { length: round(K.dist(g.B, g.Bm)), median: "mb" },
            Mb_E: { length: round(K.dist(g.Bm, g.E)), median: "ma" },
            E_B: { length: round(K.dist(g.E, g.B)), median: "mc" },
          },
          exactlyThreeQuarters: Math.abs(r.blueShare - 0.75) < 1e-9,
          hint: "Tick 'hint' on the page: each midpoint cuts its side into two equal halves, which is why the four pink pieces are equal quarters.",
        };
      },
    },
    two_definitions_of_d: {
      describe:
        "For a triangle ABC, compare the Java applet's D (the reflection of A in the midpoint Ma of BC) with the article's D (the reflection of the centroid G in Ma). They are different points; only the article's triangle BDG has sides two thirds of the medians and one third of ABC's area, and scaling it by 3/2 gives the 3/4 median triangle.",
      args: '{ "A": {"x":65,"y":230}, "B": {"x":300,"y":230}, "C": {"x":220,"y":50} }',
      run: (args) => {
        const K = core();
        const { A, B, C } = readTriangle(K, args);
        const g = construct(K, A, B, C);
        const bdgArea = K.area(g.B, g.articleD, g.G);
        const bdgSides = [
          K.dist(g.B, g.G), K.dist(g.G, g.articleD), K.dist(g.articleD, g.B),
        ];
        const blueArea = K.area(...g.medianTriangle);
        return {
          A: pt(A), B: pt(B), C: pt(C),
          midpointMa: pt(g.Am), centroidG: pt(g.G),
          appletD: pt(g.D), articleD: pt(g.articleD),
          sameD: K.dist(g.D, g.articleD) < 1e-9,
          appletDIsReflectionOfA: pt(K.midpoint(g.D, A)),
          articleDIsReflectionOfG: pt(K.midpoint(g.articleD, g.G)),
          articleTriangleBDG: {
            vertices: [pt(g.B), pt(g.articleD), pt(g.G)],
            sides: bdgSides.map(round),
            sidesAsFractionsOfMedians: {
              BG_over_mb: round(bdgSides[0] / g.medianLengths.mb),
              GD_over_ma: round(bdgSides[1] / g.medianLengths.ma),
              DB_over_mc: round(bdgSides[2] / g.medianLengths.mc),
            },
            area: round(bdgArea),
            shareOfABC: round(bdgArea / g.area),
          },
          blueArea: round(blueArea),
          blueToBDGSideRatio: 1.5,
          blueToBDGAreaRatio: round(blueArea / bdgArea),
          note: "The applet's D completes the parallelogram with A and D opposite; the article's D is G reflected in Ma. Only BDG has the 2/3-median sides, and (3/2)^2 * (1/3) = 3/4 gives the blue area.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of the picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Median Triangle state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Median Triangle position must be an object");
  }
  const K = core();
  const { A, B, C } = readTriangle(K, state);
  const g = construct(K, A, B, C);
  const opts = (state.options && typeof state.options === "object" ? state.options : {}) as Json;
  return {
    ...state,
    stateVersion,
    saved: { ...state },
    valid: true,
    namesShown: opts.names === true,
    hintShown: opts.hint === true,
    core: reading(K, A, B, C),
    line: K.label({ valid: true, ...g }),
  };
}
