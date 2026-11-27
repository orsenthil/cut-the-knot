/*
 * run_game_logic actions and saved-position reader for Evelyn N.
 *
 * Every number below comes from the game's real core
 * (evelyn-n/evelyn-n-core.js), copied into src/generated/cores/ at build time.
 * See _shared.ts for the module shape.
 *
 * The applet grows a chain of circles around an n-gon: each new circle is
 * tangent to the previous one and to two sides meeting at a corner. Its loop
 * stops after 2n circles, so 2n is a cap of the program, not a theorem about
 * the drawing. For a regular polygon the chain comes back to its first circle
 * after n circles when n is even, and one circle *past* the displayed cap
 * (at index 2n) when n is odd. The triangle case n = 3 is Evelyn's six-circles
 * theorem: the sixth drawn circle touches the first. The old page also claims
 * that for even n the distance from the first to the 2n-th drawn circle does
 * not depend on the starting radius; it plainly does, and the second action
 * measures it twice to show that.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["evelyn-n"].EvelynNCore;

type Point = { x: number; y: number };
type Circle = { x: number; y: number; r: number; red?: boolean };
type Geo = {
  n: number;
  which: number;
  vertices: Point[];
  bisectors: Point[];
  p: Point;
  firstRadius: number;
  circles: Circle[];
  chainLength: number;
  closureAt: number;
};

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Accept [x, y] or { x, y }, as the other geometry readers do. */
function readPoint(v: unknown, key: string): Point {
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${key}" must have exactly two numbers, [x, y]`);
    const x = Number(v[0]), y = Number(v[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`"${key}" must be two finite numbers`);
    return { x, y };
  }
  if (v !== null && typeof v === "object") {
    const p = v as Json;
    return { x: num(p, "x"), y: num(p, "y") };
  }
  throw new Error(`"${key}" must be [x, y] or { x, y }`);
}

/** n is the number of sides: a whole number from 3 to 21 (the core's range). */
function readN(args: Json): number {
  const C = core();
  const n = num(args, "n", C.N_MIN);
  if (!Number.isInteger(n) || n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`"n" must be a whole number of sides from ${C.N_MIN} to ${C.N_MAX}, got ${JSON.stringify(args.n)}`);
  }
  return n;
}

/** ta is where P sits on the first bisector: 0 at the corner, 1 at the diagonal. */
function readTa(args: Json, key = "ta", fallback?: number): number {
  const C = core();
  const ta = num(args, key, fallback === undefined ? C.TA_INIT : fallback);
  if (!(ta >= 0 && ta <= 1)) {
    throw new Error(`"${key}" must be between 0 and 1, got ${JSON.stringify(args[key])}`);
  }
  return ta;
}

function readWhich(args: Json, n: number): number {
  const w = num(args, "which", 2 * n);
  if (!Number.isInteger(w) || w < 0 || w > 2 * n) {
    throw new Error(`"which" must be a whole number from 0 to 2n = ${2 * n}, got ${JSON.stringify(args.which)}`);
  }
  return w;
}

function geometry(state: Json): Geo | null {
  return core().geometry(state) as Geo | null;
}

/** A fresh regular n-gon picture, straight from the core's start + geometry. */
function measure(n: number, ta: number, which: number): Geo {
  const C = core();
  const state = C.start({ n: n, ta: ta, which: which }) as Json;
  const g = geometry(state);
  if (!g) throw new Error(`the core cannot draw a regular ${n}-gon`);
  return g;
}

/** The circle one step past the 2n cap, from the core's own nextCircle(). */
function pastCap(g: Geo): Circle | null {
  const C = core();
  const k = g.circles.length;
  const i = k % g.n;
  const prev = g.circles[k - 1];
  if (!prev) return null;
  const next = C.nextCircle(g.vertices[(i + 1) % g.n], prev, g.vertices[i], g.bisectors[i]);
  if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y) || !Number.isFinite(next.r)) return null;
  return { x: next.x, y: next.y, r: next.r };
}

