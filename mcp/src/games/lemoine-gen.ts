/*
 * run_game_logic actions and saved-position reader for Lemoine Gen.
 *
 * The real core is lemoine-gen/lemoine-gen-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the page's 480 x 360 SVG, y down.
 *
 * From a point P the red walk cuts BC by the line through P parallel to AM,
 * then CA by BM, then AB by CM, and repeats. The blue walk first drops a
 * perpendicular to the side and uses the order BC, AB, CA. Every step is an
 * affine map, so after three steps each walk maps one side line to itself and
 * settles into a repeating three-point cycle. Separately, ComputeCenter()
 * writes M = (x:y:z) in barycentrics and marks O = (1/y+1/z : 1/z+1/x :
 * 1/x+1/y), the complement of the isotomic conjugate of M; with M at the
 * symmedian point this is the ordinary Lemoine construction. The marked O is
 * not the limit of either walk. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type State = {
  ABC: Pt[];
  point: Pt;
  iM: Pt | null;
  seed: Pt;
  red: Pt[];
  blue: Pt[];
  which: number;
  running: boolean;
  show: Record<string, boolean>;
};
type StartOpts = { width?: number; height?: number; M?: Pt; seed?: Pt };
type Core = {
  start(options?: StartOpts): State;
  move(state: State, m: Json): State | null;
  run(state: State, limit?: number): State;
  result(state: State): unknown;
  center(vertices: Pt[], m: Pt): Pt | null;
  barycentric(p: Pt, vertices: Pt[]): number[];
  fromBarycentric(w: number[], vertices: Pt[]): Pt;
  symmedianPoint(vertices: Pt[]): Pt;
  reflect(p: Pt, c: Pt): Pt;
  geo: { area2(a: Pt, b: Pt, c: Pt): number };
  SIDES: number[][];
};

const core = (): Core => cores["lemoine-gen"].LemoineGenCore as unknown as Core;
const PAGE = { width: 480, height: 360 }; // the page's SVG viewBox
const SIDE_NAMES = ["BC", "CA", "AB"] as const; // SIDES = [[1,2],[2,0],[0,1]]
const SHOW_KEYS = ["red", "blue", "connections", "center", "reflection", "cevians"];
const CYCLE_TOL = 1e-5; // the logic test's tolerance for a closed 3-cycle

/* The core is exact up to floating point; only what we print is rounded. */
const r6 = (v: number): number | null => (Number.isFinite(v) ? Number(v.toFixed(6)) : null);
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x)!, y: r6(p.y)! } : null;
const near = (a: number, b: number, tol: number): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const nearPt = (a: Pt | null, b: Pt | null, tol: number): boolean =>
  !!a && !!b && near(a.x, b.x, tol) && near(a.y, b.y, tol);
const numOr = (raw: unknown, fallback: number): number =>
  raw !== undefined && raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : fallback;
const boolOr = (raw: unknown, fallback: boolean): boolean =>
  typeof raw === "boolean" ? raw : fallback;

/** A point, accepted as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x = NaN, y = NaN;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`"${label}" must be [x, y] or { x, y }`);
    [x, y] = [Number(raw[0]), Number(raw[1])];
  } else if (typeof raw === "object") {
    const o = raw as Json;
    if (o.x === undefined || o.y === undefined) {
      throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
    }
    [x, y] = [Number(o.x), Number(o.y)];
  } else {
    throw new Error(`"${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

/** A walk is an array of points; an empty or absent one restarts at the seed. */
function readWalk(raw: unknown, label: string, fallback: Pt[]): Pt[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback.slice();
  return raw.map((p, i) => readPoint(p, `${label}[${i}]`));
}

/** The three corners, defaulting to the page's opening triangle. */
function readTriangle(C: Core, args: Json): Pt[] {
  const seed = C.start(PAGE);
  const ABC = [
    readPoint(args.A, "A", seed.ABC[0]),
    readPoint(args.B, "B", seed.ABC[1]),
    readPoint(args.C, "C", seed.ABC[2]),
  ];
  if (Math.abs(C.geo.area2(ABC[0], ABC[1], ABC[2])) < 1e-6) {
    throw new Error("A, B and C must form a non-flat triangle");
  }
  return ABC;
}

