/*
 * run_game_logic actions and saved-position reader for Dissect Cyclic Quadri
 * (Bogomolny's DissectCyclicQuadri applet).
 *
 * A, B, C, D glide on one circle and P is a free point. Cut points R, M, N, Q
 * on the side lines AB, BC, CD, DA join P and split the quadrilateral into
 * BRPM, CMPN, DNPQ and AQPR. The page's article makes two claims:
 *
 *   1. For any P, the perpendicular feet from P to the four side lines make
 *      all four pieces cyclic (opposite angles are supplementary).
 *   2. Fix N on CD; the circle through C, N, P fixes M on CB, the circle
 *      through B, M, P fixes R on BA, and the circle through A, R, P fixes Q
 *      on AD. DNPQ then turns out cyclic automatically.
 *
 * Its last paragraph is inconsistent about when all four cut points lie
 * strictly inside the sides: with X = AD ^ BC and Y = AB ^ CD it first asks P
 * to be outside the circles ABX and BCY, and then outside ABX and BXY. Both
 * actions below report X and Y and that wording discrepancy; the core checks
 * the always-cyclic constructions, not that locus.
 *
 * Every number returned here is measured by the game's real core,
 * dissect-cyclic-quadri/dissect-cyclic-quadri-core.js, copied into
 * src/generated/cores/ at build time. Coordinates are board units of the
 * page's 400 x 300 viewBox, with y down. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Coef = { R: number; M: number; N: number; Q: number };
type CutPoints = { R: Point; M: Point; N: Point; Q: Point };
type Options = { names: boolean; helper: boolean; hint: boolean };
type State = CutPoints & {
  A: Point; B: Point; C: Point; D: Point; P: Point;
  coef: Coef; options: Options; fromFeet: boolean; explored: boolean;
};
type QuadResult = {
  name: string;
  cyclic: boolean;
  gap: number | null;
  circle: { center: Point; radius: number } | null;
};
type Quads = {
  quads: QuadResult[];
  cyclic: boolean[];
  count: number;
  strictCount: number;
  relaxedUsed: boolean;
  hintEnabled: boolean;
  tolerance: { strict: number; relaxed: number };
};
type Core = {
  STRICT: number;
  RELAXED: number;
  start(options?: Json): State;
  move(state: State, name: string, q: Point): State;
  feet(state: State): CutPoints;
  useFeet(state: State): State;
  solveFromN(state: State): State;
  sidePoints(v: Pick<State, "A" | "B" | "C" | "D">, coef: Coef): CutPoints;
  coefFor(p: Point, a: Point, b: Point, clamp?: boolean): number;
  computeQuads(state: State): {
    strictCount: number;
    count: number;
    relaxedUsed: boolean;
    hintEnabled: boolean;
    showHint: boolean;
    quads: Array<{
      name: string;
      circle: { c: Point; r: number } | null;
      gap: number;
      cyclic: boolean;
    }>;
  };
  angle(v: Point, p: Point, q: Point): number;
  intersect(a: Point, b: Point, c: Point, d: Point, tiny?: number): Point | null;
  dist(p: Point, q: Point): number;
  describe(state: State): string;
};

const core = (): Core =>
  cores["dissect-cyclic-quadri"].DissectCyclicQuadriCore as unknown as Core;

const LOCUS_NOTE =
  "The page is inconsistent about the locus where all four cuts fall inside the sides: with X = AD ^ BC and Y = AB ^ CD, one passage says P must be outside the circles ABX and BCY, another says ABX and BXY. This reader checks the two constructions that always produce cyclic pieces, not that disputed locus.";

/** JSON-safe output: finite numbers rounded, non-finite measurements as null. */
const out = (v: number, digits = 6): number | null =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : null;
const pt = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const round = (v: number, digits = 6): number =>
  Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN;
const deg = (radians: number): number | null =>
  Number.isFinite(radians) ? round((radians * 180) / Math.PI, 4) : null;

function readPoint(v: unknown, label: string, fallback?: Point): Point {
  if (v === undefined || v === null) {
    if (fallback) return fallback;
    throw new Error(`missing argument "${label}": give [x, y] or { "x": ..., "y": ... }`);
  }
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`argument "${label}" must be [x, y]`);
    x = Number(v[0]);
    y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

