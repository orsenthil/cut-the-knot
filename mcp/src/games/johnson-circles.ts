/*
 * run_game_logic actions and saved-position reader for Johnson Circles.
 *
 * The real core is johnson-circles/johnson-circles-core.js, copied verbatim
 * into src/generated/cores/ at build time; every number below is measured by
 * it or by its own vector helpers, never re-derived here. Coordinates are the
 * page's 420 x 300 SVG user units, y downward, with O the shared point at
 * (210, 150). This is a demonstration: there is no win or loss.
 *
 * Write the three centre vectors from O as a, b, c, each of length r. The
 * second meeting of the b- and c-circles is b + c, so A = b + c, B = c + a,
 * C = a + b and the circumcentre of ABC is Q = a + b + c, distance r from all
 * three. Then (A - O)·(C - B) = (b + c)·(b - c) = |b|² - |c|² = 0, so O is the
 * orthocentre of ABC. The half-turn about N = midpoint(O, Q) sends Oa, Ob, Oc
 * to A, B, C; the stretch by 2 about O sends them to the anticomplementary
 * vertices A' = 2a, B' = 2b, C' = 2c on a circle of radius 2r. A line through
 * C meets the a- and b-circles again at points separated by 2|(b - a)·u|,
 * at most the side A'B' = 2|a - b|; the three such bounds add to the perimeter
 * of A'B'C', the largest perimeter of any triangle with sides through A, B, C.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Circle = { c: Pt; r: number };
type Options = Record<string, boolean>;
type Geometry = {
  valid: boolean;
  reason: string | null;
  O: Pt;
  r: number;
  guide: Circle;
  Oa: Pt; Ob: Pt; Oc: Pt;
  A: Pt; B: Pt; C: Pt; Q: Pt; N: Pt;
  Ap: Pt; Bp: Pt; Cp: Pt;
  circleA: Circle; circleB: Circle; circleC: Circle;
  circle: Circle; antiCircle: Circle;
  centres: Pt[];
  triangle: Pt[];
  anticomplementary: Pt[];
  rhombi: Pt[][];
  altitudes: Pt[][];
  centreAltitudes: Pt[][];
  spokes: Pt[][];
};
type State = {
  Oa: Pt; Ob: Pt; Oc: Pt;
  options: Options;
  moves: number;
  explored: boolean;
};
type Core = {
  VIEW: { width: number; height: number };
  O: Pt;
  RADIUS: number;
  ANGLES: Record<string, number>;
  OPTION_KEYS: string[];
  START: { Oa: Pt; Ob: Pt; Oc: Pt };
  start(o?: { Oa?: Pt; Ob?: Pt; Oc?: Pt; options?: Options }): State;
  randomStart(rand?: () => number): State;
  reset(s: State): State;
  moveCenter(s: State, name: string, p: Pt): State;
  setOption(s: State, name: string, on: boolean): State;
  result(s: State): string | null;
  compute(s: State): Geometry;
  describe(g: Geometry): string;
  label(g: Geometry): string;
  projectToGuide(p: Pt): Pt;
  separated(s: { Oa: Pt; Ob: Pt; Oc: Pt } | null): boolean;
  finite(p: unknown): boolean;
  copy(p: Pt): Pt;
  add(p: Pt, q: Pt): Pt;
  sub(p: Pt, q: Pt): Pt;
  scale(p: Pt, k: number): Pt;
  dot(p: Pt, q: Pt): number;
  dist(p: Pt, q: Pt): number;
  midpoint(p: Pt, q: Pt): Pt;
  onGuide(angle: number): Pt;
};

const core = (): Core => cores["johnson-circles"].JohnsonCirclesCore as unknown as Core;

/* The core keeps full precision; only what we print is rounded. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number): number | null => (Number.isFinite(v) ? Number(v.toExponential(2)) : null);
const rp = (p: Pt | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const rc = (c: Circle | undefined): { c: { x: number; y: number } | null; r: number } | null =>
  c ? { c: rp(c.c), r: r6(c.r) } : null;
const isPlain = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const near = (a: number, b: number, tol = 1e-6): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/* --------------------------------------------------------------- validation */