/** M may be a point or the string "symmedian" (the Lemoine-point case). */
function readM(C: Core, args: Json, ABC: Pt[]): Pt {
  const raw = args.M;
  if (typeof raw === "string") {
    if (raw === "symmedian" || raw === "K" || raw === "lemoine") {
      return C.symmedianPoint(ABC);
    }
    throw new Error(`M may be a point or "symmedian", got ${JSON.stringify(raw)}`);
  }
  return readPoint(raw, "M", C.start(PAGE).point);
}

/** Reject M on a side: some barycentric is 0, so O and some parallel guides fail. */
function offSideWeights(C: Core, ABC: Pt[], m: Pt, label: string): number[] {
  const w = C.barycentric(m, ABC);
  const sum = w[0] + w[1] + w[2];
  if (!Number.isFinite(sum) || Math.abs(sum) < 1e-12 ||
      w.some((v) => !Number.isFinite(v) || Math.abs(v / sum) < 1e-6)) {
    throw new Error(`"${label}" lies on (or too close to) a side line of ABC: a barycentric coordinate is ~0, so the centre and some guides are undefined`);
  }
  return w;
}

function readSteps(args: Json): number {
  const raw = args.steps;
  if (raw === undefined || raw === null) return 90; // as in the logic test
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 12 || n > 600) {
    throw new Error(`argument "steps" must be an integer in [12, 600], got ${JSON.stringify(raw)}`);
  }
  return n;
}

const normalized = (w: number[]): (number | null)[] => {
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => (Number.isFinite(v) && Number.isFinite(sum) && Math.abs(sum) > 1e-12 ? r6(v / sum) : null));
};

/** Compare two triples up to their common scale (barycentrics need no sum = 1). */
function ratiosAgree(a: number[], b: number[], tol: number): boolean {
  const sa = a.reduce((x, y) => x + y, 0), sb = b.reduce((x, y) => x + y, 0);
  return a.length === b.length && Number.isFinite(sa) && Number.isFinite(sb) &&
    Math.abs(sa) > 1e-12 && Math.abs(sb) > 1e-12 &&
    a.every((v, i) => Number.isFinite(v) && Number.isFinite(b[i]) &&
      Math.abs(v / sa - b[i] / sb) <= tol);
}

const sideLengths = (ABC: Pt[]) => {
  const d = (p: Pt, q: Pt): number => Math.hypot(q.x - p.x, q.y - p.y);
  return { a_BC: d(ABC[1], ABC[2]), b_CA: d(ABC[2], ABC[0]), c_AB: d(ABC[0], ABC[1]) };
};

/** Which side line a point lies on, read from its (near-zero) barycentric. */
function sideOf(C: Core, ABC: Pt[], p: Pt): string | null {
  const w = C.barycentric(p, ABC);
  const sum = w[0] + w[1] + w[2];
  if (!Number.isFinite(sum) || Math.abs(sum) < 1e-12) return null;
  const hits = w.map((v) => Number.isFinite(v) && Math.abs(v / sum) < 1e-4);
  const on = hits.map((h, i) => (h ? i : -1)).filter((i) => i >= 0);
  return on.length === 1 ? SIDE_NAMES[on[0]] : null;
}

/** What one walk says: its last three points, sides and 3-step closure. */
function cycleReading(C: Core, ABC: Pt[], walk: Pt[]) {
  const n = walk.length;
  const gap = n >= 4 ? Math.hypot(walk[n - 1].x - walk[n - 4].x,
    walk[n - 1].y - walk[n - 4].y) : null;
  return {
    stepsRecorded: Math.max(0, n - 1),
    lastPoint: pt(n ? walk[n - 1] : null),
    sideOfLastPoint: n ? sideOf(C, ABC, walk[n - 1]) : null,
    cyclePoints: n >= 3 ? walk.slice(-3).map((p, i) => ({
      point: pt(p), side: sideOf(C, ABC, p), stepsAgo: 2 - i,
    })) : [],
    closesAfterThree: gap !== null && gap <= CYCLE_TOL,
    gapFromThreeStepsEarlier: gap === null ? null : r6(gap),
  };
}

