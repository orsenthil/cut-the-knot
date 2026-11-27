/*
 * run_game_logic actions and saved-position reader for Equiloc Quad 2Tri
 * (Alexander Bogomolny's EquilocQuad2Tri applet).
 *
 * A, B and S lie on one circle; C slides on the line B-S and D on the line
 * A-S, and dragging either sets the common length AD = BC. The four midpoints
 * K of AC, L of BD, M of AB and N of CD form the quadrilateral K-M-L-N. Each
 * side is a midline of a triangle: KM and LN are half of BC, ML and NK are
 * half of AD. Since AD = BC all four sides are equal and opposite sides are
 * parallel, so KMLN is a rhombus -- no 60-degree angle needed. That angle only
 * makes the short diagonal cut the rhombus into two equilateral triangles
 * (KL at 60 degrees, MN at 120). The old printed page mislists the midpoints
 * as AC, AB, BD, AD (the core uses AC, BD, AB, CD), misnames the equilateral
 * half as KMN (it is KML at the start) and gives the wrong midline bases.
 *
 * Every number below is measured by the real core in
 * equiloc-quad-2-tri/equiloc-quad-2-tri-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * illustration's 400 x 300 viewBox, with y down. This is a demo: there is no
 * win or loss. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type SideKey = "KM" | "ML" | "LN" | "NK";
type Measures = {
  kmVsBC: number; mlVsAD: number; lnVsBC: number; nkVsAD: number;
  kmDir: number; mlDir: number; lnDir: number; nkDir: number;
  sideSpread: number; adbcError: number; ad: number; bc: number;
  kl: number; mn: number; side: number; angle: number; angleError: number;
};
type Claims = {
  rhombus: boolean; adEqualsBC: boolean; midlinesEqual: boolean;
  oppositeParallel: boolean; equilic: boolean;
  equilateralKML: boolean; equilateralKNL: boolean;
  equilateralKMN: boolean; equilateralLMN: boolean;
};
type Geometry = {
  A: Point; B: Point; C: Point; D: Point; S: Point;
  K: Point; L: Point; M: Point; N: Point;
  sides: Record<SideKey, [Point, Point]>;
  sideLengths: Record<SideKey, number>;
  measures: Measures; claims: Claims;
  construction: [Point, Point][]; circle: Circle;
};
type Options = { names: boolean; construction: boolean; hint: boolean };
type State = {
  A: Point; B: Point; C: Point; D: Point; S: Point; length: number;
  circle: Circle; options: Options; explored: boolean;
};
type Core = {
  point(x: number, y: number): Point;
  locate(length: number, p: Point, q: Point): Point;
  dist(p: Point, q: Point): number;
  start(options?: Json): State;
  move(state: State, name: string, p: Point): State;
  compute(state: State): Geometry | null;
  geometry(state: State): Geometry | null;
  describe(state: State): string;
  result(state: State): null;
};

const core = () => cores["equiloc-quad-2-tri"].EquilocQuad2TriCore as unknown as Core;

/* The core is exact up to floating point; its residuals are ~1e-13 units. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const round = (v: number, digits = 6): number =>
  (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const pt = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const err = (v: number): number | null => (Number.isFinite(v) ? v : null);
const errText = (v: number | null): string =>
  v === null ? "undefined"
    : v !== 0 && Math.abs(v) < 1e-4 ? v.toExponential(2)
      : String(r6(v));
const SIDE_KEYS: SideKey[] = ["KM", "ML", "LN", "NK"];

/** Accept both the page's saved { x, y } dots and the tutor's [x, y] arguments. */
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

function readCircle(value: unknown, label: string): Circle {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`"${label}" must be a circle { c, r }`);
  }
  const o = value as Json;
  const r = num(o, "r");
  if (!(r > 0)) throw new Error(`"${label}.r" must be positive`);
  return { c: readPoint(o.c, `${label}.c`), r };
}

/** Cosmetic switches may be top-level keys or a nested `options` object. */
function readOptions(args: Json): Options {
  const raw: Json = args.options && typeof args.options === "object" && !Array.isArray(args.options)
    ? args.options as Json : args;
  const flag = (key: keyof Options, fallback: boolean): boolean => {
    const v = raw[key];
    if (v === undefined || v === null) return fallback;
    if (typeof v !== "boolean") {
      throw new Error(`"${key}" must be a boolean, got ${JSON.stringify(v)}`);
    }
    return v;
  };
  /* The core defaults names to true, the other two to false. */
  return { names: flag("names", true), construction: flag("construction", false), hint: flag("hint", false) };
}

/** Start from the core's opening picture and apply any supplied handle moves. */
function buildState(args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object with optional S, C, D points and options");
  }
  const K = core();
  let s = K.start(readOptions(args));
  for (const name of ["S", "C", "D"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      /* S is snapped onto the circle, C and D onto their secants, by the core. */
      s = K.move(s, name, readPoint(args[name], name));
    }
  }
  return s;
}