/** A point as [x, y] or { x, y }, with finite coordinates. */
function readPoint(raw: unknown, label: string): Pt {
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`${label} must be [x, y] or { x, y }`);
    x = Number(raw[0]);
    y = Number(raw[1]);
  } else if (isPlain(raw)) {
    x = Number(raw.x);
    y = Number(raw.y);
  } else {
    throw new Error(`${label} must be [x, y] or { x, y }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} needs finite numeric x and y, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

const maybePoint = (raw: unknown): { x: number; y: number } | null => {
  try {
    return rp(readPoint(raw, "point"));
  } catch {
    return null;
  }
};

/** The applet's five panel checkboxes; absent means unchecked. */
function readOptions(C: Core, raw: unknown, strict = true): Options {
  const opts: Options = {};
  for (const k of C.OPTION_KEYS) opts[k] = false;
  if (raw === undefined || raw === null) return opts;
  if (!isPlain(raw)) {
    if (strict) throw new Error('argument "options" must be an object of booleans');
    return opts;
  }
  for (const k of Object.keys(raw)) {
    if (!C.OPTION_KEYS.includes(k)) {
      if (strict) {
        throw new Error(`unknown option "${k}": expected one of ${C.OPTION_KEYS.join(", ")}`);
      }
      continue;
    }
    const v = raw[k];
    if (typeof v !== "boolean") {
      if (strict) throw new Error(`option "${k}" must be true or false`);
      continue;
    }
    opts[k] = v;
  }
  return opts;
}

const savedOptions = (raw: unknown): Options | null => {
  if (!isPlain(raw)) return null;
  const o: Options = {};
  for (const k of Object.keys(raw)) if (typeof raw[k] === "boolean") o[k] = raw[k] as boolean;
  return o;
};

type CentreName = "Oa" | "Ob" | "Oc";
const CENTRES: readonly CentreName[] = ["Oa", "Ob", "Oc"];

/** Start the core from any supplied centres; the core projects them to the guide. */
function buildState(C: Core, args: Json): { s: State; given: CentreName[] } {
  if (!isPlain(args)) throw new Error("arguments must be an object with optional Oa, Ob, Oc and options");
  const given: CentreName[] = [];
  const seed: { Oa?: Pt; Ob?: Pt; Oc?: Pt; options: Options } = {
    options: readOptions(C, args.options),
  };
  for (const name of CENTRES) {
    const raw = args[name];
    if (raw !== undefined && raw !== null) {
      seed[name] = readPoint(raw, name);
      given.push(name);
    }
  }
  return { s: C.start(seed), given };
}

function readDirection(C: Core, args: Json, fallback: Pt): Pt {
  const raw = args.direction;
  if (raw === undefined || raw === null) return fallback;
  const v = readPoint(raw, "direction");
  if (Math.hypot(v.x, v.y) < 1e-9) throw new Error('argument "direction" must be a nonzero vector');
  return v;
}

/* ------------------------------------------------------------------ readings */

/** The equal circles, the orthocentric system and the rhombi, all from compute(). */
function configuration(C: Core, g: Geometry) {
  if (!g.valid) {
    return {
      valid: false,
      reason: g.reason,
      describe: C.describe(g),
      note: "The core refuses this picture: two centres are less than two units apart, so it does not draw the circles.",
    };
  }
  const O = g.O;
  const a = C.sub(g.Oa, O), b = C.sub(g.Ob, O), c = C.sub(g.Oc, O);
  const expectedA = C.add(O, C.add(b, c));
  const expectedB = C.add(O, C.add(c, a));
  const expectedC = C.add(O, C.add(a, b));
  const expectedQ = C.add(O, C.add(C.add(a, b), c));

  const sums = {
    A_is_b_plus_c: { expected: rp(expectedA), residual: sig(C.dist(g.A, expectedA)) },
    B_is_c_plus_a: { expected: rp(expectedB), residual: sig(C.dist(g.B, expectedB)) },
    C_is_a_plus_b: { expected: rp(expectedC), residual: sig(C.dist(g.C, expectedC)) },
    Q_is_a_plus_b_plus_c: { expected: rp(expectedQ), residual: sig(C.dist(g.Q, expectedQ)) },
  };
  const radii = {
    guide: r6(g.guide.r),
    circleA: r6(g.circleA.r),
    circleB: r6(g.circleB.r),
    circleC: r6(g.circleC.r),
    fourth: r6(g.circle.r),
    anticomplementary: r6(g.antiCircle.r),
  };
  const allFourEqual = [g.guide.r, g.circleA.r, g.circleB.r, g.circleC.r, g.circle.r]
    .every((v) => near(v, g.r));
  const Q_to_ABC_minus_r = {
    QA: sig(C.dist(g.Q, g.A) - g.r),
    QB: sig(C.dist(g.Q, g.B) - g.r),
    QC: sig(C.dist(g.Q, g.C) - g.r),
  };
  const orthocentre = {
    OA_dot_BC: sig(C.dot(C.sub(g.A, O), C.sub(g.C, g.B))),
    OB_dot_CA: sig(C.dot(C.sub(g.B, O), C.sub(g.A, g.C))),
    OC_dot_AB: sig(C.dot(C.sub(g.C, O), C.sub(g.B, g.A))),
  };
  const orthocentric = Object.values(orthocentre)
    .every((v) => v !== null && Math.abs(v) <= 1e-6 * g.r * g.r);
  const rhombi = g.rhombi.map((quad) => ({
    vertices: quad.map(rp),
    sideLengths: quad.map((p, i) => r6(C.dist(p, quad[(i + 1) % quad.length]))),
    sidesAllR: quad.every((p, i) => near(C.dist(p, quad[(i + 1) % quad.length]), g.r)),
  }));

  return {
    valid: true,
    board: C.VIEW,
    O: rp(O),
    radius: r6(g.r),
    centres: { Oa: rp(g.Oa), Ob: rp(g.Ob), Oc: rp(g.Oc) },
    guide: rc(g.guide),
    circles: {
      circleA: rc(g.circleA), circleB: rc(g.circleB), circleC: rc(g.circleC),
      fourth: rc(g.circle), anticomplementary: rc(g.antiCircle),
    },
    intersections: { A: rp(g.A), B: rp(g.B), C: rp(g.C) },
    Q: rp(g.Q), N: rp(g.N),
    anticomplementary: { Ap: rp(g.Ap), Bp: rp(g.Bp), Cp: rp(g.Cp) },
    sums,
    radii,
    allFourEqual,
    Q_to_ABC_minus_r,
    orthocentre,
    orthocentric,
    rhombi,
    describe: C.describe(g),
    note:
      `The core draws three circles of radius ${r6(g.r)} through O and a fourth through A, B, C; it finds A = b + c, B = c + a, C = a + b and Q = a + b + c, and the fourth radius is ${r6(g.circle.r)}. ` +
      `The dot products are ${JSON.stringify(orthocentre)}, so O is ${orthocentric ? "the orthocentre of ABC" : "not the orthocentre at this picture"} and the four points form an orthocentric system.`,
  };
}

/** The two homotheties and the largest-perimeter bound, measured by the core. */
function homotheties(C: Core, g: Geometry, direction: Pt | null) {
  if (!g.valid) {
    return {
      valid: false,
      reason: g.reason,
      describe: C.describe(g),
      note: "The core refuses this picture: two centres are less than two units apart, so there is nothing to map.",
    };
  }
  const O = g.O, N = g.N;
  const halfTurn = (p: Pt): Pt => C.add(N, C.scale(C.sub(p, N), -1));
  const double = (p: Pt): Pt => C.add(O, C.scale(C.sub(p, O), 2));
  const map = (f: (p: Pt) => Pt, names: [CentreName, "A" | "B" | "C" | "Ap" | "Bp" | "Cp"][]) =>
    names.map(([from, to]) => ({
      from,
      to,
      image: rp(f(g[from])),
      target: rp(g[to]),
      residual: sig(C.dist(f(g[from]), g[to])),
    }));

  const d = direction ?? C.sub(g.Ob, g.Oa);
  const len = Math.hypot(d.x, d.y);
  const u = { x: d.x / len, y: d.y / len };
  /* C is on the a- and b-circles; C + t u meets them again at t = -2(·u). */
  const chord = (vertex: Pt, c1: Pt, c2: Pt) => {
    const t1 = -2 * C.dot(C.sub(vertex, c1), u);
    const t2 = -2 * C.dot(C.sub(vertex, c2), u);
    const p1 = C.add(vertex, C.scale(u, t1));
    const p2 = C.add(vertex, C.scale(u, t2));
    return { first: p1, second: p2, distance: C.dist(p1, p2) };
  };
  const side = (vertex: Pt, c1: Pt, c2: Pt, outerSide: number) => {
    const q = chord(vertex, c1, c2);
    const bound = 2 * C.dist(c1, c2);
    return {
      distance: q.distance,
      bound,
      output: {
        first: rp(q.first), second: rp(q.second),
        separation: r6(q.distance),
        bound: r6(bound),
        anticomplementarySide: r6(outerSide),
        withinBound: q.distance <= bound + 1e-6,
      },
    };
  };
  const throughA = side(g.A, g.Ob, g.Oc, C.dist(g.Bp, g.Cp));
  const throughB = side(g.B, g.Oc, g.Oa, C.dist(g.Cp, g.Ap));
  const throughC = side(g.C, g.Oa, g.Ob, C.dist(g.Ap, g.Bp));
  const perimeter = (p: Pt, q: Pt, s: Pt): number =>
    C.dist(p, q) + C.dist(q, s) + C.dist(s, p);
  const pABC = perimeter(g.A, g.B, g.C);
  const pAnti = perimeter(g.Ap, g.Bp, g.Cp);
  const sumOfBounds = throughA.bound + throughB.bound + throughC.bound;

  return {
    valid: true,
    direction: rp(u),
    homothetyMinusOne: {
      center: rp(N),
      maps: map(halfTurn, [["Oa", "A"], ["Ob", "B"], ["Oc", "C"]]),
    },
    homothetyTwo: {
      center: rp(O),
      maps: map(double, [["Oa", "Ap"], ["Ob", "Bp"], ["Oc", "Cp"]]),
      outerRadius: r6(g.antiCircle.r),
      outerMinusTwiceR: sig(g.antiCircle.r - 2 * g.r),
    },
    perimeters: {
      ABC: r6(pABC),
      anticomplementary: r6(pAnti),
      ratio: r6(pAnti / pABC),
    },
    sideBounds: {
      throughA: throughA.output,
      throughB: throughB.output,
      throughC: throughC.output,
    },
    sumOfBounds: r6(sumOfBounds),
    perimeterBoundHolds: [throughA, throughB, throughC].every((s) => s.distance <= s.bound + 1e-6),
    anticomplementaryIsLargest: near(sumOfBounds, pAnti, 1e-6 * Math.max(1, pAnti)),
    describe: C.describe(g),
    note:
      `The half-turn about N = ${JSON.stringify(rp(N))} sends Oa, Ob, Oc to A, B, C, and the stretch by 2 about O sends them to the anticomplementary vertices on a circle of radius ${r6(g.antiCircle.r)}. ` +
      `A line in direction ${JSON.stringify(rp(u))} through each of A, B, C cuts its two circles in chords no longer than the matching side of A'B'C' (perimeter ${r6(pAnti)}, twice the ${r6(pABC)} of ABC), so no triangle with sides through A, B, C has a larger perimeter.`,
  };
}

