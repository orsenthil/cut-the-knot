/*
 * run_game_logic actions and saved-position reader for de Villiers 2.
 *
 * All geometry comes from the real core,
 * de-villiers-2/de-villiers-2-core.js, copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 *
 * The construction: four draggable corners stay on one circle. The tangents
 * at them meet in a tangential quadrilateral (Pitot's equality holds, and its
 * incircle is the original circle). The perpendicular bisectors of its sides
 * then meet in a second quadrilateral. The page's claim — tested here, not
 * merely drawn — is that this second quadrilateral is inscriptible too: its
 * opposite side sums agree and its four distances from the incircle's centre
 * to the sides agree. This is NOT the similar-triangles/parallelogram result
 * of the sibling applet de Villiers (de-villiers/): no similar triangles or
 * parallelogram occur here. A square is degenerate: all four bisectors meet
 * in one point, so there is no second quadrilateral.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["de-villiers-2"].DeVilliers2Core;
type Core = ReturnType<typeof core>;
type Geometry = NonNullable<ReturnType<Core["compute"]>>;
type Point = { x: number; y: number };
type Circle = { c: Point; r: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const roundErr = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e12) / 1e12 : NaN);
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const circleView = (c: Circle | null | undefined) =>
  c ? { center: pt(c.c), radius: round(c.r) } : null;

/** Finite number from a nested object (a saved circle, point or options entry). */
function numField(o: Json, field: string, label: string): number {
  const v = o[field];
  const n = Number(v);
  if (v === undefined || v === null || !Number.isFinite(n)) {
    throw new Error(`"${label}.${field}" must be a number, got ${JSON.stringify(v)}`);
  }
  return n;
}

