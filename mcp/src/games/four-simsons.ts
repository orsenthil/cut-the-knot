/*
 * run_game_logic actions and saved-position reader for Four Simsons
 * (Alexander Bogomolny's FourSimsons applet, "Simsons and 9-Point Circles in
 * Cyclic Quadrilateral").
 *
 * Four corners A, B, C, D are dragged round one circle. Each corner has a
 * Simson line in the triangle made by the other three corners, and each of
 * those four triangles has a nine-point centre and a nine-point circle. The
 * page says that all eight objects pass through one point H. H is the
 * circumcenter of the four nine-point centres N_A N_B N_C N_D, which form a
 * half-size copy of ABCD: its circumradius is R/2 and so is every nine-point
 * radius, so four equal circles centred R/2 from H all pass through H. H is
 * also the centre of the homothety taking ABCD to the quadrilateral of the
 * four orthocentres, hence the common midpoint of A H_A, B H_B, C H_C, D H_D;
 * a Simson line runs through that midpoint.
 *
 * Every number below is measured by the real core in
 * four-simsons/four-simsons-core.js, copied into src/generated/cores/ at build
 * time. Coordinates are board units of the applet's 400 x 300 view, y down.
 * This is an illustration, so there is no win or loss. See _shared.ts for the
 * module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };
type Simson = { feet: Point[]; first: Point; second: Point; third: Point };
type Options = { centers: boolean; circles: boolean; simsons: boolean };
type State = { angles: number[]; options: Options; selected: number; explored: boolean };
type Measures = {
  circleError: number; simsonError: number; homothetyError: number;
  radiusError: number; nQuadError: number; similarityError: number;
  collinearError: number;
};
type Claims = {
  circlesConcurrent: boolean; simsonsConcurrent: boolean; homothetyMidpoints: boolean;
  ninePointRadiusHalfR: boolean; nQuadSimilarHalf: boolean; nQuadCircumcenter: boolean;
  pedalFeetCollinear: boolean; cyclic: boolean;
};
type Geometry = {
  A: Point; B: Point; C: Point; D: Point; points: Point[];
  triangles: Point[][]; INDEX: number[][];
  centers: Point[]; orthocenters: Point[]; circles: Circle[]; simsons: Simson[];
  circumcenter: Point; circumradius: number; H: Point; homothetyMidpoints: Point[];
  measures: Measures; claims: Claims; tol: number;
};
interface Core {
  VIEW: { x: number; y: number; width: number; height: number };
  NAMES: string[];
  OPTION_NAMES: string[];
  start(options?: Json): State;
  move(state: State, name: string, angleOrPoint: number | Point): State;
  setOption(state: State, name: string, on: boolean): State;
  select(state: State, index: number): State;
  geometry(state: State): Geometry | null;
  compute(a: Point, b: Point, c: Point, d: Point): Geometry | null;
  circumcenter(a: Point, b: Point, c: Point): Point;
  dist(p: Point, q: Point): number;
  distToLine(p: Point, a: Point, b: Point): number;
  angleOf(p: Point): number;
  describe(state: State): string;
}

const core = (): Core => cores["four-simsons"].FourSimsonsCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : NaN);
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;

/** A board point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string): Point {
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

const safePoint = (raw: unknown): Point | null => {
  try { return pt(readPoint(raw, "saved point")); } catch { return null; }
};
const safePoints = (raw: unknown): Array<Point | null> =>
  Array.isArray(raw) ? raw.map(safePoint) : [];
const safeCircles = (raw: unknown): Array<{ center: Point | null; radius: number | null }> =>
  Array.isArray(raw) ? raw.map((c) => {
    if (!c || typeof c !== "object" || Array.isArray(c)) return { center: null, radius: null };
    const o = c as Json;
    return {
      center: safePoint(o.center),
      radius: typeof o.radius === "number" && Number.isFinite(o.radius) ? r6(o.radius) : null,
    };
  }) : [];
const safeLines = (raw: unknown): Array<[Point | null, Point | null]> =>
  Array.isArray(raw) ? raw.map((line) =>
    Array.isArray(line) && line.length >= 2 ? [safePoint(line[0]), safePoint(line[1])] : [null, null],
  ) : [];

function readOptions(raw: unknown): Options {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Json : {};
  return { centers: o.centers === true, circles: o.circles === true, simsons: o.simsons === true };
}

function readSelected(raw: unknown): number {
  if (raw === undefined || raw === null) return -1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= -1 && n <= 3 ? n : -1;
}

/**
 * Build a core state from JSON args the way the page's drags do. Each corner
 * is either [x, y] / { x, y } (projected onto the circle by Core.move) or a
 * number giving the angle in radians. Omitted corners keep the opening
 * diagram; options and the highlighted line are optional.
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C, D points (or angles) and display options");
  }
  let s = C.start({});
  for (const name of C.NAMES) {
    const v = args[name];
    if (v === undefined || v === null) continue;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) throw new Error(`"${name}" angle must be a finite number of radians`);
      s = C.move(s, name, v);
    } else {
      s = C.move(s, name, readPoint(v, name));
    }
  }
  if (args.options !== undefined && args.options !== null) {
    if (typeof args.options !== "object" || Array.isArray(args.options)) {
      throw new Error('"options" must be an object with boolean centers/circles/simsons');
    }
    const o = args.options as Json;
    for (const key of C.OPTION_NAMES) {
      const value = o[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== "boolean") throw new Error(`"options.${key}" must be true or false`);
      s = C.setOption(s, key, value);
    }
  }
  if (args.selected !== undefined && args.selected !== null) {
    const n = Number(args.selected);
    if (!Number.isInteger(n) || n < -1 || n > 3) {
      throw new Error('"selected" must be -1 (none) or an integer from 0 to 3');
    }
    s = C.select(s, n);
  }
  return s;
}

function requireGeometry(C: Core, s: State): Geometry {
  const g = C.geometry(s);
  if (!g) {
    throw new Error(
      "those four corners are degenerate: the core cannot locate the circumcenter, so there is no " +
      "Simson or nine-point circle to measure. Move a corner away from the others and try again.",
    );
  }
  return g;
}

function basics(C: Core, g: Geometry, s: State) {
  return {
    board: { width: C.VIEW.width, height: C.VIEW.height },
    vertices: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    circumcircle: { center: pt(g.circumcenter), radius: r6(g.circumradius) },
    tolerance: sig(g.tol),
    options: { ...s.options },
    selected: s.selected,
    cyclic: g.claims.cyclic === true,
    description: C.describe(s),
  };
}

/** The common point and the eight objects that the page says pass through it. */
function concurring(C: Core, g: Geometry, s: State) {
  const circles = g.circles.map((c, i) => {
    const miss = Math.abs(C.dist(c.center, g.H) - c.radius);
    return {
      triangle: `omits ${C.NAMES[i]}`,
      center: pt(c.center), radius: r6(c.radius),
      distanceFromH: r6(C.dist(c.center, g.H)),
      missFromH: sig(miss), throughH: miss <= g.tol,
    };
  });
  const lines = g.simsons.map((line, i) => {
    const miss = C.distToLine(g.H, line.first, line.second);
    return {
      of: C.NAMES[i],
      through: [pt(line.first), pt(line.second)],
      feet: line.feet.map(pt),
      missFromH: sig(miss), throughH: miss <= g.tol,
    };
  });
  const maxMiss = Math.max(g.measures.circleError, g.measures.simsonError);
  const H = pt(g.H)!;
  return {
    ...basics(C, g, s),
    commonPoint: H,
    ninePointCenters: g.centers.map(pt),
    ninePointCircles: circles,
    simsonLines: lines,
    verdict: {
      allEightConcur: g.claims.circlesConcurrent === true && g.claims.simsonsConcurrent === true,
      circlesConcurrent: g.claims.circlesConcurrent === true,
      simsonsConcurrent: g.claims.simsonsConcurrent === true,
      maxMissFromH: sig(maxMiss),
    },
    note:
      `The four nine-point circles (one for each triangle of three corners) and the four Simson lines all pass through ` +
      `H = (${H.x}, ${H.y}). The worst miss of any of the eight objects from H is ${sig(maxMiss)} board units ` +
      `against a tolerance of ${sig(g.tol)}; the quadrilateral is ${g.claims.cyclic ? "cyclic" : "not cyclic"}. ` +
      "This is an illustration, so there is no win or loss.",
  };
}

