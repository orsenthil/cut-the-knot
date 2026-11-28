/*
 * run_game_logic actions and saved-position reader for Inscribed Quadri.
 *
 * Four corners A, B, C, D are dragged round one circle. Each corner defines a
 * triangle from the other three corners; O is the circle's centre and is the
 * circumcentre of all four triangles. In a single triangle the orthocentre H_i,
 * nine-point centre N_i, centroid G_i and circumcentre O lie on its Euler line
 * with H_iN_i : N_iO = 1:1 and H_iG_i : G_iO = 2:1. Across the quadrilateral the
 * four Euler lines all pass through the same O, and the four orthocentres,
 * nine-point centres and centroids form quadrilaterals homothetic to ABCD about
 * H, N and G with ratios -1, -1/2 and -1/3. Those three centres lie with O on
 * one line, but with the *different* ratios HN : NO = 1:2 and HG : GO = 1:1.
 * H is also the common point of the four nine-point circles, four maltitudes,
 * four Simson lines and the circumcentre of the N quadrilateral.
 *
 * Every number below is measured by the real core in
 * inscribed-quadri/inscribed-quadri-core.js, copied into src/generated/cores/
 * at build time. Coordinates are board units in the applet's 400 x 300 view,
 * y downward. This is an illustration: there is no win or loss. See _shared.ts
 * for the module shape.
 */

import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Options = {
  orthocenters: boolean; ninePoints: boolean; centroids: boolean;
  eulerLines: boolean; homothety: boolean; quadrilaterals: boolean;
  ninePointCircles: boolean; maltitudes: boolean; simsons: boolean;
};
type State = { angles: number[]; options: Options; explored: boolean };
type MeasureKey =
  | "triangleRatioError" | "collinearThreeError" | "eulerConcurError"
  | "homotheticFamiliesError" | "homotheticCornersError" | "lineRatioError"
  | "nineCircleError" | "nCircleCenterError" | "simsonError"
  | "maltitudeError" | "diagonalMaltitudeError";
type Measures = Record<MeasureKey, number>;
type Claims = Record<MeasureKey | "cyclic" | "fourSimsons", boolean>;
type Simson = { feet: Point[]; ends: Point[] } | null;
type Geometry = {
  A: Point; B: Point; C: Point; D: Point; points: Point[];
  triangles: Point[][]; INDEX: number[][];
  orthocenters: Point[]; nineCenters: Point[]; centroids: Point[];
  H: Point; N: Point; G: Point; O: Point; circumradius: number;
  eulerLines: Array<{ from: Point; to: Point; ok: boolean }>;
  maltitudes: Array<{ from: Point; to: Point }>;
  simsons: Simson[];
  nineCircles: Array<{ center: Point; radius: number }>;
  homothetyLines: Record<"H" | "N" | "G", Array<[Point, Point]>>;
  quads: Record<"H" | "N" | "G", Point[]>;
  centralLine: { from: Point; to: Point };
  measures: Measures; claims: Claims; tol: number;
};
interface Core {
  VIEW: { x: number; y: number; width: number; height: number };
  CENTER: Point; RADIUS: number;
  NAMES: string[]; OPTION_KEYS: string[]; INDEX: number[][];
  onCircle(angle: number): Point;
  angleOf(p: Point): number;
  add(p: Point, q: Point): Point;
  sub(p: Point, q: Point): Point;
  mul(p: Point, k: number): Point;
  dist(p: Point, q: Point): number;
  distToLine(p: Point, a: Point, b: Point): number;
  circumcenter(a: Point, b: Point, c: Point): Point;
  start(options?: Json): State;
  move(state: State, name: string, angleOrPoint: number | Point): State;
  setOption(state: State, name: string, on: boolean): State;
  geometry(state: State): Geometry | null;
  compute(a: Point, b: Point, c: Point, d: Point): Geometry | null;
  describe(state: State): string;
}

const core = (): Core => cores["inscribed-quadri"].InscribedQuadriCore as unknown as Core;

/* The core keeps full precision; only the numbers we print are tidied. */
const r6 = (v: number): number => (Number.isFinite(v) ? Number(v.toFixed(6)) : NaN);
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(3)) : null;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const line = (s: { from: Point; to: Point } | null | undefined) =>
  s ? { from: pt(s.from), to: pt(s.to) } : null;