/** Shared report of a regular polygon's chain, used by both actions. */
function chainReading(n: number, ta: number, which: number) {
  const C = core();
  const g = measure(n, ta, which);
  const cap = 2 * n;
  const first = g.circles[0];
  const last = g.circles[g.circles.length - 1];
  const extra = pastCap(g);
  const centreGap = extra && first ? gap(first, extra) : null;
  const radiusGap = extra && first ? Math.abs(first.r - extra.r) : null;
  const numericTol = 1e-3 * C.RADIUS; // a generous tolerance for a check past the cap
  return {
    n,
    ta: round(ta),
    which,
    programCap: cap,
    drawnCircles: g.chainLength,
    firstRadius: round(g.firstRadius),
    closureAtInDrawnRange: g.closureAt,
    regularPolygonPeriod: n % 2 === 0 ? n : 2 * n,
    circlePastCap: extra ? pt(extra) : null,
    centreGapPastCap: centreGap === null ? null : round(centreGap),
    radiusGapPastCap: radiusGap === null ? null : round(radiusGap),
    repeatsPastCap: centreGap !== null && radiusGap !== null &&
      centreGap < numericTol && radiusGap < numericTol,
    firstToLastDrawnDistance: first && last ? round(gap(first, last)) : null,
    redCircles: g.circles.filter((c) => c.red === true).length,
    isEvelynTriangle: n === 3,
    description: C.describe({ n: n, which: which, ta: ta, vertices: g.vertices, explored: true }),
  };
}

