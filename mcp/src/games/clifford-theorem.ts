/*
 * run_game_logic actions and saved-position reader for Clifford Theorem.
 *
 * The real core is clifford-theorem/clifford-theorem-core.js, copied into
 * src/generated/cores/ at build time. A state is four circles, each held by a
 * centre and a rim point; the core's analyse() takes the first of its three
 * cyclic orders whose neighbouring circles all cross, intersects those four
 * pairs, and searches its eight choices of one crossing from each pair for a
 * red circle through four z points and a blue circle through the other four w
 * points. Every number here is measured by that core, in the applet's 600 x
 * 450 board units with y down. See _shared.ts for the module shape.
 *
 * Four points are concyclic exactly when their complex cross ratio is real.
 * The page's algebra claims that the product of its four join ratios (1)-(4)
 * is its expression (5), which the logic test disproved; the identity that
 * does hold is (5) = (1)*(3)/((2)*(4)). Since each join ratio is real, the
 * corrected identity still proves that a real z ratio forces a real w ratio.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["clifford-theorem"].CliffordTheoremCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type CircleDef = { center: Point; rim: Point };
type Ring = CircleDef[];
type Drawing = { x: number; y: number; r: number };
type Found = { tries: number[]; red: Drawing; blue: Drawing; z: Point[]; w: Point[] };
type Analysis = {
  circles: Drawing[];
  order: number[] | null;
  pairs: Point[][];
  found: Found[];
  valid: boolean;
};
type Complex = [number, number];

const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const finite = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : round(v, 9);
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const drawing = (c: Drawing | null | undefined) =>
  c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)
    ? { center: pt(c), radius: round(c.r) }
    : null;

const asNumber = (v: unknown): number => (typeof v === "number" || typeof v === "string" ? Number(v) : NaN);

function readPoint(value: unknown, name: string): Point {
  if (Array.isArray(value) && value.length === 2) {
    const x = asNumber(value[0]), y = asNumber(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  } else if (value && typeof value === "object") {
    const o = value as Json;
    const x = asNumber(o.x), y = asNumber(o.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  throw new Error(`"${name}" must be [x, y] or { "x": ..., "y": ... } with finite numbers`);
}

function readRing(value: unknown, name: string): Ring {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error(`"${name}" must be an array of exactly four circles, each { center, rim }`);
  }
  return value.map((entry, i) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`${name}[${i}] must be a circle { center, rim }`);
    }
    const c = entry as Json;
    return { center: readPoint(c.center, `${name}[${i}].center`), rim: readPoint(c.rim, `${name}[${i}].rim`) };
  });
}

/** The opening ring is used when no circles are supplied. */
function ringFrom(args: Json): Ring {
  return args.circles === undefined || args.circles === null
    ? (core().start({}) as Ring)
    : readRing(args.circles, "circles");
}

const csub = (u: Complex, v: Complex): Complex => [u[0] - v[0], u[1] - v[1]];
const cdiv = (u: Complex, v: Complex): Complex => {
  const d = v[0] * v[0] + v[1] * v[1];
  if (!Number.isFinite(d) || d < 1e-18) return [NaN, NaN];
  return [(u[0] * v[0] + u[1] * v[1]) / d, (u[1] * v[0] - u[0] * v[1]) / d];
};

/** [(a-c)/(b-c)] / [(a-d)/(b-d)], the page's cross-ratio test for concyclicity. */
const crossRatio = (p: Point[]): Complex => {
  const a: Complex = [p[0].x, p[0].y];
  const b: Complex = [p[1].x, p[1].y];
  const c: Complex = [p[2].x, p[2].y];
  const d: Complex = [p[3].x, p[3].y];
  return cdiv(cdiv(csub(a, c), csub(b, c)), cdiv(csub(a, d), csub(b, d)));
};
const isReal = (z: Complex): boolean =>
  Number.isFinite(z[0]) && Number.isFinite(z[1]) && Math.abs(z[1]) <= 1e-6 * Math.max(1, Math.abs(z[0]));
const complexOut = (z: Complex): { re: number; im: number } | null =>
  Number.isFinite(z[0]) && Number.isFinite(z[1]) ? { re: round(z[0], 9), im: round(z[1], 9) } : null;

