/*
 * run_game_logic actions and saved-position reader for Markowsky Parabola.
 *
 * Every number below comes from the game's real core
 * (markowsky-parabola/markowsky-parabola-core.js), copied into
 * src/generated/cores/ at build time. A and B are two dots on the right branch
 * of a parabola with vertex O; OB meets the vertical through A at C, and D is
 * the foot of C on the axis. With O at the origin and the curve y = x²/(4a),
 * C = (p, pq/(4a)) and D = (0, pq/(4a)), so DA and DB have slopes
 * (p−q)/(4a) and (q−p)/(4a): mirror images across the horizontal ray DC,
 * hence ∠ADC = ∠BDC. The applet rounds curve heights to whole pixels, so its
 * two drawn readings differ slightly while the exact curve makes them equal.
 *
 * The page's description line says "ADO and BDE", but its body and the
 * applet's angle marks say ADC and BDC; this port follows the latter. This is
 * the two-dot problem, not Markowsky2 ("Three Points on a Parabola"), which
 * has its own core about three pairwise tangent intersections. See _shared.ts
 * for the module shape; this is a demo, so there is no win or loss.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Options = { names: boolean; statement: boolean; hint: boolean };
type State = { tA: number; tB: number; options: Options; touches: number };
type Segment = { p: Pt; q: Pt };
type Geometry = {
  view: { width: number; height: number };
  O: Pt; Op: Pt; A: Pt; B: Pt; Aprime: Pt; Bprime: Pt;
  directrixY: number; active: boolean;
  C: Pt | null; D: Pt | null; K: Pt | null; M: Pt | null;
  tangentA: Segment | null; tangentB: Segment | null;
};
type Ideal = {
  O: Pt; A: Pt; B: Pt; C: Pt; D: Pt; K: Pt; M: Pt;
  slopeDA: number; slopeDB: number;
};
type StartArgs = { tA?: number | string; tB?: number | string } & Partial<Options>;

interface Core {
  VIEW: { width: number; height: number };
  MIN_T: number; MAX_T: number; START_T: { A: number; B: number };
  A: number; DH: number; DT: number; HALF: number;
  start(options?: StartArgs): State;
  setOffset(state: State, which: "A" | "B" | 1 | 2, value: unknown): State;
  moveVertex(state: State, which: "A" | "B", p: Pt): State;
  setOption(state: State, name: keyof Options, on: boolean): State;
  geometry(state: State): Geometry;
  angle(v: Pt, p: Pt, q: Pt): number;
  readings(state: State): { adc: number; bdc: number; gap: number };
  ideal(tA: number, tB: number): Ideal;
  curvePoint(t: number): Pt;
  parabolaPoints(): Pt[];
  status(state: State): string;
}

const core = (): Core =>
  cores["markowsky-parabola"].MarkowskyParabolaCore as unknown as Core;

const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const r6 = (v: number): number | null => (Number.isFinite(v) ? Number(v.toFixed(6)) : null);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y)
    ? { x: Number(p.x.toFixed(6)), y: Number(p.y.toFixed(6)) }
    : null;

const THEOREM_NOTE =
  "With O at (0, 0) and the curve y = x²/(4a), a = 40, write the offsets of A and B as p and q. " +
  "OB meets the vertical through A = (p, p²/(4a)) at C = (p, pq/(4a)) and D = (0, pq/(4a)) is its foot on the axis, so DC is horizontal. " +
  "The slopes of DA and DB are (p−q)/(4a) and (q−p)/(4a), equal in size and opposite in sign: DC bisects ∠ADB, so ∠ADC = ∠BDC on the exact curve. " +
  "The applet rounds every curve height to a whole pixel, which is why its drawn readings need not match exactly.";
const DOMAIN_NOTE =
  "The claim needs both dots right of the axis with A nearer the vertex (0 < p < q); the core skips the whole construction when the two offsets differ by less than 0.1 or either is 0.";
const CONSTRUCTION_NOTE =
  "The drawing builds C as OB ∩ the vertical through A, D as the foot of C on the axis, K as OA ∩ the vertical through B, and M as the intersection of the tangents at A and B. " +
  "On the exact curve C, D, K and M all have height pq/(4a), and a tangent at offset t has slope t/(2a) (negative in the drawing's downward y). " +
  "Whole-pixel curve heights spread those four drawn heights by a fraction of a pixel and shift M off the exact midpoint by a fraction of a pixel.";
const TYPO_NOTE =
  "The page's description line calls the angles ADO and BDE, but its body and the applet's angle marks say ADC and BDC; this port follows ADC and BDC. " +
  "It is the two-dot problem, not Markowsky2 ('Three Points on a Parabola'), which asks where three pairwise tangent intersections lie.";

/** A slider offset is a whole number in the applet's -250..260 range. */
function readT(C: Core, args: Json, key: "tA" | "tB", fallback: number): number {
  if (args[key] === undefined || args[key] === null) return fallback;
  const n = num(args, key, fallback);
  if (!Number.isInteger(n) || n < C.MIN_T || n > C.MAX_T) {
    throw new Error(`argument "${key}" must be a whole number from ${C.MIN_T} to ${C.MAX_T}`);
  }
  return n;
}

