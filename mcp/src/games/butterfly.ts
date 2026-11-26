/*
 * run_game_logic actions and saved-position reader for Butterfly — Bogomolny's
 * 2N-Wing Butterfly theorem, ported from the Butterfly applet.
 *
 * N concentric circles share a centre O. A horizontal classifier through the
 * nexus M and two spikes through M cut circle i in A_i, B_i and C_i, D_i. Pair
 * A_i with D_p(i) and C_i with B_p(i) for any permutation p; these "wings" meet
 * the classifier at X_i and Y_i. When M lies on the perpendicular through O
 * (so M bisects every circle's chord on the classifier),
 *
 *     sum_i 1 / |MX_i|  =  sum_i 1 / |MY_i|,
 *
 * and for N = 1 that says MX = MY: M is the midpoint of XY, the plain butterfly
 * theorem. Drag M sideways and the midpoint property dies, so the equality
 * fails — the applet's own counterexample. Every number below is measured by
 * the game's real core (butterfly/butterfly-core.js), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = {
  n: number;
  width: number;
  height: number;
  seed: number;
  center: Point;
  radii: number[];
  M: Point;
  A: Point;
  C: Point;
  perm: number[];
};
type Measurements = {
  classifier: { p: Point; q: Point };
  circles: { center: Point; radius: number }[];
  A: (Point | null)[];
  B: (Point | null)[];
  C: (Point | null)[];
  D: (Point | null)[];
  X: (Point | null)[];
  Y: (Point | null)[];
  mx: number[];
  my: number[];
  sumX: number;
  sumY: number;
  defined: boolean;
  aligned: boolean;
};
type Claims = {
  defined: boolean;
  aligned: boolean;
  midpoint: boolean;
  reciprocal: boolean;
  chordMidpoints: boolean;
  powerOfPoint: boolean;
};
type Core = {
  start(options?: Json): State;
  withPoint(s: State, name: string, p: Point): State;
  measurements(s: State): Measurements;
  claims(s: State): Claims;
  result(s?: State): null;
};

const core = () => cores["butterfly"].ButterflyCore as unknown as Core;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const round = (v: number, digits = 6): number => Number(v.toFixed(digits));
/** JSON cannot carry NaN/Infinity: an undefined crossing is reported as null. */
const safe = (v: number): number | null => (finite(v) ? round(v) : null);
const pt = (p: Point | null | undefined): Point | null =>
  p && finite(p.x) && finite(p.y) ? { x: round(p.x, 4), y: round(p.y, 4) } : null;