/* The live page's saved centres (rounded from porting/live-fixtures/johnson-circles.json). */
const fixtureCentres = {
  Oa: [254.292, 190.475],
  Ob: [167.574, 192.426],
  Oc: [228.541, 92.937],
};

export function actions(): GameActions {
  return {
    fourth_circle: {
      describe:
        "Place the three equal circles from centre positions Oa, Ob, Oc (each [x, y] or { x, y }, projected onto the guide circle; the applet's opening centres are used when omitted), optionally with the five panel flags in options, then run the real core's compute. It reports the three circles and the fourth through the other intersections A, B, C, checks the vector sums A = b+c, B = c+a, C = a+b and Q = a+b+c, that Q is distance r from each of A, B, C, that O is the orthocentre of ABC (OA perpendicular to BC and so on), and the three rhombi. The example uses the live page's saved centres.",
      args: JSON.stringify(fixtureCentres),
      run: (args) => {
        const C = core();
        const { s, given } = buildState(C, args);
        return {
          centresSupplied: given,
          options: { ...s.options },
          geometry: configuration(C, C.compute(s)),
          result: C.result(s),
        };
      },
    },

    homotheties_and_perimeter: {
      describe:
        "Take the same optional Oa, Ob, Oc and options, plus an optional nonzero direction [ux, uy] for a line through each vertex (the line of centres OaOb is used by default), and measure the two homotheties with the core's own vector helpers. The half-turn of factor -1 about N = midpoint(O, Q) sends Oa, Ob, Oc to A, B, C; the stretch of factor 2 about O sends them to the anticomplementary triangle A'B'C' on a circle of radius 2r. It also compares the perimeters of ABC and A'B'C' and measures the separation of the second intersections of a line through each of A, B, C with its two circles against the matching outer side, the bound that makes A'B'C' the largest-perimeter triangle; the example uses the live centres with direction [0, 1].",
      args: JSON.stringify({ ...fixtureCentres, direction: [0, 1] }),
      run: (args) => {
        const C = core();
        const { s, given } = buildState(C, args);
        const g = C.compute(s);
        const direction = readDirection(C, args, g.valid ? C.sub(g.Ob, g.Oa) : { x: 1, y: 0 });
        return {
          centresSupplied: given,
          options: { ...s.options },
          homotheties: homotheties(C, g, direction),
          result: C.result(s),
        };
      },
    },
  };
}

