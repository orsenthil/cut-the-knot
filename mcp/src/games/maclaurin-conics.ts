/*
 * run_game_logic actions and saved-position reader for Mac Laurin Conics.
 *
 * The real core is maclaurin-conics/maclaurin-conics-core.js, copied verbatim
 * into src/generated/cores/ at build time; every number below comes from it.
 *
 * A triangle ABC has B sliding on a line l and C sliding on a line m, with the
 * side BC kept through a fixed point W. The other two sides are kept through
 * fixed points U (on AB) and V (on AC), so choosing B fixes C = (BW) ∩ m and
 * then A = (BU) ∩ (CV). Maclaurin's observation is that A traces a conic as B
 * runs along l; when U, V and W become collinear the conic degenerates into a
 * straight line through the crossing l ∩ m. The page's "Show extra lines"
 * draws WU ∩ l, WV ∩ m and l ∩ m to make that crossing visible.
 *
 * Both actions rebuild the page's board from the fields Track.state saved,
 * then move B with the core's own move() so its glider fix-ups, its |det| < 1
 * guard and its one-unit trace filter are exercised. This is an illustration:
 * there is no win or loss, only a verdict from classify(). See _shared.ts for
 * the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Line = { p: Pt; q: Pt };
type State = {
  width: number;
  height: number;
  coef: number;
  ends: Pt[][];
  B: Pt;
  C: Pt;
  U: Pt;
  V: Pt;
  W: Pt;
  names: boolean;
  extra: boolean;
  collect: boolean;
  explored: boolean;
  trace: Pt[];
};
type Geometry = {
  l: Line;
  m: Line;
  sides: Line[];
  X: Pt;
  extraLines: Line[];
  extraPoints: Pt[];
  lCapM: Pt;
};
type Verdict = {
  kind: "conic" | "line";
  degenerate: boolean;
  passes: boolean;
  maxResidual: number;
  discriminant?: number;
  through?: Pt;
  count: number;
};
type Fit = { maxResidual: number; discriminant: number };

interface Core {
  VIEW: { width: number; height: number };
  COEF: number;
  HANDLES: string[];
  start(options?: Partial<State>): State;
  compute(s: State): Geometry;
  move(s: State, who: string, p: Pt): State;
  legalMoves(): string[];
  result(): null;
  position(s: State): {
    ends: Pt[][];
    B: Pt;
    C: Pt;
    U: Pt;
    V: Pt;
    W: Pt;
    names: boolean;
    extra: boolean;
    trace: Pt[];
  };
  classify(s: State): Verdict;
  describe(s: State): string;
  createMidPoint(l: Line, t: number): Pt;
  intersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt;
  nearestPoint(p: Pt, l: Line): Pt;
  clearTrace(s: State): State;
  withTrace(s: State): State;
  straightLinePreset(s: State): State;
  collinear(a: Pt, b: Pt, c: Pt): boolean;
  dist(a: Pt, b: Pt): number;
  pointLineDistance(p: Pt, a: Pt, b: Pt): number;
  fitConic(points: Pt[]): Fit | null;
}

const core = (): Core =>
  cores["maclaurin-conics"].MaclaurinConicsCore as unknown as Core;

/* Round for the tutor; non-finite values become null so output stays JSON. */
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const numOrNull = (v: number | undefined): number | null =>
  v === undefined || !Number.isFinite(v) ? null : r6(v);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: r6(p.x), y: r6(p.y) }
    : null;