/** The half-scale centre quadrilateral, R/2 radii and the common midpoint of A H_A. */
function supporting(C: Core, g: Geometry, s: State) {
  const R = g.circumradius, halfR = R / 2;
  const pairs = [] as Array<{
    pair: string; vertexDistance: number; centerDistance: number;
    ratio: number | null; residual: number | null; halfScale: boolean;
  }>;
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const full = C.dist(g.points[i], g.points[j]);
      const small = C.dist(g.centers[i], g.centers[j]);
      pairs.push({
        pair: `${C.NAMES[i]}${C.NAMES[j]}`,
        vertexDistance: r6(full), centerDistance: r6(small),
        ratio: full > 0 ? r6(small / full) : null,
        residual: sig(Math.abs(small - full / 2)),
        halfScale: Math.abs(small - full / 2) <= g.tol,
      });
    }
  }
  const radii = g.circles.map((c, i) => {
    const miss = Math.abs(c.radius - halfR);
    return {
      triangle: `omits ${C.NAMES[i]}`, radius: r6(c.radius),
      residual: sig(miss), equalsHalfR: miss <= g.tol,
    };
  });
  const hAgain = C.circumcenter(g.centers[1], g.centers[2], g.centers[3]);
  const centreMiss = C.dist(hAgain, g.H);
  const midpoints = g.homothetyMidpoints.map((m, i) => ({
    corner: C.NAMES[i], orthocenter: pt(g.orthocenters[i]), midpoint: pt(m),
    missFromH: sig(C.dist(m, g.H)), isH: C.dist(m, g.H) <= g.tol,
  }));
  const feet = g.simsons.map((line, i) => {
    const miss = C.distToLine(line.third, line.first, line.second);
    return { of: C.NAMES[i], thirdFoot: pt(line.third), missFromLine: sig(miss), collinear: miss <= g.tol };
  });
  const H = pt(g.H)!;
  return {
    ...basics(C, g, s),
    commonPoint: H,
    centreQuadrilateral: {
      vertices: g.centers.map(pt),
      circumcenter: pt(hAgain),
      circumcenterMissFromH: sig(centreMiss),
      circumcenterIsH: centreMiss <= g.tol,
      pairs,
      maxRatioError: sig(g.measures.similarityError),
      halfScale: g.claims.nQuadSimilarHalf === true && g.claims.nQuadCircumcenter === true,
    },
    ninePointRadii: {
      circumradius: r6(R), halfCircumradius: r6(halfR),
      each: radii, maxError: sig(g.measures.radiusError),
      allEqualHalfR: g.claims.ninePointRadiusHalfR === true,
    },
    homothetyMidpoints: {
      point: H, each: midpoints,
      maxError: sig(g.measures.homothetyError),
      allAtH: g.claims.homothetyMidpoints === true,
    },
    pedalFeet: {
      each: feet, maxCollinearityError: sig(g.measures.collinearError),
      allCollinear: g.claims.pedalFeetCollinear === true,
    },
    note:
      `The four nine-point centres form a half-size copy of ABCD: every centre-to-centre distance is half the ` +
      `matching corner distance (worst error ${sig(g.measures.similarityError)}) and its circumcenter is H ` +
      `(miss ${sig(centreMiss)}). Each nine-point circle has radius R/2 = ${r6(halfR)} for R = ${r6(R)} ` +
      `(worst error ${sig(g.measures.radiusError)}). H = (${H.x}, ${H.y}) is the common midpoint of ` +
      `AH_A, BH_B, CH_C and DH_D (worst miss ${sig(g.measures.homothetyError)}), and the three perpendicular ` +
      `feet of each Simson line lie in a row (worst ${sig(g.measures.collinearError)}). ` +
      "This is an illustration, so there is no win or loss.",
  };
}

