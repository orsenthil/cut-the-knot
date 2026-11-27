/*
 * run_game_logic actions and saved-position reader for Circles Cover Quadrilateral.
 * The geometry lives in circles-cover-quadrilateral-core.js, copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 *
 * Four circles are centred at the corners A, B, C, D of a quadrilateral. The
 * illustration asks whether, if all four circles cover the quadrilateral,
 * some one of its four triangles (ABC, BCD, CDA, DAB) is already covered by
 * the three circles at that triangle's own corners. The core decides covering
 * on a fine grid: for f(p) = min_i(distance(p, centre_i) - r_i), a largest
 * sampled gap at most -h proves covering everywhere (f is 1-Lipschitz), and
 * a positive gap proves a hole; the actions below use a mesh of 2 board units
 * so neither answer depends on grid luck. Every number reported here comes
 * from the real core, never from a second transcription of the geometry.
 */

import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-cover-quadrilateral"].CirclesCoverQuadrilateralCore;
type Core = ReturnType<typeof core>;
type State = ReturnType<Core["start"]>;
type Geometry = NonNullable<ReturnType<Core["geometry"]>>;
type Classification = ReturnType<Core["classify"]>;
type Point = { x: number; y: number };

const NAMES = ["A", "B", "C", "D"] as const;
/* Fine enough that a borderline triangle's answer is settled at this mesh. */
const MESH = 2;

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e3) / 1e3 : NaN);
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const circleName = (i: number): string => NAMES[i];

function numField(o: Json, field: string, outer: string): number {
  const v = o[field];
  const n = Number(v);
  if (v === undefined || v === null || !Number.isFinite(n)) {
    throw new Error(`argument "${outer}.${field}" must be a number, got ${JSON.stringify(v)}`);
  }
  return n;
}

/** Accept [x, y] or { "x": ..., "y": ... }, falling back to the reset corner. */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const v = args[key];
  if (v === undefined || v === null) return { x: fallback.x, y: fallback.y };
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    const a = numArray(args, key);
    return { x: a[0], y: a[1] };
  }
  if (typeof v === "object") {
    const o = v as Json;
    return { x: numField(o, "x", key), y: numField(o, "y", key) };
  }
  throw new Error(`argument "${key}" must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(v)}`);
}

/** The four slider values, snapped to the applet's 0..600, step 5 grid. */
function readRadii(C: Core, args: Json, fallback: number[]): number[] {
  const v = args.radii;
  if (v === undefined || v === null) return fallback.slice();
  const r = numArray(args, "radii");
  if (r.length !== 4) {
    throw new Error("argument \"radii\" must be four numbers, one for each circle A, B, C, D");
  }
  return r.map((x, i) => {
    if (x < C.RADIUS.min || x > C.RADIUS.max) {
      throw new Error(`radii[${i}] must be between ${C.RADIUS.min} and ${C.RADIUS.max}, the slider range`);
    }
    return C.snapRadius(x);
  });
}

function readOn(args: Json, fallback: boolean[]): boolean[] {
  const v = args.on;
  if (v === undefined || v === null) return fallback.slice();
  if (!Array.isArray(v) || v.length !== 4 || !v.every((x) => typeof x === "boolean")) {
    throw new Error("argument \"on\" must be four booleans, one per circle A, B, C, D");
  }
  return (v as boolean[]).slice();
}

/** Build the core's state; corners outside the board are clamped as dragging does. */
function readState(C: Core, args: Json): State {
  const fresh = C.start();
  return {
    A: C.clamp(readPoint(args, "A", fresh.A)),
    B: C.clamp(readPoint(args, "B", fresh.B)),
    C: C.clamp(readPoint(args, "C", fresh.C)),
    D: C.clamp(readPoint(args, "D", fresh.D)),
    radii: readRadii(C, args, fresh.radii),
    on: readOn(args, fresh.on),
    explored: true,
  };
}

function geometry(C: Core, s: State): Geometry {
  const g = C.geometry(s, MESH);
  if (!g) {
    throw new Error("those corners and radii do not make a drawing: every corner and radius must be a finite number");
  }
  return g;
}

const gapReport = (c: Classification) => ({
  largestGap: round(c.maxGap),
  covered: c.covered,
  certainCovered: c.certainCovered,
  certainUncovered: c.certainUncovered,
});

