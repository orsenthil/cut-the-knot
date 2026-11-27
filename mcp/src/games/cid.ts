/*
 * run_game_logic actions and saved-position reader for CID (Consecutive
 * Isosceles Decomposition). The real core lives in cid/cid-core.js and is
 * copied into src/generated/cores/ at build time. It reproduces the applet's
 * construction: from the base B, C of an isosceles triangle with apex A and
 * TopAngle = 180/n, draw a circle of radius |BC| about the last point and meet
 * the line from the point before it to A; every step has that same length, so
 * each slice is isosceles and its base angles step by 180/n. The chain lands on
 * A exactly for odd denominators n = 2k+1 (k slices, gamma = 180/(2k+1));
 * even denominators stop about half a step short. See _shared.ts for the
 * module shape.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["cid"].CidCore;
type Point = { x: number; y: number };
type State = {
  n: number;
  width: number;
  height: number;
  showNames: boolean;
  A: Point;
  B: Point;
  C: Point;
};
type Slice = { points: Point[]; baseAngle: number; apexAngle: number; farAngle: number };

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const pt = (p: Point): { x: number; y: number } => ({ x: round(p.x), y: round(p.y) });

/** Accept [x, y] arrays as well as the page's { x, y } points. */
function readPoint(args: Json, key: string): Point {
  const v = args[key];
  if (Array.isArray(v)) {
    const a = numArray(args, key);
    if (a.length !== 2) throw new Error(`argument "${key}" must be [x, y]`);
    return { x: a[0], y: a[1] };
  }
  if (v !== undefined && v !== null && typeof v === "object") {
    const o = v as Json;
    return { x: num(o, "x"), y: num(o, "y") };
  }
  throw new Error(`missing argument "${key}": give [x, y] or { "x": ..., "y": ... }`);
}

/** The applet's spinner holds integers 2..178; reject anything else. */
function readN(args: Json, key = "n"): number {
  const C = core();
  const raw = num(args, key, C.DEFAULT_N);
  const n = Math.round(raw);
  if (!Number.isInteger(raw) || n < C.MIN_N || n > C.MAX_N) {
    throw new Error(`${key} must be an integer from ${C.MIN_N} to ${C.MAX_N}, got ${JSON.stringify(args[key])}`);
  }
  return n;
}

/** A fresh diagram for n, or the page's saved corners when A, B, C are given. */
function readState(args: Json): State {
  const C = core();
  const n = readN(args);
  const width = num(args, "width", C.WIDTH);
  const height = num(args, "height", C.HEIGHT);
  if (!(width > 0) || !(height > 0)) throw new Error('"width" and "height" must be positive');
  const corners = ["A", "B", "C"].filter((k) => args[k] !== undefined && args[k] !== null);
  if (corners.length === 0) {
    return C.start({ n, width, height, showNames: Boolean(args.showNames) }) as State;
  }
  if (corners.length !== 3) throw new Error("give all three corners A, B and C, or none");
  return C.start({
    n, width, height, showNames: Boolean(args.showNames),
    points: { A: readPoint(args, "A"), B: readPoint(args, "B"), C: readPoint(args, "C") },
  }) as State;
}