function reading(C: Core, s: Ring) {
  const a = C.analyse(s) as unknown as Analysis;
  const circles = a.circles.map(drawing);
  if (!a.valid || !a.order || a.pairs.length !== 4) {
    return {
      ringClosed: false,
      circles,
      order: null as number[] | null,
      ring: null as number[] | null,
      joins: [] as unknown[],
      crossings: [] as unknown[],
      tries: [] as unknown[],
      cliffordPairs: 0,
      foundTries: [] as number[][],
      checks: {
        neighboursMeet: false,
        concyclicZGivesConcyclicW: null as boolean | null,
        zConcyclicExactlyWhenWConcyclic: null as boolean | null,
        zRealExactlyWhenWReal: null as boolean | null,
        foundPairRatiosBothReal: false,
        everyFoundPairHasBothCircles: false,
      },
      note:
        "The four circles do not form a ring in any of the applet's three orders (1-2-3-4, 1-2-4-3, 1-3-2-4): at least one neighbouring pair fails the strict two-circle meeting test. Drag a rim handle until every neighbour crosses to make the Clifford configuration appear.",
    };
  }

  const order = a.order;
  const joins = [0, 1, 2, 3].map((k) => {
    const i = order[k], j = order[(k + 1) % 4];
    const ci = a.circles[i], cj = a.circles[j];
    const d = C.distance(ci, cj);
    return {
      from: i + 1,
      to: j + 1,
      centresApart: round(d),
      radiiSum: round(ci.r + cj.r),
      radiiDifference: round(Math.abs(ci.r - cj.r)),
      cross: Boolean(C.meet(ci, cj)),
      crossings: a.pairs[k].map((p) => pt(p)),
    };
  });

  const tries = C.TRIES.map((choice: number[]) => {
    const [t0, t1, t2] = choice;
    const red = C.getCircle(a.pairs, 0, t0, t1) as Drawing;
    const blue = C.getCircle(a.pairs, 1, 1 - t0, 1 - t1) as Drawing;
    const z = [a.pairs[0][0], a.pairs[1][t0], a.pairs[2][t1], a.pairs[3][t2]];
    const w = [a.pairs[0][1], a.pairs[1][1 - t0], a.pairs[2][1 - t1], a.pairs[3][1 - t2]];
    const zr = z.map((p) => C.distance(red, p) - red.r);
    const wr = w.map((p) => C.distance(blue, p) - blue.r);
    const ratioZ = crossRatio(z), ratioW = crossRatio(w);
    return {
      tries: [t0, t1, t2],
      red: drawing(red),
      blue: drawing(blue),
      z: z.map(pt),
      w: w.map(pt),
      zResiduals: zr.map(finite),
      wResiduals: wr.map(finite),
      zConcyclic: zr.every((r) => Math.abs(r) < C.ON_CIRCLE),
      wConcyclic: wr.every((r) => Math.abs(r) < C.ON_CIRCLE),
      crossRatioZ: complexOut(ratioZ),
      crossRatioW: complexOut(ratioW),
      zRatioReal: isReal(ratioZ),
      wRatioReal: isReal(ratioW),
      appletFindsIt: a.found.some(
        (f) => f.tries[0] === t0 && f.tries[1] === t1 && f.tries[2] === t2,
      ),
    };
  });

  const found = tries.filter((t) => t.appletFindsIt);
  const withRatios = tries.filter((t) => t.crossRatioZ !== null && t.crossRatioW !== null);
  const worst = found.length
    ? Math.max(...found.flatMap((t) => [...t.zResiduals, ...t.wResiduals].map((r) => Math.abs(r ?? Infinity))))
    : null;
  const firstZRatio = found[0]?.crossRatioZ?.re ?? null;
  const firstWRatio = found[0]?.crossRatioW?.re ?? null;
  const pairLine = found.length
    ? `${found.length} give a red circle through four z crossings, and in every one of them the four w crossings lie on the blue circle (largest residual ${finite(worst)} board units). ` +
      (firstZRatio !== null
        ? `For the first pair the z cross ratio is ${firstZRatio} and the w cross ratio is ${firstWRatio}, both real; their values need not match, since the two ratios use different point orderings. `
        : "")
    : "None of the eight choices puts four crossings on a circle, so no red/blue Clifford pair is drawn here. ";
  return {
    ringClosed: true,
    circles,
    order,
    ring: order.map((n) => n + 1),
    joins,
    crossings: a.pairs.map((pair) => pair.map(pt)),
    tries,
    cliffordPairs: a.found.length,
    foundTries: found.map((t) => t.tries),
    worstFoundResidual: finite(worst),
    checks: {
      neighboursMeet: joins.every((j) => j.cross),
      concyclicZGivesConcyclicW: tries.every((t) => !t.zConcyclic || t.wConcyclic),
      zConcyclicExactlyWhenWConcyclic: tries.every((t) => t.zConcyclic === t.wConcyclic),
      zRealExactlyWhenWReal: withRatios.every((t) => t.zRatioReal === t.wRatioReal),
      foundPairRatiosBothReal: found.every((t) => t.zRatioReal && t.wRatioReal),
      everyFoundPairHasBothCircles: found.every((t) => t.zConcyclic && t.wConcyclic),
    },
    note:
      `The ring closes in the order ${order.map((n) => n + 1).join("-")} and the core searches all ${C.TRIES.length} choices of one crossing from each join. ` +
      pairLine +
      "Four points are concyclic exactly when their cross ratio is real. The page's algebra step - the product of its four join ratios (1)-(4) equals expression (5) - is wrong; the true identity is (5) = (1)*(3)/((2)*(4)). Because every join ratio is real, the corrected identity still forces the z ratio real and then the w ratio real: concyclic z gives concyclic w.",
  };
}

