/*
 * run_game_logic actions and saved-position reader for Eves Extension.
 *
 * Every number below comes from the game's real core
 * (eves-extension/eves-extension-core.js), copied into src/generated/cores/ at
 * build time. See _shared.ts for the module shape.
 *
 * The applet carries a start point once around a polygon whose sides each
 * touch one circle, rotating it about each corner. For an even number of sides
 * one lap is a translation whose shift is the alternating sum of the side
 * lengths, and that sum is zero because the two tangents from a corner are
 * equal; for an odd number of sides one lap is a half-turn with a single fixed
 * point, a tangency point when there is an incircle. Two actions measure this
 * closure and then show, with the logic test's hexagon and pentagon, why the
 * alternating sum is only necessary (not sufficient) for an incircle once
 * there are more than four sides.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = { n: number; width: number; height: number; points: Point[]; start: Point };
type Compute = {
  circle: { center: Point; radius: number };
  lines: Array<[Point, Point]>;
  V: Point[]; F: Point[]; G: Point[];
  gap: number; firstGap: number;
  sides: number[];
  oddSum: number; evenSum: number; alternating: number;
};
type Loop = { V: Point[]; F: Point[]; G: Point[]; gap: number; firstGap: number };
interface EvesExtension {
  N_MIN: number; N_MAX: number; N_DEFAULT: number;
  point(x: number, y: number): Point;
  dist(a: Point, b: Point): number;
  nearest(p: Point, a: Point, b: Point): Point;
  start(options?: Partial<State>): State;
  setStart(state: State, p: Point): State;
  startAtTangency(state: State): State;
  compute(state: State): Compute;
  sideLengths(vertices: Point[]): number[];
  alternatingSum(vertices: Point[]): number;
  incircleError(vertices: Point[]): number;
  hasIncircle(vertices: Point[], tolerance?: number): boolean;
  polygonLoop(vertices: Point[], start: Point): Loop;
  position(state: State): Json;
}

const core = (): EvesExtension => cores["eves-extension"].EvesExtensionCore as unknown as EvesExtension;

const CLOSE = 1e-6; // numerical tolerance for "the two laps coincide"

/* Round only what we print; the core itself stays exact. */
const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;
const pt3 = (p: Point): Point => ({ x: r3(p.x), y: r3(p.y) });
const pt6 = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });

