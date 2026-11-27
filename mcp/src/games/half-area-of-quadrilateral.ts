/*
 * run_game_logic actions and saved-position reader for Half Area Of Quadrilateral.
 *
 * The real core is half-area-of-quadrilateral/half-area-of-quadrilateral-core.js,
 * copied into src/generated/cores/ at build time. It transcribes the applet's
 * Compute(): K is the midpoint of diagonal BD; the line through K parallel to
 * the other diagonal AC meets AB or AD (whichever is nearer) at E; CE then
 * cuts the quadrilateral into two pieces of equal area. The core also measures
 * the four pairs of equal triangles that make the area-swap proof work.
 *
 * This is Dividing Evenly a Quadrilateral I. It is deliberately not the
 * B/D-parallel sibling (Half Area Of Quadrilateral II), which draws a parallel
 * through B or D and bisects with the median CM from C. Every number below is
 * measured by the real core, in the page's 400 x 250 board units (y down).
 * This is a demonstration, so there is no win or loss. See _shared.ts for shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };

type State = {
  A: Point; B: Point; C: Point; D: Point;
  options: { names: boolean; premise: boolean; hint: boolean };
  explored: boolean;
};

type Areas = {
  total: number; quad: number; tri: number; difference: number;
  abk: number; adk: number; cbk: number; cdk: number;
  aek: number; cek: number; ael: number; ckl: number;
};

type Claims = {
  equalHalves: boolean; eOnSide: boolean; bisects: boolean;
  abkAdk: boolean; cbkCdk: boolean; aekCek: boolean; aelCkl: boolean;
  bdInterior: boolean; convex: boolean;
};

type Geometry = {
  A: Point; B: Point; C: Point; D: Point;
  K: Point; E: Point; L: Point; guide: Point; onAB: Point; onAD: Point;
  useAB: boolean; side: "AB" | "AD"; nearCorner: Point; farCorner: Point;
  quad: Point[]; tri: Point[]; valid: boolean;
  areas: Areas; claims: Claims; tol: number;
};

interface Core {
  VIEW: { x: number; y: number; width: number; height: number };
  start(options?: Json): State;
  move(state: State, name: string, p: Point): State;
  geometry(state: State): Geometry | null;
}

const core = (): Core =>
  cores["half-area-of-quadrilateral"].HalfAreaOfQuadrilateralCore as unknown as Core;

/* The core is exact up to floating point; tidy only the numbers we print. */
const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : NaN);
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: r6(p.x), y: r6(p.y) }
    : null;
const poly = (pts: Point[]): (Point | null)[] => (pts || []).map(pt);

/** Treat two measurements as equal when they agree to about six significant figures. */
const close = (x: number, y: number): boolean =>
  Number.isFinite(x) && Number.isFinite(y) &&
  Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));
const pointClose = (p: Point | null | undefined, q: Point | null | undefined): boolean =>
  !!p && !!q && close(p.x, q.x) && close(p.y, q.y);

/** A board point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Point): Point {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing argument "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/**
 * A real core state: start from the applet's opening quadrilateral and apply
 * each supplied corner as a drag (which clamps it to the board), exactly as
 * the live page does. Omitted corners keep their opening positions.
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with A, B, C and D points");
  }
  let s = C.start({});
  for (const name of ["A", "B", "C", "D"] as const) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) s = C.move(s, name, readPoint(raw, name));
  }
  return s;
}

/** Compute() draws nothing for coincident corners or a guide missing both sides. */
function requireGeometry(C: Core, s: State): Geometry {
  const g = C.geometry(s);
  if (!g || !g.valid) {
    throw new Error(
      "A, B, C and D must be four distinct corners ([x, y] or { x, y }) with the " +
      "line through the midpoint of BD parallel to AC crossing AB or AD",
    );
  }
  return g;
}

