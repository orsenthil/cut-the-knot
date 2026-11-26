/*
 * run_game_logic actions and saved-position reader for Random Walks. The core lives in
 * random-walk/ and is copied into src/generated/cores/ at build time. See _shared.ts for the
 * module shape.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

const core = () => cores["random-walk"].RandomWalkCore;

/** Slider values are whole numbers inside the applet's ranges. */
function whole(args: Json, key: string, range: number[], fallback: number): number {
  const v = Math.round(num(args, key, fallback));
  if (v < range[0] || v > range[1]) {
    throw new Error(`argument "${key}" must be a whole number in ${range[0]}..${range[1]}`);
  }
  return v;
}

/** What the core can say about endpoints a, b and n steps. */
function read(a: number, b: number, n: number) {
  const C = core();
  const s = C.start({ a, b, n });
  const steps = C.steps(s);
  const reachable = C.reachable(s);
  const routes = C.countWalks(s);
  const up = reachable ? (steps + b - a) / 2 : null;
  const down = up === null ? null : steps - up;
  // Reflecting the part before the first axis touch maps walks from a that
  // touch 0 one-to-one onto all walks from -a to b (the reflection lemma).
  const touched = a > 0 ? C.countWalks(C.start({ a: -a, b, n })) : null;
  return {
    a: s.a, b: s.b, n: s.n,
    steps,
    shortenedByOne: steps !== s.n,
    reachable,
    upSteps: up,
    downSteps: down,
    routes,
    touchingAxisRoutes: touched,
  };
}

export function actions(): GameActions {
  const C = core();
  return {
    count: {
      describe:
        "How many up/down routes join height a to height b in n steps: u = (steps + b - a)/2 steps go up, so the number of routes is C(steps, u), provided the steps and b-a share parity and there are enough of them; the applet quietly drops one step if the parity is wrong. For a positive start it also counts the routes that touch the axis, which the reflection lemma matches with all routes from -a to b.",
      args: '{ "a": 3, "b": 4, "n": 9 }',
      run: (args) => {
        const L = C.LIMITS;
        return read(
          whole(args, "a", L.a, C.DEFAULTS.a),
          whole(args, "b", L.b, C.DEFAULTS.b),
          whole(args, "n", L.n, C.DEFAULTS.n),
        );
      },
    },
    sample: {
      describe:
        "A reproducible sample of walks from a to b: each path lists the walker's height after every step. The core chooses up or down at random but steers towards b near the end, so each sampled walk arrives, and every path is one of the C(steps, u) routes counted by `count`.",
      args: '{ "a": 1, "b": 1, "n": 6, "count": 3, "seed": 1 }',
      run: (args) => {
        const L = C.LIMITS;
        const a = whole(args, "a", L.a, C.DEFAULTS.a);
        const b = whole(args, "b", L.b, C.DEFAULTS.b);
        const n = whole(args, "n", L.n, C.DEFAULTS.n);
        const count = Math.round(num(args, "count", 3));
        if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error("argument \"count\" must be a whole number in 1..50");
        // A tiny seeded generator keeps the sample the same for the tutor.
        let x = Math.round(num(args, "seed", 1)) >>> 0 || 1;
        const random = () => {
          x += 0x6d2b79f5;
          let t = x;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const s = C.start({ a, b, n });
        return {
          ...read(a, b, n),
          walks: Array.from({ length: count }, () => C.walk(s, random)),
        };
      },
    },
  };
}

/** The position the page saves with Track.state, read back through the core. */
export function position(state: Json, _stateVersion: number): unknown {
  const C = core();
  const a = num(state, "a", C.DEFAULTS.a);
  const b = num(state, "b", C.DEFAULTS.b);
  const n = num(state, "n", C.DEFAULTS.n);
  const raw = Array.isArray(state.walks) ? state.walks : [];
  const walks = raw.map((w) => (Array.isArray(w) ? w.map((y) => Number(y)) : []));
  const touched = a > 0 ? walks.find((w) => w.includes(0)) : undefined;
  return {
    ...read(a, b, n),
    showNames: state.showNames === true,
    walks,
    walksShown: walks.length,
    explored: state.explored === true,
    reflectionExample: touched ? { walk: touched, reflected: C.reflect(touched) } : null,
  };
}
