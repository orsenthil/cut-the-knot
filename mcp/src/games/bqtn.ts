/*
 * run_game_logic actions and saved-position reader for BQTN — "A Chain of
 * Touching Circles in a Polygon", Bui Quang Tuan's theorem as published by
 * Alexander Bogomolny.
 *
 * Draw a convex n-gon and choose a point P on the internal bisector at corner
 * A1. The first circle is centred at P and touches side A1A2. At each step the
 * next circle touches the previous one at that circle's foot on the next side,
 * and its centre lies on the next corner's bisector: centre = intersection of
 * the perpendicular at the touch point with the bisector at the next corner.
 *
 * The theorem is about odd n: for any convex polygon with an odd number of
 * sides the chain closes at step 2n, i.e. C_{2n} = C_1 on the page. For an even
 * number of sides an arbitrary convex polygon misses, but a *regular* even
 * polygon closes early (period n), and when P is put at the bisector foot
 * (t = 0) all the circles coincide at the centre (period 1). That is the
 * page's "regular polygon repeats after 1 or 2n steps" claim, with the even-n
 * period-n case allowed by the core's check.
 *
 * Every number below is measured by the game's real core
 * (bqtn/bqtn-core.js), copied into src/generated/cores/ at build time.
 * See _shared.ts for the shape of a game module.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = { n: number; points: Point[]; t: number; which: number };
type Circle = { center: Point; r: number; index: number; tangent: Point };
type Chain = {
  vertices: Point[];
  feet: Point[];
  P: Point;
  circles: Circle[];
  tangencies: Point[];
  scale: number;
  tol: number;
  finite: boolean;
  period: number | null;
  returns: boolean;
  deviation: number;
};
type Claims = {
  tangenciesOnSides: boolean;
  centersOnBisectors: boolean;
  consecutiveTouch: boolean;
  returnsAt2N: boolean;
  chainLength: boolean;
  regularLengthOneOrTwoN: boolean;
  all: boolean;
  centralChain: boolean;
};
type Core = {
  WIDTH: number;
  HEIGHT: number;
  N_MIN: number;
  N_MAX: number;
  DEFAULT_T: number;
  MAX_CIRCLES: number;
  start(options?: Json): State;
  chain(s: State): Chain;
  claims(s: State): Claims;
  isRegular(s: State): boolean;
  regularPolygon(n: number, width?: number, height?: number): Point[];
  result(s?: Json): null;
};

const core = () => cores["bqtn"].BqtnCore as unknown as Core;

const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const xy = (p: Point): [number, number] => [round(p.x, 4), round(p.y, 4)];

/** Tool args may give [x, y] or {x, y}; a saved position from the page uses {x, y}. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or {x, y}`);
    x = Number(value[0]);
    y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const p = value as Json;
    x = Number(p.x);
    y = Number(p.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or {x, y}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric coordinates, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** Build a state the core accepts: n corners (a regular n-gon by default) and P's parameter t. */
function stateFromArgs(C: Core, args: Json): State {
  const n = Math.round(num(args, "n", C.N_MIN));
  if (!Number.isInteger(n) || n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`"n" must be an integer from ${C.N_MIN} to ${C.N_MAX}`);
  }
  const t = num(args, "t", C.DEFAULT_T);
  if (!Number.isFinite(t) || t < 0 || t > 1) throw new Error('"t" must be a number between 0 and 1');
  let points: Point[] | undefined;
  if (args.points !== undefined) {
    if (!Array.isArray(args.points)) throw new Error('"points" must be an array of [x, y] corners');
    if (args.points.length !== n) throw new Error(`"points" must list exactly ${n} corners, got ${args.points.length}`);
    points = args.points.map((p, i) => readPoint(p, `points[${i}]`));
  }
  return C.start({ n, t, points, which: 2 * n });
}

/** The core's chain and its page-claim checks at one configuration. */
function reading(C: Core, s: State) {
  const m = C.chain(s);
  const cl = C.claims(s);
  const n = s.n;
  const regular = C.isRegular(s);
  const period = m.period;
  const first = m.circles[0];

  let note: string;
  if (!m.finite) {
    note = `The chain degenerates at this configuration (t = ${s.t} and/or corners too close): a centre or radius is not finite. Move the corners apart or pick 0 <= t < 1.`;
  } else if (regular && n % 2 === 1) {
    note = `A regular ${n}-gon (odd) closes at step ${2 * n}: C_${2 * n} = C_1, period ${period}. The theorem is stronger: any convex odd-sided polygon closes at 2n, not just a regular one.`;
  } else if (regular) {
    note = `A regular ${n}-gon (even) repeats after ${period} steps, so it is back at circle 1 at step ${2 * n} as well. Its period is ${period}, not 2n: with P at the bisector foot (t = 0) all circles share the centre (period 1), otherwise an even regular polygon has period n. The "1 or 2n" rule only applies to odd-sided polygons for an arbitrary convex shape.`;
  } else if (m.returns) {
    note = `This non-regular ${n}-gon closes at step ${2 * n} (period ${period}). ${n % 2 === 1 ? "That is the odd-sided theorem at work." : "Even-sided polygons only close in special positions; a small drag usually breaks this."}`;
  } else {
    note = `This non-regular ${n}-gon misses circle 1 by ${round(m.deviation)} at step ${2 * n}. ${n % 2 === 1 ? "For an odd-sided convex polygon the core should close it; check that the corners are in convex position." : "The closure theorem needs an odd number of sides: try an odd n."}`;
  }

  return {
    n,
    odd: n % 2 === 1,
    t: round(s.t),
    regular,
    corners: s.points.map(xy),
    startPointP: m.finite ? xy(m.P) : null,
    chain: {
      steps: 2 * n,
      circlesDrawn: m.circles.length, // circle 1 plus 2n steps
      period, // first step k > 0 at which circle k+1 matches circle 1, or null
      chainLengthInRange: cl.chainLength,
      closesAt2N: m.returns,
      deviation: round(m.deviation),
      finite: m.finite,
      firstRadius: m.finite ? round(first.r) : null,
    },
    regularClaim: {
      periodIsOneOrTwoN: cl.regularLengthOneOrTwoN,
      // A regular polygon returns after 1 step when t=0 and n is even,
      // after n steps when n is even, and after 2n steps when n is odd.
      expectedPeriod: regular ? (n % 2 === 1 ? 2 * n : (s.t === 0 ? 1 : n)) : null,
    },
    pageClaims: {
      tangenciesOnSides: cl.tangenciesOnSides,
      centersOnBisectors: cl.centersOnBisectors,
      consecutiveTouch: cl.consecutiveTouch,
      returnsAt2N: cl.returnsAt2N,
      allHold: cl.all,
      allCirclesAtCentre: cl.centralChain,
    },
    note,
  };
}

