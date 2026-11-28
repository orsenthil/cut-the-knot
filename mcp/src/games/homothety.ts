/*
 * run_game_logic actions and saved-position reader for Homothety.
 *
 * The real core is homothety/homothety-core.js, copied verbatim into
 * src/generated/cores/ at build time; every number below is measured by it.
 * A homothety with center O and coefficient k sends P to O + k(P - O), so
 * O, P and P' are collinear and the signed ratio OP'/OP is k. A slider reads
 * k = (V.x - O.x)/(U.x - O.x) whenever O and U are more than a pixel apart;
 * moving O or U instead carries V along and keeps k. Two chained homotheties
 * have coefficient k1*k2: another homothety whose center is on the line of the
 * two old centers, unless the product is 1, when the result is a translation
 * along that line. Coordinates are the applet's 400 x 300 board, y downward.
 * See _shared.ts for the module shape.
 */

import { cores } from "../generated/cores.js";
import { num, type GameActions, type Json } from "./_shared.js";

type Pt = { x: number; y: number };
type Slider = { O: Pt; U: Pt; V: Pt; k: number };
type Transform = { name: string; center: Pt; slider: Slider; seed: number };
type Polygon = { index: number; tint: number; vertices: Pt[]; seed: number };
type State = {
  count: number;
  sides: number;
  seed: number;
  transforms: Transform[];
  polygons: Polygon[];
  showLines: boolean;
  showDragControls: boolean;
  showProduct: boolean;
};
type Composition =
  | { kind: "translation"; dx: number; dy: number }
  | { kind: "homothety"; k: number; center: Pt };
type Core = {
  WIDTH: number;
  HEIGHT: number;
  LIMITS: { count: [number, number]; sides: [number, number] };
  SLIDER: { originX: number; unitX: number; firstValue: number; firstRow: number; rowStep: number };
  start(o?: { count?: number; sides?: number; seed?: number }): State;
  result(s: State): null;
  coefficient(t: Transform): number;
  sliderValue(slider: Slider, v: number): number;
  sliderValuePoint(slider: Slider): number;
  transformPoint(t: Transform, p: Pt): Pt;
  withTransformPoint(s: State, i: number, name: "center" | "O" | "U" | "V", p: Pt): State;
  setCount(s: State, n: number): State;
  addPolygon(s: State, sides?: number): State;
  removeLastPolygon(s: State): State;
  withVertex(s: State, polygonIndex: number, vertexIndex: number, p: Pt): State;
  withFlag(s: State, name: "lines" | "drags" | "product", on: boolean): State;
  images(s: State): Pt[][][];
  finalPolygons(s: State): Pt[][];
  composition(t1: Transform, t2: Transform): Composition;
  applyComposition(h: Composition, p: Pt): Pt;
};

const core = (): Core => cores["homothety"].HomothetyCore as unknown as Core;

/* Only what we print is rounded; the core keeps full precision. */
const r6 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : NaN);
const cn = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? r6(v) : null;
const rp = (p: Pt | null | undefined): { x: number; y: number } | null =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: r6(p.x), y: r6(p.y) } : null;
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y;
const cross = (a: Pt, b: Pt): number => a.x * b.y - a.y * b.x;
const near = (a: number, b: number, tol = 1e-7): boolean =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
const same = (a: Pt, b: Pt, tol = 1e-6): boolean =>
  near(a.x, b.x, tol) && near(a.y, b.y, tol);
const isPlain = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const isPointLike = (v: unknown): boolean =>
  isPlain(v) && Number.isFinite(Number(v.x)) && Number.isFinite(Number(v.y)) &&
  (typeof v.x === "number" || typeof v.x === "string") &&
  (typeof v.y === "number" || typeof v.y === "string");

/** Read a point from either the page's { x, y } form or a tutor's [x, y]. */
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
    throw new Error(`${label} needs finite numeric x and y`);
  }
  return { x, y };
}

function intArg(args: Json, key: string, fallback: number, lo: number, hi: number): number {
  const v = args[key];
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) {
    throw new Error(`argument "${key}" must be an integer from ${lo} to ${hi}`);
  }
  return n;
}

/**
 * Build a core position from action arguments. Every slider change goes through
 * withTransformPoint: "k" is turned into a blue V point with the core's own
 * sliderValuePoint and then read back with its sliderValue, so the coefficient
 * is the one the live page would report.
 */