function readCoef(v: unknown, label: string): Coef {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`argument "${label}" must be an object with R, M, N, Q numbers`);
  }
  const o = v as Json;
  const c: Coef = {
    R: num(o, "R"), M: num(o, "M"), N: num(o, "N"), Q: num(o, "Q"),
  };
  return c;
}

/**
 * The opening figure, with any corners A-D snapped onto the guide circle and
 * P clamped to the view exactly as a drag through the core does. Missing
 * points keep the applet's start values.
 */
function baseState(args: Json, K: Core): State {
  let s = K.start();
  for (const name of ["A", "B", "C", "D"] as const) {
    if (args[name] !== undefined && args[name] !== null) {
      s = K.move(s, name, readPoint(args[name], name));
    }
  }
  if (args.P !== undefined && args.P !== null) {
    s = K.move(s, "P", readPoint(args.P, "P"));
  }
  return s;
}

/** The core's cyclicity verdict for each piece, including its fallback margin. */
function quadReading(K: Core, s: State): Quads {
  const g = K.computeQuads(s);
  return {
    quads: g.quads.map((q) => ({
      name: q.name,
      cyclic: q.cyclic === true,
      gap: out(q.gap, 9),
      circle: q.circle
        ? { center: pt(q.circle.c), radius: round(q.circle.r) }
        : null,
    })),
    cyclic: g.quads.map((q) => q.cyclic === true),
    count: g.count,
    strictCount: g.strictCount,
    relaxedUsed: g.relaxedUsed,
    hintEnabled: g.hintEnabled,
    tolerance: { strict: K.STRICT, relaxed: K.RELAXED },
  };
}

/**
 * Four points on a circle subtend a chord in angles that are either equal
 * (same side of the chord) or supplementary (opposite sides). Both tests are
 * reported, since the article writes the identities as sums of 180 degrees
 * but the two points can land on the same side.
 */
function anglePair(a: number, b: number) {
  const sum = deg(a + b);
  const difference = deg(Math.abs(a - b));
  return {
    sum,
    difference,
    supplementary: sum !== null && Math.abs(a + b - Math.PI) < 1e-6,
    equalOnSameSide: difference !== null && Math.abs(a - b) < 1e-6,
    cyclicCriterion: Math.abs(a + b - Math.PI) < 1e-6 || Math.abs(a - b) < 1e-6,
  };
}

/** The angles each piece subtends at its outer corner and at P on its cut chord. */
function angleSums(K: Core, s: State) {
  const pair = (corner: Point, cut1: Point, cut2: Point) => {
    const atCorner = K.angle(corner, cut1, cut2);
    const atP = K.angle(s.P, cut1, cut2);
    return {
      atCorner: deg(atCorner),
      atP: deg(atP),
      ...anglePair(atCorner, atP),
    };
  };
  return {
    BRPM: pair(s.B, s.R, s.M),
    CMPN: pair(s.C, s.M, s.N),
    DNPQ: pair(s.D, s.N, s.Q),
    AQPR: pair(s.A, s.Q, s.R),
  };
}

/** The two side-line intersections in the page's disputed locus paragraph. */
function locus(K: Core, s: State) {
  const X = K.intersect(s.A, s.D, s.B, s.C); // AD ^ BC
  const Y = K.intersect(s.A, s.B, s.C, s.D); // AB ^ CD
  return {
    X: X ? pt(X) : null,
    Y: Y ? pt(Y) : null,
    wordings: [
      "P outside the circles ABX and BCY (earlier in the article)",
      "P outside the circles ABX and BXY (at the end of the article)",
    ],
    checkedByCore: false,
  };
}

function coordinates(s: State) {
  return {
    A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D), P: pt(s.P),
  };
}

function cutPoints(s: State) {
  return { R: pt(s.R), M: pt(s.M), N: pt(s.N), Q: pt(s.Q), coef: s.coef };
}