/** Everything the core measures about the construction and the two pieces. */
function reading(C: Core, g: Geometry) {
  const a = g.areas, cl = g.claims;
  return {
    board: { width: C.VIEW.width, height: C.VIEW.height },
    corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    midpointK: pt(g.K),
    guideThroughKParallelToAC: { from: pt(g.K), to: pt(g.guide) },
    intersections: {
      onAB: pt(g.onAB), onAD: pt(g.onAD), nearerIsOn: g.side, E: pt(g.E),
    },
    crossingL: pt(g.L),
    dividingLine: { from: pt(g.C), to: pt(g.E) },
    pieces: { quadrilateral: poly(g.quad), triangle: poly(g.tri) },
    areas: {
      total: r6(a.total), quad: r6(a.quad), tri: r6(a.tri), difference: sig(a.difference),
    },
    proofPairs: {
      abkEqualsAdk: cl.abkAdk, cbkEqualsCdk: cl.cbkCdk,
      aekEqualsCek: cl.aekCek, aelEqualsCkl: cl.aelCkl,
    },
    proofAreas: {
      abk: r6(a.abk), adk: r6(a.adk), cbk: r6(a.cbk), cdk: r6(a.cdk),
      aek: r6(a.aek), cek: r6(a.cek), ael: r6(a.ael), ckl: r6(a.ckl),
    },
    claims: {
      equalHalves: cl.equalHalves, eOnSide: cl.eOnSide, bisects: cl.bisects,
      bdInterior: cl.bdInterior, convex: cl.convex,
    },
    tolerance: sig(g.tol),
  };
}

/** Keep the two constructions apart: the tutor should not mix up CE with CM. */
const SIBLING_NOTE =
  "This is Dividing Evenly a Quadrilateral I: K is the midpoint of BD and the line through K " +
  "parallel to AC meets AB or AD at E, so the dividing line is CE. It is not the B/D-parallel " +
  "sibling (Dividing Evenly a Quadrilateral II), which draws a parallel through B or D, takes " +
  "the median from C to the midpoint M of the side cut off and bisects with CM instead of CE.";

/* The saved quadrilateral from the live fixture, as corners for the examples. */
const EXAMPLE_ARGS =
  '{"A":[138.33333333333334,35.714285714285715],' +
  '"B":[66.66666666666667,208.33333333333334],' +
  '"C":[333.3333333333333,200],' +
  '"D":[266.6666666666667,62.5]}';