/** A corner may be a board point as [x, y] / { x, y }, or an angle in radians. */
function readPoint(raw: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y], { x, y } or an angle in radians`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readOptions(raw: unknown): Options {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Json : {};
  return {
    orthocenters: o.orthocenters === true,
    ninePoints: o.ninePoints === true,
    centroids: o.centroids === true,
    eulerLines: o.eulerLines === true,
    homothety: o.homothety === true,
    quadrilaterals: o.quadrilaterals === true,
    ninePointCircles: o.ninePointCircles === true,
    maltitudes: o.maltitudes === true,
    simsons: o.simsons === true,
  };
}

/**
 * Build a core state the way the page does: each supplied corner is moved onto
 * the circle (a number is taken as an angle in radians), or `angles` /
 * `anglesDegrees` sets all four at once, and the checkboxes are optional.
 * Omitted corners keep the applet's opening diagram.
 */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C, D corners (or angles) and options");
  }
  if (args.angles !== undefined && args.anglesDegrees !== undefined) {
    throw new Error('give either "angles" (radians) or "anglesDegrees", not both');
  }
  const hasAngles = args.angles !== undefined || args.anglesDegrees !== undefined;
  const named = C.NAMES.filter((name) => args[name] !== undefined && args[name] !== null);
  if (hasAngles && named.length) {
    throw new Error('give either corners A, B, C, D or "angles"/"anglesDegrees", not both');
  }

  let s = C.start({});
  if (args.angles !== undefined) {
    const angles = numArray(args, "angles");
    if (angles.length !== 4) throw new Error(`"angles" needs four numbers, got ${angles.length}`);
    s = { ...s, angles, explored: true };
  } else if (args.anglesDegrees !== undefined) {
    const degrees = numArray(args, "anglesDegrees");
    if (degrees.length !== 4) throw new Error(`"anglesDegrees" needs four numbers, got ${degrees.length}`);
    s = { ...s, angles: degrees.map((d) => d * Math.PI / 180), explored: true };
  } else {
    for (const name of named) {
      const v = args[name];
      s = typeof v === "number"
        ? C.move(s, name, v)
        : C.move(s, name, readPoint(v, name));
    }
  }

  if (args.options !== undefined && args.options !== null) {
    if (typeof args.options !== "object" || Array.isArray(args.options)) {
      throw new Error('"options" must be an object of the nine boolean checkboxes');
    }
    const o = args.options as Json;
    for (const key of C.OPTION_KEYS) {
      const value = o[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== "boolean") throw new Error(`"options.${key}" must be true or false`);
      s = C.setOption(s, key, value);
    }
  }
  return s;
}

function requireGeometry(C: Core, s: State): Geometry {
  const g = C.geometry(s);
  if (!g) {
    throw new Error(
      "those four corners make a degenerate diagram: two coincide or a needed line is " +
      "parallel, so the core draws no orthocentre or centre line. Move a corner and try again.",
    );
  }
  return g;
}

function basics(C: Core, g: Geometry, s: State) {
  return {
    board: { width: C.VIEW.width, height: C.VIEW.height },
    corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    circumcircle: { center: pt(g.O), radius: r6(g.circumradius) },
    tolerance: sig(g.tol),
    options: { ...s.options },
    cyclic: g.claims.cyclic === true,
    description: C.describe(s),
  };
}

/** The four Euler lines and the two different sets of Euler ratios. */
function eulerReading(C: Core, g: Geometry, s: State) {
  const O = g.O;
  const triangles = g.triangles.map((vertices, i) => {
    const ht = g.orthocenters[i], nt = g.nineCenters[i], gt = g.centroids[i];
    const e = g.eulerLines[i];
    const HN = C.dist(ht, nt), NO = C.dist(nt, O);
    const HG = C.dist(ht, gt), GO = C.dist(gt, O);
    const miss = e.ok ? C.distToLine(O, e.from, e.to) : Infinity;
    const ntMiss = C.distToLine(nt, ht, O), gtMiss = C.distToLine(gt, ht, O);
    return {
      triangle: `omits ${C.NAMES[i]}`,
      vertices: vertices.map(pt),
      orthocenter: pt(ht), ninePointCenter: pt(nt), centroid: pt(gt),
      circumcenter: pt(e.to),
      eulerLine: {
        from: pt(e.from), to: pt(e.to), ok: e.ok,
        missFromO: sig(miss), throughO: e.ok && miss <= g.tol,
      },
      singleTriangleRatios: {
        HN: r6(HN), NO: r6(NO), HG: r6(HG), GO: r6(GO),
        HNoverNO: NO > 0 ? r6(HN / NO) : null,
        HGoverGO: GO > 0 ? r6(HG / GO) : null,
        expected: "H_iN_i : N_iO = 1:1 and H_iG_i : G_iO = 2:1",
        collinearityError: sig(Math.max(ntMiss, gtMiss)),
        holds: Math.abs(HN - NO) <= g.tol && Math.abs(HG - 2 * GO) <= g.tol
          && ntMiss <= g.tol && gtMiss <= g.tol,
      },
    };
  });

  const HN = C.dist(g.H, g.N), NO = C.dist(g.N, g.O);
  const HG = C.dist(g.H, g.G), GO = C.dist(g.G, g.O);
  const predictedN = C.add(g.O, C.mul(C.sub(g.H, g.O), 2 / 3));
  const predictedG = C.add(g.O, C.mul(C.sub(g.H, g.O), 1 / 2));
  const nMiss = C.dist(g.N, predictedN), gMiss = C.dist(g.G, predictedG);
  const lineMiss = Math.max(C.distToLine(g.H, g.N, g.O), C.distToLine(g.G, g.N, g.O));
  const centreLine = {
    from: pt(g.H), to: pt(g.O),
    points: { H: pt(g.H), N: pt(g.N), G: pt(g.G), O: pt(g.O) },
    distances: { HN: r6(HN), NO: r6(NO), HG: r6(HG), GO: r6(GO) },
    ratios: {
      HNoverNO: NO > 0 ? r6(HN / NO) : null,
      HGoverGO: GO > 0 ? r6(HG / GO) : null,
      expected: "HN : NO = 1:2 and HG : GO = 1:1",
    },
    predictedN: pt(predictedN), predictedG: pt(predictedG),
    residuals: { N: sig(nMiss), G: sig(gMiss), collinear: sig(lineMiss) },
    holds: g.claims.lineRatioError,
  };

  return {
    ...basics(C, g, s),
    triangles,
    eulerLinesConcurAtO: {
      holds: g.claims.eulerConcurError, maxMiss: sig(g.measures.eulerConcurError),
    },
    centreLine,
    verdict: {
      allSingleTriangleRatios: triangles.every((t) => t.singleTriangleRatios.holds),
      allEulerLinesThroughO: g.claims.eulerConcurError,
      quadrilateralRatios: centreLine.holds,
    },
    note:
      `In each of the four triangles the orthocentre, nine-point centre, centroid and circumcentre lie on ` +
      `one Euler line with H_iN_i : N_iO = 1:1 and H_iG_i : G_iO = 2:1, and all four Euler lines meet at ` +
      `O = (${r6(O.x)}, ${r6(O.y)}). The four family centres are different points: H, N, G lie with O on ` +
      `one line with HN : NO = 1:2 (N is two thirds of the way from O to H) and HG : GO = 1:1 ` +
      `(G is halfway). This is an illustration: there is no win or loss.`,
  };
}

/** The three homothetic families (k = -1, -1/2, -1/3) and the concurrence at H. */
function homothetyReading(C: Core, g: Geometry, s: State) {
  const families = (["H", "N", "G"] as const).map((name) => {
    const k = name === "H" ? -1 : name === "N" ? -1 / 2 : -1 / 3;
    const centre = name === "H" ? g.H : name === "N" ? g.N : g.G;
    const images = name === "H" ? g.orthocenters : name === "N" ? g.nineCenters : g.centroids;
    const corners = images.map((image, i) => {
      const corner = g.points[i];
      const predicted = C.add(centre, C.mul(C.sub(corner, centre), k));
      const residual = C.dist(image, predicted);
      return {
        corner: C.NAMES[i], original: pt(corner), image: pt(image), predicted: pt(predicted),
        residual: sig(residual), holds: residual <= g.tol,
      };
    });
    return {
      family: name, coefficient: k, centre: pt(centre),
      quadrilateral: images.map(pt), corners,
      maxResidual: sig(Math.max(...g.points.map((_, i) =>
        C.dist(images[i], C.add(centre, C.mul(C.sub(g.points[i], centre), k)))))),
      holds: g.claims.homotheticCornersError,
    };
  });

  const aboutO = g.points.map((corner, i) => {
    const gt = g.centroids[i];
    const predH = C.add(g.O, C.mul(C.sub(gt, g.O), 3));
    const predN = C.add(g.O, C.mul(C.sub(gt, g.O), 1.5));
    return {
      corner: C.NAMES[i],
      HfromG: { image: pt(g.orthocenters[i]), predicted: pt(predH), residual: sig(C.dist(g.orthocenters[i], predH)) },
      NfromG: { image: pt(g.nineCenters[i]), predicted: pt(predN), residual: sig(C.dist(g.nineCenters[i], predN)) },
    };
  });

  const nineCircles = g.nineCircles.map((c, i) => {
    const d = C.dist(c.center, g.H);
    return {
      triangle: `omits ${C.NAMES[i]}`, center: pt(c.center), radius: r6(c.radius),
      distanceFromH: r6(d), missFromH: sig(Math.abs(d - c.radius)),
      throughH: Math.abs(d - c.radius) <= g.tol,
    };
  });
  const maltitudes = g.maltitudes.map((m, i) => {
    const miss = C.distToLine(g.H, m.from, m.to);
    return {
      of: `${C.NAMES[i]}${C.NAMES[(i + 1) % 4]}`,
      segment: line(m), missFromH: sig(miss), throughH: miss <= g.tol,
    };
  });
  const simsonLines = g.simsons.map((sim, i) => {
    if (!sim) {
      return { of: C.NAMES[i], through: null, feet: null, missFromH: null, throughH: false };
    }
    const miss = C.distToLine(g.H, sim.ends[0], sim.ends[1]);
    return {
      of: C.NAMES[i], through: sim.ends.map(pt), feet: sim.feet.map(pt),
      missFromH: sig(miss), throughH: miss <= g.tol,
    };
  });
  const nQuadCenter = C.circumcenter(g.nineCenters[0], g.nineCenters[1], g.nineCenters[2]);
  const nCenterMiss = C.dist(nQuadCenter, g.H);

  return {
    ...basics(C, g, s),
    commonPoint: pt(g.H),
    homotheties: families,
    familiesAboutO: {
      factors: { HfromG: 3, NfromG: 1.5 }, pairs: aboutO,
      maxResidual: sig(g.measures.homotheticFamiliesError),
      holds: g.claims.homotheticFamiliesError,
    },
    concurrenceAtH: {
      nineCircles, maltitudes, simsonLines,
      HAsCircumcenterOfNQuad: {
        center: pt(nQuadCenter), missFromH: sig(nCenterMiss),
        holds: g.claims.nCircleCenterError && Number.isFinite(nCenterMiss),
      },
      diagonalMaltitudeError: sig(g.measures.diagonalMaltitudeError),
    },
    verdict: {
      homotheticAboutHNAndG: g.claims.homotheticCornersError,
      homotheticAboutO: g.claims.homotheticFamiliesError,
      nineCirclesThroughH: g.claims.nineCircleError,
      maltitudesThroughH: g.claims.maltitudeError,
      simsonsThroughH: g.claims.simsonError,
      fourSimsons: g.claims.fourSimsons,
      diagonalMaltitudes: g.claims.diagonalMaltitudeError,
    },
    note:
      `The orthocentre quadrilateral is the image of ABCD under a half-turn (k = -1) about H, the ` +
      `nine-point-centre quadrilateral under k = -1/2 about N, and the centroid quadrilateral under ` +
      `k = -1/3 about G; about O the first two are 3 and 3/2 times the third. H = ` +
      `(${r6(g.H.x)}, ${r6(g.H.y)}) is the common point of the four nine-point circles, the four ` +
      `maltitudes and the four Simson lines, and is the circumcentre of the N quadrilateral. ` +
      "This is an illustration: there is no win or loss.",
  };
}

/* The four corners of the live fixture; Core.move projects each onto the circle. */
const EXAMPLE_ARGS = '{"A":[287.32421600408543,198.72864967626157],"B":[113.39745962155612,200],"C":[118.8217825191482,91.60396411885881],"D":[250,63.39745962155614]}';

export function actions(): GameActions {
  return {
    euler_lines_and_ratios: {
      describe:
        "For four corners A, B, C, D of a cyclic quadrilateral on the applet's 400 x 300 board (y downward), report each triangle formed by three corners with its orthocentre H_i, nine-point centre N_i, centroid G_i, circumcentre and Euler line, and check that all four Euler lines pass through the common centre O. Report two different ratio pairs: within a single triangle H_iN_i : N_iO = 1:1 and H_iG_i : G_iO = 2:1, while the family centres satisfy HN : NO = 1:2 and HG : GO = 1:1. Corners may be [x, y], { x, y } or angles in radians; use angles or anglesDegrees for all four at once, options to set the nine checkboxes, and omit corners for the opening diagram.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        return eulerReading(C, requireGeometry(C, s), s);
      },
    },
    homotheties_and_concurrence: {
      describe:
        "For the same four corners (arguments as in euler_lines_and_ratios), check with the real core that the orthocentre, nine-point-centre and centroid quadrilaterals are homothetic to ABCD about H, N and G with ratios -1, -1/2 and -1/3, that about O they are 3 and 3/2 times the centroid quadrilateral, and that H is the common point of the four nine-point circles, four maltitudes and four Simson lines and the circumcentre of the N quadrilateral. Each object carries its own residual against the drawing's tolerance.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        return homothetyReading(C, requireGeometry(C, s), s);
      },
    },
  };
}

const safePoint = (raw: unknown): Point | null => {
  try { return pt(readPoint(raw, "saved point")); } catch { return null; }
};
const safePoints = (raw: unknown): Array<Point | null> =>
  Array.isArray(raw) ? raw.map(safePoint) : [];
const safeLines = (raw: unknown): Array<[Point | null, Point | null] | null> =>
  Array.isArray(raw) ? raw.map((s) =>
    Array.isArray(s) && s.length >= 2 ? [safePoint(s[0]), safePoint(s[1])] : null) : [];
const safeCircles = (raw: unknown): Array<{ center: Point | null; radius: number | null }> =>
  Array.isArray(raw) ? raw.map((c) => {
    if (!c || typeof c !== "object" || Array.isArray(c)) return { center: null, radius: null };
    const o = c as Json;
    return {
      center: safePoint(o.center),
      radius: typeof o.radius === "number" && Number.isFinite(o.radius) ? r6(o.radius) : null,
    };
  }) : [];

/** Echo the fields Track.state saved, then re-measure the diagram with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Inscribed Quadri state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Inscribed Quadri position must be an object");
  }
  const C = core();
  const options = readOptions(state.options);
  const saved = {
    A: safePoint(state.A), B: safePoint(state.B), C: safePoint(state.C), D: safePoint(state.D),
    H: safePoint(state.H), N: safePoint(state.N), G: safePoint(state.G), O: safePoint(state.O),
    circumradius: typeof state.circumradius === "number" && Number.isFinite(state.circumradius)
      ? r6(state.circumradius) : null,
    orthocenters: safePoints(state.orthocenters),
    nineCenters: safePoints(state.nineCenters),
    centroids: safePoints(state.centroids),
    nineCircles: safeCircles(state.nineCircles),
    eulerLines: safeLines(state.eulerLines),
    maltitudes: safeLines(state.maltitudes),
    simsonLines: safeLines(state.simsonLines),
    angles: Array.isArray(state.angles) && state.angles.length === 4
      ? state.angles.map((a) => (typeof a === "number" && Number.isFinite(a) ? r6(a) : null)) : null,
    options,
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
      s = { angles, options, explored: true };
      fromAngles = true;
      g = C.geometry(s);
    } else {
      const corners = [state.A, state.B, state.C, state.D].map((v, i) =>
        readPoint(v, `saved ${C.NAMES[i]}`));
      g = C.compute(corners[0], corners[1], corners[2], corners[3]);
      s = { angles: corners.map((p) => C.angleOf(p)), options, explored: true };
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
      note: "The saved position is degenerate (two corners coincide or a line fails), so the core draws no construction here. Move a corner on the page and look again.",
    };
  }

  return {
    ...state,
    stateVersion,
    valid: true,
    saved,
    reading: {
      euler: eulerReading(C, g, s),
      homothety: homothetyReading(C, g, s),
    },
    coreDescription: C.describe(s),
    note: fromAngles
      ? "Track.state saved only the four angles and the checkboxes because the drawing was degenerate; the reading below is a fresh core measurement from those angles."
      : "Track.state saved the four corners on the circle, the derived orthocentres, nine-point centres and centroids, the centre line H-N-G-O, the four Euler lines, maltitudes, Simson lines and nine-point circles, the checkboxes, and the page's claims and residuals. The core rebuilds the same picture from the saved corners: within each triangle H_iN_i : N_iO = 1:1 and H_iG_i : G_iO = 2:1, while for the four family centres HN : NO = 1:2 and HG : GO = 1:1, with homothety ratios -1, -1/2 and -1/3 and concurrence at H. This is an illustration: there is no win or loss.",
  };
}
