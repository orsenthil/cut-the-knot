/*
 * run_game_logic actions and saved-position reader for Four Pedal Circles.
 *
 * The real core is four-pedal-circles/four-pedal-circles-core.js, copied into
 * src/generated/cores/ at build time; every number below is measured by it.
 * Coordinates are board units of the page's 400 x 300 SVG, y down. A complete
 * quadrangle is the four points A, B, C, D and their six joining lines; with a
 * fifth point P the three perpendicular feet on the sides of each of the four
 * triangles give four pedal circles. The core builds them in the applet's
 * order ABC, ACD, ABD, BCD and finds the common point Q as the midpoint of the
 * "other" intersections of ABC with ABD (they share the foot on AB) and of
 * ACD with BCD (they share the foot on CD). It also keeps the applet's quirk:
 * "other" means at least 1 unit from the shared foot, which can pick the foot
 * itself when the two intersections are very close.
 *
 * The second action uses the core's own primitives (nearestPoint, pedalCircle,
 * ninePointCircle, simsonLine, intersect and circleDistance) to check the
 * page's further claims: for a cyclic quadrangle the four pedal circles of the
 * vertices are Simson lines and, with the four nine-point circles, all meet at
 * one point; for any quadrangle the four nine-point circles and the four pedal
 * circles of the remaining vertices still meet at one point. See _shared.ts
 * for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type LineCircle =
  | { kind: "circle"; center: Pt; radius: number }
  | { kind: "line"; a: Pt; b: Pt };
type NineCircle = { center: Pt; radius: number } | null;
type Feet = Record<"ab" | "ac" | "ad" | "bc" | "bd" | "cd", Pt>;
type Geometry = {
  degenerate: boolean;
  feet?: Feet;
  circles?: Record<string, LineCircle>;
  Q?: Pt;
  x13?: Pt;
  x24?: Pt;
  gap?: number;
  nineCircles?: Record<string, NineCircle>;
  simson?: Record<string, { a: Pt; b: Pt }>;
};
type State = {
  A: Pt; B: Pt; C: Pt; D: Pt; P: Pt;
  showNames: boolean; showTriangles: boolean; showLines: boolean;
  moves: number; explored: boolean;
};
type Core = {
  WIDTH: number; HEIGHT: number;
  NAMES: string[]; OPTION_KEYS: string[]; CIRCLE_NAMES: string[];
  finite(p: unknown): boolean;
  dist(p: Pt, q: Pt): number;
  start(options?: Json): State;
  compute(state: State): Geometry;
  residuals(state: State, g: Geometry): { feetError: number; onCircles: number; gap: number } | null;
  result(state: State): string | null;
  nearestPoint(p: Pt, a: Pt, b: Pt): Pt;
  pedalCircle(a: Pt, b: Pt, c: Pt): LineCircle;
  ninePointCircle(a: Pt, b: Pt, c: Pt): NineCircle;
  simsonLine(p: Pt, a: Pt, b: Pt, c: Pt): { a: Pt; b: Pt };
  intersect(lc1: LineCircle, lc2: LineCircle): Pt[] | null;
  circleDistance(p: Pt, lc: LineCircle): number;
  circumcenter(a: Pt, b: Pt, c: Pt): Pt;
};

const core = (): Core =>
  cores["four-pedal-circles"].FourPedalCirclesCore as unknown as Core;

const POINT_NAMES = ["A", "B", "C", "D", "P"] as const;
const OPTION_NAMES = ["showNames", "showTriangles", "showLines"] as const;
const QUAD_NAMES = ["A", "B", "C", "D"] as const;
const TRIPLES: Record<string, readonly string[]> = {
  A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"],
};
const TOL = 1e-3; // board units; the core rounds saved handles to 0.001

const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const sig = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Number(v.toExponential(2)) : null;
const pt = (p: Pt | null | undefined): Pt | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const lineOut = (lc: LineCircle) =>
  lc.kind === "circle"
    ? { kind: "circle", center: pt(lc.center), radius: r6(lc.radius) }
    : { kind: "line", through: [pt(lc.a), pt(lc.b)] };

/** Accept the page's saved { x, y } dots and the tutor's [x, y] arguments. */
function readPoint(raw: unknown, label: string, fallback?: Pt): Pt {
  if (raw === undefined || raw === null) {
    if (fallback) return { ...fallback };
    throw new Error(`missing required argument "${label}"`);
  }
  let x: number, y: number;
  if (Array.isArray(raw)) {
    if (raw.length !== 2) throw new Error(`argument "${label}" must be [x, y] or { x, y }`);
    x = Number(raw[0]); y = Number(raw[1]);
  } else if (typeof raw === "object") {
    const o = raw as Json;
    x = Number(o.x); y = Number(o.y);
  } else {
    throw new Error(`argument "${label}" must be [x, y] or { x, y }, got ${JSON.stringify(raw)}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`argument "${label}" needs finite numeric x and y`);
  }
  return { x, y };
}

function readOptions(raw: Json): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of OPTION_NAMES) {
    const v = raw[key];
    if (v !== undefined && v !== null && typeof v !== "boolean") {
      throw new Error(`argument "${key}" must be a boolean, got ${JSON.stringify(v)}`);
    }
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}

/** The core's opening picture with any supplied handles applied through start(). */
function buildState(C: Core, args: Json): State {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("arguments must be an object of A, B, C, D, P points and optional checkboxes");
  }
  const given: Json = {};
  for (const name of POINT_NAMES) {
    const v = args[name];
    if (v !== undefined && v !== null) given[name] = readPoint(v, name);
  }
  return C.start({ ...given, ...readOptions(args) });
}

/** A saved position, with its recorded move count and explored flag kept. */
function stateFromSaved(C: Core, state: Json): State {
  const seed = C.start({});
  const given: Json = {};
  for (const name of POINT_NAMES) {
    given[name] = readPoint(state[name], `saved ${name}`, seed[name] as Pt);
  }
  const s = C.start({ ...given, ...readOptions(state) });
  const moves = Number(state.moves);
  return {
    ...s,
    moves: Number.isFinite(moves) && moves >= 0 ? Math.floor(moves) : 0,
    explored: state.explored === true,
  };
}

type PedalReading = ReturnType<typeof pedalReading>;

/** Six feet, four pedal circles, their second intersections and the core's Q. */
function pedalReading(C: Core, s: State) {
  const g = C.compute(s);
  if (g.degenerate || !g.feet || !g.circles || !C.finite(g.Q)) {
    return {
      valid: false as const,
      reason: "degenerate",
      note:
        "Two of A, B, C, D are less than 0.5 board units apart or three of them are collinear, " +
        "or the core could not intersect the pedal circles. Move the corners apart and try again.",
    };
  }
  const Q = g.Q!;
  const perCircle: Record<string, number | null> = {};
  for (const name of C.CIRCLE_NAMES) {
    perCircle[name] = sig(C.circleDistance(Q, g.circles![name]));
  }
  const maxResidual = Math.max(...C.CIRCLE_NAMES.map((n) => Math.abs(C.circleDistance(Q, g.circles![n]))));
  const x13 = g.x13!, x24 = g.x24!, footAB = g.feet!.ab, footCD = g.feet!.cd;
  const gap13 = C.dist(x13, footAB), gap24 = C.dist(x24, footCD);
  const lines = C.CIRCLE_NAMES.filter((n) => g.circles![n].kind === "line");
  const res = C.residuals(s, g);
  return {
    valid: true as const,
    board: { width: C.WIDTH, height: C.HEIGHT },
    handles: Object.fromEntries(POINT_NAMES.map((n) => [n, pt(s[n])])),
    options: {
      showNames: s.showNames, showTriangles: s.showTriangles, showLines: s.showLines,
    },
    feet: Object.fromEntries(Object.entries(g.feet!).map(([k, p]) => [k, pt(p)])),
    pedalCircles: Object.fromEntries(C.CIRCLE_NAMES.map((n) => [n, lineOut(g.circles![n])])),
    sharedFeet: { AB: pt(footAB), CD: pt(footCD) },
    otherIntersections: {
      ABC_ABD: pt(x13), ACD_BCD: pt(x24),
      distanceFromSharedFoot: { fromAB: r6(gap13), fromCD: r6(gap24) },
      nearSharedFoot: { fromAB: gap13 < 1, fromCD: gap24 < 1 },
      separation: sig(g.gap),
    },
    commonPoint: pt(Q),
    residuals: {
      distanceToEachCircle: perCircle,
      max: sig(maxResidual),
      feetError: sig(res?.feetError),
      onCircles: sig(res?.onCircles),
    },
    concurrent: maxResidual <= TOL,
    simsonLineCases: lines,
    result: C.result(s),
    note:
      `Q is the midpoint of the two "other" intersections, (${r6(Q.x)}, ${r6(Q.y)}); the largest ` +
      `distance from Q to any pedal circle is ${sig(maxResidual)} board units, so all four meet there ` +
      `${maxResidual <= TOL ? "as the page claims" : "only approximately here"}. ` +
      (lines.length
        ? `The pedal ${lines.length === 1 ? "circle" : "circles"} of ${lines.join(", ")} ${lines.length === 1 ? "flattens" : "flatten"} into a Simson line, the applet's fallback when the three feet almost line up. `
        : "") +
      (gap13 < 1 || gap24 < 1
        ? "At least one second intersection is within the applet's 1-unit test of its shared foot, so its \"other\" pick can be the foot itself and displace Q; the core keeps that quirk. "
        : "") +
      "This is an illustration, so the tracker records exploration rather than a win or a loss.",
  };
}