export function actions(): GameActions {
  return {
    halving_line: {
      describe:
        "For a quadrilateral with corners A, B, C, D (each [x, y] or { x, y } in the page's 400 x 250 board; omit a corner to keep the opening picture), use the real core to find K the midpoint of BD and the line through K parallel to AC, then take E as the nearer crossing on AB or AD. Report E, the crossing L, the two pieces cut by CE with their areas, and whether CE halves the shape; the note distinguishes this CE construction from the B/D-parallel sibling that bisects with CM.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = requireGeometry(C, s);
        const r = reading(C, g);
        return {
          ...r,
          note:
            `K = (B+D)/2 is the midpoint of BD, and through K the core draws the line parallel to AC; ` +
            `that line meets side ${g.side} at E = (${r.intersections.E!.x}, ${r.intersections.E!.y}). ` +
            `CE cuts the shape into a ${r.areas.quad} square-unit piece and a ${r.areas.tri} square-unit piece — ` +
            (g.claims.bisects
              ? "the two areas agree, so CE halves the quadrilateral. "
              : "the areas do not agree, so CE does not split the quadrilateral into equal pieces. ") +
            (g.claims.bdInterior
              ? "BD lies inside the shape, so these are the two pieces of the drawing."
              : "BD lies outside the shape, so the matching areas are polygons rather than two drawn pieces.") +
            " " + SIBLING_NOTE,
        };
      },
    },

    equal_area_pairs: {
      describe:
        "For the same quadrilateral, report the four pairs of equal triangle areas the real core measures: ABK = ADK and CBK = CDK (K halves BD), AEK = CEK (KE parallel to AC), and AEL = CKL after removing the common triangle LEK. These equal swaps turn ABCK into BCE and ADCK into AECD, so area(BCE) = area(AECD) and CE halves the quadrilateral; arguments and validation are as in halving_line.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = requireGeometry(C, s);
        const r = reading(C, g);
        const a = g.areas;
        return {
          board: r.board,
          corners: r.corners,
          midpointK: r.midpointK,
          side: g.side,
          proofPairs: r.proofPairs,
          proofAreas: r.proofAreas,
          pieces: r.pieces,
          areas: r.areas,
          claims: r.claims,
          tolerance: r.tolerance,
          note:
            `The core measures ABK = ${r6(a.abk)} and ADK = ${r6(a.adk)}, CBK = ${r6(a.cbk)} and ` +
            `CDK = ${r6(a.cdk)} (equal bases on BD and the same altitude), AEK = ${r6(a.aek)} and ` +
            `CEK = ${r6(a.cek)} (the shared base EK between parallels), then AEL = ${r6(a.ael)} and ` +
            `CKL = ${r6(a.ckl)} after dropping the common triangle LEK. Swapping AEL for CKL gives ` +
            `area(BCE) = ${r6(a.tri)} and area(AECD) = ${r6(a.quad)}, so CE halves the shape. ` +
            SIBLING_NOTE,
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Half Area Of Quadrilateral state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Half Area Of Quadrilateral position must be an object");
  }

  const C = core();
  const savedCorners = {
    A: readPoint(state.A, "saved A"),
    B: readPoint(state.B, "saved B"),
    C: readPoint(state.C, "saved C"),
    D: readPoint(state.D, "saved D"),
  };
  const savedK = readPoint(state.K, "saved K");
  const savedE = readPoint(state.E, "saved E");
  const savedL = readPoint(state.L, "saved L");

  /* Rebuild the state the page drew: its options and four dragged corners. */
  const rawOptions = (state.options && typeof state.options === "object" && !Array.isArray(state.options))
    ? state.options as Json
    : {};
  let s = C.start(rawOptions);
  for (const name of ["A", "B", "C", "D"] as const) s = C.move(s, name, savedCorners[name]);
  const g = C.geometry(s);

  const saved = {
    A: pt(savedCorners.A), B: pt(savedCorners.B), C: pt(savedCorners.C), D: pt(savedCorners.D),
    K: pt(savedK), E: pt(savedE), L: pt(savedL),
    side: state.side, options: s.options, explored: state.explored === true,
    areas: state.areas, claims: state.claims,
  };

  const base = { ...state, stateVersion, saved };

  if (!g || !g.valid) {
    return {
      ...base,
      valid: false,
      drawingPossible: false,
      note:
        "Track.state saved the four corners, the computed K, E and L, the side E fell on, the " +
        "names/premise/hint switches and the core's areas and claims, but those corners are too " +
        "close together (or the guide misses both sides), so the core draws nothing here. " +
        "This is a demonstration with no win or loss.",
    };
  }

  const r = reading(C, g);
  const savedAreas = (state.areas && typeof state.areas === "object" && !Array.isArray(state.areas))
    ? state.areas as Json
    : {};
  const numberOrNull = (obj: Json, key: string): number | null => {
    const v = obj[key];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const savedTotal = numberOrNull(savedAreas, "total");
  const savedQuad = numberOrNull(savedAreas, "quad");
  const areaMatches =
    (savedTotal === null || close(savedTotal, g.areas.total)) &&
    (savedQuad === null || close(savedQuad, g.areas.quad));

  return {
    ...base,
    valid: true,
    drawingPossible: true,
    isIllustration: true,
    midpointK: r.midpointK,
    E: r.intersections.E,
    side: g.side,
    crossingL: r.crossingL,
    dividingLine: r.dividingLine,
    pieces: r.pieces,
    areas: r.areas,
    proofPairs: r.proofPairs,
    claims: r.claims,
    savedMatchesCore:
      pointClose(savedK, g.K) && pointClose(savedE, g.E) && pointClose(savedL, g.L) &&
      saved.side === g.side && areaMatches,
    reading: r,
    note:
      "Track.state saved the four draggable corners A, B, C and D, the computed K, E and L, " +
      "which side E fell on, the names/premise/hint switches, the explored flag and the core's " +
      "areas and claims. The core rebuilds K, E and L from those corners and re-measures the two " +
      "pieces: CE halves the quadrilateral when E lies on a side and the two areas agree. " +
      SIBLING_NOTE,
  };
}