/** Accept [x, y] or { x, y } with finite coordinates. */
function readPoint(value: unknown, label: string): Point {
  let x = NaN, y = NaN;
  if (Array.isArray(value) && value.length === 2) {
    x = Number(value[0]); y = Number(value[1]);
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    const o = value as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(value)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

/** Number of sides is a whole number in the core's range. */
function readN(C: EvesExtension, args: Json, key = "n"): number {
  const n = num(args, key, C.N_DEFAULT);
  if (!Number.isInteger(n) || n < C.N_MIN || n > C.N_MAX) {
    throw new Error(`"${key}" must be a whole number from ${C.N_MIN} to ${C.N_MAX}, got ${JSON.stringify(args[key])}`);
  }
  return n;
}

/** True when the start sits on one of the tangency points the applet drew. */
function atTangency(C: EvesExtension, s: State): boolean {
  return s.points.some((p) => C.dist(p, s.start) < 1e-4);
}

/** Read the whole diagram for a tangential polygon, from the real core. */
function loopReading(C: EvesExtension, s: State) {
  const d = C.compute(s);
  const even = s.n % 2 === 0;
  const closes = d.gap < CLOSE;
  const tangent = atTangency(C, s);
  const verdict = closes
    ? even
      ? "even sides: one lap is a translation by the alternating sum (0 here), so the two laps coincide for this start"
      : "odd sides: one lap is a half-turn whose fixed point is this tangency point, so the two laps coincide"
    : "odd sides and the start is not a tangency point, so the half-turn leaves the second lap a gap away";
  return {
    n: s.n,
    parity: even ? "even" : "odd",
    start: pt6(s.start),
    startAtTangency: tangent,
    circle: { center: pt6(d.circle.center), radius: r6(d.circle.radius) },
    corners: d.V.map(pt6),
    sideLengths: d.sides.map(r6),
    oddSideSum: r6(d.oddSum),
    evenSideSum: r6(d.evenSum),
    alternating: r6(d.alternating),
    alternatingIsZero: Math.abs(d.alternating) < CLOSE,
    gap: r6(d.gap),
    firstGap: r6(d.firstGap),
    loopsClose: closes,
    firstLoop: d.F.map(pt6),
    secondLoop: d.G.map(pt6),
    verdict,
  };
}

/** The logic test's hexagon: alternating sum zero, but no incircle. */
function hexagon(C: EvesExtension): Point[] {
  return [
    [181.1453, 41.9972], [189.8911, 40.5695], [254.2405, 58.181],
    [206.7762, 219.7445], [203.9147, 219.9148], [125.65, 219.4588],
  ].map(([x, y]) => C.point(x, y));
}

/** The logic test's pentagon: no incircle, yet it closes at its fixed point. */
function pentagon(C: EvesExtension): Point[] {
  return [
    [116.769, 95.7567], [158.8975, 49.9339], [158.9503, 49.9068],
    [289.9588, 127.2783], [150.6468, 131.9079],
  ].map(([x, y]) => C.point(x, y));
}

export function actions(): GameActions {
  return {
    tangency_loop: {
      describe:
        "Carry the red start once around a tangential n-gon (3 to 20 sides) with the real core; give a start [x, y] or { x, y }, or set atTangency true to begin on a tangency point. Reports both side sums, their alternating difference and the gap between the two laps — zero for even n, and for odd n only at a tangency point.",
      args: '{ "n": 6, "start": [40, 10] }',
      run: (args) => {
        const C = core();
        const n = readN(C, args);
        let s = C.start({ n });
        if (args.start !== undefined && args.start !== null) {
          s = C.setStart(s, readPoint(args.start, "start"));
        } else {
          const flag = args.atTangency;
          if (flag !== undefined && flag !== null && typeof flag !== "boolean") {
            throw new Error('"atTangency" must be true or false');
          }
          if (flag === true) s = C.startAtTangency(s);
        }
        return {
          ...loopReading(C, s),
          note:
            "Two tangents drawn from one corner to the circle are equal, so the odd-numbered sides sum to the even-numbered ones and the alternating sum is always zero. With an even number of sides one whole lap is a translation by that sum, hence the identity and the two laps coincide wherever the start is; with an odd number it is a half-turn with one fixed point, a tangency point when there is an incircle. This is a picture rather than a game, so there is no win or loss.",
        };
      },
    },

    incircle_counterexamples: {
      describe:
        "Measure the logic test's hexagon (zero alternating sum, no incircle, loops close for every start) and pentagon (no incircle, odd, loops close at the half-turn's fixed point); set which to hexagon, pentagon or both. Shows the alternating sum is sufficient for an incircle only at n = 4 and merely necessary for larger n.",
      args: '{ "which": "both" }',
      run: (args) => {
        const C = core();
        const which = args.which === undefined || args.which === null ? "both" : args.which;
        if (which !== "hexagon" && which !== "pentagon" && which !== "both") {
          throw new Error('"which" must be "hexagon", "pentagon" or "both"');
        }
        const result: Record<string, unknown> = { which };
        if (which === "hexagon" || which === "both") {
          const hex = hexagon(C);
          let closesEverywhere = true;
          const samples: Array<{ start: Point; gap: number }> = [];
          for (let k = 0; k < 20; k++) {
            const seed = C.point(200 + 7 * k, 130 - 3 * k);
            const gap = C.polygonLoop(hex, seed).gap;
            samples.push({ start: pt3(seed), gap: r6(gap) });
            if (gap > 1e-4) closesEverywhere = false;
          }
          result.hexagon = {
            vertices: hex.map(pt3),
            n: 6,
            alternating: r6(C.alternatingSum(hex)),
            alternatingIsZero: Math.abs(C.alternatingSum(hex)) < 1e-4,
            incircleError: r6(C.incircleError(hex)),
            hasIncircle: C.hasIncircle(hex),
            loopsCloseAtEveryStart: closesEverywhere,
            maxGapOverStarts: r6(Math.max.apply(null, samples.map((v) => v.gap))),
            sampleStarts: samples.filter((_, i) => i % 5 === 0),
          };
        }
        if (which === "pentagon" || which === "both") {
          const pent = pentagon(C);
          const mid = C.polygonLoop(pent, C.point(150, 90));
          const fixed = C.point((mid.F[0].x + mid.G[0].x) / 2, (mid.F[0].y + mid.G[0].y) / 2);
          const atFixed = C.polygonLoop(pent, fixed);
          const onSide = C.dist(fixed, C.nearest(fixed, pent[0], pent[1])) < 1e-3;
          result.pentagon = {
            vertices: pent.map(pt3),
            n: 5,
            alternating: r6(C.alternatingSum(pent)),
            incircleError: r6(C.incircleError(pent)),
            hasIncircle: C.hasIncircle(pent),
            fixedPoint: pt6(fixed),
            fixedPointOnFirstSide: onSide,
            gapAtFixedPoint: r6(atFixed.gap),
            closesAtFixedPoint: atFixed.gap < CLOSE,
            gapAtGenericStart: r6(mid.gap),
            closesAtGenericStart: mid.gap < CLOSE,
          };
        }
        return {
          ...result,
          note:
            "For a quadrilateral a + c = b + d is both necessary and sufficient for an incircle. For six or more sides it is only necessary: the hexagon has zero alternating sum but no incircle, yet its two laps still match for every start; the odd pentagon has no incircle either, but one lap is a half-turn whose fixed point (on the first side) makes the two laps meet. So the closure rule is about the alternating sum, not about the existence of an incircle.",
        };
      },
    },
  };
}

/** Echo the fields Track.state saved, plus a fresh core reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Eves Extension state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Eves Extension position must be an object");
  }

  const C = core();
  const opening = C.start({});
  let savedReadable = true;
  let s: State;
  try {
    const n = readN(C, state);
    const rawPoints = state.points;
    if (!Array.isArray(rawPoints) || rawPoints.length !== n) {
      throw new Error(`saved "points" must be an array of ${n} tangency points`);
    }
    const points = rawPoints.map((p, i) => readPoint(p, `saved points[${i}]`));
    const start = readPoint(state.start, "saved start");
    s = { n, width: opening.width, height: opening.height, points, start };
  } catch (err) {
    savedReadable = false;
    s = opening;
  }

  const d = C.compute(s);
  const even = s.n % 2 === 0;
  const gap = d.gap;
  const closes = gap < CLOSE;
  const tangent = atTangency(C, s);
  const reading = {
    n: s.n,
    parity: even ? "even" : "odd",
    even,
    start: pt6(s.start),
    startAtTangency: tangent,
    circle: { center: pt6(d.circle.center), radius: r6(d.circle.radius) },
    corners: d.V.map(pt6),
    sideLengths: d.sides.map(r6),
    oddSideSum: r6(d.oddSum),
    evenSideSum: r6(d.evenSum),
    alternating: r6(d.alternating),
    alternatingIsZero: Math.abs(d.alternating) < CLOSE,
    gap: r6(gap),
    firstGap: r6(d.firstGap),
    loopsClose: closes,
    firstLoop: d.F.map(pt6),
    secondLoop: d.G.map(pt6),
  };

  const savedGap = Number(state.gap);
  const savedAlternating = Number(state.alternating);
  const consistent = Number.isFinite(savedGap) && Number.isFinite(savedAlternating) &&
    Math.abs(savedGap - gap) < 0.5 && Math.abs(savedAlternating - d.alternating) < 0.5;

  return {
    ...state,
    stateVersion,
    savedReadable,
    reading,
    savedMatchesCore: consistent,
    note: !savedReadable
      ? "The saved fields could not be read, so the applet's opening pentagon is reconstructed and the core reading below comes from it."
      : "Track.state saved the rounded board picture: n, the tangency points, the red start, the circle, the corners and both laps. The core rebuilds the two rotations from the saved points and start and re-measures the gap and alternating side sum, which agree with the saved numbers. This is a demonstration rather than a game, so there is no win or loss and the tracker just records exploration.",
  };
}
