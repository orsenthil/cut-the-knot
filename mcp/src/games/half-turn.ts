/*
 * run_game_logic actions and saved-position reader for Half Turn.
 *
 * The real core is half-turn/half-turn-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the applet's 460 x 360 canvas, y down.
 *
 * One half turn about O sends P to 2O - P, so S_O^2 = I and O is its only
 * fixed point. Chaining n of them gives p -> sign*p + t with t = 2(O_n -
 * O_{n-1} + ... +/- O_1): even n is a translation, odd n a half turn about
 * c = t/2. The old page claims "for any n, AA_n = BB_n, AA_n || BB_n"; that
 * holds only for even n, because for odd n the two segments are chords
 * through c of different lengths and directions. See _shared.ts for the
 * shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = {
  n: number; seed: number; a: Point; b: Point; centers: Point[];
  rngState: number; showNames: boolean; showStatement: boolean; moves: number;
};
type Composition = { sign: number; t: Point; center: Point | null };
type Chain = {
  segments: Array<{ start: Point; end: Point }>;
  aPoints: Point[]; bPoints: Point[]; centers: Point[];
};
type Core = {
  N_MIN: number; N_MAX: number; N_DEFAULT: number;
  start(options?: { n?: number; seed?: number }): State;
  move(s: State, m: Json): State | null;
  reflect(p: Point, o: Point): Point;
  compute(s: State): Chain;
  composition(s: State): Composition;
  image(s: State, p: Point): Point;
  result(s: State): unknown;
};

const core = (): Core => cores["half-turn"].HalfTurnCore as unknown as Core;

/* The core is exact up to floating point; only what we print is rounded. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0);
const rp = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const near = (a: number, b: number, tol = 1e-7): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const same = (p: Point, q: Point, tol = 1e-7): boolean => near(p.x, q.x, tol) && near(p.y, q.y, tol);
const vec = (p: Point, q: Point): Point => ({ x: q.x - p.x, y: q.y - p.y });
const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;
const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const len = (v: Point): number => Math.hypot(v.x, v.y);

const numeric = (v: unknown): boolean =>
  (typeof v === "number" || typeof v === "string") && Number.isFinite(Number(v));

/** An action's argument: a required, finite point. */
function point(v: unknown, label: string): Point {
  if (!v || typeof v !== "object") throw new Error(`${label} must be a point with numeric x and y`);
  const p = v as Json;
  if (!numeric(p.x) || !numeric(p.y)) throw new Error(`${label} must be a point with numeric x and y`);
  return { x: Number(p.x), y: Number(p.y) };
}

function intArg(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`${key} must be an integer from ${lo} to ${hi}`);
  }
  return n;
}

/** Build a position from action arguments, applying every change with the real core. */
function buildState(C: Core, args: Json): State {
  const base = C.start({});
  const n = intArg(args, "n", base.n, C.N_MIN, C.N_MAX);
  const seed = intArg(args, "seed", base.seed, 0, 4294967295);
  let s = C.start({ n, seed });
  if (args.a !== undefined && args.a !== null) {
    const next = C.move(s, { type: "point", which: "a", point: point(args.a, "a") });
    if (!next) throw new Error('could not set "a"');
    s = next;
  }
  if (args.b !== undefined && args.b !== null) {
    const next = C.move(s, { type: "point", which: "b", point: point(args.b, "b") });
    if (!next) throw new Error('could not set "b"');
    s = next;
  }
  if (args.centers !== undefined && args.centers !== null) {
    if (!Array.isArray(args.centers) || args.centers.length < n) {
      throw new Error(`"centers" must be an array of at least ${n} points`);
    }
    args.centers.slice(0, n).forEach((raw, i) => {
      const next = C.move(s, {
        type: "point", which: "center", index: i, point: point(raw, `centers[${i}]`),
      });
      if (!next) throw new Error(`could not set centers[${i}]`);
      s = next;
    });
  }
  return s;
}