/* The corners of the saved fixture, projected onto the circle by Core.move. */
const EXAMPLE_ARGS = '{"A":[287.32421600408543,198.72864967626157],"B":[113.39745962155612,200],"C":[118.8217825191482,91.60396411885881],"D":[250,63.39745962155614]}';

export function actions(): GameActions {
  return {
    concurring_objects: {
      describe:
        "For four corners A, B, C, D of a cyclic quadrilateral on the applet's 400 x 300 board (y downward), report the common point H and all eight objects the page says pass through it: the four nine-point circles, one in each triangle of three corners, and the four Simson lines. Each object carries its own miss from H, and the verdict says whether all eight concur; a corner may be [x, y], { x, y } or an angle in radians, omitted corners keep the opening diagram, and options/selected optionally set the checkboxes and highlighted line.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        return concurring(C, requireGeometry(C, s), s);
      },
    },
    half_scale_and_midpoints: {
      describe:
        "For the same four corners (arguments as in concurring_objects), check the page's supporting claims with the real core: the four nine-point centres form a half-size copy of ABCD whose circumcenter is the common point H, every nine-point circle has radius R/2 where R is the circumradius, H is the midpoint of AH_A (and cyclically for B, C, D), and each Simson line's three perpendicular feet are collinear. Returns the centres, circle radii, homothety midpoints and the largest residual for each claim.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        return supporting(C, requireGeometry(C, s), s);
      },
    },
  };
}