function geometryFrom(args: Json) {
  const K = core();
  const s = buildState(args);
  const g = K.geometry(s);
  if (!g) {
    throw new Error(
      "the core cannot draw this arrangement: move S away from A and B, or C and D away from S, so the handles stay apart",
    );
  }
  return { K, s, g };
}

function measuresView(m: Measures) {
  return {
    kmVsBC: err(m.kmVsBC), mlVsAD: err(m.mlVsAD),
    lnVsBC: err(m.lnVsBC), nkVsAD: err(m.nkVsAD),
    kmDir: err(m.kmDir), mlDir: err(m.mlDir), lnDir: err(m.lnDir), nkDir: err(m.nkDir),
    sideSpread: err(m.sideSpread), adbcError: err(m.adbcError),
    ad: r6(m.ad), bc: r6(m.bc), kl: r6(m.kl), mn: r6(m.mn), side: r6(m.side),
    angle: round(m.angle, 4), angleError: err(m.angleError),
  };
}

/** The two diagonals that cut the rhombus into equilateral triangles, if any. */
function equilateralHalves(m: Measures, c: Claims) {
  const halves: Array<{
    diagonal: "KL" | "MN"; triangles: [string, string];
    diagonalLength: number; sideLength: number;
  }> = [];
  if (c.equilateralKML && c.equilateralKNL) {
    halves.push({ diagonal: "KL", triangles: ["KML", "KNL"],
      diagonalLength: r6(m.kl), sideLength: r6(m.side) });
  }
  if (c.equilateralKMN && c.equilateralLMN) {
    halves.push({ diagonal: "MN", triangles: ["KMN", "LMN"],
      diagonalLength: r6(m.mn), sideLength: r6(m.side) });
  }
  return halves;
}

function halfText(m: Measures, c: Claims): string {
  const halves = equilateralHalves(m, c);
  if (halves.length > 0) {
    return halves.map((h) =>
      `The short diagonal ${h.diagonal} (${h.diagonalLength}) cuts KMLN into equilateral triangles ${h.triangles.join(" and ")}.`,
    ).join(" ");
  }
  return `No diagonal gives two equilateral triangles here (the acute angle between AD and BC is ${round(m.angle, 2)} degrees, not 60).`;
}

/** Everything the core can say about one picture, in tutor-friendly units. */
function reading(K: Core, s: State, g: Geometry) {
  const m = g.measures, c = g.claims;
  const sides = Object.fromEntries(SIDE_KEYS.map((key) => [key, r6(g.sideLengths[key])])) as
    Record<SideKey, number>;
  const midpoints = {
    K: { of: "AC", point: pt(g.K) },
    L: { of: "BD", point: pt(g.L) },
    M: { of: "AB", point: pt(g.M) },
    N: { of: "CD", point: pt(g.N) },
  };
  const midlines = {
    definition: "K = midpoint(AC), L = midpoint(BD), M = midpoint(AB), N = midpoint(CD)",
    coreList: "AC, BD, AB, CD (gives the rhombus K-M-L-N)",
    pagePrintedList: "AC, AB, BD, AD (misprint; does not give a rhombus)",
    halves: {
      KM: { triangle: "ABC", halfOf: "BC", length: sides.KM, expected: r6(m.bc / 2), error: err(m.kmVsBC) },
      ML: { triangle: "ABD", halfOf: "AD", length: sides.ML, expected: r6(m.ad / 2), error: err(m.mlVsAD) },
      LN: { triangle: "BCD", halfOf: "BC", length: sides.LN, expected: r6(m.bc / 2), error: err(m.lnVsBC) },
      NK: { triangle: "ACD", halfOf: "AD", length: sides.NK, expected: r6(m.ad / 2), error: err(m.nkVsAD) },
    },
    lengthsMatch: c.midlinesEqual,
    oppositeSidesParallel: c.oppositeParallel,
  };
  const rhombus = {
    vertices: { K: pt(g.K), M: pt(g.M), L: pt(g.L), N: pt(g.N) },
    order: "K-M-L-N",
    sideLengths: sides,
    sideSpread: err(m.sideSpread),
    equalSides: c.rhombus,
    holds: c.rhombus,
  };
  const equilic = {
    AD: r6(m.ad), BC: r6(m.bc), adEqualsBC: c.adEqualsBC,
    adbcError: err(m.adbcError),
    angleDegrees: round(m.angle, 4),
    angleError: err(m.angleError),
    angleIs60: c.equilic,
    equilateralHalves: equilateralHalves(m, c),
    holds: c.equilic,
  };
  return {
    points: { A: pt(g.A), B: pt(g.B), C: pt(g.C), D: pt(g.D), S: pt(g.S),
      K: pt(g.K), L: pt(g.L), M: pt(g.M), N: pt(g.N) },
    circle: { center: pt(g.circle.c), radius: r6(g.circle.r) },
    length: r6(s.length),
    midpoints,
    midlines,
    rhombus,
    equilic,
    measures: measuresView(m),
    claims: c,
    result: K.result(s),
    status: K.describe(s),
  };
}