/** Every core measurement of a chain, shared by the actions and position(). */
function reading(C: Core, s: State): Json {
  const chain = C.compute(s);
  const c = C.composition(s);
  const n = s.n;
  const even = c.sign > 0;
  const an = chain.aPoints[n];
  const bn = chain.bPoints[n];
  const aa = vec(s.a, an);
  const bb = vec(s.b, bn);
  const aaEqualsBb = same(aa, bb);
  const aaParallelBb = Math.abs(cross(aa, bb)) < 1e-7;
  // S_O^2 = I, checked on the first center with a point away from it.
  const o = s.centers[0];
  const probe = { x: s.a.x + 13, y: s.b.y - 7 };
  const involution = same(C.reflect(C.reflect(probe, o), o), probe);
  // The closed form must agree with the applet's step-by-step Compute().
  const imageMatchesChain = same(C.image(s, s.a), an) && same(C.image(s, s.b), bn);
  return {
    n,
    parity: even ? "even" : "odd",
    kind: even ? "translation" : "half-turn",
    sign: c.sign,
    translation: rp(c.t),
    fixedPoint: c.center ? rp(c.center) : null,
    a: rp(s.a),
    b: rp(s.b),
    aN: rp(an),
    bN: rp(bn),
    aa: rp(aa),
    bb: rp(bb),
    aaLength: r6(len(aa)),
    bbLength: r6(len(bb)),
    cross: r6(cross(aa, bb)),
    aaEqualsBb,
    aaParallelBb,
    pageClaimHolds: aaEqualsBb && aaParallelBb,
    chordsMeetAtFixedPoint: even
      ? null
      : same(mid(s.a, an), c.center as Point) && same(mid(s.b, bn), c.center as Point),
    involution,
    imageMatchesChain,
    segments: chain.segments.map((seg, i) => ({ index: i, start: rp(seg.start), end: rp(seg.end) })),
    result: C.result(s),
    note: even
      ? `${n} half turns compose to the translation p -> p + t, with t = ${r6(c.t.x)}, ${r6(c.t.y)}. Both AA${n} and BB${n} equal t, so the page's "AA_n = BB_n, AA_n || BB_n" clause does hold for even n.`
      : `${n} half turns compose to a half turn about c = (${r6(c.center!.x)}, ${r6(c.center!.y)}), so AA${n} and BB${n} are chords through c with different lengths and directions: the page's "for any n, AA_n = BB_n, AA_n || BB_n" fails for odd n, though both lines do pass through c.`,
  };
}

export function actions(): GameActions {
  return {
    composition: {
      describe:
        "Compose n half turns (1 to 10) about the applet's centers with the real core and report the map p -> sign*p + t: for even n it is a translation by t, so AA_n = BB_n; for odd n it is a half turn about the fixed point t/2, so AA_n and BB_n are chords through it that are usually unequal and not parallel. Also checks S_O^2 = I and that the closed form matches the step-by-step chain. Accepts seed, and optionally a, b and centers to override the opening picture.",
      args: '{ "n": 3, "seed": 7 }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args);
        const r = reading(C, s);
        return {
          ...r,
          seed: s.seed,
          centers: s.centers.slice(0, s.n).map(rp),
        };
      },
    },

    odd_counterexample: {
      describe:
        "Pin the maths section's worked odd-n case with the real core: flip the arrow A=(230,120), B=(260,160) about O1=(200,150), O2=(280,200), O3=(240,140). Reports the half-turn center c, A_3, B_3, both segments AA_3 and BB_3 with their lengths and cross product, showing the page's 'for any n, AA_n = BB_n and AA_n || BB_n' is false for odd n while both chords meet at c. Pass a, b or centers to try another odd-n arrangement.",
      args: '{ "a": { "x": 230, "y": 120 }, "b": { "x": 260, "y": 160 }, "centers": [{ "x": 200, "y": 150 }, { "x": 280, "y": 200 }, { "x": 240, "y": 140 }] }',
      run: (args) => {
        const C = core();
        const fixed = {
          a: { x: 230, y: 120 },
          b: { x: 260, y: 160 },
          centers: [{ x: 200, y: 150 }, { x: 280, y: 200 }, { x: 240, y: 140 }],
        };
        const merged: Json = { ...fixed, ...args, n: 3 };
        const s = buildState(C, merged);
        const r = reading(C, s);
        if (r.kind !== "half-turn") throw new Error("the counterexample needs an odd number of half turns");
        const aNExpected = { x: 90, y: 60 };
        const bNExpected = { x: 60, y: 20 };
        const fixedPointExpected = { x: 160, y: 90 };
        return {
          ...r,
          aNExpected,
          bNExpected,
          fixedPointExpected,
          workedMatch:
            same(s.a, fixed.a) && same(s.b, fixed.b) &&
            (s.centers as Point[]).slice(0, 3).every((p, i) => same(p, fixed.centers[i])) &&
            same(r.aN as Point, aNExpected) && same(r.bN as Point, bNExpected) &&
            same(r.fixedPoint as Point, fixedPointExpected),
          note:
            "The three half turns are one half turn about c = (160, 90): A_3 = (90, 60) and B_3 = (60, 20). AA_3 = (-140, -60) has length about 152.3, BB_3 = (-200, -140) has length about 244.1, and their cross product is 7600, so they are neither equal nor parallel: the old page's 'for any n' clause is wrong. Both chords do pass through c, which is the part of the page's statement that is right.",
        };
      },
    },
  };
}