/** The centre the applet marks, measured through the core at one triangle and M. */
function centreReading(C: Core, ABC: Pt[], m: Pt) {
  const w = C.barycentric(m, ABC);
  const sum = w[0] + w[1] + w[2];
  const bad = !Number.isFinite(sum) || Math.abs(sum) < 1e-12 ||
    w.some((v) => !Number.isFinite(v) || Math.abs(v) < 1e-12);
  const O = bad ? null : C.center(ABC, m);
  const wO = O ? C.barycentric(O, ABC) : null;
  const inv = bad ? null : w.map((v) => 1 / v);
  const expected = inv ? [inv[1] + inv[2], inv[2] + inv[0], inv[0] + inv[1]] : null;
  const lengths = sideLengths(ABC);
  const K = C.symmedianPoint(ABC);
  return {
    M: { at: pt(m), barycentric: normalized(w) },
    reciprocals: inv ? normalized(inv) : null,
    centre: {
      at: pt(O),
      barycentric: wO ? normalized(wO) : null,
      expectedBarycentric: expected ? normalized(expected) : null,
      formulaHolds: !!(O && wO && expected && ratiosAgree(expected, wO, 1e-6)),
      formula: "(1/y + 1/z : 1/z + 1/x : 1/x + 1/y) for M = (x:y:z)",
    },
    sides: { a_BC: r6(lengths.a_BC), b_CA: r6(lengths.b_CA), c_AB: r6(lengths.c_AB) },
    symmedian: { at: pt(K), barycentric: normalized([lengths.a_BC ** 2, lengths.b_CA ** 2, lengths.c_AB ** 2]) },
    mIsSymmedian: nearPt(m, K, 1e-6 * Math.max(1, lengths.a_BC)),
    lemoineCase: {
      centreWhenMIsK: pt(bad ? null : C.center(ABC, K)),
      expectedBarycentric: normalized([
        1 / (lengths.b_CA ** 2) + 1 / (lengths.c_AB ** 2),
        1 / (lengths.c_AB ** 2) + 1 / (lengths.a_BC ** 2),
        1 / (lengths.a_BC ** 2) + 1 / (lengths.b_CA ** 2),
      ]),
      formula: "(1/b² + 1/c² : 1/c² + 1/a² : 1/a² + 1/b²) with a = BC, b = CA, c = AB",
    },
  };
}

function buildState(C: Core, ABC: Pt[], m: Pt, seed: Pt): State {
  return { ...C.start(PAGE), ABC, point: m, seed, red: [seed], blue: [seed], which: 0 };
}

