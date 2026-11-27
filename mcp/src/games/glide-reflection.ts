/*
 * run_game_logic actions and saved-position reader for Glide Reflection.
 *
 * A glide reflection slides a polygon by v = A - B (the arrow's direction) and
 * flips it in the line through A and B. Every reading below comes from the
 * game's real core (glide-reflection/ in the site), including the page's own
 * residuals for the two orders, the isometry, the orientation flip, the missing
 * fixed point and the axis that is carried to itself only as a set. See
 * _shared.ts for the shape of a game module.
 */

import { cores } from "../generated/cores.js";
import { type GameActions, type Json } from "./_shared.js";

const core = () => cores["glide-reflection"].GlideReflectionCore;

type Point = { x: number; y: number };
type Polygon = Point[];

const round = (v: number): number => Math.round(v * 1e6) / 1e6;
const rpoint = (p: Point): Point => ({ x: round(p.x), y: round(p.y) });
const rpoly = (poly: Polygon): Point[] => poly.map(rpoint);

const numeric = (v: unknown): boolean =>
  (typeof v === "number" || typeof v === "string") && Number.isFinite(Number(v));

/** An action's argument: a required, finite point. */
function point(v: unknown, label: string): Point {
  if (!v || typeof v !== "object") throw new Error(`${label} must be a point with numeric x and y`);
  const p = v as Json;
  if (!numeric(p.x) || !numeric(p.y)) throw new Error(`${label} must be a point with numeric x and y`);
  return { x: Number(p.x), y: Number(p.y) };
}

/** An action's argument: an optional point, with the opening arrow as default. */
function optionalPoint(v: unknown, label: string, fallback: Point): Point {
  return v === undefined || v === null ? fallback : point(v, label);
}

function polygonArg(v: unknown, label: string, fallback: Polygon): Polygon {
  if (v === undefined || v === null) return fallback;
  if (!Array.isArray(v) || v.length < 3) {
    throw new Error(`${label} must be an array of at least 3 points`);
  }
  return v.map((q, i) => point(q, `${label}[${i}]`));
}

function intArg(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`${key} must be an integer from ${lo} to ${hi}`);
  }
  return n;
}

function boolArg(args: Json, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "boolean") throw new Error(`${key} must be a boolean`);
  return v;
}

/* Reading a saved position must never throw on a damaged or older record. */

const isSavedPoint = (v: unknown): boolean =>
  !!v && typeof v === "object" && numeric((v as Json).x) && numeric((v as Json).y);

const savedPoint = (v: unknown, fallback: Point): Point => {
  if (!isSavedPoint(v)) return fallback;
  const p = v as Json;
  return { x: Number(p.x), y: Number(p.y) };
};
const savedInt = (v: unknown, fallback: number, lo: number, hi: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
};
const savedBool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

function savedState(C: ReturnType<typeof core>, state: Json) {
  const base = C.start();
  const vectors = Array.isArray(state.vectors) && state.vectors.length > 0 &&
    state.vectors.every((v) => !!v && typeof v === "object" &&
      isSavedPoint((v as Json).a) && isSavedPoint((v as Json).b))
    ? state.vectors.map((v, i) => {
      const raw = v as Json;
      const fallback = base.vectors[i % base.vectors.length];
      return {
        a: savedPoint(raw.a, fallback.a),
        b: savedPoint(raw.b, fallback.b),
        kind: savedInt(raw.kind, fallback.kind, 0, C.ARROW_NAMES.length - 1),
      };
    })
    : base.vectors;
  const shapes = Array.isArray(state.shapes) &&
    state.shapes.every((poly) => Array.isArray(poly) && poly.every(isSavedPoint))
    ? state.shapes.map((poly) => poly.map((p: unknown) => savedPoint(p, { x: 0, y: 0 })))
    : base.shapes;
  return {
    ...base,
    vectors,
    shapes,
    n: savedInt(state.n, base.n, C.N_MIN, C.N_MAX),
    p: savedInt(state.p, base.p, C.P_MIN, C.P_MAX),
    arrowKind: savedInt(state.arrowKind, base.arrowKind, 0, C.ARROW_NAMES.length - 1),
    showDrags: savedBool(state.showDrags, base.showDrags),
    showGhost: savedBool(state.showGhost, base.showGhost),
    seed: Number.isInteger(Number(state.seed)) && Number(state.seed) >= 0 ? Number(state.seed) : base.seed,
    moves: Number.isFinite(Number(state.moves)) ? Number(state.moves) : 0,
    explored: savedBool(state.explored, false),
  };
}