function buildState(C: Core, args: Json, minCount: number): State {
  if (!isPlain(args)) throw new Error("arguments must be an object");
  const base = C.start();
  const count = Math.max(
    minCount,
    intArg(args, "count", Math.max(minCount, base.count), C.LIMITS.count[0], C.LIMITS.count[1]),
  );
  const sides = intArg(args, "sides", base.sides, C.LIMITS.sides[0], C.LIMITS.sides[1]);
  const seed = intArg(args, "seed", base.seed, 0, 4294967295);
  let s = C.start({ count, sides, seed });

  const raw = args.transforms;
  if (raw !== undefined && raw !== null) {
    if (!Array.isArray(raw) || raw.length < minCount) {
      throw new Error(`argument "transforms" must be an array of at least ${minCount} entries`);
    }
    raw.slice(0, count).forEach((entry, i) => {
      const label = `transforms[${i}]`;
      if (!isPlain(entry)) throw new Error(`${label} must be an object`);
      const spec = entry;
      if (spec.center !== undefined && spec.center !== null) {
        s = C.withTransformPoint(s, i, "center", readPoint(spec.center, `${label}.center`));
      }
      if (spec.O !== undefined && spec.O !== null) {
        s = C.withTransformPoint(s, i, "O", readPoint(spec.O, `${label}.O`));
      }
      if (spec.U !== undefined && spec.U !== null) {
        s = C.withTransformPoint(s, i, "U", readPoint(spec.U, `${label}.U`));
      }
      if (spec.V !== undefined && spec.V !== null && spec.k !== undefined && spec.k !== null) {
        throw new Error(`${label} cannot set both V and k`);
      }
      if (spec.V !== undefined && spec.V !== null) {
        s = C.withTransformPoint(s, i, "V", readPoint(spec.V, `${label}.V`));
      }
      if (spec.k !== undefined && spec.k !== null) {
        const k = num(spec, "k", NaN);
        const slider = s.transforms[i].slider;
        if (Math.abs(slider.U.x - slider.O.x) <= 1) {
          throw new Error(`${label}: O and U must be more than one pixel apart to set k`);
        }
        const target = C.sliderValuePoint({ O: slider.O, U: slider.U, V: slider.V, k });
        s = C.withTransformPoint(s, i, "V", { x: target, y: slider.O.y });
      }
    });
  }
  return s;
}

/** A probe point: the saved P when given, otherwise a spot near the first center. */
function probe(C: Core, s: State, args: Json): Pt {
  const t = s.transforms[0];
  const fallback = t ? { x: t.center.x - 55, y: t.center.y - 35 } : { x: 150, y: 120 };
  return args.P === undefined || args.P === null ? fallback : readPoint(args.P, "P");
}

/** The same transform with a different coefficient, placed on its slider by the core. */
function withK(C: Core, t: Transform, k: number): Transform {
  const sl = t.slider;
  const base = { O: sl.O, U: sl.U, V: sl.V, k: sl.k };
  const V = { x: C.sliderValuePoint({ ...base, k }), y: sl.O.y };
  return { ...t, slider: { ...base, V, k: C.sliderValue({ ...base, V }, V.x) } };
}