const copyPt = (p: Pt): Pt => ({ x: p.x, y: p.y });
const isObj = (v: unknown): v is Json =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** A saved point as { x, y } or [x, y], with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return copyPt(fallback);
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (isObj(raw)) {
    [x, y] = [Number(raw.x), Number(raw.y)];
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** The two given lines, each a pair of draggable ends. */
function readEnds(raw: unknown, fallback: Pt[][]): Pt[][] {
  if (raw === undefined || raw === null) return fallback.map((pair) => pair.map(copyPt));
  if (!Array.isArray(raw) || raw.length !== 2) {
    throw new Error('argument "ends" must be two lines: [[p, q], [p, q]]');
  }
  return raw.map((pair, i) => {
    if (!Array.isArray(pair) || pair.length !== 2) {
      throw new Error(`ends[${i}] must be [p, q]`);
    }
    return pair.map((p, j) => readPoint(p, `ends[${i}][${j}]`));
  });
}

/** The traced A positions the page saved (up to 24 of them). */
function readTrace(raw: unknown, fallback: Pt[]): Pt[] {
  if (raw === undefined || raw === null) return fallback.map(copyPt);
  if (!Array.isArray(raw)) throw new Error('argument "trace" must be an array of points');
  if (raw.length > 200) throw new Error('argument "trace" may hold at most 200 points');
  return raw.map((p, i) => readPoint(p, `trace[${i}]`));
}

/** How many positions of B to try while tracing the locus. */
function sampleCount(args: Json): number {
  const n = num(args, "samples", 16);
  if (!Number.isInteger(n) || n < 6 || n > 24) {
    throw new Error('argument "samples" must be a whole number from 6 to 24');
  }
  return n;
}

/**
 * Rebuild the core state from the page's saved fields, falling back to the
 * applet's start position for anything omitted. The board size is not itself
 * saved, so width/height may be given explicitly and default to 400 x 300.
 */
function buildState(C: Core, args: Json): State {
  if (!isObj(args)) throw new Error("arguments must be an object of saved board fields");
  const width = num(args, "width", C.VIEW.width);
  const height = num(args, "height", C.VIEW.height);
  if (width < 50 || width > 5000 || height < 50 || height > 5000) {
    throw new Error('"width" and "height" must each be between 50 and 5000');
  }
  const seed = C.start({ width, height });
  return {
    ...seed,
    ends: readEnds(args.ends, seed.ends),
    B: readPoint(args.B, "B", seed.B),
    C: readPoint(args.C, "C", seed.C),
    U: readPoint(args.U, "U", seed.U),
    V: readPoint(args.V, "V", seed.V),
    W: readPoint(args.W, "W", seed.W),
    names: args.names === undefined ? seed.names : args.names === true,
    extra: args.extra === undefined ? seed.extra : args.extra === true,
    trace: readTrace(args.trace, seed.trace),
    collect: true,
  };
}

/* Keep the sweep away from the board's edges, where A can run far off-screen. */
const FROM = 0.15;
const TO = 0.72;

/** Slide B along l with the core, letting it fix C and collect A each step. */
function slideB(C: Core, s: State, count: number): State {
  const l = { p: s.ends[0][0], q: s.ends[0][1] };
  let cur = s;
  for (let i = 0; i < count; i++) {
    const t = FROM + (TO - FROM) * i / Math.max(1, count - 1);
    cur = C.move(cur, "B", C.createMidPoint(l, t));
  }
  return cur;
}

const verdictShape = (v: Verdict) => ({
  kind: v.kind,
  degenerate: v.degenerate,
  passes: v.passes,
  maxResidual: numOrNull(v.maxResidual),
  discriminant: numOrNull(v.discriminant),
  through: pt(v.through),
  count: v.count,
});

/** The first few on-board traced positions, enough to see the shape. */
const pathOf = (trace: Pt[], width: number, height: number) =>
  trace
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height)
    .slice(0, 8)
    .map(pt);

const FIXTURE_ARGS =
  '{"ends":[[{"x":244,"y":0},{"x":200,"y":300}],[{"x":0,"y":150},{"x":400,"y":150}]],' +
  '"B":[231.048387,88.306452],"C":[120,150],"U":[100,75],"V":[300,75],' +
  '"W":[-31.2,234],"names":true,"extra":false,"samples":16}';

