/*
 * run_game_logic actions and saved-position reader for Four Centroids
 * (Alexander Bogomolny's FourCentroids applet).
 *
 * A point P and a triangle ABC give three more triangles ABP, BCP and CAP.
 * Their centroids are Ga = (B+C+P)/3, Gb = (C+A+P)/3 and Gc = (A+B+P)/3,
 * while G = (A+B+C)/3 is the centroid of ABC. Because G - Ga = (A-P)/3
 * (and cyclically), the three lines through Ga, Gb, Gc parallel to AP, BP,
 * CP all pass through G.
 *
 * Put J = (A+B+C+P)/4 = (3G+P)/4. Then Ga = J - (A-J)/3 and its cyclic
 * versions, so ABC and GaGbGc are homothetic about J with coefficient -1/3:
 * their sides are parallel and one third as long, and GJ : JP = 1 : 3.
 *
 * The page's sentence "Let U be the midpoint of AG. In BCU, CGb : GbU = 2:1
 * and BGc : GcU = 2:1" is wrong: the 2:1 split holds when U is the midpoint
 * of AP, not AG. GbGc is parallel to BC and a third as long either way.
 *
 * Every number below is measured by the real core in
 * four-centroids/four-centroids-core.js, copied into src/generated/cores/ at
 * build time. Coordinates are board units of the applet's 400 x 300 view,
 * with y down. This is an illustration: there is no win or loss. See
 * _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Show = {
  names: boolean; statement1: boolean; statement2: boolean; premises: boolean;
};
type State = { A: Point[]; P: Point; show: Show; explored: boolean };
type Claims = {
  parallels: boolean; homothetic: boolean; midpointRatios: boolean;
  centerRatio: boolean; intersectionsAgree: boolean; pageU: boolean; workingU: boolean;
};
type Measures = {
  parallelError: number; sideError: number; sideRatioError: number;
  homothetyError: number; midpointError: number; centerRatioError: number;
  jError: number; scale: number; tol: number;
};
type MidpointCheck = {
  pageMidpoint: Point; workingMidpoint: Point;
  pageClaim: boolean; workingClaim: boolean;
  sideParallel: boolean; sideRatio: number;
};
type Geometry = {
  A: Point[]; P: Point; G: Point[]; Gabc: Point; M: Point[]; N: Point[];
  J: Point | null; Jformula: Point;
  x01: Point | null; x12: Point | null; x20: Point | null;
  U: MidpointCheck;
  measures: Measures; claims: Claims; degenerate: boolean;
};
type Core = {
  VIEW: { x: number; y: number; width: number; height: number };
  PAD: number;
  NAMES: string[];
  OPTION_KEYS: string[];
  point(x: number, y: number): Point;
  dist(p: Point, q: Point): number;
  start(options?: Json): State;
  movePoint(s: State, name: string, p: Point): State;
  geometry(s: State): Geometry | null;
  describe(s: State): string;
};

const core = (): Core =>
  cores["four-centroids"].FourCentroidsCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: round(p.x, 4), y: round(p.y, 4) }
    : null;
const err = (v: number): number | null => (Number.isFinite(v) ? v : null);
const errText = (v: number | null): string =>
  v === null ? "undefined"
    : v !== 0 && Math.abs(v) < 1e-4 ? v.toExponential(2)
      : String(round(v, 6));
const ratio = (a: number, b: number): number | null => (b > 0 ? round(a / b, 6) : null);

/** Accept the page's { x, y } dots and the tutor's [x, y] arguments alike. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object") {
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

/** The four cosmetic checkboxes; absent ones are off. */
function readShow(value: unknown): Show {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error('"show" must be an object with boolean names/statement1/statement2/premises');
  }
  const raw = value as Json;
  const show = {} as Show;
  for (const key of ["names", "statement1", "statement2", "premises"] as const) {
    const v = raw[key];
    if (v !== undefined && v !== null && typeof v !== "boolean") {
      throw new Error(`"show.${key}" must be a boolean, got ${JSON.stringify(v)}`);
    }
    show[key] = v === true;
  }
  return show;
}