/** OP'/OP with signed lengths, collinearity, the inverse and the fixed points. */
function stretchReading(C: Core, t: Transform, P: Pt) {
  const O = t.center;
  const k = C.coefficient(t);
  const image = C.transformPoint(t, P);
  const v = sub(P, O);
  const vp = sub(image, O);
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) throw new Error("argument P must not be the center of the homothety");
  const signedImage = dot(vp, v) / len;
  const ratio = signedImage / len;
  const collinear = Math.abs(cross(v, vp)) <= 1e-7 * Math.max(1, len * len);
  const slider = t.slider;
  const run = slider.U.x - slider.O.x;

  let inverse: Json | null = null;
  if (k !== 0) {
    const back = withK(C, t, 1 / k);
    const roundTripForward = C.transformPoint(back, image);
    const roundTripBackward = C.transformPoint(t, C.transformPoint(back, P));
    const pair = C.composition(t, back);
    inverse = {
      k: cn(C.coefficient(back)),
      compositionKind: pair.kind,
      composition: pair.kind === "translation"
        ? { dx: cn(pair.dx), dy: cn(pair.dy) }
        : { k: cn(pair.k), center: rp(pair.center) },
      inverseThenH: rp(roundTripForward),
      HThenInverse: rp(roundTripBackward),
      identity: same(roundTripForward, P) && same(roundTripBackward, P),
    };
  }

  return {
    center: rp(O),
    slider: { O: rp(slider.O), U: rp(slider.U), V: rp(slider.V) },
    sliderRun: r6(run),
    sliderReadable: Math.abs(run) > 1,
    k: cn(k),
    sliderValue: cn(C.sliderValue(slider, slider.V.x)),
    sliderValuePoint: cn(C.sliderValuePoint(slider)),
    P: rp(P),
    image: rp(image),
    vectorOP: rp(v),
    vectorOPPrime: rp(vp),
    signedOP: cn(len),
    signedOPPrime: cn(signedImage),
    ratio: cn(ratio),
    ratioIsK: near(ratio, k, 1e-9),
    collinear,
    crossProduct: cn(cross(v, vp)),
    side: k > 0 ? "same side of the center" : k < 0 ? "opposite side of the center" : "at the center",
    areaScale: cn(k * k),
    orientationPreserved: k !== 0,
    fixed: k === 1 ? "every point (the identity)" : "the center only",
    inverse,
    note: k === 0
      ? `k = 0 sends every point to O = (${r6(O.x)}, ${r6(O.y)}), so OP' is zero and there is no inverse.`
      : `k = ${r6(k)} makes OP' / OP = ${r6(ratio)} as a signed ratio and keeps O, P and P' on one line: P' is on the ${k > 0 ? "same" : "opposite"} side of O. Areas scale by k² = ${r6(k * k)}, orientation is kept for any nonzero k, ${k === 1 ? "so nothing moves" : "and only the center is fixed"}${inverse ? "; a stretch by 1/k undoes it in either order" : ""}.`,
  };
}

/** H2 after H1: coefficient k1k2, center on C1C2, or a translation when k1k2 = 1. */
function compositionReading(C: Core, t1: Transform, t2: Transform, P: Pt) {
  const k1 = C.coefficient(t1);
  const k2 = C.coefficient(t2);
  const h = C.composition(t1, t2);
  const reverse = C.composition(t2, t1);
  const chained = C.transformPoint(t2, C.transformPoint(t1, P));
  const closed = C.applyComposition(h, P);
  const reversedImage = C.applyComposition(reverse, P);
  const d = sub(t2.center, t1.center);
  const tol = 1e-6 * Math.max(1, Math.hypot(d.x, d.y));
  const sameCenter = same(t1.center, t2.center, 1e-9);
  const K = k1 * k2;

  const shape = (m: Composition): Json => m.kind === "translation"
    ? { kind: "translation", dx: cn(m.dx), dy: cn(m.dy) }
    : { kind: "homothety", k: cn(m.k), center: rp(m.center) };

  let translationCase: Json | null = null;
  if (k1 !== 0) {
    const inverseSecond = withK(C, t2, 1 / k1);
    const m = C.composition(t1, inverseSecond);
    if (m.kind === "translation") {
      translationCase = {
        k1: cn(k1),
        k2: cn(C.coefficient(inverseSecond)),
        dx: cn(m.dx),
        dy: cn(m.dy),
        length: cn(Math.hypot(m.dx, m.dy)),
        parallelToCenters: Math.abs(cross({ x: m.dx, y: m.dy }, d)) <= tol,
        identity: sameCenter && near(m.dx, 0, 1e-6) && near(m.dy, 0, 1e-6),
      };
    }
  }

  const composition: Json = h.kind === "translation"
    ? {
        ...shape(h),
        length: cn(Math.hypot(h.dx, h.dy)),
        parallelToCenters: Math.abs(cross({ x: h.dx, y: h.dy }, d)) <= tol,
      }
    : {
        ...shape(h),
        centerOnLineOfOldCenters: Math.abs(cross(sub(h.center, t1.center), d)) <= tol,
      };

  return {
    H1: { center: rp(t1.center), k: cn(k1) },
    H2: { center: rp(t2.center), k: cn(k2) },
    product: cn(K),
    composition,
    reverseComposition: shape(reverse),
    P: rp(P),
    chainedImage: rp(chained),
    closedFormImage: rp(closed),
    agree: same(chained, closed, 1e-5),
    commute: same(closed, reversedImage, 1e-5),
    sameCenter,
    inverseCase: translationCase !== null && translationCase.identity === true,
    translationCase,
    note: h.kind === "translation"
      ? `k1·k2 = ${r6(K)} makes the P term vanish: H2 after H1 is a translation by (${r6(h.dx)}, ${r6(h.dy)}), parallel to the line of the two centers${sameCenter ? ", and with equal centers it is the identity (the inverse case)" : ""}.`
      : `k1·k2 = ${r6(K)}, so H2 after H1 is another homothety with that coefficient and its center on the line through the two old centers. ${same(closed, reversedImage, 1e-5) ? "These two commute" : "These two do not commute"}: order matters when the centers differ.`,
  };
}