type QuadReading = ReturnType<typeof quadrangleReading>;

/** The eight-circle concurrence of BCD/ACD/ABD/ABC's nine and vertex pedal circles. */
function quadrangleReading(C: Core, s: State) {
  // This claim uses A, B, C, D alone, so validate the quadrangle directly
  // rather than through compute(), which also needs a well-behaved P.
  const quad = QUAD_NAMES.map((n) => s[n]);
  let degenerate = false;
  for (let i = 0; i < quad.length; i++) {
    for (let j = i + 1; j < quad.length; j++) {
      if (C.dist(quad[i], quad[j]) < 0.5) degenerate = true;
      for (let k = j + 1; k < quad.length; k++) {
        const cross = (quad[j].x - quad[i].x) * (quad[k].y - quad[i].y)
          - (quad[j].y - quad[i].y) * (quad[k].x - quad[i].x);
        if (Math.abs(cross) < 1e-6) degenerate = true;
      }
    }
  }
  if (degenerate) {
    return {
      valid: false as const,
      reason: "degenerate",
      note: "A, B, C and D must be four distinct corners with no three collinear for the triangles and their nine-point circles to exist.",
    };
  }
  const O = C.circumcenter(s.A, s.B, s.C);
  const R = C.finite(O) ? C.dist(O, s.A) : NaN;
  const radiusGap = C.finite(O) ? C.dist(O, s.D) - R : NaN;
  const cyclic = Number.isFinite(radiusGap) && Math.abs(radiusGap) <= TOL * Math.max(1, R);

  const entries: Array<{ name: string; lc: LineCircle }> = [];
  const pedalCircles: Record<string, unknown> = {};
  const nineCircles: Record<string, unknown> = {};
  const simsonLines: Record<string, unknown> = {};
  for (const name of QUAD_NAMES) {
    const [u, v, w] = TRIPLES[name].map((n) => s[n as keyof State] as Pt);
    const feet = [
      C.nearestPoint(s[name], u, v),
      C.nearestPoint(s[name], u, w),
      C.nearestPoint(s[name], v, w),
    ];
    const pedal = C.pedalCircle(feet[0], feet[1], feet[2]);
    pedalCircles[name] = lineOut(pedal);
    entries.push({ name: `pedal ${name} in ${TRIPLES[name].join("")}`, lc: pedal });

    const nine = C.ninePointCircle(u, v, w);
    if (!nine) {
      return {
        valid: false as const,
        reason: "no nine-point circle",
        note: `The core cannot draw the nine-point circle of ${TRIPLES[name].join("")}; move the corners apart.`,
      };
    }
    const nineLine: LineCircle = { kind: "circle", center: nine.center, radius: nine.radius };
    nineCircles[name] = lineOut(nineLine);
    entries.push({ name: `nine-point of ${TRIPLES[name].join("")}`, lc: nineLine });

    const simson = C.simsonLine(s[name], u, v, w);
    const simsonLC: LineCircle = { kind: "line", a: simson.a, b: simson.b };
    simsonLines[name] = {
      through: [pt(simson.a), pt(simson.b)],
      feetResiduals: feet.map((f) => sig(C.circleDistance(f, simsonLC))),
    };
  }

  /* Try every pairwise intersection and keep the point closest to all eight. */
  let best: Pt | null = null;
  let bestMax = Infinity;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const hits = C.intersect(entries[i].lc, entries[j].lc);
      if (!hits) continue;
      for (const hit of hits) {
        if (!C.finite(hit)) continue;
        const worst = Math.max(...entries.map((e) => Math.abs(C.circleDistance(hit, e.lc))));
        if (worst < bestMax) { bestMax = worst; best = hit; }
      }
    }
  }

  const residuals = entries.map((e) => ({
    object: e.name,
    residual: best ? sig(C.circleDistance(best, e.lc)) : null,
  }));
  const fromSimson: Record<string, number | null> = {};
  for (const name of QUAD_NAMES) {
    const simson = C.simsonLine(s[name], ...(TRIPLES[name].map((n) => s[n as keyof State] as Pt) as [Pt, Pt, Pt]));
    fromSimson[name] = best
      ? sig(C.circleDistance(best, { kind: "line", a: simson.a, b: simson.b }))
      : null;
  }
  const simsonMax = Math.max(...Object.values(fromSimson).map((v) => (v === null ? Infinity : Math.abs(v))));
  const concurrent = Number.isFinite(bestMax) && bestMax <= TOL;
  return {
    valid: true as const,
    board: { width: C.WIDTH, height: C.HEIGHT },
    handles: Object.fromEntries(QUAD_NAMES.map((n) => [n, pt(s[n])])),
    cyclic,
    circumcircle: { center: pt(O), radius: r6(R), fourthVertexRadiusError: sig(radiusGap) },
    pedalCircles,
    nineCircles,
    simsonLines,
    commonPoint: pt(best),
    residuals,
    maxResidual: sig(bestMax),
    simsonResiduals: fromSimson,
    maxSimsonResidual: sig(simsonMax),
    concurrent,
    simsonLinesConcurrent: Number.isFinite(simsonMax) && simsonMax <= TOL,
    note:
      (cyclic
        ? "A, B, C and D lie on one circle, so each vertex's pedal circle has become its Simson line; "
        : "A, B, C and D are not cyclic, so the four vertex pedal circles are ordinary circles; ") +
      `the core puts the common point at (${pt(best)?.x}, ${pt(best)?.y}), at most ${sig(bestMax)} board units ` +
      `from any of the eight circles and ${sig(simsonMax)} from any Simson line. ` +
      "For a cyclic quadrangle those are exactly the page's four Simson lines and four nine-point circles; " +
      "for every quadrangle the eight circles still meet in one point. This is an illustration, so there is no win or loss.",
  };
}

