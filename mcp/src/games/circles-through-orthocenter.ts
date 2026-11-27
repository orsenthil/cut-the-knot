/*
 * run_game_logic actions and saved-position reader for Circles Through
 * the Orthocenter.
 *
 * The core lives in circles-through-orthocenter/ and is copied into
 * src/generated/cores/ at build time. Everything below is measured by it.
 *
 * The theorem behind the picture (Problem 1 of the 2008 IMO): ABC has
 * orthocenter H. The circle centred at the midpoint M_a of BC through H cuts
 * line BC at A1 and A2; likewise for the other two sides. The six points are
 * concyclic, and the circle is centred at the circumcenter O of ABC. Because
 * OM_a is perpendicular to BC, OA1^2 = OM_a^2 + M_aA1^2 = s_a^2 + r_a^2, and
 * the page's two identities
 *
 *   (a/2)^2 - r_a^2 = (b/2)^2 - r_b^2 = (c/2)^2 - r_c^2        (1)
 *   r_a^2 + s_a^2   = r_b^2 + s_b^2   = r_c^2 + s_c^2          (3)
 *
 * make that value the same on all three sides. H is the radical center of the
 * three midpoint circles. "Acute-angled" is a red herring: the six points are
 * concyclic for every non-degenerate triangle. In a right triangle the
 * applet's own three-point circle has no centre (the chosen crossings
 * coincide), so the port draws the proved circle centred at O instead; the
 * core keeps that quirk visible as `appletCircle: null`. See _shared.ts for
 * the shape of a game module.
 *
 * Coordinates are board units from the illustration's 360 x 240 viewBox,
 * with y down.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["circles-through-orthocenter"].CirclesThroughOrthocenterCore;
type Core = ReturnType<typeof core>;

type Point = { x: number; y: number };
type Circle = { c: Point; r: number };
type State = {
  A: Point;
  B: Point;
  C: Point;
  showNames: boolean;
  showHint: boolean;
  moves: number;
  explored: boolean;
};
type Full = {
  degenerate: false;
  feet: { a: Point; b: Point; c: Point };
  H: Point;
  mids: { a: Point; b: Point; c: Point };
  radii: { a: number; b: number; c: number };
  circles: { a: Circle; b: Circle; c: Circle };
  pairs: { A: Point[]; B: Point[]; C: Point[] };
  six: Point[];
  circle: Circle | null;
  theoremCircle: Circle;
  circumcircle: Circle;
  radical: { ab: Point | null; bc: Point | null; ca: Point | null };
  O: Point;
};
type Degenerate = { degenerate: true; reason: string };
type Geometry = Full | Degenerate;
type Residuals = {
  concyclic: number;
  equalRadii: number;
  equalPowers: number;
  radicalCenter: number;
  altitudes: number;
  crossings: number;
  circleCentre: number;
};

const TOL = 1e-5;
const SIDES = ["a", "b", "c"] as const;
const CROSSINGS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const round = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
/** Residuals are tiny; keep their size and sign instead of rounding to zero. */
const sig = (v: number | null | undefined): number | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : Number(v.toExponential(2));
const pt = (p: Point | null | undefined): Point | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: round(p.x), y: round(p.y) } : null;

/** Accept both [x, y] and the page's saved {x, y}. */
function readPoint(args: Json, key: string, fallback: Point): Point {
  const raw = args[key];
  if (raw === undefined || raw === null) return { ...fallback };
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${key}" must be [x, y] or {"x": ..., "y": ...}`);
    const x = Number(raw[0]);
    const y = Number(raw[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`argument "${key}" must hold two finite numbers`);
    }
    return { x, y };
  }
  if (typeof raw !== "object") {
    throw new Error(`argument "${key}" must be [x, y] or {"x": ..., "y": ...}, got ${JSON.stringify(raw)}`);
  }
  const o = raw as Json;
  const x = Number(o.x);
  const y = Number(o.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${key}" must hold finite numeric coordinates, got ${JSON.stringify(raw)}`);
  }
  return { x, y };
}

function boolArg(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`argument "${key}" must be a boolean`);
  return v;
}

/** Validate the corners and let the core clamp them to the board. */
function readState(C: Core, args: Json): State {
  const seed = C.start({}) as unknown as State;
  const s = C.start({
    A: readPoint(args, "A", seed.A),
    B: readPoint(args, "B", seed.B),
    C: readPoint(args, "C", seed.C),
    showNames: boolArg(args, "showNames", seed.showNames),
    showHint: boolArg(args, "showHint", seed.showHint),
  }) as unknown as State;
  for (let i = 0; i < C.NAMES.length; i++) {
    for (let j = i + 1; j < C.NAMES.length; j++) {
      const p = s[C.NAMES[i] as "A" | "B" | "C"];
      const q = s[C.NAMES[j] as "A" | "B" | "C"];
      if (C.dist(p, q) < C.MIN_GAP) {
        throw new Error(
          `corners ${C.NAMES[i]} and ${C.NAMES[j]} are closer than ${C.MIN_GAP} board units; ` +
          "the page will not let two corners sit on top of each other",
        );
      }
    }
  }
  return s;
}

