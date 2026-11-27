/*
 * run_game_logic actions and saved-position reader for Cyclic Hexagon
 * (Alexander Bogomolny's applet, with the theorem credited to Bui Quang Tuan).
 *
 * Six points alternate around one circle as two interlaced triangles A0..A2
 * and B0..B2. From each A_i drop a perpendicular to the line through its two
 * neighbouring B vertices (length k_i, foot K_i); from each B_i drop one to
 * the line through its two neighbouring A vertices (length l_i, foot L_i).
 * Then k0*k1*k2 = l0*l1*l2, and both equal the product of the six alternating
 * hexagon sides divided by the cube of the diameter D = 2R. The reason is
 * that for P, U, V on one circle, dist(P, line UV) = |PU|*|PV| / D: each
 * perpendicular is a product of two chords over D, and multiplying the three
 * in either family uses every hexagon side exactly once.
 *
 * Every number below is measured by the game's real core
 * (cyclic-hexagon/cyclic-hexagon-core.js), copied into src/generated/cores/
 * at build time. Coordinates are board units from the page's 480 x 420
 * viewBox, with y down. See _shared.ts for the shape of a game module.
 */
import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type State = {
  center: Point;
  radius: number;
  A: Point[];
  B: Point[];
  showNames: boolean;
  showCircles1: boolean;
  showCircles2: boolean;
};
type Circle = { center: Point; radius: number };
type Geometry = {
  N: number;
  A: Point[];
  B: Point[];
  K: Point[];
  L: Point[];
  k: number[];
  l: number[];
  P: Point[];
  Q: Point[];
  rP: number[];
  rQ: number[];
  sides: number[];
  circleA: Circle[];
  circleB: Circle[];
  circleOA: Circle[];
  circleOB: Circle[];
  R: number;
  D: number;
  kProduct: number;
  lProduct: number;
  sideProduct: number;
  sideOverDiameter: number;
};
type Core = {
  N: number;
  WIDTH: number;
  HEIGHT: number;
  CENTER: Point;
  RADIUS: number;
  TAU: number;
  start(options?: Json): State;
  movePoint(s: State, name: string, p: Point): State;
  toggle(s: State, which: string): State;
  reset(s: State): State;
  compute(s: State): Geometry;
  describe(s: State): string;
  result(s?: State): null;
  dist(p: Point, q: Point): number;
  foot(p: Point, a: Point, b: Point): Point;
  mid(p: Point, q: Point): Point;
};

const core = () => cores["cyclic-hexagon"].CyclicHexagonCore as unknown as Core;

/* The core is exact up to floating point; tidy only what we print. */
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const pt = (p: Point): Point => ({ x: round(p.x, 4), y: round(p.y, 4) });
const close = (a: number, b: number, tolerance = 1e-6): boolean =>
  Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));

/** Tool args and saved positions may give a point as [x, y] or {x, y}. */
function readPoint(value: unknown, label: string): Point {
  let x: number, y: number;
  if (Array.isArray(value)) {
    if (value.length !== 2) throw new Error(`"${label}" must be [x, y] or {x, y}`);
    x = Number(value[0]);
    y = Number(value[1]);
  } else if (value && typeof value === "object") {
    const o = value as Json;
    x = o.x as number;
    y = o.y as number;
  } else {
    throw new Error(`"${label}" must be [x, y] or {x, y}`);
  }
  x = Number(x);
  y = Number(y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric coordinates, got ${JSON.stringify(value)}`);
  }
  return { x, y };
}

/** The three A or three B vertices, as points. */
function readTriple(value: unknown, label: string): Point[] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`"${label}" must be an array of exactly three points`);
  }
  return value.map((p, i) => readPoint(p, `${label}[${i}]`));
}

/** Three angles in degrees, one per vertex. */
function readAngles(value: unknown, label: string): number[] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`"${label}" must be an array of exactly three angles in degrees`);
  }
  return value.map((v, i) => {
    const a = Number(v);
    if (!Number.isFinite(a)) throw new Error(`${label}[${i}] is not a finite angle`);
    return a;
  });
}

/**
 * Build a core state from tool arguments. Angles are easier to give for points
 * on a circle; explicit points are accepted too. Either way the real core's
 * movePoint projects each point onto the circumcircle, just as a drag does.
 * Omitting both uses the illustration's opening arrangement.
 */
function stateFromArgs(args: Json): State {
  const C = core();
  let s = C.start({
    showNames: args.showNames === true,
    showCircles1: args.showCircles1 === true,
    showCircles2: args.showCircles2 === true,
  });
  for (const key of ["A", "B"] as const) {
    const anglesKey = `${key}angles`;
    const hasAngles = args[anglesKey] !== undefined && args[anglesKey] !== null;
    const hasPoints = args[key] !== undefined && args[key] !== null;
    if (hasAngles && hasPoints) {
      throw new Error(`give either "${key}angles" or "${key}", not both`);
    }
    if (!hasAngles && !hasPoints) continue;
    let points: Point[];
    if (hasAngles) {
      points = readAngles(args[anglesKey], anglesKey).map((deg) => {
        const a = (deg * Math.PI) / 180;
        return {
          x: s.center.x + s.radius * Math.cos(a),
          y: s.center.y + s.radius * Math.sin(a),
        };
      });
    } else {
      points = readTriple(args[key], key);
    }
    points.forEach((p, i) => {
      if (Math.hypot(p.x - s.center.x, p.y - s.center.y) < 1e-9) {
        throw new Error(`"${key}[${i}]" is at the circle's centre and cannot be projected onto it`);
      }
      s = C.movePoint(s, `${key}${i}`, p);
    });
  }
  return s;
}