/** Build an equilic quadrilateral with a chosen angle between AD and BC. */
function stateAtAngle(K: Core, angleDeg: number, length: number): State {
  const R = 140;
  const S = K.point(200, 220);
  const t = (angleDeg * Math.PI) / 180;
  const a = -Math.PI / 2 - t / 2, b = -Math.PI / 2 + t / 2;
  const A = K.point(S.x + R * Math.cos(a), S.y + R * Math.sin(a));
  const B = K.point(S.x + R * Math.cos(b), S.y + R * Math.sin(b));
  return {
    A, B, S,
    C: K.locate(length, B, S), D: K.locate(length, A, S),
    length,
    circle: { c: K.point(S.x, S.y), r: R },
    options: { names: true, construction: false, hint: false },
    explored: true,
  };
}

export function actions(): GameActions {
  return {
    rhombus_and_halves: {
      describe:
        "For A, B, S on one circle with C on line B-S and D on line A-S so AD = BC, take K of AC, L of BD, M of AB and N of CD and report the rhombus K-M-L-N: its four equal sides, the midline halves BC/2 and AD/2 with residuals, which diagonal cuts it into two equilateral triangles, and the note that the rhombus needs no 60-degree angle. It also corrects the old page's midpoint list (printed AC, AB, BD, AD; the code and this reader use AC, BD, AB, CD). S, C and D are optional [x, y] or { x, y } board points; omit them for the opening figure.",
      args: '{ "S": [294.8547117632492, 107.13582568932148] }',
      run: (args) => {
        const { K, s, g } = geometryFrom(args);
        const view = reading(K, s, g);
        const c = g.claims, m = g.measures;
        return {
          ...view,
          note:
            `The four midpoints of AC, BD, AB, CD give KMLN with sides ` +
            `${SIDE_KEYS.map((key) => view.rhombus.sideLengths[key]).join(", ")} (spread ` +
            `${errText(view.rhombus.sideSpread)}): each is a midline, KM = LN = BC/2 and ` +
            `ML = NK = AD/2, and AD = BC = ${view.equilic.AD}. So the rhombus holds even when ` +
            `the angle is not 60 degrees. ${halfText(m, c)} ` +
            "The old page's midpoint list AC, AB, BD, AD is a misprint, and it calls KMN equilateral when the opening half is KML.",
        };
      },
    },
    rhombus_at_other_angles: {
      describe:
        "Draw equilic quadrilaterals with AD = BC at angles other than 60 degrees (the page's circle fixes the angle at 60 or 120, so this steps off the circle) and confirm with the real core that the four midpoints still give a rhombus while equilateral halves appear only at 60 and 120. Pass `angles` as degrees from 1 to 179 (default [30, 60, 80, 120, 150]) and optionally `length` for the common side (2 to 138, default 70).",
      args: '{ "angles": [30, 60, 80, 120, 150] }',
      run: (args) => {
        const raw = args.angles === undefined || args.angles === null
          ? [30, 60, 80, 120, 150] : args.angles;
        if (!Array.isArray(raw) || raw.length < 1 || raw.length > 24) {
          throw new Error('"angles" must be an array of 1 to 24 angles in degrees');
        }
        const angles = raw.map((v, i) => {
          const n = Number(v);
          if (!Number.isFinite(n) || n <= 0 || n >= 180) {
            throw new Error(`angles[${i}] must be strictly between 0 and 180 degrees`);
          }
          return n;
        });
        const length = args.length === undefined || args.length === null ? 70 : Number(args.length);
        if (!Number.isFinite(length) || length <= 2 || length >= 138) {
          throw new Error('"length" must be greater than 2 and less than 138 board units');
        }
        const K = core();
        type Row = {
          angle: number; drawable: boolean; reason?: string;
          measuredAngle?: number; ad?: number; bc?: number;
          sideLengths?: Record<SideKey, number>; sideSpread?: number | null;
          rhombus?: boolean; equilic?: boolean;
          equilateralHalves?: string[];
        };
        const rows: Row[] = angles.map((angle) => {
          const g = K.geometry(stateAtAngle(K, angle, length));
          if (!g) {
            return { angle, drawable: false,
              reason: "the core cannot draw this figure (a handle is too close to S)" };
          }
          const halves = equilateralHalves(g.measures, g.claims);
          return {
            angle, drawable: true,
            measuredAngle: round(g.measures.angle, 4),
            ad: r6(g.measures.ad), bc: r6(g.measures.bc),
            sideLengths: Object.fromEntries(SIDE_KEYS.map((key) =>
              [key, r6(g.sideLengths[key])])) as Record<SideKey, number>,
            sideSpread: err(g.measures.sideSpread),
            rhombus: g.claims.rhombus,
            equilic: g.claims.equilic,
            equilateralHalves: halves.map((h) => h.triangles.join("+")),
          };
        });
        const drawn = rows.filter((row) => row.drawable);
        const allRhombi = drawn.length > 0 && drawn.every((row) => row.rhombus === true);
        const equilateralOnlyAt60or120 = drawn.every((row) =>
          row.equilic === (Math.abs((row.measuredAngle ?? 0) - 60) < 1e-6));
        const worstSpread = drawn.reduce<number>((max, row) =>
          Math.max(max, row.sideSpread ?? 0), 0);
        return {
          length, rows,
          rhombusAtEveryAngle: allRhombi,
          worstSideSpread: r6(worstSpread),
          equilateralOnlyAt60or120,
          note:
            `At all ${drawn.length} drawable angles the four midpoints form a rhombus ` +
            `(worst side spread ${errText(r6(worstSpread))} board units), so the 60-degree angle is not needed. ` +
            "Equilateral halves appear only when the acute angle between AD and BC is 60 degrees " +
            "(diagonal KL) or its 120-degree companion (diagonal MN); the page's circle supplies exactly those angles.",
        };
      },
    },
  };
}

