/*
 * run_game_logic actions and saved-position reader for Escher's Theorem.
 *
 * The real core is eschers-theorem/eschers-theorem-core.js, copied into
 * src/generated/cores/ at build time. Aq, Bq, Cq are the fixed corners of an
 * equilateral triangle (the centroids of the Napoleon triangles on ABC). Pick
 * B anywhere; a +120-degree turn about Aq gives C and a +120-degree turn about
 * Bq gives A, and the third turn about Cq comes out at 120 degrees by itself.
 * The hexagon A C' B A' C B' then tiles the plane by 120-degree rotations, and
 * AA', BB', CC' concur (Kiepert's theorem). All three turns must go the same
 * way round: flipping one destroys the concurrence. This is Rigby's
 * Napoleon-hexagon result, NOT the side-ratio applet Escher Ceva Menelaus.
 *
 * Every number below is measured by the core; coordinates are the page's
 * 640 x 420 viewBox units with y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["eschers-theorem"].EschersTheoremCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Options = { names: boolean; angles: boolean; concurrency: boolean; tessellation: boolean; hint: boolean };
type State = {
  A: Point; B: Point; C: Point;
  Aq: Point; Bq: Point; Cq: Point;
  Ap: Point | null; Bp: Point | null; Cp: Point | null;
  F: Point | null; crosses: Point[] | null;
  options: Options;
};
type Derived = { Ap: Point; Bp: Point; Cp: Point; F: Point; crosses: Point[] };

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : r6(v);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const pts = (v: (Point | null)[]): (Point | null)[] => v.map(pt);
const deg = (rad: number): number | null => maybe((rad * 180) / Math.PI);
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);
const near = (a: number, b: number, tol = 1e-8): boolean =>
  Number.isFinite(a) && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** The largest gap between the three pairwise crossings of AA', BB', CC'. */