export function actions(): GameActions {
  return {
    stretch_ratio: {
      describe:
        "Move one homothety's blue center and its orange zero, red one and blue coefficient points, and read the coefficient from the real slider arithmetic. Pass a transform object with any of center, O, U, V (each [x, y] or { x, y } on the 400 x 300 board) or a number k, which places V with the core's own slider formula; omitting a slider point keeps the opening one. With a probe point P it reports OP' = O + k(P - O), the signed lengths OP and OP' and their ratio k, collinearity, the sign (same or opposite side), how areas scale, what is fixed, and the inverse stretch by 1/k. The example sets k = -1, a half-turn about (310, 234).",
      args: '{"transforms":[{"center":{"x":310,"y":234},"k":-1}],"P":{"x":280,"y":200}}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args, 1);
        return stretchReading(C, s.transforms[0], probe(C, s, args));
      },
    },

    composition: {
      describe:
        "Compose two homotheties H1 then H2 with the real core, each transform accepting the same center/O/U/V/k fields as stretch_ratio. Reports k1, k2 and their product K, the chained image of a probe point P beside the closed form, the combined coefficient and center (on the line of the old centers) or, when K = 1, the translation vector along that line; also checks the reverse order and includes the translation/inverse case with k2 = 1/k1. The example uses k1 = -1 about (100, 150) and k2 = 2 about (250, 150), whose product is a stretch by -2 about (50, 150).",
      args: '{"transforms":[{"center":{"x":100,"y":150},"k":-1},{"center":{"x":250,"y":150},"k":2}],"P":{"x":170,"y":120}}',
      run: (args) => {
        const C = core();
        const s = buildState(C, args, 2);
        return compositionReading(C, s.transforms[0], s.transforms[1], probe(C, s, args));
      },
    },
  };
}

/* Reading a saved position must not throw on a damaged or older record. */

const savedPoint = (v: unknown, fallback: Pt): Pt =>
  isPointLike(v) ? { x: Number((v as Json).x), y: Number((v as Json).y) } : fallback;
const savedInt = (v: unknown, fallback: number, lo: number, hi: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
};
const savedBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

