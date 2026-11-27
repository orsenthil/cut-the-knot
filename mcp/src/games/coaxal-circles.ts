/*
 * run_game_logic actions and saved-position reader for Coaxal Circles.
 *
 * Two points A and B on a horizontal line carry two pencils of circles: the
 * Apollonian circles have their centres on line AB and never meet each other,
 * while the circles through A and B have their centres on the perpendicular
 * bisector. Every circle of one pencil cuts every circle of the other at right
 * angles (the Coaxal Circles Theorem): with s = |AB|/2, an Apollonian circle at
 * distance t from the midpoint has radius √(t² − s²) and a circle through A and
 * B whose centre is u from line AB has radius √(u² + s²); their centres are
 * √(t² + u²) apart, and that equals the sum of the two radii squared. The
 * perpendicular bisector is the common radical axis of the first pencil and
 * line AB is the common radical axis of the second.
 *
 * The core (coaxal-circles/coaxal-circles-core.js, copied into
 * src/generated/cores/ at build time) supplies every circle and every power
 * below. See _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["coaxal-circles"].CoaxalCirclesCore as any;

type Point = { x: number; y: number };

const r4 = (v: number): number => Number(v.toFixed(4));
const r6 = (v: number): number => Number(v.toFixed(6));
const xy = (p: any): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r4(p.x), y: r4(p.y) } : null;

/** Accept the page's {x,y} points and the tutor's [x,y] arguments alike. */
function readPoint(v: unknown, label: string, fallback: Point): Point {
  if (v === undefined || v === null) return { x: fallback.x, y: fallback.y };
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y]`);
    x = Number(v[0]); y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** Build the core's real state from A, B and either flat or nested options. */
function readState(v: Json) {
  const C = core();
  const home = C.start({});
  const o = v.options && typeof v.options === "object" ? v.options as Json : v;
  const A = readPoint(v.A, "A", home.A);
  const B = readPoint(v.B, "B", home.B);
  if (!(Math.abs(B.x - A.x) > 1e-9)) {
    throw new Error('"A" and "B" must have different x coordinates to make two pencils');
  }
  const state = {
    A, B,
    options: {
      n: C.clampN(num(o, "n", C.N_DEFAULT)),
      familyOne: o.familyOne === undefined ? true : !!o.familyOne,
      familyTwo: o.familyTwo === true,
      names: o.names === true,
    },
    explored: v.explored === true,
  };
  return { state, g: C.geometry(state) };
}

const circleView = (c: any): Json | null => c && Number.isFinite(c.r)
  ? { centre: xy(c.c), radius: r6(c.r) }
  : null;

function geometryView(C: any, g: any): Json {
  return {
    A: xy(g.A),
    B: xy(g.B),
    midpoint: xy(C.point(g.Xc, g.y)),
    halfSeparation: r6(g.s),
    separation: r6(2 * g.s),
    lineOfCentres: { from: xy(g.axis.p), to: xy(g.axis.q) },
    perpendicularBisector: { from: xy(g.bisector.p), to: xy(g.bisector.q) },
  };
}

/** d² − (r1² + r2²) for every cross-pair of the two pencils. */
function orthogonality(f1: any[], f2: any[]) {
  let pairs = 0, orthogonal = 0, worst = 0;
  const examples: Json[] = [];
  for (const a of f1) {
    for (const b of f2) {
      const dx = a.c.x - b.c.x, dy = a.c.y - b.c.y;
      const d2 = dx * dx + dy * dy;
      const residual = d2 - (a.r * a.r + b.r * b.r);
      const rel = Math.abs(residual) / Math.max(1, d2);
      pairs++;
      if (rel < 1e-9) orthogonal++;
      worst = Math.max(worst, rel);
      if (examples.length < 3) {
        examples.push({
          onLineOfCentres: circleView(a),
          throughAB: circleView(b),
          centreDistance: r6(Math.sqrt(d2)),
          dSquared: r6(d2),
          sumOfRadiiSquared: r6(a.r * a.r + b.r * b.r),
          residual: r6(residual),
        });
      }
    }
  }
  return {
    pairsCompared: pairs,
    orthogonalPairs: orthogonal,
    worstRelativeResidual: r6(worst),
    allOrthogonal: pairs > 0 && orthogonal === pairs,
    examples,
  };
}

/** Powers sampled along a candidate radical axis, using the core's power(). */
function powerSpread(C: any, circles: any[], points: Point[]): Json[] {
  return points.map((p) => {
    const powers = circles.map((c) => C.power(c, p));
    const lo = Math.min(...powers), hi = Math.max(...powers);
    return {
      point: xy(p),
      powers: powers.map(r6),
      maxSpread: r6(hi - lo),
      constant: hi - lo < 1e-6 * Math.max(1, Math.abs(hi)),
    };
  });
}

export function actions(): GameActions {
  return {
    pencils: {
      describe:
        "Given A and B (each [x,y] or {x,y} on the page's 600 x 440 board, defaulting to the applet's opening points) and an optional integer n (1..100, default 5), build the two coaxal pencils with the real core: the Apollonian circles with centres on line AB and the circles through A and B with centres on the perpendicular bisector. Reports the midpoint, half-separation, both axes, the circle counts and a sample of the circles, and tests d² = r1² + r2² for every pair drawn from the two pencils — every pair crosses at right angles, which is the Coaxal Circles Theorem.",
      args: '{ "A": [254, 220], "B": [350, 220], "n": 5 }',
      run: (args) => {
        const C = core();
        const { state, g } = readState(args);
        const f1 = C.familyOne(state);
        const f2 = C.familyTwo(state);
        return {
          geometry: geometryView(C, g),
          counts: { apollonian: f1.length, throughAB: f2.length },
          apollonianSample: f1.slice(0, 8).map((c: any) => ({
            k: c.k, side: c.side, ...circleView(c),
          })),
          throughABSample: f2.slice(0, 8).map((c: any) => ({
            k: c.k, side: c.side, diameter: c.diameter === true, ...circleView(c),
          })),
          orthogonality: orthogonality(f1, f2),
          status: C.describe(state),
          note:
            "An Apollonian circle at distance t from the midpoint has radius √(t² − s²), and a circle through A and B with its centre u off line AB has radius √(u² + s²), where s = |AB|/2. Their centres are √(t² + u²) apart and the two radii squares sum to t² + u², so d² = r1² + r2² and the circles meet at right angles. The perpendicular bisector is the straight-line member of the Apollonian pencil, and the circle on AB as diameter is the member of the other pencil centred at the midpoint.",
        };
      },
    },

    radical_axis: {
      describe:
        "For the same two points A and B and optional n, check the radical-axis half of the theorem: at points on the perpendicular bisector x = Xc every Apollonian circle has the same power (so that line is their common radical axis), and at points on line AB every circle through A and B has the same power (so AB is their common radical axis). Optional t and u (default 40 and 30) build the core's tangentPair at A and check that its two circles are orthogonal too.",
      args: '{ "A": [254, 220], "B": [350, 220], "n": 5, "t": 40, "u": 30 }',
      run: (args) => {
        const C = core();
        const { state, g } = readState(args);
        const f1 = C.familyOne(state);
        const f2 = C.familyTwo(state);
        const t = num(args, "t", 40);
        const u = num(args, "u", 30);
        if (!(t > 0) || !(u > 0)) {
          throw new Error('"t" and "u" must be positive distances from A along the two axes');
        }
        const pair = C.tangentPair(state.A, t, u);
        const d2 = (pair[0].c.x - pair[1].c.x) ** 2 + (pair[0].c.y - pair[1].c.y) ** 2;
        const sumR2 = pair[0].r ** 2 + pair[1].r ** 2;
        const onBisector = powerSpread(C, f1, [-g.s, 0, g.s].map((v) => C.point(g.Xc, g.y + v)));
        const onAB = powerSpread(C, f2, [-g.s, 0, g.s].map((h) => C.point(g.Xc + h, g.y)));
        return {
          geometry: geometryView(C, g),
          apollonianCommonRadicalAxis: {
            line: { from: xy(g.bisector.p), to: xy(g.bisector.q) },
            samples: onBisector,
            allConstant: onBisector.every((s) => s.constant === true),
          },
          throughABCommonRadicalAxis: {
            line: { from: xy(g.axis.p), to: xy(g.axis.q) },
            samples: onAB,
            allConstant: onAB.every((s) => s.constant === true),
          },
          tangentPairAtA: {
            t, u,
            circles: pair.map(circleView),
            centreDistanceSquared: r6(d2),
            sumOfRadiiSquared: r6(sumR2),
            orthogonalityResidual: r6(d2 - sumR2),
            orthogonal: Math.abs(d2 - sumR2) < 1e-6 * Math.max(1, d2),
          },
          status: C.describe(state),
          note:
            "For the Apollonian circles the power at (Xc, y + v) is v² + s², independent of which circle you use, so the perpendicular bisector is their radical axis; for the circles through A and B the power at (Xc + h, y) is h² − s², independent of the circle, so line AB is theirs. Each pencil's radical axis is the other's line of centres, which is why the pencils are orthogonal. The tangentPair circles at A are built on the two perpendicular directions and satisfy d² = t² + u² = r1² + r2² as well.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus a fresh core reading. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Coaxal Circles state version ${stateVersion}`);
  const C = core();
  const source = state && typeof state === "object" ? state : ({} as Json);
  try {
    const { state: saved, g } = readState(source);
    const f1 = C.familyOne(saved);
    const f2 = C.familyTwo(saved);
    const options = saved.options as Json;
    return {
      stateVersion,
      saved: {
        A: xy(saved.A),
        B: xy(saved.B),
        options: { ...options },
        explored: saved.explored,
      },
      geometry: geometryView(C, g),
      circlesDrawn: {
        apollonian: options.familyOne ? f1.length : 0,
        throughAB: options.familyTwo ? f2.length : 0,
      },
      orthogonality: orthogonality(f1, f2),
      radicalAxes: {
        apollonian: { from: xy(g.bisector.p), to: xy(g.bisector.q) },
        throughAB: { from: xy(g.axis.p), to: xy(g.axis.q) },
      },
      explored: saved.explored,
      status: C.describe(saved),
      note:
        "The saved points and options rebuild the page's two pencils. Every pair of circles, one from each pencil, is orthogonal (d² = r1² + r2²), and the two axes are each other's line of centres and common radical axis. This is a drawing, not a game: there is no win or loss, so the record marks it explored once the player has changed the picture.",
    };
  } catch (err) {
    return {
      stateVersion,
      saved: source,
      error: err instanceof Error ? err.message : String(err),
      note:
        "This saved position cannot be read as a coaxal-circles diagram: A and B must be finite points with different x coordinates, with an optional n (1..100) and the three display options.",
    };
  }
}
