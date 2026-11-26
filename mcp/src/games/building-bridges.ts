/*
 * run_game_logic actions and saved-position reader for Building Bridges.
 *
 * The core lives in building-bridges/ and is copied into src/generated/cores/
 * at build time. The illustration has no win condition: the player drags the
 * towns, the river banks and the two bridge points C and C''. The one idea is
 * translation: each bridge is a fixed vector, so sliding A across the first
 * river (A' = A + d0) and B back across the second (B' = B - d1) turns the
 * problem into joining A' to B' by a straight land path.
 * See _shared.ts for the shape of a game module.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["building-bridges"].BuildingBridgesCore;
type Core = ReturnType<typeof core>;
type Pt = { x: number; y: number };
type Bank = { a: Pt; b: Pt };
type River = { upper: Bank; lower: Bank; coef: number };
type Diagram = { width: number; height: number; random: number; A: Pt; B: Pt; rivers: River[] };

const r2 = (v: number) => Math.round(v * 100) / 100;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r2(p.x), y: r2(p.y) } : null;

/** A point may be written [x, y] or {x, y}; both are checked. */
function readPoint(value: unknown, name: string): Pt {
  let a: unknown, b: unknown;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`${name} must be [x, y]`);
    [a, b] = value;
  } else if (value && typeof value === "object") {
    const o = value as Json;
    a = o.x;
    b = o.y;
  } else {
    throw new Error(`${name} must be [x, y] or {x, y}`);
  }
  const x = Number(a), y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${name} must have finite x and y`);
  return { x, y };
}

function readBank(value: unknown, name: string): Bank {
  if (!value || typeof value !== "object") throw new Error(`${name} must have a and b`);
  const o = value as Json;
  const a = readPoint(o.a, `${name}.a`), b = readPoint(o.b, `${name}.b`);
  if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-9) throw new Error(`${name} needs two different ends`);
  return { a, b };
}

/** coef is the player's bridge position along a bank, as on the page. */
function readCoef(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < -0.25 || n > 1.25) {
    throw new Error("coef must be a fraction of the bank from -0.25 to 1.25");
  }
  return n;
}

function readRivers(value: unknown, fallback: River[], args: Json): River[] {
  if (value === undefined || value === null) {
    return fallback.map((r, i) => ({ ...r, coef: readCoef(args[`coef${i}`], r.coef) }));
  }
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error("rivers must be an array of exactly two rivers");
  }
  return value.map((r, i) => {
    if (!r || typeof r !== "object") throw new Error(`rivers[${i}] must have upper and lower banks`);
    const o = r as Json;
    return {
      upper: readBank(o.upper, `rivers[${i}].upper`),
      lower: readBank(o.lower, `rivers[${i}].lower`),
      coef: readCoef(args[`coef${i}`], readCoef(o.coef, fallback[i].coef)),
    };
  });
}

/**
 * Build the diagram the core draws. Actions are strict about their arguments;
 * a saved position falls back field by field so a dragged-away diagram is
 * still described instead of throwing.
 */
function makeState(args: Json, strict: boolean): Diagram {
  const C = core();
  const initial = C.start({}) as Diagram;
  const width = num(args, "width", initial.width);
  const height = num(args, "height", initial.height);
  if (width < 40 || height < 40) throw new Error("width and height must be at least 40");
  const random = num(args, "random", initial.random);
  if (random < 0 || random > 1) throw new Error("random must be between 0 and 1");
  const base = C.start({ width, height, random }) as Diagram;
  const point = (key: string, fallback: Pt, name: string): Pt => {
    if (args[key] === undefined) return fallback;
    try { return readPoint(args[key], name); }
    catch (err) { if (strict) throw err; return fallback; }
  };
  let rivers: River[];
  try { rivers = readRivers(args.rivers, base.rivers, args); }
  catch (err) { if (strict) throw err; rivers = base.rivers; }
  const s = C.start({
    position: {
      width, height, random,
      A: point("A", base.A, "A"),
      B: point("B", base.B, "B"),
      rivers,
    },
  }) as Diagram;
  if (strict && !C.valid(s)) {
    throw new Error("This drawing does not make sense: keep both towns outside the rivers and the two rivers apart.");
  }
  return s;
}

/** Everything the core can tell us about one diagram. */
function reading(s: Diagram) {
  const C: Core = core();
  const g = C.geometry(s);
  const ok = Boolean(C.valid(s, g));
  const claims = C.claims(s, g) as Record<string, boolean>;
  const attempt = C.attempt(s, g);
  const route = C.route(s, g) as Pt[];
  const crossWithDirection = (from: Pt, to: Pt): number =>
    Number(C.cross(C.sub(to, from), g.v).toExponential(3));
  const land = ok && route.length === 6 && route.every((p) => C.finite(p))
    ? [
        { name: "AC", from: pt(route[0]), to: pt(route[1]), crossWithDirection: crossWithDirection(route[0], route[1]) },
        { name: "C'C''", from: pt(route[2]), to: pt(route[3]), crossWithDirection: crossWithDirection(route[2], route[3]) },
        { name: "C'''B", from: pt(route[4]), to: pt(route[5]), crossWithDirection: crossWithDirection(route[4], route[5]) },
      ]
    : null;
  const shortest = ok ? C.shortestLength(s, g) as number : null;
  const yours = ok ? C.attemptLength(s, g) as number : null;
  return {
    drawingValid: ok,
    bridgeVectors: {
      first: pt(g.d0), second: pt(g.d1),
      widths: ok ? [r2(C.dist(g.d0, { x: 0, y: 0 })), r2(C.dist(g.d1, { x: 0, y: 0 }))] : null,
    },
    translatedTowns: ok ? { Aprime: pt(g.Aprime), Bprime: pt(g.Bprime), direction: pt(g.v) } : null,
    optimalBridges: ok ? {
      first: { name: "CC'", upper: pt(g.KU0), lower: pt(g.KL0), vector: pt(g.d0) },
      second: { name: "C''C'''", upper: pt(g.KU1), lower: pt(g.KL1), vector: pt(g.d1) },
    } : null,
    landSegments: land,
    playerBridges: {
      coef0: s.rivers[0].coef, coef1: s.rivers[1].coef,
      C: pt(attempt.C0), Cprime: pt(attempt.Cp0),
      CdoublePrime: pt(attempt.C1), CtriplePrime: pt(attempt.Cp1),
    },
    yourLandSegments: ok ? [
      { name: "A to C", from: pt(s.A), to: pt(attempt.C0) },
      { name: "C' to C''", from: pt(attempt.Cp0), to: pt(attempt.C1) },
      { name: "C''' to B", from: pt(attempt.Cp1), to: pt(s.B) },
    ] : null,
    yourLandSegmentsParallel: ok ? [
      [s.A, attempt.C0], [attempt.Cp0, attempt.C1], [attempt.Cp1, s.B],
    ].every(([from, to]) => {
      const u = C.sub(to as Pt, from as Pt);
      return Math.abs(C.cross(u, g.v)) <= 1e-6 * Math.hypot(u.x, u.y) * Math.hypot(g.v.x, g.v.y);
    }) : null,
    shortestLength: shortest === null ? null : r2(shortest),
    yourRoadLength: yours === null ? null : r2(yours),
    shortestRouteLength: ok ? r2(C.pathLength(route)) : null,
    difference: shortest === null || yours === null ? null : r2(yours - shortest),
    claims,
    note: ok
      ? "A' = A + d0 and B' = B - d1, where d0 and d1 are the fixed bridge vectors. The straight line A'B' fixes both bridges; the three land pieces are parallel to A'B', so their cross products with that direction are 0. The shortest road is |A'B'| plus the two bridge widths, and no placement of C or C'' can beat it."
      : "This drawing does not describe the puzzle: keep both towns outside the rivers and the two rivers apart, then the construction and its claims can be read.",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For two towns and two rivers, give both bridge vectors, the translated towns A' = A + d0 and B' = B - d1, the two optimal bridge placements, the three land pieces of the shortest road and every claim on the page, including AC || C'C'' || C'''B. Rivers may be omitted for the standard diagram, or given as two {upper:{a,b},lower:{a,b}} strips; towns may be [x, y] or {x, y}.",
      args: '{ "A": [103, 85], "B": [300, 265] }',
      run: (args) => reading(makeState(args, true)),
    },
    compare_roads: {
      describe:
        "Compare the road through the two draggable bridge points C and C'' with the shortest road. coef0 and coef1 put those points along each river's upper bank (0 = left end, 1 = right end); the result gives both road lengths, their four bridge ends and whether the three land pieces are parallel on the straight dashed line A'B'.",
      args: '{ "A": [103, 85], "B": [300, 265], "coef0": 0.35, "coef1": 0.65 }',
      run: (args) => {
        const s = makeState(args, true);
        const r = reading(s);
        return {
          coef0: s.rivers[0].coef, coef1: s.rivers[1].coef,
          yourBridgeEnds: r.playerBridges,
          shortestBridgeEnds: r.optimalBridges,
          yourRoadLength: r.yourRoadLength,
          shortestLength: r.shortestLength,
          difference: r.difference,
          yourLandSegments: r.yourLandSegments,
          yourLandSegmentsParallel: r.yourLandSegmentsParallel,
          shortestLandSegmentsParallel: r.claims.landSegmentsParallel,
          note: "The two bridges have fixed lengths, so only the land parts can change. The shortest road's three land pieces are parallel (cross products 0); yours line up only when C and C'' sit at the optimal crossings on the dashed line A'B'.",
        };
      },
    },
  };
}

/** Describe the position the page saved with window.Track.state(state). */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Building Bridges state version ${stateVersion}`);
  const s = makeState(state, false);
  return {
    stateVersion,
    width: s.width, height: s.height, random: s.random,
    A: pt(s.A), B: pt(s.B),
    rivers: s.rivers.map((r) => ({
      upper: { a: pt(r.upper.a), b: pt(r.upper.b) },
      lower: { a: pt(r.lower.a), b: pt(r.lower.b) },
      coef: r.coef,
    })),
    ...reading(s),
  };
}
