/*
 * run_game_logic actions and saved-position reader for Orthocenter and Three
 * Equal Circles.
 *
 * The core is equal-circles-orthocenter/equal-circles-orthocenter-core.js,
 * copied into src/generated/cores/ at build time; every number below is
 * measured by it. Coordinates are board units in the page's 440 x 320 SVG,
 * with y down.
 *
 * ABC has orthocenter H. The circles through (B,C,H), (C,A,H) and (A,B,H)
 * each have the radius of ABC's own circumcircle. Writing vectors from the
 * circumcenter O, H = A + B + C - 2O and the point opposite H on the circle
 * through B,C,H is A' = B + C - A, cyclically: A'B'C' is the anticomplementary
 * triangle of ABC, H is its circumcenter, and HA' = HB' = HC' = 2R. Reflecting
 * H in a side lands on the circumcircle, which is the page's congruence proof
 * that the circles are equal. See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type State = {
  A: Point; B: Point; C: Point;
  showNames: boolean; showPremise: boolean; showStatement: boolean; showHint: boolean;
  moves: number; explored: boolean;
};
type Geometry = {
  valid: true; reason: null;
  A: Point; B: Point; C: Point;
  Ha: Point; Hb: Point; Hc: Point; H: Point;
  circleA: Circle; circleB: Circle; circleC: Circle; circle: Circle;
  Oa: Point; Ob: Point; Oc: Point;
  outer: Point[]; triangle: Point[];
};
type Invalid = { valid: false; reason: string };
type Core = {
  VIEW: { width: number; height: number };
  MARGIN: number;
  OPTION_KEYS: string[];
  ANGLES: { A: number; B: number; C: number };
  START: { A: Point; B: Point; C: Point };
  start(options?: Partial<State>): State;
  randomStart(rand?: () => number): State;
  moveVertex(state: State, name: string, point: Point): State;
  setOption(state: State, name: string, on: boolean): State;
  result(state: State): string | null;
  compute(state: State): Geometry | Invalid;
  geometry(state: State): Geometry | Invalid;
  describe(g: Geometry | Invalid): string;
  label(g: Geometry | Invalid): string;
  intersect(a: Point, b: Point, c: Point, d: Point): Point;
  nearestPoint(p: Point, a: Point, b: Point): Point;
  findCircumcenter(a: Point, b: Point, c: Point): Point;
  getCircle(a: Point, b: Point, c: Point): Circle | null;
  prorate(from: Point, to: Point, length: number): Point;
  average(a: Point, b: Point, c: Point): Point;
  finite(p: Point): boolean;
  round(v: number): number;
  clamp(v: number, lo: number, hi: number): number;
  clampPoint(p: Point): Point;
  copy(p: Point): Point;
  dist(p: Point, q: Point): number;
  sqDist(p: Point, q: Point): number;
  dot(p: Point, q: Point): number;
  sub(p: Point, q: Point): Point;
  cross(p: Point, q: Point): number;
  midpoint(p: Point, q: Point): Point;
  reflect(p: Point, q: Point): Point;
  twiceArea(a: Point, b: Point, c: Point): number;
};

const core = (): Core =>
  cores["equal-circles-orthocenter"].EqualCirclesOrthocenterCore as unknown as Core;

const TOL = 1e-6;
const MATCH = 1e-4;
const round = (v: number, digits = 6): number => (Number.isFinite(v) ? Number(v.toFixed(digits)) : NaN);
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(2));
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;
const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const circleView = (c: Circle | null | undefined) =>
  c ? { centre: pt(c.c), radius: round(c.r) } : null;

/** A corner as the page saves it ({x, y}) or as a short [x, y] pair. */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return { ...fallback };
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${key}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${key}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readBool(args: Json, key: string, dflt: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return dflt;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be true or false`);
  return v;
}

/** The page's four checkboxes, accepted nested under "options" or at top level. */
function readOptions(args: Json): Pick<State, "showNames" | "showPremise" | "showStatement" | "showHint"> {
  const raw = args.options;
  if (raw !== undefined && raw !== null && (typeof raw !== "object" || Array.isArray(raw))) {
    throw new Error('argument "options" must be an object');
  }
  const o = (raw && typeof raw === "object" ? raw : args) as Json;
  return {
    showNames: readBool(o, "showNames", false),
    showPremise: readBool(o, "showPremise", false),
    showStatement: readBool(o, "showStatement", false),
    showHint: readBool(o, "showHint", false),
  };
}

/** A real core state: the page clamps supplied corners to its board. */
function buildState(C: Core, args: Json): State {
  const seed = C.start({});
  return C.start({
    A: readPoint(args, "A", seed.A),
    B: readPoint(args, "B", seed.B),
    C: readPoint(args, "C", seed.C),
    ...readOptions(args),
  });
}

/** A drawable figure, or a helpful error using the core's own reason. */
function live(args: Json): { C: Core; s: State; g: Geometry } {
  const C = core();
  const s = buildState(C, args);
  const g = C.compute(s);
  if (!g.valid) {
    throw new Error(
      "A, B and C must make a proper, non-right triangle on the page's " +
      `${C.VIEW.width} x ${C.VIEW.height} board; the core reports "${g.reason}"`,
    );
  }
  return { C, s, g };
}

/** The equal circles and equal diameters, measured rather than assumed. */
function circleReading(C: Core, g: Geometry) {
  const circles = [
    { name: "BCH", through: "B, C, H", ...circleView(g.circleA) },
    { name: "CAH", through: "C, A, H", ...circleView(g.circleB) },
    { name: "ABH", through: "A, B, H", ...circleView(g.circleC) },
    { name: "ABC", through: "A, B, C (circumcircle)", ...circleView(g.circle) },
  ];
  const radii = [g.circleA.r, g.circleB.r, g.circleC.r, g.circle.r];
  const radiusSpread = Math.max(...radii) - Math.min(...radii);
  const circumdiameter = 2 * g.circle.r;
  const antipodes = [
    { name: "A′", side: "BCH", point: pt(g.Oa) },
    { name: "B′", side: "CAH", point: pt(g.Ob) },
    { name: "C′", side: "ABH", point: pt(g.Oc) },
  ];
  const diameters = [
    { name: "HA′", length: round(C.dist(g.H, g.Oa)), minus2R: sig(C.dist(g.H, g.Oa) - circumdiameter) },
    { name: "HB′", length: round(C.dist(g.H, g.Ob)), minus2R: sig(C.dist(g.H, g.Ob) - circumdiameter) },
    { name: "HC′", length: round(C.dist(g.H, g.Oc)), minus2R: sig(C.dist(g.H, g.Oc) - circumdiameter) },
  ];
  return {
    triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
    orthocenter: pt(g.H),
    altitudeFeet: { Ha: pt(g.Ha), Hb: pt(g.Hb), Hc: pt(g.Hc) },
    circles,
    radii: {
      BCH: round(g.circleA.r), CAH: round(g.circleB.r),
      ABH: round(g.circleC.r), ABC: round(g.circle.r),
    },
    radiusSpread: sig(radiusSpread),
    equalRadii: radiusSpread <= TOL,
    circumdiameter: round(circumdiameter),
    antipodes,
    diameters,
    equalDiameters: diameters.every((d) => d.minus2R !== null && Math.abs(d.minus2R) <= TOL),
    tolerance: TOL,
  };
}

/** The anticomplementary triangle and the congruent-triangle proof. */
function outerReading(C: Core, g: Geometry) {
  const closed = {
    Aprime: { x: g.B.x + g.C.x - g.A.x, y: g.B.y + g.C.y - g.A.y },
    Bprime: { x: g.C.x + g.A.x - g.B.x, y: g.C.y + g.A.y - g.B.y },
    Cprime: { x: g.A.x + g.B.x - g.C.x, y: g.A.y + g.B.y - g.C.y },
  };
  const outer = { Aprime: g.Oa, Bprime: g.Ob, Cprime: g.Oc };
  const closedErrors = Object.fromEntries(
    (["Aprime", "Bprime", "Cprime"] as const).map((key) =>
      [key, round(C.dist(closed[key], outer[key]))]),
  ) as Record<string, number>;
  // A, B, C are the midpoints of B'C', C'A', A'B' respectively.
  const midOf = {
    A: C.midpoint(g.Ob, g.Oc), B: C.midpoint(g.Oc, g.Oa), C: C.midpoint(g.Oa, g.Ob),
  };
  const midpointErrors = {
    A: round(C.dist(midOf.A, g.A)),
    B: round(C.dist(midOf.B, g.B)),
    C: round(C.dist(midOf.C, g.C)),
  };
  const radiiFromH = {
    HAprime: C.dist(g.H, g.Oa), HBprime: C.dist(g.H, g.Ob), HCprime: C.dist(g.H, g.Oc),
  };
  const radiusSpread = Math.max(...Object.values(radiiFromH)) - Math.min(...Object.values(radiiFromH));
  const baseArea = Math.abs(C.twiceArea(g.A, g.B, g.C));
  const outerArea = Math.abs(C.twiceArea(g.Oa, g.Ob, g.Oc));
  const areaRatio = baseArea > 0 ? outerArea / baseArea : null;

  // Reflecting H in a side gives P on the circumcircle. B and C lie on the
  // mirror, so HB = PB and HC = PC: HBC and PBC are congruent.
  const reflections = [
    { side: "BC", foot: g.Ha, corners: [g.B, g.C] },
    { side: "CA", foot: g.Hb, corners: [g.C, g.A] },
    { side: "AB", foot: g.Hc, corners: [g.A, g.B] },
  ].map(({ side, foot, corners }) => {
    const P = C.reflect(g.H, foot); // reflection of H in this side
    return {
      side,
      foot: pt(foot),
      reflectedPointOnCircumcircle: pt(P),
      distanceFromCircumcircle: sig(C.dist(g.circle.c, P) - g.circle.r),
      equalSidesFromCorners: corners.map((corner) => sig(C.dist(P, corner) - C.dist(g.H, corner))),
    };
  });

  const checks = {
    closedFormMatches: Object.values(closedErrors).every((e) => e <= TOL),
    cornersAreMidpoints: Object.values(midpointErrors).every((e) => e <= TOL),
    HIsCircumcenterOfOuter: radiusSpread <= TOL,
    areaRatioFour: areaRatio !== null && Math.abs(areaRatio - 4) <= TOL,
    reflectionsOnCircumcircle: reflections.every((r) =>
      r.distanceFromCircumcircle !== null && Math.abs(r.distanceFromCircumcircle) <= TOL),
    congruentTriangles: reflections.every((r) =>
      r.equalSidesFromCorners.every((e) => e !== null && Math.abs(e) <= TOL)),
  };
  return {
    closedForm: {
      Aprime: pt(closed.Aprime), Bprime: pt(closed.Bprime), Cprime: pt(closed.Cprime),
    },
    anticomplementary: {
      Aprime: pt(g.Oa), Bprime: pt(g.Ob), Cprime: pt(g.Oc),
    },
    closedFormErrors: closedErrors,
    midpointsOfOuterSides: { A: pt(midOf.A), B: pt(midOf.B), C: pt(midOf.C) },
    midpointErrors,
    circumcenterH: {
      H: pt(g.H),
      distances: { HAprime: round(radiiFromH.HAprime), HBprime: round(radiiFromH.HBprime),
        HCprime: round(radiiFromH.HCprime) },
      radiusSpread: sig(radiusSpread),
    },
    areaRatio: areaRatio === null ? null : round(areaRatio),
    reflectedPoints: reflections,
    checks,
    allHold: Object.values(checks).every(Boolean),
    tolerance: TOL,
  };
}

/** A fresh reading of the position saved with Track.state. */
function fullReading(C: Core, g: Geometry) {
  return { ...circleReading(C, g), ...outerReading(C, g) };
}

export function actions(): GameActions {
  return {
    equal_circles: {
      describe:
        "For a triangle with corners A, B, C (each {x, y} or [x, y] in the page's 440 x 320 board, y down), run the real core and report the orthocenter H, the altitude feet, the three circles through (B,C,H), (C,A,H), (A,B,H) and the circumcircle of ABC, their radii and spread, and the three points opposite H on the equal circles (A′, B′, C′) with the diameters HA′, HB′, HC′ compared with the circumdiameter 2R. Omit a corner to use the opening triangle; the four booleans set the page's checkboxes. A flat or right triangle is refused because one of the circles degenerates.",
      args: '{ "A": [265, 58.718], "B": [155.279, 175.023], "C": [284.721, 175.023] }',
      run: (args) => {
        const { C, s, g } = live(args);
        return {
          ...circleReading(C, g),
          options: {
            showNames: s.showNames, showPremise: s.showPremise,
            showStatement: s.showStatement, showHint: s.showHint,
          },
          status: C.describe(g),
          note:
            "Drop the three altitudes to find H. Each circle through H and two corners has the same radius as the circumcircle of ABC: reflecting H in a side lands on that circumcircle, and the two triangles on the shared side are congruent, so their circumcircles match. A′ is the point opposite H on the circle through B,C,H; HA′, HB′ and HC′ are all diameters of equal circles and so all equal 2R.",
        };
      },
    },
    anticomplementary: {
      describe:
        "Check the second half of the Orthocenter and Three Equal Circles claim for triangle A, B, C (each {x, y} or [x, y] in board units): A′ = B + C − A and cyclically, A, B, C are the midpoints of B′C′, C′A′, A′B′, H is the circumcenter of the outer triangle, its area is four times ABC's, and reflecting H in each side lands on the circumcircle so triangles HBC and PBC are congruent. Returns a boolean per claim, the closed-form points, midpoint and radius residuals, and the reflected points. Arguments and the opening-triangle fallback are as in equal_circles.",
      args: '{ "A": [265, 58.718], "B": [155.279, 175.023], "C": [284.721, 175.023] }',
      run: (args) => {
        const { C, g } = live(args);
        const reading = outerReading(C, g);
        return {
          triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
          ...reading,
          note: reading.allHold
            ? "All the claims hold here. Written from the circumcenter, H = A + B + C − 2O and A′ = B + C − A, so A, B, C are the midpoints of the outer sides and A′B′C′ has four times the area of ABC with H as its circumcenter; the three diameters are each 2R. The residuals are tiny because the core's radii are the applet's average of three distances."
            : "At least one check failed at these corners; move them apart into a proper, non-right triangle and try again.",
        };
      },
    },
  };
}

/** The saved picture, echoed and then re-measured with the same core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Orthocenter and Three Equal Circles state version ${stateVersion}`);
  }
  const C = core();
  const src = state && typeof state === "object" ? state : ({} as Json);
  let savedReadable = true;
  let s: State;
  try {
    s = buildState(C, src);
  } catch {
    savedReadable = false;
    s = C.start({});
  }
  const g = C.compute(s);
  if (!g.valid) {
    return {
      ...src, stateVersion, savedReadable, valid: false,
      note: "The saved corners are flat, coincident or right-angled, so the core cannot draw all four circles here.",
    };
  }

  const saved = {
    A: pt(s.A), B: pt(s.B), C: pt(s.C),
    H: pt(numToPoint(src.H)), Oa: pt(numToPoint(src.Oa)),
    Ob: pt(numToPoint(src.Ob)), Oc: pt(numToPoint(src.Oc)),
    centre: pt(numToPoint(src.centre)),
    radius: num(src.radius),
    options: {
      showNames: s.showNames, showPremise: s.showPremise,
      showStatement: s.showStatement, showHint: s.showHint,
    },
  };
  const differences: Array<{ field: string; page: number; core: number; diff: number }> = [];
  const compare = (field: string, page: number | null, value: number): void => {
    if (page === null) return;
    differences.push({ field, page: round(page), core: round(value), diff: round(Math.abs(page - value), 9) });
  };
  const comparePoint = (field: string, page: Point | null, value: Point): void => {
    if (!page) return;
    compare(`${field}.x`, page.x, value.x);
    compare(`${field}.y`, page.y, value.y);
  };
  comparePoint("H", saved.H, g.H);
  comparePoint("Oa", saved.Oa, g.Oa);
  comparePoint("Ob", saved.Ob, g.Ob);
  comparePoint("Oc", saved.Oc, g.Oc);
  comparePoint("centre", saved.centre, g.circle.c);
  compare("radius", saved.radius, g.circle.r);
  const savedMatchesCore = differences.every((d) => d.diff <= MATCH * Math.max(1, Math.abs(d.core)));

  return {
    ...src,
    stateVersion,
    savedReadable,
    saved,
    valid: true,
    reading: fullReading(C, g),
    core: {
      triangle: { A: pt(g.A), B: pt(g.B), C: pt(g.C) },
      H: pt(g.H), Oa: pt(g.Oa), Ob: pt(g.Ob), Oc: pt(g.Oc),
      centre: pt(g.circle.c), radius: round(g.circle.r),
    },
    coreDescription: C.describe(g),
    savedMatchesCore,
    differences,
    note: !savedReadable
      ? "The saved corners could not be read, so the opening triangle is shown instead; the core reading below comes from those corners."
      : `Track.state saved the three draggable corners, the orthocenter H, the three opposite points A′, B′, C′, the circumcentre and radius, and the four checkbox flags. The core rebuilds all of them from A, B, C: the four circles have radius ${round(g.circle.r, 4)}, the outer triangle A′B′C′ has H as its circumcenter, and HA′ = HB′ = HC′ = 2R. ${savedMatchesCore ? "The saved derived points agree with the core's recomputation." : "Some saved derived points differ from the core's recomputation; check whether the two were captured from the same corners."} This is a demonstration, so the tracker records exploration rather than a win or a loss.`,
  };
}

/** Read a saved point without throwing; position() can still fall back to the core. */
function numToPoint(value: unknown): Point | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Json;
  const x = num(o.x), y = num(o.y);
  return x !== null && y !== null ? { x, y } : null;
}