/** The three checkboxes are booleans, exactly as Track.state saves them. */
function readFlag(args: Json, key: string, fallback: boolean): boolean {
  const raw = args[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return raw;
}

/** Start from the core's own picture with validated arguments. */
function makeState(C: Core, args: Json): State {
  if (!isObj(args)) {
    throw new Error("arguments must be an object with optional tA, tB, names, statement and hint");
  }
  const home = C.start({});
  const s = C.start({
    tA: readT(C, args, "tA", home.tA),
    tB: readT(C, args, "tB", home.tB),
    names: readFlag(args, "names", home.options.names),
    statement: readFlag(args, "statement", home.options.statement),
    hint: readFlag(args, "hint", home.options.hint),
  });
  if (!C.geometry(s).active) {
    throw new Error("A and B need different, nonzero offsets (at least 0.1 apart) before the core builds C, D, K and M");
  }
  return s;
}

/** Both readings of one picture: the drawn pixels and the exact parabola. */
function reading(C: Core, s: State) {
  const g = C.geometry(s);
  const r = C.readings(s);
  const ex = C.ideal(s.tA, s.tB);
  const idealAdc = C.angle(ex.D, ex.A, ex.C);
  const idealBdc = C.angle(ex.D, ex.B, ex.C);
  const slopeOf = (line: Segment | null): number | null =>
    line ? (line.q.y - line.p.y) / (line.q.x - line.p.x) : null;

  let construction: Json | null = null;
  if (g.active && g.C && g.D && g.K && g.M && g.tangentA && g.tangentB) {
    const levels = [g.C.y, g.D.y, g.K.y, g.M.y];
    const spread = Math.max(...levels) - Math.min(...levels);
    const drawnSlopeA = slopeOf(g.tangentA)!;
    const drawnSlopeB = slopeOf(g.tangentB)!;
    const expectA = -s.tA / (2 * C.A);
    const expectB = -s.tB / (2 * C.A);
    construction = {
      C: pt(g.C), D: pt(g.D), K: pt(g.K), M: pt(g.M),
      footOnAxis: Math.abs(g.D.x - g.O.x) < 1e-9,
      dcHorizontal: Math.abs(g.D.y - g.C.y) < 1e-9,
      drawnYs: { C: r6(g.C.y), D: r6(g.D.y), K: r6(g.K.y), M: r6(g.M.y) },
      drawnLevelSpread: r6(spread),
      drawnExactlyLevel: spread < 1e-9,
      idealYs: { C: r6(ex.C.y), D: r6(ex.D.y), K: r6(ex.K.y), M: r6(ex.M.y) },
      idealLevel: r6(ex.C.y),
      idealLevelInDrawingY: r6(g.O.y - ex.C.y),
      drawnFootLevel: r6(g.D.y),
      pixelLevelError: r6(g.D.y - (g.O.y - ex.C.y)),
      tangentSlopesDrawn: { A: r6(drawnSlopeA), B: r6(drawnSlopeB) },
      tangentSlopesExpected: { A: r6(expectA), B: r6(expectB) },
      tangentSlopesMatch: Math.abs(drawnSlopeA - expectA) < 1e-12 &&
        Math.abs(drawnSlopeB - expectB) < 1e-12,
      idealMidpointMInDrawing: pt({ x: C.HALF + ex.M.x, y: g.O.y - ex.M.y }),
      drawnM: pt(g.M),
    };
  }

  return {
    active: g.active,
    tA: s.tA, tB: s.tB,
    inStatedDomain: s.tA > 0 && s.tB > s.tA,
    board: {
      view: g.view, O: pt(g.O), A: pt(g.A), B: pt(g.B),
      Aprime: pt(g.Aprime), Bprime: pt(g.Bprime), directrixY: g.directrixY,
    },
    drawnAngles: {
      ADC: r6(r.adc), BDC: r6(r.bdc), gap: r6(r.gap),
      equalAtWholePixels: Number.isFinite(r.gap) && r.gap < 1e-9,
    },
    exactCurve: {
      O: pt(ex.O), A: pt(ex.A), B: pt(ex.B), C: pt(ex.C),
      D: pt(ex.D), K: pt(ex.K), M: pt(ex.M),
      slopes: { DA: r6(ex.slopeDA), DB: r6(ex.slopeDB) },
      slopesAreOpposites: Math.abs(ex.slopeDA + ex.slopeDB) < 1e-12,
      ADC: r6(idealAdc), BDC: r6(idealBdc), gap: r6(Math.abs(idealAdc - idealBdc)),
      anglesEqual: Math.abs(idealAdc - idealBdc) < 1e-9,
    },
    construction,
    checkboxes: { ...s.options },
    status: C.status(s),
  };
}

const ANGLE_ARGS = '{ "tA": 82, "tB": 180 }';
const FOOT_ARGS = '{ "tA": 80, "tB": 180, "hint": true }';

export function actions(): GameActions {
  return {
    equal_angles: {
      describe:
        "Give the two slider offsets tA and tB (whole numbers from -250 to 260; the example is the saved 82 and 180). With both dots right of the axis and A nearer the vertex, the core rebuilds the pixel-drawn picture and measures ∠ADC and ∠BDC at the foot D, then measures the same angles on the exact parabola y = x²/(4a) and checks that DA and DB have opposite slopes, so DC bisects ∠ADB. The note explains that the page's ADO/BDE is a typo for ADC/BDC and that this is not Markowsky2.",
      args: ANGLE_ARGS,
      run: (args) => {
        const C = core();
        const s = makeState(C, args);
        return {
          focus: "equal angles",
          ...reading(C, s),
          note: THEOREM_NOTE + " " + DOMAIN_NOTE + " " + TYPO_NOTE,
        };
      },
    },

    d_foot_construction: {
      describe:
        "Give tA and tB (whole offsets -250 to 260; the example uses the starting 80 and 180, with hint on). The core builds C as OB ∩ the vertical through A, drops the foot D on the axis, and builds K from OA and M from the two tangents; the report checks that D is level with C, measures the drawn spread of the four heights against the exact common height pq/(4a), and verifies the tangent slopes t/(2a). This is the two-dot Markowsky Parabola, not the three-point Markowsky2.",
      args: FOOT_ARGS,
      run: (args) => {
        const C = core();
        const s = makeState(C, args);
        return {
          focus: "D foot construction",
          ...reading(C, s),
          note: CONSTRUCTION_NOTE + " " + DOMAIN_NOTE + " " + TYPO_NOTE,
        };
      },
    },
  };
}

/** Echo Track's saved fields, then re-measure the same picture with the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Markowsky Parabola state version ${stateVersion}`);
  if (!isObj(state)) throw new Error("saved Markowsky Parabola position must be an object");
  const C = core();
  const opts = isObj(state.options) ? state.options : ({} as Json);
  const rawTouches = state.touches;
  const touches = rawTouches === undefined || rawTouches === null ? 0 : num(state, "touches", 0);
  if (!Number.isInteger(touches) || touches < 0) {
    throw new Error('saved field "touches" must be a nonnegative whole number');
  }
  const saved = C.start({
    tA: readT(C, state, "tA", C.START_T.A),
    tB: readT(C, state, "tB", C.START_T.B),
    names: readFlag(opts, "names", false),
    statement: readFlag(opts, "statement", false),
    hint: readFlag(opts, "hint", false),
  });
  return {
    stateVersion,
    tA: saved.tA, tB: saved.tB,
    options: { ...saved.options },
    touches,
    reading: reading(C, saved),
    note:
      "Track.state saved the two slider offsets tA and tB, the names/statement/hint checkboxes and the touch count; " +
      "the core rebuilds the drawing from those offsets and reports both the pixel-rounded angle marks and the exact " +
      "curve's equal angles and level C, D, K, M. " + THEOREM_NOTE + " " + TYPO_NOTE,
  };
}
