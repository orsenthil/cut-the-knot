/*
 * run_game_logic actions and saved-position reader for Hubert Shutrick's
 * Dissection. All numbers come from the real core, copied at build time from
 * huberts-dissection/huberts-dissection-core.js into src/generated/cores/.
 *
 * The cut needs a point N on AB with MN = AB, where M is the midpoint of BC.
 * That happens exactly when AM > AB and BM < AB together: the olympiad's
 * "median AM longer than AB" alone is not enough (a tall narrow triangle has
 * AM > AB but BM > AB and no such N). Turning the two pieces a half turn about
 * Bm and M then gives N'N''MM', whose four sides all equal AB; see _shared.ts
 * for the module shape. All coordinates are SVG viewBox units, y down.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  A: Pt; B: Pt; C: Pt; angle: number; showNames: boolean; showHint: boolean;
  moves: number; explored: boolean;
};
type Geometry = {
  good: boolean; degenerate?: boolean; A: Pt; B: Pt; C: Pt; M: Pt; Bm: Pt;
  sense: number; N?: Pt | null; ab: number; angle: number; center: Pt;
  theta?: number; Mm?: Pt; Np?: Pt; Ap?: Pt; Bp?: Pt; Npp?: Pt;
  movingA?: Pt[]; movingB?: Pt[]; fixed?: Pt[]; rhombus?: Pt[];
};
type Hypotheses = {
  ab: number; bm: number; am: number; medianLonger: boolean;
  halfSideShorter: boolean; acute: boolean; angles: number[];
  sides: number[]; area: number;
};
type HalfTurn = {
  Np: Pt; Npp: Pt; Mm: Pt; sides: number[]; ab: number; polygon: Pt[]; area: number;
};
type Claims = {
  nOnSegment: boolean; midline: boolean; fourEqualSides: boolean;
  oppositeSidesParallel: boolean; areaPreserved: boolean; piecesFillRhombus: boolean;
};
type Core = {
  WIDTH: number; HEIGHT: number; ANGLE_MIN: number; ANGLE_MAX: number; ANGLE_START: number;
  start(options?: Partial<{
    width: number; height: number; A: Pt; B: Pt; C: Pt;
    angle: number; showNames: boolean; showHint: boolean;
  }>): State;
  move(s: State, m: Json): State | null;
  compute(s: State): Geometry;
  halfTurn(g: Geometry): HalfTurn | null;
  claims(g: Geometry): Claims | null;
  hypotheses(s: State): Hypotheses | null;
  signedArea(poly: Pt[]): number;
  dist(p: Pt, q: Pt): number;
  result(s: State): string | null;
  describe(s: State, g: Geometry): string;
};

const core = (): Core => cores["huberts-dissection"].HubertsDissectionCore as unknown as Core;

/* 180° is the half turn inside the applet's 0..185 animation range. */
const HALF_TURN_ANGLE = 180;

/* The core is exact up to floating point; only the numbers we print are rounded. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : 0);
const rp = (p: Pt): Pt => ({ x: r6(p.x), y: r6(p.y) });
const same = (p: Pt, q: Pt, tol = 1e-6): boolean =>
  Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(q.x) && Number.isFinite(q.y)
  && Math.abs(p.x - q.x) <= tol && Math.abs(p.y - q.y) <= tol;
const samePoly = (a: Pt[] | undefined, b: Pt[] | undefined, tol = 1e-6): boolean =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length
  && a.every((p, i) => same(p, b[i], tol));

const numeric = (v: unknown): boolean =>
  (typeof v === "number" || typeof v === "string") && Number.isFinite(Number(v));

/** A required argument: a finite point with numeric x and y. */
function point(v: unknown, label: string): Pt {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`${label} must be a point with numeric x and y`);
  }
  const p = v as Json;
  if (!numeric(p.x) || !numeric(p.y)) {
    throw new Error(`${label} must be a point with numeric x and y`);
  }
  return { x: Number(p.x), y: Number(p.y) };
}

/** Build a state from optional corner overrides, always through the real core. */
function buildState(C: Core, args: Json, angle: number): State {
  const base = C.start({});
  const s = C.start({
    A: args.A === undefined ? base.A : point(args.A, "A"),
    B: args.B === undefined ? base.B : point(args.B, "B"),
    C: args.C === undefined ? base.C : point(args.C, "C"),
    angle,
  });
  if ([C.dist(s.A, s.B), C.dist(s.B, s.C), C.dist(s.C, s.A)].some((d) => d < 1)) {
    throw new Error("A, B and C must be three distinct points at least 1 unit apart");
  }
  return s;
}

