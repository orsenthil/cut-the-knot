/*
 * run_game_logic actions and saved-position reader for Besteman.
 *
 * The real core is besteman/besteman-core.js, copied into src/generated/cores/
 * at build time. It transcribes the applet's straightedge-and-compass division:
 * with AB level and AC = N·AB/2, the circles (A, AB) and (C, AC) meet at D and
 * E, their common chord DE crosses AB at P, and Q is the midpoint of AD. The
 * chord is the radical axis, so AP = AB²/(2AC) = AB/N. See _shared.ts for the
 * module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["besteman"].BestemanCore;

type Core = ReturnType<typeof core>;
type Point = { x: number; y: number };
/** construct() omits these three lengths on a degenerate picture. */
type Geometry = ReturnType<Core["construct"]> & {
  AP?: number | null;
  AQ?: number | null;
  AD?: number | null;
};

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null => (v == null ? null : round(v));
const pt = (p: Point | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** Accept the page's {x, y} as well as [x, y] in action arguments. */
function readPoint(args: Json, key: string, fallback?: Point): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    if (v.length !== 2 || !v.every((x) => Number.isFinite(Number(x)))) {
      throw new Error(`argument "${key}" must be [x, y]`);
    }
    return { x: Number(v[0]), y: Number(v[1]) };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  if (fallback) return { ...fallback };
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

/** The page's saved points may be absent on a fresh, untouched picture. */
function savedPoint(args: Json, key: string, fallback: Point | null): Point | null {
  const v = args[key];
  if (v === undefined || v === null) return fallback ? { ...fallback } : null;
  return readPoint(args, key);
}

function savedNumber(args: Json, key: string, fallback: number | null): number | null {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  return num(args, key);
}

/**
 * Build a core state for one construction. The applet fixes AB level, so only
 * the number N, the length of AB and (optionally) the left end A are needed.
 * B is placed to the right of A inside the 400 x 250 picture, so the core's
 * own clamping cannot silently change the requested length.
 */
function readConfig(args: Json) {
  const C = core();
  const n = num(args, "n", C.DEFAULT_N);
  if (!Number.isInteger(n) || n < C.MIN_N || n > C.MAX_N) {
    throw new Error(`"n" must be a whole number from ${C.MIN_N} to ${C.MAX_N}`);
  }
  const AB = num({ AB: args.AB ?? args.baseLength }, "AB");
  if (!(AB > 0)) throw new Error('"AB" (baseLength) must be a positive length');
  const A = readPoint(args, "A", C.START_A);
  if (A.x < 0 || A.x > C.WIDTH || A.y < 0 || A.y > C.HEIGHT) {
    throw new Error(`"A" must lie inside the ${C.WIDTH} x ${C.HEIGHT} picture`);
  }
  if (A.x + AB > C.WIDTH) {
    throw new Error(`AB = ${AB} puts B outside the ${C.WIDTH}-wide picture; move A left or shorten AB`);
  }
  return C.start({ A, B: { x: A.x + AB, y: A.y }, n });
}

/** Every number the page draws and every equality its article claims. */
function reading(C: Core, state: ReturnType<Core["start"]>) {
  const g: Geometry = C.construct(state);
  const claims = C.claims(state);
  const AP = maybe(g.AP);
  const AQ = maybe(g.AQ);
  return {
    n: g.n,
    A: pt(g.A), B: pt(g.B), M: pt(g.M), C: pt(g.C),
    AB: round(g.AB), AC: round(g.AC), halfStep: round(g.AB / 2),
    circles: {
      centeredAtA: { center: pt(g.circleA), radius: round(g.circleA.r) },
      centeredAtC: { center: pt(g.circleC), radius: round(g.circleC.r) },
    },
    D: pt(g.D), E: pt(g.E), P: pt(g.P), Q: pt(g.Q),
    lengths: {
      AP, AQ, AD: maybe(g.AD),
      ABOverN: round(g.AB / g.n),
      ABsquaredOver2AC: round((g.AB * g.AB) / (2 * g.AC)),
    },
    ratios: {
      APOverAQ: g.AP != null && g.AQ != null ? round(g.AP / g.AQ) : null,
      ADOverAC: g.AD != null ? round(g.AD / g.AC) : null,
    },
    divisions: (g.divisions || []).map(pt),
    claims,
    equalities: {
      AP_over_AQ_equals_AD_over_AC: claims.similarTriangles,
      AP_equals_AB_squared_over_2AC: claims.apFormula,
      AP_equals_AB_over_N: claims.apEqualsABOverN,
    },
    note: g.degenerate || !g.P
      ? "AB is too short to carry the construction, so there are no circles' crossings to measure."
      : `C sits ${round(g.AC)} = ${g.n} × AB/2 from A. The two circles meet at D and E; their common chord DE is perpendicular to AC and cuts AB at P, and Q is the midpoint of AD. D is on the circle about A, so AD = AB and AQ = AB/2; the chord puts AP at AB²/(2AC), hence AP/AQ = AB/AC = AD/AC and, because AC = ${g.n}·AB/2, AP = AB/${g.n} = ${round(g.AB / g.n)} — the length of each of the ${g.n} equal steps marked along AB.`,
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a whole N from 2 to 20 and a positive base length AB (also accepted as baseLength), give the point C with AC = N·AB/2, the two circles centred at A and C, their crossings D and E, P = DE ∩ AB, Q the midpoint of DA, the equal steps along AB, and the measured equalities AP/AQ = AD/AC, AP = AB²/(2AC) and AP = AB/N. Optional A moves the left end; B is placed at A + (AB, 0) inside the 400 x 250 picture.",
      args: '{ "n": 3, "AB": 50 }',
      run: (args) => {
        const C = core();
        return reading(C, readConfig(args));
      },
    },
    check_claims: {
      describe:
        "Test every claim on Besteman's page for a whole N (2..20) and base length AB: AC is N half-steps, DE is perpendicular to AC, D and E lie on both circles, P lies on the chord and on AB, Q is the midpoint of AD, AP/AQ = AD/AC, AP = AB²/(2AC), AP = AB/N, and the marked divisions are evenly spaced. Reports a boolean per claim plus the names of any that fail.",
      args: '{ "n": 5, "AB": 40 }',
      run: (args) => {
        const C = core();
        const state = readConfig(args);
        const claims = C.claims(state);
        const names = [
          "acIsNM", "chordPerpendicular", "pointsOnCircles", "pOnChordAndAxis",
          "qIsMidpoint", "similarTriangles", "apFormula", "apEqualsABOverN",
          "divisionsEvenlySpaced",
        ] as const;
        const failed = names.filter((k) => claims[k] !== true);
        return {
          n: state.n,
          AB: round(C.construct(state).AB),
          claims,
          allHold: failed.length === 0,
          failed,
          note: failed.length
            ? `These claims fail: ${failed.join(", ")}. The construction needs a positive AB and a whole N from ${C.MIN_N} to ${C.MAX_N}.`
            : `All ${names.length} claims hold here, including AP = AB²/(2AC) = AB/${state.n}.`,
        };
      },
    },
  };
}

