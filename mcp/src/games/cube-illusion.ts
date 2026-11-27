/*
 * run_game_logic actions and saved-position reader for Cube Illusion.
 * The drawing is one fixed set of strokes; both answers come from the real
 * core's point geometry and edge lists. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cube-illusion"].CubeIllusionCore;

type Reading = "small" | "cut" | null;

interface CubeState {
  angle: number;
  n: number;
  m: number;
  longLines: boolean;
  shortLines: boolean;
  width: number;
  height: number;
  reading?: Reading;
}

type Stroke = { a: { x: number; y: number }; b: { x: number; y: number }; kind: string; name: string };

/** Read the page's options, rejecting values outside the applet's scrollbars. */
function readState(args: Json, base?: CubeState): CubeState {
  const C = core();
  const patch: Json = {};
  for (const key of ["angle", "n", "m"] as const) {
    if (args[key] === undefined || args[key] === null) continue;
    const value = num(args, key);
    const range = C.RANGES[key];
    if (!Number.isInteger(value) || value < range.min || value > range.max) {
      throw new Error(`"${key}" must be an integer from ${range.min} to ${range.max}`);
    }
    patch[key] = value;
  }
  for (const key of ["longLines", "shortLines"] as const) {
    if (args[key] === undefined || args[key] === null) continue;
    if (typeof args[key] !== "boolean") throw new Error(`"${key}" must be true or false`);
    patch[key] = args[key];
  }
  for (const key of ["width", "height"] as const) {
    if (args[key] === undefined || args[key] === null) continue;
    const value = num(args, key);
    if (!Number.isInteger(value) || value < 1) throw new Error(`"${key}" must be a positive integer`);
    patch[key] = value;
  }
  const reading = args.reading;
  if (reading !== undefined && reading !== null && reading !== "small" && reading !== "cut") {
    throw new Error('"reading" must be "small", "cut", or null');
  }
  const state = C.adjust(base ?? (C.start({}) as CubeState), patch) as CubeState;
  if (reading !== undefined) state.reading = reading as Reading;
  return state;
}

/** The cycle among a reading's nine named strokes, and the three that leaf off it. */
function analyseReading(names: readonly string[]) {
  const adj = new Map<string, string[]>();
  const add = (u: string, v: string) => {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u)!.push(v);
    adj.get(v)!.push(u);
  };
  for (const name of names) {
    const [u, v] = name.split("-");
    if (!u || !v || u === v) throw new Error(`bad cube edge name "${name}"`);
    add(u, v);
  }
  /* Several 6-cycles can pass through the hidden corner; keep the one whose
     three leftover strokes really leaf off it, as the applet's outline does. */
  const cycles: string[][] = [];
  const visit = (start: string, at: string, path: string[]) => {
    for (const next of adj.get(at) ?? []) {
      if (next === start && path.length === 6) cycles.push(path.slice());
      else if (path.length < 6 && !path.includes(next)) visit(start, next, [...path, next]);
    }
  };
  for (const start of [...adj.keys()].sort()) visit(start, start, [start]);
  let cycle: string[] | null = null;
  let spokes: string[] = [];
  for (const candidate of cycles) {
    const on = new Set(candidate);
    const rest = names.filter((name) => {
      const [u, v] = name.split("-");
      return !(on.has(u) && on.has(v));
    });
    if (rest.length !== 3 || names.length !== 9) continue;
    const ends = rest.map((name) => {
      const [u, v] = name.split("-");
      return on.has(u) ? v : on.has(v) ? u : null;
    });
    // Three spokes either meet at one hidden corner (small cube) or end at
    // three separate cut corners (big cube) — never at two, and never inside.
    if (ends.some((end) => end === null)) continue;
    if (ends[0] !== ends[1] && new Set(ends).size !== 3) continue;
    cycle = candidate;
    spokes = rest;
    break;
  }
  return {
    hexagon: cycle,
    spokes,
    closed: cycle !== null,
    strokeCount: names.length,
  };
}

function heavySignature(lines: Stroke[]): string {
  return lines
    .filter((line) => line.kind === "edge")
    .map((line) => `${line.name}:${line.a.x},${line.a.y}-${line.b.x},${line.b.y}`)
    .sort()
    .join("|");
}

/** Ratios of the four slants in the drawing; the same affine unit makes them agree. */
function tilt(state: CubeState) {
  const p = core().computePoints(state);
  const ratio = p.slantedUnitH / p.slantedUnitW;
  const slopes = {
    lowerLeft: Math.abs((p.B.y - p.A.y) / (p.B.x - p.A.x)),
    lowerRight: Math.abs((p.D.y - p.A.y) / (p.D.x - p.A.x)),
    upperLeft: Math.abs((p.Cp.y - p.Bp.y) / (p.Cp.x - p.Bp.x)),
    upperRight: Math.abs((p.Cp.y - p.Dp.y) / (p.Cp.x - p.Dp.x)),
  };
  const expected = Math.tan((state.angle * Math.PI) / 180) / 1.6;
  const agree = Object.values(slopes).every((s) => Math.abs(s - ratio) < 1e-9);
  return { ratio, expected, slantedUnitW: p.slantedUnitW, slantedUnitH: p.slantedUnitH, slopes, agree };
}