function readPoint(value: unknown, label: string): Point {
  const p = value as Json;
  if (!p || typeof p !== "object") throw new Error(`"${label}" must be {x, y}`);
  const x = Number(p.x);
  const y = Number(p.y);
  if (!finite(x) || !finite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

function readRadii(value: unknown, n: number): number[] {
  if (!Array.isArray(value) || value.length !== n) {
    throw new Error(`"radii" must list ${n} positive numbers, one per circle`);
  }
  return value.map((v, i) => {
    const r = Number(v);
    if (!finite(r) || r <= 0) throw new Error(`radii[${i}] must be a positive finite number`);
    return r;
  });
}

function readPerm(value: unknown, n: number): number[] {
  if (!Array.isArray(value) || value.length !== n) {
    throw new Error(`"perm" must list ${n} numbers, one per circle`);
  }
  const p = value.map((v, i) => {
    const k = Number(v);
    if (!Number.isInteger(k) || k < 1 || k > n) {
      throw new Error(`perm[${i}] must be an integer from 1 to ${n}`);
    }
    return k;
  });
  if (new Set(p).size !== n) throw new Error('"perm" must be a permutation of 1..n (each circle paired once)');
  return p;
}

/** Build a core state from tool args; M, A, C, radii and perm are optional. */
function stateFromArgs(C: Core, args: Json): State {
  const n = Math.round(num(args, "n", 2));
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error('"n" must be an integer from 1 to 10');
  const width = num(args, "width", 400);
  const height = num(args, "height", 300);
  if (width <= 0 || height <= 0) throw new Error('"width" and "height" must be positive');
  const options: Json = { n, width, height, seed: num(args, "seed", 2912) };
  if (args.center !== undefined) options.center = readPoint(args.center, "center");
  if (args.radii !== undefined) options.radii = readRadii(args.radii, n);
  let s = C.start(options);
  if (args.M !== undefined) s = { ...s, M: readPoint(args.M, "M") };
  // The page keeps A and C on the outer circle; withPoint does that clamping.
  if (args.A !== undefined) s = C.withPoint(s, "A", readPoint(args.A, "A"));
  if (args.C !== undefined) s = C.withPoint(s, "C", readPoint(args.C, "C"));
  if (args.perm !== undefined) s = { ...s, perm: readPerm(args.perm, n) };
  return s;
}

/** The core's own measurements and claim checks, as plain JSON. */
function reading(C: Core, s: State) {
  const m = C.measurements(s);
  const cl = C.claims(s);
  return {
    n: s.n,
    aligned: cl.aligned,
    defined: cl.defined,
    M: { x: round(s.M.x), y: round(s.M.y) },
    center: { x: round(s.center.x), y: round(s.center.y) },
    perm: s.perm.slice(),
    distances: m.mx.map((mx, i) => ({
      circle: i + 1,
      X: pt(m.X[i]),
      Y: pt(m.Y[i]),
      MX: safe(mx),
      MY: safe(m.my[i]),
    })),
    sumX: safe(m.sumX),
    sumY: safe(m.sumY),
    difference: finite(m.sumX) && finite(m.sumY) ? round(m.sumX - m.sumY) : null,
    claims: {
      midpoint: cl.midpoint,
      reciprocal: cl.reciprocal,
      chordMidpoints: cl.chordMidpoints,
      powerOfPoint: cl.powerOfPoint,
    },
  };
}

type Reading = ReturnType<typeof reading>;

function noteFor(r: Reading): string {
  if (!r.defined) {
    return "Both spikes must cross every circle before the crossings X and Y exist; drag A, C or M until the whole butterfly is drawn.";
  }
  if (!r.aligned) {
    return `M sits ${Math.abs(r.M.x - r.center.x).toFixed(3)} units to the side of O's perpendicular, so M is not the midpoint of the classifier chords. Sum 1/MX = ${r.sumX} but sum 1/MY = ${r.sumY} (difference ${r.difference}), so the equality fails. This is the applet's counterexample, not a flaw in the theorem.`;
  }
  if (r.n === 1) {
    return `One circle: MX = MY = ${r.distances[0].MX}, so M is the midpoint of XY — the plain butterfly theorem (power of the point plus similar triangles).`;
  }
  return `${r.n} circles with this pairing: sum 1/MX = sum 1/MY = ${r.sumX}, exactly. The equality survives any permutation of the wing pairing as long as M stays on the perpendicular through O.`;
}

export function actions(): GameActions {
  return {
    wing_sums: {
      describe:
        "For N concentric circles (1 to 10), a nexus M, two spikes and a pairing permutation, use the real core to measure where each wing A_i D_p(i) and C_i B_p(i) crosses the classifier. Report both sets of distances MX_i and MY_i, the sums of their reciprocals 1/MX and 1/MY, the difference, and the page's checks. With N = 1 this is the plain butterfly theorem (M is the midpoint of XY); with M moved off the perpendicular through O the equality breaks. Optional arguments: center, radii (N positive numbers), A and C (spike ends on the outer circle), perm (a permutation of 1..N), width, height and seed.",
      args: '{ "n": 2, "M": {"x": 203, "y": 168.079}, "A": {"x": 141.899, "y": 197.427}, "C": {"x": 256.137, "y": 100.265}, "perm": [1, 2] }',
      run: (args) => {
        const C = core();
        const r = reading(C, stateFromArgs(C, args));
        return { ...r, note: noteFor(r) };
      },
    },
    offset_counterexample: {
      describe:
        "Sweep the nexus M sideways from the position above O (offset 0) by each offset in a list, keeping the rest of the butterfly fixed, and report the two reciprocal sums and their difference at each spot. Only offset 0 keeps M the midpoint of every circle's classifier chord, so only there do sum 1/MX and sum 1/MY agree; any sideways drag is the counterexample shown on the page. Optional arguments: n, width, height, seed, center, radii, A, C, perm and M.y to choose the starting drawing.",
      args: '{ "n": 2, "offsets": [0, 1, 3, 8] }',
      run: (args) => {
        const C = core();
        const s = stateFromArgs(C, args);
        const value = args.offsets;
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error('"offsets" must be a non-empty array of sideways distances');
        }
        if (value.length > 12) throw new Error('"offsets" may list at most 12 distances');
        const offsets = value.map((v, i) => {
          const o = Number(v);
          if (!finite(o)) throw new Error(`offsets[${i}] must be a finite number`);
          return o;
        });
        const rows = offsets.map((offset) => {
          const here: State = { ...s, M: { x: s.center.x + offset, y: s.M.y } };
          const r = reading(C, here);
          return {
            offset,
            aligned: r.aligned,
            defined: r.defined,
            sumX: r.sumX,
            sumY: r.sumY,
            difference: r.difference,
            sumsEqual: r.claims.reciprocal,
            midpoint: r.claims.midpoint,
          };
        });
        const holds = rows.filter((row) => row.sumsEqual).map((row) => row.offset);
        return {
          n: s.n,
          M_y: round(s.M.y),
          center: { x: round(s.center.x), y: round(s.center.y) },
          rows,
          note: `M was moved to x = O.x + offset at the same height. The reciprocal sums agree only at offsets [${holds.join(", ")}]; every other offset breaks the midpoint hypothesis, so the sums differ. The butterfly theorem needs M on the perpendicular through O in every circle.`,
        };
      },
    },
  };
}

/** The fields Track.state saved on the page, plus the core's reading of them. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported butterfly state version ${stateVersion}`);
  const C = core();
  const saved = state ?? ({} as Json);
  const n = Math.round(num(saved, "n"));
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error('"n" must be an integer from 1 to 10');
  const width = num(saved, "width", 400);
  const height = num(saved, "height", 300);
  if (width <= 0 || height <= 0) throw new Error('"width" and "height" must be positive');
  const here: State = {
    n,
    width,
    height,
    seed: num(saved, "seed", 2912),
    center: readPoint(saved.center, "center"),
    radii: readRadii(saved.radii, n),
    M: readPoint(saved.M, "M"),
    A: readPoint(saved.A, "A"),
    C: readPoint(saved.C, "C"),
    perm: readPerm(saved.perm, n),
  };
  const r = reading(C, here);
  return {
    stateVersion,
    // Exactly what the page saved with Track.state(state).
    n: here.n,
    width: here.width,
    height: here.height,
    seed: here.seed,
    center: here.center,
    radii: here.radii,
    M: here.M,
    A: here.A,
    C: here.C,
    perm: here.perm,
    result: C.result(here), // an illustration: no win or loss
    // What the core adds for this exact drawing.
    aligned: r.aligned,
    defined: r.defined,
    distances: r.distances,
    sumX: r.sumX,
    sumY: r.sumY,
    difference: r.difference,
    checks: r.claims,
    note: `Track.state saved ${n} circle${n === 1 ? "" : "s"} with the nexus M at (${round(here.M.x, 2)}, ${round(here.M.y, 2)}) and centre O at (${round(here.center.x, 2)}, ${round(here.center.y, 2)}). ${noteFor(r)}`,
  };
}