/** Everything the core says about one diagram, in degrees and page coordinates. */
function reading(s: State) {
  const C = core();
  const gamma = C.topAngle(s);
  const points = C.compute(s) as Point[];
  const slices = C.triangles(s) as Slice[];
  const cl = C.claims(s);
  const step = C.dist(s.B, s.C);
  const last = points[points.length - 1];
  return {
    denominator: s.n,
    apexAngleDegrees: round(gamma),
    measuredApexAngleDegrees: round(C.apexAngle(s)),
    oddDenominator: s.n % 2 === 1,
    stepLength: round(step),
    iterations: C.iterations(s),
    chain: points.map((p, i) => ({
      index: i,
      label: i === 0 ? "B" : i === 1 ? "C" : cl.complete && i === points.length - 1 ? "A" : `P${i - 1}`,
      point: pt(p),
    })),
    slices: slices.map((t, i) => ({
      index: i + 1,
      baseAngleDegrees: round(t.baseAngle),
      turnAngleDegrees: round(t.apexAngle),
      farAngleDegrees: round(t.farAngle),
    })),
    baseAnglesDegrees: slices.map((t) => round(t.baseAngle)),
    expectedBaseAngleStepDegrees: round(gamma),
    actualBaseAngleStepDegrees: slices.length > 1
      ? round((slices[0].baseAngle - slices[slices.length - 1].baseAngle) / (slices.length - 1))
      : null,
    gapToApexOverStep: last ? round(C.dist(last, s.A) / step) : null,
    checks: {
      equalSteps: cl.equalSteps,
      isoscelesSlices: cl.isosceles,
      arithmeticBaseAngles: cl.arithmetic,
      completeChain: cl.complete,
      formula: cl.formula,
      twentyDegrees: cl.twentyDegrees,
      thirtySixDegrees: cl.thirtySixDegrees,
      sixtyDegrees: cl.sixtyDegrees,
    },
    note:
      "Each new point is |BC| from the previous one, so all chain steps are equal and every slice is isosceles. Scanning the base angles from the base towards A gives a drop of gamma = 180/n each time. When n = 2k+1 is odd there are k slices and the last point is A (gamma = 180/(2k+1)); for even n the chain stops about half a step short, so formula is false. n = 3 gives one equilateral slice, n = 5 two golden-gnomon slices and n = 9 the four slices of the 80-80-20 triangle.",
  };
}

export function actions(): GameActions {
  return {
    decomposition: {
      describe:
        "Build the CID diagram for the applet's denominator n (an integer 2..178; the apex angle is 180/n degrees) and report the chain of points from B and C to the apex, the equal step length, the isosceles slices with their three angles, the base-angle progression and the core's checks. Odd n = 2k+1 give k slices that reach A exactly; even n stop short. Optional width, height and showNames change the picture; optional corners A, B, C ([x, y] or { x, y }) read a dragged diagram instead of a freshly reset one.",
      args: '{ "n": 9 }',
      run: (args) => {
        const s = readState(args);
        return {
          state: {
            n: s.n, width: s.width, height: s.height, showNames: s.showNames,
            A: pt(s.A), B: pt(s.B), C: pt(s.C),
          },
          ...reading(s),
        };
      },
    },
    denominators: {
      describe:
        "Compare 1 to 40 denominators at once (integers 2..178): for each n report 180/n, how many equal isosceles slices the chain makes, the base-angle list, whether the chain reaches the apex, whether the article's formula gamma = 180/(2k+1) holds, and the leftover gap as a fraction of a step. Use this to see that only odd denominators close the chain while even ones stop about half a step short.",
      args: '{ "ns": [3, 4, 5, 6, 7, 9, 10, 11, 20, 21] }',
      run: (args) => {
        if (!Array.isArray(args.ns)) throw new Error('"ns" must be an array of integers');
        if (args.ns.length < 1 || args.ns.length > 40) throw new Error('"ns" must hold 1 to 40 denominators');
        const rows = args.ns.map((v) => {
          const n = readN({ n: v });
          const C = core();
          const s = C.start({ n });
          const points = C.compute(s) as Point[];
          const slices = C.triangles(s) as Slice[];
          const cl = C.claims(s);
          const step = C.dist(s.B, s.C);
          const last = points[points.length - 1];
          return {
            n,
            apexAngleDegrees: round(C.topAngle(s)),
            slices: slices.length,
            baseAnglesDegrees: slices.map((t) => round(t.baseAngle)),
            completeChain: cl.complete,
            formula: cl.formula,
            arithmeticBaseAngles: cl.arithmetic,
            equalSteps: cl.equalSteps,
            gapToApexOverStep: last ? round(C.dist(last, s.A) / step) : null,
          };
        });
        return {
          rows,
          note: "Only odd n = 2k+1 complete the chain (k equal isosceles slices, base angles dropping by 180/n); even n leave the last point short of A. n = 3, 5, 9 are the 60, 36 and 20 degree cases named on the page.",
        };
      },
    },
  };
}

/** The page saves { n, width, height, showNames, A, B, C } with Track.state. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported CID state version ${stateVersion}`);
  const s = readState(state);
  return {
    stateVersion,
    n: s.n,
    width: s.width,
    height: s.height,
    showNames: s.showNames,
    A: pt(s.A),
    B: pt(s.B),
    C: pt(s.C),
    reading: reading(s),
  };
}