export function actions(): GameActions {
  return {
    pedal_concurrence: {
      describe:
        "For the complete quadrangle A, B, C, D and the fifth point P (each [x, y] or { x, y } on the page's 400 x 300 board, y down; omit any to keep the opening picture), run the real core and report the six perpendicular feet, the four pedal circles (ABC, ACD, ABD, BCD), the two 'other' circle intersections and their common point Q. Q is measured against every circle and the feet against the sides; the report also flags when a pedal circle flattens into a Simson line or when the applet's 1-unit 'other' test can pick the shared foot. Optional showNames, showTriangles and showLines set the three checkboxes.",
      args: '{ "A": [83, 200], "B": [200, 180], "C": [280, 90], "D": [100, 100], "P": [218.181818, 225] }',
      run: (args) => {
        const C = core();
        return pedalReading(C, buildState(C, args));
      },
    },

    simson_nine_point: {
      describe:
        "For four corners A, B, C, D of a quadrangle (each [x, y] or { x, y } in board units; omit any for the opening picture), use the real core's foot, pedal-circle, nine-point-circle and Simson-line primitives to find the point common to the four nine-point circles and the four pedal circles of the remaining vertices. It reports whether the quadrangle is cyclic, the residuals to all eight circles and to the four Simson lines, and the common point: for a cyclic quadrangle the vertex pedal circles are Simson lines and everything meets at the circumcenter; for any quadrangle the eight circles still concur. P is not needed for this claim.",
      args: '{ "A": [300, 150], "B": [140, 230], "C": [100, 150], "D": [260, 70] }',
      run: (args) => {
        const C = core();
        return quadrangleReading(C, buildState(C, args));
      },
    },
  };
}