/** The half-turn picture and all the page's claims, measured by the core. */
function rhombusReading(C: Core, s: State): Json {
  const g = C.compute(s);
  if (!g.good || !g.N) {
    const h = C.hypotheses(s);
    return {
      A: rp(s.A), B: rp(s.B), C: rp(s.C), ab: r6(g.ab),
      constructible: false,
      medianLonger: h ? h.medianLonger : null,
      halfSideShorter: h ? h.halfSideShorter : null,
      note: C.describe(s, g),
      why: `With AB = ${r6(g.ab)} there is no point N on segment AB with MN = AB, so there are no pieces to turn into a rhombus.`,
    };
  }
  const h = C.halfTurn(g) as HalfTurn;
  const cl = C.claims(g) as Claims;
  return {
    A: rp(s.A), B: rp(s.B), C: rp(s.C), ab: r6(g.ab), angle: s.angle,
    constructible: true,
    N: rp(g.N), M: rp(g.M), Bm: rp(g.Bm),
    halfTurn: { Np: rp(h.Np), Npp: rp(h.Npp), Mm: rp(h.Mm) },
    rhombus: h.polygon.map(rp),
    sides: h.sides.map(r6),
    sidesEqualAb: cl.fourEqualSides,
    claims: cl,
    triangleArea: r6(Math.abs(C.signedArea([g.A, g.B, g.C]))),
    rhombusArea: r6(h.area),
    matchesAsDrawn: samePoly(g.rhombus, h.polygon),
    note: C.describe(s, g),
    why: `BmM is the midline of triangle ABC, so 2·BmM = AB; N''M and M'N' inherit MN = AB. A half turn about Bm and M gives the outline N'N''MM' with four sides each equal to AB = ${r6(g.ab)}, and the three pieces fill it without changing area.`,
  };
}

export function actions(): GameActions {
  return {
    rhombus: {
      describe:
        "Build Hubert Shutrick's dissection at the half-turn angle and report the rhombus N'N''MM' with its four side lengths and AB, together with the core's checks that N lies on AB, the midline equals AB/2, opposite sides are parallel and the three pieces fill the rhombus with area preserved. Accepts optional corners A, B, C; defaults to the page's opening triangle.",
      args: '{ "A": { "x": 200, "y": 280 }, "B": { "x": 288, "y": 213.33333333333334 }, "C": { "x": 240, "y": 64 } }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args, HALF_TURN_ANGLE);
        return rhombusReading(C, s);
      },
    },

    cut_condition: {
      describe:
        "Test whether the cut can be made for triangle ABC: the circle centred at the midpoint M of BC with radius AB must meet segment AB at N. Reports AM, BM, the olympiad condition AM > AB, the extra required BM < AB, and whether N exists; the example uses a tall narrow triangle where AM > AB holds but BM < AB fails and no cut exists.",
      args: '{ "A": { "x": 220, "y": 280 }, "B": { "x": 260, "y": 280 }, "C": { "x": 240, "y": 60 } }',
      run: (args) => {
        const C = core();
        const s = buildState(C, args, C.ANGLE_START);
        const g = C.compute(s);
        const h = C.hypotheses(s);
        if (!h) throw new Error("could not read the triangle's hypotheses");
        const cl = g.good ? C.claims(g) : null;
        const why = g.good
          ? `Both AM > AB and BM < AB hold (AM = ${r6(h.am)}, BM = ${r6(h.bm)}, AB = ${r6(h.ab)}), so the circle centred at M of radius AB meets segment AB at N with MN = AB.`
          : h.medianLonger && !h.halfSideShorter
            ? `AM > AB (${r6(h.am)} > ${r6(h.ab)}) but BM >= AB (${r6(h.bm)} >= ${r6(h.ab)}): the olympiad's median condition alone is not enough here. Both A and B lie inside or on the circle, so no N on segment AB has MN = AB.`
            : !h.medianLonger
              ? `AM <= AB (${r6(h.am)} <= ${r6(h.ab)}), so A lies on or inside the circle centred at M of radius AB and the circle misses segment AB: no cut.`
              : `Both AM > AB and BM < AB hold, but this triangle is so flat that the applet's line-circle intersection finds no N on AB: no cut.`;
        return {
          A: rp(s.A), B: rp(s.B), C: rp(s.C),
          ab: r6(h.ab), am: r6(h.am), bm: r6(h.bm),
          medianLongerAmGtAb: h.medianLonger,
          halfSideShorterBmLtAb: h.halfSideShorter,
          bothConditionsHold: h.medianLonger && h.halfSideShorter,
          acute: h.acute,
          cutExists: g.good,
          nOnSegment: cl ? cl.nOnSegment : false,
          N: g.N ? rp(g.N) : null,
          note: C.describe(s, g),
          why,
        };
      },
    },
  };
}