/** Everything the core measures at one arrangement, phrased for a tutor. */
function reading(s: State) {
  const C = core();
  const g = C.compute(s);
  if (![g.R, g.D, g.kProduct, g.lProduct, g.sideProduct, g.sideOverDiameter]
    .every((v) => Number.isFinite(v))) {
    throw new Error("the core could not measure this arrangement (a length is not finite)");
  }
  const next = (i: number) => (i + 1) % g.N;
  const prev = (i: number) => (i + g.N - 1) % g.N;

  /* The chord lemma behind the theorem, checked on all six perpendiculars. */
  const fromA = g.k.map((k, i) => {
    const byChord = C.dist(g.A[i], g.B[next(i)]) * C.dist(g.A[i], g.B[prev(i)]) / g.D;
    return { i, perpendicular: round(k), chordProductOverD: round(byChord), agrees: close(k, byChord) };
  });
  const fromB = g.l.map((l, i) => {
    const byChord = C.dist(g.B[i], g.A[next(i)]) * C.dist(g.B[i], g.A[prev(i)]) / g.D;
    return { i, perpendicular: round(l), chordProductOverD: round(byChord), agrees: close(l, byChord) };
  });
  const productsEqual = close(g.kProduct, g.lProduct);
  const formulaFourHolds = productsEqual && close(g.kProduct, g.sideOverDiameter);

  return {
    R: round(g.R),
    D: round(g.D),
    vertices: { A: g.A.map(pt), B: g.B.map(pt) },
    feet: { K: g.K.map(pt), L: g.L.map(pt) },
    perpendiculars: { k: g.k.map((v) => round(v)), l: g.l.map((v) => round(v)) },
    products: {
      kProduct: round(g.kProduct),
      lProduct: round(g.lProduct),
      equal: productsEqual,
      gap: round(Math.abs(g.kProduct - g.lProduct)),
    },
    chordLemma: {
      statement: "dist(P, line UV) = |PU| * |PV| / D",
      fromA,
      fromB,
      allAgree: [...fromA, ...fromB].every((c) => c.agrees),
    },
    sides: {
      sides: g.sides.map((v) => round(v)),
      sideProduct: round(g.sideProduct),
      sideOverDiameter: round(g.sideOverDiameter),
    },
    formulaFourHolds,
    coreDescription: C.describe(s),
  };
}

const formulaTwoNote =
  "The page's intermediate formula (2) prints P(i+1) and Q(i+1), but with the indices used here " +
  "the correct partners for k_i and l_i are Q(i-1) and P(i-1). As printed it fails in almost every " +
  "configuration; shifted by one it is exact. The final product formulas (1), (3) and (4) are " +
  "unaffected, because a product does not care which way round the indices run.";