export function actions(): GameActions {
  return {
    perpendicular_feet: {
      describe:
        "For corners A, B, C, D on the circle and a free point P (each [x, y] or {x, y} in the page's 400x300 board; omit any for the opening figure), press the page's Perpendicular feet button with the real core: R, M, N, Q become the feet of the perpendiculars from P to AB, BC, CD and DA. Report those feet and their side parameters, the cyclicity verdict for BRPM, CMPN, DNPQ and AQPR with each corner's gap from the circle through the other three, and the angles each piece subtends at its corner and at P (equal or supplementary, depending on which side of the chord they fall). The core uses a 1-pixel tolerance, relaxed to 3 pixels only when exactly three pieces pass. It also reports X = AD ^ BC and Y = AB ^ CD and the page's two inconsistent wordings of the inside-the-sides locus (ABX & BCY versus ABX & BXY).",
      args: '{ "P": [150, 250] }',
      run: (args) => {
        const K = core();
        const s = K.useFeet(baseState(args, K));
        const reading = quadReading(K, s);
        return {
          ...coordinates(s),
          construction: "perpendicular feet from P to AB, BC, CD and DA",
          cuts: cutPoints(s),
          quads: reading,
          angleSums: angleSums(K, s),
          locus: locus(K, s),
          fromFeet: s.fromFeet,
          coreDescription: K.describe(s),
          note: reading.count === 4
            ? `All four pieces are cyclic: each corner-and-P pair of angles on its cut chord is equal or supplementary, so the feet construction works at this P. ${LOCUS_NOTE}`
            : `Only ${reading.count} of four pieces pass the core's cyclicity test here; the article's claim is about the exact perpendicular feet, so check whether P or a corner lies on a side line. ${LOCUS_NOTE}`,
        };
      },
    },

    build_from_n: {
      describe:
        "Fix N on CD (give N as a point, which the core snaps onto the side, or give t, a number in [0, 1] meaning that fraction from C to D; default 0.4) and run the article's other construction with the real core. The circle through C, N and P meets CB again at M, then circles through B, M and P and through A, R and P fix R and Q uniquely; report those three points, their side parameters, all four cyclicity verdicts and the angles each piece subtends. The article's three angle identities (CNP/CMP, BMP/BRP, ARP/AQP) report both a sum and a difference: they equal 180 degrees when the two points lie on opposite sides of the chord, and are equal when they lie on the same side. DNPQ closes up automatically. Takes the same optional A, B, C, D and P arguments as perpendicular_feet.",
      args: '{ "P": [150, 250], "t": 0.4 }',
      run: (args) => {
        const K = core();
        let s = baseState(args, K);
        const hasN = args.N !== undefined && args.N !== null;
        const hasT = args.t !== undefined && args.t !== null;
        if (hasN && hasT) throw new Error('give either "N" or "t", not both');
        if (hasN) {
          s = K.move(s, "N", readPoint(args.N, "N"));
        } else {
          const t = num(args, "t", 0.4);
          if (t < 0 || t > 1) throw new Error('argument "t" must be between 0 and 1');
          s = K.move(s, "N", { x: s.C.x + t * (s.D.x - s.C.x), y: s.C.y + t * (s.D.y - s.C.y) });
        }
        const originalN = pt(s.N);
        const solved = K.solveFromN(s);
        const reading = quadReading(K, solved);
        const angles = angleSums(K, solved);
        const feet = K.useFeet(s);
        const feetDistance = (name: keyof CutPoints): number | null =>
          out(K.dist(solved[name], feet[name]), 6);
        return {
          ...coordinates(s),
          fixedN: originalN,
          construction:
            "C,N,P circle -> M on CB; B,M,P circle -> R on BA; A,R,P circle -> Q on AD",
          cuts: cutPoints(solved),
          quads: reading,
          angleSums: angles,
          distanceFromFeet: { R: feetDistance("R"), M: feetDistance("M"), Q: feetDistance("Q") },
          // The three angle pairs the article uses to build M, R and Q. It
          // writes each as 180 degrees; equality is the same-side version.
          keyAnglesDeg: {
            CNP_CMP: anglePair(K.angle(solved.N, s.C, s.P), K.angle(solved.M, s.C, s.P)),
            BMP_BRP: anglePair(K.angle(solved.M, s.B, s.P), K.angle(solved.R, s.B, s.P)),
            ARP_AQP: anglePair(K.angle(solved.R, s.A, s.P), K.angle(solved.Q, s.A, s.P)),
          },
          locus: locus(K, solved),
          coreDescription: K.describe(solved),
          note: reading.quads.find((q) => q.name === "DNPQ")?.cyclic === true
            ? `With N fixed, the core determines M, R and Q and DNPQ is cyclic for free; all four pieces read ${reading.count} of 4. ${LOCUS_NOTE}`
            : `The construction from N did not make DNPQ pass the core's test here (perhaps two points coincide or a circle is degenerate). ${LOCUS_NOTE}`,
        };
      },
    },
  };
}