/** Tool arguments use [x, y]; the page's saved position uses { "x": ..., "y": ... }. */
function readPoint(v: unknown, label: string, fallback?: Point): Point {
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    const x = Number(v[0]), y = Number(v[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`"${label}" must be two finite numbers, got ${JSON.stringify(v)}`);
    }
    return { x, y };
  }
  if (v !== undefined && v !== null && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Json;
    return { x: numField(o, "x", label), y: numField(o, "y", label) };
  }
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(v)}`);
}

function readCircle(v: unknown, label: string): Circle | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`"${label}" must be { "c": {x, y}, "r": number }`);
  }
  const o = v as Json;
  if (!o.c || typeof o.c !== "object" || Array.isArray(o.c)) {
    throw new Error(`"${label}.c" must be a point {x, y}`);
  }
  const c = o.c as Json;
  const circle = { c: { x: numField(c, "x", `${label}.c`), y: numField(c, "y", `${label}.c`) }, r: numField(o, "r", label) };
  if (!(circle.r > 0)) throw new Error(`"${label}.r" must be positive`);
  return circle;
}

/** The four corners, with the reset picture as a fallback for omitted ones. */
function readCorners(C: Core, args: Json) {
  const fresh = C.start();
  return {
    A: readPoint(args.A, "A", fresh.A),
    B: readPoint(args.B, "B", fresh.B),
    Cc: readPoint(args.C, "C", fresh.C),
    D: readPoint(args.D, "D", fresh.D),
  };
}

/**
 * Build the drawing exactly as the applet's drags do: RestrictToCircle snaps
 * every corner onto the circle through the first three, then the tangents and
 * perpendicular bisectors are taken. Returns the core's full geometry.
 */
function computeFromArgs(C: Core, args: Json): { g: Geometry; circle: Circle; corners: Point[] } {
  const given = readCorners(C, args);
  const fitted = C.circumcircle(given.A, given.B, given.Cc);
  if (!fitted || !(fitted.r > 1e-9)) {
    throw new Error("A, B and C are collinear or coincide, so there is no circle through them");
  }
  const circle: Circle = { c: { x: fitted.c.x, y: fitted.c.y }, r: fitted.r };
  const corners = [given.A, given.B, given.Cc, given.D].map((p, i) => {
    const q = C.onCircle(p, circle);
    if (!q) throw new Error(`corner ${"ABCD"[i]} could not be snapped onto the circle`);
    return q as Point;
  });
  const g = C.compute(corners[0], corners[1], corners[2], corners[3]);
  if (!g) {
    throw new Error(
      "those corners make a degenerate picture: two tangents are parallel, or all four bisectors meet at one point (as with a square), so there is no second quadrilateral. Move a corner.",
    );
  }
  return { g, circle, corners };
}

/** Tutor-friendly reading of one drawing, in the SVG's 360 x 300 units. */
function reading(C: Core, g: Geometry) {
  const m = g.measures;
  const cl = g.claims;
  const rawSides = (q: readonly unknown[]) => q.map((p, i) => C.dist(p as Point, q[(i + 1) % 4] as Point));
  const oppositeSums = (s: number[]) => ({ first: round(s[0] + s[2]), second: round(s[1] + s[3]) });
  const rawMainSides = rawSides(g.main);
  const rawStepSides = rawSides(g.step);
  const mainSides = rawMainSides.map(round);
  const stepSides = rawStepSides.map(round);
  return {
    circle: circleView(g.circle),
    corners: { A: pt(g.corners[0]), B: pt(g.corners[1]), C: pt(g.corners[2]), D: pt(g.corners[3]) },
    tangentQuadrilateral: {
      vertices: g.main.map((p) => pt(p as Point)),
      sides: mainSides,
      oppositeSideSums: oppositeSums(rawMainSides),
      incircle: circleView(g.mainIncircle),
      tangencyErrorToCircle: roundErr(m.tangencyError),
    },
    bisectorQuadrilateral: {
      vertices: g.step.map((p: Point) => pt(p)),
      sides: stepSides,
      oppositeSideSums: oppositeSums(rawStepSides),
      incircle: circleView(g.stepIncircle),
      distancesFromCentreToSides: g.stepIncircle.radii.map((r: number) => round(r)),
      inradiusSpread: roundErr(m.incircleSpread),
    },
    measures: {
      mainPitotError: roundErr(m.mainPitot),
      stepPitotError: roundErr(m.stepPitot),
      incircleVsCircleError: roundErr(m.circleErr),
      formula3Error: roundErr(m.formula3Error),
      tolerance: roundErr(m.tol),
    },
    claims: cl,
    note:
      "The tangent quadrilateral is inscriptible: Pitot's equality holds and its incircle is the given circle. The perpendicular-bisector quadrilateral is inscriptible too — its opposite side sums agree (Pitot) and the four distances from its incircle's centre to its sides agree. " +
      "This is de Villiers 2's bisector theorem, not the similar-triangles/parallelogram claim of the sibling applet de Villiers. For a square the four bisectors coincide at one point and the second quadrilateral does not exist.",
  };
}

function checkReading(C: Core, g: Geometry) {
  const cl = g.claims;
  const failed = [
    "cornersOnCircle", "tangentsTouchCircle", "mainIsInscriptible",
    "bisectorsPerpendicular", "bisectorsThroughMidpoints",
    "iterateIsInscriptible", "formula3",
  ].filter((k) => cl[k as keyof typeof cl] !== true);
  return {
    cornersOnCircle: cl.cornersOnCircle,
    tangentsTouchCircle: cl.tangentsTouchCircle,
    mainIsInscriptible: cl.mainIsInscriptible,
    bisectorsPerpendicular: cl.bisectorsPerpendicular,
    bisectorsThroughMidpoints: cl.bisectorsThroughMidpoints,
    iterateIsInscriptible: cl.iterateIsInscriptible,
    formula3: cl.formula3,
    pitot: { mainError: roundErr(g.measures.mainPitot), stepError: roundErr(g.measures.stepPitot) },
    stepInradiusSpread: roundErr(g.measures.incircleSpread),
    tolerance: roundErr(g.measures.tol),
    failed,
    allHold: failed.length === 0,
    note:
      "Both Pitot's opposite-side equality and the equal inradii test are applied to the perpendicular-bisector quadrilateral, so 'inscriptible' is checked twice, not assumed from the picture. " +
      "The sibling applet de Villiers instead builds similar triangles on a quadrilateral's sides and asks whether their free tips form a parallelogram; that is a different theorem.",
  };
}

export function actions(): GameActions {
  const sample = '{ "A": [255, 150], "B": [207.1768315857505, 219.90293144754196], "C": [107.1781376137807, 167.9436996910487], "D": [164.1903150426915, 76.68524117511772] }';
  return {
    bisector_iterate: {
      describe:
        "For four corners A, B, C, D as [x, y] points in the page's 360 x 300 board (y down), snap them onto the circle through A, B, C as the applet's drags do, draw the tangents at them and meet them into a tangential quadrilateral, then meet the perpendicular bisectors of its sides into a second quadrilateral. Report both quadrilaterals, their sides and opposite-side sums, their incircles (including the four distances from the second incircle's centre to its sides) and every claim. The second quadrilateral is inscriptible by Pitot's equality and equal inradii; this is de Villiers 2's bisector theorem, not the similar-triangles/parallelogram theorem of its sibling de Villiers. Corners may be omitted to use the reset picture.",
      args: sample,
      run: (args) => {
        const C = core();
        return reading(C, computeFromArgs(C, args).g);
      },
    },
    check_inscriptible: {
      describe:
        "Test every claim on the de Villiers 2 page for four corners A, B, C, D (snapped onto their common circle): the corners are concyclic, the four tangents graze the circle, the tangent quadrilateral is inscriptible, its bisectors are perpendicular and pass through the side midpoints, the perpendicular-bisector quadrilateral is inscriptible, and the article's signed formula (3) holds. Returns a boolean per claim, the names that fail, the Pitot errors, the spread of the second incircle's four radii and the core's tolerance. Unlike the sibling applet de Villiers, this theorem is about perpendicular bisectors and incircles, not similar triangles and parallelograms; a square is degenerate because all four bisectors meet at one point.",
      args: sample,
      run: (args) => {
        const C = core();
        return checkReading(C, computeFromArgs(C, args).g);
      },
    },
  };
}

/** The saved fields from Track.state plus a fresh core reading of those corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported de Villiers 2 state version ${stateVersion}`);
  }
  const C = core();
  const fresh = C.start();
  const A = readPoint(state.A, "A", fresh.A);
  const B = readPoint(state.B, "B", fresh.B);
  const Cc = readPoint(state.C, "C", fresh.C);
  const D = readPoint(state.D, "D", fresh.D);
  const savedCircle = readCircle(state.circle, "circle");
  const o = state.options && typeof state.options === "object" && !Array.isArray(state.options)
    ? state.options as Json : {};
  const options = {
    names: o.names === true, angles: o.angles === true, diagonals: o.diagonals === true,
    joints: o.joints !== false, primary: o.primary === true, secondary: o.secondary === true,
  };
  const here = { ...fresh, A, B, C: Cc, D, circle: savedCircle || fresh.circle, options };
  const g = C.geometry(here);
  const savedPoints = (key: string) =>
    Array.isArray(state[key]) ? (state[key] as unknown[]).map((p, i) => readPoint(p, `${key}[${i}]`)) : null;
  const savedPt = (key: string) => {
    const v = state[key];
    return v && typeof v === "object" && !Array.isArray(v)
      ? pt({ x: numField(v as Json, "x", key), y: numField(v as Json, "y", key) })
      : null;
  };
  const savedMain = savedPoints("main");
  const savedStep = savedPoints("step");
  const eq = (saved: Point[] | null, corePoints: Point[]) => saved !== null && saved.length === corePoints.length &&
    saved.every((p, i) => Math.abs(p.x - corePoints[i].x) < 1e-6 && Math.abs(p.y - corePoints[i].y) < 1e-6);
  return {
    stateVersion,
    A: pt(A), B: pt(B), C: pt(Cc), D: pt(D),
    circle: circleView(savedCircle),
    main: savedMain && savedMain.map(pt),
    step: savedStep && savedStep.map(pt),
    options,
    savedClaims: state.claims === undefined || state.claims === null ? null : state.claims,
    savedMeasures: state.measures === undefined || state.measures === null ? null : state.measures,
    savedMatchesCore: g ? {
      main: eq(savedMain, g.main as Point[]),
      step: eq(savedStep, g.step as Point[]),
      claims: state.claims && typeof state.claims === "object"
        ? Object.keys(g.claims).every((k) =>
            (state.claims as Json)[k] === (g.claims as unknown as Json)[k])
        : null,
    } : null,
    reading: g ? reading(C, g) : {
      note: "Those saved corners do not make a drawable construction; move a corner to see the tangents and bisectors.",
    },
    statusSentence: C.describe(here),
  };
}