export function actions(): GameActions {
  const C = core();
  return {
    chain_closure: {
      describe:
        "For a convex n-gon (n from 3 to 21) and a point P at parameter t on the first corner's bisector (t = 0 at the bisector foot, t = 1 at the corner), build the touching-circle chain with the real core and report whether it closes at step 2n (C_2n = C_1), the period (first repeat of circle 1), its deviation from closing, and the page's checks that each touch point lies on a side, each centre on a bisector and consecutive circles touch. With no 'points' argument a regular n-gon is used; otherwise pass exactly n [x, y] corners. The theorem closes an arbitrary convex polygon only when n is odd; a regular even n-gon repeats after n steps (or 1 when P is at the foot).",
      args: '{ "n": 5, "t": 0.7 }',
      run: (args) => reading(C, stateFromArgs(C, args)),
    },
    regular_lengths: {
      describe:
        "Sweep the chain length of regular polygons over a list of side counts ns (each an integer from 3 to 21), using the core with P at t = 0.7 on the first bisector. For each n report the measured period, whether the chain closes at step 2n, and the page's 'period is 1 or 2n' regular-polygon claim. The pattern shows the theorem: odd n gives period 2n and closes; even n gives period n (still back at circle 1 by step 2n), and the odd-side requirement is what makes closure hold for non-regular polygons.",
      args: '{ "ns": [3, 4, 5, 6, 7, 8] }',
      run: (args) => {
        const value = args.ns;
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error('"ns" must be a non-empty array of side counts');
        }
        if (value.length > C.N_MAX) throw new Error(`"ns" may list at most ${C.N_MAX} side counts`);
        const ns = value.map((v, i) => {
          const n = Math.round(Number(v));
          if (!Number.isFinite(n) || n < C.N_MIN || n > C.N_MAX) {
            throw new Error(`ns[${i}] must be an integer from ${C.N_MIN} to ${C.N_MAX}`);
          }
          return n;
        });
        return {
          t: C.DEFAULT_T,
          polygons: ns.map((n) => {
            const r = reading(C, C.start({ n, t: C.DEFAULT_T, which: 2 * n }));
            return {
              n,
              odd: r.odd,
              period: r.chain.period,
              closesAt2N: r.chain.closesAt2N,
              regularPeriodIsOneOrTwoN: r.regularClaim.periodIsOneOrTwoN,
              deviation: r.chain.deviation,
            };
          }),
          note:
            "For a regular polygon the chain is periodic: odd n has period 2n (the page's C_2n = C_1), even n has period n. P at the bisector foot (t = 0) collapses an even regular polygon's chain to one circle (period 1). Only odd n guarantees closure once the corners are dragged out of regularity.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported BQTN state version ${stateVersion}`);
  const C = core();
  const saved = state ?? ({} as Json);
  const n = Math.round(num(saved, "n"));
  if (!Number.isInteger(n) || n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`"n" must be an integer from ${C.N_MIN} to ${C.N_MAX}`);
  }
  const points = saved.points;
  if (!Array.isArray(points) || points.length !== n) {
    throw new Error(`"points" must list exactly ${n} corners`);
  }
  const corners = points.map((p, i) => readPoint(p, `points[${i}]`));
  const t = num(saved, "t", C.DEFAULT_T);
  if (!Number.isFinite(t) || t < 0 || t > 1) throw new Error('"t" must be a number between 0 and 1');
  const which = Math.round(num(saved, "which", 2 * n));
  const here: State = { n, points: corners, t, which };
  const readingHere = reading(C, here);

  const marked = which === 2 * n ? "all circles" : `circles C${which + 1} and C${which + 2}`;
  return {
    // The fields Track.state saved, with the same names.
    stateVersion,
    n,
    points: corners.map((p) => ({ x: p.x, y: p.y })),
    t,
    which,
    result: C.result(here), // an illustration: nothing can be won or lost
    // What the core adds at exactly this position.
    valid: readingHere.chain.finite,
    core: readingHere,
    marked,
    note: `Track.state saved ${n} corners, t = ${t} and which = ${which} (${marked}). The core rebuilds the bisectors and all ${2 * n + 1} circles: ${readingHere.note}`,
  };
}