/** The fields Track.state saves, plus a fresh core reading of that diagram. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Dissect Cyclic Quadri state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object") {
    throw new Error("missing saved Dissect Cyclic Quadri state");
  }
  const K = core();
  const A = readPoint(state.A, "A");
  const B = readPoint(state.B, "B");
  const C = readPoint(state.C, "C");
  const D = readPoint(state.D, "D");
  const P = readPoint(state.P, "P");
  const R = readPoint(state.R, "R");
  const M = readPoint(state.M, "M");
  const N = readPoint(state.N, "N");
  const Q = readPoint(state.Q, "Q");
  const coef = readCoef(state.coef, "coef");
  const rawOptions = state.options && typeof state.options === "object"
    ? state.options as Json : {};
  const options: Options = {
    names: rawOptions.names === true,
    helper: rawOptions.helper === true,
    hint: rawOptions.hint === true,
  };
  const savedCyclic: boolean[] | null = Array.isArray(state.cyclic)
    ? state.cyclic.map((v) => v === true) : null;
  const savedCount = state.count === undefined || state.count === null
    ? null : num(state, "count");
  const fromFeet = state.fromFeet === true;

  const here: State = {
    A, B, C, D, P, R, M, N, Q, coef, options, fromFeet, explored: true,
  };
  const reading = quadReading(K, here);

  // The page saves both the cut points and the parameters that place them;
  // rebuilding from the parameters must reproduce what is on screen.
  const rebuilt = K.sidePoints(here, coef);
  const cutGaps: Record<string, number | null> = {};
  for (const name of ["R", "M", "N", "Q"] as const) {
    cutGaps[name] = out(K.dist(here[name], rebuilt[name]), 9);
  }
  const cutPointsAgree = Object.values(cutGaps).every(
    (v) => v !== null && v <= 1e-4,
  );

  const savedMatchesCore = (savedCyclic === null
    || savedCyclic.length === reading.cyclic.length
      && savedCyclic.every((v, i) => v === reading.cyclic[i]))
    && (savedCount === null || savedCount === reading.count);

  // What the two buttons would give at this very position, by the real core.
  const atFeet = quadReading(K, K.useFeet(here));
  const fromN = quadReading(K, K.solveFromN(here));

  return {
    ...state,
    stateVersion,
    saved: {
      corners: coordinates(here),
      cuts: cutPoints(here),
      options,
      cyclic: savedCyclic,
      count: savedCount,
      fromFeet,
    },
    core: {
      quads: reading,
      cutPointsFromCoef: { ...cutPoints({ ...here, ...rebuilt }), gaps: cutGaps },
      cutPointsAgree,
      savedMatchesCore,
      atPerpendicularFeet: { cyclic: atFeet.cyclic, count: atFeet.count },
      fromFixedN: { cyclic: fromN.cyclic, count: fromN.count },
      angleSums: angleSums(K, here),
    },
    coreDescription: K.describe(here),
    note: savedMatchesCore
      ? `The saved picture reads ${reading.count} of 4 pieces cyclic (${reading.quads.map((q) => `${q.name}: ${q.cyclic ? "yes" : "no"}`).join(", ")}); pressing Perpendicular feet here would give ${atFeet.count} of 4, and building from the saved N gives ${fromN.count} of 4. ${LOCUS_NOTE}`
      : `The page's saved cyclic flags or count differ from a fresh core reading of the same points (${reading.count} of 4). The core field gives the true verdicts. ${LOCUS_NOTE}`,
  };
}
