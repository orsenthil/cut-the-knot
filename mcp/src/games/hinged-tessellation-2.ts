/*
 * run_game_logic actions and saved-position reader for Hinged Tessellation 2
 * (applet HingedTessellation2, the second hinged-tessellation applet).
 *
 * The real core is hinged-tessellation-2/hinged-tessellation-2-core.js, copied
 * into src/generated/cores/ at build time; every number reported here is
 * measured from it. Coordinates are board units with y down.
 *
 * Applet B keeps the SQUARES rigid: each side is turned a quarter turn to make
 * a square, so all four stay square at every hinge position, while the
 * triangles are free to stretch. With the hinges locked BA = BC, and the five
 * polygons at A have angles
 *
 *     90 + β + β + 90 + (180 − 2β) = 360
 *
 * for every opening. At β = 60 the vertex figure is the semi-regular
 * (4,3,3,4,3); opening the hinge to 90 degrees makes β = 45 and pairs the
 * triangles into squares, the page's (4,4,4,4) derivative. Sibling applet A
 * (HingedTessellation1) makes the opposite choice: it holds the triangles
 * equilateral and lets the squares become rhombi, reaching six triangles at
 * every corner at 60 degrees. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { numArray, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  A: Pt; B: Pt; C: Pt;
  layers: number; colorMode: number; loose: boolean;
  width: number; height: number;
};
type Tessellation = {
  D: Pt;
  base: { triangles: unknown[]; edges: unknown[] };
  motifs: unknown[];
  V: Pt; W: Pt;
};
type VertexAngles = {
  parts: number[]; sum: number; apex: number;
  squares: Pt[][]; triangles: Pt[][];
};
type Core = {
  MODES: { ONE_COLOR: number; TWO_COLORS: number; COLOR_LAYERS: number };
  LIMITS: { layers: { min: number; max: number; step: number } };
  dist(p: Pt, q: Pt): number;
  angle(vertex: Pt, p: Pt, q: Pt): number;
  start(o?: Partial<State>): State;
  withPoint(s: State, name: string, p: Pt): State;
  withOption(s: State, name: string, value: number | boolean): State;
  withApex(s: State, degrees: number): State;
  tessellate(s: State): Tessellation;
  vertexAngles(a: Pt, b: Pt, c: Pt): VertexAngles;
};

const core = (): Core =>
  cores["hinged-tessellation-2"].HingedTessellation2Core as unknown as Core;

/* The geometry is exact up to floating point; tidy only what we print. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const ptOut = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });

/** Accept both the page's saved { x, y } dots and short [x, y] JSON. */
function readPoint(raw: unknown, label: string): Pt {
  if (raw === undefined || raw === null) {
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function intArg(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`argument "${key}" must be an integer from ${lo} to ${hi}`);
  }
  return n;
}