/** Rebuild the page's saved picture through the core, falling back where damaged. */
function savedState(C: Core, state: Json): { s: State; readable: boolean } {
  const base = C.start();
  const count = savedInt(state.count, base.count, C.LIMITS.count[0], C.LIMITS.count[1]);
  const sides = savedInt(state.sides, base.sides, C.LIMITS.sides[0], C.LIMITS.sides[1]);
  const seed = savedInt(state.seed, base.seed, 0, 4294967295);
  let s = C.start({ count, sides, seed });
  let readable = count === Number(state.count) && sides === Number(state.sides) &&
    seed === Number(state.seed);

  const rawTs = state.transforms;
  if (Array.isArray(rawTs) && rawTs.length >= count) {
    for (let i = 0; i < count; i++) {
      const raw: unknown = rawTs[i];
      if (!isPlain(raw) || !isPlain(raw.slider)) {
        readable = false;
        continue;
      }
      const t = s.transforms[i];
      const center = savedPoint(raw.center, t.center);
      const O = savedPoint(raw.slider.O, t.slider.O);
      const U = savedPoint(raw.slider.U, t.slider.U);
      const V = savedPoint(raw.slider.V, t.slider.V);
      if (!isPointLike(raw.center) || !isPointLike(raw.slider.O) ||
          !isPointLike(raw.slider.U) || !isPointLike(raw.slider.V)) {
        readable = false;
      }
      s = C.withTransformPoint(s, i, "center", center);
      s = C.withTransformPoint(s, i, "O", O);
      s = C.withTransformPoint(s, i, "U", U);
      s = C.withTransformPoint(s, i, "V", V);
      if (Number.isFinite(Number(raw.slider.k)) &&
          !near(C.coefficient(s.transforms[i]), Number(raw.slider.k), 1e-6)) {
        readable = false;
      }
    }
  } else {
    readable = false;
  }

  const rawPolys = state.polygons;
  if (Array.isArray(rawPolys)) {
    for (const raw of rawPolys) {
      if (!isPlain(raw) || !Array.isArray(raw.vertices) || raw.vertices.length < 3 ||
          raw.vertices.length > 20 || !raw.vertices.every(isPointLike)) {
        readable = false;
        continue;
      }
      s = C.addPolygon(s, raw.vertices.length);
      const pi = s.polygons.length - 1;
      raw.vertices.forEach((p: unknown, vi: number) => {
        s = C.withVertex(s, pi, vi, savedPoint(p, { x: 0, y: 0 }));
      });
    }
  } else {
    readable = false;
  }
  // addPolygon advances the seed (and may reset the side count); the record's
  // own seed and side count are what we echo and measure with.
  s = { ...s, seed, sides };
  s = C.withFlag(s, "lines", savedBool(state.showLines, base.showLines));
  s = C.withFlag(s, "drags", savedBool(state.showDragControls, base.showDragControls));
  s = C.withFlag(s, "product", savedBool(state.showProduct, base.showProduct));
  return { s, readable };
}

/** Echo Track.state's fields, then re-measure the picture with the real core. */
export function position(state: Json, stateVersion: number): unknown {
  if (stateVersion !== 1) throw new Error(`unsupported Homothety state version ${stateVersion}`);
  if (!isPlain(state)) throw new Error("saved Homothety position must be an object");
  const C = core();
  const { s, readable } = savedState(C, state);
  const first = s.transforms[0];
  const fallbackProbe = first ? { x: first.center.x - 60, y: first.center.y - 40 } : { x: 150, y: 120 };
  let P: Pt = s.polygons.length ? s.polygons[0].vertices[0] : fallbackProbe;
  if (first && Math.hypot(P.x - first.center.x, P.y - first.center.y) < 1e-9) P = fallbackProbe;
  const stretch = first ? stretchReading(C, first, P) : null;
  const composition = s.transforms.length > 1
    ? compositionReading(C, s.transforms[0], s.transforms[1], P)
    : null;

  return {
    stateVersion,
    savedReadable: readable,
    count: s.count,
    sides: s.sides,
    seed: s.seed,
    transforms: s.transforms.map((t) => ({
      name: t.name,
      center: rp(t.center),
      slider: { O: rp(t.slider.O), U: rp(t.slider.U), V: rp(t.slider.V) },
      k: cn(C.coefficient(t)),
    })),
    polygons: s.polygons.map((p) => ({
      index: p.index,
      tint: cn(p.tint),
      vertices: p.vertices.map(rp),
    })),
    showLines: s.showLines,
    showDragControls: s.showDragControls,
    showProduct: s.showProduct,
    coefficients: s.transforms.map((t) => cn(C.coefficient(t))),
    probe: rp(P),
    stretch,
    composition,
    imageChain: C.images(s).map((layer) => layer.map((poly) => poly.map(rp))),
    finalPolygons: C.finalPolygons(s).map((poly) => poly.map(rp)),
    result: C.result(s),
    note: !readable
      ? "Some saved fields could not be read, so the opening arrangement was reconstructed and the readings below come from it."
      : `Track.state saved ${s.count} homothety slider${s.count === 1 ? "" : "s"}, ${s.polygons.length} polygon${s.polygons.length === 1 ? "" : "s"}, the seed, the side count and the three presentation boxes. The core reports k = ${s.transforms.map((t) => cn(C.coefficient(t))).join(", ")}${composition ? ` and a combined coefficient of ${cn(C.coefficient(s.transforms[0]) * C.coefficient(s.transforms[1]))}` : ""}. This is a demonstration with no win or loss.`,
  };
}