export function actions(): GameActions {
  return {
    walks: {
      describe:
        "Run the applet's two walks on the real core from triangle A, B, C (each [x,y] or {x,y}, default the opening triangle), free point M (a point or \"symmedian\") and seed, for `steps` iterations (12 to 600, default 90), and report each walk's last three points, the side each lies on and whether the last point repeats the one three steps earlier — the affine three-point cycle. Also gives M's barycentrics and the marked centre O = (1/y+1/z : 1/z+1/x : 1/x+1/y), which is not either walk's limit; a flat triangle or M on a side is refused.",
      args: '{"seed":[170,110],"steps":90}',
      run: (args) => {
        const C = core();
        const ABC = readTriangle(C, args);
        const M = readM(C, args, ABC);
        offSideWeights(C, ABC, M, "M");
        const seed = readPoint(args.seed, "seed", C.start(PAGE).seed);
        const steps = readSteps(args);
        const settled = C.run(buildState(C, ABC, M, seed), steps);
        const cr = centreReading(C, ABC, M);
        const lastRed = settled.red[settled.red.length - 1] ?? null;
        const lastBlue = settled.blue[settled.blue.length - 1] ?? null;
        const O = cr.centre.at;
        return {
          triangle: { A: pt(ABC[0]), B: pt(ABC[1]), C: pt(ABC[2]) },
          M: pt(M), seed: pt(seed), steps,
          sideOrder: { red: ["BC", "CA", "AB"], blue: ["BC", "AB", "CA"] },
          red: cycleReading(C, ABC, settled.red),
          blue: cycleReading(C, ABC, settled.blue),
          centre: { at: O, formula: cr.centre.formula },
          centreIsEitherWalkLimit: nearPt(O, lastRed, 1e-3) || nearPt(O, lastBlue, 1e-3),
          note:
            "Each step is affine: through P parallel to AM onto BC, then BM onto CA, then CM onto AB for red; blue drops a perpendicular first and visits BC, AB, CA. After three steps a walk maps one side line to itself, so it settles into a cycle of three points, one per side. The green centre is computed from M by a separate formula and is not one of those cycle points. Illustration only: there is no win or loss.",
        };
      },
    },

    centre: {
      describe:
        "For triangle A, B, C and free point M (a point, or \"symmedian\" for the Lemoine-point case), report M's barycentrics (x:y:z), their reciprocals and the applet's centre O = (1/y+1/z : 1/z+1/x : 1/x+1/y) as barycentrics and a board point, with the side lengths, the symmedian point K = (a²:b²:c²) and the Lemoine case's centre (1/b²+1/c² : 1/c²+1/a² : 1/a²+1/b²). Also checks that reflection in O is the half-turn 2O − P; a flat triangle or M on a side is refused.",
      args: '{"A":[40,200],"B":[310,170],"C":[150,20],"M":"symmedian"}',
      run: (args) => {
        const C = core();
        const ABC = readTriangle(C, args);
        const M = readM(C, args, ABC);
        const w = offSideWeights(C, ABC, M, "M");
        const reading = centreReading(C, ABC, M);
        const O = reading.centre.at;
        const K = C.symmedianPoint(ABC);
        const kW = C.barycentric(K, ABC);
        const lengths = sideLengths(ABC);
        const OK = C.center(ABC, K);
        const okW = OK ? C.barycentric(OK, ABC) : null;
        const expectedK = [
          1 / (lengths.b_CA ** 2) + 1 / (lengths.c_AB ** 2),
          1 / (lengths.c_AB ** 2) + 1 / (lengths.a_BC ** 2),
          1 / (lengths.a_BC ** 2) + 1 / (lengths.b_CA ** 2),
        ];
        const sample = {
          x: (ABC[0].x + ABC[1].x + ABC[2].x) / 3,
          y: (ABC[0].y + ABC[1].y + ABC[2].y) / 3,
        };
        const reflected = O ? C.reflect(sample, O) : null;
        const halfTurn = O ? { x: 2 * O.x - sample.x, y: 2 * O.y - sample.y } : null;
        return {
          triangle: { A: pt(ABC[0]), B: pt(ABC[1]), C: pt(ABC[2]) },
          ...reading,
          lemoineCase: {
            ...reading.lemoineCase,
            symmedianBarycentricIsSquaredSides: ratiosAgree(
              kW, [lengths.a_BC ** 2, lengths.b_CA ** 2, lengths.c_AB ** 2], 1e-9),
            centreBarycentric: okW ? normalized(okW) : null,
            centreMatchesReciprocalSides: !!(okW && ratiosAgree(expectedK, okW, 1e-9)),
          },
          reflection: {
            sample: pt(sample),
            reflectedInO: pt(reflected),
            expected2OMinusP: pt(halfTurn),
            isHalfTurn: nearPt(reflected, halfTurn, 1e-9),
          },
          note:
            "ComputeCenter takes M's barycentrics (x:y:z) to (1/x:1/y:1/z), the isotomic conjugate, then to (1/y+1/z : 1/z+1/x : 1/x+1/y), its centroid complement. With M at the symmedian point a²:b²:c² this becomes the reciprocal-side formula, the familiar Lemoine-point case. Reflection in the marked centre is the half-turn P -> 2O − P; this is an illustration with no win or loss.",
        };
      },
    },
  };
}

