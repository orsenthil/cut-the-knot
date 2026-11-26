/*
 * run_game_logic actions and saved-position reader for Barygon.
 *
 * The real core is barygon/barygon-core.js (global BarygonCore), copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 *
 * The page starts with N corners P_i, replaces each by the barycentre of K
 * neighbours (the applet's NA), Q_i = (P_i + ... + P_{i+K-1})/K, and repeats
 * NI rounds. Telescoping gives Q_{i+1} - Q_i = (P_{i+K} - P_i)/K, so one round
 * already decides the page's question. A paragon has opposite sides parallel
 * and equal: S_{i+N/2} = -S_i. A Fourier mode k is multiplied by
 * lambda_k = (1/K)(1 + z_k + ... + z_k^(K-1)), z_k = exp(2*pi*i*k/N), and
 * lambda_k = 0 exactly when N divides k*K but does not divide k. The paragon
 * condition only touches even modes, so with n = N/2 one round gives a
 * paragon exactly when n divides K. An odd multiple of n gives a
 * non-degenerate paragon; an even multiple (a multiple of N) makes every
 * corner the centroid, a flat paragon. For any other K, |lambda_2| < 1 but
 * non-zero: the obstructions shrink every round and never vanish in exact
 * arithmetic, so the polygon only converges to a paragon.
 */

import { cores } from "../generated/cores.js";
import type { GameActions, Json } from "./_shared.js";

const core = () => cores["barygon"].BarygonCore;
type Core = ReturnType<typeof core>;
type Pt = { x: number; y: number };
type State = { N: number; NA: number; NI: number; width: number; height: number; points: Pt[] };

/** Round for display only; null (which JSON prints as null) for non-finite values. */
const tidy = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null;
const pt = (p: Pt): { x: number | null; y: number | null } => ({ x: tidy(p.x), y: tidy(p.y) });
const poly = (ps: Pt[]) => ps.map(pt);