/**
 * Three vertices A and a point P, each [x, y] or { x, y } in board units.
 * Missing handles keep the applet's opening layout; supplied points go
 * through the core's own movePoint, which clamps them to the board like a
 * drag. `show` optionally sets the four checkboxes.
 */
function buildState(C: Core, args: Json): State {
  if (args && (typeof args !== "object" || Array.isArray(args))) {
    throw new Error("arguments must be an object with A (three points) and P (a point)");
  }
  const given = (args && typeof args === "object" ? args : {}) as Json;
  let s = C.start({ show: "1" });
  if (given.A !== undefined && given.A !== null) {
    if (!Array.isArray(given.A) || given.A.length !== 3) {
      throw new Error('"A" must be an array of exactly three points [A, B, C]');
    }
    const a = given.A.map((v, i) => readPoint(v, `A[${i}]`));
    for (let i = 0; i < 3; i++) s = C.movePoint(s, C.NAMES[i], a[i]);
  }
  if (given.P !== undefined && given.P !== null) {
    s = C.movePoint(s, "P", readPoint(given.P, "P"));
  }
  if (given.show !== undefined && given.show !== null) {
    s = { ...s, show: readShow(given.show) };
  }
  return s;
}

/** Refuse a figure whose cevians do not give the core an intersection J. */
function geometryOf(C: Core, s: State): Geometry {
  const g = C.geometry(s);
  if (!g || g.degenerate) {
    throw new Error(
      "those points are degenerate: the core cannot meet the three cevians to locate J. " +
      "Move a vertex or P so the lines are not parallel and try again.",
    );
  }
  return g;
}

/** The whole construction, measured by the core rather than assumed. */
function reading(C: Core, g: Geometry) {
  const m = g.measures, c = g.claims, u = g.U;
  const gj = C.dist(g.Gabc, g.Jformula), jp = C.dist(g.Jformula, g.P);
  return {
    board: { width: C.VIEW.width, height: C.VIEW.height },
    handles: { A: g.A.map((p) => pt(p)), P: pt(g.P) },
    centroids: {
      Ga: pt(g.G[0]), Gb: pt(g.G[1]), Gc: pt(g.G[2]), G: pt(g.Gabc),
      formulas: "Ga=(B+C+P)/3, Gb=(C+A+P)/3, Gc=(A+B+P)/3, G=(A+B+C)/3",
    },
    parallels: {
      statement: "G-Ga=(A-P)/3, G-Gb=(B-P)/3, G-Gc=(C-P)/3, so the lines through Ga, Gb, Gc parallel to AP, BP, CP all pass through G",
      holds: c.parallels === true,
      maxDistanceToLine: err(m.parallelError),
      tolerance: err(m.tol),
    },
    homothety: {
      statement: "J=(A+B+C+P)/4 and Ga=J-(A-J)/3 (cyclically), so ABC and GaGbGc are homothetic about J with coefficient -1/3, and GJ:JP=1:3",
      coefficient: -1 / 3,
      center: pt(g.Jformula),
      centerFromIntersections: pt(g.J),
      holds: c.homothetic === true,
      centerRatioHolds: c.centerRatio === true,
      intersectionsAgree: c.intersectionsAgree === true,
      GJ: round(gj), JP: round(jp), GJ_to_JP: ratio(gj, jp),
      sideLengths: {
        AB: round(C.dist(g.A[0], g.A[1])), BC: round(C.dist(g.A[1], g.A[2])),
        CA: round(C.dist(g.A[2], g.A[0])),
        GaGb: round(C.dist(g.G[0], g.G[1])), GbGc: round(C.dist(g.G[1], g.G[2])),
        GcGa: round(C.dist(g.G[2], g.G[0])),
      },
      sideRatios: {
        GaGb_to_AB: ratio(C.dist(g.G[0], g.G[1]), C.dist(g.A[0], g.A[1])),
        GbGc_to_BC: ratio(C.dist(g.G[1], g.G[2]), C.dist(g.A[1], g.A[2])),
        GcGa_to_CA: ratio(C.dist(g.G[2], g.G[0]), C.dist(g.A[2], g.A[0])),
      },
      errors: {
        sideParallel: err(m.sideError), sideRatio: err(m.sideRatioError),
        homothety: err(m.homothetyError), centerRatio: err(m.centerRatioError),
        intersections: err(m.jError),
      },
    },
    midpointRatios: {
      statement: "For each side midpoint L, LG:LA = 1:3 and LG[i]:LP = 1:3",
      holds: c.midpointRatios === true,
      maxError: err(m.midpointError),
    },
    pageMidpointSentence: {
      statement: 'The page says "Let U be the midpoint of AG. In BCU, CGb:GbU = 2:1 and BGc:GcU = 2:1"',
      pageClaimHolds: u.pageClaim === true,
      workingClaimHolds: u.workingClaim === true,
      correction: "The 2:1 split holds when U is the midpoint of AP, not AG",
      pageMidpoint: pt(u.pageMidpoint),
      workingMidpoint: pt(u.workingMidpoint),
      GbGcParallelBC: u.sideParallel === true,
      GbGc_to_BC: ratio(C.dist(g.G[1], g.G[2]), C.dist(g.A[1], g.A[2])),
      sideRatioError: round(u.sideRatio),
    },
    claims: c,
    degenerate: g.degenerate,
  };
}

