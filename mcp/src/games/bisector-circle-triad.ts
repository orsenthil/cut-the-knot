/*
 * run_game_logic actions and saved-position reader for Bisector Circle Triad.
 *
 * The real core is bisector-circle-triad/bisector-circle-triad-core.js, copied
 * into src/generated/cores/ at build time. Every number below is measured by
 * it. See _shared.ts for the shape of a game module.
 *
 * The theorem (Quang Tuan Bui, via Bogomolny's "Three Congruent Circles by
 * Reflection II"): reflect each corner in the two angle bisectors through the
 * other corners, giving Ab, Ac, Ba, Bc, Ca, Cb. The circles A Cb Bc, B Ac Ca
 * and C Ba Ab are congruent; reflecting the six images once more gives three
 * more circles of that same radius. With L the incenter and O the circumcenter,
 * every one of those six circles has radius |LO|, and their centers lie on the
 * circle centered at L with radius R. Board units are the page's 400 x 300
 * viewBox, with y down.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { center: Point; radius: number };
type Triangle = { A: Point; B: Point; C: Point };

/** The fields of a non-degenerate core.compute() result that we report. */
type Compute = {
  valid: true;
  A: Point; B: Point; C: Point;
  O: Point; R: number; L: Point; r: number;
  feet: { La: Point; Lb: Point; Lc: Point };
  reflected: { Ab: Point; Ac: Point; Ba: Point; Bc: Point; Ca: Point; Cb: Point };
  primed: { A1b: Point; A1c: Point; B1a: Point; B1c: Point; C1a: Point; C1b: Point };
  X: Point; Y: Point; Z: Point;
  circles: {
    abc: Circle | null;
    A: Circle | null; B: Circle | null; C: Circle | null;
    A1: Circle | null; B1: Circle | null; C1: Circle | null;
    L: Circle | null; one: Circle | null;
  };
  P: Point | null;
};

type Claims = {
  circumcircle: boolean;
  reflections: boolean;
  translations: boolean;
  mainTriad: boolean;
  sixCircles: boolean;
  radiusLO: boolean;
  OXYZconcyclic: boolean;
  centersOnCircle: boolean;
  isogonalOnCircumcircle: boolean;
};

type Core = {
  start(options?: Json): Triangle;
  compute(s: Triangle, box?: Json): Compute | { valid: false };
  claims(s: Triangle): Claims;
  distance(p: Point, q: Point): number;
  result(state?: Json): null;
};

const core = () => cores["bisector-circle-triad"].BisectorCircleTriadCore as unknown as Core;

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const maybe = (v: number | null | undefined): number | null => (v === null || v === undefined ? null : r6(v));
const xy = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const circleView = (c: Circle | null | undefined) =>
  c ? { center: xy(c.center), radius: maybe(c.radius) } : null;