/** A whole number in [min, max]; try each name in order so callers can use K or NA. */
function intArg(args: Json, names: string[], min: number, max: number, fallback?: number): number {
  const name = names.find((k) => args[k] !== undefined && args[k] !== null);
  const raw = name === undefined ? undefined : args[name];
  if (raw === undefined || raw === null) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing required argument "${names[0]}" (expected a whole number from ${min} to ${max})`);
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`argument "${name}" must be a whole number, got ${JSON.stringify(raw)}`);
  if (n < min || n > max) throw new Error(`argument "${name}" must be from ${min} to ${max}, got ${n}`);
  return n;
}

function finiteArg(args: Json, name: string, fallback: number): number {
  const v = args[name];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`argument "${name}" must be a number, got ${JSON.stringify(v)}`);
  return n;
}

/** Corners may be [x, y] or { "x": ..., "y": ... }; absent means the applet's random reset. */
function readPoints(args: Json, n: number): Pt[] | undefined {
  const v = args.points;
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) throw new Error('argument "points" must be an array of [x, y] pairs');
  if (v.length !== n) throw new Error(`argument "points" must have N = ${n} corners, got ${v.length}`);
  return v.map((entry, i) => {
    let x: unknown, y: unknown;
    if (Array.isArray(entry)) {
      if (entry.length !== 2) throw new Error(`points[${i}] must be [x, y]`);
      [x, y] = entry;
    } else if (entry !== null && typeof entry === "object") {
      const o = entry as Json;
      x = o.x; y = o.y;
    } else {
      throw new Error(`points[${i}] must be [x, y] or { "x": ..., "y": ... }`);
    }
    const xn = Number(x), yn = Number(y);
    if (!Number.isFinite(xn) || !Number.isFinite(yn)) {
      throw new Error(`points[${i}] must have finite numeric x and y, got ${JSON.stringify(entry)}`);
    }
    return { x: xn, y: yn };
  });
}

/** Deterministic stand-in for the applet's random reset, so examples are reproducible. */
function seeded(seed: number): () => number {
  let s = (Math.floor(seed) >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Build a core state from an action's arguments (or from a saved position). */
function makeState(C: Core, args: Json, saved: boolean): State {
  const fresh = C.start() as State;
  const N = intArg(args, ["N"], 3, 20, saved ? fresh.N : undefined);
  const K = intArg(args, ["K", "NA"], 2, 20, saved ? fresh.NA : undefined);
  const NI = intArg(args, ["rounds", "NI"], 1, 20, saved ? fresh.NI : undefined);
  const points = readPoints(args, N);
  return C.start({
    N, NA: K, NI,
    width: finiteArg(args, "width", fresh.width),
    height: finiteArg(args, "height", fresh.height),
    points,
    random: seeded(finiteArg(args, "seed", 7)),
  }) as State;
}

/** Everything the core can say about one configuration, from the polygon itself. */
function reading(C: Core, state: State) {
  const seq = C.sequence(state) as Pt[][];
  const first = seq[1];
  const final = seq[seq.length - 1];
  const cl = C.claims(state);
  const N = state.N, K = state.NA, NI = state.NI;
  const even = N % 2 === 0;
  const n = even ? N / 2 : null;
  const oddMultiple = n !== null && cl.halfDivides && !cl.allDivides;
  const sides = C.sideVectors(final) as Pt[];
  const oppositeSides = n === null ? null : sides.slice(0, n).map((s, i) => {
    const other = sides[i + n];
    return { side: i, sumWithOpposite: pt({ x: s.x + other.x, y: s.y + other.y }) };
  });
  const zeroModes: number[] = [];
  for (let k = 1; k < N; k++) if ((k * K) % N === 0) zeroModes.push(k);
  const evenModes: number[] = [];
  for (let k = 2; k < N; k += 2) evenModes.push(k);
  const allEvenModesVanish = even && evenModes.every((k) => zeroModes.includes(k));
  const lambda2 = C.eigenModulus(2, N, K);

  let verdict: string;
  if (!even) {
    verdict =
      "An odd number of corners has no opposite side, so the paragon test does not apply. " +
      "Averaging still runs and contracts the polygon toward its centre.";
  } else if (cl.allDivides) {
    verdict =
      `K = ${K} is a multiple of N = ${N}, so every group of K corners contains whole laps: ` +
      "all corners become the same centre of mass, a flat (degenerate) paragon.";
  } else if (cl.halfDivides) {
    verdict =
      `K = ${K} is an odd multiple of n = ${n} (an even multiple would be a multiple of N and would collapse the polygon), ` +
      "so one round kills every even Fourier mode and gives a non-degenerate paragon: opposite sides are parallel and equal.";
  } else {
    verdict =
      `K = ${K} is not a multiple of n = ${n}, so lambda_2 is non-zero but has modulus ${tidy(lambda2)} < 1. ` +
      "Each round shrinks the non-paragon parts, so in exact arithmetic no finite number of rounds makes them vanish: " +
      "the polygon only converges to the paragon below.";
  }

  return {
    configuration: { N, groupK: K, rounds: NI, half: n, roundsShown: seq.length - 1 },
    startVertices: poly(state.points),
    afterOneRound: first ? poly(first) : null,
    finalVertices: poly(final),
    finalSideVectors: poly(sides),
    paragon: {
      evenN: cl.even,
      isParagon: cl.finalIsParagon,
      paragonDefect: tidy(cl.defect),
      relativeDefect: tidy(C.relativeDefect(final)),
      allVerticesCoincident: C.isCoincident(final),
      oppositeSides,
      test: "A paragon needs S_{i+N/2} = -S_i, i.e. side i plus the opposite side is the zero vector (shown rounded).",
      roundingCaveat: even && !cl.halfDivides && cl.finalIsParagon
        ? "The defect rounds to zero after this many rounds; in exact arithmetic this setting never reaches a paragon."
        : null,
    },
    criterion: {
      nDividesK: cl.halfDivides,
      NDividesK: cl.allDivides,
      oddMultipleOfHalf: oddMultiple,
      paragonAfterOneStep: cl.paragonAfterOneStep,
      collapsedAfterOneStep: cl.collapsedAfterOneStep,
      neverExact: cl.neverExact,
      exactNeverParagon: even && !cl.halfDivides,
      convergenceLimit: n === null ? null : poly((C.limitPolygon(state.points) as Pt[] | null) ?? []),
    },
    eigenvalues: {
      lambda2Modulus: tidy(lambda2),
      zeroModes,
      allEvenModesVanish,
      rule:
        "lambda_k = (1/K)(1 + z_k + ... + z_k^(K-1)) with z_k = exp(2*pi*i*k/N); " +
        "lambda_k = 0 exactly when N divides k*K while N does not divide k. " +
        "The paragon condition kills the even modes k = 2, 4, ..., which happens exactly when n = N/2 divides K.",
    },
    telescopingIdentity: cl.telescoping,
    verdict,
    note:
      "One round replaces Q_i by the barycentre of K consecutive corners and, because " +
      "Q_{i+1} - Q_i = (P_{i+K} - P_i)/K, gives every side from one subtraction. " + verdict,
  };
}

export function actions(): GameActions {
  return {
    average: {
      describe:
        "Run Barygon's averaging for N corners (3-20), a group of K neighbours (2-20, the page's 'Average over') and a number of rounds (1-20). Reports the vertices after one round and after all rounds, the side vectors, whether the final polygon is a paragon (opposite sides parallel, equal and antipodal) with its defect, and the eigenvalue criterion including the odd-multiple-of-N/2 exception. Corners may be given as 'points': [[x,y], ...], otherwise a fixed-seed reset polygon is used.",
      args: '{ "N": 6, "K": 9, "rounds": 1 }',
      run: (args) => {
        const C = core();
        return reading(C, makeState(C, args, false));
      },
    },
    eigen_modes: {
      describe:
        "Fourier analysis of one Barygon averaging with N corners and groups of K neighbours. For every mode k it reports |lambda_k| and whether lambda_k vanishes exactly (N divides k*K but not k), then states the paragon criterion: the even modes 2, 4, ... must all vanish, which happens exactly when N/2 divides K; an odd multiple of N/2 gives a non-degenerate paragon, an even multiple (a multiple of N) collapses every corner to the centre, and otherwise the polygon only converges.",
      args: '{ "N": 6, "K": 6 }',
      run: (args) => {
        const C = core();
        const N = intArg(args, ["N"], 3, 20);
        const K = intArg(args, ["K", "NA"], 2, 20);
        const n = N % 2 === 0 ? N / 2 : null;
        const modes = Array.from({ length: N }, (_, k) => ({
          k,
          lambdaModulus: tidy(C.eigenModulus(k, N, K)),
          vanishesExactly: k !== 0 && (k * K) % N === 0,
        }));
        const halfDivides = n !== null && K % n === 0;
        const allDivides = K % N === 0;
        return {
          N, groupK: K, half: n,
          modes,
          rule:
            "z_k = exp(2*pi*i*k/N); lambda_k = (1/K)(1 + z_k + ... + z_k^(K-1)); " +
            "lambda_k = 0 exactly when N | k*K and N does not divide k. Mode 0 stays fixed (the centroid).",
          criterion: {
            halfDivides, allDivides,
            oddMultipleOfHalf: halfDivides && !allDivides,
            evenModesAllKillable: halfDivides,
            verdict: n === null
              ? "Odd N has no opposite sides, so the paragon test does not apply."
              : allDivides
                ? "N divides K: every mode k = 1, ..., N-1 vanishes, so all corners collapse to the centroid (flat paragon)."
                : halfDivides
                  ? `K is an odd multiple of ${n}: all even modes vanish while odd modes survive, giving a non-degenerate paragon in one round.`
                  : `K is not a multiple of ${n}: lambda_2 is non-zero, so no finite number of rounds reaches a paragon, though it converges to one.`,
          },
        };
      },
    },
  };
}

/** The page's Track.state snapshot, plus a fresh core reading of that drawing. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const here = makeState(C, state, true);
  return {
    stateVersion,
    N: here.N,
    groupK: here.NA,
    rounds: here.NI,
    width: here.width,
    height: here.height,
    savedVertices: poly(here.points),
    reading: reading(C, here),
  };
}