/* Reading a saved position must not throw on a damaged or older record. */

/** Rebuild the page's saved centres (which Track.state already projected to the guide). */
function restore(C: Core, state: Json): { s: State; readable: boolean } {
  const seed: { Oa?: Pt; Ob?: Pt; Oc?: Pt; options: Options } = {
    options: readOptions(C, state.options, false),
  };
  let readable = isPlain(state.options);
  if (readable) {
    for (const k of Object.keys(state.options as Json)) {
      if (!C.OPTION_KEYS.includes(k) || typeof (state.options as Json)[k] !== "boolean") readable = false;
    }
  }
  for (const name of CENTRES) {
    const raw = state[name];
    try {
      const p = readPoint(raw, name);
      const q = C.projectToGuide(p);
      if (C.dist(p, q) > 0.01) readable = false;
      seed[name] = q;
    } catch {
      readable = false;
    }
  }
  return { s: C.start(seed), readable };
}

/** Echo Track.state's fields, then re-measure the saved picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Johnson Circles state version ${stateVersion}`);
  }
  const src: Json = isPlain(state) ? state : {};
  const C = core();
  const { s, readable } = restore(C, src);
  const g = C.compute(s);
  const geom = configuration(C, g);
  const hom = homotheties(C, g, null);
  return {
    stateVersion,
    saved: {
      Oa: maybePoint(src.Oa),
      Ob: maybePoint(src.Ob),
      Oc: maybePoint(src.Oc),
      options: savedOptions(src.options),
    },
    savedReadable: readable,
    Oa: rp(s.Oa), Ob: rp(s.Ob), Oc: rp(s.Oc),
    options: { ...s.options },
    guide: { c: rp(C.O), r: r6(C.RADIUS) },
    reading: {
      valid: g.valid,
      radius: r6(g.r),
      fourthRadius: g.valid ? r6(g.circle.r) : null,
      allCirclesEqual: g.valid ? (geom as { allFourEqual?: boolean }).allFourEqual : null,
      orthocentric: g.valid ? (geom as { orthocentric?: boolean }).orthocentric : null,
      N: g.valid ? rp(g.N) : null,
      outerRadius: g.valid ? r6(g.antiCircle.r) : null,
      configuration: geom,
      homotheties: hom,
    },
    result: C.result(s),
    note:
      (!readable
        ? "Some saved fields could not be read, so the core's opening centres were used and the reading below comes from them. "
        : "Track.state saved the three centres on the guide circle of radius 60 about O and the five checkbox flags; the core rebuilds every circle, intersection and homothety from them. ") +
      `${g.valid ? `The fourth circle has radius ${r6(g.circle.r)}, the same as the three given circles.` : "The core does not draw this picture."} This is a demonstration, so there is no win or loss.`,
  };
}