/** The fields Track.state saved, plus a fresh core reading of that picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equiloc Quad 2Tri state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Equiloc Quad 2Tri position must be an object");
  }
  const saved = {
    A: readPoint(state.A, "A"), B: readPoint(state.B, "B"),
    C: readPoint(state.C, "C"), D: readPoint(state.D, "D"),
    S: readPoint(state.S, "S"),
    K: readPoint(state.K, "K"), L: readPoint(state.L, "L"),
    M: readPoint(state.M, "M"), N: readPoint(state.N, "N"),
    length: num(state, "length"),
    circle: readCircle(state.circle, "circle"),
    options: readOptions(state.options && typeof state.options === "object"
      ? state.options as Json : {}),
  };
  const savedClaims: Json = state.claims && typeof state.claims === "object"
    && !Array.isArray(state.claims) ? state.claims as Json : {};
  const savedMeasures: Json = state.measures && typeof state.measures === "object"
    && !Array.isArray(state.measures) ? state.measures as Json : {};

  /* compute() re-locates C and D from `length`, exactly as the page repaints. */
  const coreState: State = {
    A: saved.A, B: saved.B, S: saved.S, C: saved.C, D: saved.D,
    length: saved.length, circle: saved.circle, options: saved.options, explored: true,
  };
  const K = core();
  const g = K.geometry(coreState);
  if (!g) {
    return {
      ...state, stateVersion,
      valid: false,
      note: "The saved points are degenerate for the core (C or D is within a unit of S, or the circle is undefined), so there is no midpoint rhombus to measure. Move a handle on the page and look again.",
    };
  }
  const coreReading = reading(K, coreState, g);
  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number, value: number): void => {
    differences.push({ field, page: r6(page), core: r6(value), diff: round(Math.abs(page - value), 9) });
  };
  for (const key of ["C", "D", "K", "L", "M", "N"] as const) {
    compare(`${key}.x`, saved[key].x, g[key].x);
    compare(`${key}.y`, saved[key].y, g[key].y);
  }
  for (const key of Object.keys(g.measures) as (keyof Measures)[]) {
    if (typeof savedMeasures[key] === "number") {
      compare(`measures.${key}`, Number(savedMeasures[key]), g.measures[key]);
    }
  }
  const savedMatchesCore = differences.every(
    (d) => d.diff <= 1e-4 * Math.max(1, Math.abs(d.core)),
  );
  const claimsAgree = Object.keys(savedClaims).every(
    (key) => savedClaims[key] === (g.claims as unknown as Json)[key],
  );

  return {
    ...state,
    stateVersion,
    saved: { ...saved, claims: savedClaims, measures: savedMeasures },
    valid: true,
    core: coreReading,
    coreDescription: K.describe(coreState),
    savedMatchesCore,
    claimsAgree,
    differences,
    note:
      "Track.state saved A, B, C, D, S, the four midpoints K, L, M, N, the common signed length, the circle, the display options and the page's own claims and residuals, in board units. " +
      "The real core rebuilds C and D from that length, then measures the four midpoint sides of KMLN, the midline halves of BC and AD, the angle between the equal sides and whichever diagonal gives equilateral triangles. " +
      (savedMatchesCore && claimsAgree
        ? "The saved numbers and claims agree with a fresh core construction."
        : "Some saved numbers or claims differ from the core rebuild; see `differences`, and trust `core` for the true reading."),
  };
}
