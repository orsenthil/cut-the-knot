/*
 * run_game_logic actions and saved-position reader for Reflection Principle.
 * The core lives in reflection-principle/ and is copied into
 * src/generated/cores/ at build time. See _shared.ts for the module shape.
 */
import { cores } from "../generated/cores.js";
import { num, numArray, type GameActions, type Json } from "./_shared.js";

const core = () => cores["reflection-principle"].ReflectionPrincipleCore;

type Params = { a: number; b: number; n: number };
type WalkPair = { path: number[]; reflected: number[]; passedZero: boolean };

/** A repeatable coin for the applet's "random up or down" steps. */
function seeded(seed: number) {
  let s = (Math.trunc(seed) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Count walks from (0,a) to (steps,b) that touch or cross the axis. */
function enumerateBadPaths(a: number, b: number, steps: number): number | null {
  if (steps > 16) return null; // 2^16 masks is enough for a tutor answer
  let bad = 0;
  for (let mask = 0; mask < 2 ** steps; mask++) {
    let y = a;
    let touched = false;
    for (let i = 0; i < steps; i++) {
      y += mask & (1 << i) ? 1 : -1;
      if (y <= 0) touched = true;
    }
    if (y === b && touched) bad++;
  }
  return bad;
}

/**
 * All walks from A to B are C(steps, (steps + b - a)/2), a binomial
 * coefficient. For a > 0 and b > 0 the reflection lemma pairs the ones that
 * touch the axis with *all* walks from the mirror point A' to B, so the bad
 * count is C(steps, (steps + b + a)/2). The applet quietly uses one fewer
 * step when the parity does not work; C.steps is that effective length.
 */
function counts(C: ReturnType<typeof core>, a: number, b: number, n: number) {
  const s = C.start({ a, b, n }) as Params;
  const steps = C.steps(s) as number;
  const allWalks = C.countWalks(s) as number;
  const fromMirror = C.countWalks(C.start({ a: -s.a, b: s.b, n: s.n })) as number;
  const brute = enumerateBadPaths(s.a, s.b, steps);
  // The lemma is only claimed above the axis at both ends (a = 0 is a quirk
  // of the applet's own reflection rule).
  const badPaths = s.a > 0 && s.b > 0 ? fromMirror : brute;
  return {
    start: s,
    steps,
    parityShortened: steps !== s.n,
    reachable: Boolean(C.reachable(s)),
    allWalks,
    fromMirror,
    badPaths,
    goodPaths: badPaths === null ? null : allWalks - badPaths,
    bruteForceBadPaths: brute,
    bruteForceAgrees: brute === null || badPaths === null ? null : brute === badPaths,
    upSteps: (steps + s.b - s.a) / 2,
  };
}

function readWalk(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.map(Number);
  return out.length && out.every((y) => Number.isFinite(y)) ? out : null;
}

export function actions(): GameActions {
  const C = core();
  return {
    reflect_and_count: {
      describe:
        "Draw one walk from A = (0,a) to B = (n,b) with its reflection from A' = (0,-a), and count the walks: all of them C(steps,(steps+b-a)/2), and the bad ones that touch the axis C(steps,(steps+b+a)/2) by the reflection lemma (for positive a and b). A small brute-force count checks the lemma; seed 42 at the default a=3,b=4,n=9 gives a walk that actually touches the axis.",
      args: '{ "a": 3, "b": 4, "n": 9, "seed": 42 }',
      run: (args) => {
        const a = Math.round(num(args, "a", C.DEFAULTS.a));
        const b = Math.round(num(args, "b", C.DEFAULTS.b));
        const n = Math.round(num(args, "n", C.DEFAULTS.n));
        const seed = num(args, "seed", 42);
        const c = counts(C, a, b, n);
        const { path, reflected } = C.pair(C.start(c.start), seeded(seed)) as WalkPair;
        const ideal = C.reflect(path) as number[];
        const firstTouchAt = path.findIndex((y) => y === 0);
        return {
          ...c,
          example: {
            seed,
            walk: path,
            reflection: reflected,
            idealReflection: ideal,
            firstTouchAt,
            touchesAxis: firstTouchAt >= 0,
            endsAt: path[path.length - 1],
            reflectionMatches: JSON.stringify(reflected) === JSON.stringify(ideal),
          },
          note:
            "Reflect the part of a touching walk up to its first touch of the axis: it becomes a walk from A' to B, and every walk from A' to B must cross back. This one-to-one pairing is why the bad walks are counted by an ordinary binomial coefficient.",
        };
      },
    },
    reflect_path: {
      describe:
        "Reflect a given walk, listed as its heights at each step, in the axis up to its first touch: the reflected heights start at -a and then copy the original, so a walk that touches the axis becomes a walk from A' to the same end B. This is the pairing behind the Reflection Lemma.",
      args: '{ "path": [3, 4, 3, 2, 1, 0, 1, 2, 3, 4] }',
      run: (args) => {
        const path = numArray(args, "path");
        if (path.some((y) => !Number.isInteger(y))) throw new Error('"path" must be whole-number heights');
        if (path.some((y, i) => i > 0 && Math.abs(y - path[i - 1]) !== 1)) {
          throw new Error('"path" must change by exactly +1 or -1 at each step');
        }
        const reflected = C.reflect(path) as number[];
        const firstTouchAt = path.findIndex((y) => y === 0);
        return {
          walk: path,
          reflected,
          firstTouchAt,
          touchesAxis: firstTouchAt >= 0,
          note: firstTouchAt < 0
            ? "This walk never touches the axis, so the lemma's pairing does not apply to it."
            : `The first touch is at step ${firstTouchAt}; before it the heights are negated, after it they are copied.`,
        };
      },
    },
  };
}

/** The position the page saved with Track.state, plus what the core says about it. */
export function position(state: Json, _stateVersion?: number): unknown {
  const C = core();
  const a = Math.round(num(state, "a", C.DEFAULTS.a));
  const b = Math.round(num(state, "b", C.DEFAULTS.b));
  const n = Math.round(num(state, "n", C.DEFAULTS.n));
  const c = counts(C, a, b, n);
  const walk = readWalk(state.walk);
  const reflected = readWalk(state.reflected);
  const firstTouchAt = walk ? walk.findIndex((y) => y === 0) : -1;
  const ideal = walk ? (C.reflect(walk) as number[]) : null;
  return {
    // The fields the page saves, with the same names.
    a: c.start.a,
    b: c.start.b,
    n: c.start.n,
    showNames: state.showNames === true,
    steps: Math.round(num(state, "steps", c.steps)),
    touchedZero: state.touchedZero === true,
    walk,
    reflected,
    explored: state.explored === true,
    // What the core adds.
    stepsFromCore: c.steps,
    reachable: c.reachable,
    allWalks: c.allWalks,
    badPaths: c.badPaths,
    goodPaths: c.goodPaths,
    walksFromMirror: c.fromMirror,
    walkEnd: walk ? walk[walk.length - 1] : null,
    firstTouchAt,
    reflectionMatchesSaved: c.start.a > 0 && reflected && ideal ? JSON.stringify(reflected) === JSON.stringify(ideal) : null,
    note:
      "A walk goes one place right and one place up or down from A = (0,a) to B = (n,b). Reflecting the part up to its first touch of the axis pairs touching walks from A with all walks from A' = (0,-a), giving the bad-path count.",
  };
}