export function actions(): GameActions {
  return {
    glide: {
      describe:
        "Apply the arrow's glide reflection to a polygon: slide by v = A - B, then flip in line AB. Reports the slide-only copy, the final image, and checks that flipping then sliding gives the same points, that distances and angles stay fixed while orientation reverses, that a nonzero slide leaves no fixed point, and that the axis is carried to itself as a whole rather than pointwise.",
      args: '{ "a": { "x": 200, "y": 150 }, "b": { "x": 170, "y": 200 }, "polygon": [{ "x": 100, "y": 110 }, { "x": 150, "y": 90 }, { "x": 160, "y": 150 }] }',
      run: (args) => {
        const C = core();
        const base = C.start();
        const a = optionalPoint(args.a, "a", base.vectors[0].a);
        const b = optionalPoint(args.b, "b", base.vectors[0].b);
        const poly = polygonArg(args.polygon, "polygon", base.shapes[0]);
        if (C.twiceArea(poly) === 0) throw new Error("polygon must not have zero area");
        const vec = { a, b, kind: C.DEFAULT_KIND };
        const v = C.vectorOf(vec);
        const image = C.glide(vec, poly);
        const reverse = C.glideReverse(vec, poly);
        const r = C.residuals({ ...base, vectors: [vec], shapes: [poly] });
        if (!r) throw new Error("could not measure this polygon");
        return {
          a: rpoint(a), b: rpoint(b),
          slideVector: rpoint(v),
          slideLength: round(Math.hypot(v.x, v.y)),
          polygon: rpoly(poly),
          slideOnly: rpoly(C.ghost(vec, poly)),
          image: rpoly(image),
          reflectThenSlide: rpoly(reverse),
          ordersAgree: r.commute < 1e-7,
          commute: round(r.commute),
          distancesPreserved: r.distance < 1e-7,
          distance: round(r.distance),
          anglesPreserved: r.angle < 1e-7,
          angle: round(r.angle),
          orientationFlipped: r.orientationFlipped,
          axisInvariantAsSet: r.axis < 1e-7,
          axis: round(r.axis),
          fixedMin: round(r.fixedMin),
          noFixedPoint: r.vectorLength > 0 && r.fixedMin >= r.vectorLength - 1e-6,
          note: r.vectorLength > 0
            ? "The axis is mapped onto itself as a line, but its points slide along it by v, so it is not fixed point by point. Every point moves at least |v|, so this glide has no fixed point."
            : "A zero slide needs A and B to coincide, leaving no reflecting line: the core then falls back to a half-turn about A, which keeps orientation and has one fixed point. The page keeps the two arrow ends at least 12 units apart so every real arrow has a nonzero slide.",
        };
      },
    },
    chain: {
      describe:
        "Apply several glide reflections in the order the page draws them: each arrow acts on the previous arrow's image. Reports all slide vectors and the first polygon after every step, with the slide-only copies before each flip when showGhost is on.",
      args: '{ "n": 2, "p": 5, "seed": 20261127, "showGhost": true }',
      run: (args) => {
        const C = core();
        const n = intArg(args, "n", C.start().n, C.N_MIN, C.N_MAX);
        const p = intArg(args, "p", C.start().p, C.P_MIN, C.P_MAX);
        const seed = intArg(args, "seed", 20261127, 0, 4294967295);
        const showGhost = boolArg(args, "showGhost", false);
        const s = C.start({ n, p, seed, showGhost });
        const view = C.compute(s);
        return {
          n, p, seed, showGhost,
          polygons: s.shapes.length,
          vectors: view.vectors.map((v: { a: Point; b: Point; v: Point; kind: number }) =>
            ({ a: rpoint(v.a), b: rpoint(v.b), v: rpoint(v.v), kind: v.kind })),
          original: view.originals.map(rpoly),
          afterEachGlide: view.images.map((step) => step.map(rpoly)),
          slideOnlyBeforeEachGlide: view.ghosts.map((step) => step.map(rpoly)),
          note: `Glide 1 acts on the original polygon; glide 2 acts on glide 1's image, and so on through all ${n} arrows. Each arrow's slide is along its own reflecting line, so the two orders agree at every step.`,
        };
      },
    },
  };
}

/** What the core says about the drawing as the page saved it. */
export function position(state: Json, stateVersion: number): unknown {
  const C = core();
  const s = savedState(C, state);
  const view = C.compute(s);
  const r = C.residuals(s);
  return {
    stateVersion,
    n: s.n,
    p: s.p,
    arrowKind: s.arrowKind,
    arrowName: C.ARROW_NAMES[s.arrowKind],
    showDrags: s.showDrags,
    showGhost: s.showGhost,
    seed: s.seed,
    moves: s.moves,
    explored: s.explored,
    result: C.result(s),
    vectors: view.vectors.map((v: { a: Point; b: Point; v: Point; kind: number }) =>
      ({ a: rpoint(v.a), b: rpoint(v.b), v: rpoint(v.v), kind: v.kind })),
    slideVector: view.vectors.length ? rpoint(view.vectors[0].v) : { x: 0, y: 0 },
    shapes: view.originals.map(rpoly),
    imageCount: view.images.length,
    images: view.images.map((step) => (step.length ? rpoly(step[0]) : [])),
    lastImages: view.images.length ? view.images[view.images.length - 1].map(rpoly) : [],
    slideOnlyCount: view.ghosts.length,
    ghosts: view.ghosts.map((step) => (step.length ? rpoly(step[0]) : [])),
    vectorLength: r ? round(r.vectorLength) : 0,
    commute: r ? round(r.commute) : 0,
    distance: r ? round(r.distance) : 0,
    angle: r ? round(r.angle) : 0,
    axis: r ? round(r.axis) : 0,
    fixedMin: r ? round(r.fixedMin) : 0,
    orientationFlipped: r ? r.orientationFlipped : false,
    ordersAgree: !!r && r.commute < 1e-7,
    isometry: !!r && r.distance < 1e-7 && r.angle < 1e-7,
    axisInvariantAsSet: !!r && r.axis < 1e-7,
    noFixedPoint: !!r && r.vectorLength > 0 && r.fixedMin >= r.vectorLength - 1e-6,
    note: r
      ? r.vectorLength > 0
        ? `${s.n} glide${s.n === 1 ? "" : "s"} slide by (${rpoint(view.vectors[0].v).x}, ${rpoint(view.vectors[0].v).y}); distances and angles are kept, orientation reverses, no point is fixed, and the axis is preserved as a set, not pointwise.`
        : "The saved arrow has zero slide (A = B), so there is no reflecting line: the core falls back to a half-turn about A, with one fixed point."
      : "No polygon with three or more corners is saved, so there is no image to measure.",
  };
}