export function actions(): GameActions {
  return {
    chain: {
      describe:
        "For four circles, each given by a centre and a rim point [x, y] on the 600 x 450 board (y down), build the ring in the first cyclic order whose neighbours all cross and report all eight ways of picking one crossing from each join, with the red circle through the four z's, the blue circle through the four w's, their distance residuals and cross-ratio realness. Clifford's condition holds when the z's are concyclic (real z ratio): then the w's are concyclic too; the page's product-of-ratios step is wrong but its corrected identity (5) = (1)*(3)/((2)*(4)) still proves this. Omit circles for the opening ring.",
      args:
        '{ "circles": [ {"center": [245, 170], "rim": [180, 105]}, {"center": [355, 170], "rim": [420, 105]}, ' +
        '{"center": [355, 280], "rim": [420, 345]}, {"center": [245, 280], "rim": [180, 345]} ] }',
      run: (args) => {
        const C = core();
        return reading(C, ringFrom(args));
      },
    },
    drag_handle: {
      describe:
        "Move one circle's centre or rim handle from the opening ring (or from the circles you pass) to a new [x, y] point, as a drag on the page does; index is 0-3 and which is center or rim. Reports the new ring order, how many Clifford pairs remain, and whether concyclic z's still come with concyclic w's.",
      args: '{ "index": 0, "which": "rim", "point": [160, 90] }',
      run: (args) => {
        const C = core();
        const index = Math.trunc(num(args, "index", 0));
        if (!(index >= 0 && index < 4)) throw new Error('"index" must be 0, 1, 2 or 3');
        const which = args.which === undefined || args.which === null ? "rim" : args.which;
        if (which !== "center" && which !== "rim") throw new Error('"which" must be "center" or "rim"');
        const to = readPoint(args.point, "point");
        const m = reading(C, C.withPoint(ringFrom(args), index, which, to));
        return {
          moved: { circle: index + 1, which, to: pt(to) },
          ...m,
          note: `Circle ${index + 1}'s ${which} handle moved to (${round(to.x)}, ${round(to.y)}). ` + m.note,
        };
      },
    },
  };
}

/** Track.state saves the four centre/rim handle pairs; the core rebuilds the rest. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Clifford Theorem state version ${stateVersion}`);
  if (!Array.isArray(state)) {
    throw new Error("saved Clifford Theorem position must be an array of four circles");
  }
  const C = core();
  const saved = readRing(state, "state");
  const m = reading(C, C.start({ circles: saved }) as Ring);
  return {
    stateVersion,
    state: saved.map((c) => ({ center: pt(c.center), rim: pt(c.rim) })),
    core: m,
    ringClosed: m.ringClosed,
    order: m.order,
    ring: m.ring,
    joins: m.joins,
    crossings: m.crossings,
    cliffordPairs: m.cliffordPairs,
    foundTries: m.foundTries,
    checks: m.checks,
    note:
      "Track.state saved the four circles as centre/rim handle pairs, with y down on the 600 x 450 board. " +
      "The core rebuilds their radii, the crossings of neighbouring circles and any red/blue Clifford pairs from them. " +
      m.note,
  };
}
