/*
 * run_game_logic actions and saved-position reader for Concurrency.
 *
 * The real core is concurrency/concurrency-core.js, copied into
 * src/generated/cores/ at build time. It follows Bogomolny's "Isogonal
 * Concurrency" applet: at each corner of a triangle a draggable ray VP[i] is
 * reflected in the corner's angle bisector to give its isogonal partner VM[i],
 * and the six lines are grouped into three triples — AP, BQ, CR; AU, BV, CW;
 * PU, QV, RW — each of which meets in one point whatever the six dots do.
 * Lyness's proportion BS/SC = (cot b - cot B)/(cot g - cot C) gives the same
 * ratio inverted at the next corner, so the three multiply to 1 and Ceva's
 * theorem forces the concurrence. Every number below is measured by the core.
 * See _shared.ts for the module shape. Coordinates are the illustration's
 * 360 x 260 viewBox units, with y down.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["concurrency"].ConcurrencyCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type State = { V: Point[]; P: Point[]; mode: number };
type Family = { index: number; name: string; lines: Point[][]; point: Point | null };
type Geometry = { angles: number[]; lengths: number[]; M: Point[]; X: Point[]; Y: Point[]; Z: Point[] };
type CevaPart = { ratio: number; predicted: number; t: number } | null;
type CevaResult = { parts: CevaPart[]; product: number | null };

const LABELS: string[][] = [["AP", "BQ", "CR"], ["AU", "BV", "CW"], ["PU", "QV", "RW"]];
const CORNERS = ["A", "B", "C"];

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : r6(v);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const deg = (rad: number): number | null => maybe((rad * 180) / Math.PI);
const dist2 = (p: Point, q: Point): number => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const agreesWith = (a: number, b: number): boolean =>
  Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** A point as the page saves it ({x, y}) or as short [x, y] JSON. */