/** Echo the fields Track.state saved, then rebuild the reading from the core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) {
    throw new Error(`unsupported Four Pedal Circles state version ${stateVersion}`);
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("saved Four Pedal Circles position must be an object");
  }
  const C = core();
  let s: State;
  try {
    s = stateFromSaved(C, state);
  } catch (err) {
    return {
      ...state,
      stateVersion,
      valid: false,
      note: `The saved position cannot be read by the core: ${(err as Error).message}`,
    };
  }
  const pedal: PedalReading = pedalReading(C, s);
  const quadrangle: QuadReading = quadrangleReading(C, s);
  const seed = C.start({});
  return {
    ...state,
    stateVersion,
    saved: {
      A: pt(s.A), B: pt(s.B), C: pt(s.C), D: pt(s.D), P: pt(s.P),
      options: {
        showNames: s.showNames, showTriangles: s.showTriangles, showLines: s.showLines,
      },
      moves: s.moves,
      explored: s.explored,
    },
    valid: pedal.valid,
    core: { pedalCircles: pedal, quadrangle },
    note:
      "Track.state saved the five draggable points, the three checkbox options and the move/explored counters; " +
      "it does not save the derived feet, circles or Q. The real core rebuilds all four pedal circles of P and their " +
      "common point Q, and (from A, B, C, D alone) the eight-circle Simson/nine-point concurrence described on the page. " +
      `The core's opening P is (${pt(seed.P)?.x}, ${pt(seed.P)?.y}); the saved P is (${pt(s.P)?.x}, ${pt(s.P)?.y}). ` +
      "This is a demonstration, with no win or loss.",
  };
}