export function actions(): GameActions {
  return {
    maclaurin_locus: {
      describe:
        "Maclaurin's construction: with B sliding on l, C kept on m so that BC passes through W, and the other sides through U and V, the vertex A = (BU) ∩ (CV) traces a conic. Pass the saved board fields (ends, B, C, U, V, W, names, extra) with U, V, W not collinear and optional samples (6-24, default 16); the action rebuilds the real core, slides B along l with move(), fits and classifies the traced A positions, and reports the conic's discriminant. It also checks that A is the core's intersection of BU and CV and that C lies on BW. The example uses the positions saved by the live fixture.",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        if (C.collinear(s.U, s.V, s.W)) {
          throw new Error("U, V and W are collinear here: use degenerate_line for that case");
        }
        const count = sampleCount(args);
        const g = C.compute(s);
        const swept = slideB(C, s, count);
        const verdict = C.classify(swept);
        const fit = C.fitConic(swept.trace);
        const apex = C.intersect(s.B, s.U, s.C, s.V);
        const disc = fit ? fit.discriminant : undefined;
        return {
          board: { width: s.width, height: s.height },
          fixed: {
            ends: s.ends.map((pair) => pair.map(pt)),
            U: pt(s.U), V: pt(s.V), W: pt(s.W),
          },
          start: { B: pt(s.B), C: pt(s.C), A: pt(g.X) },
          crossingLM: pt(g.lCapM),
          collinearUVW: false,
          samples: count,
          slideFractionOnL: [FROM, TO],
          traced: swept.trace.length,
          apexFromBUCV: pt(apex),
          apexAgrees: pt(apex) !== null && pt(g.X) !== null
            && C.dist(apex, g.X) < 1e-6,
          distanceOfCfromBW: numOrNull(C.pointLineDistance(s.C, s.B, s.W)),
          classification: verdictShape(verdict),
          fitResidual: numOrNull(fit ? fit.maxResidual : undefined),
          conicType: disc === undefined ? null
            : disc < 0 ? "ellipse" : disc > 0 ? "hyperbola" : "parabola",
          path: pathOf(swept.trace, s.width, s.height),
          status: C.describe(swept),
          result: C.result(),
          note:
            `B was moved to ${count} positions between ${FROM} and ${TO} of the way along l; ` +
            `the core's move() kept C = (BW) ∩ m and collected A = (BU) ∩ (CV). ` +
            `${verdict.count} of those positions survive the core's board filter, and ` +
            (verdict.passes
              ? `they fit a ${verdict.kind} with residual ${numOrNull(verdict.maxResidual)} ` +
                `(discriminant ${numOrNull(verdict.discriminant)}), confirming Maclaurin's conic.`
              : `there are not yet enough spread-out positions for a reliable fit; drag B farther.`),
        };
      },
    },

    degenerate_line: {
      describe:
        "When the three fixed points U, V, W are collinear, Maclaurin's conic collapses to a straight line through the crossing l ∩ m. The action applies the page's straight-line preset (which puts U, V at their default spots and W at BC ∩ UV, keeping B and C), then slides B with the real core and calls classify() to check that every traced A lies on that line through l ∩ m. Accepts the saved board fields and optional samples (6-24, default 16).",
      args: FIXTURE_ARGS,
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const straight = C.straightLinePreset(s);
        if (!C.collinear(straight.U, straight.V, straight.W)) {
          throw new Error("the preset could not make U, V and W collinear");
        }
        const count = sampleCount(args);
        const crossing = C.compute(straight).lCapM;
        const swept = slideB(C, straight, count);
        const verdict = C.classify(swept);
        const through = verdict.through ?? crossing;
        return {
          board: { width: straight.width, height: straight.height },
          fixed: {
            ends: straight.ends.map((pair) => pair.map(pt)),
            U: pt(straight.U), V: pt(straight.V), W: pt(straight.W),
          },
          crossingLM: pt(crossing),
          collinearUVW: true,
          samples: count,
          slideFractionOnL: [FROM, TO],
          traced: swept.trace.length,
          verdict: verdictShape(verdict),
          lineThrough: pt(through),
          passesThroughCrossing: Number.isFinite(through.x) && Number.isFinite(through.y)
            && C.dist(through, crossing) < 1e-6,
          maxDistanceFromLine: numOrNull(verdict.maxResidual),
          path: pathOf(swept.trace, straight.width, straight.height),
          status: C.describe(swept),
          result: C.result(),
          note:
            `With U, V, W on one line the core puts W at BC ∩ UV and keeps B and C fixed. ` +
            `After sliding B to ${count} positions along l, ${verdict.count} A positions were traced; ` +
            (verdict.passes
              ? `all lie within ${numOrNull(verdict.maxResidual)} units of the line through l ∩ m = ${JSON.stringify(pt(crossing))}, the degenerate conic.`
              : `too few spread-out positions were traced to confirm the line; drag B farther.`),
        };
      },
    },
  };
}

/** Echo what Track.state saved, then re-measure the picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Mac Laurin Conics state version ${stateVersion}`);
  }
  if (!isObj(state)) throw new Error("saved Mac Laurin Conics position must be an object");
  const C = core();
  const s = buildState(C, state);
  const g = C.compute(s);
  const verdict = C.classify(s);
  const apex = C.intersect(s.B, s.U, s.C, s.V);
  const apexPt = pt(apex);
  const aPt = pt(g.X);
  return {
    stateVersion,
    saved: {
      ends: s.ends.map((pair) => pair.map(pt)),
      B: pt(s.B), C: pt(s.C), U: pt(s.U), V: pt(s.V), W: pt(s.W),
      names: s.names, extra: s.extra,
      trace: s.trace.map(pt),
    },
    board: { width: s.width, height: s.height },
    A: aPt,
    apexFromBUCV: apexPt,
    apexAgrees: apexPt !== null && aPt !== null && C.dist(apex, g.X) < 1e-6,
    crossingLM: pt(g.lCapM),
    extraPoints: {
      WU_on_l: pt(g.extraPoints[0]),
      WV_on_m: pt(g.extraPoints[1]),
    },
    collinearUVW: C.collinear(s.U, s.V, s.W),
    distanceOfCfromBW: numOrNull(C.pointLineDistance(s.C, s.B, s.W)),
    driftOfBfromL: numOrNull(C.dist(s.B, C.nearestPoint(s.B, g.l))),
    driftOfCfromM: numOrNull(C.dist(s.C, C.nearestPoint(s.C, g.m))),
    classification: verdictShape(verdict),
    status: C.describe(s),
    result: C.result(),
    note:
      "Track.state saved the two given lines' four ends, the gliders B and C, the fixed points " +
      "U, V and W, the two display flags and the recent traced A positions in the page's " +
      "400 x 300 board units. The core rebuilds A = (BU) ∩ (CV), the crossing l ∩ m and the " +
      "other Pascal points, checks that C = (BW) ∩ m and says whether the traced path is a " +
      "conic or the straight line through l ∩ m. This is an illustration with no win or loss.",
  };
}