function readPoint(raw: unknown, label: string): Point {
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { "x": ..., "y": ... }`);
    const x = Number(raw[0]), y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`argument "${label}" is not a finite point`);
    return { x, y };
  }
  if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`argument "${label}" must be [x, y] or { "x": ..., "y": ... }`);
}

function readTriple(args: Json, key: string, fallback: Point[]): Point[] {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback.map((p) => ({ ...p }));
  if (!Array.isArray(raw) || raw.length !== 3) {
    throw new Error(`argument "${key}" must be an array of three [x, y] points`);
  }
  return raw.map((p, i) => readPoint(p, `${key}[${i}]`));
}

function readMode(args: Json, fallback: number): number {
  const raw = args.mode;
  if (raw === undefined || raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 2) {
    throw new Error('argument "mode" must be 0 (AP, BQ, CR), 1 (AU, BV, CW) or 2 (PU, QV, RW)');
  }
  return n;
}

/**
 * Rebuild the page's state: start() supplies the opening picture, then the
 * real moveVertex/movePoint keep any supplied dots on the board exactly as a
 * drag does. Three distinct, non-collinear corners are needed for a bisector.
 */
function readState(C: Core, args: Json): State {
  const seed = C.start({}) as State;
  const V = readTriple(args, "V", seed.V);
  const P = readTriple(args, "P", seed.P);
  const scale = Math.max(
    1, dist2(V[0], V[1]), dist2(V[1], V[2]), dist2(V[2], V[0]),
  );
  const area2 = (V[1].x - V[0].x) * (V[2].y - V[0].y) - (V[1].y - V[0].y) * (V[2].x - V[0].x);
  if (Math.abs(area2) < 1e-9 * scale) {
    throw new Error("V must be three distinct, non-collinear corners: a flat triangle has no angle bisectors");
  }
  let s = C.start({ mode: readMode(args, seed.mode) }) as State;
  for (let i = 0; i < 3; i++) s = C.moveVertex(s, i, V[i]) as State;
  for (let i = 0; i < 3; i++) s = C.movePoint(s, i, P[i]) as State;
  if (args.trisect !== undefined && args.trisect !== null) {
    if (typeof args.trisect !== "boolean") throw new Error('argument "trisect" must be true or false');
    if (args.trisect) s = C.trisect(s) as State;
  }
  return s;
}

const corners = (s: State) => ({ A: pt(s.V[0]), B: pt(s.V[1]), C: pt(s.V[2]) });
const rayPoints = (s: State) => ({ atA: pt(s.P[0]), atB: pt(s.P[1]), atC: pt(s.P[2]) });

/** The three concurrent triples and the geometry the page draws from them. */
function familiesReading(C: Core, s: State) {
  const families = C.families(s) as Family[];
  const g = C.geometry(s) as Geometry;
  return {
    triangle: corners(s),
    rayPoints: rayPoints(s),
    mode: s.mode,
    highlighted: { lines: LABELS[s.mode], index: s.mode },
    families: families.map((f) => ({
      index: f.index,
      name: f.name,
      lines: LABELS[f.index],
      endpoints: f.lines.map((line) => ({ from: pt(line[0]), to: pt(line[1]) })),
      concurrent: !!f.point,
      meetingPoint: pt(f.point),
    })),
    allThreeConcurrent: families.every((f) => !!f.point),
    mirrorPoints: { U: pt(g.M[0]), V: pt(g.M[1]), W: pt(g.M[2]) },
    cornerAngles_deg: { atA: deg(g.angles[0]), atB: deg(g.angles[1]), atC: deg(g.angles[2]) },
    sentence: C.describe(s) as string,
    note:
      "Each corner's ray is reflected in its angle bisector to give its isogonal partner. The applet claims three triples of the six lines concur; the core intersects them and checks the two crossings agree, returning null when a line is flat or overlapping. The mirror point is pulled back by the ray's length, a harmless quirk of the original code that does not move the line or its concurrency.",
  };
}

/** Lyness's proportion at each corner and the Ceva product of the three ratios. */
function cevaReading(C: Core, s: State) {
  const cv = C.ceva(s) as CevaResult;
  const parts = cv.parts.map((part, j) => ({
    fromCorner: CORNERS[j],
    sideRatio_BSoverSC: part ? maybe(part.ratio) : null,
    lynessPredicted: part ? maybe(part.predicted) : null,
    fractionAlongSide: part ? maybe(part.t) : null,
    agrees: part ? agreesWith(part.ratio, part.predicted) : null,
  }));
  const product = cv.product;
  return {
    triangle: corners(s),
    rayPoints: rayPoints(s),
    parts,
    cyclicProduct: maybe(product),
    productIsOne: product !== null && Math.abs(product - 1) < 1e-6,
    note:
      "Lyness's proportion BS/SC = (cot b - cot B)/(cot g - cot C) is checked at each corner: B and C are the triangle's corner angles, b and g the angles the two isogonal lines make with the sides. The same ratio appears upside down at the next corner, so the three ratios multiply to 1; Ceva's theorem then forces each triple of lines to meet. A null part means the reflected line left its corner and the proportion is undefined there.",
  };
}

const SAMPLE =
  '{ "V": [[180.46937473388832, 43.37028773640289], [123.3508861918203, 195.58954959335378], [264.9391034129076, 112.7819913310947]], "P": [[178.96601708683653, 91.8132063631653], [161.94519408328546, 165.06304070538755], [233.71642806530684, 100.6432530549312]], "mode": 0 }';

export function actions(): GameActions {
  return {
    concurrent_families: {
      describe:
        "For triangle corners V=[A,B,C] and three ray points P (each [x,y] or {x,y} on the illustration's 360 x 260 board, y down; an omitted triple uses the opening picture), reflect each ray in its angle bisector and report the three isogonal triples AP,BQ,CR; AU,BV,CW; PU,QV,RW with the endpoints of every line and the single point where its three lines meet (null if they are flat or overlapping). mode 0/1/2 picks the highlighted family and trisect:true moves each pair a third of the way into its corner; the mirror points, angles and sentence under the picture all come from the page's own core.",
      args: SAMPLE,
      run: (args) => {
        const C = core();
        return familiesReading(C, readState(C, args));
      },
    },
    lyness_ceva: {
      describe:
        "For the same V and P, check Lyness's proportion at each corner: the measured side ratio BS/SC against (cot b - cot B)/(cot g - cot C), where B,C are the corner angles and b,g the angles the two isogonal lines make with the sides. Each ratio returns inverted at the next corner, so the three multiply to 1 and Ceva's theorem forces the concurrence; this reports every ratio, its predicted value, the fraction along the side and the cyclic product (null for a degenerate construction).",
      args: SAMPLE,
      run: (args) => {
        const C = core();
        return cevaReading(C, readState(C, args));
      },
    },
  };
}

const pointOrNull = (v: unknown): Point | null => {
  if (Array.isArray(v) && v.length === 2) {
    const x = Number(v[0]), y = Number(v[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x: r6(x), y: r6(y) } : null;
  }
  if (v && typeof v === "object") {
    const o = v as Json;
    const x = Number(o.x), y = Number(o.y);
    return Number.isFinite(x) && Number.isFinite(y) ? { x: r6(x), y: r6(y) } : null;
  }
  return null;
};

/** Track.state saves the three corners V, the three ray points P and mode. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Concurrency state version ${stateVersion}`);
  const C = core();
  const V = (state.V ?? []) as unknown[];
  const P = (state.P ?? []) as unknown[];
  const rawMode = state.mode === undefined || state.mode === null ? NaN : Number(state.mode);
  const saved = {
    stateVersion,
    V: [0, 1, 2].map((i) => pointOrNull(V[i])),
    P: [0, 1, 2].map((i) => pointOrNull(P[i])),
    mode: Number.isFinite(rawMode) ? rawMode : null,
  };
  try {
    const s = readState(C, state);
    return {
      ...saved,
      mode: s.mode,
      families: familiesReading(C, s),
      ceva: cevaReading(C, s),
      note:
        "Track.state saves the three triangle corners V, the three ray points P and the chosen family mode. The core rebuilds the isogonal mirror points, the three concurrent triples and Lyness's proportion from them, so the saved picture can be checked against the applet's concurrence claim.",
    };
  } catch (e) {
    return {
      ...saved,
      families: null,
      ceva: null,
      note: `The saved position cannot be measured: ${(e as Error).message}`,
    };
  }
}
