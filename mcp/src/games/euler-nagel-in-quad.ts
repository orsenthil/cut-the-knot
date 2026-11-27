/*
 * run_game_logic actions and saved-position reader for Euler Nagel In Quad
 * (Alexander Bogomolny's EulerNagelInQuad applet, "Remarkable Line in a
 * Quadrilateral").
 *
 * Four corners A, B, C, D make four triangles, each with an orthocentre H,
 * nine-point centre N, centroid G and circumcentre O. Join the centres of the
 * two triangles that omit opposite corners (H_A H_C with H_B H_D, and likewise
 * for N, G and O). The four intersections H', N', G', O' always lie on one
 * line, with H'N' : N'O' = 1 : 1 (N' the midpoint) and H'G' : G'O' = 2 : 1
 * (G' two thirds of the way). When ABCD is cyclic the four circumcentres
 * coincide and the homothety centres instead split the line HN : NO = 1 : 2
 * and HG : GO = 1 : 1.
 *
 * Every number below is measured by the real core in
 * euler-nagel-in-quad/euler-nagel-in-quad-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * applet's 560 x 400 view, with y down. This is a demo: there is no win or
 * loss, only an explored picture. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Options = {
  circumcenters: boolean; orthocenters: boolean; centroids: boolean;
  ninePoints: boolean; diagonals: boolean; eulerLines: boolean;
};
type State = { A: Point; B: Point; C: Point; D: Point; options: Options; explored: boolean };
type TriangleCheck = { valid: boolean; collinear: boolean; nMidpoint: boolean; gRatio: boolean };
type CyclicCenters = {
  H: Point; N: Point; G: Point; O: Point;
  collinear: boolean; nRatio: boolean; gRatio: boolean; order: boolean;
};
type Claims = {
  collinear: boolean; nMidpoint: boolean; gRatio: boolean; order: boolean;
  triangleEuler: boolean; cyclic: boolean; cyclicClaim: boolean;
};
type Measures = { collinearError: number; nError: number; gError: number };
type Geometry = {
  A: Point; B: Point; C: Point; D: Point; corners: Point[];
  HH: Point[]; NN: Point[]; GG: Point[]; OO: Point[];
  H: Point; N: Point; G: Point; O: Point;
  exact: { H: Point; N: Point; G: Point; O: Point };
  eulerLines: [Point, Point][];
  valid: boolean; scale: number;
  measures: Measures;
  claims: Claims;
  triangles: TriangleCheck[];
  cyclicCenters: CyclicCenters | null;
};
type Core = {
  VIEW: { x: number; y: number; width: number; height: number };
  point(x: number, y: number): Point;
  dist(p: Point, q: Point): number;
  start(options?: Json): State;
  compute(a: Point, b: Point, c: Point, d: Point): Geometry | null;
  geometry(state: State): Geometry | null;
  describe(state: State): string;
};

const OPTION_KEYS: (keyof Options)[] = [
  "circumcenters", "orthocenters", "centroids", "ninePoints", "diagonals", "eulerLines",
];

const core = () => cores["euler-nagel-in-quad"].EulerNagelInQuadCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: Point): Point => ({ x: round(p.x, 4), y: round(p.y, 4) });
const err = (v: number): number | null => (Number.isFinite(v) ? v : null);
const errText = (v: number | null): string =>
  v === null ? "undefined"
    : v !== 0 && Math.abs(v) < 1e-4 ? v.toExponential(2)
      : String(round(v, 6));

/** Accept the page's { x, y } dots and the tutor's [x, y] arguments alike. */
function readPoint(value: unknown, label: string): Point {
  if (value === undefined || value === null) {
    throw new Error(`missing required point "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (typeof value === "object") {
    const o = value as Json;
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`"${label}" must hold finite numeric x and y, got ${JSON.stringify(value)}`);
    }
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" must hold finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Normalise the six cosmetic checkboxes; absent ones are off. */
function readOptions(value: unknown): Options {
  const raw: Json = value && typeof value === "object" && !Array.isArray(value)
    ? value as Json : {};
  const options = {} as Options;
  for (const key of OPTION_KEYS) {
    const v = raw[key];
    if (v !== undefined && v !== null && typeof v !== "boolean") {
      throw new Error(`"options.${key}" must be a boolean, got ${JSON.stringify(v)}`);
    }
    options[key] = v === true;
  }
  return options;
}

function hasCornerArgs(args: Json): boolean {
  return (args.corners !== undefined && args.corners !== null)
    || (args.anglesDegrees !== undefined && args.anglesDegrees !== null)
    || ["A", "B", "C", "D"].some((k) => args[k] !== undefined && args[k] !== null);
}

/**
 * Four corners from one of: `corners` (four points), individual A/B/C/D
 * points, or four `anglesDegrees` on a circle (optional `center` and `radius`,
 * defaulting to the applet's own circle). With none of these the applet's
 * opening figure is used. The angles route is the handy way to make a cyclic
 * quadrilateral: all four points then share one circumcircle.
 */
function cornersFromArgs(args: Json): { A: Point; B: Point; C: Point; D: Point } {
  const K = core();
  const hasCorners = args.corners !== undefined && args.corners !== null;
  const hasAngles = args.anglesDegrees !== undefined && args.anglesDegrees !== null;
  const hasKeys = ["A", "B", "C", "D"].some(
    (k) => args[k] !== undefined && args[k] !== null,
  );
  if ([hasCorners, hasAngles, hasKeys].filter(Boolean).length > 1) {
    throw new Error('give only one of "corners", "anglesDegrees", or A/B/C/D');
  }
  if (hasAngles) {
    const angles = numArray(args, "anglesDegrees");
    if (angles.length !== 4) {
      throw new Error('"anglesDegrees" must hold exactly four angles, one per corner');
    }
    const center = args.center === undefined || args.center === null
      ? K.point(K.VIEW.x + K.VIEW.width / 2, K.VIEW.y + K.VIEW.height / 2)
      : readPoint(args.center, "center");
    const radius = args.radius === undefined || args.radius === null
      ? Math.min(K.VIEW.width, K.VIEW.height) / 3
      : num(args, "radius");
    if (!(radius > 0)) throw new Error('"radius" must be positive');
    const p = angles.map((d) => K.point(
      center.x + radius * Math.cos(d * Math.PI / 180),
      center.y + radius * Math.sin(d * Math.PI / 180),
    ));
    return { A: p[0], B: p[1], C: p[2], D: p[3] };
  }
  if (hasCorners) {
    if (!Array.isArray(args.corners) || args.corners.length !== 4) {
      throw new Error('"corners" must be an array of exactly four points [A, B, C, D]');
    }
    const p = args.corners.map((v, i) => readPoint(v, `corners[${i}]`));
    return { A: p[0], B: p[1], C: p[2], D: p[3] };
  }
  const fresh = K.start();
  if (hasKeys) {
    return {
      A: args.A === undefined || args.A === null ? fresh.A : readPoint(args.A, "A"),
      B: args.B === undefined || args.B === null ? fresh.B : readPoint(args.B, "B"),
      C: args.C === undefined || args.C === null ? fresh.C : readPoint(args.C, "C"),
      D: args.D === undefined || args.D === null ? fresh.D : readPoint(args.D, "D"),
    };
  }
  return { A: fresh.A, B: fresh.B, C: fresh.C, D: fresh.D };
}

function geometryFrom(args: Json): Geometry {
  const K = core();
  const c = cornersFromArgs(args);
  const g = K.compute(c.A, c.B, c.C, c.D);
  if (!g || !g.valid) {
    throw new Error(
      "the core cannot find the four centre points here: two corners coincide or a line is parallel; move a corner and try again",
    );
  }
  return g;
}

/** Everything the core can say about one quadrilateral, in tutor-friendly units. */
function reading(K: Core, g: Geometry) {
  const m = g.measures;
  const c = g.claims;
  const e = g.exact;
  const ratio = (a: number, b: number): number | null =>
    b > 0 ? round(a / b, 6) : null;
  const cc = g.cyclicCenters;
  return {
    corners: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D) },
    centers: { Hp: pt(g.H), Np: pt(g.N), Gp: pt(g.G), Op: pt(g.O) },
    exactCenters: { Hp: pt(e.H), Np: pt(e.N), Gp: pt(e.G), Op: pt(e.O) },
    triangleCenters: {
      omitsA: { H: pt(g.HH[0]), N: pt(g.NN[0]), G: pt(g.GG[0]), O: pt(g.OO[0]) },
      omitsB: { H: pt(g.HH[1]), N: pt(g.NN[1]), G: pt(g.GG[1]), O: pt(g.OO[1]) },
      omitsC: { H: pt(g.HH[2]), N: pt(g.NN[2]), G: pt(g.GG[2]), O: pt(g.OO[2]) },
      omitsD: { H: pt(g.HH[3]), N: pt(g.NN[3]), G: pt(g.GG[3]), O: pt(g.OO[3]) },
    },
    remarkableLine: {
      statement: "H', N', G', O' collinear; H'N' : N'O' = 1 : 1 and H'G' : G'O' = 2 : 1",
      collinear: c.collinear,
      collinearError: err(m.collinearError),
      nMidpoint: c.nMidpoint,
      nError: err(m.nError),
      gRatio: c.gRatio,
      gError: err(m.gError),
      order: c.order,
      segmentRatios: {
        HpNp_to_NpOp: ratio(K.dist(e.H, e.N), K.dist(e.N, e.O)),
        HpGp_to_GpOp: ratio(K.dist(e.H, e.G), K.dist(e.G, e.O)),
      },
    },
    triangleEuler: c.triangleEuler,
    triangles: g.triangles.map((t, i) => ({
      omits: "ABCD"[i],
      valid: t.valid, collinear: t.collinear, nMidpoint: t.nMidpoint, gRatio: t.gRatio,
    })),
    cyclic: c.cyclic,
    cyclicCenters: cc ? {
      H: pt(cc.H), N: pt(cc.N), G: pt(cc.G), O: pt(cc.O),
      statement: "HN : NO = 1 : 2 and HG : GO = 1 : 1",
      collinear: cc.collinear, nRatio: cc.nRatio, gRatio: cc.gRatio, order: cc.order,
    } : null,
    claims: { ...c },
    scale: round(g.scale),
  };
}

export function actions(): GameActions {
  return {
    remarkable_line: {
      describe:
        "For quadrilateral corners A, B, C, D (a `corners` array of four [x, y] points, individual A/B/C/D points, or omit for the applet's opening figure) rebuild the four triangles that omit one corner each and their orthocentre, nine-point centre, centroid and circumcentre. Report H', N', G', O' where the centre lines of opposite triangles meet, check they are collinear, and check that N' is the midpoint of H'O' (1 : 1) and G' is two thirds along (2 : 1), with the core's measured errors, segment ratios and verdicts. Also report the same Euler-line checks inside each of the four triangles.",
      args: '{ "corners": [[440.47005383792515, 266.66666666666663], [164.52994616207485, 266.66666666666663], [171.7623766921976, 122.13861882514509], [346.6666666666667, 84.52994616207485]] }',
      run: (args) => {
        const K = core();
        const g = geometryFrom(args);
        const r = reading(K, g);
        const l = r.remarkableLine;
        const allHold = l.collinear && l.nMidpoint && l.gRatio && l.order && r.triangleEuler;
        return {
          ...r,
          note: allHold
            ? `The four centres H', N', G', O' are collinear (farthest point ${errText(l.collinearError)} board units off the line). N' is the midpoint of H'O' (H'N'/N'O' = ${l.segmentRatios.HpNp_to_NpOp}, error ${errText(l.nError)}), and G' is two thirds along (H'G'/G'O' = ${l.segmentRatios.HpGp_to_GpOp}, error ${errText(l.gError)}). Inside every triangle its nine-point centre and centroid split the Euler line the same 1 : 1 and 2 : 1 way.`
            : `The core did not confirm every part of the remarkable line (collinear ${l.collinear}, midpoint ${l.nMidpoint}, two-thirds ${l.gRatio}, triangle Euler lines ${r.triangleEuler}); see the residuals and move a corner if a line is nearly parallel.`,
        };
      },
    },
    cyclic_case: {
      describe:
        "For four corners on one circle (give four `anglesDegrees` on the applet's circle, with optional `center` and `radius`, or explicit `corners`/A/B/C/D points on a common circle) the four triangles share one circumcircle and their circumcentres coincide. Report the homothety centres H, N, G, O of the four centre quadrilaterals and ABCD and check they are collinear with HN : NO = 1 : 2 and HG : GO = 1 : 1, using the core's residuals and verdicts. Omit all arguments for four corners at 30, 150, 216 and 300 degrees on the applet's circle. For a cyclic quadrilateral the general 1 : 1 and 2 : 1 line of remarkable_line degenerates; the 1 : 2 and 1 : 1 homothety line takes its place.",
      args: '{ "anglesDegrees": [30, 150, 216, 300] }',
      run: (args) => {
        /* With no corners at all, use four angles on the applet's circle so
         * the omitted-argument case is itself cyclic. */
        const g = geometryFrom(hasCornerArgs(args)
          ? args : { ...args, anglesDegrees: [30, 150, 216, 300] });
        const r = reading(core(), g);
        const cc = r.cyclicCenters;
        const holds = r.cyclic && cc && cc.collinear && cc.nRatio && cc.gRatio && cc.order;
        return {
          ...r,
          note: holds
            ? `All four triangle circumcentres coincide at O = (${cc.O.x}, ${cc.O.y}), so ABCD is cyclic. The homothety centres H, N, G, O are collinear: N divides HO as HN : NO = 1 : 2 (one third from H to O) and G is the midpoint with HG : GO = 1 : 1. The ordinary 1 : 1 / 2 : 1 line of remarkable_line no longer applies here.`
            : r.cyclic
              ? "The four circumcentres coincide, but the core could not draw the homothety centres collinear with the 1 : 2 and 1 : 1 ratios (a connecting line is probably parallel); move a corner and try again."
              : "These four corners are not cyclic: the four triangle circumcentres do not coincide. Give four anglesDegrees on the circle, or corners on a common circle, to see the 1 : 2 and 1 : 1 homothety line.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of those corners. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Euler Nagel In Quad state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Euler Nagel In Quad position must be an object");
  }
  if (!Array.isArray(state.corners) || state.corners.length !== 4) {
    throw new Error('saved "corners" must be an array of four { x, y } points');
  }
  const saved = {
    A: readPoint(state.corners[0], "corners[0]"),
    B: readPoint(state.corners[1], "corners[1]"),
    C: readPoint(state.corners[2], "corners[2]"),
    D: readPoint(state.corners[3], "corners[3]"),
  };
  const options = readOptions(state.options);

  /* The degenerate path of the page saves only corners and options. */
  const savedOptPoint = (v: unknown, label: string): Point | null => {
    try { return readPoint(v, label); } catch { return null; }
  };
  const savedCenters = {
    Hp: savedOptPoint(state.H, "H"), Np: savedOptPoint(state.N, "N"),
    Gp: savedOptPoint(state.G, "G"), Op: savedOptPoint(state.O, "O"),
  };
  const savedTriangleCenters: Record<string, (Point | null)[]> = {};
  const tc = state.triangleCenters && typeof state.triangleCenters === "object"
    ? state.triangleCenters as Json : {};
  const flatTriangleCenters: Json = { H: tc.H, N: tc.N, G: tc.G, O: tc.O };
  for (const key of ["H", "N", "G", "O"] as const) {
    const v = flatTriangleCenters[key];
    savedTriangleCenters[key] = Array.isArray(v)
      ? v.map((q, i) => savedOptPoint(q, `triangleCenters.${key}[${i}]`))
      : [];
  }
  const savedClaims: Json = state.claims && typeof state.claims === "object" && !Array.isArray(state.claims)
    ? state.claims as Json : {};
  const savedCyclic = state.cyclicCenters && typeof state.cyclicCenters === "object" && !Array.isArray(state.cyclicCenters)
    ? state.cyclicCenters as Json : null;

  const K = core();
  const g = K.compute(saved.A, saved.B, saved.C, saved.D);
  if (!g || !g.valid) {
    return {
      ...state, stateVersion,
      saved: { corners: [pt(saved.A), pt(saved.B), pt(saved.C), pt(saved.D)], options,
        H: savedCenters.Hp, N: savedCenters.Np, G: savedCenters.Gp, O: savedCenters.Op },
      valid: false,
      core: null,
      note: "The saved corners are degenerate for the core (two coincide or a centre line is parallel), so there is no remarkable line to measure here. Move a corner on the page and look again.",
    };
  }

  const coreReading = reading(K, g);
  const here: State = { ...saved, options, explored: true };
  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number, value: number): void => {
    differences.push({ field, page: round(page), core: round(value), diff: round(Math.abs(page - value), 9) });
  };
  const comparePoint = (field: string, page: Point | null, value: Point): void => {
    if (page) { compare(`${field}.x`, page.x, value.x); compare(`${field}.y`, page.y, value.y); }
  };
  const drawnKey = { Hp: "H", Np: "N", Gp: "G", Op: "O" } as const;
  for (const key of ["Hp", "Np", "Gp", "Op"] as const) {
    comparePoint(key, savedCenters[key], g[drawnKey[key]]);
  }
  const tri = { H: g.HH, N: g.NN, G: g.GG, O: g.OO };
  for (const key of ["H", "N", "G", "O"] as const) {
    const arr = savedTriangleCenters[key] || [];
    arr.forEach((p, i) => {
      if (p && tri[key][i]) comparePoint(`triangleCenters.${key}[${i}]`, p, tri[key][i]);
    });
  }
  if (savedCyclic) {
    for (const key of ["H", "N", "G", "O"] as const) {
      comparePoint(`cyclicCenters.${key}`, savedOptPoint(savedCyclic[key], `cyclicCenters.${key}`),
        g.cyclicCenters ? g.cyclicCenters[key] : { x: NaN, y: NaN });
    }
  }
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  ) && (!savedCyclic || !!g.cyclicCenters);
  const claimsAgree = Object.keys(savedClaims).every(
    (key) => savedClaims[key] === (g.claims as unknown as Json)[key],
  );

  return {
    ...state,
    stateVersion,
    valid: true,
    saved: {
      corners: { A: pt(saved.A), B: pt(saved.B), C: pt(saved.C), D: pt(saved.D) },
      H: savedCenters.Hp, N: savedCenters.Np, G: savedCenters.Gp, O: savedCenters.Op,
      triangleCenters: savedTriangleCenters,
      cyclicCenters: savedCyclic,
      claims: savedClaims,
      options,
    },
    core: coreReading,
    coreDescription: K.describe(here),
    savedMatchesCore,
    claimsAgree,
    differences,
    note:
      "Track.state saved the four corners, the drawn H', N', G', O', the four triangles' centre points, any cyclic homothety centres, the page's claim verdicts and the six display options, in board units. " +
      "The real core rebuilds H', N', G', O' from those corners and rechecks collinearity, the 1 : 1 midpoint and 2 : 1 ratio (and the cyclic 1 : 2 / 1 : 1 case). " +
      (savedMatchesCore && claimsAgree
        ? "The saved numbers and claims agree with a fresh core construction."
        : "Some saved numbers or claims differ from the core rebuild; see `differences`, and trust `core` for the true reading."),
  };
}