/** Reading a saved position must never throw on a damaged or older record. */

const isSavedPoint = (v: unknown): boolean =>
  !!v && typeof v === "object" && !Array.isArray(v)
  && numeric((v as Json).x) && numeric((v as Json).y);

const savedPoint = (v: unknown, fallback: Pt): Pt =>
  isSavedPoint(v) ? { x: Number((v as Json).x), y: Number((v as Json).y) } : fallback;

const savedInt = (v: unknown, fallback: number, lo: number, hi: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
};

const savedBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Hubert's Dissection state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Hubert's Dissection position must be an object");
  }
  const C = core();
  const base = C.start({});
  const A = savedPoint(state.A, base.A);
  const B = savedPoint(state.B, base.B);
  const Cp = savedPoint(state.C, base.C);
  const angle = savedInt(state.angle, base.angle, C.ANGLE_MIN, C.ANGLE_MAX);
  const showNames = savedBool(state.showNames, base.showNames);
  const showHint = savedBool(state.showHint, base.showHint);
  const s = C.start({ A, B, C: Cp, angle, showNames, showHint });

  const readable = isSavedPoint(state.A) && isSavedPoint(state.B) && isSavedPoint(state.C)
    && angle === Number(state.angle);
  const g = C.compute(s);
  const h = g.good ? C.halfTurn(g) : null;
  const cl = g.good ? C.claims(g) : null;
  const hyp = C.hypotheses(s);
  const savedPieces = Array.isArray(state.pieces)
    ? state.pieces.filter(isSavedPoint).map((p) => savedPoint(p, base.A))
    : null;

  return {
    ...state,
    stateVersion,
    savedReadable: readable,
    A: rp(A), B: rp(B), C: rp(Cp),
    angle: s.angle,
    showNames, showHint,
    savedGood: typeof state.good === "boolean" ? state.good : null,
    savedPieces: savedPieces ? savedPieces.map(rp) : state.pieces ?? null,
    good: g.good,
    degenerate: g.degenerate === true,
    savedGoodMatchesCore: g.good === state.good,
    savedPiecesMatchAsDrawn: g.good ? samePoly(savedPieces ?? undefined, g.rhombus) : state.pieces == null,
    ab: hyp ? r6(hyp.ab) : null,
    am: hyp ? r6(hyp.am) : null,
    bm: hyp ? r6(hyp.bm) : null,
    medianLongerAmGtAb: hyp ? hyp.medianLonger : null,
    halfSideShorterBmLtAb: hyp ? hyp.halfSideShorter : null,
    nOnSegment: cl ? cl.nOnSegment : false,
    halfTurnSides: h ? h.sides.map(r6) : null,
    fourSidesEqualAb: cl ? cl.fourEqualSides : null,
    areaPreserved: cl ? cl.areaPreserved : null,
    piecesFillRhombus: cl ? cl.piecesFillRhombus : null,
    note: C.describe(s, g),
    reading: !readable
      ? "Some saved fields could not be read, so the core rebuilt the opening triangle; the measurement below comes from that reconstruction."
      : `Track.state saved the three corners, the angle slider (0..185), the two switches and whether the cut was drawable. The core recomputes N with MN = AB: ${g.good ? `the cut exists and at the half turn N'N''MM' has four sides equal to AB = ${r6(h ? h.ab : 0)}` : "no point N on AB has MN = AB, so only the dashed median AM is drawn"}. This is a demonstration with no win or loss, so the tracker just records exploration.`,
  };
}