/** The fields Track.state saves on the page, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const fresh = C.start({});
  const A = readPoint(state, "A", fresh.A);
  const B = readPoint(state, "B", fresh.B);
  const n = num(state, "n", fresh.n);
  const here = C.start({
    A, B, n,
    names: state.names === true,
    hint: state.hint === true,
  });
  const g: Geometry = C.construct(here);
  const derived = reading(C, here);

  const savedC = savedPoint(state, "C", g.C);
  const savedM = savedPoint(state, "M", g.M);
  const savedD = savedPoint(state, "D", g.D);
  const savedE = savedPoint(state, "E", g.E);
  const savedP = savedPoint(state, "P", g.P);
  const savedQ = savedPoint(state, "Q", g.Q);
  const gap = (p: Point | null, q: Point | null): number =>
    p && q ? Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) : p === q ? 0 : Infinity;
  const drift = Math.max(
    gap(savedC, g.C), gap(savedM, g.M), gap(savedD, g.D),
    gap(savedE, g.E), gap(savedP, g.P), gap(savedQ, g.Q),
    Math.abs(savedNumber(state, "AB", g.AB)! - g.AB),
    Math.abs(savedNumber(state, "AC", g.AC)! - g.AC),
    Math.abs((savedNumber(state, "AP", g.AP ?? 0) ?? 0) - (g.AP ?? 0)),
  );

  return {
    stateVersion,
    // Saved fields, as written by besteman.js's Track.state call.
    A: pt(A), B: pt(B), C: pt(savedC), M: pt(savedM), D: pt(savedD), E: pt(savedE),
    P: pt(savedP), Q: pt(savedQ), n: here.n,
    AB: savedNumber(state, "AB", g.AB), AC: savedNumber(state, "AC", g.AC),
    AP: savedNumber(state, "AP", g.AP ?? null),
    names: here.names, hint: here.hint,
    // What the real core makes of the same picture.
    reading: {
      ...derived,
      savedMatchesCore: Number.isFinite(drift) && drift < 1e-6,
      maxSavedDeviation: Number.isFinite(drift) ? round(drift) : null,
      note: derived.note,
    },
  };
}
