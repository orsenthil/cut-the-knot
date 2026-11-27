/*
 * run_game_logic actions and saved-position reader for Equiangular Poly.
 *
 * Every number below comes from the game's real core
 * (equiangular-poly/equiangular-poly-core.js), copied into src/generated/cores/
 * at build time. See _shared.ts for the module shape.
 *
 * The applet draws the N side lines of an equiangular polygon. Each line is
 * stored as an outward unit normal n_i and an offset t_i from the centre, so
 * the signed distance from P to line i is t_i - (P - centre) . n_i. Because
 * equally spaced normals add to zero, those signed distances always add to
 * t_0 + ... + t_(N-1), whatever P does; ordinary (unsigned) distances add to
 * the same total only while P is inside every side line.
 */

import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["equiangular-poly"].EquiangularPolyCore;

type Point = { x: number; y: number };
type Line = { n: Point; t: number };
type State = { width: number; height: number; N: number; showHint: boolean; P: Point; lines: Line[] };

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

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

/** N is the number of sides: a whole number from 3 to 15. */
function readN(args: Json): number {
  const C = core();
  const N = num(args, "N", C.INITIAL_N);
  if (!Number.isInteger(N) || N < C.MIN_N || N > C.MAX_N) {
    throw new Error(`"N" must be a whole number of sides from ${C.MIN_N} to ${C.MAX_N}, got ${JSON.stringify(args.N)}`);
  }
  return N;
}

function dimensions(args: Json): { width: number; height: number } {
  const C = core();
  const width = num(args, "width", C.WIDTH);
  const height = num(args, "height", C.HEIGHT);
  if (!(width > 0) || !(height > 0)) throw new Error('"width" and "height" must be positive');
  return { width, height };
}

/** Build a regular polygon, sliding its side lines by the optional offsets t. */
function makeState(args: Json): State {
  const C = core();
  const { width, height } = dimensions(args);
  const N = readN(args);
  let t: number[] | undefined;
  if (args.t !== undefined && args.t !== null) {
    t = numArray(args, "t");
    if (t.length !== N) throw new Error(`"t" must give exactly ${N} offsets, one for each side line`);
  }
  return C.start({ width, height, N, showHint: args.showHint === true, t }) as State;
}

