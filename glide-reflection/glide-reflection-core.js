"use strict";

/*
 * Glide Reflection — the geometry behind Alexander Bogomolny's applet
 * GlideReflection (cut-the-knot.org/Curriculum/Geometry/GlideReflection.shtml).
 *
 * The applet draws one or more arrows and some polygons. Each arrow is a glide
 * reflection: the polygon is slid along the arrow's own line and then flipped in
 * that line. GlideReflectionCanvas.GetVector() returns Start - End, so the arrow
 * points from End (tail) to Start (head) and the slide vector is v = a - b.
 * Because v is parallel to the reflecting line through a and b, sliding then
 * flipping gives exactly the same picture as flipping then sliding. The map is
 * a rigid motion that reverses orientation; if v is not zero it has no fixed
 * point (each point moves at least |v|), and only a zero vector gives an
 * ordinary reflection with the axis fixed point by point.
 *
 * This is the logic only: no document, no window, no storage. It defines one
 * global, GlideReflectionCore, so the page loads it with a plain <script> and
 * porting/check-glide-reflection.mjs loads it in Node. Positions are plain data
 * (points, vectors, polygons and numbers), so they can be saved for the tutor.
 */

const GlideReflectionCore = (() => {
  // The applet's own parameters: WIDTH (400 will do), HEIGHT (300 will do),
  // PVSpin P from 3 to 20 (default 5), PVSpin #GlideReflections from 1 to 20
  // (default 1), and the five Choice entries for the arrow kind.
  const WIDTH = 400;
  const HEIGHT = 300;
  const P_MIN = 3, P_MAX = 20;
  const N_MIN = 1, N_MAX = 20;
  const ARROW_NAMES = ["Line segment", "Full body", "Line arrow", "Filled arrow", "Fixed head"];
  const DEFAULT_KIND = 1; // GlideReflectionCanvas.DefaultVectorKind
  const MIN_SEPARATION = 12; // keeps the reflecting line defined when a handle is dragged
  const OPTION_KEYS = ["n", "p", "arrowKind", "showDrags", "showGhost"];

  /* ------------------------------------------------------------ tiny vectors */

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (p, q) => p.x * q.x + p.y * q.y;
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const round = (v) => Math.round(v * 1000) / 1000;
  const clampPoint = (p) => ({
    x: Math.max(6, Math.min(WIDTH - 6, round(p.x))),
    y: Math.max(6, Math.min(HEIGHT - 6, round(p.y))),
  });
  const copyPoint = (p) => ({ x: p.x, y: p.y });
  const copyPoly = (poly) => poly.map(copyPoint);
  const clampInt = (v, lo, hi, fallback) =>
    Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.trunc(v))) : fallback;

  /** A deterministic xorshift step, standing in for the applet's Math.random(). */
  function nextRandom(seed) {
    let s = (seed >>> 0) || 1;
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5; s >>>= 0;
    return { u: s / 4294967296, seed: s };
  }

  /* ----------------------------------------------------- the transformation */

  /**
   * MoveableVector.GetVector(): Start - End, not End - Start. The applet's
   * arrowhead is at Start, so this is the direction of the arrow.
   */
  const vectorOf = (vec) => sub(vec.a, vec.b);

  /** Foot of the perpendicular from p to line(a,b). */
  function foot(p, a, b) {
    const d = sub(b, a), len2 = dot(d, d);
    if (len2 === 0) return copyPoint(a);
    return add(a, mul(d, dot(sub(p, a), d) / len2));
  }

  /**
   * GeoSDoub.ReflectPointInLine(p, line) rotates p about an endpoint by twice
   * the angle at the other endpoint. For a non-degenerate line that is the
   * usual reflection 2*foot - p; we use the foot directly so the answer stays
   * finite when the two endpoints are dragged together.
   */
  function reflectInLine(p, a, b) {
    const f = foot(p, a, b);
    return sub(mul(f, 2), p);
  }

  const translatePoint = (p, v) => add(p, v);

  /** The applet's order: Translate() first, then ReflectInLine(). */
  function glidePoint(p, a, b, v) {
    return reflectInLine(translatePoint(p, v), a, b);
  }

  /** GlideReflectionCanvas.Translate() over one polygon. */
  const ghost = (vec, poly) => poly.map((p) => translatePoint(p, vectorOf(vec)));

  /** Translate() followed by ReflectInLine() over one polygon. */
  const glide = (vec, poly) => {
    const v = vectorOf(vec);
    return poly.map((p) => glidePoint(p, vec.a, vec.b, v));
  };

  /** ReflectInLine() followed by Translate() — the page says this is the same. */
  const glideReverse = (vec, poly) => {
    const v = vectorOf(vec);
    return poly.map((p) => add(reflectInLine(p, vec.a, vec.b), v));
  };

  /* --------------------------------------------------------------- polygons */

  /** AddNGon's vertex loop: centre plus radius 30 at equal angles. */
  function regularPolygon(center, sides, radius) {
    const points = [];
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI * i) / sides;
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    }
    return points;
  }

  /** AddNGon(int P, double u, double v) with Math.random() replaced by u and v. */
  function polygonFor(sides, u, v) {
    const center = {
      x: Math.trunc((WIDTH * 2) / 3 + u * 30 - 15),
      y: Math.trunc(HEIGHT / 2 + v * 30 - 15),
    };
    return regularPolygon(center, sides, 30);
  }

  /** Reset()'s arrow placement: a in [w/2, 5w/6] x [h/2, 5h/6], b = a + (30,50). */
  function vectorsFor(n, seed) {
    let s = (seed >>> 0) || 1;
    const vectors = [];
    for (let i = 0; i < n; i++) {
      const ux = nextRandom(s); s = ux.seed;
      const uy = nextRandom(s); s = uy.seed;
      const a = {
        x: ((1 + 2 * ux.u) * WIDTH) / 2,
        y: ((1 + 2 * uy.u) * HEIGHT) / 2,
      };
      vectors.push({ a, b: clampPoint(add(a, { x: 30, y: 50 })), kind: DEFAULT_KIND });
    }
    return vectors;
  }

  /** Twice the signed area, positive for a counter-clockwise walk in SVG's y-down axes. */
  function twiceArea(poly) {
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      sum += p.x * q.y - q.x * p.y;
    }
    return sum;
  }

  /** Angle at the middle of three points, in radians. */
  function angleAt(v, p, q) {
    const a = sub(p, v), b = sub(q, v);
    const la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
    if (!la || !lb) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (la * lb))));
  }

  /* --------------------------------------------------------------- positions */

  /** The opening picture. The Java applet opens with no polygon; we add one
   *  pentagon so there is something to transform on the first paint. */
  function start(options) {
    const o = options || {};
    const n = clampInt(o.n, N_MIN, N_MAX, 1);
    const p = clampInt(o.p, P_MIN, P_MAX, 5);
    const seed = Number.isFinite(o.seed) ? (o.seed >>> 0) || 1 : 20261127;
    const arrowKind = clampInt(o.arrowKind, 0, 4, DEFAULT_KIND);
    return {
      vectors: vectorsFor(n, seed).map((v) => ({ ...v, kind: arrowKind })),
      shapes: [polygonFor(p, 0.55, 0.45)],
      n, p,
      arrowKind,
      showDrags: typeof o.showDrags === "boolean" ? o.showDrags : true,
      showGhost: typeof o.showGhost === "boolean" ? o.showGhost : false,
      seed,
      moves: 0,
      explored: false,
    };
  }

  /** The moves a player can make (the drag handles for the first shape only). */
  function legalMoves(state) {
    const n = state ? state.n : 1;
    const p = state ? state.p : 5;
    return [
      ...(n ? [{ type: "point", index: 0, which: "a" }, { type: "point", index: 0, which: "b" }] : []),
      ...Array.from({ length: state && state.shapes.length ? p : 0 }, (_, i) => ({ type: "vertex", shape: 0, vertex: i })),
      ...OPTION_KEYS.map((key) => ({ type: "option", key })),
      { type: "add" }, { type: "remove" }, { type: "reset" },
    ];
  }

  /** The position after a move, or null if the move is not allowed. */
  function move(state, m) {
    if (!state || !m) return null;
    let next = null;
    if (m.type === "point") {
      const i = m.index;
      if (!Number.isInteger(i) || i < 0 || i >= state.vectors.length ||
          (m.which !== "a" && m.which !== "b") || !finite(m.point)) return null;
      const vec = state.vectors[i];
      const point = clampPoint(m.point);
      const a = m.which === "a" ? point : vec.a;
      const b = m.which === "b" ? point : vec.b;
      if (dist(a, b) < MIN_SEPARATION) return null;
      const vectors = state.vectors.map((v, j) =>
        j === i ? { ...v, [m.which]: point } : { a: copyPoint(v.a), b: copyPoint(v.b), kind: v.kind });
      next = { ...state, vectors };
    } else if (m.type === "vertex") {
      const { shape, vertex } = m;
      if (!Number.isInteger(shape) || shape < 0 || shape >= state.shapes.length ||
          !Number.isInteger(vertex) || vertex < 0 || vertex >= state.shapes[shape].length ||
          !finite(m.point)) return null;
      const shapes = state.shapes.map((poly, i) =>
        i === shape ? poly.map((q, j) => (j === vertex ? clampPoint(m.point) : copyPoint(q))) : copyPoly(poly));
      next = { ...state, shapes };
    } else if (m.type === "option") {
      if (!OPTION_KEYS.includes(m.key)) return null;
      if (m.key === "n") {
        const n = m.value;
        if (!Number.isInteger(n) || n < N_MIN || n > N_MAX) return null;
        next = { ...state, n, vectors: n === state.n ? state.vectors : vectorsFor(n, state.seed) };
      } else if (m.key === "p") {
        const p = m.value;
        if (!Number.isInteger(p) || p < P_MIN || p > P_MAX) return null;
        next = { ...state, p }; // like the applet's P spin, this only affects the next Add
      } else if (m.key === "arrowKind") {
        const k = m.value;
        if (!Number.isInteger(k) || k < 0 || k > 4) return null;
        next = { ...state, arrowKind: k, vectors: state.vectors.map((v) => ({ ...v, kind: k })) };
      } else {
        if (typeof m.value !== "boolean") return null;
        next = { ...state, [m.key]: m.value };
      }
    } else if (m.type === "add") {
      const ux = nextRandom(state.seed), uy = nextRandom(ux.seed);
      next = {
        ...state, seed: uy.seed,
        shapes: [...state.shapes.map(copyPoly), polygonFor(state.p, ux.u, uy.u)],
      };
    } else if (m.type === "remove") {
      if (!state.shapes.length) return null;
      next = { ...state, shapes: state.shapes.slice(0, -1).map(copyPoly) };
    } else if (m.type === "reset") {
      const seed = nextRandom(state.seed).seed;
      next = { ...state, seed, vectors: vectorsFor(state.n, seed) };
    }
    if (!next) return null;
    return { ...next, moves: (state.moves || 0) + 1, explored: true };
  }

  /** Nothing can be won: a demo counts as played once it has been changed. */
  const result = (state) => (state && state.explored ? "done" : null);

  /**
   * DrawGlideReflections() chains the arrows: each arrow translates the shapes
   * left by the previous step and reflects that result. With ShowGhost on, the
   * intermediate translated polygons are also returned.
   */
  function compute(state) {
    const originals = state.shapes.map(copyPoly);
    let chain = originals.map(copyPoly);
    const images = [], ghosts = [];
    for (const vec of state.vectors) {
      const translated = chain.map((poly) => ghost(vec, poly));
      if (state.showGhost) ghosts.push(translated.map(copyPoly));
      chain = translated.map((poly) => poly.map((p) => reflectInLine(p, vec.a, vec.b)));
      images.push(chain.map(copyPoly));
    }
    return {
      originals,
      images,
      ghosts,
      vectors: state.vectors.map((v) => ({
        a: copyPoint(v.a), b: copyPoint(v.b), v: vectorOf(v), kind: v.kind,
      })),
    };
  }

  /** Small residuals for the status line and the logic test. */
  function residuals(state) {
    const vec = state.vectors[0];
    const poly = state.shapes[0];
    if (!vec || !poly || poly.length < 3) return null;
    const v = vectorOf(vec);
    let commute = 0, distance = 0, angle = 0, fixedMin = Infinity;
    const image = glide(vec, poly), reverse = glideReverse(vec, poly);
    // The axis is carried to itself as a line: take a point on it first.
    const onAxis = foot(poly[0], vec.a, vec.b);
    const axis = Math.abs(cross(sub(glidePoint(onAxis, vec.a, vec.b, v), vec.a), sub(vec.b, vec.a))) /
      Math.max(1, dist(vec.a, vec.b));
    for (let i = 0; i < poly.length; i++) {
      commute = Math.max(commute, dist(image[i], reverse[i]));
      fixedMin = Math.min(fixedMin, dist(image[i], poly[i]));
      for (let j = i + 1; j < poly.length; j++) {
        distance = Math.max(distance, Math.abs(dist(poly[i], poly[j]) - dist(image[i], image[j])));
      }
      angle = Math.max(angle, Math.abs(
        angleAt(poly[i], poly[(i + 1) % poly.length], poly[(i + 2) % poly.length]) -
        angleAt(image[i], image[(i + 1) % image.length], image[(i + 2) % image.length])));
    }
    return {
      commute, distance, angle, axis, fixedMin, vectorLength: Math.hypot(v.x, v.y),
      orientationFlipped: Math.sign(twiceArea(image)) === -Math.sign(twiceArea(poly)),
    };
  }

  return {
    WIDTH, HEIGHT, P_MIN, P_MAX, N_MIN, N_MAX, ARROW_NAMES, DEFAULT_KIND,
    MIN_SEPARATION, OPTION_KEYS,
    add, sub, mul, dot, cross, dist, finite, clampPoint, nextRandom,
    vectorOf, foot, reflectInLine, translatePoint, glidePoint, glide, glideReverse, ghost,
    regularPolygon, polygonFor, vectorsFor, twiceArea, angleAt,
    start, legalMoves, move, result, compute, residuals,
  };
})();