/** Everything the illustration can say about one drawing, from the core. */
function reading(C: Core, s: State, g: Geometry) {
  return {
    corners: { A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D) },
    radii: { A: s.radii[0], B: s.radii[1], C: s.radii[2], D: s.radii[3] },
    visible: { A: s.on[0], B: s.on[1], C: s.on[2], D: s.on[3] },
    visibleCircles: g.active.map(circleName),
    quadrilateral: gapReport(g.quad),
    triangles: g.triangles.map((t) => ({
      name: t.name,
      ownCircles: t.name.split(""),
      ownThree: gapReport(t.own),
      bestVisibleTriple: {
        circles: t.best.indices.map(circleName),
        largestGap: round(t.best.maxGap),
      },
      coveredBySomeVisibleTriple: t.coveredBySomeTriple,
    })),
    hypothesis: g.hypothesis,
    conclusion: g.conclusion,
    conclusionLiteral: g.conclusionLiteral,
    theoremHolds: g.theorem,
    meshSpacing: g.spacing,
    status: C.describe(s, g),
    howToRead:
      "The hypothesis is 'all four visible circles cover the quadrilateral'; the conclusion is " +
      "'some triangle is covered by the three circles at its own corners'. A negative largest gap " +
      `means covered; below -${g.spacing} it is certain everywhere, while a positive gap proves a hole. ` +
      "Only visible circles count towards the hypothesis and the best visible triple.",
  };
}

export function actions(): GameActions {
  return {
    check_covering: {
      describe:
        "For corners A, B, C, D in the illustration's 640 by 400 board (y down) and four radii on the slider grid 0..600 in steps of 5, report whether all visible circles cover the whole quadrilateral and, for each of the four triangles ABC, BCD, CDA, DAB, whether the three circles at its own corners cover it. Also gives the largest uncovered gap for each, the best visible triple of circles, the theorem's hypothesis and conclusion, and the page's status line. Corners default to the reset quadrilateral, radii to 120, 140, 160, 180; all circles start visible, or pass on = [true, false, ...] to hide some.",
      args: '{ "A": [160, 100], "B": [213, 300], "C": [480, 320], "D": [512, 80], "radii": [165, 190, 220, 245] }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        return reading(C, s, geometry(C, s));
      },
    },
    fit_radii: {
      describe:
        "Press the page's 'Make them cover' button: scale the given radii in their own proportions to the smallest slider-grid values for which all four visible circles cover the quadrilateral, then report the covering of the quadrilateral and of each of the four triangles with its own three circles. Same arguments as check_covering; radii default to 120, 140, 160, 180. Corners are clamped to the board as dragging does.",
      args: '{ "A": [160, 100], "B": [213, 300], "C": [480, 320], "D": [512, 80], "radii": [120, 140, 160, 180] }',
      run: (args) => {
        const C = core();
        const s = readState(C, args);
        const radii = C.fitRadii(s);
        const fitted: State = { ...s, radii, on: [true, true, true, true], explored: true };
        const g = geometry(C, fitted);
        return {
          chosenRadii: { A: radii[0], B: radii[1], C: radii[2], D: radii[3] },
          ...reading(C, fitted, g),
          note:
            "The button only changes radii and shows all four circles; the corners are untouched. " +
            (g.hypothesis
              ? "With the hypothesis satisfied, look for a triangle covered by its own three circles."
              : "Even at these radii the four circles do not cover the quadrilateral; try dragging the corners."),
        };
      },
    },
  };
}

/** The page's saved drawing and options, re-read through the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circles Cover Quadrilateral state version ${stateVersion}`);
  }
  const C = core();
  const s = readState(C, state);
  const g = geometry(C, s);
  const savedHypothesis = typeof state.hypothesis === "boolean" ? state.hypothesis : null;
  const savedConclusion = typeof state.conclusion === "boolean" ? state.conclusion : null;
  const savedTriangles = Array.isArray(state.coveredTriangles)
    ? state.coveredTriangles.filter((x): x is string => typeof x === "string")
    : null;
  const coveredNow = g.triangles.filter((t) => t.own.covered).map((t) => t.name).sort();
  return {
    stateVersion,
    // The fields the page saved with Track.state, unchanged.
    A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D),
    radii: s.radii.slice(), on: s.on.slice(),
    savedHypothesis,
    savedConclusion,
    savedCoveredTriangles: savedTriangles,
    matchesSaved: {
      hypothesis: savedHypothesis === null ? null : savedHypothesis === g.hypothesis,
      conclusion: savedConclusion === null ? null : savedConclusion === g.conclusion,
      coveredTriangles: savedTriangles === null
        ? null
        : JSON.stringify(savedTriangles.slice().sort()) === JSON.stringify(coveredNow),
    },
    reading: reading(C, s, g),
    note: C.describe(s, g),
  };
}