export function actions(): GameActions {
  return {
    two_readings: {
      describe:
        "Read the same 18 heavy strokes two ways: check that nine close into a hexagon and three leaf off it for each reading, and show that one tilt ratio fixes both slant directions of the cube grid.",
      args: '{ "angle": 45, "n": 6, "m": 2 }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const edges = C.segments(state).filter((line) => line.kind === "edge");
        const readings = Object.fromEntries(
          (["small", "cut"] as const).map((kind) => {
            const names = C.READINGS[kind];
            const missing = names.filter((name) => !edges.some((line) => line.name === name));
            if (missing.length) throw new Error(`core has no heavy stroke named ${missing.join(", ")}`);
            return [kind, analyseReading(names)];
          }),
        );
        const t = tilt(state);
        return {
          angle: state.angle, n: state.n, m: state.m,
          heavyStrokes: edges.length,
          strokesPerReading: Object.values(readings).map((r) => r.strokeCount),
          readings,
          tilt: t,
          fitsBothReadings:
            edges.length === 18 && readings.small.closed && readings.cut.closed && t.agree,
          description: C.describe(state),
          note: "One affine cube grid gives both readings: the small cube's six edges close a hexagon with three spokes meeting at its hidden corner, and the cut cube's six edges close another hexagon with three spokes to the cut-off corner.",
        };
      },
    },
    grid_toggle: {
      describe:
        "Turn the long and short tiling lines off and on and verify that all 18 heavy cube strokes, and hence both readings, are unchanged; count the tiling strokes each toggle adds.",
      args: '{ "angle": 45, "n": 6, "m": 2, "longLines": true, "shortLines": true }',
      run: (args) => {
        const C = core();
        const state = readState(args);
        const full = C.segments(state) as Stroke[];
        const plain = C.segments({ ...state, longLines: false, shortLines: false }) as Stroke[];
        const long = C.segments({ ...state, longLines: true, shortLines: false }) as Stroke[];
        const short = C.segments({ ...state, longLines: false, shortLines: true }) as Stroke[];
        const count = (lines: Stroke[], kind: string) => lines.filter((line) => line.kind === kind).length;
        const identical = heavySignature(full) === heavySignature(plain);
        return {
          angle: state.angle, n: state.n, m: state.m,
          heavyStrokes: count(full, "edge"),
          heavyStrokesIdenticalWhenGridOff: identical,
          longStrokes: count(full, "long"),
          shortStrokes: count(full, "short"),
          longOnly: count(long, "long"),
          shortOnly: count(short, "short"),
          readingUnaffected: identical && heavySignature(long) === heavySignature(short),
          note: "The grid checkboxes only add thin tiling lines; the heavy strokes carrying the two cube readings are exactly the same either way.",
        };
      },
    },
  };
}

/** What the core says about the illustration whose position the page saved. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Cube Illusion state version ${stateVersion}`);
  const C = core();
  try {
    const here = readState(state);
    const lines = C.segments(here) as Stroke[];
    const small = analyseReading(C.READINGS.small);
    const cut = analyseReading(C.READINGS.cut);
    const t = tilt(here);
    const kinds = { edge: 0, long: 0, short: 0 };
    for (const line of lines) if (line.kind in kinds) kinds[line.kind as keyof typeof kinds]++;
    return {
      ...state,
      stateVersion,
      valid: true,
      angle: here.angle,
      n: here.n,
      m: here.m,
      longLines: here.longLines,
      shortLines: here.shortLines,
      width: here.width,
      height: here.height,
      reading: here.reading ?? null,
      mClampedToN: here.m !== Number(state.m),
      tiltRatio: t.ratio,
      slantsAgree: t.agree,
      heavyStrokes: kinds.edge,
      longStrokes: kinds.long,
      shortStrokes: kinds.short,
      bothReadingsFit: kinds.edge === 18 && small.closed && cut.closed,
      highlightedEdges: here.reading ? [...C.READINGS[here.reading]] : [],
      description: C.describe(here),
      note: "The 18 heavy strokes close a hexagon for each of the two readings; tilting by this angle and choosing the two cube sizes fixes both without shading or hidden edges.",
    };
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      error: err instanceof Error ? err.message : String(err),
      note: "A saved Cube Illusion position needs an angle from 15 to 60 and integer cube sizes n (2 to 10) and m (1 to 10).",
    };
  }
}