/** A non-degenerate construction, or a helpful error for the tutor's model. */
function live(args: Json): { C: Core; s: State; g: Full } {
  const C = core();
  const s = readState(C, args);
  const g = C.compute(s) as unknown as Geometry;
  if (g.degenerate) {
    throw new Error(
      `A, B and C must be three non-collinear corners of a drawable triangle ` +
      `on the page's ${C.WIDTH} x ${C.HEIGHT} board (the core reports "${g.reason}")`,
    );
  }
  return { C, s, g };
}

/** The three lengths the page compares: half-side, OM and the circle radius. */
function identities(C: Core, s: State, g: Full) {
  const half: Record<string, number> = {};
  const om: Record<string, number> = {};
  const powers: Record<string, number> = {}; // (a/2)^2 - r_a^2   (page's (1))
  const sums: Record<string, number> = {}; // r_a^2 + s_a^2       (page's (3))
  const circum: Record<string, number> = {}; // (a/2)^2 + s_a^2 = R^2
  const opposite = { a: [s.B, s.C], b: [s.C, s.A], c: [s.A, s.B] };
  for (const key of SIDES) {
    const [u, v] = opposite[key];
    half[key] = C.dist(u, v) / 2;
    om[key] = C.dist(g.O, g.mids[key]);
    powers[key] = half[key] ** 2 - g.radii[key] ** 2;
    sums[key] = g.radii[key] ** 2 + om[key] ** 2;
    circum[key] = half[key] ** 2 + om[key] ** 2;
  }
  const spread = (values: Record<string, number>): number =>
    Math.max(...Object.values(values)) - Math.min(...Object.values(values));
  const R2 = g.circumcircle.r ** 2;
  return {
    halfSide: half,
    distanceOM: om,
    halfSideSquaredMinusRadiusSquared: { ...powers, spread: spread(powers), holds: spread(powers) <= TOL },
    radiusSquaredPlusOMSquared: { ...sums, spread: spread(sums), holds: spread(sums) <= TOL },
    halfSideSquaredPlusOMSquared: {
      ...circum,
      circumradiusSquared: R2,
      spreadFromR2: Math.max(...Object.values(circum).map((v) => Math.abs(v - R2))),
      holds: Object.values(circum).every((v) => Math.abs(v - R2) <= TOL),
    },
    commonRadiusSquared: g.theoremCircle.r ** 2,
  };
}

/** Residuals are already the maximum gap behind each claim; keep their scale. */
function residualView(r: Residuals | null) {
  return {
    concyclic: sig(r?.concyclic),
    equalPowers: sig(r?.equalPowers),
    equalRadii: sig(r?.equalRadii),
    radicalCenter: sig(r?.radicalCenter),
    altitudes: sig(r?.altitudes),
    crossings: sig(r?.crossings),
    circleCentre: sig(r?.circleCentre),
  };
}

function allHold(r: Residuals | null): boolean {
  return !!r && Object.values(r).every((v) => Number.isFinite(v) && v <= TOL);
}

/** Everything the core measures at one figure, in tutor-friendly units. */
function reading(C: Core, s: State, g: Full) {
  const r = C.residuals(s, g) as Residuals | null;
  const pairs = [
    { side: "a", line: "BC", names: ["A1", "A2"], points: g.pairs.A },
    { side: "b", line: "CA", names: ["B1", "B2"], points: g.pairs.B },
    { side: "c", line: "AB", names: ["C1", "C2"], points: g.pairs.C },
  ];
  const crossings = pairs.flatMap((pair) => pair.points.map((p, i) => ({
    name: pair.names[i],
    side: pair.side,
    onLine: pair.line,
    point: pt(p),
    distanceFromO: round(C.dist(g.O, p)),
  })));
  const ids = identities(C, s, g);
  return {
    triangle: { A: pt(s.A), B: pt(s.B), C: pt(s.C) },
    orthocenter: pt(g.H),
    circumcenter: pt(g.O),
    altitudeFeet: { a: pt(g.feet.a), b: pt(g.feet.b), c: pt(g.feet.c) },
    midpointCircles: SIDES.map((key) => ({
      side: key,
      midpoint: pt(g.mids[key]),
      radius: round(g.radii[key]),
      center: pt(g.circles[key].c),
    })),
    crossings,
    commonCircle: { center: pt(g.theoremCircle.c), radius: round(g.theoremCircle.r) },
    circumcircle: { center: pt(g.circumcircle.c), radius: round(g.circumcircle.r) },
    // In a right triangle the applet's GetCircle cannot draw a circle: its
    // three chosen crossings coincide. The proved circle above is drawn instead.
    appletCircle: g.circle ? { center: pt(g.circle.c), radius: round(g.circle.r) } : null,
    radicalAxes: { ab: pt(g.radical.ab), bc: pt(g.radical.bc), ca: pt(g.radical.ca) },
    largestGapFromCommonCircle: round(
      Math.max(...g.six.map((p) => Math.abs(C.dist(g.O, p) - g.theoremCircle.r))),
    ),
    identities: ids,
    residuals: residualView(r),
    allHold: allHold(r),
    tolerance: TOL,
  };
}