function boolArg(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** Optional opening angle at B; the core itself works in degrees 1–179. */
function apexArg(args: Json, key: string): number | null {
  const v = args[key];
  if (v === undefined || v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 179) {
    throw new Error(`argument "${key}" must be a finite number of degrees from 1 to 179`);
  }
  return n;
}

/** The page's state: start from the opening picture, override points/options. */
function buildState(C: Core, args: Json): State {
  const opening = C.start();
  let s = C.start({
    layers: intArg(args, "layers", opening.layers, C.LIMITS.layers.min, C.LIMITS.layers.max),
    colorMode: intArg(args, "colorMode", opening.colorMode, C.MODES.ONE_COLOR, C.MODES.COLOR_LAYERS),
    loose: boolArg(args, "loose", opening.loose),
  });
  for (const name of ["A", "B", "C"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = C.withPoint(s, name, readPoint(args[name], name));
    }
  }
  return s;
}

/** Everything the real core says about one hinge position. */
function reading(C: Core, s: State) {
  const v = C.vertexAngles(s.A, s.B, s.C);
  const pattern = C.tessellate(s);
  const scale = Math.max(1, C.dist(s.A, s.B), C.dist(s.B, s.C), C.dist(s.A, s.C));
  const lenTol = 1e-6 * scale;
  const angleTol = 1e-4; // degrees

  const sides = (poly: Pt[]): number[] =>
    poly.map((p, i) => C.dist(p, poly[(i + 1) % poly.length]));
  const angles = (poly: Pt[]): number[] =>
    poly.map((p, i) =>
      C.angle(p, poly[(i - 1 + poly.length) % poly.length], poly[(i + 1) % poly.length]) * 180 / Math.PI);
  const spread = (v2: number[]): number => Math.max(...v2) - Math.min(...v2);

  const squares = v.squares.map((sq) => {
    const sd = sides(sq);
    const an = angles(sq);
    const sideSpread = spread(sd);
    const angleError = Math.max(...an.map((a) => Math.abs(a - 90)));
    return {
      corners: sq.map(ptOut),
      sides: sd.map(r6), sideSpread: r6(sideSpread),
      angles: an.map(r6), angleError: r6(angleError),
      isSquare: sideSpread <= lenTol && angleError <= angleTol,
    };
  });
  /* Only the first three of the core's eight triangles touch A. */
  const trianglesAtA = v.triangles.slice(0, 3).map((tri) => {
    const sd = sides(tri);
    const an = angles(tri);
    return {
      corners: tri.map(ptOut),
      sides: sd.map(r6), sideSpread: r6(spread(sd)),
      angles: an.map(r6), equilateral: spread(sd) <= lenTol,
    };
  });

  const arrangement =
    Math.abs(v.apex - 60) < 0.5 ? "semi-regular (4,3,3,4,3)"
      : Math.abs(v.apex - 90) < 0.5 ? "square derivative (4,4,4,4)"
        : `locked hinges at ${v.apex.toFixed(0)}° (still a full turn at A)`;

  return {
    hinge: { A: ptOut(s.A), B: ptOut(s.B), C: ptOut(s.C), apex: r6(v.apex), locked: !s.loose },
    vertexFigure: {
      polygons: [4, 3, 3, 4, 3],
      parts: ["square ABML", "triangle ABC", "triangle ACD", "square DAKI", "triangle AKL"],
      anglesDeg: v.parts.map(r6),
      sumDeg: r6(v.sum),
      fillsTurn: Math.abs(v.sum - 360) <= angleTol,
      betaDeg: r6(v.parts[1]),
      thirdTriangleDeg: r6(v.parts[4]),
    },
    arrangement,
    squares,
    trianglesAtA,
    tessellation: {
      layers: s.layers, colorMode: s.colorMode,
      motifs: pattern.motifs.length,
      trianglesPerMotif: pattern.base.triangles.length,
      edgesPerMotif: pattern.base.edges.length,
    },
  };
}
type Reading = ReturnType<typeof reading>;

/** The short form used for each step of a hinge sweep. */
function compact(r: Reading) {
  return {
    apexDeg: r.hinge.apex,
    betaDeg: r.vertexFigure.betaDeg,
    thirdTriangleDeg: r.vertexFigure.thirdTriangleDeg,
    anglesDeg: r.vertexFigure.anglesDeg,
    sumDeg: r.vertexFigure.sumDeg,
    fillsTurn: r.vertexFigure.fillsTurn,
    arrangement: r.arrangement,
    squaresStaySquare: r.squares.every((q) => q.isSquare),
    trianglesEquilateralAtA: r.trianglesAtA.every((t) => t.equilateral),
  };
}

export function actions(): GameActions {
  return {
    vertex_figure: {
      describe:
        "Report the five polygons that meet at hinge point A and their angles for a chosen opening of the hinge. Pass A, B and C as [x, y] or { x, y } board points (omitted dots keep the opening picture) and optionally apex (degrees 1–179; 60 is the semi-regular start, 90 the square derivative), plus layers (0–15), colorMode (0–2) and loose. The core measures the two squares, the three triangles at A and the five angles 90 + β + β + 90 + (180 − 2β), showing they fill 360° and that the squares stay square while the triangles stretch — unlike applet A, which keeps its triangles equilateral and lets the squares become rhombi.",
      args: '{ "apex": 60 }',
      run: (args) => {
        const C = core();
        const base = buildState(C, args);
        const requestedApex = apexArg(args, "apex");
        const s = requestedApex === null ? base : C.withApex(base, requestedApex);
        const r = reading(C, s);
        const triWord = r.trianglesAtA.every((t) => t.equilateral)
          ? "all three triangles are equilateral"
          : "the triangles have stretched and are no longer equilateral";
        return {
          requested: { apex: requestedApex },
          ...r,
          note:
            `The five polygons at A have angles ${r.vertexFigure.anglesDeg.join(" + ")} = ${r.vertexFigure.sumDeg}°, a full turn; the two squares are still square and ${triWord}. ` +
            `This is the ${r.arrangement} arrangement. Applet A (HingedTessellation1) makes the opposite choice: it holds the triangles equilateral and lets the squares become rhombi.`,
        };
      },
    },

    hinge_morph: {
      describe:
        "Sweep the hinge open from the (4,3,3,4,3) start toward the (4,4,4,4) square derivative. apexes is a list of opening angles at B in degrees (1–179, default [60, 75, 90]); A, B and C may be given as [x, y] or { x, y } to fix the centre B and the radius BA. Each step reports β, the five angles at A, their 360° sum, whether the squares are still square and the triangles still equilateral. At 60° the triangles are equilateral; at 90° β = 45°, none are, yet four squares meet at every corner — the opposite choice from applet A, where the triangles stay rigid and the squares turn into rhombi.",
      args: '{ "apexes": [60, 75, 90] }',
      run: (args) => {
        const C = core();
        const base = buildState(C, args);
        const raw = args.apexes;
        const list = raw === undefined || raw === null ? [60, 75, 90] : numArray(args, "apexes");
        if (!list.length) throw new Error('argument "apexes" must be a non-empty array of degrees');
        if (list.length > 30) throw new Error('argument "apexes" may have at most 30 entries');
        for (const a of list) {
          if (!Number.isFinite(a) || a < 1 || a > 179) {
            throw new Error('each entry of "apexes" must be between 1 and 179 degrees');
          }
        }
        const steps = list.map((a) => compact(reading(C, C.withApex(base, a))));
        const first = steps[0];
        const last = steps[steps.length - 1];
        return {
          apexes: list,
          steps,
          note:
            `Opening the hinge takes β from ${first.betaDeg}° to ${last.betaDeg}°; the five angles at A still sum to ${last.sumDeg}° in every step, the squares stay square (${last.squaresStaySquare}), and the triangles stop being equilateral (${last.trianglesEquilateralAtA}) as the tiling reaches ${last.arrangement}. ` +
            "Applet A instead keeps its triangles equilateral and turns its squares into rhombi, reaching six triangles at every corner at 60°.",
        };
      },
    },
  };
}

const savedNum = (v: unknown): number | null => {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function savedPoint(v: unknown): Pt | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Json;
  const x = savedNum(o.x), y = savedNum(o.y);
  return x === null || y === null ? null : { x, y };
}

/** Echo what Track.state saved, then re-measure that picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hinged Tessellation 2 state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Hinged Tessellation 2 position must be an object");
  }
  const C = core();
  const opening = C.start();
  const saved = {
    A: savedPoint(state.A), B: savedPoint(state.B), C: savedPoint(state.C),
    layers: savedNum(state.layers), colorMode: savedNum(state.colorMode),
    loose: typeof state.loose === "boolean" ? state.loose : null,
    width: savedNum(state.width), height: savedNum(state.height),
  };
  let s = C.start({
    layers: saved.layers ?? opening.layers,
    colorMode: saved.colorMode ?? opening.colorMode,
    loose: saved.loose ?? opening.loose,
    width: saved.width ?? opening.width,
    height: saved.height ?? opening.height,
  });
  for (const name of ["A", "B", "C"] as const) {
    const p = saved[name];
    if (p) s = C.withPoint(s, name, p);
  }
  const readable = !!(saved.A && saved.B && saved.C);
  const r = readable ? reading(C, s) : null;
  return {
    ...state,
    stateVersion,
    saved,
    reading: r,
    status: r ? r.arrangement : null,
    note:
      "Track.state saves the whole core position: the three hinge dots A, B, C, the layer count, colour mode, the loose-hinge flag and the board size; those fields are echoed above. " +
      (r
        ? `The core rebuilds that drawing and re-measures the five angles at A (${r.vertexFigure.anglesDeg.join(" + ")} = ${r.vertexFigure.sumDeg}°), the four squares and the three triangles at A. The hinge is at ${r.hinge.apex}°, so the arrangement is ${r.arrangement}.`
        : "The saved hinge dots could not be read, so the core reading is null and the opening picture was used."),
  };
}