function spread(points: (Point | null)[]): number {
  const good = points.filter((p): p is Point => !!p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (good.length < 2) return NaN;
  let m = 0;
  for (let i = 0; i < good.length; i++) {
    for (let j = i + 1; j < good.length; j++) m = Math.max(m, dist(good[i], good[j]));
  }
  return m;
}

/** Concurrence is decided relative to the scale of the crossings, which may be far off-screen. */
function concurrent(points: (Point | null)[]): boolean {
  const sp = spread(points);
  if (!Number.isFinite(sp)) return false;
  const scale = points.reduce(
    (m, p) => (p && Number.isFinite(p.x) && Number.isFinite(p.y)
      ? Math.max(m, Math.abs(p.x), Math.abs(p.y)) : m), 1);
  return sp <= 1e-6 * scale;
}

/** Accept the page's saved {x, y} points and short [x, y] tool arguments alike. */
function readPoint(raw: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (raw !== null && typeof raw === "object") {
    const o = raw as Json;
    x = num(o, "x", NaN); y = num(o, "y", NaN);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${label}" is not a finite point`);
  return { x, y };
}

/** start() gives the opening picture; an optional drag of one vertex rebuilds the other two. */
function readState(K: Core, args: Json): State {
  const seed = K.start({}) as State;
  const rawWhich = args.which;
  let which = "B";
  if (rawWhich !== undefined && rawWhich !== null) {
    if (typeof rawWhich !== "string") throw new Error('argument "which" must be "A", "B" or "C"');
    which = rawWhich.toUpperCase();
    if (which !== "A" && which !== "B" && which !== "C") {
      throw new Error('argument "which" must be "A", "B" or "C"');
    }
  }
  const rawPoint = args.point;
  if (rawPoint === undefined || rawPoint === null) return seed;
  return K.adjust(seed, which, readPoint(rawPoint, "point")) as State;
}

/** Rebuild a state from the fields Track.state actually saves. */
function readSavedState(K: Core, state: Json): State {
  const s = {
    A: readPoint(state.A, "A"), B: readPoint(state.B, "B"), C: readPoint(state.C, "C"),
    Aq: readPoint(state.Aq, "Aq"), Bq: readPoint(state.Bq, "Bq"), Cq: readPoint(state.Cq, "Cq"),
  };
  const seed = K.start({}) as State;
  return { ...s, Ap: null, Bp: null, Cp: null, F: null, crosses: null, options: seed.options };
}

/** The three page claims, each measured by the core. */
function reading(K: Core, s: State) {
  const q = [s.Aq, s.Bq, s.Cq];
  const fixedSides = [dist(q[0], q[1]), dist(q[1], q[2]), dist(q[2], q[0])];
  const fixedAngles = [
    deg(K.angleAt(q[1], q[0], q[2])),
    deg(K.angleAt(q[2], q[1], q[0])),
    deg(K.angleAt(q[0], q[2], q[1])),
  ];
  const fixedIsEquilateral = fixedSides.every((d) => near(d, fixedSides[0])) &&
    fixedAngles.every((a) => a !== null && near(a, 60, 1e-6));

  // At each fixed centre, the angle subtended by the two neighbouring moving corners.
  const turns = {
    atAprime: deg(K.angleAt(s.Aq, s.B, s.C)),
    atBprime: deg(K.angleAt(s.Bq, s.C, s.A)),
    atCprime: deg(K.angleAt(s.Cq, s.A, s.B)),
  };
  const turnsAre120 = Object.values(turns).every((a) => a !== null && near(a, 120, 1e-6));

  const d = K.derive(s) as Derived;
  const crosses = [
    K.intersect(s.A, s.Aq, s.B, s.Bq),
    K.intersect(s.B, s.Bq, s.C, s.Cq),
    K.intersect(s.C, s.Cq, s.A, s.Aq),
  ] as (Point | null)[];

  const base = [s.A, s.Cq, s.B, s.Aq, s.C, s.Bq];
  const baseSides = base.map((p, i) => dist(p, base[(i + 1) % 6]));
  const hexagons = K.copies(s) as Point[][];
  let deviation = 0;
  for (const hex of hexagons) {
    for (let i = 0; i < 6; i++) deviation = Math.max(deviation, Math.abs(dist(hex[i], hex[(i + 1) % 6]) - baseSides[i]));
  }
  const congruent = Number.isFinite(deviation) &&
    deviation <= 1e-6 * Math.max(1, ...baseSides.map(Math.abs));

  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    fixedTriangle: {
      Aprime: pt(s.Aq), Bprime: pt(s.Bq), Cprime: pt(s.Cq),
      sideLengths: fixedSides.map(maybe), anglesDeg: fixedAngles, isEquilateral: fixedIsEquilateral,
    },
    turns: { ...turns, allAre120Degrees: turnsAre120 },
    concurrence: {
      lines: ["AA\u2032", "BB\u2032", "CC\u2032"],
      pairwiseCrossings: pts(crosses),
      meetingPoint: pt(d.F),
      spread: maybe(spread(crosses)),
      concurrent: concurrent(crosses),
      napoleonApices: { Aprime2: pt(d.Ap), Bprime2: pt(d.Bp), Cprime2: pt(d.Cp) },
    },
    tessellation: {
      hexagon: "A C\u2032 B A\u2032 C B\u2032",
      copies: hexagons.length,
      rotationDegrees: deg(K.THIRD_TURN),
      baseSideLengths: baseSides.map(maybe),
      maxSideDeviation: maybe(deviation),
      allCongruent: congruent,
    },
    note:
      "Aq, Bq, Cq are the fixed equilateral triangle (the Napoleon centres). The three marked angles at its corners are all 120 degrees; the hexagon A C\u2032 B A\u2032 C B\u2032 is copied by 120-degree rotations about its corners into congruent tiles; and AA\u2032, BB\u2032, CC\u2032 share one point by Kiepert's theorem. All three turns must run the same way round the triangle. This is Rigby's Napoleon-hexagon result, not the side-ratio applet Escher Ceva Menelaus.",
  };
}

/** The orientation caveat: flip one 120-degree turn and the three lines miss. */
function orientation(K: Core, s: State) {
  const good = reading(K, s);
  // Keep A and B, but send B about Aprime by -120 instead of +120 to get C.
  const badC = K.rotate(s.Aq, s.B, K.THIRD_TURN, -1) as Point;
  const badCrosses = [
    K.intersect(s.A, s.Aq, s.B, s.Bq),
    K.intersect(s.B, s.Bq, badC, s.Cq),
    K.intersect(badC, s.Cq, s.A, s.Aq),
  ] as (Point | null)[];
  return {
    triangle: good.triangle,
    correct: {
      C: pt(s.C),
      crossings: good.concurrence.pairwiseCrossings,
      spread: good.concurrence.spread,
      concurrent: good.concurrence.concurrent,
    },
    flipped: {
      C: pt(badC),
      changedTurn: "B about A\u2032: \u2212120\u00b0 instead of +120\u00b0",
      crossings: pts(badCrosses),
      spread: maybe(spread(badCrosses)),
      concurrent: concurrent(badCrosses),
    },
    note:
      "Rigby's caveat: the three 120-degree turns must go the same way round the triangle. Here one turn is reversed while the other two stay, and AA\u2032, BB\u2032, CC\u2032 no longer meet in one point (the crossing spread grows from near zero to a visible gap). Escher Ceva Menelaus is a different applet: it types in how points divide a triangle's sides and uses a Ceva\u2013Menelaus equation, whereas here the whole triangle moves and no ratio is entered.",
  };
}

const SAMPLE = '{ "which": "B", "point": [267.58831175456856, 263.50976445678475] }';

export function actions(): GameActions {
  return {
    verify_escher: {
      describe:
        "Check the page's three claims for the diagram: an optional drag of vertex which (A, B or C; default B) to point [x, y] in the page's 640 x 420 board rebuilds the other two corners with the core's 120-degree rotations. Reports the fixed equilateral triangle, the three 120-degree turns at its corners, whether AA\u2032, BB\u2032 and CC\u2032 concur (crossings, meeting point and spread), and whether all 138 hexagon copies are congruent.",
      args: SAMPLE,
      run: (args) => {
        const K = core();
        return reading(K, readState(K, args));
      },
    },
    orientation_flip: {
      describe:
        "Demonstrate Rigby's orientation caveat: starting from the same optional drag of which to point, reverse one of the three 120-degree turns and compare the crossings of AA\u2032, BB\u2032, CC\u2032 with the correct concurrence. Returns both versions of the third corner, their crossing spreads and a boolean for each concurrence, showing that mixed turn directions destroy the common point. This Napoleon-hexagon result is not the Escher Ceva Menelaus side-ratio applet.",
      args: SAMPLE,
      run: (args) => {
        const K = core();
        return orientation(K, readState(K, args));
      },
    },
  };
}

/** Track.state saves the whole core state; echo it and re-measure it through the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Escher's Theorem state version ${stateVersion}`);
  const K = core();
  const saved = {
    A: pt(state.A as Point), B: pt(state.B as Point), C: pt(state.C as Point),
    Aprime: pt(state.Aq as Point), Bprime: pt(state.Bq as Point), Cprime: pt(state.Cq as Point),
    NapoleonApexA: pt(state.Ap as Point), NapoleonApexB: pt(state.Bp as Point), NapoleonApexC: pt(state.Cp as Point),
    meetingPoint: pt(state.F as Point),
    crossings: Array.isArray(state.crosses) ? pts(state.crosses as Point[]) : null,
    options: state.options ?? null,
  };
  try {
    const s = readSavedState(K, state);
    const r = reading(K, s);
    return {
      stateVersion,
      saved,
      reading: r,
      savedDerivedMatches:
        r.concurrence.meetingPoint !== null && saved.meetingPoint !== null &&
        dist(r.concurrence.meetingPoint, saved.meetingPoint) <= 1e-6 * Math.max(1, Math.abs(saved.meetingPoint.x), Math.abs(saved.meetingPoint.y)) &&
        Array.isArray(saved.crossings) && saved.crossings.length === 3 &&
        r.concurrence.pairwiseCrossings.every((p, i) => {
          const savedP = saved.crossings![i];
          return p !== null && savedP !== null && dist(p, savedP) <= 1e-6 * Math.max(1, Math.abs(savedP.x), Math.abs(savedP.y));
        }),
      note:
        "Track.state saves the three moving corners A, B, C, the fixed equilateral centres Aq, Bq, Cq and the derived Napoleon apices, meeting point and crossings with the five display options. The reading recomputes the 120-degree turns, the common point of AA\u2032, BB\u2032, CC\u2032 and the congruent hexagon copies from the saved geometry with the same core the page uses, then checks them against the saved derived fields. This is an illustration: there is no win or loss.",
    };
  } catch (e) {
    return {
      stateVersion,
      saved,
      reading: null,
      savedDerivedMatches: false,
      note: `The saved position cannot be measured: ${(e as Error).message}`,
    };
  }
}