export function actions(): GameActions {
  return {
    six_crossings: {
      describe:
        "For a triangle with corners A, B, C (each {x, y} or [x, y] on the page's 360 x 240 board, y down), report the orthocenter H, the circumcenter O, the three circles centred at the side midpoints that pass through H, and their six crossings with the side lines (A1, A2 on BC; B1, B2 on CA; C1, C2 on AB). Each crossing is listed with its distance from O, together with the common circle through all six, the half-side and OM lengths, and the radius-squared identities. Omit a corner to use the illustration's opening triangle. Refuses a collinear or too-close triangle.",
      args: '{ "A": [75, 160], "B": [270, 160], "C": [147.273, 34.286] }',
      run: (args) => {
        const { C, s, g } = live(args);
        return {
          ...reading(C, s, g),
          note:
            "Drop the three altitudes to find H. The circle centred at the midpoint Ma of BC through H cuts BC at A1 and A2, and likewise on the other sides. Since O lies on the perpendicular bisector of BC, OM_a is perpendicular to BC and OA1^2 = OM_a^2 + M_aA1^2 = s_a^2 + r_a^2. The two identities in `identities` make this the same value on all three sides, so all six crossings lie on one circle about O — for every non-degenerate triangle, not just acute ones.",
        };
      },
    },
    check_identities: {
      describe:
        "Check the two identities on the Circles Through the Orthocenter page for triangle A, B, C (each {x, y} or [x, y]): (a/2)^2 - ra^2 is the same on all three sides, and ra^2 + sa^2 is the same too, where ra = MaH and sa = OM_a. Together they put all six crossings on one circle about O. Returns each side's values, their spreads, the core's residuals (concyclic, equalPowers, equalRadii, radicalCenter, altitudes, crossings, circleCentre) and whether every claim holds to 1e-5. Arguments as in six_crossings.",
      args: '{ "A": [75, 160], "B": [270, 160], "C": [147.273, 34.286] }',
      run: (args) => {
        const { C, s, g } = live(args);
        const r = C.residuals(s, g) as Residuals | null;
        const view = reading(C, s, g);
        return {
          triangle: view.triangle,
          identities: view.identities,
          residuals: residualView(r),
          allHold: view.allHold,
          tolerance: TOL,
          note: view.allHold
            ? "All the identities hold here. Equation (1) gives equal powers of the vertices in the three midpoint circles and (3) gives equal values of r^2 + s^2; Pythagoras then puts all six crossings the same distance from O, so H is the radical center and the common circle is centred at O. The residuals are tiny but not exactly zero because the core's circle radius is the applet's average of three distances."
            : "At least one residual exceeds the tolerance; move the corners apart on the page and try another non-degenerate triangle.",
        };
      },
    },
  };
}

/** The saved picture, with the core's reading of the same figure. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Circles Through the Orthocenter state version ${stateVersion}`);
  }
  const C = core();
  // start() resets the counters, but position() must report what the page saved.
  const s: State = Object.assign(readState(C, state), {
    moves: typeof state.moves === "number" && Number.isFinite(state.moves) ? state.moves : 0,
    explored: state.explored === true,
  });
  const saved = {
    stateVersion,
    A: pt(s.A),
    B: pt(s.B),
    C: pt(s.C),
    showNames: s.showNames,
    showHint: s.showHint,
    moves: s.moves,
    explored: s.explored,
    // This is a demo: it counts as played once explored, never won or lost.
    result: C.result(s),
  };
  const g = C.compute(s) as unknown as Geometry;
  if (g.degenerate) {
    return {
      ...saved,
      degenerate: true,
      note: "The saved corners are collinear or too close to make a triangle, so there is no orthocenter, no midpoint circles and no six crossings to measure.",
    };
  }
  return {
    ...saved,
    degenerate: false,
    reading: reading(C, s, g),
    note:
      "Track.state saved the three draggable corners and the names/hint switches. The core rebuilds the altitude feet and orthocenter, the three circles through H, their six crossings and the common circle about O, then checks the page's identities at exactly this position. There is no win or loss: an explored illustration has result \"done\".",
  };
}