/** A corner arrives as {x, y} from the page or as a short [x, y] pair. */
function readPoint(v: unknown, label: string, fallback: Point): Point {
  if (v === undefined || v === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(v)) {
    if (v.length !== 2) throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
    x = Number(v[0]);
    y = Number(v[1]);
  } else if (typeof v === "object") {
    const o = v as Json;
    x = Number(o.x);
    y = Number(o.y);
  } else {
    throw new Error(`"${label}" must be [x, y] or { "x": ..., "y": ... }`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${label}" needs finite numeric x and y, got ${JSON.stringify(v)}`);
  }
  return { x, y };
}

/** Omit a corner to use the illustration's opening 400 x 300 triangle. */
function triangle(args: Json): Triangle {
  const seed = core().start({ width: 400, height: 300 });
  return {
    A: readPoint(args.A, "A", seed.A),
    B: readPoint(args.B, "B", seed.B),
    C: readPoint(args.C, "C", seed.C),
  };
}

/** The core refuses a collinear or collapsed triangle: no circles to draw. */
function drawing(args: Json): { C: Core; s: Triangle; d: Compute } {
  const C = core();
  const s = triangle(args);
  const raw = C.compute(s);
  if (!raw.valid || !raw.L || !raw.O || !raw.circles) {
    throw new Error(
      "A, B and C must be three distinct, non-collinear corners on the page's 400 x 300 board (y down); " +
      "the applet cannot draw a triad for a collapsed triangle",
    );
  }
  return { C, s, d: raw };
}

const allSix = (d: Compute): Array<Circle | null> => {
  const c = d.circles;
  return [c.A, c.B, c.C, c.A1, c.B1, c.C1];
};

/** The labelled construction, using the names on the page. */
function construction(C: Core, d: Compute) {
  const c = d.circles;
  const six = allSix(d);
  return {
    triangle: { A: xy(d.A), B: xy(d.B), C: xy(d.C) },
    incenterL: xy(d.L),
    circumcenterO: xy(d.O),
    circumradiusR: maybe(d.R),
    inradius: maybe(d.r),
    bisectorFeet: { La: xy(d.feet.La), Lb: xy(d.feet.Lb), Lc: xy(d.feet.Lc) },
    reflectedVertices: {
      Ab: xy(d.reflected.Ab), Ac: xy(d.reflected.Ac),
      Ba: xy(d.reflected.Ba), Bc: xy(d.reflected.Bc),
      Ca: xy(d.reflected.Ca), Cb: xy(d.reflected.Cb),
    },
    twiceReflected: {
      A1b: xy(d.primed.A1b), A1c: xy(d.primed.A1c),
      B1a: xy(d.primed.B1a), B1c: xy(d.primed.B1c),
      C1a: xy(d.primed.C1a), C1b: xy(d.primed.C1b),
    },
    translatedCenters: { X: xy(d.X), Y: xy(d.Y), Z: xy(d.Z) },
    circles: {
      throughReflected: { A: circleView(c.A), B: circleView(c.B), C: circleView(c.C) },
      throughTwiceReflected: { A: circleView(c.A1), B: circleView(c.B1), C: circleView(c.C1) },
      circumcircleABC: circleView(c.abc),
      centeredAtLThroughO: circleView(c.L),
      throughSixCenters: circleView(c.one),
    },
    sixRadii: six.map((one) => maybe(one?.radius)),
    LO: maybe(C.distance(d.L, d.O)),
    isogonalPointP: xy(d.P),
    note:
      "A_b and A_c are A mirrored in the bisectors through B and C (and likewise for B and C). " +
      "The circles A C_b B_c, B A_c C_a and C B_a A_b are the three the page always draws; " +
      "reflecting once more gives A C'_b B'_c, B A'_c C'_a and C B'_a A'_b. All six have radius |LO|, " +
      "and their centers lie at distance R from the incenter L. X, Y and Z are O translated by " +
      "B→C'_a, C→A'_b and A→B'_c, so O, X, Y, Z lie on the circle centered at L with radius |LO|.",
  };
}

const claimNames = [
  "circumcircle", "reflections", "translations", "mainTriad", "sixCircles",
  "radiusLO", "OXYZconcyclic", "centersOnCircle", "isogonalOnCircumcircle",
] as const;

/** The page's Check-the-claims button, with the numbers behind each claim. */
function checks(C: Core, s: Triangle, d: Compute) {
  const cl = C.claims(s);
  const failed = claimNames.filter((key) => cl[key] !== true);
  const six = allSix(d);
  return {
    circumcircle: cl.circumcircle === true,
    reflections: cl.reflections === true,
    translations: cl.translations === true,
    mainTriad: cl.mainTriad === true,
    sixCircles: cl.sixCircles === true,
    radiusLO: cl.radiusLO === true,
    OXYZconcyclic: cl.OXYZconcyclic === true,
    centersOnCircle: cl.centersOnCircle === true,
    isogonalOnCircumcircle: cl.isogonalOnCircumcircle === true,
    allHold: failed.length === 0,
    failed,
    numbers: {
      sixRadii: six.map((one) => maybe(one?.radius)),
      LO: maybe(C.distance(d.L, d.O)),
      circumradiusR: maybe(d.R),
      centerDistancesFromL: six.map((one) => (one ? maybe(C.distance(one.center, d.L)) : null)),
      OX: maybe(C.distance(d.O, d.X)),
      OY: maybe(C.distance(d.O, d.Y)),
      OZ: maybe(C.distance(d.O, d.Z)),
      isogonalDistanceFromO: d.P ? maybe(C.distance(d.P, d.O)) : null,
    },
    note: failed.length
      ? "At least one claim failed. The checks compare the three main circles, the three second-reflection circles and |LO|, the centers' distances from L against R, and the isogonal point's distance from O against R. Drag a corner away from an exactly equilateral triangle and check again."
      : "All nine claims hold here. The three main radii, the three second-reflection radii and |LO| agree; the six centers lie R from L; O, X, Y, Z lie |LO| from L; and the isogonal-conjugate point lies on the circumcircle. The core's radii are the applet's average of three distances, so the equalities hold to rounding, not bit for bit.",
  };
}

export function actions(): GameActions {
  return {
    construction: {
      describe:
        "For a triangle with corners A, B, C (each {x, y} or [x, y] on the page's 400 x 300 board, y down), report the incenter L, circumcenter O and circumradius R, the three bisector feet, the six reflected vertices, the six twice-reflected points, the three translated centers X, Y, Z, the isogonal point P, and the seven circles the applet draws with their centers and radii. The six triad radii are reported alongside |LO|. Omit a corner to use the illustration's opening triangle. Refuses a degenerate triangle.",
      args: '{ "A": {"x": 163, "y": 100}, "B": {"x": 133.333, "y": 200}, "C": {"x": 300, "y": 200} }',
      run: (args) => {
        const { C, d } = drawing(args);
        return construction(C, d);
      },
    },
    check_claims: {
      describe:
        "Check the claims on the Bisector Circle Triad page for a triangle A, B, C ({x, y} or [x, y]): the circumcircle exists, the six reflections are involutions, the second reflections act as translations, the three main circles are congruent, all six circles are congruent, each radius equals |LO|, O, X, Y, Z are concyclic about L, the six circle centers lie on the circle centered at L with radius R, and the isogonal point lies on the circumcircle. Returns a boolean for each, the failed names, and the measured radii, distances and residuals.",
      args: '{ "A": [163, 100], "B": [133.333, 200], "C": [300, 200] }',
      run: (args) => {
        const { C, s, d } = drawing(args);
        return checks(C, s, d);
      },
    },
  };
}

/** The page saves only its three draggable corners; the core rebuilds the rest. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Bisector Circle Triad state version ${stateVersion}`);
  }
  const C = core();
  const s = triangle(state ?? ({} as Json));
  const raw = C.compute(s);
  // The core's result() ignores its argument: an illustration cannot be won.
  const saved = {
    stateVersion,
    A: xy(s.A), B: xy(s.B), C: xy(s.C),
    result: C.result(state),
  };
  if (!raw.valid || !raw.L || !raw.O || !raw.circles) {
    return {
      ...saved,
      valid: false,
      note: "The saved corners are in a line or too close together, so there is no incenter, circumcircle or triad of circles to measure here.",
    };
  }
  const d = raw;
  return {
    ...saved,
    valid: true,
    reading: {
      ...construction(C, d),
      ...checks(C, s, d),
    },
    note:
      "Track.state saved the three draggable corners of the illustration. The core rebuilds the bisectors, the six reflected vertices, all seven circles and the isogonal point from them, then checks the page's claims at exactly this position.",
  };
}