export function actions(): GameActions {
  return {
    perpendicular_products: {
      describe:
        "Place six points on the page's circle and, with the real core, drop each A_i perpendicular to the line through its two neighbouring B vertices (length k_i, foot K_i) and each B_i to the line through its two neighbouring A vertices (length l_i, foot L_i). Report the three k lengths and three l lengths, their feet, the products k0*k1*k2 and l0*l1*l2 with whether they are equal, and the chord-lemma check dist(P, line UV) = |PU|*|PV|/D on all six. Give Aangles/Bangles in degrees (defaults 0,120,240 and 180,300,60), or explicit A/B points, which the core projects onto the circle as a drag would.",
      args: '{ "Aangles": [10, 130, 250], "Bangles": [190, 310, 70] }',
      run: (args) => {
        const m = reading(stateFromArgs(args));
        return {
          R: m.R,
          D: m.D,
          vertices: m.vertices,
          feet: m.feet,
          perpendiculars: m.perpendiculars,
          products: m.products,
          chordLemma: m.chordLemma,
          note:
            "Individual k and l lengths generally differ, but their products match. " +
            "Each length is a product of two chords divided by the diameter, so multiplying three " +
            "of them uses every side of the alternating hexagon once. " + formulaTwoNote,
        };
      },
    },
    side_formula: {
      describe:
        "For the same six points, check the page's formula (4) with the real core: the product of the three k lengths, the product of the three l lengths, and the product of all six alternating hexagon sides divided by D^3 (D = 2R, so D^3 = 8R^3) are one and the same number. Report R, D, the six sides, their product and the quotient, and whether all three agree. The page flags that its intermediate formula (2) prints P(i+1)/Q(i+1) whereas the correct partners are Q(i-1)/P(i-1); shifted by one it is exact, and the final product formulas are unaffected. Angles or points are given as in perpendicular_products.",
      args: '{ "Aangles": [0, 120, 240], "Bangles": [180, 300, 60] }',
      run: (args) => {
        const m = reading(stateFromArgs(args));
        return {
          R: m.R,
          D: m.D,
          vertices: m.vertices,
          sides: m.sides,
          products: m.products,
          formulaFour: {
            statement: "k0*k1*k2 = l0*l1*l2 = (a0*a1*a2*a3*a4*a5) / D^3, with D = 2R",
            kProduct: m.products.kProduct,
            lProduct: m.products.lProduct,
            sideProductOverD3: m.sides.sideOverDiameter,
            allThreeAgree: m.formulaFourHolds,
          },
          note:
            "Multiplying the three perpendiculars in either family uses all six hexagon sides once, " +
            "each over the same diameter D = 2R. " + formulaTwoNote,
        };
      },
    },
  };
}

/** The fields Track.state saved, plus the core's reading of that same picture. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Cyclic Hexagon state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object") {
    throw new Error("missing saved Cyclic Hexagon state");
  }
  const C = core();
  const center = readPoint(state.center, "center");
  const radius = num(state, "radius");
  if (!(radius > 0)) throw new Error('"radius" must be a positive number');
  const A = readTriple(state.A, "A");
  const B = readTriple(state.B, "B");
  for (const [key, pts] of [["A", A], ["B", B]] as const) {
    pts.forEach((p, i) => {
      if (Math.hypot(p.x - center.x, p.y - center.y) < 1e-9) {
        throw new Error(`saved "${key}[${i}]" is at the circle's centre and cannot be projected onto it`);
      }
    });
  }
  const here: State = {
    center,
    radius,
    A,
    B,
    showNames: state.showNames === true,
    showCircles1: state.showCircles1 === true,
    showCircles2: state.showCircles2 === true,
  };
  const g = C.compute(here);
  if (![g.kProduct, g.lProduct, g.sideOverDiameter].every((v) => Number.isFinite(v))) {
    return {
      ...state,
      stateVersion,
      valid: false,
      note: "The saved six points give a non-finite measurement; the core cannot read this picture.",
    };
  }
  const m = reading(here);
  const offCircle = Math.max(...[...A, ...B].map(
    (p) => Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - radius),
  ));
  return {
    // The page's saved fields, with the same names.
    ...state,
    stateVersion,
    valid: true,
    // What the core adds.
    core: {
      R: m.R,
      D: m.D,
      feet: m.feet,
      perpendiculars: m.perpendiculars,
      products: m.products,
      sides: m.sides,
      formulaFourHolds: m.formulaFourHolds,
      chordLemmaAllAgree: m.chordLemma.allAgree,
      result: C.result(here), // an illustration: nothing can be won or lost
    },
    offCircle: round(offCircle, 8),
    allPointsOnCircle: offCircle <= 1e-6 * Math.max(1, radius),
    note:
      `Track.state saved a circle of radius ${round(radius)} about (${round(center.x)}, ${round(center.y)}) ` +
      `with three A points, three B points, names ${here.showNames ? "shown" : "hidden"}, ` +
      `side circles ${here.showCircles1 ? "shown" : "hidden"} and half-size circles ` +
      `${here.showCircles2 ? "shown" : "hidden"}. ` +
      `With D = 2R = ${m.D}, the core measures k0*k1*k2 = ${m.products.kProduct}, ` +
      `l0*l1*l2 = ${m.products.lProduct} (equal: ${m.products.equal}), and the six sides divided by ` +
      `D^3 = ${m.sides.sideOverDiameter}; formula (4) holds: ${m.formulaFourHolds}.`,
  };
}