/* Reading a saved position must never throw on a damaged or older record. */

const isSavedPoint = (v: unknown): boolean =>
  !!v && typeof v === "object" && numeric((v as Json).x) && numeric((v as Json).y);

const savedPoint = (v: unknown, fallback: Point): Point => {
  if (!isSavedPoint(v)) return fallback;
  const p = v as Json;
  return { x: Number(p.x), y: Number(p.y) };
};

const savedInt = (v: unknown, fallback: number, lo: number, hi: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
};

const savedBool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

function savedState(C: Core, state: Json): { s: State; readable: boolean } {
  const base = C.start({});
  const n = savedInt(state.n, base.n, C.N_MIN, C.N_MAX);
  const seed = savedInt(state.seed, base.seed, 0, 4294967295);
  const fallback = C.start({ n, seed });
  const a = savedPoint(state.a, fallback.a);
  const b = savedPoint(state.b, fallback.b);
  const raw = state.centers;
  const usableCenters = Array.isArray(raw) && raw.length >= n && raw.every(isSavedPoint);
  const centers: Point[] = usableCenters
    ? (raw as unknown[]).map((p, i) => savedPoint(p, fallback.centers[i % fallback.centers.length]))
    : fallback.centers;
  const s: State = {
    n, seed, a, b, centers,
    rngState: savedInt(state.rngState, fallback.rngState, 0, 4294967295),
    showNames: savedBool(state.showNames, fallback.showNames),
    showStatement: savedBool(state.showStatement, fallback.showStatement),
    moves: Number.isFinite(Number(state.moves)) ? Number(state.moves) : 0,
  };
  const readable = n === Number(state.n) && seed === Number(state.seed) &&
    isSavedPoint(state.a) && isSavedPoint(state.b) && usableCenters;
  return { s, readable };
}

export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Half Turn state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Half Turn position must be an object");
  }
  const C = core();
  const { s, readable } = savedState(C, state);
  const r = reading(C, s);
  return {
    ...state,
    stateVersion,
    savedReadable: readable,
    n: s.n,
    seed: s.seed,
    a: rp(s.a),
    b: rp(s.b),
    centers: s.centers.map(rp),
    rngState: s.rngState,
    showNames: s.showNames,
    showStatement: s.showStatement,
    moves: s.moves,
    result: r.result,
    reading: r,
    note: !readable
      ? "Some saved fields could not be read, so the applet's opening picture was reconstructed and the core reading below comes from it."
      : `Track.state saved the arrow ends A and B, the ${s.centers.length} centers, the spinner n, the seed and the two presentation boxes. The core rebuilds the chain from the first ${s.n} centers: ${r.kind === "translation" ? "an even n gives a translation by t, and AA_n = BB_n" : "an odd n gives a half turn about t/2, and the page's AA_n = BB_n clause fails"}. This is a demonstration with no win or loss, so the tracker just records exploration.`,
  };
}