/** Rebuild the exact state the page saved with Track.state (fixture version 1). */
function savedState(state: Json, stateVersion: number): State {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Equiangular Poly state version ${stateVersion}`);
  }
  const C = core();
  const { width, height } = dimensions(state);
  const N = readN(state);
  const centre = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const P = state.P === undefined || state.P === null ? centre : readPoint(state.P, "P");
  let lines: Line[];
  if (state.lines === undefined || state.lines === null) {
    lines = (C.start({ width, height, N }) as State).lines;
  } else {
    if (!Array.isArray(state.lines)) throw new Error('"lines" must be an array of { n: { x, y }, t }');
    if (state.lines.length !== N) throw new Error(`"lines" must have exactly ${N} entries, one per side`);
    lines = state.lines.map((entry, i) => {
      const line = entry as Json;
      const normal = line.n as Json;
      const nx = num(normal, "x"), ny = num(normal, "y");
      const len = Math.hypot(nx, ny);
      if (!(len > 0)) throw new Error(`lines[${i}].n is not a direction`);
      return { n: { x: nx / len, y: ny / len }, t: num(line, "t") };
    });
  }
  return { width, height, N, showHint: state.showHint === true, P, lines };
}

/** One core-derived reading of P: signed versus ordinary distances. */
function reading(s: State, P: Point) {
  const C = core();
  const g = C.compute({ ...s, P }) as Json;
  const offsets = s.lines.map((line) => line.t);
  const offsetsSum = sum(offsets);
  const signedSum = g.sumSigned as number;
  const unsignedSum = g.sumUnsigned as number;
  return {
    P: pt(P),
    inside: Boolean(g.inside),
    convex: Boolean(g.convex),
    signedDistances: (g.signed as number[]).map(round),
    signedSum: round(signedSum),
    unsignedDistances: (g.unsigned as number[]).map(round),
    unsignedSum: round(unsignedSum),
    offsets: offsets.map(round),
    offsetsSum: round(offsetsSum),
    sideLengths: (g.sideLengths as number[]).map(round),
    equiangular: Boolean(C.claims(g).equiangular),
    signedSumEqualsOffsets: Boolean(C.close(signedSum, offsetsSum)),
    unsignedEqualsSigned: Boolean(C.close(unsignedSum, signedSum)),
  };
}

function samplePoints(s: State, args: Json): Point[] {
  if (args.points === undefined || args.points === null) {
    const c = { x: Math.floor(s.width / 2), y: Math.floor(s.height / 2) };
    return [c, { x: c.x + s.width * 0.12, y: c.y - s.height * 0.1 }, { x: s.width - 10, y: 10 }];
  }
  if (!Array.isArray(args.points)) throw new Error('"points" must be an array of [x, y] or { x, y }');
  return args.points.map((p, i) => readPoint(p, `points[${i}]`));
}

export function actions(): GameActions {
  return {
    distance_sum: {
      describe:
        "For an equiangular N-gon (3–15 sides), optionally sliding its side lines with offsets t = [...], report the signed distances from each sample point P to every side line and their total. The signed total always equals t_0 + ... + t_(N-1); ordinary (unsigned) distances add to it only when P is inside every side line.",
      args: '{ "N": 5, "t": [94, 90, 90, 90, 90], "points": [[200, 180], [250, 130], [390, 10]] }',
      run: (args) => {
        const s = makeState(args);
        const points = samplePoints(s, args);
        const reads = points.map((P) => reading(s, P));
        const offsetsSum = round(sum(s.lines.map((line) => line.t)));
        return {
          N: s.N,
          board: { width: s.width, height: s.height },
          offsets: s.lines.map((line) => round(line.t)),
          offsetsSum,
          points: reads,
          signedSumIsOffsetsSum: reads.every((r) => r.signedSumEqualsOffsets),
          unsignedMatchesWhenInside: reads.every((r) => !r.inside || r.unsignedEqualsSigned),
          note:
            "Give each side line a sign, positive on the polygon's inside: the distances from P then add to the fixed sum of the offsets for every P, because the equally spaced normals cancel. Ordinary distances use absolute values and match that total only while P is inside all the side lines; outside, a sign flips and the ordinary sum is larger.",
        };
      },
    },
    converse_counterexamples: {
      describe:
        "Check where the converse of the distance-sum claim stops, using the core's three cases: an equiangular triangle (which must be regular, Viviani's theorem), a rectangle with unequal sides, and a slanted parallelogram that is not equiangular at all. For each, several interior points show that the signed distance sum stays fixed even when the sides are unequal or the angles are not equal.",
      args: '{ "width": 400, "height": 360 }',
      run: (args) => {
        const C = core();
        const { width, height } = dimensions(args);
        const base = C.start({ width, height, N: 3 }) as State;
        const c = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
        const r = Math.min(width, height) / 4;
        const a = r + 5, b = r - 20;
        const cos60 = 0.5, sin60 = Math.sqrt(3) / 2;

        // The three side-line sets, kept in cyclic order around each shape.
        const triangle = base; // three equal offsets: regular, hence equilateral
        const rectangle: State = {
          ...base,
          N: 4,
          lines: [
            { n: { x: 1, y: 0 }, t: a },
            { n: { x: 0, y: 1 }, t: b },
            { n: { x: -1, y: 0 }, t: a },
            { n: { x: 0, y: -1 }, t: b },
          ],
        };
        const parallelogram: State = {
          ...base,
          N: 4,
          lines: [
            { n: { x: 1, y: 0 }, t: a },
            { n: { x: cos60, y: sin60 }, t: b },
            { n: { x: -1, y: 0 }, t: a },
            { n: { x: -cos60, y: -sin60 }, t: b },
          ],
        };

        const points = [c, { x: c.x + 20, y: c.y - 15 }, { x: c.x - 25, y: c.y + 10 }];
        const describe = (name: string, why: string, s: State) => {
          const g = C.compute({ ...s, P: c }) as Json;
          const sides = g.sideLengths as number[];
          return {
            name,
            why,
            offsets: s.lines.map((line) => round(line.t)),
            offsetsSum: round(sum(s.lines.map((line) => line.t))),
            sideLengths: sides.map(round),
            allSidesEqual: sides.every((len) => Boolean(C.close(len, sides[0], 1e-6))),
            equiangular: Boolean(C.claims(g).equiangular),
            samples: points.map((P) => {
              const rP = reading(s, P);
              return {
                P: rP.P,
                inside: rP.inside,
                signedSum: rP.signedSum,
                unsignedSum: rP.unsignedSum,
                signedSumEqualsOffsets: rP.signedSumEqualsOffsets,
                unsignedEqualsSigned: rP.unsignedEqualsSigned,
              };
            }),
          };
        };

        return {
          cases: [
            describe("equilateral triangle (3 sides)", "Equal angles force equal sides; the sum of distances from an interior point is the altitude (Viviani's theorem).", triangle),
            describe("rectangle (4 sides, unequal)", "Every angle is a right angle, but the two side lengths differ: equiangular does not mean regular, yet the distance sum is still width + height.", rectangle),
            describe("slanted parallelogram (4 sides)", "The angles alternate 120° and 60°, so it is not equiangular; distances to each pair of opposite parallel lines still add to a fixed height, so the total is constant.", parallelogram),
          ],
          converseBeyondTriangles: true,
          note:
            "A constant distance sum does not characterise a regular polygon once N > 3. The triangle case forces regularity; the rectangle keeps equal angles with unequal sides, and the parallelogram loses equal angles altogether while the sum stays constant. In every case the signed sum equals the sum of the side-line offsets, and the ordinary sum agrees only for points inside all the side lines.",
        };
      },
    },
  };
}

/** The fields the page saved with Track.state, plus the core's reading. */
export function position(state: Json, stateVersion: number): unknown {
  const s = savedState(state, stateVersion);
  const r = reading(s, s.P);
  return {
    stateVersion,
    width: s.width,
    height: s.height,
    N: s.N,
    showHint: s.showHint,
    P: r.P,
    offsets: r.offsets,
    offsetsSum: r.offsetsSum,
    reading: r,
    note:
      "The signed distances from P to the side lines (positive inside) add to the sum of the line offsets, whatever P does. Ordinary distances use absolute values and agree with that total only while P is inside every side line.",
  };
}