/** Rebuild the page's saved picture with safe fallbacks for every field. */
function savedState(C: Core, state: Json) {
  const seed0 = C.start(PAGE);
  const abc = Array.isArray(state.ABC) ? (state.ABC as unknown[]) : [];
  const ABC = [0, 1, 2].map((i) => readPoint(abc[i], `ABC[${i}]`, seed0.ABC[i]));
  const M = readPoint(state.point, "point", seed0.point);
  const seed = readPoint(state.seed, "seed", seed0.seed);
  const red = readWalk(state.red, "red", [seed]);
  const blue = readWalk(state.blue, "blue", [seed]);
  const which = ((Math.trunc(numOr(state.which, 0)) % 3) + 3) % 3;
  const showRaw = state.show !== null && typeof state.show === "object" ? state.show as Json : {};
  const show = Object.fromEntries(SHOW_KEYS.map((k) => [k, boolOr(showRaw[k], false)]));
  const s = buildState(C, ABC, M, seed);
  return {
    s: { ...s, red, blue, which, show, running: boolOr(state.running, false) } as State,
    ABC, M, seed, red, blue, which,
    iM: state.iM === undefined || state.iM === null ? null : pt(readPoint(state.iM, "iM")),
    running: boolOr(state.running, false),
    show,
  };
}

const fmt = (p: Pt | null): string => (p ? `(${Math.round(p.x)}, ${Math.round(p.y)})` : "(?, ?)");

/** Echo the fields Track.state saved and re-measure the picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Lemoine Gen state version ${stateVersion}`);
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Lemoine Gen position must be an object");
  }
  const C = core();
  const saved = savedState(C, state);
  const cr = centreReading(C, saved.ABC, saved.M);
  const settled = C.run(saved.s, 90);
  const lastRed = saved.red[saved.red.length - 1] ?? null;
  const lastBlue = saved.blue[saved.blue.length - 1] ?? null;
  const nextSide = (k: number): number => (k === 1 ? 2 : k === 2 ? 1 : 0);
  return {
    ...state,
    stateVersion,
    stateIsIllustration: C.result(saved.s) === null,
    triangle: {
      A: pt(saved.ABC[0]), B: pt(saved.ABC[1]), C: pt(saved.ABC[2]),
    },
    M: pt(saved.M), seed: pt(saved.seed), iM: saved.iM,
    nextSides: {
      red: SIDE_NAMES[saved.which],
      blue: SIDE_NAMES[nextSide(saved.which)],
    },
    running: saved.running,
    show: saved.show,
    walks: {
      red: cycleReading(C, saved.ABC, saved.red),
      blue: cycleReading(C, saved.ABC, saved.blue),
    },
    centre: cr,
    ifRun: {
      steps: 90,
      red: cycleReading(C, saved.ABC, settled.red),
      blue: cycleReading(C, saved.ABC, settled.blue),
      note: "Where the two walks settle if Animate is left running: each closes a three-point cycle, one point per side line.",
    },
    status: `Red ${Math.max(0, saved.red.length - 1)} steps at ${fmt(lastRed)}; blue ${Math.max(0, saved.blue.length - 1)} steps at ${fmt(lastBlue)}.`,
    note:
      "Track.state saved the triangle ABC, the free point M, the seed and the two coloured walks with their bookkeeping (which, running, six display flags). The core recomputes the barycentrics of M, the marked centre O = (1/y+1/z : 1/z+1/x : 1/x+1/y) and, by running the same walks, the three-point cycles they settle into. O follows its own formula and is not the limit of either walk. This is an illustration with no win or loss; the tracker records exploration.",
  };
}