export function actions(): GameActions {
  return {
    chain_period: {
      describe:
        "Grow Evelyn's circle chain around a regular n-gon (3 to 21 sides) starting with P at parameter ta on the first bisector (0 to 1). Reports the applet's 2n loop cap, how many circles it actually draws, where it first returns to the opening circle, the n-for-even / 2n-for-odd repeat of a regular polygon (checked one circle past the cap), and the six-circles triangle case at n = 3.",
      args: '{ "n": 5, "ta": 0.7 }',
      run: (args) => {
        const n = readN(args);
        const ta = readTa(args);
        const which = readWhich(args, n);
        const r = chainReading(n, ta, which);
        return {
          ...r,
          note:
            "The applet always stops after 2n circles, so 2n is a cap in the program, not a proved bound on the chain. For a regular polygon the centres return to the first circle after n circles when n is even (visible as closureAtInDrawnRange = n) and at index 2n when n is odd, just beyond the displayed range. At n = 3 the six drawn circles are Evelyn's six-circles theorem: the sixth touches the first.",
        };
      },
    },
    even_n_distance: {
      describe:
        "Test the old page's claim that for an even-sided polygon the distance from the first circle to the 2n-th drawn circle does not depend on the first radius, using the real core at two positions of P (ta values between 0 and 1). Returns both distances and their difference; the claim fails whenever they disagree.",
      args: '{ "n": 4, "taA": 0.5, "taB": 0.95 }',
      run: (args) => {
        const n = readN(args);
        if (n % 2 !== 0) {
          throw new Error(`"n" must be even for this claim; got ${n}. Use chain_period for an odd-sided polygon.`);
        }
        const a = readTa(args, "taA", 0.5);
        const b = readTa(args, "taB", 0.95);
        if (a === b) {
          throw new Error('"taA" and "taB" must differ to test whether the distance depends on the first radius');
        }
        const A = chainReading(n, a, 2 * n);
        const B = chainReading(n, b, 2 * n);
        const difference = Math.abs(A.firstToLastDrawnDistance! - B.firstToLastDrawnDistance!);
        return {
          n,
          programCap: 2 * n,
          atA: {
            ta: A.ta,
            firstRadius: A.firstRadius,
            firstToLastDrawnDistance: A.firstToLastDrawnDistance,
            closureAtInDrawnRange: A.closureAtInDrawnRange,
          },
          atB: {
            ta: B.ta,
            firstRadius: B.firstRadius,
            firstToLastDrawnDistance: B.firstToLastDrawnDistance,
            closureAtInDrawnRange: B.closureAtInDrawnRange,
          },
          difference: round(difference),
          pageClaimHolds: difference < 1e-6,
          note:
            "The chain closes after n circles for an even-sided regular polygon, so the 2n-th drawn circle is one of the repeated ones. Moving the yellow point changes the first circle's radius and, with it, the distance from the first circle to the last drawn one. For a square the core gives roughly 99 board units at ta = 0.5 and 145 at ta = 0.95, so the page's 'independent of the first radius' sentence is false.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Evelyn N state version ${stateVersion}`);
  }
  const C = core();
  const n = readN(state);
  const ta = readTa(state);
  const which = readWhich(state, n);
  const whichSpinner = num(state, "whichSpinner", which);
  if (!Number.isInteger(whichSpinner) || whichSpinner < 0 || whichSpinner > 2 * n) {
    throw new Error(`"whichSpinner" must be a whole number from 0 to 2n = ${2 * n}`);
  }

  /* The page saves the vertices it drew; fall back to the core's regular
   * polygon only when they are absent. */
  let vertices: Point[];
  if (state.vertices === undefined || state.vertices === null) {
    vertices = C.start({ n: n, ta: ta, which: which }).vertices as Point[];
  } else {
    if (!Array.isArray(state.vertices) || state.vertices.length !== n) {
      throw new Error(`"vertices" must be an array of ${n} points, one per corner`);
    }
    vertices = state.vertices.map((v, i) => readPoint(v, `vertices[${i}]`));
  }
  const saved: Json = {
    n: n, which: which, whichSpinner: whichSpinner, ta: ta,
    vertices: vertices, explored: state.explored === true,
  };
  const g = geometry(saved);
  if (!g) {
    return {
      stateVersion,
      n, which, whichSpinner, ta,
      vertices: vertices.map(pt),
      p: state.p ?? null,
      circles: Array.isArray(state.circles) ? state.circles : [],
      chainLength: num(state, "chainLength", 0),
      closureAt: num(state, "closureAt", 0),
      explored: saved.explored,
      reading: null,
      note: "The saved polygon cannot be drawn by the core (its corners are not usable).",
    };
  }

  const first = g.circles[0];
  const last = g.circles[g.circles.length - 1];
  const sideLengths = g.vertices.map((v, i) => gap(v, g.vertices[(i + 1) % n]));
  const regular = sideLengths.every((s) => Math.abs(s - sideLengths[0]) < 1e-6 * C.RADIUS);
  const savedCircles = Array.isArray(state.circles) ? state.circles as Json[] : [];

  return {
    stateVersion,
    /* The page's saved fields, with the same names. */
    n,
    which,
    whichSpinner,
    ta,
    vertices: vertices.map(pt),
    p: state.p ?? null,
    circles: savedCircles,
    chainLength: num(state, "chainLength", 0),
    closureAt: num(state, "closureAt", 0),
    explored: saved.explored,
    /* What the core reads back from those fields. */
    reading: {
      n: g.n,
      which: g.which,
      chainLength: g.chainLength,
      closureAt: g.closureAt,
      firstRadius: round(g.firstRadius),
      firstToLastDrawnDistance: first && last ? round(gap(first, last)) : null,
      redCircles: g.circles.filter((c) => c.red === true).length,
      p: pt(g.p),
      circles: g.circles.map((c) => ({ x: round(c.x), y: round(c.y), r: round(c.r), red: c.red === true })),
      sideLengths: sideLengths.map(round),
      regular,
      programCap: 2 * g.n,
      regularPolygonPeriod: g.n % 2 === 0 ? g.n : 2 * g.n,
      isEvelynTriangle: g.n === 3,
      description: C.describe(saved),
    },
    savedMatchesCore: savedCircles.length === g.chainLength,
    note: regular
      ? `A regular ${g.n}-gon: the applet draws ${g.chainLength} of its ${2 * g.n} allowed circles, and the chain returns to the first circle after ${g.n % 2 === 0 ? g.n : 2 * g.n} circles. ${g.n === 3 ? "This is Evelyn's six-circles theorem." : ""}`
      : `The saved corners do not form a regular ${g.n}-gon, so the n / 2n repeat is not expected here; the core still draws ${g.chainLength} circles up to its ${2 * g.n} cap.`,
  };
}