const EXAMPLE_ARGS = '{"A":[[324,240],[133,50],[80,240]],"P":[200,195],"show":{"names":true}}';

export function actions(): GameActions {
  return {
    four_centroids: {
      describe:
        "Take a triangle ABC (three [x, y] or { x, y } points in `A`) and a point `P`, in the applet's 400 x 300 board; omit either to keep the opening figure, and optionally pass `show` to set the four checkboxes. The real core reports the four centroids Ga, Gb, Gc and G, then checks that the lines through Ga, Gb, Gc parallel to AP, BP, CP all pass through G (because G-Ga=(A-P)/3 and cyclically), with its measured distance and tolerance. Points outside the board are clamped to it just as a drag does.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = geometryOf(C, s);
        const r = reading(C, g);
        return {
          ...r,
          note: r.parallels.holds
            ? `Ga, Gb, Gc sit at (${r.centroids.Ga!.x}, ${r.centroids.Ga!.y}), (${r.centroids.Gb!.x}, ${r.centroids.Gb!.y}) and (${r.centroids.Gc!.x}, ${r.centroids.Gc!.y}), with G at (${r.centroids.G!.x}, ${r.centroids.G!.y}). G-Ga=(A-P)/3 and cyclically, so the three parallels through Ga, Gb, Gc pass through G: the worst distance is ${errText(r.parallels.maxDistanceToLine)} board units (tolerance ${errText(r.parallels.tolerance)}).`
            : `The core could not confirm the three parallels (worst distance ${errText(r.parallels.maxDistanceToLine)} against tolerance ${errText(r.parallels.tolerance)}); move a vertex or P so the lines meet cleanly.`,
        };
      },
    },
    homothety_and_midpoint: {
      describe:
        "For the same triangle and point (arguments as in four_centroids), the real core finds J=(A+B+C+P)/4, checks that ABC and GaGbGc are homothetic about J with coefficient -1/3, that GJ:JP=1:3, and that the small triangle's sides are parallel to and a third of ABC's. It also tests the page's sentence about U: with U the midpoint of AG the claimed 2:1 splits in BCU are false for a moving P, while with U the midpoint of AP they hold; GbGc stays parallel to BC and a third as long either way.",
      args: EXAMPLE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const g = geometryOf(C, s);
        const r = reading(C, g);
        const h = r.homothety, u = r.pageMidpointSentence;
        const sideOK = [h.sideRatios.GaGb_to_AB, h.sideRatios.GbGc_to_BC, h.sideRatios.GcGa_to_CA]
          .every((v) => v !== null && Math.abs(v - 1 / 3) < 1e-6);
        return {
          homothety: h,
          midpointRatios: r.midpointRatios,
          pageMidpointSentence: u,
          claims: r.claims,
          note: h.holds && sideOK
            ? `J=(A+B+C+P)/4 is at (${h.center!.x}, ${h.center!.y}); GJ=${h.GJ} and JP=${h.JP}, so GJ:JP=${h.GJ_to_JP}. Ga, Gb, Gc are the images of A, B, C under the homothety about J with coefficient -1/3: each small side is parallel to and one third of its big side. The page's "U is the midpoint of AG" sentence is false here (2:1 split ${u.pageClaimHolds}); use the midpoint of AP instead and the split holds (${u.workingClaimHolds}). GbGc remains parallel to BC and a third as long either way.`
            : `The core did not confirm the homothety here (homothetic ${h.holds}, center ratio ${h.centerRatioHolds}, side ratios ${h.sideRatios.GaGb_to_AB}/${h.sideRatios.GbGc_to_BC}/${h.sideRatios.GcGa_to_CA}); see the residual fields and move a point. The midpoint-of-AG sentence still fails (2:1 split ${u.pageClaimHolds}) while the midpoint-of-AP version holds (${u.workingClaimHolds}).`,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that diagram. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Centroids state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four Centroids position must be an object");
  }
  if (!Array.isArray(state.A) || state.A.length !== 3) {
    throw new Error('saved "A" must be an array of three { x, y } points');
  }
  const A = state.A.map((v, i) => readPoint(v, `A[${i}]`));
  const P = readPoint(state.P, "P");
  const show = readShow(state.show === undefined || state.show === null ? {} : state.show);
  const optPoint = (v: unknown, label: string): Point | null => {
    try { return readPoint(v, label); } catch { return null; }
  };
  const savedG = Array.isArray(state.G) ? state.G.map((v, i) => optPoint(v, `G[${i}]`)) : null;
  const savedGabc = optPoint(state.Gabc, "Gabc");
  const savedJ = optPoint(state.J, "J");
  const savedClaims: Json = state.claims && typeof state.claims === "object" && !Array.isArray(state.claims)
    ? state.claims as Json : {};
  const saved = {
    A: A.map((p) => pt(p)), P: pt(P), show,
    G: savedG ? savedG.map((p) => (p ? pt(p) : null)) : null,
    Gabc: pt(savedGabc), J: pt(savedJ), claims: savedClaims,
  };

  const C = core();
  const here: State = { A, P, show, explored: true };
  const g = C.geometry(here);
  if (!g) {
    return {
      ...state,
      stateVersion,
      saved,
      valid: false,
      core: null,
      note: "The saved vertices and P are not a readable diagram for the core, so there are no centroids or homothety to measure here. Move a handle on the page and look again.",
    };
  }

  const coreReading = reading(C, g);
  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number, value: number): void => {
    differences.push({ field, page: round(page), core: round(value), diff: round(Math.abs(page - value), 9) });
  };
  const comparePoint = (field: string, page: Point | null, value: Point): void => {
    if (page) { compare(`${field}.x`, page.x, value.x); compare(`${field}.y`, page.y, value.y); }
  };
  if (savedG) savedG.forEach((p, i) => { if (p && g.G[i]) comparePoint(`G[${i}]`, p, g.G[i]); });
  comparePoint("Gabc", savedGabc, g.Gabc);
  comparePoint("J", savedJ, g.J || g.Jformula);
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );
  const claimsAgree = Object.keys(savedClaims).every(
    (key) => savedClaims[key] === (g.claims as unknown as Json)[key],
  );

  return {
    ...state,
    stateVersion,
    valid: true,
    saved,
    core: coreReading,
    coreDescription: C.describe(here),
    savedMatchesCore,
    claimsAgree,
    differences,
    note:
      "Track.state saved the three vertices, P, the four centroids G[0..3] (the last is G), J, the checkbox states and the claim verdicts in board units. " +
      "The real core rebuilds them: the parallels through Ga, Gb, Gc meet at G, ABC and GaGbGc are homothetic about J with coefficient -1/3 and GJ:JP=1:3, and each small side is parallel to and a third of ABC's. " +
      `The page's midpoint-of-AG sentence is false (2:1 split ${coreReading.pageMidpointSentence.pageClaimHolds}); with U the midpoint of AP the split holds (${coreReading.pageMidpointSentence.workingClaimHolds}). ` +
      (savedMatchesCore && claimsAgree
        ? "The saved numbers and claims agree with a fresh core construction."
        : "Some saved numbers or claims differ from the core rebuild; see `differences`, and trust `core` for the true reading."),
  };
}