/** Echo the fields Track.state saved, then re-measure the diagram with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Simsons state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four Simsons position must be an object");
  }
  const C = core();
  const options = readOptions(state.options);
  const selected = readSelected(state.selected);
  const saved = {
    A: safePoint(state.A), B: safePoint(state.B), C: safePoint(state.C), D: safePoint(state.D),
    angles: Array.isArray(state.angles) && state.angles.length === 4
      ? state.angles.map((a) => (typeof a === "number" && Number.isFinite(a) ? r6(a) : null)) : null,
    centers: safePoints(state.centers), orthocenters: safePoints(state.orthocenters),
    circles: safeCircles(state.circles), simsonLines: safeLines(state.simsonLines),
    H: safePoint(state.H), circumcenter: safePoint(state.circumcenter),
    circumradius: typeof state.circumradius === "number" && Number.isFinite(state.circumradius)
      ? r6(state.circumradius) : null,
    options, selected,
    claims: state.claims && typeof state.claims === "object" && !Array.isArray(state.claims) ? state.claims : {},
    measures: state.measures && typeof state.measures === "object" && !Array.isArray(state.measures) ? state.measures : {},
  };

  let s: State | null = null;
  let g: Geometry | null = null;
  let fromAngles = false;
  try {
    if (Array.isArray(state.angles) && state.angles.length === 4) {
      const angles = state.angles.map((a) => {
        const n = Number(a);
        if (!Number.isFinite(n)) throw new Error("saved angles must be four finite numbers");
        return n;
      });
      s = { angles, options, selected, explored: true };
      fromAngles = true;
      g = C.geometry(s);
    } else {
      const corners = [state.A, state.B, state.C, state.D].map((v, i) =>
        readPoint(v, `saved ${C.NAMES[i]}`));
      g = C.compute(corners[0], corners[1], corners[2], corners[3]);
      s = {
        angles: corners.map((p) => C.angleOf(p)),
        options, selected, explored: true,
      };
    }
  } catch (e) {
    return {
      ...state, stateVersion, valid: false, saved, reading: null,
      note: `The saved fields cannot be read as four corners: ${(e as Error).message}`,
    };
  }
  if (!s || !g) {
    return {
      ...state, stateVersion, valid: false, saved, reading: null,
      note: "The saved position is degenerate (three corners nearly in a line), so the core draws no construction here. Move a corner on the page and look again.",
    };
  }

  return {
    ...state,
    stateVersion,
    valid: true,
    saved,
    reading: { concurring: concurring(C, g, s), supporting: supporting(C, g, s) },
    coreDescription: C.describe(s),
    note: fromAngles
      ? "Track.state saved only the four angles, the checkboxes and the highlighted line because the drawing was degenerate; the reading below is a fresh core measurement from those angles."
      : "Track.state saved the four corners (all on the circle), the derived centres, orthocenters, circles, Simson line ends, common point H, circumcircle and radius, the checkboxes, the highlighted line and the page's claims and residuals. The core rebuilds the same picture from the saved corners: the four circles and four lines pass through H, the centres form a half-size copy of ABCD whose circumcenter is H, every nine-point radius is R/2, and H is the midpoint of each A H_A segment. This is an illustration: there is no win or loss.",
  };
}
